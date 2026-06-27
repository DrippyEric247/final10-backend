# Live Events QA Checklist (Beta)

Test on **https://www.final10.app** after deploy. Admin controls: `/admin` → Live Events section.

## Max Supply Drops

| # | Test | Expected |
|---|------|----------|
| 1 | Admin → Create 10m drop (me) | Modal appears with countdown ~09:59 |
| 2 | Dismiss modal | Compact banner shows remaining time |
| 3 | Claim drop | Reward summary animation; Savvy/eggs/tokens update |
| 4 | Wait for expiry | Claim returns 410; banner disappears |
| 5 | Rapid double-tap Claim | Only one reward; second request 409 |
| 6 | Global drop | Other users can claim once each |

## Scout Support

| # | Test | Expected |
|---|------|----------|
| 1 | Admin → +1 deal action | Dashboard progress increments |
| 2 | Set streak 4/5 → +1 deal | Celebration modal; milestone 5 ready |
| 3 | Call In Support (5) | Max Supply Drop created (not auto-claimed) |
| 4 | Set streak 7/8 → +1 → Call In (8) | Savvy Sale starts (15 min) |
| 5 | Admin reset | Progress clears |
| 6 | Use Best Move | dealStreakCount increments (deduped) |

## Savvy Sale

| # | Test | Expected |
|---|------|----------|
| 1 | Admin → Start 15 min sale | Banner + Perk Machine theme active |
| 2 | Spin paid_1/2/3 | Server charges **10 Savvy** each |
| 3 | Spin history | Shows original cost, sale cost, savings |
| 4 | End sale / wait expiry | Prices return to 20/40/60 |
| 5 | Client tamper (DevTools) | Server still charges 10 during sale |

## Universal Events Tab

- **Route:** `/events` (protected)
- **Floating HUD:** 🎪 Events button (bottom-right, all pages when logged in)
- **Nav:** Events item with claimable badge count
- **API:** `GET /api/events/hub`

| # | Test | Expected |
|---|------|----------|
| 1 | Open `/events` | All five sections render |
| 2 | Active supply drop | Shows in Active + Claimable with timer |
| 3 | Claim from Events page | Reward applies; badge count decreases |
| 4 | Floating tab badge | Matches claimable count |
| 5 | Mobile viewport | Floating tab tappable; page scrolls cleanly |
| 6 | Non-admin | No admin panel on Events page |
| 7 | Admin | Live Events admin controls at bottom of `/events` |

## Security

| # | Test | Expected |
|---|------|----------|
| 1 | Claim another user's dropId | 403 FORBIDDEN |
| 2 | Non-admin POST create-test | 403 |
| 3 | API error responses | No secrets / stack traces |

