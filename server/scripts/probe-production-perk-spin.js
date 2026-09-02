#!/usr/bin/env node
/**
 * Probe live production Perk Machine spin via public API (creates throwaway accounts).
 * Usage: node server/scripts/probe-production-perk-spin.js
 */
const API = process.env.PROBE_API_URL || 'https://api.final10.app';

async function req(method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

async function registerUser() {
  const ts = Date.now();
  const payload = {
    firstName: 'Diag',
    lastName: 'Spin',
    username: `diag${ts}`,
    email: `diag.spin.${ts}@gmail.com`,
    password: 'DiagSpinTest123!',
  };
  const reg = await req('POST', '/api/auth/register', { body: payload });
  if (reg.status >= 400) throw new Error(`register failed ${reg.status} ${JSON.stringify(reg.json)}`);
  return { token: reg.json.token, userId: reg.json.user?.id || reg.json.user?._id };
}

async function main() {
  const report = { api: API, runs: [] };

  for (let i = 0; i < 5; i += 1) {
    const { token } = await registerUser();
    const entry = { i };

    entry.statusBefore = await req('GET', '/api/perk-machine/status', { token });
    entry.streak = await req('POST', '/api/streak/claim', { token });

    for (const mode of ['free', 'paid_1', 'paid_2', 'paid_3']) {
      const spin = await req('POST', '/api/perk-machine/spin', { token, body: { mode } });
      entry[mode] = {
        status: spin.status,
        code: spin.json?.code,
        message: spin.json?.message,
        reward: spin.json?.rewards?.[0]?.type || spin.json?.rewards?.[0]?.id || null,
        requestId: spin.json?.requestId,
        detail: spin.json?.detail,
      };
      if (mode === 'free' && spin.status >= 400) break;
    }

    report.runs.push(entry);
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message, stack: err.stack }, null, 2));
  process.exit(1);
});
