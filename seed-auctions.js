const mongoose = require('mongoose');
const Auction = require('./models/Auction');
const User = require('./models/User');
require('dotenv').config();

const sampleAuctions = [
  {
    title: "iPhone 14 Pro Max 256GB - Space Black",
    description: "Excellent condition iPhone 14 Pro Max with 256GB storage. Includes original box, charger, and case.",
    category: "electronics",
    condition: "like-new",
    startingPrice: 800,
    currentBid: 850,
    buyItNowPrice: 950,
    endTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
    images: [{ url: "https://example.com/iphone.jpg", alt: "iPhone 14 Pro Max" }],
    tags: ["iphone", "apple", "smartphone", "pro max"],
    source: { platform: "internal" },
    aiScore: { dealPotential: 75, competitionLevel: "medium", trendingScore: 85 }
  },
  {
    title: "iPhone 13 128GB - Blue",
    description: "Good condition iPhone 13 with 128GB storage. Minor scratches on screen.",
    category: "electronics", 
    condition: "good",
    startingPrice: 500,
    currentBid: 520,
    endTime: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // 1 day from now
    images: [{ url: "https://example.com/iphone13.jpg", alt: "iPhone 13" }],
    tags: ["iphone", "apple", "smartphone"],
    source: { platform: "internal" },
    aiScore: { dealPotential: 80, competitionLevel: "low", trendingScore: 70 }
  },
  {
    title: "Samsung Galaxy S23 Ultra 512GB",
    description: "Brand new Samsung Galaxy S23 Ultra with 512GB storage. Still sealed in box.",
    category: "electronics",
    condition: "new", 
    startingPrice: 900,
    currentBid: 900,
    endTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
    images: [{ url: "https://example.com/galaxy.jpg", alt: "Samsung Galaxy S23" }],
    tags: ["samsung", "galaxy", "smartphone", "android"],
    source: { platform: "internal" },
    aiScore: { dealPotential: 60, competitionLevel: "high", trendingScore: 90 }
  },
  {
    title: "MacBook Pro 14-inch M2 Chip",
    description: "2023 MacBook Pro with M2 chip, 16GB RAM, 512GB SSD. Excellent condition.",
    category: "electronics",
    condition: "like-new",
    startingPrice: 1200,
    currentBid: 1250,
    endTime: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000), // 4 days from now
    images: [{ url: "https://example.com/macbook.jpg", alt: "MacBook Pro" }],
    tags: ["macbook", "apple", "laptop", "m2"],
    source: { platform: "internal" },
    aiScore: { dealPotential: 70, competitionLevel: "medium", trendingScore: 75 }
  },
  {
    title: "Nike Air Jordan 1 Retro High",
    description: "Classic Air Jordan 1 in Chicago colorway. Size 10.5, worn once.",
    category: "fashion",
    condition: "like-new",
    startingPrice: 150,
    currentBid: 175,
    endTime: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // 1 day from now
    images: [{ url: "https://example.com/jordans.jpg", alt: "Air Jordan 1" }],
    tags: ["nike", "jordan", "sneakers", "basketball"],
    source: { platform: "internal" },
    aiScore: { dealPotential: 85, competitionLevel: "low", trendingScore: 95 }
  }
];

async function seedAuctions() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/final10');
    console.log('Connected to MongoDB');

    // Find a user to be the seller (or create one if none exist)
    let seller = await User.findOne();
    if (!seller) {
      seller = new User({
        username: 'testuser',
        email: 'test@example.com',
        password: 'hashedpassword' // You'd normally hash this
      });
      await seller.save();
      console.log('Created test user');
    }

    // Add seller ID and startTime to all auctions
    const auctionsWithSeller = sampleAuctions.map(auction => ({
      ...auction,
      seller: seller._id,
      status: 'active',
      startTime: new Date()
    }));

    await Auction.insertMany(auctionsWithSeller);
    console.log(`✅ Added ${sampleAuctions.length} sample auctions`);
    
    // Test search
    const iphoneResults = await Auction.find({
      $or: [
        { title: { $regex: 'iphone', $options: 'i' } },
        { description: { $regex: 'iphone', $options: 'i' } },
        { tags: { $in: [new RegExp('iphone', 'i')] } }
      ]
    });
    console.log(`📱 Found ${iphoneResults.length} iPhone auctions`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error seeding auctions:', error);
    process.exit(1);
  }
}

seedAuctions();
