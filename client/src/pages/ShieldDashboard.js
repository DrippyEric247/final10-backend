import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Shield, 
  AlertTriangle, 
  Users, 
  Activity, 
  Eye, 
  CheckCircle, 
  XCircle, 
  Clock, 
  TrendingUp,
  AlertCircle,
  Zap,
  Lock,
  Unlock,
  Ban,
  UserCheck,
  BarChart3,
  Filter,
  Search,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const ShieldDashboard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [events, setEvents] = useState([]);
  const [enforcements, setEnforcements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    days: 7,
    risk_score_min: 0,
    app: 'all',
    status: 'all'
  });

  useEffect(() => {
    if (user?.role !== 'admin') {
      return;
    }
    fetchDashboardData();
  }, [user, filters]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch stats
      const statsResponse = await fetch(`/api/shield/stats?days=${filters.days}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const statsData = await statsResponse.json();
      setStats(statsData.stats);

      // Fetch events
      const eventsResponse = await fetch(`/api/shield/events?days=${filters.days}&limit=50`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const eventsData = await eventsResponse.json();
      setEvents(eventsData.events || []);

      // Fetch enforcements
      const enforcementsResponse = await fetch(`/api/shield/enforcements?days=${filters.days}&limit=50`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const enforcementsData = await enforcementsResponse.json();
      setEnforcements(enforcementsData.enforcements || []);

    } catch (error) {
      console.error('Error fetching Shield dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveEnforcement = async (enforcementId) => {
    try {
      const response = await fetch(`/api/shield/enforcements/${enforcementId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ notes: 'Approved via dashboard' })
      });

      if (response.ok) {
        await fetchDashboardData(); // Refresh data
      }
    } catch (error) {
      console.error('Error approving enforcement:', error);
    }
  };

  const handleRejectEnforcement = async (enforcementId) => {
    try {
      const response = await fetch(`/api/shield/enforcements/${enforcementId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ notes: 'Rejected via dashboard' })
      });

      if (response.ok) {
        await fetchDashboardData(); // Refresh data
      }
    } catch (error) {
      console.error('Error rejecting enforcement:', error);
    }
  };

  const handleStartProactive = async () => {
    try {
      const response = await fetch('/api/shield/start-proactive', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (response.ok) {
        alert('Proactive investigation system started!');
      }
    } catch (error) {
      console.error('Error starting proactive investigation:', error);
    }
  };

  if (user?.role !== 'superadmin') {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="text-gray-400">Superadmin access required for SavvyShield Dashboard</p>
          <p className="text-gray-500 text-sm mt-2">Only the system owner can control the AI fraud prevention system</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <RefreshCw className="animate-spin h-12 w-12 text-purple-500" />
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'events', label: 'Events', icon: Activity },
    { id: 'enforcements', label: 'Enforcements', icon: Shield },
    { id: 'investigation', label: 'Investigation', icon: Eye }
  ];

  const getRiskColor = (score) => {
    if (score >= 0.9) return 'text-red-500';
    if (score >= 0.75) return 'text-orange-500';
    if (score >= 0.6) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getRiskBadge = (score) => {
    if (score >= 0.9) return 'bg-red-500/20 text-red-400 border-red-500/30';
    if (score >= 0.75) return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    if (score >= 0.6) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    return 'bg-green-500/20 text-green-400 border-green-500/30';
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Shield className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold">SavvyShield Dashboard</h1>
                <p className="text-sm text-gray-400">AI-Powered Fraud Detection & Prevention</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={handleStartProactive}
                className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-all duration-300 transform hover:scale-105 flex items-center space-x-2"
              >
                <Zap className="h-4 w-4" />
                <span>Start Proactive</span>
              </button>
              
              <button
                onClick={fetchDashboardData}
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
                      ? 'border-purple-500 text-purple-400'
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
        {activeTab === 'overview' && (
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
                    <p className="text-sm font-medium text-gray-400">Total Events</p>
                    <p className="text-2xl font-bold text-white">
                      {stats?.events?.total_events || 0}
                    </p>
                  </div>
                  <Activity className="h-8 w-8 text-blue-400" />
                </div>
                <div className="mt-4">
                  <p className="text-xs text-gray-500">
                    Avg Risk: {(stats?.events?.avg_risk_score || 0).toFixed(3)}
                  </p>
                </div>
              </div>

              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-400">High Risk Events</p>
                    <p className="text-2xl font-bold text-red-400">
                      {stats?.events?.high_risk_events || 0}
                    </p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-red-400" />
                </div>
                <div className="mt-4">
                  <p className="text-xs text-gray-500">
                    {stats?.events?.total_events > 0 
                      ? `${((stats?.events?.high_risk_events / stats?.events?.total_events) * 100).toFixed(1)}% of total`
                      : '0% of total'
                    }
                  </p>
                </div>
              </div>

              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-400">Active Enforcements</p>
                    <p className="text-2xl font-bold text-orange-400">
                      {stats?.active_enforcements || 0}
                    </p>
                  </div>
                  <Shield className="h-8 w-8 text-orange-400" />
                </div>
                <div className="mt-4">
                  <p className="text-xs text-gray-500">
                    {stats?.enforcement?.total_enforcements || 0} total
                  </p>
                </div>
              </div>

              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-400">Overdue Reviews</p>
                    <p className="text-2xl font-bold text-yellow-400">
                      {stats?.overdue_reviews || 0}
                    </p>
                  </div>
                  <Clock className="h-8 w-8 text-yellow-400" />
                </div>
                <div className="mt-4">
                  <p className="text-xs text-gray-500">
                    Requires attention
                  </p>
                </div>
              </div>
            </div>

            {/* Recent High Risk Events */}
            <div className="bg-gray-800 rounded-xl border border-gray-700">
              <div className="p-6 border-b border-gray-700">
                <h3 className="text-lg font-semibold text-white">Recent High Risk Events</h3>
              </div>
              <div className="p-6">
                {events.filter(e => e.risk_score >= 0.8).slice(0, 5).length > 0 ? (
                  <div className="space-y-4">
                    {events.filter(e => e.risk_score >= 0.8).slice(0, 5).map((event) => (
                      <div key={event._id} className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
                        <div className="flex items-center space-x-4">
                          <div className={`p-2 rounded-lg ${getRiskBadge(event.risk_score)}`}>
                            <AlertTriangle className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium text-white">{event.event_type}</p>
                            <p className="text-sm text-gray-400">
                              User: {event.savvy_user_id} | App: {event.app} | Level: {event.level}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold ${getRiskColor(event.risk_score)}`}>
                            {(event.risk_score * 100).toFixed(1)}%
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(event.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-center py-8">No high risk events in the selected period</p>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'events' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="bg-gray-800 rounded-xl border border-gray-700">
              <div className="p-6 border-b border-gray-700">
                <h3 className="text-lg font-semibold text-white">Shield Events</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Event
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        App
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Risk Score
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Time
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {events.map((event) => (
                      <tr key={event._id} className="hover:bg-gray-700/50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <div className={`p-1 rounded ${getRiskBadge(event.risk_score)}`}>
                              <Activity className="h-3 w-3" />
                            </div>
                            <span className="text-sm font-medium text-white">
                              {event.event_type.replace('_', ' ')}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-300">
                            {event.savvy_user_id}
                          </div>
                          <div className="text-xs text-gray-500">
                            {event.level}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-300">{event.app}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`font-bold ${getRiskColor(event.risk_score)}`}>
                            {(event.risk_score * 100).toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            event.investigation_status === 'resolved' ? 'bg-green-500/20 text-green-400' :
                            event.investigation_status === 'investigating' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            {event.investigation_status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                          {new Date(event.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'enforcements' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="bg-gray-800 rounded-xl border border-gray-700">
              <div className="p-6 border-b border-gray-700">
                <h3 className="text-lg font-semibold text-white">Enforcements</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Decision
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Risk Score
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Review
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {enforcements.map((enforcement) => (
                      <tr key={enforcement._id} className="hover:bg-gray-700/50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <div className={`p-1 rounded ${
                              enforcement.decision === 'auto_block' ? 'bg-red-500/20 text-red-400' :
                              enforcement.decision === 'temp_suspend' ? 'bg-orange-500/20 text-orange-400' :
                              enforcement.decision === 'soft_restrict' ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-green-500/20 text-green-400'
                            }`}>
                              <Shield className="h-3 w-3" />
                            </div>
                            <span className="text-sm font-medium text-white">
                              {enforcement.decision.replace('_', ' ')}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-300">
                            {enforcement.savvy_user_id}
                          </div>
                          <div className="text-xs text-gray-500">
                            {enforcement.level}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`font-bold ${getRiskColor(enforcement.risk_score)}`}>
                            {(enforcement.risk_score * 100).toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            enforcement.status === 'active' ? 'bg-red-500/20 text-red-400' :
                            enforcement.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            {enforcement.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            enforcement.human_review?.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                            enforcement.human_review?.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                            'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {enforcement.human_review?.status || 'pending'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex space-x-2">
                            {enforcement.human_review?.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => handleApproveEnforcement(enforcement._id)}
                                  className="p-1 bg-green-600 hover:bg-green-700 rounded text-white"
                                  title="Approve"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleRejectEnforcement(enforcement._id)}
                                  className="p-1 bg-red-600 hover:bg-red-700 rounded text-white"
                                  title="Reject"
                                >
                                  <XCircle className="h-4 w-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'investigation' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="bg-gray-800 rounded-xl border border-gray-700">
              <div className="p-6 border-b border-gray-700">
                <h3 className="text-lg font-semibold text-white">Proactive Investigation</h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="text-md font-semibold text-white">Investigation Rules</h4>
                    <div className="space-y-3">
                      {[
                        'Device Reuse Detection',
                        'Velocity Spike Detection',
                        'Impossible Travel Detection',
                        'Win Rate Anomaly Detection',
                        'Payment Risk Detection',
                        'Bot Behavior Detection',
                        'IP Reputation Detection',
                        'Behavioral Pattern Detection'
                      ].map((rule, index) => (
                        <div key={index} className="flex items-center space-x-3">
                          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                          <span className="text-sm text-gray-300">{rule}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <h4 className="text-md font-semibold text-white">System Status</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-300">Proactive Investigation</span>
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-500/20 text-green-400">
                          Active
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-300">AI Analysis</span>
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-500/20 text-green-400">
                          Running
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-300">Auto-Enforcement</span>
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-500/20 text-yellow-400">
                          Review Mode
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default ShieldDashboard;
