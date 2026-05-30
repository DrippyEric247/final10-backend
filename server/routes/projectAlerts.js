const router = require('express').Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Alert = require('../models/Alert');
const ProjectAlert = require('../models/ProjectAlert');
const { getTierConfig, normalizeTier } = require('../config/subscriptionPlans');
const { isBetaTester, getTierConfigForUser } = require('../services/betaTesterService');

function projectCaps(user) {
  return getTierConfigForUser(user);
}

function countActiveProjects(userId) {
  return ProjectAlert.countDocuments({
    user: userId,
    status: { $nin: ['completed'] },
  });
}

async function assertProjectEnabled(user) {
  if (isBetaTester(user)) {
    const cfg = getTierConfigForUser(user);
    return { tier: 'elite', cfg };
  }
  const tier = normalizeTier(user.subscription?.tier || user.membershipTier || 'free');
  const cfg = projectCaps(user);
  if (!cfg.projectAlertsEnabled) {
    const err = new Error('Project alerts require a Core or higher subscription');
    err.status = 403;
    throw err;
  }
  return { tier, cfg };
}

router.get('/', auth, async (req, res, next) => {
  try {
    const projects = await ProjectAlert.find({ user: req.user.id }).sort('-updatedAt').lean();
    res.json(projects);
  } catch (e) {
    next(e);
  }
});

router.post('/', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('subscription membershipTier betaTester foundingAccess betaAccessExpiresAt');
    if (!user) return res.status(404).json({ message: 'User not found' });
    const { cfg } = await assertProjectEnabled(user);

    const active = await countActiveProjects(req.user.id);
    const maxP = cfg.projectActiveMax;
    if (maxP != null && Number.isFinite(maxP) && active >= maxP) {
      return res.status(403).json({
        message: `Active project limit reached (${maxP}) for ${cfg.label}`,
        projectActiveMax: maxP,
      });
    }

    const {
      name,
      category = 'general',
      budget,
      trustRequirement = 0,
      items = [],
      bundleSavingsTarget,
      aiSummary = '',
    } = req.body;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ message: 'Project name is required' });
    }

    const maxItems = cfg.projectItemsMaxPerProject;
    const cleanedItems = (Array.isArray(items) ? items : []).map((it) => ({
      title: String(it.title || '').trim(),
      keywords: Array.isArray(it.keywords)
        ? it.keywords.map((k) => String(k).trim()).filter(Boolean).slice(0, 12)
        : [],
      targetPrice:
        cfg.projectPriceTargetsPerItem && Number.isFinite(Number(it.targetPrice))
          ? Number(it.targetPrice)
          : undefined,
      estimatedSavings: Number.isFinite(Number(it.estimatedSavings)) ? Number(it.estimatedSavings) : 0,
      trustMin: Number.isFinite(Number(it.trustMin)) ? Math.min(100, Math.max(0, Number(it.trustMin))) : 0,
      status: ['watching', 'found', 'skipped'].includes(it.status) ? it.status : 'watching',
      notes: String(it.notes || '').slice(0, 500),
    })).filter((it) => it.title);

    if (maxItems != null && Number.isFinite(maxItems) && cleanedItems.length > maxItems) {
      return res.status(400).json({ message: `Max ${maxItems} items per project on your plan` });
    }

    const project = await ProjectAlert.create({
      user: req.user.id,
      name: String(name).trim().slice(0, 120),
      category: String(category).trim().slice(0, 64),
      budget: Number.isFinite(Number(budget)) ? Number(budget) : undefined,
      trustRequirement: Math.min(100, Math.max(0, Number(trustRequirement) || 0)),
      items: cleanedItems,
      bundleSavingsTarget: cfg.projectBundleSavings && Number.isFinite(Number(bundleSavingsTarget))
        ? Number(bundleSavingsTarget)
        : undefined,
      aiSummary: cfg.projectAiPartsList ? String(aiSummary || '').slice(0, 4000) : '',
    });
    project.recomputeStatus();
    await project.save();
    res.status(201).json(project);
  } catch (e) {
    if (e.status === 403) return res.status(403).json({ message: e.message });
    next(e);
  }
});

router.patch('/:id', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('subscription membershipTier betaTester foundingAccess betaAccessExpiresAt');
    const { cfg } = await assertProjectEnabled(user);

    const project = await ProjectAlert.findOne({ _id: req.params.id, user: req.user.id });
    if (!project) return res.status(404).json({ message: 'Not found' });

    const { name, category, budget, trustRequirement, status, bundleSavingsTarget, estimatedBundleSavings, aiSummary } =
      req.body;

    if (name != null) project.name = String(name).trim().slice(0, 120);
    if (category != null) project.category = String(category).trim().slice(0, 64);
    if (budget !== undefined) project.budget = Number.isFinite(Number(budget)) ? Number(budget) : undefined;
    if (trustRequirement != null) {
      project.trustRequirement = Math.min(100, Math.max(0, Number(trustRequirement) || 0));
    }
    if (status != null && ['watching', 'ready', 'completed'].includes(status)) project.status = status;
    if (cfg.projectBundleSavings && bundleSavingsTarget !== undefined) {
      project.bundleSavingsTarget = Number.isFinite(Number(bundleSavingsTarget))
        ? Number(bundleSavingsTarget)
        : undefined;
    }
    if (cfg.projectBundleSavings && estimatedBundleSavings != null) {
      project.estimatedBundleSavings = Number.isFinite(Number(estimatedBundleSavings))
        ? Number(estimatedBundleSavings)
        : 0;
    }
    if (cfg.projectAiPartsList && aiSummary != null) {
      project.aiSummary = String(aiSummary).slice(0, 4000);
    }
    project.recomputeStatus();
    await project.save();
    res.json(project);
  } catch (e) {
    if (e.status === 403) return res.status(403).json({ message: e.message });
    next(e);
  }
});

router.delete('/:id', auth, async (req, res, next) => {
  try {
    const del = await ProjectAlert.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!del) return res.status(404).json({ message: 'Not found' });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.post('/:id/items', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('subscription membershipTier betaTester foundingAccess betaAccessExpiresAt');
    const { cfg } = await assertProjectEnabled(user);

    const project = await ProjectAlert.findOne({ _id: req.params.id, user: req.user.id });
    if (!project) return res.status(404).json({ message: 'Not found' });

    const maxItems = cfg.projectItemsMaxPerProject;
    if (maxItems != null && Number.isFinite(maxItems) && project.items.length >= maxItems) {
      return res.status(403).json({ message: `Max ${maxItems} tracked items per project` });
    }

    const it = req.body || {};
    const title = String(it.title || '').trim();
    if (!title) return res.status(400).json({ message: 'Item title required' });

    project.items.push({
      title: title.slice(0, 200),
      keywords: Array.isArray(it.keywords)
        ? it.keywords.map((k) => String(k).trim()).filter(Boolean).slice(0, 12)
        : [],
      targetPrice: cfg.projectPriceTargetsPerItem && Number.isFinite(Number(it.targetPrice))
        ? Number(it.targetPrice)
        : undefined,
      estimatedSavings: Number.isFinite(Number(it.estimatedSavings)) ? Number(it.estimatedSavings) : 0,
      trustMin: Number.isFinite(Number(it.trustMin)) ? Math.min(100, Math.max(0, Number(it.trustMin))) : 0,
      status: 'watching',
      notes: String(it.notes || '').slice(0, 500),
    });
    project.recomputeStatus();
    await project.save();
    res.status(201).json(project);
  } catch (e) {
    if (e.status === 403) return res.status(403).json({ message: e.message });
    next(e);
  }
});

router.patch('/:id/items/:itemId', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('subscription membershipTier betaTester foundingAccess betaAccessExpiresAt');
    const { cfg } = await assertProjectEnabled(user);

    const project = await ProjectAlert.findOne({ _id: req.params.id, user: req.user.id });
    if (!project) return res.status(404).json({ message: 'Not found' });

    const item = project.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ message: 'Item not found' });

    const it = req.body || {};
    if (it.title != null) item.title = String(it.title).trim().slice(0, 200);
    if (Array.isArray(it.keywords)) {
      item.keywords = it.keywords.map((k) => String(k).trim()).filter(Boolean).slice(0, 12);
    }
    if (cfg.projectPriceTargetsPerItem && it.targetPrice !== undefined) {
      item.targetPrice = Number.isFinite(Number(it.targetPrice)) ? Number(it.targetPrice) : undefined;
    }
    if (it.estimatedSavings != null) {
      item.estimatedSavings = Number.isFinite(Number(it.estimatedSavings)) ? Number(it.estimatedSavings) : 0;
    }
    if (it.trustMin != null) item.trustMin = Math.min(100, Math.max(0, Number(it.trustMin) || 0));
    if (it.status != null && ['watching', 'found', 'skipped'].includes(it.status)) item.status = it.status;
    if (it.notes != null) item.notes = String(it.notes).slice(0, 500);

    project.recomputeStatus();
    await project.save();
    res.json(project);
  } catch (e) {
    if (e.status === 403) return res.status(403).json({ message: e.message });
    next(e);
  }
});

router.delete('/:id/items/:itemId', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('subscription membershipTier betaTester foundingAccess betaAccessExpiresAt');
    await assertProjectEnabled(user);

    const project = await ProjectAlert.findOne({ _id: req.params.id, user: req.user.id });
    if (!project) return res.status(404).json({ message: 'Not found' });

    const item = project.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ message: 'Item not found' });

    if (item.linkedAlertId) {
      await Alert.deleteOne({ _id: item.linkedAlertId, user: req.user.id }).catch(() => {});
    }
    await item.deleteOne();
    project.recomputeStatus();
    await project.save();
    res.json(project);
  } catch (e) {
    if (e.status === 403) return res.status(403).json({ message: e.message });
    next(e);
  }
});

router.post('/:id/spawn-missing-alerts', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('subscription membershipTier betaTester foundingAccess betaAccessExpiresAt');
    const { tier, cfg } = await assertProjectEnabled(user);

    const project = await ProjectAlert.findOne({ _id: req.params.id, user: req.user.id });
    if (!project) return res.status(404).json({ message: 'Not found' });

    let existingAlerts = await Alert.countDocuments({ user: req.user.id });
    const alertsMax = cfg.alertsMax;
    const created = [];

    for (const item of project.items) {
      if (item.status !== 'watching' || item.linkedAlertId) continue;
      if (alertsMax != null && Number.isFinite(alertsMax) && existingAlerts >= alertsMax) break;

      const keywords =
        item.keywords && item.keywords.length
          ? item.keywords
          : item.title.split(/\s+/).filter(Boolean).slice(0, 8);

      const alert = await Alert.create({
        user: req.user.id,
        name: `${project.name} • ${item.title}`.slice(0, 120),
        keywords,
        maxPrice: cfg.projectPriceTargetsPerItem ? item.targetPrice : project.budget,
        minConfidence: Math.max(70, project.trustRequirement || 70),
        sources: ['ebay'],
        persona: 'buyer',
        kind: 'project_part',
        status: 'active',
        context: {
          projectAlertId: String(project._id),
          projectItemId: String(item._id),
          alertsSpeed: cfg.alertsSpeed,
          subscriptionTier: tier,
        },
      });
      item.linkedAlertId = alert._id;
      existingAlerts += 1;
      created.push(alert._id);
    }

    project.recomputeStatus();
    await project.save();
    res.json({ ok: true, createdCount: created.length, alertIds: created });
  } catch (e) {
    if (e.status === 403) return res.status(403).json({ message: e.message });
    next(e);
  }
});

module.exports = router;
