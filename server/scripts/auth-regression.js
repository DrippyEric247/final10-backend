#!/usr/bin/env node
/**
 * Auth regression sweep — signup, login (case variants), forgot-password,
 * protected routes, OAuth providers. Run against local or live API.
 *
 *   cd server && node scripts/auth-regression.js
 *   API_BASE=https://api.final10.app node scripts/auth-regression.js
 */
const axios = require('axios');

const API_BASE = (process.env.API_BASE || 'http://localhost:5000/api').replace(/\/$/, '');
const suffix = `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
const password = 'QaRegression123!';
const mixedEmail = `QaMixed.${suffix}@Example.COM`;
const lowerEmail = mixedEmail.toLowerCase();
const username = `qareg${suffix}`.slice(0, 38);

const results = [];

function record(id, pass, detail) {
  results.push({ id, pass, detail });
  const icon = pass ? '✅' : '❌';
  console.log(`${icon} ${id}: ${detail}`);
}

async function main() {
  console.log(`\n🔐 Auth regression — ${API_BASE}\n`);

  // Health
  try {
    const { data } = await axios.get(`${API_BASE}/health`, { timeout: 15000 });
    record('PREFLIGHT', data.ok === true, `health ok=${data.ok}`);
  } catch (e) {
    record('PREFLIGHT', false, e.message);
    printSummary();
    process.exit(1);
  }

  // OAuth providers
  try {
    const { data } = await axios.get(`${API_BASE}/auth/providers`, { timeout: 15000 });
    record('NU-03-OAUTH-PROVIDERS', typeof data.google === 'boolean', `google=${data.google} apple=${data.apple}`);
  } catch (e) {
    record('NU-03-OAUTH-PROVIDERS', false, e.message);
  }

  // Unauthenticated /me
  try {
    await axios.get(`${API_BASE}/auth/me`, { timeout: 15000 });
    record('SC-05-UNAUTH-ME', false, 'expected 401');
  } catch (e) {
    const status = e.response?.status;
    record('SC-05-UNAUTH-ME', status === 401, `status=${status}`);
  }

  // Signup with mixed-case email
  let token;
  try {
    const { data, status } = await axios.post(
      `${API_BASE}/auth/register`,
      {
        firstName: 'QA',
        lastName: 'Regression',
        username,
        email: mixedEmail,
        password,
        referralCode: '',
      },
      { timeout: 20000, validateStatus: () => true }
    );
    token = data?.token;
    const storedEmail = data?.user?.email;
    record(
      'NU-01-SIGNUP-MIXED-CASE',
      status === 201 && Boolean(token) && storedEmail === lowerEmail,
      `status=${status} storedEmail=${storedEmail}`
    );
  } catch (e) {
    record('NU-01-SIGNUP-MIXED-CASE', false, e.message);
  }

  // Login lowercase variant
  try {
    const { data, status } = await axios.post(
      `${API_BASE}/auth/login`,
      { email: lowerEmail, password },
      { timeout: 20000, validateStatus: () => true }
    );
    record(
      'BUG-001-LOGIN-LOWERCASE',
      status === 200 && Boolean(data?.token),
      `status=${status}`
    );
    token = data?.token || token;
  } catch (e) {
    record('BUG-001-LOGIN-LOWERCASE', false, e.message);
  }

  // Login mixed-case variant
  try {
    const { status } = await axios.post(
      `${API_BASE}/auth/login`,
      { email: mixedEmail, password },
      { timeout: 20000, validateStatus: () => true }
    );
    record('BUG-001-LOGIN-MIXED-CASE', status === 200, `status=${status}`);
  } catch (e) {
    record('BUG-001-LOGIN-MIXED-CASE', false, e.message);
  }

  // Protected /me with token
  try {
    const { status, data } = await axios.get(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15000,
      validateStatus: () => true,
    });
    record('NU-02-AUTH-ME', status === 200 && data?.email === lowerEmail, `status=${status} email=${data?.email}`);
  } catch (e) {
    record('NU-02-AUTH-ME', false, e.message);
  }

  // Forgot password (anti-enumeration)
  try {
    const { status, data } = await axios.post(
      `${API_BASE}/auth/forgot-password`,
      { email: lowerEmail },
      { timeout: 15000,
        validateStatus: () => true }
    );
    record(
      'NU-04-FORGOT-PASSWORD',
      status === 200 && /sent reset instructions/i.test(data?.message || ''),
      `status=${status}`
    );
  } catch (e) {
    record('NU-04-FORGOT-PASSWORD', false, e.message);
  }

  // Short password rejected
  try {
    const { status } = await axios.post(
      `${API_BASE}/auth/register`,
      {
        firstName: 'Bad',
        lastName: 'Pass',
        username: `bad${suffix}`,
        email: `bad.${suffix}@example.com`,
        password: 'short',
        referralCode: '',
      },
      { timeout: 15000, validateStatus: () => true }
    );
    record('BUG-002-SHORT-PASSWORD-SERVER', status === 400, `status=${status}`);
  } catch (e) {
    record('BUG-002-SHORT-PASSWORD-SERVER', false, e.message);
  }

  // Signup conflict on case variant
  try {
    const { status } = await axios.post(
      `${API_BASE}/auth/register`,
      {
        firstName: 'Dup',
        lastName: 'User',
        username: `dup${suffix}`,
        email: mixedEmail,
        password,
        referralCode: '',
      },
      { timeout: 15000, validateStatus: () => true }
    );
    record('BUG-001-SIGNUP-CONFLICT-CASE', status === 400, `status=${status}`);
  } catch (e) {
    record('BUG-001-SIGNUP-CONFLICT-CASE', false, e.message);
  }

  printSummary();
  const failed = results.filter((r) => !r.pass);
  process.exit(failed.length ? 1 : 0);
}

function printSummary() {
  const passed = results.filter((r) => r.pass).length;
  console.log(`\n📊 ${passed}/${results.length} passed\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
