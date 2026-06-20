import React, { useCallback, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import ListingModeTabs from '../ebay/ListingModeTabs';
import { emitPowerToast } from '../../lib/final10PowerFeedback';
import { trackQuickSnipeAction } from '../../lib/analytics';
import { recordScoutMissionAction } from '../../lib/savvyScoutMissions';
import { SAVVY_SCOUT } from '../../config/savvyScoutBranding';
import QuickSnipeSavvyRewards from './QuickSnipeSavvyRewards';
import { getConfidenceLabel, rankQuickSnipeListings } from '../../lib/quickSnipesBestMove';

const TRENDING_SNEAKERS = [
  { label: 'Jordan 1', query: 'air jordan 1' },
  { label: 'Jordan 4', query: 'air jordan 4' },
  { label: 'Nike SB', query: 'nike sb dunk' },
  { label: 'Yeezy', query: 'yeezy' },
  { label: 'Off-White', query: 'off-white nike' },
  { label: 'New Balance', query: 'new balance 990' },
  { label: 'Travis Scott', query: 'travis scott sneaker' },
];

const TRENDING_TECH = [
  { label: 'MacBook Pro', query: 'macbook pro m3' },
  { label: 'RTX 4090', query: 'rtx 4090' },
  { label: 'Steam Deck', query: 'steam deck' },
  { label: 'PS5 Slim', query: 'playstation 5' },
  { label: 'iPad Pro', query: 'ipad pro m4' },
];

const TRENDING_WATCHES = [
  { label: 'Rolex Sub', query: 'rolex submariner' },
  { label: 'Omega Speedy', query: 'omega speedmaster' },
  { label: 'Seiko 5', query: 'seiko 5 sports' },
  { label: 'Cartier Tank', query: 'cartier tank watch' },
];

const TRENDING_BMW = [
  { label: 'E90 LCI', query: 'bmw e90 parts' },
  { label: 'M3 V8', query: 'bmw e92 m3 parts' },
  { label: 'E60 M5', query: 'bmw e60 m5 exhaust' },
  { label: 'F80 M3', query: 'bmw f80 m3 carbon' },
];

const TRENDING_COLLECTIBLES = [
  { label: 'Pokémon', query: 'pokemon cards' },
  { label: 'Sports Cards', query: 'sports cards lot' },
  { label: 'Hot Wheels', query: 'hot wheels rare' },
  { label: 'MTG', query: 'magic the gathering cards' },
];

function toMoney(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return `$${Math.round(n).toLocaleString()}`;
}

function fmtTime(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}m ${String(sec).padStart(2, '0')}s`;
}

function sellerUsername(item) {
  const s = item.seller;
  if (typeof s === 'string' && s.trim()) return s.trim();
  if (s && typeof s === 'object') {
    const u = s.username ?? s.userId ?? s.sellerUserName;
    if (u != null) return String(u).trim();
  }
  return String(item.sellerUsername || '').trim();
}

function feedbackCount(item) {
  const s = item.seller;
  if (s && typeof s === 'object') {
    const n = Number(s.feedbackScore ?? s.feedbackCount);
    if (Number.isFinite(n)) return n;
  }
  const flat = Number(item.sellerFeedbackCount ?? item.sellerFeedbackScore);
  return Number.isFinite(flat) ? flat : 0;
}

function accountAgeDays(item) {
  const s = item.seller;
  if (s && typeof s === 'object') {
    const d = s.sellerRegistrationDate || s.accountCreationDate;
    if (d) {
      const t = new Date(String(d)).getTime();
      if (!Number.isNaN(t)) return Math.max(0, Math.floor((Date.now() - t) / 86400000));
    }
  }
  const flat = Number(item.sellerAccountAgeDays ?? item.sellerRegistrationDays);
  return Number.isFinite(flat) ? flat : null;
}

function imageCount(item) {
  if (Array.isArray(item.images)) return item.images.length;
  if (Array.isArray(item.thumbnailImages)) return item.thumbnailImages.length;
  if (Array.isArray(item.additionalImages)) return item.additionalImages.length;
  const n = Number(item.imageCount);
  return Number.isFinite(n) ? n : item.imageUrl ? 1 : 0;
}

/**
 * Derive Savvy trust chips from listing + trust engine outputs already on the item.
 */
function buildTrustBadges(item) {
  const badges = [];
  const trust = Number(item.trustScore) || 0;
  const fb = feedbackCount(item);
  const age = accountAgeDays(item);
  const imgs = imageCount(item);
  const price = Number(item.buyNowPrice ?? item.currentBidPrice ?? item.price ?? 0);
  const market = Number(item.marketValue ?? 0);
  const suspiciousTitle = /replica|counterfeit|100% authentic fake/i.test(String(item.title || ''));

  if (item.savvyVerifiedSeller) {
    badges.push({ key: 'verified', label: 'VERIFIED SELLER', icon: '✅', tone: 'emerald' });
  }
  if (fb >= 500 && trust >= 70) {
    badges.push({ key: 'history', label: 'TRUSTED HISTORY', icon: '🛡️', tone: 'sky' });
  }
  if (item.safeToRecommend && trust >= 62 && imgs >= 1) {
    badges.push({ key: 'safe', label: 'SAFE SNIPE', icon: '🔒', tone: 'violet' });
  }
  if (Number(item.confidenceScore) >= 78 || Number(item.aiConfidence) >= 82) {
    badges.push({ key: 'conf', label: 'HIGH CONFIDENCE', icon: '⚡', tone: 'amber' });
  }
  if (trust >= 55 && item.safeToRecommend && !item.savvyWarningHeadline && market > 0 && price > 0 && price >= market * 0.35) {
    badges.push({ key: 'lowrisk', label: 'LOW RISK', icon: '✓', tone: 'slate' });
  }
  if ((age != null && age < 120) || (fb < 10 && fb >= 0)) {
    badges.push({ key: 'new', label: 'NEW SELLER WARNING', icon: '⚠️', tone: 'orange' });
  }
  if (!item.safeToRecommend || trust < 38 || suspiciousTitle || (market > 0 && price > 0 && price < market * 0.12)) {
    badges.push({ key: 'risky', label: 'RISKY DEAL', icon: '❌', tone: 'rose' });
  }

  const seen = new Set();
  const uniq = badges.filter((b) => {
    if (seen.has(b.key)) return false;
    seen.add(b.key);
    return true;
  });
  uniq.sort((a, b) => {
    const warn = (k) => (k === 'risky' || k === 'new' ? 0 : 1);
    if (warn(a.key) !== warn(b.key)) return warn(a.key) - warn(b.key);
    return 0;
  });
  return uniq.slice(0, 4);
}

function BestMoveFallbackCard({
  fallback,
  liveTick,
  onMeaningfulView,
  saveAlert,
  searchQuery,
}) {
  const item = fallback?.item;
  if (!item) return null;
  const price = Number(item.buyNowPrice ?? item.currentBidPrice ?? item.price ?? 0);
  const market = Number(item.marketValue ?? 0);
  const savings = Number(fallback.savings) || Math.max(0, market - price);
  const savingsPct = Number(fallback.savingsPct) || (market > 0 ? (savings / market) * 100 : 0);
  const trust = Math.round(Number(fallback.trustScore ?? item.trustScore) || 0);
  const confidence = fallback.confidence || getConfidenceLabel(fallback.confidenceScore ?? item.confidenceScore);
  const url = item.itemWebUrl || item.itemUrl;
  const seconds = Math.max(0, Number(item.secondsRemaining || 0) - liveTick);
  const bids = Math.max(1, Number(item.bidCount || 0));

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="qscc-savvy-card qscc-savvy-card--fallback rounded-2xl overflow-hidden flex flex-col border-2 border-cyan-400/40 mb-6"
    >
      <div className="px-5 py-4 border-b border-cyan-400/25 bg-cyan-500/10">
        <div className="text-[10px] font-black tracking-[0.22em] text-cyan-200 uppercase">Best Move Available Right Now</div>
        <p className="mt-2 text-sm text-cyan-50/95 leading-relaxed">
          Savvy Scout is still scanning for legendary finds. Here&apos;s the strongest move available right now.
        </p>
      </div>
      <div className="grid md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)] gap-0">
        <div className="qscc-savvy-card__media relative aspect-[4/3] md:aspect-auto md:min-h-[260px] bg-slate-950">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={String(item.title || 'Listing')}
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-xs font-bold">No photo</div>
          )}
          <div className="absolute top-3 left-3">
            <span className={`qscc-confidence-badge qscc-confidence-badge--${confidence.key}`}>
              {confidence.label}
            </span>
          </div>
        </div>
        <div className="p-5 sm:p-6 flex flex-col bg-gradient-to-b from-slate-900/50 to-slate-950">
          <h4 className="text-white font-bold text-lg leading-snug line-clamp-3">{item.title}</h4>
          <div className="mt-3 text-sm text-slate-300 space-y-1.5">
            <div><span className="text-slate-400">Price:</span> <span className="font-bold text-white">{toMoney(price)}</span></div>
            <div className="text-emerald-300 font-black">
              Est. savings: {toMoney(savings)}
              {savingsPct > 0 ? ` (${Math.round(savingsPct)}%)` : ''}
            </div>
            <div><span className="text-slate-400">Trust score:</span> <span className="font-bold text-cyan-200">{trust}%</span></div>
            <div><span className="text-slate-400">Ends in:</span> <span className="font-bold text-amber-200">{fmtTime(seconds)}</span></div>
            <div><span className="text-slate-400">Activity:</span> <span className="font-bold text-amber-200">{bids} watching</span></div>
          </div>
          <div className="mt-3 text-xs leading-relaxed text-violet-100/95 border border-violet-400/25 bg-violet-500/10 rounded-lg px-3 py-2.5">
            <strong className="text-violet-200">Why Savvy Scout picked it:</strong>{' '}
            {fallback.pickReason || 'Strongest composite score from savings, trust, seller reputation, and urgency.'}
          </div>
          <QuickSnipeSavvyRewards item={item} effectiveSavings={savings} />
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="qscc-savvy-btn qscc-savvy-btn--buy"
              onClick={() => {
                onMeaningfulView(item, 'fallback_view_deal');
                if (url) window.open(url, '_blank', 'noopener,noreferrer');
              }}
            >
              View Deal
            </button>
            <button
              type="button"
              className="qscc-savvy-btn qscc-savvy-btn--accent"
              onClick={() => saveAlert(item, searchQuery)}
            >
              Create Alert for Better Deal
            </button>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

function TrendingRow({ title, chips, runHunt }) {
  return (
    <div className="qscc-trend-block">
      <div className="qscc-trend-block__title">{title}</div>
      <div className="qscc-trend-block__chips">
        {chips.map((c) => (
          <button
            key={c.label}
            type="button"
            className="qscc-trend-chip"
            onClick={() =>
              runHunt(c.query, 'trending_chip', {
                ebayCategoryId: '',
                loadingMessage: `Launching ${c.label} hunt...`,
              })
            }
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function QuickSnipesSavvyResults({
  loading,
  items,
  liveTick,
  mode,
  setMode,
  showPass,
  setShowPass,
  runHunt,
  onMeaningfulView,
  fallbackBestMove = null,
  searchQuery = '',
}) {
  const [banner, setBanner] = useState('');

  const ranked = useMemo(() => rankQuickSnipeListings(items || [], liveTick), [items, liveTick]);
  const extraordinary = useMemo(() => ranked.filter((x) => x.extraordinary), [ranked]);
  const cardsToRender = extraordinary.length > 0 ? extraordinary : [];
  const showFallbackCard = cardsToRender.length === 0 && Boolean(fallbackBestMove?.item);

  const headerStats = useMemo(() => {
    const n = ranked.length || (fallbackBestMove?.item ? 1 : 0);
    if (!n) return { count: 0, lowComp: false, confLabel: 'MEDIUM' };
    if (!ranked.length && fallbackBestMove?.item) {
      const conf = fallbackBestMove.confidence || getConfidenceLabel(fallbackBestMove.item.confidenceScore);
      return { count: 1, lowComp: true, confLabel: conf.label.toUpperCase().includes('LEGENDARY') || conf.label.includes('High') ? 'HIGH' : 'MEDIUM' };
    }
    const lowBids = ranked.filter((r) => Number(r.item.bidCount || 0) <= 2).length;
    const lowComp = lowBids / n >= 0.38;
    const avgConf =
      ranked.reduce((a, r) => a + (Number(r.item.confidenceScore) || Number(r.item.aiConfidence) || 0), 0) / n;
    let confLabel = 'MEDIUM';
    if (avgConf >= 72) confLabel = 'HIGH';
    else if (avgConf < 48) confLabel = 'LOW';
    return { count: n, lowComp, confLabel };
  }, [ranked, fallbackBestMove]);

  const saveAlert = useCallback((item, alertQuery = '') => {
    try {
      const key = 'f10_quick_snipe_alerts_v1';
      const raw = JSON.parse(localStorage.getItem(key) || '[]');
      const id = String(item.itemId ?? '');
      if (raw.some((x) => String(x.id) === id)) {
        setBanner('Already watching this deal in Saved Alerts.');
        window.setTimeout(() => setBanner(''), 2800);
        return;
      }
      raw.unshift({
        id,
        title: String(item.title || '').slice(0, 120),
        query: String(alertQuery || item.title || '').slice(0, 40),
        savedAt: Date.now(),
      });
      localStorage.setItem(key, JSON.stringify(raw.slice(0, 40)));
      trackQuickSnipeAction('save_alert', { itemId: id });
      recordScoutMissionAction('save_deal', { pathname: '/local-deals' });
      emitPowerToast(8, 'Deal alert saved to your dock.');
      setBanner('Saved to Savvy Deal Alerts.');
      window.setTimeout(() => setBanner(''), 2800);
    } catch {
      setBanner('Could not save alert — try again.');
      window.setTimeout(() => setBanner(''), 2500);
    }
  }, []);

  const openSeller = useCallback((item) => {
    const u = sellerUsername(item);
    if (!u) return;
    const url = `https://www.ebay.com/usr/${encodeURIComponent(u)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    trackQuickSnipeAction('view_seller', { itemId: String(item.itemId ?? '') });
  }, []);

  if (loading) {
    return (
      <div className="qscc-savvy-wrap qscc-glass rounded-2xl border border-violet-500/25 p-5 sm:p-8">
        <div className="qscc-savvy-shimmer qscc-savvy-shimmer--title mb-6" />
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="qscc-savvy-card qscc-savvy-card--skeleton rounded-2xl overflow-hidden">
              <div className="qscc-savvy-shimmer qscc-savvy-shimmer--img" />
              <div className="p-4 space-y-2">
                <div className="qscc-savvy-shimmer qscc-savvy-shimmer--line" />
                <div className="qscc-savvy-shimmer qscc-savvy-shimmer--line short" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!ranked.length && !showFallbackCard) return null;

  return (
    <div className="qscc-savvy-wrap qscc-glass rounded-2xl border border-violet-500/30 p-5 sm:p-8 shadow-[0_0_60px_rgba(139,92,246,0.12)]">
      {banner ? (
        <div className="mb-4 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-100" role="status">
          {banner}
        </div>
      ) : null}

      <div className="qscc-trending-strip space-y-4 mb-8">
        <div className="text-xs font-black tracking-[0.2em] text-fuchsia-200/90 uppercase">Savvy radar</div>
        <TrendingRow title="Trending sneaker hunts" chips={TRENDING_SNEAKERS} runHunt={runHunt} />
        <TrendingRow title="Trending tech" chips={TRENDING_TECH} runHunt={runHunt} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TrendingRow title="Trending watches" chips={TRENDING_WATCHES} runHunt={runHunt} />
          <TrendingRow title="Trending BMW parts" chips={TRENDING_BMW} runHunt={runHunt} />
        </div>
        <TrendingRow title="Trending collectibles" chips={TRENDING_COLLECTIBLES} runHunt={runHunt} />
      </div>

      <div className="qscc-savvy-header flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-8">
        <div>
          <p className="text-xs font-black tracking-[0.22em] text-cyan-300/90 uppercase mb-2">Savvy Deal Intelligence</p>
          <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
            {SAVVY_SCOUT.shortTitle} found{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-fuchsia-400">{headerStats.count}</span>{' '}
            opportunities
          </h3>
          <div className="mt-3 flex flex-wrap gap-2 text-xs sm:text-sm font-bold">
            <span className={`qscc-savvy-pill ${headerStats.lowComp ? 'qscc-savvy-pill--hot' : ''}`}>
              {headerStats.lowComp ? 'LOW COMPETITION DETECTED' : 'MIXED COMPETITION'}
            </span>
            <span className="qscc-savvy-pill qscc-savvy-pill--cyan">
              BEST MOVE CONFIDENCE: {headerStats.confLabel}
            </span>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <ListingModeTabs mode={mode} onChange={setMode} />
          {mode === 'best_move' ? (
            <label className="text-xs text-slate-300 inline-flex items-center gap-2 whitespace-nowrap">
              <input type="checkbox" checked={showPass} onChange={(e) => setShowPass(e.target.checked)} />
              Show pass
            </label>
          ) : null}
        </div>
      </div>

      {showFallbackCard ? (
        <BestMoveFallbackCard
          fallback={fallbackBestMove}
          liveTick={liveTick}
          onMeaningfulView={onMeaningfulView}
          saveAlert={saveAlert}
          searchQuery={searchQuery}
        />
      ) : null}

      {cardsToRender.length === 0 && !showFallbackCard ? (
        <div className="rounded-2xl border border-amber-400/35 bg-amber-500/10 px-5 py-6 text-amber-100">
          <div className="text-xs font-black tracking-[0.2em] uppercase text-amber-200 mb-2">Savvy Scout scanning</div>
          <h4 className="text-xl font-black text-white">
            Savvy Scout is still scanning for legendary finds. Here&apos;s the strongest move available right now.
          </h4>
          <p className="text-sm text-amber-100/90 mt-2">
            Pulling from Auctions and Trending lanes — tap a hunt above while Savvy widens the search.
          </p>
        </div>
      ) : cardsToRender.length > 0 ? (
      <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {cardsToRender.map(({ item, risky, savings, savingsPct }, idx) => {
          const price = Number(item.buyNowPrice ?? item.currentBidPrice ?? item.price ?? 0);
          const market = Number(item.marketValue ?? 0);
          const seconds = Math.max(0, Number(item.secondsRemaining || 0) - liveTick);
          const bids = Number(item.bidCount || 0);
          const badges = buildTrustBadges(item);
          const url = item.itemWebUrl || item.itemUrl;

          return (
            <motion.article
              key={item.itemId}
              layout
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(0.35, idx * 0.04) }}
              className={`qscc-savvy-card group rounded-2xl overflow-hidden flex flex-col ${risky ? 'qscc-savvy-card--risky' : ''}`}
            >
              <div className="qscc-savvy-card__media relative aspect-[4/3] bg-slate-950">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={String(item.title || 'Listing')}
                    className="absolute inset-0 w-full h-full object-cover transition duration-500 group-hover:scale-[1.04]"
                    loading="lazy"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-xs font-bold tracking-wide">
                    No photo
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-90 pointer-events-none" />
                <div className="absolute top-2 left-2 right-2 flex flex-wrap gap-1">
                  {badges.map((b) => (
                    <span key={b.key} className={`qscc-trust-badge qscc-trust-badge--${b.tone}`}>
                      <span aria-hidden>{b.icon}</span> {b.label}
                    </span>
                  ))}
                </div>
                <div className="absolute bottom-2 left-2 right-2 flex justify-between items-end gap-2">
                  <span className="text-[10px] font-black tracking-wider text-white/90 bg-black/50 px-2 py-1 rounded-md border border-white/10">
                    ENDS {fmtTime(seconds)}
                  </span>
                  <span className="text-[10px] font-black text-amber-200 bg-amber-500/15 px-2 py-1 rounded-md border border-amber-400/30">
                    {bids} watching
                  </span>
                </div>
              </div>

              <div className="p-4 sm:p-5 flex flex-col flex-1 bg-gradient-to-b from-slate-900/40 to-slate-950/95">
                <div className="text-[10px] font-black tracking-[0.2em] text-rose-300 uppercase">🔥 Best move of the day</div>
                <h4 className="mt-1 text-white font-bold text-sm sm:text-base leading-snug line-clamp-2">{item.title}</h4>
                <div className="mt-3 text-xs text-slate-300 space-y-1.5">
                  <div><span className="text-slate-400">Market Value:</span> <span className="font-bold text-slate-100">{toMoney(market)}</span></div>
                  <div><span className="text-slate-400">Current Price:</span> <span className="font-bold text-slate-100">{toMoney(price)}</span></div>
                  <div className="text-emerald-300 font-black">YOU SAVE: {toMoney(savings)}{Number.isFinite(savingsPct) && savingsPct > 0 ? ` (${Math.round(savingsPct)}%)` : ''}</div>
                  <div><span className="text-slate-400">Trust Score:</span> <span className="font-bold text-cyan-200">{Math.round(Number(item.trustScore || 0))}%</span></div>
                  <div><span className="text-slate-400">Only</span> <span className="font-black text-amber-200">{Math.max(1, bids)}</span> <span className="text-slate-400">similar listings found.</span></div>
                  <div className="text-[11px] leading-relaxed text-violet-100/90 border border-violet-400/25 bg-violet-500/10 rounded-lg px-2.5 py-2 mt-2">
                    Savvy found this because the seller is highly trusted, the price is {Math.max(0, Math.round(Number(savingsPct || 0)))}% below market, and demand is increasing.
                  </div>
                </div>

                <QuickSnipeSavvyRewards item={item} effectiveSavings={savings} />

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="qscc-savvy-btn qscc-savvy-btn--buy"
                    onClick={() => {
                      onMeaningfulView(item, 'lane_buy');
                      if (url) window.open(url, '_blank', 'noopener,noreferrer');
                    }}
                  >
                    View Deal
                  </button>
                  <button type="button" className="qscc-savvy-btn qscc-savvy-btn--ghost" onClick={() => onMeaningfulView(item, 'lane_watch')}>
                    Watch
                  </button>
                  <button type="button" className="qscc-savvy-btn qscc-savvy-btn--ghost" onClick={() => onMeaningfulView(item, 'lane_pass')}>
                    Pass
                  </button>
                  <button type="button" className="qscc-savvy-btn qscc-savvy-btn--accent" onClick={() => saveAlert(item)}>
                    Save alert
                  </button>
                  <button
                    type="button"
                    className="qscc-savvy-btn qscc-savvy-btn--ghost"
                    disabled={!sellerUsername(item)}
                    onClick={() => openSeller(item)}
                  >
                    View seller
                  </button>
                </div>
              </div>
            </motion.article>
          );
        })}
      </div>
      ) : null}
    </div>
  );
}
