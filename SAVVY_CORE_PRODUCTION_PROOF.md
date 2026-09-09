# Savvy Core Production Proof

> Last verified: 2026-09-06

## Deployment verification

| Field | Value |
|-------|-------|
| **Git SHA (repo)** | `5cc3da2049b8bab93b4ec57535f8a8dedb1450c5` |
| **Railway deploy SHA** | `5cc3da2049b8bab93b4ec57535f8a8dedb1450c5` (via `GET https://api.final10.app/api/health`) |
| **Savvy Core version** | `1.0.0` |
| **Proof harness on deploy** | Present (`/api/savvy-core-proof/*` returns gated response) |

Code is deployed. **Environment flags are not enabled on production.**

## Production flag status (api.final10.app)

| Flag | Production | Required for proof |
|------|------------|-------------------|
| `SAVVY_CORE_V1_ENABLED` | **false** | **true** |
| `SAVVY_CORE_EXTERNAL_APP_WRITES_ENABLED` | **false** | optional (proof harness calls services in-process) |
| `SAVVY_CORE_PROOF_ENABLED` | **false** | **true** |

Public config source: `GET https://api.final10.app/api/config/public`

## Enable on Railway (production API service)

1. Open [Railway](https://railway.app) → **final10-backend** (API service)
2. **Variables** tab → add or set:

```bash
SAVVY_CORE_V1_ENABLED=true
SAVVY_CORE_PROOF_ENABLED=true
SAVVY_CORE_PROOF_USER_EMAIL=<dedicated-internal-test@yourdomain.com>
```

3. Optional (HTTP trusted-app write tests only — not required for `/dev/savvy-core-proof`):

```bash
SAVVY_CORE_EXTERNAL_APP_WRITES_ENABLED=true
SAVVY_CORE_APP_KEYS={"savvytrip_test":"<server-side-secret>"}
```

4. **Redeploy** the API service (Railway restarts on variable change)

5. Verify:

```bash
curl https://api.final10.app/api/config/public
# savvyCoreEnabled: true, savvyCoreProofEnabled: true

curl https://api.final10.app/api/savvy-core/health
# enabled: true
```

6. Sign in as admin → `https://www.final10.app/dev/savvy-core-proof` → **NEW PROOF SESSION** → run once

Or CLI against production Mongo (same Railway DB):

```bash
cd server
SAVVY_CORE_V1_ENABLED=true SAVVY_CORE_PROOF_ENABLED=true \
  SAVVY_CORE_PROOF_USER_EMAIL=<test-account> \
  npm run savvy-core:production-proof
```

**Use a dedicated internal test account only. Do not re-run against real users.**

## App ID: savvytrip_test

Registered on deploy. Write permissions (V1 model):

| Capability | savvytrip_test |
|------------|----------------|
| wallet.earn | yes |
| wallet.spend | **no** |
| xp.award | yes |
| contracts.progress | yes |
| cosmetics.unlock | yes |
| rewards.grant | yes |
| events.emit | yes |

Reads (`/api/savvy-core/me`, `/wallet`, `/progression`) use **user session auth**, not separate `wallet.read` / `progression.read` flags (not in V1 permission enum).

## Local harness proof (2026-09-06)

Run against **local MongoDB** + user `admin@final10.com` (`68e6e6f64bfa3ea741711353`):

| Check | Result |
|-------|--------|
| READ PARITY | PASS |
| +50 SAVVY | PASS |
| FINAL10 BALANCE SYNC | PASS |
| IDEMPOTENCY | PASS |
| +25 XP | PASS |
| FINAL10 XP SYNC | PASS |
| CONTRACT | PASS |
| COSMETIC | PASS |
| LEDGER | PASS |
| SECURITY NEGATIVES | PASS |
| FINAL PARITY | PASS |

## Automated regression (2026-09-06)

36/36 tests PASS — Savvy Core, Perk Machine, Savvy Watch, Savvy Predictions, Contracts.

## Final verdict

**BLOCKED — Railway production flags not enabled**

Once `SAVVY_CORE_V1_ENABLED` and `SAVVY_CORE_PROOF_ENABLED` are set on the API service and proof is run once with a dedicated test account, verdict becomes:

**PRODUCTION PROVEN — READY FOR REAL APP #2**
