import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Crown, 
  Search, 
  Users, 
  Gift, 
  Star, 
  TrendingUp,
  RefreshCw,
  History,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { STORAGE_KEY } from '../lib/api';
import { buildApiUrl } from '../lib/runtimeApi';
import { hasAdminRole } from '../lib/adminAccess';
import OwnerSearchUserCard from '../components/owner/OwnerSearchUserCard';
import {
  loadOwnerSearchHistory,
  saveOwnerSearchHistory,
  clearOwnerSearchHistory,
} from '../lib/ownerSearchHistory';

function getAuthToken() {
  return localStorage.getItem(STORAGE_KEY) || localStorage.getItem('token') || '';
}

function ownerAuthHeaders(extra = {}) {
  const token = getAuthToken();
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

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
  const [searchError, setSearchError] = useState('');
  const [recentSearches, setRecentSearches] = useState([]);
  const [showMembershipModal, setShowMembershipModal] = useState(false);
  const [membershipTierEdit, setMembershipTierEdit] = useState('premium');
  const [membershipMonths, setMembershipMonths] = useState('12');
  const [membershipReason, setMembershipReason] = useState('Owner membership update');
  const profileDetailsRef = useRef(null);

  const ownerAccountId = String(user?.id || user?._id || '');

  useEffect(() => {
    if (!hasAdminRole(user)) {
      return;
    }
    fetchStats();
    if (ownerAccountId) {
      setRecentSearches(loadOwnerSearchHistory(ownerAccountId));
    }
  }, [user, ownerAccountId]);

  const patchSearchResult = useCallback((userId, patch) => {
    setSearchResults((prev) =>
      prev.map((row) => (String(row.id) === String(userId) ? { ...row, ...patch } : row))
    );
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch(buildApiUrl('/owner/stats'), {
        headers: ownerAuthHeaders(),
      });
      const data = await response.json();
      setStats(data.stats);
    } catch (error) {
      console.error('Error fetching owner stats:', error);
    }
  };

  const searchUsers = async (queryOverride) => {
    const q = String(queryOverride ?? searchQuery).trim();
    if (!q) return;
    if (queryOverride) setSearchQuery(q);

    setLoading(true);
    setSearchError('');
    setSearchResults([]);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(
        buildApiUrl(`/owner/search-users?query=${encodeURIComponent(q)}`),
        {
          headers: ownerAuthHeaders(),
          signal: controller.signal,
        }
      );

      let data = {};
      try {
        data = await response.json();
      } catch {
        throw new Error('Server returned an invalid response. Try again in a moment.');
      }

      if (!response.ok) {
        setSearchError(data.message || `Search failed (${response.status})`);
        return;
      }

      const users = data.users || [];
      setSearchResults(users);
      if (ownerAccountId) {
        setRecentSearches(
          saveOwnerSearchHistory(ownerAccountId, {
            query: q,
            resultCount: users.length,
            users,
          })
        );
      }
      if (users.length === 0) {
        setSearchError('No users found for that query.');
      }
    } catch (error) {
      const isAbort = error?.name === 'AbortError';
      const raw = String(error?.message || '');
      const isNetwork =
        isAbort ||
        raw === 'Failed to fetch' ||
        /network|fetch|http2|protocol/i.test(raw);
      const message = isAbort
        ? 'Search timed out after 8 seconds. Use a full email address and try again.'
        : isNetwork
          ? 'Could not reach the server (network or HTTP/2 error). Redeploy may be required — try a full email search again.'
          : raw || 'Search failed. Try again with a full email address.';
      setSearchError(message);
      console.error('Error searching users:', error);
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  const fetchUserDetails = async (userId) => {
    try {
      const response = await fetch(buildApiUrl(`/owner/user/${userId}`), {
        headers: ownerAuthHeaders(),
      });
      const data = await response.json();
      setSelectedUser(data.user);
      return data.user;
    } catch (error) {
      console.error('Error fetching user details:', error);
      return null;
    }
  };

  const handleViewFullProfile = async (row) => {
    setSelectedUser(row);
    await fetchUserDetails(row.id);
    setTimeout(() => {
      profileDetailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  };

  const handleGrantSavvy = (row) => {
    setSelectedUser(row);
    setGrantType('points');
    setGrantAmount('');
    setGrantReason('Owner Savvy grant');
    setShowGrantModal(true);
  };

  const handleEditMembership = (row) => {
    setSelectedUser(row);
    setMembershipTierEdit(row.hasLifetimeSub ? 'pro' : row.membershipTier || 'free');
    setMembershipMonths(row.hasLifetimeSub ? '0' : '12');
    setMembershipReason('Owner membership update');
    setShowMembershipModal(true);
  };

  const handleBanUser = async (row) => {
    const reason = window.prompt(`Ban reason for ${row.username}:`, 'Owner ban');
    if (reason === null) return;
    try {
      const response = await fetch(buildApiUrl('/owner/ban-user'), {
        method: 'POST',
        headers: ownerAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ userId: row.id, reason }),
      });
      const data = await response.json();
      if (data.success) {
        patchSearchResult(row.id, { isBanned: true });
        alert(`Banned ${row.username}`);
      } else {
        alert(data.message || 'Ban failed');
      }
    } catch (error) {
      console.error('Ban user error:', error);
      alert('Failed to ban user');
    }
  };

  const handleUnbanUser = async (row) => {
    if (!window.confirm(`Unban ${row.username}?`)) return;
    try {
      const response = await fetch(buildApiUrl('/owner/unban-user'), {
        method: 'POST',
        headers: ownerAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ userId: row.id }),
      });
      const data = await response.json();
      if (data.success) {
        patchSearchResult(row.id, { isBanned: false });
        alert(`Unbanned ${row.username}`);
      } else {
        alert(data.message || 'Unban failed');
      }
    } catch (error) {
      console.error('Unban user error:', error);
      alert('Failed to unban user');
    }
  };

  const handleUpdateMembership = async () => {
    if (!selectedUser) return;
    try {
      const response = await fetch(buildApiUrl('/owner/update-membership'), {
        method: 'POST',
        headers: ownerAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          userId: selectedUser.id,
          membershipTier: membershipTierEdit,
          durationMonths: parseInt(membershipMonths, 10),
          reason: membershipReason,
        }),
      });
      const data = await response.json();
      if (data.success) {
        alert(data.message);
        setShowMembershipModal(false);
        const updated = data.user || {};
        patchSearchResult(selectedUser.id, {
          membershipTier: updated.membershipTier,
          isPremium: updated.isPremium,
          hasLifetimeSub: updated.hasLifetimeSub,
        });
        fetchUserDetails(selectedUser.id);
        fetchStats();
      } else {
        alert(data.message || 'Update failed');
      }
    } catch (error) {
      console.error('Update membership error:', error);
      alert('Failed to update membership');
    }
  };

  const applyHistoryEntry = async (entry) => {
    setSearchError('');
    if (entry.users?.length) {
      setSearchQuery(entry.query);
      setSearchResults(entry.users);
      return;
    }
    await searchUsers(entry.query);
  };

  const revokeFoundingAccess = async () => {
    if (!selectedUser) return;
    if (!window.confirm(`Revoke Founding Tester access for ${selectedUser.username}?`)) return;
    try {
      const response = await fetch(buildApiUrl('/owner/revoke-founding-access'), {
        method: 'POST',
        headers: ownerAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          email: selectedUser.email,
          reason: grantReason || 'Owner revoked Founding Tester access',
        }),
      });
      const data = await response.json();
      if (data.success) {
        alert(`✅ ${data.message}`);
        fetchUserDetails(selectedUser.id);
        fetchStats();
      } else {
        alert(`❌ ${data.message || 'Failed to revoke'}`);
      }
    } catch (error) {
      console.error('Error revoking founding access:', error);
      alert('❌ Failed to revoke founding access');
    }
  };

  const handleGrant = async () => {
    if (!selectedUser) return;
    if ((grantType === 'points' || grantType === 'premium') && !grantAmount) return;
    if (grantType === 'revoke_founding') {
      await revokeFoundingAccess();
      setShowGrantModal(false);
      return;
    }
    
    try {
      let endpoint = '';
      let payload = { userId: selectedUser.id, reason: grantReason };
      
      switch (grantType) {
        case 'points':
          endpoint = buildApiUrl('/owner/grant-points');
          payload.points = parseInt(grantAmount);
          break;
        case 'lifetime':
          endpoint = buildApiUrl('/owner/grant-lifetime-subscription');
          break;
        case 'premium':
          endpoint = buildApiUrl('/owner/grant-premium-subscription');
          payload.durationMonths = parseInt(grantAmount);
          break;
        case 'founding':
          endpoint = buildApiUrl('/owner/grant-founding-access');
          payload.email = selectedUser.email;
          payload.betaTester = true;
          payload.foundingAccess = true;
          break;
        default:
          return;
      }
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: ownerAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert(`✅ ${data.message}`);
        setShowGrantModal(false);
        setGrantAmount('');
        setGrantReason('');
        if (data.user) {
          const earned = data.user.newLifetimePoints;
          patchSearchResult(selectedUser.id, {
            pointsBalance: data.user.newPointsBalance ?? data.user.pointsBalance,
            lifetimePointsEarned: earned,
            totalSavvyEarned: earned,
            savvyPoints: earned,
          });
        }
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

  if (!hasAdminRole(user)) {
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
              {searchError ? (
                <p
                  className="mt-4 rounded-lg border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-200"
                  role="alert"
                >
                  {searchError}
                </p>
              ) : null}

              {recentSearches.length > 0 && (
                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-500">
                      <History className="h-3.5 w-3.5" />
                      Recent searches
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        clearOwnerSearchHistory(ownerAccountId);
                        setRecentSearches([]);
                      }}
                      className="text-xs text-gray-500 hover:text-gray-300"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recentSearches.map((entry) => (
                      <button
                        key={`${entry.query}-${entry.searchedAt}`}
                        type="button"
                        onClick={() => applyHistoryEntry(entry)}
                        className="rounded-full border border-gray-600 bg-gray-700/80 px-3 py-1 text-xs text-gray-200 hover:border-yellow-500/50 hover:text-yellow-200"
                      >
                        {entry.query}
                        <span className="ml-1 text-gray-500">({entry.resultCount})</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Search Results — instant card grid */}
            {searchResults.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.15 }}
                className="space-y-4"
              >
                <h3 className="text-lg font-semibold text-white">
                  Results ({searchResults.length})
                </h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {searchResults.map((row) => (
                    <OwnerSearchUserCard
                      key={row.id}
                      user={row}
                      onGrantSavvy={handleGrantSavvy}
                      onEditMembership={handleEditMembership}
                      onBanUser={handleBanUser}
                      onUnbanUser={handleUnbanUser}
                      onViewProfile={handleViewFullProfile}
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {/* User Details */}
            {selectedUser && (
              <div
                ref={profileDetailsRef}
                className="bg-gray-800 rounded-xl border border-gray-700"
              >
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
                      <p className="text-white font-semibold">
                        {Number(selectedUser.pointsBalance || 0).toLocaleString()}
                      </p>
                      <p className="text-gray-400 text-sm">
                        {Number(selectedUser.lifetimePointsEarned || 0).toLocaleString()} lifetime
                      </p>
                    </div>
                    
                    <div className="bg-gray-700 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-400 mb-2">Founding Tester</h4>
                      <p className="text-white font-semibold">
                        {selectedUser.betaTester || selectedUser.foundingAccess ? 'Active' : 'Off'}
                      </p>
                      <p className="text-gray-400 text-sm">
                        {selectedUser.betaAccessExpiresAt
                          ? `Expires ${new Date(selectedUser.betaAccessExpiresAt).toLocaleDateString()}`
                          : selectedUser.betaTester || selectedUser.foundingAccess
                            ? 'No expiry — unlimited access'
                            : 'Standard limits apply'}
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

      {/* Membership Modal */}
      {showMembershipModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-800"
          >
            <div className="flex items-center justify-between border-b border-gray-700 p-6">
              <div>
                <h3 className="text-lg font-semibold text-white">Edit Membership</h3>
                <p className="text-sm text-gray-400">{selectedUser.username}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowMembershipModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 p-6">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">Tier</label>
                <select
                  value={membershipTierEdit}
                  onChange={(e) => setMembershipTierEdit(e.target.value)}
                  className="w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-3 text-white"
                >
                  <option value="free">Free</option>
                  <option value="premium">Premium</option>
                  <option value="pro">Pro</option>
                </select>
              </div>
              {membershipTierEdit !== 'free' && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">
                    Duration (months, 0 = lifetime for Pro)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={membershipMonths}
                    onChange={(e) => setMembershipMonths(e.target.value)}
                    className="w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-3 text-white"
                  />
                </div>
              )}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">Reason</label>
                <input
                  type="text"
                  value={membershipReason}
                  onChange={(e) => setMembershipReason(e.target.value)}
                  className="w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-3 text-white"
                />
              </div>
            </div>
            <div className="flex gap-4 border-t border-gray-700 p-6">
              <button
                type="button"
                onClick={() => setShowMembershipModal(false)}
                className="flex-1 rounded-lg bg-gray-700 py-3 font-medium text-white hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdateMembership}
                className="flex-1 rounded-lg bg-violet-600 py-3 font-medium text-white hover:bg-violet-500"
              >
                Save
              </button>
            </div>
          </motion.div>
        </div>
      )}

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
                  <option value="founding">Enable Founding Tester</option>
                  <option value="revoke_founding">Disable Founding Tester</option>
                </select>
              </div>
              
              {grantType !== 'lifetime' && grantType !== 'founding' && (
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






