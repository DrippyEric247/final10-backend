/**
 * Scout Flight tournament heartbeat client.
 *
 * Sends lightweight gameplay evidence during eligible tournament runs only.
 * Practice mode never calls the server.
 */

import { sendScoutFlightHeartbeat } from './api';
import { HEARTBEAT_INTERVAL_MS } from './scoutFlightNukeConfig';
import { PHASE } from './scoutFlightEngine';
import { getCombinedRewardMultiplier, getNukeRewardMultiplier } from './scoutFlightNukeEngine';

export { HEARTBEAT_INTERVAL_MS };

/**
 * @param {object} game engine state
 * @param {string} runId
 * @param {number} sequence monotonic per run
 */
export function buildScoutFlightHeartbeatPayload(game, runId, sequence) {
  if (!game || !runId) return null;

  return {
    runId,
    sequence,
    elapsedRunTime: Math.round(Number(game.elapsed) || 0),
    currentScore: Math.round(Number(game.score) || 0),
    baseScore: Math.round(Number(game.baseScore) || 0),
    obstacleCountPassed: Math.round(Number(game.nuke?.obstaclesEscaped) || 0),
    runMultiplier: Math.max(1, Number(game.runMultiplier) || 1),
    nukeMultiplier: getNukeRewardMultiplier(game),
    currentMultiplier: getCombinedRewardMultiplier(game),
    alive: game.phase === PHASE.PLAYING,
    clientTimestamp: Date.now(),
  };
}

/**
 * Starts periodic heartbeats for a tournament run.
 * @returns {() => void} stop function
 */
export function startScoutFlightHeartbeatLoop({ getGame, runId, sequenceRef }) {
  if (!runId || !sequenceRef) return () => {};

  let stopped = false;
  let inflight = false;

  const tick = async () => {
    if (stopped || inflight) return;
    const game = getGame?.();
    if (!game || game.phase !== PHASE.PLAYING) return;

    const seq = sequenceRef.current;
    const payload = buildScoutFlightHeartbeatPayload(game, runId, seq);
    if (!payload) return;

    inflight = true;
    try {
      await sendScoutFlightHeartbeat(payload);
      sequenceRef.current = seq + 1;
    } catch {
      /* missed heartbeats are tolerated within server grace rules */
    } finally {
      inflight = false;
    }
  };

  void tick();
  const id = window.setInterval(() => void tick(), HEARTBEAT_INTERVAL_MS);

  return () => {
    stopped = true;
    window.clearInterval(id);
  };
}
