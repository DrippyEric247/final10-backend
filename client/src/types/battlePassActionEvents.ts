/**
 * Battle Pass action events — typed domain events for task progress and analytics.
 * Consumers (engine, API bridge) map these to storage or backend.
 */

/** Clock source injectable for tests */
export type TimestampFactory = () => number;

// ——— Payloads (one per action type) ———

export interface DailyLoginClaimedPayload {
  streakDay: number;
  rewardClaimed: boolean;
}

export interface PowerBoostClaimedPayload {
  /** e.g. daily_claim, mission, purchase */
  source: string;
  /** Optional delta applied to multiplier or lint */
  multiplierDelta?: number;
}

export interface AuctionScannedPayload {
  auctionId?: string;
  itemId?: string;
  secondsRemaining: number;
  marketplace: string;
  category?: string;
}

export interface BidPlacedPayload {
  auctionId: string;
  bidAmount: number;
  secondsRemaining: number;
  marketplace: string;
  /** Server-issued one-time token from POST /api/ebay/bids/place (required in production). */
  progressionTrustToken?: string;
}

export interface AuctionWonPayload {
  auctionId: string;
  winAmount: number;
  secondsRemaining: number;
  marketplace: string;
  progressionTrustToken?: string;
}

export interface SavvyPointsEarnedPayload {
  amount: number;
  source: string;
}

export interface StreakUpdatedPayload {
  streakType: string;
  days: number;
}

export interface RankChangedPayload {
  previousRank: number;
  newRank: number;
}

export interface PowerMultiplierChangedPayload {
  previousMultiplier: number;
  newMultiplier: number;
}

export interface TaskCompletedPayload {
  taskId: string;
  taskType: "daily" | "weekly" | "season" | string;
  rewardSummary?: string;
}

export interface BuyNowScannedPayload {
  itemId: string;
  marketplace: string;
  listingMode?: "buy_now" | "mixed" | string;
  category?: string;
}

export interface RecommendedDealViewedPayload {
  itemId: string;
  marketplace: string;
  recommendationType?: "buy_now_better" | "auction_better" | "wait_and_watch" | "pass" | string;
  confidenceScore?: number;
}

/** Maps action type string → payload interface */
export type BattlePassActionPayloadMap = {
  daily_login_claimed: DailyLoginClaimedPayload;
  power_boost_claimed: PowerBoostClaimedPayload;
  auction_scanned: AuctionScannedPayload;
  bid_placed: BidPlacedPayload;
  auction_won: AuctionWonPayload;
  savvy_points_earned: SavvyPointsEarnedPayload;
  streak_updated: StreakUpdatedPayload;
  rank_changed: RankChangedPayload;
  power_multiplier_changed: PowerMultiplierChangedPayload;
  task_completed: TaskCompletedPayload;
  buy_now_scanned: BuyNowScannedPayload;
  recommended_deal_viewed: RecommendedDealViewedPayload;
};

export type BattlePassActionType = keyof BattlePassActionPayloadMap;

/** Payload for a given action type */
export type BattlePassPayloadFor<T extends BattlePassActionType> = BattlePassActionPayloadMap[T];

/** Discriminated union of all events */
export type BattlePassActionEvent = {
  [K in BattlePassActionType]: {
    id: string;
    type: K;
    userId: string;
    timestamp: number;
    payload: BattlePassPayloadFor<K>;
  };
}[BattlePassActionType];

/** Narrowing helper type guard pattern */
export function isBattlePassActionEvent(x: unknown): x is BattlePassActionEvent {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.userId === "string" &&
    typeof o.timestamp === "number" &&
    typeof o.type === "string" &&
    o.payload !== null &&
    typeof o.payload === "object"
  );
}
