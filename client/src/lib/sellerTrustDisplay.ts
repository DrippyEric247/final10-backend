import type { SellerTrustBand, SellerTrustDisplay, TrustScoreInput } from '../types/trustScore';

export const SELLER_BAND_LABEL: Record<SellerTrustBand, SellerTrustDisplay['bandLabel']> = {
  elite: 'Elite',
  high: 'Trusted',
  medium: 'Established',
  low: 'New',
  unknown: 'New',
};

function toNum(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseFeedbackPercent(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const s = String(raw).replace(/%/g, '').trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function isTopRated(value: TrustScoreInput['sellerTopRated']): boolean {
  if (typeof value === 'boolean') return value;
  const s = String(value || '').trim().toLowerCase();
  return s === 'true' || s === 'yes' || s === 'top-rated' || s === 'top_rated';
}

export function formatFeedbackCount(count: number | null): string {
  if (count == null || !Number.isFinite(count)) return '—';
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (count >= 10_000) return `${Math.round(count / 1000)}k`;
  if (count >= 1000) return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return count.toLocaleString('en-US');
}

export function formatAccountAgeDays(days: number | null): string {
  if (days == null || !Number.isFinite(days) || days < 0) return '—';
  if (days >= 365 * 2) {
    const years = Math.floor(days / 365);
    return `${years} yr${years === 1 ? '' : 's'}`;
  }
  if (days >= 365) return '1 yr';
  if (days >= 30) {
    const months = Math.floor(days / 30);
    return `${months} mo`;
  }
  return `${Math.max(1, Math.floor(days))} d`;
}

export function buildSellerTrustDisplay(
  input: TrustScoreInput,
  band: SellerTrustBand
): SellerTrustDisplay {
  const rawPct = input.sellerFeedbackPercent;
  const feedbackPct =
    typeof rawPct === 'string' && /%/.test(rawPct)
      ? parseFeedbackPercent(rawPct)
      : toNum(rawPct) ?? parseFeedbackPercent(rawPct);
  const feedbackCount =
    toNum(input.sellerFeedbackCount) ??
    toNum(input.sellerCompletedSalesCount) ??
    toNum((input as { sellerFeedbackScore?: number | string }).sellerFeedbackScore);

  const accountDays = toNum(input.sellerAccountAgeDays);

  return {
    bandLabel: SELLER_BAND_LABEL[band] ?? 'New',
    feedbackPercent: feedbackPct != null ? `${feedbackPct}%` : '—',
    feedbackCount: formatFeedbackCount(feedbackCount),
    accountAge: formatAccountAgeDays(accountDays),
    isTopRated: isTopRated(input.sellerTopRated),
  };
}
