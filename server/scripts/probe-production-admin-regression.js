#!/usr/bin/env node
/**
 * Production admin regression probe — disposable test account, full paid transaction.
 *
 * Usage:
 *   PROBE_API_URL=https://api.final10.app \
 *   PROBE_ADMIN_EMAIL=... PROBE_ADMIN_PASSWORD=... \
 *   node server/scripts/probe-production-admin-regression.js
 *
 * Or: PROBE_ADMIN_TOKEN=<jwt>
 *
 * Optional: --matrix  (run reward family matrix if control passes)
 */
const API = process.env.PROBE_API_URL || 'https://api.final10.app';

async function req(method, path, { token, body, headers = {} } = {}) {
  const h = { 'Content-Type': 'application/json', ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers: h,
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

async function resolveAdminToken() {
  if (process.env.PROBE_ADMIN_TOKEN) return process.env.PROBE_ADMIN_TOKEN.trim();
  const email = process.env.PROBE_ADMIN_EMAIL?.trim();
  const password = process.env.PROBE_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('Set PROBE_ADMIN_TOKEN or PROBE_ADMIN_EMAIL + PROBE_ADMIN_PASSWORD');
  }
  const login = await req('POST', '/api/auth/login', {
    body: { email, password },
  });
  if (login.status >= 400 || !login.json?.token) {
    throw new Error(`Admin login failed ${login.status}: ${JSON.stringify(login.json)}`);
  }
  return login.json.token;
}

function gitContainsFix(sha, fixSha = '11ae5efc') {
  if (!sha) return { known: false, containsFix: null };
  return { known: false, containsFix: null, note: 'Compare locally with git merge-base after SHA is captured' };
}

async function main() {
  const runMatrix = process.argv.includes('--matrix');
  const report = {
    api: API,
    ts: new Date().toISOString(),
    health: null,
    productionCommitSHA: null,
    contains11ae5efcFix: null,
    containsHeadFixes: null,
    adminAuth: false,
    controlProbe: null,
    matrixProbe: null,
  };

  report.health = await req('GET', '/api/health');
  report.productionCommitSHA =
    report.health.json?.gitCommitSha ||
    report.health.json?.gitSha ||
    null;

  const { execSync } = require('child_process');
  const fixSha = '11ae5efc4d8666ba8657a891c3a5c790c2b49ca2';
  const headSha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();

  if (report.productionCommitSHA) {
    try {
      execSync(`git cat-file -e ${report.productionCommitSHA}^{commit}`, { stdio: 'pipe' });
      execSync(`git merge-base --is-ancestor ${fixSha} ${report.productionCommitSHA}`, { stdio: 'pipe' });
      report.contains11ae5efcFix = 'YES';
    } catch {
      report.contains11ae5efcFix = 'NO';
    }
    try {
      execSync(`git merge-base --is-ancestor ${headSha} ${report.productionCommitSHA}`, { stdio: 'pipe' });
      report.containsHeadFixes = 'YES';
    } catch {
      report.containsHeadFixes = 'NO';
    }
  } else {
    report.inferredProductionBranch = 'main (origin/HEAD)';
    report.inferredMainSha = execSync('git rev-parse main', { encoding: 'utf8' }).trim();
    report.inferredBetaSha = execSync('git rev-parse beta', { encoding: 'utf8' }).trim();
    try {
      execSync(`git merge-base --is-ancestor ${fixSha} main`, { stdio: 'pipe' });
      report.contains11ae5efcFix = 'YES (inferred from main branch — deploy SHA not yet exposed in /api/health)';
    } catch {
      report.contains11ae5efcFix = 'NO (inferred from main branch)';
    }
    report.containsHeadFixes = `NO — main lacks beta-only commits through ${headSha.slice(0, 8)}`;
    report.productionCommitSHA = `${report.inferredMainSha} (inferred — redeploy needed for gitCommitSha in health)`;
  }

  const token = await resolveAdminToken();
  report.adminAuth = true;

  const adminPing = await req('GET', '/api/perk-machine/admin/ping', { token });
  report.adminPing = { status: adminPing.status, ok: adminPing.json?.ok === true };

  const control = await req('POST', '/api/perk-machine/admin/paid-spin-regression', {
    token,
    body: {
      mode: 'paid_1',
      forceReward: 'TEST_SAVVY_1',
      useDisposableAccount: true,
    },
  });
  report.controlProbe = {
    httpStatus: control.status,
    ...control.json,
  };

  if (runMatrix && control.json?.outcome === 'PASS') {
    const matrix = await req('POST', '/api/perk-machine/admin/paid-spin-regression/matrix', {
      token,
      body: { mode: 'paid_1', useDisposableAccount: true },
    });
    report.matrixProbe = { httpStatus: matrix.status, ...matrix.json };
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message, stack: err.stack }, null, 2));
  process.exit(1);
});
