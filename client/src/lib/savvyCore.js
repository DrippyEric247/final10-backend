/**
 * Savvy Core V1 — client SDK for cross-app progression reads.
 * App #2 should use these helpers instead of Final10 user object internals.
 */
import { api } from './api';

const BASE = '/api/savvy-core';

export async function getMe() {
  const { data } = await api.get(`${BASE}/me`);
  return data;
}

export async function getWallet() {
  const { data } = await api.get(`${BASE}/wallet`);
  return data;
}

export async function getProgression() {
  const { data } = await api.get(`${BASE}/progression`);
  return data;
}

export async function getHealth() {
  const { data } = await api.get(`${BASE}/health`);
  return data;
}

/**
 * Trusted-app write helpers (server-side or privileged integrations only).
 * Requires X-Savvy-App-Id and X-Savvy-App-Key headers.
 */
export function createSavvyCoreWriteClient({ appId, appKey }) {
  const headers = {
    'X-Savvy-App-Id': appId,
    'X-Savvy-App-Key': appKey,
  };

  return {
    grantReward(body) {
      return api.post(`${BASE}/rewards/grant`, body, { headers });
    },
    earnSavvy(body) {
      return api.post(`${BASE}/wallet/earn`, body, { headers });
    },
    awardXp(body) {
      return api.post(`${BASE}/xp/award`, body, { headers });
    },
    progressContract(body) {
      return api.post(`${BASE}/contracts/progress`, body, { headers });
    },
    unlockCosmetic(body) {
      return api.post(`${BASE}/cosmetics/unlock`, body, { headers });
    },
    emitEvent(body) {
      return api.post(`${BASE}/events/emit`, body, { headers });
    },
  };
}

export const savvyCore = {
  getMe,
  getWallet,
  getProgression,
  getHealth,
  createSavvyCoreWriteClient,
};

export default savvyCore;
