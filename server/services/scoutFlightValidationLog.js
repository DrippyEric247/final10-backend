/**
 * Structured validation logging for Scout Flight runs.
 * Never log auth tokens or full request bodies.
 */

function logScoutFlightValidation(event = {}) {
  const payload = {
    runId: event.runId || null,
    userId: event.userId ? String(event.userId) : null,
    serverDurationMs: event.serverDurationMs ?? null,
    heartbeatCount: event.heartbeatCount ?? null,
    obstacleCount: event.obstacleCount ?? null,
    submittedScore: event.submittedScore ?? null,
    validatedScore: event.validatedScore ?? null,
    rejectionReason: event.rejectionReason || null,
    nukeEligible: event.nukeEligible ?? null,
    isTestRun: Boolean(event.isTestRun),
    adjusted: Boolean(event.adjusted),
    event: event.event || 'validation',
    timestamp: new Date().toISOString(),
  };

  if (event.rejectionReason || event.adjusted) {
    console.warn('[scout-flight/validation]', JSON.stringify(payload));
  } else if (process.env.SCOUT_FLIGHT_VALIDATION_DEBUG === '1') {
    console.info('[scout-flight/validation]', JSON.stringify(payload));
  }

  return payload;
}

module.exports = { logScoutFlightValidation };
