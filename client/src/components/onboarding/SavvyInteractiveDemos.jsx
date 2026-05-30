import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import "../../styles/SavvyInteractiveDemos.css";
import { ANALYTICS_EVENTS, trackEvent } from "../../lib/analytics";
import { SAVVY_SCOUT } from "../../config/savvyScoutBranding";

const FIRST_RUN_DONE_KEY = "f10_first_run_savvy_done_v1";
const DEMO_SEEN_KEY = "f10_interactive_demo_seen_v1";

const DEMOS = [
  {
    id: "quick-snipes",
    title: "Quick Snipes",
    durationMs: 8600,
    summary: "Savvy already did the hard part.",
  },
  {
    id: "smart-cart",
    title: "Smart Cart",
    durationMs: 8200,
    summary: "Savvy optimized your cart automatically.",
  },
  {
    id: "alerts",
    title: "Alert System",
    durationMs: 8200,
    summary: "Savvy waits and strikes at the right window.",
  },
  {
    id: "scanner",
    title: "Video Scanner",
    durationMs: 8000,
    summary: "Savvy uncovers products hidden inside videos.",
  },
  {
    id: "seller-signals",
    title: "Seller Signals",
    durationMs: 7600,
    summary: "Savvy turns market pressure into timing advantage.",
  },
  {
    id: "points",
    title: "Savvy Points Engine",
    durationMs: 7600,
    summary: "Every action compounds your rank momentum.",
  },
];

const GUIDE_BY_ROUTE = [
  { pattern: /^\/local-deals\b/, label: "Quick Snipes", selector: ".qscc-live-hero, #video-url, h1" },
  { pattern: /^\/alerts\b/, label: "Alerts", selector: "#alerts-quick-topic, h1" },
  { pattern: /^\/scanner\b/, label: "Video Scanner", selector: "#video-url, .scanner-dock" },
  { pattern: /^\/seller-trends\b/, label: "Seller Signals", selector: "h1, [class*='seller-trends']" },
  { pattern: /^\/feed\b/, label: "Smart Cart", selector: ".smart-cart-wrap, [data-tour='feed-categories']" },
  { pattern: /^\/win-feed\b/, label: "Savvy Wins", selector: "h1, main" },
];

const GUIDE_STORIES = {
  "Quick Snipes": ["Scanning live listings...", "Locking on under-market move...", "Best Move Found. Execute now."],
  Alerts: ["Reading your target...", "Monitoring market weakness...", "Deal found window opening."],
  "Video Scanner": ["Parsing video frames...", "Matching hidden products...", "Under-market listing surfaced."],
  "Seller Signals": ["Tracking demand velocity...", "Checking inventory pressure...", "Profit opportunity detected."],
  "Smart Cart": ["Expanding your setup...", "Finding bundle savings...", "Cart optimized automatically."],
  "Savvy Wins": ["Tracking streak momentum...", "Stacking reward multipliers...", "Rank-up path unlocked."],
};

function getRouteGuide(pathname) {
  return GUIDE_BY_ROUTE.find((x) => x.pattern.test(pathname)) || null;
}

function typedValue(text, pct) {
  const n = Math.max(0, Math.min(text.length, Math.floor((pct / 100) * text.length)));
  return text.slice(0, n);
}

function DemoScene({ demo, pct }) {
  const lockOn = pct > 42;
  const reveal = pct > 62;
  const burst = pct > 75;

  if (demo.id === "quick-snipes") {
    const scans = Math.min(100, pct * 1.7);
    return (
      <div className="sid-scene">
        <div className="sid-chaos-grid">
          {["PS5", "Rolex", "Jordan 4", "MacBook", "RTX 4090"].map((it, i) => (
            <div key={it} className={`sid-chaos-item ${pct > i * 13 ? "is-on" : ""}`}>
              {it} · ${[549, 5100, 269, 1099, 1299][i]}
            </div>
          ))}
        </div>
        <div className="sid-scan-wrap">
          <div className="sid-scanbar" style={{ width: `${scans}%` }} />
          <div className={`sid-reticle ${lockOn ? "is-on" : ""}`} />
          <div className={`sid-signal ${reveal ? "is-on" : ""}`}>UNDER MARKET DETECTED</div>
        </div>
        <div className={`sid-stats ${burst ? "is-on" : ""}`}>
          <span>SAVE $178</span><span>LOW COMPETITION</span><span>HIGH TRUST</span>
        </div>
      </div>
    );
  }

  if (demo.id === "smart-cart") {
    const cmd = typedValue("Cookout for 8 people", pct * 1.2);
    const added = Math.floor((pct / 100) * 5);
    const items = ["Burgers", "Charcoal", "Buns", "Drinks", "Sauces"];
    return (
      <div className="sid-scene">
        <div className="sid-command-line">{cmd}<span className="sid-caret">|</span></div>
        <div className="sid-list">
          {items.map((it, i) => (
            <div key={it} className={`sid-list-item ${added > i ? "is-on" : ""}`}>+ {it}</div>
          ))}
        </div>
        <div className={`sid-signal ${pct > 62 ? "is-on" : ""}`}>SAVED $43 · BUNDLE ROUTE FOUND</div>
      </div>
    );
  }

  if (demo.id === "alerts") {
    const cmd = typedValue("Jordan 4 under $180", pct * 1.25);
    return (
      <div className="sid-scene">
        <div className="sid-command-line">{cmd}<span className="sid-caret">|</span></div>
        <div className="sid-radar">
          <div className={`sid-radar-ring ${pct > 28 ? "is-on" : ""}`} />
          <div className={`sid-radar-ring ${pct > 45 ? "is-on" : ""}`} />
          <div className={`sid-radar-ring ${pct > 60 ? "is-on" : ""}`} />
        </div>
        <div className={`sid-stats ${pct > 58 ? "is-on" : ""}`}>
          <span>TARGET LOCKED</span><span>LOW COMPETITION DETECTED</span><span>DEAL FOUND</span>
        </div>
      </div>
    );
  }

  if (demo.id === "scanner") {
    const frames = Math.min(100, pct * 1.45);
    return (
      <div className="sid-scene">
        <div className="sid-video-frame">
          <div className="sid-video-scan" style={{ top: `${frames}%` }} />
          {pct > 28 ? <div className="sid-detect-box box-a">Shoes</div> : null}
          {pct > 44 ? <div className="sid-detect-box box-b">Keyboard</div> : null}
          {pct > 60 ? <div className="sid-detect-box box-c">Headset</div> : null}
        </div>
        <div className={`sid-signal ${pct > 68 ? "is-on" : ""}`}>FOUND UNDER MARKET</div>
      </div>
    );
  }

  if (demo.id === "seller-signals") {
    const up = Math.max(8, Math.floor(pct * 0.7));
    return (
      <div className="sid-scene">
        <div className="sid-chart">
          <div className="sid-chart-line" style={{ clipPath: `polygon(0% 100%, 0% ${100 - up}%, 100% ${26 - Math.min(20, up / 2)}%, 100% 100%)` }} />
        </div>
        <div className={`sid-list-item ${pct > 36 ? "is-on" : ""}`}>Jordan demand rising.</div>
        <div className={`sid-list-item ${pct > 52 ? "is-on" : ""}`}>Low inventory in size 10-11.</div>
        <div className={`sid-signal ${pct > 70 ? "is-on" : ""}`}>PROFIT OPPORTUNITY DETECTED</div>
      </div>
    );
  }

  const coins = Math.floor((pct / 100) * 10);
  const multi = (1 + pct / 66).toFixed(1);
  return (
    <div className="sid-scene">
      <div className="sid-points-row">
        <div className={`sid-list-item ${pct > 24 ? "is-on" : ""}`}>Saved Item +20</div>
        <div className={`sid-list-item ${pct > 42 ? "is-on" : ""}`}>Created Alert +35</div>
        <div className={`sid-list-item ${pct > 57 ? "is-on" : ""}`}>Found Deal +40</div>
      </div>
      <div className="sid-wallet">
        <div className={`sid-wallet-coins ${pct > 52 ? "is-on" : ""}`}>{"🪙".repeat(Math.max(1, Math.min(10, coins)))}</div>
        <div className="sid-wallet-main">Wallet +{coins * 12} · x{multi}</div>
      </div>
      <div className={`sid-signal ${pct > 70 ? "is-on" : ""}`}>SAVVY SNIPER RANK UP</div>
    </div>
  );
}

export default function SavvyInteractiveDemos({ enabled }) {
  const location = useLocation();
  const routeGuide = useMemo(() => getRouteGuide(location.pathname), [location.pathname]);
  const carouselOpenedRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const [guidedOpen, setGuidedOpen] = useState(false);
  const [box, setBox] = useState(null);
  const [guideStep, setGuideStep] = useState(0);
  const [sceneMs, setSceneMs] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    try {
      const done = localStorage.getItem(FIRST_RUN_DONE_KEY) === "1";
      const seen = localStorage.getItem(DEMO_SEEN_KEY) === "1";
      if (!done || seen) return;
      const t = window.setTimeout(() => setOpen(true), 900);
      return () => window.clearTimeout(t);
    } catch {
      return undefined;
    }
  }, [enabled]);

  useEffect(() => {
    if (!open) {
      carouselOpenedRef.current = false;
      return;
    }
    if (!carouselOpenedRef.current) {
      carouselOpenedRef.current = true;
      trackEvent(ANALYTICS_EVENTS.DEMO_STARTED, { variant: "interactive_carousel" });
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const activeDemo = DEMOS[idx];
    setSceneMs(0);
    const t = window.setInterval(() => {
      setSceneMs((n) => {
        const next = n + 120;
        if (next >= activeDemo.durationMs) {
          setIdx((cur) => (cur + 1) % DEMOS.length);
          return 0;
        }
        return next;
      });
    }, 120);
    return () => window.clearInterval(t);
  }, [open, idx]);

  useEffect(() => {
    if (!guidedOpen) return undefined;
    const guide = getRouteGuide(location.pathname);
    if (!guide) return undefined;
    const target = document.querySelector(guide.selector);
    if (!target) {
      setBox(null);
      return undefined;
    }
    const update = () => {
      const r = target.getBoundingClientRect();
      setBox({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [guidedOpen, location.pathname]);

  useEffect(() => {
    if (!guidedOpen || !routeGuide) return undefined;
    setGuideStep(0);
    const steps = GUIDE_STORIES[routeGuide.label] || [];
    if (!steps.length) return undefined;
    const t = window.setInterval(() => setGuideStep((n) => (n + 1) % steps.length), 1800);
    return () => window.clearInterval(t);
  }, [guidedOpen, routeGuide]);

  const demo = DEMOS[idx];
  const progressPct = Math.max(0, Math.min(100, (sceneMs / demo.durationMs) * 100));

  const closeDemo = () => {
    trackEvent(ANALYTICS_EVENTS.DEMO_COMPLETED, {
      variant: "interactive_carousel",
      action: "start_exploring",
    });
    setOpen(false);
    try {
      localStorage.setItem(DEMO_SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  if (!enabled) return null;

  return (
    <>
      {routeGuide ? (
        <button
          className="savvy-guide-fab"
          type="button"
          onClick={() => {
            trackEvent(ANALYTICS_EVENTS.DEMO_STARTED, {
              variant: "guided_highlight",
              route: routeGuide.label,
            });
            setGuidedOpen(true);
          }}
        >
          Show Me How This Works
        </button>
      ) : null}

      <AnimatePresence>
        {open ? (
          <motion.div className="savvy-demo-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="savvy-demo-panel" initial={{ scale: 0.95, y: 18 }} animate={{ scale: 1, y: 0 }}>
              <div className="savvy-demo-orb" aria-hidden />
              <div className="savvy-demo-eyebrow">Savvy Interactive Demos</div>
              <AnimatePresence mode="wait">
                <motion.div key={demo.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                  <h3>{demo.title}</h3>
                  <DemoScene demo={demo} pct={progressPct} />
                  <div className="savvy-demo-highlight">{demo.summary}</div>
                  <div className="sid-progress-track">
                    <div className="sid-progress-bar" style={{ width: `${progressPct}%` }} />
                  </div>
                </motion.div>
              </AnimatePresence>
              <div className="savvy-demo-actions">
                <button type="button" onClick={() => setIdx((n) => (n + DEMOS.length - 1) % DEMOS.length)}>Back</button>
                <button type="button" onClick={() => setIdx((n) => (n + 1) % DEMOS.length)}>Next Demo</button>
                <button type="button" onClick={closeDemo}>Start Exploring</button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {guidedOpen && routeGuide ? (
          <motion.div className="savvy-guided-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {box ? (
              <motion.div
                className="savvy-guided-highlight"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, top: box.top - 6, left: box.left - 6, width: box.width + 12, height: box.height + 12 }}
              />
            ) : null}
            <motion.div className="savvy-guided-panel" initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
              <div className="savvy-guided-title">{SAVVY_SCOUT.shortTitle} Guide · {routeGuide.label}</div>
              <p>
                Watch this area first. Savvy highlights the highest-leverage move and automates the hard comparison work.
                One action here starts your momentum loop.
              </p>
              <div className="savvy-guided-step">{(GUIDE_STORIES[routeGuide.label] || [])[guideStep]}</div>
              <button
                type="button"
                onClick={() => {
                  trackEvent(ANALYTICS_EVENTS.DEMO_COMPLETED, {
                    variant: "guided_highlight",
                    route: routeGuide.label,
                    action: "got_it",
                  });
                  setGuidedOpen(false);
                }}
              >
                Got it
              </button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
