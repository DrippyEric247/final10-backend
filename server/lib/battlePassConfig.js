/**
 * Mirrors client `client/src/lib/battlePassConfig.js` for server-side tier math.
 */

const BATTLE_PASS_SEASON_ID = 'neon_hunt_s1';

const BATTLE_PASS_CUMULATIVE_XP = [
  50, 120, 210, 320, 450, 600, 780, 980, 1200, 1450,
];

const BATTLE_PASS_TIERS = [
  { level: 1, free: { type: 'points', value: 40, label: '+40 pts' }, premium: { type: 'bp_xp', value: 35, label: 'Bonus 35 BP XP' } },
  { level: 2, free: { type: 'boost', value: 0.02, label: '+0.02x Power (season)' }, premium: { type: 'points', value: 80, label: '+80 pts' } },
  { level: 3, free: { type: 'points', value: 55, label: '+55 pts' }, premium: { type: 'emblem', id: 'sigil_bp_neon', label: 'Neon Sigil emblem' } },
  { level: 4, free: { type: 'bp_xp', value: 50, label: '+50 BP XP' }, premium: { type: 'card', id: 'card_bp_neon_lane', label: 'Neon Lane card' } },
  { level: 5, free: { type: 'boost', value: 0.02, label: '+0.02x Power (season)' }, premium: { type: 'points', value: 120, label: '+120 pts' } },
  { level: 6, free: { type: 'points', value: 70, label: '+70 pts' }, premium: { type: 'boost', value: 0.03, label: '+0.03x Power (season)' } },
  { level: 7, free: { type: 'emblem', id: 'sigil_bp_hunter', label: 'Hunter emblem' }, premium: { type: 'points', value: 150, label: '+150 pts' } },
  { level: 8, free: { type: 'card', id: 'card_bp_strike', label: 'Strike card' }, premium: { type: 'bp_xp', value: 100, label: '+100 BP XP' } },
  { level: 9, free: { type: 'points', value: 90, label: '+90 pts' }, premium: { type: 'boost', value: 0.03, label: '+0.03x Power (season)' } },
  { level: 10, free: { type: 'card', id: 'card_bp_finale', label: 'Finale card' }, premium: { type: 'emblem', id: 'sigil_bp_apex', label: 'Apex emblem' } },
];

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function getBattlePassMaxXp() {
  const last = BATTLE_PASS_CUMULATIVE_XP[BATTLE_PASS_CUMULATIVE_XP.length - 1];
  return last || 1;
}

function computeTierFromXp(xp) {
  let completedCount = 0;
  for (let i = 0; i < BATTLE_PASS_CUMULATIVE_XP.length; i += 1) {
    if (xp >= BATTLE_PASS_CUMULATIVE_XP[i]) completedCount = i + 1;
  }
  return Math.min(completedCount, BATTLE_PASS_TIERS.length);
}

function tierRewardClaimKey(track, level) {
  return `tier:${track}:${level}`;
}

function missionRewardClaimKey(seasonId, taskId) {
  const sid = String(seasonId || '').trim() || BATTLE_PASS_SEASON_ID;
  return `mission:${sid}:${String(taskId).trim()}`;
}

/** Legacy keys before season scoping — still honored for duplicate detection. */
function legacyMissionRewardClaimKey(taskId) {
  return `mission:${String(taskId).trim()}`;
}

module.exports = {
  BATTLE_PASS_SEASON_ID,
  BATTLE_PASS_CUMULATIVE_XP,
  BATTLE_PASS_TIERS,
  getBattlePassMaxXp,
  computeTierFromXp,
  clamp,
  tierRewardClaimKey,
  missionRewardClaimKey,
  legacyMissionRewardClaimKey,
};
