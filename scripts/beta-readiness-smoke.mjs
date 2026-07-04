/**
 * Beta readiness smoke — live API + route probes (no browser).
 * Usage: node scripts/beta-readiness-smoke.mjs
 */
const FRONTEND = process.env.F10_FRONTEND || 'https://www.final10.app';
const API = (process.env.F10_API || 'https://api.final10.app').replace(/\/$/, '');

const report = {
  timestamp: new Date().toISOString(),
  frontend: FRONTEND,
  api: API,
  deploy: {},
  passed: [],
  failed: [],
  warnings: [],
  notTested: [],
};

function pass(id, detail) {
  report.passed.push({ id, detail });
}
function fail(id, detail, severity = 'High') {
  report.failed.push({ id, detail, severity });
}
function warn(id, detail) {
  report.warnings.push({ id, detail });
}
function skip(id, reason) {
  report.notTested.push({ id, reason });
}

async function req(method, path, { body, token, origin } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (origin) headers.Origin = origin;
  const init = { method, headers };
  if (body) init.body = JSON.stringify(body);
  const res = await fetch(`${API}${path}`, init);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 300) };
  }
  return { status: res.status, json, headers: res.headers };
}

async function main() {
  const suffix = `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  const password = 'BetaSmoke123!';
  const email = `beta.smoke.${suffix}@example.com`;
  const username = `bsmoke${suffix}`.slice(0, 36);
  let token = null;

  // Deploy fingerprint
  try {
    const html = await (await fetch(FRONTEND)).text();
    const m = html.match(/main\.([a-f0-9]+)\.js/);
    report.deploy.liveBundle = m ? `main.${m[1]}.js` : 'unknown';
    pass('DEPLOY-FRONTEND-UP', `Frontend responds; bundle=${report.deploy.liveBundle}`);
  } catch (e) {
    fail('DEPLOY-FRONTEND-UP', e.message, 'Critical');
  }

  // Health
  try {
    const { status, json } = await req('GET', '/api/health');
    if (status === 200 && json.ok) {
      pass('API-HEALTH', `mongo=${json.mongo?.status} alertEmail=${json.alertEmailEnabled}`);
      report.deploy.apiUptimeSec = json.uptimeSec;
      if (json.emailFromAudit?.issue) warn('EMAIL-FROM', json.emailFromAudit.issue);
    } else fail('API-HEALTH', `status=${status}`, 'Critical');
  } catch (e) {
    fail('API-HEALTH', e.message, 'Critical');
  }

  // Public config
  try {
    const { status, json } = await req('GET', '/api/config/public');
    status === 200 ? pass('CONFIG-PUBLIC', 'OK') : fail('CONFIG-PUBLIC', `status=${status}`, 'High');
    if (json?.stripePublishableKey) pass('STRIPE-CONFIG', 'Publishable key present');
    else warn('STRIPE-CONFIG', 'No stripePublishableKey in public config');
  } catch (e) {
    fail('CONFIG-PUBLIC', e.message, 'High');
  }

  // OAuth providers
  try {
    const { status, json } = await req('GET', '/api/auth/providers');
    if (status === 200) {
      json.google ? pass('GOOGLE-OAUTH-CONFIG', 'google=true') : warn('GOOGLE-OAUTH-CONFIG', 'google=false');
      json.apple ? pass('APPLE-OAUTH-CONFIG', 'apple=true') : skip('APPLE-OAUTH', 'apple provider disabled');
    } else fail('GOOGLE-OAUTH-CONFIG', `status=${status}`, 'High');
  } catch (e) {
    fail('GOOGLE-OAUTH-CONFIG', e.message, 'High');
  }

  // Google OAuth redirect (no follow)
  try {
    const res = await fetch(`${API}/api/auth/google`, { redirect: 'manual' });
    const loc = res.headers.get('location') || '';
    if (res.status === 302 && loc.includes('accounts.google.com')) {
      pass('GOOGLE-OAUTH-REDIRECT', 'Redirects to Google');
    } else if (res.status >= 400) {
      fail('GOOGLE-OAUTH-REDIRECT', `status=${res.status}`, 'High');
    } else {
      warn('GOOGLE-OAUTH-REDIRECT', `status=${res.status} loc=${loc.slice(0, 80)}`);
    }
  } catch (e) {
    fail('GOOGLE-OAUTH-REDIRECT', e.message, 'High');
  }

  // Unauth /me
  try {
    const { status } = await req('GET', '/api/auth/me');
    status === 401 ? pass('UNAUTH-ME', '401 as expected') : fail('UNAUTH-ME', `status=${status}`, 'Critical');
  } catch (e) {
    fail('UNAUTH-ME', e.message, 'Critical');
  }

  // Signup
  try {
    const { status, json } = await req('POST', '/api/auth/register', {
      body: {
        firstName: 'Beta',
        lastName: 'Smoke',
        username,
        email,
        password,
        referralCode: '',
      },
    });
    token = json?.token;
    if (status === 201 && token) {
      pass('SIGNUP', `user=${json.user?.username}`);
      if (json.user?.email === email.toLowerCase()) pass('EMAIL-NORMALIZE', 'stored lowercase');
      else fail('EMAIL-NORMALIZE', `stored=${json.user?.email}`, 'Critical');
    } else fail('SIGNUP', `status=${status} ${json?.message || ''}`, 'Critical');
  } catch (e) {
    fail('SIGNUP', e.message, 'Critical');
  }

  // Login lowercase
  if (token) {
    try {
      const { status, json } = await req('POST', '/api/auth/login', {
        body: { email: email.toLowerCase(), password },
      });
      status === 200 && json?.token
        ? pass('LOGIN-LOWERCASE', 'OK')
        : fail('LOGIN-LOWERCASE', `status=${status}`, 'Critical');
      token = json?.token || token;
    } catch (e) {
      fail('LOGIN-LOWERCASE', e.message, 'Critical');
    }
  } else skip('LOGIN-LOWERCASE', 'no signup token');

  // Auth me
  if (token) {
    try {
      const { status, json } = await req('GET', '/api/auth/me', { token });
      status === 200 ? pass('AUTH-ME', `savvy=${json.savvyPoints ?? json.points}`) : fail('AUTH-ME', `status=${status}`, 'Critical');
    } catch (e) {
      fail('AUTH-ME', e.message, 'Critical');
    }
  }

  // Forgot password
  try {
    const { status, json } = await req('POST', '/api/auth/forgot-password', { body: { email } });
    status === 200 ? pass('FORGOT-PASSWORD', json?.message?.slice(0, 60) || 'OK') : fail('FORGOT-PASSWORD', `status=${status}`, 'High');
  } catch (e) {
    fail('FORGOT-PASSWORD', e.message, 'High');
  }

  // Email verification endpoint probe
  skip('EMAIL-VERIFICATION', 'Requires inbox access to verify delivery/link');

  // eBay search (public/deal hunter)
  try {
    const { status, json } = await req('GET', '/api/ebay/search?q=ps5&limit=5');
    if (status === 200 && Array.isArray(json?.items || json?.results || json?.listings)) {
      const items = json.items || json.results || json.listings;
      pass('SEARCH-EBAY', `${items.length} results`);
      const broken = items.filter((i) => i.image && !String(i.image).startsWith('http'));
      if (broken.length) warn('SEARCH-IMAGES', `${broken.length} items with relative image URLs`);
    } else if (status === 429) {
      warn('SEARCH-EBAY', 'Rate limited (429)');
    } else {
      fail('SEARCH-EBAY', `status=${status}`, 'High');
    }
  } catch (e) {
    fail('SEARCH-EBAY', e.message, 'High');
  }

  // Best move / deals feed probes
  for (const [id, path] of [
    ['FEED-TRENDING', '/api/promotions/trending/feed?limit=5'],
    ['QUICK-SNIPES', '/api/feed?limit=5'],
    ['AUCTIONS-SEARCH', '/api/auctions?limit=5'],
  ]) {
    try {
      const { status, json } = await req('GET', path, { token });
      if (status === 200) pass(id, 'OK');
      else if (status === 401 || status === 404) {
        const pub = await req('GET', path);
        pub.status === 200 ? pass(id, 'OK (public)') : warn(id, `auth=${status} public=${pub.status}`);
      } else if (status === 429) warn(id, 'Rate limited');
      else warn(id, `status=${status}`);
    } catch (e) {
      warn(id, e.message);
    }
  }

  // Authenticated economy endpoints
  if (token) {
    for (const [id, method, path] of [
      ['SAVVY-BALANCE', 'GET', '/api/points'],
      ['PERK-MACHINE-STATUS', 'GET', '/api/perk-machine/status'],
      ['SCOUT-MISSIONS', 'GET', '/api/scout-missions/progress'],
      ['ALERTS-LIST', 'GET', '/api/alerts'],
      ['EASTER-EGGS-AVAILABLE', 'GET', '/api/easter-eggs/available'],
      ['PRODUCT-FEED', 'GET', '/api/feed/product-feed?limit=5'],
    ]) {
      try {
        const { status, json } = await req(method, path, { token });
        if (status === 200) pass(id, JSON.stringify(json).slice(0, 80));
        else if (status === 404) warn(id, 'Route not found (404)');
        else warn(id, `status=${status}`);
      } catch (e) {
        warn(id, e.message);
      }
    }

    // Create alert
    try {
      const { status, json } = await req('POST', '/api/alerts', {
        token,
        body: {
          name: 'Beta Smoke PS5',
          keywords: ['ps5'],
          maxPrice: 400,
          sources: ['ebay'],
        },
      });
      if (status === 200 || status === 201) pass('CREATE-ALERT', `id=${json?.alert?._id || json?._id || 'ok'}`);
      else warn('CREATE-ALERT', `status=${status} ${json?.message || ''}`);
    } catch (e) {
      warn('CREATE-ALERT', e.message);
    }

    skip('ALERT-EMAIL-DELIVERY', 'Requires waiting for match + inbox');

    // Subscribe / stripe sandbox
    try {
      const { status, json } = await req('POST', '/api/payments/create-checkout-session', {
        token,
        body: { tier: 'premium' },
      });
      if (status === 200 && (json?.url || json?.sessionId)) pass('STRIPE-CHECKOUT', 'Session created');
      else if (status === 404) warn('STRIPE-CHECKOUT', 'Endpoint missing — check mock subscribe path');
      else warn('STRIPE-CHECKOUT', `status=${status} ${json?.message || JSON.stringify(json).slice(0, 100)}`);
    } catch (e) {
      warn('STRIPE-CHECKOUT', e.message);
    }

    // Logout probe (token invalidation optional)
    pass('LOGOUT', 'Client-side only — token remains valid until expiry (JWT)');
  } else {
    ['SAVVY-BALANCE', 'PERK-MACHINE', 'CREATE-ALERT', 'SCOUT-MISSIONS'].forEach((id) =>
      skip(id, 'blocked — signup failed')
    );
  }

  skip('SCOUT-FLIGHT', 'Requires browser interaction');
  skip('MOBILE-RESPONSIVE', 'Requires browser/device viewport test');
  skip('GOOGLE-OAUTH-COMPLETE', 'Requires interactive Google consent');

  // CORS
  try {
    const res = await fetch(`${API}/api/health`, {
      method: 'OPTIONS',
      headers: {
        Origin: FRONTEND,
        'Access-Control-Request-Method': 'GET',
      },
    });
    const cors = res.headers.get('access-control-allow-origin');
    cors ? pass('CORS', cors) : warn('CORS', 'No ACAO header');
  } catch (e) {
    warn('CORS', e.message);
  }

  console.log(JSON.stringify(report, null, 2));
  process.exit(report.failed.some((f) => f.severity === 'Critical') ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
