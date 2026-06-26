# @savvy/core

Savvy Universe shared core package. **Final10 remains the source of truth** for behavior until each module is wired via re-export shims.

## Phase 1 (current)

Leaf modules only — no React, no API client, no imports from `client/src`:

| Path | Source (Final10) |
|------|------------------|
| `src/events/universeEvents.js` | Consolidated `CustomEvent` string constants |
| `src/config/savvyRewards.js` | `client/src/config/savvyRewards.js` |
| `src/config/scoutBranding.js` | `client/src/config/savvyScoutBranding.js` |
| `src/tokens/theme.css` | `client/src/styles/theme.css` (tokens + base utilities) |

Final10 **does not import this package yet**. Zero visible app changes.

## Verify parity

From this directory:

```bash
npm run verify
```

Fails if package copies drift from `client/src` originals without updating both.

## Roadmap

See `SavvyTrip/SAVVY_CORE_EXTRACTION_PLAN.md` for Phases 2–9 (rewards, auth, wallet HUD, scout, etc.).
