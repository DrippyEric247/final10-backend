const router = require('express').Router();
const Alert = require('../models/Alert');
const auth = require('../middleware/auth');
const User = require('../models/User');
const { isBetaTester, logBetaUsage } = require('../services/betaTesterService');
const { auditAlertCreated } = require('../services/auditLogger');
const {
  createAlertAuthoritative,
  AlertLimitError,
  serializeAlertForClient,
  refreshAlertScheduleIfNeeded,
  countActiveAlerts,
} = require('../services/alertCreationService');
const { getEntitlementByUserId } = require('../services/premiumEntitlementService');
const { resolveAlertSpeedProfile } = require('../services/alertTimingService');
const { normalizeAlertKeywords } = require('../lib/alertKeywords');

const USER_ALERT_FIELDS =
  'subscription membershipTier premiumTier isPremium premium referralCodeUsed foundingTesterProgramCompleted betaTester foundingAccess betaAccessExpiresAt subscriptionExpires membershipExpiresAt perkMachine';

// Get my alerts — server-authoritative scheduling state
router.get('/', auth, async (req, res) => {
  const alerts = await Alert.find({ user: req.user.id })
    .sort('-updatedAt')
    .populate({
      path: 'matches.auction',
      select: 'title currentBid timeRemaining source url images',
    });

  const refreshed = [];
  for (const alert of alerts) {
    refreshed.push(await refreshAlertScheduleIfNeeded(alert, req.user.id));
  }
  res.json(refreshed.map(serializeAlertForClient));
});

// Create alert — server limit + activation schedule
router.post('/', auth, async (req, res) => {
  try {
    const {
      name,
      keywords = [],
      maxPrice,
      minConfidence = 70,
      sources = ['ebay'],
      persona = 'buyer',
      kind = 'custom',
      status = 'active',
      context = {},
    } = req.body;

    if (!name || !Array.isArray(keywords)) {
      return res.status(400).json({ message: 'Invalid payload', code: 'INVALID_PAYLOAD' });
    }

    if (
      req.body?.nextScanAt != null ||
      req.body?.eligibleAt != null ||
      req.body?.effectiveSpeedTier != null ||
      req.body?.alertsMax != null
    ) {
      return res.status(400).json({
        message: 'Client cannot set alert scheduling or limit fields.',
        code: 'CLIENT_SCHEDULE_REJECTED',
      });
    }

    const user = await User.findById(req.user.id).select(USER_ALERT_FIELDS);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const ent = await getEntitlementByUserId(req.user.id);
    const profile = await resolveAlertSpeedProfile(req.user.id, user, ent);
    const tierCfg = require('../services/betaTesterService').getTierConfigForUser(user, ent);
    const activeCount = await countActiveAlerts(req.user.id);

    const alert = await createAlertAuthoritative(req.user.id, user, ent, {
      name,
      keywords,
      maxPrice,
      minConfidence,
      sources,
      persona,
      kind,
      status,
      context,
    });

    await User.findByIdAndUpdate(req.user.id, { alertEmailOnMatch: true });

    if (isBetaTester(user)) {
      void logBetaUsage(user._id, 'alert_created', { name: String(name).slice(0, 80) });
    }

    auditAlertCreated({
      userId: String(req.user.id),
      alertId: String(alert._id),
      keywordCount: alert.keywords?.length || 0,
      tier: profile.label,
      alertsMax: tierCfg.alertsMax,
      existingCount: activeCount,
      eligibleAt: alert.eligibleAt,
      nextScanAt: alert.nextScanAt,
    });

    setImmediate(() => {
      try {
        const { recordScoutMissionTrigger } = require('../services/scoutMissionProgressService');
        void recordScoutMissionTrigger(req.user.id, 'create_alert', {
          source: 'server',
          dedupeKey: `create_alert:${String(alert._id)}`,
        });
      } catch {
        /* non-blocking */
      }
    });

    return res.status(201).json({
      ...serializeAlertForClient(alert),
      alertsMax: tierCfg.alertsMax,
      alertsRemaining: Number.isFinite(tierCfg.alertsMax)
        ? Math.max(0, tierCfg.alertsMax - (activeCount + 1))
        : null,
      alertSpeedTier: profile.tier,
      alertsSpeed: tierCfg.alertsSpeed,
    });
  } catch (err) {
    if (err instanceof AlertLimitError || err?.code === 'ALERT_LIMIT_REACHED') {
      return res.status(403).json({
        message: err.message,
        code: 'ALERT_LIMIT_REACHED',
        ...(err.details || {}),
      });
    }
    auditAlertCreated({
      userId: String(req.user?.id || ''),
      error: true,
      message: String(err?.message || '').slice(0, 200),
    });
    console.error('[alerts] create failed:', err?.message || err);
    return res.status(err.status || 500).json({ message: err.message || 'Could not create alert' });
  }
});

router.patch('/:id/toggle', auth, async (req, res) => {
  const alert = await Alert.findOne({ _id: req.params.id, user: req.user.id });
  if (!alert) return res.status(404).json({ message: 'Not found' });

  const willActivate = !alert.isActive;
  if (willActivate) {
    const user = await User.findById(req.user.id).select(USER_ALERT_FIELDS);
    const ent = await getEntitlementByUserId(req.user.id);
    const tierCfg = require('../services/betaTesterService').getTierConfigForUser(user, ent);
    const activeCount = await countActiveAlerts(req.user.id);
    if (Number.isFinite(tierCfg.alertsMax) && activeCount >= tierCfg.alertsMax) {
      return res.status(403).json({
        message: `Alert limit reached for ${tierCfg.label} plan`,
        code: 'ALERT_LIMIT_REACHED',
        alertsMax: tierCfg.alertsMax,
      });
    }
  }

  alert.isActive = !alert.isActive;
  if (alert.isActive && alert.status === 'paused') alert.status = 'active';
  if (!alert.isActive) alert.status = 'paused';
  await alert.save();
  res.json(serializeAlertForClient(alert));
});

router.patch('/:id', auth, async (req, res) => {
  const alert = await Alert.findOne({ _id: req.params.id, user: req.user.id });
  if (!alert) return res.status(404).json({ message: 'Not found' });

  const body = req.body || {};
  if (
    body.nextScanAt != null ||
    body.eligibleAt != null ||
    body.effectiveSpeedTier != null ||
    body.lastScannedAt != null
  ) {
    return res.status(400).json({
      message: 'Client cannot modify alert scheduling fields.',
      code: 'CLIENT_SCHEDULE_REJECTED',
    });
  }

  if (body.name != null) alert.name = String(body.name).trim().slice(0, 200);
  if (Array.isArray(body.keywords)) {
    alert.keywords = normalizeAlertKeywords(body.keywords);
    if (!alert.keywords.length) {
      return res.status(400).json({ message: 'At least one keyword is required' });
    }
  }
  if (body.maxPrice !== undefined) {
    alert.maxPrice =
      body.maxPrice === null || body.maxPrice === '' ? undefined : Number(body.maxPrice);
  }
  if (body.minConfidence != null) {
    const c = Number(body.minConfidence);
    if (Number.isFinite(c)) alert.minConfidence = Math.min(100, Math.max(0, Math.round(c)));
  }
  if (body.kind != null) alert.kind = String(body.kind).slice(0, 64);
  if (body.persona != null) alert.persona = body.persona;
  if (Array.isArray(body.sources)) alert.sources = body.sources;
  if (body.status != null) alert.status = body.status;
  if (body.context != null && typeof body.context === 'object') {
    const { nextScanAt, eligibleAt, alertSpeedTier, ...safe } = body.context;
    alert.context = { ...alert.context, ...safe };
  }
  await alert.save();
  res.json(serializeAlertForClient(alert));
});

router.delete('/:id', auth, async (req, res) => {
  const del = await Alert.findOneAndDelete({ _id: req.params.id, user: req.user.id });
  if (!del) return res.status(404).json({ message: 'Not found' });
  res.json({ ok: true });
});

module.exports = router;
