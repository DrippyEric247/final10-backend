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

---

## Phase 2 Migration Summary

**Date:** 2026-06-26  
**Scope:** Final10 client re-export shims + `@savvy/core` package exports  
**SavvyTrip changes:** None  

### What changed

| File | Change |
|------|--------|
| `client/package.json` | Added `"@savvy/core": "file:../packages/savvy-core"` |
| `client/package-lock.json` | Lockfile updated (`npm install --legacy-peer-deps`) |
| `client/src/config/savvyRewards.js` | One-line shim: `export * from '@savvy/core/config/savvyRewards';` |
| `client/src/config/savvyRewards.d.ts` | Type shim (TS build only; no runtime change) |
| `package.json` (root) | Added `"verify:savvy-core"` script |
| `packages/savvy-core/package.json` | Subpath `exports` + types for `config/savvyRewards` |
| `packages/savvy-core/src/config/savvyRewards.d.ts` | Type declarations for package subpath |
| `packages/savvy-core/scripts/verify-parity.js` | Recognizes client re-export shims |

### What did not change

- No UI, routes, or runtime behavior
- `savvyScoutBranding.js` still local (shim deferred)
- Event constant files in `client/src/lib/` unchanged (optional Phase 2 item skipped)
- SavvyTrip untouched

### Verification

1. `npm run verify` in `packages/savvy-core` — pass  
2. `npm run verify:savvy-core` from repo root — pass  
3. `npm run build` in `client` — pass (bundle size unchanged)

### Phase 3 preview (awaiting approval)

- Shim `client/src/config/savvyScoutBranding.js` → `@savvy/core/config/scoutBranding`
- Optional event constant shims in `client/src/lib/`
- Begin rewards/auth extraction into `@savvy/core`

**Do not start Phase 3 until approved.**
