const { grantContractReward } = require('./contractRewardService');
const {
  getContractById,
  getContractsForApp,
  getUniverseContracts,
  periodKeyForContract,
  DEFAULT_CONTRACTS_APP_ID,
  utcDayKey,
} = require('../config/contracts');
const {
  getContractProgressRows,
  tryAcquireContractClaim,
  releaseContractClaim,
  recordContractClaimed,
  isContractCompleteOnServer,
} = require('./contractProgressService');
const {
  resolveContractExpiresAt,
  isContractExpired,
  maskContractForClient,
  computeContractStreak,
  formatMsRemaining,
} = require('../lib/contractUtils');

function formatRewardLabel(reward) {
  if (!reward) return '';
  if (reward.label) return reward.label;
  if (reward.type === 'savvy' || reward.type === 'savvy_coins') return `+${reward.amount || 0} Savvy`;
  if (reward.type === 'perk_spin') return `+${reward.amount || 1} Perk Spin`;
  if (reward.type === 'egg') return `+${reward.amount || 1} Egg`;
  if (reward.type === 'scout_flight_ticket') return `+${reward.amount || 1} Tournament Ticket`;
  if (reward.type === 'cosmetic') return 'Exclusive Cosmetic';
  if (reward.type === 'contract_xp') return `+${reward.amount || 0} Contract XP`;
  if (reward.type === 'multiplier') return 'Savvy Multiplier Token';
  if (reward.type === 'hidden') return 'Classified Reward';
  return reward.type;
}

function mergeContractWithProgress(contract, row, now = new Date()) {
  const masked = maskContractForClient(contract, row);
  const periodKey = periodKeyForContract(contract, now);
  const progress = row && row.periodKey === periodKey ? Number(row.progress) || 0 : 0;
  const target = Math.max(1, Number(contract.target) || 1);
  const expired = isContractExpired(contract, now, { periodKey: row?.periodKey || periodKey });
  const isCompleted =
    !expired &&
    (Boolean(row?.completedAt && row.periodKey === periodKey) || progress >= target);
  const isClaimed = Boolean(row?.claimedAt && row.periodKey === periodKey);
  const expiresAt = resolveContractExpiresAt(contract, now);
  const expiresInMs = expiresAt ? expiresAt.getTime() - now.getTime() : null;

  return {
    id: masked.id,
    appId: masked.appId,
    appLabel: masked.appLabel,
    scope: masked.scope,
    title: masked.title,
    description: masked.description,
    type: masked.type,
    difficulty: masked.difficulty || null,
    icon: masked.icon,
    target,
    progress: Math.min(progress, target),
    periodKey,
    reward: masked.reward || contract.reward,
    rewardLabel: formatRewardLabel(masked.reward || contract.reward),
    isHidden: Boolean(contract.isHidden),
    isDiscovered: masked.isDiscovered !== false,
    isCompleted,
    isClaimed,
    isExpired: expired,
    canClaim: isCompleted && !isClaimed && !expired,
    completedAt: row?.periodKey === periodKey ? row.completedAt : null,
    claimedAt: row?.periodKey === periodKey ? row.claimedAt : null,
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
    expiresInMs,
    expiresLabel: expiresAt ? formatMsRemaining(expiresInMs) : null,
  };
}

async function buildProgressMap(userId) {
  const rows = await getContractProgressRows(userId);
  const map = new Map();
  for (const row of rows) {
    map.set(`${row.contractId}:${row.periodKey}`, row);
  }
  return { rows, map };
}

function listVisibleAppContracts(appDefs, map, now) {
  return appDefs
    .filter((contract) => {
      if (!contract.isHidden) return true;
      const row = map.get(`${contract.id}:${periodKeyForContract(contract, now)}`);
      return Boolean(row);
    })
    .map((contract) =>
      mergeContractWithProgress(contract, map.get(`${contract.id}:${periodKeyForContract(contract, now)}`), now)
    );
}

async function getContractsHubForUser(userId, appId = DEFAULT_CONTRACTS_APP_ID) {
  const key = String(appId || DEFAULT_CONTRACTS_APP_ID).trim();
  const now = new Date();
  const { rows, map } = await buildProgressMap(userId);

  const appDefs = getContractsForApp(key);
  const universeDefs = getUniverseContracts();

  const appContracts = listVisibleAppContracts(appDefs, map, now);
  const universeContracts = universeDefs.map((c) =>
    mergeContractWithProgress(c, map.get(`${c.id}:${periodKeyForContract(c, now)}`), now)
  );

  const today = utcDayKey(now);
  const completedToday = rows.filter(
    (r) => r.completedAt && r.completedAt.toISOString().slice(0, 10) === today
  ).length;

  const claimedTodaySavvy = rows
    .filter((r) => r.claimedAt && r.claimedAt.toISOString().slice(0, 10) === today)
    .reduce((sum, r) => {
      const def = getContractById(r.contractId);
      const type = def?.reward?.type;
      return sum + (type === 'savvy' || type === 'savvy_coins' ? Number(def.reward.amount) || 0 : 0);
    }, 0);

  const visible = [...appContracts, ...universeContracts];
  const activeCount = visible.filter((c) => !c.isExpired && (!c.isCompleted || c.canClaim)).length;
  const claimableCount = visible.filter((c) => c.canClaim).length;
  const contractStreak = computeContractStreak(rows);

  const completedRecent = rows
    .filter((r) => r.claimedAt)
    .sort((a, b) => new Date(b.claimedAt) - new Date(a.claimedAt))
    .slice(0, 12)
    .map((r) => {
      const def = getContractById(r.contractId);
      if (!def) return null;
      return mergeContractWithProgress(def, r, now);
    })
    .filter(Boolean);

  return {
    appId: key,
    appLabel: key === 'final10' ? 'FINAL10' : key.toUpperCase(),
    summary: {
      activeCount,
      claimableCount,
      completedToday,
      savvyEarnedToday: claimedTodaySavvy,
      contractStreak,
    },
    appContracts,
    universeContracts,
    completedRecent,
  };
}

async function claimContractReward(user, { contractId, sourceAppId = DEFAULT_CONTRACTS_APP_ID }) {
  const contract = getContractById(contractId);
  if (!contract) {
    return {
      ok: false,
      granted: false,
      error: 'invalid_contract',
      message: 'Unknown contract.',
    };
  }

  if (isContractExpired(contract)) {
    return {
      ok: false,
      granted: false,
      error: 'contract_expired',
      message: 'This contract has expired.',
    };
  }

  const complete = await isContractCompleteOnServer(user._id, contract);
  if (!complete) {
    return {
      ok: false,
      granted: false,
      error: 'contract_not_complete',
      message: 'Complete this contract before claiming.',
    };
  }

  const claimLock = await tryAcquireContractClaim(user._id, contract);
  if (!claimLock.ok) {
    if (claimLock.error === 'already_claimed') {
      return {
        ok: false,
        granted: false,
        alreadyClaimed: true,
        duplicate: true,
        error: 'already_claimed',
        message: 'Contract reward already claimed.',
      };
    }
    if (claimLock.error === 'contract_expired') {
      return {
        ok: false,
        granted: false,
        error: 'contract_expired',
        message: 'This contract has expired.',
      };
    }
    return {
      ok: false,
      granted: false,
      error: 'contract_not_complete',
      message: 'Complete this contract before claiming.',
    };
  }

  const period = claimLock.periodKey;
  const reward = contract.reward || { type: 'savvy', amount: 0 };

  try {
    const grantResult = await grantContractReward(user, { contract, periodKey: period, reward });

    if (grantResult.duplicate || !grantResult.granted) {
      await releaseContractClaim(user._id, contract, period);
      return {
        ok: false,
        granted: false,
        alreadyClaimed: Boolean(grantResult.duplicate),
        duplicate: Boolean(grantResult.duplicate),
        error: grantResult.duplicate ? 'already_claimed' : 'grant_failed',
        message: grantResult.duplicate
          ? 'Contract reward already claimed.'
          : 'Could not grant contract reward.',
      };
    }

    if (grantResult.newBalance != null) {
      user.savvyPoints = grantResult.newBalance;
    }
    await user.save();
    await recordContractClaimed(user._id, contract, { sourceAppId });

    return {
      ok: true,
      granted: true,
      contractId: contract.id,
      periodKey: period,
      reward,
      rewardType: grantResult.rewardType || reward.type,
      added: grantResult.amount || reward.amount || 0,
      newBalance: grantResult.newBalance ?? user.savvyPoints,
      message: `Reward claimed: ${formatRewardLabel(reward)}`,
    };
  } catch (err) {
    await releaseContractClaim(user._id, contract, period);
    throw err;
  }
}

module.exports = {
  getContractsHubForUser,
  claimContractReward,
  mergeContractWithProgress,
  formatRewardLabel,
};
