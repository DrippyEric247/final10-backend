const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');
const { requireAdminAccess } = require('../middleware/requireRole');
const { HttpError } = require('../middleware/apiErrors');
const {
  getActiveDropForUser,
  createSupplyDrop,
  claimSupplyDrop,
  expireActiveDropsForUser,
  getRecentClaims,
  SupplyDropError,
} = require('../services/supplyDropService');
const {
  getActiveSavvySale,
  startSavvySale,
  endSavvySale,
} = require('../services/savvySaleService');
const { logLiveEventAdmin } = require('../services/liveEventsAdminService');
const { DEFAULT_CLAIM_WINDOW_MS } = require('../config/supplyDropRewards');
const { buildEventsHub } = require('../services/eventsHubService');
const { buildActivationState, markEventActivated, markExplanationDismissed, resetActivationSeen } = require('../services/eventActivationService');
const {
  getPendingSummary,
  getEventHistory,
  markSummaryShown,
} = require('../services/eventSummaryService');

const router = express.Router();

function handleServiceError(err, next) {
  if (err instanceof SupplyDropError) {
    return { status: err.status, body: { message: err.message, code: err.code } };
  }
  return null;
}

router.get('/supply-drop/active', auth, async (req, res, next) => {
  try {
    const drop = await getActiveDropForUser(req.user.id);
    res.json({ drop });
  } catch (err) {
    console.error('[events/supply-drop/active]', err);
    next(err);
  }
});

router.post('/supply-drop/claim', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return next(new HttpError(404, 'NOT_FOUND', 'User not found'));

    const dropId = String(req.body?.dropId || '').trim();
    if (!dropId) return next(new HttpError(400, 'DROP_ID_REQUIRED', 'dropId is required'));

    const result = await claimSupplyDrop(user, dropId);
    res.json({ message: `Supply Drop claimed — ${result.reward.label}`, ...result });
  } catch (err) {
    const mapped = handleServiceError(err);
    if (mapped) return res.status(mapped.status).json(mapped.body);
    console.error('[events/supply-drop/claim]', err);
    next(err);
  }
});

router.get('/savvy-sale/active', auth, async (req, res, next) => {
  try {
    const sale = await getActiveSavvySale();
    res.json({ sale });
  } catch (err) {
    console.error('[events/savvy-sale/active]', err);
    next(err);
  }
});

router.get('/hub', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return next(new HttpError(404, 'NOT_FOUND', 'User not found'));
    const hub = await buildEventsHub(user);
    res.json(hub);
  } catch (err) {
    console.error('[events/hub]', err);
    next(err);
  }
});

router.get('/summary/pending', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return next(new HttpError(404, 'NOT_FOUND', 'User not found'));
    const summary = await getPendingSummary(user);
    if (user.isModified()) await user.save();
    res.json({ summary });
  } catch (err) {
    console.error('[events/summary/pending]', err);
    next(err);
  }
});

router.get('/summary/history', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return next(new HttpError(404, 'NOT_FOUND', 'User not found'));
    const limit = Math.min(80, Math.max(1, Number(req.query.limit) || 40));
    const history = await getEventHistory(user, { limit });
    if (user.isModified()) await user.save();
    res.json({ history });
  } catch (err) {
    console.error('[events/summary/history]', err);
    next(err);
  }
});

router.post('/summary/dismiss', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return next(new HttpError(404, 'NOT_FOUND', 'User not found'));
    const summaryId = String(req.body?.summaryId || '').trim();
    const action = String(req.body?.action || 'dismiss').trim();
    if (!summaryId) return next(new HttpError(400, 'SUMMARY_ID_REQUIRED', 'summaryId is required'));
    const summary = await markSummaryShown(user, summaryId, { action });
    res.json({ message: 'Event summary recorded.', summary });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ message: err.message, code: err.code });
    }
    console.error('[events/summary/dismiss]', err);
    next(err);
  }
});

router.get('/activation/state', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return next(new HttpError(404, 'NOT_FOUND', 'User not found'));
    res.json(await buildActivationState(user));
  } catch (err) {
    console.error('[events/activation/state]', err);
    next(err);
  }
});

router.post('/activation/activate', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return next(new HttpError(404, 'NOT_FOUND', 'User not found'));
    const activationId = String(req.body?.activationId || '').trim();
    const eventKey = String(req.body?.eventKey || '').trim();
    const state = await markEventActivated(user, { activationId, eventKey });
    res.json({ message: 'Event activated.', ...state });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ message: err.message, code: err.code });
    }
    console.error('[events/activation/activate]', err);
    next(err);
  }
});

router.post('/activation/dismiss-explanation', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return next(new HttpError(404, 'NOT_FOUND', 'User not found'));
    const activationId = String(req.body?.activationId || '').trim();
    const state = await markExplanationDismissed(user, { activationId });
    res.json({ message: 'Explanation dismissed.', ...state });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ message: err.message, code: err.code });
    }
    console.error('[events/activation/dismiss-explanation]', err);
    next(err);
  }
});

router.post('/admin/reset-activation', auth, requireAdminAccess(), async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return next(new HttpError(404, 'NOT_FOUND', 'User not found'));
    const state = await resetActivationSeen(user);
    res.json({ message: 'Event activation state reset.', ...state });
  } catch (err) {
    console.error('[events/admin/reset-activation]', err);
    next(err);
  }
});

router.get('/live-state', auth, async (req, res, next) => {
  try {
    const [drop, sale] = await Promise.all([
      getActiveDropForUser(req.user.id),
      getActiveSavvySale(),
    ]);
    res.json({ supplyDrop: drop, savvySale: sale });
  } catch (err) {
    console.error('[events/live-state]', err);
    next(err);
  }
});

router.get('/admin/ping', auth, requireAdminAccess(), (req, res) => {
  res.json({ ok: true, feature: 'live-events' });
});

router.post('/supply-drop/create-test', auth, requireAdminAccess(), async (req, res, next) => {
  try {
    const adminUser = await User.findById(req.user.id);
    const scope = String(req.body?.scope || 'user').trim();
    const targetUserId = scope === 'global' ? null : String(req.body?.userId || req.user.id);

    const drop = await createSupplyDrop({
      scope: scope === 'global' ? 'global' : 'user',
      userId: targetUserId,
      createdBy: adminUser._id,
      source: 'admin',
      durationMs: DEFAULT_CLAIM_WINDOW_MS,
      forceRewardId: req.body?.forceRewardId || null,
    });

    const log = logLiveEventAdmin('create_supply_drop', adminUser, { scope, dropId: drop.dropId });
    res.json({ drop, adminLog: log });
  } catch (err) {
    const mapped = handleServiceError(err);
    if (mapped) return res.status(mapped.status).json(mapped.body);
    console.error('[events/supply-drop/create-test]', err);
    next(err);
  }
});

router.post('/supply-drop/expire', auth, requireAdminAccess(), async (req, res, next) => {
  try {
    const adminUser = await User.findById(req.user.id);
    const userId = req.body?.userId || req.user.id;
    const result = await expireActiveDropsForUser(userId);
    const log = logLiveEventAdmin('expire_supply_drop', adminUser, result);
    res.json({ ...result, adminLog: log });
  } catch (err) {
    console.error('[events/supply-drop/expire]', err);
    next(err);
  }
});

router.get('/supply-drop/recent-claims', auth, requireAdminAccess(), async (req, res, next) => {
  try {
    const claims = await getRecentClaims(Number(req.query?.limit) || 20);
    res.json({ claims });
  } catch (err) {
    console.error('[events/supply-drop/recent-claims]', err);
    next(err);
  }
});

router.post('/savvy-sale/start', auth, requireAdminAccess(), async (req, res, next) => {
  try {
    const adminUser = await User.findById(req.user.id);
    const minutes = Number(req.body?.minutes) || 15;
    const sale = await startSavvySale({
      durationMinutes: minutes,
      createdBy: adminUser._id,
      source: 'admin',
    });
    const log = logLiveEventAdmin('start_savvy_sale', adminUser, { minutes, eventId: sale.eventId });
    res.json({ sale, adminLog: log });
  } catch (err) {
    console.error('[events/savvy-sale/start]', err);
    next(err);
  }
});

router.post('/savvy-sale/end', auth, requireAdminAccess(), async (req, res, next) => {
  try {
    const adminUser = await User.findById(req.user.id);
    const result = await endSavvySale();
    const log = logLiveEventAdmin('end_savvy_sale', adminUser, result);
    res.json({ ...result, adminLog: log });
  } catch (err) {
    console.error('[events/savvy-sale/end]', err);
    next(err);
  }
});

module.exports = router;
