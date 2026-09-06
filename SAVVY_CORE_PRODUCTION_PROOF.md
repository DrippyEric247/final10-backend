# Savvy Core Production Proof

> Template — run `npm run savvy-core:production-proof` with flags enabled to generate a live report.

## Deployment

| Field | Value |
|-------|-------|
| DEPLOYMENT SHA | _(set on run)_ |
| TEST USER | _(dedicated admin / internal test account)_ |
| APP ID | `savvytrip_test` |

## Required environment (proof environment only)

```bash
SAVVY_CORE_V1_ENABLED=true
SAVVY_CORE_PROOF_ENABLED=true
SAVVY_CORE_PROOF_USER_EMAIL=your-internal-test@example.com
# optional: SAVVY_CORE_APP_KEYS for HTTP trusted-app tests (not used by proof harness writes)
```

**Do NOT enable globally in production without intent.** Flags default OFF.

## Architecture verified

```
Browser (/dev/savvy-core-proof)
  → /api/savvy-core-proof/*  (admin auth, no app secret)
    → Savvy Core services (earnSavvy, awardAccountXP, etc.)
      → canonical User wallet + UserLevel + ContractProgress + CosmeticInventory
```

Final10 reads the same `User.savvyPoints` and `profileXpService` paths — no manual sync.

## Manual UI

1. Sign in as admin (or dev user in non-prod)
2. Open `/dev/savvy-core-proof`
3. Click **NEW PROOF SESSION** then run each proof action once
4. Verify PASS badges

## Automated

```bash
cd server
SAVVY_CORE_V1_ENABLED=true SAVVY_CORE_PROOF_ENABLED=true \
  SAVVY_CORE_PROOF_USER_EMAIL=... \
  npm run savvy-core:production-proof
```

## Results checklist

| Check | Result |
|-------|--------|
| READ PARITY | — |
| +50 SAVVY | — |
| FINAL10 BALANCE SYNC | — |
| IDEMPOTENCY | — |
| +25 XP | — |
| FINAL10 XP SYNC | — |
| CONTRACT | — |
| COSMETIC | — |
| LEDGER APP NAMESPACE | — |
| APP PERMISSIONS | — |
| BAD KEY | — |
| UNKNOWN APP | — |
| CLIENT TAMPER PROTECTION | — |
| FINAL10 REGRESSION | — |

## Data migration

**NONE** — proof uses additive ledger meta and existing collections.
