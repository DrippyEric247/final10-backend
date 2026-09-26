const {
  SAVVYTRIP_APP_ID,
  SAVVYTRIP_PROOF_SAVVY_AMOUNT,
  SAVVYTRIP_PROOF_XP_AMOUNT,
  SAVVYTRIP_PROOF_COSMETIC_ID,
  SAVVYTRIP_PROOF_CONTRACT_ID,
  SAVVYTRIP_PROOF_CONTRACT_TRIGGER,
  buildSavvyTripProofIdempotencyKey,
} = require('../config/savvyTripAppProofConfig');
const { getContractsForApp } = require('../config/contracts');
const { isKnownCosmeticId } = require('../data/cosmeticIds');
const { hasAppPermission, SAVVY_PERMISSIONS } = require('../config/savvyCorePermissionsData');
const { SOURCE_APP } = require('../services/savvyCore/savvyTripCoreAdapter');

describe('SavvyTrip App #2 proof harness', () => {
  test('uses canonical production appId savvytrip', () => {
    expect(SAVVYTRIP_APP_ID).toBe('savvytrip');
    expect(SOURCE_APP).toBe('savvytrip');
  });

  test('proof constants match App #2 spec', () => {
    expect(SAVVYTRIP_PROOF_SAVVY_AMOUNT).toBe(10);
    expect(SAVVYTRIP_PROOF_XP_AMOUNT).toBe(25);
    expect(SAVVYTRIP_PROOF_COSMETIC_ID).toBe('savvytrip_proof_card');
    expect(isKnownCosmeticId(SAVVYTRIP_PROOF_COSMETIC_ID)).toBe(true);
  });

  test('proof contract registered for savvytrip', () => {
    const contracts = getContractsForApp('savvytrip');
    expect(
      contracts.some(
        (c) => c.id === SAVVYTRIP_PROOF_CONTRACT_ID && c.trigger === SAVVYTRIP_PROOF_CONTRACT_TRIGGER
      )
    ).toBe(true);
  });

  test('savvytrip has earn/xp/contracts/cosmetics but not wallet.spend', () => {
    expect(hasAppPermission('savvytrip', SAVVY_PERMISSIONS.WALLET_EARN)).toBe(true);
    expect(hasAppPermission('savvytrip', SAVVY_PERMISSIONS.WALLET_SPEND)).toBe(false);
    expect(hasAppPermission('savvytrip', SAVVY_PERMISSIONS.XP_AWARD)).toBe(true);
    expect(hasAppPermission('savvytrip', SAVVY_PERMISSIONS.CONTRACTS_PROGRESS)).toBe(true);
    expect(hasAppPermission('savvytrip', SAVVY_PERMISSIONS.COSMETICS_UNLOCK)).toBe(true);
  });

  test('idempotency key builder uses savvytrip namespace', () => {
    const key = buildSavvyTripProofIdempotencyKey('pr_abc123', 'savvy10');
    expect(key).toBe('savvytrip:proof:pr_abc123:savvy10');
  });
});
