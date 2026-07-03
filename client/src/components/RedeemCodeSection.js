import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Gift,
  Key,
  CheckCircle,
  XCircle,
  Star,
  Sparkles,
  Trophy,
  Zap,
  Crown,
} from 'lucide-react';
import api from '../services/authService';
import easterEggService from '../services/easterEggService';
import Final10SocialLinks from './Final10SocialLinks';

const RedeemCodeSection = ({ onPointsEarned }) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [recentRedemptions, setRecentRedemptions] = useState([]);
  const [availableHints, setAvailableHints] = useState([]);

  useEffect(() => {
    let cancelled = false;

    async function loadServerState() {
      try {
        const [historyRes, availableRes] = await Promise.all([
          easterEggService.getHistory(),
          easterEggService.getAvailable(),
        ]);
        if (cancelled) return;

        const history = Array.isArray(historyRes?.data?.redemptions)
          ? historyRes.data.redemptions
          : [];
        setRecentRedemptions(
          history.slice(0, 5).map((r) => ({
            code: r.code,
            points: r.points,
            name: r.name,
            timestamp: r.redeemedAt ? new Date(r.redeemedAt) : new Date(),
            icon: r.icon || '🎁',
          }))
        );

        const hints = Array.isArray(availableRes?.data?.available)
          ? availableRes.data.available
          : [];
        setAvailableHints(hints);
      } catch {
        /* logged out or offline */
      }
    }

    loadServerState();
    return () => {
      cancelled = true;
    };
  }, []);

  const getPointsIcon = (points) => {
    if (points >= 1000) return Crown;
    if (points >= 500) return Trophy;
    if (points >= 250) return Star;
    if (points >= 100) return Zap;
    return Sparkles;
  };

  const getPointsColor = (points) => {
    if (points >= 1000) return 'text-purple-600 bg-purple-100';
    if (points >= 500) return 'text-yellow-600 bg-yellow-100';
    if (points >= 250) return 'text-blue-600 bg-blue-100';
    if (points >= 100) return 'text-green-600 bg-green-100';
    return 'text-gray-600 bg-gray-100';
  };

  const handleRedeemCode = async () => {
    if (!code.trim()) {
      setError('Please enter a redeem code');
      return;
    }

    if (loading) return;

    setLoading(true);
    setError('');
    setSuccess('');

    const upperCode = code.trim().toUpperCase();

    try {
      const response = await easterEggService.redeemCode(upperCode);

      setSuccess(response.data.message);

      setRecentRedemptions((prev) => [
        {
          code: upperCode,
          points: response.data.savvyEarned ?? response.data.pointsEarned,
          name: response.data.easterEgg?.name || 'Easter Egg',
          timestamp: new Date(),
          icon: response.data.easterEgg?.icon || '🎁',
        },
        ...prev.slice(0, 4),
      ]);

      setAvailableHints((prev) => prev.filter((h) => h.hintCode !== `${upperCode.slice(0, 2)}***`));

      if (onPointsEarned) {
        onPointsEarned(response.data.savvyEarned ?? response.data.pointsEarned);
      }

      setCode('');
    } catch (err) {
      if (err.response?.status === 400) {
        try {
          const promoResponse = await api.post('/promo-codes/validate', {
            code: code.trim(),
            orderValue: 0,
          });

          if (promoResponse.data.valid) {
            setSuccess(
              `✅ Promo code "${code}" is valid! ${promoResponse.data.promoCode.description}`
            );
            setCode('');
            return;
          }
        } catch {
          /* fall through */
        }
        setError(err.response.data.message);
      } else {
        setError('Invalid redeem code. Keep watching our trailers for easter eggs! 🎬');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleRedeemCode();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200"
    >
      <div className="flex items-center space-x-3 mb-4">
        <div className="p-2 bg-purple-100 rounded-lg">
          <Gift className="h-6 w-6 text-purple-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Redeem Codes</h3>
          <p className="text-sm text-gray-600">Enter codes from trailers, teasers, and easter eggs!</p>
        </div>
      </div>

      <div className="flex space-x-2 mb-4">
        <div className="flex-1 relative">
          <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Enter redeem code..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            disabled={loading}
          />
        </div>
        <button
          onClick={handleRedeemCode}
          disabled={loading || !code.trim()}
          className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Redeeming...' : 'Redeem'}
        </button>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-4"
        >
          <XCircle className="h-5 w-5 text-red-500" />
          <span className="text-red-700 text-sm">{error}</span>
        </motion.div>
      )}

      {success && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center space-x-2 p-3 bg-green-50 border border-green-200 rounded-lg mb-4"
        >
          <CheckCircle className="h-5 w-5 text-green-500" />
          <span className="text-green-700 text-sm">{success}</span>
        </motion.div>
      )}

      {recentRedemptions.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Recent Redemptions:</h4>
          <div className="space-y-2">
            {recentRedemptions.map((redemption, index) => {
              const PointsIcon = getPointsIcon(redemption.points);
              const pointsColor = getPointsColor(redemption.points);

              return (
                <motion.div
                  key={`${redemption.code}-${index}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200"
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{redemption.icon}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{redemption.name}</p>
                      <p className="text-xs text-gray-500 font-mono">{redemption.code}</p>
                    </div>
                  </div>
                  <div
                    className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${pointsColor}`}
                  >
                    <PointsIcon className="h-3 w-3" />
                    <span>+{redemption.points}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {availableHints.length > 0 ? (
        <div className="mt-6 p-4 bg-white rounded-lg border border-gray-200">
          <h4 className="text-sm font-medium text-gray-700 mb-3">🎁 Easter eggs still out there:</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
            {availableHints.map((hint) => (
              <div key={hint.hintCode || hint.name} className="flex items-center space-x-2 p-2 bg-gray-50 rounded">
                <span className="text-lg">{hint.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{hint.name}</p>
                  <p className="text-gray-500 truncate">{hint.description}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2 italic">
            💡 Hint: Watch our latest trailers and teasers to find hidden codes!
          </p>
        </div>
      ) : null}

      <Final10SocialLinks className="mt-6" />
    </motion.div>
  );
};

export default RedeemCodeSection;
