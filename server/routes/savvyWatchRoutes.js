const express = require('express');
const auth = require('../middleware/auth');
const { requireAdminAccess } = require('../middleware/requireRole');
const { HttpError } = require('../middleware/apiErrors');
const {
  savvyWatchHeartbeatLimiter,
  savvyWatchClaimLimiter,
} = require('../middleware/rateLimits');
const {
  SavvyWatchError,
  SavvyWatchRewardError,
  getPublicEventPage,
  joinEvent,
  sendHeartbeat,
  claimCheckpoint,
  getSessionState,
  getUserHistory,
  createEventFromPreset,
  updateEventStatus,
  listAdminEvents,
  getEventBySlug,
  getParticipantCount,
  serializeEventPublic,
  getLiveSavvyWatchHomePromo,
} = require('../services/savvyWatchService');
const {
  listCompetitions,
  submitEntry,
  listEntries,
  castVote,
  moderateEntry,
  setHostScore,
  lockResults,
  awardCompetitionPrizes,
  updateCompetitionStatus,
} = require('../services/savvyWatchCompetitionService');
const {
  createLiveCode,
  getActiveLiveCodes,
  redeemLiveCode,
  expireLiveCode,
} = require('../services/savvyWatchLiveCodeService');
const {
  SavvyWatchLiveWelcomeError,
  claimLiveWelcomeBonus,
  getLiveWelcomeBonusStatus,
  recordQrVisit,
  getEventQrStats,
} = require('../services/savvyWatchLiveWelcomeBonusService');
const { renderSavvyWatchLiveQrPng } = require('../services/savvyWatchQrAssetService');
const { isSavvyWatchEnabled, buildSavvyWatchJoinUrl, LIVE_WELCOME_BONUS_AMOUNT } = require('../config/savvyWatchConfig');
const { GTA_CAR_MEET_PRESET } = require('../config/savvyWatchGtaPreset');

const router = express.Router();

function handleError(err, res, next) {
  if (err instanceof SavvyWatchError || err instanceof SavvyWatchRewardError || err instanceof SavvyWatchLiveWelcomeError) {
    return res.status(err.status || 500).json({
      code: err.code || 'SAVVY_WATCH_ERROR',
      message: err.message,
      ...(err.details || {}),
    });
  }
  return next(err);
}

function readAttributionSource(req) {
  return req.body?.source || req.query?.source || req.body?.src || req.query?.src;
}

/** Public feature flag */
router.get('/enabled', (_req, res) => {
  res.json({ enabled: isSavvyWatchEnabled() });
});

/** Homepage live promo — driven by events with status=live */
router.get('/live-promo', async (req, res, next) => {
  try {
    const promo = await getLiveSavvyWatchHomePromo();
    res.json(promo);
  } catch (err) {
    handleError(err, res, next);
  }
});

/** Public event page data */
router.get('/events/:slug', async (req, res, next) => {
  try {
    const page = await getPublicEventPage(req.params.slug);
    res.json(page);
  } catch (err) {
    handleError(err, res, next);
  }
});

/** Overlay/public stats */
router.get('/events/:slug/overlay', async (req, res, next) => {
  try {
    const event = await getEventBySlug(req.params.slug);
    if (!event) throw new SavvyWatchError(404, 'EVENT_NOT_FOUND', 'Event not found.');
    const participantCount = await getParticipantCount(event.eventId);
    const liveCodes = await getActiveLiveCodes(event.eventId);
    const competitions = await listCompetitions(event.eventId);
    const openCompetition = competitions.find((c) => ['entries_open', 'voting_open'].includes(c.status));
    res.json({
      event: serializeEventPublic(event, { participantCount }),
      qrUrl: buildSavvyWatchJoinUrl(event.slug, { useSourceParam: true }),
      liveWelcomeBonusAmount: LIVE_WELCOME_BONUS_AMOUNT,
      liveCodes: liveCodes.map((c) => ({ label: c.label, expiresAt: c.expiresAt, claimCount: c.claimCount })),
      openCompetition: openCompetition ? { title: openCompetition.title, status: openCompetition.status } : null,
      savvyWatchParticipants: participantCount,
    });
  } catch (err) {
    handleError(err, res, next);
  }
});

/** Authenticated session state */
router.get('/events/:slug/session', auth, async (req, res, next) => {
  try {
    const state = await getSessionState(req.user, req.params.slug);
    res.json(state);
  } catch (err) {
    handleError(err, res, next);
  }
});

router.post('/events/:slug/join', auth, savvyWatchClaimLimiter, async (req, res, next) => {
  try {
    const result = await joinEvent(req.user, req.params.slug, {
      source: readAttributionSource(req),
    });
    res.json(result);
  } catch (err) {
    handleError(err, res, next);
  }
});

router.post('/events/:slug/qr-visit', async (req, res, next) => {
  try {
    const result = await recordQrVisit(req.params.slug, { source: readAttributionSource(req) });
    res.json(result);
  } catch (err) {
    handleError(err, res, next);
  }
});

router.get('/events/:slug/live-welcome-bonus/status', auth, async (req, res, next) => {
  try {
    const status = await getLiveWelcomeBonusStatus(req.user._id);
    res.json({ ...status, bonusAmount: LIVE_WELCOME_BONUS_AMOUNT });
  } catch (err) {
    handleError(err, res, next);
  }
});

router.post('/events/:slug/live-welcome-bonus/claim', auth, savvyWatchClaimLimiter, async (req, res, next) => {
  try {
    const result = await claimLiveWelcomeBonus(req.user, req.params.slug, {
      source: readAttributionSource(req),
    });
    res.json(result);
  } catch (err) {
    handleError(err, res, next);
  }
});

router.post('/events/:slug/heartbeat', auth, savvyWatchHeartbeatLimiter, async (req, res, next) => {
  try {
    const result = await sendHeartbeat(req.user, req.params.slug, {
      visible: req.body?.visible !== false,
      interacted: Boolean(req.body?.interacted),
    });
    res.json(result);
  } catch (err) {
    handleError(err, res, next);
  }
});

router.post('/events/:slug/checkpoints/:checkpointId/claim', auth, savvyWatchClaimLimiter, async (req, res, next) => {
  try {
    const result = await claimCheckpoint(req.user, req.params.slug, req.params.checkpointId);
    res.json(result);
  } catch (err) {
    handleError(err, res, next);
  }
});

router.post('/events/:slug/live-code/redeem', auth, savvyWatchClaimLimiter, async (req, res, next) => {
  try {
    const result = await redeemLiveCode(req.user, req.params.slug, req.body?.code);
    res.json(result);
  } catch (err) {
    handleError(err, res, next);
  }
});

router.get('/history', auth, async (req, res, next) => {
  try {
    const history = await getUserHistory(req.user._id, Number(req.query.limit) || 20);
    res.json({ history });
  } catch (err) {
    handleError(err, res, next);
  }
});

// --- Competitions ---

router.get('/events/:slug/competitions/:compSlug/entries', async (req, res, next) => {
  try {
    const event = await getEventBySlug(req.params.slug);
    if (!event) throw new SavvyWatchError(404, 'EVENT_NOT_FOUND', 'Event not found.');
    const competitions = await listCompetitions(event.eventId);
    const comp = competitions.find((c) => c.slug === req.params.compSlug);
    if (!comp) throw new SavvyWatchError(404, 'COMPETITION_NOT_FOUND', 'Competition not found.');
    const entries = await listEntries(comp.competitionId);
    res.json({ competition: comp, entries });
  } catch (err) {
    handleError(err, res, next);
  }
});

router.post('/events/:slug/competitions/:compSlug/entries', auth, async (req, res, next) => {
  try {
    let entryImage = null;
    if (req.body?.entryImageBase64 && req.body?.entryImageMimeType) {
      entryImage = {
        mimeType: req.body.entryImageMimeType,
        size: Buffer.from(req.body.entryImageBase64, 'base64').length,
        data: Buffer.from(req.body.entryImageBase64, 'base64'),
      };
    }
    const entry = await submitEntry(req.user, req.params.slug, req.params.compSlug, {
      ...req.body,
      entryImage,
    });
    res.json({ entry: { entryId: entry.entryId, status: entry.status, displayName: entry.displayName } });
  } catch (err) {
    handleError(err, res, next);
  }
});

router.post('/events/:slug/competitions/:compSlug/vote', auth, async (req, res, next) => {
  try {
    const result = await castVote(req.user, req.params.slug, req.params.compSlug, req.body?.entryId);
    res.json(result);
  } catch (err) {
    handleError(err, res, next);
  }
});

// --- Admin ---

router.get('/admin/ping', auth, requireAdminAccess(), (_req, res) => {
  res.json({ ok: true, savvyWatch: true, enabled: isSavvyWatchEnabled() });
});

router.get('/admin/events', auth, requireAdminAccess(), async (req, res, next) => {
  try {
    const events = await listAdminEvents(req.user);
    res.json({ events });
  } catch (err) {
    handleError(err, res, next);
  }
});

router.post('/admin/events/preset/gta-car-meet', auth, requireAdminAccess(), async (req, res, next) => {
  try {
    const event = await createEventFromPreset(req.user, GTA_CAR_MEET_PRESET, req.body || {});
    res.json({ event });
  } catch (err) {
    handleError(err, res, next);
  }
});

router.post('/admin/events/:slug/status', auth, requireAdminAccess(), async (req, res, next) => {
  try {
    const event = await updateEventStatus(req.user, req.params.slug, req.body?.status);
    res.json({ event });
  } catch (err) {
    handleError(err, res, next);
  }
});

router.get('/admin/events/:slug/qr', auth, requireAdminAccess(), async (req, res, next) => {
  try {
    const event = await getEventBySlug(req.params.slug);
    if (!event) throw new SavvyWatchError(404, 'EVENT_NOT_FOUND', 'Event not found.');
    const joinUrl = buildSavvyWatchJoinUrl(event.slug, { useSourceParam: true });
    const stats = await getEventQrStats(event.slug);
    res.json({
      slug: event.slug,
      joinUrl,
      liveWelcomeBonusAmount: LIVE_WELCOME_BONUS_AMOUNT,
      stats,
    });
  } catch (err) {
    handleError(err, res, next);
  }
});

router.get('/admin/events/:slug/qr.png', auth, requireAdminAccess(), async (req, res, next) => {
  try {
    const event = await getEventBySlug(req.params.slug);
    if (!event) throw new SavvyWatchError(404, 'EVENT_NOT_FOUND', 'Event not found.');
    const transparent = String(req.query.transparent || '').toLowerCase() === '1';
    const png = await renderSavvyWatchLiveQrPng(event.slug, { transparent });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.setHeader('Content-Disposition', `inline; filename="savvy-watch-${event.slug}${transparent ? '-transparent' : ''}.png"`);
    res.send(png);
  } catch (err) {
    handleError(err, res, next);
  }
});

router.post('/admin/events/:slug/live-code', auth, requireAdminAccess(), async (req, res, next) => {
  try {
    const liveCode = await createLiveCode(req.user, req.params.slug, req.body || {});
    res.json({ liveCode: { code: liveCode.code, label: liveCode.label, reward: liveCode.reward, expiresAt: liveCode.expiresAt } });
  } catch (err) {
    handleError(err, res, next);
  }
});

router.post('/admin/live-code/:liveCodeId/expire', auth, requireAdminAccess(), async (req, res, next) => {
  try {
    const result = await expireLiveCode(req.user, req.params.liveCodeId);
    res.json(result);
  } catch (err) {
    handleError(err, res, next);
  }
});

router.post('/admin/competitions/:competitionId/status', auth, requireAdminAccess(), async (req, res, next) => {
  try {
    const competition = await updateCompetitionStatus(req.user, req.params.competitionId, req.body?.status);
    res.json({ competition });
  } catch (err) {
    handleError(err, res, next);
  }
});

router.post('/admin/entries/:entryId/moderate', auth, requireAdminAccess(), async (req, res, next) => {
  try {
    const entry = await moderateEntry(req.user, req.params.entryId, req.body?.action, req.body?.note);
    res.json({ entry });
  } catch (err) {
    handleError(err, res, next);
  }
});

router.post('/admin/entries/:entryId/host-score', auth, requireAdminAccess(), async (req, res, next) => {
  try {
    const result = await setHostScore(req.user, req.params.entryId, req.body?.score);
    res.json(result);
  } catch (err) {
    handleError(err, res, next);
  }
});

router.post('/admin/competitions/:competitionId/lock', auth, requireAdminAccess(), async (req, res, next) => {
  try {
    const result = await lockResults(req.user, req.params.competitionId);
    res.json(result);
  } catch (err) {
    handleError(err, res, next);
  }
});

router.post('/admin/competitions/:competitionId/award', auth, requireAdminAccess(), async (req, res, next) => {
  try {
    const result = await awardCompetitionPrizes(req.user, req.params.competitionId);
    res.json(result);
  } catch (err) {
    handleError(err, res, next);
  }
});

module.exports = router;
