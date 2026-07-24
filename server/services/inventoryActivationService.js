/**
 * Secure inventory token activation — idempotency, transaction log, atomic consume.
 */

const { resolveInventoryToken } = require('../config/inventoryTokens');
const { activatePerkItem } = require('./perkBoostService');
const { getPerkMachineStatus } = require('./perkMachineService');

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_TRANSACTIONS = 200;

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

  const status = getPerkMachineStatus(user);
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
    navigationTarget: result.navigationTarget,
    presentation: result.presentation,
    message: result.boost?.extended
      ? `${def.label} extended by 30 minutes.`
      : result.freeSpins
        ? 'Free spin added.'
        : `${def.label} activated.`,
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
