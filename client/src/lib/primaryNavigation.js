/**
 * Final10 primary navigation — "Final10 finds the deal for you… or you find it."
 * Step 1: Alerts · Step 2: Quick Snipes · Step 3: Auctions
 */

export const DEAL_PHILOSOPHY_TAGLINE =
  'Final10 either finds the deal for you… or you find it.';

export const DEAL_PHILOSOPHY_LANES = Object.freeze({
  alerts: {
    key: 'alerts',
    step: 1,
    philosophy: 'Final10 Finds It For You',
    helperText:
      'Set your target. Savvy Scout watches the market 24/7 so you don\'t have to.',
  },
  quickSnipes: {
    key: 'quickSnipes',
    step: 2,
    philosophy: 'You Find It Yourself',
    helperText: 'Jump into live opportunities before someone else does.',
  },
  auctions: {
    key: 'auctions',
    step: 3,
    philosophy: 'Traditional auction hunting',
    helperText: 'Master the final minutes. Win where competition is lowest.',
  },
});

export const PRIMARY_NAV_PROGRESSION = [
  DEAL_PHILOSOPHY_LANES.alerts,
  DEAL_PHILOSOPHY_LANES.quickSnipes,
  DEAL_PHILOSOPHY_LANES.auctions,
];

/** Default discovery entry after onboarding — active hunt lane. */
export const DEFAULT_DISCOVERY_PATH = '/local-deals';

/** Passive discovery entry — let Final10 watch for you. */
export const PASSIVE_DISCOVERY_PATH = '/alerts';
