import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, Users, TrendingUp, Zap, Award, Share2, Loader2 } from 'lucide-react';
import ebayService from '../services/ebayService';

const AuctionDetail = () => {
  const { id } = useParams();
  const [auction, setAuction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAuctionDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await ebayService.getItemDetails(id);
        setAuction(data);
      } catch (err) {
        console.error('Error fetching auction details:', err);
        setError('Failed to load auction details. Please try again.');
        setAuction(null);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchAuctionDetails();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 pt-20 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
          <span className="text-gray-400">Loading auction details...</span>
        </div>
      </div>
    );
  }

  if (error || !auction) {
    return (
      <div className="min-h-screen bg-gray-900 pt-20 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-lg mb-4">{error || 'Auction not found'}</p>
          <button 
            onClick={() => window.history.back()}
            className="btn-primary"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const formatTimeRemaining = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <div className="min-h-screen bg-gray-900 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Image */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="relative">
              <img
                src={auction.image || 'https://picsum.photos/400/300?random=1'}
                alt={auction.title || 'Auction Item'}
                className="w-full h-96 object-cover rounded-xl"
              />
              <div className="absolute top-4 left-4 bg-black/70 text-white px-3 py-1 rounded-lg text-sm font-medium">
                eBay
              </div>
              <div className="absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded-lg text-sm font-medium flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {formatTimeRemaining(auction.timeRemaining || 0)}
              </div>
            </div>
          </motion.div>

          {/* Details */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-6"
          >
            {/* Title and AI Scores */}
            <div>
              <h1 className="text-3xl font-bold text-white mb-4">{auction.title || 'Auction Item'}</h1>
              
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-2 bg-green-500/20 px-3 py-1 rounded-lg">
                  <TrendingUp className="w-4 h-4 text-green-400" />
                  <span className="text-green-400 font-medium">{auction.dealPotential || 0}% Deal Potential</span>
                </div>
                <div className="flex items-center gap-2 bg-blue-500/20 px-3 py-1 rounded-lg">
                  <Zap className="w-4 h-4 text-blue-400" />
                  <span className="text-blue-400 font-medium">{auction.competitionLevel || 'Low'} Competition</span>
                </div>
                <div className="flex items-center gap-2 bg-purple-500/20 px-3 py-1 rounded-lg">
                  <Award className="w-4 h-4 text-purple-400" />
                  <span className="text-purple-400 font-medium">{auction.trendingScore || 0}% Trending</span>
                </div>
              </div>
            </div>

            {/* Price */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-3xl font-bold text-white">${auction.currentBid || '0.00'}</div>
                  <div className="text-gray-400">Current Bid</div>
                </div>
                <div className="text-right">
                  <div className="text-lg text-gray-400">Starting: ${auction.startingPrice || '0.00'}</div>
                  <div className="text-sm text-gray-500">{auction.bidCount || 0} bids</div>
                </div>
              </div>
              
              <div className="space-y-3">
                <input
                  type="number"
                  placeholder="Enter your bid"
                  className="input-primary w-full"
                />
                <button className="btn-primary w-full">
                  Place Bid
                </button>
              </div>
            </div>

            {/* Description */}
            <div className="card">
              <h3 className="text-lg font-semibold text-white mb-3">Description</h3>
              <p className="text-gray-300">{auction.description || 'No description available.'}</p>
            </div>

            {/* Seller */}
            <div className="card">
              <h3 className="text-lg font-semibold text-white mb-3">Seller</h3>
              <div className="flex items-center gap-3">
                <img
                  src={auction.seller?.profileImage || 'https://picsum.photos/100/100?random=999'}
                  alt={auction.seller?.username || 'eBay Seller'}
                  className="w-10 h-10 rounded-full"
                />
                <div>
                  <div className="text-white font-medium">{auction.seller?.username || 'eBay Seller'}</div>
                  <div className="text-gray-400 text-sm">Verified Seller</div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4">
              <button className="btn-secondary flex-1 flex items-center justify-center gap-2">
                <Users className="w-4 h-4" />
                Watch
              </button>
              <button className="btn-secondary flex-1 flex items-center justify-center gap-2">
                <Share2 className="w-4 h-4" />
                Share
              </button>
            </div>
          </motion.div>
        </div>

        {/* Bidding History */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-8"
        >
          <div className="card">
            <h3 className="text-lg font-semibold text-white mb-4">Bidding History</h3>
            <div className="space-y-3">
              {auction.bids && auction.bids.length > 0 ? (
                auction.bids.map((bid, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-medium">{index + 1}</span>
                      </div>
                      <div>
                        <div className="text-white font-medium">{bid.bidder}</div>
                        <div className="text-gray-400 text-sm">{bid.timestamp.toLocaleTimeString()}</div>
                      </div>
                    </div>
                    <div className="text-xl font-bold text-white">${bid.amount}</div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No bids yet. Be the first to bid!</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AuctionDetail;


































