const FoundingBetaSlot = require('../models/FoundingBetaSlot');
const FoundingTesterProgress = require('../models/FoundingTesterProgress');
const User = require('../models/User');
const {
  MAX_FOUNDING_BETA_SLOTS,
  FOUNDING_BETA_COSMETICS,
  FOUNDING_BETA_MESSAGES,
} = require('../config/foundingBeta');
const { grantSystemCosmeticUnlock } = require('./cosmeticInventoryService');
const { MISSION_COUNT } = require('../config/foundingTesterMissions');

let slotsSeeded = false;

async function ensureSlotsSeeded() {
  if (slotsSeeded) return;
  const count = await FoundingBetaSlot.countDocuments();
  if (count >= MAX_FOUNDING_BETA_SLOTS) {
    slotsSeeded = true;
    return;
  }
  const existing = await FoundingBetaSlot.find().select('slot').lean();
  const have = new Set(existing.map((r) => r.slot));
  const toCreate = [];
  for (let slot = 1; slot <= MAX_FOUNDING_BETA_SLOTS; slot += 1) {
    if (!have.has(slot)) toCreate.push({ slot });
  }
  if (toCreate.length) {
    try {
      await FoundingBetaSlot.insertMany(toCreate, { ordered: false });
    } catch (e) {
      if (e?.code !== 11000) throw e;
    }
  }
  slotsSeeded = true;
}

function isBetaAccount(user) {
  if (!user) return false;
  if (typeof user.hasFoundingTesterAccess === 'function' && user.hasFoundingTesterAccess()) return true;
  return Boolean(user.betaTester || user.foundingAccess);
}

async function syncSlotProgress(userId) {
  const progress = await FoundingTesterProgress.findOne({ userId }).lean();
  const completed = (progress?.missionRecords || []).filter((r) => r.completedAt).length;
  const programCompleted = Boolean(progress?.programCompletedAt || progress?.grandRewardGrantedAt);
  await FoundingBetaSlot.updateOne(
    { userId },
    {
      $set: {
        missionsCompleted: completed,
        programCompleted,
        programCompletedAt: progress?.programCompletedAt || progress?.grandRewardGrantedAt || null,
      },
    }
  );
  return { missionsCompleted: completed, programCompleted };
}

/**
 * Assign the next available founder slot (1–100). Idempotent per user.
 */
async function tryAssignFounderSlot(user) {
  await ensureSlotsSeeded();
  if (!user?._id) return { ok: false, code: 'NO_USER' };
  if (!isBetaAccount(user)) return { ok: false, code: 'NOT_BETA' };

  const existing = await FoundingBetaSlot.findOne({ userId: user._id }).lean();
  if (existing) {
    return {
      ok: true,
      assigned: false,
      duplicate: true,
      slot: existing.slot,
      joinedAt: existing.joinedAt,
    };
  }

  const open = await FoundingBetaSlot.findOneAndUpdate(
    { userId: null },
    {
      $set: {
        userId: user._id,
        username: user.username || user.firstName || 'Founder',
        joinedAt: new Date(),
      },
    },
    { sort: { slot: 1 }, new: true }
  );

  if (!open) {
    return { ok: false, code: 'FULL', message: FOUNDING_BETA_MESSAGES.hallComplete };
  }

  if (!user.founderNumber) {
    user.founderNumber = open.slot;
    user.founderJoinedAt = open.joinedAt;
    await user.save();
  }

  await grantSystemCosmeticUnlock(user._id, FOUNDING_BETA_COSMETICS.callingCardId, 'founding_beta_slot');

  const prog = await syncSlotProgress(user._id);

  return {
    ok: true,
    assigned: true,
    slot: open.slot,
    joinedAt: open.joinedAt,
    missionsCompleted: prog.missionsCompleted,
    programCompleted: prog.programCompleted,
  };
}

async function getScarcityStatus() {
  await ensureSlotsSeeded();
  const claimed = await FoundingBetaSlot.countDocuments({ userId: { $ne: null } });
  const remaining = Math.max(0, MAX_FOUNDING_BETA_SLOTS - claimed);
  return {
    max: MAX_FOUNDING_BETA_SLOTS,
    claimed,
    remaining,
    complete: remaining === 0,
    message: remaining === 0 ? FOUNDING_BETA_MESSAGES.hallComplete : null,
  };
}

async function getHallSnapshot() {
  await ensureSlotsSeeded();
  const [slots, scarcity] = await Promise.all([
    FoundingBetaSlot.find().sort({ slot: 1 }).lean(),
    getScarcityStatus(),
  ]);

  const members = slots.map((s) => ({
    slot: s.slot,
    username: s.userId ? s.username || 'Founder' : null,
    joinedAt: s.joinedAt,
    missionsCompleted: s.missionsCompleted || 0,
    missionCount: MISSION_COUNT,
    programCompleted: Boolean(s.programCompleted),
    programCompletedAt: s.programCompletedAt,
    claimed: Boolean(s.userId),
  }));

  return { ...scarcity, members };
}

async function getMemberDetail(slotNumber) {
  await ensureSlotsSeeded();
  const slot = await FoundingBetaSlot.findOne({ slot: Number(slotNumber) }).lean();
  if (!slot || !slot.userId) return null;

  const user = await User.findById(slot.userId)
    .select('username founderNumber founderJoinedAt foundingTesterProgramCompleted badges createdAt')
    .lean();

  return {
    slot: slot.slot,
    username: slot.username || user?.username || 'Founder',
    joinedAt: slot.joinedAt || user?.founderJoinedAt || user?.createdAt,
    missionsCompleted: slot.missionsCompleted || 0,
    missionCount: MISSION_COUNT,
    programCompleted: Boolean(slot.programCompleted || user?.foundingTesterProgramCompleted),
    programCompletedAt: slot.programCompletedAt,
    badges: Array.isArray(user?.badges) ? user.badges : [],
    legacyRewardsGranted: Boolean(slot.legacyRewardsGranted),
  };
}

async function getLegacyForUser(userId) {
  await ensureSlotsSeeded();
  const slot = await FoundingBetaSlot.findOne({ userId }).lean();
  if (!slot) return { hasSlot: false };

  const user = await User.findById(userId)
    .select('username founderNumber founderJoinedAt foundingTesterProgramCompleted badges')
    .lean();
  const progress = await FoundingTesterProgress.findOne({ userId }).lean();
  const missionsCompleted = (progress?.missionRecords || []).filter((r) => r.completedAt).length;

  return {
    hasSlot: true,
    slot: slot.slot,
    founderNumber: slot.slot,
    username: slot.username || user?.username,
    joinedAt: slot.joinedAt || user?.founderJoinedAt,
    missionsCompleted,
    missionCount: MISSION_COUNT,
    programCompleted: Boolean(slot.programCompleted || user?.foundingTesterProgramCompleted),
    programCompletedAt: slot.programCompletedAt || progress?.programCompletedAt,
    legacyRewardsGranted: Boolean(slot.legacyRewardsGranted),
    badges: Array.isArray(user?.badges) ? user.badges : [],
    cosmetics: FOUNDING_BETA_COSMETICS,
  };
}

async function grantFoundingLegacyRewards(user) {
  const slot = await FoundingBetaSlot.findOne({ userId: user._id });
  if (!slot) return { ok: false, code: 'NO_SLOT' };
  if (slot.legacyRewardsGranted) return { ok: true, duplicate: true, slot: slot.slot };

  await grantSystemCosmeticUnlock(user._id, FOUNDING_BETA_COSMETICS.callingCardId, 'founding_legacy');
  await grantSystemCosmeticUnlock(user._id, FOUNDING_BETA_COSMETICS.emblemId, 'founding_legacy');
  await grantSystemCosmeticUnlock(user._id, FOUNDING_BETA_COSMETICS.borderId, 'founding_legacy');

  if (!Array.isArray(user.badges)) user.badges = [];
  if (!user.badges.includes(FOUNDING_BETA_COSMETICS.legacyBadge)) {
    user.badges.push(FOUNDING_BETA_COSMETICS.legacyBadge);
  }

  slot.legacyRewardsGranted = true;
  slot.programCompleted = true;
  slot.programCompletedAt = slot.programCompletedAt || new Date();
  await slot.save();

  return {
    ok: true,
    slot: slot.slot,
    welcome: FOUNDING_BETA_MESSAGES.welcomeFounder,
    scoutLine: FOUNDING_BETA_MESSAGES.scoutComplete,
    cosmetics: FOUNDING_BETA_COSMETICS,
  };
}

async function backfillBetaUsersWithoutSlots() {
  await ensureSlotsSeeded();
  const betaUsers = await User.find({
    $or: [{ betaTester: true }, { foundingAccess: true }],
    founderNumber: { $exists: false },
  })
    .select('_id username betaTester foundingAccess')
    .limit(120);

  let assigned = 0;
  for (const u of betaUsers) {
    const r = await tryAssignFounderSlot(u);
    if (r.assigned) assigned += 1;
    if (r.code === 'FULL') break;
  }
  return { assigned };
}

module.exports = {
  ensureSlotsSeeded,
  tryAssignFounderSlot,
  getScarcityStatus,
  getHallSnapshot,
  getMemberDetail,
  getLegacyForUser,
  grantFoundingLegacyRewards,
  syncSlotProgress,
  backfillBetaUsersWithoutSlots,
  isBetaAccount,
};
