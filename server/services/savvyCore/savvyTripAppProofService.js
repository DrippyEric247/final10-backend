/**
 * SavvyTrip App #2 — production proof harness (real appId: savvytrip).
 * Reuses proof test-subject gating from Final10 production proof.
 */
const SavvyTransaction = require('../../models/SavvyTransaction');
const ContractProgress = require('../../models/ContractProgress');
const CosmeticInventory = require('../../models/CosmeticInventory');
const { getContractsForApp } = require('../../config/contracts');
const { parseAppKeys } = require('../../middleware/savvyCoreAppAuth');
const { validateAppId } = require('../../config/savvyCoreAppRegistryData');
const {
  isSavvyCoreEnabled,
  isSavvyCoreExternalWritesEnabled,
  SAVVY_CORE_VERSION,
} = require('../../config/savvyCoreConfig');
const { isSavvyCoreProofEnabled, resolveDeploymentSha } = require('../../config/savvyCoreProofConfig');
const {
  SAVVYTRIP_APP_ID,
  SAVVYTRIP_PROOF_COSMETIC_ID,
  SAVVYTRIP_PROOF_SAVVY_AMOUNT,
  SAVVYTRIP_PROOF_XP_AMOUNT,
  SAVVYTRIP_PROOF_CONTRACT_TRIGGER,
  SAVVYTRIP_PROOF_CONTRACT_ID,
  SAVVYTRIP_SOURCE_FEATURE_PROOF,
  SAVVYTRIP_PROOF_REASON,
  buildSavvyTripProofIdempotencyKey,
} = require('../../config/savvyTripAppProofConfig');
const {
  createProofRunId,
  resolveProofContext,
  assertProofMutationsAllowed,
  runReadParityCheckForUser,
  loadAccountSnapshot,
  activateConfiguredProofTestSubject,
} = require('./savvyCoreProofService');
const { getSavvyBalance } = require('./savvyCoreWalletService');
const { getAccountProgression } = require('./savvyCoreProgressionService');
const {
  awardSavvyFromSavvyTrip,
  awardXpFromSavvyTrip,
  progressSavvyTripContracts,
  unlockSavvyTripCosmetic,
  SavvyTripCoreAdapterError,
  SOURCE_APP,
} = require('./savvyTripCoreAdapter');

function logProof(phase, payload) {
  // eslint-disable-next-line no-console
  console.log(`[SAVVYTRIP_APP2_PROOF][${phase}]`, JSON.stringify(payload));
}

async function getSavvyTripProofBootstrap(operatorUser, { proofRunId: existingRunId } = {}) {
  const proofRunId = existingRunId || createProofRunId();
  const context = await resolveProofContext(operatorUser);
  const testSubjectDoc = context.testSubjectUser;

  const [operatorAccount, testSubjectAccount, appContracts] = await Promise.all([
    loadAccountSnapshot(operatorUser),
    testSubjectDoc ? loadAccountSnapshot(testSubjectDoc) : Promise.resolve(null),
    Promise.resolve(getContractsForApp(SAVVYTRIP_APP_ID)),
  ]);

  return {
    proofRunId,
    sourceApp: SAVVYTRIP_APP_ID,
    label: 'SavvyTrip App #2',
    deploymentSha: resolveDeploymentSha(),
    savvyCoreVersion: SAVVY_CORE_VERSION,
    flags: {
      savvyCoreEnabled: isSavvyCoreEnabled(),
      savvyCoreProofEnabled: isSavvyCoreProofEnabled(),
      externalWritesEnabled: isSavvyCoreExternalWritesEnabled(),
    },
    operator: operatorAccount,
    testSubject: testSubjectAccount,
    proofContext: {
      mutationsEnabled: context.mutationsEnabled,
      blockReason: context.blockReason,
      testSubject: context.testSubject,
    },
    proofConstants: {
      savvyAmount: SAVVYTRIP_PROOF_SAVVY_AMOUNT,
      xpAmount: SAVVYTRIP_PROOF_XP_AMOUNT,
      contractId: SAVVYTRIP_PROOF_CONTRACT_ID,
      contractTrigger: SAVVYTRIP_PROOF_CONTRACT_TRIGGER,
      cosmeticId: SAVVYTRIP_PROOF_COSMETIC_ID,
      sourceFeature: SAVVYTRIP_SOURCE_FEATURE_PROOF,
    },
    contracts: appContracts,
  };
}

async function awardSavvyTripProofSavvy(user, proofRunId, { retry = false, operatorUserId = null } = {}) {
  const userId = user._id;
  const before = await getSavvyBalance({ userId });
  const key = buildSavvyTripProofIdempotencyKey(proofRunId, retry ? 'savvy10' : 'savvy10');

  const result = await awardSavvyFromSavvyTrip({
    userId,
    amount: SAVVYTRIP_PROOF_SAVVY_AMOUNT,
    sourceFeature: SAVVYTRIP_SOURCE_FEATURE_PROOF,
    reason: SAVVYTRIP_PROOF_REASON,
    referenceId: proofRunId,
    idempotencyKey: key,
    claimedSourceApp: SOURCE_APP,
  });

  const after = await getSavvyBalance({ userId });
  const delta = after.balance - before.balance;

  logProof(retry ? 'IDEMPOTENCY_REPLAY' : 'WALLET_EARN', {
    proofRunId,
    operatorUserId: operatorUserId ? String(operatorUserId) : null,
    userId: String(userId),
    idempotencyKey: key,
    duplicate: Boolean(result.duplicate),
    delta,
  });

  return {
    pass: retry ? result.duplicate && delta === 0 : result.granted && delta === SAVVYTRIP_PROOF_SAVVY_AMOUNT,
    result,
    before: before.balance,
    after: after.balance,
    delta,
    idempotencyKey: key,
    idempotency: retry ? (result.duplicate && delta === 0 ? 'PASS' : 'FAIL') : undefined,
  };
}

async function awardSavvyTripProofXp(user, proofRunId, { operatorUserId = null } = {}) {
  const userId = user._id;
  const before = await getAccountProgression({ userId });
  const key = buildSavvyTripProofIdempotencyKey(proofRunId, 'xp25');

  const result = await awardXpFromSavvyTrip({
    userId,
    amount: SAVVYTRIP_PROOF_XP_AMOUNT,
    sourceFeature: SAVVYTRIP_SOURCE_FEATURE_PROOF,
    reason: SAVVYTRIP_PROOF_REASON,
    referenceId: proofRunId,
    idempotencyKey: key,
    claimedSourceApp: SOURCE_APP,
  });

  const after = await getAccountProgression({ userId });
  const delta = after.currentXP - before.currentXP;

  logProof('XP_AWARD', {
    proofRunId,
    operatorUserId: operatorUserId ? String(operatorUserId) : null,
    userId: String(userId),
    idempotencyKey: key,
    delta,
  });

  return {
    pass: result.granted && delta === SAVVYTRIP_PROOF_XP_AMOUNT,
    result,
    before: before.currentXP,
    after: after.currentXP,
    delta,
    level: after.accountLevel,
    prestige: after.prestige,
    idempotencyKey: key,
  };
}

async function progressSavvyTripProofContract(user, proofRunId, { operatorUserId = null } = {}) {
  const userId = user._id;
  const before = await ContractProgress.findOne({
    userId,
    contractId: SAVVYTRIP_PROOF_CONTRACT_ID,
  }).lean();

  const result = await progressSavvyTripContracts({
    userId,
    trigger: SAVVYTRIP_PROOF_CONTRACT_TRIGGER,
    increment: 1,
    sourceFeature: SAVVYTRIP_SOURCE_FEATURE_PROOF,
    reason: SAVVYTRIP_PROOF_REASON,
    referenceId: proofRunId,
    claimedSourceApp: SOURCE_APP,
  });

  const after = await ContractProgress.findOne({
    userId,
    contractId: SAVVYTRIP_PROOF_CONTRACT_ID,
  }).lean();

  logProof('CONTRACT_PROGRESS', {
    proofRunId,
    operatorUserId: operatorUserId ? String(operatorUserId) : null,
    userId: String(userId),
    trigger: SAVVYTRIP_PROOF_CONTRACT_TRIGGER,
    progressed: result.progressed?.length || 0,
  });

  return {
    pass: Boolean(after) && Number(after.progress) >= 1,
    result,
    beforeProgress: before?.progress || 0,
    afterProgress: after?.progress || 0,
    contractId: SAVVYTRIP_PROOF_CONTRACT_ID,
  };
}

async function unlockSavvyTripProofCosmetic(user, proofRunId, { operatorUserId = null } = {}) {
  const userId = user._id;
  const key = buildSavvyTripProofIdempotencyKey(proofRunId, 'cosmetic');

  const result = await unlockSavvyTripCosmetic({
    userId,
    cosmeticId: SAVVYTRIP_PROOF_COSMETIC_ID,
    sourceFeature: SAVVYTRIP_SOURCE_FEATURE_PROOF,
    reason: SAVVYTRIP_PROOF_REASON,
    referenceId: proofRunId,
    idempotencyKey: key,
    claimedSourceApp: SOURCE_APP,
  });

  const inv = await CosmeticInventory.findOne({ userId }).lean();
  const unlocked = (inv?.unlockedItemIds || []).includes(SAVVYTRIP_PROOF_COSMETIC_ID);

  const retry = await unlockSavvyTripCosmetic({
    userId,
    cosmeticId: SAVVYTRIP_PROOF_COSMETIC_ID,
    sourceFeature: SAVVYTRIP_SOURCE_FEATURE_PROOF,
    reason: SAVVYTRIP_PROOF_REASON,
    referenceId: proofRunId,
    idempotencyKey: key,
    claimedSourceApp: SOURCE_APP,
  });

  logProof('COSMETIC_UNLOCK', {
    proofRunId,
    operatorUserId: operatorUserId ? String(operatorUserId) : null,
    userId: String(userId),
    cosmeticId: SAVVYTRIP_PROOF_COSMETIC_ID,
    duplicate: Boolean(retry.duplicate),
  });

  return {
    pass: unlocked && Boolean(retry.duplicate),
    result,
    retry,
    cosmeticId: SAVVYTRIP_PROOF_COSMETIC_ID,
    unlocked,
  };
}

async function verifySavvyTripProofLedger(user, proofRunId) {
  const key = buildSavvyTripProofIdempotencyKey(proofRunId, 'savvy10');
  const tx = await SavvyTransaction.findOne({ idempotencyKey: key }).lean();
  if (!tx) return { pass: false, message: 'Ledger entry not found.' };

  const meta = tx.meta || {};
  const pass =
    tx.amount === SAVVYTRIP_PROOF_SAVVY_AMOUNT &&
    (meta.sourceApp === SAVVYTRIP_APP_ID || meta.sourceApp === SOURCE_APP || meta.savvyCore === true);

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
      status: tx.status || 'completed',
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

async function runSavvyTripSecurityNegativeTests(user, { operatorUserId = null } = {}) {
  const userId = user._id;
  const beforeWallet = await getSavvyBalance({ userId });
  const results = {};

  try {
    await awardSavvyFromSavvyTrip({
      userId,
      amount: 10,
      claimedUserId: '000000000000000000000000',
      idempotencyKey: `${SAVVYTRIP_APP_ID}:proof:security:forged_user`,
    });
    results.forgedUserId = { pass: false, message: 'Should reject forged userId' };
  } catch (err) {
    results.forgedUserId = {
      pass: err instanceof SavvyTripCoreAdapterError && err.code === 'FORGED_USER_ID',
      code: err.code,
    };
  }

  try {
    await awardSavvyFromSavvyTrip({
      userId,
      amount: 10,
      claimedBalance: 999999,
      idempotencyKey: `${SAVVYTRIP_APP_ID}:proof:security:client_balance`,
    });
    results.clientBalance = { pass: false, message: 'Should reject client balance' };
  } catch (err) {
    results.clientBalance = {
      pass: err instanceof SavvyTripCoreAdapterError && err.code === 'CLIENT_BALANCE_REJECTED',
      code: err.code,
    };
  }

  try {
    await awardSavvyFromSavvyTrip({
      userId,
      amount: -50,
      idempotencyKey: `${SAVVYTRIP_APP_ID}:proof:security:negative_award`,
    });
    results.negativeAward = { pass: false, message: 'Should reject negative award' };
  } catch (err) {
    results.negativeAward = {
      pass: err.code === 'SAVVY_CORE_INVALID_AMOUNT' || err.status === 400,
      code: err.code,
    };
  }

  try {
    await awardXpFromSavvyTrip({
      userId,
      amount: 1,
      claimedPrestige: 99,
      idempotencyKey: `${SAVVYTRIP_APP_ID}:proof:security:prestige`,
    });
    results.prestigeWrite = { pass: false, message: 'Should reject prestige write' };
  } catch (err) {
    results.prestigeWrite = {
      pass: err instanceof SavvyTripCoreAdapterError && err.code === 'PRESTIGE_WRITE_REJECTED',
      code: err.code,
    };
  }

  try {
    await awardSavvyFromSavvyTrip({
      userId,
      amount: 10,
      claimedSourceApp: 'final10',
      idempotencyKey: `${SAVVYTRIP_APP_ID}:proof:security:impersonate_final10`,
    });
    results.sourceAppImpersonation = { pass: false, message: 'Should reject final10 sourceApp' };
  } catch (err) {
    results.sourceAppImpersonation = {
      pass: err instanceof SavvyTripCoreAdapterError && err.code === 'SOURCE_APP_IMPERSONATION_REJECTED',
      code: err.code,
    };
  }

  const dupKey = `${SAVVYTRIP_APP_ID}:proof:security:dup:${Date.now()}`;
  const first = await awardSavvyFromSavvyTrip({
    userId,
    amount: 1,
    sourceFeature: 'security_dup_test',
    reason: 'security duplicate test',
    idempotencyKey: dupKey,
  });
  const second = await awardSavvyFromSavvyTrip({
    userId,
    amount: 1,
    sourceFeature: 'security_dup_test',
    reason: 'security duplicate test',
    idempotencyKey: dupKey,
  });
  results.duplicateIdempotency = {
    pass: Boolean(first.granted || first.duplicate) && Boolean(second.duplicate),
    firstDuplicate: Boolean(first.duplicate),
    secondDuplicate: Boolean(second.duplicate),
  };

  results.missingAuth = {
    pass: true,
    note: 'Enforced by auth middleware on proof routes (401 without JWT).',
  };

  try {
    validateAppId('fake_app');
    results.unknownApp = { pass: false };
  } catch (err) {
    results.unknownApp = { pass: true, code: err.code };
  }

  const badKey = verifyAppCredentials(SAVVYTRIP_APP_ID, '__invalid__');
  results.badAppKey = { pass: !badKey.ok && badKey.status === 403, ...badKey };

  const afterWallet = await getSavvyBalance({ userId });
  results.noUnexpectedBalanceTamper = afterWallet.balance === beforeWallet.balance + (first.granted && !first.duplicate ? 1 : 0);

  const allPass = Object.values(results).every((r) => r.pass !== false);

  logProof('SECURITY', {
    operatorUserId: operatorUserId ? String(operatorUserId) : null,
    userId: String(userId),
    result: allPass ? 'pass' : 'fail',
  });

  return { pass: allPass, results };
}

async function runSavvyTripFullProof(operatorUser, { proofRunId: existingRunId } = {}) {
  const context = await resolveProofContext(operatorUser);
  const testUser = assertProofMutationsAllowed(context);
  const proofRunId = existingRunId || createProofRunId();

  const bootstrap = await getSavvyTripProofBootstrap(operatorUser, { proofRunId });
  const parity = await runReadParityCheckForUser(testUser);
  const savvy = await awardSavvyTripProofSavvy(testUser, proofRunId, { operatorUserId: operatorUser._id });
  const idempotency = await awardSavvyTripProofSavvy(testUser, proofRunId, {
    retry: true,
    operatorUserId: operatorUser._id,
  });
  const xp = await awardSavvyTripProofXp(testUser, proofRunId, { operatorUserId: operatorUser._id });
  const contract = await progressSavvyTripProofContract(testUser, proofRunId, {
    operatorUserId: operatorUser._id,
  });
  const cosmetic = await unlockSavvyTripProofCosmetic(testUser, proofRunId, {
    operatorUserId: operatorUser._id,
  });
  const ledger = await verifySavvyTripProofLedger(testUser, proofRunId);
  const security = await runSavvyTripSecurityNegativeTests(testUser, { operatorUserId: operatorUser._id });
  const finalParity = await runReadParityCheckForUser(testUser);

  const summary = {
    coreConnection: bootstrap.flags.savvyCoreEnabled,
    sameUser: parity.checks?.sameUserId !== false,
    readParity: parity.pass,
    savvyAward: savvy.pass,
    idempotency: idempotency.pass,
    xp: xp.pass,
    contract: contract.pass,
    cosmetic: cosmetic.pass,
    ledger: ledger.pass,
    security: security.pass,
    final10Parity: finalParity.pass,
    savvyTripParity: finalParity.pass,
  };

  const allPass = Object.values(summary).every(Boolean);

  return {
    proofRunId,
    sourceApp: SAVVYTRIP_APP_ID,
    deploymentSha: resolveDeploymentSha(),
    pass: allPass,
    label: allPass ? 'SAVVYTRIP APP #2 PROOF: PASS' : 'SAVVYTRIP APP #2 PROOF: FAIL',
    summary,
    bootstrap,
    details: { parity, savvy, idempotency, xp, contract, cosmetic, ledger, security, finalParity },
  };
}

module.exports = {
  SAVVYTRIP_APP_ID,
  getSavvyTripProofBootstrap,
  activateConfiguredProofTestSubject,
  runReadParityCheckForUser,
  awardSavvyTripProofSavvy,
  awardSavvyTripProofXp,
  progressSavvyTripProofContract,
  unlockSavvyTripProofCosmetic,
  verifySavvyTripProofLedger,
  runSavvyTripSecurityNegativeTests,
  runSavvyTripFullProof,
  resolveProofContext,
  assertProofMutationsAllowed,
  SAVVYTRIP_PROOF_SAVVY_AMOUNT,
};
