const crypto = require('crypto');
const express = require('express');
const User = require('../models/User');
const CreatorEvent = require('../models/CreatorEvent');
const Auction = require('../models/Auction');
const auth = require('../middleware/auth');

const router = express.Router();

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function clientFingerprint(req) {
  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.ip ||
    req.connection?.remoteAddress ||
    '';
  const ua = req.headers['user-agent'] || '';
  return crypto.createHash('sha1').update(`${ip}|${ua}`).digest('hex');
}

async function loadCreatorByHandle(handle) {
  if (!handle) return null;
  const user = await User.findOne({
    username: { $regex: '^' + String(handle).replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + '$', $options: 'i' },
  }).select('_id username firstName lastName creatorHandle');
  return user || null;
}

/* -------------------------------------------------------------------------- */
/*  POST /api/creators/click — public click telemetry                          */
/* -------------------------------------------------------------------------- */

router.post('/click', async (req, res) => {
  try {
    const {
      creatorHandle,
      creatorCode,
      campaign,
      source,
      landingPath,
    } = req.body || {};

    if (!creatorHandle && !creatorCode) {
      return res.status(400).json({ code: 'BAD_REQUEST', message: 'creatorHandle or creatorCode required' });
    }

    let creatorId = null;
    let resolvedHandle = creatorHandle || null;
    if (creatorHandle) {
      const creator = await loadCreatorByHandle(creatorHandle);
      if (creator) {
        creatorId = creator._id;
        resolvedHandle = creator.username;
      }
    }

    // De-dupe identical clicks within a 30s window from the same fingerprint.
    const dedupeKey = crypto
      .createHash('sha1')
      .update(`${resolvedHandle || creatorCode || ''}|${clientFingerprint(req)}`)
      .digest('hex');

    const recent = await CreatorEvent.findOne({
      type: 'click',
      dedupeKey,
      createdAt: { $gte: new Date(Date.now() - 30 * 1000) },
    }).select('_id').lean();

    if (recent) {
      return res.json({ ok: true, deduped: true });
    }

    await CreatorEvent.create({
      type: 'click',
      creatorId,
      creatorHandle: resolvedHandle,
      creatorCode: creatorCode || null,
      campaign: campaign || null,
      source: source || null,
      landingPath: landingPath ? String(landingPath).slice(0, 512) : null,
      dedupeKey,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error('Creator click telemetry error:', err);
    return res.status(500).json({ code: 'SERVER_ERROR', message: 'Server error' });
  }
});

/* -------------------------------------------------------------------------- */
/*  GET /api/creators/:handle/profile — lightweight public creator profile     */
/* -------------------------------------------------------------------------- */

router.get('/:handle/profile', async (req, res) => {
  try {
    const creator = await loadCreatorByHandle(req.params.handle);
    if (!creator) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Creator not found' });
    }

    const followers = await User.countDocuments({ following: creator._id });
    const referredCount = await User.countDocuments({ creatorId: creator._id });

    return res.json({
      handle: creator.username,
      firstName: creator.firstName || null,
      lastName: creator.lastName || null,
      followers,
      referredUsers: referredCount,
    });
  } catch (err) {
    console.error('Creator profile error:', err);
    return res.status(500).json({ code: 'SERVER_ERROR', message: 'Server error' });
  }
});

/* -------------------------------------------------------------------------- */
/*  GET /api/creators/:handle/analytics — authed creator analytics             */
/* -------------------------------------------------------------------------- */

router.get('/:handle/analytics', auth, async (req, res) => {
  try {
    const creator = await loadCreatorByHandle(req.params.handle);
    if (!creator) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Creator not found' });
    }

    // Only the creator themselves OR an admin can view full analytics.
    const isSelf = String(creator._id) === String(req.user._id);
    const isAdmin =
      typeof req.user.isAdmin === 'function' ? req.user.isAdmin() : false;
    if (!isSelf && !isAdmin) {
      return res.status(403).json({ code: 'FORBIDDEN', message: 'Forbidden' });
    }

    const period = String(req.query.period || 'all').toLowerCase();
    let since = null;
    if (period === 'week') {
      since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === 'month') {
      since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    const summary = await CreatorEvent.summaryForCreator(creator._id, since);

    // A small daily timeseries for a chart.
    const seriesSince = since || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const series = await CreatorEvent.aggregate([
      { $match: { creatorId: creator._id, createdAt: { $gte: seriesSince } } },
      {
        $group: {
          _id: {
            day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            type: '$type',
          },
          count: { $sum: 1 },
          amount: { $sum: '$amount' },
        },
      },
      { $sort: { '_id.day': 1 } },
    ]);

    return res.json({
      handle: creator.username,
      period,
      summary,
      series,
    });
  } catch (err) {
    console.error('Creator analytics error:', err);
    return res.status(500).json({ code: 'SERVER_ERROR', message: 'Server error' });
  }
});

/* -------------------------------------------------------------------------- */
/*  GET /api/creators/:handle/curated — creator-curated listing surface        */
/* -------------------------------------------------------------------------- */

router.get('/:handle/curated', async (req, res) => {
  try {
    const creator = await loadCreatorByHandle(req.params.handle);
    if (!creator) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Creator not found' });
    }

    // Curated listings are auctions the creator created or won and chose to
    // pin. We re-use the existing pinnedWins field and also include their
    // own active listings.
    const pinned = await User.findById(creator._id).select('pinnedWins').lean();
    const pinnedIds = (pinned?.pinnedWins || []).slice(0, 24);

    let listings = [];
    if (pinnedIds.length) {
      listings = await Auction.find({ _id: { $in: pinnedIds } })
        .limit(24)
        .lean();
    }

    return res.json({
      handle: creator.username,
      curated: listings.map((a) => ({
        ...a,
        recommendedBy: creator.username,
      })),
    });
  } catch (err) {
    console.error('Creator curated listings error:', err);
    return res.status(500).json({ code: 'SERVER_ERROR', message: 'Server error' });
  }
});

module.exports = router;
