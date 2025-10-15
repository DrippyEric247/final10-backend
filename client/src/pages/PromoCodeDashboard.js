import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Plus, 
  Eye, 
  Edit, 
  Trash2, 
  Copy, 
  ExternalLink,
  TrendingUp,
  Users,
  DollarSign,
  Calendar,
  Tag,
  BarChart3,
  Filter,
  Search
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/authService';
import PromoCodeCreator from '../components/PromoCodeCreator';

const PromoCodeDashboard = () => {
  const { user } = useAuth();
  const [promoCodes, setPromoCodes] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreator, setShowCreator] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    fetchPromoCodes();
    fetchStats();
  }, []);

  const fetchPromoCodes = async () => {
    try {
      const response = await api.get('/promo-codes/creator/my-codes');
      setPromoCodes(response.data);
    } catch (error) {
      console.error('Error fetching promo codes:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/promo-codes/creator/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleCodeCreated = (newCode) => {
    setPromoCodes(prev => [newCode, ...prev]);
    setShowCreator(false);
    fetchStats(); // Refresh stats
  };

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    // You could add a toast notification here
  };

  const handleGenerateLink = (code) => {
    const link = `${window.location.origin}/register?promo=${code}`;
    navigator.clipboard.writeText(link);
    // You could add a toast notification here
  };

  const filteredCodes = promoCodes.filter(code => {
    const matchesSearch = code.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         code.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterStatus === 'all' || 
                         (filterStatus === 'active' && code.isActive && !code.isExpired) ||
                         (filterStatus === 'expired' && code.isExpired) ||
                         (filterStatus === 'inactive' && !code.isActive);
    
    return matchesSearch && matchesFilter;
  });

  const formatDiscount = (code) => {
    if (code.discountType === 'percentage') {
      return `${code.discountValue}% off`;
    } else if (code.discountType === 'fixed') {
      return `$${code.discountValue} off`;
    } else if (code.discountType === 'free_shipping') {
      return 'Free Shipping';
    }
    return 'Discount';
  };

  const getStatusBadge = (code) => {
    if (!code.isActive) {
      return <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">Inactive</span>;
    }
    if (code.isExpired) {
      return <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">Expired</span>;
    }
    if (code.isFullyUsed) {
      return <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">Fully Used</span>;
    }
    return <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">Active</span>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Promo Code Dashboard</h1>
          <p className="text-gray-600 mt-1">Manage your promo codes and track performance</p>
        </div>
        <button
          onClick={() => setShowCreator(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <Plus className="h-5 w-5" />
          <span>Create Code</span>
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-lg shadow p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Codes</p>
                <p className="text-2xl font-bold text-gray-900">{stats.promoStats.totalCodes}</p>
              </div>
              <Tag className="h-8 w-8 text-purple-600" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-lg shadow p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Codes</p>
                <p className="text-2xl font-bold text-gray-900">{stats.promoStats.activeCodes}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-lg shadow p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Usage</p>
                <p className="text-2xl font-bold text-gray-900">{stats.promoStats.totalUsage}</p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-lg shadow p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900">${stats.promoStats.totalRevenue.toFixed(2)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-yellow-600" />
            </div>
          </motion.div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search codes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Codes</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          
          <div className="text-sm text-gray-600">
            {filteredCodes.length} of {promoCodes.length} codes
          </div>
        </div>
      </div>

      {/* Promo Codes List */}
      <div className="bg-white rounded-lg shadow">
        {filteredCodes.length === 0 ? (
          <div className="text-center py-12">
            <Tag className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No promo codes found</h3>
            <p className="text-gray-600 mb-4">
              {promoCodes.length === 0 
                ? "You haven't created any promo codes yet."
                : "No codes match your current filters."
              }
            </p>
            {promoCodes.length === 0 && (
              <button
                onClick={() => setShowCreator(true)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Create Your First Code
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredCodes.map((code, index) => (
              <motion.div
                key={code._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-6 hover:bg-gray-50"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{code.code}</h3>
                      {getStatusBadge(code)}
                    </div>
                    <p className="text-gray-600 mb-3">{code.description}</p>
                    
                    <div className="flex items-center space-x-6 text-sm text-gray-500">
                      <div className="flex items-center space-x-1">
                        <Tag className="h-4 w-4" />
                        <span>{formatDiscount(code)}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Users className="h-4 w-4" />
                        <span>{code.usageCount} uses</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <DollarSign className="h-4 w-4" />
                        <span>${code.totalRevenue.toFixed(2)} revenue</span>
                      </div>
                      {code.validUntil && (
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-4 w-4" />
                          <span>Expires {new Date(code.validUntil).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleCopyCode(code.code)}
                      className="p-2 text-gray-400 hover:text-gray-600"
                      title="Copy code"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleGenerateLink(code.code)}
                      className="p-2 text-gray-400 hover:text-gray-600"
                      title="Copy referral link"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </button>
                    <button
                      className="p-2 text-gray-400 hover:text-gray-600"
                      title="View details"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      className="p-2 text-gray-400 hover:text-gray-600"
                      title="Edit code"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                
                {/* Progress bar for usage */}
                {code.usageLimit && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                      <span>Usage Progress</span>
                      <span>{code.usageCount} / {code.usageLimit}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-purple-600 h-2 rounded-full"
                        style={{ width: `${(code.usageCount / code.usageLimit) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Promo Code Creator Modal */}
      {showCreator && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <PromoCodeCreator
            onCodeCreated={handleCodeCreated}
            onCancel={() => setShowCreator(false)}
          />
        </div>
      )}
    </div>
  );
};

export default PromoCodeDashboard;








