#!/usr/bin/env node
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
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  return { status: res.status, json };
}

async function registerUser() {
  const ts = Date.now() + Math.floor(Math.random() * 9999);
  const reg = await req('POST', '/api/auth/register', {
    body: {
      firstName: 'Diag',
      lastName: 'Spin',
      username: `diag${ts}`,
      email: `diag.spin.${ts}@gmail.com`,
      password: 'DiagSpinTest123!',
    },
  });
  if (reg.status >= 400) throw new Error(`register ${reg.status}`);
  return reg.json.token;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const freeResults = {};
  const paidResults = {};

  for (let i = 0; i < 20; i += 1) {
    const token = await registerUser();
    await req('POST', '/api/streak/claim', { token });
    const spin = await req('POST', '/api/perk-machine/spin', { token, body: { mode: 'free' } });
    const key = spin.status >= 400
      ? `FAIL:${spin.json?.code || spin.status}`
      : `OK:${spin.json?.rewards?.[0]?.type || spin.json?.rewards?.[0]?.id || 'unknown'}`;
    freeResults[key] = (freeResults[key] || 0) + 1;
    if (spin.status >= 400) {
      freeResults[`msg:${spin.json?.message}`] = (freeResults[`msg:${spin.json?.message}`] || 0) + 1;
    }
  }

  for (let i = 0; i < 10; i += 1) {
    const token = await registerUser();
    const streak = await req('POST', '/api/streak/claim', { token });
    const savvy = streak.json?.newBalance ?? streak.json?.status?.savvyBalance ?? streak.json?.savvyBalance;
    await sleep(5000);
    const spin = await req('POST', '/api/perk-machine/spin', { token, body: { mode: 'paid_1' } });
    const key = spin.status >= 400
      ? `FAIL:${spin.json?.code || spin.status}:${spin.json?.message || ''}`
      : `OK:${spin.json?.rewards?.[0]?.type || spin.json?.rewards?.[0]?.id}:${spin.json?.savvyCost}`;
    paidResults[key] = (paidResults[key] || 0) + 1;
    paidResults[`savvyAfterStreak:${savvy}`] = (paidResults[`savvyAfterStreak:${savvy}`] || 0) + 1;
  }

  console.log(JSON.stringify({ freeResults, paidResults }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
