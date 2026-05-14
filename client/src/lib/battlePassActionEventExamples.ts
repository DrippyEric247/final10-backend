/**
 * Development / fixture sample events for QA and manual integration tests.
 * Not imported by production bundles unless you explicitly pull this module.
 */

import type { BattlePassActionEvent } from "../types/battlePassActionEvents";
import {
  createAuctionScannedEvent,
  createAuctionWonEvent,
  createBidPlacedEvent,
  createDailyLoginClaimedEvent,
  createPowerBoostClaimedEvent,
  createPowerMultiplierChangedEvent,
  createRankChangedEvent,
  createSavvyPointsEarnedEvent,
} from "./battlePassActionEventFactory";

const DEV_USER = "user_dev_final10";

const fixedOpts = {
  userId: DEV_USER,
  id: "bp_evt_example_fixed_id",
  timestamp: 1_700_000_000_000,
};

/**
 * Scan auction (ending soon flow).
 */
export const exampleScanAuction: BattlePassActionEvent = createAuctionScannedEvent(
  { ...fixedOpts, id: "bp_evt_ex_scan" },
  {
    auctionId: "auc_neon_8821",
    secondsRemaining: 240,
    marketplace: "final10",
    category: "electronics",
  }
);

/**
 * Place bid in final window (e.g. last 10 minutes).
 */
export const exampleLastMinuteBid: BattlePassActionEvent = createBidPlacedEvent(
  { ...fixedOpts, id: "bp_evt_ex_bid" },
  {
    auctionId: "auc_neon_8821",
    bidAmount: 124.5,
    secondsRemaining: 420,
    marketplace: "final10",
  }
);

/**
 * Win auction under 10 seconds remaining (snipe scenario).
 */
export const exampleWinUnderTenSeconds: BattlePassActionEvent = createAuctionWonEvent(
  { ...fixedOpts, id: "bp_evt_ex_snipe_win" },
  {
    auctionId: "auc_clutch_009",
    winAmount: 89.99,
    secondsRemaining: 7,
    marketplace: "final10",
  }
);

/** Daily login + streak slot */
export const exampleDailyLoginClaimed: BattlePassActionEvent = createDailyLoginClaimedEvent(
  { ...fixedOpts, id: "bp_evt_ex_daily_login" },
  {
    streakDay: 5,
    rewardClaimed: true,
  }
);

/** Daily power boost claim (pairs with power_boost_claimed) */
export const examplePowerBoostClaimed: BattlePassActionEvent = createPowerBoostClaimedEvent(
  { ...fixedOpts, id: "bp_evt_ex_power_boost" },
  {
    source: "daily_claim",
    multiplierDelta: 0.02,
  }
);

/** Earn 500 savvy points */
export const exampleSavvy500: BattlePassActionEvent = createSavvyPointsEarnedEvent(
  { ...fixedOpts, id: "bp_evt_ex_savvy_500" },
  {
    amount: 500,
    source: "weekly_activity_bundle",
  }
);

/** Improve leaderboard rank */
export const exampleRankImprovement: BattlePassActionEvent = createRankChangedEvent(
  { ...fixedOpts, id: "bp_evt_ex_rank" },
  {
    previousRank: 42,
    newRank: 28,
  }
);

/** Hit 1.5× power multiplier */
export const examplePower15x: BattlePassActionEvent = createPowerMultiplierChangedEvent(
  { ...fixedOpts, id: "bp_evt_ex_power_15" },
  {
    previousMultiplier: 1.2,
    newMultiplier: 1.5,
  }
);

/** All samples in display order */
export const battlePassActionEventDevSamples: BattlePassActionEvent[] = [
  exampleScanAuction,
  exampleLastMinuteBid,
  exampleWinUnderTenSeconds,
  exampleDailyLoginClaimed,
  examplePowerBoostClaimed,
  exampleSavvy500,
  exampleRankImprovement,
  examplePower15x,
];
