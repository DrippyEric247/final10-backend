/**
 * Apply authoritative Savvy balance from a server response into AuthContext.
 * Updates both savvyPoints and savvyPointsServerBase so withLoadout() displays correctly.
 */
export function applyServerSavvyBalance(patchUser, newBalance, extras = {}) {
  if (typeof patchUser !== "function") return;
  const balance = Math.max(0, Math.round(Number(newBalance) || 0));
  if (!Number.isFinite(balance)) return;

  const payload = {
    savvyPointsServerBase: balance,
    savvyPoints: balance,
    ...extras,
  };

  if (extras.lifetimePointsEarned != null) {
    payload.lifetimePointsEarned = Math.max(
      0,
      Math.round(Number(extras.lifetimePointsEarned) || 0)
    );
  }

  patchUser(payload);
}
