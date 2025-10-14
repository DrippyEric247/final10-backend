import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Clock, Filter, Search, Zap, TrendingUp, Award, Loader2 } from 'lucide-react';
import ebayService from '../services/ebayService';
import { useAuth } from '../context/AuthContext';

const Auctions = () => {
  const { user } = useAuth();
  const [filters, setFilters] = useState({
    category: '',
    minPrice: '',
    maxPrice: '',
    timeRemaining: '',
    sortBy: 'endTime',
    sortOrder: 'asc',
    search: ''
  });
  
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    current: 1,
    pages: 1,
    total: 0,
    limit: 20
  });
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch auctions from API
  const fetchAuctions = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      setError(null);
      
      const queryFilters = {
        ...filters,
        page,
        limit: 20
      };
      
      // Remove empty filters to avoid API issues
      Object.keys(queryFilters).forEach(key => {
        if (queryFilters[key] === '' || queryFilters[key] === null || queryFilters[key] === undefined) {
          delete queryFilters[key];
        }
      });
      
      console.log('Fetching auctions with filters:', queryFilters);
      console.log('OAuth token present:', !!localStorage.getItem('f10_token'));
      
      const response = await ebayService.searchItems(queryFilters);
      console.log('Auctions response:', response);
      
      setAuctions(response.items || []);
      setPagination(response.pagination || { current: page, pages: 1, total: 0, limit: 20 });
      setCurrentPage(page);
    } catch (err) {
      console.error('Error fetching auctions:', err);
      console.error('Error details:', {
        message: err.message,
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data,
        config: {
          url: err.config?.url,
          method: err.config?.method,
          headers: err.config?.headers
        }
      });
      
      let errorMessage = 'Failed to load auctions. Please try again.';
      
      if (err.response?.status === 500) {
        errorMessage = 'Server error (500). Please check if the backend is running and eBay API is configured.';
      } else if (err.response?.status === 401) {
        errorMessage = 'Authentication failed. Please log in again.';
      } else if (err.response?.status === 403) {
        errorMessage = 'Access denied. Check your OAuth permissions.';
      } else if (err.response?.status === 429) {
        errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
      } else if (err.response?.status === 404) {
        errorMessage = 'API endpoint not found. Please check backend configuration.';
      }
      
      setError(errorMessage);
      setAuctions([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Load auctions on component mount and when filters change
  useEffect(() => {
    fetchAuctions(1);
  }, [fetchAuctions]);

  // Handle filter changes
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Handle live search (this will complete the search task)
  const handleLiveSearch = async (searchTerm) => {
    if (!searchTerm.trim() || !user) return;
    
    try {
      setLoading(true);
      // This will call the eBay search API which automatically completes the search task
      const response = await ebayService.searchItems({ 
        keywords: searchTerm, 
        limit: 20,
        page: 1
      });
      
      console.log('Live search results:', response);
      // Update the auctions with search results
      setAuctions(response.items || []);
      setPagination(response.pagination || { current: 1, pages: 1, total: 0, limit: 20 });
      setCurrentPage(1);
    } catch (error) {
      console.error('Live search error:', error);
      setError('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatTimeRemaining = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const getCompetitionColor = (level) => {
    switch (level) {
      case 'low': return 'text-green-400';
      case 'medium': return 'text-yellow-400';
      case 'high': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getDealPotentialColor = (score) => {
    if (score >= 90) return 'text-green-400';
    if (score >= 70) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="min-h-screen bg-gray-900 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8"
        >
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Live <span className="text-gradient">Auctions</span>
          </h1>
          <p className="text-gray-400 text-lg">
            AI-curated auctions ending in 10 minutes or less
          </p>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="card mb-8"
        >
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <span className="text-white font-medium">Filters:</span>
            </div>
            
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                name="search"
                id="auction-search"
                placeholder="Search auctions... (Press Enter for live search)"
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleLiveSearch(filters.search);
                  }
                }}
                className="input-primary pl-10"
              />
            </div>
            
            <select
              value={filters.category}
              onChange={(e) => handleFilterChange('category', e.target.value)}
              className="input-primary"
            >
              <option value="">All Categories</option>
              <option value="electronics">Electronics</option>
              <option value="fashion">Fashion</option>
              <option value="home">Home</option>
              <option value="sports">Sports</option>
              <option value="collectibles">Collectibles</option>
              <option value="automotive">Automotive</option>
            </select>

            <input
              type="number"
              name="minPrice"
              id="min-price"
              placeholder="Min Price"
              value={filters.minPrice}
              onChange={(e) => handleFilterChange('minPrice', e.target.value)}
              className="input-primary w-24"
            />

            <input
              type="number"
              name="maxPrice"
              id="max-price"
              placeholder="Max Price"
              value={filters.maxPrice}
              onChange={(e) => handleFilterChange('maxPrice', e.target.value)}
              className="input-primary w-24"
            />

            <select
              value={filters.timeRemaining}
              onChange={(e) => handleFilterChange('timeRemaining', e.target.value)}
              className="input-primary"
            >
              <option value="">Any Time</option>
              <option value="5">5 minutes or less</option>
              <option value="10">10 minutes or less</option>
              <option value="30">30 minutes or less</option>
            </select>

            <select
              value={filters.sortBy}
              onChange={(e) => handleFilterChange('sortBy', e.target.value)}
              className="input-primary"
            >
              <option value="endTime">Ending Soon</option>
              <option value="dealPotential">Best Deals</option>
              <option value="trending">Most Trending</option>
              <option value="price">Price</option>
            </select>
          </div>
        </motion.div>

        {/* Loading State */}
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-center py-12"
          >
            <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
            <span className="ml-2 text-gray-400">Loading auctions...</span>
          </motion.div>
        )}

        {/* Error State */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="card bg-red-900/20 border-red-500/50 mb-8"
          >
            <p className="text-red-400">{error}</p>
            <button 
              onClick={() => fetchAuctions(currentPage)}
              className="btn-primary mt-4"
            >
              Try Again
            </button>
          </motion.div>
        )}

        {/* Auctions Grid */}
        {!loading && !error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {auctions.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <p className="text-gray-400 text-lg">No auctions found matching your criteria.</p>
                <button 
                  onClick={() => setFilters({
                    category: '',
                    minPrice: '',
                    maxPrice: '',
                    timeRemaining: '',
                    sortBy: 'endTime',
                    sortOrder: 'asc',
                    search: ''
                  })}
                  className="btn-primary mt-4"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              auctions.map((auction, index) => (
                <motion.div
                  key={`auction-${auction._id || auction.id || index}-${index}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  className="card-hover group cursor-pointer"
                  onClick={() => window.location.href = `/auction/${auction._id}`}
                >
                  {/* Image */}
                  <div className="relative mb-4">
                    <img
                      src={auction.images?.[0]?.url || 'https://via.placeholder.com/300x200/1f2937/8b5cf6?text=Product'}
                      alt={auction.images?.[0]?.alt || auction.title}
                      className="w-full h-48 object-cover rounded-lg"
                      onError={(e) => {
                        e.target.src = 'https://via.placeholder.com/300x200/1f2937/8b5cf6?text=Product';
                      }}
                    />
                    <div className="absolute top-3 left-3 bg-black/70 text-white px-2 py-1 rounded text-sm font-medium">
                      eBay
                    </div>
                    <div className="absolute top-3 right-3 bg-red-500 text-white px-2 py-1 rounded text-sm font-medium flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTimeRemaining(auction.timeRemaining || 0)}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-white group-hover:text-purple-400 transition-colors line-clamp-2">
                      {auction.title}
                    </h3>

                    {/* AI Scores */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <TrendingUp className="w-4 h-4 text-purple-400" />
                          <span className={`text-sm font-medium ${getDealPotentialColor(auction.aiScore?.dealPotential || 0)}`}>
                            {auction.aiScore?.dealPotential || 0}%
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Zap className="w-4 h-4 text-yellow-400" />
                          <span className={`text-sm font-medium ${getCompetitionColor(auction.aiScore?.competitionLevel || 'medium')}`}>
                            {auction.aiScore?.competitionLevel || 'medium'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Award className="w-4 h-4 text-blue-400" />
                        <span className="text-sm font-medium text-blue-400">
                          {auction.aiScore?.trendingScore || 0}%
                        </span>
                      </div>
                    </div>

                    {/* Price and Bids */}
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-2xl font-bold text-white">
                          ${auction.currentBid || auction.startingPrice}
                        </div>
                        <div className="text-sm text-gray-400">
                          {auction.bidCount || 0} bids
                        </div>
                      </div>
                      <button 
                        className="btn-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Handle bid placement
                        }}
                      >
                        Place Bid
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </motion.div>
        )}

        {/* Pagination */}
        {!loading && !error && auctions.length > 0 && pagination.pages > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex items-center justify-center gap-4 mt-8"
          >
            <button 
              onClick={() => fetchAuctions(currentPage - 1)}
              disabled={currentPage <= 1}
              className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            
            <div className="flex items-center gap-2">
              {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                const pageNum = Math.max(1, Math.min(pagination.pages - 4, currentPage - 2)) + i;
                if (pageNum > pagination.pages) return null;
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => fetchAuctions(pageNum)}
                    className={`px-3 py-2 rounded ${
                      pageNum === currentPage 
                        ? 'bg-purple-600 text-white' 
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            
            <button 
              onClick={() => fetchAuctions(currentPage + 1)}
              disabled={currentPage >= pagination.pages}
              className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </motion.div>
        )}

        {/* Results Summary */}
        {!loading && !error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="text-center mt-4"
          >
            <p className="text-gray-400">
              Showing {auctions.length} of {pagination.total} auctions
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Auctions;






























