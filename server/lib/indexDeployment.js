/**
 * Safe index verification for deployment — create missing only, never drop.
 */

const Alert = require('../models/Alert');
const SavvyTransaction = require('../models/SavvyTransaction');
const User = require('../models/User');
const Auction = require('../models/Auction');

/** @type {Array<{ name: string, collection: import('mongodb').Collection, spec: object, options?: object }>} */
const INDEX_MANIFEST = [
  { name: 'alert_scan_schedule', collection: () => Alert.collection, spec: { isActive: 1, nextScanAt: 1, eligibleAt: 1 } },
  { name: 'alert_user_active', collection: () => Alert.collection, spec: { user: 1, isActive: 1 } },
  { name: 'alert_scan_claim_ttl', collection: () => Alert.collection, spec: { scanClaimExpiresAt: 1 }, options: { sparse: true } },
  { name: 'alert_email_retry', collection: () => Alert.collection, spec: { 'matches.emailDeliveryStatus': 1, 'matches.emailNextAttemptAt': 1 }, options: { sparse: true } },
  { name: 'savvy_tx_idempotency', collection: () => SavvyTransaction.collection, spec: { idempotencyKey: 1 }, options: { unique: true } },
  { name: 'savvy_tx_user_created', collection: () => SavvyTransaction.collection, spec: { userId: 1, createdAt: -1 } },
  { name: 'savvy_tx_user_source', collection: () => SavvyTransaction.collection, spec: { userId: 1, source: 1, createdAt: -1 } },
  { name: 'user_email', collection: () => User.collection, spec: { email: 1 }, options: { unique: true, sparse: true } },
  { name: 'user_oauth_google', collection: () => User.collection, spec: { googleId: 1 }, options: { sparse: true } },
  { name: 'user_oauth_apple', collection: () => User.collection, spec: { appleId: 1 }, options: { sparse: true } },
  { name: 'user_last_active', collection: () => User.collection, spec: { lastActive: -1 } },
  { name: 'auction_status_updated', collection: () => Auction.collection, spec: { status: 1, updatedAt: -1 } },
  { name: 'job_lease_expires', collection: () => require('../models/BackgroundJobLease').collection, spec: { expiresAt: 1 } },
];

function specKey(spec) {
  return JSON.stringify(spec);
}

async function listIndexKeys(collection) {
  const indexes = await collection.indexes();
  return indexes.map((idx) => ({ name: idx.name, key: idx.key, unique: Boolean(idx.unique) }));
}

async function verifyAndEnsureIndexes({ dryRun = true } = {}) {
  const report = {
    dryRun,
    existing: [],
    created: [],
    conflicts: [],
    manualRequired: [],
    ok: true,
  };

  for (const entry of INDEX_MANIFEST) {
    const collection = entry.collection();
    const indexes = await listIndexKeys(collection);
    const match = indexes.find((idx) => specKey(idx.key) === specKey(entry.spec));

    if (match) {
      if (entry.options?.unique && !match.unique) {
        report.conflicts.push({
          name: entry.name,
          issue: 'unique_required_but_index_not_unique',
          existing: match.name,
        });
        report.manualRequired.push(entry.name);
        report.ok = false;
      } else {
        report.existing.push({ name: entry.name, indexName: match.name });
      }
      continue;
    }

    if (dryRun) {
      report.created.push({ name: entry.name, spec: entry.spec, pending: true });
      continue;
    }

    try {
      const indexName = await collection.createIndex(entry.spec, {
        ...(entry.options || {}),
        name: entry.name,
      });
      report.created.push({ name: entry.name, indexName });
    } catch (err) {
      report.conflicts.push({ name: entry.name, error: err.message });
      report.manualRequired.push(entry.name);
      report.ok = false;
    }
  }

  if (report.manualRequired.length) report.ok = false;
  return report;
}

module.exports = {
  INDEX_MANIFEST,
  verifyAndEnsureIndexes,
  specKey,
};
