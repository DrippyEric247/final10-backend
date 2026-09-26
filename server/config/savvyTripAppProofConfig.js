/**
 * SavvyTrip App #2 proof — real product appId (not savvytrip_test).
 * Reuses the same Core flags / test subject as Final10 production proof.
 */
const { SAVVY_APP_IDS } = require('./savvyCoreAppRegistryData');
const { isSavvyCoreProofEnabled } = require('./savvyCoreProofConfig');

const SAVVYTRIP_APP_ID = SAVVY_APP_IDS.SAVVY_TRIP;
const SAVVYTRIP_APP_LABEL = 'SavvyTrip';
const SAVVYTRIP_PROOF_COSMETIC_ID = 'savvytrip_proof_card';
const SAVVYTRIP_PROOF_SAVVY_AMOUNT = 10;
const SAVVYTRIP_PROOF_XP_AMOUNT = 25;
const SAVVYTRIP_PROOF_CONTRACT_TRIGGER = 'savvytrip_core_proof';
const SAVVYTRIP_PROOF_CONTRACT_ID = 'savvytrip_core_proof_action';
const SAVVYTRIP_SOURCE_FEATURE_PROOF = 'core_proof';
const SAVVYTRIP_PROOF_REASON = 'SavvyTrip App #2 integration proof';

function buildSavvyTripProofIdempotencyKey(proofRunId, action) {
  return `${SAVVYTRIP_APP_ID}:proof:${proofRunId}:${action}`;
}

module.exports = {
  SAVVYTRIP_APP_ID,
  SAVVYTRIP_APP_LABEL,
  SAVVYTRIP_PROOF_COSMETIC_ID,
  SAVVYTRIP_PROOF_SAVVY_AMOUNT,
  SAVVYTRIP_PROOF_XP_AMOUNT,
  SAVVYTRIP_PROOF_CONTRACT_TRIGGER,
  SAVVYTRIP_PROOF_CONTRACT_ID,
  SAVVYTRIP_SOURCE_FEATURE_PROOF,
  SAVVYTRIP_PROOF_REASON,
  isSavvyCoreProofEnabled,
  buildSavvyTripProofIdempotencyKey,
};
