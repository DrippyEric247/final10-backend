import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ExternalLink, Loader2, Search } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import SellerTrustEvidence from '../components/trust/SellerTrustEvidence';
import ListingCardImage from '../components/listings/ListingCardImage';
import DealShareButton from '../components/deals/DealShareButton';
import SavvyAlertButton from '../components/alerts/SavvyAlertButton';
import { trackDealShareEvent } from '../hooks/useDealShare';
import { getDealShareUrl, sanitizeDealShareSource } from '../lib/dealShareUrl';
import { resolveDirectItemUrl } from '../lib/bestMoveListingValidation';
import '../styles/DealDetail.css';

function formatMoney(value, currency = 'USD') {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n);
  } catch {
    return `$${Math.round(n)}`;
  }
}

function statusLabel(status) {
  switch (status) {
    case 'ended':
      return 'Deal ended';
    case 'sold':
      return 'Sold';
    case 'expired':
      return 'Listing expired';
    case 'removed':
      return 'Listing removed';
    case 'unavailable':
      return 'Listing no longer available';
    default:
      return null;
  }
}

function formatUpdatedAt(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return null;
  }
}

export default function DealDetail() {
  const { dealId } = useParams();
  const [searchParams] = useSearchParams();
  const shareSource = sanitizeDealShareSource(searchParams.get('src'));
  const { user } = useAuth();
  const navigate = useNavigate();
  const [deal, setDeal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!dealId) return;
      setLoading(true);
      setError(null);
      try {
        const { data } = await api.get(`/deals/${encodeURIComponent(dealId)}`, {
          params: { src: shareSource },
        });
        if (!cancelled) setDeal(data);
        trackDealShareEvent(dealId, 'shared_deal_opened', shareSource);
      } catch (err) {
        if (!cancelled) {
          setDeal(null);
          setError(err?.response?.data?.message || 'This deal could not be loaded.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [dealId, shareSource]);

  const listing = deal?.listing || {};
  const isActive = deal?.status === 'active';
  const endedLabel = statusLabel(deal?.status);
  const marketplaceUrl = deal?.marketplaceUrl || resolveDirectItemUrl(listing);
  const price = Number(listing.buyNowPrice ?? listing.currentBidPrice ?? listing.price ?? 0);
  const marketValue = Number(listing.marketValue ?? 0);
  const savings = Number(listing.estimatedSavings ?? Math.max(0, marketValue - price));
  const shareUrl = deal ? getDealShareUrl(deal.listing || {}, shareSource) : null;

  const ogTitle = listing.title
    ? `${listing.title} — Final10`
    : 'Final10 Deal';
  const ogDescription = [
    price > 0 ? formatMoney(price, listing.currency) : null,
    savings > 0 ? `Est. ${formatMoney(savings, listing.currency)} savings` : null,
    'Found by Final10',
  ]
    .filter(Boolean)
    .join(' • ');

  const searchSimilar = () => {
    const q = String(listing.title || '').split(/\s+/).slice(0, 4).join(' ').trim();
    if (!q) {
      navigate('/local-deals');
      return;
    }
    navigate(`/local-deals?q=${encodeURIComponent(q)}`);
  };

  const openMarketplace = () => {
    if (!marketplaceUrl || !isActive) return;
    trackDealShareEvent(dealId, 'shared_deal_marketplace_clicked', shareSource);
    window.open(marketplaceUrl, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return (
      <div className="deal-detail-page deal-detail-page--loading">
        <Loader2 className="deal-detail-spinner" aria-hidden />
        <p>Loading deal…</p>
      </div>
    );
  }

  if (error || !deal) {
    return (
      <div className="deal-detail-page deal-detail-page--error">
        <h1>Deal unavailable</h1>
        <p>{error || 'This link may be invalid or the listing was removed.'}</p>
        <button type="button" className="deal-detail-btn deal-detail-btn--primary" onClick={searchSimilar}>
          <Search size={16} aria-hidden /> Find similar deals
        </button>
      </div>
    );
  }

  return (
    <div className="deal-detail-page">
      <Helmet>
        <title>{ogTitle}</title>
        <meta name="description" content={ogDescription} />
        <meta property="og:title" content={ogTitle} />
        <meta property="og:description" content={ogDescription} />
        {shareUrl ? <meta property="og:url" content={shareUrl} /> : null}
        {listing.imageUrl ? <meta property="og:image" content={listing.imageUrl} /> : null}
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={ogTitle} />
        <meta name="twitter:description" content={ogDescription} />
        {listing.imageUrl ? <meta name="twitter:image" content={listing.imageUrl} /> : null}
      </Helmet>

      <header className="deal-detail-header">
        <Link to="/" className="deal-detail-brand">
          Final10
        </Link>
        <div className="deal-detail-header__actions">
          <DealShareButton deal={listing} shareSource={shareSource} compact />
          {!user ? (
            <Link to="/login" className="deal-detail-btn deal-detail-btn--ghost">
              Sign in
            </Link>
          ) : null}
        </div>
      </header>

      <main className="deal-detail-main">
        {endedLabel ? (
          <div className="deal-detail-status deal-detail-status--ended" role="status">
            {endedLabel.toUpperCase()}
            {deal.fromSnapshot ? (
              <span className="deal-detail-status__note">
                Showing the last information Final10 saved for this listing.
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="deal-detail-grid">
          <div className="deal-detail-media">
            <ListingCardImage
              item={listing}
              alt={listing.title || 'Deal'}
              aspectRatio="1 / 1"
              borderRadius="16px"
            />
          </div>

          <div className="deal-detail-body">
            <p className="deal-detail-kicker">
              {deal.marketplace === 'ebay' ? 'eBay' : deal.marketplace} · Found by Final10
            </p>
            <h1 className="deal-detail-title">{listing.title}</h1>

            <div className="deal-detail-pricing">
              <div>
                <span className="deal-detail-label">Current price</span>
                <strong className={isActive ? 'deal-detail-price' : 'deal-detail-price deal-detail-price--historical'}>
                  {formatMoney(price, listing.currency)}
                </strong>
                {!isActive ? (
                  <span className="deal-detail-historical-note">Historical — not available to buy now</span>
                ) : null}
              </div>
              {marketValue > 0 ? (
                <div>
                  <span className="deal-detail-label">Market value</span>
                  <strong>{formatMoney(marketValue, listing.currency)}</strong>
                </div>
              ) : null}
              {savings > 0 ? (
                <div>
                  <span className="deal-detail-label">Est. savings</span>
                  <strong className="deal-detail-savings">
                    {formatMoney(savings, listing.currency)}
                    {listing.estimatedSavingsPct
                      ? ` (${listing.estimatedSavingsPct}%)`
                      : ''}
                  </strong>
                </div>
              ) : null}
            </div>

            {listing.isAuction && Number(listing.secondsRemaining) > 0 && isActive ? (
              <p className="deal-detail-meta">
                Auction · {Math.max(0, Number(listing.bidCount || 0))} bids ·{' '}
                {Math.max(0, Math.floor(Number(listing.secondsRemaining) / 60))} min left
              </p>
            ) : null}

            {deal.bestMove?.labels?.includes('BEST_MOVE') ? (
              <p className="deal-detail-best-move">Best Move signal detected by Final10</p>
            ) : null}

            <div className="deal-detail-trust">
              <SellerTrustEvidence
                evidence={deal.sellerEvidence}
                listing={listing}
                showDetailsToggle
              />
            </div>

            <div className="deal-detail-actions">
              <button
                type="button"
                className="deal-detail-btn deal-detail-btn--primary"
                disabled={!isActive || !marketplaceUrl}
                onClick={openMarketplace}
              >
                <ExternalLink size={16} aria-hidden />
                {isActive ? 'View on marketplace' : 'Marketplace link unavailable'}
              </button>
              {!isActive ? (
                <button type="button" className="deal-detail-btn deal-detail-btn--secondary" onClick={searchSimilar}>
                  <Search size={16} aria-hidden /> Find similar deals
                </button>
              ) : null}
            </div>

            {user ? (
              <div className="deal-detail-authenticated">
                <h2>Your Final10 tools</h2>
                <p className="deal-detail-rewards-note">
                  Savvy rewards and personalized Best Move actions are calculated for your account only.
                </p>
                <SavvyAlertButton
                  label="Track this deal"
                  payload={{
                    listingId: String(listing.itemId || listing.listingId || deal.listingId),
                    title: listing.title,
                    imageUrl: listing.imageUrl,
                    minConfidence: 70,
                    persona: 'buyer',
                    kind: 'shared_deal',
                    context: { source: 'shared_deal', dealId: deal.dealId, shareSource },
                  }}
                />
              </div>
            ) : (
              <div className="deal-detail-public-note">
                <h2>Deal information</h2>
                <p>
                  This page is public. Sign in to save deals, earn Savvy, and unlock personalized Best Move
                  guidance.
                </p>
              </div>
            )}

            {formatUpdatedAt(deal.lastUpdatedAt) ? (
              <p className="deal-detail-updated">Last updated {formatUpdatedAt(deal.lastUpdatedAt)}</p>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
