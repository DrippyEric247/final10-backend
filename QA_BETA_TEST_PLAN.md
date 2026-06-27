# Final10 AI Beta Test Plan

**Version:** 1.0 (beta pre-launch)  
**Live app under test:** [https://www.final10.app](https://www.final10.app)  
**Live API:** [https://api.final10.app](https://api.final10.app)  
**Bug reports:** use [BUG_REPORT_TEMPLATE.md](./BUG_REPORT_TEMPLATE.md)  
**Quick checklist:** [docs/BETA_QA_CHECKLIST.md](./docs/BETA_QA_CHECKLIST.md)

---

## Rules of engagement

1. **Live verification only** — Do not mark PASS from code review, local dev, or assumptions. Every PASS must cite the live URL and timestamp.
2. **NOT TESTED is valid** — Prefer NOT TESTED over assumed PASS.
3. **One bug per report** — Use `BUG_REPORT_TEMPLATE.md` for each issue.
4. **Capture evidence** — Screenshot, console, network row, Savvy balance before/after for reward tests.
5. **No production changes during test runs** — Testers report; humans triage and fix.
6. **Use fresh personas** — New User and Rewards tests should use dedicated test accounts; never use production admin accounts for chaos tests without explicit approval.

---

## Repeatable AI agent workflow

Each test agent run follows this loop:

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│ 1. Preflight│ ──► │ 2. Execute   │ ──► │ 3. Record   │ ──► │ 4. File bugs │
│ checklist   │     │ test cases   │     │ PASS/FAIL   │     │ + severity   │
└─────────────┘     └──────────────┘     └─────────────┘     └──────────────┘
```

### Agent session preflight

| Step | Action |
|------|--------|
| P1 | Open incognito / private window |
| P2 | Navigate to `https://www.final10.app` |
| P3 | Open DevTools → Console + Network |
| P4 | Optional: `GET https://api.final10.app/api/auth/providers` — record `google` / `apple` |
| P5 | Optional: `GET https://api.final10.app/api/health` — confirm API up |
| P6 | Record JS bundle name from Network (e.g. `/static/js/main.*.js`) |
| P7 | Assign role (NU / DH / RW / MB / CH / SC) and test account if needed |

### Test case record format

For each test case, agents fill:

| Column | Content |
|--------|---------|
| **Test ID** | e.g. `NU-01` |
| **Steps** | Numbered actions |
| **Expected** | Pass criteria |
| **Actual** | What happened on live |
| **Result** | PASS / FAIL / NOT TESTED / BLOCKED |
| **Severity** | If FAIL: Critical / High / Medium / Low |
| **Screenshot notes** | What to capture |
| **Console/log notes** | Errors, warnings, API codes |
| **Recommended fix** | Area to investigate (no code changes in test run) |

---

## Tester role 1: New User Tester (NU)

**Persona:** First-time visitor, no account, mobile-friendly, needs clarity on Final10 rewards ecosystem.

### Role checklist

- [ ] Land on site unauthenticated
- [ ] Email signup (`/register`)
- [ ] Google sign-in (`/login` → Continue with Google) — if providers enabled
- [ ] Apple sign-in — if providers enabled
- [ ] Email login (`/login`)
- [ ] Forgot password (`/forgot-password` → email → `/reset-password?token=...`)
- [ ] Onboarding preferences (`/onboarding/preferences`)
- [ ] Onboarding Best Move (`/onboarding/best-move`) if shown
- [ ] Discover explanation of: Savvy Points, Perk Machine, Eggs, Battle Pass, Alerts
- [ ] Logout and session cleared

### Test cases

#### NU-01 — Register with email

| | |
|---|---|
| **Steps** | 1. Go to `https://www.final10.app/register` 2. Fill username, name, email, password (10+ chars) 3. Submit |
| **Expected** | Account created; redirected to onboarding or dashboard; no raw API error |
| **Actual** | |
| **Screenshot notes** | Success state; any error banner |
| **Console/log notes** | `POST /api/auth/register` status |
| **Recommended fix** | |

#### NU-02 — Login with email

| | |
|---|---|
| **Steps** | 1. `/login` 2. Enter credentials 3. Submit |
| **Expected** | Redirect to `/` or onboarding; floating Savvy HUD appears; token stored |
| **Actual** | |
| **Screenshot notes** | Post-login dashboard |
| **Console/log notes** | `POST /api/auth/login`, `GET /api/auth/me` |
| **Recommended fix** | |

#### NU-03 — Google OAuth start

| | |
|---|---|
| **Steps** | 1. `/login` 2. Click **Continue with Google** |
| **Expected** | Redirect to Google consent OR clear on-page error if not configured; never redirect to wrong domain (e.g. `*.vercel.app` backend) |
| **Actual** | |
| **Screenshot notes** | URL bar after click |
| **Console/log notes** | `GET /api/auth/providers` → `google` value |
| **Recommended fix** | |

#### NU-04 — Forgot password request

| | |
|---|---|
| **Steps** | 1. `/login` → **Forgot Password?** 2. Enter email 3. Submit |
| **Expected** | Message: “If an account exists, we sent reset instructions.” Same for unknown email (no enumeration) |
| **Actual** | |
| **Screenshot notes** | Success message |
| **Console/log notes** | `POST /api/auth/forgot-password` → 200 |
| **Recommended fix** | |

#### NU-05 — Reset password with token

| | |
|---|---|
| **Steps** | 1. Open reset link from email (`/reset-password?token=...`) 2. Set new password + confirm 3. Submit 4. Login with new password |
| **Expected** | Success message; old password fails; new password works |
| **Actual** | |
| **Screenshot notes** | Reset success + login |
| **Console/log notes** | `POST /api/auth/reset-password` |
| **Recommended fix** | |

#### NU-06 — Onboarding preferences

| | |
|---|---|
| **Steps** | 1. Complete new account signup 2. Follow `/onboarding/preferences` 3. Select categories/interests 4. Finish |
| **Expected** | Preferences saved; user reaches main app; no infinite loop back to onboarding |
| **Actual** | |
| **Screenshot notes** | Final onboarding step |
| **Console/log notes** | Any onboarding API calls |
| **Recommended fix** | |

#### NU-07 — Savvy Points discoverability

| | |
|---|---|
| **Steps** | 1. As new user, find what Savvy Points are without reading code 2. Check Dashboard, Profile (`/profile`), HUD tooltip/copy |
| **Expected** | Plain-language explanation within 2–3 clicks of login |
| **Actual** | |
| **Screenshot notes** | Where explanation appears (or absence) |
| **Console/log notes** | N/A |
| **Recommended fix** | |

#### NU-08 — Perk Machine discoverability

| | |
|---|---|
| **Steps** | 1. Find Perk Machine from nav or dashboard 2. Open `/perk-machine` 3. Read on-page copy |
| **Expected** | User understands spins cost Savvy, eggs exist, rewards apply to wallet |
| **Actual** | |
| **Screenshot notes** | Perk Machine intro area |
| **Console/log notes** | `GET /api/perk-machine/status` |
| **Recommended fix** | |

#### NU-09 — Battle Pass discoverability

| | |
|---|---|
| **Steps** | 1. Navigate to `/battle-pass` 2. Read tier tracks and claim instructions |
| **Expected** | Free vs Premium tracks clear; 25 tiers visible; claim buttons labeled |
| **Actual** | |
| **Screenshot notes** | Battle Pass header + tier row |
| **Console/log notes** | Progression API if errors |
| **Recommended fix** | |

#### NU-10 — Alerts discoverability

| | |
|---|---|
| **Steps** | 1. Find `/alerts` 2. Understand how to create an alert |
| **Expected** | Clear CTA to create alert; form fields labeled |
| **Actual** | |
| **Screenshot notes** | Alerts empty state |
| **Console/log notes** | Alerts API |
| **Recommended fix** | |

---

## Tester role 2: Deal Hunter Tester (DH)

**Persona:** Power user hunting deals, uses search, Best Move, alerts, auction cards.

### Role checklist

- [ ] Dashboard / feed loads listings
- [ ] Search or category browse works
- [ ] Best Move flow (onboarding or main app)
- [ ] Auction list (`/auctions`) and detail (`/auction/:id`)
- [ ] Deal cards show image, title, price, trust signals
- [ ] External listing links open correctly
- [ ] CTAs (Save, Best Move, bid, etc.) respond
- [ ] Create Savvy Scout alert (`/alerts`)
- [ ] Trending / feed (`/feed`, `/trending`) if applicable

### Test cases

#### DH-01 — Auction search / browse

| | |
|---|---|
| **Steps** | 1. Login 2. Go to `/auctions` or `/feed` 3. Wait for cards to load |
| **Expected** | Cards render with images; no infinite spinner; empty state if no results |
| **Actual** | |
| **Screenshot notes** | First row of cards |
| **Console/log notes** | eBay/search API errors |
| **Recommended fix** | |

#### DH-02 — Deal card integrity

| | |
|---|---|
| **Steps** | 1. Open any deal card 2. Verify image, title, price, seller/trust badge 3. Click through link |
| **Expected** | Image loads (or fallback); price numeric; link opens valid listing URL |
| **Actual** | |
| **Screenshot notes** | Card + opened listing tab |
| **Console/log notes** | Broken image URLs |
| **Recommended fix** | |

#### DH-03 — Best Move (onboarding)

| | |
|---|---|
| **Steps** | 1. New or reset user → `/onboarding/best-move` 2. Run Best Move for a category |
| **Expected** | Results relevant to category; valid URLs; Savvy Scout copy; no PS5-only fallback for unrelated category |
| **Actual** | |
| **Screenshot notes** | Best Move results panel |
| **Console/log notes** | Search API latency/errors |
| **Recommended fix** | |

#### DH-04 — Create product alert

| | |
|---|---|
| **Steps** | 1. `/alerts` 2. Create alert with keywords/price 3. Save |
| **Expected** | Alert appears in list; confirmation shown; persists after refresh |
| **Actual** | |
| **Screenshot notes** | Alert list with new entry |
| **Console/log notes** | Alert create API |
| **Recommended fix** | |

#### DH-05 — Auction detail page

| | |
|---|---|
| **Steps** | 1. Click into `/auction/:id` 2. Review layout and actions |
| **Expected** | Detail loads; CTA buttons work; back navigation OK |
| **Actual** | |
| **Screenshot notes** | Full detail page |
| **Console/log notes** | 404 on detail fetch |
| **Recommended fix** | |

#### DH-06 — Savvy rewards on deal card

| | |
|---|---|
| **Steps** | 1. Find deal card with Savvy rewards badge 2. Read estimated Savvy / Best Move label |
| **Expected** | Copy matches tier; no NaN or broken formatting |
| **Actual** | |
| **Screenshot notes** | Rewards strip on card |
| **Console/log notes** | N/A |
| **Recommended fix** | |

---

## Tester role 3: Rewards Tester (RW)

**Persona:** Validates Savvy economy — streaks, Perk Machine, eggs, Battle Pass, inventory boosts.

### Role checklist

- [ ] Record Savvy balance before each reward action (HUD + Profile)
- [ ] Daily streak claim (`/daily-streak`)
- [ ] Perk Machine free/paid spin (`/perk-machine`)
- [ ] Egg hatch
- [ ] Net Savvy summary after paid spin (cost / rewards / net)
- [ ] Inventory token activation (BP XP, Savvy token, free spin egg)
- [ ] Battle Pass manual tier claim
- [ ] No duplicate claims; balance matches server after refresh

### Test cases

#### RW-01 — Daily streak claim

| | |
|---|---|
| **Steps** | 1. Note Savvy HUD 2. Login first time today 3. Claim daily streak |
| **Expected** | Savvy increases; streak day increments; HUD and profile match after refresh |
| **Actual** | |
| **Screenshot notes** | Before/after HUD |
| **Console/log notes** | Daily login / streak API |
| **Recommended fix** | |

#### RW-02 — Paid Perk Machine spin (net summary)

| | |
|---|---|
| **Steps** | 1. Note balance B0 2. Paid 2-slot spin (40 Savvy) 3. Win e.g. +50 Savvy 4. Read net summary |
| **Expected** | Net +10 shown; HUD = B0 - 40 + 50; history shows cost/rewards/net |
| **Actual** | |
| **Screenshot notes** | Result summary + HUD |
| **Console/log notes** | `POST /api/perk-machine/spin`; log balance before/after if dev |
| **Recommended fix** | |

#### RW-03 — Egg hatch wallet sync

| | |
|---|---|
| **Steps** | 1. Hatch egg with Savvy reward 2. Compare HUD before/after 3. Hard refresh |
| **Expected** | Savvy persists after refresh; same integer on HUD and balance card |
| **Actual** | |
| **Screenshot notes** | Hatch modal + HUD |
| **Console/log notes** | `POST /api/perk-machine/hatch` |
| **Recommended fix** | |

#### RW-04 — Inventory activation

| | |
|---|---|
| **Steps** | 1. Own a BP XP or Savvy token 2. Click **Use** 3. Confirm modal 4. Activate |
| **Expected** | Token count decreases; Active Boosts panel shows timer |
| **Actual** | |
| **Screenshot notes** | Active boosts panel |
| **Console/log notes** | `POST /api/perk-machine/activate` |
| **Recommended fix** | |

#### RW-05 — Battle Pass tier claim

| | |
|---|---|
| **Steps** | 1. `/battle-pass` 2. Claim unlocked free tier 3. Claim again |
| **Expected** | First claim succeeds; duplicate blocked; Savvy/egg inventory updates |
| **Actual** | |
| **Screenshot notes** | Claim popup + claimed state |
| **Console/log notes** | `POST /api/progression/claim-tier` |
| **Recommended fix** | |

#### RW-06 — Free spin token economy

| | |
|---|---|
| **Steps** | 1. Use daily free spin when available 2. Verify no Savvy cost |
| **Expected** | Free spin works; cooldown/countdown shown when unavailable |
| **Actual** | |
| **Screenshot notes** | Free spin button state |
| **Console/log notes** | Spin mode `free` in response |
| **Recommended fix** | |

---

## Tester role 4: Mobile Layout Tester (MB)

**Persona:** iPhone user; checks layout, touch targets, sticky elements, modals.

### Role checklist

- [ ] Viewport 390×844 (iPhone 14) or real device
- [ ] Bottom navigation usable
- [ ] Floating Savvy HUD not blocking CTAs
- [ ] Login / register / forgot password forms
- [ ] Perk Machine reels + sidebar scroll
- [ ] Battle Pass 25-tier scroll
- [ ] Modals (hatch, activation, claim) fit screen
- [ ] No horizontal page scroll on main routes

### Test cases

#### MB-01 — Login page mobile

| | |
|---|---|
| **Steps** | 1. Emulate iPhone 14 2. `/login` 3. Tap all fields and buttons |
| **Expected** | Google/Apple/email buttons full width; Forgot Password tappable; no overlap |
| **Actual** | |
| **Screenshot notes** | Full viewport screenshot |
| **Console/log notes** | N/A |
| **Recommended fix** | |

#### MB-02 — Perk Machine layout

| | |
|---|---|
| **Steps** | 1. `/perk-machine` on mobile 2. Scroll entire page 3. Tap spin buttons |
| **Expected** | Reels visible; spin buttons ≥44px touch; sidebar stacks below or scrolls |
| **Actual** | |
| **Screenshot notes** | Machine + spin row |
| **Console/log notes** | N/A |
| **Recommended fix** | |

#### MB-03 — Sticky HUD vs nav

| | |
|---|---|
| **Steps** | 1. Scroll Dashboard and Profile 2. Observe Savvy HUD + bottom nav |
| **Expected** | HUD readable; nav tabs not covered; safe-area respected |
| **Actual** | |
| **Screenshot notes** | Mid-scroll capture |
| **Console/log notes** | N/A |
| **Recommended fix** | |

#### MB-04 — Battle Pass tier grid

| | |
|---|---|
| **Steps** | 1. `/battle-pass` mobile 2. Scroll all 25 tiers |
| **Expected** | Claim buttons reachable; milestone tiers visible; no clipped text |
| **Actual** | |
| **Screenshot notes** | Tier 10 and tier 25 |
| **Console/log notes** | N/A |
| **Recommended fix** | |

#### MB-05 — Egg hatch modal

| | |
|---|---|
| **Steps** | 1. Hatch egg on mobile 2. Complete cinematic modal |
| **Expected** | Modal fits viewport; close/continue tappable; no off-screen content |
| **Actual** | |
| **Screenshot notes** | Modal at peak animation |
| **Console/log notes** | N/A |
| **Recommended fix** | |

---

## Tester role 5: Chaos Tester (CH)

**Persona:** Stresses timing, race conditions, invalid input, session edge cases.

### Role checklist

- [ ] Double-click spin / claim buttons
- [ ] Refresh during spin animation
- [ ] Logout mid Perk Machine spin
- [ ] Two tabs: spin in both
- [ ] Invalid login/password
- [ ] Expired JWT (clear token, call API)
- [ ] Rapid navigation between routes
- [ ] Check for duplicate rewards / balance drift

### Test cases

#### CH-01 — Double spin click

| | |
|---|---|
| **Steps** | 1. Rapid double-click paid spin 2. Check balance and history |
| **Expected** | Only one spin charged; one history entry |
| **Actual** | |
| **Screenshot notes** | Recent spins list |
| **Console/log notes** | Multiple spin responses? |
| **Recommended fix** | |

#### CH-02 — Refresh mid-spin

| | |
|---|---|
| **Steps** | 1. Start spin 2. Refresh during animation 3. Check balance |
| **Expected** | Server authoritative balance; no double charge or lost reward |
| **Actual** | |
| **Screenshot notes** | Balance after reload |
| **Console/log notes** | Spin id in history |
| **Recommended fix** | |

#### CH-03 — Logout during reward flow

| | |
|---|---|
| **Steps** | 1. Start hatch or claim 2. Logout in another tab or via menu mid-request |
| **Expected** | Graceful error or completion; no orphan UI state |
| **Actual** | |
| **Screenshot notes** | Error state |
| **Console/log notes** | 401 handling |
| **Recommended fix** | |

#### CH-04 — Two-tab simultaneous claim

| | |
|---|---|
| **Steps** | 1. Open Battle Pass tier claim in two tabs 2. Claim both at once |
| **Expected** | One succeeds; second shows already claimed |
| **Actual** | |
| **Screenshot notes** | Both tab outcomes |
| **Console/log notes** | Duplicate claim API response |
| **Recommended fix** | |

#### CH-05 — Invalid reset token

| | |
|---|---|
| **Steps** | 1. `/reset-password?token=invalid` 2. Submit new password |
| **Expected** | Safe error; no stack trace; token not accepted twice |
| **Actual** | |
| **Screenshot notes** | Error message |
| **Console/log notes** | `POST /api/auth/reset-password` 400 |
| **Recommended fix** | |

---

## Tester role 6: Security Tester (SC)

**Persona:** Validates auth boundaries, admin isolation, API safety, production hygiene.

### Role checklist

- [ ] Protected routes redirect unauthenticated users
- [ ] Normal user cannot see admin panels
- [ ] Admin API returns 403 without role
- [ ] Rate limits on auth endpoints (optional probe)
- [ ] OAuth debug hidden in production
- [ ] Error responses lack secrets / stack traces
- [ ] Reward endpoints require auth and validate ownership

### Test cases

#### SC-01 — Protected route gate

| | |
|---|---|
| **Steps** | 1. Logout 2. Visit `/profile`, `/perk-machine`, `/battle-pass`, `/settings` |
| **Expected** | Redirect to `/login` or auth prompt |
| **Actual** | |
| **Screenshot notes** | Redirect URL |
| **Console/log notes** | N/A |
| **Recommended fix** | |

#### SC-02 — Admin UI hidden

| | |
|---|---|
| **Steps** | 1. Login as free user 2. Visit `/admin`, `/owner-control`, `/dashboard/admin` |
| **Expected** | Blocked, redirect, or 404; no admin controls in Perk Machine/Battle Pass |
| **Actual** | |
| **Screenshot notes** | What user sees |
| **Console/log notes** | N/A |
| **Recommended fix** | |

#### SC-03 — Admin API without role

| | |
|---|---|
| **Steps** | 1. As normal user, `GET https://api.final10.app/api/perk-machine/admin/ping` with user JWT |
| **Expected** | 403 Forbidden |
| **Actual** | |
| **Screenshot notes** | Network response body (redacted) |
| **Console/log notes** | Status code only in report |
| **Recommended fix** | |

#### SC-04 — OAuth debug footer absent (production)

| | |
|---|---|
| **Steps** | 1. `/login` on live 2. Scroll to footer |
| **Expected** | No “Auth debug” block; no API/bundle debug lines |
| **Actual** | |
| **Screenshot notes** | Page bottom |
| **Console/log notes** | No `[Final10 auth debug]` in production console |
| **Recommended fix** | |

#### SC-05 — Auth providers endpoint (information disclosure)

| | |
|---|---|
| **Steps** | 1. `GET /api/auth/providers` unauthenticated |
| **Expected** | Only `{ google: bool, apple: bool }` — no secrets |
| **Actual** | |
| **Screenshot notes** | Response JSON |
| **Console/log notes** | N/A |
| **Recommended fix** | |

#### SC-06 — Forgot password enumeration

| | |
|---|---|
| **Steps** | 1. POST forgot-password with known vs unknown email |
| **Expected** | Identical response body and timing (within reason) |
| **Actual** | |
| **Screenshot notes** | Both responses |
| **Console/log notes** | Response messages |
| **Recommended fix** | |

---

## Nightly triage

| Severity | SLA (beta) | Owner |
|----------|------------|-------|
| Critical | Same night | On-call dev |
| High | ≤ 48h | Product + dev |
| Medium | Next sprint | Backlog |
| Low | Backlog | Optional |

---

## Agent assignment matrix (suggested)

| Night | Agent 1 | Agent 2 | Agent 3 |
|-------|---------|---------|---------|
| 1 | NU + SC | RW | MB |
| 2 | DH | CH | RW |
| 3 | NU (OAuth) | DH + alerts | CH + SC |

Rotate roles so the same path is hit by different agents weekly.

---

## Related docs

- [SOCIAL_AUTH_SETUP.md](./SOCIAL_AUTH_SETUP.md) — OAuth env for NU-03
- [BUG_REPORT_TEMPLATE.md](./BUG_REPORT_TEMPLATE.md)
- [docs/BETA_QA_CHECKLIST.md](./docs/BETA_QA_CHECKLIST.md)

**Stay Savvy. Stay Smart. The best deals from the start.**
