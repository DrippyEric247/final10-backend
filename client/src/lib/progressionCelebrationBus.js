/**
 * Global progression celebration bus — animations, sfx, scout voice for all rewards.
 */
import { playScoutVoiceLine } from './scoutVoiceLines';

export const PROGRESSION_CELEBRATION_EVENT = 'f10:progression-celebration';

/** @typedef {'savvy'|'xp'|'battle_pass_xp'|'profile_xp'|'tier_unlock'|'boost'|'inventory'|'mission'|'streak'|'cosmetic'|'generic'} CelebrationKind */

/**
 * @typedef {object} CelebrationPayload
 * @property {CelebrationKind} kind
 * @property {number} [amount]
 * @property {string} [label]
 * @property {string} [subtitle]
 * @property {string} [icon]
 * @property {string} [scoutVoiceLine]
 * @property {boolean} [navigateBattlePass]
 * @property {boolean} [screenShake]
 * @property {'NORMAL'|'GOOD'|'RARE'|'EPIC'|'LEGENDARY'} [rarity]
 * @property {string} [source]
 */

const VOICE_BY_KIND = Object.freeze({
  savvy: 'reward_confirmed',
  xp: 'mission_complete',
  battle_pass_xp: 'battle_pass_boost',
  profile_xp: 'savvy_level_boost',
  tier_unlock: 'win',
  boost: 'double_points',
  inventory: 'supply_drop',
  mission: 'mission_complete',
  streak: 'reward_confirmed',
  cosmetic: 'win',
  generic: 'reward_confirmed',
});

const ICON_BY_KIND = Object.freeze({
  savvy: '🪙',
  xp: '⚡',
  battle_pass_xp: '⚡',
  profile_xp: '✨',
  tier_unlock: '🏆',
  boost: '🔥',
  inventory: '🎁',
  mission: '🎯',
  streak: '🛡️',
  cosmetic: '🎖️',
  generic: '✨',
});

let lastEmitAt = 0;
const DEDUPE_MS = 280;

/**
 * Emit a premium progression celebration (floating text, sfx, scout voice).
 * @param {CelebrationPayload} payload
 */
export function emitProgressionCelebration(payload = {}) {
  if (typeof window === 'undefined') return;
  const kind = payload.kind || 'generic';
  const amount = Math.max(0, Math.round(Number(payload.amount) || 0));
  const now = Date.now();
  if (now - lastEmitAt < DEDUPE_MS && !payload.force) return;
  lastEmitAt = now;

  const detail = {
    kind,
    amount,
    label: payload.label || defaultLabel(kind, amount),
    subtitle: payload.subtitle || '',
    icon: payload.icon || ICON_BY_KIND[kind] || '✨',
    rarity: payload.rarity || rarityFromAmount(amount),
    source: payload.source || kind,
    navigateBattlePass: Boolean(payload.navigateBattlePass),
    screenShake: payload.screenShake !== false && amount >= 25,
    ts: now,
  };

  try {
    window.dispatchEvent(new CustomEvent(PROGRESSION_CELEBRATION_EVENT, { detail }));
  } catch {
    /* ignore */
  }

  const voiceKey = payload.scoutVoiceLine || VOICE_BY_KIND[kind] || 'reward_confirmed';
  playScoutVoiceLine(voiceKey);
}

function defaultLabel(kind, amount) {
  if (kind === 'tier_unlock') return 'Tier Unlocked!';
  if (kind === 'boost') return 'Boost Activated';
  if (kind === 'streak') return 'Shield Activated';
  if (kind === 'inventory') return 'Item Used';
  if (amount > 0) {
    if (kind === 'savvy') return `+${amount.toLocaleString()} Savvy`;
    if (kind === 'battle_pass_xp' || kind === 'profile_xp' || kind === 'xp') {
      return `+${amount.toLocaleString()} XP`;
    }
    return `+${amount.toLocaleString()}`;
  }
  return 'Reward Earned';
}

function rarityFromAmount(amount) {
  if (amount >= 400) return 'LEGENDARY';
  if (amount >= 200) return 'EPIC';
  if (amount >= 90) return 'RARE';
  if (amount >= 35) return 'GOOD';
  return 'NORMAL';
}

/** Bridge Savvy balance changes into celebrations. */
export function celebrateSavvyGrant(amount, source = 'savvy') {
  const amt = Math.max(1, Math.round(Number(amount) || 0));
  if (!amt) return;
  emitProgressionCelebration({
    kind: 'savvy',
    amount: amt,
    source,
    scoutVoiceLine: amt >= 100 ? 'win' : 'reward_confirmed',
  });
}

/** Bridge BP XP grants. */
export function celebrateBattlePassXp(amount, opts = {}) {
  const amt = Math.max(1, Math.round(Number(amount) || 0));
  if (!amt) return;
  emitProgressionCelebration({
    kind: 'battle_pass_xp',
    amount: amt,
    navigateBattlePass: opts.navigate !== false,
    source: opts.source || 'battle_pass',
    label: opts.label,
  });
}

/** Bridge tier unlocks. */
export function celebrateTierUnlock(tier, opts = {}) {
  emitProgressionCelebration({
    kind: 'tier_unlock',
    amount: 0,
    label: opts.label || `Tier ${tier} Unlocked`,
    subtitle: opts.subtitle || '',
    navigateBattlePass: true,
    screenShake: true,
    scoutVoiceLine: 'win',
  });
}
