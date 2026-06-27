# Egg Exchange Chamber — QA Checklist

Test on **https://www.final10.app** after deploy. Page: `/egg-exchange`

## Exchange rules (server-authoritative)

| Type | Cost | Reward |
|------|------|--------|
| `rare_to_epic` | 25 Rare + 2,500 Savvy | 1 Epic |
| `epic_to_legendary` | 25 Epic + 8,000 Savvy | 1 Legendary |
| `legendary_to_mythic` | 10 Legendary + 20,000 Savvy | 1 Mythic |

## Manual tests

| # | Test | Expected |
|---|------|----------|
| 1 | Admin preset Rare→Epic, exchange | Epic +1, Rare −25, Savvy −2500 |
| 2 | 24 Rare eggs, exchange | Disabled / INSUFFICIENT_EGGS |
| 3 | 25 Rare, 1000 Savvy, exchange | Disabled / INSUFFICIENT_SAVVY |
| 4 | Double-click Exchange rapidly | One fusion only; 429 on second |
| 5 | After exchange | Savvy HUD + balance card match |
| 6 | After exchange | Egg inventory on Perk Machine updates |
| 7 | Exchange history | New row with eggs/Savvy spent |
| 8 | Legendary→Mythic with 10 + 20k | Mythic +1 |
| 9 | Hatchery still hatches eggs | Unchanged behavior |
| 10 | Perk Machine spin | Unchanged odds/costs |
| 11 | Events Hub | Mythic Fusion Progress card links to `/egg-exchange` |
| 12 | Hatchery link | Opens Egg Exchange Chamber |

## Admin tools (`/egg-exchange`, admin only)

- +25 Rare / +25 Epic / +10 Legendary eggs
- +20,000 Savvy
- Reset exchange inventory
- Preset test flows for each tier

## API

- `GET /api/eggs/exchange/status`
- `POST /api/eggs/exchange` body `{ "exchangeType": "rare_to_epic" | ... }`

## Out of scope (do not test here)

- Pack-a-Punch (future season)
- SavvyTrip
