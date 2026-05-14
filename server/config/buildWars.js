/**
 * Savvy Build Wars — season config (adjust dates for production).
 */

const EVENT_ID = "bw_s1_2026";

/** Season window (UTC). */
const startsAt = new Date("2026-05-01T00:00:00.000Z");
const endsAt = new Date("2026-06-15T23:59:59.999Z");

module.exports = {
  EVENT_ID,
  name: "Savvy Build Wars",
  startsAt,
  endsAt,
  /** Entry requires a linked Project Alert with at least this many line items. */
  minItems: 2,
  /** Minimum tracked savings (USD) across bundle + line items. */
  minSavingsUsd: 1,
  /** Minimum blended trust floor (0–100). */
  minTrustBlend: 55,
  /** Savvy points — participant on successful entry. */
  participantPoints: 25,
  /** Extra points by rank tier (claimed after `endsAt`). */
  rankRewards: {
    top1Pct: { points: 500, badge: "build_wars_top_1pct" },
    top10Pct: { points: 150, badge: "build_wars_top_10pct" },
  },
  /** Lucky draw for entrants outside top 10% (probability, one-time). */
  luckyDraw: { probability: 0.06, points: 45, badge: null },
};
