import React from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  Star, 
  Target, 
  Zap,
  Filter,
  Eye,
  MousePointer,
  Users
} from 'lucide-react';

const PromotionFilterTabs = ({ activeTab, onTabChange, stats = {} }) => {
  const tabs = [
    {
      id: 'all',
      label: 'All Items',
      icon: TrendingUp,
      color: 'from-gray-500 to-gray-600',
      description: 'Mix of promoted and organic content'
    },
    {
      id: 'featured',
      label: 'Featured',
      icon: Star,
      color: 'from-yellow-400 to-orange-500',
      description: 'Premium top placements',
      badge: stats.featured || 0
    },
    {
      id: 'promoted',
      label: 'Promoted',
      icon: Target,
      color: 'from-purple-500 to-pink-500',
      description: 'Enhanced visibility',
      badge: stats.promoted || 0
    },
    {
      id: 'organic',
      label: 'Trending',
      icon: Zap,
      color: 'from-orange-500 to-red-500',
      description: 'Algorithm-based trending'
    }
  ];

  return (
    <div className="promotion-filter-tabs mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Filter className="h-5 w-5 text-purple-400" />
          <h3 className="text-lg font-semibold text-white">Filter by Promotion Type</h3>
        </div>
        
        {/* Quick Stats */}
        <div className="flex items-center space-x-4 text-sm text-gray-400">
          <div className="flex items-center space-x-1">
            <Eye className="h-4 w-4" />
            <span>{stats.totalImpressions?.toLocaleString() || 0} views</span>
          </div>
          <div className="flex items-center space-x-1">
            <MousePointer className="h-4 w-4" />
            <span>{stats.totalClicks || 0} clicks</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <motion.button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`relative p-4 rounded-lg border-2 transition-all duration-300 ${
                isActive 
                  ? `border-purple-500 bg-gradient-to-r ${tab.color} bg-opacity-20` 
                  : 'border-gray-600 bg-gray-800 hover:border-gray-500'
              }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${
                  isActive 
                    ? 'bg-white bg-opacity-20' 
                    : 'bg-gray-700'
                }`}>
                  <Icon className={`h-5 w-5 ${
                    isActive ? 'text-white' : 'text-gray-400'
                  }`} />
                </div>
                
                <div className="flex-1 text-left">
                  <div className="flex items-center space-x-2">
                    <span className={`font-medium ${
                      isActive ? 'text-white' : 'text-gray-300'
                    }`}>
                      {tab.label}
                    </span>
                    {tab.badge !== undefined && (
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        isActive 
                          ? 'bg-white bg-opacity-30 text-white' 
                          : 'bg-purple-600 text-white'
                      }`}>
                        {tab.badge}
                      </span>
                    )}
                  </div>
                  <p className={`text-xs mt-1 ${
                    isActive ? 'text-white text-opacity-80' : 'text-gray-500'
                  }`}>
                    {tab.description}
                  </p>
                </div>
              </div>

              {/* Active Indicator */}
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-gradient-to-r opacity-10 rounded-lg"
                  style={{ background: `linear-gradient(to right, var(--tw-gradient-stops))` }}
                  initial={false}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Tab Description */}
      <div className="mt-4 p-4 bg-gray-800 rounded-lg border border-gray-700">
        <div className="flex items-start space-x-3">
          <div className="p-2 bg-purple-600 rounded-lg">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-white mb-1">
              {tabs.find(t => t.id === activeTab)?.label} Content
            </h4>
            <p className="text-xs text-gray-400">
              {activeTab === 'all' && 'Discover a mix of promoted listings and organic trending items, carefully curated for maximum relevance and quality.'}
              {activeTab === 'featured' && 'Premium listings with top placement and maximum visibility. These items have invested in featured promotion packages.'}
              {activeTab === 'promoted' && 'Enhanced listings with improved visibility and engagement. These items use various promotion packages for better reach.'}
              {activeTab === 'organic' && 'Algorithm-based trending items based on popularity, engagement, and user behavior patterns.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromotionFilterTabs;







