/**
 * Hidden trailer Easter Egg promo codes — add new entries here (no backend logic changes).
 *
 * Schema per code:
 * - code, active, expiresAt, maxRedemptions
 * - savvyAmount, callingCardId, callingCardEnabled, supplyDrop, supplyDropDurationMs
 * - UI copy: successTitle, successHeadline, scoutMessage, ctaLabel, ctaPath,
 *   successFooter, alreadyRedeemedMessage, invalidMessage
 */

const BETA_SUPPLY_DROP_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

/** @type {Record<string, object>} */
const TRAILER_PROMO_CODES = Object.freeze({
  BETA247: {
    code: 'BETA247',
    active: true,
    expiresAt: null,
    maxRedemptions: null,
    rewardType: 'bundle',
    savvyAmount: 247,
    callingCardId: 'card_beta_hunter',
    callingCardEnabled: true,
    supplyDrop: true,
    supplyDropLabel: 'Beta Supply Drop',
    supplyDropDurationMs: BETA_SUPPLY_DROP_DURATION_MS,
    supplyDropSource: 'trailer_promo:BETA247',
    name: 'Beta Hunter',
    icon: '🎬',
    category: 'trailer',
    successTitle: 'Hidden Trailer Code Redeemed!',
    successHeadline: '🎉 Congratulations! You discovered the hidden Beta247 trailer code.',
    successFooter: 'Thanks for watching closely.\nMore hidden trailer codes are coming...',
    alreadyRedeemedMessage: "You've already claimed the BETA247 trailer reward.",
    invalidMessage: 'Invalid or expired promo code.',
    createdBy: 'system',
    createdAt: '2026-06-25T00:00:00.000Z',
  },
  INVITEFRIENDS: {
    code: 'INVITEFRIENDS',
    active: true,
    expiresAt: null,
    maxRedemptions: null,
    rewardType: 'savvy',
    savvyAmount: 500,
    callingCardEnabled: false,
    supplyDrop: false,
    name: 'Invite Friends',
    icon: '🤝',
    category: 'referral',
    successTitle: '🎉 Invite Friends Code Redeemed!',
    successHeadline: 'You earned +500 Savvy.',
    scoutMessage:
      'Nice move, Operator. Now invite your friends to earn even more Savvy.',
    ctaLabel: 'Invite Friends',
    ctaPath: '/invite-friends',
    alreadyRedeemedMessage: "You've already claimed the INVITEFRIENDS reward.",
    invalidMessage: 'Invalid or expired code.',
    createdBy: 'system',
    createdAt: '2026-06-25T00:00:00.000Z',
  },
});

function normalizeTrailerPromoCode(raw) {
  return String(raw || '').trim().toUpperCase();
}

function getTrailerPromoCodeDef(rawCode) {
  const upper = normalizeTrailerPromoCode(rawCode);
  if (!upper || !TRAILER_PROMO_CODES[upper]) return null;
  const def = TRAILER_PROMO_CODES[upper];
  if (!def.active) return { ...def, code: upper, inactive: true };
  if (def.expiresAt && new Date(def.expiresAt).getTime() <= Date.now()) {
    return { ...def, code: upper, expired: true };
  }
  return { ...def, code: upper };
}

function listActiveTrailerPromoCodes() {
  return Object.values(TRAILER_PROMO_CODES).filter((def) => {
    if (!def.active) return false;
    if (def.expiresAt && new Date(def.expiresAt).getTime() <= Date.now()) return false;
    return true;
  });
}

module.exports = {
  TRAILER_PROMO_CODES,
  BETA_SUPPLY_DROP_DURATION_MS,
  normalizeTrailerPromoCode,
  getTrailerPromoCodeDef,
  listActiveTrailerPromoCodes,
};
