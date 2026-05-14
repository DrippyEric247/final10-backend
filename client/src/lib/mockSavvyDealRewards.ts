/**
 * Mock Savvy Points / reward breakdown for deal cards.
 * Replace with API-backed values when the rewards service is wired.
 */

export type SavvySubscriptionTier = 'free' | 'core' | 'pro' | 'elite';

export type MockEcosystemFlags = {
  savvyTrip: boolean;
  ezStay: boolean;
  aiGo: boolean;
};

/** Flip to `false` to hide ecosystem visuals until backend provides real links. */
export const MOCK_SAVVY_ECOSYSTEM_DEFAULT_CONNECTED: MockEcosystemFlags = {
  savvyTrip: true,
  ezStay: true,
  aiGo: true,
};

const STORAGE_ECOSYSTEM = 'f10_mock_ecosystem_apps_v1';
const STORAGE_WALLET = 'f10_mock_savvy_wallet_balance_v1';
const STORAGE_STREAK = 'f10_mock_deal_view_streak_v1';

export function readMockEcosystemFlags(): MockEcosystemFlags {
  if (typeof window === 'undefined') return MOCK_SAVVY_ECOSYSTEM_DEFAULT_CONNECTED;
  try {
    const raw = window.localStorage.getItem(STORAGE_ECOSYSTEM);
    if (!raw) return MOCK_SAVVY_ECOSYSTEM_DEFAULT_CONNECTED;
    const parsed = JSON.parse(raw) as Partial<MockEcosystemFlags>;
    return {
      savvyTrip: Boolean(parsed.savvyTrip),
      ezStay: Boolean(parsed.ezStay),
      aiGo: Boolean(parsed.aiGo),
    };
  } catch {
    return MOCK_SAVVY_ECOSYSTEM_DEFAULT_CONNECTED;
  }
}

export function ecosystemMultiplier(flags: MockEcosystemFlags): number {
  const n = [flags.savvyTrip, flags.ezStay, flags.aiGo].filter(Boolean).length;
  if (n >= 3) return 2;
  if (n === 2) return 1.35;
  if (n === 1) return 1.12;
  return 1;
}

export function readMockWalletBalance(): number {
  if (typeof window === 'undefined') return 4055;
  try {
    const n = Number(window.localStorage.getItem(STORAGE_WALLET));
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : 4055;
  } catch {
    return 4055;
  }
}

export function readMockStreak(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const n = Number(window.localStorage.getItem(STORAGE_STREAK));
    return Number.isFinite(n) && n >= 0 ? Math.min(99, Math.round(n)) : 0;
  } catch {
    return 0;
  }
}

export type MockSavvyBreakdownLine = {
  key: string;
  label: string;
  amount: number;
  /** UI color token */
  tone: 'blue' | 'green' | 'cyan' | 'gold' | 'purple';
};

export type MockSavvyRewardCardModel = {
  breakdown: MockSavvyBreakdownLine[];
  /** Sum of positive breakdown lines (before global multipliers). */
  subtotalAdditive: number;
  ecosystemFlags: MockEcosystemFlags;
  ecosystemMult: number;
  ecosystemActive: boolean;
  /** Flat XP-style bump for elite — mock */
  eliteFlatBonus: number;
  trendingBonus: number;
  xpBoosted: boolean;
  /** 0–100 composite for UI meter */
  rewardConfidence: number;
  competitionScore: number;
  marketFitScore: number;
  savvyAiScore: number;
  trustScore: number;
  /** Premium status tags */
  statusTags: { key: string; label: string; emoji: string }[];
};

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function hashItemSeed(id: string | undefined, title: string | undefined): number {
  const s = `${id || ''}:${title || ''}`;
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h << 5) - h + s.charCodeAt(i);
  return Math.abs(h);
}

/**
 * Builds additive breakdown lines that sum to `baseAfterTrust` (trust-adjusted Savvy base).
 * Global user × ecosystem multipliers are applied outside this function (see SavvyRewardBadge / caller).
 */
export function buildMockSavvyBreakdown(params: {
  baseAfterTrust: number;
  trustScore: number;
  bidCount: number;
  marketValue: number;
  price: number;
  savings: number;
  confidenceScore: number;
  aiConfidence: number;
  safeToRecommend?: boolean;
  savvyVerifiedSeller?: boolean;
  title?: string;
  itemId?: string;
  subscriptionTier: SavvySubscriptionTier;
}): MockSavvyRewardCardModel {
  const {
    baseAfterTrust,
    trustScore,
    bidCount,
    marketValue,
    price,
    savings,
    confidenceScore,
    aiConfidence,
    safeToRecommend = true,
    savvyVerifiedSeller = false,
    title = '',
    itemId,
    subscriptionTier,
  } = params;

  const b = Math.max(0, Math.round(baseAfterTrust));
  const bids = Number(bidCount) || 0;
  const seed = hashItemSeed(itemId, title);

  const trustedSellerAmt =
    savvyVerifiedSeller || trustScore >= 82
      ? Math.round(clamp(b * 0.22, 24, 120))
      : trustScore >= 68
        ? Math.round(clamp(b * 0.14, 12, 72))
        : 0;

  const lowCompAmt = bids <= 2 ? Math.round(clamp(b * 0.12, 10, 55)) : bids <= 5 ? Math.round(clamp(b * 0.06, 4, 28)) : 0;

  const flags = readMockEcosystemFlags();
  const ecoMult = ecosystemMultiplier(flags);
  const ecosystemActive = ecoMult > 1.001;
  const ecosystemFlat =
    ecosystemActive && bids <= 4 ? Math.round(clamp(b * 0.1 + (seed % 18), 20, 140)) : ecosystemActive ? Math.round(clamp(b * 0.06, 12, 90)) : 0;

  const trendingBonus =
    savings > 120 && trustScore >= 60 && seed % 4 !== 0 ? Math.round(clamp(15 + (seed % 40), 8, 85)) : 0;

  const eliteFlatBonus = subscriptionTier === 'elite' ? Math.round(clamp(18 + (seed % 22), 12, 55)) : 0;

  const extraSum = trustedSellerAmt + lowCompAmt + ecosystemFlat + trendingBonus + eliteFlatBonus;
  let basePortion = Math.max(0, b - extraSum);
  if (basePortion < Math.round(b * 0.25)) {
    const scale = b / Math.max(1, extraSum + Math.round(b * 0.35));
    basePortion = Math.round(Math.max(b * 0.35, b - extraSum * scale));
  }
  const sumParts = basePortion + trustedSellerAmt + lowCompAmt + ecosystemFlat + trendingBonus + eliteFlatBonus;
  const fix = b - sumParts;
  basePortion = Math.max(0, basePortion + fix);

  const breakdown: MockSavvyBreakdownLine[] = [
    { key: 'base', label: 'Base rewards', amount: basePortion, tone: 'blue' },
  ];
  if (trustedSellerAmt > 0) {
    breakdown.push({ key: 'trusted', label: 'Trusted seller', amount: trustedSellerAmt, tone: 'green' });
  }
  if (lowCompAmt > 0) {
    breakdown.push({ key: 'lowcomp', label: 'Low competition', amount: lowCompAmt, tone: 'purple' });
  }
  if (ecosystemFlat > 0) {
    breakdown.push({ key: 'eco', label: 'Ecosystem combo', amount: ecosystemFlat, tone: 'cyan' });
  }
  if (trendingBonus > 0) {
    breakdown.push({ key: 'trend', label: 'Trending velocity', amount: trendingBonus, tone: 'gold' });
  }
  if (eliteFlatBonus > 0) {
    breakdown.push({ key: 'elite', label: 'Elite lane bonus', amount: eliteFlatBonus, tone: 'gold' });
  }

  const subtotalAdditive = breakdown.reduce((a, x) => a + Math.max(0, x.amount), 0);

  const conf = Number.isFinite(confidenceScore) ? confidenceScore : 0;
  const ai = Number.isFinite(aiConfidence) ? aiConfidence : trustScore;
  const marketFit =
    marketValue > 0 && price > 0
      ? clamp(Math.round(68 + (1 - Math.abs(marketValue - price) / marketValue) * 28), 40, 98)
      : 55 + (seed % 18);

  const competitionScore = clamp(Math.round(100 - bids * 11 - (bids > 12 ? 18 : 0)), 12, 98);

  const rewardConfidence = clamp(
    Math.round(
      trustScore * 0.28 +
        competitionScore * 0.18 +
        marketFit * 0.22 +
        ai * 0.22 +
        (safeToRecommend ? 10 : -8) +
        (conf > 0 ? conf * 0.1 : 0)
    ),
    18,
    98
  );

  const savvyAiScore = clamp(Math.round(ai), 12, 97);

  const statusTags: { key: string; label: string; emoji: string }[] = [];
  if (subtotalAdditive >= 380 && trustScore >= 70) statusTags.push({ key: 'high', label: 'HIGH SAVVY RETURN', emoji: '💎' });
  if (subscriptionTier === 'pro' || subscriptionTier === 'elite') statusTags.push({ key: 'xp', label: 'XP BOOSTED', emoji: '⚡' });
  if (ecosystemActive) statusTags.push({ key: 'eco', label: 'ECOSYSTEM ACTIVE', emoji: '🌐' });
  if (savvyVerifiedSeller || trustScore >= 85) statusTags.push({ key: 'ver', label: 'VERIFIED SELLER', emoji: '🛡' });
  if (trendingBonus > 0) statusTags.push({ key: 'trend', label: 'TRENDING DEAL', emoji: '📈' });
  if (bids <= 2) statusTags.push({ key: 'low', label: 'LOW COMPETITION', emoji: '🎯' });

  const xpBoosted = subscriptionTier !== 'free';

  return {
    breakdown,
    subtotalAdditive,
    ecosystemFlags: flags,
    ecosystemMult: ecoMult,
    ecosystemActive,
    eliteFlatBonus,
    trendingBonus,
    xpBoosted,
    rewardConfidence,
    competitionScore,
    marketFitScore: marketFit,
    savvyAiScore,
    trustScore: Math.round(trustScore),
    statusTags: statusTags.slice(0, 5),
  };
}
