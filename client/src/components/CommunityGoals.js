import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Award, 
  Bell, 
  TrendingUp, 
  Clock,
  Users,
  Gift,
  Target
} from 'lucide-react';
import { getCommunityGoals, getCommunityProgress, claimCommunityReward } from '../lib/api';
import toast from 'react-hot-toast';

const CommunityGoals = () => {
  const [goals, setGoals] = useState(null);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    loadCommunityData();
  }, []);

  const loadCommunityData = async () => {
    try {
      const [goalsData, progressData] = await Promise.all([
        getCommunityGoals(),
        getCommunityProgress()
      ]);
      setGoals(goalsData);
      setProgress(progressData);
    } catch (error) {
      console.error('Failed to load community data:', error);
      // Fallback data for development
      setGoals({
        savvyPoints: { target: 1000000, reward: { points: 10000, subscription: 1 } },
        activeAlerts: { target: 100000, reward: { points: 10000, subscription: 1 } },
        auctionsWon: { target: 100000, reward: { points: 10000, subscription: 1 } },
        timeSaved: { target: 8760, reward: { points: 10000, subscription: 1 } } // 1 year in hours
      });
      setProgress({
        savvyPoints: 750000,
        activeAlerts: 45000,
        auctionsWon: 32000,
        timeSaved: 5200,
        canClaimReward: true
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClaimReward = async () => {
    if (claiming) return;
    
    setClaiming(true);
    try {
      const result = await claimCommunityReward();
      toast.success(`Reward claimed! You received ${result.points} Savvy Points and ${result.subscription} month subscription!`);
      loadCommunityData(); // Refresh data
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to claim reward');
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card text-center animate-pulse">
            <div className="h-6 bg-gray-700 rounded mb-2"></div>
            <div className="h-8 bg-gray-700 rounded mb-1"></div>
            <div className="h-4 bg-gray-700 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  const goalItems = [
    {
      key: 'savvyPoints',
      label: 'Savvy Points',
      icon: <Award className="w-5 h-5" />,
      current: progress?.savvyPoints || 0,
      target: goals?.savvyPoints?.target || 1000000,
      unit: '',
      color: 'from-purple-500 to-purple-600'
    },
    {
      key: 'activeAlerts',
      label: 'Active Alerts',
      icon: <Bell className="w-5 h-5" />,
      current: progress?.activeAlerts || 0,
      target: goals?.activeAlerts?.target || 100000,
      unit: '',
      color: 'from-blue-500 to-blue-600'
    },
    {
      key: 'auctionsWon',
      label: 'Auctions Won',
      icon: <TrendingUp className="w-5 h-5" />,
      current: progress?.auctionsWon || 0,
      target: goals?.auctionsWon?.target || 100000,
      unit: '',
      color: 'from-green-500 to-green-600'
    },
    {
      key: 'timeSaved',
      label: 'Time Saved',
      icon: <Clock className="w-5 h-5" />,
      current: progress?.timeSaved || 0,
      target: goals?.timeSaved?.target || 8760,
      unit: 'h',
      color: 'from-yellow-500 to-yellow-600'
    }
  ];

  const formatNumber = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const getProgressPercentage = (current, target) => {
    return Math.min((current / target) * 100, 100);
  };

  return (
    <div className="mb-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="mb-6"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Users className="w-6 h-6 text-purple-400" />
              Community Goals
            </h2>
            <p className="text-gray-400">Help us reach these milestones together!</p>
          </div>
          {progress?.canClaimReward && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleClaimReward}
              disabled={claiming}
              className="btn bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 flex items-center gap-2"
            >
              <Gift className="w-4 h-4" />
              {claiming ? 'Claiming...' : 'Claim Reward!'}
            </motion.button>
          )}
        </div>

        {/* Reward Info */}
        <div className="card bg-gradient-to-r from-purple-900/30 to-pink-900/30 border-purple-500/30 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
              <Target className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Community Reward</h3>
              <p className="text-gray-300 text-sm">
                When we hit any goal, all participants get <span className="text-yellow-300 font-semibold">10,000 Savvy Points</span> 
                {' '}and a <span className="text-yellow-300 font-semibold">1-month subscription</span> (worth $100)!
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Goals Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-6"
      >
        {goalItems.map((item, index) => {
          const percentage = getProgressPercentage(item.current, item.target);
          const isCompleted = percentage >= 100;
          
          return (
            <motion.div
              key={item.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 + (index * 0.1) }}
              className={`card text-center relative overflow-hidden ${
                isCompleted ? 'ring-2 ring-green-400 bg-green-500/10' : ''
              }`}
            >
              {/* Progress Bar */}
              <div className="absolute top-0 left-0 h-1 bg-gray-700 w-full">
                <div 
                  className={`h-full bg-gradient-to-r ${item.color} transition-all duration-1000 ease-out`}
                  style={{ width: `${percentage}%` }}
                />
              </div>

              {/* Completion Badge */}
              {isCompleted && (
                <div className="absolute top-2 right-2">
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">✓</span>
                  </div>
                </div>
              )}

              <div className="text-purple-400 mb-2 flex justify-center">
                {item.icon}
              </div>
              
              <div className="text-2xl font-bold text-white mb-1">
                {formatNumber(item.current)}{item.unit}
              </div>
              
              <div className="text-gray-400 text-sm mb-2">{item.label}</div>
              
              <div className="text-xs text-gray-500">
                {formatNumber(item.current)} / {formatNumber(item.target)}
              </div>
              
              {isCompleted && (
                <div className="mt-2 text-xs text-green-400 font-semibold">
                  Goal Reached! 🎉
                </div>
              )}
            </motion.div>
          );
        })}
      </motion.div>

      {/* Progress Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="mt-6 card bg-gray-800/50"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Community Progress</h3>
            <p className="text-gray-400 text-sm">
              Updated daily • Next update in 23 hours
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-purple-400">
              {goalItems.filter(item => getProgressPercentage(item.current, item.target) >= 100).length}/4
            </div>
            <div className="text-gray-400 text-sm">Goals Completed</div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default CommunityGoals;
