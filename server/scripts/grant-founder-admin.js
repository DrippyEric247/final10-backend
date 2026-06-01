/**
 * Grant Founding Tester + superadmin (founder admin) using existing User schema fields.
 *
 * Usage (local):
 *   node server/scripts/grant-founder-admin.js ericvasquez012@gmail.com
 *
 * Usage (production — paste Railway MONGODB_URI):
 *   MONGODB_URI="mongodb+srv://..." node server/scripts/grant-founder-admin.js ericvasquez012@gmail.com
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { grantFounderAdminByEmailOrId } = require('../services/grantFounderAdminService');

async function main() {
  const email = String(process.argv[2] || '').trim().toLowerCase();
  if (!email) {
    console.error('Usage: node server/scripts/grant-founder-admin.js <email>');
    process.exit(1);
  }
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is required');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const user = await grantFounderAdminByEmailOrId({ email, grantedBy: 'grant-founder-admin.js' });
  console.log(JSON.stringify({ success: true, user }, null, 2));
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
