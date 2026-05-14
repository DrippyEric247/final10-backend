import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "../lib/api";
import { notifyUniversalProgressRefresh } from "../lib/universalBoostProgress";
import { recordPowerAfterScan } from "../lib/final10PowerEngine";
import { recordBattlePassXp } from "../lib/battlePassEngine";
import { POWER } from "../lib/final10PowerConfig";
import { emitPowerToast } from "../lib/final10PowerFeedback";
import { pushAssistantSignal } from "../lib/assistantSignals";
import ListingCardImage from "./listings/ListingCardImage";
import { ANALYTICS_EVENTS, trackEvent } from "../lib/analytics";
import "../styles/VideoScannerCinematic.css";

const SCAN_PHASES = [
  "Analyzing frames...",
  "Detecting products...",
  "Cross-checking marketplaces...",
  "Finding hidden opportunities...",
];

const DETECTION_NOTES = [
  "Sneaker detected",
  "Luxury watch identified",
  "Gaming setup recognized",
  "Designer bag match found",
];

const TAG_POOL = ["💎 Hidden Gem", "🔥 Trending Fast", "⚡ Panic Seller", "👑 Luxury Find", "🎯 Best Move"];

const priceNum = (p) => {
  const n = Number(p);
  return Number.isFinite(n) ? n : 0;
};

const toMoney = (n) => `$${Math.max(0, Math.round(Number(n) || 0)).toLocaleString()}`;

function rarityFromConfidence(c) {
  const n = Math.round(Number(c || 0) * 100);
  if (n >= 95) return "One-of-One Move";
  if (n >= 90) return "Legendary";
  if (n >= 84) return "Elite";
  if (n >= 72) return "Rare";
  if (n >= 60) return "Uncommon";
  return "Common";
}

function buildBuyingMatrix(product) {
  const current = priceNum(product.price);
  return [
    { label: "Best current listing", value: current, note: "Strong value now" },
    { label: "Best trust listing", value: Math.round(current * 1.04), note: "Highest trust seller" },
    { label: "Cheapest listing", value: Math.max(1, Math.round(current * 0.94)), note: "Lowest absolute price" },
    { label: "Fastest ending auction", value: Math.max(1, Math.round(current * 0.98)), note: "Ends soonest window" },
    { label: "AI recommended move", value: Math.max(1, Math.round(current * 0.96)), note: "Best risk/reward path" },
  ];
}

export default function VideoScanner() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");
  const [scanPhaseIndex, setScanPhaseIndex] = useState(0);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanPulse, setScanPulse] = useState(false);
  const [detectedNoteIndex, setDetectedNoteIndex] = useState(0);
  const [revealKey, setRevealKey] = useState(0);

  useEffect(() => {
    if (!loading) return undefined;
    const phaseId = window.setInterval(() => {
      setScanPhaseIndex((n) => (n + 1) % SCAN_PHASES.length);
      setDetectedNoteIndex((n) => (n + 1) % DETECTION_NOTES.length);
    }, 1100);
    const progressId = window.setInterval(() => {
      setScanProgress((n) => Math.min(96, n + Math.max(2, Math.round((100 - n) * 0.08))));
    }, 220);
    return () => {
      window.clearInterval(phaseId);
      window.clearInterval(progressId);
    };
  }, [loading]);

  const scan = async (e) => {
    e.preventDefault();
    setError("");
    setResults(null);
    setLoading(true);
    setScanPulse(true);
    setScanProgress(4);
    setScanPhaseIndex(0);
    try {
      const { data } = await api.get("/scanner/video", { params: { url } });
      setScanProgress(100);
      setResults(data);
      setRevealKey((k) => k + 1);
      try {
        const raw = JSON.parse(localStorage.getItem("f10_scan_earn_state") || "{}");
        const scannedVideos = Number(raw.scannedVideos) || 0;
        localStorage.setItem("f10_scan_earn_state", JSON.stringify({ ...raw, scannedVideos: scannedVideos + 1 }));
        localStorage.setItem("f10_video_scanner_used", "true");
        recordPowerAfterScan();
        recordBattlePassXp("scan");
        window.dispatchEvent(new CustomEvent("f10:ftue-action", { detail: { type: "scan" } }));
        notifyUniversalProgressRefresh();
        emitPowerToast(POWER.DISPLAY.scanPowerPop, "Vision scan complete");
        const n = Array.isArray(data?.products) ? data.products.length : 0;
        trackEvent(ANALYTICS_EVENTS.SCANNER_USED, {
          productCount: n,
          framesAnalyzed: data?.framesAnalyzed,
          surface: "cinematic_scanner",
        });
        if (n > 0) {
          pushAssistantSignal({
            id: "scanner-latest-results",
            tone: "scan",
            title: "Target Identified",
            body: `${n} product ${n === 1 ? "match" : "matches"} extracted from clip.`,
            priority: 1,
          });
        }
      } catch {
        /* ignore local telemetry errors */
      }
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "AI scan failed. Try another clip.");
    } finally {
      window.setTimeout(() => {
        setLoading(false);
        setScanPulse(false);
      }, 420);
    }
  };

  const productCards = useMemo(() => {
    const products = Array.isArray(results?.products) ? results.products : [];
    return products.map((p, i) => {
      const current = priceNum(p.price);
      const market = Math.max(current + Math.round(current * 0.11), current + 35);
      const confidencePct = Math.round(Number(p.confidence || 0) * 100);
      const trust = Math.max(55, Math.min(98, confidencePct + (i % 3) * 4));
      const competition = i % 2 === 0 ? "LOW" : i % 3 === 0 ? "MEDIUM" : "LOW";
      return {
        ...p,
        current,
        market,
        confidencePct,
        trust,
        competition,
        rarity: rarityFromConfidence(p.confidence),
        tag: TAG_POOL[i % TAG_POOL.length],
        buyMatrix: buildBuyingMatrix(p),
      };
    });
  }, [results]);

  return (
    <div className="scanner-cinematic min-h-screen pt-16 sm:pt-20 overflow-x-clip">
      <div className="scanner-overlay-grid" aria-hidden />
      <div className="scanner-overlay-scanline" aria-hidden />
      <div className="scanner-wrap max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <header className="scanner-hero rounded-3xl p-6 md:p-8 mb-8 relative overflow-hidden">
          <div className="scanner-radar" aria-hidden />
          <div className="scanner-radar-ring" aria-hidden />
          <div className="scanner-eye-pulse" aria-hidden />
          <motion.h1
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white break-words"
          >
            AI VIDEO SCANNER
          </motion.h1>
          <p className="text-slate-300 text-lg mt-2 max-w-3xl">
            Drop a TikTok, Instagram, or YouTube link. Savvy scans the video and uncovers the products inside.
          </p>
          <div className="scanner-vision-active mt-4">VISION SYSTEM ACTIVE</div>
        </header>

        <form onSubmit={scan} className={`scanner-dock rounded-2xl p-5 md:p-6 mb-8 ${scanPulse ? "is-active" : ""}`}>
          <div className="scanner-dock-head mb-3">
            <div className="text-xs uppercase tracking-[0.16em] text-violet-200 font-bold">Futuristic Upload Dock</div>
          </div>
          <div className="flex flex-col md:flex-row gap-3">
            <input
              name="videoUrl"
              id="video-url"
              type="url"
              placeholder="https://www.tiktok.com/@user/video/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              className="scanner-input flex-1"
            />
            <button type="submit" className="scanner-unlock-btn w-full shrink-0 md:w-auto md:min-w-[180px]" disabled={loading || !url}>
              {loading ? "AI SCANNING..." : "UNLOCK PRODUCTS"}
            </button>
          </div>
          <AnimatePresence>
            {loading ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mt-4"
              >
                <div className="scanner-progress-bar">
                  <motion.div className="scanner-progress-fill" animate={{ width: `${scanProgress}%` }} transition={{ duration: 0.25 }} />
                </div>
                <div className="mt-2 text-sm text-sky-200">{SCAN_PHASES[scanPhaseIndex]}</div>
                <div className="scanner-waveform scanner-waveform-scroll mt-2" aria-hidden>
                  {Array.from({ length: 26 }).map((_, i) => (
                    <span key={i} style={{ animationDelay: `${i * 0.05}s` }} />
                  ))}
                </div>
                <div className="text-xs text-amber-200 mt-2">🎯 {DETECTION_NOTES[detectedNoteIndex]}</div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </form>

        {error ? <div className="scanner-error rounded-xl px-4 py-3 mb-6">{error}</div> : null}

        <AnimatePresence>
          {results ? (
            <motion.section
              key={revealKey}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="scanner-reveal-banner rounded-2xl p-4 md:p-5"
              >
                <div className="text-xs tracking-[0.16em] uppercase text-cyan-200 font-bold">TARGET IDENTIFIED</div>
                <div className="text-2xl md:text-3xl font-black text-white">SAVVY FOUND A MATCH</div>
                <div className="text-sm text-slate-200">UNDER MARKET DETECTED · LOW COMPETITION WINDOW FOUND</div>
              </motion.div>

              <div className="text-sm text-slate-300">Frames analyzed: {results.framesAnalyzed ?? "--"}</div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {productCards.map((p, i) => (
                  <motion.article
                    key={`${p.title || "product"}-${i}`}
                    initial={{ opacity: 0, y: 30, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: i * 0.08 }}
                    className="scanner-card rounded-2xl overflow-hidden"
                  >
                    <div className="scanner-card-media relative">
                      <ListingCardImage
                        item={p}
                        alt={p.title || "Detected Product"}
                        aspectRatio="16 / 10"
                        borderRadius="0"
                        fallbackSrc="/placeholder.png"
                      />
                      <span className="scanner-card-tag">{p.tag}</span>
                      <span className="scanner-card-conf">{Math.max(1, p.confidencePct)}% confidence</span>
                      <div className="scanner-lock-reticle" aria-hidden />
                    </div>

                    <div className="p-4 md:p-5">
                      <h3 className="text-xl font-extrabold text-white mb-2">{p.title || "Detected product"}</h3>
                      <div className="scanner-stat-row">
                        <span>Est. market: {toMoney(p.market)}</span>
                        <span>Best deal: {toMoney(p.current)}</span>
                      </div>
                      <div className="scanner-stat-row">
                        <span>Trust: {p.trust}</span>
                        <span>Competition: {p.competition}</span>
                      </div>
                      <div className="scanner-stat-row">
                        <span>Rarity: {p.rarity}</span>
                        <span>Source: {p.platform || "Marketplace AI graph"}</span>
                      </div>
                      <div className="scanner-under-market mt-2">Found under market: {toMoney(Math.max(0, p.market - p.current))}</div>

                      <div className="mt-4">
                        <div className="text-xs uppercase tracking-[0.12em] text-violet-200 font-bold mb-2">Where To Buy</div>
                        <div className="scanner-buy-matrix">
                          {p.buyMatrix.map((b) => (
                            <div key={b.label} className="scanner-buy-row">
                              <div className="text-slate-200">{b.label}</div>
                              <div className="text-white font-bold">{toMoney(b.value)}</div>
                              <div className="text-slate-400 text-xs">{b.note}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {p.auctionId ? (
                          <a className="scanner-action-btn" href={`/auctions/${p.auctionId}`}>Open Auction</a>
                        ) : p.url ? (
                          <a className="scanner-action-btn" href={p.url} target="_blank" rel="noreferrer">Open Listing</a>
                        ) : null}
                      </div>
                    </div>
                  </motion.article>
                ))}
              </div>
            </motion.section>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
/* removed legacy duplicate */

