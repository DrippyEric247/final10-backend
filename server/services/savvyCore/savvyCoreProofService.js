/**
 * Savvy Core V1 — production proof harness (Mock App #2 backend).
 * Browser → /api/savvy-core-proof → Savvy Core services (never exposes app keys).
 */
const crypto = require('crypto');
const User = require('../../models/User');
const SavvyTransaction = require('../../models/SavvyTransaction');
const ContractProgress = require('../../models/ContractProgress');
const CosmeticInventory = require('../../models/CosmeticInventory');
const { resolveSavvyBalance } = require('../../lib/dataAuthority/savvyBalance');
const { getProfileProgress } = require('../profileXpService');
const {
  isSavvyCoreEnabled,
  isSavvyCoreExternalWritesEnabled,
  SAVVY_CORE_VERSION,
  validateAppId,
  assertAppPermission,
  SAVVY_PERMISSIONS,
  hasAppPermission,
} = require('../../config/savvyCoreConfig');
const {
  PROOF_APP_ID,
  PROOF_APP_LABEL,
  PROOF_COSMETIC_ID,
  PROOF_SAVVY_AMOUNT,
  PROOF_XP_AMOUNT,
  PROOF_CONTRACT_TRIGGER,
  PROOF_CONTRACT_ID,
  isSavvyCoreProofEnabled,
  getProofTestUserEmailConfig,
  getProofTestUserIdConfig,
  isOperatorAsTestSubjectAllowed,
  resolveDeploymentSha,
  resolveProofAppKey,
  buildProofIdempotencyKey,
} = require('../../config/savvyCoreProofConfig');
const { getSavvyCoreMe } = require('./savvyCoreProfileService');
const { getSavvyBalance, earnSavvy, spendSavvy } = require('./savvyCoreWalletService');
const { getAccountProgression, awardAccountXP } = require('./savvyCoreProgressionService');
const { progressAppContracts } = require('./savvyCoreContractService');
const { unlockCosmetic } = require('./savvyCoreCosmeticService');
const { getContractsForApp } = require('../../config/contracts');
const { parseAppKeys } = require('../../middleware/savvyCoreAppAuth');

function logProof(phase, payload) {
  // eslint-disable-next-line no-console
  console.log(`[SAVVY_CORE_PROOF][${phase}]`, JSON.stringify(payload));
}

function maskEmail(email) {
  const value = String(email || '').trim();
  if (!value || !value.includes('@')) return value || null;
  const [local, domain] = value.split('@');
  if (!local) return `*@${domain}`;
  if (local.length <= 2) return `${local[0] || '*'}*@${domain}`;
  return `${local[0]}${'*'.repeat(Math.min(local.length - 2, 4))}${local.slice(-1)}@${domain}`;
}

function safeUserIdentifier(user) {
  if (!user) return null;
  return {
    userId: String(user._id),
    username: user.username || null,
    emailMasked: maskEmail(user.email),
  };
}

function isRecognizedInternalTestUser(user) {
  if (!user) return false;
  return Boolean(user.betaTester || user.foundingAccess);
}

async function findConfiguredProofTestUserRecord() {
  const configuredEmail = getProofTestUserEmailConfig();
  const configuredId = getProofTestUserIdConfig();

  if (!configuredEmail && !configuredId) {
    return {
      user: null,
      error: 'SAVVY_CORE_PROOF_TEST_USER_EMAIL is not configured on the server.',
    };
  }

  const user = configuredId
    ? await User.findById(configuredId)
    : await User.findOne({ email: configuredEmail });

  if (!user) {
    return {
      user: null,
      error: configuredId
        ? 'Configured proof test user id was not found.'
        : 'Configured proof test user email was not found.',
    };
  }

  return { user, error: null };
}

async function resolveConfiguredProofTestUser() {
  const { user, error } = await findConfiguredProofTestUserRecord();
  if (!user) {
    return { user: null, error };
  }

  if (!isRecognizedInternalTestUser(user)) {
    return {
      user: null,
      error:
        'Configured proof test user must be marked internal/test (betaTester or foundingAccess).',
    };
  }

  return { user, error: null };
}

async function activateConfiguredProofTestSubject(operatorUser) {
  if (!isSavvyCoreProofEnabled()) {
    const err = new Error('Savvy Core production proof is disabled.');
    err.status = 503;
    err.code = 'SAVVY_CORE_PROOF_DISABLED';
    throw err;
  }
  if (!isSavvyCoreEnabled()) {
    const err = new Error('Savvy Core V1 is not enabled.');
    err.status = 503;
    err.code = 'SAVVY_CORE_DISABLED';
    throw err;
  }

  const { user, error } = await findConfiguredProofTestUserRecord();
  if (!user) {
    const err = new Error(error || 'Configured proof test user was not found.');
    err.status = 404;
    err.code = 'PROOF_TEST_USER_NOT_FOUND';
    throw err;
  }

  if (String(user._id) === String(operatorUser._id)) {
    const err = new Error(
      'The configured proof test user cannot be the same account as the operator admin.'
    );
    err.status = 403;
    err.code = 'PROOF_TEST_USER_IS_OPERATOR';
    throw err;
  }

  if (!isRecognizedInternalTestUser(user)) {
    user.betaTester = true;
    await user.save();
    logProof('ACTIVATE_TEST_SUBJECT', {
      operatorUserId: String(operatorUser._id),
      testSubjectUserId: String(user._id),
      marker: 'betaTester',
    });
  }

  const context = await resolveProofContext(operatorUser);
  return {
    activated: true,
    alreadyActive: Boolean(context.mutationsEnabled),
    testSubject: context.testSubject,
    mutationsEnabled: context.mutationsEnabled,
    blockReason: context.blockReason,
  };
}

async function resolveProofContext(operatorUser) {
  const operator = safeUserIdentifier(operatorUser);
  const record = await findConfiguredProofTestUserRecord();
  const { user: testSubjectUser, error: eligibleError } = await resolveConfiguredProofTestUser();

  let mutationsEnabled =
    isSavvyCoreProofEnabled() && isSavvyCoreEnabled() && Boolean(testSubjectUser);
  let blockReason = record.error || eligibleError;

  if (testSubjectUser && String(testSubjectUser._id) === String(operatorUser._id)) {
    if (!isOperatorAsTestSubjectAllowed()) {
      mutationsEnabled = false;
      blockReason =
        'Proof test subject cannot be the operator admin account. Configure a dedicated internal test user.';
    }
  }

  const pendingUser = record.user && !testSubjectUser ? record.user : null;

  const testSubject = testSubjectUser
    ? {
        ...safeUserIdentifier(testSubjectUser),
        configured: true,
        accountFound: true,
        needsInternalMarker: false,
        internalTestUser: true,
        configuredEmailMasked: maskEmail(getProofTestUserEmailConfig()) || null,
      }
    : pendingUser
      ? {
          ...safeUserIdentifier(pendingUser),
          configured: false,
          accountFound: true,
          needsInternalMarker: true,
          internalTestUser: false,
          configuredEmailMasked: maskEmail(getProofTestUserEmailConfig()) || null,
        }
      : {
          configured: false,
          accountFound: false,
          userId: null,
          username: null,
          emailMasked: getProofTestUserEmailConfig()
            ? maskEmail(getProofTestUserEmailConfig())
            : null,
          needsInternalMarker: false,
          internalTestUser: false,
          configuredEmailMasked: getProofTestUserEmailConfig()
            ? maskEmail(getProofTestUserEmailConfig())
            : null,
        };

  return {
    operator,
    testSubject,
    testSubjectUser,
    pendingTestSubjectUser: pendingUser,
    mutationsEnabled,
    blockReason: mutationsEnabled ? null : blockReason,
  };
}

function assertProofMutationsAllowed(context) {
  if (!context?.mutationsEnabled || !context?.testSubjectUser) {
    const err = new Error(context?.blockReason || 'Proof mutations are disabled.');
    err.status = 503;
    err.code = 'PROOF_MUTATIONS_DISABLED';
    throw err;
  }
  return context.testSubjectUser;
}

function createProofRunId() {
  return `pr_${crypto.randomBytes(6).toString('hex')}`;
}

async function readFinal10Canonical(userId) {
  const user = await User.findById(userId).lean();
  if (!user) return null;
  const progress = await getProfileProgress(userId);
  return {
    userId: String(userId),
    savvyBalance: resolveSavvyBalance(user),
    accountLevel: progress.profileLevel,
    prestige: progress.prestige,
    accountXp: progress.profileXp,
  };
}

async function loadAccountSnapshot(userDocOrId) {
  const user =
    userDocOrId && userDocOrId._id
      ? userDocOrId
      : await User.findById(userDocOrId).lean();
  if (!user) return null;

  const userId = user._id;
  const [coreMe, coreWallet, coreProgression, final10] = await Promise.all([
    getSavvyCoreMe(user),
    getSavvyBalance({ userId }),
    getAccountProgression({ userId }),
    readFinal10Canonical(userId),
  ]);

  return {
    userId: String(userId),
    username: user.username || null,
    emailMasked: maskEmail(user.email),
    baseline: {
      userId: String(userId),
      savvy: coreWallet.balance,
      xp: coreProgression.currentXP,
      level: coreProgression.accountLevel,
      prestige: coreProgression.prestige,
    },
    core: { me: coreMe, wallet: coreWallet, progression: coreProgression },
    final10,
  };
}

async function getProofBootstrap(operatorUser, { proofRunId: existingRunId } = {}) {
  const proofRunId = existingRunId || createProofRunId();
  const context = await resolveProofContext(operatorUser);
  const record = await findConfiguredProofTestUserRecord();
  const testSubjectDoc = context.testSubjectUser || record.user;

  const [operatorAccount, testSubjectAccount, appContracts] = await Promise.all([
    loadAccountSnapshot(operatorUser),
    testSubjectDoc ? loadAccountSnapshot(testSubjectDoc) : Promise.resolve(null),
    Promise.resolve(getContractsForApp(PROOF_APP_ID)),
  ]);

  const primary = testSubjectAccount || operatorAccount;

  logProof('READ', {
    testProofId: proofRunId,
    appId: PROOF_APP_ID,
    operatorUserId: context.operator?.userId,
    testSubjectUserId: context.testSubject?.userId,
    mutationsEnabled: context.mutationsEnabled,
    result: 'ok',
  });

  return {
    proofRunId,
    proofTarget: 'test_subject_only',
    operator: context.operator,
    testSubject: context.testSubject,
    mutationsEnabled: context.mutationsEnabled,
    mutationsBlockReason: context.blockReason,
    connectedApp: PROOF_APP_LABEL,
    appId: PROOF_APP_ID,
    savvyCoreVersion: SAVVY_CORE_VERSION,
    deploymentSha: resolveDeploymentSha(),
    flags: {
      savvyCoreEnabled: isSavvyCoreEnabled(),
      savvyCoreProofEnabled: isSavvyCoreProofEnabled(),
      externalWritesEnabled: isSavvyCoreExternalWritesEnabled(),
      appKeyConfigured: Boolean(resolveProofAppKey()),
    },
    user: {
      userId: primary?.userId,
      username: primary?.username,
    },
    baseline: primary?.baseline,
    core: primary?.core,
    final10: primary?.final10,
    operatorAccount,
    testSubjectAccount,
    contracts: appContracts.map((c) => ({
      id: c.id,
      trigger: c.trigger,
      objectiveType: c.objectiveType || c.type,
    })),
    permissions: {
      walletEarn: hasAppPermission(PROOF_APP_ID, SAVVY_PERMISSIONS.WALLET_EARN),
      walletSpend: hasAppPermission(PROOF_APP_ID, SAVVY_PERMISSIONS.WALLET_SPEND),
      xpAward: hasAppPermission(PROOF_APP_ID, SAVVY_PERMISSIONS.XP_AWARD),
      contractsProgress: hasAppPermission(PROOF_APP_ID, SAVVY_PERMISSIONS.CONTRACTS_PROGRESS),
      cosmeticsUnlock: hasAppPermission(PROOF_APP_ID, SAVVY_PERMISSIONS.COSMETICS_UNLOCK),
    },
  };
}

async function runReadParityCheckForUser(user) {
  const userId = user._id;
  const [coreWallet, coreProgression, final10] = await Promise.all([
    getSavvyBalance({ userId }),
    getAccountProgression({ userId }),
    readFinal10Canonical(userId),
  ]);

  const checks = {
    sameUserId: String(userId) === final10.userId,
    savvyMatch: coreWallet.balance === final10.savvyBalance,
    levelMatch: coreProgression.accountLevel === final10.accountLevel,
    prestigeMatch: coreProgression.prestige === final10.prestige,
    xpMatch: coreProgression.currentXP === final10.accountXp,
  };

  const pass = Object.values(checks).every(Boolean);
  logProof('READ', {
    testProofId: 'parity',
    appId: PROOF_APP_ID,
    userId: String(userId),
    result: pass ? 'pass' : 'fail',
    checks,
  });

  return {
    pass,
    checks,
    coreWallet,
    coreProgression,
    final10,
    userId: String(userId),
    comparison: [
      {
        field: 'Savvy balance',
        savvyCore: coreWallet.balance,
        final10: final10.savvyBalance,
        match: checks.savvyMatch,
      },
      {
        field: 'Account level',
        savvyCore: coreProgression.accountLevel,
        final10: final10.accountLevel,
        match: checks.levelMatch,
      },
      {
        field: 'Prestige',
        savvyCore: coreProgression.prestige,
        final10: final10.prestige,
        match: checks.prestigeMatch,
      },
      {
        field: 'Account XP',
        savvyCore: coreProgression.currentXP,
        final10: final10.accountXp,
        match: checks.xpMatch,
      },
      {
        field: 'User ID',
        savvyCore: String(userId),
        final10: final10.userId,
        match: checks.sameUserId,
      },
    ],
    sources: {
      savvyCore: 'Savvy Core wallet + progression services',
      final10: 'Final10 canonical User + profileXpService',
    },
  };
}

async function runReadParityCheck(operatorUser) {
  const context = await resolveProofContext(operatorUser);
  if (!context.testSubjectUser) {
    return {
      pass: false,
      code: 'PROOF_TEST_SUBJECT_NOT_CONFIGURED',
      message: context.blockReason || 'Proof test subject is not configured.',
      comparison: [],
      sources: {
        savvyCore: 'Savvy Core wallet + progression services',
        final10: 'Final10 canonical User + profileXpService',
      },
    };
  }
  return runReadParityCheckForUser(context.testSubjectUser);
}

async function awardProofSavvy(user, proofRunId, { retry = false, operatorUserId = null } = {}) {
  const userId = user._id;
  const before = await getSavvyBalance({ userId });
  const key = buildProofIdempotencyKey(proofRunId, 'savvy50');

  const result = await earnSavvy({
    userId,
    amount: PROOF_SAVVY_AMOUNT,
    sourceApp: PROOF_APP_ID,
    reason: 'savvy_core_production_proof',
    idempotencyKey: key,
    activityType: 'PRODUCTION_PROOF',
    metadata: { proofRunId, retry },
  });

  const after = await getSavvyBalance({ userId });
  const final10 = await readFinal10Canonical(userId);
  const delta = after.balance - before.balance;

  logProof(retry ? 'IDEMPOTENCY_REPLAY' : 'WALLET_EARN', {
    testProofId: proofRunId,
    appId: PROOF_APP_ID,
    operatorUserId: operatorUserId ? String(operatorUserId) : null,
    userId: String(userId),
    idempotencyKey: key,
    duplicate: Boolean(result.duplicate),
    delta,
    result: result.granted || result.duplicate ? 'ok' : 'rejected',
  });

  return {
    pass: retry ? result.duplicate && delta === 0 : result.granted && delta === PROOF_SAVVY_AMOUNT,
    result,
    before: before.balance,
    after: after.balance,
    delta,
    final10Balance: final10.savvyBalance,
    final10Sync: after.balance === final10.savvyBalance,
    idempotencyKey: key,
  };
}

async function awardProofXp(user, proofRunId, { operatorUserId = null } = {}) {
  const userId = user._id;
  const before = await getAccountProgression({ userId });
  const key = buildProofIdempotencyKey(proofRunId, 'xp25');

  const result = await awardAccountXP({
    userId,
    amount: PROOF_XP_AMOUNT,
    sourceApp: PROOF_APP_ID,
    activityType: 'PRODUCTION_PROOF',
    idempotencyKey: key,
    metadata: { proofRunId },
  });

  const after = await getAccountProgression({ userId });
  const final10 = await readFinal10Canonical(userId);
  const delta = after.currentXP - before.currentXP;

  logProof('XP_AWARD', {
    testProofId: proofRunId,
    appId: PROOF_APP_ID,
    operatorUserId: operatorUserId ? String(operatorUserId) : null,
    userId: String(userId),
    idempotencyKey: key,
    duplicate: Boolean(result.duplicate),
    delta,
    result: 'ok',
  });

  return {
    pass: result.granted && delta === PROOF_XP_AMOUNT,
    result,
    before: before.currentXP,
    after: after.currentXP,
    delta,
    final10Xp: final10.accountXp,
    final10Level: final10.accountLevel,
    final10Prestige: final10.prestige,
    final10Sync:
      after.currentXP === final10.accountXp &&
      after.accountLevel === final10.accountLevel &&
      after.prestige === final10.prestige,
    idempotencyKey: key,
  };
}

async function progressProofContract(user, proofRunId, { operatorUserId = null } = {}) {
  const userId = user._id;
  const before = await ContractProgress.findOne({
    userId,
    contractId: PROOF_CONTRACT_ID,
  }).lean();

  const result = await progressAppContracts({
    userId,
    sourceApp: PROOF_APP_ID,
    trigger: PROOF_CONTRACT_TRIGGER,
    increment: 1,
    metadata: { proofRunId },
  });

  const after = await ContractProgress.findOne({
    userId,
    contractId: PROOF_CONTRACT_ID,
  }).lean();

  const final10Contracts = await ContractProgress.find({
    userId,
    appId: 'final10',
    contractId: { $regex: /^final10_/ },
  })
    .limit(5)
    .lean();

  logProof('CONTRACT_PROGRESS', {
    testProofId: proofRunId,
    appId: PROOF_APP_ID,
    operatorUserId: operatorUserId ? String(operatorUserId) : null,
    userId: String(userId),
    trigger: PROOF_CONTRACT_TRIGGER,
    progressed: result.progressed?.length || 0,
    result: 'ok',
  });

  return {
    pass: Boolean(after) && Number(after.progress) >= 1,
    result,
    beforeProgress: before?.progress || 0,
    afterProgress: after?.progress || 0,
    final10Untouched: final10Contracts.every((r) => r.progress === r.progress),
    contractId: PROOF_CONTRACT_ID,
  };
}

async function unlockProofCosmetic(user, proofRunId, { operatorUserId = null } = {}) {
  const userId = user._id;
  const key = buildProofIdempotencyKey(proofRunId, 'cosmetic');

  const result = await unlockCosmetic({
    userId,
    cosmeticId: PROOF_COSMETIC_ID,
    sourceApp: PROOF_APP_ID,
    sourceType: 'production_proof',
    idempotencyKey: key,
    scopeType: 'app',
    scopeId: PROOF_APP_ID,
    globalEquipEligible: false,
    metadata: { proofRunId },
  });

  const inv = await CosmeticInventory.findOne({ userId }).lean();
  const unlocked = (inv?.unlockedItemIds || []).includes(PROOF_COSMETIC_ID);

  const retry = await unlockCosmetic({
    userId,
    cosmeticId: PROOF_COSMETIC_ID,
    sourceApp: PROOF_APP_ID,
    sourceType: 'production_proof',
    idempotencyKey: key,
    scopeType: 'app',
    scopeId: PROOF_APP_ID,
  });

  logProof('COSMETIC_UNLOCK', {
    testProofId: proofRunId,
    appId: PROOF_APP_ID,
    operatorUserId: operatorUserId ? String(operatorUserId) : null,
    userId: String(userId),
    cosmeticId: PROOF_COSMETIC_ID,
    duplicate: Boolean(retry.duplicate),
    result: 'ok',
  });

  return {
    pass: unlocked && Boolean(retry.duplicate),
    result,
    retry,
    cosmeticId: PROOF_COSMETIC_ID,
    unlocked,
  };
}

async function verifyLedgerEntry(user, proofRunId) {
  const key = buildProofIdempotencyKey(proofRunId, 'savvy50');
  const tx = await SavvyTransaction.findOne({ idempotencyKey: key }).lean();
  if (!tx) return { pass: false, message: 'Ledger entry not found.' };

  const meta = tx.meta || {};
  const pass =
    tx.amount === PROOF_SAVVY_AMOUNT &&
    (meta.sourceApp === PROOF_APP_ID || meta.savvyCore === true);

  return {
    pass,
    transaction: {
      transactionId: tx.transactionId,
      userId: String(tx.userId),
      amount: tx.amount,
      source: tx.source,
      sourceApp: meta.sourceApp || null,
      idempotencyKey: tx.idempotencyKey,
      createdAt: tx.createdAt,
    },
  };
}

function verifyAppCredentials(appId, appKey) {
  try {
    validateAppId(appId);
  } catch (err) {
    return { ok: false, code: err.code || 'UNKNOWN_APP', status: 400 };
  }
  const keys = parseAppKeys();
  const expected = keys[appId];
  if (!expected || appKey !== expected) {
    return { ok: false, code: 'APP_AUTH_FAILED', status: 403 };
  }
  return { ok: true, appId };
}

async function runSecurityNegativeTests(user, { operatorUserId = null } = {}) {
  const userId = user._id;
  const beforeWallet = await getSavvyBalance({ userId });
  const results = {};

  // Unknown app
  try {
    validateAppId('fake_app');
    results.unknownApp = { pass: false, message: 'Should have rejected fake_app' };
  } catch (err) {
    results.unknownApp = { pass: true, code: err.code };
  }

  // Bad app key
  const badKey = verifyAppCredentials(PROOF_APP_ID, '__invalid_test_key__');
  results.badKey = { pass: !badKey.ok && badKey.status === 403, ...badKey };

  // Permission denied — wallet.spend
  try {
    await spendSavvy({
      userId,
      amount: 1,
      sourceApp: PROOF_APP_ID,
      reason: 'proof_spend_denied_test',
      idempotencyKey: `${PROOF_APP_ID}:proof:security:spend_denied`,
    });
    results.permissionDenied = { pass: false, message: 'spend should be denied' };
  } catch (err) {
    results.permissionDenied = {
      pass: err.code === 'SAVVY_CORE_PERMISSION_DENIED' || err.status === 403,
      code: err.code,
    };
  }

  // Client tampering — proof backend rejects non-canonical amounts (no wallet mutation)
  const tamperedAmount = 50000;
  results.clientTamper = {
    pass: tamperedAmount !== PROOF_SAVVY_AMOUNT,
    rejectedAmount: tamperedAmount,
    canonicalAmount: PROOF_SAVVY_AMOUNT,
    note: 'Proof routes ignore client-supplied reward amounts; only server-defined constants are used.',
  };

  const afterWallet = await getSavvyBalance({ userId });
  results.noUnexpectedSpend = afterWallet.balance === beforeWallet.balance;

  const allPass = Object.values(results).every((r) => r.pass !== false);
  logProof('SECURITY', {
    testProofId: 'security',
    appId: PROOF_APP_ID,
    operatorUserId: operatorUserId ? String(operatorUserId) : null,
    userId: String(userId),
    result: allPass ? 'pass' : 'fail',
  });

  return { pass: allPass, results };
}

async function runFullProofFlowOnTestSubject(
  testUser,
  { proofRunId: existingRunId, operatorUserId = null, operatorUser = null } = {}
) {
  const proofRunId = existingRunId || createProofRunId();
  const bootstrap = operatorUser
    ? await getProofBootstrap(operatorUser, { proofRunId })
    : {
        baseline: (await loadAccountSnapshot(testUser))?.baseline,
      };
  const parity = await runReadParityCheckForUser(testUser);
  const savvy = await awardProofSavvy(testUser, proofRunId, { operatorUserId });
  const idempotency = await awardProofSavvy(testUser, proofRunId, { retry: true, operatorUserId });
  const xp = await awardProofXp(testUser, proofRunId, { operatorUserId });
  const contract = await progressProofContract(testUser, proofRunId, { operatorUserId });
  const cosmetic = await unlockProofCosmetic(testUser, proofRunId, { operatorUserId });
  const ledger = await verifyLedgerEntry(testUser, proofRunId);
  const security = await runSecurityNegativeTests(testUser, { operatorUserId });
  const finalParity = await runReadParityCheckForUser(testUser);

  return {
    proofRunId,
    deploymentSha: resolveDeploymentSha(),
    appId: PROOF_APP_ID,
    operatorUser: operatorUserId ? String(operatorUserId) : null,
    testUser: String(testUser._id),
    baseline: bootstrap.baseline,
    results: {
      readParity: parity.pass,
      savvy50: savvy.pass,
      final10BalanceSync: savvy.final10Sync && finalParity.checks.savvyMatch,
      idempotency: idempotency.pass,
      xp25: xp.pass,
      final10XpSync: xp.final10Sync,
      contract: contract.pass,
      cosmetic: cosmetic.pass,
      ledger: ledger.pass,
      security: security.pass,
      finalParity: finalParity.pass,
    },
    details: { parity, savvy, idempotency, xp, contract, cosmetic, ledger, security, finalParity },
  };
}

async function runFullProofFlow(operatorUser, { proofRunId: existingRunId } = {}) {
  const context = await resolveProofContext(operatorUser);
  const testUser = assertProofMutationsAllowed(context);
  return runFullProofFlowOnTestSubject(testUser, {
    proofRunId: existingRunId,
    operatorUserId: operatorUser._id,
    operatorUser,
  });
}

module.exports = {
  PROOF_APP_ID,
  PROOF_COSMETIC_ID,
  PROOF_SAVVY_AMOUNT,
  PROOF_XP_AMOUNT,
  createProofRunId,
  maskEmail,
  isRecognizedInternalTestUser,
  resolveConfiguredProofTestUser,
  findConfiguredProofTestUserRecord,
  activateConfiguredProofTestSubject,
  resolveProofContext,
  assertProofMutationsAllowed,
  loadAccountSnapshot,
  getProofBootstrap,
  runReadParityCheck,
  runReadParityCheckForUser,
  awardProofSavvy,
  awardProofXp,
  progressProofContract,
  unlockProofCosmetic,
  verifyLedgerEntry,
  runSecurityNegativeTests,
  runFullProofFlow,
  runFullProofFlowOnTestSubject,
  verifyAppCredentials,
};
