import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  Zap, 
  Star, 
  TrendingUp, 
  Plus,
  Filter,
  Eye,
  MousePointer,
  Users,
  Crown,
  Target
} from "lucide-react";
import ebayService from "../services/ebayService";
import promotionService from "../services/promotionService";
import { useAuth } from "../context/AuthContext";
import PromotedItemCard from "../components/PromotedItemCard";
import PromotionFilterTabs from "../components/PromotionFilterTabs";

export default function Trending() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  // Fetch promoted trending feed
  const { data: promotedData, status: promotedStatus, error: promotedError } = useQuery({
    queryKey: ["promoted-trending", activeTab, selectedCategory],
    queryFn: async () => {
      try {
        const feed = await promotionService.getTrendingFeed(selectedCategory, 20);
        return feed;
      } catch (error) {
        console.error('Error fetching promoted trending:', error);
        return { items: [], total: 0 };
      }
    },
    enabled: !!user,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // Fetch organic trending as fallback
  const { data: organicData, status: organicStatus } = useQuery({
    queryKey: ["organic-trending", selectedCategory],
    queryFn: async () => {
      try {
        const trendingItems = await ebayService.getTrendingItems(selectedCategory, 20);
        return {
          trendingAuctions: trendingItems.items || [],
          trendingCategories: trendingItems.categories || []
        };
      } catch (error) {
        console.error('Error fetching organic trending:', error);
        return {
          trendingAuctions: [],
          trendingCategories: []
        };
      }
    },
    enabled: !!user && (activeTab === 'organic' || activeTab === 'all'),
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // Get promotion packages for quick promotion
  const { data: packages } = useQuery({
    queryKey: ["promotion-packages"],
    queryFn: () => promotionService.getPackages(),
    enabled: !!user,
  });

  // Combine data based on active tab
  const getDisplayData = () => {
    if (activeTab === 'all') {
      // Mix promoted and organic content
      const promotedItems = promotedData?.items || [];
      const organicItems = organicData?.trendingAuctions || [];
      
      // Interleave items: 2 promoted, 1 organic, repeat
      const mixedItems = [];
      let promotedIndex = 0;
      let organicIndex = 0;
      
      while (promotedIndex < promotedItems.length || organicIndex < organicItems.length) {
        // Add 2 promoted items
        if (promotedIndex < promotedItems.length) {
          mixedItems.push({ ...promotedItems[promotedIndex], isPromoted: true });
          promotedIndex++;
        }
        if (promotedIndex < promotedItems.length) {
          mixedItems.push({ ...promotedItems[promotedIndex], isPromoted: true });
          promotedIndex++;
        }
        
        // Add 1 organic item
        if (organicIndex < organicItems.length) {
          mixedItems.push({ ...organicItems[organicIndex], isPromoted: false });
          organicIndex++;
        }
      }
      
      return mixedItems;
    } else if (activeTab === 'organic') {
      return (organicData?.trendingAuctions || []).map(item => ({ ...item, isPromoted: false }));
    } else {
      // Featured, promoted, etc.
      return (promotedData?.items || []).map(item => ({ ...item, isPromoted: true }));
    }
  };

  const displayData = getDisplayData();
  const isLoading = promotedStatus === 'loading' || organicStatus === 'loading';
  const error = promotedError || organicData?.error;

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <div className="mb-8">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-4">
                🔥 Trending - Promote Your Listings
              </h1>
              <p className="text-gray-400 text-lg">
                Discover promoted items and trending auctions. Login to see the promotion-powered feed!
              </p>
            </div>
            <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-xl p-8 border border-purple-500/30">
              <h2 className="text-2xl font-bold mb-4">Join the Promotion Revolution!</h2>
              <p className="text-gray-300 mb-6">
                Promote your listings and get maximum visibility. Our AI-powered promotion system 
                helps your items reach the right audience at the right time.
              </p>
              <Link 
                to="/login" 
                className="inline-flex items-center space-x-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105"
              >
                <Zap className="h-5 w-5" />
                <span>Login to Get Started</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent mx-auto mb-4"></div>
            <p className="text-gray-400">Loading promoted trending feed...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        <div className="container mx-auto px-4 py-8">
          <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-6 text-center">
            <h2 className="text-xl font-bold text-red-400 mb-2">Error Loading Trending Feed</h2>
            <p className="text-gray-400">{String(error)}</p>
          </div>
        </div>
      </div>
    );
  }

  // Calculate stats for filter tabs
  const stats = {
    featured: displayData.filter(item => item.isPromoted && item.promotionType === 'featured').length,
    promoted: displayData.filter(item => item.isPromoted && item.promotionType === 'promoted').length,
    totalImpressions: displayData.reduce((sum, item) => sum + (item.promotionMetrics?.impressions || 0), 0),
    totalClicks: displayData.reduce((sum, item) => sum + (item.promotionMetrics?.clicks || 0), 0)
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-4">
            🔥 Trending - Promote Your Listings
          </h1>
          <p className="text-gray-400 text-lg mb-6">
            Discover promoted items and trending auctions. Mix of premium promotions and organic content.
          </p>
          
          {/* Quick Promote Button */}
          <Link
            to="/promote"
            className="inline-flex items-center space-x-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 mb-6"
          >
            <Plus className="h-5 w-5" />
            <span>Promote Your Listing</span>
          </Link>

          {/* Category Chips */}
          <div className="flex flex-wrap justify-center gap-2 mb-6">
            {['all', 'electronics', 'fashion', 'home', 'automotive', 'sports'].map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                  selectedCategory === category
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Promotion Filter Tabs */}
        <PromotionFilterTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          stats={stats}
        />

        {/* Feed Grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
        >
          {displayData.length > 0 ? (
            displayData.map((item, index) => (
              <PromotedItemCard
                key={`${item._id || item.id}-${index}`}
                item={item}
                index={index}
                isPromoted={item.isPromoted}
              />
            ))
          ) : (
            <div className="col-span-full text-center py-12">
              <div className="bg-gray-800 rounded-xl p-8 border border-gray-700">
                <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-300 mb-2">No Trending Items</h3>
                <p className="text-gray-400 mb-6">
                  {activeTab === 'all' 
                    ? "No promoted or trending items available right now."
                    : `No ${activeTab} items available right now.`
                  }
                </p>
                <Link
                  to="/promote"
                  className="inline-flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>Be the First to Promote</span>
                </Link>
              </div>
            </div>
          )}
        </motion.div>

        {/* Load More Button */}
        {displayData.length >= 20 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-center mt-8"
          >
            <button className="bg-gray-800 hover:bg-gray-700 text-white font-medium py-3 px-6 rounded-lg border border-gray-600 transition-colors">
              Load More Items
            </button>
          </motion.div>
        )}

        {/* Promotion Stats Footer */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-12 bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-xl p-6 border border-purple-500/30"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <div className="flex items-center justify-center space-x-3">
              <Eye className="h-6 w-6 text-purple-400" />
              <div>
                <div className="text-2xl font-bold text-white">{stats.totalImpressions.toLocaleString()}</div>
                <div className="text-sm text-gray-400">Total Impressions</div>
              </div>
            </div>
            <div className="flex items-center justify-center space-x-3">
              <MousePointer className="h-6 w-6 text-purple-400" />
              <div>
                <div className="text-2xl font-bold text-white">{stats.totalClicks}</div>
                <div className="text-sm text-gray-400">Total Clicks</div>
              </div>
            </div>
            <div className="flex items-center justify-center space-x-3">
              <Star className="h-6 w-6 text-purple-400" />
              <div>
                <div className="text-2xl font-bold text-white">{displayData.filter(item => item.isPromoted).length}</div>
                <div className="text-sm text-gray-400">Promoted Items</div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

