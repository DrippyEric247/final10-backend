# Referral Integrity Report — Phase 2 Item 1

**Date:** 2026-06-29 · **Tests:** `npm run test:referral` — **5/5 PASS**  
**Regression:** `npm run test:economy` — **8/8 PASS**

---

## Summary

Referral rewards now flow through a **single authoritative pipeline** (`referralService.js`) with fraud checks, duplicate prevention, Savvy wallet grants via Phase 1 `creditSavvy`, and dual audit logging (`ReferralLog` + `REFERRAL_*` security audit events).

---

## What Was Fixed

| Issue (pre-Phase 2) | Fix |
|---------------------|-----|
| `referralFraudCheck` called with wrong args | Correct object signature + `getClientIp` / `getClientUa` |
| `ReferralLog.create` used wrong field names | Uses `referrerId` + `refereedId` (schema-aligned) |
| Daily cap never enforced (logs failed silently) | Logs write correctly; cap query works |
| Unauthenticated `/process-referral` with arbitrary `userId` | **Auth required**; uses `req.user.id` only |
| Dual pipelines (signup + process-referral) double-award | Unified service; idempotency + unique index |
| Rewards to legacy `points` only | **Savvy wallet** via `creditSavvy` + `SavvyTransaction` |
| No duplicate protection per referee | Partial unique index: one `accepted` log per `refereedId` |

---

## Reward Configuration

| Party | Env var | Default |
|-------|---------|---------|
| Referrer (inviter) | `REFERRAL_SAVVY_REFERRER` or `REFERRAL_POINTS` | 250 Savvy |
| Referee (invited) | `REFERRAL_SAVVY_REFEREE` | 50 Savvy |
| Daily cap per referrer | `REFERRAL_DAILY_CAP` | 10 |

Idempotency keys (lifetime per pair):
- Referrer: `referral:referrer:{referrerId}:{refereeId}`
- Referee: `referral:referee:{refereeId}`

---

## Verification Results

| Test | Result |
|------|--------|
| Both parties receive Savvy + SavvyTransaction rows | ✅ |
| Duplicate retry returns without double grant | ✅ |
| `processReferralByCode` retry idempotent | ✅ |
| 3 concurrent claims → 1 grant, 1 accepted log | ✅ |
| Self-referral skipped | ✅ |
| Economy integrity regression | ✅ 8/8 |

---

## Audit Trail

Each referral attempt produces:
1. **`ReferralLog`** — status `accepted` | `blocked` | `capped` with IP/UA/reason
2. **`SavvyTransaction`** — balance before/after for each Savvy grant
3. **Security audit** — `REFERRAL_REWARD_GRANTED`, `REFERRAL_BLOCKED`, `REFERRAL_CAPPED`, `REFERRAL_DUPLICATE_SKIPPED`

---

## Entry Points (post-fix)

| Route | Auth | Behavior |
|-------|------|----------|
| `POST /api/auth/signup` | No | Calls `processReferralOnSignup` after user create |
| `POST /api/users/process-referral` | **Yes** | Catch-up for signed-in user; idempotent |

---

## Remaining Referral Risks (low)

| Risk | Severity | Notes |
|------|----------|-------|
| Social OAuth signup ignores referral codes | Medium | Phase 2+ — wire referral code from client state |
| `'welcome'` code still grants legacy signup perks | Low | Intentional marketing path; not user-referrer |
| IP/UA fraud rules bypassable via VPN | Low | Expected; caps limit blast radius |

---

## Files Changed

- `server/config/referralRewards.js` — reward amounts
- `server/services/referralService.js` — canonical pipeline
- `server/services/referralGuard.js` — fraud + logging fix
- `server/models/ReferralLog.js` — unique index per accepted referee
- `server/routes/auth.js` — signup integration
- `server/routes/users.js` — auth-locked catch-up endpoint
- `server/models/User.js` — `processReferralSignup` delegates to service
- `server/__tests__/referral-integrity.test.js` — verification suite

---

**Status:** Phase 2 Item 1 complete. **Awaiting approval before Battle Pass trust (Item 2).**
