const router = require('express').Router();
const crypto = require('crypto');
const auth = require('../middleware/auth');

const User = require('../models/User');
const Alert = require('../models/Alert');
const ProjectAlert = require('../models/ProjectAlert');
const BuildWarsEntry = require('../models/BuildWarsEntry');
const BuildWarsVote = require('../models/BuildWarsVote');
const PointsLedger = require('../models/PointsLedger');
const { creditSavvy } = require('../services/savvyBalanceService');
const BW = require('../config/buildWars');
const {
  scoreProject,
  validateProjectForEntry,
  buildTypeLabel,
  computeFinalScore,
} = require('../lib/buildWarsScoring');

async function grantSavvyPoints(userId, amount, source, idempotencyKey) {
  if (!amount || amount <= 0) return { granted: false, amount: 0 };
  try {
    await PointsLedger.create({
      userId,
      type: 'earn',
      amount,
      source,
      refId: BW.EVENT_ID,
      idempotencyKey,
    });
  } catch (e) {
    if (e?.code === 11000) return { granted: false, amount: 0, duplicate: true };
    throw e;
  }
  const result = await creditSavvy(userId, {
    amount,
    source,
    idempotencyKey: `${idempotencyKey}:savvy`,
    meta: { refId: BW.EVENT_ID },
  });
  if (result.duplicate) return { granted: false, amount: 0, duplicate: true };
  return { granted: result.granted, amount: result.granted ? amount : 0 };
}

function luckyRollStable(userId) {
  const h = crypto.createHash('sha256').update(`${BW.EVENT_ID}:${String(userId)}`).digest();
  const n = h.readUInt32BE(0) / 0xffffffff;
  return n < BW.luckyDraw.probability;
}

function eventWindow() {
  const now = Date.now();
  return {
    now,
    started: now >= BW.startsAt.getTime(),
    ended: now > BW.endsAt.getTime(),
    startsAt: BW.startsAt,
    endsAt: BW.endsAt,
  };
}

router.get('/config', (_req, res) => {
  const w = eventWindow();
  res.json({
    eventId: BW.EVENT_ID,
    name: BW.name,
    startsAt: BW.startsAt,
    endsAt: BW.endsAt,
    started: w.started,
    ended: w.ended,
    rules: {
      minItems: BW.minItems,
      minSavingsUsd: BW.minSavingsUsd,
      minTrustBlend: BW.minTrustBlend,
      weights: { savings: 0.4, smartBuild: 0.3, trust: 0.2, votes: 0.1 },
    },
    rewards: BW.rankRewards,
    participantPoints: BW.participantPoints,
    luckyDraw: BW.luckyDraw,
  });
});

router.get('/leaderboard', async (req, res, next) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const rows = await BuildWarsEntry.find({ eventId: BW.EVENT_ID })
      .sort({ finalScore: -1, updatedAt: -1 })
      .limit(limit)
      .populate('user', 'username firstName savvyPoints')
      .lean();

    const total = await BuildWarsEntry.countDocuments({ eventId: BW.EVENT_ID });

    const mapped = rows.map((r, idx) => ({
      entryId: r._id,
      rank: idx + 1,
      userId: r.user?._id,
      username: r.user?.username || r.user?.firstName || 'Savvy builder',
      buildType: r.buildType,
      finalScore: r.finalScore,
      savingsUsd: r.savingsUsd,
      savvyPointsEarned: r.savvyPointsAwarded,
      trustLevel: Math.round(r.trustBlend),
      itemCount: r.itemCount,
      linkedAlerts: r.linkedAlerts,
      communityVotes: r.communityVotes,
    }));

    res.json({ total, entries: mapped });
  } catch (e) {
    next(e);
  }
});

router.get('/me', auth, async (req, res, next) => {
  try {
    const entry = await BuildWarsEntry.findOne({ eventId: BW.EVENT_ID, user: req.user.id })
      .populate('projectAlert', 'name category status')
      .lean();
    if (!entry) return res.json({ entry: null });
    res.json({ entry });
  } catch (e) {
    next(e);
  }
});

router.post('/enter', auth, async (req, res, next) => {
  try {
    const w = eventWindow();
    if (!w.started) return res.status(400).json({ message: 'Build Wars has not started yet' });
    if (w.ended) return res.status(400).json({ message: 'Build Wars entry window has closed' });

    const { projectAlertId } = req.body || {};
    if (!projectAlertId) return res.status(400).json({ message: 'projectAlertId required' });

    const existing = await BuildWarsEntry.findOne({ eventId: BW.EVENT_ID, user: req.user.id });
    if (existing) return res.status(400).json({ message: 'You already entered this season' });

    const project = await ProjectAlert.findOne({ _id: projectAlertId, user: req.user.id }).lean();
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const v = validateProjectForEntry(project);
    if (!v.ok) return res.status(400).json({ message: v.message });

    const userAlerts = await Alert.countDocuments({ user: req.user.id });
    const scored = scoreProject(project, { userTotalAlerts: userAlerts, communityVotes: 0 });

    const entry = await BuildWarsEntry.create({
      eventId: BW.EVENT_ID,
      user: req.user.id,
      projectAlert: project._id,
      buildType: buildTypeLabel(project.category),
      savingsUsd: scored.savingsUsd,
      trustBlend: scored.trustBlend,
      linkedAlerts: scored.linkedAlerts,
      itemCount: scored.itemCount,
      savingsScore: scored.savingsScore,
      smartBuildScore: scored.smartBuildScore,
      trustScore: scored.trustScore,
      voteScore: scored.voteScore,
      finalScore: scored.finalScore,
      communityVotes: 0,
    });

    const idem = `build_wars_${BW.EVENT_ID}_participant_${req.user.id}`;
    const grant = await grantSavvyPoints(req.user.id, BW.participantPoints, 'build_wars_participant', idem);
    entry.participantRewardGranted = Boolean(grant.granted);
    entry.savvyPointsAwarded = grant.granted ? BW.participantPoints : 0;
    await entry.save();

    res.status(201).json({
      entry,
      participantReward: grant,
      scoring: scored,
    });
  } catch (e) {
    next(e);
  }
});

router.post('/vote/:entryId', auth, async (req, res, next) => {
  try {
    const w = eventWindow();
    if (!w.started) return res.status(400).json({ message: 'Event not started' });
    if (w.ended) return res.status(400).json({ message: 'Voting closed' });

    const entry = await BuildWarsEntry.findOne({ _id: req.params.entryId, eventId: BW.EVENT_ID });
    if (!entry) return res.status(404).json({ message: 'Entry not found' });
    if (String(entry.user) === String(req.user.id)) {
      return res.status(400).json({ message: 'You cannot vote for your own build' });
    }

    try {
      await BuildWarsVote.create({
        eventId: BW.EVENT_ID,
        entry: entry._id,
        voter: req.user.id,
      });
    } catch (e) {
      if (e?.code === 11000) return res.status(400).json({ message: 'You already voted for this build' });
      throw e;
    }

    entry.communityVotes = (entry.communityVotes || 0) + 1;
    const voteScore = Math.min(100, entry.communityVotes * 4);
    entry.voteScore = voteScore;
    entry.finalScore =
      Math.round(
        computeFinalScore({
          savings: entry.savingsScore,
          smart: entry.smartBuildScore,
          trust: entry.trustScore,
          votes: voteScore,
        }) * 100
      ) / 100;
    await entry.save();
    res.json({ ok: true, communityVotes: entry.communityVotes, finalScore: entry.finalScore });
  } catch (e) {
    next(e);
  }
});

router.post('/claim-rank-reward', auth, async (req, res, next) => {
  try {
    const w = eventWindow();
    if (!w.ended) return res.status(400).json({ message: 'Rank rewards unlock after the event ends' });

    const entry = await BuildWarsEntry.findOne({ eventId: BW.EVENT_ID, user: req.user.id });
    if (!entry) return res.status(404).json({ message: 'No Build Wars entry found' });
    if (entry.rankRewardClaimed) {
      return res.json({ ok: true, already: true, tier: entry.rankRewardTier, awarded: 0 });
    }

    const entries = await BuildWarsEntry.find({ eventId: BW.EVENT_ID }).sort({ finalScore: -1, updatedAt: -1 }).lean();
    const n = entries.length;
    const idx = entries.findIndex((e) => String(e.user) === String(req.user.id));
    const rank = idx >= 0 ? idx + 1 : n + 1;

    const top1cut = Math.max(1, Math.ceil(n * 0.01));
    const top10cut = Math.max(1, Math.ceil(n * 0.1));

    let tier = 'none';
    let points = 0;
    let badge = null;

    if (rank <= top1cut) {
      tier = 'top1';
      points = BW.rankRewards.top1Pct.points;
      badge = BW.rankRewards.top1Pct.badge;
    } else if (rank <= top10cut) {
      tier = 'top10';
      points = BW.rankRewards.top10Pct.points;
      badge = BW.rankRewards.top10Pct.badge;
    } else if (!entry.luckyRewardGranted && luckyRollStable(req.user.id)) {
      tier = 'lucky';
      points = BW.luckyDraw.points;
      badge = BW.luckyDraw.badge;
      entry.luckyRewardGranted = true;
    }

    entry.rankRewardClaimed = true;
    entry.rankRewardTier = tier;

    if (points > 0) {
      const idem = `build_wars_${BW.EVENT_ID}_rank_${tier}_${req.user.id}`;
      const grant = await grantSavvyPoints(req.user.id, points, `build_wars_${tier}`, idem);
      if (grant.granted) {
        entry.savvyPointsAwarded = (entry.savvyPointsAwarded || 0) + points;
      }
      if (badge) {
        await User.updateOne({ _id: req.user.id }, { $addToSet: { badges: badge } });
      }
    }

    await entry.save();
    res.json({ ok: true, rank, total: n, tier, pointsAwarded: points, badge });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
