import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { 
  MapPin, 
  Clock, 
  DollarSign, 
  Truck, 
  Users, 
  Zap,
  Search,
  Filter,
  Star,
  TrendingUp,
  ShoppingCart
} from 'lucide-react';
import ebayService from '../services/ebayService';
import { trackLocalDealsSearch } from '../lib/api';

const LocalDeals = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchRadius, setSearchRadius] = useState(25);
  const [activeTab, setActiveTab] = useState('search');

  const categories = [
    { id: 'all', name: 'All Deals', icon: '🛍️' },
    { id: 'electronics', name: 'Electronics', icon: '📱' },
    { id: 'furniture', name: 'Furniture', icon: '🪑' },
    { id: 'vehicles', name: 'Vehicles', icon: '🚗' },
    { id: 'fashion', name: 'Fashion', icon: '👕' },
    { id: 'tools', name: 'Tools', icon: '🔧' },
    { id: 'toys', name: 'Toys', icon: '🧸' },
    { id: 'books', name: 'Books', icon: '📚' }
  ];

  // Search eBay deals query
  const { 
    data: searchResults, 
    isLoading: searchLoading, 
    error: searchError,
    refetch: refetchSearch
  } = useQuery({
    queryKey: ['ebaySearch', searchTerm, searchRadius],
    queryFn: () => ebayService.searchItems({ keywords: searchTerm, limit: 15 }),
    enabled: false, // Only run when manually triggered
    retry: 1
  });

  // Trending eBay deals query
  const { 
    data: trendingData, 
    isLoading: trendingLoading, 
    error: trendingError 
  } = useQuery({
    queryKey: ['trendingEbay', selectedCategory],
    queryFn: () => ebayService.getTrendingItems(selectedCategory, 20),
    enabled: activeTab === 'trending'
  });

  // Category deals query
  const { 
    data: categoryData, 
    isLoading: categoryLoading, 
    error: categoryError 
  } = useQuery({
    queryKey: ['ebayCategory', selectedCategory],
    queryFn: () => ebayService.searchItems({ categoryId: selectedCategory, limit: 15 }),
    enabled: activeTab === 'category' && selectedCategory !== 'all'
  });

  const handleSearch = () => {
    if (searchTerm.trim()) {
      // Track daily task completion
      trackLocalDealsSearch(searchTerm);
      refetchSearch();
      setActiveTab('search');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  };


  const getDealScoreColor = (score) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getDealScoreBg = (score) => {
    if (score >= 80) return 'bg-green-500/20 border-green-500/30';
    if (score >= 60) return 'bg-yellow-500/20 border-yellow-500/30';
    return 'bg-red-500/20 border-red-500/30';
  };

  const renderDealCard = (deal, index) => (
    <motion.div
      key={`${deal.platform}-${deal.title}-${index}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-purple-500/50 transition-all duration-300 group"
    >
      <div className="flex gap-4">
        {/* Image */}
        <div className="flex-shrink-0">
          <img
            src={deal.image || deal.imageUrl}
            alt={deal.title}
            className="w-24 h-24 object-cover rounded-lg"
            onError={(e) => {
              e.target.src = 'https://via.placeholder.com/96x96?text=eBay+Item';
            }}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-lg font-semibold text-white group-hover:text-purple-300 transition-colors line-clamp-2">
              {deal.title}
            </h3>
            <div className={`px-3 py-1 rounded-full text-sm font-medium border ${getDealScoreBg(deal.aiScore?.dealPotential || deal.dealPotential || 70)} ${getDealScoreColor(deal.aiScore?.dealPotential || deal.dealPotential || 70)}`}>
              {deal.aiScore?.dealPotential || deal.dealPotential || 70}/100
            </div>
          </div>

          <div className="flex items-center gap-4 mb-3">
            <div className="flex items-center gap-1 text-green-400">
              <DollarSign className="h-4 w-4" />
              <span className="font-semibold">{formatPrice(deal.currentBid)}</span>
            </div>
            <div className="flex items-center gap-1 text-blue-400">
              <MapPin className="h-4 w-4" />
              <span className="text-sm">{deal.location || 'eBay'}</span>
            </div>
            <div className="flex items-center gap-1 text-purple-400">
              <Star className="h-4 w-4" />
              <span className="text-sm">eBay</span>
            </div>
          </div>

          {/* AI Scores */}
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full border border-green-500/30">
              🔥 {deal.aiScore?.trendingScore || deal.trendingScore || 0}% Trending
            </span>
            <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full border border-blue-500/30">
              ⚡ {deal.aiScore?.competitionLevel || deal.competitionLevel || 'medium'} Competition
            </span>
            <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded-full border border-purple-500/30">
              💎 {deal.aiScore?.dealPotential || deal.dealPotential || 0}% Deal Potential
            </span>
          </div>

          {/* Time Remaining */}
          {deal.timeRemaining && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-3">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-red-400" />
                <span className="text-sm font-medium text-red-400">Time Remaining</span>
              </div>
              <div className="text-sm text-gray-300">
                {Math.floor(deal.timeRemaining / 60)}m {deal.timeRemaining % 60}s
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <a
              href={deal.itemUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <ShoppingCart className="h-4 w-4" />
              View on eBay
            </a>
            <button className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
              <Users className="h-4 w-4" />
              {deal.bidCount || 0} Bids
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-gray-900 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-extrabold text-white mb-4">
            🏠 Local Deals Advantage
          </h1>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            Find amazing local deals with no shipping costs, instant pickup, and cash negotiation opportunities
          </p>
        </motion.div>

        {/* Search Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="bg-gray-800 rounded-xl p-6 mb-8 border border-gray-700"
        >
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search for local deals (iPhone, furniture, tools...)"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <select
                value={searchRadius}
                onChange={(e) => setSearchRadius(Number(e.target.value))}
                className="px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value={10}>10 miles</option>
                <option value={25}>25 miles</option>
                <option value={50}>50 miles</option>
                <option value={100}>100 miles</option>
              </select>
              <button
                onClick={handleSearch}
                disabled={!searchTerm.trim() || searchLoading}
                className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                {searchLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Search
              </button>
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex gap-2 mb-8"
        >
          <button
            onClick={() => setActiveTab('trending')}
            className={`px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'trending'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            <TrendingUp className="h-4 w-4" />
            Trending Deals
          </button>
          <button
            onClick={() => setActiveTab('category')}
            className={`px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'category'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            <Filter className="h-4 w-4" />
            By Category
          </button>
        </motion.div>

        {/* Category Filter */}
        {activeTab === 'category' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mb-8"
          >
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                    selectedCategory === category.id
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  <span>{category.icon}</span>
                  {category.name}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Local Advantages Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="bg-gradient-to-r from-green-600/20 to-blue-600/20 rounded-xl p-6 mb-8 border border-green-500/30"
        >
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-green-400" />
            Local Deals Advantages
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-center gap-3">
              <Truck className="h-5 w-5 text-green-400" />
              <div>
                <div className="text-white font-medium">No Shipping</div>
                <div className="text-gray-400 text-sm">Save on shipping costs</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-blue-400" />
              <div>
                <div className="text-white font-medium">Instant Pickup</div>
                <div className="text-gray-400 text-sm">Get items same day</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-purple-400" />
              <div>
                <div className="text-white font-medium">Cash Negotiation</div>
                <div className="text-gray-400 text-sm">Negotiate better prices</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-yellow-400" />
              <div>
                <div className="text-white font-medium">Local Support</div>
                <div className="text-gray-400 text-sm">Support your community</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Results */}
        <div className="space-y-6">
          {/* Search Results */}
          {activeTab === 'search' && (
            <>
              {searchLoading && (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent mx-auto mb-4" />
                  <p className="text-gray-400">Searching local deals...</p>
                </div>
              )}

              {searchError && (
                <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-6 text-center">
                  <p className="text-red-400">Failed to search local deals. Please try again.</p>
                </div>
              )}

              {searchResults && (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-white">
                      Search Results for "{searchTerm}"
                    </h2>
                    <span className="text-gray-400">
                      {searchResults.items?.length || 0} eBay items found
                    </span>
                  </div>

                  {(!searchResults.items || searchResults.items.length === 0) ? (
                    <div className="text-center py-12">
                      <p className="text-gray-400 text-lg">No eBay items found for "{searchTerm}"</p>
                      <p className="text-gray-500 text-sm mt-2">Try a different search term</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {searchResults.items.map((deal, index) => renderDealCard(deal, index))}
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* Trending Results */}
          {activeTab === 'trending' && (
            <>
              {trendingLoading && (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent mx-auto mb-4" />
                  <p className="text-gray-400">Loading trending local deals...</p>
                </div>
              )}

              {trendingError && (
                <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-6 text-center">
                  <p className="text-red-400">Failed to load trending deals. Please try again.</p>
                </div>
              )}

              {trendingData && (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-white">Trending eBay Items</h2>
                    <span className="text-gray-400">
                      {trendingData.items?.length || 0} trending items
                    </span>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {trendingData.items?.map((deal, index) => renderDealCard(deal, index))}
                  </div>
                </>
              )}
            </>
          )}

          {/* Category Results */}
          {activeTab === 'category' && selectedCategory !== 'all' && (
            <>
              {categoryLoading && (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent mx-auto mb-4" />
                  <p className="text-gray-400">Loading {selectedCategory} deals...</p>
                </div>
              )}

              {categoryError && (
                <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-6 text-center">
                  <p className="text-red-400">Failed to load category deals. Please try again.</p>
                </div>
              )}

              {categoryData && (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-white capitalize">
                      {selectedCategory} eBay Items
                    </h2>
                    <span className="text-gray-400">
                      {categoryData.items?.length || 0} items found
                    </span>
                  </div>

                  {(!categoryData.items || categoryData.items.length === 0) ? (
                    <div className="text-center py-12">
                      <p className="text-gray-400 text-lg">No {selectedCategory} items found</p>
                      <p className="text-gray-500 text-sm mt-2">Try a different category or search term</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {categoryData.items.map((deal, index) => renderDealCard(deal, index))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default LocalDeals;
