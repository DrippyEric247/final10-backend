/**
 * Wave 6 — canonical login streak reads.
 * User.loginStreakDays is authoritative; currentStreak is a compatibility mirror.
 */

function resolveLoginStreak(user) {
  const canonical = Number(user?.loginStreakDays);
  if (Number.isFinite(canonical)) return Math.max(0, Math.round(canonical));

  const mirror = Number(user?.currentStreak);
  if (Number.isFinite(mirror)) return Math.max(0, Math.round(mirror));

  return 0;
}

function resolveLongestStreak(user) {
  return Math.max(0, Math.round(Number(user?.longestStreak) || 0));
}

module.exports = {
  resolveLoginStreak,
  resolveLongestStreak,
};
