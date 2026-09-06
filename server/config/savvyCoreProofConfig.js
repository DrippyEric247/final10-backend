/**
 * Savvy Core V1 — production proof harness configuration.
 * Feature-flagged; never enables global writes by itself.
 */
const { SAVVY_APP_IDS } = require('./savvyCoreAppRegistryData');

const PROOF_APP_ID = SAVVY_APP_IDS.SAVVY_TRIP_TEST;
const PROOF_APP_LABEL = 'SavvyTrip Test';
const PROOF_COSMETIC_ID = 'savvytrip_test_proof_card';
const PROOF_SAVVY_AMOUNT = 50;
const PROOF_XP_AMOUNT = 25;
const PROOF_CONTRACT_TRIGGER = 'proof_action';
const PROOF_CONTRACT_ID = 'savvytrip_test_proof_action';

function envFlag(name, defaultValue = false) {
  const raw = process.env[name];
  if (raw == null || raw === '') return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(String(raw).trim().toLowerCase());
}

function isSavvyCoreProofEnabled() {
  return envFlag('SAVVY_CORE_PROOF_ENABLED', false);
}

function resolveDeploymentSha() {
  return (
    process.env.RAILWAY_GIT_COMMIT_SHA ||
    process.env.GIT_COMMIT_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.RENDER_GIT_COMMIT ||
    'local-dev'
  );
}

function resolveProofAppKey() {
  try {
    const raw = process.env.SAVVY_CORE_APP_KEYS;
    if (!raw) return null;
    const keys = JSON.parse(raw);
    return keys[PROOF_APP_ID] || null;
  } catch {
    return null;
  }
}

function buildProofIdempotencyKey(proofRunId, action) {
  return `${PROOF_APP_ID}:proof:${proofRunId}:${action}`;
}

module.exports = {
  PROOF_APP_ID,
  PROOF_APP_LABEL,
  PROOF_COSMETIC_ID,
  PROOF_SAVVY_AMOUNT,
  PROOF_XP_AMOUNT,
  PROOF_CONTRACT_TRIGGER,
  PROOF_CONTRACT_ID,
  isSavvyCoreProofEnabled,
  resolveDeploymentSha,
  resolveProofAppKey,
  buildProofIdempotencyKey,
};
