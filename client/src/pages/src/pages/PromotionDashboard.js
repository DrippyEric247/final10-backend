import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { 
  TrendingUp,
  Eye,
  MousePointer,
  DollarSign,
  Clock,
  Play,
  Pause,
  X,
  Plus,
  BarChart3,
  Target,
  Star,
  AlertCircle,
  CheckCircle,
  Zap
} from 'lucide-react';
import { Link } from 'react-router-dom';
import promotionService from '../services/promotionService';
import { useAuth } from '../context/AuthContext';

const PromotionDashboard = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedPromotion, setSelectedPromotion] = useState(null);

  // Fetch user's promotions
  const { data: promotions, isLoading: promotionsLoading } = useQuery({
    queryKey: ['user-promotions'],
    queryFn: () => promotionService.getMyPromotions(),
    enabled: !!user
  });

  // Fetch analytics
  const { data: analytics } = useQuery({
    queryKey: ['promotion-analytics'],
    queryFn: () => promotionService.getAnalytics(),
    enabled: !!user
  });

  // Promotion control mutations
  const pauseMutation = useMutation({
    mutationFn: (promotionId) => promotionService.pausePromotion(promotionId),
    onSuccess: () => {
      queryClient.invalidateQueries(['user-promotions']);
    }
  });

  const resumeMutation = useMutation({
    mutationFn: (promotionId) => promotionService.resumePromotion(promotionId),
    onSuccess: () => {
      queryClient.invalidateQueries(['user-promotions']);
    }
  });

  const cancelMutation = useMutation({
    mutationFn: (promotionId) => promotionService.cancelPromotion(promotionId),
    onSuccess: () => {
      queryClient.invalidateQueries(['user-promotions']);
    }
  });

  const getStatusColor = (status) => {
    const colors = {
      active: 'text-green-400 bg-green-400/20',
      paused: 'text-orange-400 bg-orange-400/20',
      pending: 'text-yellow-400 bg-yellow-400/20',
      completed: 'text-blue-400 bg-blue-400/20',
      cancelled: 'text-red-400 bg-red-400/20'
    };
    return colors[status] || 'text-gray-400 bg-gray-400/20';
  };

  const getStatusIcon = (status) => {
    const icons = {
      active: CheckCircle,
      paused: Pause,
      pending: Clock,
      completed: CheckCircle,
      cancelled: X
    };
    return icons[status] || AlertCircle;
  };

  const formatDuration = (hours) => {
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
  };

  const calculateROI = (spent, revenue) => {
    if (!spent || spent === 0) return 0;
    return ((revenue - spent) / spent) * 100;
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Please login to view your promotions</h1>
          <Link 
            to="/login"
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg"
          >
            Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                Promotion Dashboard
              </h1>
              <p className="text-gray-400">Manage and track your listing promotions</p>
            </div>
            <Link
              to="/promote"
              className="inline-flex items-center space-x-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105"
            >
              <Plus className="h-5 w-5" />
              <span>Create Promotion</span>
            </Link>
          </div>

          {/* Quick Stats */}
          {analytics && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-purple-600 rounded-lg">
                    <TrendingUp className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">{analytics.promotionStats.totalPromotions}</div>
                    <div className="text-sm text-gray-400">Total Promotions</div>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-green-600 rounded-lg">
                    <CheckCircle className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">{analytics.promotionStats.activePromotions}</div>
                    <div className="text-sm text-gray-400">Active Promotions</div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-blue-600 rounded-lg">
                    <Eye className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">{analytics.promotionStats.totalImpressions?.toLocaleString() || 0}</div>
                    <div className="text-sm text-gray-400">Total Impressions</div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-orange-600 rounded-lg">
                    <MousePointer className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">{analytics.promotionStats.totalClicks || 0}</div>
                    <div className="text-sm text-gray-400">Total Clicks</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </motion.div>

        {/* Tabs */}
        <div className="flex space-x-1 mb-8 bg-gray-800 rounded-lg p-1">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'active', label: 'Active', icon: Play },
            { id: 'all', label: 'All Promotions', icon: Target }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-colors ${
                  activeTab === tab.id
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        {promotionsLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent mx-auto mb-4"></div>
            <p className="text-gray-400">Loading your promotions...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Active Promotions */}
            {activeTab === 'overview' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-xl font-bold mb-4 flex items-center space-x-2">
                    <Play className="h-5 w-5 text-green-400" />
                    <span>Active Promotions</span>
                  </h2>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {promotions?.promotions?.filter(p => p.status === 'active').map((promotion) => (
                      <div key={promotion._id} className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <div className={`p-2 rounded-lg ${getStatusColor(promotion.status)}`}>
                              {React.createElement(getStatusIcon(promotion.status), { className: "h-4 w-4" })}
                            </div>
                            <div>
                              <div className="font-semibold text-white">{promotion.promotionPackage?.name}</div>
                              <div className="text-sm text-gray-400">{promotion.listingType} • {promotion.targetCategory}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-white">${promotion.budget}</div>
                            <div className="text-sm text-gray-400">{formatDuration(promotion.duration)}</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 mb-4">
                          <div className="text-center">
                            <div className="text-lg font-bold text-purple-400">{promotion.metrics.impressions}</div>
                            <div className="text-xs text-gray-400">Impressions</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-bold text-purple-400">{promotion.metrics.clicks}</div>
                            <div className="text-xs text-gray-400">Clicks</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-bold text-purple-400">
                              {(promotion.metrics.ctr * 100).toFixed(1)}%
                            </div>
                            <div className="text-xs text-gray-400">CTR</div>
                          </div>
                        </div>

                        <div className="flex space-x-2">
                          <button
                            onClick={() => pauseMutation.mutate(promotion._id)}
                            disabled={pauseMutation.isLoading}
                            className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <Pause className="h-4 w-4 inline mr-2" />
                            Pause
                          </button>
                          <button
                            onClick={() => setSelectedPromotion(promotion)}
                            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                          >
                            View Details
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Performance Chart Placeholder */}
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                  <h3 className="text-lg font-bold mb-4">Performance Over Time</h3>
                  <div className="h-64 bg-gray-700 rounded-lg flex items-center justify-center">
                    <div className="text-center text-gray-400">
                      <BarChart3 className="h-12 w-12 mx-auto mb-2" />
                      <p>Performance chart coming soon</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* All Promotions */}
            {activeTab === 'all' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                {promotions?.promotions?.map((promotion) => (
                  <div key={promotion._id} className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className={`p-3 rounded-lg ${getStatusColor(promotion.status)}`}>
                          {React.createElement(getStatusIcon(promotion.status), { className: "h-5 w-5" })}
                        </div>
                        <div>
                          <div className="font-semibold text-white">{promotion.promotionPackage?.name}</div>
                          <div className="text-sm text-gray-400">
                            {promotion.listingType} • {promotion.targetCategory} • {promotion.createdAt ? new Date(promotion.createdAt).toLocaleDateString() : ''}
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-lg font-bold text-white">${promotion.budget}</div>
                        <div className="text-sm text-gray-400">{formatDuration(promotion.duration)}</div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <div className="text-sm text-gray-400">
                          {promotion.metrics.impressions} impressions
                        </div>
                        <div className="text-sm text-gray-400">
                          {promotion.metrics.clicks} clicks
                        </div>
                      </div>

                      <div className="flex space-x-2">
                        {promotion.status === 'active' && (
                          <button
                            onClick={() => pauseMutation.mutate(promotion._id)}
                            disabled={pauseMutation.isLoading}
                            className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded text-sm transition-colors disabled:opacity-50"
                          >
                            Pause
                          </button>
                        )}
                        {promotion.status === 'paused' && (
                          <button
                            onClick={() => resumeMutation.mutate(promotion._id)}
                            disabled={resumeMutation.isLoading}
                            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm transition-colors disabled:opacity-50"
                          >
                            Resume
                          </button>
                        )}
                        {(promotion.status === 'active' || promotion.status === 'paused') && (
                          <button
                            onClick={() => cancelMutation.mutate(promotion._id)}
                            disabled={cancelMutation.isLoading}
                            className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm transition-colors disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </div>
        )}

        {/* Empty State */}
        {promotions?.promotions?.length === 0 && (
          <div className="text-center py-12">
            <div className="bg-gray-800 rounded-xl p-8 border border-gray-700">
              <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-300 mb-2">No Promotions Yet</h3>
              <p className="text-gray-400 mb-6">
                Start promoting your listings to get more visibility and sales.
              </p>
              <Link
                to="/promote"
                className="inline-flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Create Your First Promotion</span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PromotionDashboard;








