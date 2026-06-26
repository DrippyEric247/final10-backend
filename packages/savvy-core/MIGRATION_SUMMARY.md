# Phase 1 Migration Summary — @savvy/core

**Date:** 2026-06-26  
**Scope:** `final10/packages/savvy-core/` only  
**Final10 client changes:** None  
**SavvyTrip changes:** None  

---

## What was added

| File | Purpose |
|------|---------|
| `package.json` | `@savvy/core` v0.1.0, `npm run verify` |
| `README.md` | Package overview and roadmap pointer |
| `src/index.js` | Phase 1 barrel export |
| `src/events/universeEvents.js` | 12 cross-app `CustomEvent` string constants + `UNIVERSE_EVENTS` map |
| `src/config/savvyRewards.js` | Copy of `client/src/config/savvyRewards.js` |
| `src/config/scoutBranding.js` | Copy of `client/src/config/savvyScoutBranding.js` |
| `src/tokens/theme.css` | CSS variables + `.card`, `.btn`, `.chip`, `.input`, `.glow`, `.text-gradient` |
| `scripts/verify-parity.js` | Drift detection vs `client/src` originals |

---

## What was not changed

- No `client/src/**` imports or file edits
- No `client/package.json` dependency on `@savvy/core`
- No UI, routes, folders, or runtime behavior
- No SavvyTrip repository changes
- No root `final10/package.json` script (verify runs inside package: `npm run verify`)

---

## Verification performed

1. `npm run verify` in `packages/savvy-core` — all parity checks pass
2. `npm run build` in `final10/client` — production build succeeds (unchanged client)

---

## Event registry (Phase 1)

| Constant | Value |
|----------|-------|
| `WALLET_AWARD_EVENT` | `f10:savvy-wallet-award` |
| `REWARD_EVENT` | `f10-reward-event` |
| `SAVVY_AUTH_REFRESH_REQUEST` | `f10:savvy-auth-refresh-request` |
| `SAVVY_STORE_UPDATED` | `f10:savvy-store-updated` |
| `CALLING_CARD_UNLOCK_EVENT` | `f10:calling-card-unlock` |
| `SAVVY_ALERT_EVENT` | `f10-savvy-alert-created` |
| `SCOUT_MISSION_SYNC_EVENT` | `f10:scout-mission-sync` |
| `SCOUT_MISSION_POPUP_EVENT` | `f10:scout-mission-popup` |
| `SCOUT_MISSION_ACTION_EVENT` | `f10:scout-mission-action` |
| `BP_UPDATE_EVENT` | `f10-battlepass-update` |
| `BP_TIER_COMPLETE_EVENT` | `f10-battlepass-tier-complete` |
| `BATTLE_PASS_ACTION_EVENT` | `f10:battle-pass-action` |

---

## Phase 2 preview (awaiting approval)

1. Add `"@savvy/core": "file:../packages/savvy-core"` to `client/package.json`
2. Replace `client/src/config/savvyRewards.js` with one-line re-export from `@savvy/core`
3. Optionally re-export `universeEvents` from thin shims in `client/src/lib/`
4. Add `verify:savvy-core` to Final10 root `package.json` for CI

**Do not start Phase 2 until approved.**
