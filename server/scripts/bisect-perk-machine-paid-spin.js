#!/usr/bin/env node
/**
 * Git bisect helper: exit 0 if paid_1 spin completes, exit 1 if not.
 *
 * Usage:
 *   git bisect start
 *   git bisect bad HEAD
 *   git bisect good a83ef205
 *   git bisect run node server/scripts/bisect-perk-machine-paid-spin.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const mongoose = require('mongoose');
const User = require('../models/User');
const SupplyDrop = require('../models/SupplyDrop');
const SavvyTransaction = require('../models/SavvyTransaction');
const { spinPerkMachine } = require('../services/perkMachineService');
const { SPIN_MODES } = require('../config/perkMachineRewards');

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('[bisect] MONGODB_URI required');
    process.exit(125);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const ts = Date.now();
  let userId = null;

  try {
    const user = await User.create({
      username: `bisect_pm_${ts}`,
      email: `bisect_pm_${ts}@bisect.local`,
      password: 'bisect_test_pass_123456',
      savvyPoints: 5000,
      perkMachine: { spinHeatTierIndex: 0, lastFreeSpinDay: '1999-01-01', lastSpinAt: null },
    });
    userId = user._id;

    const forceRewardId =
      typeof require('../config/perkMachineTestRewards').TEST_SAVVY_1 !== 'undefined'
        ? 'TEST_SAVVY_1'
        : 'savvy_25';

    const result = await spinPerkMachine(user, {
      mode: SPIN_MODES.PAID_1,
      forceRewardId,
    });

    const reloaded = await User.findById(user._id);
    const savvyWon = result.savvyWon || 0;
    const netDebit = 5000 - Number(reloaded.savvyPoints) + savvyWon;
    if (netDebit !== 20) {
      console.error('[bisect] FAIL unexpected net debit', { netDebit, savvyWon });
      process.exit(1);
    }

    console.log('[bisect] PASS', {
      commit: process.env.GIT_COMMIT || 'unknown',
      forceRewardId,
      spinId: result.spinId,
    });
    process.exit(0);
  } catch (err) {
    console.error('[bisect] FAIL', {
      message: err?.message,
      code: err?.code,
      failedStage: err?.failedStage,
      lastOkStage: err?.lastOkStage,
    });
    process.exit(1);
  } finally {
    if (userId) {
      await SupplyDrop.deleteMany({ userId });
      await SavvyTransaction.deleteMany({ userId });
      await User.deleteOne({ _id: userId });
    }
    await mongoose.disconnect();
  }
}

main();
