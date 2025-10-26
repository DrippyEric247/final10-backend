import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import hashtagTrackerService from '../services/hashtagTracker';

// Custom hook for hashtag tracking functionality
export const useHashtagTracker = () => {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const updateIntervalRef = useRef(null);

  // Fetch social media connections
  const {
    data: connections,
    isLoading: connectionsLoading,
    error: connectionsError,
    refetch: refetchConnections
  } = useQuery({
    queryKey: ['socialConnections'],
    queryFn: () => hashtagTrackerService.getConnections(),
    refetchInterval: 30000, // Refetch every 30 seconds
    retry: 3,
    onSuccess: (data) => {
      const hasConnection = Object.values(data || {}).some(conn => conn.connected);
      setIsConnected(hasConnection);
    }
  });

  // Fetch tracked posts
  const {
    data: trackedPosts,
    isLoading: postsLoading,
    error: postsError,
    refetch: refetchPosts
  } = useQuery({
    queryKey: ['trackedPosts'],
    queryFn: () => hashtagTrackerService.getTrackedPosts(),
    enabled: isConnected,
    refetchInterval: 60000, // Refetch every minute
    retry: 3
  });

  // Fetch campaign stats
  const {
    data: campaignStats,
    isLoading: statsLoading,
    error: statsError
  } = useQuery({
    queryKey: ['campaignStats'],
    queryFn: () => hashtagTrackerService.getCampaignStats(),
    enabled: isConnected,
    refetchInterval: 120000, // Refetch every 2 minutes
    retry: 3
  });

  // Connect account mutation
  const connectMutation = useMutation({
    mutationFn: ({ platform, authData }) => 
      hashtagTrackerService.connectAccount(platform, authData),
    onSuccess: () => {
      queryClient.invalidateQueries(['socialConnections']);
      setIsConnected(true);
    },
    onError: (error) => {
      console.error('Failed to connect account:', error);
    }
  });

  // Disconnect account mutation
  const disconnectMutation = useMutation({
    mutationFn: (platform) => hashtagTrackerService.disconnectAccount(platform),
    onSuccess: () => {
      queryClient.invalidateQueries(['socialConnections']);
      // Check if still connected to any platform
      const hasConnection = Object.values(connections || {}).some(conn => conn.connected);
      setIsConnected(hasConnection);
    }
  });

  // Trigger hashtag scan mutation
  const scanMutation = useMutation({
    mutationFn: () => hashtagTrackerService.triggerHashtagScan(),
    onSuccess: () => {
      queryClient.invalidateQueries(['trackedPosts']);
      queryClient.invalidateQueries(['campaignStats']);
      setLastUpdate(new Date());
    }
  });

  // Submit post for tracking mutation
  const submitPostMutation = useMutation({
    mutationFn: ({ platform, postUrl, hashtags }) => 
      hashtagTrackerService.submitPostForTracking(platform, postUrl, hashtags),
    onSuccess: () => {
      queryClient.invalidateQueries(['trackedPosts']);
    }
  });

  // Start real-time updates
  const startRealTimeUpdates = useCallback((callback) => {
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
    }

    updateIntervalRef.current = setInterval(async () => {
      try {
        const [posts, stats] = await Promise.all([
          hashtagTrackerService.getTrackedPosts(10, 0),
          hashtagTrackerService.getCampaignStats()
        ]);
        
        const updateData = { posts, stats, timestamp: Date.now() };
        setLastUpdate(new Date());
        callback(updateData);
      } catch (error) {
        console.error('Real-time update failed:', error);
      }
    }, 30000); // Update every 30 seconds
  }, []);

  // Stop real-time updates
  const stopRealTimeUpdates = useCallback(() => {
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
      updateIntervalRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRealTimeUpdates();
    };
  }, [stopRealTimeUpdates]);

  // Utility functions
  const extractHashtags = useCallback((text) => {
    return hashtagTrackerService.extractHashtags(text);
  }, []);

  const calculatePoints = useCallback((post) => {
    return hashtagTrackerService.calculatePoints(post);
  }, []);

  const formatPostForDisplay = useCallback((post) => {
    return hashtagTrackerService.formatPostForDisplay(post);
  }, []);

  // Get connection status for specific platform
  const getConnectionStatus = useCallback((platform) => {
    return connections?.[platform] || { connected: false, lastSync: null };
  }, [connections]);

  // Check if user has any connected platforms
  const hasAnyConnection = useCallback(() => {
    return Object.values(connections || {}).some(conn => conn.connected);
  }, [connections]);

  // Get recent posts for a specific platform
  const getPlatformPosts = useCallback((platform, limit = 10) => {
    if (!trackedPosts) return [];
    return trackedPosts
      .filter(post => post.platform === platform)
      .slice(0, limit);
  }, [trackedPosts]);

  // Get posts by hashtag
  const getPostsByHashtag = useCallback((hashtag, limit = 10) => {
    if (!trackedPosts) return [];
    return trackedPosts
      .filter(post => post.hashtags?.includes(hashtag))
      .slice(0, limit);
  }, [trackedPosts]);

  // Get total points earned from social posts
  const getTotalSocialPoints = useCallback(() => {
    if (!trackedPosts) return 0;
    return trackedPosts.reduce((total, post) => {
      return total + calculatePoints(post);
    }, 0);
  }, [trackedPosts, calculatePoints]);

  // Get user's social engagement stats
  const getSocialStats = useCallback(() => {
    if (!trackedPosts) {
      return {
        totalPosts: 0,
        totalLikes: 0,
        totalRetweets: 0,
        totalComments: 0,
        totalPoints: 0,
        averageEngagement: 0
      };
    }

    const stats = trackedPosts.reduce((acc, post) => {
      acc.totalPosts += 1;
      acc.totalLikes += post.likes || 0;
      acc.totalRetweets += post.retweets || 0;
      acc.totalComments += post.comments || 0;
      acc.totalPoints += calculatePoints(post);
      return acc;
    }, {
      totalPosts: 0,
      totalLikes: 0,
      totalRetweets: 0,
      totalComments: 0,
      totalPoints: 0
    });

    stats.averageEngagement = stats.totalPosts > 0 
      ? (stats.totalLikes + stats.totalRetweets + stats.totalComments) / stats.totalPosts 
      : 0;

    return stats;
  }, [trackedPosts, calculatePoints]);

  return {
    // Data
    connections,
    trackedPosts,
    campaignStats,
    isConnected,
    lastUpdate,

    // Loading states
    connectionsLoading,
    postsLoading,
    statsLoading,

    // Error states
    connectionsError,
    postsError,
    statsError,

    // Mutations
    connectAccount: connectMutation.mutate,
    disconnectAccount: disconnectMutation.mutate,
    triggerScan: scanMutation.mutate,
    submitPost: submitPostMutation.mutate,

    // Mutation states
    isConnecting: connectMutation.isPending,
    isDisconnecting: disconnectMutation.isPending,
    isScanning: scanMutation.isPending,
    isSubmitting: submitPostMutation.isPending,

    // Real-time updates
    startRealTimeUpdates,
    stopRealTimeUpdates,

    // Utility functions
    extractHashtags,
    calculatePoints,
    formatPostForDisplay,
    getConnectionStatus,
    hasAnyConnection,
    getPlatformPosts,
    getPostsByHashtag,
    getTotalSocialPoints,
    getSocialStats,

    // Manual refetch functions
    refetchConnections,
    refetchPosts
  };
};

// Hook for specific hashtag analytics
export const useHashtagAnalytics = (hashtag, timeRange = '7d') => {
  const {
    data: analytics,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['hashtagAnalytics', hashtag, timeRange],
    queryFn: () => hashtagTrackerService.getHashtagAnalytics(hashtag, timeRange),
    enabled: !!hashtag,
    refetchInterval: 300000, // Refetch every 5 minutes
    retry: 3
  });

  return {
    analytics,
    isLoading,
    error,
    refetch
  };
};

// Hook for user social stats
export const useUserSocialStats = (userId) => {
  const {
    data: stats,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['userSocialStats', userId],
    queryFn: () => hashtagTrackerService.getUserSocialStats(userId),
    enabled: !!userId,
    refetchInterval: 60000, // Refetch every minute
    retry: 3
  });

  return {
    stats,
    isLoading,
    error,
    refetch
  };
};

export default useHashtagTracker;




















