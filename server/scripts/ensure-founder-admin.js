/**
 * Ensure founder email has at least admin role (idempotent).
 *
 * Usage:
 *   node server/scripts/ensure-founder-admin.js
 *   MONGODB_URI="mongodb+srv://..." node server/scripts/ensure-founder-admin.js ericvasquez012@gmail.com
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const {
  FOUNDER_ADMIN_EMAIL,
  ensureFounderAdminRole,
  isFounderAdminEmail,
} = require('../lib/founderAdminAccess');

async function main() {
  const email = String(process.argv[2] || FOUNDER_ADMIN_EMAIL).trim().toLowerCase();
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is required');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const user = await User.findOne({ email });
  if (!user) {
    console.error(`User not found for email: ${email}`);
    process.exit(1);
  }

  const before = user.role;
  if (isFounderAdminEmail(email)) {
    await ensureFounderAdminRole(user);
  } else if (before !== 'admin' && before !== 'superadmin') {
    user.role = 'admin';
    await user.save();
  }

  const updated = await User.findById(user._id).lean();
  console.log(
    JSON.stringify(
      {
        success: true,
        email: updated.email,
        roleBefore: before,
        roleAfter: updated.role,
      },
      null,
      2
    )
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
