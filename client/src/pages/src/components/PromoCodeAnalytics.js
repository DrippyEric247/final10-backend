import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  Users, 
  DollarSign, 
  Tag, 
  Calendar,
  BarChart3,
  PieChart,
  Download,
  Filter
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart as RechartsPieChart, Cell } from 'recharts';
import promoCodeService from '../services/promoCodeService';

const PromoCodeAnalytics = ({ isAdmin = false, creatorId = null }) => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30d');
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange, isAdmin, creatorId]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      
      let response;
      if (isAdmin) {
        response = await promoCodeService.getAdminAnalytics();
      } else {
        response = await promoCodeService.getCreatorStats();
      }
      
      setAnalytics(response.data);
      
      // Generate chart data based on date range
      generateChartData(response.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateChartData = (data) => {
    // This would typically come from your API with proper date aggregation
    // For now, we'll generate sample data
    const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
    const chartData = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      chartData.push({
        date: date.toISOString().split('T')[0],
        usage: Math.floor(Math.random() * 20) + 5,
        revenue: Math.floor(Math.random() * 1000) + 200,
        commissions: Math.floor(Math.random() * 100) + 50
      });
    }
    
    setChartData(chartData);
  };

  const COLORS = ['#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#3B82F6'];

  const exportData = () => {
    if (!analytics) return;
    
    const dataToExport = {
      dateRange,
      generatedAt: new Date().toISOString(),
      ...analytics
    };
    
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `promo-code-analytics-${dateRange}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-12">
        <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Analytics Data</h3>
        <p className="text-gray-600">Analytics data will appear here once you start using promo codes.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h2>
          <p className="text-gray-600">Track your promo code performance</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          
          <button
            onClick={exportData}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            <Download className="h-4 w-4" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg shadow p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Codes</p>
              <p className="text-2xl font-bold text-gray-900">
                {analytics.promoStats?.totalCodes || analytics.overview?.totalCodes || 0}
              </p>
              <p className="text-xs text-gray-500">
                {analytics.promoStats?.activeCodes || analytics.overview?.activeCodes || 0} active
              </p>
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
              <p className="text-sm font-medium text-gray-600">Total Usage</p>
              <p className="text-2xl font-bold text-gray-900">
                {analytics.promoStats?.totalUsage || analytics.overview?.totalUsage || 0}
              </p>
              <p className="text-xs text-gray-500">code redemptions</p>
            </div>
            <Users className="h-8 w-8 text-blue-600" />
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
              <p className="text-sm font-medium text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900">
                ${(analytics.promoStats?.totalRevenue || analytics.overview?.totalRevenue || 0).toFixed(2)}
              </p>
              <p className="text-xs text-gray-500">from promo codes</p>
            </div>
            <DollarSign className="h-8 w-8 text-green-600" />
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
              <p className="text-sm font-medium text-gray-600">Total Commission</p>
              <p className="text-2xl font-bold text-gray-900">
                ${(analytics.promoStats?.totalCommission || analytics.overview?.totalCommission || 0).toFixed(2)}
              </p>
              <p className="text-xs text-gray-500">earned</p>
            </div>
            <TrendingUp className="h-8 w-8 text-yellow-600" />
          </div>
        </motion.div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Usage Trend Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-lg shadow p-6"
        >
          <h3 className="text-lg font-medium text-gray-900 mb-4">Usage Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="usage" stroke="#8B5CF6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Revenue Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-lg shadow p-6"
        >
          <h3 className="text-lg font-medium text-gray-900 mb-4">Revenue Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="revenue" fill="#10B981" />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Top Performing Codes */}
      {analytics.topCodes && analytics.topCodes.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white rounded-lg shadow p-6"
        >
          <h3 className="text-lg font-medium text-gray-900 mb-4">Top Performing Codes</h3>
          <div className="space-y-3">
            {analytics.topCodes.slice(0, 10).map((code, index) => (
              <div key={code._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
                  <div>
                    <p className="font-medium text-gray-900">{code.code}</p>
                    <p className="text-sm text-gray-500">by {code.creator?.username}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{code.usageCount} uses</p>
                  <p className="text-sm text-gray-500">${code.totalRevenue.toFixed(2)} revenue</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Commission Breakdown */}
      {analytics.earnings && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-white rounded-lg shadow p-6"
        >
          <h3 className="text-lg font-medium text-gray-900 mb-4">Commission Breakdown</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {analytics.earnings.map((earning, index) => (
              <div key={earning._id} className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-600 capitalize">{earning._id}</p>
                <p className="text-xl font-bold text-gray-900">
                  ${earning.totalAmount?.toFixed(2) || '0.00'}
                </p>
                <p className="text-xs text-gray-500">{earning.count} transactions</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default PromoCodeAnalytics;







