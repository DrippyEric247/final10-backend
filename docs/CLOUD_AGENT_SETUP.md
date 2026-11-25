# Final10 Cloud Agent Setup (Phase 1)

This document describes how Cursor Cloud Agents develop the Final10 **backend** without a local machine.

## What Phase 1 enables

- Reproducible install of root + `server` dependencies via `scripts/cloud-agent-install.sh`
- Puppeteer Chromium download **skipped** by default (`PUPPETEER_SKIP_DOWNLOAD=1`) so installs finish reliably
- Node.js **22** (Cloud default image / `server/.nvmrc`)
- Offline-friendly unit tests: `cd server && npm run test:unit`

## What Phase 1 does **not** enable

| Requirement | Why | Notes |
| --- | --- | --- |
| MongoDB | Most API routes and integration tests need a database | Use a **non-production** Atlas/dev cluster or local Mongo later. Never point Cloud Agents at production. |
| JWT_SECRET | Auth and many protected routes | Generate a dedicated cloud/dev secret; never reuse production. |
| Stripe / eBay / Best Buy / Resend / OAuth | Optional integrations | Only needed for those features; see `server/.env.example`. |
| Puppeteer Chromium | Marketplace scrapers launch Chromium | Skipped in Cloud install. Set `PUPPETEER_SKIP_DOWNLOAD=0` and reinstall only if you intentionally need scrapers. |
| Full `npm test` | Includes Mongo integration suites | Some files throw without `MONGODB_URI`; use `test:unit` until a non-prod DB is configured. |

## Install

From the repository root:

```bash
bash scripts/cloud-agent-install.sh
```

Optional: include the React client with `CLOUD_INSTALL_CLIENT=1`.

## Unit tests (no external services)

```bash
cd server
npm run test:unit
```

Integration helpers (need a **non-prod** `MONGODB_URI`):

```bash
cd server
# npm run test:economy
# npm run test:referral
# npm run test:battle-pass-trust
# npm run test:alert-e2e
```

## Environment variables

1. Copy `server/.env.example` → `server/.env` (local only; never commit `.env`).
2. For Cloud Agents, prefer Cursor **environment secrets** over committed files.
3. Production Railway/Vercel settings must not be changed by Cloud setup work.

Minimum for a future Phase 2 local/API boot (not required for `test:unit`):

- `NODE_ENV=development`
- `MONGODB_URI` — **non-production** URI only
- `JWT_SECRET` — ≥32 chars, unique to cloud/dev

## Security rules

- Never commit API keys, passwords, JWT secrets, or Mongo credentials.
- Do not connect to production MongoDB from Cloud Agents.
- Do not modify production Railway or Vercel configuration.
- Do not change Savvy Points, subscriptions, payments, or auth business logic as part of env setup.
- Do not merge or deploy from setup PRs without explicit approval.

## Cursor environment config

Recommended install command for the dashboard / config-as-code:

```text
bash scripts/cloud-agent-install.sh
```

Committed reference: `.cursor/environment.json`  
Dashboard-managed environments must **Save** the proposed install script after a successful draft build.
