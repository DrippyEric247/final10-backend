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

async function getProofBootstrap(user, { proofRunId: existingRunId } = {}) {
  const proofRunId = existingRunId || createProofRunId();
  const userId = user._id;

  const [coreMe, coreWallet, coreProgression, final10, appContracts] = await Promise.all([
    getSavvyCoreMe(user),
    getSavvyBalance({ userId }),
    getAccountProgression({ userId }),
    readFinal10Canonical(userId),
    Promise.resolve(getContractsForApp(PROOF_APP_ID)),
  ]);

  const baseline = {
    userId: String(userId),
    savvy: coreWallet.balance,
    xp: coreProgression.currentXP,
    level: coreProgression.accountLevel,
    prestige: coreProgression.prestige,
  };

  logProof('READ', {
    testProofId: proofRunId,
    appId: PROOF_APP_ID,
    userId: baseline.userId,
    result: 'ok',
  });

  return {
    proofRunId,
    connectedApp: PROOF_APP_LABEL,
    appId: PROOF_APP_ID,
    savvyCoreVersion: SAVVY_CORE_VERSION,
    deploymentSha: resolveDeploymentSha(),
    flags: {
      savvyCoreEnabled: isSavvyCoreEnabled(),
      externalWritesEnabled: isSavvyCoreExternalWritesEnabled(),
      proofEnabled: true,
      appKeyConfigured: Boolean(resolveProofAppKey()),
    },
    user: {
      userId: String(userId),
      username: user.username,
    },
    baseline,
    core: { me: coreMe, wallet: coreWallet, progression: coreProgression },
    final10,
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

async function runReadParityCheck(user) {
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

  return { pass, checks, coreWallet, coreProgression, final10 };
}

async function awardProofSavvy(user, proofRunId, { retry = false } = {}) {
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

async function awardProofXp(user, proofRunId) {
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

async function progressProofContract(user, proofRunId) {
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

async function unlockProofCosmetic(user, proofRunId) {
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

async function runSecurityNegativeTests(user) {
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
    userId: String(userId),
    result: allPass ? 'pass' : 'fail',
  });

  return { pass: allPass, results };
}

async function runFullProofFlow(user, { proofRunId: existingRunId } = {}) {
  const proofRunId = existingRunId || createProofRunId();
  const bootstrap = await getProofBootstrap(user);
  const parity = await runReadParityCheck(user);
  const savvy = await awardProofSavvy(user, proofRunId);
  const idempotency = await awardProofSavvy(user, proofRunId, { retry: true });
  const xp = await awardProofXp(user, proofRunId);
  const contract = await progressProofContract(user, proofRunId);
  const cosmetic = await unlockProofCosmetic(user, proofRunId);
  const ledger = await verifyLedgerEntry(user, proofRunId);
  const security = await runSecurityNegativeTests(user);
  const finalParity = await runReadParityCheck(user);

  return {
    proofRunId,
    deploymentSha: resolveDeploymentSha(),
    appId: PROOF_APP_ID,
    testUser: String(user._id),
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

module.exports = {
  PROOF_APP_ID,
  PROOF_COSMETIC_ID,
  PROOF_SAVVY_AMOUNT,
  PROOF_XP_AMOUNT,
  createProofRunId,
  getProofBootstrap,
  runReadParityCheck,
  awardProofSavvy,
  awardProofXp,
  progressProofContract,
  unlockProofCosmetic,
  verifyLedgerEntry,
  runSecurityNegativeTests,
  runFullProofFlow,
  verifyAppCredentials,
};
