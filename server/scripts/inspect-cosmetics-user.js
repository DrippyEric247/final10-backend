/**
 * Inspect cosmetic unlock state for a user (by email, username, or id).
 * Usage: node scripts/inspect-cosmetics-user.js ericvasquez012@gmail.com
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const User = require('../models/User');
const CosmeticInventory = require('../models/CosmeticInventory');
const { ensureProgressDocuments } = require('../services/battlePassPersistenceService');
const { roleAutoUnlockIds } = require('../data/cosmeticIds');

function effectiveUnlockedSet(inv, user) {
  const set = new Set(inv.unlockedItemIds || []);
  for (const id of roleAutoUnlockIds(user?.role)) set.add(id);
  return set;
}

async function main() {
  const key = process.argv[2];
  if (!key) {
    console.error('Usage: node scripts/inspect-cosmetics-user.js <email|username|id>');
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/final10';
  await mongoose.connect(uri);

  let user = null;
  if (mongoose.Types.ObjectId.isValid(key)) {
    user = await User.findById(key);
  }
  if (!user) {
    const normalized = key.includes('@') ? key.toLowerCase().trim() : key.trim();
    user = await User.findOne({
      $or: [{ email: normalized }, { username: key.trim() }],
    });
  }

  if (!user) {
    console.error('User not found:', key);
    process.exit(1);
  }

  const { inv } = await ensureProgressDocuments(user._id);
  const inventoryUnlockedItemIds = [...(inv.unlockedItemIds || [])];
  const roleAutoUnlockIdsList = roleAutoUnlockIds(user.role);
  const effectiveUnlockedItemIds = [...effectiveUnlockedSet(inv, user)];

  const founders = ['sigil_founders_circle', 'card_founders_circle'];
  const foundersStatus = Object.fromEntries(
    founders.map((id) => [
      id,
      {
        inInventory: inventoryUnlockedItemIds.includes(id),
        inRoleAuto: roleAutoUnlockIdsList.includes(id),
        inEffective: effectiveUnlockedItemIds.includes(id),
      },
    ])
  );

  console.log(
    JSON.stringify(
      {
        userId: String(user._id),
        email: user.email,
        username: user.username,
        role: user.role,
        equippedCosmetics: user.equippedCosmetics || null,
        inventoryUnlockedItemIds,
        roleAutoUnlockIds: roleAutoUnlockIdsList,
        effectiveUnlockedItemIds,
        foundersCircle: foundersStatus,
      },
      null,
      2
    )
  );

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
