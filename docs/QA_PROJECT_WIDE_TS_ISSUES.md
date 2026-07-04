# Project-Wide TypeScript Issues (QA Log)

> **Scope:** Out of band for Phase 1 bug fixes (BUG-001, BUG-002, …).  
> Do not block Phase 1 QA verification on these unless they reappear after a clean restart.

---

## Status (2026-06-29 — clean dev restart)

| Check | Result |
|-------|--------|
| `npm run client` | **Compiled successfully** — typecheck: **No issues found** |
| `npm run build` (client) | **Compiled successfully** |
| BUG-001 (`savvyRewards` / `DAILY_LOGIN_BASE_SAVVY`) | **Not present** — no compile overlay |

The development environment is **stable** for continued Phase 1 QA.

---

## Historical issues (initial Phase 1 QA session)

Observed when the frontend dev server crashed mid-recompile. These were **unrelated to BUG-001** (savvyRewards re-export). Likely addressed by subsequent commits on `main` (e.g. `78d9c602` exclude test files from prod TS compile, `80f2bd35` shared state TS fixes).

| Area | Symptom | Files (indicative) |
|------|---------|-------------------|
| Trust / seller display | Missing `buildSellerTrustDisplay`, `expect` in test scope | `trustScoreEngine.ts`, `trustSystem.test.ts`, `SellerTrustStats.tsx` |
| Shared UI state components | Prop mismatches (`error`, `icon`, `action` required) | `BattlePassPage.tsx`, `CreatorLanding.tsx`, `SellerDashboard.tsx` |
| Leaderboard | JSX parse error (unclosed fragment) | `LeaderboardPage.js` |

**Severity if they recur:** Medium (dev HMR instability, possible production build failure).

**Recommended owner track:** Separate “TypeScript hygiene / trust UI” sprint — not mixed into Phase 1 economy/auth QA commits.

---

## How to re-check

```bash
cd client
npm run dev          # expect: Compiled successfully + No issues found
npm run build        # expect: Compiled successfully
npm test -- --watchAll=false --testPathPattern=savvyRewards.test.js
```

---

## Phase 1 isolation rule

- One commit per verified bug fix.
- Do not bundle trust/leaderboard/seller-dashboard TS fixes into BUG-001/BUG-002 commits.
- Re-open this log if `npm run build` fails again and append a dated section with fresh `ERROR` lines.
