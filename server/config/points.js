// config/points.js

module.exports = {
  // ===== Trial settings =====
  TRIAL_DAYS: 14,                 // free trial length in days
  TRIAL_BONUS_MULTIPLIER: 0.5,    // +50% bonus earn rate during trial

  // ===== Premium settings =====
  PREMIUM_BONUS_MULTIPLIER: 0.20, // +20% boost for Premium subs

  // ===== Weekend settings =====
  WEEKEND_MULTIPLIER: 1.0,        // +100% (double points) on Sat/Sun

  // ===== Badge thresholds =====
  BADGE_TIERS: [
    { name: 'Bronze',  threshold: 100_000 },
    { name: 'Silver',  threshold: 1_000_000 },
    { name: 'Gold',    threshold: 10_000_000 },
    { name: 'Diamond', threshold: 25_000_000 },
    // Platinum handled by Top 10 leaderboard
  ],

  // ===== Redeem settings =====
  DISCOUNT_RATIO: 0.01,           // 100 pts = $1 off
};

