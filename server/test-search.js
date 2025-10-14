const mongoose = require('mongoose');
const Auction = require('./models/Auction');
require('dotenv').config();

async function testSearch() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/final10');
    console.log('Connected to MongoDB');

    const count = await Auction.countDocuments();
    console.log('Total auctions:', count);

    // Test iPhone search
    const iphoneSearch = await Auction.find({
      $or: [
        { title: { $regex: 'iphone', $options: 'i' } },
        { description: { $regex: 'iphone', $options: 'i' } },
        { tags: { $in: [new RegExp('iphone', 'i')] } }
      ]
    });
    
    console.log('iPhone search results:', iphoneSearch.length);
    iphoneSearch.forEach(a => console.log('- ' + a.title));

    // Test general search
    const allActive = await Auction.find({ status: 'active' });
    console.log('Active auctions:', allActive.length);
    allActive.forEach(a => console.log('- ' + a.title));

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testSearch();

