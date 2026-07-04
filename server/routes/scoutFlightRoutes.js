const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');
const { requireAdminAccess } = require('../middleware/requireRole');
const { HttpError } = require('../middleware/apiErrors');
const {
  scoutFlightTournamentStartLimiter,
  scoutFlightTournamentSubmitLimiter,
} = require('../middleware/rateLimits');
const {
  ScoutFlightTournamentError,
  getTournamentStatus,
  startTournamentRun,
  submitTournamentScore,
  getLeaderboard,
  adminGrantTicket,
} = require('../services/scoutFlightTournamentService');
const {
  ScoutFlightChampionshipError,
  getChampionshipDashboard,
  getSeasonLeaderboard,
  getHallOfChampions,
  adminFinalizeSeason,
  adminDisqualifyRun,
  ensureCurrentSeason,
} = require('../services/scoutFlightChampionshipService');
const { getRewardTiers, getChampionshipMessaging } = require('../config/scoutFlightChampionshipConfig');

const router = express.Router();

router.get('/tournament/status', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return next(new HttpError(404, 'NOT_FOUND', 'User not found'));
    res.json(await getTournamentStatus(user));
  } catch (err) {
    console.error('[scout-flight/tournament/status]', err);
    next(err);
  }
});

router.post('/tournament/start', auth, scoutFlightTournamentStartLimiter, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return next(new HttpError(404, 'NOT_FOUND', 'User not found'));
    const result = await startTournamentRun(user);
    res.json({
      message: result.resumed ? 'Tournament run resumed.' : 'Tournament run started.',
      ...result,
    });
  } catch (err) {
    if (err instanceof ScoutFlightTournamentError) {
      return res.status(err.status).json({ message: err.message, code: err.code });
    }
    console.error('[scout-flight/tournament/start]', err);
    next(err);
  }
});

router.post('/tournament/submit', auth, scoutFlightTournamentSubmitLimiter, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return next(new HttpError(404, 'NOT_FOUND', 'User not found'));
    const result = await submitTournamentScore(user, {
      runId: req.body?.runId,
      score: req.body?.score,
      elapsedMs: req.body?.elapsedMs,
    });
    res.json({
      message: result.duplicate ? 'Score already submitted.' : 'Tournament run complete.',
      ...result,
    });
  } catch (err) {
    if (err instanceof ScoutFlightTournamentError) {
      return res.status(err.status).json({ message: err.message, code: err.code });
    }
    console.error('[scout-flight/tournament/submit]', err);
    next(err);
  }
});

router.get('/tournament/leaderboard', auth, async (req, res, next) => {
  try {
    const period = String(req.query?.period || 'daily').trim();
    const limit = Number(req.query?.limit) || 50;
    const seasonId = req.query?.seasonId ? String(req.query.seasonId).trim() : null;
    const data = await getLeaderboard(period, { userId: req.user.id, limit, seasonId });
    res.json(data);
  } catch (err) {
    console.error('[scout-flight/tournament/leaderboard]', err);
    next(err);
  }
});

router.get('/championship/current', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return next(new HttpError(404, 'NOT_FOUND', 'User not found'));
    res.json(await getChampionshipDashboard(user));
  } catch (err) {
    console.error('[scout-flight/championship/current]', err);
    next(err);
  }
});

router.get('/championship/season/:seasonId/leaderboard', auth, async (req, res, next) => {
  try {
    const seasonId = String(req.params.seasonId || '').trim();
    const limit = Number(req.query?.limit) || 50;
    const data = await getSeasonLeaderboard(seasonId, { userId: req.user.id, limit });
    res.json(data);
  } catch (err) {
    if (err instanceof ScoutFlightChampionshipError) {
      return res.status(err.status).json({ message: err.message, code: err.code });
    }
    console.error('[scout-flight/championship/season/leaderboard]', err);
    next(err);
  }
});

router.get('/championship/hall-of-champions', auth, async (req, res, next) => {
  try {
    const limit = Number(req.query?.limit) || 50;
    res.json(await getHallOfChampions({ limit }));
  } catch (err) {
    console.error('[scout-flight/championship/hall-of-champions]', err);
    next(err);
  }
});

router.get('/championship/rewards', auth, async (req, res, next) => {
  try {
    const season = await ensureCurrentSeason();
    res.json({
      isBetaSeason: season.isBetaSeason,
      rewardTiers: getRewardTiers(season.isBetaSeason),
      messaging: getChampionshipMessaging(season.isBetaSeason),
    });
  } catch (err) {
    console.error('[scout-flight/championship/rewards]', err);
    next(err);
  }
});

router.post('/admin/grant-ticket', auth, requireAdminAccess(), async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return next(new HttpError(404, 'NOT_FOUND', 'User not found'));
    const count = Number(req.body?.count) || 1;
    const result = await adminGrantTicket(user, count);
    res.json({
      message: `Granted ${result.granted} Scout Flight Ticket(s).`,
      ...result,
    });
  } catch (err) {
    console.error('[scout-flight/admin/grant-ticket]', err);
    next(err);
  }
});

router.post('/admin/finalize-season', auth, requireAdminAccess(), async (req, res, next) => {
  try {
    const seasonId = String(req.body?.seasonId || '').trim();
    if (!seasonId) return next(new HttpError(400, 'SEASON_REQUIRED', 'seasonId is required'));
    const result = await adminFinalizeSeason(seasonId);
    res.json({
      message: result.alreadyFinalized ? 'Season already finalized.' : 'Season finalized and rewards granted.',
      ...result,
    });
  } catch (err) {
    if (err instanceof ScoutFlightChampionshipError) {
      return res.status(err.status).json({ message: err.message, code: err.code });
    }
    console.error('[scout-flight/admin/finalize-season]', err);
    next(err);
  }
});

router.post('/admin/disqualify-run', auth, requireAdminAccess(), async (req, res, next) => {
  try {
    const runId = String(req.body?.runId || '').trim();
    const reason = String(req.body?.reason || '').trim();
    const result = await adminDisqualifyRun(runId, reason);
    res.json({ message: 'Run disqualified.', ...result });
  } catch (err) {
    if (err instanceof ScoutFlightChampionshipError) {
      return res.status(err.status).json({ message: err.message, code: err.code });
    }
    console.error('[scout-flight/admin/disqualify-run]', err);
    next(err);
  }
});

module.exports = router;
