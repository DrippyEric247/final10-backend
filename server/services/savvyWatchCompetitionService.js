/**
 * Savvy Watch — competitions, entries, voting, host judging.
 */
const crypto = require('crypto');
const SavvyWatchCompetition = require('../models/SavvyWatchCompetition');
const SavvyWatchEntry = require('../models/SavvyWatchEntry');
const SavvyWatchVote = require('../models/SavvyWatchVote');
const SavvyWatchSession = require('../models/SavvyWatchSession');
const { SavvyWatchError, getEventBySlug, logAudit } = require('./savvyWatchService');
const { claimSavvyWatchReward } = require('./savvyWatchRewardService');

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

function validateEntryImage(image) {
  if (!image) return null;
  const mimeType = String(image.mimeType || '').toLowerCase();
  const size = Number(image.size) || 0;
  if (!ALLOWED_IMAGE_TYPES.has(mimeType)) {
    throw new SavvyWatchError(400, 'INVALID_IMAGE', 'Image must be JPEG, PNG, WEBP, or GIF.');
  }
  if (size <= 0 || size > MAX_IMAGE_BYTES) {
    throw new SavvyWatchError(400, 'INVALID_IMAGE', 'Image must be under 2MB.');
  }
  return { mimeType, size, data: image.data };
}

async function requireJoinedSession(eventId, userId) {
  const session = await SavvyWatchSession.findOne({ eventId, userId });
  if (!session) throw new SavvyWatchError(400, 'NOT_JOINED', 'Join the event before participating in competitions.');
  return session;
}

async function listCompetitions(eventId) {
  return SavvyWatchCompetition.find({ eventId }).sort({ createdAt: 1 }).lean();
}

async function submitEntry(user, slug, competitionSlug, payload = {}) {
  const event = await getEventBySlug(slug);
  if (!event) throw new SavvyWatchError(404, 'EVENT_NOT_FOUND', 'Event not found.');
  await requireJoinedSession(event.eventId, user._id);

  const competition = await SavvyWatchCompetition.findOne({
    eventId: event.eventId,
    slug: String(competitionSlug).trim().toLowerCase(),
  });
  if (!competition) throw new SavvyWatchError(404, 'COMPETITION_NOT_FOUND', 'Competition not found.');
  if (competition.status !== 'entries_open') {
    throw new SavvyWatchError(400, 'ENTRIES_CLOSED', 'Entries are not open for this competition.');
  }

  const existingCount = await SavvyWatchEntry.countDocuments({
    competitionId: competition.competitionId,
    userId: user._id,
    status: { $ne: 'disqualified' },
  });
  if (existingCount >= competition.maxEntriesPerUser) {
    throw new SavvyWatchError(409, 'ENTRY_LIMIT', 'Maximum entries reached for this competition.');
  }

  if (competition.eligibleMake) {
    const make = String(payload.vehicleMake || '').trim().toUpperCase();
    if (make !== String(competition.eligibleMake).trim().toUpperCase()) {
      throw new SavvyWatchError(400, 'INELIGIBLE_VEHICLE', `This competition requires ${competition.eligibleMake}.`);
    }
  }

  const entry = await SavvyWatchEntry.create({
    entryId: `swen_${crypto.randomBytes(8).toString('hex')}`,
    eventId: event.eventId,
    competitionId: competition.competitionId,
    userId: user._id,
    displayName: String(payload.displayName || user.username || 'Operator').trim().slice(0, 64),
    vehicleName: payload.vehicleName || null,
    vehicleMake: payload.vehicleMake || null,
    vehicleModel: payload.vehicleModel || null,
    crewName: payload.crewName || null,
    crewMembers: Array.isArray(payload.crewMembers) ? payload.crewMembers.slice(0, 10) : [],
    shortDescription: String(payload.shortDescription || '').slice(0, 500),
    caption: String(payload.caption || '').slice(0, 280),
    entryImage: validateEntryImage(payload.entryImage),
    status: competition.moderationRequired ? 'pending' : 'approved',
  });

  await SavvyWatchSession.updateOne(
    { eventId: event.eventId, userId: user._id },
    { $inc: { competitionsEntered: 1 } }
  );

  return entry;
}

async function listEntries(competitionId, { publicOnly = true } = {}) {
  const query = { competitionId };
  if (publicOnly) query.status = 'approved';
  return SavvyWatchEntry.find(query)
    .select('-entryImage.data')
    .sort({ voteCount: -1, createdAt: 1 })
    .lean();
}

async function castVote(user, slug, competitionSlug, entryId) {
  const event = await getEventBySlug(slug);
  if (!event) throw new SavvyWatchError(404, 'EVENT_NOT_FOUND', 'Event not found.');
  await requireJoinedSession(event.eventId, user._id);

  const competition = await SavvyWatchCompetition.findOne({
    eventId: event.eventId,
    slug: String(competitionSlug).trim().toLowerCase(),
  });
  if (!competition) throw new SavvyWatchError(404, 'COMPETITION_NOT_FOUND', 'Competition not found.');
  if (competition.status !== 'voting_open') {
    throw new SavvyWatchError(400, 'VOTING_CLOSED', 'Voting is not open for this competition.');
  }
  if (competition.votingMode === 'host') {
    throw new SavvyWatchError(400, 'HOST_JUDGED', 'This competition is host-judged only.');
  }

  const entry = await SavvyWatchEntry.findOne({
    entryId,
    competitionId: competition.competitionId,
    status: 'approved',
  });
  if (!entry) throw new SavvyWatchError(404, 'ENTRY_NOT_FOUND', 'Entry not found or not approved.');

  try {
    await SavvyWatchVote.create({
      voteId: `swv_${crypto.randomBytes(8).toString('hex')}`,
      eventId: event.eventId,
      competitionId: competition.competitionId,
      entryId,
      voterUserId: user._id,
    });
  } catch (err) {
    if (err?.code === 11000) {
      throw new SavvyWatchError(409, 'ALREADY_VOTED', 'You already voted in this competition.');
    }
    throw err;
  }

  await SavvyWatchEntry.updateOne({ entryId }, { $inc: { voteCount: 1 } });
  await SavvyWatchSession.updateOne(
    { eventId: event.eventId, userId: user._id },
    { $inc: { competitionVotes: 1 } }
  );

  return { voted: true, entryId };
}

async function moderateEntry(adminUser, entryId, action, note = '') {
  const entry = await SavvyWatchEntry.findOne({ entryId });
  if (!entry) throw new SavvyWatchError(404, 'ENTRY_NOT_FOUND', 'Entry not found.');

  const statusMap = { approve: 'approved', reject: 'rejected', disqualify: 'disqualified' };
  const status = statusMap[action];
  if (!status) throw new SavvyWatchError(400, 'INVALID_ACTION', 'Invalid moderation action.');

  await SavvyWatchEntry.updateOne({ entryId }, { $set: { status, moderationNote: note || null } });
  await logAudit(entry.eventId, adminUser._id, `entry_${action}`, {
    targetType: 'entry',
    targetId: entryId,
    note,
  });

  return SavvyWatchEntry.findOne({ entryId }).select('-entryImage.data').lean();
}

async function setHostScore(adminUser, entryId, score) {
  const entry = await SavvyWatchEntry.findOne({ entryId });
  if (!entry) throw new SavvyWatchError(404, 'ENTRY_NOT_FOUND', 'Entry not found.');
  const hostScore = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
  await SavvyWatchEntry.updateOne({ entryId }, { $set: { hostScore } });
  await logAudit(entry.eventId, adminUser._id, 'host_score_set', { targetId: entryId, hostScore });
  return { entryId, hostScore };
}

async function lockResults(adminUser, competitionId) {
  const competition = await SavvyWatchCompetition.findOne({ competitionId });
  if (!competition) throw new SavvyWatchError(404, 'COMPETITION_NOT_FOUND', 'Competition not found.');

  const entries = await SavvyWatchEntry.find({
    competitionId,
    status: 'approved',
  }).lean();

  let winner = null;
  let runnerUp = null;

  if (competition.votingMode === 'host') {
    const sorted = entries.sort((a, b) => (b.hostScore || 0) - (a.hostScore || 0));
    winner = sorted[0] || null;
    runnerUp = sorted[1] || null;
  } else {
    const sorted = entries.sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0));
    winner = sorted[0] || null;
    runnerUp = sorted[1] || null;
  }

  await SavvyWatchCompetition.updateOne(
    { competitionId },
    {
      $set: {
        status: 'results_locked',
        'results.winnerEntryId': winner?.entryId || null,
        'results.runnerUpEntryId': runnerUp?.entryId || null,
        'results.lockedAt': new Date(),
      },
    }
  );

  await logAudit(competition.eventId, adminUser._id, 'competition_results_locked', {
    competitionId,
    winnerEntryId: winner?.entryId,
  });

  return { winnerEntryId: winner?.entryId, runnerUpEntryId: runnerUp?.entryId };
}

async function awardCompetitionPrizes(adminUser, competitionId) {
  const competition = await SavvyWatchCompetition.findOne({ competitionId });
  if (!competition) throw new SavvyWatchError(404, 'COMPETITION_NOT_FOUND', 'Competition not found.');
  if (competition.results?.awardsGranted) {
    throw new SavvyWatchError(409, 'ALREADY_AWARDED', 'Prizes already awarded for this competition.');
  }
  if (!competition.results?.winnerEntryId) {
    throw new SavvyWatchError(400, 'NO_WINNER', 'Lock results before awarding prizes.');
  }

  const User = require('../models/User');
  const awards = [];

  const winnerEntry = await SavvyWatchEntry.findOne({ entryId: competition.results.winnerEntryId });
  if (winnerEntry && competition.rewardConfig?.winnerSavvy > 0) {
    const winner = await User.findById(winnerEntry.userId);
    if (winner) {
      const grant = await claimSavvyWatchReward(winner, {
        eventId: competition.eventId,
        claimType: 'competition',
        competitionId,
        entryId: winnerEntry.entryId,
        amount: competition.rewardConfig.winnerSavvy,
        rewardType: 'savvy_watch_competition',
        note: `Savvy Watch competition winner — ${competition.title}`,
        meta: { placement: 'winner' },
      });
      awards.push({ entryId: winnerEntry.entryId, placement: 'winner', ...grant });
    }
  }

  if (competition.results.runnerUpEntryId && competition.rewardConfig?.runnerUpSavvy > 0) {
    const runnerUpEntry = await SavvyWatchEntry.findOne({ entryId: competition.results.runnerUpEntryId });
    if (runnerUpEntry) {
      const runner = await User.findById(runnerUpEntry.userId);
      if (runner) {
        const grant = await claimSavvyWatchReward(runner, {
          eventId: competition.eventId,
          claimType: 'competition',
          competitionId,
          entryId: runnerUpEntry.entryId,
          amount: competition.rewardConfig.runnerUpSavvy,
          rewardType: 'savvy_watch_competition',
          note: `Savvy Watch competition runner-up — ${competition.title}`,
          meta: { placement: 'runner_up' },
        });
        awards.push({ entryId: runnerUpEntry.entryId, placement: 'runner_up', ...grant });
      }
    }
  }

  await SavvyWatchCompetition.updateOne(
    { competitionId },
    { $set: { 'results.awardsGranted': true } }
  );

  await logAudit(competition.eventId, adminUser._id, 'competition_prizes_awarded', { competitionId, awards });
  return { awards };
}

async function updateCompetitionStatus(adminUser, competitionId, status) {
  const competition = await SavvyWatchCompetition.findOne({ competitionId });
  if (!competition) throw new SavvyWatchError(404, 'COMPETITION_NOT_FOUND', 'Competition not found.');
  await SavvyWatchCompetition.updateOne({ competitionId }, { $set: { status } });
  await logAudit(competition.eventId, adminUser._id, `competition_${status}`, { competitionId });
  return SavvyWatchCompetition.findOne({ competitionId }).lean();
}

module.exports = {
  listCompetitions,
  submitEntry,
  listEntries,
  castVote,
  moderateEntry,
  setHostScore,
  lockResults,
  awardCompetitionPrizes,
  updateCompetitionStatus,
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
};
