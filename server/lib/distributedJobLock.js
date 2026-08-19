/**
 * Mongo-backed distributed job leases for multi-instance cron safety.
 */

const crypto = require('crypto');
const os = require('os');
const BackgroundJobLease = require('../models/BackgroundJobLease');
const { info, warn } = require('../services/structuredLog');

function defaultOwnerId() {
  return `${os.hostname()}:${process.pid}:${crypto.randomUUID().slice(0, 8)}`;
}

/**
 * Attempt to acquire an exclusive lease. Expired leases may be stolen atomically.
 * Active non-expired leases cannot be stolen.
 */
async function acquireJobLease(jobKey, ownerId, leaseMs) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + leaseMs);
  const key = String(jobKey || '').trim();
  const owner = String(ownerId || defaultOwnerId());

  if (!key) {
    return { acquired: false, reason: 'invalid_job_key' };
  }

  try {
    await BackgroundJobLease.create({ jobKey: key, ownerId: owner, expiresAt });
    info('JOB_LEASE_ACQUIRED', { jobKey: key, ownerId: owner, leaseMs });
    return { acquired: true, ownerId: owner, expiresAt };
  } catch (err) {
    if (err?.code !== 11000) throw err;
  }

  const stolen = await BackgroundJobLease.findOneAndUpdate(
    { jobKey: key, expiresAt: { $lte: now } },
    { $set: { ownerId: owner, expiresAt, acquiredAt: now } },
    { new: true }
  );
  if (stolen) {
    info('JOB_LEASE_ACQUIRED', { jobKey: key, ownerId: owner, leaseMs, recovered: true });
    return { acquired: true, ownerId: owner, expiresAt, recovered: true };
  }

  const renewed = await BackgroundJobLease.findOneAndUpdate(
    { jobKey: key, ownerId: owner, expiresAt: { $gt: now } },
    { $set: { expiresAt } },
    { new: true }
  );
  if (renewed) {
    return { acquired: true, ownerId: owner, expiresAt, renewed: true };
  }

  warn('JOB_LEASE_DENIED', { jobKey: key, ownerId: owner });
  return { acquired: false, reason: 'held_by_other' };
}

async function releaseJobLease(jobKey, ownerId) {
  const key = String(jobKey || '').trim();
  const owner = String(ownerId || '');
  if (!key || !owner) return { released: false };

  const result = await BackgroundJobLease.deleteOne({ jobKey: key, ownerId: owner });
  if (result.deletedCount > 0) {
    info('JOB_LEASE_RELEASED', { jobKey: key, ownerId: owner });
    return { released: true };
  }
  return { released: false };
}

/**
 * Run fn only when this instance holds the lease for jobKey.
 */
async function withJobLease(jobKey, fn, { ownerId = defaultOwnerId(), leaseMs = 120000 } = {}) {
  const lock = await acquireJobLease(jobKey, ownerId, leaseMs);
  if (!lock.acquired) {
    return { skipped: true, reason: lock.reason || 'not_acquired' };
  }
  try {
    const result = await fn();
    return { skipped: false, result };
  } finally {
    await releaseJobLease(jobKey, ownerId);
  }
}

module.exports = {
  acquireJobLease,
  releaseJobLease,
  withJobLease,
  defaultOwnerId,
};
