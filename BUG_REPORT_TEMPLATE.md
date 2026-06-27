# Final10 Beta Bug Report

> Copy this template for each issue. Do **not** mark PASS without live verification on [https://www.final10.app](https://www.final10.app) (or note the exact URL tested).

---

## Report metadata

| Field | Value |
|-------|--------|
| **Bug ID** | `BUG-YYYY-MM-DD-###` (e.g. `BUG-2026-06-26-001`) |
| **Reporter / Agent role** | New User / Deal Hunter / Rewards / Mobile / Chaos / Security |
| **Date (UTC)** | |
| **Environment** | Production live / Staging / Local |
| **Live URL tested** | Must start with `https://www.final10.app` or `https://api.final10.app` |
| **Browser / device** | e.g. Chrome 138 desktop, Safari iOS 17, iPhone 14 viewport |
| **Account type** | Guest / Free / Premium / Admin test account |
| **Build fingerprint** | JS bundle from Network tab (e.g. `main.xxxxx.js`) or Railway deploy ID |

---

## Summary

**One-line title:**

---

## Severity

- [ ] **Critical** — Data loss, wrong balances, auth bypass, payment/security breach, app unusable
- [ ] **High** — Core flow broken (signup, spin, claim, search, alerts); no workaround
- [ ] **Medium** — Feature degraded; workaround exists
- [ ] **Low** — Cosmetic, copy, minor UX

---

## Test case reference

| Field | Value |
|-------|--------|
| **Tester role** | |
| **Test ID** | From `QA_BETA_TEST_PLAN.md` (e.g. `NU-03`, `RW-07`) |
| **Steps to reproduce** | Numbered list |

1.
2.
3.

---

## Expected result

What should happen according to the test plan or product intent.

---

## Actual result

What happened on the **live** site. Be specific (numbers, error text, URLs).

---

## Evidence

### Screenshots / screen recording

| # | Description | File or link |
|---|-------------|--------------|
| 1 | | |

### Console (browser DevTools)

```
Paste relevant console errors/warnings (redact tokens)
```

### Network (DevTools)

| Request | Method | Status | Notes |
|---------|--------|--------|-------|
| e.g. `/api/perk-machine/spin` | POST | 400 | |

### Server / Railway logs (if available)

```
Paste relevant log lines (no secrets)
```

---

## Impact

Who is affected and how (e.g. “All users see wrong Savvy after paid spin”).

---

## Recommended fix

Suggested area (file/route/component if known). Do not implement unless assigned.

---

## Regression check

After fix, re-run these test IDs:

- [ ]

---

## Status

- [ ] Open
- [ ] Confirmed
- [ ] In progress
- [ ] Fixed
- [ ] Verified on live
- [ ] Won't fix (explain)
