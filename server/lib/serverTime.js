/**
 * Authoritative server-side calendar boundaries (UTC) for resets and UI sync.
 */

function startOfUtcDay(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addUtcDays(date, days) {
  const x = new Date(date.getTime());
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

/** Monday 00:00 UTC for the week containing `d`. */
function utcWeekStartMonday(d = new Date()) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = x.getUTCDay(); // 0 Sun .. 6 Sat
  const delta = dow === 0 ? -6 : 1 - dow;
  x.setUTCDate(x.getUTCDate() + delta);
  return x;
}

function getServerTimePayload() {
  const now = new Date();
  const dayStart = startOfUtcDay(now);
  const nextDayStart = addUtcDays(dayStart, 1);
  const weekStart = utcWeekStartMonday(now);
  const weekKey = `week-${weekStart.toISOString().slice(0, 10)}`;

  return {
    serverNowIso: now.toISOString(),
    utcDate: dayStart.toISOString().slice(0, 10),
    utcDayStartIso: dayStart.toISOString(),
    utcNextDayStartIso: nextDayStart.toISOString(),
    utcWeekStartIso: weekStart.toISOString(),
    weekKeyUtc: weekKey,
  };
}

module.exports = {
  getServerTimePayload,
  startOfUtcDay,
  utcWeekStartMonday,
};
