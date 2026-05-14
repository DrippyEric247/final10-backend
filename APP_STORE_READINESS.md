# Final10 — App Store Readiness Tracker

A single source of truth for the four-phase push from feature-heavy web app
to shipping iOS (Capacitor) + hardened backend. Update the status column as
tasks land. **Do not add new consumer tabs until every P0 here is green.**

Target host: **Railway** (both client + server services).
Target native wrapper: **Capacitor** (reuses the CRA React client 1:1).

Status legend: ✅ done · 🟡 in progress · 🔲 not started · ⛔ blocked on user input.

---

## Phase 1 — Product readiness

> Goal: a new visitor understands "what is this and why should I care" within 60 seconds.

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1.1 | Onboarding — first 60 s explainer | 🟡 | `FirstSixtyLanding` + `SavvyFirstRunExperience` exist. Need an audit pass: the current experience is multi-step; condense to "Best Move → Savvy reward → multiplier" in 3 screens max. |
| 1.2 | Best Move front-and-center on Dashboard | ✅ | Dashboard already has a Best Move hero card with gold treatment. |
| 1.3 | Savvy explanation is clear | 🟡 | `SavvyRewardBadge` now shows `+113 (2.0× = +226)` with highlights. Need a one-liner "What is Savvy?" link from Dashboard hero → `/points` explainer. |
| 1.4 | Global search on every listing surface | ✅ | `GlobalSmartSearch` now renders on Dashboard, Auctions, LocalDeals, SavvyOffers, Trending. Scope enum extended with `dashboard` and `feed`. Still TODO: mount on `WinFeed` and `ProductFeed`. |
| 1.5 | Trust + reward display consistent everywhere | ✅ | Every deal card routes through `DealCard` → `DealCardShell` → `SavvyRewardBadge`. OfferCard, Auctions, ProductFeed all import the same badge. |
| 1.6 | Remove dev/debug UI from user surfaces | ✅ | `AuthDebugger` gated to non-production. Internal dashboards (`/shield-dashboard`, `/owner-control`, `/admin/cosmetics`, `/production-readiness`, `/launch-kpis`, `/growth-levers`) wrapped in `InternalRoute`, role-gated in prod. |
| 1.7 | Standardized loading / empty / error | 🟡 | `LoadingState`, `EmptyState`, `ErrorState` primitives shipped in `components/ui/states/`. Still TODO: retrofit the top 5 pages (Dashboard, Auctions, ProductFeed, LocalDeals, WinFeed) to use them. |

---

## Phase 2 — Production readiness

> Goal: safe, stable, observable, and abuse-resistant backend.

| # | Task | Status | Notes |
|---|------|--------|-------|
| 2.1 | Rotate all exposed credentials | ⛔ | **Blocked on user action** — see `SECURITY_ROTATION.md`. Until every secret in that doc is rotated in the eBay/Stripe/Mongo/OpenAI/Shield consoles and re-set in Railway, the server is not safe to push live. |
| 2.2 | Remove dev-only env flag reliance | ✅ | `DISABLE_EBAY_AUTH`, `ALLOW_PROGRESSION_TRUST_BYPASS`, `ALLOW_BP_CLIENT_PREMIUM_UNLOCK` now refused by `envValidation` in production. Server exits rather than booting with them. eBay route middleware also now ignores the bypass flag in prod. |
| 2.3 | Startup refuses on weak/placeholder secrets | ✅ | `validateCoreEnv` scans `PLACEHOLDER_PATTERNS` (`supersecretchangeme`, `your_*`, `replace_me`, etc.) and exits on match in production. `JWT_SECRET` must be ≥ 32 chars. |
| 2.4 | Verify production auth flow end-to-end | 🔲 | After 2.1 lands, need a live smoke test of: login, hydrate `/auth/me`, token refresh, logout, password reset (not yet wired — limiter exists but no route). Cookie flags need confirmation on Railway (`Secure`, `HttpOnly`, `SameSite=Lax`). |
| 2.5 | Rate limiting on every mutating route | 🟡 | `middleware/rateLimits.js` exports the limiters. Applied on eBay and progression. Not yet confirmed applied to: `auth/login`, `auth/signup`, `auth/password-reset` (when added), `offers`, `promoCodes`, `payments` checkout. Needs an audit pass + explicit `.use(limiter)` on each router. |
| 2.6 | Structured request logging | 🔲 | `requestTelemetry` middleware exists but is minimal. Recommend `pino-http` with correlation IDs + redaction for `authorization` / cookies / body secrets. |
| 2.7 | Monitoring hooks | 🔲 | No APM / crash reporting in place. Recommend Sentry for both client + server (free tier is fine for launch). Integrates with Capacitor for iOS crashes. |
| 2.8 | Central error handling parity | 🟡 | `middleware/errorHandler.js` exists and returns `{ code, message }`. Need audit: every router must `next(err)` rather than returning raw strings; `NODE_ENV=production` must suppress stack traces. |
| 2.9 | Persistent user progress | 🔲 | `Final10PowerContext` reads from `localStorage` only. Tampering with the key directly inflates the user's multiplier. Needs server-side persistence of Power snapshot + re-computation on claim. Schema: `UserProgress { userId, activityAcc, skillAcc, loginStreakDays, lastLoginDay, updatedAt }`. |
| 2.10 | Harden reward claim logic | 🔲 | Every reward claim endpoint needs: idempotency key, server-side recomputation of `baseSavvy × trustMult × userMult`, rate limiter, audit log. Today several claim paths trust client-computed totals. |

---

## Phase 3 — Mobile readiness (Capacitor-bound)

> Goal: every tab looks native-quality on 360×640, 390×844, 430×932.

| # | Task | Status | Notes |
|---|------|--------|-------|
| 3.1 | Install Capacitor + iOS project scaffold | 🔲 | `npm install @capacitor/core @capacitor/cli @capacitor/ios`, `npx cap init Final10 com.final10.app --web-dir=client/build`, `npx cap add ios`. Requires macOS + Xcode for the iOS add. |
| 3.2 | Viewport + safe-area support | 🔲 | `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` in `client/public/index.html`. Top nav + bottom action bars get `padding-top: env(safe-area-inset-top)` etc. |
| 3.3 | Touch target audit (≥44×44 px) | 🔲 | Needs a pass across `Navigation`, all `DealCard` CTAs, `OfferCard`, profile toggles, `Final10SideAssistant` controls. `.f10-state__retry` already sized at 44 min-height; good pattern to extend. |
| 3.4 | Small-screen clutter reduction | 🔲 | Candidates to collapse behind a `<details>` / kebab menu on ≤390 px: referral banner on Dashboard, KPI strip on profile, secondary deal chips on DealCard. |
| 3.5 | App icon + splash assets | ⛔ | Blocked on logo source. `manifest.json` has `"icons": []` and `index.html` references a non-existent `logo192.png`. I can generate placeholders from `SavvyMark` + Final10 wordmark on request. Required outputs: `icon-192`, `icon-512`, `maskable-icon-512`, `apple-touch-icon-180`, iOS launch storyboards. |
| 3.6 | PWA manifest fill-in | 🔲 | `name`, `short_name`, `description`, `categories`, `theme_color` (already `#6d28d9`), `background_color`, `display: standalone`, `orientation: portrait`, `icons[]`. Rewire `index.html` to only reference icons that actually exist. |
| 3.7 | Service worker review | 🔲 | `client/public/sw.js` exists but not wired into `index.js`. Decide: keep PWA-only (current) or register for offline shell before Capacitor package. Capacitor ignores SW on iOS, so this is web-only. |

---

## Phase 4 — App Store submission assets

> Goal: everything Apple / Google review needs is in the repo before submission.

| # | Task | Status | Notes |
|---|------|--------|-------|
| 4.1 | Privacy policy page | 🔲 | Need a `/privacy` route. Required by App Store guideline 5.1.1. Needs legal entity name, data categories collected (email, username, referral data, reward balance, device ID, eBay search queries), retention policy, contact email. I can draft a skeleton once you confirm the legal entity + support email. |
| 4.2 | Terms of service page | 🔲 | `/terms` — recommended. Same blocker: legal entity. |
| 4.3 | Support / contact page | 🔲 | `/support` — required field in App Store Connect. Minimum: contact email + a short FAQ. |
| 4.4 | Account deletion flow | 🔲 | Guideline 5.1.1(v) — mandatory for apps that create accounts. Needs `POST /api/users/me/delete` + confirmation UI on `/profile`. Must actually purge the user, not just soft-delete, or document retention clearly. |
| 4.5 | App Store metadata placeholders | 🔲 | Will live in `APP_STORE_METADATA.md` — name, subtitle (30 chars), promo text (170), keywords (100), description (4000), category (Shopping recommended), age rating, support URL, marketing URL, privacy URL. |
| 4.6 | Screenshot planning | 🔲 | Required sizes: 6.9" (iPhone 16 Pro Max), 6.7", 6.5", 5.5", 12.9" iPad Pro, 11" iPad Pro. Shot list should include: Dashboard Best Move, Auctions list, DealCard detail, Savvy reward moment, Profile streak, Shield trust. |
| 4.7 | TestFlight readiness checklist | 🔲 | `APPLE_SUBMISSION_CHECKLIST.md` — bundle ID, provisioning, crash reporter (Sentry), minimum iOS 15, export compliance (no custom encryption → `ITSAppUsesNonExemptEncryption=false`), demo account credentials (review-only email + password with seeded data), reviewer notes. |

---

## Dev-loop commands (quick reference)

```bash
# Client
cd client && npm start                 # dev on :3000
cd client && npm run build             # production build → client/build/
cd client && npm run lint              # lint client

# Server
cd server && npm run dev               # nodemon on :5000 (reads server/.env)
cd server && NODE_ENV=production node index.js  # simulate prod boot (should refuse on weak secrets)

# Capacitor (after 3.1 scaffolding)
cd client && npm run build && npx cap sync ios && npx cap open ios
```

---

## Open decisions that unblock the next slices

1. **Legal entity name + support email** — blocks 4.1 / 4.2 / 4.3.
2. **Logo source (SVG or 1024×1024 PNG)** — blocks 3.5 / 3.6.
3. **Bundle identifier** — suggesting `com.final10.app`. Confirm before I scaffold Capacitor.
4. **Minimum iOS version** — recommend iOS 15. Confirm.
5. **Apple Developer account status** — account created? Team ID known?
6. **Server-side persistence for Power/reward state** — OK to land a MongoDB schema + one-time migration, or do you want to keep it localStorage-only until v1.1?

Once any of these are answered, tag the corresponding row and I'll take the next slice.
