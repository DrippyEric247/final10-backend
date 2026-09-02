#!/usr/bin/env node
/**
 * Diagnose Perk Machine spin failures against live Mongo (read-only probe + isolated test spins).
 * Usage: node server/scripts/diagnose-perk-spin-production.js [--clone-user=<email>]
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const mongoose = require('mongoose');
const User = require('../models/User');
const { spinPerkMachine } = require('../services/perkMachineService');
const { SPIN_MODES, REWARD_POOL } = require('../config/perkMachineRewards');

async function trySpin(user, options, label) {
  const before = Math.round(Number(user.savvyPoints) || 0);
  const heatBefore = user.perkMachine?.spinHeatTierIndex;
  try {
    const result = await spinPerkMachine(user, options);
    return {
      label,
      ok: true,
      savvyBefore: before,
      savvyAfter: result.savvyBalance,
      spinId: result.spinId,
      rewards: result.rewards?.map((r) => r.type),
    };
  } catch (err) {
    return {
      label,
      ok: false,
      savvyBefore: before,
      savvyAfter: Math.round(Number(user.savvyPoints) || 0),
      errorName: err?.name,
      errorMessage: err?.message,
      code: err?.code,
      status: err?.status,
      stack: err?.stack?.split('\n').slice(0, 8),
      heatBefore,
      heatAfter: user?.perkMachine?.spinHeatTierIndex,
    };
  }
}

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error(JSON.stringify({ ok: false, error: 'MONGODB_URI missing' }));
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const cloneArg = process.argv.find((a) => a.startsWith('--clone-user='));
  const cloneEmail = cloneArg ? cloneArg.split('=')[1] : null;

  const report = { ok: true, probes: [], cloneTests: [] };

  // Sample real users with perk machine state (no PII in output)
  const candidates = await User.find({
    'perkMachine.lastSpinAt': { $exists: true },
    savvyPoints: { $gte: 20 },
  })
    .select('username email savvyPoints perkMachine membershipTier isPremium')
    .sort({ 'perkMachine.lastSpinAt': -1 })
    .limit(5)
    .lean();

  report.candidateCount = candidates.length;
  report.candidateSnapshots = candidates.map((u) => ({
    userId: String(u._id),
    savvyPoints: u.savvyPoints,
    spinHeatTierIndex: u.perkMachine?.spinHeatTierIndex,
    hasSpinLock: Boolean(u.perkMachine?.spinLockUntil),
    spinHistoryLen: Array.isArray(u.perkMachine?.spinHistory) ? u.perkMachine.spinHistory.length : 0,
    lastSpinAt: u.perkMachine?.lastSpinAt || null,
    missingHeatFields:
      u.perkMachine &&
      (typeof u.perkMachine.spinHeatTierIndex !== 'number' ||
        u.perkMachine.spinHeatCooldownUntil === undefined),
  }));

  if (cloneEmail) {
    const source = await User.findOne({ email: cloneEmail.toLowerCase().trim() });
    if (!source) {
      report.cloneError = 'user not found';
    } else {
      const testUser = await User.create({
        username: `diag_pm_${Date.now()}`,
        email: `diag_pm_${Date.now()}@diag.local`,
        password: 'diagpass123456',
        savvyPoints: Math.max(5000, Number(source.savvyPoints) || 0),
        membershipTier: source.membershipTier,
        isPremium: source.isPremium,
        perkMachine: JSON.parse(JSON.stringify(source.perkMachine || {})),
      });
      testUser.perkMachine.lastSpinAt = null;
      testUser.perkMachine.spinLockUntil = null;
      testUser.markModified('perkMachine');
      await testUser.save();

      try {
        report.cloneTests.push(
          await trySpin(testUser, { mode: SPIN_MODES.PAID_1, adminBypassCost: true }, 'clone paid_1 bypass')
        );
        const reloaded = await User.findById(testUser._id);
        reloaded.perkMachine.lastSpinAt = null;
        reloaded.perkMachine.spinLockUntil = null;
        reloaded.markModified('perkMachine');
        await reloaded.save();
        report.cloneTests.push(
          await trySpin(reloaded, { mode: SPIN_MODES.PAID_3, adminBypassCost: true }, 'clone paid_3 bypass')
        );
        for (const reward of REWARD_POOL.filter((r) => ['supply_drop', 'calling_card', 'egg_haul'].includes(r.id))) {
          const u = await User.findById(testUser._id);
          u.perkMachine.lastSpinAt = null;
          u.perkMachine.spinLockUntil = null;
          u.markModified('perkMachine');
          await u.save();
          report.cloneTests.push(
            await trySpin(u, {
              mode: SPIN_MODES.PAID_1,
              forceRewardId: reward.id,
              adminBypassCost: true,
            }, `clone force ${reward.id}`)
          );
        }
      } finally {
        await User.deleteOne({ _id: testUser._id });
      }
    }
  }

  // Legacy-shape user probe
  const legacy = await User.create({
    username: `diag_legacy_${Date.now()}`,
    email: `diag_legacy_${Date.now()}@diag.local`,
    password: 'diagpass123456',
    savvyPoints: 5000,
    perkMachine: { lastFreeSpinDay: null, eggInventory: { common: 1 } },
  });
  try {
    report.probes.push(await trySpin(legacy, { mode: SPIN_MODES.PAID_1 }, 'legacy paid_1'));
    const r2 = await User.findById(legacy._id);
    r2.perkMachine.lastSpinAt = null;
    r2.perkMachine.spinLockUntil = null;
    r2.markModified('perkMachine');
    await r2.save();
    report.probes.push(
      await trySpin(r2, { mode: SPIN_MODES.PAID_3, forceRewardId: 'supply_drop' }, 'legacy supply_drop paid_3')
    );
  } finally {
    await User.deleteOne({ _id: legacy._id });
  }

  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(JSON.stringify({ ok: false, error: err.message, stack: err.stack }, null, 2));
  try {
    await mongoose.disconnect();
  } catch (_) {
    /* ignore */
  }
  process.exit(1);
});
