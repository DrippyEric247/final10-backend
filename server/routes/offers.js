const crypto = require("crypto");
const express = require("express");
const auth = require("../middleware/auth");
const OfferInteraction = require("../models/OfferInteraction");
const User = require("../models/User");
const PointsLedger = require("../models/PointsLedger");
const BusinessOffer = require("../models/BusinessOffer");

const router = express.Router();

const CLAIM_COOLDOWN_MS = 7 * 60 * 1000;
const MAX_CLAIMS_PER_DAY = 10;
const RAPID_WINDOW_MS = 3 * 60 * 1000;
const RAPID_MAX_ACTIONS = 15;

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function dayRange(now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function hashIp(req) {
  const raw = req.ip || req.headers["x-forwarded-for"] || "";
  return crypto.createHash("sha256").update(String(raw)).digest("hex").slice(0, 24);
}

function calculateClickReward(offer) {
  if (Number(offer.trustScore) < 50) return 0;
  return clamp(Math.round(Number(offer.price || 0) * 0.02), 5, 10);
}

function calculateClaimReward(offer) {
  if (Number(offer.trustScore) < 50) return 0;
  const raw = Math.round((Number(offer.savings || 0) * 0.5) + (Number(offer.price || 0) * 0.1));
  return clamp(raw, 50, 200);
}

async function detectRapidAbuse(userId) {
  const since = new Date(Date.now() - RAPID_WINDOW_MS);
  const recent = await OfferInteraction.countDocuments({
    userId,
    updatedAt: { $gte: since },
    status: { $in: ["clicked", "claimed", "verified"] },
  });
  return recent >= RAPID_MAX_ACTIONS;
}

router.get("/interactions", auth, async (req, res) => {
  try {
    const raw = String(req.query.offerIds || "");
    const offerIds = raw
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean)
      .slice(0, 200);
    if (!offerIds.length) return res.json({ interactions: [] });

    const interactions = await OfferInteraction.find({
      userId: req.user._id,
      offerId: { $in: offerIds },
    }).lean();

    return res.json({
      interactions: interactions.map((i) => ({
        offerId: i.offerId,
        clickedAt: i.clickedAt,
        claimedAt: i.claimedAt,
        verifiedAt: i.verifiedAt,
        verificationMethod: i.verificationMethod || "none",
        status: i.status || "none",
        rewardGiven: i.rewardGiven || 0,
      })),
    });
  } catch (error) {
    console.error("offers.interactions.error", error);
    return res.status(500).json({ error: "Failed to load interactions" });
  }
});

router.post("/:id/click", auth, async (req, res) => {
  try {
    const offerId = String(req.params.id || "").trim();
    if (!offerId) return res.status(400).json({ error: "Missing offer id" });

    const rapidAbuse = await detectRapidAbuse(req.user._id);
    if (rapidAbuse) return res.status(429).json({ error: "Too many rapid actions. Please slow down." });

    const now = new Date();
    const payloadOffer = req.body?.offer || {};
    const clickReward = calculateClickReward(payloadOffer);

    let interaction = await OfferInteraction.findOne({ userId: req.user._id, offerId });
    if (!interaction) {
      interaction = await OfferInteraction.create({
        userId: req.user._id,
        offerId,
        clickedAt: now,
        status: "clicked",
        rewardGiven: clickReward,
        userAgent: req.headers["user-agent"] || "",
        ipHash: hashIp(req),
      });
    } else {
      if (interaction.clickedAt && now.getTime() - new Date(interaction.clickedAt).getTime() < 20 * 1000) {
        interaction.rapidSignals = (interaction.rapidSignals || 0) + 1;
      }
      if ((interaction.rapidSignals || 0) > 6) {
        interaction.status = "blocked";
        await interaction.save();
        return res.status(429).json({ error: "Rapid abuse pattern detected. Offer is temporarily blocked." });
      }
      if (!interaction.clickedAt) interaction.clickedAt = now;
      interaction.status = interaction.claimedAt ? "claimed" : "clicked";
      interaction.userAgent = req.headers["user-agent"] || interaction.userAgent;
      interaction.ipHash = hashIp(req);
      await interaction.save();
    }

    const businessOffer = await BusinessOffer.findById(offerId).catch(() => null);
    if (businessOffer && businessOffer.verificationStatus === "verified") {
      businessOffer.stats.views += 1;
      businessOffer.stats.clicks += 1;
      if (businessOffer.pricingModel?.payPerClick?.enabled) {
        businessOffer.spent += Number(businessOffer.pricingModel.payPerClick.rate || 0);
      }
      if (businessOffer.spent >= businessOffer.totalBudget) {
        businessOffer.status = "ended";
      } else if (businessOffer.spent > businessOffer.dailyBudget && businessOffer.status === "active") {
        businessOffer.status = "paused";
      }
      businessOffer.recomputeStats();
      await businessOffer.save();
    }

    return res.json({
      ok: true,
      offerId,
      status: interaction.status,
      clickedAt: interaction.clickedAt,
      clickReward,
    });
  } catch (error) {
    console.error("offers.click.error", error);
    return res.status(500).json({ error: "Failed to track click" });
  }
});

router.post("/:id/claim", auth, async (req, res) => {
  try {
    const offerId = String(req.params.id || "").trim();
    if (!offerId) return res.status(400).json({ error: "Missing offer id" });

    const rapidAbuse = await detectRapidAbuse(req.user._id);
    if (rapidAbuse) return res.status(429).json({ error: "Suspicious activity detected. Try again later." });

    const interaction = await OfferInteraction.findOne({ userId: req.user._id, offerId });
    if (!interaction || !interaction.clickedAt) {
      return res.status(400).json({ error: "You must click View Deal before claiming." });
    }
    if (interaction.claimedAt) {
      return res.status(409).json({ error: "Reward already claimed for this offer." });
    }

    const now = Date.now();
    if (now - new Date(interaction.clickedAt).getTime() < CLAIM_COOLDOWN_MS) {
      return res.status(429).json({ error: "Please wait before claiming this reward." });
    }

    const { start, end } = dayRange();
    const claimsToday = await OfferInteraction.countDocuments({
      userId: req.user._id,
      claimedAt: { $gte: start, $lt: end },
    });
    if (claimsToday >= MAX_CLAIMS_PER_DAY) {
      return res.status(429).json({ error: "Daily claim limit reached." });
    }

    const payloadOffer = req.body?.offer || {};
    const clickReward = calculateClickReward(payloadOffer);
    const claimReward = calculateClaimReward(payloadOffer);
    const totalReward = clickReward + claimReward;

    interaction.claimedAt = new Date();
    interaction.rewardGiven = totalReward;
    interaction.status = totalReward > 0 ? "claimed" : "blocked";
    interaction.verificationMethod = "manual";
    await interaction.save();

    if (totalReward > 0) {
      const user = await User.findById(req.user._id);
      if (!user) return res.status(404).json({ error: "User not found" });

      user.pointsBalance = (user.pointsBalance || 0) + totalReward;
      user.lifetimePointsEarned = (user.lifetimePointsEarned || 0) + totalReward;
      await user.save();

      await PointsLedger.create({
        userId: user._id,
        type: "earn",
        amount: totalReward,
        source: "offer_claim_reward",
        refId: offerId,
        idempotencyKey: `offer_claim_${user._id}_${offerId}`,
      }).catch((err) => {
        if (err?.code !== 11000) throw err;
      });
    }

    const businessOffer = await BusinessOffer.findById(offerId).catch(() => null);
    if (businessOffer) {
      businessOffer.stats.claims += 1;
      businessOffer.stats.rewardsDistributed += totalReward;
      if (businessOffer.pricingModel?.payPerClaim?.enabled) {
        businessOffer.spent += Number(businessOffer.pricingModel.payPerClaim.rate || 0);
      }
      businessOffer.recomputeStats();
      if (businessOffer.spent >= businessOffer.totalBudget) {
        businessOffer.status = "ended";
      }
      await businessOffer.save();
    }

    return res.json({
      ok: true,
      offerId,
      claimedAt: interaction.claimedAt,
      status: interaction.status,
      rewardAwarded: totalReward,
      verificationMethod: interaction.verificationMethod,
    });
  } catch (error) {
    console.error("offers.claim.error", error);
    return res.status(500).json({ error: "Failed to claim reward" });
  }
});

module.exports = router;

