import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Hash, 
  Twitter, 
  Instagram, 
  MessageSquare, 
  CheckCircle, 
  Clock, 
  TrendingUp,
  Users,
  Zap,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  Star
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// API functions for hashtag tracking
const hashtagAPI = {
  // Get user's social media connections
  getConnections: async () => {
    const token = localStorage.getItem('f10_token');
    const response = await fetch('http://localhost:5000/api/social/connections', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    if (!response.ok) throw new Error('Failed to fetch connections');
    return response.json();
  },

  // Connect social media account
  connectAccount: async (platform, authData) => {
    const token = localStorage.getItem('f10_token');
    const response = await fetch('http://localhost:5000/api/social/connect', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ platform, authData })
    });
    if (!response.ok) throw new Error('Failed to connect account');
    return response.json();
  },

  // Get tracked posts
  getTrackedPosts: async () => {
    const token = localStorage.getItem('f10_token');
    const response = await fetch('http://localhost:5000/api/social/tracked-posts', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    if (!response.ok) throw new Error('Failed to fetch tracked posts');
    return response.json();
  },

  // Manually trigger hashtag scan
  triggerScan: async () => {
    const token = localStorage.getItem('f10_token');
    const response = await fetch('http://localhost:5000/api/social/scan-hashtags', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    if (!response.ok) throw new Error('Failed to trigger scan');
    return response.json();
  },

  // Get hashtag campaign stats
  getCampaignStats: async () => {
    const token = localStorage.getItem('f10_token');
    const response = await fetch('http://localhost:5000/api/social/campaign-stats', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    if (!response.ok) throw new Error('Failed to fetch campaign stats');
    return response.json();
  }
};

const HashtagTracker = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState('');

  // Fetch connections
  const { data: connections, isLoading: connectionsLoading } = useQuery({
    queryKey: ['socialConnections'],
    queryFn: hashtagAPI.getConnections,
    enabled: !!user,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Fetch tracked posts
  const { data: trackedPosts, isLoading: postsLoading } = useQuery({
    queryKey: ['trackedPosts'],
    queryFn: hashtagAPI.getTrackedPosts,
    enabled: !!user,
    refetchInterval: 60000, // Refetch every minute
  });

  // Fetch campaign stats
  const { data: campaignStats } = useQuery({
    queryKey: ['campaignStats'],
    queryFn: hashtagAPI.getCampaignStats,
    enabled: !!user,
  });

  // Connect account mutation
  const connectMutation = useMutation({
    mutationFn: ({ platform, authData }) => hashtagAPI.connectAccount(platform, authData),
    onSuccess: () => {
      queryClient.invalidateQueries(['socialConnections']);
      setShowConnectModal(false);
    },
  });

  // Trigger scan mutation
  const scanMutation = useMutation({
    mutationFn: hashtagAPI.triggerScan,
    onSuccess: () => {
      queryClient.invalidateQueries(['trackedPosts']);
      queryClient.invalidateQueries(['campaignStats']);
    },
  });

  const platforms = [
    {
      id: 'twitter',
      name: 'Twitter/X',
      icon: <Twitter className="h-5 w-5" />,
      color: 'from-blue-400 to-blue-600',
      connected: connections?.twitter?.connected || false,
      lastSync: connections?.twitter?.lastSync
    },
    {
      id: 'instagram',
      name: 'Instagram',
      icon: <Instagram className="h-5 w-5" />,
      color: 'from-pink-400 to-purple-600',
      connected: connections?.instagram?.connected || false,
      lastSync: connections?.instagram?.lastSync
    }
  ];

  const hashtags = [
    { tag: '#StayEarning', points: 300, color: 'text-yellow-400' },
    { tag: '#StaySavvy', points: 300, color: 'text-blue-400' },
    { tag: '#Final10', points: 200, color: 'text-green-400' },
    { tag: '#AuctionWin', points: 500, color: 'text-purple-400' }
  ];

  const handleConnect = (platform) => {
    setSelectedPlatform(platform);
    setShowConnectModal(true);
  };

  const handleConnectSubmit = (authData) => {
    connectMutation.mutate({ platform: selectedPlatform, authData });
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const getPointsEarned = (post) => {
    let basePoints = 300; // Default social post points
    
    // Check for specific hashtags that give bonus points
    const hashtagsInPost = post.hashtags || [];
    if (hashtagsInPost.includes('#AuctionWin')) basePoints = 500;
    if (hashtagsInPost.includes('#Final10')) basePoints = 200;
    
    // Engagement bonuses
    let engagementBonus = 0;
    if (post.likes > 100) engagementBonus += 100;
    if (post.likes > 1000) engagementBonus += 200;
    if (post.retweets > 50) engagementBonus += 50;
    
    return basePoints + engagementBonus;
  };

  return (
    <div className="min-h-screen bg-gray-900 pt-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg">
              <Hash className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Hashtag Tracker</h1>
              <p className="text-gray-400">Automated social media post tracking for points</p>
            </div>
          </div>
        </motion.div>

        {/* Campaign Stats */}
        {campaignStats && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8"
          >
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="h-5 w-5 text-green-400" />
                <span className="text-sm text-gray-400">Total Posts</span>
              </div>
              <div className="text-2xl font-bold text-white">{campaignStats.totalPosts || 0}</div>
            </div>
            
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <div className="flex items-center gap-3 mb-2">
                <Zap className="h-5 w-5 text-yellow-400" />
                <span className="text-sm text-gray-400">Points Earned</span>
              </div>
              <div className="text-2xl font-bold text-white">{campaignStats.totalPoints?.toLocaleString() || 0}</div>
            </div>
            
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <div className="flex items-center gap-3 mb-2">
                <Users className="h-5 w-5 text-blue-400" />
                <span className="text-sm text-gray-400">Active Users</span>
              </div>
              <div className="text-2xl font-bold text-white">{campaignStats.activeUsers || 0}</div>
            </div>
            
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <div className="flex items-center gap-3 mb-2">
                <Star className="h-5 w-5 text-purple-400" />
                <span className="text-sm text-gray-400">Viral Posts</span>
              </div>
              <div className="text-2xl font-bold text-white">{campaignStats.viralPosts || 0}</div>
            </div>
          </motion.div>
        )}

        {/* Hashtag Campaign Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 rounded-lg p-6 mb-8 border border-blue-500/20"
        >
          <h2 className="text-xl font-bold text-white mb-4">🎯 Active Hashtag Campaigns</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {hashtags.map((hashtag) => (
              <div key={hashtag.tag} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                <span className={`font-mono text-lg ${hashtag.color}`}>{hashtag.tag}</span>
                <span className="text-yellow-400 font-semibold">+{hashtag.points} pts</span>
              </div>
            ))}
          </div>
          <p className="text-sm text-gray-400 mt-4">
            Post with any of these hashtags and earn points automatically! Bonus points for engagement and viral posts.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Social Media Connections */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gray-800/50 rounded-lg p-6 border border-gray-700"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Social Media Connections</h2>
              <button
                onClick={() => scanMutation.mutate()}
                disabled={scanMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
              >
                <RefreshCw className={`h-4 w-4 ${scanMutation.isPending ? 'animate-spin' : ''}`} />
                {scanMutation.isPending ? 'Scanning...' : 'Scan Now'}
              </button>
            </div>

            <div className="space-y-4">
              {platforms.map((platform) => (
                <div key={platform.id} className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 bg-gradient-to-r ${platform.color} rounded-lg`}>
                      {platform.icon}
                    </div>
                    <div>
                      <div className="font-semibold text-white">{platform.name}</div>
                      <div className="text-sm text-gray-400">
                        Last sync: {formatDate(platform.lastSync)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {platform.connected ? (
                      <div className="flex items-center gap-2 text-green-400">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-sm">Connected</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleConnect(platform.id)}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                      >
                        Connect
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 bg-blue-900/20 rounded-lg border border-blue-500/20">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-blue-400 mb-1">How it works</h3>
                  <p className="text-sm text-gray-300">
                    Connect your social media accounts to automatically track posts with our hashtags. 
                    We'll scan for new posts and award points instantly when detected.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Recent Tracked Posts */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-gray-800/50 rounded-lg p-6 border border-gray-700"
          >
            <h2 className="text-xl font-bold text-white mb-6">Recent Tracked Posts</h2>
            
            {postsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
                <span className="ml-3 text-gray-400">Loading posts...</span>
              </div>
            ) : trackedPosts?.length > 0 ? (
              <div className="space-y-4">
                {trackedPosts.slice(0, 5).map((post) => (
                  <div key={post.id} className="p-4 bg-gray-700/50 rounded-lg">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full flex items-center justify-center">
                          <span className="text-white font-semibold text-sm">
                            {post.platform === 'twitter' ? 'T' : 'I'}
                          </span>
                        </div>
                        <div>
                          <div className="font-semibold text-white">@{post.username}</div>
                          <div className="text-sm text-gray-400">
                            {formatDate(post.createdAt)} • {post.platform}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-yellow-400 font-bold">+{getPointsEarned(post)} pts</div>
                        <div className="text-xs text-gray-400">
                          {post.likes} likes • {post.retweets} retweets
                        </div>
                      </div>
                    </div>
                    
                    <p className="text-gray-300 mb-3 line-clamp-2">{post.content}</p>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex gap-2">
                        {post.hashtags?.slice(0, 3).map((tag) => (
                          <span key={tag} className="px-2 py-1 bg-blue-900/30 text-blue-300 rounded text-xs">
                            {tag}
                          </span>
                        ))}
                      </div>
                      <a
                        href={post.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-sm"
                      >
                        View Post <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <MessageSquare className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                <p className="text-gray-400">No tracked posts yet</p>
                <p className="text-sm text-gray-500 mt-2">
                  Connect your social accounts and start posting with our hashtags!
                </p>
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {/* Connect Modal */}
      {showConnectModal && (
        <ConnectModal
          platform={selectedPlatform}
          onClose={() => setShowConnectModal(false)}
          onSubmit={handleConnectSubmit}
          isLoading={connectMutation.isPending}
        />
      )}
    </div>
  );
};

// Connect Modal Component
const ConnectModal = ({ platform, onClose, onSubmit, isLoading }) => {
  const [authData, setAuthData] = useState({});

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(authData);
  };

  const getPlatformInstructions = (platform) => {
    switch (platform) {
      case 'twitter':
        return {
          title: 'Connect Twitter Account',
          description: 'We\'ll monitor your Twitter posts for our hashtags and award points automatically.',
          steps: [
            'Click "Authorize Twitter" below',
            'Sign in to your Twitter account',
            'Grant permission for Final10 to read your posts',
            'We\'ll start tracking your hashtag posts immediately'
          ]
        };
      case 'instagram':
        return {
          title: 'Connect Instagram Account',
          description: 'Connect your Instagram to track posts with our hashtags.',
          steps: [
            'Click "Authorize Instagram" below',
            'Sign in to your Instagram account',
            'Grant permission for Final10 to read your posts',
            'We\'ll start tracking your hashtag posts immediately'
          ]
        };
      default:
        return {
          title: 'Connect Account',
          description: 'Connect your social media account to start earning points.',
          steps: []
        };
    }
  };

  const instructions = getPlatformInstructions(platform);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gray-800 rounded-lg p-6 max-w-md w-full border border-gray-700"
      >
        <h3 className="text-xl font-bold text-white mb-4">{instructions.title}</h3>
        <p className="text-gray-400 mb-6">{instructions.description}</p>
        
        <div className="space-y-3 mb-6">
          {instructions.steps.map((step, index) => (
            <div key={index} className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-white text-xs font-bold">{index + 1}</span>
              </div>
              <p className="text-sm text-gray-300">{step}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit({})}
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
          >
            {isLoading ? 'Connecting...' : `Authorize ${platform === 'twitter' ? 'Twitter' : 'Instagram'}`}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default HashtagTracker;




















