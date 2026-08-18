/**
 * Wave 6 — canonical Savvy balance reads.
 * User.savvyPoints is authoritative; pointsBalance is a deprecated mirror only.
 */

function resolveSavvyBalance(user) {
  const canonical = Math.round(Number(user?.savvyPoints));
  if (Number.isFinite(canonical) && canonical >= 0) return canonical;

  const mirror = Math.round(Number(user?.pointsBalance));
  if (Number.isFinite(mirror) && mirror >= 0) return mirror;

  return 0;
}

/**
 * Detect accounts where deprecated mirror diverges from canonical balance.
 */
function detectSavvyBalanceConflict(user) {
  const canonical = Math.round(Number(user?.savvyPoints));
  const mirror = Math.round(Number(user?.pointsBalance));
  if (!Number.isFinite(canonical) || !Number.isFinite(mirror)) {
    return { conflict: false, canonical: resolveSavvyBalance(user), mirror: null };
  }
  if (canonical === mirror) {
    return { conflict: false, canonical, mirror };
  }
  return { conflict: true, canonical, mirror, delta: mirror - canonical };
}

/**
 * Pick migration target without blindly taking the largest number.
 * Prefers completed SavvyTransaction sum when available; otherwise canonical field.
 */
async function resolveSavvyBalanceMigrationTarget(user, { sumCompletedTransactions } = {}) {
  const canonical = Math.round(Number(user?.savvyPoints));
  const mirror = Math.round(Number(user?.pointsBalance));
  const ledgerSum =
    typeof sumCompletedTransactions === 'function'
      ? Math.round(Number(await sumCompletedTransactions(user)) || 0)
      : null;

  if (Number.isFinite(ledgerSum) && ledgerSum >= 0) {
    return { target: ledgerSum, source: 'savvy_transaction_sum', ambiguous: false };
  }

  if (Number.isFinite(canonical) && canonical >= 0) {
    const ambiguous =
      Number.isFinite(mirror) && mirror >= 0 && mirror !== canonical && mirror > canonical;
    return {
      target: canonical,
      source: 'savvyPoints',
      ambiguous,
      ...(ambiguous ? { alternate: mirror } : {}),
    };
  }

  if (Number.isFinite(mirror) && mirror >= 0) {
    return { target: mirror, source: 'pointsBalance_mirror', ambiguous: false };
  }

  return { target: 0, source: 'default_zero', ambiguous: false };
}

module.exports = {
  resolveSavvyBalance,
  detectSavvyBalanceConflict,
  resolveSavvyBalanceMigrationTarget,
};
