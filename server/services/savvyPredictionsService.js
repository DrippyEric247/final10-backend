/**
 * Savvy Predictions — core orchestration (free-entry, server-authoritative locking).
 */
const SavvyPrediction = require('../models/SavvyPrediction');
const SavvyPredictionEntry = require('../models/SavvyPredictionEntry');
const SavvyWatchEvent = require('../models/SavvyWatchEvent');
const SavvyWatchSession = require('../models/SavvyWatchSession');
const SavvyPredictionStreak = require('../models/SavvyPredictionStreak');
const {
  isSavvyPredictionsEnabled,
  isSavvyPredictionsAdminOnly,
  generatePredictionId,
  generateOptionId,
  generateEntryId,
  PREDICTION_TYPES,
  STREAK_THRESHOLDS,
  DEFAULT_PREDICTION_REWARDS,
} = require('../config/savvyPredictionsConfig');
const { isSavvyWatchEnabled } = require('../config/savvyWatchConfig');
const { getEventBySlug } = require('./savvyWatchService');
const { awardPredictionSavvy, SavvyPredictionsRewardError } = require('./savvyPredictionsRewardService');
const User = require('../models/User');

class SavvyPredictionsError extends Error {
  constructor(status, code, message, details = {}) {
    super(message);
    this.name = 'SavvyPredictionsError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function assertPredictionsAccess(user, { adminOk = false } = {}) {
  if (!isSavvyWatchEnabled()) {
    throw new SavvyPredictionsError(503, 'SAVVY_WATCH_DISABLED', 'Savvy Watch must be enabled for predictions.');
  }
  if (!isSavvyPredictionsEnabled()) {
    throw new SavvyPredictionsError(503, 'SAVVY_PREDICTIONS_DISABLED', 'Savvy Predictions is not enabled.');
  }
  if (isSavvyPredictionsAdminOnly() && !adminOk) {
    const role = String(user?.role || '').toLowerCase();
    const isAdmin = role === 'admin' || role === 'superadmin' || user?.foundingAccess;
    if (!isAdmin) {
      throw new SavvyPredictionsError(403, 'SAVVY_PREDICTIONS_ADMIN_ONLY', 'Savvy Predictions is in admin preview mode.');
    }
  }
}

function normalizeOptions(rawOptions = []) {
  return rawOptions.map((opt, idx) => ({
    optionId: opt.optionId || generateOptionId(),
    label: String(opt.label || '').trim(),
    sortOrder: opt.sortOrder ?? idx,
    min: opt.min != null ? Number(opt.min) : null,
    max: opt.max != null ? Number(opt.max) : null,
    side: opt.side || null,
    participantRef: opt.participantRef || null,
    meta: opt.meta || {},
  }));
}

function isLocked(prediction, now = new Date()) {
  if (['locked', 'resolved', 'cancelled', 'void'].includes(prediction.status)) return true;
  if (prediction.locksAt && now >= new Date(prediction.locksAt)) return true;
  return false;
}

function findBracketOption(options, numericValue) {
  const val = Number(numericValue);
  if (!Number.isFinite(val)) return null;
  for (const opt of options) {
    const minOk = opt.min == null || val >= opt.min;
    const maxOk = opt.max == null || val <= opt.max;
    if (minOk && maxOk) return opt.optionId;
  }
  return null;
}

function serializePredictionPublic(prediction, { userEntry = null, distribution = null, event = null } = {}) {
  const now = new Date();
  const locked = isLocked(prediction, now);
  const hideDist = prediction.displayConfig?.hideDistributionUntilLock !== false
    && event?.predictionRules?.hideDistributionUntilLock !== false;

  return {
    predictionId: prediction.predictionId,
    eventId: prediction.eventId,
    title: prediction.title,
    description: prediction.description,
    type: prediction.type,
    status: locked && prediction.status === 'open' ? 'locked' : prediction.status,
    opensAt: prediction.opensAt,
    locksAt: prediction.locksAt,
    secondsUntilLock: locked ? 0 : Math.max(0, Math.floor((new Date(prediction.locksAt).getTime() - now.getTime()) / 1000)),
    options: (prediction.options || []).map((o) => ({
      optionId: o.optionId,
      label: o.label,
      side: o.side,
    })),
    rewardConfig: {
      correctSavvy: prediction.rewardConfig?.correctSavvy ?? DEFAULT_PREDICTION_REWARDS[prediction.type] ?? 10,
    },
    matchup: prediction.matchup,
    userEntry: userEntry
      ? {
          selectedOptionId: userEntry.selectedOptionId,
          outcome: userEntry.outcome,
          rewardAmount: userEntry.rewardAmount,
        }
      : null,
    distribution: !hideDist || locked ? distribution : null,
    officialResult: ['resolved', 'void'].includes(prediction.status) ? {
      winningOptionId: prediction.officialResult?.winningOptionId,
      label: prediction.officialResult?.label,
      numericValue: prediction.officialResult?.numericValue,
      source: prediction.officialResult?.source || 'host_entered',
      evidence: prediction.officialResult?.evidence,
    } : null,
    resolution: prediction.status === 'resolved' ? {
      correctCount: prediction.resolution?.correctCount ?? 0,
      totalEntries: prediction.resolution?.totalEntries ?? 0,
      correctPercent: prediction.resolution?.totalEntries
        ? Math.round(((prediction.resolution?.correctCount ?? 0) / prediction.resolution.totalEntries) * 100)
        : 0,
    } : null,
    entryCost: 0,
  };
}

async function computeDistribution(predictionId) {
  const entries = await SavvyPredictionEntry.find({ predictionId }).lean();
  const counts = {};
  for (const e of entries) {
    counts[e.selectedOptionId] = (counts[e.selectedOptionId] || 0) + 1;
  }
  const total = entries.length;
  const distribution = Object.entries(counts).map(([optionId, count]) => ({
    optionId,
    count,
    percent: total ? Math.round((count / total) * 100) : 0,
  }));
  return { totalPicks: total, distribution };
}

async function listEventPredictions(eventId, userId = null) {
  const event = await SavvyWatchEvent.findOne({ eventId }).lean();
  const predictions = await SavvyPrediction.find({ eventId, status: { $nin: ['draft', 'cancelled'] } })
    .sort({ locksAt: 1 })
    .lean();

  const userEntries = userId
    ? await SavvyPredictionEntry.find({ eventId, userId }).lean()
    : [];
  const entryMap = Object.fromEntries(userEntries.map((e) => [e.predictionId, e]));

  const result = [];
  for (const p of predictions) {
    const dist = await computeDistribution(p.predictionId);
    result.push(serializePredictionPublic(p, {
      userEntry: entryMap[p.predictionId] || null,
      distribution: dist,
      event,
    }));
  }
  return result;
}

async function createPrediction(adminUser, slug, payload = {}) {
  assertPredictionsAccess(adminUser, { adminOk: true });
  const event = await getEventBySlug(slug);
  if (!event) throw new SavvyPredictionsError(404, 'EVENT_NOT_FOUND', 'Savvy Watch event not found.');

  const type = String(payload.type || '').toUpperCase();
  if (!PREDICTION_TYPES.includes(type)) {
    throw new SavvyPredictionsError(400, 'INVALID_TYPE', 'Invalid prediction type.');
  }

  const options = normalizeOptions(payload.options);
  if (options.length < 2) {
    throw new SavvyPredictionsError(400, 'INVALID_OPTIONS', 'At least two options are required.');
  }

  const prediction = await SavvyPrediction.create({
    predictionId: generatePredictionId(),
    eventId: event.eventId,
    title: payload.title || type,
    description: payload.description || '',
    type,
    status: payload.status === 'open' ? 'open' : 'draft',
    opensAt: payload.opensAt ? new Date(payload.opensAt) : new Date(),
    locksAt: new Date(payload.locksAt || Date.now() + 5 * 60 * 1000),
    createdBy: adminUser._id,
    options,
    rewardConfig: {
      correctSavvy: Math.round(Number(payload.rewardConfig?.correctSavvy ?? DEFAULT_PREDICTION_REWARDS[type] ?? 10)),
      streakBonusSavvy: Math.round(Number(payload.rewardConfig?.streakBonusSavvy) || 0),
      perfectComboSavvy: Math.round(Number(payload.rewardConfig?.perfectComboSavvy) || 0),
    },
    displayConfig: {
      hideDistributionUntilLock: payload.displayConfig?.hideDistributionUntilLock !== false,
      showMatchup: payload.displayConfig?.showMatchup !== false,
    },
    matchup: payload.matchup || {},
  });

  return prediction;
}

async function updatePredictionStatus(adminUser, predictionId, status) {
  assertPredictionsAccess(adminUser, { adminOk: true });
  const prediction = await SavvyPrediction.findOne({ predictionId });
  if (!prediction) throw new SavvyPredictionsError(404, 'PREDICTION_NOT_FOUND', 'Prediction not found.');

  if (status === 'locked') {
    prediction.status = 'locked';
    await prediction.save();
    return prediction;
  }

  if (status === 'open') {
    prediction.status = 'open';
    prediction.opensAt = prediction.opensAt || new Date();
    await prediction.save();
    return prediction;
  }

  if (status === 'cancelled' || status === 'void') {
    prediction.status = status;
    await SavvyPredictionEntry.updateMany(
      { predictionId, outcome: 'pending' },
      { $set: { outcome: 'void' } }
    );
    await prediction.save();
    return prediction;
  }

  throw new SavvyPredictionsError(400, 'INVALID_STATUS', 'Invalid status transition.');
}

async function submitPredictionEntry(user, slug, predictionId, selectedOptionId) {
  assertPredictionsAccess(user);
  const event = await getEventBySlug(slug);
  if (!event) throw new SavvyPredictionsError(404, 'EVENT_NOT_FOUND', 'Event not found.');

  const session = await SavvyWatchSession.findOne({ eventId: event.eventId, userId: user._id });
  if (!session) {
    throw new SavvyPredictionsError(400, 'NOT_JOINED', 'Join the Savvy Watch event before making predictions.');
  }

  const prediction = await SavvyPrediction.findOne({ predictionId, eventId: event.eventId });
  if (!prediction) throw new SavvyPredictionsError(404, 'PREDICTION_NOT_FOUND', 'Prediction not found.');

  if (prediction.status !== 'open') {
    throw new SavvyPredictionsError(400, 'PREDICTION_NOT_OPEN', 'This prediction is not open.');
  }

  const now = new Date();
  if (isLocked(prediction, now)) {
    if (prediction.status === 'open') {
      prediction.status = 'locked';
      await prediction.save();
    }
    throw new SavvyPredictionsError(400, 'PREDICTION_LOCKED', 'Prediction locked before the run started.');
  }

  const validOption = (prediction.options || []).find((o) => o.optionId === selectedOptionId);
  if (!validOption) {
    throw new SavvyPredictionsError(400, 'INVALID_OPTION', 'Selected option is not valid.');
  }

  let entry = await SavvyPredictionEntry.findOne({ predictionId, userId: user._id });
  if (entry) {
    entry.selectedOptionId = selectedOptionId;
    entry.updatedAt = now;
    await entry.save();
  } else {
    try {
      entry = await SavvyPredictionEntry.create({
        entryId: generateEntryId(),
        predictionId,
        eventId: event.eventId,
        userId: user._id,
        selectedOptionId,
        submittedAt: now,
      });
      await SavvyWatchSession.updateOne({ eventId: event.eventId, userId: user._id }, { $inc: { predictionsSubmitted: 1 } });
    } catch (err) {
      if (err?.code === 11000) {
        entry = await SavvyPredictionEntry.findOne({ predictionId, userId: user._id });
        if (entry) {
          entry.selectedOptionId = selectedOptionId;
          await entry.save();
        }
      } else {
        throw err;
      }
    }
  }

  const dist = await computeDistribution(predictionId);
  return {
    entry: { entryId: entry.entryId, selectedOptionId: entry.selectedOptionId },
    distribution: dist,
    entryCost: 0,
  };
}

async function previewResolution(adminUser, predictionId, officialResult = {}) {
  assertPredictionsAccess(adminUser, { adminOk: true });
  const prediction = await SavvyPrediction.findOne({ predictionId });
  if (!prediction) throw new SavvyPredictionsError(404, 'PREDICTION_NOT_FOUND', 'Prediction not found.');

  if (!['locked', 'open', 'resolved'].includes(prediction.status)) {
    throw new SavvyPredictionsError(400, 'NOT_RESOLVABLE', 'Prediction cannot be resolved in current status.');
  }

  const winningOptionId = resolveWinningOptionId(prediction, officialResult);
  const entries = await SavvyPredictionEntry.find({ predictionId }).lean();
  const correctEntries = entries.filter((e) => e.selectedOptionId === winningOptionId);
  const rewardEach = Math.round(Number(prediction.rewardConfig?.correctSavvy) || 10);

  return {
    officialResult: {
      winningOptionId,
      label: officialResult.label || (prediction.options || []).find((o) => o.optionId === winningOptionId)?.label,
      numericValue: officialResult.numericValue ?? null,
      source: officialResult.source || 'host_entered',
    },
    correctCount: correctEntries.length,
    totalEntries: entries.length,
    totalPayoutSavvy: correctEntries.length * rewardEach,
    rewardEach,
  };
}

function resolveWinningOptionId(prediction, officialResult) {
  if (officialResult.winningOptionId) return officialResult.winningOptionId;

  const bracketTypes = ['DRAG_ET_BRACKET', 'DRAG_MARGIN_BRACKET', 'DRIFT_TIME_BRACKET'];
  if (bracketTypes.includes(prediction.type) && officialResult.numericValue != null) {
    const id = findBracketOption(prediction.options, officialResult.numericValue);
    if (!id) throw new SavvyPredictionsError(400, 'NO_MATCHING_BRACKET', 'Official value does not match any bracket.');
    return id;
  }

  throw new SavvyPredictionsError(400, 'RESULT_REQUIRED', 'Official winning option or numeric value is required.');
}

async function resolveAndAward(adminUser, predictionId, officialResult = {}, { confirm = false } = {}) {
  assertPredictionsAccess(adminUser, { adminOk: true });
  const prediction = await SavvyPrediction.findOne({ predictionId });
  if (!prediction) throw new SavvyPredictionsError(404, 'PREDICTION_NOT_FOUND', 'Prediction not found.');

  if (prediction.status === 'resolved' && prediction.resolution?.payoutComplete) {
    return {
      alreadyResolved: true,
      predictionId,
      resolution: prediction.resolution,
    };
  }

  if (prediction.status === 'void' || prediction.status === 'cancelled') {
    throw new SavvyPredictionsError(400, 'PREDICTION_VOID', 'Cannot resolve a void or cancelled prediction.');
  }

  const preview = await previewResolution(adminUser, predictionId, officialResult);
  if (!confirm) {
    return { preview, requiresConfirmation: true };
  }

  const winningOptionId = preview.officialResult.winningOptionId;
  const rewardEach = preview.rewardEach;

  prediction.status = 'locked';
  prediction.officialResult = {
    winningOptionId,
    numericValue: preview.officialResult.numericValue,
    label: preview.officialResult.label,
    source: preview.officialResult.source || 'host_entered',
    evidence: officialResult.evidence || null,
    evidenceUrl: officialResult.evidenceUrl || null,
    submittedAt: new Date(),
    submittedBy: adminUser._id,
  };
  await prediction.save();

  const entries = await SavvyPredictionEntry.find({ predictionId });
  let correctCount = 0;
  let totalPayout = 0;

  for (const entry of entries) {
    if (entry.selectedOptionId === winningOptionId) {
      entry.outcome = 'correct';
      correctCount += 1;

      const streakDoc = await updateStreak(entry.userId, prediction.eventId, 'correct');
      entry.streakAtResolve = streakDoc.currentStreak;

      try {
        const user = await User.findById(entry.userId);
        if (user) {
          const payout = await awardPredictionSavvy(user, {
            eventId: prediction.eventId,
            predictionId,
            entryId: entry.entryId,
            amount: rewardEach,
            payoutType: 'correct',
            rewardType: 'savvy_prediction_correct',
            note: `Savvy Prediction correct — ${prediction.title}`,
            meta: { predictionType: prediction.type },
          });
          if (!payout.duplicate) {
            entry.rewardAmount = payout.savvyAmount;
            entry.rewardedAt = new Date();
            totalPayout += payout.savvyAmount;
          }

          await maybeAwardStreakBonus(user, prediction, streakDoc);
        }
      } catch (err) {
        if (!(err instanceof SavvyPredictionsRewardError && ['PREDICTION_CAP_EXCEEDED', 'PREDICTION_BUDGET_EXCEEDED'].includes(err.code))) {
          throw err;
        }
      }
    } else {
      entry.outcome = 'incorrect';
      await updateStreak(entry.userId, prediction.eventId, 'incorrect');
    }
    entry.lockedAt = entry.lockedAt || prediction.locksAt;
    await entry.save();
  }

  prediction.status = 'resolved';
  prediction.resolvedAt = new Date();
  prediction.resolution = {
    totalEntries: entries.length,
    correctCount,
    totalPayoutSavvy: totalPayout,
    awardedAt: new Date(),
    payoutComplete: true,
  };
  await prediction.save();

  return {
    resolved: true,
    predictionId,
    officialResult: prediction.officialResult,
    resolution: prediction.resolution,
    correctPercent: entries.length ? Math.round((correctCount / entries.length) * 100) : 0,
  };
}

async function updateStreak(userId, eventId, outcome) {
  let doc = await SavvyPredictionStreak.findOne({ userId, eventId });
  if (!doc) {
    doc = await SavvyPredictionStreak.create({ userId, eventId });
  }

  doc.totalPredictions += 1;

  if (outcome === 'void') {
    doc.lastOutcome = 'void';
    doc.lastResolvedAt = new Date();
    await doc.save();
    return doc;
  }

  if (outcome === 'correct') {
    doc.currentStreak += 1;
    doc.correctPredictions += 1;
    doc.bestStreak = Math.max(doc.bestStreak, doc.currentStreak);
    doc.lastOutcome = 'correct';
  } else if (outcome === 'incorrect') {
    doc.currentStreak = 0;
    doc.lastOutcome = 'incorrect';
  }

  doc.lastResolvedAt = new Date();
  await doc.save();
  return doc;
}

async function maybeAwardStreakBonus(user, prediction, streakDoc) {
  const threshold = STREAK_THRESHOLDS.find((t) => t.count === streakDoc.currentStreak);
  if (!threshold) return null;
  if ((streakDoc.streakBonusesAwarded || []).includes(threshold.count)) return null;

  const bonus = Math.round(Number(threshold.bonusSavvy) || 0);
  if (bonus <= 0) return null;

  const result = await awardPredictionSavvy(user, {
    eventId: prediction.eventId,
    predictionId: prediction.predictionId,
    entryId: `streak_${threshold.count}`,
    amount: bonus,
    payoutType: 'streak_bonus',
    rewardType: 'savvy_prediction_streak',
    note: `Savvy Prediction streak — ${threshold.label}`,
    meta: { streakCount: threshold.count, streakLabel: threshold.label },
  });

  if (!result.duplicate) {
    await SavvyPredictionStreak.updateOne(
      { userId: user._id, eventId: prediction.eventId },
      { $addToSet: { streakBonusesAwarded: threshold.count } }
    );
  }

  return result;
}

async function getUserPredictionHistory(userId, limit = 30) {
  const entries = await SavvyPredictionEntry.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  const predictionIds = [...new Set(entries.map((e) => e.predictionId))];
  const predictions = await SavvyPrediction.find({ predictionId: { $in: predictionIds } }).lean();
  const predMap = Object.fromEntries(predictions.map((p) => [p.predictionId, p]));

  const eventIds = [...new Set(entries.map((e) => e.eventId))];
  const events = await SavvyWatchEvent.find({ eventId: { $in: eventIds } }).lean();
  const eventMap = Object.fromEntries(events.map((e) => [e.eventId, e]));

  const streaks = await SavvyPredictionStreak.find({ userId }).lean();
  const streakMap = Object.fromEntries(streaks.map((s) => [s.eventId, s]));

  const history = entries.map((e) => {
    const pred = predMap[e.predictionId];
    const pickLabel = (pred?.options || []).find((o) => o.optionId === e.selectedOptionId)?.label;
    const resultLabel = pred?.officialResult?.label
      || (pred?.options || []).find((o) => o.optionId === pred?.officialResult?.winningOptionId)?.label;

    return {
      eventTitle: eventMap[e.eventId]?.title || e.eventId,
      eventSlug: eventMap[e.eventId]?.slug || null,
      predictionTitle: pred?.title || e.predictionId,
      predictionType: pred?.type,
      pick: pickLabel,
      officialResult: resultLabel,
      outcome: e.outcome,
      savvyEarned: e.rewardAmount || 0,
      timestamp: e.submittedAt,
    };
  });

  const totals = streaks.reduce(
    (acc, s) => ({
      totalPredictions: acc.totalPredictions + (s.totalPredictions || 0),
      correctPredictions: acc.correctPredictions + (s.correctPredictions || 0),
      bestStreak: Math.max(acc.bestStreak, s.bestStreak || 0),
    }),
    { totalPredictions: 0, correctPredictions: 0, bestStreak: 0 }
  );

  const currentStreak = Math.max(0, ...streaks.map((s) => s.currentStreak || 0));

  return {
    history,
    stats: {
      ...totals,
      accuracy: totals.totalPredictions ? Math.round((totals.correctPredictions / totals.totalPredictions) * 100) : 0,
      currentStreak,
      bestStreak: totals.bestStreak,
    },
    streaksByEvent: Object.fromEntries(
      Object.entries(streakMap).map(([eventId, s]) => [eventId, {
        currentStreak: s.currentStreak,
        bestStreak: s.bestStreak,
        correctPredictions: s.correctPredictions,
        totalPredictions: s.totalPredictions,
      }])
    ),
  };
}

async function getOverlayPredictions(slug) {
  const event = await getEventBySlug(slug);
  if (!event) throw new SavvyPredictionsError(404, 'EVENT_NOT_FOUND', 'Event not found.');

  const predictions = await SavvyPrediction.find({
    eventId: event.eventId,
    status: { $in: ['open', 'locked', 'resolved'] },
  })
    .sort({ locksAt: -1 })
    .limit(3)
    .lean();

  const active = predictions.find((p) => p.status === 'open' && !isLocked(p)) || predictions[0];
  if (!active) return { event: { slug: event.slug, title: event.title }, activePrediction: null };

  const dist = await computeDistribution(active.predictionId);
  const locked = isLocked(active);

  return {
    event: { slug: event.slug, title: event.title },
    activePrediction: {
      predictionId: active.predictionId,
      title: active.title,
      type: active.type,
      status: locked && active.status === 'open' ? 'locked' : active.status,
      matchup: active.matchup,
      options: (active.options || []).map((o) => ({ optionId: o.optionId, label: o.label })),
      secondsUntilLock: locked ? 0 : Math.max(0, Math.floor((new Date(active.locksAt).getTime() - Date.now()) / 1000)),
      totalPicks: dist.totalPicks,
      distribution: dist.distribution,
      officialResult: active.status === 'resolved' ? {
        label: active.officialResult?.label,
        numericValue: active.officialResult?.numericValue,
        source: active.officialResult?.source || 'host_entered',
      } : null,
      resolution: active.status === 'resolved' ? {
        correctPercent: active.resolution?.totalEntries
          ? Math.round(((active.resolution?.correctCount ?? 0) / active.resolution.totalEntries) * 100)
          : 0,
        correctCount: active.resolution?.correctCount ?? 0,
      } : null,
    },
  };
}

async function getEventLeaderboard(eventId, limit = 20) {
  const streaks = await SavvyPredictionStreak.find({ eventId })
    .sort({ correctPredictions: -1, bestStreak: -1 })
    .limit(limit)
    .lean();

  return streaks.map((s, idx) => ({
    rank: idx + 1,
    userId: s.userId,
    correctPredictions: s.correctPredictions,
    totalPredictions: s.totalPredictions,
    accuracy: s.totalPredictions ? Math.round((s.correctPredictions / s.totalPredictions) * 100) : 0,
    currentStreak: s.currentStreak,
    bestStreak: s.bestStreak,
  }));
}

module.exports = {
  SavvyPredictionsError,
  assertPredictionsAccess,
  serializePredictionPublic,
  listEventPredictions,
  createPrediction,
  updatePredictionStatus,
  submitPredictionEntry,
  previewResolution,
  resolveAndAward,
  getUserPredictionHistory,
  getOverlayPredictions,
  getEventLeaderboard,
  isLocked,
  computeDistribution,
  findBracketOption,
};
