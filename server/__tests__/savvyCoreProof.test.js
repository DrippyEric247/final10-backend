const {
  isSavvyCoreProofEnabled,
  PROOF_SAVVY_AMOUNT,
  PROOF_XP_AMOUNT,
  PROOF_COSMETIC_ID,
  PROOF_CONTRACT_ID,
  buildProofIdempotencyKey,
} = require('../config/savvyCoreProofConfig');
const { PROOF_APP_ID } = require('../services/savvyCore/savvyCoreProofService');
const { verifyAppCredentials } = require('../services/savvyCore/savvyCoreProofService');
const { validateAppId } = require('../config/savvyCoreAppRegistryData');
const { hasAppPermission, SAVVY_PERMISSIONS } = require('../config/savvyCorePermissionsData');
const { getContractsForApp } = require('../config/contracts');
const { isKnownCosmeticId } = require('../data/cosmeticIds');

describe('Savvy Core production proof harness', () => {
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
});
