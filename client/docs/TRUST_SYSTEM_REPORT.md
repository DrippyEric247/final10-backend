# Final10 Seller Trust System — Validation Report

**Date:** 2026-06-29  
**Status:** Approved — 18/18 unit tests passing (`trustSystem.test.ts`)

---

## Architecture

Seller trust and deal risk are **separate engines**, merged only at display/ranking time:

| Module | Responsibility |
|--------|----------------|
| `sellerTrustEngine.ts` | Reputation score (feedback, volume, account age, Top Rated, store) |
| `dealRiskEngine.ts` | Listing/deal signals (price vs market, shipping, images, metadata) |
| `trustScoreEngine.ts` | Orchestrator — **`evaluateListingTrust(item)`** is the canonical API |
| `sellerTrustDisplay.ts` | UI formatters (band label, feedback %, count, account age, Top Rated) |

**Cross-surface rule:** Search, Trending, Best Move, Alerts, Watchlist, Product Feed, and Quick Snipes all call `evaluateTrustScore(trustScoreInputFromListing(item))`, which is identical to `evaluateListingTrust(item)` (verified in unit tests).

---

## Seller Trust Formula (0–100)

**Baseline:** 32 when any seller signal exists; 24 when none. **Floor:** 8. **Ceiling:** 100. Never defaults to 0.

### Additive signals

| Signal | Points |
|--------|--------|
| Named seller (not "unknown") | +4 |
| Account ≥ 5 years | +10 |
| Account ≥ 2 years | +7 |
| Account ≥ 1 year | +4 |
| Feedback > 99% | +10 |
| Feedback ≥ 98% | +7 |
| Feedback ≥ 95% | +3 |
| Feedback < 90% | −12 |
| Feedback count > 10,000 | +10 |
| Feedback count > 1,000 | +8 |
| Feedback count > 100 | +5 |
| Feedback count < 20 | −6 |
| Items sold > 50,000 | +10 |
| Items sold > 5,000 | +7 |
| Items sold > 500 | +4 |
| Response time ≤ 6 hrs | +5 |
| Top Rated Seller | +5 |
| Business / store account | +4 |
| Returns accepted | +3 |
| Repeat buyer rate ≥ 25% | +5 |
| Repeat buyer rate ≥ 15% | +2 |

### Guard rails (priority rules)

1. **Established profile:** feedback > 98%, volume > 1,000, account > 2 years → **min score 72**, never "unverified".
2. **Mega reputation:** feedback ≥ 99%, volume ≥ 5,000 → **min score 68** even without join date.
3. **New seller cap:** feedback count ≤ 10 (and not established/mega) → band forced to **New** (`low`).
4. **Named seller floor:** score ≥ 36 when seller name is present.

### Trust bands (display labels)

| Score | Internal band | UI label |
|-------|---------------|----------|
| 61–100 | elite | Elite |
| 41–60 | high | Trusted |
| 21–40 | medium | Established |
| 1–20 | low | New |
| unknown + no signals | medium | Established (neutral prior) |

### Legacy trust level (feeds / rewards)

Derived from seller score + guards — **not** from deal price:

- `high` ≥ 80 (or established/mega with score ≥ 55)
- `medium` ≥ 55 / established bands
- `low` ≥ 36
- `unverified` only when no seller identity and score < 30 (never for established/mega)

---

## UI Requirements — Verified

Every listing using `SavvyTrustPanel` displays via `SellerTrustStats`:

- Seller Trust Score (0–100)
- Trust Band (New / Established / Trusted / Elite)
- Feedback %
- Feedback count (formatted)
- Account age
- Top Rated badge (when `sellerTopRated` is true)

Missing fields render as `—` without throwing.

---

## Test Matrix Results

All tests in `client/src/lib/trustSystem.test.ts`:

| Scenario | Result |
|----------|--------|
| New seller (0–10 feedback) | Score ≥ 8, band `low`, label **New** |
| Small seller (10–100) | Score ≥ 21 |
| Established (100–1000) | Score ≥ 41 |
| High-volume (1000+) | Score ≥ 55, band high/elite |
| Top Rated | Score ≥ base (bonus applied) |
| Feedback 95% / 98% / 99% / 100% | All ≥ 8; ≥ 98% → score ≥ 40 |
| Mega eBay seller (99.8%, 63k reviews, 173k sold) | Elite, score ≥ 72, not unverified |
| Missing seller data | No throw, score ≥ 8, feedback `—` |
| Established / mega guards | Helper functions pass |
| Cheap price vs market | Deal flag only; seller stays elite |
| Cross-surface consistency | 3× `evaluateListingTrust` → identical scores |
| Manual pipeline equivalence | `evaluateListingTrust` === `evaluateTrustScore(trustScoreInputFromListing(...))` |
| Deal warning separate from seller band | Elite seller + under-market price → deal warning, not unverified |

**Command:** `CI=true npm test -- --watchAll=false --testPathPattern=trustSystem`  
**Outcome:** 18 passed, 0 failed

---

## Edge Cases

| Case | Behavior |
|------|----------|
| Nested eBay seller object | `trustScoreInputFromListing` extracts feedback %, score, registration date |
| String feedback % (`"99.8%"`) | Parsed correctly |
| Missing account age with mega volume | Mega guard still applies (min 68) |
| No seller name, no signals | Neutral score ~30, band Established (not 0) |
| ≤ 10 feedback with 100% rating | Band capped to New |
| Severe fraud (replica title + low deal score) | Legacy level forced to `low`, not unverified for established/mega |

---

## Remaining Risks

1. **Server normalizer dependency:** Client trust is only as good as seller fields mapped in `ebayListingNormalizer.js`. If eBay API shape changes, fields may go missing → neutral band, not zero.
2. **Pre-existing unrelated test failures:** `referrals.test.js` and `savvyRewards.test.js` fail in full suite (missing exports / `@savvy/core`); not trust-related.
3. **Production build:** Unrelated compile error (`getEventsHub` export from `../lib/api`) blocks full `npm run build` — trust modules compile in isolation via Jest/TS.
4. **Surfaces without SavvyTrustPanel:** Cards that only show a compact badge still use the same engine but may not render full `SellerTrustStats` grid until panel is opened.
5. **Subjective thresholds:** Band cutoffs (61/41/21) and guard minimums (72/68) may need tuning with production telemetry.

---

## Files in This Commit

- `client/src/lib/sellerTrustEngine.ts` — new-seller band cap
- `client/src/lib/trustScoreEngine.ts` — `sellerDisplay`, `evaluateListingTrust`
- `client/src/lib/sellerTrustDisplay.ts` — display formatters
- `client/src/lib/trustSystem.test.ts` — unit tests
- `client/src/types/trustScore.ts` — `SellerTrustDisplay` type
- `client/src/components/trust/SavvyTrustPanel.tsx` — stats panel wiring
- `client/src/components/trust/SellerTrustStats.tsx` — stats UI
- `client/src/styles/SellerTrustStats.css` — stats styles
- `client/docs/TRUST_SYSTEM_REPORT.md` — this report
