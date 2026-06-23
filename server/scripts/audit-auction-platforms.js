const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Auction = require('../models/Auction');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const sample = await Auction.findOne({ status: 'active' }).lean();
  const platforms = await Auction.aggregate([
    { $group: { _id: '$source.platform', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
  console.log(JSON.stringify({ sample: sample ? { title: sample.title, source: sample.source } : null, platforms }, null, 2));
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
