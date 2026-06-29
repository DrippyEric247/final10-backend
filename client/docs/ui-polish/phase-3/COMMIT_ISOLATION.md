# Phase 2/3 commit isolation notes

## Seller Dashboard + Leaderboard (`3304605e`)

On `main`, commit `3304605e` bundles **Leaderboard** and **Seller Dashboard** in one commit. File changes remain isolated:

| File | Screen |
|------|--------|
| `LeaderboardPage.js`, `LeaderboardPage.css` | Leaderboard only |
| `SellerDashboard.tsx`, `SellerDashboard.css` | Seller Dashboard only |

Rewriting published history would require a force-push; Phase 3+ work uses **one commit per logical feature** going forward.

## Phase 3 commit plan

One commit each for: WinFeed, Leaderboard, Seller Dashboard, Premium, Navigation, then docs.
