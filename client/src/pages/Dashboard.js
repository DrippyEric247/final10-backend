import CopyField from "../components/CopyField";
import { makeReferralLink } from "../lib/referrals";
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  Bell, 
  Zap,
  Target,
  Radar,
  Gauge,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import FirstSixtyLanding from '../components/onboarding/FirstSixtyLanding';
import AttributionBanner from '../components/onboarding/AttributionBanner';
import BuildWarsBanner from '../components/BuildWarsBanner';
import { SCOUT_LABELS, SAVVY_SCOUT } from '../config/savvyScoutBranding';
import "../styles/LiveSavvyNetwork.css";

const Dashboard = () => {
  const { user } = useAuth();
  const referralLink = user?._id ? makeReferralLink(user._id) : "";
  const [heroStatusIdx, setHeroStatusIdx] = useState(0);
  const [goalMetricIdx, setGoalMetricIdx] = useState(0);
  const [goalProgress, setGoalProgress] = useState(54);
  const [goalPulse, setGoalPulse] = useState(false);
  const [marketTick, setMarketTick] = useState(0);
  const [alertIdx, setAlertIdx] = useState(0);
  const [tipIdx, setTipIdx] = useState(0);

  const heroStatuses = useMemo(() => ([
    "Beta — live scan stats coming soon",
    "Hunt ending auctions",
    "Lock alerts on your targets",
    `${SAVVY_SCOUT.shortTitle} is learning your picks`,
  ]), []);

  const goalMetrics = useMemo(() => ([
    { label: "Beta testers", value: "Early access", reward: "Help shape launch rewards together" },
    { label: "Community goals", value: "Coming soon", reward: "Live totals at public launch" },
    { label: "Savvy rewards", value: "Earn now", reward: "Complete missions and daily tasks" },
    { label: "Alerts", value: "Your picks", reward: "Create your first alert to start" },
    { label: "Best Moves", value: "Personalized", reward: "Finish onboarding for your first pick" },
    { label: "Win feed", value: "Real wins", reward: "Post your first Savvy Win" },
    { label: "Leaderboard", value: "Preview", reward: "Rankings update as players compete" },
  ]), []);

  const quickActions = useMemo(() => ([
    { title: "Hunt Ending Auctions", helper: "Deploy instantly.", href: "/auctions", icon: <Target className="w-5 h-5" /> },
    { title: "Lock New Alert", helper: "Fastest route to opportunity.", href: "/alerts", icon: <Bell className="w-5 h-5" /> },
    { title: "Scan a Video", helper: "AI already prepped this lane.", href: "/scanner", icon: <Radar className="w-5 h-5" /> },
    { title: "Enter Quick Snipes", helper: "Strike under-market windows now.", href: "/local-deals", icon: <Zap className="w-5 h-5" /> },
    { title: "Build a Bundle", helper: "Compound savings + Savvy rewards.", href: "/feed", icon: <Sparkles className="w-5 h-5" /> },
    { title: "Launch Seller Signals", helper: "Read pressure before everyone else.", href: "/seller-trends", icon: <Gauge className="w-5 h-5" /> },
  ]), []);

  const marketItems = useMemo(() => ([
    { name: "Jordan 4 Military Black", save: "$178", trust: 92, comp: "Low", ai: 94, time: "08:41" },
    { name: "Rolex Submariner", save: "$640", trust: 96, comp: "Mid", ai: 90, time: "21:18" },
    { name: "PS5 Disc Bundle", save: "$89", trust: 88, comp: "Low", ai: 93, time: "05:28" },
    { name: "BMW M Wheels", save: "$312", trust: 91, comp: "Mid", ai: 89, time: "13:46" },
    { name: "RTX 4090", save: "$244", trust: 86, comp: "High", ai: 85, time: "03:59" },
  ]), []);

  const liveAlerts = useMemo(() => ([
    { text: `${SAVVY_SCOUT.shortTitle} found 22% under-market PS5.`, time: "Just now", rarity: "rare" },
    { text: "Jordan demand spiking in size 10.5.", time: "12s ago", rarity: "epic" },
    { text: "Low competition detected in camera auctions.", time: "34s ago", rarity: "common" },
    { text: "Seller panic detected on RTX listings.", time: "1m ago", rarity: "legendary" },
    { text: "Luxury watch lane heating up.", time: "2m ago", rarity: "rare" },
    { text: "3 users just locked this deal.", time: "3m ago", rarity: "epic" },
  ]), []);

  const proTips = useMemo(() => ([
    "Late-night auctions usually have lower bid pressure.",
    "Use Seller Signals before entering hot markets.",
    "Bundle builds multiply Savvy rewards.",
    "Watch low-photo listings for hidden value.",
    "Luxury listings peak during weekends.",
  ]), []);

  useEffect(() => {
    const t = window.setInterval(() => setHeroStatusIdx((n) => (n + 1) % heroStatuses.length), 2800);
    return () => window.clearInterval(t);
  }, [heroStatuses.length]);

  useEffect(() => {
    const t = window.setInterval(() => setGoalMetricIdx((n) => (n + 1) % goalMetrics.length), 3600);
    return () => window.clearInterval(t);
  }, [goalMetrics.length]);

  useEffect(() => {
    const t = window.setInterval(() => {
      setGoalProgress((n) => {
        const next = n + 0.45;
        if (next >= 100) {
          setGoalPulse(true);
          window.setTimeout(() => setGoalPulse(false), 1200);
          return 18;
        }
        return next;
      });
    }, 230);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    const t = window.setInterval(() => setMarketTick((n) => (n + 1) % marketItems.length), 2800);
    return () => window.clearInterval(t);
  }, [marketItems.length]);

  useEffect(() => {
    const t = window.setInterval(() => setAlertIdx((n) => (n + 1) % liveAlerts.length), 2600);
    return () => window.clearInterval(t);
  }, [liveAlerts.length]);

  useEffect(() => {
    const t = window.setInterval(() => setTipIdx((n) => (n + 1) % proTips.length), 6200);
    return () => window.clearInterval(t);
  }, [proTips.length]);

  const activeMetric = goalMetrics[goalMetricIdx];
  const activeAlert = liveAlerts[alertIdx];

  return (
    <div className="live-savvy-network min-h-screen pt-20">
      {/* First-time visitor: 60-second value explainer (only when no user). */}
      {!user ? <FirstSixtyLanding /> : null}

      <div className="lsn-backdrop" aria-hidden>
        <span className="lsn-grid" />
        <span className="lsn-sweep" />
        <span className="lsn-particles" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        {/* Attribution confirmation: "You joined through @creator" */}
        <AttributionBanner user={user} />
        {user ? <BuildWarsBanner /> : null}
        {user ? (
          <p className="events-hint" style={{ marginBottom: '1rem' }}>
            🎪 Live events, drops, and Scout Support —{' '}
            <Link to="/events" style={{ color: '#c4b5fd', fontWeight: 600 }}>
              open Events Hub
            </Link>
          </p>
        ) : null}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="lsn-hero mb-8"
        >
          <div className="lsn-hero-kicker">LIVE SAVVY NETWORK</div>
          <h1>
            {user ? <>Welcome back, <span>{user?.firstName}</span>.</> : <>Welcome back, Operator.</>}
          </h1>
          <p>The market moved while you were away.</p>
          <motion.div key={heroStatusIdx} className="lsn-status-bar" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            {heroStatuses[heroStatusIdx]}
          </motion.div>
        </motion.div>

        <motion.div className={`lsn-goals ${goalPulse ? "is-pulse" : ""}`} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
          <div className="lsn-goals-head">
            <div>
              <div className="lsn-goals-kicker">COMMUNITY GOALS · BETA PREVIEW</div>
              <h3>When the community wins, everyone earns.</h3>
            </div>
            <div className="lsn-goals-metric">
              <span>{activeMetric.label}</span>
              <strong>{activeMetric.value}</strong>
            </div>
          </div>
          <div className="lsn-goal-track">
            <div className="lsn-goal-energy" style={{ width: `${goalProgress}%` }} />
          </div>
          <div className="lsn-goals-foot">
            <span>{goalProgress.toFixed(1)}% synced</span>
            <span>{goalPulse ? "GOAL COMPLETED · COIN BURST" : activeMetric.reward}</span>
          </div>
        </motion.div>

        <motion.div className="mb-8" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
          <h2 className="lsn-section-title">QUICK DEPLOY</h2>
          <div className="lsn-quick-grid">
            {quickActions.map((action) => (
              <Link key={action.title} to={action.href} className="lsn-quick-card">
                <div className="lsn-quick-icon">{action.icon}</div>
                <h3>{action.title}</h3>
                <p>{action.helper}</p>
              </Link>
            ))}
          </div>
        </motion.div>

        <motion.div className="grid lg:grid-cols-5 gap-6 mb-8" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
          <div className="lsn-feed col-span-3">
            <div className="lsn-feed-head">
              <h3><TrendingUp className="w-5 h-5" /> TRENDING AUCTIONS — LIVE MARKET FEED</h3>
              <div className="flex items-center gap-2">
                <span className="chip">Preview</span>
                <Link to="/auctions">View all</Link>
              </div>
            </div>
            <div className="lsn-feed-lane">
              {marketItems.map((item, i) => {
                const shifted = (i - marketTick + marketItems.length) % marketItems.length;
                return (
                  <div key={item.name} className={`lsn-market-card pos-${shifted}`}>
                    <div className="lsn-market-hot">HOT</div>
                    <h4>{item.name}</h4>
                    <div className="lsn-market-row"><span>Save</span><strong>{item.save}</strong></div>
                    <div className="lsn-market-row"><span>Trust</span><strong>{item.trust}%</strong></div>
                    <div className="lsn-market-row"><span>Competition</span><strong>{item.comp}</strong></div>
                    <div className="lsn-market-row"><span>{SCOUT_LABELS.confidenceTitle}</span><strong>{item.ai}%</strong></div>
                    <div className="lsn-market-time">Ends in {item.time}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="lsn-alerts col-span-2">
            <div className="lsn-feed-head">
              <h3><Bell className="w-5 h-5" /> LIVE ALERT STREAM</h3>
              <div className="flex items-center gap-2">
                <span className="chip">Preview</span>
                <Link to="/alerts">Manage</Link>
              </div>
            </div>
            <motion.div key={alertIdx} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className={`lsn-alert-item rarity-${activeAlert.rarity}`}>
              <div className="lsn-alert-dot" />
              <div>
                <div className="lsn-alert-text">{activeAlert.text}</div>
                <div className="lsn-alert-time">{activeAlert.time}</div>
              </div>
            </motion.div>
            <div className="lsn-alert-stack">
              {liveAlerts.slice(0, 4).map((a) => (
                <div key={a.text} className={`lsn-alert-mini rarity-${a.rarity}`}>{a.text}</div>
              ))}
            </div>
          </div>
        </motion.div>

{/* Invite & Earn */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="lsn-goals mb-8"
        >
          <div className="lsn-goals-head">
            <div>
              <div className="lsn-goals-kicker">REFERRAL · EARN TOGETHER</div>
              <h3>Invite &amp; Earn</h3>
            </div>
            <span className="chip">#StaySavvy</span>
          </div>

          <p className="text-[var(--f10-text-dim)] mb-4 leading-relaxed">
            Share your link. When a friend signs up, you earn <span className="text-[var(--f10-accent)] font-semibold">5,000 Savvy
            Points</span> and a <span className="text-[var(--f10-accent)] font-semibold">$50 bonus</span> (up to 10 new users per day for cash bonus).
            No cap on points after that—keep it rolling.
          </p>

          <CopyField value={referralLink} />
          <p className="text-[var(--f10-text-dim)] text-xs mt-2 mb-0">
            Pro tip: post your auction wins with <span className="text-purple-300">#Final10</span> for extra Savvy Points.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35 }}
          className="lsn-tip mt-8"
        >
          <div className="flex items-start gap-4">
            <div className="lsn-tip-icon"><Zap className="w-6 h-6 text-white" /></div>
            <div>
              <h3>PRO TIPS — LIVE AI ADVICE</h3>
              <motion.p key={tipIdx} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="lsn-tip-text">
                {proTips[tipIdx]}
              </motion.p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;

