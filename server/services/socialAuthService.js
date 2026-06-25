/**
 * Social sign-in (Google + Apple) — Authorization Code flow.
 *
 * Stateless CSRF: the OAuth `state` is a short-lived JWT signed with JWT_SECRET
 * (no session/cookie needed, which also survives Apple's cross-site form_post).
 * Provider ID tokens are verified server-side against each provider's JWKS.
 */

const crypto = require('crypto');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { google, apple, getClientBaseUrl } = require('../config/socialAuthConfig');
const { verifyJwtWithJwks } = require('./oauthJwks');

const STATE_TTL = '10m';

/* --------------------------------- state --------------------------------- */

function signState({ provider, nonce }) {
  return jwt.sign(
    { k: 'oauth_state', provider, nonce },
    process.env.JWT_SECRET,
    { expiresIn: STATE_TTL }
  );
}

function verifyState(token, expectedProvider) {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  if (decoded.k !== 'oauth_state' || decoded.provider !== expectedProvider) {
    throw new Error('Invalid OAuth state');
  }
  return decoded;
}

function makeNonce() {
  return crypto.randomBytes(16).toString('hex');
}

/* ----------------------------- authorize URLs ---------------------------- */

function getGoogleAuthUrl() {
  const nonce = makeNonce();
  const state = signState({ provider: 'google', nonce });
  const params = new URLSearchParams({
    client_id: google.clientId,
    redirect_uri: google.callbackUrl,
    response_type: 'code',
    scope: google.scope,
    state,
    nonce,
    access_type: 'online',
    include_granted_scopes: 'true',
    prompt: 'select_account',
  });
  return `${google.authUrl}?${params.toString()}`;
}

function getAppleAuthUrl() {
  const nonce = makeNonce();
  const state = signState({ provider: 'apple', nonce });
  const params = new URLSearchParams({
    client_id: apple.clientId,
    redirect_uri: apple.callbackUrl,
    response_type: 'code',
    scope: apple.scope,
    state,
    nonce,
    // Required by Apple when requesting name/email scopes.
    response_mode: 'form_post',
  });
  return `${apple.authUrl}?${params.toString()}`;
}

/* ------------------------------ code exchange ---------------------------- */

async function exchangeGoogleCode(code, expectedNonce) {
  const body = new URLSearchParams({
    code,
    client_id: google.clientId,
    client_secret: google.clientSecret,
    redirect_uri: google.callbackUrl,
    grant_type: 'authorization_code',
  });
  const { data } = await axios.post(google.tokenUrl, body.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 10000,
  });
  if (!data || !data.id_token) throw new Error('Google did not return an id_token');

  const claims = await verifyJwtWithJwks(data.id_token, {
    jwksUri: google.jwksUri,
    issuer: google.issuers,
    audience: google.clientId,
    nonce: expectedNonce,
  });

  return {
    provider: 'google',
    providerId: claims.sub,
    email: claims.email ? String(claims.email).toLowerCase() : null,
    emailVerified: claims.email_verified === true || claims.email_verified === 'true',
    firstName: claims.given_name || '',
    lastName: claims.family_name || '',
    name: claims.name || '',
    profileImage: claims.picture || null,
  };
}

/** Apple client secret is a short-lived ES256 JWT signed with the .p8 key. */
function buildAppleClientSecret() {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      iss: apple.teamId,
      iat: now,
      exp: now + 60 * 30, // 30 minutes
      aud: 'https://appleid.apple.com',
      sub: apple.clientId,
    },
    apple.privateKey,
    { algorithm: 'ES256', keyid: apple.keyId }
  );
}

async function exchangeAppleCode(code, expectedNonce, applePayloadUser) {
  const clientSecret = buildAppleClientSecret();
  const body = new URLSearchParams({
    code,
    client_id: apple.clientId,
    client_secret: clientSecret,
    redirect_uri: apple.callbackUrl,
    grant_type: 'authorization_code',
  });
  const { data } = await axios.post(apple.tokenUrl, body.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 10000,
  });
  if (!data || !data.id_token) throw new Error('Apple did not return an id_token');

  const claims = await verifyJwtWithJwks(data.id_token, {
    jwksUri: apple.jwksUri,
    issuer: apple.issuer,
    audience: apple.clientId,
    nonce: expectedNonce,
  });

  // Apple only sends the user's name on the FIRST authorization, via the
  // form_post `user` field (JSON). The id_token never carries a name.
  let firstName = '';
  let lastName = '';
  if (applePayloadUser) {
    try {
      const parsed =
        typeof applePayloadUser === 'string' ? JSON.parse(applePayloadUser) : applePayloadUser;
      firstName = parsed?.name?.firstName || '';
      lastName = parsed?.name?.lastName || '';
    } catch (_e) {
      /* ignore malformed user payload */
    }
  }

  return {
    provider: 'apple',
    providerId: claims.sub,
    email: claims.email ? String(claims.email).toLowerCase() : null,
    emailVerified: claims.email_verified === true || claims.email_verified === 'true',
    isPrivateEmail: claims.is_private_email === true || claims.is_private_email === 'true',
    firstName,
    lastName,
    name: [firstName, lastName].filter(Boolean).join(' '),
    profileImage: null,
  };
}

/* --------------------------- user find / create -------------------------- */

function sanitizeUsernameBase(input) {
  const base = String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 30);
  return base.length >= 2 ? base : 'savvy';
}

async function generateUniqueUsername(seed) {
  const base = sanitizeUsernameBase(seed);
  // Try the base first, then append short random suffixes until unique.
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate =
      attempt === 0 ? base : `${base}${crypto.randomBytes(2).toString('hex')}`.slice(0, 38);
    // eslint-disable-next-line no-await-in-loop
    const taken = await User.findOne({ username: candidate }).select('_id').lean();
    if (!taken) return candidate;
  }
  return `savvy_${crypto.randomBytes(5).toString('hex')}`;
}

function providerIdField(provider) {
  return provider === 'apple' ? 'appleId' : 'googleId';
}

/**
 * Find an existing account by provider id, else link by verified email, else
 * create a fresh account. Existing user data (Savvy, Battle Pass, eggs, perk
 * history, streaks, alerts, calling cards, subscription) is never overwritten —
 * we only fill in provider identity + missing profile fields.
 *
 * Returns { user, isNew, linked }.
 */
async function findOrCreateSocialUser(profile) {
  const { provider, providerId } = profile;
  if (!provider || !providerId) throw new Error('Missing provider identity');
  const idField = providerIdField(provider);
  const email = profile.email ? String(profile.email).toLowerCase() : null;

  // 1) Already linked to this provider identity.
  const byProvider = await User.findOne({ [idField]: providerId });
  if (byProvider) {
    if (!byProvider.profileImage && profile.profileImage) {
      byProvider.profileImage = profile.profileImage;
    }
    if (profile.emailVerified && !byProvider.emailVerified) {
      byProvider.emailVerified = true;
    }
    byProvider.lastActive = new Date();
    await byProvider.save();
    return { user: byProvider, isNew: false, linked: false };
  }

  // 2) Link to an existing account with the same email (preserve all data).
  if (email) {
    const byEmail = await User.findOne({ email });
    if (byEmail) {
      byEmail[idField] = providerId;
      if (!Array.isArray(byEmail.authProviders)) byEmail.authProviders = [];
      const already = byEmail.authProviders.some(
        (p) => p.provider === provider && p.providerId === providerId
      );
      if (!already) {
        byEmail.authProviders.push({ provider, providerId, email, linkedAt: new Date() });
      }
      // Apple/Google verified the email; reflect that, but never wipe existing data.
      if (profile.emailVerified) byEmail.emailVerified = true;
      if (!byEmail.profileImage && profile.profileImage) byEmail.profileImage = profile.profileImage;
      byEmail.lastActive = new Date();
      await byEmail.save();
      return { user: byEmail, isNew: false, linked: true };
    }
  }

  // 3) Create a brand-new account.
  const usernameSeed = email ? email.split('@')[0] : `${provider}_${providerId.slice(-6)}`;
  const username = await generateUniqueUsername(usernameSeed);
  const user = new User({
    firstName: profile.firstName || '',
    lastName: profile.lastName || '',
    username,
    email: email || `${provider}_${providerId}@users.final10.app`,
    provider,
    [idField]: providerId,
    emailVerified: Boolean(profile.emailVerified),
    profileImage: profile.profileImage || null,
    authProviders: [{ provider, providerId, email, linkedAt: new Date() }],
    points: 100,
    membershipTier: 'free',
    lastActive: new Date(),
  });
  await user.save();
  user.referralCode = user._id.toString();
  await user.save();

  return { user, isNew: true, linked: false };
}

/* --------------------------------- redirect ------------------------------ */

function buildClientSuccessRedirect(token, provider) {
  const base = getClientBaseUrl();
  const params = new URLSearchParams({ token, provider });
  return `${base}/auth/social?${params.toString()}`;
}

function buildClientErrorRedirect(reason, provider) {
  const base = getClientBaseUrl();
  const params = new URLSearchParams({ error: reason || 'social_auth_failed' });
  if (provider) params.set('provider', provider);
  return `${base}/login?${params.toString()}`;
}

module.exports = {
  signState,
  verifyState,
  getGoogleAuthUrl,
  getAppleAuthUrl,
  exchangeGoogleCode,
  exchangeAppleCode,
  buildAppleClientSecret,
  findOrCreateSocialUser,
  generateUniqueUsername,
  buildClientSuccessRedirect,
  buildClientErrorRedirect,
};
