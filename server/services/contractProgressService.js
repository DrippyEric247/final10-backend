/**
 * Server-side Savvy Contracts progress — only trusted hooks may advance progress.
 */
const User = require('../models/User');
const ContractProgress = require('../models/ContractProgress');
const {
  getContractsForTrigger,
  getContractById,
  periodKeyForContract,
  utcDayKey,
} = require('../config/contracts');
const {
  isContractExpired,
  isContractDiscovered,
} = require('../lib/contractUtils');

async function getOrCreateProgress(userId, contract) {
  const periodKey = periodKeyForContract(contract);
  const target = Math.max(1, Math.round(Number(contract.target) || 1));

  let row = await ContractProgress.findOne({ userId, contractId: contract.id, periodKey });
  if (!row) {
    try {
      row = await ContractProgress.create({
        userId,
        contractId: contract.id,
        appId: contract.appId,
        scope: contract.scope || 'app',
        periodKey,
        progress: 0,
        target,
      });
    } catch (e) {
      if (e?.code === 11000) {
        row = await ContractProgress.findOne({ userId, contractId: contract.id, periodKey });
      } else {
        throw e;
      }
    }
  }
  return row;
}

/**
 * Record progress for all contracts matching a trusted trigger.
 */
async function recordContractTrigger(userId, trigger, opts = {}) {
  const increment = Math.max(1, Math.round(Number(opts.increment) || 1));
  const contracts = getContractsForTrigger(trigger);
  if (!contracts.length) return [];

  const completed = [];
  const now = new Date();

  for (const contract of contracts) {
    if (isContractExpired(contract, now)) continue;

    const row = await getOrCreateProgress(userId, contract);
    if (row.claimedAt) {
      completed.push({ contractId: contract.id, alreadyClaimed: true });
      continue;
    }
    if (row.completedAt) {
      completed.push({ contractId: contract.id, alreadyComplete: true });
      continue;
    }

    let nextProgress = Math.min(row.target, (Number(row.progress) || 0) + increment);

    const patch = {
      progress: nextProgress,
      lastTrigger: trigger,
      meta: {
        ...(row.meta || {}),
        ...(opts.meta || {}),
        discovered: true,
      },
    };

    if (contract.isHidden && !isContractDiscovered(contract, row)) {
      patch.meta.discovered = true;
    }

    if (nextProgress >= row.target && !row.completedAt) {
      patch.completedAt = now;
    }

    await ContractProgress.updateOne({ _id: row._id }, { $set: patch });

    if (patch.completedAt) {
      completed.push({ contractId: contract.id, completed: true, progress: nextProgress });
    }
  }

  return completed;
}

async function isContractCompleteOnServer(userId, contract) {
  if (isContractExpired(contract)) return false;

  const periodKey = periodKeyForContract(contract);
  const row = await ContractProgress.findOne({
    userId,
    contractId: contract.id,
    periodKey,
  }).lean();

  if (!row) return false;
  if (row.claimedAt) return true;
  if (row.completedAt) return true;
  return Number(row.progress) >= Number(row.target);
}

async function getContractProgressRows(userId, { appId } = {}) {
  const query = { userId };
  const rows = await ContractProgress.find(query).sort({ updatedAt: -1 }).lean();
  if (!appId) return rows;
  return rows.filter(
    (r) => r.appId === appId || r.scope === 'universe' || r.appId === 'universe'
  );
}

async function tryAcquireContractClaim(userId, contract) {
  if (isContractExpired(contract)) {
    return { ok: false, error: 'contract_expired' };
  }

  const periodKey = periodKeyForContract(contract);

  const row = await ContractProgress.findOneAndUpdate(
    {
      userId,
      contractId: contract.id,
      periodKey,
      claimedAt: null,
      completedAt: { $ne: null },
    },
    { $set: { claimedAt: new Date() } },
    { new: true }
  );

  if (row) {
    return { ok: true, periodKey };
  }

  const existing = await ContractProgress.findOne({
    userId,
    contractId: contract.id,
    periodKey,
  }).lean();

  if (existing?.claimedAt) {
    return { ok: false, error: 'already_claimed' };
  }
  if (isContractExpired(contract)) {
    return { ok: false, error: 'contract_expired' };
  }

  return { ok: false, error: 'contract_not_complete' };
}

async function releaseContractClaim(userId, contract, periodKey) {
  await ContractProgress.updateOne(
    { userId, contractId: contract.id, periodKey, claimedAt: { $ne: null } },
    { $unset: { claimedAt: 1 } }
  );
}

async function recordContractProgressFromProgressionEvent(userId, eventType) {
  const { PROGRESSION_EVENT_TO_CONTRACT_TRIGGER } = require('../config/contracts');
  const trigger = PROGRESSION_EVENT_TO_CONTRACT_TRIGGER[eventType];
  if (!trigger) return [];
  return recordContractTrigger(userId, trigger);
}

async function updateCrossAppContractProgress(userId, sourceAppId, claimedContractId) {
  const crossDef = getContractById('universe_multi_app_contracts');
  if (!crossDef) return;

  const periodKey = periodKeyForContract(crossDef);
  const row = await getOrCreateProgress(userId, crossDef);
  const claims = Array.isArray(row.meta?.claims) ? [...row.meta.claims] : [];
  claims.push({
    appId: String(sourceAppId || 'final10'),
    contractId: claimedContractId,
    at: new Date().toISOString(),
  });

  const distinctApps = new Set(claims.map((c) => c.appId)).size;
  const minApps = Math.max(2, Number(crossDef.minDistinctApps) || 2);
  const eligibleCount = distinctApps >= minApps ? claims.length : 0;
  const nextProgress = Math.min(row.target, eligibleCount);

  const patch = {
    progress: nextProgress,
    lastTrigger: 'contract_claimed_cross_app',
    meta: { claims, distinctApps, minDistinctApps: minApps },
  };

  if (nextProgress >= row.target && !row.completedAt && !row.claimedAt) {
    patch.completedAt = new Date();
  }

  await ContractProgress.updateOne({ _id: row._id }, { $set: patch });
}

/** Track app opens for future cross-app objectives — no fake progress. */
async function recordContractAppOpen(userId, appId) {
  const key = String(appId || 'final10').trim();
  const day = utcDayKey();
  const user = await User.findById(userId);
  if (!user) return;

  if (!user.contractsMeta) user.contractsMeta = { appOpens: [] };
  const opens = user.contractsMeta.appOpens || [];
  const exists = opens.some((o) => o.appId === key && o.day === day);
  if (!exists) {
    opens.push({ appId: key, day, at: new Date() });
    user.contractsMeta.appOpens = opens.slice(-90);
    user.markModified('contractsMeta');
    await user.save();
  }
}

async function recordContractClaimed(userId, contract, { sourceAppId = 'final10' } = {}) {
  await recordContractTrigger(userId, 'contract_claimed', { increment: 1 });
  await updateCrossAppContractProgress(userId, sourceAppId, contract.id);
}

module.exports = {
  recordContractTrigger,
  isContractCompleteOnServer,
  getContractProgressRows,
  tryAcquireContractClaim,
  releaseContractClaim,
  recordContractProgressFromProgressionEvent,
  recordContractClaimed,
  recordContractAppOpen,
  getOrCreateProgress,
};
