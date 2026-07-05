import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Plus,
  Trash2,
  Gift,
  Users,
  DollarSign,
  Film,
} from 'lucide-react';
import easterEggService from '../services/easterEggService';

const EasterEggAdmin = () => {
  const [stats, setStats] = useState(null);
  const [trailerRedemptions, setTrailerRedemptions] = useState([]);
  const [trailerFilter, setTrailerFilter] = useState('BETA247');
  const [newCode, setNewCode] = useState({
    code: '',
    points: '',
    name: '',
    icon: '🎁',
    description: '',
    category: 'special',
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    fetchTrailerRedemptions();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await easterEggService.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching easter egg stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTrailerRedemptions = async (code = trailerFilter) => {
    try {
      const response = await easterEggService.getTrailerRedemptions({
        code: code || undefined,
        limit: 200,
      });
      setTrailerRedemptions(response.data?.redemptions || []);
    } catch (error) {
      console.error('Error fetching trailer redemptions:', error);
    }
  };

  const handleAddCode = async (e) => {
    e.preventDefault();

    try {
      await easterEggService.addCode(newCode);
      setNewCode({
        code: '',
        points: '',
        name: '',
        icon: '🎁',
        description: '',
        category: 'special',
      });
      setShowAddForm(false);
      fetchStats();
    } catch (error) {
      console.error('Error adding easter egg code:', error);
    }
  };

  const handleRemoveCode = async (code) => {
    if (window.confirm(`Are you sure you want to remove the easter egg code "${code}"?`)) {
      try {
        await easterEggService.removeCode(code);
        fetchStats();
      } catch (error) {
        console.error('Error removing easter egg code:', error);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    );
  }

  const trailerStats = stats?.trailerPromo;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Trailer & Easter Egg Codes</h1>
          <p className="text-gray-600 mt-1">
            Hidden trailer promos (BETA247+) and legacy Savvy easter eggs
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          <Plus className="h-5 w-5" />
          <span>Add Legacy Code</span>
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Legacy Redemptions</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalRedemptions}</p>
              </div>
              <Gift className="h-8 w-8 text-purple-600" />
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
                <p className="text-sm font-medium text-gray-600">Trailer Redemptions</p>
                <p className="text-2xl font-bold text-gray-900">{trailerStats?.totalRedemptions || 0}</p>
              </div>
              <Film className="h-8 w-8 text-fuchsia-600" />
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
                <p className="text-sm font-medium text-gray-600">Savvy Awarded</p>
                <p className="text-2xl font-bold text-gray-900">
                  {((stats.totalPointsAwarded || 0) + (trailerStats?.totalSavvyAwarded || 0)).toLocaleString()}
                </p>
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
                <p className="text-sm font-medium text-gray-600">Unique Users</p>
                <p className="text-2xl font-bold text-gray-900">
                  {(stats.uniqueUsers || 0) + (trailerStats?.uniqueUsers || 0)}
                </p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </motion.div>
        </div>
      )}

      {trailerStats?.codeStats?.length ? (
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Trailer Code Performance</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Redemptions</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Savvy</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cards</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Drops</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {trailerStats.codeStats.map((row) => (
                  <tr key={row.code}>
                    <td className="px-4 py-3 font-mono text-sm">{row.code}</td>
                    <td className="px-4 py-3 text-sm">{row.redemptions}</td>
                    <td className="px-4 py-3 text-sm">{row.totalSavvyAwarded}</td>
                    <td className="px-4 py-3 text-sm">{row.callingCardsGranted}</td>
                    <td className="px-4 py-3 text-sm">{row.supplyDropsGranted}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-lg font-medium text-gray-900">Trailer Redemption Log</h3>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={trailerFilter}
              onChange={(e) => setTrailerFilter(e.target.value.toUpperCase())}
              placeholder="Filter code"
              className="px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
            />
            <button
              type="button"
              onClick={() => fetchTrailerRedemptions(trailerFilter)}
              className="px-3 py-2 bg-purple-600 text-white rounded-md text-sm hover:bg-purple-700"
            >
              Refresh
            </button>
          </div>
        </div>
        <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">When</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rewards</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {trailerRedemptions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No trailer redemptions yet.
                  </td>
                </tr>
              ) : (
                trailerRedemptions.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                      {row.redeemedAt ? new Date(row.redeemedAt).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold">{row.code}</td>
                    <td className="px-4 py-3">{row.username || row.userId}</td>
                    <td className="px-4 py-3">{row.email || '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs">{row.ipAddress || '—'}</td>
                    <td className="px-4 py-3 text-xs">
                      +{row.savvyAmount || 0} Savvy
                      {row.callingCardGranted ? ' · Card' : ''}
                      {row.supplyDropId ? ' · Drop' : ''}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {stats?.codeStats && (
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Legacy Easter Egg Performance</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Points</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Redemptions</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Points</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {stats.codeStats.map((codeStat) => (
                  <tr key={codeStat.code} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-mono text-sm font-medium text-gray-900">{codeStat.code}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{codeStat.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{codeStat.points}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{codeStat.redemptions}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {codeStat.totalPointsAwarded.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        type="button"
                        onClick={() => handleRemoveCode(codeStat.code)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full"
          >
            <h3 className="text-lg font-medium text-gray-900 mb-4">Add Legacy Easter Egg Code</h3>
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3 mb-4">
              Trailer promos like BETA247 are configured in <code>server/config/trailerPromoCodes.js</code>.
            </p>

            <form onSubmit={handleAddCode} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Code</label>
                <input
                  type="text"
                  value={newCode.code}
                  onChange={(e) => setNewCode({ ...newCode, code: e.target.value.toUpperCase() })}
                  placeholder="TRAILER2024"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                <input
                  type="text"
                  value={newCode.name}
                  onChange={(e) => setNewCode({ ...newCode, name: e.target.value })}
                  placeholder="Trailer Master"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Points</label>
                <input
                  type="number"
                  value={newCode.points}
                  onChange={(e) => setNewCode({ ...newCode, points: e.target.value })}
                  placeholder="500"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <div className="flex items-center justify-end space-x-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700">
                  Add Code
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default EasterEggAdmin;
