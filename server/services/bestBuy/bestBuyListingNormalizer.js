const { buildCanonicalProductKey } = require('../../lib/marketplace/canonicalProductKey');
const { mapOpenBoxCondition, openBoxConditionLabel } = require('./bestBuyConditionMapper');

/** Best Buy Products API — documented attributes only (invalid show fields can break queries). */
const PRODUCT_SHOW_FIELDS =
  'sku,name,salePrice,regularPrice,onSale,active,onlineAvailability,inStoreAvailability,largeFrontImage,url,upc,manufacturer,modelNumber,condition,type,categoryPath,customerReviewAverage,customerReviewCount';

function toMoney(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function pickImage(product) {
  return (
    product?.largeFrontImage ||
    product?.image ||
    product?.thumbnail ||
    product?.images?.standard ||
    null
  );
}

function pickProductUrl(product) {
  return product?.url || product?.productUrl || product?.links?.web || null;
}

function baseProductFields(product) {
  const sku = String(product?.sku || '').trim();
  const manufacturer = product?.manufacturer || null;
  const modelNumber = product?.modelNumber || null;
  const upc = product?.upc != null ? String(product.upc) : null;
  const canonicalProductKey = buildCanonicalProductKey({
    upc,
    manufacturer,
    brand: manufacturer,
    modelNumber,
    sku,
    marketplace: 'bestbuy',
  });

  return {
    marketplace: 'bestbuy',
    source: 'bestbuy',
    sku,
    upc,
    brand: manufacturer,
    manufacturer,
    model: modelNumber,
    modelNumber,
    title: product?.name || product?.names?.title || 'Best Buy product',
    imageUrl: pickImage(product),
    productUrl: pickProductUrl(product),
    category: Array.isArray(product?.categoryPath)
      ? product.categoryPath.map((c) => c?.name).filter(Boolean).join(' › ')
      : null,
    canonicalProductKey,
    rawSourceId: sku,
    retrievedAt: new Date().toISOString(),
    seller: {
      name: 'Best Buy',
      type: 'retailer',
    },
    trust: {
      marketplace: 'Best Buy',
      retailerBacked: true,
      evidenceType: 'retailer_inventory',
    },
  };
}

function normalizeBestBuyNewProduct(product) {
  const base = baseProductFields(product);
  const salePrice = toMoney(product?.salePrice);
  const regularPrice = toMoney(product?.regularPrice);
  const price = salePrice ?? regularPrice;
  const onlineAvailability = Boolean(
    product?.onlineAvailability ?? product?.onlineAvail ?? product?.active
  );

  return {
    ...base,
    marketplaceListingId: `bestbuy:new:${base.sku}`,
    listingType: 'retail_new',
    condition: 'new',
    conditionLabel: 'New',
    price,
    regularPrice,
    shippingPrice: 0,
    totalPrice: price,
    currency: 'USD',
    availability: onlineAvailability ? 'available_online' : 'unavailable',
    onlineAvailability,
    inStoreAvailability: Boolean(product?.inStoreAvailability),
    specifications: {
      customerReviewAverage: product?.customerReviewAverage ?? null,
      customerReviewCount: product?.customerReviewCount ?? null,
    },
  };
}

function normalizeOpenBoxOffer(productPayload, offer, offerIndex = 0) {
  const base = baseProductFields(productPayload);
  const rawCondition = offer?.condition || offer?.conditions?.value || 'other';
  const normalizedCondition = mapOpenBoxCondition(rawCondition);
  const price = toMoney(offer?.prices?.current ?? offer?.price ?? productPayload?.prices?.current);
  const regularPrice = toMoney(
    offer?.prices?.regular ?? offer?.regularPrice ?? productPayload?.prices?.regular
  );

  return {
    ...base,
    marketplaceListingId: `bestbuy:openbox:${base.sku}:${normalizedCondition}:${offerIndex}`,
    listingType: 'retail_open_box',
    condition: normalizedCondition,
    conditionLabel: openBoxConditionLabel(normalizedCondition),
    openBoxConditionRaw: rawCondition,
    price,
    regularPrice,
    shippingPrice: 0,
    totalPrice: price,
    currency: 'USD',
    availability: price != null ? 'available_open_box' : 'unavailable',
    onlineAvailability: price != null,
    fulfillment: offer?.fulfillment || offer?.store || null,
    trust: {
      ...base.trust,
      openBoxCondition: rawCondition,
    },
  };
}

function normalizeBestBuySearchResponse(data) {
  const products = Array.isArray(data?.products) ? data.products : [];
  return products.map((p) => normalizeBestBuyNewProduct(p));
}

function normalizeOpenBoxSkuResponse(data) {
  const results = Array.isArray(data?.results)
    ? data.results
    : data?.sku || data?.offers
      ? [data]
      : [];
  const offers = [];
  for (const row of results) {
    const productPayload = {
      sku: row?.sku,
      name: row?.names?.title,
      manufacturer: row?.manufacturer,
      modelNumber: row?.modelNumber,
      upc: row?.upc,
      image: row?.images?.standard,
      url: row?.links?.web,
      prices: row?.prices,
    };
    const rowOffers = Array.isArray(row?.offers) ? row.offers : [];
    rowOffers.forEach((offer, idx) => {
      offers.push(normalizeOpenBoxOffer(productPayload, offer, idx));
    });
  }
  return offers;
}

module.exports = {
  PRODUCT_SHOW_FIELDS,
  normalizeBestBuyNewProduct,
  normalizeBestBuySearchResponse,
  normalizeOpenBoxOffer,
  normalizeOpenBoxSkuResponse,
};
