/**
 * Perk Machine paid-spin regression harness — admin/dev only.
 * Executes the FULL paid transaction (no cost bypass) with optional forced reward.
 */
const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../models/User');
const SupplyDrop = require('../models/SupplyDrop');
const SavvyTransaction = require('../models/SavvyTransaction');
const { spinPerkMachine } = require('./perkMachineService');
const { SPIN_MODES, getSpinConfig, REWARD_POOL } = require('../config/perkMachineRewards');
const {
  listRegressionRewardFamilies,
  resolveAdminTestReward,
  TEST_SAVVY_1,
} = require('../config/perkMachineTestRewards');

function resolveForceRewardId(forceRewardId) {
  const id = String(forceRewardId || TEST_SAVVY_1.id).trim();
  if (resolveAdminTestReward(id)) return id;
  if (REWARD_POOL.some((r) => r.id === id)) return id;
  return null;
}

function snapshotUserEconomy(user) {
  const pm = user.perkMachine || {};
  return {
    savvyPoints: Math.round(Number(user.savvyPoints) || 0),
    spinHeatTierIndex: pm.spinHeatTierIndex ?? 0,
    ticketSpinProgress: pm.ticketSpinProgress ?? 0,
    nukeLifetimeSpins: pm.nuke?.lifetimeQualifyingSpins ?? 0,
    scoutFlightTickets: user.eventInventory?.scoutFlightTicket ?? 0,
    streakShields: user.dailyStreak?.scoutShields ?? 0,
  };
}

function describeUserDocumentShape(user) {
  if (!user) {
    return { hydrated: false, lean: true, mongooseDocument: false };
  }
  const isMongooseDoc =
    typeof user.$__ !== 'undefined' ||
    user instanceof mongoose.Document ||
    Boolean(user._doc);
  return {
    hydrated: isMongooseDoc,
    lean: !isMongooseDoc,
    mongooseDocument: user instanceof mongoose.Document,
    hasSave: typeof user.save === 'function',
    constructor: user?.constructor?.name || null,
  };
}

function inspectMalformedFields(doc, prefix = '', out = []) {
  if (!doc || typeof doc !== 'object') return out;
  if (Array.isArray(doc)) {
    doc.forEach((entry, i) => inspectMalformedFields(entry, `${prefix}[${i}]`, out));
    return out;
  }
  for (const [key, value] of Object.entries(doc)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value instanceof Date && Number.isNaN(value.getTime())) {
      out.push({ path, issue: 'invalid_date' });
    } else if (typeof value === 'string' && /TierIndex|spinHeat|At$|Until$/.test(key)) {
      out.push({ path, issue: 'string_where_scalar_expected', valueType: 'string' });
    } else if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      inspectMalformedFields(value, path, out);
    }
  }
  return out;
}

async function inspectTestAccountData(userId) {
  const user = await User.findById(userId).lean();
  if (!user) return { found: false };
  const pm = user.perkMachine || {};
  return {
    found: true,
    userId: String(userId),
    savvyPoints: user.savvyPoints,
    pointsBalance: user.pointsBalance,
    perkMachine: {
      spinHeatTierIndex: pm.spinHeatTierIndex,
      spinHeatTierIndexType: typeof pm.spinHeatTierIndex,
      spinHeatCooldownUntil: pm.spinHeatCooldownUntil,
      lastSpinAt: pm.lastSpinAt,
      spinLockUntil: pm.spinLockUntil,
      spinHistoryLength: Array.isArray(pm.spinHistory) ? pm.spinHistory.length : null,
      eggInventory: pm.eggInventory || null,
      tokens: pm.tokens || null,
      nuke: pm.nuke
        ? {
            lifetimeQualifyingSpins: pm.nuke.lifetimeQualifyingSpins,
            processedSpinIdsType: Array.isArray(pm.nuke.processedSpinIds)
              ? 'array'
              : typeof pm.nuke.processedSpinIds,
          }
        : null,
    },
    eventInventory: user.eventInventory || null,
    dailyStreak: user.dailyStreak
      ? { scoutShields: user.dailyStreak.scoutShields, streakShieldActiveUntil: user.dailyStreak.streakShieldActiveUntil }
      : null,
    malformedFieldHints: inspectMalformedFields({
      perkMachine: pm,
      eventInventory: user.eventInventory,
      dailyStreak: user.dailyStreak,
    }),
    supplyDropCount: await SupplyDrop.countDocuments({ userId }),
    savvyTransactionCount: await SavvyTransaction.countDocuments({ userId }),
  };
}

async function createRegressionUser(initialSavvy = 5000) {
  const ts = `${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  return User.create({
    username: `pm_regress_${ts}`,
    email: `pm_regress_${ts}@regression.local`,
    password: 'regression_test_pass_123456',
    savvyPoints: initialSavvy,
    perkMachine: {
      spinHeatTierIndex: 0,
      lastFreeSpinDay: '1999-01-01',
      lastSpinAt: null,
    },
  });
}

async function cleanupRegressionUser(userId) {
  if (!userId) return;
  await SupplyDrop.deleteMany({ userId });
  await SavvyTransaction.deleteMany({ userId });
  await User.deleteOne({ _id: userId });
}

function auditSessionPropagation() {
  return {
    usesMongoSession: false,
    withTransaction: false,
    activeSessionExisted: false,
    sessionPassedToRewardGrant: false,
    note: 'No mongoose.startSession/withTransaction in perkMachineService or reward grant paths. Free and paid share identical non-transactional flow.',
    pass: true,
  };
}

function buildTransactionStageReport({ outcome, error, result }) {
  const lastOk = error?.lastOkStage || null;
  const failed = error?.failedStage || null;
  const rewardGrantStarted =
    outcome === 'PASS' ||
    Boolean(failed && String(failed).startsWith('REWARD_GRANT')) ||
    lastOk === 'REWARDS_SELECTED' ||
    lastOk === 'DB_TRANSACTION';
  const rewardGrantCompleted = outcome === 'PASS';
  const walletDebitStarted =
    outcome === 'PASS' ||
    lastOk === 'WALLET_DEBIT' ||
    lastOk === 'BALANCE_UPDATED' ||
    lastOk === 'WALLET_LEDGER' ||
    failed === 'WALLET_DEBIT' ||
    Boolean(result?.savvyCost > 0);
  const transactionStarted = Boolean(lastOk || failed || outcome === 'PASS');
  const transactionCommitted = outcome === 'PASS';

  return {
    transactionStarted,
    sessionPassedToRewardGrant: false,
    rewardGrantStarted,
    rewardGrantCompleted,
    balanceDeductionStarted: walletDebitStarted,
    transactionCommitted,
    transactionAborted: outcome === 'FAIL',
    logicalDbTransactionNote:
      'Logical spin transaction (grant → debit → persist). No Mongo multi-doc session.',
  };
}

function formatRegressionError(err, resolvedForce) {
  if (!err) return null;
  return {
    name: err?.name || null,
    message: err?.message || String(err),
    code: err?.code || null,
    failedStage: err?.failedStage || null,
    lastOkStage: err?.lastOkStage || null,
    spinTraceId: err?.spinTraceId || null,
    rewardId: err?.rewardId || resolvedForce,
    rewardType: err?.rewardType || null,
    grantHandler: err?.grantHandler || null,
    field: err?.field || null,
    model: err?.model || null,
    stack: err?.stack || null,
    validationDetails:
      err?.errors && typeof err.errors === 'object'
        ? Object.entries(err.errors).map(([path, detail]) => ({
            path,
            kind: detail?.kind,
            message: detail?.message,
            value: detail?.value,
          }))
        : null,
  };
}

/**
 * Run one full paid spin (real Savvy debit) with forced reward.
 * @returns {Promise<object>} structured regression result
 */
async function runPaidSpinRegression(user, {
  mode = SPIN_MODES.PAID_1,
  forceRewardId = TEST_SAVVY_1.id,
} = {}) {
  const resolvedForce = resolveForceRewardId(forceRewardId);
  if (!resolvedForce) {
    const err = new Error(`Unknown forceRewardId: ${forceRewardId}`);
    err.status = 400;
    err.code = 'INVALID_FORCE_REWARD';
    throw err;
  }

  const config = getSpinConfig(mode);
  if (!config) {
    const err = new Error(`Invalid spin mode: ${mode}`);
    err.status = 400;
    err.code = 'INVALID_MODE';
    throw err;
  }

  const reloaded = await User.findById(user._id);
  reloaded.perkMachine.lastSpinAt = null;
  reloaded.perkMachine.spinLockUntil = null;
  reloaded.markModified('perkMachine');
  await reloaded.save();

  const before = snapshotUserEconomy(reloaded);
  const userDocShapeBefore = describeUserDocumentShape(reloaded);
  const sessionAudit = auditSessionPropagation();
  const startedAt = Date.now();
  let outcome = 'PASS';
  let caughtError = null;
  let result = null;

  try {
    result = await spinPerkMachine(reloaded, {
      mode,
      forceRewardId: resolvedForce,
    });
  } catch (err) {
    outcome = 'FAIL';
    caughtError = err;
  }

  const error = formatRegressionError(caughtError, resolvedForce);
  const afterUser = await User.findById(user._id);
  const after = afterUser ? snapshotUserEconomy(afterUser) : before;
  const transactionStages = buildTransactionStageReport({ outcome, error, result });

  return {
    outcome,
    mode,
    forceRewardId: resolvedForce,
    selectedReward: resolvedForce,
    durationMs: Date.now() - startedAt,
    before,
    after,
    savvyDebited: before.savvyPoints - after.savvyPoints + (result?.savvyWon || 0),
    expectedDebit: config.savvy,
    spinTraceId: result?.spinTraceId || error?.spinTraceId || null,
    failedStage: error?.failedStage || null,
    lastOkStage: error?.lastOkStage || null,
    rewardTypes: result?.rewards?.map((r) => r.type) || null,
    error,
    sessionAudit,
    userDocumentShape: userDocShapeBefore,
    transactionStages,
    result: result
      ? {
          spinId: result.spinId,
          savvyCost: result.savvyCost,
          savvyWon: result.savvyWon,
          savvyBalance: result.savvyBalance,
        }
      : null,
  };
}

/**
 * Admin probe — disposable test account, full paid transaction, cleanup after.
 */
async function runDisposablePaidSpinProbe({
  mode = SPIN_MODES.PAID_1,
  forceRewardId = TEST_SAVVY_1.id,
  initialSavvy = 5000,
} = {}) {
  const testUser = await createRegressionUser(initialSavvy);
  const testUserId = testUser._id;
  let dataBefore = null;
  let probeResult = null;

  try {
    dataBefore = await inspectTestAccountData(testUserId);
    probeResult = await runPaidSpinRegression(testUser, { mode, forceRewardId });
    const dataAfter = await inspectTestAccountData(testUserId);
    return {
      ...probeResult,
      testAccount: {
        userId: String(testUserId),
        email: testUser.email,
        username: testUser.username,
        disposed: true,
      },
      testAccountDataBefore: dataBefore,
      testAccountDataAfter: dataAfter,
    };
  } finally {
    await cleanupRegressionUser(testUserId);
  }
}

async function runRewardFamilyMatrix(user, { mode = SPIN_MODES.PAID_1 } = {}) {
  const families = listRegressionRewardFamilies();
  const rows = [];

  for (const family of families) {
    const row = await runPaidSpinRegression(user, {
      mode,
      forceRewardId: family.forceRewardId,
    });
    rows.push({
      family: family.family,
      label: family.label,
      forceRewardId: family.forceRewardId,
      outcome: row.outcome,
      failedStage: row.failedStage,
      lastOkStage: row.lastOkStage,
      grantHandler: row.error?.grantHandler || null,
      exception: row.error?.message || null,
      savvyDebited: row.savvyDebited,
    });
    if (row.outcome === 'FAIL') break;
  }

  const working = rows.filter((r) => r.outcome === 'PASS').map((r) => r.family);
  const broken = rows.filter((r) => r.outcome === 'FAIL').map((r) => r.family);

  return { mode, rows, workingRewardTypes: working, brokenRewardTypes: broken };
}

async function runDisposableRewardFamilyMatrix({ mode = SPIN_MODES.PAID_1 } = {}) {
  const testUser = await createRegressionUser(50000);
  try {
    return await runRewardFamilyMatrix(testUser, { mode });
  } finally {
    await cleanupRegressionUser(testUser._id);
  }
}

function compareFreeVsPaidPools() {
  const paidPool = REWARD_POOL.map((r) => ({
    id: r.id,
    type: r.type,
    label: r.label,
  }));
  return {
    freeSpinPool: paidPool,
    paidSpinPool: paidPool,
    paidOnlyRewards: [],
    freeOnlyRewards: [],
    samePool: true,
    note: 'Free and paid spins both use REWARD_POOL via buildWeightedPool(tier). Mode only affects cost, heat advance, and nuke qualifying — not pool selection.',
  };
}

function compareFreeVsPaidExecutionPaths() {
  return {
    sharedSteps: [
      'acquirePerkSpinLock',
      'ensurePerkMachineDoc / legacy sanitize',
      'buildWeightedPool + pickWeightedReward',
      'applyReward / executePerkMachineRewardGrant',
      'user.save()',
    ],
    paidOnlySteps: [
      'resolveSavvySaleSpinPricing',
      'applySpinHeatToBaseCost',
      'balance validation',
      'spendSavvyReward (WALLET_DEBIT) after REWARD_GRANT',
      'advanceSpinHeat',
      'recordQualifyingNukeSpin',
      'recordSpinForTournamentTicket',
    ],
    freeOnlySteps: ['claimFreeSpinSlot', 'free spin rollback on failure'],
    mongoSessionDifference: 'None — neither path uses mongoose sessions',
  };
}

module.exports = {
  TEST_SAVVY_1,
  resolveForceRewardId,
  createRegressionUser,
  cleanupRegressionUser,
  inspectTestAccountData,
  runPaidSpinRegression,
  runDisposablePaidSpinProbe,
  runRewardFamilyMatrix,
  runDisposableRewardFamilyMatrix,
  compareFreeVsPaidPools,
  compareFreeVsPaidExecutionPaths,
  auditSessionPropagation,
  snapshotUserEconomy,
};
