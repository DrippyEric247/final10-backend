/**
 * Verify provider ID tokens (Google/Apple) against their published JWKS.
 *
 * Uses Node's built-in crypto (createPublicKey with format: 'jwk') so no extra
 * dependency is required. Keys are cached in-memory with a TTL and refreshed on
 * a kid miss (handles provider key rotation).
 */

const crypto = require('crypto');
const axios = require('axios');
const jwt = require('jsonwebtoken');

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const cache = new Map(); // jwksUri -> { keys, fetchedAt }

async function fetchJwks(jwksUri, { force = false } = {}) {
  const cached = cache.get(jwksUri);
  if (!force && cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.keys;
  }
  const { data } = await axios.get(jwksUri, { timeout: 8000 });
  const keys = Array.isArray(data && data.keys) ? data.keys : [];
  cache.set(jwksUri, { keys, fetchedAt: Date.now() });
  return keys;
}

/**
 * Verify a JWT and return its payload. Throws on any failure (bad signature,
 * wrong issuer/audience, expired, nonce mismatch).
 */
async function verifyJwtWithJwks(token, { jwksUri, issuer, audience, nonce } = {}) {
  if (!token || typeof token !== 'string') {
    throw new Error('Missing identity token');
  }
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || !decoded.header || !decoded.header.kid) {
    throw new Error('Malformed identity token');
  }
  const { kid, alg } = decoded.header;

  let keys = await fetchJwks(jwksUri);
  let jwk = keys.find((k) => k.kid === kid);
  if (!jwk) {
    keys = await fetchJwks(jwksUri, { force: true });
    jwk = keys.find((k) => k.kid === kid);
  }
  if (!jwk) {
    throw new Error('No matching signing key for identity token');
  }

  const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  const payload = jwt.verify(token, publicKey, {
    algorithms: [alg || 'RS256'],
    issuer,
    audience,
  });

  if (nonce && payload.nonce && payload.nonce !== nonce) {
    throw new Error('Identity token nonce mismatch');
  }
  return payload;
}

module.exports = { verifyJwtWithJwks };
