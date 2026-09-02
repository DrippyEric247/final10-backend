#!/usr/bin/env node
/**
 * Git bisect gate: paid 1-slot spin completes (20 Savvy debited net).
 * Run from repo root: node server/scripts/bisect-paid-spin-gate.js
 */
const fs = require('fs');
const path = require('path');

const serverDir = path.join(__dirname, '..');
const envPath = path.join(serverDir, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) {
      process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
}

if (!process.env.MONGODB_URI) {
  console.error('NO_MONGODB');
  process.exit(125);
}

const mongoose = require('mongoose');
const User = require('../models/User');
const SupplyDrop = require('../models/SupplyDrop');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const ts = Date.now();
  let userId = null;
  try {
    const { spinPerkMachine } = require('../services/perkMachineService');
    const { SPIN_MODES } = require('../config/perkMachineRewards');

    const user = await User.create({
      username: `bisect_${ts}`,
      email: `bisect_${ts}@t.local`,
      password: 'bisect_test_pass_123456',
      savvyPoints: 5000,
      perkMachine: { spinHeatTierIndex: 0, lastFreeSpinDay: '1999-01-01', lastSpinAt: null },
    });
    userId = user._id;

    const opts = { mode: SPIN_MODES.PAID_1 };
    try {
      require('../config/perkMachineTestRewards');
      opts.forceRewardId = 'TEST_SAVVY_1';
    } catch {
      opts.forceRewardId = 'savvy_25';
    }

    const before = Number(user.savvyPoints);
    const result = await spinPerkMachine(user, opts);
    const reloaded = await User.findById(user._id);
    const after = Number(reloaded.savvyPoints);
    const savvyWon = Number(result.savvyWon) || 0;
    const netDebit = before - after + savvyWon;

    if (netDebit !== 20) {
      throw new Error(`net_debit_${netDebit}_expected_20`);
    }
    console.log('PASS', result.spinId || 'ok');
    process.exit(0);
  } catch (e) {
    console.error(
      'FAIL',
      e.message,
      e.failedStage || e.code || '',
      e.lastOkStage || ''
    );
    process.exit(1);
  } finally {
    if (userId) {
      try {
        const SavvyTransaction = require('../models/SavvyTransaction');
        await SavvyTransaction.deleteMany({ userId });
      } catch {
        /* model may not exist on very old commits */
      }
      await SupplyDrop.deleteMany({ userId }).catch(() => {});
      await User.deleteOne({ _id: userId });
    }
    await mongoose.disconnect();
  }
})();
