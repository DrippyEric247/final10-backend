import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Crown, 
  Search, 
  Users, 
  Gift, 
  Star, 
  Zap, 
  TrendingUp,
  User,
  Mail,
  Calendar,
  DollarSign,
  Award,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Filter,
  Eye,
  Edit3,
  Send
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const OwnerControlPanel = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [grantType, setGrantType] = useState('points');
  const [grantAmount, setGrantAmount] = useState('');
  const [grantReason, setGrantReason] = useState('');

  useEffect(() => {
    if (user?.role !== 'superadmin') {
      return;
    }
    fetchStats();
  }, [user]);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/owner/stats', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      setStats(data.stats);
    } catch (error) {
      console.error('Error fetching owner stats:', error);
    }
  };

  const searchUsers = async () => {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/owner/search-users?query=${encodeURIComponent(searchQuery)}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      setSearchResults(data.users || []);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserDetails = async (userId) => {
    try {
      const response = await fetch(`/api/owner/user/${userId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      setSelectedUser(data.user);
    } catch (error) {
      console.error('Error fetching user details:', error);
    }
  };

  const handleGrant = async () => {
    if (!selectedUser || !grantAmount) return;
    
    try {
      let endpoint = '';
      let payload = { userId: selectedUser.id, reason: grantReason };
      
      switch (grantType) {
        case 'points':
          endpoint = '/api/owner/grant-points';
          payload.points = parseInt(grantAmount);
          break;
        case 'lifetime':
          endpoint = '/api/owner/grant-lifetime-subscription';
          break;
        case 'premium':
          endpoint = '/api/owner/grant-premium-subscription';
          payload.durationMonths = parseInt(grantAmount);
          break;
        default:
          return;
      }
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert(`✅ ${data.message}`);
        setShowGrantModal(false);
        setGrantAmount('');
        setGrantReason('');
        fetchUserDetails(selectedUser.id);
        fetchStats();
      } else {
        alert(`❌ ${data.message}`);
      }
    } catch (error) {
      console.error('Error granting perk:', error);
      alert('❌ Failed to grant perk');
    }
  };

  if (user?.role !== 'superadmin') {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <Crown className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-4">Owner Access Required</h1>
          <p className="text-gray-400">Only the system owner can access this control panel</p>
          <p className="text-gray-500 text-sm mt-2">This is your exclusive owner perk for creating the Savvy Universe!</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'search', label: 'User Search', icon: Search },
    { id: 'stats', label: 'Owner Stats', icon: TrendingUp },
    { id: 'grants', label: 'Recent Grants', icon: Gift }
  ];

  const getMembershipBadge = (membershipTier, isPremium, hasLifetime) => {
    if (hasLifetime) {
      return 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white';
    }
    if (isPremium) {
      return 'bg-gradient-to-r from-purple-500 to-pink-500 text-white';
    }
    return 'bg-gray-600 text-gray-300';
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-lg">
                <Crown className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Owner Control Panel</h1>
                <p className="text-sm text-gray-400">Your exclusive perks for creating the Savvy Universe</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={fetchStats}
                className="bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center space-x-2"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Refresh</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-yellow-500 text-yellow-400'
                      : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'search' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* Search Section */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-4">Search Users</h3>
              <div className="flex space-x-4">
                <div className="flex-1">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by username, email, or user ID..."
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                    onKeyPress={(e) => e.key === 'Enter' && searchUsers()}
                  />
                </div>
                <button
                  onClick={searchUsers}
                  disabled={loading}
                  className="bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 text-white font-medium py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center space-x-2"
                >
                  {loading ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  <span>Search</span>
                </button>
              </div>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="bg-gray-800 rounded-xl border border-gray-700">
                <div className="p-6 border-b border-gray-700">
                  <h3 className="text-lg font-semibold text-white">Search Results</h3>
                </div>
                <div className="divide-y divide-gray-700">
                  {searchResults.map((user) => (
                    <div key={user.id} className="p-6 hover:bg-gray-700/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                            <User className="h-6 w-6 text-white" />
                          </div>
                          <div>
                            <h4 className="text-lg font-semibold text-white">{user.username}</h4>
                            <p className="text-gray-400">{user.email}</p>
                            <div className="flex items-center space-x-4 mt-2">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getMembershipBadge(user.membershipTier, user.isPremium, user.hasLifetimeSub)}`}>
                                {user.hasLifetimeSub ? 'Lifetime' : user.membershipTier}
                              </span>
                              <span className="text-sm text-gray-400">
                                {user.pointsBalance.toLocaleString()} points
                              </span>
                              <span className="text-sm text-gray-400">
                                Member since {new Date(user.memberSince).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => fetchUserDetails(user.id)}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center space-x-2"
                        >
                          <Eye className="h-4 w-4" />
                          <span>View Details</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* User Details */}
            {selectedUser && (
              <div className="bg-gray-800 rounded-xl border border-gray-700">
                <div className="p-6 border-b border-gray-700">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">User Details</h3>
                    <button
                      onClick={() => setShowGrantModal(true)}
                      className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-all duration-300 transform hover:scale-105 flex items-center space-x-2"
                    >
                      <Gift className="h-4 w-4" />
                      <span>Grant Owner Perk</span>
                    </button>
                  </div>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="bg-gray-700 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-400 mb-2">Basic Info</h4>
                      <p className="text-white font-semibold">{selectedUser.username}</p>
                      <p className="text-gray-400 text-sm">{selectedUser.email}</p>
                      <p className="text-gray-400 text-sm">{selectedUser.role}</p>
                    </div>
                    
                    <div className="bg-gray-700 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-400 mb-2">Membership</h4>
                      <p className="text-white font-semibold">{selectedUser.membershipTier}</p>
                      <p className="text-gray-400 text-sm">
                        {selectedUser.hasLifetimeSub ? 'Lifetime' : 
                         selectedUser.subscriptionExpires ? 
                         `Expires ${new Date(selectedUser.subscriptionExpires).toLocaleDateString()}` : 
                         'No subscription'}
                      </p>
                    </div>
                    
                    <div className="bg-gray-700 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-400 mb-2">Points</h4>
                      <p className="text-white font-semibold">{selectedUser.pointsBalance.toLocaleString()}</p>
                      <p className="text-gray-400 text-sm">
                        {selectedUser.lifetimePointsEarned.toLocaleString()} lifetime
                      </p>
                    </div>
                    
                    <div className="bg-gray-700 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-400 mb-2">Member Since</h4>
                      <p className="text-white font-semibold">
                        {new Date(selectedUser.memberSince).toLocaleDateString()}
                      </p>
                      <p className="text-gray-400 text-sm">
                        Last active: {selectedUser.lastActive ? 
                        new Date(selectedUser.lastActive).toLocaleDateString() : 'Never'}
                      </p>
                    </div>
                    
                    <div className="bg-gray-700 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-400 mb-2">eBay Connected</h4>
                      <p className={`font-semibold ${selectedUser.ebayConnected ? 'text-green-400' : 'text-red-400'}`}>
                        {selectedUser.ebayConnected ? 'Yes' : 'No'}
                      </p>
                    </div>
                    
                    <div className="bg-gray-700 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-400 mb-2">Referral Code</h4>
                      <p className="text-white font-semibold">{selectedUser.referralCode}</p>
                      <p className="text-gray-400 text-sm">
                        Used: {selectedUser.referralCodeUsed || 'None'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'stats' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-400">Total Users</p>
                    <p className="text-2xl font-bold text-white">
                      {stats?.totalUsers || 0}
                    </p>
                  </div>
                  <Users className="h-8 w-8 text-blue-400" />
                </div>
              </div>

              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-400">Premium Users</p>
                    <p className="text-2xl font-bold text-purple-400">
                      {stats?.premiumUsers || 0}
                    </p>
                  </div>
                  <Star className="h-8 w-8 text-purple-400" />
                </div>
              </div>

              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-400">Lifetime Users</p>
                    <p className="text-2xl font-bold text-yellow-400">
                      {stats?.lifetimeUsers || 0}
                    </p>
                  </div>
                  <Crown className="h-8 w-8 text-yellow-400" />
                </div>
              </div>

              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-400">Points Granted</p>
                    <p className="text-2xl font-bold text-green-400">
                      {(stats?.totalOwnerGrants || 0).toLocaleString()}
                    </p>
                  </div>
                  <Gift className="h-8 w-8 text-green-400" />
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'grants' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            <div className="bg-gray-800 rounded-xl border border-gray-700">
              <div className="p-6 border-b border-gray-700">
                <h3 className="text-lg font-semibold text-white">Recent Owner Grants</h3>
              </div>
              <div className="p-6">
                {stats?.recentGrants?.length > 0 ? (
                  <div className="space-y-4">
                    {stats.recentGrants.map((grant, index) => (
                      <div key={index} className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
                        <div className="flex items-center space-x-4">
                          <div className={`p-2 rounded-lg ${
                            grant.type === 'points' ? 'bg-green-500/20 text-green-400' :
                            grant.type === 'lifetime_subscription' ? 'bg-yellow-500/20 text-yellow-400' :
                            grant.type === 'premium_subscription' ? 'bg-purple-500/20 text-purple-400' :
                            'bg-red-500/20 text-red-400'
                          }`}>
                            <Gift className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium text-white">{grant.username}</p>
                            <p className="text-gray-400 text-sm">
                              {grant.type.replace('_', ' ')} - {grant.reason}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-white font-medium">
                            {grant.amount ? `${grant.amount.toLocaleString()}` : 'N/A'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(grant.grantedAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-center py-8">No grants yet</p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Grant Modal */}
      {showGrantModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-md"
          >
            <div className="p-6 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white">Grant Owner Perk</h3>
              <p className="text-gray-400 text-sm">Give {selectedUser?.username} an owner perk</p>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Perk Type
                </label>
                <select
                  value={grantType}
                  onChange={(e) => setGrantType(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                >
                  <option value="points">Points</option>
                  <option value="lifetime">Lifetime Subscription</option>
                  <option value="premium">Premium Subscription</option>
                </select>
              </div>
              
              {grantType !== 'lifetime' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {grantType === 'points' ? 'Points Amount' : 'Duration (months)'}
                  </label>
                  <input
                    type="number"
                    value={grantAmount}
                    onChange={(e) => setGrantAmount(e.target.value)}
                    placeholder={grantType === 'points' ? '1000' : '12'}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  />
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Reason
                </label>
                <input
                  type="text"
                  value={grantReason}
                  onChange={(e) => setGrantReason(e.target.value)}
                  placeholder="Owner perk - special reward"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                />
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-700 flex space-x-4">
              <button
                onClick={() => setShowGrantModal(false)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-medium py-3 px-6 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleGrant}
                className="flex-1 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 text-white font-medium py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 flex items-center justify-center space-x-2"
              >
                <Gift className="h-4 w-4" />
                <span>Grant Perk</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default OwnerControlPanel;





