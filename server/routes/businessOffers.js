const express = require("express");
const auth = require("../middleware/auth");
const BusinessOffer = require("../models/BusinessOffer");

const router = express.Router();

function tierPricingDefaults(tier) {
  if (tier === "featured") {
    return {
      payPerClick: { enabled: true, rate: 0.5 },
      payPerClaim: { enabled: true, rate: 1.8 },
      featuredPlacement: { enabled: true, dailyFee: 9.99 },
    };
  }
  if (tier === "boosted") {
    return {
      payPerClick: { enabled: true, rate: 0.4 },
      payPerClaim: { enabled: true, rate: 1.4 },
      featuredPlacement: { enabled: false, dailyFee: 0 },
    };
  }
  return {
    payPerClick: { enabled: true, rate: 0.3 },
    payPerClaim: { enabled: true, rate: 1.1 },
    featuredPlacement: { enabled: false, dailyFee: 0 },
  };
}

function offerToPublicFeed(offer) {
  const priceBase = 40 + (offer.rewardAmount * 1.1);
  const marketBase = priceBase * (1.18 + (offer.promotionTier === "featured" ? 0.12 : 0.05));
  return {
    id: String(offer._id),
    title: offer.offerTitle,
    image: offer.logo || "https://via.placeholder.com/640x480/111827/A78BFA?text=Promoted",
    price: Number(priceBase.toFixed(2)),
    marketValue: Number(marketBase.toFixed(2)),
    sourceType: offer.promotionTier === "featured" ? "featured" : "promoted",
    category: offer.category,
    trustScore: offer.verificationStatus === "verified" ? 82 : offer.verificationStatus === "pending" ? 60 : 45,
    demandLevel: offer.promotionTier === "featured" ? "high" : "medium",
    expiresAt: Date.now() + (12 * 60 * 60 * 1000),
    rewardPoints: offer.rewardAmount,
    sellerId: String(offer.ownerUserId),
    isPromoted: true,
    promotionTier: offer.promotionTier,
    url: "https://www.ebay.com",
    popularity: offer.stats.clicks + offer.stats.views,
    location: "Online",
    businessOfferId: String(offer._id),
  };
}

router.get("/public", async (_req, res) => {
  try {
    const offers = await BusinessOffer.find({
      status: "active",
      verificationStatus: "verified",
    })
      .sort({ promotionTier: -1, createdAt: -1 })
      .limit(60)
      .lean();

    return res.json({
      offers: offers.map(offerToPublicFeed),
    });
  } catch (error) {
    console.error("businessOffers.public.error", error);
    return res.status(500).json({ error: "Failed to fetch business offers" });
  }
});

router.use(auth);

router.get("/dashboard/overview", async (req, res) => {
  try {
    const offers = await BusinessOffer.find({ ownerUserId: req.user._id }).lean();
    const totals = offers.reduce(
      (acc, offer) => {
        acc.totalSpend += Number(offer.spent || 0);
        acc.views += Number(offer.stats?.views || 0);
        acc.clicks += Number(offer.stats?.clicks || 0);
        acc.claims += Number(offer.stats?.claims || 0);
        acc.rewardsDistributed += Number(offer.stats?.rewardsDistributed || 0);
        return acc;
      },
      { totalSpend: 0, views: 0, clicks: 0, claims: 0, rewardsDistributed: 0 }
    );
    const conversionRate = totals.clicks > 0 ? Number(((totals.claims / totals.clicks) * 100).toFixed(2)) : 0;
    return res.json({ ...totals, conversionRate, totalOffers: offers.length });
  } catch (error) {
    console.error("businessOffers.overview.error", error);
    return res.status(500).json({ error: "Failed to load dashboard overview" });
  }
});

router.get("/", async (req, res) => {
  try {
    const offers = await BusinessOffer.find({ ownerUserId: req.user._id }).sort({ createdAt: -1 }).lean();
    return res.json({ offers });
  } catch (error) {
    console.error("businessOffers.list.error", error);
    return res.status(500).json({ error: "Failed to load offers" });
  }
});

router.post("/", async (req, res) => {
  try {
    const {
      businessName,
      logo,
      offerTitle,
      category,
      rewardAmount,
      dailyBudget,
      totalBudget,
      promotionTier,
      verificationStatus,
    } = req.body || {};

    if (!businessName || !offerTitle || !category || !dailyBudget || !totalBudget) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const tier = promotionTier || "basic";
    const offer = await BusinessOffer.create({
      ownerUserId: req.user._id,
      businessName,
      logo,
      offerTitle,
      category,
      rewardAmount: Number(rewardAmount || 0),
      dailyBudget: Number(dailyBudget),
      totalBudget: Number(totalBudget),
      promotionTier: tier,
      sourceType: tier === "featured" ? "featured" : "promoted",
      verificationStatus: verificationStatus || "pending",
      pricingModel: tierPricingDefaults(tier),
    });
    return res.status(201).json({ offer });
  } catch (error) {
    console.error("businessOffers.create.error", error);
    return res.status(500).json({ error: "Failed to create offer" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const offer = await BusinessOffer.findOne({ _id: req.params.id, ownerUserId: req.user._id });
    if (!offer) return res.status(404).json({ error: "Offer not found" });
    const allowed = ["offerTitle", "category", "rewardAmount", "dailyBudget", "totalBudget", "logo", "businessName"];
    for (const key of allowed) {
      if (req.body[key] !== undefined) offer[key] = req.body[key];
    }
    await offer.save();
    return res.json({ offer });
  } catch (error) {
    console.error("businessOffers.update.error", error);
    return res.status(500).json({ error: "Failed to update offer" });
  }
});

router.put("/:id/status", async (req, res) => {
  try {
    const offer = await BusinessOffer.findOne({ _id: req.params.id, ownerUserId: req.user._id });
    if (!offer) return res.status(404).json({ error: "Offer not found" });
    const nextStatus = String(req.body?.status || "");
    if (!["active", "paused", "ended"].includes(nextStatus)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    offer.status = nextStatus;
    await offer.save();
    return res.json({ offer });
  } catch (error) {
    console.error("businessOffers.status.error", error);
    return res.status(500).json({ error: "Failed to update status" });
  }
});

module.exports = router;

