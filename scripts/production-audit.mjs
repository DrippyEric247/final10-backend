/**
 * Production audit: console errors, failed network, route smoke checks.
 * Usage: node scripts/production-audit.mjs
 */
import { chromium } from 'playwright';

const FRONTEND = process.env.F10_FRONTEND || 'https://final10.app';
const API = process.env.F10_API || 'https://api.final10.app';

const ROUTES = [
  { name: 'Dashboard', path: '/' },
  { name: 'Login', path: '/login' },
  { name: 'Signup', path: '/register' },
  { name: 'Quick Snipes (Feed)', path: '/feed' },
  { name: 'Alerts', path: '/alerts' },
  { name: 'Wallet (Points)', path: '/points' },
  { name: 'Seller Dashboard', path: '/seller-dashboard' },
  { name: 'Auctions', path: '/auctions' },
];

const report = {
  frontend: FRONTEND,
  api: API,
  consoleErrors: [],
  consoleWarnings: [],
  failedRequests: [],
  routes: [],
  apiProbes: [],
};

async function probeApi() {
  const probes = [
    { method: 'GET', path: '/api/health' },
    { method: 'GET', path: '/api/config/public' },
    { method: 'GET', path: '/api/config/time' },
    { method: 'POST', path: '/api/auth/login', body: { email: 'audit@invalid.test', password: 'x' } },
    { method: 'POST', path: '/api/auth/register', body: { email: 'audit-invalid@test.com', password: 'Test1234!', username: 'audituser' } },
    { method: 'GET', path: '/api/notifications' },
    { method: 'GET', path: '/api/alerts' },
    { method: 'GET', path: '/api/points' },
    { method: 'POST', path: '/api/analytics/event', body: { name: 'audit_ping', props: {} } },
    { method: 'OPTIONS', path: '/api/auth/login', headers: { Origin: FRONTEND, 'Access-Control-Request-Method': 'POST' } },
  ];

  for (const p of probes) {
    try {
      const init = {
        method: p.method,
        headers: {
          'Content-Type': 'application/json',
          Origin: FRONTEND,
          ...(p.headers || {}),
        },
      };
      if (p.body) init.body = JSON.stringify(p.body);
      const res = await fetch(`${API}${p.path}`, init);
      const text = (await res.text()).slice(0, 200);
      report.apiProbes.push({
        method: p.method,
        path: p.path,
        status: res.status,
        cors: res.headers.get('access-control-allow-origin'),
        body: text,
        ok: res.ok || res.status === 401 || res.status === 400 || res.status === 204,
      });
    } catch (err) {
      report.apiProbes.push({
        method: p.method,
        path: p.path,
        error: err.message,
        ok: false,
      });
    }
  }
}

async function auditBrowser() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  page.on('console', (msg) => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error') report.consoleErrors.push(text);
    if (type === 'warning') report.consoleWarnings.push(text);
  });

  page.on('requestfailed', (req) => {
    report.failedRequests.push({
      url: req.url(),
      method: req.method(),
      failure: req.failure()?.errorText || 'unknown',
    });
  });

  page.on('response', (res) => {
    const url = res.url();
    if (!url.includes('/api/') && !url.includes('railway.app')) return;
    if (res.status() >= 400) {
      report.failedRequests.push({
        url,
        method: res.request().method(),
        status: res.status(),
      });
    }
  });

  for (const route of ROUTES) {
    const entry = { ...route, consoleErrors: [], failedApi: [], loaded: false };
    const beforeErr = report.consoleErrors.length;
    const beforeFail = report.failedRequests.length;

    try {
      await page.goto(`${FRONTEND}${route.path}`, { waitUntil: 'networkidle', timeout: 45000 });
      entry.loaded = true;
      await page.waitForTimeout(2000);
      entry.title = await page.title();
    } catch (err) {
      entry.error = err.message;
    }

    entry.consoleErrors = report.consoleErrors.slice(beforeErr);
    entry.failedApi = report.failedRequests.slice(beforeFail).filter((r) =>
      r.url?.includes('/api/') || r.url?.includes('railway.app')
    );
    report.routes.push(entry);
  }

  await browser.close();
}

await probeApi();
await auditBrowser();

const unique = (arr) => [...new Set(arr)];
report.consoleErrors = unique(report.consoleErrors);
report.consoleWarnings = unique(report.consoleWarnings);

// Dedupe failed requests by url+status
const seen = new Set();
report.failedRequests = report.failedRequests.filter((r) => {
  const key = `${r.method}:${r.url}:${r.status || r.failure}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

console.log(JSON.stringify(report, null, 2));
