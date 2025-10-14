import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
  User, 
  Settings, 
  Award, 
  Calendar, 
  Target, 
  CheckCircle, 
  Clock, 
  Share2, 
  Search, 
  Eye, 
  Gift,
  Star,
  TrendingUp,
  Users,
  Link as LinkIcon,
  ExternalLink,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { 
  getDailyTasks, 
  claimDailyLogin, 
  watchAd, 
  trackAppShare, 
  trackProductShare, 
  completeSocialPost,
  getLevelInfo,
  getMilestones,
  getLevelStats
} from '../lib/api';
import useHashtagTracker from '../hooks/useHashtagTracker';
import api from '../services/authService';
import RedeemCodeSection from '../components/RedeemCodeSection';

const Profile = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showAdModal, setShowAdModal] = useState(false);
  const [socialPostData, setSocialPostData] = useState({ platform: '', postUrl: '' });
  const [pointsUpdating, setPointsUpdating] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState('');
  
  // Handle points earned from redeem codes
  const handlePointsEarned = (points) => {
    setPointsUpdating(true);
    // Refresh points data
    queryClient.invalidateQueries(['dailyTasks']);
    queryClient.invalidateQueries(['levelInfo']);
    queryClient.invalidateQueries(['levelStats']);
    queryClient.invalidateQueries(['milestones']);
    
    // Show success message
    setShowSuccessMessage(`+${points} points earned!`);
    setTimeout(() => {
      setShowSuccessMessage('');
      setPointsUpdating(false);
    }, 3000);
  };
  
  // Enhanced hashtag tracking
  const {
    connections,
    trackedPosts,
    isConnected,
    connectAccount,
    triggerScan,
    getTotalSocialPoints,
    getSocialStats
  } = useHashtagTracker();

  // Fetch daily tasks
  const { data: tasksData, isLoading, error } = useQuery({
    queryKey: ['dailyTasks'],
    queryFn: getDailyTasks,
    enabled: !!user,
    refetchInterval: false, // Disable automatic refetching to prevent rate limiting
    refetchOnWindowFocus: false, // Disable refetch on window focus
    onSuccess: (data) => {
      console.log('Daily tasks data received:', data);
    },
    onError: (error) => {
      console.error('Daily tasks fetch error:', error);
      if (error.status === 429) {
        console.warn('Rate limited - will retry later');
      }
    },
  });

  // Fetch level information
  const { data: levelData, isLoading: levelLoading } = useQuery({
    queryKey: ['levelInfo'],
    queryFn: getLevelInfo,
    enabled: !!user,
    refetchInterval: false, // Disable automatic refetching to prevent rate limiting
    refetchOnWindowFocus: false, // Disable refetch on window focus
    onError: (error) => {
      console.error('Level info fetch error:', error);
      if (error.status === 429) {
        console.warn('Rate limited - will retry later');
      }
    },
  });

  // Fetch milestones
  const { data: milestonesData } = useQuery({
    queryKey: ['milestones'],
    queryFn: getMilestones,
    enabled: !!user,
  });

  // Fetch level stats
  const { data: statsData } = useQuery({
    queryKey: ['levelStats'],
    queryFn: getLevelStats,
    enabled: !!user,
  });

  // Fetch eBay connection status
  const { data: ebayStatus, isLoading: ebayStatusLoading } = useQuery({
    queryKey: ['ebayStatus', user?.id],
    queryFn: async () => {
      const response = await api.get(`/users/${user.id}/ebay-status`);
      return response.data;
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // Refetch every 30 seconds to check token status
  });

  // Mutations for task actions
  const claimLoginMutation = useMutation({
    mutationFn: claimDailyLogin,
    onSuccess: (data) => {
      console.log('Daily login claimed successfully:', data);
      setPointsUpdating(true);
      setShowSuccessMessage(`+${data.pointsEarned || 50} points earned!`);
      // Invalidate all related queries to refresh the UI
      queryClient.invalidateQueries(['dailyTasks']);
      queryClient.invalidateQueries(['levelInfo']);
      queryClient.invalidateQueries(['levelStats']);
      queryClient.invalidateQueries(['milestones']);
      // Force refetch of daily tasks to get updated points
      queryClient.refetchQueries(['dailyTasks']).finally(() => {
        setPointsUpdating(false);
        setTimeout(() => setShowSuccessMessage(''), 3000);
      });
    },
    onError: (error) => {
      console.error('Daily login claim failed:', error);
      setPointsUpdating(false);
      const errorMessage = error.status === 429 
        ? 'Too many requests. Please wait a moment and try again.'
        : (error.message || 'Unknown error');
      alert('Failed to claim daily login: ' + errorMessage);
    },
  });

  const watchAdMutation = useMutation({
    mutationFn: watchAd,
    onSuccess: (data) => {
      console.log('Ad watched successfully:', data);
      setPointsUpdating(true);
      queryClient.invalidateQueries(['dailyTasks']);
      queryClient.invalidateQueries(['levelInfo']);
      queryClient.invalidateQueries(['levelStats']);
      queryClient.invalidateQueries(['milestones']);
      queryClient.refetchQueries(['dailyTasks']).finally(() => {
        setPointsUpdating(false);
      });
      setShowAdModal(false);
    },
    onError: (error) => {
      console.error('Watch ad failed:', error);
      setPointsUpdating(false);
      const errorMessage = error.status === 429 
        ? 'Too many requests. Please wait a moment and try again.'
        : (error.message || 'Unknown error');
      alert('Failed to watch ad: ' + errorMessage);
    },
  });

  const shareAppMutation = useMutation({
    mutationFn: trackAppShare,
    onSuccess: (data) => {
      console.log('App shared successfully:', data);
      queryClient.invalidateQueries(['dailyTasks']);
      queryClient.invalidateQueries(['levelInfo']);
      queryClient.invalidateQueries(['levelStats']);
      queryClient.invalidateQueries(['milestones']);
      queryClient.refetchQueries(['dailyTasks']);
    },
    onError: (error) => {
      console.error('Share app failed:', error);
      alert('Failed to share app: ' + (error.message || 'Unknown error'));
    },
  });

  const shareProductMutation = useMutation({
    mutationFn: ({ productId, productTitle }) => trackProductShare(productId, productTitle),
    onSuccess: (data) => {
      console.log('Product shared successfully:', data);
      queryClient.invalidateQueries(['dailyTasks']);
      queryClient.invalidateQueries(['levelInfo']);
      queryClient.invalidateQueries(['levelStats']);
      queryClient.invalidateQueries(['milestones']);
      queryClient.refetchQueries(['dailyTasks']);
    },
    onError: (error) => {
      console.error('Share product failed:', error);
      alert('Failed to share product: ' + (error.message || 'Unknown error'));
    },
  });

  const socialPostMutation = useMutation({
    mutationFn: ({ platform, postUrl }) => completeSocialPost(platform, postUrl),
    onSuccess: (data) => {
      console.log('Social post completed successfully:', data);
      queryClient.invalidateQueries(['dailyTasks']);
      queryClient.invalidateQueries(['levelInfo']);
      queryClient.invalidateQueries(['levelStats']);
      queryClient.invalidateQueries(['milestones']);
      queryClient.refetchQueries(['dailyTasks']);
      setSocialPostData({ platform: '', postUrl: '' });
    },
    onError: (error) => {
      console.error('Social post failed:', error);
      alert('Failed to complete social post: ' + (error.message || 'Unknown error'));
    },
  });

  const handleWatchAd = () => {
    setShowAdModal(true);
    // Simulate ad watching
    setTimeout(() => {
      watchAdMutation.mutate();
    }, 3000);
  };

  const handleShareApp = () => {
    // Prompt user for share URL and platform
    const shareUrl = prompt('Please paste the URL of your share post (Twitter, Facebook, etc.):');
    const platform = prompt('What platform did you share on? (twitter, facebook, instagram, etc.):');
    
    if (!shareUrl || !platform) {
      alert('Both share URL and platform are required for verification.');
      return;
    }
    
    shareAppMutation.mutate({ shareUrl, platform });
  };

  const handleShareProduct = () => {
    // Prompt user for product details and share URL
    const productId = prompt('Enter the product ID:') || 'mock-product-123';
    const productTitle = prompt('Enter the product title:') || 'Sample Product';
    const shareUrl = prompt('Please paste the URL of your product share post:');
    const platform = prompt('What platform did you share on? (twitter, facebook, instagram, etc.):');
    
    if (!shareUrl || !platform) {
      alert('Both share URL and platform are required for verification.');
      return;
    }
    
    shareProductMutation.mutate({ productId, productTitle, shareUrl, platform });
  };

  const handleSocialPost = () => {
    if (socialPostData.platform && socialPostData.postUrl) {
      socialPostMutation.mutate(socialPostData);
    }
  };

  // Handle eBay OAuth connection
  const handleConnectEbay = () => {
    // Real browser navigation so redirects/CORS work properly
    const API_BASE = process.env.REACT_APP_API_BASE || '/api';
    window.location.href = `${API_BASE}/ebay-auth/start`;
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-900 pt-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white mb-4">Profile</h1>
            <p className="text-gray-400">Please login to view your profile and daily tasks</p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading || levelLoading) {
    return (
      <div className="min-h-screen bg-gray-900 pt-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
            <p className="text-gray-400 mt-4">Loading your profile...</p>
          </div>
        </div>
      </div>
    );
  }

  const dailyTasks = tasksData?.dailyTasks || {};
  const tasks = dailyTasks.tasks || {};
  const allTasksCompleted = dailyTasks.allTasksCompleted || false;
  
  const levelInfo = levelData?.level || {};
  const milestones = milestonesData?.milestones || [];
  const stats = statsData?.stats || {};

  return (
    <div className="min-h-screen bg-gray-900 pt-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Profile</h1>
              <p className="text-gray-400">Welcome back, {user.firstName || user.username}!</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-purple-400 flex items-center gap-2">
                {pointsUpdating && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-400"></div>}
                {tasksData?.totalPoints || 0} pts
                <button
                  onClick={() => {
                    queryClient.refetchQueries(['dailyTasks']);
                    queryClient.refetchQueries(['levelInfo']);
                  }}
                  className="ml-2 text-xs bg-purple-600 hover:bg-purple-700 px-2 py-1 rounded"
                  title="Refresh points"
                >
                  🔄
                </button>
              </div>
              <div className="text-sm text-gray-400">
                {tasksData?.userTier || 'free'} tier
              </div>
              {showSuccessMessage && (
                <div className="text-sm text-green-400 font-medium mt-1 animate-pulse">
                  {showSuccessMessage}
                </div>
              )}
            </div>
          </div>

          {/* Level Progress Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-xl p-6 mb-8 border border-purple-500/30"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="bg-purple-500/20 p-3 rounded-lg">
                  <Award className="h-6 w-6 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Level {levelInfo.currentLevel || 1}</h2>
                  <p className="text-sm text-gray-400">{levelInfo.totalXP || 0} Total XP</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-purple-400">
                  {levelInfo.xpToNextLevel || 100} XP to next level
                </div>
                <div className="text-sm text-gray-400">
                  Level {levelInfo.currentLevel || 1} → {levelInfo.currentLevel + 1 || 2}
                </div>
              </div>
            </div>
            
            {/* XP Progress Bar */}
            <div className="w-full bg-gray-700 rounded-full h-3 mb-2">
              <div 
                className="bg-gradient-to-r from-purple-500 to-pink-500 h-3 rounded-full transition-all duration-500"
                style={{ 
                  width: `${levelInfo.xpInfo ? (levelInfo.xpInfo.xpProgress / levelInfo.xpInfo.xpRange) * 100 : 0}%` 
                }}
              ></div>
            </div>
            
            <div className="flex justify-between text-xs text-gray-400">
              <span>{levelInfo.xpInfo?.currentLevelStart || 0} XP</span>
              <span>{levelInfo.xpInfo?.nextLevelStart || 100} XP</span>
            </div>
          </motion.div>

          {/* Redeem Code Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="mb-8"
          >
            <RedeemCodeSection onPointsEarned={handlePointsEarned} />
          </motion.div>

          {/* eBay Connection Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="bg-gray-800 rounded-xl p-6 mb-8"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="bg-blue-500/20 p-3 rounded-lg">
                  <LinkIcon className="h-6 w-6 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">eBay Connection</h2>
                  <p className="text-sm text-gray-400">Connect your eBay account for enhanced features</p>
                </div>
              </div>
              {ebayStatus?.connected && (
                <div className="flex items-center gap-2 bg-green-500/20 text-green-400 px-3 py-1 rounded-full">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm font-medium">Connected</span>
                </div>
              )}
            </div>

            {ebayStatusLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
                <span className="ml-3 text-gray-400">Checking connection status...</span>
              </div>
            ) : ebayStatus?.connected ? (
              <div className="space-y-4">
                {/* Connection Status */}
                <div className="flex items-center justify-between p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-400" />
                    <div>
                      <div className="text-white font-medium">eBay Account Connected</div>
                      <div className="text-sm text-gray-400">
                        Connected on {new Date(ebayStatus.connectedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-green-400 font-medium">
                      {ebayStatus.hasValidToken ? 'Token Valid' : 'Token Expired'}
                    </div>
                    {ebayStatus.needsRefresh && (
                      <div className="text-xs text-yellow-400">Needs Refresh</div>
                    )}
                  </div>
                </div>

                {/* Permissions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-700/50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Search className="h-4 w-4 text-blue-400" />
                      <span className="text-sm font-medium text-white">Browse Permissions</span>
                    </div>
                    <div className="text-xs text-gray-400">
                      {ebayStatus.hasBuyBrowsePermissions ? '✅ Full access' : '❌ Limited access'}
                    </div>
                  </div>
                  <div className="p-4 bg-gray-700/50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="h-4 w-4 text-green-400" />
                      <span className="text-sm font-medium text-white">Buy Permissions</span>
                    </div>
                    <div className="text-xs text-gray-400">
                      {ebayStatus.hasBuyBrowsePermissions ? '✅ Full access' : '❌ Limited access'}
                    </div>
                  </div>
                </div>

                {/* Scopes */}
                {ebayStatus.scopes && ebayStatus.scopes.length > 0 && (
                  <div className="p-4 bg-gray-700/50 rounded-lg">
                    <div className="text-sm font-medium text-white mb-2">Granted Permissions</div>
                    <div className="flex flex-wrap gap-2">
                      {ebayStatus.scopes.map((scope, index) => (
                        <span
                          key={index}
                          className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded"
                        >
                          {scope.split('/').pop() || scope}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="mb-4">
                  <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <h3 className="text-lg font-medium text-white mb-2">eBay Account Not Connected</h3>
                  <p className="text-gray-400 mb-6">
                    Connect your eBay account to access enhanced features like real-time auction data, 
                    personalized recommendations, and advanced search capabilities.
                  </p>
                </div>
                <button
                  onClick={handleConnectEbay}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 mx-auto transition-colors"
                >
                  <LinkIcon className="h-4 w-4" />
                  Connect eBay Account
                  <ExternalLink className="h-4 w-4" />
                </button>
                <p className="text-xs text-gray-500 mt-3">
                  You'll be redirected to eBay to authorize the connection
                </p>
              </div>
            )}
          </motion.div>

          {/* Daily Tasks Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="bg-gray-800 rounded-xl p-6 mb-8"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Calendar className="h-6 w-6 text-purple-400" />
                <h2 className="text-xl font-bold text-white">Daily Tasks</h2>
              </div>
              {allTasksCompleted && (
                <div className="flex items-center gap-2 bg-green-500/20 text-green-400 px-3 py-1 rounded-full">
                  <Gift className="h-4 w-4" />
                  <span className="text-sm font-medium">All Complete!</span>
                </div>
              )}
            </div>

            <div className="grid gap-4">
              {/* Daily Login Task */}
              <TaskCard
                icon={<Target className="h-5 w-5" />}
                title="Daily Login"
                description="Log in to claim your daily points"
                points={50}
                completed={tasks.dailyLogin?.completed || false}
                onAction={() => claimLoginMutation.mutate()}
                actionText={tasks.dailyLogin?.completed ? "Already Claimed" : "Claim"}
                loading={claimLoginMutation.isPending}
                disabled={tasks.dailyLogin?.completed || false}
              />

              {/* Search Task */}
              <TaskCard
                icon={<Search className="h-5 w-5" />}
                title="Search for Products"
                description={`Search for ${tasks.search?.target || 1} product(s) to earn points`}
                points={25}
                completed={tasks.search?.completed || false}
                progress={tasks.search?.progress || 0}
                target={tasks.search?.target || 1}
                actionText={tasks.search?.completed ? "Completed" : "Search Now"}
                onAction={() => navigate('/auctions')}
                disabled={tasks.search?.completed || false}
              />

              {/* Watch Ads Task */}
              <TaskCard
                icon={<Eye className="h-5 w-5" />}
                title="Watch Ads"
                description={`Watch ${tasks.watchAds?.target || 5} ads for extra searches`}
                points={50}
                completed={tasks.watchAds?.completed || false}
                progress={tasks.watchAds?.progress || 0}
                target={tasks.watchAds?.target || 5}
                onAction={handleWatchAd}
                actionText={tasks.watchAds?.completed ? "Completed" : "Watch Ad"}
                loading={watchAdMutation.isPending}
                disabled={tasks.watchAds?.completed || false}
              />

              {/* Share App Task */}
              <TaskCard
                icon={<Share2 className="h-5 w-5" />}
                title="Share App"
                description={`Share Final10 with ${tasks.shareApp?.target || 3} friends`}
                points={300}
                completed={tasks.shareApp?.completed || false}
                progress={tasks.shareApp?.progress || 0}
                target={tasks.shareApp?.target || 3}
                onAction={handleShareApp}
                actionText={tasks.shareApp?.completed ? "Completed" : "Share"}
                loading={shareAppMutation.isPending}
                disabled={tasks.shareApp?.completed || false}
              />

              {/* Share Product Task */}
              <TaskCard
                icon={<TrendingUp className="h-5 w-5" />}
                title="Share Product"
                description="Share a product you found to earn points"
                points={75}
                completed={tasks.shareProduct?.completed || false}
                onAction={handleShareProduct}
                actionText={tasks.shareProduct?.completed ? "Completed" : "Share Product"}
                loading={shareProductMutation.isPending}
                disabled={tasks.shareProduct?.completed || false}
              />

              {/* Enhanced Social Media Post Task */}
              <TaskCard
                icon={<Users className="h-5 w-5" />}
                title="Social Media Post"
                description={
                  isConnected 
                    ? "Post with #StayEarning #StaySavvy - Auto-tracked!" 
                    : "Post your Final10 win with #StayEarning #StaySavvy"
                }
                points={300}
                completed={tasks.socialPost?.completed || false}
                onAction={() => setSocialPostData({ platform: 'twitter', postUrl: '' })}
                actionText={tasks.socialPost?.completed ? "Completed" : (isConnected ? "Auto-Tracking Active" : "Complete Post")}
                disabled={tasks.socialPost?.completed || false}
              />

              {/* AI Video Scanner Task */}
              <TaskCard
                icon={<span className="text-lg">🤖</span>}
                title="Use AI Video Scanner"
                description="Use the AI video scanner to identify products"
                points={20}
                completed={tasks.useVideoScanner?.completed || false}
                onAction={() => window.location.href = '/scanner'}
                actionText={tasks.useVideoScanner?.completed ? "Completed" : "Use Scanner"}
                disabled={tasks.useVideoScanner?.completed || false}
              />

              {/* Search Local Deals Task */}
              <TaskCard
                icon={<span className="text-lg">🏪</span>}
                title="Search for a Local Deal"
                description="Search for local deals on OfferUp and local marketplaces"
                points={25}
                completed={tasks.searchLocalDeals?.completed || false}
                onAction={() => window.location.href = '/local-deals'}
                actionText={tasks.searchLocalDeals?.completed ? "Completed" : "Search Local Deals"}
                disabled={tasks.searchLocalDeals?.completed || false}
              />
            </div>

            {/* Bonus Points */}
            {allTasksCompleted && (
              <div className="mt-6 p-4 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-lg border border-purple-500/30">
                <div className="flex items-center gap-3">
                  <Star className="h-6 w-6 text-yellow-400" />
                  <div>
                    <h3 className="font-bold text-white">Daily Bonus Unlocked!</h3>
                    <p className="text-sm text-gray-300">Complete all tasks to earn 1000 bonus points!</p>
                  </div>
                </div>
              </div>
            )}
          </motion.div>

          {/* User Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
          >
            <div className="bg-gray-800 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <Award className="h-6 w-6 text-purple-400" />
                <h3 className="text-lg font-bold text-white">Total Points</h3>
              </div>
              <div className="text-3xl font-bold text-purple-400">
                {tasksData?.totalPoints || 0}
              </div>
              <p className="text-sm text-gray-400 mt-2">Lifetime earned</p>
            </div>

            <div className="bg-gray-800 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <User className="h-6 w-6 text-blue-400" />
                <h3 className="text-lg font-bold text-white">Membership</h3>
              </div>
              <div className="text-2xl font-bold text-blue-400 capitalize">
                {tasksData?.userTier || 'Free'}
              </div>
              <p className="text-sm text-gray-400 mt-2">Current tier</p>
            </div>

            <div className="bg-gray-800 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <Clock className="h-6 w-6 text-green-400" />
                <h3 className="text-lg font-bold text-white">Tasks Today</h3>
              </div>
              <div className="text-3xl font-bold text-green-400">
                {Object.values(tasks).filter(task => task.completed).length}
              </div>
              <p className="text-sm text-gray-400 mt-2">Completed</p>
            </div>
          </motion.div>

          {/* Milestones Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="bg-gray-800 rounded-xl p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <Star className="h-6 w-6 text-yellow-400" />
              <h2 className="text-xl font-bold text-white">Milestones</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {milestones.map((milestone, index) => (
                <div 
                  key={index}
                  className={`p-4 rounded-lg border ${
                    milestone.achieved 
                      ? 'bg-green-500/10 border-green-500/30' 
                      : 'bg-gray-700/50 border-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{milestone.icon}</span>
                    <div>
                      <h3 className={`font-bold ${milestone.achieved ? 'text-green-400' : 'text-gray-400'}`}>
                        {milestone.name}
                      </h3>
                      <p className="text-sm text-gray-500">Level {milestone.level}</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-400 mb-2">{milestone.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-purple-400">
                      +{milestone.reward} points
                    </span>
                    {milestone.achieved && (
                      <CheckCircle className="h-4 w-4 text-green-400" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>

        {/* Enhanced Social Tracking Status */}
        {isConnected && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-green-900/20 to-blue-900/20 rounded-lg p-6 mb-6 border border-green-500/20"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500 rounded-lg">
                  <Users className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Auto-Tracking Active</h3>
                  <p className="text-sm text-green-400">Your social posts are being monitored automatically</p>
                </div>
              </div>
              <button
                onClick={() => triggerScan()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Scan Now
              </button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{getTotalSocialPoints()}</div>
                <div className="text-sm text-gray-400">Social Points</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{trackedPosts?.length || 0}</div>
                <div className="text-sm text-gray-400">Tracked Posts</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">
                  {Object.values(connections || {}).filter(conn => conn.connected).length}
                </div>
                <div className="text-sm text-gray-400">Connected Platforms</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">
                  {getSocialStats().totalLikes?.toLocaleString() || 0}
                </div>
                <div className="text-sm text-gray-400">Total Likes</div>
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              <span className="px-2 py-1 bg-blue-900/30 text-blue-300 rounded text-xs">#StayEarning</span>
              <span className="px-2 py-1 bg-blue-900/30 text-blue-300 rounded text-xs">#StaySavvy</span>
              <span className="px-2 py-1 bg-blue-900/30 text-blue-300 rounded text-xs">#Final10</span>
              <span className="px-2 py-1 bg-blue-900/30 text-blue-300 rounded text-xs">#AuctionWin</span>
            </div>
          </motion.div>
        )}

        {/* Ad Modal */}
        {showAdModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-xl p-8 max-w-md mx-4">
              <h3 className="text-xl font-bold text-white mb-4">Watching Ad...</h3>
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
                <p className="text-gray-400">Please wait while the ad loads...</p>
                <p className="text-sm text-gray-500 mt-2">This will earn you 5 extra searches!</p>
              </div>
            </div>
          </div>
        )}

        {/* Social Post Modal */}
        {socialPostData.platform && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-xl p-6 max-w-md mx-4">
              <h3 className="text-xl font-bold text-white mb-4">Complete Social Post</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Platform
                  </label>
                  <select
                    value={socialPostData.platform}
                    onChange={(e) => setSocialPostData({...socialPostData, platform: e.target.value})}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="twitter">Twitter</option>
                    <option value="instagram">Instagram</option>
                    <option value="facebook">Facebook</option>
                    <option value="tiktok">TikTok</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Post URL
                  </label>
                  <input
                    type="url"
                    value={socialPostData.postUrl}
                    onChange={(e) => setSocialPostData({...socialPostData, postUrl: e.target.value})}
                    placeholder="https://..."
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                
                {!isConnected && (
                  <div className="p-3 bg-yellow-900/20 border border-yellow-500/20 rounded-lg">
                    <p className="text-sm text-yellow-300">
                      💡 <strong>Tip:</strong> Connect your social accounts for automatic tracking and bonus points!
                    </p>
                  </div>
                )}
                
                {isConnected && (
                  <div className="p-3 bg-green-900/20 border border-green-500/20 rounded-lg">
                    <p className="text-sm text-green-300">
                      ✅ <strong>Auto-tracking active!</strong> Your posts with hashtags will be detected automatically.
                    </p>
                  </div>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={handleSocialPost}
                    disabled={!socialPostData.postUrl || socialPostMutation.isPending}
                    className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white py-2 px-4 rounded-lg font-medium"
                  >
                    {socialPostMutation.isPending ? 'Submitting...' : 'Submit'}
                  </button>
                  <button
                    onClick={() => setSocialPostData({ platform: '', postUrl: '' })}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Task Card Component
const TaskCard = ({ 
  icon, 
  title, 
  description, 
  points, 
  completed, 
  progress = 0, 
  target = 1, 
  onAction, 
  actionText, 
  loading = false, 
  disabled = false 
}) => {
  const progressPercentage = target > 1 ? (progress / target) * 100 : (completed ? 100 : 0);

  return (
    <div className={`bg-gray-700 rounded-lg p-4 border ${completed ? 'border-green-500/50' : 'border-gray-600'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${completed ? 'bg-green-500/20' : 'bg-purple-500/20'}`}>
            {completed ? <CheckCircle className="h-5 w-5 text-green-400" /> : icon}
          </div>
          <div>
            <h3 className="font-medium text-white">{title}</h3>
            <p className="text-sm text-gray-400">{description}</p>
            {target > 1 && (
              <div className="mt-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-600 rounded-full h-2">
                    <div 
                      className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progressPercentage}%` }}
                    ></div>
                  </div>
                  <span className="text-xs text-gray-400">{progress}/{target}</span>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-purple-400">+{points}</div>
          <button
            onClick={onAction}
            disabled={disabled || loading}
            className={`mt-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              disabled 
                ? 'bg-green-500/20 text-green-400 cursor-not-allowed' 
                : 'bg-purple-600 hover:bg-purple-700 text-white'
            }`}
          >
            {loading ? 'Loading...' : completed ? 'Completed' : actionText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Profile;


































