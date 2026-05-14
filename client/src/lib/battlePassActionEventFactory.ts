import type {
  AuctionScannedPayload,
  AuctionWonPayload,
  BattlePassActionEvent,
  BattlePassActionPayloadMap,
  BattlePassActionType,
  BattlePassPayloadFor,
  BidPlacedPayload,
  DailyLoginClaimedPayload,
  PowerBoostClaimedPayload,
  PowerMultiplierChangedPayload,
  RankChangedPayload,
  RecommendedDealViewedPayload,
  SavvyPointsEarnedPayload,
  StreakUpdatedPayload,
  TaskCompletedPayload,
  TimestampFactory,
  BuyNowScannedPayload,
} from "../types/battlePassActionEvents";

export interface IdGenerator {
  (): string;
}

/** Default mock/dev id: time + random suffix (not cryptographically secure). */
export function createBattlePassEventId(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `bp_evt_${Date.now().toString(36)}_${rand}`;
}

export interface CreateEventOptions {
  id?: string;
  userId: string;
  timestamp?: number;
  now?: TimestampFactory;
}

function resolveId(opts: CreateEventOptions, gen: IdGenerator): string {
  return opts.id ?? gen();
}

function resolveTs(opts: CreateEventOptions): number {
  return opts.timestamp ?? (opts.now ? opts.now() : Date.now());
}

function buildEvent<K extends BattlePassActionType>(
  type: K,
  payload: BattlePassPayloadFor<K>,
  opts: CreateEventOptions,
  idGen: IdGenerator = createBattlePassEventId
): Extract<BattlePassActionEvent, { type: K }> {
  return {
    id: resolveId(opts, idGen),
    type,
    userId: opts.userId,
    timestamp: resolveTs(opts),
    payload,
  } as Extract<BattlePassActionEvent, { type: K }>;
}

export function createDailyLoginClaimedEvent(
  opts: CreateEventOptions,
  payload: DailyLoginClaimedPayload,
  idGen?: IdGenerator
): Extract<BattlePassActionEvent, { type: "daily_login_claimed" }> {
  return buildEvent("daily_login_claimed", payload, opts, idGen);
}

export function createPowerBoostClaimedEvent(
  opts: CreateEventOptions,
  payload: PowerBoostClaimedPayload,
  idGen?: IdGenerator
): Extract<BattlePassActionEvent, { type: "power_boost_claimed" }> {
  return buildEvent("power_boost_claimed", payload, opts, idGen);
}

export function createAuctionScannedEvent(
  opts: CreateEventOptions,
  payload: AuctionScannedPayload,
  idGen?: IdGenerator
): Extract<BattlePassActionEvent, { type: "auction_scanned" }> {
  return buildEvent("auction_scanned", payload, opts, idGen);
}

export function createBidPlacedEvent(
  opts: CreateEventOptions,
  payload: BidPlacedPayload,
  idGen?: IdGenerator
): Extract<BattlePassActionEvent, { type: "bid_placed" }> {
  return buildEvent("bid_placed", payload, opts, idGen);
}

export function createAuctionWonEvent(
  opts: CreateEventOptions,
  payload: AuctionWonPayload,
  idGen?: IdGenerator
): Extract<BattlePassActionEvent, { type: "auction_won" }> {
  return buildEvent("auction_won", payload, opts, idGen);
}

export function createSavvyPointsEarnedEvent(
  opts: CreateEventOptions,
  payload: SavvyPointsEarnedPayload,
  idGen?: IdGenerator
): Extract<BattlePassActionEvent, { type: "savvy_points_earned" }> {
  return buildEvent("savvy_points_earned", payload, opts, idGen);
}

export function createStreakUpdatedEvent(
  opts: CreateEventOptions,
  payload: StreakUpdatedPayload,
  idGen?: IdGenerator
): Extract<BattlePassActionEvent, { type: "streak_updated" }> {
  return buildEvent("streak_updated", payload, opts, idGen);
}

export function createRankChangedEvent(
  opts: CreateEventOptions,
  payload: RankChangedPayload,
  idGen?: IdGenerator
): Extract<BattlePassActionEvent, { type: "rank_changed" }> {
  return buildEvent("rank_changed", payload, opts, idGen);
}

export function createPowerMultiplierChangedEvent(
  opts: CreateEventOptions,
  payload: PowerMultiplierChangedPayload,
  idGen?: IdGenerator
): Extract<BattlePassActionEvent, { type: "power_multiplier_changed" }> {
  return buildEvent("power_multiplier_changed", payload, opts, idGen);
}

export function createTaskCompletedEvent(
  opts: CreateEventOptions,
  payload: TaskCompletedPayload,
  idGen?: IdGenerator
): Extract<BattlePassActionEvent, { type: "task_completed" }> {
  return buildEvent("task_completed", payload, opts, idGen);
}

export function createBuyNowScannedEvent(
  opts: CreateEventOptions,
  payload: BuyNowScannedPayload,
  idGen?: IdGenerator
): Extract<BattlePassActionEvent, { type: "buy_now_scanned" }> {
  return buildEvent("buy_now_scanned", payload, opts, idGen);
}

export function createRecommendedDealViewedEvent(
  opts: CreateEventOptions,
  payload: RecommendedDealViewedPayload,
  idGen?: IdGenerator
): Extract<BattlePassActionEvent, { type: "recommended_deal_viewed" }> {
  return buildEvent("recommended_deal_viewed", payload, opts, idGen);
}

/**
 * Type-safe factory by action type (useful for generic dispatch).
 */
export function createBattlePassActionEvent<T extends BattlePassActionType>(
  type: T,
  opts: CreateEventOptions,
  payload: BattlePassActionPayloadMap[T],
  idGen?: IdGenerator
): Extract<BattlePassActionEvent, { type: T }> {
  return buildEvent(type, payload, opts, idGen);
}
