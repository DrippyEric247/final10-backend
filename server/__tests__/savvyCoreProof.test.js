const {
  isSavvyCoreProofEnabled,
  getProofTestUserEmailConfig,
  isOperatorAsTestSubjectAllowed,
  PROOF_SAVVY_AMOUNT,
  PROOF_XP_AMOUNT,
  PROOF_COSMETIC_ID,
  PROOF_CONTRACT_ID,
  buildProofIdempotencyKey,
} = require('../config/savvyCoreProofConfig');
const {
  PROOF_APP_ID,
  verifyAppCredentials,
  maskEmail,
  isRecognizedInternalTestUser,
  resolveProofContext,
} = require('../services/savvyCore/savvyCoreProofService');
const { validateAppId } = require('../config/savvyCoreAppRegistryData');
const { hasAppPermission, SAVVY_PERMISSIONS } = require('../config/savvyCorePermissionsData');
const { getContractsForApp } = require('../config/contracts');
const { isKnownCosmeticId } = require('../data/cosmeticIds');

jest.mock('../models/User', () => ({
  findById: jest.fn(),
  findOne: jest.fn(),
}));

const User = require('../models/User');

describe('Savvy Core production proof harness', () => {
  const envSnapshot = { ...process.env };

  afterEach(() => {
    process.env = { ...envSnapshot };
    jest.clearAllMocks();
  });

  test('proof config constants are defined', () => {
    expect(PROOF_APP_ID).toBe('savvytrip_test');
    expect(PROOF_SAVVY_AMOUNT).toBe(50);
    expect(PROOF_XP_AMOUNT).toBe(25);
    expect(PROOF_COSMETIC_ID).toBe('savvytrip_test_proof_card');
    expect(isKnownCosmeticId(PROOF_COSMETIC_ID)).toBe(true);
  });

  test('proof contract is registered for savvytrip_test', () => {
    const contracts = getContractsForApp('savvytrip_test');
    expect(contracts.some((c) => c.id === PROOF_CONTRACT_ID && c.trigger === 'proof_action')).toBe(true);
  });

  test('savvytrip_test lacks wallet.spend permission', () => {
    expect(hasAppPermission('savvytrip_test', SAVVY_PERMISSIONS.WALLET_EARN)).toBe(true);
    expect(hasAppPermission('savvytrip_test', SAVVY_PERMISSIONS.WALLET_SPEND)).toBe(false);
  });

  test('idempotency key builder is stable', () => {
    const key = buildProofIdempotencyKey('pr_abc123', 'savvy50');
    expect(key).toBe('savvytrip_test:proof:pr_abc123:savvy50');
  });

  test('unknown app is rejected', () => {
    expect(() => validateAppId('fake_app')).toThrow(/Unknown Savvy appId/);
  });

  test('bad app key is rejected', () => {
    const result = verifyAppCredentials('savvytrip_test', '__definitely_invalid__');
    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
  });

  test('proof flag defaults off in test env', () => {
    expect(isSavvyCoreProofEnabled()).toBe(false);
  });

  test('maskEmail hides most of the local part', () => {
    expect(maskEmail('proof.tester@final10.app')).toBe('p****r@final10.app');
  });

  test('internal test user requires betaTester or foundingAccess', () => {
    expect(isRecognizedInternalTestUser({ betaTester: true })).toBe(true);
    expect(isRecognizedInternalTestUser({ foundingAccess: true })).toBe(true);
    expect(isRecognizedInternalTestUser({ email: 'x@y.com' })).toBe(false);
  });

  test('resolveProofContext disables mutations when operator equals test subject', async () => {
    process.env.SAVVY_CORE_PROOF_ENABLED = 'true';
    process.env.SAVVY_CORE_V1_ENABLED = 'true';
    process.env.SAVVY_CORE_PROOF_TEST_USER_EMAIL = 'proof@test.final10.app';
    delete process.env.SAVVY_CORE_PROOF_ALLOW_OPERATOR_AS_SUBJECT;

    const operator = {
      _id: '507f1f77bcf86cd799439011',
      email: 'proof@test.final10.app',
      username: 'admin',
      betaTester: true,
    };
    User.findOne.mockResolvedValue(operator);

    const context = await resolveProofContext(operator);
    expect(context.mutationsEnabled).toBe(false);
    expect(context.blockReason).toMatch(/cannot be the operator/i);
    expect(isOperatorAsTestSubjectAllowed()).toBe(false);
    expect(getProofTestUserEmailConfig()).toBe('proof@test.final10.app');
  });

  test('resolveProofContext enables mutations for separate internal test user', async () => {
    process.env.SAVVY_CORE_PROOF_ENABLED = 'true';
    process.env.SAVVY_CORE_V1_ENABLED = 'true';
    process.env.SAVVY_CORE_PROOF_TEST_USER_EMAIL = 'proof.tester@final10.app';

    const operator = {
      _id: '507f1f77bcf86cd799439011',
      email: 'admin@final10.app',
      username: 'admin',
    };
    const testUser = {
      _id: '507f1f77bcf86cd799439099',
      email: 'proof.tester@final10.app',
      username: 'proof_tester',
      betaTester: true,
    };
    User.findOne.mockResolvedValue(testUser);

    const context = await resolveProofContext(operator);
    expect(context.mutationsEnabled).toBe(true);
    expect(context.testSubject.userId).toBe(String(testUser._id));
    expect(context.testSubject.emailMasked).toBe('p****r@final10.app');
  });
});
