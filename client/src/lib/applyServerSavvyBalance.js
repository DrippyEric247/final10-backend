/**
 * Apply authoritative Savvy balance from a server response into AuthContext.
 * Server database wins — never inflate local balance above server value.
 */
const SAVVY_CHANGE_LOG = 'f10:savvy-balance-changed';

export function logSavvyBalanceChange(detail) {
  const payload = {
    timestamp: new Date().toISOString(),
    ...detail,
  };
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.log('[SavvyChange]', payload);
  }
  try {
    window.dispatchEvent(new CustomEvent(SAVVY_CHANGE_LOG, { detail: payload }));
  } catch {
    /* ignore */
  }
}

export { SAVVY_CHANGE_LOG };

export function applyServerSavvyBalance(patchUser, newBalance, extras = {}) {
  if (typeof patchUser !== 'function') return;
  const balance = Math.max(0, Math.round(Number(newBalance) || 0));
  if (!Number.isFinite(balance)) return;

  const oldValue =
    extras.oldValue != null ? Math.max(0, Math.round(Number(extras.oldValue) || 0)) : undefined;
  const amountAdded =
    extras.amountAdded != null
      ? Math.round(Number(extras.amountAdded) || 0)
      : oldValue != null
        ? balance - oldValue
        : undefined;

  const payload = {
    savvyPointsServerBase: balance,
    savvyPoints: balance,
    savvyBalanceSyncedAt: Date.now(),
    ...extras,
  };

  if (extras.lifetimePointsEarned != null) {
    payload.lifetimePointsEarned = Math.max(
      0,
      Math.round(Number(extras.lifetimePointsEarned) || 0)
    );
  }

  logSavvyBalanceChange({
    source: extras.source || 'server_sync',
    oldValue,
    amountAdded: amountAdded != null && amountAdded > 0 ? amountAdded : extras.amountAdded,
    multiplier: extras.multiplier,
    finalTotal: balance,
    userId: extras.userId,
  });

  patchUser(payload);
}
