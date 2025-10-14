import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Plus, 
  Save, 
  X, 
  Percent, 
  DollarSign, 
  Truck, 
  Calendar,
  Users,
  Gift,
  Tag,
  AlertCircle
} from 'lucide-react';
import api from '../services/authService';

const PromoCodeCreator = ({ onCodeCreated, onCancel }) => {
  const [formData, setFormData] = useState({
    code: '',
    description: '',
    discountType: 'percentage',
    discountValue: 10,
    usageLimit: '',
    userUsageLimit: 1,
    validUntil: '',
    minimumOrderValue: 0,
    commissionRate: 5,
    tags: '',
    notes: ''
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'code' ? value.toUpperCase() : value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.code.trim()) {
      newErrors.code = 'Code is required';
    } else if (formData.code.length < 3) {
      newErrors.code = 'Code must be at least 3 characters';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }

    if (formData.discountValue <= 0) {
      newErrors.discountValue = 'Discount value must be greater than 0';
    }

    if (formData.discountType === 'percentage' && formData.discountValue > 100) {
      newErrors.discountValue = 'Percentage cannot exceed 100%';
    }

    if (formData.commissionRate < 0 || formData.commissionRate > 100) {
      newErrors.commissionRate = 'Commission rate must be between 0 and 100';
    }

    if (formData.minimumOrderValue < 0) {
      newErrors.minimumOrderValue = 'Minimum order value cannot be negative';
    }

    if (formData.usageLimit && formData.usageLimit < 1) {
      newErrors.usageLimit = 'Usage limit must be at least 1';
    }

    if (formData.userUsageLimit < 1) {
      newErrors.userUsageLimit = 'User usage limit must be at least 1';
    }

    if (formData.validUntil) {
      const validUntilDate = new Date(formData.validUntil);
      if (validUntilDate <= new Date()) {
        newErrors.validUntil = 'Expiration date must be in the future';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const payload = {
        ...formData,
        discountValue: parseFloat(formData.discountValue),
        usageLimit: formData.usageLimit ? parseInt(formData.usageLimit) : null,
        userUsageLimit: parseInt(formData.userUsageLimit),
        minimumOrderValue: parseFloat(formData.minimumOrderValue),
        commissionRate: parseFloat(formData.commissionRate),
        tags: formData.tags ? formData.tags.split(',').map(tag => tag.trim()) : [],
        validUntil: formData.validUntil ? new Date(formData.validUntil) : null
      };

      const response = await api.post('/promo-codes/creator/create', payload);
      
      if (onCodeCreated) {
        onCodeCreated(response.data);
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to create promo code';
      setErrors({ submit: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const discountTypeOptions = [
    { value: 'percentage', label: 'Percentage', icon: Percent },
    { value: 'fixed', label: 'Fixed Amount', icon: DollarSign },
    { value: 'free_shipping', label: 'Free Shipping', icon: Truck }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-lg shadow-lg p-6 max-w-2xl mx-auto"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Gift className="h-6 w-6 text-purple-600" />
          <h2 className="text-xl font-bold text-gray-900">Create Promo Code</h2>
        </div>
        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {errors.submit && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <p className="text-sm text-red-700">{errors.submit}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Code */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Promo Code *
            </label>
            <input
              type="text"
              name="code"
              value={formData.code}
              onChange={handleInputChange}
              placeholder="SAVE20"
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                errors.code ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {errors.code && (
              <p className="mt-1 text-sm text-red-600">{errors.code}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description *
            </label>
            <input
              type="text"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="20% off your first order"
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                errors.description ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-600">{errors.description}</p>
            )}
          </div>
        </div>

        {/* Discount Configuration */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center space-x-2">
            <Tag className="h-5 w-5 text-purple-600" />
            <span>Discount Configuration</span>
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Discount Type *
              </label>
              <div className="space-y-2">
                {discountTypeOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <label key={option.value} className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="discountType"
                        value={option.value}
                        checked={formData.discountType === option.value}
                        onChange={handleInputChange}
                        className="text-purple-600 focus:ring-purple-500"
                      />
                      <Icon className="h-4 w-4 text-gray-500" />
                      <span className="text-sm">{option.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Discount Value *
              </label>
              <div className="flex items-center space-x-2">
                {formData.discountType === 'percentage' && (
                  <span className="text-gray-500">%</span>
                )}
                {formData.discountType === 'fixed' && (
                  <span className="text-gray-500">$</span>
                )}
                {formData.discountType === 'free_shipping' && (
                  <span className="text-gray-500 text-sm">Free</span>
                )}
                <input
                  type="number"
                  name="discountValue"
                  value={formData.discountValue}
                  onChange={handleInputChange}
                  min="0"
                  max={formData.discountType === 'percentage' ? 100 : undefined}
                  step={formData.discountType === 'percentage' ? 1 : 0.01}
                  disabled={formData.discountType === 'free_shipping'}
                  className={`flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                    errors.discountValue ? 'border-red-300' : 'border-gray-300'
                  } disabled:bg-gray-100`}
                />
              </div>
              {errors.discountValue && (
                <p className="mt-1 text-sm text-red-600">{errors.discountValue}</p>
              )}
            </div>
          </div>
        </div>

        {/* Usage Limits */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center space-x-2">
            <Users className="h-5 w-5 text-purple-600" />
            <span>Usage Limits</span>
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Total Usage Limit
              </label>
              <input
                type="number"
                name="usageLimit"
                value={formData.usageLimit}
                onChange={handleInputChange}
                min="1"
                placeholder="Unlimited"
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                  errors.usageLimit ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              <p className="mt-1 text-xs text-gray-500">Leave empty for unlimited</p>
              {errors.usageLimit && (
                <p className="mt-1 text-sm text-red-600">{errors.usageLimit}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Per User Limit *
              </label>
              <input
                type="number"
                name="userUsageLimit"
                value={formData.userUsageLimit}
                onChange={handleInputChange}
                min="1"
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                  errors.userUsageLimit ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              {errors.userUsageLimit && (
                <p className="mt-1 text-sm text-red-600">{errors.userUsageLimit}</p>
              )}
            </div>
          </div>
        </div>

        {/* Additional Settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Minimum Order Value
            </label>
            <div className="flex items-center space-x-2">
              <span className="text-gray-500">$</span>
              <input
                type="number"
                name="minimumOrderValue"
                value={formData.minimumOrderValue}
                onChange={handleInputChange}
                min="0"
                step="0.01"
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                  errors.minimumOrderValue ? 'border-red-300' : 'border-gray-300'
                }`}
              />
            </div>
            {errors.minimumOrderValue && (
              <p className="mt-1 text-sm text-red-600">{errors.minimumOrderValue}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Commission Rate (%)
            </label>
            <input
              type="number"
              name="commissionRate"
              value={formData.commissionRate}
              onChange={handleInputChange}
              min="0"
              max="100"
              step="0.1"
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                errors.commissionRate ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {errors.commissionRate && (
              <p className="mt-1 text-sm text-red-600">{errors.commissionRate}</p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-purple-600" />
            <span>Expiration Date</span>
          </label>
          <input
            type="datetime-local"
            name="validUntil"
            value={formData.validUntil}
            onChange={handleInputChange}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 ${
              errors.validUntil ? 'border-red-300' : 'border-gray-300'
            }`}
          />
          {errors.validUntil && (
            <p className="mt-1 text-sm text-red-600">{errors.validUntil}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tags (comma-separated)
          </label>
          <input
            type="text"
            name="tags"
            value={formData.tags}
            onChange={handleInputChange}
            placeholder="summer, sale, new-user"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notes
          </label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleInputChange}
            rows="3"
            placeholder="Internal notes about this promo code..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <div className="flex items-center justify-end space-x-4 pt-4 border-t">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Creating...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>Create Promo Code</span>
              </>
            )}
          </button>
        </div>
      </form>
    </motion.div>
  );
};

export default PromoCodeCreator;







