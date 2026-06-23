/**
 * Grant cosmetic unlocks directly in MongoDB (emergency / migration).
 * Usage: node scripts/grant-cosmetics-for-user.js ericvasquez012@gmail.com sigil_founders_circle card_founders_circle
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const { grantCosmeticUnlock } = require('../services/cosmeticInventoryService');

async function main() {
  const userKey = process.argv[2];
  const itemIds = process.argv.slice(3);
  if (!userKey || !itemIds.length) {
    console.error('Usage: node scripts/grant-cosmetics-for-user.js <email|username|id> <itemId> [itemId...]');
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/final10';
  await mongoose.connect(uri);

  for (const itemId of itemIds) {
    const state = await grantCosmeticUnlock(null, userKey, itemId, 'cli migration grant');
    console.log(`Granted ${itemId} to ${userKey}`);
    console.log(JSON.stringify(state, null, 2));
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
