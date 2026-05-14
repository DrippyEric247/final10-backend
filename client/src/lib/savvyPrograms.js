/**
 * Business Savvy / Responder Savvy — program enrollment, verification,
 * reward multipliers, and claim guards.
 *
 * Everything is client-side today so the features work end-to-end without a
 * backend, but the public API is modeled to map 1:1 to future endpoints:
 *
 *   POST /api/programs/enroll          → enrollInProgram(...)
 *   POST /api/programs/verify          → verifyEnrollment(...)
 *   GET  /api/programs/me              → getEnrollment()
 *   POST /api/programs/events          → trackProgramEvent(...)
 *   GET  /api/programs/me/stats        → getProgramStats()
 *
 * Storage (localStorage):
 *   f10_savvy_program_v1          → enrollment object
 *   f10_savvy_program_events_v1   → rolling event log (≤200)
 *   f10_savvy_program_claims_v1   → { [offerId]: { at, count } } dedupe
 *   f10_savvy_program_daily_v1    → { date, count } daily claim counter
 */

const ENROLL_KEY = "f10_savvy_program_v1";
const EVENT_KEY = "f10_savvy_program_events_v1";
const CLAIMS_KEY = "f10_savvy_program_claims_v1";
const DAILY_KEY = "f10_savvy_program_daily_v1";
const UPDATE_EVENT = "f10-savvy-program-updated";
const EVENT_CAP = 200;

export const USER_TYPES = Object.freeze({
  CONSUMER: "consumer",
  BUSINESS: "business",
  RESPONDER: "responder",
});

export const VERIFICATION_STATUS = Object.freeze({
  PENDING: "pending",
  VERIFIED: "verified",
  REJECTED: "rejected",
});

// Reward economy — keep co-located so both client and (future) server can
// import these as the source of truth.
export const REWARD_RULES = Object.freeze({
  basePointsPerDollar: 1,
  businessMultiplier: 1.2,
  responderMultiplier: 1.4,
  pendingMultiplier: 1.0, // pending enrollments only earn base
  bulkTiers: [
    { threshold: 500, bonus: 0.5 },
    { threshold: 200, bonus: 0.25 },
    { threshold: 100, bonus: 0.1 },
  ],
  minTrustForRewards: 65, // "no rewards for low-trust listings"
});

export const CLAIM_LIMITS = Object.freeze({
  consumer: 12,
  business: 25,
  responder: 20,
  dedupeWindowMs: 12 * 60 * 60 * 1000, // same offer can't be re-claimed within 12h
});

// Email domains that clearly don't indicate a business account.
const CONSUMER_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "ymail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "icloud.com",
  "me.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "msn.com",
  "comcast.net",
]);

// Responder agency kinds — used by both enrollment and the badge tooltip.
export const RESPONDER_AGENCIES = [
  { id: "fire", label: "Fire / Rescue" },
  { id: "ems", label: "EMS / Paramedic" },
  { id: "police", label: "Police / Law enforcement" },
  { id: "nurse", label: "Nurse / Medical" },
  { id: "military", label: "Active / Veteran military" },
  { id: "teacher", label: "Teacher / Educator" },
  { id: "other", label: "Other verified service" },
];

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function safeLS() {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

function read(key, fallback) {
  const ls = safeLS();
  if (!ls) return fallback;
  try {
    const raw = JSON.parse(ls.getItem(key) || "null");
    return raw == null ? fallback : raw;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  const ls = safeLS();
  if (!ls) return;
  try {
    ls.setItem(key, JSON.stringify(value));
  } catch {
    /* quota — best-effort */
  }
}

function emit() {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(UPDATE_EVENT));
  } catch {
    /* ignore */
  }
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function extractEmailDomain(email) {
  const m = String(email || "").trim().toLowerCase().match(/^[^@]+@([^@]+)$/);
  return m ? m[1] : "";
}

function looksLikeBusinessDomain(domain) {
  if (!domain) return false;
  if (CONSUMER_EMAIL_DOMAINS.has(domain)) return false;
  // anything with a TLD that isn't a consumer webmail passes the first filter;
  // refuse .test/.example/.invalid.
  if (/\.(test|example|invalid|localhost)$/.test(domain)) return false;
  // require at least one dot and 4+ chars (e.g. "acme.co").
  return domain.includes(".") && domain.length >= 4;
}

// ---------------------------------------------------------------------------
// Enrollment
// ---------------------------------------------------------------------------

export class ProgramEnrollmentError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export function getEnrollment() {
  const raw = read(ENROLL_KEY, null);
  if (!raw || typeof raw !== "object") {
    return {
      userType: USER_TYPES.CONSUMER,
      verificationStatus: null,
      enrolledAt: 0,
      verifiedAt: 0,
      meta: {},
    };
  }
  return {
    userType: raw.userType || USER_TYPES.CONSUMER,
    verificationStatus: raw.verificationStatus || null,
    enrolledAt: Number(raw.enrolledAt) || 0,
    verifiedAt: Number(raw.verifiedAt) || 0,
    meta: raw.meta && typeof raw.meta === "object" ? raw.meta : {},
  };
}

export function isEnrolledInProgram() {
  const e = getEnrollment();
  return e.userType !== USER_TYPES.CONSUMER;
}

/**
 * Enroll the current user in a program. Business applications are auto-verified
 * when the business email domain passes the naive "not consumer webmail" check;
 * responders always drop to pending for document/admin verification.
 */
export function enrollInProgram(input) {
  const userType = input?.userType;
  if (![USER_TYPES.BUSINESS, USER_TYPES.RESPONDER].includes(userType)) {
    throw new ProgramEnrollmentError("invalid_type", "Pick a program to enroll in.");
  }

  const meta = {};
  let verificationStatus = VERIFICATION_STATUS.PENDING;
  let verifiedAt = 0;

  if (userType === USER_TYPES.BUSINESS) {
    const email = String(input?.businessEmail || "").trim();
    const name = String(input?.businessName || "").trim();
    const paymentRef = String(input?.paymentRef || "").trim();
    if (!name) throw new ProgramEnrollmentError("missing_name", "Business name is required.");
    const domain = extractEmailDomain(email);
    if (!domain) {
      throw new ProgramEnrollmentError("missing_email", "A business email is required.");
    }
    if (!paymentRef) {
      throw new ProgramEnrollmentError("missing_payment", "Attach a payment reference (card last-4 / EIN).");
    }
    meta.businessName = name;
    meta.businessEmail = email;
    meta.domain = domain;
    meta.paymentRef = paymentRef.slice(-24);
    if (looksLikeBusinessDomain(domain)) {
      verificationStatus = VERIFICATION_STATUS.VERIFIED;
      verifiedAt = Date.now();
      meta.verifiedBy = "auto_domain_check";
    }
  }

  if (userType === USER_TYPES.RESPONDER) {
    const agency = String(input?.agencyId || "").trim();
    const agencyName = String(input?.agencyName || "").trim();
    const attest = Boolean(input?.attestTruth);
    if (!agency) {
      throw new ProgramEnrollmentError("missing_agency", "Pick a responder category.");
    }
    if (!agencyName) {
      throw new ProgramEnrollmentError("missing_agency_name", "Enter your agency or department name.");
    }
    if (!attest) {
      throw new ProgramEnrollmentError(
        "missing_attestation",
        "Confirm the attestation to continue."
      );
    }
    meta.agencyId = agency;
    meta.agencyName = agencyName;
    meta.documentName = String(input?.documentName || "").slice(0, 128) || null;
    meta.attestedAt = Date.now();
    // Responders always start pending; admin approves from /admin/cosmetics-ish flow.
  }

  const enrollment = {
    userType,
    verificationStatus,
    enrolledAt: Date.now(),
    verifiedAt,
    meta,
  };
  write(ENROLL_KEY, enrollment);
  emit();
  return enrollment;
}

/** Admin / dev helper — flip an enrollment to verified. */
export function verifyEnrollment({ verifiedBy } = {}) {
  const current = read(ENROLL_KEY, null);
  if (!current) {
    throw new ProgramEnrollmentError("no_enrollment", "No active enrollment to verify.");
  }
  const updated = {
    ...current,
    verificationStatus: VERIFICATION_STATUS.VERIFIED,
    verifiedAt: Date.now(),
    meta: { ...(current.meta || {}), verifiedBy: String(verifiedBy || "admin") },
  };
  write(ENROLL_KEY, updated);
  emit();
  return updated;
}

export function leaveProgram() {
  write(ENROLL_KEY, null);
  emit();
}

// ---------------------------------------------------------------------------
// Reward math
// ---------------------------------------------------------------------------

/**
 * Return the program multiplier a user earns right now. Pending enrollments
 * earn at the consumer rate so we never promise rewards before verification.
 */
export function getProgramMultiplier(enrollment) {
  const e = enrollment || getEnrollment();
  if (e.verificationStatus !== VERIFICATION_STATUS.VERIFIED) {
    return REWARD_RULES.pendingMultiplier;
  }
  if (e.userType === USER_TYPES.BUSINESS) return REWARD_RULES.businessMultiplier;
  if (e.userType === USER_TYPES.RESPONDER) return REWARD_RULES.responderMultiplier;
  return 1;
}

function bulkBonusFor(orderValue) {
  const v = Number(orderValue) || 0;
  for (const tier of REWARD_RULES.bulkTiers) {
    if (v >= tier.threshold) return tier.bonus;
  }
  return 0;
}

/**
 * Compute the final reward for a claim. Returns a breakdown so the UI can
 * explain how we got to the number.
 *
 * @param {{ orderValue:number, trustScore?:number, basePoints?:number }} offer
 * @param {ReturnType<typeof getEnrollment>} [enrollment]
 * @returns {{ total:number, base:number, multiplier:number, bulk:number, blocked:boolean, reason?:string }}
 */
export function computeOfferReward(offer, enrollment) {
  const trust = Number(offer?.trustScore ?? offer?.trust ?? 80);
  const base =
    Number(offer?.basePoints) > 0
      ? Number(offer.basePoints)
      : Math.max(0, Math.round(Number(offer?.orderValue || offer?.price || 0)));
  if (trust < REWARD_RULES.minTrustForRewards) {
    return {
      total: 0,
      base,
      multiplier: 1,
      bulk: 0,
      blocked: true,
      reason: `Trust score ${Math.round(trust)} is below the ${REWARD_RULES.minTrustForRewards} floor — no rewards.`,
    };
  }
  const enr = enrollment || getEnrollment();
  const multiplier = getProgramMultiplier(enr);
  const bulk = bulkBonusFor(offer?.orderValue || offer?.price || 0);
  const total = Math.round(base * (multiplier + bulk));
  return { total, base, multiplier, bulk, blocked: false };
}

// ---------------------------------------------------------------------------
// Tracking
// ---------------------------------------------------------------------------

function pushEvent(entry) {
  const log = read(EVENT_KEY, []);
  const list = Array.isArray(log) ? log : [];
  list.unshift(entry);
  write(EVENT_KEY, list.slice(0, EVENT_CAP));
}

export function trackProgramEvent({
  userKey,
  eventType,
  offerId,
  offer,
  payload,
} = {}) {
  const enr = getEnrollment();
  const entry = {
    at: Date.now(),
    userKey: userKey || null,
    userType: enr.userType,
    verificationStatus: enr.verificationStatus,
    eventType: String(eventType || "unknown"),
    offerId: offerId || offer?.id || null,
    category: offer?.category || null,
    orderValue: Number(offer?.orderValue ?? offer?.price ?? 0) || 0,
    trustScore: Number(offer?.trustScore ?? 0) || 0,
    payload: payload || null,
  };
  pushEvent(entry);
  return entry;
}

export function readProgramEvents(limit = 50) {
  const log = read(EVENT_KEY, []);
  const list = Array.isArray(log) ? log : [];
  return list.slice(0, Math.max(0, Number(limit) || 50));
}

// ---------------------------------------------------------------------------
// Claims guard (dedupe + daily cap)
// ---------------------------------------------------------------------------

function readClaims() {
  const raw = read(CLAIMS_KEY, {});
  return raw && typeof raw === "object" ? raw : {};
}

function getDailyCap() {
  const enr = getEnrollment();
  return CLAIM_LIMITS[enr.userType] ?? CLAIM_LIMITS.consumer;
}

function getDailyCount() {
  const d = read(DAILY_KEY, null);
  if (!d || d.date !== todayKey()) return 0;
  return Number(d.count) || 0;
}

function bumpDailyCount() {
  const next = { date: todayKey(), count: getDailyCount() + 1 };
  write(DAILY_KEY, next);
}

export function getProgramClaimStatus() {
  return {
    dailyCap: getDailyCap(),
    dailyUsed: getDailyCount(),
    remaining: Math.max(0, getDailyCap() - getDailyCount()),
  };
}

/**
 * Pre-claim check. Returns `{ ok, reason }`.
 */
export function canClaimOffer(offer) {
  if (!offer) return { ok: false, reason: "Invalid offer." };
  const offerId = offer.id;
  if (!offerId) return { ok: false, reason: "Offer is missing an id." };
  const trust = Number(offer.trustScore ?? offer.trust ?? 80);
  if (trust < REWARD_RULES.minTrustForRewards) {
    return {
      ok: false,
      reason: `Trust ${Math.round(trust)} is below the rewards floor — we won't issue points here.`,
    };
  }
  const cap = getDailyCap();
  if (getDailyCount() >= cap) {
    return { ok: false, reason: `Daily claim limit reached (${cap}/day).` };
  }
  const claims = readClaims();
  const prev = claims[offerId];
  if (prev && Date.now() - Number(prev.at || 0) < CLAIM_LIMITS.dedupeWindowMs) {
    return { ok: false, reason: "You already claimed this offer recently." };
  }
  return { ok: true, reason: null };
}

/**
 * Record a successful claim. The caller is responsible for the actual reward
 * grant — this module just updates counters / dedupe and emits an event so
 * the dashboard refreshes.
 */
export function recordClaim(offer, { pointsAwarded = 0, orderValue } = {}) {
  if (!offer?.id) return null;
  const claims = readClaims();
  const existing = claims[offer.id] || { count: 0 };
  claims[offer.id] = {
    at: Date.now(),
    count: Number(existing.count || 0) + 1,
    offerId: offer.id,
    category: offer.category || null,
    pointsAwarded: Math.max(0, Number(pointsAwarded) || 0),
    orderValue: Number(orderValue ?? offer.orderValue ?? offer.price ?? 0) || 0,
    trustScore: Number(offer.trustScore) || 0,
    title: offer.title || null,
  };
  write(CLAIMS_KEY, claims);
  bumpDailyCount();
  trackProgramEvent({
    eventType: "claim",
    offerId: offer.id,
    offer,
    payload: { pointsAwarded: Math.max(0, Number(pointsAwarded) || 0) },
  });
  emit();
  return claims[offer.id];
}

// ---------------------------------------------------------------------------
// Stats for the dashboard
// ---------------------------------------------------------------------------

export function getProgramStats() {
  const claims = readClaims();
  const entries = Object.values(claims);
  const totalSpend = entries.reduce((a, c) => a + (Number(c.orderValue) || 0), 0);
  const totalSavvyEarned = entries.reduce((a, c) => a + (Number(c.pointsAwarded) || 0), 0);

  const byCategory = new Map();
  for (const c of entries) {
    const k = c.category || "other";
    const cur = byCategory.get(k) || { category: k, spend: 0, count: 0 };
    cur.spend += Number(c.orderValue) || 0;
    cur.count += 1;
    byCategory.set(k, cur);
  }
  const topCategories = Array.from(byCategory.values())
    .sort((a, b) => b.spend - a.spend || b.count - a.count)
    .slice(0, 5);

  const recentOffersUsed = entries
    .sort((a, b) => Number(b.at) - Number(a.at))
    .slice(0, 10)
    .map((c) => ({
      offerId: c.offerId,
      title: c.title,
      category: c.category,
      pointsAwarded: c.pointsAwarded,
      orderValue: c.orderValue,
      at: c.at,
      trustScore: c.trustScore,
    }));

  return {
    totalSpend,
    totalSavvyEarned,
    topCategories,
    recentOffersUsed,
    totalClaims: entries.length,
  };
}

// ---------------------------------------------------------------------------
// Offer decoration (filters + "bonus badges" for the UI)
// ---------------------------------------------------------------------------

function isBulkFriendly(offer) {
  const price = Number(offer?.price || offer?.orderValue || 0);
  const text = `${offer?.title || ""} ${offer?.description || ""}`.toLowerCase();
  if (/bulk|case of|pack of|pallet|wholesale|multi-?pack/.test(text)) return true;
  return price >= 200;
}

function isTeamFriendly(offer) {
  const category = String(offer?.category || "").toLowerCase();
  const text = `${offer?.title || ""}`.toLowerCase();
  if (["electronics", "home", "auto", "office"].includes(category)) return true;
  return /team|office|uniform|gear|kit|fleet/.test(text);
}

function isTrustedVendor(offer) {
  return Number(offer?.trustScore || 0) >= 90;
}

/**
 * Returns a decorated copy of the offer with program-specific flags + a ranked
 * reward breakdown. Safe to call for consumer users — decorations just become
 * informational without multipliers.
 */
export function decorateOfferForProgram(offer, enrollment) {
  if (!offer) return offer;
  const enr = enrollment || getEnrollment();
  const reward = computeOfferReward(
    { ...offer, orderValue: offer.price || offer.orderValue || 0 },
    enr
  );
  // Chip labels are aimed at business/responder teams — only render them when
  // the user is enrolled so the consumer feed stays focused on deal signal.
  const enrolled = enr.userType !== USER_TYPES.CONSUMER;
  const chips = [];
  if (enrolled) {
    if (isTrustedVendor(offer)) chips.push({ id: "trusted", label: "Trusted vendor" });
    if (isBulkFriendly(offer)) chips.push({ id: "bulk", label: "Bulk-friendly" });
    if (isTeamFriendly(offer)) chips.push({ id: "team", label: "Best for teams" });
  }
  const showBonus =
    enr.userType !== USER_TYPES.CONSUMER &&
    enr.verificationStatus === VERIFICATION_STATUS.VERIFIED &&
    !reward.blocked &&
    reward.multiplier > 1;
  return {
    ...offer,
    program: {
      enrolled,
      verified: enr.verificationStatus === VERIFICATION_STATUS.VERIFIED,
      multiplier: reward.multiplier,
      bulkBonus: reward.bulk,
      rewardTotal: reward.total,
      rewardBlocked: reward.blocked,
      rewardReason: reward.reason || null,
      chips,
      showBonus,
      bonusLabel: showBonus
        ? `Extra rewards · ${Math.round((reward.multiplier + reward.bulk) * 100)}% payout`
        : null,
    },
  };
}

/**
 * Sort offers so high-trust + program-friendly listings bubble up for enrolled
 * users. Consumers keep their original order.
 */
export function prioritizeOffersForProgram(offers, enrollment) {
  if (!Array.isArray(offers)) return [];
  const enr = enrollment || getEnrollment();
  const decorated = offers.map((o) => decorateOfferForProgram(o, enr));
  if (enr.userType === USER_TYPES.CONSUMER) return decorated;
  return decorated
    .slice()
    .sort((a, b) => {
      const trustA = Number(a.trustScore) || 0;
      const trustB = Number(b.trustScore) || 0;
      if (trustA !== trustB) return trustB - trustA;
      const chipA = a.program?.chips?.length || 0;
      const chipB = b.program?.chips?.length || 0;
      if (chipA !== chipB) return chipB - chipA;
      return (b.program?.rewardTotal || 0) - (a.program?.rewardTotal || 0);
    });
}

// ---------------------------------------------------------------------------
// Profile badge data
// ---------------------------------------------------------------------------

/**
 * Dev-only: force a verified Business Savvy enrollment for program UI testing.
 */
export function devUnlockAllProgramsVerified() {
  if (typeof process !== "undefined" && process.env && process.env.NODE_ENV === "production") {
    return;
  }
  const enrollment = {
    userType: USER_TYPES.BUSINESS,
    verificationStatus: VERIFICATION_STATUS.VERIFIED,
    enrolledAt: Date.now(),
    verifiedAt: Date.now(),
    meta: {
      businessName: "Dev Unlock Co.",
      businessEmail: "dev@final10.test",
      domain: "final10.test",
      paymentRef: "dev",
      verifiedBy: "dev_override_panel",
    },
  };
  write(ENROLL_KEY, enrollment);
  emit();
}

export function getProgramBadge(enrollment) {
  const e = enrollment || getEnrollment();
  if (e.userType === USER_TYPES.BUSINESS) {
    return {
      id: "business_savvy",
      label: "Business Savvy",
      tone: "indigo",
      verified: e.verificationStatus === VERIFICATION_STATUS.VERIFIED,
      multiplier: REWARD_RULES.businessMultiplier,
    };
  }
  if (e.userType === USER_TYPES.RESPONDER) {
    return {
      id: "responder_savvy",
      label: "Responder Savvy",
      tone: "rose",
      verified: e.verificationStatus === VERIFICATION_STATUS.VERIFIED,
      multiplier: REWARD_RULES.responderMultiplier,
    };
  }
  return null;
}

export const SAVVY_PROGRAM_UPDATE_EVENT = UPDATE_EVENT;
