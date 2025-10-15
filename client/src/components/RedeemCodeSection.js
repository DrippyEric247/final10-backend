import React, { useState } from 'react';
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
  Crown
} from 'lucide-react';
import api from '../services/authService';
import easterEggService from '../services/easterEggService';

const RedeemCodeSection = ({ onPointsEarned }) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [recentRedemptions, setRecentRedemptions] = useState([]);

  // Sample easter egg codes for demo (you can expand this)
  const easterEggCodes = {
    'TRAILER2024': { points: 500, name: 'Trailer Master', icon: '🎬' },
    'TEASER2024': { points: 300, name: 'Teaser Hunter', icon: '🔍' },
    'EasterEgg': { points: 1000, name: 'Easter Egg Finder', icon: '🥚' },
    'StaySavvy': { points: 250, name: 'Savvy Viewer', icon: '💡' },
    'StayEarning': { points: 200, name: 'Earning Pro', icon: '💰' },
    'Final10': { points: 150, name: 'Final10 Fan', icon: '🎯' }
  };

  const getCodeIcon = (codeKey) => {
    const code = easterEggCodes[codeKey];
    if (code) {
      switch (code.name) {
        case 'Trailer Master': return '🎬';
        case 'Teaser Hunter': return '🔍';
        case 'Easter Egg Finder': return '🥚';
        case 'Savvy Viewer': return '💡';
        case 'Earning Pro': return '💰';
        case 'Final10 Fan': return '🎯';
        default: return '🎁';
      }
    }
    return '🎁';
  };

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

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Check if it's an easter egg code first
      const upperCode = code.toUpperCase();
      if (easterEggCodes[upperCode]) {
        const easterEgg = easterEggCodes[upperCode];
        
        // Award points for easter egg code
        const response = await easterEggService.redeemCode(upperCode);

        setSuccess(response.data.message);
        
        // Add to recent redemptions
        setRecentRedemptions(prev => [{
          code: upperCode,
          points: response.data.pointsEarned,
          name: response.data.easterEgg.name,
          timestamp: new Date(),
          icon: getCodeIcon(upperCode)
        }, ...prev.slice(0, 4)]); // Keep only last 5

        if (onPointsEarned) {
          onPointsEarned(response.data.pointsEarned);
        }
      } else {
        // Try regular promo code validation
        const promoResponse = await api.post('/promo-codes/validate', {
          code: code.trim(),
          orderValue: 0
        });

        if (promoResponse.data.valid) {
          setSuccess(`✅ Promo code "${code}" is valid! ${promoResponse.data.promoCode.description}`);
        } else {
          setError('Invalid redeem code. Keep watching our trailers for easter eggs! 🎬');
        }
      }

      setCode('');
    } catch (err) {
      if (err.response?.status === 400) {
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
      className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200"
    >
      {/* Header */}
      <div className="flex items-center space-x-3 mb-6">
        <div className="p-2 bg-purple-100 rounded-lg">
          <Gift className="h-6 w-6 text-purple-600" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900">Redeem Codes</h3>
          <p className="text-sm text-gray-600">Enter codes from trailers, teasers, and easter eggs!</p>
        </div>
      </div>

      {/* Redeem Form */}
      <div className="space-y-4 mb-6">
        <div className="flex space-x-3">
          <div className="flex-1">
            <div className="relative">
              <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyPress={handleKeyPress}
                placeholder="Enter redeem code..."
                disabled={loading}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed text-center font-mono tracking-wider"
              />
            </div>
          </div>
          <button
            onClick={handleRedeemCode}
            disabled={loading || !code.trim()}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
          >
            {loading ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Redeeming...</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Sparkles className="h-4 w-4" />
                <span>Redeem</span>
              </div>
            )}
          </button>
        </div>

        {/* Messages */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 border border-red-200 rounded-lg p-4"
          >
            <div className="flex items-center space-x-2">
              <XCircle className="h-5 w-5 text-red-500" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </motion.div>
        )}

        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-green-50 border border-green-200 rounded-lg p-4"
          >
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <p className="text-sm text-green-700">{success}</p>
            </div>
          </motion.div>
        )}
      </div>

      {/* Easter Egg Hints */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 mb-3">🎬 Easter Egg Hunting Tips:</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-gray-600">
          <div className="flex items-center space-x-2">
            <span className="text-lg">🎬</span>
            <span>Watch our trailers carefully for hidden codes</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-lg">🔍</span>
            <span>Look for codes in teaser descriptions</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-lg">💡</span>
            <span>Follow our social media for code drops</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-lg">🎯</span>
            <span>Some codes are time-limited, act fast!</span>
          </div>
        </div>
      </div>

      {/* Recent Redemptions */}
      {recentRedemptions.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Recent Redemptions:</h4>
          <div className="space-y-2">
            {recentRedemptions.map((redemption, index) => {
              const PointsIcon = getPointsIcon(redemption.points);
              const pointsColor = getPointsColor(redemption.points);
              
              return (
                <motion.div
                  key={index}
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
                  <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${pointsColor}`}>
                    <PointsIcon className="h-3 w-3" />
                    <span>+{redemption.points}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Available Easter Eggs Preview (for hints) */}
      <div className="mt-6 p-4 bg-white rounded-lg border border-gray-200">
        <h4 className="text-sm font-medium text-gray-700 mb-3">🎁 Available Easter Eggs:</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
          {Object.entries(easterEggCodes).map(([codeKey, codeData]) => {
            const PointsIcon = getPointsIcon(codeData.points);
            const pointsColor = getPointsColor(codeData.points);
            
            return (
              <div key={codeKey} className="flex items-center space-x-2 p-2 bg-gray-50 rounded">
                <span className="text-lg">{codeData.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{codeData.name}</p>
                  <div className={`inline-flex items-center space-x-1 ${pointsColor}`}>
                    <PointsIcon className="h-3 w-3" />
                    <span className="font-medium">+{codeData.points}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-gray-500 mt-2 italic">
          💡 Hint: Watch our latest trailers and teasers to find these codes!
        </p>
      </div>
    </motion.div>
  );
};

export default RedeemCodeSection;
