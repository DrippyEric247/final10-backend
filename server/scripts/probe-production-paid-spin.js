#!/usr/bin/env node
const API = process.env.PROBE_API_URL || 'https://api.final10.app';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function req(method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { method, headers, body: body != null ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function registerUser() {
  const ts = `${Date.now()}${Math.floor(Math.random() * 9999)}`;
  const reg = await req('POST', '/api/auth/register', {
    body: {
      firstName: 'Diag',
      lastName: 'Paid',
      username: `dp${ts}`,
      email: `dp.${ts}@gmail.com`,
      password: 'DiagSpinTest123!',
    },
  });
  if (reg.status >= 400) throw new Error(`register ${reg.status} ${JSON.stringify(reg.json)}`);
  return reg.json.token;
}

async function main() {
  const paid = [];
  for (let i = 0; i < 6; i += 1) {
    await sleep(12000);
    const token = await registerUser();
    const streak = await req('POST', '/api/streak/claim', { token });
    const bal = streak.json?.newBalance ?? streak.json?.status?.savvyBalance ?? streak.json?.savvyPointsEarned;
    await sleep(6000);
    const spin = await req('POST', '/api/perk-machine/spin', { token, body: { mode: 'paid_1' } });
    paid.push({
      i,
      streakSavvy: bal,
      status: spin.status,
      code: spin.json?.code,
      message: spin.json?.message,
      reward: spin.json?.rewards?.[0]?.type || spin.json?.rewards?.[0]?.id,
      savvyCost: spin.json?.savvyCost,
      requestId: spin.json?.requestId,
    });
  }
  console.log(JSON.stringify({ paid }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
