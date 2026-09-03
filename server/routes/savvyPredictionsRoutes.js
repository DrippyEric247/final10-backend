const express = require('express');
const auth = require('../middleware/auth');
const optionalUserAuth = require('../middleware/optionalUserAuth');
const { requireAdminAccess } = require('../middleware/requireRole');
const { savvyPredictionsSubmitLimiter } = require('../middleware/rateLimits');
const {
  SavvyPredictionsError,
  listEventPredictions,
  submitPredictionEntry,
  createPrediction,
  updatePredictionStatus,
  previewResolution,
  resolveAndAward,
  getUserPredictionHistory,
  getOverlayPredictions,
  getEventLeaderboard,
} = require('../services/savvyPredictionsService');
const { getEventBySlug } = require('../services/savvyWatchService');
const { dragRacePreset, driftBattlePreset, fastestRunPreset } = require('../config/savvyPredictionsGtaPreset');
const { isSavvyPredictionsEnabled } = require('../config/savvyPredictionsConfig');

const router = express.Router();

function handleError(err, res, next) {
  if (err instanceof SavvyPredictionsError) {
    return res.status(err.status || 500).json({
      code: err.code || 'SAVVY_PREDICTIONS_ERROR',
      message: err.message,
      ...(err.details || {}),
    });
  }
  return next(err);
}

router.get('/enabled', (_req, res) => {
  res.json({ enabled: isSavvyPredictionsEnabled() });
});

router.get('/events/:slug', optionalUserAuth, async (req, res, next) => {
  try {
    const event = await getEventBySlug(req.params.slug);
    if (!event) throw new SavvyPredictionsError(404, 'EVENT_NOT_FOUND', 'Event not found.');
    const userId = req.user?._id || null;
    const predictions = await listEventPredictions(event.eventId, userId);
    res.json({ eventId: event.eventId, slug: event.slug, predictions, entryCost: 0 });
  } catch (err) {
    handleError(err, res, next);
  }
});

router.get('/events/:slug/overlay', async (req, res, next) => {
  try {
    const overlay = await getOverlayPredictions(req.params.slug);
    res.json(overlay);
  } catch (err) {
    handleError(err, res, next);
  }
});

router.get('/events/:slug/leaderboard', async (req, res, next) => {
  try {
    const event = await getEventBySlug(req.params.slug);
    if (!event) throw new SavvyPredictionsError(404, 'EVENT_NOT_FOUND', 'Event not found.');
    const leaderboard = await getEventLeaderboard(event.eventId, Number(req.query.limit) || 20);
    res.json({ leaderboard });
  } catch (err) {
    handleError(err, res, next);
  }
});

router.post('/events/:slug/:predictionId/submit', auth, savvyPredictionsSubmitLimiter, async (req, res, next) => {
  try {
    if (req.body?.stakeAmount != null || req.body?.betAmount != null || req.body?.wagerAmount != null) {
      throw new SavvyPredictionsError(400, 'NO_STAKES', 'Predictions are free-entry. Stakes are not allowed.');
    }
    const result = await submitPredictionEntry(
      req.user,
      req.params.slug,
      req.params.predictionId,
      req.body?.selectedOptionId
    );
    res.json(result);
  } catch (err) {
    handleError(err, res, next);
  }
});

router.get('/history', auth, async (req, res, next) => {
  try {
    const data = await getUserPredictionHistory(req.user._id, Number(req.query.limit) || 30);
    res.json(data);
  } catch (err) {
    handleError(err, res, next);
  }
});

// --- Admin ---

router.post('/admin/events/:slug/create', auth, requireAdminAccess(), async (req, res, next) => {
  try {
    const prediction = await createPrediction(req.user, req.params.slug, req.body || {});
    res.json({ prediction: { predictionId: prediction.predictionId, title: prediction.title, status: prediction.status } });
  } catch (err) {
    handleError(err, res, next);
  }
});

router.post('/admin/predictions/:predictionId/status', auth, requireAdminAccess(), async (req, res, next) => {
  try {
    const prediction = await updatePredictionStatus(req.user, req.params.predictionId, req.body?.status);
    res.json({ prediction: { predictionId: prediction.predictionId, status: prediction.status } });
  } catch (err) {
    handleError(err, res, next);
  }
});

router.post('/admin/predictions/:predictionId/preview', auth, requireAdminAccess(), async (req, res, next) => {
  try {
    const preview = await previewResolution(req.user, req.params.predictionId, req.body?.officialResult || req.body || {});
    res.json({ preview });
  } catch (err) {
    handleError(err, res, next);
  }
});

router.post('/admin/predictions/:predictionId/resolve', auth, requireAdminAccess(), async (req, res, next) => {
  try {
    const result = await resolveAndAward(
      req.user,
      req.params.predictionId,
      req.body?.officialResult || req.body || {},
      { confirm: Boolean(req.body?.confirm) }
    );
    res.json(result);
  } catch (err) {
    handleError(err, res, next);
  }
});

router.post('/admin/events/:slug/preset/drag-race', auth, requireAdminAccess(), async (req, res, next) => {
  try {
    const templates = dragRacePreset(req.body || {});
    const created = [];
    for (const tpl of templates) {
      const p = await createPrediction(req.user, req.params.slug, { ...tpl, status: req.body?.openImmediately ? 'open' : 'draft' });
      created.push({ predictionId: p.predictionId, title: p.title, type: p.type });
    }
    res.json({ predictions: created });
  } catch (err) {
    handleError(err, res, next);
  }
});

router.post('/admin/events/:slug/preset/drift-battle', auth, requireAdminAccess(), async (req, res, next) => {
  try {
    const templates = driftBattlePreset(req.body || {});
    const created = [];
    for (const tpl of templates) {
      const p = await createPrediction(req.user, req.params.slug, { ...tpl, status: req.body?.openImmediately ? 'open' : 'draft' });
      created.push({ predictionId: p.predictionId, title: p.title, type: p.type });
    }
    res.json({ predictions: created });
  } catch (err) {
    handleError(err, res, next);
  }
});

router.post('/admin/events/:slug/preset/fastest-run', auth, requireAdminAccess(), async (req, res, next) => {
  try {
    const tpl = fastestRunPreset(req.body || {});
    const p = await createPrediction(req.user, req.params.slug, { ...tpl, status: req.body?.openImmediately ? 'open' : 'draft' });
    res.json({ prediction: { predictionId: p.predictionId, title: p.title, type: p.type } });
  } catch (err) {
    handleError(err, res, next);
  }
});

module.exports = router;
