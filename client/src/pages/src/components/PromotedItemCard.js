import React from 'react';
import { motion } from 'framer-motion';
import { 
  Star, 
  TrendingUp, 
  Eye, 
  MousePointer, 
  Users, 
  Clock,
  Award,
  Zap,
  Crown,
  Target
} from 'lucide-react';
import { Link } from 'react-router-dom';

const PromotedItemCard = ({ item, index, isPromoted = false }) => {
  const getPromotionBadge = (type) => {
    const badges = {
      featured: {
        icon: Crown,
        color: 'from-yellow-400 to-orange-500',
        text: 'FEATURED',
        textColor: 'text-yellow-900'
      },
      promoted: {
        icon: Star,
        color: 'from-purple-500 to-pink-500',
        text: 'PROMOTED',
        textColor: 'text-purple-900'
      },
      sponsored: {
        icon: Target,
        color: 'from-green-500 to-emerald-500',
        text: 'SPONSORED',
        textColor: 'text-green-900'
      },
      trending: {
        icon: TrendingUp,
        color: 'from-orange-500 to-red-500',
        text: 'TRENDING',
        textColor: 'text-orange-900'
      }
    };

    return badges[type] || badges.promoted;
  };

  const promotionBadge = isPromoted ? getPromotionBadge(item.promotionType) : null;

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`card group relative overflow-hidden ${
        isPromoted ? 'ring-2 ring-purple-500/20 bg-gradient-to-br from-purple-50/10 to-pink-50/10' : ''
      }`}
    >
      {/* Promotion Badge */}
      {isPromoted && promotionBadge && (
        <div className={`absolute top-2 left-2 z-10 bg-gradient-to-r ${promotionBadge.color} text-white px-2 py-1 rounded-full text-xs font-bold flex items-center space-x-1 shadow-lg`}>
          <promotionBadge.icon className="h-3 w-3" />
          <span>{promotionBadge.text}</span>
        </div>
      )}

      {/* Performance Indicator */}
      {isPromoted && item.promotionMetrics && (
        <div className="absolute top-2 right-2 z-10 bg-black/50 backdrop-blur-sm text-white px-2 py-1 rounded-full text-xs">
          <div className="flex items-center space-x-1">
            <Eye className="h-3 w-3" />
            <span>{item.promotionMetrics.impressions?.toLocaleString() || 0}</span>
          </div>
        </div>
      )}

      {/* Image */}
      <div className="thumb relative">
        <img 
          src={item.images?.[0]?.url || "https://via.placeholder.com/400x300/1f2937/8b5cf6?text=Product"} 
          alt={item.images?.[0]?.alt || item.title} 
          loading="lazy" 
          className={`transition-transform duration-300 group-hover:scale-105 ${
            isPromoted ? 'ring-2 ring-purple-500/30' : ''
          }`}
          onError={(e) => {
            e.target.src = "https://via.placeholder.com/400x300/1f2937/8b5cf6?text=Product";
          }}
        />
        
        {/* Platform Badge */}
        <span className={`chip ${isPromoted ? 'bg-purple-600 text-white' : ''}`}>
          {item.listingType === 'ebay' ? 'eBay' : item.listingType}
        </span>

        {/* Promotion Glow Effect */}
        {isPromoted && (
          <div className="absolute inset-0 bg-gradient-to-t from-purple-500/20 to-transparent pointer-events-none" />
        )}
      </div>

      {/* Content */}
      <div className="meta">
        <h3 className="title group-hover:text-purple-400 transition-colors">
          {item.title}
        </h3>
        
        <div className="row">
          <span className="price text-purple-400 font-bold">
            ${item.currentBid || item.startingPrice || item.price}
          </span>
          <span className="end">
            {item.timeRemaining ? `Ends ${item.timeRemaining}` : 'Available'}
          </span>
        </div>

        {/* Promotion Metrics */}
        {isPromoted && item.promotionMetrics && (
          <div className="promotion-metrics mt-2 p-2 bg-purple-500/10 rounded-lg">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center space-x-1 text-purple-400">
                <Eye className="h-3 w-3" />
                <span>{item.promotionMetrics.impressions?.toLocaleString() || 0}</span>
              </div>
              <div className="flex items-center space-x-1 text-purple-400">
                <MousePointer className="h-3 w-3" />
                <span>{item.promotionMetrics.clicks || 0}</span>
              </div>
            </div>
            {item.promotionMetrics.ctr > 0 && (
              <div className="mt-1 text-xs text-purple-500">
                CTR: {(item.promotionMetrics.ctr * 100).toFixed(1)}%
              </div>
            )}
          </div>
        )}

        {/* AI Scores */}
        {item.aiScore && (
          <div className="ai-scores mt-2">
            <span className="score bg-gradient-to-r from-orange-500 to-red-500 text-white">
              🔥 {item.aiScore.trendingScore || 0}
            </span>
            <span className="score bg-gradient-to-r from-blue-500 to-purple-500 text-white">
              💎 {item.aiScore.dealPotential || 0}
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="actions">
        <Link 
          className={`btn ${isPromoted ? 'btn-primary bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700' : 'btn-primary'}`}
          to={`/auction/${item._id || item.id}`}
        >
          {isPromoted ? (
            <div className="flex items-center space-x-2">
              <Zap className="h-4 w-4" />
              <span>View Promoted Item</span>
            </div>
          ) : (
            'View Auction'
          )}
        </Link>
      </div>

      {/* Promotion Attribution */}
      {isPromoted && item.user && (
        <div className="absolute bottom-2 left-2 text-xs text-gray-400 bg-black/50 backdrop-blur-sm px-2 py-1 rounded">
          Promoted by {item.user.username}
        </div>
      )}
    </motion.article>
  );
};

export default PromotedItemCard;







