const router = require('express').Router();
const Alert = require('../models/Alert');
const auth = require('../middleware/auth');  // your JWT middleware
const User = require('../models/User');
const { getTierConfig, normalizeTier } = require('../config/subscriptionPlans');
const { isBetaTester, getTierConfigForUser, logBetaUsage } = require('../services/betaTesterService');
const { auditAlertCreated } = require('../services/auditLogger');
const { normalizeAlertKeywords } = require('../lib/alertKeywords');

// Get my alerts
router.get('/', auth, async (req, res) => {
  const alerts = await Alert.find({ user: req.user.id })
    .sort('-updatedAt')
    .populate({
      path: 'matches.auction',
      select: 'title currentBid timeRemaining source url images',
    });
  res.json(alerts);
});

// Create alert
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
  if (!name || !Array.isArray(keywords)) return res.status(400).json({ message: 'Invalid payload' });
  const user = await User.findById(req.user.id).select('subscription membershipTier betaTester foundingAccess betaAccessExpiresAt');
  if (!user) return res.status(404).json({ message: 'User not found' });
  const tierCfg = getTierConfigForUser(user);
  const existingCount = await Alert.countDocuments({ user: req.user.id });
  if (Number.isFinite(tierCfg.alertsMax) && existingCount >= tierCfg.alertsMax) {
    return res.status(403).json({
      message: `Alert limit reached for ${tierCfg.label} plan`,
      alertsMax: tierCfg.alertsMax,
      alertsSpeed: tierCfg.alertsSpeed,
    });
  }

  const normalizedKeywords = normalizeAlertKeywords(keywords);
  if (!normalizedKeywords.length) {
    return res.status(400).json({ message: 'At least one keyword is required' });
  }

  const alert = await Alert.create({
    user: req.user.id,
    name,
    keywords: normalizedKeywords,
    maxPrice,
    minConfidence,
    sources,
    persona,
    kind,
    status,
    context: {
      ...context,
      alertsSpeed: tierCfg.alertsSpeed,
      subscriptionTier: isBetaTester(user)
        ? 'elite'
        : normalizeTier(user.subscription?.tier || user.membershipTier || 'free'),
    },
  });

  // Opt users into match emails when they create an alert (can disable in settings later).
  await User.findByIdAndUpdate(req.user.id, { alertEmailOnMatch: true });

  if (isBetaTester(user)) {
    void logBetaUsage(user._id, 'alert_created', { name: String(name).slice(0, 80) });
  }

  auditAlertCreated({
    userId: String(req.user.id),
    alertId: String(alert._id),
    keywordCount: alert.keywords?.length || 0,
    tier: tierCfg.label,
    alertsMax: tierCfg.alertsMax,
    existingCount,
  });

  res.status(201).json(alert);
  } catch (err) {
    auditAlertCreated({
      userId: String(req.user?.id || ''),
      error: true,
      message: String(err?.message || '').slice(0, 200),
    });
    console.error('[alerts] create failed:', err?.message || err);
    res.status(500).json({ message: 'Could not create alert' });
  }
});

// Toggle on/off
router.patch('/:id/toggle', auth, async (req, res) => {
  const alert = await Alert.findOne({ _id: req.params.id, user: req.user.id });
  if (!alert) return res.status(404).json({ message: 'Not found' });
  alert.isActive = !alert.isActive;
  await alert.save();
  res.json(alert);
});

// Update fields (edit from client)
router.patch('/:id', auth, async (req, res) => {
  const alert = await Alert.findOne({ _id: req.params.id, user: req.user.id });
  if (!alert) return res.status(404).json({ message: 'Not found' });
  const body = req.body || {};
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
    alert.context = { ...alert.context, ...body.context };
  }
  await alert.save();
  res.json(alert);
});

// Delete
router.delete('/:id', auth, async (req, res) => {
  const del = await Alert.findOneAndDelete({ _id: req.params.id, user: req.user.id });
  if (!del) return res.status(404).json({ message: 'Not found' });
  res.json({ ok: true });
});

module.exports = router;



































