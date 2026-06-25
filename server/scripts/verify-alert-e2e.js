/**
 * Run real-path alert E2E against a running API (local or production).
 *
 * Usage:
 *   node scripts/verify-alert-e2e.js --email ericvasquez012@gmail.com --token <JWT>
 *   node scripts/verify-alert-e2e.js --email eric@example.com --secret <ALERT_TEST_PUBLIC_SECRET>
 *
 * Env:
 *   API_BASE=https://api.final10.app
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

function parseArgs(argv) {
  const out = { api: process.env.API_BASE || 'http://localhost:5000' };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--email') out.email = argv[++i];
    else if (a === '--token') out.token = argv[++i];
    else if (a === '--secret') out.secret = argv[++i];
    else if (a === '--api') out.api = argv[++i];
  }
  return out;
}

async function main() {
  const { email, token, secret, api } = parseArgs(process.argv);
  if (!email) {
    console.error('Usage: node scripts/verify-alert-e2e.js --email <user@email> [--token JWT | --secret PUBLIC_SECRET] [--api URL]');
    process.exit(1);
  }

  const base = String(api).replace(/\/$/, '');
  const url = `${base}/api/test-alert/e2e-real`;
  const headers = { 'Content-Type': 'application/json' };
  if (secret) headers['X-Alert-Test-Secret'] = secret;
  else if (token) headers.Authorization = `Bearer ${token}`;
  else {
    console.error('Provide --token (JWT) or --secret (ALERT_TEST_PUBLIC_SECRET / OWNER_GRANT_SECRET)');
    process.exit(1);
  }

  console.log(`POST ${url}`);
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ to: email }),
  });
  const body = await res.json().catch(() => ({}));
  console.log(JSON.stringify({ status: res.status, ...body }, null, 2));

  if (!body.ok) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
