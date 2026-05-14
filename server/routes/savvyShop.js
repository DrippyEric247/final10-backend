const express = require('express');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const User = require('../models/User');
const SavvyShop = require('../models/SavvyShop');
const SavvyShopProduct = require('../models/SavvyShopProduct');
const SavvyShopPost = require('../models/SavvyShopPost');
const { estimateMaxFlipSavvyPotential } = require('../services/flipRewardsService');
const {
  awardCreatorPoints,
  maybeGrantContentBonus,
  maybeGrantHighFlipBonus,
  processEngagement,
  processReportSale,
} = require('../services/savvyCreatorRewardsService');
const {
  getCreatorMonetizationProfile,
  syncSavvyShopCreatorBand,
} = require('../services/creatorEliteAccessService');
const { processPostEngagement, awardPostCreation } = require('../services/savvyShopPostRewardsService');

const router = express.Router();

function slugifyBase(name) {
  let s = String(name || 'shop')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 28);
  if (s.length < 3) {
    s = `shop-${String(mongoose.Types.ObjectId()).slice(-6)}`.toLowerCase().slice(0, 28);
  }
  return s;
}

async function uniqueSlug(base, excludeId = null) {
  let slug = slugifyBase(base);
  let n = 0;
  for (;;) {
    const q = { slug };
    if (excludeId) q._id = { $ne: excludeId };
    const exists = await SavvyShop.findOne(q).select('_id').lean();
    if (!exists) return slug;
    n += 1;
    slug = `${slugifyBase(base)}-${n}`.slice(0, 32);
  }
}

function normalizeHashtags(raw) {
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : String(raw).split(/[\s,#]+/);
  const out = [];
  for (const t of arr) {
    const x = String(t || '')
      .trim()
      .replace(/^#/, '');
    if (x.length >= 2 && x.length <= 40) out.push(x.toLowerCase());
    if (out.length >= 12) break;
  }
  return out;
}

function serializeProductMini(p) {
  if (!p || !p._id) return null;
  return {
    id: p._id,
    title: p.title,
    imageUrl: p.imageUrl,
    currency: p.currency,
    displayPrice: p.displayPrice,
    flipScore: p.flipScore,
    dealUrl: p.dealUrl,
    hashtags: p.hashtags || [],
  };
}

function serializePostPublic(post, owner) {
  const p = post.product && typeof post.product === 'object' ? post.product : null;
  return {
    id: post._id,
    caption: post.caption,
    imageUrl: post.imageUrl || '',
    hashtags: post.hashtags || [],
    engagement: post.engagement || { viewCount: 0, likeCount: 0, saveCount: 0 },
    createdAt: post.createdAt,
    productFlipScoreAtPost: post.productFlipScoreAtPost,
    product: serializeProductMini(p),
    creator: {
      id: owner._id,
      username: owner.username,
      firstName: owner.firstName,
      lastName: owner.lastName,
    },
  };
}

function sortShopPosts(posts, sort) {
  const list = [...posts].filter((p) => p.product);
  if (sort === 'flip') {
    list.sort((a, b) => {
      const fsb = Number(b.productFlipScoreAtPost ?? b.product?.flipScore ?? -1);
      const fsa = Number(a.productFlipScoreAtPost ?? a.product?.flipScore ?? -1);
      if (fsb !== fsa) return fsb - fsa;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  } else if (sort === 'trending') {
    list.sort((a, b) => {
      const ta =
        (a.engagement?.viewCount || 0) +
        (a.engagement?.likeCount || 0) * 3 +
        (a.engagement?.saveCount || 0) * 5;
      const tb =
        (b.engagement?.viewCount || 0) +
        (b.engagement?.likeCount || 0) * 3 +
        (b.engagement?.saveCount || 0) * 5;
      if (tb !== ta) return tb - ta;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  } else {
    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
  return list;
}

function computeSavvyPotential(body) {
  const fs = body.flipScore != null ? Number(body.flipScore) : null;
  if (!Number.isFinite(fs)) return null;
  try {
    return estimateMaxFlipSavvyPotential({
      flipScore: fs,
      fromAi: body.kind === 'final10_flip',
      premium: false,
    }).maxTotal;
  } catch {
    return null;
  }
}

/**
 * GET /api/savvy-shop/public/:slug
 */
router.get('/public/:slug', async (req, res) => {
  try {
    const slug = String(req.params.slug || '')
      .trim()
      .toLowerCase();
    const shop = await SavvyShop.findOne({ slug, published: true })
      .populate('owner', 'username firstName lastName savvyPoints')
      .lean();
    if (!shop) {
      return res.status(404).json({ message: 'Shop not found' });
    }
    const products = await SavvyShopProduct.find({ shop: shop._id }).sort({ sortOrder: 1, createdAt: -1 }).lean();
    const followers = await User.countDocuments({ following: shop.owner._id });

    const [saleCount, topProductLean, contentPostCount] = await Promise.all([
      SavvyShopProduct.countDocuments({ shop: shop._id, milestonesGranted: { $in: ['sale_v1'] } }),
      SavvyShopProduct.findOne({ shop: shop._id })
        .sort({ flipScore: -1, 'engagement.viewCount': -1 })
        .lean(),
      SavvyShopPost.countDocuments({ shop: shop._id }),
    ]);

    const creatorStats = {
      totalSalesReported: saleCount,
      totalSavvyPoints: Number(shop.owner.savvyPoints || 0),
      contentPostCount,
      topProduct: topProductLean
        ? {
            id: topProductLean._id,
            title: topProductLean.title,
            flipScore: topProductLean.flipScore,
            imageUrl: topProductLean.imageUrl,
          }
        : null,
    };

    return res.json({
      shop: {
        id: shop._id,
        slug: shop.slug,
        storeName: shop.storeName,
        brandTagline: shop.brandTagline,
        bio: shop.bio,
        badges: shop.badges || [],
        defaultCommissionPct: shop.defaultCommissionPct,
        totalShopSavvyEarned: shop.totalShopSavvyEarned || 0,
        creatorAccessBand: shop.creatorAccessBand || 'free',
        shopConversion: {
          headline: '🔥 This product made creators $2,340 this week',
          sub: 'Upgrade to Elite to tap in',
        },
        owner: {
          id: shop.owner._id,
          username: shop.owner.username,
          firstName: shop.owner.firstName,
          lastName: shop.owner.lastName,
          savvyPoints: Number(shop.owner.savvyPoints || 0),
        },
        followers,
      },
      creatorStats,
      products: products.map((p) => ({
        id: p._id,
        kind: p.kind,
        title: p.title,
        subtitle: p.subtitle,
        imageUrl: p.imageUrl,
        currency: p.currency,
        displayPrice: p.displayPrice,
        estimatedProfit: p.estimatedProfit,
        flipScore: p.flipScore,
        savvyPotentialEstimate: p.savvyPotentialEstimate,
        dealUrl: p.dealUrl,
        marketplaceItemId: p.marketplaceItemId,
        hashtags: p.hashtags || [],
        whyBuy: p.whyBuy,
        videoUrl: p.videoUrl || '',
        engagement: p.engagement || { viewCount: 0, clickCount: 0, saveCount: 0 },
      })),
    });
  } catch (err) {
    console.error('savvy-shop public', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * POST /api/savvy-shop/public/:slug/products/:productId/engage
 * Body: { type: 'view'|'click'|'save', fp?: string, campaignHashtag?: string }
 */
router.post('/public/:slug/products/:productId/engage', async (req, res) => {
  try {
    const slug = String(req.params.slug || '')
      .trim()
      .toLowerCase();
    const productId = req.params.productId;
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: 'Invalid product' });
    }
    const shop = await SavvyShop.findOne({ slug, published: true }).lean();
    if (!shop) return res.status(404).json({ message: 'Shop not found' });
    const product = await SavvyShopProduct.findOne({
      _id: productId,
      shop: shop._id,
    }).lean();
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const result = await processEngagement(req, shop, product, req.body || {});
    return res.json(result);
  } catch (err) {
    console.error('savvy-shop engage', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * GET /api/savvy-shop/public/:slug/posts
 * Query: sort=new|trending|flip
 */
router.get('/public/:slug/posts', async (req, res) => {
  try {
    const slug = String(req.params.slug || '')
      .trim()
      .toLowerCase();
    const shop = await SavvyShop.findOne({ slug, published: true })
      .populate('owner', 'username firstName lastName')
      .lean();
    if (!shop) return res.status(404).json({ message: 'Shop not found' });

    const sortRaw = String(req.query.sort || 'new').toLowerCase();
    const sort = sortRaw === 'trending' || sortRaw === 'flip' ? sortRaw : 'new';

    const raw = await SavvyShopPost.find({ shop: shop._id }).populate('product').lean();
    const sorted = sortShopPosts(raw, sort);
    const posts = sorted.map((p) => serializePostPublic(p, shop.owner));

    return res.json({ sort, posts });
  } catch (err) {
    console.error('savvy-shop public posts', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * POST /api/savvy-shop/public/:slug/posts/:postId/engage
 * Body: { type: 'view'|'like'|'save'|'shop', fp?: string }
 */
router.post('/public/:slug/posts/:postId/engage', async (req, res) => {
  try {
    const slug = String(req.params.slug || '')
      .trim()
      .toLowerCase();
    const postId = req.params.postId;
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ message: 'Invalid post' });
    }
    const shop = await SavvyShop.findOne({ slug, published: true }).lean();
    if (!shop) return res.status(404).json({ message: 'Shop not found' });
    const post = await SavvyShopPost.findOne({ _id: postId, shop: shop._id }).lean();
    if (!post) return res.status(404).json({ message: 'Post not found' });

    const result = await processPostEngagement(req, shop, post, req.body || {});
    return res.json(result);
  } catch (err) {
    console.error('savvy-shop post engage', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * GET /api/savvy-shop/my-shop/posts
 */
router.get('/my-shop/posts', auth, async (req, res) => {
  try {
    const shop = await SavvyShop.findOne({ owner: req.user.id }).lean();
    if (!shop) return res.json({ posts: [] });
    const owner = await User.findById(req.user.id).select('username firstName lastName').lean();
    const raw = await SavvyShopPost.find({ shop: shop._id }).sort({ createdAt: -1 }).populate('product').lean();
    const posts = sortShopPosts(raw, 'new').map((p) => serializePostPublic(p, owner));
    return res.json({ posts });
  } catch (err) {
    console.error('savvy-shop my posts', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * POST /api/savvy-shop/my-shop/posts
 * Body: { caption, imageUrl?, productId, hashtags? }
 */
router.post('/my-shop/posts', auth, async (req, res) => {
  try {
    const shop = await SavvyShop.findOne({ owner: req.user.id });
    if (!shop) return res.status(400).json({ message: 'Create your shop first' });

    const b = req.body || {};
    const productId = b.productId || b.product;
    if (!productId || !mongoose.Types.ObjectId.isValid(String(productId))) {
      return res.status(400).json({ message: 'productId is required' });
    }
    const product = await SavvyShopProduct.findOne({ _id: productId, shop: shop._id });
    if (!product) return res.status(404).json({ message: 'Product not found on this shop' });

    const caption = String(b.caption || '').trim();
    if (caption.length < 4) {
      return res.status(400).json({ message: 'caption must be at least 4 characters' });
    }

    const post = await SavvyShopPost.create({
      shop: shop._id,
      author: req.user.id,
      product: product._id,
      caption: caption.slice(0, 2000),
      imageUrl: String(b.imageUrl || '').trim().slice(0, 2048),
      hashtags: normalizeHashtags(b.hashtags),
      productFlipScoreAtPost:
        product.flipScore != null && Number.isFinite(Number(product.flipScore))
          ? Math.max(0, Math.min(10, Number(product.flipScore)))
          : null,
    });

    const addPts = await awardPostCreation(req.user.id, post._id, shop._id);
    await syncSavvyShopCreatorBand(shop._id);

    const lean = await SavvyShopPost.findById(post._id).populate('product').lean();
    const owner = await User.findById(req.user.id).select('username firstName lastName').lean();
    return res.status(201).json({
      post: serializePostPublic(lean, owner),
      savvyAwarded: Number(addPts.awarded || 0),
    });
  } catch (err) {
    console.error('savvy-shop create post', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * GET /api/savvy-shop/my-shop
 */
router.get('/my-shop', auth, async (req, res) => {
  try {
    const shop = await SavvyShop.findOne({ owner: req.user.id })
      .populate('owner', 'username savvyPoints')
      .lean();
    if (!shop) {
      const creatorMonetization = await getCreatorMonetizationProfile(req.user.id);
      return res.json({ shop: null, products: [], creatorMonetization });
    }
    const products = await SavvyShopProduct.find({ shop: shop._id }).sort({ sortOrder: 1, createdAt: -1 }).lean();
    const creatorMonetization = await getCreatorMonetizationProfile(req.user.id);
    return res.json({
      shop: {
        ...shop,
        id: shop._id,
      },
      products,
      productCount: products.length,
      creatorMonetization,
    });
  } catch (err) {
    console.error('savvy-shop my', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * PUT /api/savvy-shop/my-shop
 */
router.put('/my-shop', auth, async (req, res) => {
  try {
    const {
      storeName,
      slug: slugIn,
      brandTagline,
      bio,
      published,
      badges,
      defaultCommissionPct,
    } = req.body || {};

    if (!storeName || String(storeName).trim().length < 2) {
      return res.status(400).json({ message: 'Store name is required' });
    }

    let shop = await SavvyShop.findOne({ owner: req.user.id });
    const owner = await User.findById(req.user.id).select('username');
    if (!owner) return res.status(404).json({ message: 'User not found' });

    if (!shop) {
      const slug = await uniqueSlug(slugIn || storeName || owner.username);
      shop = await SavvyShop.create({
        owner: req.user.id,
        slug,
        storeName: String(storeName).trim(),
        brandTagline: String(brandTagline || '').trim().slice(0, 120),
        bio: String(bio || '').trim().slice(0, 2000),
        published: Boolean(published),
        badges: Array.isArray(badges)
          ? badges.filter((b) => b === 'top_seller' || b === 'trending_creator').slice(0, 2)
          : [],
        defaultCommissionPct:
          defaultCommissionPct != null
            ? Math.max(0, Math.min(50, Number(defaultCommissionPct)))
            : 5,
      });
    } else {
      if (slugIn && String(slugIn).trim().toLowerCase() !== shop.slug) {
        const next = await uniqueSlug(String(slugIn).trim().toLowerCase(), shop._id);
        shop.slug = next;
      }
      shop.storeName = String(storeName).trim().slice(0, 80);
      shop.brandTagline = String(brandTagline || '').trim().slice(0, 120);
      shop.bio = String(bio || '').trim().slice(0, 2000);
      if (typeof published === 'boolean') shop.published = published;
      if (Array.isArray(badges)) {
        shop.badges = badges.filter((b) => b === 'top_seller' || b === 'trending_creator').slice(0, 2);
      }
      if (defaultCommissionPct != null) {
        shop.defaultCommissionPct = Math.max(0, Math.min(50, Number(defaultCommissionPct)));
      }
      await shop.save();
    }

    await syncSavvyShopCreatorBand(shop._id);
    const fresh = await SavvyShop.findById(shop._id).lean();
    return res.json({ shop: fresh, creatorMonetization: await getCreatorMonetizationProfile(req.user.id) });
  } catch (err) {
    console.error('savvy-shop put', err);
    if (err.code === 11000) {
      return res.status(409).json({ message: 'That shop URL is already taken. Try another.' });
    }
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * POST /api/savvy-shop/my-shop/products
 */
router.post('/my-shop/products', auth, async (req, res) => {
  try {
    const shop = await SavvyShop.findOne({ owner: req.user.id });
    if (!shop) {
      return res.status(400).json({ message: 'Create your shop first' });
    }

    const b = req.body || {};
    const title = String(b.title || '').trim();
    const dealUrl = String(b.dealUrl || b.url || '').trim();
    if (!title || !dealUrl) {
      return res.status(400).json({ message: 'title and dealUrl are required' });
    }

    const capProfile = await getCreatorMonetizationProfile(req.user.id);
    const existingCount = await SavvyShopProduct.countDocuments({ shop: shop._id });
    if (capProfile.maxProducts != null && existingCount >= capProfile.maxProducts) {
      const head =
        capProfile.band === 'free' ? capProfile.copy.upgradeStartEarning : capProfile.copy.upgradeEarn;
      return res.status(403).json({
        message: `${head} — ${capProfile.copy.unlockStore}`,
        code: 'SAVVY_SHOP_PRODUCT_CAP',
        band: capProfile.band,
        maxProducts: capProfile.maxProducts,
      });
    }

    const kind = b.kind === 'final10_flip' ? 'final10_flip' : 'external_link';
    const maxOrder = await SavvyShopProduct.findOne({ shop: shop._id }).sort({ sortOrder: -1 }).select('sortOrder').lean();
    const sortOrder = (maxOrder?.sortOrder ?? 0) + 1;

    const savvyPotentialEstimate = computeSavvyPotential({ ...b, kind });

    const product = await SavvyShopProduct.create({
      shop: shop._id,
      sortOrder,
      kind,
      title: title.slice(0, 200),
      subtitle: String(b.subtitle || '').trim().slice(0, 200),
      imageUrl: String(b.imageUrl || '').trim().slice(0, 2048),
      currency: String(b.currency || 'USD')
        .trim()
        .toUpperCase()
        .slice(0, 8),
      displayPrice: Math.max(0, Number(b.displayPrice ?? b.price) || 0),
      estimatedProfit:
        b.estimatedProfit != null && Number.isFinite(Number(b.estimatedProfit))
          ? Number(b.estimatedProfit)
          : null,
      flipScore:
        b.flipScore != null && Number.isFinite(Number(b.flipScore))
          ? Math.max(0, Math.min(10, Number(b.flipScore)))
          : null,
      savvyPotentialEstimate,
      dealUrl: dealUrl.slice(0, 2048),
      marketplaceItemId: String(b.marketplaceItemId || b.itemId || '').trim().slice(0, 64),
      hashtags: normalizeHashtags(b.hashtags),
      whyBuy: String(b.whyBuy || '').trim().slice(0, 4000),
      videoUrl: String(b.videoUrl || '').trim().slice(0, 2048),
    });

    const idem = `savvy_creator_add_product_${req.user.id}_${product._id}`;
    const addPts = await awardCreatorPoints(req.user.id, 5, idem, 'savvy_creator_add_product', shop._id);

    const lean = await SavvyShopProduct.findById(product._id).lean();
    const sdoc = await SavvyShop.findById(shop._id);
    const hf = await maybeGrantHighFlipBonus(lean, sdoc, req.user.id);
    const ct = await maybeGrantContentBonus(lean, sdoc, req.user.id);
    const rewardHints = [...new Set([...(hf.hints || []), ...(ct.hints || [])])];
    const savvyAwarded =
      Number(addPts.awarded || 0) + Number(hf.awarded || 0) + Number(ct.awarded || 0);

    await syncSavvyShopCreatorBand(shop._id);

    return res.status(201).json({ product, rewardHints, savvyAwarded });
  } catch (err) {
    console.error('savvy-shop add product', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * PATCH /api/savvy-shop/my-shop/products/:productId
 */
router.patch('/my-shop/products/:productId', auth, async (req, res) => {
  try {
    const shop = await SavvyShop.findOne({ owner: req.user.id });
    if (!shop) return res.status(404).json({ message: 'No shop' });
    const product = await SavvyShopProduct.findOne({ _id: req.params.productId, shop: shop._id });
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const b = req.body || {};
    if (b.title != null) product.title = String(b.title).trim().slice(0, 200);
    if (b.subtitle != null) product.subtitle = String(b.subtitle).trim().slice(0, 200);
    if (b.imageUrl != null) product.imageUrl = String(b.imageUrl).trim().slice(0, 2048);
    if (b.currency != null) product.currency = String(b.currency).trim().toUpperCase().slice(0, 8);
    if (b.displayPrice != null) product.displayPrice = Math.max(0, Number(b.displayPrice) || 0);
    if (b.estimatedProfit !== undefined) {
      product.estimatedProfit =
        b.estimatedProfit != null && Number.isFinite(Number(b.estimatedProfit))
          ? Number(b.estimatedProfit)
          : null;
    }
    if (b.flipScore !== undefined) {
      product.flipScore =
        b.flipScore != null && Number.isFinite(Number(b.flipScore))
          ? Math.max(0, Math.min(10, Number(b.flipScore)))
          : null;
    }
    if (b.dealUrl != null) product.dealUrl = String(b.dealUrl).trim().slice(0, 2048);
    if (b.marketplaceItemId != null) product.marketplaceItemId = String(b.marketplaceItemId).trim().slice(0, 64);
    if (b.whyBuy != null) product.whyBuy = String(b.whyBuy).trim().slice(0, 4000);
    if (b.videoUrl != null) product.videoUrl = String(b.videoUrl).trim().slice(0, 2048);
    if (b.sortOrder != null) product.sortOrder = Number(b.sortOrder) || 0;
    if (b.hashtags !== undefined) product.hashtags = normalizeHashtags(b.hashtags);
    if (b.kind === 'final10_flip' || b.kind === 'external_link') product.kind = b.kind;
    product.savvyPotentialEstimate = computeSavvyPotential(product.toObject());
    await product.save();

    const lean = await SavvyShopProduct.findById(product._id).lean();
    const sdoc = await SavvyShop.findById(shop._id);
    const hf = await maybeGrantHighFlipBonus(lean, sdoc, req.user.id);
    const ct = await maybeGrantContentBonus(lean, sdoc, req.user.id);
    const rewardHints = [...new Set([...(hf.hints || []), ...(ct.hints || [])])];
    const savvyAwarded = Number(hf.awarded || 0) + Number(ct.awarded || 0);

    await syncSavvyShopCreatorBand(shop._id);

    return res.json({ product, rewardHints, savvyAwarded });
  } catch (err) {
    console.error('savvy-shop patch product', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * POST /api/savvy-shop/my-shop/products/:productId/report-sale
 * Trust-based V1 — creator confirms a sale tied to this pick (anti-spam: once per product).
 */
router.post('/my-shop/products/:productId/report-sale', auth, async (req, res) => {
  try {
    const shop = await SavvyShop.findOne({ owner: req.user.id });
    if (!shop) return res.status(404).json({ message: 'No shop' });
    const product = await SavvyShopProduct.findOne({
      _id: req.params.productId,
      shop: shop._id,
    }).lean();
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const saleOut = await processReportSale(shop, product);
    return res.json({
      ok: true,
      awarded: saleOut.awarded,
      savvyAwarded: saleOut.awarded,
      rewardHints: saleOut.hints,
      locked: Boolean(saleOut.locked),
      eliteRequired: Boolean(saleOut.eliteRequired),
    });
  } catch (err) {
    console.error('savvy-shop report-sale', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * DELETE /api/savvy-shop/my-shop/products/:productId
 */
router.delete('/my-shop/products/:productId', auth, async (req, res) => {
  try {
    const shop = await SavvyShop.findOne({ owner: req.user.id });
    if (!shop) return res.status(404).json({ message: 'No shop' });
    await SavvyShopProduct.deleteOne({ _id: req.params.productId, shop: shop._id });
    await syncSavvyShopCreatorBand(shop._id);
    return res.json({ ok: true });
  } catch (err) {
    console.error('savvy-shop delete product', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
