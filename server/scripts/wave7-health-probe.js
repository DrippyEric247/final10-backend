#!/usr/bin/env node
/**
 * Live health/readiness probe — verifies 503→200 transition after Mongo connects.
 * Never prints secrets.
 */

const http = require('http');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

process.env.NODE_ENV = process.env.NODE_ENV || 'development';
process.env.PORT = process.env.PORT || '8099';
process.env.DISABLE_SAVVY_SCOUT_SCAN = 'true';
process.env.DISABLE_AUCTION_CRON_REFRESH = 'true';
process.env.ALERT_E2E_BOOT_DISABLED = 'true';
process.env.INDEX_DEPLOY_DRY_RUN = '1';

function probe(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let body = '';
        res.on('data', (c) => {
          body += c;
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

async function waitForReady(base, maxMs = 30000) {
  const start = Date.now();
  let last = null;
  while (Date.now() - start < maxMs) {
    last = await probe(`${base}/api/health/ready`);
    if (last.status === 200 && last.json?.ok === true) return last;
    await new Promise((r) => setTimeout(r, 500));
  }
  return last;
}

async function main() {
  if (!process.env.MONGODB_URI) {
    console.log(JSON.stringify({ ok: false, reason: 'MONGODB_URI missing' }));
    process.exit(1);
  }

  delete require.cache[require.resolve('../index.js')];
  require('../index.js');

  const base = `http://127.0.0.1:${process.env.PORT}`;
  await new Promise((r) => setTimeout(r, 300));

  const healthEarly = await probe(`${base}/api/health`);
  const readyEarly = await probe(`${base}/api/health/ready`);
  const readyFinal = await waitForReady(base, 25000);
  const healthFinal = await probe(`${base}/health`);

  const report = {
    ok:
      healthEarly.status === 200 &&
      healthFinal.status === 200 &&
      readyFinal.status === 200 &&
      readyFinal.json?.mongo?.ready === true,
    healthEarly: { status: healthEarly.status, live: healthEarly.json?.live },
    readyEarly: {
      status: readyEarly.status,
      mongoReady: readyEarly.json?.mongo?.ready,
    },
    readyFinal: {
      status: readyFinal.status,
      mongoReady: readyFinal.json?.mongo?.ready,
      ok: readyFinal.json?.ok,
    },
    healthFinal: { status: healthFinal.status },
    readinessTransition:
      readyEarly.status === 503 || readyEarly.json?.ok === false
        ? '503_or_not_ready_before_mongo_then_ready'
        : 'already_ready_on_first_probe',
  };

  console.log(JSON.stringify(report, null, 2));
  process.kill(process.pid, 'SIGTERM');
  process.exit(report.ok ? 0 : 1);
}

main().catch((err) => {
  console.log(JSON.stringify({ ok: false, error: String(err.message).slice(0, 200) }));
  process.exit(1);
});
