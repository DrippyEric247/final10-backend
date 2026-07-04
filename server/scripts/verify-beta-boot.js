#!/usr/bin/env node
/**
 * Pre-push smoke: health latency, PORT bind, Google OAuth disabled JSON, CORS preflight.
 * Run from server/: node scripts/verify-beta-boot.js
 */
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const TEST_PORT = 19876;
const BASE = `http://127.0.0.1:${TEST_PORT}`;
const MAX_HEALTH_MS = 500;

function request(method, urlPath, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE);
    const started = Date.now();
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers,
      },
      (res) => {
        let body = '';
        res.on('data', (c) => {
          body += c;
        });
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body,
            elapsedMs: Date.now() - started,
          });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForHealth(maxWaitMs = 45000) {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    try {
      const res = await request('GET', '/api/health');
      if (res.status === 200) return res;
    } catch {
      // server still booting
    }
    await sleep(400);
  }
  throw new Error('Server did not respond to /api/health in time');
}

async function main() {
  const env = {
    ...process.env,
    NODE_ENV: 'development',
    PORT: String(TEST_PORT),
    JWT_SECRET: process.env.JWT_SECRET || 'local-verify-secret-thirty-two-chars!!',
    GOOGLE_CLIENT_ID: '',
    GOOGLE_CLIENT_SECRET: '',
    GOOGLE_CALLBACK_URL: '',
    ALLOWED_ORIGINS: 'https://final10.app,https://www.final10.app',
    CLIENT_URL: 'https://final10.app',
  };

  const child = spawn(process.execPath, ['index.js'], {
    cwd: path.join(__dirname, '..'),
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let bootLog = '';
  child.stdout.on('data', (d) => {
    bootLog += d.toString();
  });
  child.stderr.on('data', (d) => {
    bootLog += d.toString();
  });

  const results = [];
  const pass = (name, detail) => {
    results.push({ name, ok: true, detail });
    console.log(`PASS ${name}: ${detail}`);
  };
  const fail = (name, detail) => {
    results.push({ name, ok: false, detail });
    console.error(`FAIL ${name}: ${detail}`);
  };

  try {
    const health = await waitForHealth();
    if (health.elapsedMs <= MAX_HEALTH_MS) {
      pass('health_immediate', `${health.elapsedMs}ms status=${health.status}`);
    } else {
      fail('health_immediate', `${health.elapsedMs}ms exceeds ${MAX_HEALTH_MS}ms budget`);
    }

    let parsed;
    try {
      parsed = JSON.parse(health.body);
      if (parsed.live === true) {
        pass('health_payload', 'live=true');
      } else {
        fail('health_payload', JSON.stringify(parsed));
      }
    } catch (e) {
      fail('health_payload', e.message);
    }

    if (bootLog.includes(`boot phase=early_listen port=${TEST_PORT}`)) {
      pass('listen_port', `early_listen on PORT=${TEST_PORT}`);
    } else {
      fail('listen_port', 'early_listen log not found');
    }

    const google = await request('GET', '/api/auth/google?format=json', {
      Accept: 'application/json',
    });
    if (google.status === 503) {
      const body = JSON.parse(google.body);
      if (body.code === 'GOOGLE_OAUTH_DISABLED' && body.configured === false) {
        pass('google_disabled_json', `503 in ${google.elapsedMs}ms`);
      } else {
        fail('google_disabled_json', google.body);
      }
    } else {
      fail('google_disabled_json', `status=${google.status} body=${google.body.slice(0, 200)}`);
    }

    for (const origin of ['https://final10.app', 'https://www.final10.app']) {
      const preflight = await request('OPTIONS', '/api/auth/login', {
        Origin: origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization,content-type',
      });
      const acao = preflight.headers['access-control-allow-origin'];
      if ((preflight.status === 204 || preflight.status === 200) && acao === origin) {
        pass(`options_preflight_${origin}`, `status=${preflight.status} ACAO=${acao}`);
      } else {
        fail(
          `options_preflight_${origin}`,
          `status=${preflight.status} ACAO=${acao || '(missing)'}`
        );
      }
    }

    const loginRoute = await request('OPTIONS', '/api/auth/login', {
      Origin: 'https://final10.app',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type,authorization',
    });
    const methods = loginRoute.headers['access-control-allow-methods'] || '';
    if (String(methods).includes('POST')) {
      pass('options_methods', methods);
    } else {
      fail('options_methods', methods || '(missing)');
    }

    // Login route exists (401/400/429 without body — not 502/404)
    const loginPost = await request('POST', '/api/auth/login', {
      Origin: 'https://final10.app',
      'Content-Type': 'application/json',
    });
    if (loginPost.status !== 404 && loginPost.status !== 502) {
      pass('login_route_alive', `status=${loginPost.status} (route mounted)`);
    } else {
      fail('login_route_alive', `status=${loginPost.status}`);
    }
  } finally {
    child.kill('SIGTERM');
    await sleep(500);
  }

  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.error('\nVerification failed:', failed.map((f) => f.name).join(', '));
    console.error('--- boot log tail ---\n', bootLog.slice(-3000));
    process.exit(1);
  }
  console.log('\nAll pre-push checks passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
