/** Founding Beta Calling Cards — first 100 founders only. */

const MAX_FOUNDING_BETA_SLOTS = 100;

const FOUNDING_BETA_COSMETICS = Object.freeze({
  callingCardId: 'card_founding_beta',
  emblemId: 'sigil_founding_legacy',
  borderId: 'border_founding_beta',
  legacyBadge: 'founding_legacy',
  testerBadge: 'founding_tester_completed',
});

const FOUNDING_BETA_MESSAGES = Object.freeze({
  hallComplete: 'The Founding 100 have been completed. Thank you for helping shape Final10.',
  welcomeFounder: 'Welcome to the Founding 100.',
  scoutComplete:
    "Outstanding work, Founder. You didn't just test Final10—you helped build it. Your legacy is now part of the Savvy Universe.",
});

module.exports = {
  MAX_FOUNDING_BETA_SLOTS,
  FOUNDING_BETA_COSMETICS,
  FOUNDING_BETA_MESSAGES,
};
