#!/usr/bin/env node
/** Standalone bisect runner — copy outside repo; works on any checkout. */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const SupplyDrop = require('../models/SupplyDrop');
const SavvyTransaction = require('../models/SavvyTransaction');
const { spinPerkMachine } = require('../services/perkMachineService');
const { SPIN_MODES } = require('../config/perkMachineRewards');

(async () => {
  if (!process.env.MONGODB_URI) {
    console.error('NO_MONGODB');
    process.exit(125);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  const ts = Date.now();
  let userId = null;
  try {
    const user = await User.create({
      username: `bisect_${ts}`,
      email: `bisect_${ts}@t.local`,
      password: 'bisect_test_pass_123456',
      savvyPoints: 5000,
      perkMachine: { spinHeatTierIndex: 0, lastFreeSpinDay: '1999-01-01', lastSpinAt: null },
    });
    userId = user._id;
    const result = await spinPerkMachine(user, { mode: SPIN_MODES.PAID_1, forceRewardId: 'savvy_25' });
    const reloaded = await User.findById(user._id);
    const net = 5000 - Number(reloaded.savvyPoints) + (result.savvyWon || 0);
    if (net !== 20) throw new Error(`net_debit_${net}`);
    console.log('PASS', result.spinId);
    process.exit(0);
  } catch (e) {
    console.error('FAIL', e.message, e.failedStage, e.lastOkStage);
    process.exit(1);
  } finally {
    if (userId) {
      await SupplyDrop.deleteMany({ userId });
      await SavvyTransaction.deleteMany({ userId }).catch(() => {});
      await User.deleteOne({ _id: userId });
    }
    await mongoose.disconnect();
  }
})();
