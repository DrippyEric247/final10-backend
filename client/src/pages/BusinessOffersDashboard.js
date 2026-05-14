import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import businessOffersService from "../services/businessOffersService";
import { incrementJourneyStep } from "../lib/tabJourney";
import "../styles/BusinessOffersOptimizer.css";

const HERO_LINES = [
  "Build my cookout under $100.",
  "Find the best grocery offers near me.",
  "Make me 5 healthy meals under budget.",
  "Optimize my gaming setup.",
  "Build my apartment essentials.",
  "Find matching products for my PS5.",
  "Plan a cheap family trip.",
  "Save me money on my next BBQ.",
  "Find all ingredients for tacos tonight.",
];

const REQUEST_HINTS = [
  "Build a $100 cookout",
  "Cheap gaming setup",
  "Healthy meals for a week",
  "Best buy-one-get-one offers",
  "Luxury setup under budget",
  "Road trip essentials",
  "Back-to-school setup",
  "Starter streaming room",
];

const REQUEST_CHIPS = [
  "Grocery",
  "Gaming",
  "Travel",
  "Home",
  "Automotive",
  "Fitness",
  "Fashion",
  "Tech",
  "Family",
  "Budget Mode",
  "Luxury Mode",
];

const SCENARIOS = [
  "Cookout Builder",
  "Cheap Apartment Setup",
  "New Parent Essentials",
  "College Dorm Build",
  "Starter Streamer Setup",
  "BMW Detail Kit",
  "Home Gym Under Budget",
  "Emergency Hurricane Prep",
  "Vacation Packing Build",
  "Gamer Battle Station",
];

const RETAILERS = ["Walmart", "Target", "Amazon", "Costco", "Best Buy", "Nike", "Adidas", "Sam's Club", "Home Depot"];

const RETAIL_BATTLE_ROWS = [
  { metric: "Price", values: ["A", "B", "A", "C", "B", "B", "A", "C", "B"] },
  { metric: "Bundle Score", values: ["B", "A", "B", "A", "A", "C", "B", "A", "B"] },
  { metric: "Cashback", values: ["A", "B", "B", "A", "B", "C", "C", "A", "B"] },
  { metric: "Shipping", values: ["B", "A", "A", "B", "A", "B", "B", "C", "B"] },
];

const SMART_CART_BY_KEYWORD = {
  ps5: ["DualSense Edge", "Charging Dock", "Gaming Headset", "PSVR2", "SSD Expansion", "Gaming Chair", "4K Monitor", "Snacks + Drinks", "Extended Warranty"],
  gaming: ["Mechanical Keyboard", "Low-Latency Mouse", "RGB Desk Mat", "Streaming Cam", "Capture Card", "Blue Light Glasses"],
  grocery: ["Protein Pack", "Grill Combo", "Hydration Bundle", "Bulk Pantry Stack", "Family Pack Produce"],
  bmw: ["Wheel Cleaner", "Ceramic Detail Kit", "Carbon Trim Set", "Ambient Light Kit", "Seat Protection Set"],
};

function useTypewriter(lines) {
  const [lineIndex, setLineIndex] = useState(0);
  const [charCount, setCharCount] = useState(0);
  useEffect(() => {
    const text = lines[lineIndex];
    const done = charCount >= text.length;
    const id = window.setTimeout(() => {
      if (!done) {
        setCharCount((n) => n + 1);
      } else {
        setCharCount(0);
        setLineIndex((n) => (n + 1) % lines.length);
      }
    }, done ? 1400 : 34);
    return () => window.clearTimeout(id);
  }, [lines, lineIndex, charCount]);
  return lines[lineIndex].slice(0, charCount);
}

function statCard(label, value, accent = "text-indigo-200") {
  return (
    <div className="rounded-xl border border-slate-600/30 bg-slate-900/55 p-4">
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`text-2xl font-black mt-1 ${accent}`}>{value}</div>
    </div>
  );
}

export default function BusinessOffersDashboard() {
  const qc = useQueryClient();
  const heroTyped = useTypewriter(HERO_LINES);
  const [hintIndex, setHintIndex] = useState(0);
  const [command, setCommand] = useState("");
  const [selectedChip, setSelectedChip] = useState("Budget Mode");
  const [liveNoticeIndex, setLiveNoticeIndex] = useState(0);

  const { data: overview } = useQuery({
    queryKey: ["business-offers-overview"],
    queryFn: businessOffersService.getOverview,
  });
  const { data: listData } = useQuery({
    queryKey: ["business-offers-list"],
    queryFn: businessOffersService.getMyOffers,
  });
  const offers = listData?.offers || [];

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => businessOffersService.updateStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["business-offers-list"] });
      qc.invalidateQueries({ queryKey: ["business-offers-overview"] });
      incrementJourneyStep("/business-offers", "toggle_offer", 1);
    },
  });

  useEffect(() => {
    incrementJourneyStep("/business-offers", "view_overview", 1);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setHintIndex((n) => (n + 1) % REQUEST_HINTS.length), 2400);
    return () => window.clearInterval(id);
  }, []);

  const notices = [
    "Deal detected: Grocery stack optimized across 3 retailers.",
    "Savvy AI optimized your purchase route for this week.",
    "Points spike: +420 projected from current build.",
    "Low shipping window opened for your tech bundle.",
  ];
  useEffect(() => {
    const id = window.setInterval(() => setLiveNoticeIndex((n) => (n + 1) % notices.length), 2600);
    return () => window.clearInterval(id);
  }, [notices.length]);

  const lowerCommand = command.toLowerCase();
  const smartItems = useMemo(() => {
    if (lowerCommand.includes("ps5")) return SMART_CART_BY_KEYWORD.ps5;
    if (lowerCommand.includes("gaming")) return SMART_CART_BY_KEYWORD.gaming;
    if (lowerCommand.includes("grocery") || lowerCommand.includes("cookout") || lowerCommand.includes("meal")) return SMART_CART_BY_KEYWORD.grocery;
    if (lowerCommand.includes("bmw") || lowerCommand.includes("auto")) return SMART_CART_BY_KEYWORD.bmw;
    return ["Starter Bundle", "Savings Pairing", "Smart Add-on", "Top Cashback Match", "Trust Optimized Choice"];
  }, [lowerCommand]);

  const projectedPoints = 180 + smartItems.length * 44 + (selectedChip === "Luxury Mode" ? 120 : 0);

  return (
    <div className="min-h-screen life-optimizer-bg text-white pt-20">
      <div className="optimizer-grid-overlay" aria-hidden />
      <div className="optimizer-scanline" aria-hidden />
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-7 relative z-10">
        <section className="optimizer-hero rounded-3xl p-6 md:p-8 overflow-hidden relative">
          <div className="optimizer-market-lines" aria-hidden />
          <div className="optimizer-coins" aria-hidden>
            {[0, 1, 2, 3].map((i) => <span key={i} style={{ animationDelay: `${i * 0.3}s` }} />)}
          </div>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-amber-300 font-bold">Savvy Life Optimizer</p>
              <h1 className="text-3xl md:text-5xl font-black tracking-tight bg-gradient-to-r from-indigo-200 via-violet-200 to-cyan-200 bg-clip-text text-transparent">
                AI-Powered Lifestyle Optimization
              </h1>
              <p className="text-slate-300 mt-2 max-w-3xl">
                An AI financial assistant + rewards engine + smart shopping strategist for every category of life.
              </p>
            </div>
            <Link
              to="/business-offers/create"
              className="rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-4 py-2 font-bold"
              onClick={() => incrementJourneyStep("/business-offers", "open_create_offer", 1)}
            >
              Create Offer
            </Link>
          </div>
          <div className="mt-5 text-lg text-emerald-200 font-semibold min-h-[2rem]">
            <span className="text-slate-400 mr-2">AI:</span>
            {heroTyped}
            <span className="optimizer-caret">|</span>
          </div>
        </section>

        <section className="optimizer-panel rounded-2xl p-5">
          <h2 className="text-sm uppercase tracking-[0.16em] text-violet-200 font-bold">Savvy AI Request Builder</h2>
          <div className="mt-3 flex flex-col md:flex-row gap-3">
            <input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder={REQUEST_HINTS[hintIndex]}
              className="optimizer-command-input flex-1"
            />
            <button type="button" className="optimizer-command-btn">Run Optimization</button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {REQUEST_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => setSelectedChip(chip)}
                className={`optimizer-chip ${selectedChip === chip ? "is-active" : ""}`}
              >
                {chip}
              </button>
            ))}
          </div>
        </section>

        <section className="optimizer-panel rounded-2xl p-5">
          <h2 className="text-xl font-black">AI SMART CART</h2>
          <p className="text-sm text-slate-300 mb-3">Users usually pair this with...</p>
          <div className="optimizer-horizontal-lane">
            {smartItems.map((it, i) => (
              <motion.article key={`${it}-${i}`} className="optimizer-item-card" whileHover={{ y: -4, scale: 1.01 }}>
                <div className="text-white font-semibold">{it}</div>
                <div className="text-xs text-emerald-300 mt-1">Market savings: ${22 + i * 8}</div>
                <div className="text-xs text-slate-300">Best retailer: {RETAILERS[i % RETAILERS.length]}</div>
                <div className="text-xs text-slate-300">Bundle bonus: +{8 + i * 3}%</div>
                <div className="text-xs text-amber-300">Savvy points: +{34 + i * 11}</div>
                <div className="text-xs text-slate-300">Trust: {i % 2 === 0 ? "HIGH" : "MED"} · AI score: {84 - i * 2}</div>
              </motion.article>
            ))}
          </div>
        </section>

        <section className="optimizer-panel rounded-2xl p-5">
          <h2 className="text-xl font-black mb-3">LIVE RETAIL BATTLEFIELD</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[840px]">
              <thead>
                <tr>
                  <th className="text-left p-2 text-slate-400">Metric</th>
                  {RETAILERS.map((r) => <th key={r} className="text-left p-2 text-slate-300">{r}</th>)}
                </tr>
              </thead>
              <tbody>
                {RETAIL_BATTLE_ROWS.map((row) => (
                  <tr key={row.metric} className="border-t border-slate-700/50">
                    <td className="p-2 text-slate-200 font-semibold">{row.metric}</td>
                    {row.values.map((v, idx) => <td key={`${row.metric}-${idx}`} className="p-2 text-cyan-200">{v}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 text-sm text-emerald-200 font-semibold">Savvy AI optimized your purchase route.</div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="optimizer-panel rounded-2xl p-5">
            <h2 className="text-xl font-black mb-3">SAVVY POINTS ENGINE</h2>
            <div className="space-y-2 text-sm text-slate-200">
              <div>Projected points earned: <span className="text-amber-300 font-bold">{projectedPoints}</span></div>
              <div>Seasonal boosts: +1.2x</div>
              <div>Streak bonus: +18%</div>
              <div>Partner boosts: +40 points</div>
            </div>
            <div className="optimizer-coin-flow mt-4" aria-hidden>
              {Array.from({ length: 6 }).map((_, i) => <span key={i} style={{ animationDelay: `${i * 0.18}s` }}>🪙</span>)}
            </div>
          </div>
          <div className="optimizer-panel rounded-2xl p-5">
            <h2 className="text-xl font-black mb-3">CHECKPOINTS TO SAVINGS</h2>
            <div className="space-y-2 text-sm">
              <div>Save $500 lifetime → unlock rewards</div>
              <div>Complete 10 AI builds → unlock calling card</div>
              <div>Build 5 grocery plans → unlock multiplier</div>
              <div>Finish gaming setup → unlock badge</div>
            </div>
            <div className="mt-4 h-3 rounded-full bg-slate-800 overflow-hidden">
              <motion.div className="h-full bg-gradient-to-r from-violet-500 to-cyan-400" animate={{ width: `${Math.min(96, 24 + smartItems.length * 8)}%` }} />
            </div>
          </div>
        </section>

        <section className="optimizer-panel rounded-2xl p-5">
          <h2 className="text-xl font-black mb-3">LIFE SCENARIOS</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {SCENARIOS.map((s, i) => (
              <motion.article key={s} className="optimizer-scenario-card" whileHover={{ y: -4 }}>
                <div className="font-bold text-white">🔥 {s}</div>
                <div className="text-xs text-slate-300 mt-2">Optimized budget: ${90 + i * 22}</div>
                <div className="text-xs text-slate-300">AI savings: ${28 + i * 7}</div>
                <div className="text-xs text-amber-300">Points earned: +{80 + i * 14}</div>
                <div className="text-xs text-slate-300">Bundle rewards + alternatives included</div>
              </motion.article>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {statCard("Total spend", `$${Number(overview?.totalSpend || 0).toFixed(2)}`, "text-fuchsia-200")}
          {statCard("Views", Number(overview?.views || 0))}
          {statCard("Clicks", Number(overview?.clicks || 0))}
          {statCard("Claims", Number(overview?.claims || 0), "text-emerald-200")}
          {statCard("Conversion", `${Number(overview?.conversionRate || 0).toFixed(1)}%`, "text-amber-200")}
          {statCard("Rewards", `${Number(overview?.rewardsDistributed || 0)} Savvy`, "text-yellow-200")}
        </section>

        <AnimatePresence mode="wait">
          <motion.div
            key={liveNoticeIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="optimizer-live-notice rounded-xl border border-cyan-400/35 bg-cyan-500/10 px-4 py-3 text-cyan-100 text-sm"
          >
            {notices[liveNoticeIndex]}
          </motion.div>
        </AnimatePresence>

        <div className="mt-2 rounded-2xl border border-slate-700 bg-slate-900/50 overflow-hidden">
          <div className="p-4 border-b border-slate-700 font-semibold">Offer Ops (Control Layer)</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="text-slate-400">
                <tr>
                  <th className="text-left p-3">Offer</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Performance</th>
                  <th className="text-left p-3">Budget</th>
                  <th className="text-left p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {offers.map((offer) => (
                  <tr key={offer._id} className="border-t border-slate-700/70">
                    <td className="p-3">
                      <div className="font-semibold">{offer.offerTitle}</div>
                      <div className="text-xs text-slate-400">{offer.businessName} · {offer.category} · {offer.promotionTier}</div>
                    </td>
                    <td className="p-3 capitalize">{offer.status}</td>
                    <td className="p-3 text-xs text-slate-300">{offer.stats?.views || 0} views / {offer.stats?.clicks || 0} clicks / {offer.stats?.claims || 0} claims</td>
                    <td className="p-3 text-xs text-slate-300">${Number(offer.spent || 0).toFixed(2)} / ${Number(offer.totalBudget || 0).toFixed(2)}</td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <button type="button" onClick={() => statusMutation.mutate({ id: offer._id, status: offer.status === "active" ? "paused" : "active" })} className="rounded-lg border border-indigo-400/45 bg-indigo-500/15 px-2.5 py-1 text-indigo-200">
                          {offer.status === "active" ? "Pause" : "Resume"}
                        </button>
                        <button type="button" onClick={() => statusMutation.mutate({ id: offer._id, status: "ended" })} className="rounded-lg border border-rose-400/45 bg-rose-500/15 px-2.5 py-1 text-rose-200">
                          End
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
