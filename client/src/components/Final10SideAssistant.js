import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  ASSISTANT_FEED_EVENT,
  DEAL_COACH_EVENT,
  buildPassiveHints,
} from "../lib/assistantSignals";
import ebayService from "../services/ebayService";
import {
  getAlertsEnabled,
  setAlertsEnabled,
  getNotificationPermission,
  requestAlertPermission,
  getAlertsFiredToday,
} from "../lib/smartDealAlerts";
import {
  buildPredictiveSuggestions,
  invalidatePredictiveCache,
} from "../lib/predictiveSuggestions";
import { trackItemClick } from "../lib/userBehavior";
import { saveWatchIntent } from "../lib/watchIntent";
import { createSavvyAlert } from "../lib/savvyAlerts";
import {
  DEV_SUBSCRIPTION_TOOLS_EVENT,
  getEffectiveSubscriptionTier,
} from "../lib/tierMultiplier";
import { SAVVY_SCOUT, SCOUT_COPY } from "../config/savvyScoutBranding";
import {
  buildVoiceAlertPayload,
  getSavvyAiCapabilities,
  parseVoiceDealIntent,
} from "../lib/savvyAiSystem";
import "../styles/Final10SideAssistant.css";
import SavvyWalletBubble from "./wallet/SavvyWalletBubble";

const DISMISS_KEY = "f10_assistant_dismissed_ids";
const HISTORY_KEY = "f10_savvy_ai_history";
const VOICE_PREF_KEY = "f10_savvy_voice_on";
const HISTORY_LIMIT = 3;
const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const DEBOUNCE_MS = 350;
const MIN_API_INTERVAL_MS = 1200;

// --- Voice layer -----------------------------------------------------------
// Web Speech API lives on window; guard every call for SSR + unsupported browsers.
function getSpeechRecognitionCtor() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function getSynth() {
  if (typeof window === "undefined") return null;
  return window.speechSynthesis || null;
}

function loadVoicePref() {
  try {
    if (typeof localStorage === "undefined") return false;
    return localStorage.getItem(VOICE_PREF_KEY) === "1";
  } catch {
    return false;
  }
}

function saveVoicePref(on) {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(VOICE_PREF_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

// Strip emoji / arrows / markdown so the synthesizer doesn't read "right arrow".
function scrubForSpeech(raw) {
  if (!raw) return "";
  return String(raw)
    .replace(/[\u{1F300}-\u{1FAFF}\u{1F000}-\u{1F6FF}\u{2600}-\u{27BF}\u2190-\u21FF\u2B00-\u2BFF]/gu, "")
    .replace(/[•·→←↑↓✦◎]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Build a short, confident utterance from a structured answer.
// Shape: "<Verdict>. <Reason> <Action>." (trimmed aggressively, 1–3 sentences.)
function buildSpeech(answer) {
  if (!answer) return "";
  const verdict = scrubForSpeech(answer.verdict?.label);
  const reason = scrubForSpeech(answer.reason);
  const actionLabel = scrubForSpeech(answer.action?.label);
  const parts = [];
  if (verdict) parts.push(verdict.replace(/[.!?]+$/, "") + ".");
  if (reason) parts.push(reason.replace(/[.!?]+$/, "") + ".");
  if (actionLabel && answer.kind !== "strategy") {
    parts.push(actionLabel.replace(/[.!?]+$/, "") + ".");
  }
  return parts.join(" ").trim();
}

function pickConfidentVoice(synth) {
  if (!synth) return null;
  const voices = synth.getVoices() || [];
  if (voices.length === 0) return null;
  // Prefer punchy, natural en-US voices if the platform ships them.
  const priority = [
    /Google US English/i,
    /Samantha/i,
    /Microsoft (Aria|Jenny|Guy)/i,
    /Alex/i,
    /Daniel/i,
  ];
  for (const pat of priority) {
    const m = voices.find((v) => pat.test(v.name) && /^en/i.test(v.lang));
    if (m) return m;
  }
  return (
    voices.find((v) => /en-US/i.test(v.lang)) ||
    voices.find((v) => /^en/i.test(v.lang)) ||
    voices[0]
  );
}

function loadDismissed() {
  try {
    const raw = JSON.parse(sessionStorage.getItem(DISMISS_KEY) || "[]");
    return new Set(Array.isArray(raw) ? raw.map(String) : []);
  } catch {
    return new Set();
  }
}

function saveDismissed(set) {
  try {
    sessionStorage.setItem(DISMISS_KEY, JSON.stringify([...set].slice(-60)));
  } catch {
    /* ignore */
  }
}

function loadHistory() {
  try {
    const raw = JSON.parse(sessionStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(raw) ? raw.slice(0, HISTORY_LIMIT) : [];
  } catch {
    return [];
  }
}

function saveHistory(list) {
  try {
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, HISTORY_LIMIT)));
  } catch {
    /* ignore */
  }
}

/**
 * Classify the user's raw input into one of five actionable intents.
 * Priority order matters: strategy/advice checks run before the more
 * generic "search_deals" fallback so questions like "how do I win" don't
 * get misrouted into an eBay product lookup.
 */
export function detectIntent(input) {
  const text = String(input || "").toLowerCase().trim();
  if (!text) return "strategy";

  const has = (patterns) => patterns.some((p) => p.test(text));

  const pointsCues = [
    /\bpoints?\b/,
    /\b(earn|rewards?|xp|level ?up|battle ?pass|daily (quest|mission|streak))\b/,
  ];
  if (has(pointsCues)) return "earn_points";

  const promoteCues = [
    /\bpromote\b/,
    /\b(boost|advertise|visibility|feature my listing|promotion|promote listing)\b/,
    /\b(sell faster|more eyeballs|get noticed)\b/,
  ];
  if (has(promoteCues)) return "promote";

  const categoryCues = [
    /\b(where (is|are|do i find)|take me to|go to|open|navigate to|show me the)\b/,
    /\b(auctions?|trending feed|feed|quick snipes?|leaderboard|profile|savvy offers?|business offers?|scanner)\b/,
    /\bcategory\b/,
  ];
  if (has(categoryCues)) return "find_category";

  const strategyCues = [
    /\b(how (do|should|can) i|what('?s| is) the best way|any tips?|advice|strategy|strategies|help me win|should i|tips for)\b/,
    /\b(win more|beat|outbid|snipe|sniping strategy|pricing tip)\b/,
  ];
  if (has(strategyCues)) return "strategy";

  const alertCues = [
    /\b(create|set|add|start)\s+(an?\s+)?alert\b/,
    /\bwatch this for me\b/,
    /\bwatch for (me|a drop)\b/,
  ];
  if (has(alertCues)) return "create_alert";

  const evalCues = [
    /\bevaluate (this )?deal\b/,
    /\bis this (a )?(good|great|bad) deal\b/,
    /\bdeal score\b/,
  ];
  if (has(evalCues)) return "evaluate_deal";

  const productCues = [
    /\b(find|search|look for|show me|any|cheap|deal|deals|best price|under \$?\d+)\b/,
    /\b(ps5|xbox|iphone|ipad|macbook|airpods|switch|gpu|rtx|ryzen|watch|nike|lego|pokemon|card|sneaker)\b/,
    /\b(for sale|buy|bid on|auction for)\b/,
  ];
  if (has(productCues)) return "search_deals";

  return "search_deals";
}

// Verdict tones drive color + emphasis in the UI. Keep the label tight.
//   great  → green  (top-tier steal)
//   strong → teal   (solid value)
//   move   → amber  (good, but time-sensitive)
//   watch  → blue   (neutral, keep eyes on)
//   skip   → red    (not worth it)
//   info   → purple (navigation / system)
const VERDICT_TONES = new Set(["great", "strong", "move", "watch", "skip", "info"]);

function mkVerdict(label, tone) {
  return { label, tone: VERDICT_TONES.has(tone) ? tone : "info" };
}

const NAV_TARGETS = {
  find_category: {
    label: "Trending Feed",
    path: "/feed",
    verdict: mkVerdict("Head to Trending", "info"),
    reason: "Fresh deals across every category live there.",
  },
  earn_points: {
    label: "Savvy Balance",
    path: "/profile#savvy-balance",
    verdict: mkVerdict("Stack XP fast", "strong"),
    reason: "Daily streaks, quests, and Battle Pass stack on one screen.",
  },
  promote: {
    label: "Promote Listing",
    path: "/promote-listing",
    verdict: mkVerdict("Boost it", "move"),
    reason: "Pick a tier, attach your item, ship it to the top.",
  },
};

// Each strategy card is already shaped as verdict + reason. No filler, no hedging.
const STRATEGY_CARDS = [
  {
    verdict: mkVerdict("Snipe the final 10", "move"),
    reason: "Low competition in the last 10 minutes — that's where wins convert.",
  },
  {
    verdict: mkVerdict("Stack Bid + Buy-Now", "strong"),
    reason: "Use the auction as your ceiling; bail to Buy-Now if it climbs.",
  },
  {
    verdict: mkVerdict("Watch 5, not 1", "strong"),
    reason: "Savvy floats the top scoring card — spread the net.",
  },
  {
    verdict: mkVerdict("Skip under 15%", "skip"),
    reason: "If savings drop below 15%, move on. Better deals refresh hourly.",
  },
  {
    verdict: mkVerdict("Promote midweek", "move"),
    reason: "Tue–Thu converts cheaper and faster than weekend noise.",
  },
  {
    verdict: mkVerdict("Bid in the last 30s", "great"),
    reason: "Shorter timer = fewer counter-bids. Move fast.",
  },
];

function pickStrategyCard(seedText) {
  const seed = String(seedText || "").length;
  const idx = (Date.now() + seed) % STRATEGY_CARDS.length;
  return STRATEGY_CARDS[idx];
}

// Grade a single listing by savings% / deal score into the shared verdict shape.
function evaluateDeal(deal) {
  const pct = Number(deal?.savingsPct);
  const score = Number(deal?.score);
  const ref = Number.isFinite(pct) ? pct : Number.isFinite(score) ? score : null;

  if (ref == null) {
    return {
      verdict: mkVerdict("Worth a look", "watch"),
      reason: "Price data's thin — check the listing for condition and shipping.",
    };
  }
  if (ref >= 40) {
    return {
      verdict: mkVerdict("Great deal", "great"),
      reason: "Priced well under market. Move fast before someone else grabs it.",
    };
  }
  if (ref >= 25) {
    return {
      verdict: mkVerdict("Strong value", "strong"),
      reason: "Clear savings vs market. Low competition window.",
    };
  }
  if (ref >= 12) {
    return {
      verdict: mkVerdict("Move fast", "move"),
      reason: "Decent margin — worth a bid if ending soon.",
    };
  }
  if (ref > 0) {
    return {
      verdict: mkVerdict("Worth a watch", "watch"),
      reason: "Slim savings. Watchlist it and wait for a price drop.",
    };
  }
  return {
    verdict: mkVerdict("Skip this", "skip"),
    reason: "No edge vs market. Better deals refresh hourly.",
  };
}

function pickTopVerdict(deals) {
  if (!Array.isArray(deals) || deals.length === 0) {
    return {
      verdict: mkVerdict("No hits", "skip"),
      reason: "Nothing live matches. Auctions has the full board.",
    };
  }
  const ranked = [...deals].sort(
    (a, b) => (Number(b.score) || 0) - (Number(a.score) || 0)
  );
  const top = ranked[0];
  const { verdict } = evaluateDeal(top);
  if (verdict.tone === "great") {
    return { verdict, reason: `Top pick is a steal — ${top.priceText}.` };
  }
  if (verdict.tone === "strong") {
    return { verdict, reason: `${deals.length} solid picks. Lead: ${top.priceText}.` };
  }
  if (verdict.tone === "move") {
    return { verdict, reason: `${deals.length} live. Act on the top card.` };
  }
  if (verdict.tone === "skip") {
    return {
      verdict: mkVerdict("Weak board", "skip"),
      reason: "Savings are thin right now. Retry in an hour.",
    };
  }
  return { verdict, reason: `${deals.length} live picks. Top: ${top.priceText}.` };
}

function parseDealEvaluationQuery(query) {
  const raw = String(query || "");
  const nums = [...raw.matchAll(/\$?\s*(\d+(?:\.\d{1,2})?)/g)].map((m) => Number(m[1]));
  const price = Number(nums[0]);
  const market = Number(nums[1]);
  return {
    price: Number.isFinite(price) ? price : null,
    market: Number.isFinite(market) ? market : null,
  };
}

function evaluateDealFromQuery(query) {
  const parsed = parseDealEvaluationQuery(query);
  const { price, market } = parsed;
  if (!Number.isFinite(price) || !Number.isFinite(market) || market <= 0) {
    return {
      kind: "evaluation",
      verdict: mkVerdict("Need 2 prices", "watch"),
      reason: "Share asking price and market value, and I'll score it fast.",
      action: { label: "Try: evaluate deal 365 vs 420", path: "/feed", kind: "nav" },
    };
  }
  const savingsPct = Math.round(((market - price) / market) * 100);
  if (savingsPct >= 25) {
    return {
      kind: "evaluation",
      verdict: mkVerdict("Best Move", "great"),
      reason: `Strong edge at ${savingsPct}% below market. Move now.`,
    };
  }
  if (savingsPct >= 10) {
    return {
      kind: "evaluation",
      verdict: mkVerdict("Solid deal", "strong"),
      reason: `${savingsPct}% below market. Worth buying if trust is high.`,
    };
  }
  if (savingsPct > 0) {
    return {
      kind: "evaluation",
      verdict: mkVerdict("Watch first", "watch"),
      reason: `Only ${savingsPct}% below market. Set an alert for a drop.`,
    };
  }
  return {
    kind: "evaluation",
    verdict: mkVerdict("Skip this", "skip"),
    reason: "Priced at or above market. Better deals are coming.",
  };
}

// ---- Weak-board personality ----------------------------------------------
// Honest, human-feeling replies when the board has no strong deal worth
// recommending. Randomized so the assistant never sounds canned. Never pushes
// bad deals to "fill space" — the assistant's trust is the product.

const WEAK_BOARD_MESSAGES_GENERIC = [
  "Nothing worth your money right now. I'll catch the next one before everyone else does.",
  "Market's a little dry. I'm watching it for you.",
  "No steals at the moment. Stay ready — I'll alert you when something real hits.",
  "Board's quiet right now. Not going to push junk just to look busy.",
  "Nothing I'd spend on yet. I'll ping you the second something real drops.",
];

const WEAK_BOARD_MESSAGES_TOPIC = [
  "{topic} deals are weak right now. I'll watch this category for you.",
  "Slim pickings on {topic} this hour. I'll grab the next real one.",
  "{topic} board is cold. Holding fire until something's worth it.",
  "Nothing on {topic} that beats retail. I'll stay on it.",
];

const WEAK_BOARD_INSIGHTS = [
  "Low supply + steady demand = fewer deals right now.",
  "Sellers are holding prices — wait for the next drop.",
  "High bid activity is thinning the margins today.",
  "Most live listings are priced near market. Patience pays.",
];

// Map common query keywords → a clean topic label we can drop into messages.
const TOPIC_KEYWORDS = [
  { pat: /\bps5|playstation 5\b/i, label: "PS5" },
  { pat: /\bps4|playstation 4\b/i, label: "PS4" },
  { pat: /\bxbox( series)?\b/i, label: "Xbox" },
  { pat: /\bnintendo switch|switch oled\b/i, label: "Switch" },
  { pat: /\biphone\b/i, label: "iPhone" },
  { pat: /\bipad\b/i, label: "iPad" },
  { pat: /\bmacbook|mac ?mini|imac\b/i, label: "MacBook" },
  { pat: /\bairpods?\b/i, label: "AirPods" },
  { pat: /\bapple watch\b/i, label: "Apple Watch" },
  { pat: /\brolex|submariner|datejust\b/i, label: "Rolex" },
  { pat: /\bjordan|yeezy|air force|nike dunk\b/i, label: "Sneakers" },
  { pat: /\bpokemon|pokémon|mtg|trading card\b/i, label: "Trading cards" },
  { pat: /\brtx \d+|gpu|graphics card\b/i, label: "GPUs" },
  { pat: /\blego\b/i, label: "LEGO" },
  { pat: /\bcamera|lens|sony a\d|canon eos\b/i, label: "Cameras" },
];

function inferTopic(query) {
  const q = String(query || "").trim();
  if (!q) return null;
  for (const entry of TOPIC_KEYWORDS) {
    if (entry.pat.test(q)) return entry.label;
  }
  // Fallback: title-case the first 2 words so "vintage denim jacket" → "Vintage Denim".
  const words = q.split(/\s+/).slice(0, 2).join(" ");
  if (!words || words.length < 3) return null;
  return words.replace(/\b\w/g, (c) => c.toUpperCase());
}

function pickWeakBoardMessage(query) {
  const topic = inferTopic(query);
  const pool = topic ? WEAK_BOARD_MESSAGES_TOPIC : WEAK_BOARD_MESSAGES_GENERIC;
  const idx = Math.floor(Math.random() * pool.length);
  const tmpl = pool[idx];
  return topic ? tmpl.replace("{topic}", topic) : tmpl;
}

function pickWeakBoardInsight() {
  return WEAK_BOARD_INSIGHTS[Math.floor(Math.random() * WEAK_BOARD_INSIGHTS.length)];
}

// Sibling categories for the "Try another category" suggestion engine.
const CATEGORY_SIBLINGS = {
  gaming: ["Electronics", "Collectibles"],
  electronics: ["Gaming", "Home"],
  sneakers: ["Fashion", "Collectibles"],
  fashion: ["Sneakers", "Luxury"],
  collectibles: ["Gaming", "Luxury"],
  home: ["Electronics", "Auto"],
  auto: ["Home", "Electronics"],
  luxury: ["Fashion", "Collectibles"],
};

function categoryFromTopic(topic) {
  if (!topic) return null;
  const t = topic.toLowerCase();
  if (/ps5|ps4|xbox|switch|gpu/.test(t)) return "gaming";
  if (/iphone|ipad|macbook|airpods|apple watch|camera/.test(t)) return "electronics";
  if (/sneakers|jordan|yeezy/.test(t)) return "sneakers";
  if (/pokemon|trading cards|lego/.test(t)) return "collectibles";
  if (/rolex/.test(t)) return "luxury";
  return null;
}

function normalizeDealItem(raw) {
  if (!raw || typeof raw !== "object") return null;
  const price =
    raw.currentBidPrice ?? raw.buyNowPrice ?? raw.price ?? raw.currentPrice ?? null;
  const priceNum = Number(price);
  const currency = raw.currency || "USD";
  const priceText = Number.isFinite(priceNum)
    ? new Intl.NumberFormat("en-US", { style: "currency", currency }).format(priceNum)
    : "—";
  const score = Number(raw.dealScore ?? raw.score);
  const savingsPct = Number(raw.savingsPercentage ?? raw.savingsPct);
  const deal = {
    id: String(raw.itemId || raw.id || raw._id || Math.random()),
    title: raw.title || "eBay listing",
    image: raw.imageUrl || raw.image || raw.galleryURL || "",
    url: raw.itemWebUrl || raw.url || raw.viewItemURL || "#",
    priceText,
    priceNumber: Number.isFinite(priceNum) ? priceNum : null,
    score: Number.isFinite(score) ? Math.round(score) : null,
    savingsPct: Number.isFinite(savingsPct) ? Math.round(savingsPct) : null,
    trustScore: Number(raw.trustScore),
    trustLevel: String(raw.trustLevel || "").toLowerCase(),
    condition: String(raw.condition || "").toLowerCase(),
  };
  deal.verdict = evaluateDeal(deal).verdict;
  return deal;
}

export default function Final10SideAssistant() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const [unread, setUnread] = useState(0);
  const [coachToast, setCoachToast] = useState(null);
  const [activeTab, setActiveTab] = useState("ask");
  const [draft, setDraft] = useState("");
  const [history, setHistory] = useState(() => loadHistory());
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");
  const [voiceOn, setVoiceOn] = useState(() => loadVoicePref());
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [alertsOn, setAlertsOn] = useState(() => getAlertsEnabled());
  const [alertsPerm, setAlertsPerm] = useState(() => getNotificationPermission());
  const [alertsToday, setAlertsToday] = useState(() => getAlertsFiredToday());
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const suggestionsFetchAtRef = useRef(0);
  const dismissedRef = useRef(loadDismissed());
  const autoOpenedUrgentRef = useRef(false);
  const searchCacheRef = useRef(new Map());
  const lastApiAtRef = useRef(0);
  const debounceRef = useRef(0);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);
  const utteranceRef = useRef(null);
  const lastVoiceIntentRef = useRef(null);
  const voiceOnRef = useRef(voiceOn);
  const supportsSR = useMemo(() => Boolean(getSpeechRecognitionCtor()), []);
  const supportsTTS = useMemo(() => Boolean(getSynth()), []);
  const [subscriptionTier, setSubscriptionTier] = useState(() =>
    getEffectiveSubscriptionTier()
  );
  const aiCaps = useMemo(() => getSavvyAiCapabilities(subscriptionTier), [subscriptionTier]);

  useEffect(() => {
    const bump = () => setSubscriptionTier(getEffectiveSubscriptionTier());
    window.addEventListener("f10:subscription-tier-updated", bump);
    window.addEventListener(DEV_SUBSCRIPTION_TOOLS_EVENT, bump);
    return () => {
      window.removeEventListener("f10:subscription-tier-updated", bump);
      window.removeEventListener(DEV_SUBSCRIPTION_TOOLS_EVENT, bump);
    };
  }, []);

  useEffect(() => {
    voiceOnRef.current = voiceOn;
  }, [voiceOn]);

  const dismiss = useCallback((id) => {
    dismissedRef.current.add(String(id));
    saveDismissed(dismissedRef.current);
    setItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setItems((prev) => {
      prev.forEach((x) => dismissedRef.current.add(String(x.id)));
      saveDismissed(dismissedRef.current);
      return [];
    });
    setUnread(0);
  }, []);

  useEffect(() => {
    if (!user) return undefined;

    const onFeed = (e) => {
      const d = e.detail;
      if (!d?.id || dismissedRef.current.has(String(d.id))) return;
      setItems((prev) => {
        const existed = prev.some((x) => x.id === String(d.id));
        const filtered = prev.filter((x) => x.id !== String(d.id));
        const row = {
          id: String(d.id),
          tone: d.tone || "info",
          title: d.title,
          body: d.body,
          priority: Number(d.priority) || 0,
          ts: d.ts || Date.now(),
        };
        const isNew = !existed && row.priority >= 1;
        if (isNew) {
          window.queueMicrotask(() => {
            setUnread((u) => u + 1);
            if (row.tone === "urgent" && !autoOpenedUrgentRef.current) {
              autoOpenedUrgentRef.current = true;
              setExpanded(true);
              setActiveTab("hints");
            }
          });
        }
        return [row, ...filtered].slice(0, 12);
      });
    };

    window.addEventListener(ASSISTANT_FEED_EVENT, onFeed);
    return () => window.removeEventListener(ASSISTANT_FEED_EVENT, onFeed);
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;
    const onCoach = (e) => {
      const d = e.detail;
      if (!d?.title || !d?.body) return;
      setCoachToast({
        title: d.title,
        body: d.body,
        tone: d.tone || "coach",
        ts: d.ts || Date.now(),
        eyebrow: d.eyebrow,
      });
    };
    window.addEventListener(DEAL_COACH_EVENT, onCoach);
    return () => window.removeEventListener(DEAL_COACH_EVENT, onCoach);
  }, [user]);

  useEffect(() => {
    if (!coachToast) return undefined;
    const t = window.setTimeout(() => setCoachToast(null), 11000);
    return () => clearTimeout(t);
  }, [coachToast]);

  useEffect(() => {
    if (!user) return undefined;
    const id = setInterval(() => {
      const hints = buildPassiveHints(location.pathname, user);
      if (hints.length === 0) return;
      const pick = hints[Math.floor(Math.random() * hints.length)];
      if (!pick || dismissedRef.current.has(pick.id)) return;
      setItems((prev) => {
        if (prev.some((x) => x.id === pick.id)) return prev;
        return [{ ...pick, ts: Date.now() }, ...prev].slice(0, 12);
      });
    }, 88000);
    return () => clearInterval(id);
  }, [user, location.pathname]);

  const sorted = useMemo(
    () =>
      [...items].sort(
        (a, b) =>
          (Number(b.priority) || 0) - (Number(a.priority) || 0) ||
          (Number(b.ts) || 0) - (Number(a.ts) || 0)
      ),
    [items]
  );

  const openPanel = useCallback(() => {
    setExpanded(true);
    setUnread(0);
    window.setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const runDealSearch = useCallback(async (query, limit = 6) => {
    const key = query.toLowerCase().trim();
    const cache = searchCacheRef.current;
    const cached = cache.get(key);
    if (cached && Date.now() - cached.ts < SEARCH_CACHE_TTL_MS) {
      return cached.results.slice(0, limit);
    }
    const now = Date.now();
    const sinceLast = now - lastApiAtRef.current;
    if (sinceLast < MIN_API_INTERVAL_MS) {
      await new Promise((r) => setTimeout(r, MIN_API_INTERVAL_MS - sinceLast));
    }
    lastApiAtRef.current = Date.now();
    const data = await ebayService.searchItems({ q: query, limit: Math.max(6, Number(limit) || 6) });
    const results = (data?.items || [])
      .map(normalizeDealItem)
      .filter(Boolean)
      .slice(0, 3);
    cache.set(key, { ts: Date.now(), results });
    if (cache.size > 24) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
    return results.slice(0, limit);
  }, []);

  const buildVoiceSearchAnswer = useCallback(
    async (intent, options = {}) => {
      const requestedMax = Number(intent?.maxPrice);
      const maxPrice = Number.isFinite(options.maxPrice) ? options.maxPrice : Number.isFinite(requestedMax) ? requestedMax : null;
      const query = String(intent?.item || intent?.query || "").trim();
      const minTrust = Number(intent?.minTrust);
      const requireHighTrust = Number.isFinite(minTrust) || Boolean(intent?.highTrustOnly);
      const preferredCondition = String(intent?.preferredCondition || "").trim().toLowerCase();
      const requireCondition = Boolean(preferredCondition);
      const allowExpanded = options.allowExpanded !== false;
      const allDeals = await runDealSearch(query, 10);
      const qualified = allDeals.filter((deal) => {
        const dealPrice = Number(deal?.priceNumber);
        const trustLevel = String(deal?.trustLevel || "").toLowerCase();
        const trustScore = Number(deal?.trustScore);
        const trustOk =
          !requireHighTrust ||
          trustLevel === "high" ||
          (Number.isFinite(trustScore) && trustScore >= (Number.isFinite(minTrust) ? minTrust : 80));
        const conditionOk =
          !requireCondition || String(deal?.condition || "").includes(preferredCondition);
        const priceOk = !Number.isFinite(maxPrice) || (Number.isFinite(dealPrice) && dealPrice <= maxPrice);
        return Boolean(trustOk && conditionOk && priceOk);
      });
      if (qualified.length > 0) {
        const best = [...qualified].sort(
          (a, b) =>
            (Number(b.score) || 0) - (Number(a.score) || 0) ||
            (Number(a.priceNumber) || Number.POSITIVE_INFINITY) -
              (Number(b.priceNumber) || Number.POSITIVE_INFINITY)
        )[0];
        const bestPrice = Number(best?.priceNumber);
        return {
          kind: "voice_results",
          verdict: mkVerdict("Best Move", "strong"),
          reason: Number.isFinite(bestPrice)
            ? `Found one at $${Math.round(bestPrice)} — high trust. This is a Best Move.`
            : "Found a high-trust match. This is a Best Move.",
          deals: qualified.slice(0, 3),
          voiceIntent: { ...intent, maxPrice: Number.isFinite(maxPrice) ? maxPrice : intent?.maxPrice },
          quickActions: ["create_alert", "expand_range", "show_more"],
        };
      }

      const rankedClosest = allDeals
        .filter((deal) => {
          const trustLevel = String(deal?.trustLevel || "").toLowerCase();
          const trustScore = Number(deal?.trustScore);
          const trustOk =
            !requireHighTrust ||
            trustLevel === "high" ||
            (Number.isFinite(trustScore) && trustScore >= (Number.isFinite(minTrust) ? minTrust : 80));
          const conditionOk =
            !requireCondition || String(deal?.condition || "").includes(preferredCondition);
          return Boolean(trustOk && conditionOk);
        })
        .sort((a, b) => {
          const ap = Number(a?.priceNumber);
          const bp = Number(b?.priceNumber);
          if (!Number.isFinite(ap) && !Number.isFinite(bp)) return 0;
          if (!Number.isFinite(ap)) return 1;
          if (!Number.isFinite(bp)) return -1;
          if (!Number.isFinite(maxPrice)) return ap - bp;
          return Math.abs(ap - maxPrice) - Math.abs(bp - maxPrice);
        });
      const closest = rankedClosest[0];
      const closestPrice = Number(closest?.priceNumber);
      const hasTarget = Number.isFinite(maxPrice);
      if (closest && hasTarget && Number.isFinite(closestPrice) && closestPrice > maxPrice && closestPrice <= maxPrice * 1.08) {
        return {
          kind: "voice_results",
          verdict: mkVerdict("Strong deal", "move"),
          reason: `Closest match is $${Math.round(closestPrice)} — strong deal.`,
          deals: [closest, ...rankedClosest.slice(1, 3)],
          voiceIntent: { ...intent, maxPrice },
          quickActions: ["create_alert", "expand_range", "show_more"],
        };
      }

      const expandedMax =
        hasTarget ? Math.max(maxPrice + 25, Math.round(maxPrice * 1.12)) : null;
      const expandedDeals =
        allowExpanded && Number.isFinite(expandedMax)
          ? rankedClosest.filter((deal) => Number(deal?.priceNumber) <= expandedMax).slice(0, 3)
          : rankedClosest.slice(0, 3);
      const closestOrFallback = expandedDeals[0] || closest;
      const fallbackPrice = Number(closestOrFallback?.priceNumber);
      const fallbackTrustHigh =
        String(closestOrFallback?.trustLevel || "").toLowerCase() === "high" ||
        Number(closestOrFallback?.trustScore) >= 80;
      return {
        kind: "voice_results",
        verdict: mkVerdict("Monitoring option ready", "watch"),
        reason:
          hasTarget && Number.isFinite(fallbackPrice)
            ? `Nothing under $${Math.round(maxPrice)} right now… Closest is $${Math.round(fallbackPrice)}${fallbackTrustHigh ? " with high trust" : ""}. Want me to watch for a drop?`
            : "No exact match yet. I found the closest options and can watch for a drop.",
        deals: expandedDeals,
        voiceIntent: { ...intent, maxPrice: hasTarget ? maxPrice : intent?.maxPrice },
        quickActions: ["create_alert", "expand_range", "show_more"],
      };
    },
    [runDealSearch]
  );

  const buildAnswer = useCallback(
    async (rawQuery) => {
      const query = rawQuery.trim();
      const intent = detectIntent(query);

      if (intent === "strategy") {
        const card = pickStrategyCard(query);
        return {
          intent,
          kind: "strategy",
          verdict: card.verdict,
          reason: card.reason,
          action: { label: "Open Trending Feed", path: "/feed", kind: "nav" },
        };
      }
      if (intent === "evaluate_deal") {
        return evaluateDealFromQuery(query);
      }
      if (intent === "create_alert") {
        const parsed = parseVoiceDealIntent(query);
        if (parsed) {
          const payload = buildVoiceAlertPayload(parsed);
          if (payload) {
            try {
              await createSavvyAlert(payload);
              return {
                kind: "monitoring",
                verdict: mkVerdict(SCOUT_COPY.assistant.monitoringBadge, "strong"),
                reason: parsed.maxPrice
                  ? `Alert set for ${parsed.item || parsed.query} under $${Math.round(parsed.maxPrice)}.`
                  : `Alert set for ${parsed.item || parsed.query}.`,
                action: { label: "Open Alerts", path: "/alerts", kind: "nav" },
              };
            } catch {
              return {
                kind: "monitoring",
                verdict: mkVerdict("Retry alert", "watch"),
                reason: "Couldn't create the alert right now. Try once more.",
                action: { label: "Open Alerts", path: "/alerts", kind: "nav" },
              };
            }
          }
        }
      }
      if (intent === "find_category" || intent === "earn_points" || intent === "promote") {
        const target = NAV_TARGETS[intent];
        return {
          intent,
          kind: "nav",
          verdict: target.verdict,
          reason: target.reason,
          action: { label: `Go to ${target.label}`, path: target.path, kind: "nav" },
        };
      }

      try {
        const deals = await runDealSearch(query);
        const topic = inferTopic(query);
        const category = categoryFromTopic(topic);

        if (deals.length === 0) {
          return {
            intent,
            kind: "weak_board",
            query,
            topic,
            category,
            verdict: mkVerdict("Low opportunity", "move"),
            reason: pickWeakBoardMessage(query),
            insight: pickWeakBoardInsight(),
            allDeals: [],
          };
        }
        const top = pickTopVerdict(deals);
        const isWeak = top.verdict.tone === "skip";
        if (isWeak) {
          return {
            intent,
            kind: "weak_board",
            query,
            topic,
            category,
            verdict: mkVerdict("Low opportunity", "move"),
            reason: pickWeakBoardMessage(query),
            insight: pickWeakBoardInsight(),
            // Keep the raw pool so "Show best available" can surface them on demand.
            allDeals: deals,
          };
        }
        return {
          intent,
          kind: "deals",
          verdict: top.verdict,
          reason: top.reason,
          deals,
          action: { label: "See all on Trending", path: "/feed", kind: "nav" },
        };
      } catch (err) {
        return {
          intent,
          kind: "nav",
          verdict: mkVerdict("Retry", "watch"),
          reason: "eBay lookup hiccuped. Auctions has the live list.",
          action: { label: "Go to Auctions", path: "/auctions", kind: "nav" },
        };
      }
    },
    [runDealSearch]
  );

  const stopSpeaking = useCallback(() => {
    const synth = getSynth();
    if (!synth) return;
    try {
      synth.cancel();
    } catch {
      /* ignore */
    }
    utteranceRef.current = null;
    setSpeaking(false);
  }, []);

  const aiStateLabel = useMemo(() => {
    if (listening) return "Listening";
    if (aiBusy) return "Processing";
    if (speaking) return "Responding";
    return "Ready";
  }, [listening, aiBusy, speaking]);

  const speakAnswer = useCallback(
    (answer) => {
      if (!voiceOnRef.current) return;
      const synth = getSynth();
      if (!synth) return;
      const text = buildSpeech(answer);
      if (!text) return;
      try {
        synth.cancel();
      } catch {
        /* ignore */
      }
      const u = new window.SpeechSynthesisUtterance(text);
      const voice = pickConfidentVoice(synth);
      if (voice) u.voice = voice;
      // Confident + slightly energetic: bumped rate, mildly lifted pitch.
      u.rate = 1.12;
      u.pitch = 1.05;
      u.volume = 1;
      u.onstart = () => setSpeaking(true);
      u.onend = () => {
        setSpeaking(false);
        utteranceRef.current = null;
      };
      u.onerror = () => {
        setSpeaking(false);
        utteranceRef.current = null;
      };
      utteranceRef.current = u;
      try {
        synth.speak(u);
      } catch {
        setSpeaking(false);
      }
    },
    []
  );

  const submitQuery = useCallback(
    async (raw, opts = {}) => {
      const query = String(raw || "").trim();
      if (!query || aiBusy) return;
      stopSpeaking();
      setAiError("");
      setAiBusy(true);
      const placeholder = {
        id: `q_${Date.now()}`,
        ts: Date.now(),
        query,
        answer: null,
        pending: true,
      };
      setHistory((prev) => {
        const next = [placeholder, ...prev].slice(0, HISTORY_LIMIT);
        saveHistory(next);
        return next;
      });
      try {
        const source = opts?.source || "text";
        let answer;
        if (source === "voice" && aiCaps.hasVoiceAutoAlert) {
          const parsed = parseVoiceDealIntent(query);
          const watchCommand = /\bwatch this for me\b|\bwatch this\b|\bwatch for a drop\b|\bwatch for me\b/i.test(query);
          if (watchCommand && lastVoiceIntentRef.current) {
            const payload = buildVoiceAlertPayload(lastVoiceIntentRef.current);
            if (payload) {
              await createSavvyAlert(payload);
              answer = {
                kind: "monitoring",
                verdict: mkVerdict(SCOUT_COPY.assistant.monitoringBadge, "strong"),
                reason: Number.isFinite(lastVoiceIntentRef.current?.maxPrice)
                  ? `Done. I'll watch ${lastVoiceIntentRef.current.item || lastVoiceIntentRef.current.query} under $${Math.round(lastVoiceIntentRef.current.maxPrice)} and ping you on drops.`
                  : `Done. I'll watch ${lastVoiceIntentRef.current.item || lastVoiceIntentRef.current.query} and ping you on drops.`,
                action: { label: "Open Alerts", path: "/alerts", kind: "nav" },
              };
            }
          } else if (parsed) {
            answer = await buildVoiceSearchAnswer(parsed);
            lastVoiceIntentRef.current = answer?.voiceIntent || parsed;
          }
        }
        if (!answer && source === "voice" && aiCaps.hasVoiceInput) {
          const parsed = parseVoiceDealIntent(query);
          if (parsed) {
            answer = await buildVoiceSearchAnswer(parsed);
            lastVoiceIntentRef.current = answer?.voiceIntent || parsed;
          }
        }
        if (!answer && source === "voice" && !aiCaps.hasVoiceInput) {
          answer = {
            kind: "nav",
            verdict: mkVerdict("Voice unlocks on Savvy+", "info"),
            reason: "Upgrade to Savvy+ to use voice search and hands-free alert creation.",
            action: { label: "View Plans", path: "/premium", kind: "nav" },
          };
        }
        if (!answer) {
          answer = await buildAnswer(query);
        }
        if (source === "voice" && !answer?.voiceIntent) {
          const parsed = parseVoiceDealIntent(query);
          if (parsed) {
            lastVoiceIntentRef.current = parsed;
          }
        }
        setHistory((prev) => {
          const next = prev.map((row) =>
            row.id === placeholder.id ? { ...row, answer, pending: false } : row
          );
          saveHistory(next);
          return next;
        });
        speakAnswer(answer);
      } catch (err) {
        setAiError("Savvy stumbled — try again.");
        setHistory((prev) => prev.filter((row) => row.id !== placeholder.id));
      } finally {
        setAiBusy(false);
      }
    },
    [aiBusy, aiCaps.hasVoiceAutoAlert, aiCaps.hasVoiceInput, buildAnswer, buildVoiceSearchAnswer, speakAnswer, stopSpeaking]
  );

  const onSubmit = useCallback(
    (e) => {
      e.preventDefault();
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
      const value = draft;
      debounceRef.current = window.setTimeout(() => {
        submitQuery(value);
        setDraft("");
      }, DEBOUNCE_MS);
    },
    [draft, submitQuery]
  );

  const handleNav = useCallback(
    (path) => {
      navigate(path);
      setExpanded(false);
      stopSpeaking();
    },
    [navigate, stopSpeaking]
  );

  const updateHistoryAnswer = useCallback((turnId, patch) => {
    setHistory((prev) => {
      const next = prev.map((row) =>
        row.id === turnId
          ? { ...row, answer: { ...row.answer, ...patch } }
          : row
      );
      saveHistory(next);
      return next;
    });
  }, []);

  // Weak-board: "🔔 Notify Me" — save intent, swap message to a confirmation.
  const handleNotifyMe = useCallback(
    (turnId, answer) => {
      const intent = saveWatchIntent({
        query: answer?.query,
        category: answer?.category,
      });
      // Auto-enable alerts if they're off so the ping actually reaches the user.
      if (intent && !getAlertsEnabled()) {
        setAlertsEnabled(true);
        setAlertsOn(true);
        // Permission will be prompted from the toggle or the next alert attempt;
        // we don't block here because the user already clicked through UI.
      }
      updateHistoryAnswer(turnId, {
        notifyState: "saved",
        reason: answer?.topic
          ? `Got you. I'll ping you the second a ${answer.topic} deal actually lands.`
          : "Got you. I'll ping you when something real shows up.",
      });
    },
    [updateHistoryAnswer]
  );

  // Weak-board: "⚡ Show Best Available" — surface the top 3 of the original
  // pool with a clear honesty label so the user knows this isn't top-tier.
  const handleShowBest = useCallback(
    (turnId, answer) => {
      const pool = Array.isArray(answer?.allDeals) ? answer.allDeals : [];
      const best = [...pool]
        .sort(
          (a, b) =>
            (Number(b.score) || 0) - (Number(a.score) || 0) ||
            (Number(b.savingsPct) || 0) - (Number(a.savingsPct) || 0)
        )
        .slice(0, 3);
      updateHistoryAnswer(turnId, {
        bestAvailable: best,
        bestAvailableLabel: "Best available right now (not top-tier)",
      });
    },
    [updateHistoryAnswer]
  );

  // Weak-board: "🎯 Try Another Category" — suggest 2 sibling categories.
  const handleTryAnother = useCallback(
    (turnId, answer) => {
      const cat = answer?.category;
      const label = answer?.topic || "This category";
      const siblings = (cat && CATEGORY_SIBLINGS[cat]) || ["Gaming", "Electronics"];
      updateHistoryAnswer(turnId, {
        categorySuggest: {
          message: `${label} dry… want ${siblings[0]} or ${siblings[1]}?`,
          options: siblings,
        },
      });
    },
    [updateHistoryAnswer]
  );

  const handleCategoryJump = useCallback(() => {
    // All category suggestions route through Trending Feed.
    navigate("/feed");
    setExpanded(false);
    stopSpeaking();
  }, [navigate, stopSpeaking]);

  const handleVoiceCreateAlert = useCallback(
    async (turnId, answer) => {
      const intent = answer?.voiceIntent;
      const payload = buildVoiceAlertPayload(intent);
      if (!payload) return;
      try {
        await createSavvyAlert(payload);
        updateHistoryAnswer(turnId, {
          alertState: "created",
          reason: Number.isFinite(intent?.maxPrice)
            ? `Alert created. I'll watch ${intent.item || intent.query} under $${Math.round(intent.maxPrice)} and notify you on drops.`
            : `Alert created. I'll watch ${intent.item || intent.query} and notify you on drops.`,
        });
      } catch {
        updateHistoryAnswer(turnId, {
          alertState: "failed",
          reason: "I couldn't create the alert this second. Try again.",
        });
      }
    },
    [updateHistoryAnswer]
  );

  const handleVoiceExpandRange = useCallback(
    async (turnId, answer) => {
      const intent = answer?.voiceIntent;
      if (!intent) return;
      const baseMax = Number(intent.maxPrice);
      const expandedMax = Number.isFinite(baseMax)
        ? Math.max(baseMax + 25, Math.round(baseMax * 1.12))
        : 500;
      try {
        const expanded = await buildVoiceSearchAnswer(
          { ...intent, maxPrice: expandedMax },
          { maxPrice: expandedMax, allowExpanded: false }
        );
        updateHistoryAnswer(turnId, {
          ...expanded,
          voiceIntent: { ...intent, maxPrice: expandedMax },
        });
      } catch {
        updateHistoryAnswer(turnId, {
          reason: "I couldn't expand the range right now. Try again.",
        });
      }
    },
    [buildVoiceSearchAnswer, updateHistoryAnswer]
  );

  const handleVoiceShowMore = useCallback(
    () => {
      navigate("/feed");
      setExpanded(false);
      stopSpeaking();
    },
    [navigate, stopSpeaking]
  );

  const handleSuggestionClick = useCallback(
    (suggestion) => {
      if (!suggestion) return;
      stopSpeaking();
      trackItemClick({
        id: suggestion.meta?.itemId || suggestion.id,
        title: suggestion.title,
        category: suggestion.meta?.category,
      });
      const url = suggestion.action?.url;
      const fallback = suggestion.action?.fallback || "/feed";
      if (url && /^https?:\/\//i.test(url)) {
        window.open(url, "_blank", "noopener,noreferrer");
        return;
      }
      navigate(url || fallback);
      setExpanded(false);
    },
    [navigate, stopSpeaking]
  );

  const stopListening = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    try {
      rec.stop();
    } catch {
      /* ignore */
    }
  }, []);

  const startListening = useCallback(() => {
    if (listening || aiBusy) return;
    if (!aiCaps.hasVoiceInput) {
      setVoiceError("Voice AI is available on Savvy+ and Savvy Pro.");
      return;
    }
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setVoiceError("Your browser doesn't support voice input.");
      return;
    }
    setVoiceError("");
    stopSpeaking();
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.continuous = false;
    recognitionRef.current = rec;

    let finalText = "";
    rec.onstart = () => setListening(true);
    rec.onresult = (evt) => {
      let interim = "";
      for (let i = evt.resultIndex; i < evt.results.length; i += 1) {
        const res = evt.results[i];
        if (res.isFinal) {
          finalText += res[0].transcript;
        } else {
          interim += res[0].transcript;
        }
      }
      setDraft((finalText || interim).trim());
    };
    rec.onerror = (evt) => {
      setListening(false);
      if (evt?.error === "not-allowed" || evt?.error === "service-not-allowed") {
        setVoiceError("Mic blocked. Enable microphone access in your browser.");
      } else if (evt?.error === "no-speech") {
        setVoiceError("Didn't catch that. Try again.");
      } else if (evt?.error && evt.error !== "aborted") {
        setVoiceError("Voice input failed. Try again.");
      }
    };
    rec.onend = () => {
      setListening(false);
      recognitionRef.current = null;
      const text = finalText.trim();
      if (text) {
        setDraft("");
        submitQuery(text, { source: "voice" });
      }
    };
    try {
      rec.start();
    } catch {
      setListening(false);
      setVoiceError("Couldn't start mic. Try again.");
    }
  }, [listening, aiBusy, aiCaps.hasVoiceInput, stopSpeaking, submitQuery]);

  const toggleAlerts = useCallback(async () => {
    if (alertsOn) {
      setAlertsEnabled(false);
      setAlertsOn(false);
      return;
    }
    // Turning ON — must prompt for OS permission from the click gesture.
    const perm = await requestAlertPermission();
    setAlertsPerm(perm);
    // We still enable in-app even if the OS denies (dock mirror stays useful).
    setAlertsEnabled(true);
    setAlertsOn(true);
  }, [alertsOn]);

  // Keep the "fired today" counter in sync with localStorage while panel open.
  useEffect(() => {
    if (!expanded) return undefined;
    setAlertsToday(getAlertsFiredToday());
    const id = setInterval(() => setAlertsToday(getAlertsFiredToday()), 30000);
    return () => clearInterval(id);
  }, [expanded]);

  const refreshSuggestions = useCallback(
    async ({ force = false } = {}) => {
      if (!user) return;
      setSuggestionsLoading(true);
      try {
        const picks = await buildPredictiveSuggestions({ force });
        setSuggestions(picks);
        suggestionsFetchAtRef.current = Date.now();
      } catch {
        /* ignore — panel just won't render picks this cycle */
      } finally {
        setSuggestionsLoading(false);
      }
    },
    [user]
  );

  // Fetch on first expand + refresh every 15 minutes while panel is open.
  useEffect(() => {
    if (!expanded || !user) return undefined;
    const stale = Date.now() - suggestionsFetchAtRef.current > 15 * 60 * 1000;
    if (stale || suggestions.length === 0) refreshSuggestions();
    const id = setInterval(() => refreshSuggestions(), 15 * 60 * 1000);
    return () => clearInterval(id);
  }, [expanded, user, refreshSuggestions, suggestions.length]);

  // When user behavior changes (click/save/category view) invalidate cache so
  // the next open reflects fresh preferences.
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onChange = () => invalidatePredictiveCache();
    window.addEventListener("f10-behavior-updated", onChange);
    return () => window.removeEventListener("f10-behavior-updated", onChange);
  }, []);

  const toggleVoice = useCallback(() => {
    setVoiceOn((prev) => {
      const next = !prev;
      saveVoicePref(next);
      if (!next) {
        // Turning voice OFF also silences any in-flight utterance.
        const synth = getSynth();
        if (synth) {
          try {
            synth.cancel();
          } catch {
            /* ignore */
          }
        }
      }
      return next;
    });
  }, []);

  // Prime voice list (Chrome loads voices async). Harmless if unsupported.
  useEffect(() => {
    const synth = getSynth();
    if (!synth || typeof synth.onvoiceschanged === "undefined") return undefined;
    const handler = () => {
      /* just forces list population */
    };
    synth.onvoiceschanged = handler;
    return () => {
      if (synth.onvoiceschanged === handler) synth.onvoiceschanged = null;
    };
  }, []);

  // Stop mic + TTS when the panel closes so no ghost audio hangs around.
  useEffect(() => {
    if (!expanded) {
      stopListening();
      stopSpeaking();
    }
  }, [expanded, stopListening, stopSpeaking]);

  useEffect(
    () => () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      stopListening();
      stopSpeaking();
    },
    [stopListening, stopSpeaking]
  );

  if (!user) return null;

  const hintCount = sorted.length;

  return (
    <div className="f10-assistant-dock" aria-live="polite">
      {coachToast ? (
        <div
          className={`f10-assistant-coach-toast f10-assistant-coach-toast--${coachToast.tone || "coach"}`}
          role="status"
        >
          <button
            type="button"
            className="f10-assistant-coach-toast-x"
            aria-label="Dismiss tip"
            onClick={() => setCoachToast(null)}
          >
            ×
          </button>
          <div className="f10-assistant-coach-toast-eyebrow">
            {coachToast.eyebrow || SCOUT_COPY.assistant.coachEyebrow}
          </div>
          <div className="f10-assistant-coach-toast-title">{coachToast.title}</div>
          <p className="f10-assistant-coach-toast-body">{coachToast.body}</p>
        </div>
      ) : null}
      {expanded ? (
        <div className="f10-assistant-panel f10-assistant-panel--ai">
          <div className="f10-assistant-panel-hd">
            <h3>{SAVVY_SCOUT.winLane}</h3>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              aria-label="Collapse assistant"
            >
              ×
            </button>
          </div>

          <div className="f10-assistant-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "ask"}
              className={`f10-assistant-tab ${activeTab === "ask" ? "f10-assistant-tab--active" : ""}`}
              onClick={() => setActiveTab("ask")}
            >
              {SAVVY_SCOUT.ask}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "hints"}
              className={`f10-assistant-tab ${activeTab === "hints" ? "f10-assistant-tab--active" : ""}`}
              onClick={() => setActiveTab("hints")}
            >
              Hints
              {hintCount > 0 ? (
                <span className="f10-assistant-tab-count">{hintCount}</span>
              ) : null}
            </button>
          </div>

          {activeTab === "ask" ? (
            <div className="f10-assistant-panel-bd f10-assistant-ai-bd">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-200">
                  {SAVVY_SCOUT.shortTitle} Active
                </span>
                <span className="rounded-full border border-cyan-400/40 bg-cyan-500/10 px-2 py-0.5 text-[11px] font-semibold text-cyan-100">
                  {SCOUT_COPY.assistant.monitoringBadge}
                </span>
                <span className="rounded-full border border-purple-400/40 bg-purple-500/10 px-2 py-0.5 text-[11px] font-semibold text-purple-100">
                  Tier: {aiCaps.tierLabel}
                </span>
                <span className="rounded-full border border-indigo-400/40 bg-indigo-500/10 px-2 py-0.5 text-[11px] font-semibold text-indigo-100">
                  Savvy OS v1: {aiStateLabel}
                </span>
              </div>
              {suggestions.length > 0 || suggestionsLoading ? (
                <section
                  className="f10-assistant-ai-picks"
                  aria-label="Savvy Scout's proactive picks"
                >
                  <div className="f10-assistant-ai-picks-hd">
                    <span className="f10-assistant-ai-picks-eyebrow">
                      {SCOUT_COPY.assistant.picksEyebrow}
                    </span>
                    <button
                      type="button"
                      className="f10-assistant-ai-picks-refresh"
                      onClick={() => refreshSuggestions({ force: true })}
                      disabled={suggestionsLoading}
                      aria-label="Refresh picks"
                      title="Refresh picks"
                    >
                      {suggestionsLoading ? "…" : "↻"}
                    </button>
                  </div>
                  {suggestionsLoading && suggestions.length === 0 ? (
                    <div className="f10-assistant-ai-picks-skel">
                      <span />
                      <span />
                    </div>
                  ) : (
                    <ul className="f10-assistant-ai-picks-list">
                      {suggestions.map((s) => (
                        <li
                          key={s.id}
                          className={`f10-assistant-ai-pick f10-assistant-ai-pick--${s.tone || "info"}`}
                        >
                          <div className="f10-assistant-ai-pick-body">
                            <div className="f10-assistant-ai-pick-title">
                              {s.title}
                            </div>
                            <div className="f10-assistant-ai-pick-reason">
                              {s.reason}
                            </div>
                          </div>
                          <button
                            type="button"
                            className={`f10-assistant-ai-pick-cta f10-assistant-ai-pick-cta--${s.tone || "info"}`}
                            onClick={() => handleSuggestionClick(s)}
                          >
                            {s.action?.label || "View"}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ) : null}

              <form className="f10-assistant-ai-form" onSubmit={onSubmit}>
                {supportsSR ? (
                  <button
                    type="button"
                    className={`f10-assistant-ai-mic ${listening ? "f10-assistant-ai-mic--live" : ""}`}
                    onClick={() => (listening ? stopListening() : startListening())}
                    aria-label={listening ? "Stop listening" : "Speak to Savvy"}
                    aria-pressed={listening}
                    disabled={aiBusy && !listening}
                    title={
                      aiCaps.hasVoiceInput
                        ? listening
                          ? "Listening… tap to stop"
                          : "Speak to Savvy"
                        : "Voice AI unlocks on Savvy+"
                    }
                  >
                    <span aria-hidden className="f10-assistant-ai-mic-ico">
                      {listening ? "■" : "🎙"}
                    </span>
                  </button>
                ) : null}
                <input
                  ref={inputRef}
                  type="text"
                  className="f10-assistant-ai-input"
                  placeholder={listening ? "Listening…" : SAVVY_SCOUT.askPlaceholder}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  disabled={aiBusy}
                  aria-label="Ask Savvy Scout"
                  autoComplete="off"
                />
                <button
                  type="submit"
                  className="f10-assistant-ai-send"
                  disabled={!draft.trim() || aiBusy}
                  aria-label="Send to Savvy Scout"
                >
                  {aiBusy ? "…" : "Ask"}
                </button>
              </form>

              <div className="f10-assistant-ai-voicebar">
                <div className="f10-assistant-ai-voicebar-group">
                  {supportsTTS ? (
                    <button
                      type="button"
                      role="switch"
                      aria-checked={voiceOn}
                      className={`f10-assistant-ai-voicetoggle ${voiceOn ? "f10-assistant-ai-voicetoggle--on" : ""}`}
                      onClick={toggleVoice}
                      title={voiceOn ? "Voice replies on" : "Voice replies off"}
                    >
                      <span className="f10-assistant-ai-voicetoggle-dot" aria-hidden />
                      <span className="f10-assistant-ai-voicetoggle-label">
                        Voice {voiceOn ? "ON" : "OFF"}
                      </span>
                    </button>
                  ) : null}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={alertsOn}
                    className={`f10-assistant-ai-voicetoggle f10-assistant-ai-voicetoggle--alerts ${alertsOn ? "f10-assistant-ai-voicetoggle--on" : ""}`}
                    onClick={toggleAlerts}
                    title={
                      alertsOn
                        ? alertsPerm === "granted"
                          ? `Alerts on · ${alertsToday}/3 today`
                          : `Alerts on (in-app only) · ${alertsToday}/3 today`
                        : "Alerts off"
                    }
                  >
                    <span className="f10-assistant-ai-voicetoggle-dot" aria-hidden />
                    <span className="f10-assistant-ai-voicetoggle-label">
                      Alerts {alertsOn ? "ON" : "OFF"}
                    </span>
                    {alertsOn ? (
                      <span className="f10-assistant-ai-voicetoggle-count">
                        {alertsToday}/3
                      </span>
                    ) : null}
                  </button>
                </div>
                {listening ? (
                  <span className="f10-assistant-ai-voicebar-status f10-assistant-ai-voicebar-status--live">
                    ● Listening
                  </span>
                ) : speaking ? (
                  <button
                    type="button"
                    className="f10-assistant-ai-voicebar-status f10-assistant-ai-voicebar-status--speaking"
                    onClick={stopSpeaking}
                    title="Stop speaking"
                  >
                    ▮▮ Speaking — tap to stop
                  </button>
                ) : null}
              </div>

              {alertsOn && alertsPerm === "denied" ? (
                <div className="f10-assistant-ai-error">
                  Browser alerts blocked — you'll still see them in Win Lane.
                </div>
              ) : null}

              {voiceError ? (
                <div className="f10-assistant-ai-error">{voiceError}</div>
              ) : null}
              {aiError ? <div className="f10-assistant-ai-error">{aiError}</div> : null}

              {history.length === 0 && !aiBusy ? (
                <div className="f10-assistant-ai-empty">
                  <div className="f10-assistant-ai-empty-title">Try asking:</div>
                  <ul className="f10-assistant-ai-suggest">
                    <li>
                      <button
                        type="button"
                        onClick={() => submitQuery("find PS5 deals")}
                      >
                        "find PS5 deals"
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        onClick={() => submitQuery("how do I earn points?")}
                      >
                        "how do I earn points?"
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        onClick={() => submitQuery("how do I win more auctions?")}
                      >
                        "how do I win more auctions?"
                      </button>
                    </li>
                  </ul>
                </div>
              ) : null}

              <div className="f10-assistant-ai-thread">
                {history.map((row) => (
                  <div key={row.id} className="f10-assistant-ai-turn">
                    <div className="f10-assistant-ai-q">
                      <span className="f10-assistant-ai-q-tag">You</span>
                      <span className="f10-assistant-ai-q-text">{row.query}</span>
                    </div>
                    {row.pending ? (
                      <div className="f10-assistant-ai-a f10-assistant-ai-a--pending">
                        {SCOUT_COPY.assistant.thinking}
                      </div>
                    ) : row.answer ? (
                      <AnswerBubble
                        turnId={row.id}
                        answer={row.answer}
                        onNav={handleNav}
                        onSpeak={supportsTTS ? speakAnswer : null}
                        voiceOn={voiceOn}
                        onNotifyMe={handleNotifyMe}
                        onShowBest={handleShowBest}
                        onTryAnother={handleTryAnother}
                        onCategoryJump={handleCategoryJump}
                      onVoiceCreateAlert={handleVoiceCreateAlert}
                      onVoiceExpandRange={handleVoiceExpandRange}
                      onVoiceShowMore={handleVoiceShowMore}
                      />
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="f10-assistant-panel-bd">
              {sorted.length === 0 ? (
                <div className="f10-assistant-empty">
                  Clear. I’ll nudge you on saves, tiers, and promos.
                </div>
              ) : (
                sorted.map((row) => (
                  <article
                    key={row.id}
                    className={`f10-assistant-card f10-assistant-card--${row.tone || "info"}`}
                  >
                    <button
                      type="button"
                      className="f10-assistant-card-x"
                      aria-label="Dismiss"
                      onClick={() => dismiss(row.id)}
                    >
                      ×
                    </button>
                    <div className="f10-assistant-card-eyebrow">
                      {row.tone === "urgent" && "⚡ Urgency"}
                      {row.tone === "gem" && "💎 Gem"}
                      {row.tone === "watch" && "⭐ Watchlist"}
                      {row.tone === "promo" && "📣 Visibility"}
                      {row.tone === "scan" && "🔍 Scan"}
                      {row.tone === "info" && "✦ Intel"}
                      {row.tone === "coach" && "◎ Coach"}
                    </div>
                    <h4 className="f10-assistant-card-title">{row.title}</h4>
                    <p className="f10-assistant-card-body">{row.body}</p>
                  </article>
                ))
              )}
              {sorted.length > 0 ? (
                <div className="f10-assistant-foot">
                  <button
                    type="button"
                    className="f10-assistant-clear-all"
                    onClick={clearAll}
                  >
                    Clear all
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      <SavvyWalletBubble />

      <button
        type="button"
        className={`f10-assistant-toggle ${unread > 0 ? "f10-assistant-toggle--pulse" : ""}`}
        onClick={() => (expanded ? setExpanded(false) : openPanel())}
        aria-expanded={expanded}
        aria-label={expanded ? `Close ${SAVVY_SCOUT.shortTitle}` : `Open ${SAVVY_SCOUT.shortTitle}`}
        title={expanded ? undefined : SAVVY_SCOUT.ask}
      >
        <span aria-hidden style={{ fontSize: "16px" }}>
          ✦
        </span>
        <span className="f10-assistant-toggle-label">{SAVVY_SCOUT.shortTitle}</span>
        {unread > 0 && !expanded ? (
          <span className="f10-assistant-badge">{unread > 9 ? "9+" : unread}</span>
        ) : null}
      </button>
    </div>
  );
}

function AnswerBubble({
  turnId,
  answer,
  onNav,
  onSpeak,
  voiceOn,
  onNotifyMe,
  onShowBest,
  onTryAnother,
  onCategoryJump,
  onVoiceCreateAlert,
  onVoiceExpandRange,
  onVoiceShowMore,
}) {
  if (!answer) return null;
  const verdictTone = answer.verdict?.tone || "info";
  const isWeakBoard = answer.kind === "weak_board";
  return (
    <div
      className={`f10-assistant-ai-a f10-assistant-ai-a--${answer.kind} f10-assistant-ai-a--tone-${verdictTone}${
        isWeakBoard ? " f10-assistant-ai-a--weakboard" : ""
      }${answer.notifyState === "saved" ? " f10-assistant-ai-a--watching" : ""}`}
    >
      <div className="f10-assistant-ai-a-head">
        <span className="f10-assistant-ai-a-tag">Savvy</span>
        {onSpeak && voiceOn ? (
          <button
            type="button"
            className="f10-assistant-ai-replay"
            onClick={() => onSpeak(answer)}
            aria-label="Hear this answer again"
            title="Hear again"
          >
            🔊
          </button>
        ) : null}
      </div>
      <div className="f10-assistant-ai-a-body">
        {answer.verdict ? (
          <div
            className={`f10-assistant-ai-verdict f10-assistant-ai-verdict--${verdictTone}`}
          >
            {answer.verdict.label}
          </div>
        ) : null}
        {answer.reason ? (
          <p className="f10-assistant-ai-reason">{answer.reason}</p>
        ) : null}
        {answer.kind === "voice_results" ? (
          <div className="f10-assistant-ai-weak-actions">
            <button
              type="button"
              className="f10-assistant-ai-weak-btn f10-assistant-ai-weak-btn--primary"
              onClick={() => onVoiceCreateAlert?.(turnId, answer)}
              disabled={answer.alertState === "created"}
            >
              <span aria-hidden>🔔</span>{" "}
              {answer.alertState === "created" ? "Alert Created" : "Create Alert"}
            </button>
            <button
              type="button"
              className="f10-assistant-ai-weak-btn"
              onClick={() => onVoiceExpandRange?.(turnId, answer)}
            >
              <span aria-hidden>↔</span> Expand Range
            </button>
            <button
              type="button"
              className="f10-assistant-ai-weak-btn"
              onClick={() => onVoiceShowMore?.(turnId, answer)}
            >
              <span aria-hidden>＋</span> Show More
            </button>
          </div>
        ) : null}

        {isWeakBoard && answer.insight && answer.notifyState !== "saved" ? (
          <p className="f10-assistant-ai-insight">
            <span aria-hidden>◉</span> {answer.insight}
          </p>
        ) : null}

        {isWeakBoard && answer.notifyState === "saved" ? (
          <div className="f10-assistant-ai-watching">
            <span className="f10-assistant-ai-watching-dot" aria-hidden />
            <span>I'll watch for you</span>
          </div>
        ) : null}

        {isWeakBoard &&
        answer.notifyState !== "saved" &&
        !answer.bestAvailable &&
        !answer.categorySuggest ? (
          <div className="f10-assistant-ai-weak-actions">
            <button
              type="button"
              className="f10-assistant-ai-weak-btn f10-assistant-ai-weak-btn--primary"
              onClick={() => onNotifyMe?.(turnId, answer)}
            >
              <span aria-hidden>🔔</span> Notify Me
            </button>
            {Array.isArray(answer.allDeals) && answer.allDeals.length > 0 ? (
              <button
                type="button"
                className="f10-assistant-ai-weak-btn"
                onClick={() => onShowBest?.(turnId, answer)}
              >
                <span aria-hidden>⚡</span> Show Best Available
              </button>
            ) : null}
            <button
              type="button"
              className="f10-assistant-ai-weak-btn"
              onClick={() => onTryAnother?.(turnId, answer)}
            >
              <span aria-hidden>🎯</span> Try Another Category
            </button>
          </div>
        ) : null}

        {isWeakBoard && answer.categorySuggest ? (
          <div className="f10-assistant-ai-altcat">
            <p className="f10-assistant-ai-altcat-msg">
              {answer.categorySuggest.message}
            </p>
            <div className="f10-assistant-ai-altcat-options">
              {answer.categorySuggest.options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className="f10-assistant-ai-altcat-btn"
                  onClick={() => onCategoryJump?.(opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {isWeakBoard &&
        Array.isArray(answer.bestAvailable) &&
        answer.bestAvailable.length > 0 ? (
          <>
            <div className="f10-assistant-ai-honesty">
              {answer.bestAvailableLabel || "Best available right now (not top-tier)"}
            </div>
            <ul className="f10-assistant-ai-deals">
              {answer.bestAvailable.map((deal) => {
                const dTone = deal.verdict?.tone || "watch";
                return (
                  <li
                    key={deal.id}
                    className={`f10-assistant-ai-deal f10-assistant-ai-deal--${dTone}`}
                  >
                    <div className="f10-assistant-ai-deal-img">
                      {deal.image ? (
                        <img src={deal.image} alt="" loading="lazy" />
                      ) : (
                        <div className="f10-assistant-ai-deal-imgfallback">✦</div>
                      )}
                    </div>
                    <div className="f10-assistant-ai-deal-meta">
                      <div className="f10-assistant-ai-deal-title">{deal.title}</div>
                      <div className="f10-assistant-ai-deal-row">
                        <span className="f10-assistant-ai-deal-price">
                          {deal.priceText}
                        </span>
                        {deal.verdict ? (
                          <span
                            className={`f10-assistant-ai-deal-verdict f10-assistant-ai-deal-verdict--${dTone}`}
                          >
                            {deal.verdict.label}
                          </span>
                        ) : null}
                      </div>
                      <a
                        href={deal.url}
                        target="_blank"
                        rel="noreferrer"
                        className="f10-assistant-ai-deal-cta"
                      >
                        View Deal
                      </a>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        ) : null}

        {(answer.kind === "deals" || answer.kind === "voice_results") &&
        Array.isArray(answer.deals) ? (
          <ul className="f10-assistant-ai-deals">
            {answer.deals.map((deal) => {
              const dTone = deal.verdict?.tone || "watch";
              return (
                <li
                  key={deal.id}
                  className={`f10-assistant-ai-deal f10-assistant-ai-deal--${dTone}`}
                >
                  <div className="f10-assistant-ai-deal-img">
                    {deal.image ? (
                      <img src={deal.image} alt="" loading="lazy" />
                    ) : (
                      <div className="f10-assistant-ai-deal-imgfallback">✦</div>
                    )}
                  </div>
                  <div className="f10-assistant-ai-deal-meta">
                    <div className="f10-assistant-ai-deal-title">{deal.title}</div>
                    <div className="f10-assistant-ai-deal-row">
                      <span className="f10-assistant-ai-deal-price">
                        {deal.priceText}
                      </span>
                      {deal.verdict ? (
                        <span
                          className={`f10-assistant-ai-deal-verdict f10-assistant-ai-deal-verdict--${dTone}`}
                        >
                          {deal.verdict.label}
                        </span>
                      ) : null}
                    </div>
                    <a
                      href={deal.url}
                      target="_blank"
                      rel="noreferrer"
                      className="f10-assistant-ai-deal-cta"
                    >
                      View Deal
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
        {answer.action && !isWeakBoard ? (
          <button
            type="button"
            className={`f10-assistant-ai-gobtn f10-assistant-ai-gobtn--${verdictTone}`}
            onClick={() => onNav(answer.action.path)}
          >
            {answer.action.label} →
          </button>
        ) : null}
      </div>
    </div>
  );
}
