const express = require('express');
const auth = require('../middleware/auth');
const { requireAdminAccess } = require('../middleware/requireRole');
const { HttpError } = require('../middleware/apiErrors');
const { assertNukeCollectionAccess } = require('../services/nukeAccessService');
const {
  getMonitorSummary,
  listMonitorRows,
  getPlayerNukeDetail,
  simulateNukeProgress,
} = require('../services/nukeProgressService');
const User = require('../models/User');

const router = express.Router();

router.use(auth, requireAdminAccess());

async function loadAuthUser(req) {
  const user = await User.findById(req.user._id || req.user.id);
  if (!user) throw new HttpError(401, 'UNAUTHORIZED', 'Authentication required');
  assertNukeCollectionAccess(user);
  return user;
}

/** Dashboard summary cards. */
router.get('/summary', async (req, res, next) => {
  try {
    await loadAuthUser(req);
    const includeTestData = req.query.includeTestData === 'true';
    return res.json(await getMonitorSummary({ includeTestData }));
  } catch (err) {
    return next(err);
  }
});

/** Searchable player monitor table. */
router.get('/players', async (req, res, next) => {
  try {
    await loadAuthUser(req);
    const { search = '', sort = 'progress_desc', includeTestData = 'false', limit = '100', skip = '0' } =
      req.query;
    return res.json(
      await listMonitorRows({
        search: String(search),
        sort: String(sort),
        includeTestData: includeTestData === 'true',
        limit: Math.min(200, Math.max(1, parseInt(limit, 10) || 100)),
        skip: Math.max(0, parseInt(skip, 10) || 0),
      })
    );
  } catch (err) {
    return next(err);
  }
});

/** Single player Nuke detail + audit timeline. */
router.get('/players/:userId', async (req, res, next) => {
  try {
    await loadAuthUser(req);
    const includeTestData = req.query.includeTestData === 'true';
    return res.json(
      await getPlayerNukeDetail(req.params.userId, { includeTestData })
    );
  } catch (err) {
    return next(err);
  }
});

/**
 * Admin test simulation — always writes testData=true rows.
 * Body: { userId, percent } where percent is 10|50|80|99|100
 */
router.post('/simulate', async (req, res, next) => {
  try {
    const admin = await loadAuthUser(req);
    const userId = req.body?.userId;
    const percent = Number(req.body?.percent);
    if (!userId) return next(new HttpError(400, 'BAD_REQUEST', 'userId is required'));
    if (!Number.isFinite(percent)) {
      return next(new HttpError(400, 'BAD_REQUEST', 'percent is required'));
    }
    const row = await simulateNukeProgress(userId, percent, admin._id);
    return res.json({ testData: true, label: 'TEST DATA', row });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
