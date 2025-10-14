const mongoose = require('mongoose');
require('dotenv').config();

const Auction = require('./models/Auction');

async function fixPlaceholderImages() {
  try {
    console.log('🖼️ Fixing Placeholder Images...\n');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/final10');
    console.log('✅ Connected to MongoDB\n');

    // Get all auctions
    const auctions = await Auction.find({});
    console.log(`📊 Found ${auctions.length} auctions`);

    if (auctions.length === 0) {
      console.log('❌ No auctions found');
      return;
    }

    // Define proper placeholder images for each category
    const placeholderImages = {
      electronics: 'https://via.placeholder.com/400x300/1f2937/60a5fa?text=Electronics',
      fashion: 'https://via.placeholder.com/400x300/1f2937/f472b6?text=Fashion',
      gaming: 'https://via.placeholder.com/400x300/1f2937/10b981?text=Gaming',
      luxury: 'https://via.placeholder.com/400x300/1f2937/f59e0b?text=Luxury',
      automotive: 'https://via.placeholder.com/400x300/1f2937/ef4444?text=Automotive',
      default: 'https://via.placeholder.com/400x300/1f2937/8b5cf6?text=Product'
    };

    // Update each auction with proper placeholder images
    let updatedCount = 0;
    
    for (const auction of auctions) {
      const category = auction.category || 'default';
      const placeholderImage = placeholderImages[category] || placeholderImages.default;
      
      // Create a proper image array with the placeholder object structure
      const properImages = [{
        url: placeholderImage,
        alt: `${auction.title} - ${category}`,
        isPrimary: true
      }];
      
      // Update the auction
      await Auction.updateOne(
        { _id: auction._id },
        {
          $set: {
            images: properImages
          }
        }
      );
      
      updatedCount++;
      console.log(`✅ Updated auction: ${auction.title}`);
      console.log(`   Category: ${category}`);
      console.log(`   Image URL: ${placeholderImage}`);
    }

    console.log(`\n🎉 Updated ${updatedCount} auctions with proper placeholder images`);

    // Verify the updates
    const updatedAuctions = await Auction.find({}).limit(3);
    console.log('\n📊 Updated auctions:');
    updatedAuctions.forEach((auction, index) => {
      console.log(`\n${index + 1}. ${auction.title}`);
      console.log(`   Category: ${auction.category}`);
      console.log(`   Images: ${auction.images.map(img => img.url).join(', ')}`);
    });

    // Test the trending endpoint to make sure images are working
    console.log('\n🧪 Testing trending endpoint with fixed images...');
    
    const axios = require('axios');
    const baseURL = 'http://localhost:5000/api';
    
    try {
      // Login first
      const loginResponse = await axios.post(`${baseURL}/auth/login`, {
        email: 'demo@final10.com',
        password: 'demo123'
      });
      
      const token = loginResponse.data.token;
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      // Test trending endpoint
      const trendingResponse = await axios.get(`${baseURL}/feed/trending`, {
        headers,
        params: {
          limit: 5,
          timeRange: '7d'
        }
      });
      
      console.log(`✅ Trending endpoint successful!`);
      console.log(`   Trending Auctions: ${trendingResponse.data.trendingAuctions?.length || 0}`);
      
      if (trendingResponse.data.trendingAuctions?.length > 0) {
        console.log('\n🖼️ Trending auctions with images:');
        trendingResponse.data.trendingAuctions.slice(0, 3).forEach((auction, index) => {
          console.log(`\n${index + 1}. ${auction.title}`);
          console.log(`   Category: ${auction.category}`);
          console.log(`   Price: $${auction.currentBid}`);
          console.log(`   Images: ${auction.images?.map(img => img.url).join(', ') || 'No images'}`);
        });
      }
      
    } catch (error) {
      console.log('❌ Trending endpoint test failed:', error.response?.data?.message || error.message);
    }

  } catch (error) {
    console.error('❌ Fix failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n📡 Disconnected from MongoDB');
  }
}

// Run the function
fixPlaceholderImages();
