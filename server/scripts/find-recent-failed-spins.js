#!/usr/bin/env node
/**
 * Find users with Perk Machine activity in a time window (read-only).
 * Usage: node server/scripts/find-recent-failed-spins.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const mongoose = require('mongoose');
const User = require('../models/User');

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error(JSON.stringify({ ok: false, error: 'MONGODB_URI missing' }));
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const start = new Date(process.argv[2] || '2026-09-02T22:00:00.000Z');
  const end = new Date(process.argv[3] || '2026-09-02T23:30:00.000Z');

  const users = await User.find({
    $or: [
      { 'perkMachine.lastSpinAt': { $gte: start, $lte: end } },
      { 'perkMachine.spinLockUntil': { $gte: start, $lte: end } },
      { updatedAt: { $gte: start, $lte: end } },
    ],
  })
    .select(
      '_id username savvyPoints perkMachine.lastSpinAt perkMachine.spinLockUntil perkMachine.spinHistory updatedAt'
    )
    .sort({ updatedAt: -1 })
    .limit(30)
    .lean();

  const out = users.map((u) => {
    const hist = Array.isArray(u.perkMachine?.spinHistory) ? u.perkMachine.spinHistory : [];
    const recent = hist.slice(-5).map((h) => ({
      spinId: h.spinId,
      mode: h.mode,
      at: h.createdAt,
      rewards: h.rewards?.map((r) => r.id),
    }));
    return {
      userId: String(u._id),
      username: u.username,
      savvyPoints: u.savvyPoints,
      lastSpinAt: u.perkMachine?.lastSpinAt || null,
      spinLockUntil: u.perkMachine?.spinLockUntil || null,
      updatedAt: u.updatedAt,
      recentHistory: recent,
    };
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        window: { start: start.toISOString(), end: end.toISOString() },
        count: out.length,
        users: out,
      },
      null,
      2
    )
  );

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  try {
    await mongoose.disconnect();
  } catch (_) {
    /* ignore */
  }
  process.exit(1);
});
