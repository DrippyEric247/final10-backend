# Production Blockers — Tracked Work Items

> **Source:** Launch Readiness Audit (June 2026)  
> **Status:** Open — do not implement without explicit approval  
> **GitHub issues:** Create manually from templates below (`gh` CLI unavailable in audit environment)

---

## Priority order

| # | Blocker | Closed Beta | Production | Complexity |
|---|---------|-------------|------------|------------|
| 1 | [Stripe / Premium purchases](#1-stripe--premium-purchases) | Conditional | **Blocker** | High |
| 2 | [Entitlement split](#2-entitlement-split) | Conditional | **Blocker** | Medium |
| 3 | [Pro tier pricing](#3-pro-tier-pricing) | Conditional | **Blocker** | Medium |
| 4 | [Production email alerts](#4-production-email-alerts) | Conditional | **Blocker** | Low–Medium |
| 5 | [Leaderboard real data](#5-leaderboard-real-data) | OK w/ disclaimer | **Blocker** | High |

**Conditional (Closed Beta):** Blocker only if that feature is in beta scope (paid upgrade, email alerts, live rankings).

---

## 1. Stripe / Premium purchases

**Status:** `[ ] Open`

### Files
- `client/src/pages/Premium.js`
- `client/src/hooks/useCreateCheckout.ts`
- `client/src/lib/api.js` (`subscribeUser`)
- `server/routes/subscribe.js`
- `server/routes/payments.js`
- `server/routes/stripeWebhook.js`

### Bug
Upgrade on `/premium` calls `POST /api/subscribe`, granting tier with no payment. Stripe checkout hook exists but is never used by the upgrade UI.

### Acceptance criteria
- [ ] Premium page launches Stripe Checkout (or Elements) for paid tiers
- [ ] Mock subscribe disabled in production (`FINAL10_REQUIRE_STRIPE` or equivalent)
- [ ] `?checkout=success` reloads entitlement state
- [ ] Checkout footer shows Stripe + legal/trust copy

### GitHub issue title
`[Production] Wire Premium upgrade to Stripe checkout (remove mock subscribe in prod)`

---

## 2. Entitlement split

**Status:** `[ ] Open` — depends on #1

### Files
- `server/routes/subscribe.js`
- `server/services/premiumEntitlementService.js`
- `server/services/battlePassPersistenceService.js`
- `server/routes/progressionRoutes.js` (`POST /premium`)
- `client/src/pages/BattlePassPage.tsx`
- `client/src/components/PremiumEntitlementCard.jsx`

### Bug
Mock subscribe updates `User.membershipTier`. Battle Pass premium track reads Stripe `PremiumEntitlement` only. Users can appear subscribed while premium track stays locked.

### Acceptance criteria
- [ ] Single source of truth for premium state (User + PremiumEntitlement synced)
- [ ] Webhook + mock/dev paths both reconcile Battle Pass premium
- [ ] Profile, Battle Pass, and gated features agree on tier

### GitHub issue title
`[Production] Unify premium entitlements (User membership ↔ PremiumEntitlement ↔ Battle Pass)`

---

## 3. Pro tier pricing

**Status:** `[ ] Open` — ship with #1

### Files
- `client/src/pages/Pricing.js`
- `client/src/pages/Premium.js`
- `client/src/lib/final10SubscriptionTiers.js`
- `server/.env.example`
- `server/routes/payments.js`

### Bug
Pro tier is marketed; only one `STRIPE_PREMIUM_PRICE_ID` exists. Premium ignores `?tier=pro` query params.

### Acceptance criteria
- [ ] Pro Stripe Price ID in env + server config
- [ ] Premium reads `tier` / `trigger` query params
- [ ] Pro checkout completes and grants correct tier
- [ ] Or: Pro hidden until ready (explicit product decision)

### GitHub issue title
`[Production] Add Pro tier Stripe price and Premium query-param preselection`

---

## 4. Production email alerts

**Status:** `[ ] Open`

### Files
- `server/services/emailService.js`
- `server/services/alertDeliveryService.js`
- `server/.env.example`
- `server/templates/email/savvyScoutDealFoundTemplate.js`
- `server/templates/email/savvyScoutMonthlyReportTemplate.js`
- `client/src/pages/Settings.js` (notification prefs — not yet built)

### Bug
`ALERT_EMAIL_ENABLED` defaults off. Deal-match and monthly report emails log-only even when Resend/SMTP is configured. No Settings UI for `alertEmailOnMatch` opt-out.

### Acceptance criteria
- [ ] Production env sets `ALERT_EMAIL_ENABLED=true` with verified Resend domain
- [ ] Alert emails deliver on match for opted-in users
- [ ] Settings page toggles alert email preference
- [ ] Monthly report cron or documented manual process for production

### GitHub issue title
`[Production] Enable alert email pipeline and user notification preferences`

---

## 5. Leaderboard real data

**Status:** `[ ] Open`

### Files
- `client/src/pages/LeaderboardPage.js`
- `client/src/data/leaderboardMock.js`
- `client/src/pages/Profile.js`
- `client/src/lib/battlePassTaskEngine.js`
- Server: new aggregation route TBD

### Bug
Rankings come from `leaderboardMock`. Profile rivalry and Battle Pass tasks also consume mock data. Misleading if marketed as live competition.

### Acceptance criteria
- [ ] Server API returns real ranked players (or empty state)
- [ ] Client removes mock fallback in production
- [ ] Loading / error / empty states implemented
- [ ] Profile rivalry uses same data source

### GitHub issue title
`[Production] Replace mock leaderboard with live rankings API`

---

## Recommended implementation order

1. **#1 Stripe / Premium** — root payment path  
2. **#3 Pro tier pricing** — same checkout pass  
3. **#2 Entitlement split** — after payment wiring  
4. **#4 Production email alerts** — independent ops + UI  
5. **#5 Leaderboard real data** — trust before public scale  

---

## Launch readiness report locations

| Resource | Path |
|----------|------|
| In-app checklist (admin) | `/production-readiness` → `client/src/pages/ProductionReadinessPage.tsx` |
| Checklist data | `client/src/data/productionChecklist.ts` |
| Markdown checklist | `PRODUCTION_READINESS_CHECKLIST.md` |
| App Store readiness | `APP_STORE_READINESS.md` |
| Launch KPIs (admin) | `/launch-kpis` → `client/src/pages/LaunchKPIDashboard.tsx` |
| This blocker tracker | `docs/PRODUCTION_BLOCKERS.md` |
