/**
 * Grant Founding Tester flags and print auth/me + entitlements payloads.
 *
 * Usage (production — paste Railway MONGODB_URI):
 *   MONGODB_URI="mongodb+srv://..." node server/scripts/grant-and-verify-founding-tester.js ericvasquez012@gmail.com
 *
 * Optional live API check (after grant):
 *   API_BASE_URL=https://final10-backend-production.up.railway.app JWT_SECRET=... node ...
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getEntitlementByUserId, toMeResponse } = require('../services/premiumEntitlementService');

const API_BASE = String(process.env.API_BASE_URL || 'https://final10-backend-production.up.railway.app')
  .trim()
  .replace(/\/+$/, '');

async function main() {
  const email = String(process.argv[2] || '').trim().toLowerCase();
  if (!email) {
    console.error('Usage: node grant-and-verify-founding-tester.js <email>');
    process.exit(1);
  }
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is required (Railway production Atlas URI).');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  let user = await User.findOne({ email });
  if (!user) {
    console.error(`User not found: ${email}`);
    process.exit(1);
  }

  user.betaTester = true;
  user.foundingAccess = true;
  user.betaAccessExpiresAt = null;
  await user.save();

  const fresh = await User.findById(user._id).lean();
  const foundingTesterActive = Boolean(
    (fresh.betaTester || fresh.foundingAccess) &&
      (!fresh.betaAccessExpiresAt || new Date(fresh.betaAccessExpiresAt) > new Date())
  );

  const authMe = {
    email: fresh.email,
    username: fresh.username,
    betaTester: Boolean(fresh.betaTester),
    foundingAccess: Boolean(fresh.foundingAccess),
    betaAccessExpiresAt: fresh.betaAccessExpiresAt || null,
    foundingTesterAccess: foundingTesterActive,
    isBetaTester: foundingTesterActive,
    foundingTesterActive,
  };

  const ent = await getEntitlementByUserId(fresh._id);
  const entitlementsMe = toMeResponse(ent, fresh);

  console.log('=== GRANT APPLIED ===');
  console.log(JSON.stringify(authMe, null, 2));
  console.log('=== GET /api/entitlements/me (equivalent) ===');
  console.log(JSON.stringify(entitlementsMe, null, 2));

  if (process.env.JWT_SECRET) {
    const token = jwt.sign(
      { sub: String(fresh._id), id: fresh._id, userId: fresh._id },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    console.log('=== LIVE API CHECK ===');
    for (const path of ['/api/auth/me', '/api/entitlements/me']) {
      const res = await fetch(`${API_BASE}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.text();
      console.log(`${path} -> ${res.status}`);
      console.log(body);
    }
  } else {
    console.log('(Set JWT_SECRET to also hit live Railway /api/auth/me and /api/entitlements/me)');
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
