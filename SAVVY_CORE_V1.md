# Savvy Core V1

Savvy Core V1 is the minimum reusable progression layer for the Savvy Universe. It lets a second Savvy app plug into the existing ecosystem without importing Final10-specific business logic or mutating Final10 models directly.

## Architecture

**Modular monolith / shared core** — one backend, clean service boundaries:

```
packages/savvy-core/          # Shared types, registry, permissions (ESM)
server/config/savvyCore*.js   # CJS runtime mirrors for Node server
server/services/savvyCore/    # Wallet, XP, rewards, contracts, cosmetics
server/routes/savvyCoreRoutes.js
client/src/lib/savvyCore.js   # Read SDK for App #2 clients
```

Final10 keeps deal discovery, auctions, Best Move, Quick Snipes, Scout Flight, deal streaks, and Final10-specific UI. App #2 calls Savvy Core APIs instead.

## Feature flags

| Flag | Default | Purpose |
|------|---------|---------|
| `SAVVY_CORE_V1_ENABLED` | `false` | Enables `/api/savvy-core/*` read endpoints |
| `SAVVY_CORE_EXTERNAL_APP_WRITES_ENABLED` | `false` | Enables trusted-app write endpoints |
| `SAVVY_CORE_APP_KEYS` | `{}` JSON | `{ "savvytrip_test": "secret-key", ... }` |

Recommended rollout:

1. Enable reads first (`SAVVY_CORE_V1_ENABLED=true`)
2. Verify App #2 can read wallet/progression
3. Enable writes with app keys when integration tests pass

## App registry

Canonical app IDs live in `@savvy/core/core/appRegistry` and `server/config/savvyCoreAppRegistryData.js`:

- `final10`, `savvytrip`, `ezstay`, `bitesavvy`, `savvyshop`, `gamesavvy`, `savvywatch`, `savvysports`
- Test apps: `savvytrip_test`, `gamesavvy_test`

Use `validateAppId(appId)` — do not scatter string literals.

## Permissions

Each app has explicit capabilities via `assertAppPermission(appId, permission)`:

| Permission | Description |
|------------|-------------|
| `wallet.earn` | Credit Savvy |
| `wallet.spend` | Debit Savvy (Final10 only in V1) |
| `xp.award` | Award account XP |
| `contracts.progress` | Fire app-scoped contract triggers |
| `cosmetics.unlock` | Unlock calling cards / emblems / camos |
| `rewards.grant` | Unified reward dispatcher |
| `events.emit` | Record event envelope |

Example: `savvytrip` can earn Savvy and award XP but cannot spend user Savvy.

## API endpoints

Base path: `/api/savvy-core`

### Read (authenticated user)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Readiness (no auth) |
| GET | `/me` | Slim cross-app profile |
| GET | `/wallet` | Savvy balance |
| GET | `/progression` | Level, prestige, XP |

### Write (trusted app — requires headers)

Headers: `X-Savvy-App-Id`, `X-Savvy-App-Key`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/rewards/grant` | Unified reward grant |
| POST | `/wallet/earn` | Earn Savvy |
| POST | `/xp/award` | Award account XP |
| POST | `/contracts/progress` | Progress app contracts |
| POST | `/cosmetics/unlock` | Unlock cosmetic |
| POST | `/events/emit` | Record event envelope |

### Admin integration tests

| Method | Path | Description |
|--------|------|-------------|
| POST | `/internal/test/savvytrip` | Full App #2 flow |
| POST | `/internal/test/gamesavvy` | GameSavvy mock flow |

## Wallet API

Server-authoritative. Wraps production `grantSavvyReward` / `spendSavvyReward`.

```js
await earnSavvy({
  userId,
  amount: 50,
  sourceApp: 'savvytrip_test',
  reason: 'booking_complete',
  idempotencyKey: 'savvytrip:wallet:user123:booking:ref-1',
  activityType: 'TRIP_BOOKED',
  metadata: { bookingRef: '123' },
});
```

Ledger metadata (additive, no migration):

- `meta.sourceApp`, `meta.originApp`, `meta.activityType`, `meta.rewardSource`
- `SavvyTransaction.idempotencyKey`

Legacy records may have `sourceApp = null`; new writes always include app namespace.

## Reward API

```js
await grantReward({
  userId,
  appId: 'savvytrip_test',
  rewardType: 'SAVVY', // SAVVY | ACCOUNT_XP | CALLING_CARD | EMBLEM | CAMO
  amount: 50,
  rewardId: 'card_savvy_core', // for cosmetics
  source: 'booking_complete',
  idempotencyKey: '...',
});
```

V1 deferred: `TICKET`, `PERK`, `APP_UNLOCK` (returns 501).

## XP / Level / Prestige API

```js
await awardAccountXP({
  userId,
  amount: 25,
  sourceApp: 'savvytrip_test',
  activityType: 'TRIP_BOOKED',
  idempotencyKey: '...',
});

const progression = await getAccountProgression({ userId });
// { accountLevel, prestige, currentXP, xpToNext, rankName, ... }
```

Levels are server-authoritative via `profileXpService`.

## Contracts API

Framework is global; objectives are app-owned.

```js
await progressAppContracts({
  userId,
  sourceApp: 'savvytrip_test',
  trigger: 'trip_booked',
  increment: 1,
});
```

Register contracts in `server/config/contracts.js` with `appId` — App #2 does not modify Final10 contract files.

## Cosmetic unlock API

```js
await unlockCosmetic({
  userId,
  cosmeticId: 'card_savvy_core',
  sourceApp: 'savvytrip_test',
  sourceType: 'trip_booking',
  scopeType: 'app',
  scopeId: 'savvytrip_test',
  globalEquipEligible: true,
  idempotencyKey: '...',
});
```

## Idempotency

Standard key format:

```
{appId}:{domain}:{userId}:{action}:{uniqueId}
```

Example: `savvytrip:booking:12345:reward`

Retries with the same key must not duplicate Savvy, XP, cosmetics, or contract side-effects.

## Scope model

| Scope | Examples |
|-------|----------|
| **Global** | Savvy balance, account XP, prestige, universal cosmetics |
| **App** | Deal streak, Scout Flight score, app-local contracts |
| **Feature** | Scoped perks/eggs |

Perk scope helpers: `@savvy/core/core/perkScope` — prevents App #2 from inheriting Final10-only egg behavior.

## Multiplier policy

Centralized in `server/config/savvyRewardPolicy.js` via `isMultiplierEligible()`. Savvy Core earn/spend uses `FIXED` policy — not multiplied.

## Client SDK

```js
import savvyCore from './lib/savvyCore';

const me = await savvyCore.getMe();
const wallet = await savvyCore.getWallet();
const progression = await savvyCore.getProgression();
```

## How to connect a new Savvy app

1. Register `appId` in `@savvy/core/core/appRegistry.js` and server mirror
2. Assign permissions in `@savvy/core/core/permissions.js`
3. Connect existing Savvy auth (same user identity)
4. Enable `SAVVY_CORE_V1_ENABLED` and read wallet/progression
5. Add app-specific contracts with `appId`
6. Configure `SAVVY_CORE_APP_KEYS` for your app
7. Enable `SAVVY_CORE_EXTERNAL_APP_WRITES_ENABLED`
8. Call approved reward APIs with idempotency keys
9. Run integration test flow; verify retry does not duplicate

## Final10 adapter

Thin wrapper at `server/services/savvyCore/final10Adapter.js`:

- `final10GrantSavvyReward` → `grantReward`
- `final10GrantAccountXp` → `grantReward`
- `final10ProgressContract` → `progressAppContracts`

Existing Final10 paths continue working; migrate incrementally.

## Observability

Structured logs:

- `[CORE_WALLET_EARN]`, `[CORE_WALLET_SPEND]`
- `[CORE_XP_AWARD]`, `[CORE_REWARD_GRANT]`
- `[CORE_CONTRACT_PROGRESS]`, `[CORE_COSMETIC_UNLOCK]`
- `[SAVVY_CORE_HANDLER_CHECK]`

Audit records: `SavvyCoreAudit` collection.

## Parity verification

```bash
cd packages/savvy-core && npm run verify
```

Confirms registry/permissions sync and existing Phase 1 parity.

## Data migration

**None required for V1.** All changes are additive (meta fields, new collection, new routes).

## What V1 does NOT include

- Microservices / Kafka
- Separate identity service
- Public third-party developer platform
- Production balance migration
- Full Final10 path migration (adapter only)
