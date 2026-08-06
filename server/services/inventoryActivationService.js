/**
 * Secure inventory token activation — idempotency, transaction log, atomic consume.
 */

const { resolveInventoryToken } = require('../config/inventoryTokens');
const { activatePerkItem } = require('./perkBoostService');
const { getPerkMachineStatus } = require('./perkMachineService');
const { ensureProgressDocuments } = require('./battlePassPersistenceService');
const { computeTierFromXp } = require('../lib/battlePassConfig');
const { grantProfileXp } = require('./profileXpService');

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_TRANSACTIONS = 200;

async function grantInstantInventoryXp(user, def, idempotencyKey) {
  const pendingXpBreakdown = {};
  const bpKey = `${idempotencyKey}:bp_xp`;
  if (def.instantBpXp > 0) {
    const amount = Math.max(0, Math.round(Number(def.instantBpXp) || 0));
    const { bp } = await ensureProgressDocuments(user._id);
    const alreadyGranted = (bp.claimedRewardIds || []).includes(bpKey);
    if (!alreadyGranted) {
      const beforeXp = Number(bp.xp) || 0;
      const tierBefore = bp.tier;
      bp.xp = beforeXp + amount;
      bp.tier = computeTierFromXp(bp.xp);
      bp.claimedRewardIds = [...(bp.claimedRewardIds || []), bpKey];
      await bp.save();
      pendingXpBreakdown.baseXp = amount;
      pendingXpBreakdown.tokenBonus = 0;
      pendingXpBreakdown.totalXp = amount;
      pendingXpBreakdown.battlePass = {
        beforeXp,
        afterXp: bp.xp,
        tierBefore,
        tierAfter: bp.tier,
      };
    }
  }
  if (def.instantProfileXp > 0) {
    const amount = Math.max(0, Math.round(Number(def.instantProfileXp) || 0));
    const profileResult = await grantProfileXp(user, {
      amount,
      source: 'inventory_token',
      idempotencyKey: `${idempotencyKey}:profile_xp`,
      metadata: { itemType: def.itemType },
    });
    pendingXpBreakdown.profileXp = profileResult.amount || amount;
    pendingXpBreakdown.profile = profileResult.progress || null;
    if (!pendingXpBreakdown.baseXp) {
      pendingXpBreakdown.baseXp = amount;
      pendingXpBreakdown.tokenBonus = Math.max(0, (profileResult.amount || amount) - amount);
      pendingXpBreakdown.totalXp = profileResult.amount || amount;
    }
  }
  return Object.keys(pendingXpBreakdown).length ? pendingXpBreakdown : null;
}

function pruneTransactions(pm) {
  if (!Array.isArray(pm.inventoryTransactions)) return;
  const now = Date.now();
  pm.inventoryTransactions = pm.inventoryTransactions
    .filter((row) => {
      if (!row?.createdAt) return true;
      return now - new Date(row.createdAt).getTime() < IDEMPOTENCY_TTL_MS;
    })
    .slice(-MAX_TRANSACTIONS);
}

function findIdempotentResult(user, idempotencyKey) {
  const rows = user?.perkMachine?.inventoryTransactions || [];
  return rows.find((r) => r.idempotencyKey === idempotencyKey && r.resultSnapshot);
}

/**
 * @param {import('../models/User')} user
 * @param {{ itemType?: string, itemKey?: string, idempotencyKey: string }} payload
 */
async function useInventoryToken(user, payload = {}) {
  const itemType = String(payload.itemType || payload.itemKey || '').trim();
  const idempotencyKey = String(payload.idempotencyKey || '').trim();
  if (!itemType) {
    const err = new Error('itemType is required.');
    err.status = 400;
    err.code = 'INVALID_ITEM';
    throw err;
  }
  if (!idempotencyKey) {
    const err = new Error('idempotencyKey is required.');
    err.status = 400;
    err.code = 'IDEMPOTENCY_REQUIRED';
    throw err;
  }

  const def = resolveInventoryToken(itemType);
  if (!def) {
    const err = new Error('That item cannot be activated.');
    err.status = 400;
    err.code = 'INVALID_ITEM';
    throw err;
  }

  if (!user.perkMachine) user.perkMachine = {};
  const pm = user.perkMachine;
  if (!Array.isArray(pm.inventoryTransactions)) pm.inventoryTransactions = [];
  pruneTransactions(pm);

  const prior = findIdempotentResult(user, idempotencyKey);
  if (prior?.resultSnapshot) {
    return {
      ...prior.resultSnapshot,
      duplicate: true,
      success: true,
    };
  }

  const inFlight = pm.inventoryTransactions.find(
    (r) => r.idempotencyKey === idempotencyKey && r.status === 'processing'
  );
  if (inFlight) {
    const err = new Error('Activation already in progress.');
    err.status = 409;
    err.code = 'ACTIVATION_IN_FLIGHT';
    throw err;
  }

  pm.inventoryTransactions.push({
    itemType: def.itemType,
    action: 'inventory_token_used',
    idempotencyKey,
    status: 'processing',
    quantityBefore: null,
    quantityAfter: null,
    createdAt: new Date(),
  });
  user.markModified('perkMachine');

  let result;
  try {
    result = activatePerkItem(user, def.itemType, {
      sourceInventoryItemId: def.itemType,
    });
  } catch (err) {
    pm.inventoryTransactions = pm.inventoryTransactions.filter(
      (r) => !(r.idempotencyKey === idempotencyKey && r.status === 'processing')
    );
    user.markModified('perkMachine');
    throw err;
  }

  let pendingXpBreakdown = null;
  if (def.kind === 'boost') {
    try {
      pendingXpBreakdown = await grantInstantInventoryXp(user, def, idempotencyKey);
    } catch (xpErr) {
      // eslint-disable-next-line no-console
      console.error('[inventory/use] instant XP grant failed', xpErr?.message);
    }
  }

  const status = getPerkMachineStatus(user);
  let message = `${def.label} activated.`;
  if (result.boost?.extended) {
    message = `${def.label} extended by 30 minutes.`;
  } else if (result.freeSpins) {
    message = 'Free spin added.';
  } else if (result.streakShield) {
    message = 'Shield Activated — your streak is protected for 24 hours.';
  } else if (result.scoutFlightLaunch) {
    message = 'Scout Flight ready — launching now.';
  } else if (pendingXpBreakdown?.totalXp) {
    message = `+${pendingXpBreakdown.totalXp} XP granted.`;
  }

  const response = {
    success: true,
    consumed: true,
    duplicate: false,
    itemType: def.itemType,
    inventoryQuantity: result.inventoryQuantity,
    activation: result.activation || null,
    boost: result.boost || null,
    freeSpins: result.freeSpins || null,
    freeSpinsTotal: result.freeSpinsTotal ?? status.extraFreeSpins,
    autoSpin: Boolean(result.autoSpin),
    streakShield: result.streakShield || null,
    scoutFlightLaunch: Boolean(result.scoutFlightLaunch),
    pendingXpBreakdown,
    navigationTarget: result.navigationTarget,
    presentation: result.presentation,
    message,
    activeBoosts: status.activeBoosts,
    inventory: {
      tokens: status.tokens,
      eggInventory: status.eggInventory,
      extraFreeSpins: status.extraFreeSpins,
    },
    transactionAction: result.transactionAction,
  };

  const txIdx = pm.inventoryTransactions.findIndex(
    (r) => r.idempotencyKey === idempotencyKey && r.status === 'processing'
  );
  if (txIdx >= 0) {
    pm.inventoryTransactions[txIdx] = {
      ...pm.inventoryTransactions[txIdx],
      status: 'completed',
      action: result.transactionAction || 'inventory_token_used',
      quantityBefore: result.quantityBefore,
      quantityAfter: result.quantityAfter,
      resultSnapshot: response,
      completedAt: new Date(),
    };
  }
  user.markModified('perkMachine');

  return response;
}

module.exports = {
  useInventoryToken,
};
