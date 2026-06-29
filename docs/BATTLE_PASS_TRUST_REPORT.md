# Battle Pass Trust Report — Phase 2 Item 2

**Date:** 2026-06-26  
**Branch:** `phase-2-battle-pass-trust` (post-merge of referral integrity on `main`)  
**Scope:** Server-side validation of Battle Pass progression; block client-forged events; verify Savvy/XP/rank/reward integrity.

---

## Summary

Battle Pass progression for high-trust event types is now **server-authoritative in production**. Clients can only POST auction/deal scan events (still gated by scan-deck and bid tokens). Savvy earned, streak/login, rank changes, and power multiplier updates are emitted exclusively from verified server hooks after canonical economy/streak mutations.

---

## Protections Implemented

| Area | Mechanism |
|------|-----------|
| **Client event boundary** | `CLIENT_ALLOWED_EVENT_TYPES` vs `SERVER_ONLY_EVENT_TYPES` in `server/config/battlePassTrust.js` |
| **HTTP rejection** | `assertClientOriginEventAllowed()` returns `403 TRUST_SERVER_EVENT_ONLY` in production for forged types |
| **Joi schema gate** | `server/validation/schemas.js` — progression POST body only accepts client-safe types |
| **Trusted server pipeline** | `progressionServerEventsService.js` emits events with deterministic IDs via `processBattlePassEvent({ trustedServerOrigin: true })` |
| **Savvy → BP hook** | `creditSavvy` schedules `onSavvyCreditedForBattlePass` (actual credited amount + source from ledger) |
| **Streak → BP hook** | `claimDailyStreak` emits `daily_login_claimed` + `streak_updated` after atomic claim |
| **Power multiplier** | After BP event processing mutates `user.powerMultiplier`, server emits `power_multiplier_changed` |
| **Rank tracking** | `BattlePassProgress.seasonRankAnchor` + `lastKnownLeaderboardRank`; rank recomputed on Savvy credit |
| **Tier/mission claims** | Unchanged from Phase 1 — atomic `$addToSet` claims + Savvy via `grantSavvyReward` / ledger |
| **Auction events** | Existing scan-deck + bid/win token trust unchanged |

---

## Files Changed

| File | Change |
|------|--------|
| `server/config/battlePassTrust.js` | Client vs server event type boundaries |
| `server/services/progressionTrustService.js` | `assertClientOriginEventAllowed()` |
| `server/services/progressionServerEventsService.js` | Trusted event emitter + rank/Savvy hooks |
| `server/services/battlePassPersistenceService.js` | Client denial, server-origin normalize, power mult emit |
| `server/services/savvyBalanceService.js` | Post-credit BP progression hook |
| `server/services/dailyStreakService.js` | Post-claim BP progression hook |
| `server/models/BattlePassProgress.js` | Rank anchor fields |
| `server/validation/schemas.js` | Restrict HTTP-accepted event types |
| `server/__tests__/battle-pass-trust.test.js` | Integrity test suite |
| `server/package.json` | `test:battle-pass-trust` script |

---

## Validation / Tests

```bash
cd server
MONGODB_URI=mongodb://127.0.0.1:27017/final10_bp_trust_test npm run test:battle-pass-trust
MONGODB_URI=mongodb://127.0.0.1:27017/final10_test npm run test:economy
MONGODB_URI=mongodb://127.0.0.1:27017/final10_ref_test npm run test:referral
```

| Suite | Result |
|-------|--------|
| Battle Pass trust | 6/6 PASS |
| Economy regression | 8/8 PASS |
| Referral regression | 5/5 PASS |

---

## Remaining Risks & Limitations

| Risk | Severity | Notes |
|------|----------|-------|
| **Dev/staging bypass** | Medium | `NODE_ENV !== production` or `ALLOW_PROGRESSION_TRUST_BYPASS=true` disables client-origin denial (intentional for local dev; blocked at prod boot) |
| **Client optimistic UI** | Medium | Client may still advance tasks locally until `/progression/me` sync; server state is authoritative |
| **`power_boost_claimed` not hooked** | Low | Mission `nh_daily_power_charge` also accepts `daily_login_claimed` — covered by streak hook; standalone power boost remains client-only and is rejected |
| **Rank proxy uses Savvy balance** | Medium | Rank climb uses `savvyPoints` count ranking, not a dedicated competitive leaderboard API; ties and bulk test users can skew ranks |
| **No rank emit without Savvy change** | Low | Rank improvements that don't involve Savvy credits won't emit `rank_changed` |
| **Auction scan forgery (dev)** | Medium | In non-production, scan-deck trust is optional; production requires recent search deck |
| **Rate limit (120/min)** | Low | Still sufficient to grind scan/bid missions legitimately; not a Savvy exploit after this change |
| **BP mission Savvy → momentum loop** | Low | Mission payouts credit Savvy which counts toward weekly momentum — by design; bounded by mission completion |
| **Tier XP grants** | Low | Manual tier claims and mission XP remain server-side; client cannot forge tier unlock |

---

## Beta Readiness (Battle Pass slice)

**Score: 78/100** (up from 72 post-Phase 1, +6 for BP trust)

Production deployment requires `NODE_ENV=production` and all dev bypass flags unset (enforced by `envValidation.js`).

---

*Stop point: Phase 2 Item 2 complete — awaiting review before Item 3.*
