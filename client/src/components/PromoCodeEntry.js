import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Gift, Tag, Percent, DollarSign } from 'lucide-react';
import api from '../services/authService';

const PromoCodeEntry = ({ 
  onCodeApplied, 
  onCodeRemoved, 
  orderValue = 0,
  appliedCode = null,
  disabled = false 
}) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [validationResult, setValidationResult] = useState(null);

  const handleValidateCode = async () => {
    if (!code.trim()) {
      setError('Please enter a promo code');
      return;
    }

    setLoading(true);
    setError('');
    setValidationResult(null);

    try {
      const response = await api.post('/promo-codes/validate', {
        code: code.trim(),
        orderValue
      });

      setValidationResult(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to validate promo code');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyCode = async () => {
    if (!validationResult) return;

    setLoading(true);
    setError('');

    try {
      const response = await api.post('/promo-codes/apply', {
        code: code.trim(),
        orderValue
      });

      if (onCodeApplied) {
        onCodeApplied({
          ...validationResult,
          usageId: response.data.usageId
        });
      }

      setCode('');
      setValidationResult(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to apply promo code');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveCode = () => {
    if (onCodeRemoved) {
      onCodeRemoved();
    }
    setCode('');
    setValidationResult(null);
    setError('');
  };

  const formatDiscount = (discount) => {
    if (discount.discountType === 'percentage') {
      return `${discount.discountValue}% off`;
    } else if (discount.discountType === 'fixed') {
      return `$${discount.discountValue} off`;
    } else if (discount.discountType === 'free_shipping') {
      return 'Free Shipping';
    }
    return 'Discount Applied';
  };

  const formatSavings = (discount) => {
    if (discount.discountAmount > 0) {
      return `Save $${discount.discountAmount.toFixed(2)}`;
    }
    return 'Discount Applied';
  };

  if (appliedCode) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-green-50 border border-green-200 rounded-lg p-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-sm font-medium text-green-800">
                Promo code applied: {appliedCode.promoCode.code}
              </p>
              <p className="text-xs text-green-600">
                {formatDiscount(appliedCode.discount)} - {formatSavings(appliedCode.discount)}
              </p>
            </div>
          </div>
          <button
            onClick={handleRemoveCode}
            disabled={disabled}
            className="text-red-500 hover:text-red-700 text-sm font-medium"
          >
            Remove
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex space-x-2">
        <div className="flex-1">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Enter promo code"
            disabled={disabled || loading}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            onKeyPress={(e) => e.key === 'Enter' && handleValidateCode()}
          />
        </div>
        <button
          onClick={handleValidateCode}
          disabled={disabled || loading || !code.trim()}
          className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? 'Validating...' : 'Apply'}
        </button>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-200 rounded-md p-3"
        >
          <div className="flex items-center space-x-2">
            <XCircle className="h-4 w-4 text-red-500" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </motion.div>
      )}

      {validationResult && validationResult.valid && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-green-50 border border-green-200 rounded-md p-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Gift className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-medium text-green-800">
                  {validationResult.promoCode.code}
                </p>
                <p className="text-xs text-green-600">
                  {validationResult.promoCode.description}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-green-800">
                {formatSavings(validationResult.discount)}
              </p>
              <p className="text-xs text-green-600">
                Final: ${validationResult.discount.finalAmount.toFixed(2)}
              </p>
            </div>
          </div>
          
          <div className="mt-3 pt-3 border-t border-green-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4 text-xs text-green-600">
                <div className="flex items-center space-x-1">
                  <Tag className="h-3 w-3" />
                  <span>By {validationResult.promoCode.creator}</span>
                </div>
                {validationResult.promoCode.discountType === 'percentage' && (
                  <div className="flex items-center space-x-1">
                    <Percent className="h-3 w-3" />
                    <span>{validationResult.promoCode.discountValue}% off</span>
                  </div>
                )}
                {validationResult.promoCode.discountType === 'fixed' && (
                  <div className="flex items-center space-x-1">
                    <DollarSign className="h-3 w-3" />
                    <span>${validationResult.promoCode.discountValue} off</span>
                  </div>
                )}
              </div>
              <button
                onClick={handleApplyCode}
                disabled={disabled || loading}
                className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? 'Applying...' : 'Confirm'}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default PromoCodeEntry;








