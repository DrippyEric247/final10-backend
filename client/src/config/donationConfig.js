/**
 * Optional donation links — hosted checkout only (Stripe Payment Links, PayPal, etc.).
 * Set REACT_APP_DONATION_LINK_* in env; leave blank to show Coming Soon.
 */

const DONATION_ENV_KEYS = Object.freeze({
  coffee5: 'REACT_APP_DONATION_LINK_5',
  support10: 'REACT_APP_DONATION_LINK_10',
  founding25: 'REACT_APP_DONATION_LINK_25',
  custom: 'REACT_APP_DONATION_LINK_CUSTOM',
});

function readLink(key) {
  const raw = process.env[key];
  return typeof raw === 'string' ? raw.trim() : '';
}

/** @returns {{ coffee5: string, support10: string, founding25: string, custom: string }} */
export function getDonationLinks() {
  return {
    coffee5: readLink(DONATION_ENV_KEYS.coffee5),
    support10: readLink(DONATION_ENV_KEYS.support10),
    founding25: readLink(DONATION_ENV_KEYS.founding25),
    custom: readLink(DONATION_ENV_KEYS.custom),
  };
}

export function hasAnyDonationLink(links = getDonationLinks()) {
  return Object.values(links).some(Boolean);
}
