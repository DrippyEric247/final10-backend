/**
 * Optional donation links — hosted checkout only (Stripe Payment Links, PayPal, etc.).
 * Tiers: $5 · $25 Support Development · $100 · Custom
 * Set REACT_APP_DONATION_LINK_* in env; leave blank to show Coming Soon.
 */

const DONATION_ENV_KEYS = Object.freeze({
  coffee5: 'REACT_APP_DONATION_LINK_5',
  support25: 'REACT_APP_DONATION_LINK_25',
  legendary100: 'REACT_APP_DONATION_LINK_100',
  custom: 'REACT_APP_DONATION_LINK_CUSTOM',
});

/** Public Stripe Payment Link defaults — override via REACT_APP_DONATION_LINK_* env. */
const DEFAULT_DONATION_LINKS = Object.freeze({
  coffee5: 'https://buy.stripe.com/00w14nao54TK3tJdOF83C02',
  support25: 'https://buy.stripe.com/3cIcN52VD71S9S79yp83C03',
  legendary100: 'https://buy.stripe.com/bJe28r67Pcmc0hx11T83C01',
  custom: 'https://buy.stripe.com/6oUeVdeEl9a08O38ul83C04',
});

function readLink(envKey, defaultKey) {
  const raw = process.env[envKey];
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (trimmed) return trimmed;
  return DEFAULT_DONATION_LINKS[defaultKey] || '';
}

/** @returns {{ coffee5: string, support25: string, legendary100: string, custom: string }} */
export function getDonationLinks() {
  return {
    coffee5: readLink(DONATION_ENV_KEYS.coffee5, 'coffee5'),
    support25: readLink(DONATION_ENV_KEYS.support25, 'support25'),
    legendary100: readLink(DONATION_ENV_KEYS.legendary100, 'legendary100'),
    custom: readLink(DONATION_ENV_KEYS.custom, 'custom'),
  };
}

export function hasAnyDonationLink(links = getDonationLinks()) {
  return Object.values(links).some(Boolean);
}
