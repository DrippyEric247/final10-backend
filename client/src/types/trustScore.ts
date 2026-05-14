export type SellerTrustBand = 'elite' | 'high' | 'medium' | 'low' | 'unknown';

export type DealRiskFlag =
  | 'price_far_below_market'
  | 'high_shipping'
  | 'missing_image'
  | 'incomplete_metadata'
  | 'suspicious_title';

export type TrustLevel = 'high' | 'medium' | 'low' | 'unverified';

export type TrustRiskFlag =
  | 'new_seller'
  | 'low_feedback'
  | 'missing_seller'
  | DealRiskFlag
  | 'incomplete_profile'
  | 'high_returns'
  | 'slow_response'
  | 'zero_sales_signal'
  | 'severe_fraud_signal';

export type TrustScoreInput = {
  title?: string | null;
  imageUrl?: string | null;
  imageCount?: number | string | null;
  listingDescriptionLength?: number | string | null;
  marketValue?: number | string | null;
  price?: number | string | null;
  currentBidPrice?: number | string | null;
  buyNowPrice?: number | string | null;
  shippingCost?: number | string | null;
  condition?: string | null;
  sellerFeedbackPercent?: number | string | null;
  sellerFeedbackCount?: number | string | null;
  sellerCompletedSalesCount?: number | string | null;
  sellerTopRated?: boolean | string | null;
  sellerAccountAgeDays?: number | string | null;
  sellerReturnRatePercent?: number | string | null;
  sellerResponseHours?: number | string | null;
  sellerCategorySalesCount?: number | string | null;
  sellerRepeatBuyerRate?: number | string | null;
  seller?: string | null;
  sellerAccountType?: string | null;
  sellerReturnsAccepted?: boolean | string | null;
  savvyVerifiedSeller?: boolean | string | null;
};

export type TrustScoreResult = {
  /** @deprecated Use sellerTrustScore — kept for backward compat (= sellerTrustScore). */
  trustScore: number;
  /** Feed / reward tier derived from seller trust + identity (not deal price). */
  trustLevel: TrustLevel;
  /** Reputation-only score 0–100. */
  sellerTrustScore: number;
  sellerTrustBand: SellerTrustBand;
  sellerTrustReasons: string[];
  /** Listing / price / shipping analysis 5–100 (higher = safer deal surface). */
  dealRiskScore: number;
  dealRiskFlags: DealRiskFlag[];
  dealRiskWarnings: string[];
  dealHighlights: string[];
  trustReasons: string[];
  trustWarnings: string[];
  /** Union of legacy + deal flags for filters still reading riskFlags. */
  riskFlags: TrustRiskFlag[];
  safeToRecommend: boolean;
  aiConfidence: number;
  /** Seller-facing caution (never “cheap price” alone). */
  savvyWarningHeadline: string | null;
  /** Deal-only ribbon (e.g. under market) — separate from seller. */
  dealWarningHeadline: string | null;
  savvyVerifiedSeller: boolean;
  isEstablishedSeller: boolean;
  isMegaReputation: boolean;
};

export type MergedDealTrustDecision = {
  headline: string;
  caution: boolean;
  supportLine: string;
};
