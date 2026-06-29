const crypto = require('crypto');
const ProgressionScanDeck = require('../models/ProgressionScanDeck');
const ProgressionActionToken = require('../models/ProgressionActionToken');
const { isProduction } = require('../config/envValidation');
const { SERVER_ONLY_EVENT_TYPES } = require('../config/battlePassTrust');

const SCAN_DECK_MS = 12 * 60 * 1000;
const BID_TOKEN_MS = 15 * 60 * 1000;
const WIN_TOKEN_MS = 20 * 60 * 1000;
const MAX_SCAN_IDS = 150;

function envTrustBypass() {
  return String(process.env.ALLOW_PROGRESSION_TRUST_BYPASS || '').toLowerCase() === 'true';
}

function trustRequired() {
  return isProduction() && !envTrustBypass();
}

function newToken() {
  return crypto.randomBytes(24).toString('hex');
}

async function refreshScanDeck(userId, listingIds) {
  const ids = Array.from(
    new Set(
      (listingIds || [])
        .map((x) => String(x || '').trim())
        .filter(Boolean)
        .slice(0, MAX_SCAN_IDS)
    )
  );
  const expiresAt = new Date(Date.now() + SCAN_DECK_MS);
  await ProgressionScanDeck.findOneAndUpdate(
    { userId },
    { $set: { listingIds: ids, expiresAt } },
    { upsert: true, new: true }
  );
}

async function listingInScanDeck(userId, listingId) {
  const lid = String(listingId || '').trim();
  if (!lid) return false;
  const doc = await ProgressionScanDeck.findOne({
    userId,
    expiresAt: { $gt: new Date() },
  }).lean();
  if (!doc || !Array.isArray(doc.listingIds)) return false;
  return doc.listingIds.includes(lid);
}

/**
 * @param {{ isWinning?: boolean|null }} bidMeta
 * @returns {{ bidToken: string, winToken?: string }}
 */
async function issueBidFlowTokens(userId, listingId, bidMeta = {}) {
  const lid = String(listingId || '').trim();
  const bidToken = newToken();
  const winEligible = Boolean(bidMeta.isWinning);
  const ops = [
    ProgressionActionToken.create({
      userId,
      listingId: lid,
      purpose: 'bid_placed',
      token: bidToken,
      expiresAt: new Date(Date.now() + BID_TOKEN_MS),
    }),
  ];
  let winToken;
  if (winEligible) {
    winToken = newToken();
    ops.push(
      ProgressionActionToken.create({
        userId,
        listingId: lid,
        purpose: 'auction_won',
        token: winToken,
        expiresAt: new Date(Date.now() + WIN_TOKEN_MS),
      })
    );
  }
  await Promise.all(ops);
  return { bidToken, winToken };
}

async function consumeActionToken(userId, listingId, purpose, token) {
  const lid = String(listingId || '').trim();
  const tok = String(token || '').trim();
  if (!lid || !tok) return false;
  const res = await ProgressionActionToken.findOneAndDelete({
    userId,
    listingId: lid,
    purpose,
    token: tok,
    expiresAt: { $gt: new Date() },
  });
  return Boolean(res);
}

/**
 * Reject client-originated events that must only be emitted server-side.
 * @returns {{ ok: true } | { ok: false, code: string, message: string }}
 */
function assertClientOriginEventAllowed(eventType) {
  if (!trustRequired()) return { ok: true };
  if (SERVER_ONLY_EVENT_TYPES.has(eventType)) {
    return {
      ok: false,
      code: 'TRUST_SERVER_EVENT_ONLY',
      message: 'This progression event must be recorded by the server from a verified action.',
    };
  }
  return { ok: true };
}

/**
 * Enforce trusted context for high-risk event types (production only unless bypass).
 * @returns {Promise<{ ok: true } | { ok: false, code: string, message: string }>}
 */
async function assertEventTrustOrDeny(event, userId) {
  if (!trustRequired()) return { ok: true };
  const p = event.payload || {};
  switch (event.type) {
    case 'auction_scanned': {
      if (!(await listingInScanDeck(userId, p.auctionId))) {
        return {
          ok: false,
          code: 'TRUST_AUCTION_REQUIRED',
          message: 'Auction scan must reference a listing from a recent search.',
        };
      }
      return { ok: true };
    }
    case 'bid_placed': {
      const tok = p.progressionTrustToken;
      if (!tok) {
        return { ok: false, code: 'TRUST_TOKEN_REQUIRED', message: 'Bid events require a server-issued trust token.' };
      }
      const consumed = await consumeActionToken(userId, p.auctionId, 'bid_placed', tok);
      if (!consumed) {
        return { ok: false, code: 'TRUST_BID_INVALID', message: 'Bid trust token is invalid or expired.' };
      }
      return { ok: true };
    }
    case 'auction_won': {
      const tok = p.progressionTrustToken;
      if (!tok) {
        return { ok: false, code: 'TRUST_TOKEN_REQUIRED', message: 'Win events require a server-issued trust token.' };
      }
      const consumed = await consumeActionToken(userId, p.auctionId, 'auction_won', tok);
      if (!consumed) {
        return { ok: false, code: 'TRUST_WIN_INVALID', message: 'Win trust token is invalid or expired.' };
      }
      return { ok: true };
    }
    case 'buy_now_scanned':
      if (!(await listingInScanDeck(userId, p.itemId))) {
        return {
          ok: false,
          code: 'TRUST_LISTING_REQUIRED',
          message: 'Buy-now scan must reference a listing from a recent search.',
        };
      }
      return { ok: true };
    case 'recommended_deal_viewed':
      if (!(await listingInScanDeck(userId, p.itemId))) {
        return {
          ok: false,
          code: 'TRUST_LISTING_REQUIRED',
          message: 'Deal view must reference a listing from a recent search.',
        };
      }
      return { ok: true };
    default:
      return { ok: true };
  }
}

module.exports = {
  trustRequired,
  refreshScanDeck,
  listingInScanDeck,
  issueBidFlowTokens,
  consumeActionToken,
  assertClientOriginEventAllowed,
  assertEventTrustOrDeny,
  SCAN_DECK_MS,
};
