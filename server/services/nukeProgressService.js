/**
 * Nuke Progress Tracking — server-authoritative, never trusts client values.
 */

const crypto = require('crypto');
const mongoose = require('mongoose');
const NukeProgress = require('../models/NukeProgress');
const NukeEventLog = require('../models/NukeEventLog');
const User = require('../models/User');
const {
  NUKE_NEAR_THRESHOLD,
  NUKE_COLLECTION,
  NUKE_REQUIREMENTS,
  getNukeRequirement,
  deriveNukeProgressStatus,
  nukeEligibilityFromStatus,
  nukeProgressPercent,
} = require('../config/nukeCollection');
const { grantCamoUnlock } = require('./camoLockerService');
const { isNukeCamoItemId } = require('../config/nukeCollection');

function newEventId() {
  return `nuke_evt_${crypto.randomBytes(12).toString('hex')}`;
}

function mapEventType(previousStatus, nextStatus, previousValue, newValue, targetValue) {
  if (previousStatus === 'not_started' && newValue > 0) return 'NUKE_PROGRESS_STARTED';
  if (nextStatus === 'near_completion' && previousStatus !== 'near_completion') {
    return 'NUKE_NEAR_COMPLETION';
  }
  if (nextStatus === 'qualified' && previousStatus !== 'qualified') {
    return 'NUKE_REQUIREMENT_COMPLETED';
  }
  if (nextStatus === 'qualified') return 'NUKE_QUALIFIED';
  return 'NUKE_PROGRESS_UPDATED';
}

async function appendNukeEvent({
  userId,
  requirementId,
  eventType,
  previousValue,
  newValue,
  source,
  verificationMethod,
  adminId,
  testData,
  metadata,
}) {
  await NukeEventLog.create({
    eventId: newEventId(),
    userId,
    requirementId,
    eventType,
    previousValue,
    newValue,
    source: String(source || 'system').slice(0, 64),
    verificationMethod: String(verificationMethod || 'server_event').slice(0, 64),
    adminId: adminId || null,
    testData: Boolean(testData),
    metadata: metadata || null,
  });
}

/**
 * Record authoritative progress delta. Idempotent upsert per user/requirement/testData.
 * @returns {Promise<object>} updated progress row
 */
async function recordNukeProgress({
  userId,
  requirementId,
  increment = 1,
  absoluteValue,
  source = 'server_event',
  verificationMethod = 'server_event',
  adminId = null,
  testData = false,
  nearThreshold = NUKE_NEAR_THRESHOLD,
}) {
  const req = getNukeRequirement(requirementId);
  if (!req) {
    const err = new Error('Unknown Nuke requirement');
    err.status = 400;
    err.code = 'UNKNOWN_NUKE_REQUIREMENT';
    throw err;
  }

  const filter = { userId, requirementId, testData: Boolean(testData) };
  let row = await NukeProgress.findOne(filter);
  const now = new Date();
  const previousValue = row ? row.currentValue : 0;
  const previousStatus = row ? row.status : 'not_started';

  let nextValue;
  if (absoluteValue != null && Number.isFinite(Number(absoluteValue))) {
    nextValue = Math.max(0, Math.round(Number(absoluteValue)));
  } else {
    nextValue = previousValue + Math.max(0, Math.round(Number(increment) || 0));
  }

  const targetValue = req.targetValue;
  const unlocked = row?.status === 'unlocked' || row?.unlockedAt != null;
  const flagged = Boolean(row?.flagged);
  const nextStatus = deriveNukeProgressStatus({
    currentValue: nextValue,
    targetValue,
    unlocked,
    flagged,
    nearThreshold,
  });

  if (!row) {
    row = new NukeProgress({
      ...filter,
      targetValue,
      currentValue: nextValue,
      status: nextStatus,
      firstProgressAt: nextValue > 0 ? now : null,
      lastProgressAt: nextValue > 0 ? now : null,
      qualifiedAt: nextStatus === 'qualified' || nextStatus === 'unlocked' ? now : null,
      lastSource: source,
      lastVerificationMethod: verificationMethod,
    });
  } else {
    row.currentValue = nextValue;
    row.status = nextStatus;
    if (nextValue > 0 && !row.firstProgressAt) row.firstProgressAt = now;
    if (nextValue > 0) row.lastProgressAt = now;
    if ((nextStatus === 'qualified' || nextStatus === 'unlocked') && !row.qualifiedAt) {
      row.qualifiedAt = now;
    }
    row.lastSource = source;
    row.lastVerificationMethod = verificationMethod;
  }

  await row.save();

  if (nextValue !== previousValue || nextStatus !== previousStatus) {
    const eventType = mapEventType(previousStatus, nextStatus, previousValue, nextValue, targetValue);
    await appendNukeEvent({
      userId,
      requirementId,
      eventType,
      previousValue,
      newValue: nextValue,
      source,
      verificationMethod,
      adminId,
      testData,
    });
    if (nextStatus === 'qualified' && previousStatus !== 'qualified') {
      await appendNukeEvent({
        userId,
        requirementId,
        eventType: 'NUKE_QUALIFIED',
        previousValue,
        newValue: nextValue,
        source,
        verificationMethod,
        adminId,
        testData,
      });
    }
  }

  return row.toObject();
}

/**
 * Production Nuke unlock — verifies qualification, atomic, assigns serial via camo locker.
 * @returns {Promise<{granted: boolean, itemId: string}>}
 */
async function grantNukeUnlock(userId, itemId, { adminId, source = 'nuke_qualification' } = {}) {
  if (!isNukeCamoItemId(itemId)) {
    const err = new Error('Not a Nuke camo item');
    err.status = 400;
    err.code = 'INVALID_NUKE_ITEM';
    throw err;
  }

  const row = await NukeProgress.findOne({
    userId,
    requirementId: NUKE_REQUIREMENTS[0]?.id,
    testData: false,
    flagged: { $ne: true },
  });
  if (!row || (row.status !== 'qualified' && row.status !== 'unlocked')) {
    const err = new Error('Nuke requirements not met');
    err.status = 403;
    err.code = 'NUKE_NOT_QUALIFIED';
    throw err;
  }

  const granted = await grantCamoUnlock(userId, itemId, source);
  await NukeProgress.updateOne(
    { _id: row._id },
    {
      $set: {
        status: 'unlocked',
        unlockedAt: row.unlockedAt || new Date(),
      },
    }
  );
  await appendNukeEvent({
      userId,
      requirementId: row.requirementId,
      eventType: 'NUKE_UNLOCK_GRANTED',
      previousValue: row.currentValue,
      newValue: row.currentValue,
      source,
      verificationMethod: 'atomic_unlock',
      adminId,
      testData: false,
      metadata: { itemId },
    });
  return { granted, itemId };
}

async function getMonitorSummary({ includeTestData = false } = {}) {
  const match = includeTestData ? {} : { testData: false };
  const rows = await NukeProgress.find(match).lean();
  const userIds = [...new Set(rows.map((r) => String(r.userId)))];
  const usersWithProgressSet = new Set(
    rows.filter((r) => r.currentValue > 0).map((r) => String(r.userId))
  );
  const summary = {
    totalTrackedUsers: userIds.length,
    usersWithProgress: usersWithProgressSet.size,
    nearNuke: rows.filter((r) => r.status === 'near_completion').length,
    qualified: rows.filter((r) => r.status === 'qualified').length,
    unlocked: rows.filter((r) => r.status === 'unlocked').length,
    flagged: rows.filter((r) => r.status === 'flagged' || r.flagged).length,
    nearThreshold: NUKE_NEAR_THRESHOLD,
  };
  return summary;
}

async function listMonitorRows({
  search = '',
  sort = 'progress_desc',
  includeTestData = false,
  limit = 100,
  skip = 0,
} = {}) {
  const match = includeTestData ? {} : { testData: false };
  let rows = await NukeProgress.find(match).lean();

  if (search.trim()) {
    const key = search.trim();
    const users = await User.find({
      $or: [
        { username: new RegExp(key, 'i') },
        { email: new RegExp(key, 'i') },
        ...(mongoose.Types.ObjectId.isValid(key) ? [{ _id: key }] : []),
      ],
    })
      .select('_id username email')
      .lean();
    const idSet = new Set(users.map((u) => String(u._id)));
    rows = rows.filter((r) => idSet.has(String(r.userId)));
  }

  const userIds = [...new Set(rows.map((r) => r.userId))];
  const users = await User.find({ _id: { $in: userIds } })
    .select('username email')
    .lean();
  const userMap = Object.fromEntries(users.map((u) => [String(u._id), u]));

  const enriched = rows.map((r) => {
    const u = userMap[String(r.userId)] || {};
    const req = getNukeRequirement(r.requirementId);
    return {
      userId: String(r.userId),
      username: u.username || '',
      email: u.email || '',
      requirementId: r.requirementId,
      requirementName: req?.name || r.requirementId,
      currentValue: r.currentValue,
      targetValue: r.targetValue,
      progressPercent: nukeProgressPercent(r.currentValue, r.targetValue),
      status: r.status,
      eligibility: nukeEligibilityFromStatus(r.status),
      firstProgressAt: r.firstProgressAt,
      lastProgressAt: r.lastProgressAt,
      qualifiedAt: r.qualifiedAt,
      unlockedAt: r.unlockedAt,
      verificationStatus: r.verificationStatus,
      testData: Boolean(r.testData),
    };
  });

  const sorters = {
    progress_desc: (a, b) => b.progressPercent - a.progressPercent || b.currentValue - a.currentValue,
    activity_desc: (a, b) =>
      new Date(b.lastProgressAt || 0) - new Date(a.lastProgressAt || 0),
    qualified: (a, b) => (b.status === 'qualified') - (a.status === 'qualified'),
    unlocked: (a, b) => (b.status === 'unlocked') - (a.status === 'unlocked'),
    suspicious: (a, b) =>
      (b.verificationStatus === 'suspicious') - (a.verificationStatus === 'suspicious'),
  };
  enriched.sort(sorters[sort] || sorters.progress_desc);

  return {
    total: enriched.length,
    rows: enriched.slice(skip, skip + limit),
  };
}

async function getPlayerNukeDetail(userId, { includeTestData = false } = {}) {
  const match = { userId, ...(includeTestData ? {} : { testData: false }) };
  const progressRows = await NukeProgress.find(match).sort({ requirementId: 1 }).lean();
  const events = await NukeEventLog.find({ userId, ...(includeTestData ? {} : { testData: false }) })
    .sort({ timestamp: -1 })
    .limit(100)
    .lean();
  const user = await User.findById(userId).select('username email').lean();
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  const requirements = NUKE_REQUIREMENTS.map((req) => {
    const row = progressRows.find((p) => p.requirementId === req.id);
    const status = row?.status || 'not_started';
    return {
      ...req,
      currentValue: row?.currentValue || 0,
      targetValue: req.targetValue,
      progressPercent: nukeProgressPercent(row?.currentValue || 0, req.targetValue),
      status,
      eligibility: nukeEligibilityFromStatus(status),
      qualifiedAt: row?.qualifiedAt || null,
      unlockedAt: row?.unlockedAt || null,
      testData: Boolean(row?.testData),
    };
  });

  const best = progressRows.reduce(
    (acc, r) => (!acc || r.currentValue > acc.currentValue ? r : acc),
    null
  );
  const overallEligibility = best
    ? nukeEligibilityFromStatus(best.status)
    : nukeEligibilityFromStatus('not_started');

  return {
    user: { userId: String(user._id), username: user.username, email: user.email },
    eligibility: overallEligibility,
    requirements,
    events,
    collection: NUKE_COLLECTION,
  };
}

/** Admin simulation — always testData=true, never affects production unlock stats. */
async function simulateNukeProgress(userId, percent, adminId) {
  const req = NUKE_REQUIREMENTS[0];
  const target = req.targetValue;
  const absoluteValue = Math.round(target * (Math.max(0, Math.min(100, percent)) / 100));
  let statusOverride = null;
  if (percent >= 100) statusOverride = 'qualified';
  else if (percent >= NUKE_NEAR_THRESHOLD * 100) statusOverride = 'near_completion';

  const row = await recordNukeProgress({
    userId,
    requirementId: req.id,
    absoluteValue,
    source: 'admin_simulate',
    verificationMethod: 'admin_test',
    adminId,
    testData: true,
  });

  if (statusOverride === 'qualified') {
    await NukeProgress.updateOne(
      { _id: row._id },
      { $set: { status: 'qualified', qualifiedAt: new Date() } }
    );
  }

  await appendNukeEvent({
    userId,
    requirementId: req.id,
    eventType: 'NUKE_ADMIN_OVERRIDE',
    previousValue: null,
    newValue: absoluteValue,
    source: 'admin_simulate',
    verificationMethod: 'admin_test',
    adminId,
    testData: true,
    metadata: { percent, label: 'TEST DATA' },
  });

  return NukeProgress.findById(row._id).lean();
}

module.exports = {
  recordNukeProgress,
  grantNukeUnlock,
  getMonitorSummary,
  listMonitorRows,
  getPlayerNukeDetail,
  simulateNukeProgress,
  appendNukeEvent,
};
