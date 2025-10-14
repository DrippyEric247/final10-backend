import CopyField from "../components/CopyField";
import { makeReferralLink } from "../lib/referrals";
import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Clock, 
  TrendingUp, 
  Bell, 
  Award, 
  Plus,
  Eye,
  Zap
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import CommunityGoals from '../components/CommunityGoals';

const Dashboard = () => {
  const { user } = useAuth();
  const referralLink = user?._id ? makeReferralLink(user._id) : "";

  const quickActions = [
    {
      title: 'Browse Auctions',
      description: 'Find auctions ending soon',
      icon: <Clock className="w-6 h-6" />,
      href: '/auctions',
      color: 'from-yellow-500 to-yellow-400'
    },
    {
      title: 'Create Alert',
      description: 'Set up deal notifications',
      icon: <Bell className="w-6 h-6" />,
      href: '/alerts',
      color: 'from-yellow-600 to-yellow-500'
    },
    {
      title: 'My Points',
      description: 'Check your Savvy Points',
      icon: <Award className="w-6 h-6" />,
      href: '/points',
      color: 'from-yellow-400 to-yellow-300'
    },
    {
      title: 'Create Auction',
      description: 'List your own auction',
      icon: <Plus className="w-6 h-6" />,
      href: '/create-auction',
      color: 'from-yellow-400 to-yellow-300'
    },
    {
      title: 'Hashtag Tracker',
      description: 'Automated social media tracking',
      icon: <Eye className="w-6 h-6" />,
      href: '/hashtag-tracker',
      color: 'from-purple-500 to-pink-500'
    }
  ];

  // Removed individual stats - now using CommunityGoals component

  return (
    <div className="min-h-screen bg-gray-900 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8"
        >
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            Welcome back, <span className="text-gradient">{user?.firstName}</span>!
          </h1>
          <p className="text-gray-400 text-lg">
            Ready to find your next great deal? Let's get started.
          </p>
        </motion.div>

        {/* Community Goals */}
        <CommunityGoals />

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-8"
        >
          <h2 className="text-2xl font-bold text-white mb-6">Quick Actions</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {quickActions.map((action, index) => (
              <Link
                key={index}
                to={action.href}
                className="card-hover group"
              >
                <div className={`w-12 h-12 bg-gradient-to-r ${action.color} rounded-lg flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform`}>
                  {action.icon}
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{action.title}</h3>
                <p className="text-gray-400">{action.description}</p>
              </Link>
            ))}
          </div>
        </motion.div>
{/* Invite & Earn */}
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.6, delay: 0.25 }}
  className="card mb-8"
>
  <div className="flex items-center justify-between mb-4">
    <h3 className="text-2xl font-semibold text-white">Invite &amp; Earn</h3>
    <span className="text-purple-400 text-sm font-semibold">#StaySavvy #StayEarning</span>
  </div>

  <p className="text-gray-300 mb-4">
    Share your link. When a friend signs up, you earn <span className="text-yellow-300 font-semibold">5,000 Savvy
    Points</span> and a <span className="text-yellow-300 font-semibold">$50 bonus</span> (up to 10 new users per day for cash bonus).
    No cap on points after that—keep it rolling.
  </p>

  <CopyField value={referralLink} />
  <p className="text-gray-400 text-xs mt-2">
    Pro tip: post your auction wins with <span className="text-purple-300">#Final10</span> for extra Savvy Points.
  </p>
</motion.div>

        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="grid lg:grid-cols-2 gap-8"
        >
          {/* Trending Auctions */}
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-purple-400" />
                Trending Auctions
              </h3>
              <Link to="/auctions" className="text-purple-400 hover:text-purple-300 text-sm">
                View all
              </Link>
            </div>
            <div className="space-y-4">
              {[1, 2, 3].map((item) => (
                <div key={item} className="flex items-center space-x-4 p-3 bg-gray-800 rounded-lg">
                  <div className="w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center">
                    <Zap className="w-6 h-6 text-purple-400" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-white font-medium">iPhone 14 Pro Max</h4>
                    <p className="text-gray-400 text-sm">$850 • 5m left</p>
                  </div>
                  <div className="text-right">
                    <div className="text-green-400 font-semibold">High Deal</div>
                    <div className="text-gray-400 text-sm">Low Competition</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Alerts */}
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                <Bell className="w-5 h-5 text-purple-400" />
                Recent Alerts
              </h3>
              <Link to="/alerts" className="text-purple-400 hover:text-purple-300 text-sm">
                Manage
              </Link>
            </div>
            <div className="space-y-4">
              {[1, 2, 3].map((item) => (
                <div key={item} className="flex items-center space-x-4 p-3 bg-gray-800 rounded-lg">
                  <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                    <Bell className="w-6 h-6 text-green-400" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-white font-medium">Nike Sneakers Alert</h4>
                    <p className="text-gray-400 text-sm">3 matches found</p>
                  </div>
                  <div className="text-right">
                    <div className="text-green-400 font-semibold">Active</div>
                    <div className="text-gray-400 text-sm">2h ago</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Pro Tip */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-8 card bg-gradient-to-r from-purple-900/30 to-blue-900/30 border-purple-500/30"
        >
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Pro Tip</h3>
              <p className="text-gray-300">
                Set up alerts for your favorite categories to never miss a great deal. 
                Our AI will notify you when auctions with high deal potential and low competition are found.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;

