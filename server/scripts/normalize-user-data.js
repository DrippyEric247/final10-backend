#!/usr/bin/env node
/**
 * Wave 6 — idempotent user data normalization (dry-run by default).
 *
 * Usage:
 *   node server/scripts/normalize-user-data.js --dry-run
 *   node server/scripts/normalize-user-data.js --apply --batch=100
 *   node server/scripts/normalize-user-data.js --dry-run --userId=<mongoId>
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const SavvyTransaction = require('../models/SavvyTransaction');
const {
  resolveSavvyBalanceMigrationTarget,
  detectSavvyBalanceConflict,
  buildNormalizationPatch,
  DATA_NORMALIZATION_VERSION,
} = require('../lib/dataAuthority');

function parseArgs(argv) {
  const opts = { dryRun: true, batch: 200, userId: null };
  for (const arg of argv) {
    if (arg === '--apply') opts.dryRun = false;
    if (arg.startsWith('--batch=')) opts.batch = Math.max(1, Number(arg.split('=')[1]) || 200);
    if (arg.startsWith('--userId=')) opts.userId = arg.split('=')[1];
  }
  return opts;
}

async function sumCompletedTransactions(userId) {
  const rows = await SavvyTransaction.aggregate([
    { $match: { userId, status: 'completed' } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  return Math.round(Number(rows[0]?.total) || 0);
}

async function normalizeUser(user, opts) {
  const result = {
    userId: String(user._id),
    alreadyCanonical: false,
    migrated: false,
    conflicting: false,
    unresolved: false,
    flags: [],
  };

  if (Number(user?.dataNormalization?.version) >= DATA_NORMALIZATION_VERSION) {
    result.alreadyCanonical = true;
    return result;
  }

  const conflict = detectSavvyBalanceConflict(user);
  if (conflict.conflict) {
    result.conflicting = true;
    result.flags.push(`savvy_mirror_delta:${conflict.delta}`);
  }

  const migration = await resolveSavvyBalanceMigrationTarget(user, {
    sumCompletedTransactions: () => sumCompletedTransactions(user._id),
  });

  if (migration.ambiguous) {
    result.unresolved = true;
    result.flags.push('ambiguous_savvy_balance');
    return result;
  }

  const canonical = Math.round(Number(migration.target) || 0);
  const mirror = Math.round(Number(user.pointsBalance) || 0);
  const needsSavvyWrite = Math.round(Number(user.savvyPoints) || 0) !== canonical;
  const needsMirrorSync = mirror !== canonical;

  if (!needsSavvyWrite && !needsMirrorSync && !conflict.conflict) {
    result.alreadyCanonical = true;
    if (!opts.dryRun) {
      await User.updateOne({ _id: user._id }, { $set: buildNormalizationPatch('normalize_script', result.flags) });
    }
    return result;
  }

  result.migrated = true;
  if (!opts.dryRun) {
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          savvyPoints: canonical,
          pointsBalance: canonical,
          ...buildNormalizationPatch('normalize_script', result.flags),
        },
      }
    );
  }

  return result;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGODB_URI required');
    process.exit(1);
  }

  await mongoose.connect(uri);

  const query = opts.userId ? { _id: opts.userId } : {};
  const cursor = User.find(query).select('_id savvyPoints pointsBalance dataNormalization').cursor();

  const stats = {
    scanned: 0,
    alreadyCanonical: 0,
    migrated: 0,
    conflicting: 0,
    unresolved: 0,
    dryRun: opts.dryRun,
  };

  let batchCount = 0;
  for await (const user of cursor) {
    stats.scanned += 1;
    const row = await normalizeUser(user, opts);
    if (row.alreadyCanonical) stats.alreadyCanonical += 1;
    if (row.migrated) stats.migrated += 1;
    if (row.conflicting) stats.conflicting += 1;
    if (row.unresolved) stats.unresolved += 1;

    batchCount += 1;
    if (batchCount >= opts.batch && !opts.userId) break;
  }

  console.log(JSON.stringify(stats, null, 2));
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
