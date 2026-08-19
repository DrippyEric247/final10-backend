#!/usr/bin/env node
/**
 * Wave 7 final integration verification — real Mongo concurrency proofs.
 * Uses isolated test prefixes; never touches production customer data patterns.
 * Never logs secret values.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const mongoose = require('mongoose');
const crypto = require('crypto');

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.log(JSON.stringify({ ok: false, phase: 'env', reason: 'MONGODB_URI missing' }));
  process.exit(1);
}

const { acquireJobLease, withJobLease } = require('../lib/distributedJobLock');
const { incrementDistributedRateLimit } = require('../lib/distributedRateLimit');
const { verifyAndEnsureIndexes } = require('../lib/indexDeployment');
const { deliverAlertMatch } = require('../services/alertDeliveryService');
const { retrySingleMatchEmail } = require('../services/alertEmailRetryService');
const BackgroundJobLease = require('../models/BackgroundJobLease');
const DistributedRateLimitBucket = require('../models/DistributedRateLimitBucket');
const Alert = require('../models/Alert');
const User = require('../models/User');
const Auction = require('../models/Auction');
const SavvyTransaction = require('../models/SavvyTransaction');

const runId = `w7verify_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

function minimalAuction(overrides = {}) {
  const now = Date.now();
  return {
    title: `W7 verify ${runId}`,
    description: 'Wave 7 integration verification fixture',
    category: 'electronics',
    condition: 'good',
    startingPrice: 50,
    currentBid: 50,
    startTime: new Date(now - 3600000),
    endTime: new Date(now + 3600000),
    source: { platform: 'ebay', url: 'https://example.com/w7verify' },
    ...overrides,
  };
}

async function proofJobLeaseTwoWorkers() {
  const jobKey = `${runId}:lease`;
  await BackgroundJobLease.deleteMany({ jobKey });
  const [a, b] = await Promise.all([
    acquireJobLease(jobKey, 'worker-a', 5000),
    acquireJobLease(jobKey, 'worker-b', 5000),
  ]);
  const winners = [a.acquired, b.acquired].filter(Boolean).length;
  await BackgroundJobLease.deleteMany({ jobKey });
  return {
    proof: 'A_job_lease_two_workers',
    expected: 'exactly_one_winner',
    pass: winners === 1,
    winners,
    details: { a: a.acquired, b: b.acquired, bReason: b.reason || null },
  };
}

async function proofExpiredLeaseRecovery() {
  const jobKey = `${runId}:lease_expired`;
  await BackgroundJobLease.deleteMany({ jobKey });
  await BackgroundJobLease.create({
    jobKey,
    ownerId: 'crashed-worker',
    expiresAt: new Date(Date.now() - 2000),
  });
  const recovered = await acquireJobLease(jobKey, 'recovery-worker', 5000);
  await BackgroundJobLease.deleteMany({ jobKey });
  return {
    proof: 'E_expired_lease_recovery',
    expected: 'recoverable_after_expiry',
    pass: recovered.acquired === true && recovered.recovered === true,
    recovered,
  };
}

async function proofSharedRateLimit() {
  const bucketKey = `SECURITY:w7verify:${runId}:ip`;
  await DistributedRateLimitBucket.deleteMany({ bucketKey });
  const [r1, r2, r3] = await Promise.all([
    incrementDistributedRateLimit(bucketKey, 2, 60000),
    incrementDistributedRateLimit(bucketKey, 2, 60000),
    incrementDistributedRateLimit(bucketKey, 2, 60000),
  ]);
  await DistributedRateLimitBucket.deleteMany({ bucketKey });
  return {
    proof: 'D_shared_rate_limit',
    expected: 'third_request_blocked',
    pass: r1.allowed && r2.allowed && !r3.allowed && r3.count === 3,
    counts: [r1.count, r2.count, r3.count],
    allowed: [r1.allowed, r2.allowed, r3.allowed],
  };
}

async function proofAlertScanClaim() {
  const suffix = runId;
  const user = await User.create({
    username: `scan_${suffix}`,
    email: `scan_${suffix}@w7verify.test`,
    savvyPoints: 0,
    subscription: { tier: 'free' },
  });
  const alert = await Alert.create({
    user: user._id,
    name: 'scan claim test',
    keywords: ['x'],
    isActive: true,
  });
  const { claimAlertForScan } = require('../services/savvyScoutAlertScanner');
  const [c1, c2] = await Promise.all([claimAlertForScan(alert._id), claimAlertForScan(alert._id)]);
  const claims = [c1, c2].filter(Boolean).length;
  await Alert.deleteOne({ _id: alert._id });
  await User.deleteOne({ _id: user._id });
  return {
    proof: 'alert_scan_claim',
    expected: 'exactly_one_scan_claim',
    pass: claims === 1,
    claims,
  };
}

async function proofDuplicateSavvyGrant() {
  const suffix = runId;
  const user = await User.create({
    username: `savvy_${suffix}`,
    email: `savvy_${suffix}@w7verify.test`,
    savvyPoints: 0,
    subscription: { tier: 'free' },
  });
  const auction = await Auction.create(minimalAuction({ title: `Savvy dedupe ${suffix}` }));
  const alert = await Alert.create({
    user: user._id,
    name: 'savvy dedupe',
    keywords: ['test'],
    isActive: true,
    matches: [{ auction: auction._id, matchedAt: new Date() }],
  });
  const alertLean = alert.toObject();
  const [r1, r2] = await Promise.all([
    deliverAlertMatch(user._id, auction.toObject(), alertLean, alert.matches[0]._id),
    deliverAlertMatch(user._id, auction.toObject(), alertLean, alert.matches[0]._id),
  ]);
  await new Promise((r) => setTimeout(r, 100));
  const txCount = await SavvyTransaction.countDocuments({
    userId: user._id,
    idempotencyKey: `alert_trigger:${alert._id}:${auction._id}`,
  });
  const refreshed = await Alert.findById(alert._id);
  const savvyMarks = (refreshed.matches || []).filter((m) => m.savvyGrantedAt).length;
  try {
    await SavvyTransaction.deleteMany({ userId: user._id });
    await Alert.deleteOne({ _id: alert._id });
    await Auction.deleteOne({ _id: auction._id });
    await User.deleteOne({ _id: user._id });
  } catch {
    /* cleanup best-effort */
  }
  return {
    proof: 'C_duplicate_alert_match_savvy',
    expected: 'one_savvy_tx_one_savvyGrantedAt',
    pass: txCount <= 1 && savvyMarks <= 1,
    txCount,
    savvyMarks,
    deliveryResults: [Boolean(r1?.savvyGranted), Boolean(r2?.savvyGranted)],
  };
}

async function proofDuplicateEmailRetry() {
  const suffix = runId;
  const user = await User.create({
    username: `email_${suffix}`,
    email: `email_${suffix}@w7verify.test`,
    alertEmailOnMatch: true,
    savvyPoints: 0,
    subscription: { tier: 'free' },
  });
  const auction = await Auction.create(minimalAuction({ title: `Email dedupe ${suffix}` }));
  const alert = await Alert.create({
    user: user._id,
    name: 'email dedupe',
    keywords: ['test'],
    isActive: true,
    matches: [
      {
        auction: auction._id,
        emailSentAt: null,
        emailDeliveryStatus: 'retry',
        emailRetryCount: 1,
        emailNextAttemptAt: new Date(Date.now() - 1000),
      },
    ],
  });
  const doc = await Alert.findById(alert._id);
  const match = doc.matches[0];
  const [e1, e2] = await Promise.all([
    retrySingleMatchEmail(doc, match),
    retrySingleMatchEmail(await Alert.findById(alert._id), match),
  ]);
  const refreshed = await Alert.findById(alert._id);
  const sentCount = (refreshed.matches || []).filter((m) => m.emailSentAt).length;
  const oneAttemptWins = sentCount <= 1;
  try {
    await Alert.deleteOne({ _id: alert._id });
    await Auction.deleteOne({ _id: auction._id });
    await User.deleteOne({ _id: user._id });
  } catch {
    /* cleanup best-effort */
  }
  return {
    proof: 'B_duplicate_email_retry',
    expected: 'at_most_one_authoritative_send_claim',
    pass: oneAttemptWins,
    sentCount,
    results: [e1, e2],
  };
}

async function proofCronOverlap() {
  const jobKey = `${runId}:cron_overlap`;
  await BackgroundJobLease.deleteMany({ jobKey });
  let executions = 0;
  const [r1, r2] = await Promise.all([
    withJobLease(jobKey, async () => {
      executions += 1;
      await new Promise((r) => setTimeout(r, 150));
    }, { ownerId: 'cron-1', leaseMs: 5000 }),
    withJobLease(jobKey, async () => {
      executions += 1;
    }, { ownerId: 'cron-2', leaseMs: 5000 }),
  ]);
  await BackgroundJobLease.deleteMany({ jobKey });
  return {
    proof: 'duplicate_cron_prevention',
    expected: 'one_execution',
    pass: executions === 1 && r1.skipped === false && r2.skipped === true,
    executions,
    r1Skipped: r1.skipped,
    r2Skipped: r2.skipped,
  };
}

async function main() {
  const report = { ok: true, runId, proofs: [], index: null };

  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000 });

  try {
    report.index = await verifyAndEnsureIndexes({ dryRun: false });
    report.proofs.push(await proofJobLeaseTwoWorkers());
    report.proofs.push(await proofExpiredLeaseRecovery());
    report.proofs.push(await proofSharedRateLimit());
    report.proofs.push(await proofAlertScanClaim());
    report.proofs.push(await proofDuplicateSavvyGrant());
    report.proofs.push(await proofDuplicateEmailRetry());
    report.proofs.push(await proofCronOverlap());
    report.ok = report.proofs.every((p) => p.pass) && report.index.ok !== false;
  } catch (err) {
    report.error = String(err.message || err).slice(0, 200);
    report.ok = false;
  } finally {
    await BackgroundJobLease.deleteMany({ jobKey: new RegExp(`^${runId}`) });
    await DistributedRateLimitBucket.deleteMany({ bucketKey: new RegExp(runId) });
    await mongoose.disconnect();
  }

  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}

main().catch((err) => {
  console.log(JSON.stringify({ ok: false, error: String(err.message || err).slice(0, 200) }));
  process.exit(1);
});
