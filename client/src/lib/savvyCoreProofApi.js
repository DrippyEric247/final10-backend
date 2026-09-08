import { api } from "./api";
import { apiPath, composeApiUrl, getApiBaseUrl } from "./runtimeApi";

const BASE = apiPath("savvy-core-proof");

/** @internal diagnostics — base axios root and proof route segment */
export function getSavvyCoreProofApiTargets() {
  return {
    baseApiUrl: getApiBaseUrl(),
    proofPath: `${BASE}/bootstrap`.replace(/\/bootstrap$/, ""),
    finalComposedUrl: composeApiUrl("savvy-core-proof/bootstrap"),
  };
}

export async function fetchSavvyCoreProofBootstrap(proofRunId) {
  const params = proofRunId ? { proofRunId } : {};
  const { data } = await api.get(`${BASE}/bootstrap`, { params });
  return data;
}

export async function activateSavvyCoreProofTestSubject() {
  const { data } = await api.post(`${BASE}/activate-test-subject`);
  return data;
}

export async function runSavvyCoreProofParity() {
  const { data } = await api.post(`${BASE}/parity`);
  return data;
}

export async function savvyCoreProofAwardSavvy(proofRunId, { retry = false } = {}) {
  const { data } = await api.post(`${BASE}/actions/award-savvy`, { proofRunId, retry });
  return data;
}

export async function savvyCoreProofAwardXp(proofRunId) {
  const { data } = await api.post(`${BASE}/actions/award-xp`, { proofRunId });
  return data;
}

export async function savvyCoreProofProgressContract(proofRunId) {
  const { data } = await api.post(`${BASE}/actions/progress-contract`, { proofRunId });
  return data;
}

export async function savvyCoreProofUnlockCosmetic(proofRunId) {
  const { data } = await api.post(`${BASE}/actions/unlock-cosmetic`, { proofRunId });
  return data;
}

export async function savvyCoreProofVerifyLedger(proofRunId) {
  const { data } = await api.get(`${BASE}/ledger/${encodeURIComponent(proofRunId)}`);
  return data;
}

export async function savvyCoreProofSecurityTests() {
  const { data } = await api.post(`${BASE}/security-tests`);
  return data;
}

export async function runSavvyCoreProofFull(proofRunId) {
  const { data } = await api.post(`${BASE}/run-full`, { proofRunId });
  return data;
}

/** Tamper test — server must reject non-canonical amount */
export async function savvyCoreProofTamperTest(proofRunId) {
  const { data } = await api.post(`${BASE}/actions/award-savvy`, {
    proofRunId,
    amount: 50000,
  });
  return data;
}
