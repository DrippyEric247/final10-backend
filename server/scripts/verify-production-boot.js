#!/usr/bin/env node
/**
 * Wave 7 — verify production-style boot without real secrets.
 * Usage: node server/scripts/verify-production-boot.js
 *
 * Starts a minimal env, validates config, probes health endpoints, then exits.
 * Mongo connectivity is ENVIRONMENT BLOCKED when MONGODB_URI is unavailable.
 */

const http = require('http');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.PORT = process.env.PORT || '0';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'wave7-boot-test-secret-min-32-chars!!';
process.env.MONGODB_URI = process.env.MONGODB_URI || '';
process.env.DISABLE_SAVVY_SCOUT_SCAN = 'true';
process.env.DISABLE_AUCTION_CRON_REFRESH = 'true';
process.env.ALERT_E2E_BOOT_DISABLED = 'true';

const { validateCoreEnv } = require('../config/envValidation');

function probe(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, json: JSON.parse(body || '{}') });
          } catch {
            resolve({ status: res.statusCode, json: { raw: body } });
          }
        });
      })
      .on('error', reject);
  });
}

async function main() {
  const isProdSim = String(process.env.WAVE7_SIMULATE_PRODUCTION || '') === '1';
  if (isProdSim) {
    process.env.NODE_ENV = 'production';
    delete process.env.DISABLE_EBAY_AUTH;
    delete process.env.ALLOW_PROGRESSION_TRUST_BYPASS;
    delete process.env.ALLOW_BP_CLIENT_PREMIUM_UNLOCK;
    if (!process.env.MONGODB_URI) {
      console.log(JSON.stringify({ ok: false, phase: 'env', reason: 'MONGODB_URI required for production simulation' }));
      process.exit(0);
    }
    const { looksLikePlaceholder } = require('../config/envValidation');
    const shield = String(process.env.SHIELD_WEBHOOK_SECRET || '').trim();
    if (!shield || shield === 'default_secret' || looksLikePlaceholder(shield)) {
      process.env.SHIELD_WEBHOOK_SECRET = 'wave7-prod-sim-shield-secret-min-32-chars';
    }
  }

  try {
    validateCoreEnv();
    const { validateShieldWebhookSecretAtBoot } = require('../lib/shieldWebhookSecret');
    if (isProdSim) validateShieldWebhookSecretAtBoot();
  } catch (err) {
    console.error(JSON.stringify({ ok: false, phase: 'validateCoreEnv', error: err.message }));
    process.exit(1);
  }

  if (!process.env.MONGODB_URI) {
    console.log(
      JSON.stringify({
        ok: true,
        phase: 'env_validation_only',
        mongo: 'ENVIRONMENT_BLOCKED',
        note: 'Set MONGODB_URI to run live health probe',
      })
    );
    process.exit(0);
  }

  delete require.cache[require.resolve('../index.js')];
  require('../index.js');

  await new Promise((r) => setTimeout(r, 8000));
  const port = process.env.PORT;
  const base = `http://127.0.0.1:${port}`;

  const health = await probe(`${base}/api/health`);
  const ready = await probe(`${base}/api/health/ready`);
  const aliasHealth = await probe(`${base}/health`);
  const aliasReady = await probe(`${base}/ready`);

  const report = {
    ok:
      health.status === 200 &&
      aliasHealth.status === 200 &&
      ready.status === 200 &&
      ready.json?.ok === true,
    prodSim: isProdSim,
    health,
    ready,
    aliasHealth: aliasHealth.status,
    aliasReady: aliasReady.status,
    mongoReady: ready.json?.mongo?.ready,
    indexDeployDryRun: process.env.INDEX_DEPLOY_DRY_RUN || null,
  };

  console.log(JSON.stringify(report, null, 2));
  process.kill(process.pid, 'SIGTERM');
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }));
  process.exit(1);
});
