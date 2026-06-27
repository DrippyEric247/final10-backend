# Final10 Beta QA Checklist

Quick reference for nightly beta sweeps. Full details: [QA_BETA_TEST_PLAN.md](../QA_BETA_TEST_PLAN.md).

**Live site only:** [https://www.final10.app](https://www.final10.app)  
**API:** [https://api.final10.app](https://api.final10.app)

Mark each item **PASS / FAIL / NOT TESTED** — never assume PASS without live verification.

---

## Pre-flight (every session)

- [ ] Hard refresh or incognito window
- [ ] Confirm JS bundle / deploy is current (not stale cache)
- [ ] Note floating Savvy HUD value at session start
- [ ] DevTools console open (preserve log)
- [ ] Mobile: iPhone 14 / 390×844 emulation or real device

---

## New User (NU)

- [ ] Register with email
- [ ] Login / logout
- [ ] Forgot password → email → reset (if email configured)
- [ ] Google sign-in (if `/api/auth/providers` → `google: true`)
- [ ] Onboarding preferences complete
- [ ] Savvy / Perk Machine / Eggs / Battle Pass / Alerts explained somewhere discoverable

---

## Deal Hunter (DH)

- [ ] Search / feed / auctions load
- [ ] Best Move (onboarding or dashboard) returns real listings
- [ ] Deal cards: image, price, trust, external link, CTA work
- [ ] Create alert → appears in `/alerts`

---

## Rewards (RW)

- [ ] Daily streak claim (`/daily-streak`)
- [ ] Perk Machine spin — cost / reward / net summary clear
- [ ] Savvy HUD matches balance card after spin & hatch
- [ ] Egg hatch updates wallet server-side
- [ ] Inventory token activation (if tokens owned)
- [ ] Battle Pass tier claim (manual claim, no duplicate)

---

## Mobile (MB)

- [ ] Bottom nav tappable; not covered by HUD
- [ ] Perk Machine + modals scroll on 390px width
- [ ] Login / signup / forgot password usable one-handed
- [ ] No horizontal overflow on Dashboard, Profile, Battle Pass

---

## Chaos (CH)

- [ ] Double-click spin / claim — no duplicate rewards
- [ ] Refresh mid-spin — balance still correct after reload
- [ ] Logout mid-flow — protected routes redirect to login
- [ ] Invalid form inputs show safe errors

---

## Security (SC)

- [ ] `/admin`, `/owner-control`, perk-machine admin hidden for normal user
- [ ] Unauthenticated `/api/auth/me` → 401
- [ ] Admin API without role → 403
- [ ] No OAuth debug footer on production login
- [ ] API errors do not expose stack traces or secrets

---

## Sign-off

| Date | Agent / human | Critical open | High open | Notes |
|------|---------------|---------------|-----------|-------|
| | | | | |

File bugs using [BUG_REPORT_TEMPLATE.md](../BUG_REPORT_TEMPLATE.md).
