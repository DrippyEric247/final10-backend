import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Bug, AlertTriangle, AlertCircle, AlertOctagon, Send, Loader } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const BugReportModal = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    title: '',
    steps: '',
    expected: '',
    actual: '',
    severity: 'med'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const severityOptions = [
    { value: 'low', label: 'Low', icon: AlertCircle, color: 'text-green-400', bgColor: 'bg-green-500/20' },
    { value: 'med', label: 'Medium', icon: AlertTriangle, color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' },
    { value: 'high', label: 'High', icon: AlertOctagon, color: 'text-red-400', bgColor: 'bg-red-500/20' }
  ];

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.steps.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/bug-reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          ...formData,
          page: window.location.pathname,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
          userId: user?.id,
          username: user?.username
        })
      });

      if (response.ok) {
        setSubmitSuccess(true);
        setTimeout(() => {
          setSubmitSuccess(false);
          onClose();
          setFormData({ title: '', steps: '', expected: '', actual: '', severity: 'med' });
        }, 2000);
      } else {
        throw new Error('Failed to submit bug report');
      }
    } catch (error) {
      console.error('Error submitting bug report:', error);
      alert('Failed to submit bug report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-red-500/20 rounded-lg">
              <Bug className="h-6 w-6 text-red-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Report a Bug</h2>
              <p className="text-sm text-gray-400">Help us improve Final10 by reporting issues</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* Success Message */}
        {submitSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-6 mt-4 p-4 bg-green-500/20 border border-green-500/30 rounded-lg"
          >
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-green-400 font-medium">Bug report submitted successfully!</span>
            </div>
            <p className="text-green-300 text-sm mt-1">
              Our AI development team will analyze and fix this issue automatically.
            </p>
          </motion.div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Bug Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              placeholder="Brief description of the bug"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              required
            />
          </div>

          {/* Severity */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Severity Level *
            </label>
            <div className="grid grid-cols-3 gap-3">
              {severityOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <motion.button
                    key={option.value}
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleInputChange('severity', option.value)}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      formData.severity === option.value
                        ? `${option.bgColor} border-current ${option.color}`
                        : 'bg-gray-700 border-gray-600 hover:border-gray-500'
                    }`}
                  >
                    <Icon className={`h-5 w-5 mx-auto mb-2 ${option.color}`} />
                    <div className={`text-sm font-medium ${option.color}`}>
                      {option.label}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Steps to Reproduce */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Steps to Reproduce *
            </label>
            <textarea
              value={formData.steps}
              onChange={(e) => handleInputChange('steps', e.target.value)}
              placeholder="1. Go to...&#10;2. Click on...&#10;3. See error..."
              rows={4}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              required
            />
          </div>

          {/* Expected vs Actual */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Expected Behavior
              </label>
              <textarea
                value={formData.expected}
                onChange={(e) => handleInputChange('expected', e.target.value)}
                placeholder="What should happen?"
                rows={3}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Actual Behavior
              </label>
              <textarea
                value={formData.actual}
                onChange={(e) => handleInputChange('actual', e.target.value)}
                placeholder="What actually happens?"
                rows={3}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              />
            </div>
          </div>

          {/* Auto-collected Info */}
          <div className="bg-gray-700/50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-300 mb-2">Auto-collected Information</h4>
            <div className="grid grid-cols-2 gap-4 text-xs text-gray-400">
              <div>
                <span className="font-medium">Page:</span> {window.location.pathname}
              </div>
              <div>
                <span className="font-medium">User:</span> {user?.username || 'Anonymous'}
              </div>
              <div className="col-span-2">
                <span className="font-medium">Browser:</span> {navigator.userAgent.split(' ')[0]}
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex space-x-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-medium py-3 px-6 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!formData.title.trim() || !formData.steps.trim() || isSubmitting}
              className="flex-1 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white font-medium py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2"
            >
              {isSubmitting ? (
                <>
                  <Loader className="h-4 w-4 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span>Submit Bug Report</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-800/50 border-t border-gray-700">
          <div className="flex items-center space-x-2 text-xs text-gray-400">
            <Bug className="h-3 w-3" />
            <span>Our AI development team will automatically analyze and fix this issue</span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default BugReportModal;






