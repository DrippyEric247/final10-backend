/**
 * Backfill SavvyTransaction rows from historical SavvyRewardLog (read-only source).
 * Does NOT mutate user balances — audit reconstruction only.
 *
 * Run: cd server && node scripts/backfill-savvy-transactions.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const SavvyRewardLog = require('../models/SavvyRewardLog');
const SavvyTransaction = require('../models/SavvyTransaction');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI required');
    process.exit(1);
  }
  await mongoose.connect(uri);

  let inserted = 0;
  let skipped = 0;
  const cursor = SavvyRewardLog.find({}).sort({ createdAt: 1 }).cursor();

  for await (const row of cursor) {
    const key = row.idempotencyKey;
    if (!key) {
      skipped += 1;
      continue;
    }
    const exists = await SavvyTransaction.findOne({ idempotencyKey: key }).lean();
    if (exists) {
      skipped += 1;
      continue;
    }
    try {
      await SavvyTransaction.create({
        userId: row.userId,
        source: row.rewardType || 'legacy_reward_log',
        amount: row.amount,
        idempotencyKey: key,
        status: 'completed',
        rewardType: row.rewardType,
        meta: { backfilledFrom: 'SavvyRewardLog', originalId: String(row._id) },
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      });
      inserted += 1;
    } catch (e) {
      if (e?.code === 11000) skipped += 1;
      else throw e;
    }
  }

  console.log(`Backfill complete. inserted=${inserted} skipped=${skipped}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
