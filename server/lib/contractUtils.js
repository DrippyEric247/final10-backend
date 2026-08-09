/**
 * Shared contract helpers — expiration, streaks, hidden masking, cross-app meta.
 */

const { utcDayKey, periodKeyForContract } = require('../config/contracts');

function yesterdayKey(dayKey) {
  const d = new Date(`${dayKey}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function startOfUtcDay(date = new Date()) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function endOfUtcDay(date = new Date()) {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

/** @param {Date} [date] */
function startOfUtcWeek(date = new Date()) {
  const d = startOfUtcDay(date);
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - day);
  return d;
}

/** @param {Date} [date] */
function endOfUtcWeek(date = new Date()) {
  const d = startOfUtcDay(date);
  const day = d.getUTCDay();
  const daysUntilSunday = day === 0 ? 0 : 7 - day;
  d.setUTCDate(d.getUTCDate() + daysUntilSunday);
  return endOfUtcDay(d);
}

/**
 * Resolve when a contract period expires (null = no expiration).
 * @param {object} contract
 * @param {Date} [date]
 */
function resolveContractExpiresAt(contract, date = new Date()) {
  if (contract?.expiresAt) {
    const exp = new Date(contract.expiresAt);
    return Number.isNaN(exp.getTime()) ? null : exp;
  }

  const type = contract?.type;

  if (contract?.expiresInHours != null) {
    const hours = Number(contract.expiresInHours);
    if (Number.isFinite(hours) && hours > 0) {
      let start = startOfUtcDay(date);
      if (contract.eventKey) {
        start = contract.eventStartsAt
          ? startOfUtcDay(new Date(contract.eventStartsAt))
          : startOfUtcWeek(date);
      }
      return new Date(start.getTime() + hours * 3600000);
    }
  }

  if (type === 'daily' || type === 'challenge') return endOfUtcDay(date);
  if (type === 'weekly' || type === 'universal') return endOfUtcWeek(date);
  if (type === 'event') return endOfUtcWeek(date);
  if (type === 'seasonal') {
    const year = date.getUTCFullYear();
    return new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
  }

  return null;
}

function isContractExpired(contract, date = new Date(), { periodKey = null } = {}) {
  const currentPeriod = periodKeyForContract(contract, date);
  if (periodKey && periodKey !== currentPeriod) return true;

  const exp = resolveContractExpiresAt(contract, date);
  if (!exp) return false;
  return date.getTime() > exp.getTime();
}

function isContractDiscovered(contract, row) {
  if (!contract?.isHidden) return true;
  if (!row) return false;
  if (row.meta?.discovered) return true;
  if (Number(row.progress) > 0) return true;
  if (row.completedAt || row.claimedAt) return true;
  return false;
}

function maskContractForClient(contract, row) {
  if (!contract.isHidden || isContractDiscovered(contract, row)) {
    return {
      ...contract,
      isDiscovered: true,
    };
  }

  const masked = {
    ...contract,
    isDiscovered: false,
    isHidden: true,
    title: contract.revealTitle || '???',
    description:
      contract.hiddenHint ||
      'Hidden objective — keep playing Savvy activities to discover this contract.',
    icon: contract.hiddenIcon || '❔',
  };

  if (!contract.revealBeforeDiscovery) {
    masked.reward = { type: 'hidden', label: 'Classified Reward' };
    masked.rewardLabel = 'Classified Reward';
  }

  return masked;
}

/**
 * Consecutive UTC days with at least one claimed contract.
 * @param {Array<{ claimedAt?: Date|string|null }>} rows
 */
function computeContractStreak(rows) {
  const claimDays = [
    ...new Set(
      (rows || [])
        .filter((r) => r.claimedAt)
        .map((r) => new Date(r.claimedAt).toISOString().slice(0, 10))
    ),
  ];
  if (!claimDays.length) return 0;

  let streak = 0;
  let cursor = utcDayKey();
  const set = new Set(claimDays);

  while (set.has(cursor)) {
    streak += 1;
    cursor = yesterdayKey(cursor);
  }

  return streak;
}

function formatMsRemaining(ms) {
  if (ms <= 0) return 'Expired';
  const totalMin = Math.ceil(ms / 60000);
  if (totalMin < 60) return `${totalMin}m left`;
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours < 48) return mins ? `${hours}h ${mins}m left` : `${hours}h left`;
  const days = Math.floor(hours / 24);
  return `${days}d left`;
}

module.exports = {
  yesterdayKey,
  resolveContractExpiresAt,
  isContractExpired,
  isContractDiscovered,
  maskContractForClient,
  computeContractStreak,
  formatMsRemaining,
  startOfUtcDay,
  endOfUtcDay,
  startOfUtcWeek,
  periodKeyForContract,
};
