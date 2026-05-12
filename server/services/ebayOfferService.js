const axios = require('axios');
const { getUserAccessToken } = require('./ebayUserTokenService');

const EBAY_BID_MODE = String(process.env.EBAY_BID_MODE || 'fallback').toLowerCase();

function ebayTimeoutMs() {
  return Math.min(Math.max(Number(process.env.EBAY_HTTP_TIMEOUT_MS) || 22000, 5000), 90000);
}

function asNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function getBrowseItem(itemId, token) {
  const itemIdEnc = encodeURIComponent(itemId);
  const url = `https://api.ebay.com/buy/browse/v1/item/${itemIdEnc}`;
  const t = ebayTimeoutMs();
  const { data } = await axios.get(url, {
    timeout: t,
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

function normalizeBidSuccess({ itemId, maxAmount, offerData }) {
  return {
    success: true,
    mode: 'live',
    itemId,
    maxAmount: asNum(maxAmount),
    bidAmount: asNum(offerData?.maxAmount?.value) ?? asNum(maxAmount),
    auctionStatus: offerData?.auctionStatus || null,
    isWinning: typeof offerData?.isWinning === 'boolean' ? offerData.isWinning : null,
    reservePriceMet:
      typeof offerData?.reservePriceMet === 'boolean' ? offerData.reservePriceMet : null,
    serverTimestamp: new Date().toISOString(),
    source: 'ebay',
  };
}

function redirectFallback(itemWebUrl, reason, itemId) {
  return {
    success: false,
    mode: 'redirect_required',
    itemId,
    itemWebUrl,
    reason,
    serverTimestamp: new Date().toISOString(),
    source: 'ebay',
  };
}

async function placeProxyBidForUser(user, { itemId, maxAmount, currency }) {
  if (!itemId) throw new Error('itemId is required');
  const amount = asNum(maxAmount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Invalid bid amount');
  if (!currency) throw new Error('currency is required');

  const userToken = await getUserAccessToken(user);
  const browseItem = await getBrowseItem(itemId, userToken);
  const options = Array.isArray(browseItem.buyingOptions) ? browseItem.buyingOptions : [];
  const isAuction = options.map((x) => String(x).toUpperCase()).includes('AUCTION');

  if (!isAuction) {
    return redirectFallback(
      browseItem.itemWebUrl,
      'Item is not currently auction-eligible',
      itemId
    );
  }

  if (EBAY_BID_MODE === 'fallback') {
    return redirectFallback(
      browseItem.itemWebUrl,
      'Direct bidding disabled in this environment',
      itemId
    );
  }

  if (EBAY_BID_MODE === 'mock') {
    return {
      success: true,
      mode: 'mock',
      itemId,
      maxAmount: amount,
      bidAmount: amount,
      auctionStatus: 'ACTIVE',
      isWinning: true,
      reservePriceMet: null,
      serverTimestamp: new Date().toISOString(),
      source: 'ebay',
    };
  }

  const itemIdEnc = encodeURIComponent(itemId);
  const url = `https://api.ebay.com/buy/offer/v1_beta/bidding/${itemIdEnc}/place_proxy_bid`;
  const bidTimeout = ebayTimeoutMs();
  try {
    const { data } = await axios.post(
      url,
      { maxAmount: { value: amount.toFixed(2), currency } },
      {
        timeout: bidTimeout,
        headers: { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' },
      }
    );
    return normalizeBidSuccess({ itemId, maxAmount: amount, offerData: data });
  } catch (error) {
    const status = error.response?.status;
    const errPayload = error.response?.data;
    if (status === 403 || status === 404 || status === 409) {
      return redirectFallback(
        browseItem.itemWebUrl,
        'Offer API unavailable for this item/account; manual bid required',
        itemId
      );
    }
    const message =
      errPayload?.errors?.[0]?.message ||
      errPayload?.message ||
      error.message ||
      'eBay bid request failed';
    const out = new Error(message);
    out.statusCode = status || 500;
    throw out;
  }
}

module.exports = { placeProxyBidForUser };

