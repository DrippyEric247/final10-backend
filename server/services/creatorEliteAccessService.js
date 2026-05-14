/**
 * Savvy Elite Creator System — monetization tiers (Free / Premium / Elite).
 * Source of truth: PremiumEntitlement (Stripe-synced). No import from premiumEntitlementService
 * to avoid circular deps with toMeResponse().
 */

const mongoose = require('mongoose');
const PremiumEntitlement = require('../models/PremiumEntitlement');
const SavvyShop = require('../models/SavvyShop');

const FREE_MAX_PRODUCTS = 3;
const PREMIUM_MAX_PRODUCTS = 10;
const VIP_MAX_PRODUCTS = 25;

const FREE_DAILY_SAVVY_CAP = 180;
const PREMIUM_DAILY_SAVVY_CAP = 420;

const MSGS = {
  upgradeEarn: '🚀 Ready to start earning for real?',
  unlockStore: 'Unlock your store\'s earning potential',
  upgradeStartEarning: 'Upgrade to start earning',
  paidWall: '💰 This is where creators get paid',
  elitePayoutTeaser: '💰 You made $120 in potential earnings',
  elitePayoutUnlock: 'Upgrade to Elite to unlock payouts',
  eliteTapIn: 'Upgrade to Elite to tap in',
  viralPool: '🔥 This product made creators $2,340 this week',
  missedSavvy: "You're missing +85 Savvy Points",
  aiLock: 'Let Savvy find the money for you',
};

function subscriptionActive(ent) {
  if (!ent) return false;
  const s = String(ent.premiumStatus || '').toLowerCase();
  return s === 'active' || s === 'trialing';
}

/**
 * @param {import('mongoose').Types.ObjectId|string|null|undefined} userId
 */
function toObjectId(userId) {
  if (!userId) return null;
  if (userId instanceof mongoose.Types.ObjectId) return userId;
  const s = String(userId);
  if (!mongoose.Types.ObjectId.isValid(s)) return null;
  return new mongoose.Types.ObjectId(s);
}

/**
 * @param {object|null|undefined} ent — lean PremiumEntitlement
 * @returns {'free'|'premium'|'elite'}
 */
function resolveMonetizationBand(ent) {
  if (!subscriptionActive(ent)) return 'free';
  const tier = String(ent.premiumTier || 'free').toLowerCase();
  if (tier === 'elite') return 'elite';
  if (tier === 'premium' || tier === 'vip') return 'premium';
  return 'free';
}

/**
 * @param {object|null|undefined} ent
 */
function monetizationFromEntitlement(ent) {
  const band = resolveMonetizationBand(ent);
  const isPaid = band !== 'free';
  const isElite = band === 'elite';

  let maxProducts = FREE_MAX_PRODUCTS;
  if (isElite) maxProducts = null;
  else if (isPaid) {
    const tier = String(ent?.premiumTier || 'premium').toLowerCase();
    maxProducts = tier === 'vip' ? VIP_MAX_PRODUCTS : PREMIUM_MAX_PRODUCTS;
  }

  const dailySavvyCap = isElite ? null : isPaid ? PREMIUM_DAILY_SAVVY_CAP : FREE_DAILY_SAVVY_CAP;

  return {
    band,
    /** Raw Stripe row tier: free | premium | vip | elite */
    stripePremiumTier: String(ent?.premiumTier || 'free').toLowerCase(),
    isPaidSubscriber: isPaid,
    isElite,
    maxProducts,
    dailySavvyCap,
    canPayout: isElite,
    canWithdraw: isElite,
    canEarnSaleSavvy: isElite,
    canHashtagBonus: isElite,
    canViralBonus: isElite,
    canHighFlipBonus: isElite,
    /** 9.0+ flip alert lanes — Elite only */
    canFlipAlerts9: isElite,
    /** Full auto-flip grid + AI “what’s next” positioning */
    canFullFlipRadar: isElite,
    canAdvancedShopAnalytics: isElite,
    featuredShopPlacement: isElite,
    /** Hashtag Savvy uses this multiplier (Elite only; non-Elite gets no hashtag points). */
    hashtagSavvyMultiplier: isElite ? 1.75 : 1,
    copy: MSGS,
    teaser: {
      weeklyCreatorPoolUsd: 2340,
      missedSavvyPoints: 85,
      potentialPayoutUsd: 120,
    },
  };
}

async function getCreatorMonetizationProfile(userId) {
  const uid = toObjectId(userId);
  if (!uid) return monetizationFromEntitlement(null);
  const ent = await PremiumEntitlement.findOne({ userId: uid }).lean();
  return monetizationFromEntitlement(ent);
}

async function syncSavvyShopCreatorBand(shopId) {
  const sid = toObjectId(shopId);
  if (!sid) return;
  const shop = await SavvyShop.findById(sid).select('owner').lean();
  if (!shop?.owner) return;
  const profile = await getCreatorMonetizationProfile(shop.owner);
  await SavvyShop.updateOne({ _id: sid }, { $set: { creatorAccessBand: profile.band } });
}

module.exports = {
  monetizationFromEntitlement,
  getCreatorMonetizationProfile,
  syncSavvyShopCreatorBand,
  resolveMonetizationBand,
  FREE_MAX_PRODUCTS,
  PREMIUM_MAX_PRODUCTS,
  VIP_MAX_PRODUCTS,
  CREATOR_MSGS: MSGS,
};
