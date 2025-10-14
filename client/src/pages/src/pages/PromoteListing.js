import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft,
  Star,
  TrendingUp,
  Target,
  Clock,
  DollarSign,
  Eye,
  MousePointer,
  Zap,
  Check,
  AlertCircle,
  Crown,
  Sparkles
} from 'lucide-react';
import promotionService from '../services/promotionService';
import { useAuth } from '../context/AuthContext';

const PromoteListing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [listingData, setListingData] = useState({
    listingType: 'ebay',
    listingId: '',
    targetCategory: 'all',
    targetKeywords: [],
    duration: 24,
    budget: 0
  });
  const [step, setStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch promotion packages
  const { data: packages, isLoading: packagesLoading } = useQuery({
    queryKey: ['promotion-packages'],
    queryFn: () => promotionService.getPackages(),
    enabled: !!user
  });

  // Fetch recommended packages
  const { data: recommendedPackages } = useQuery({
    queryKey: ['recommended-packages'],
    queryFn: () => promotionService.getRecommendedPackages(),
    enabled: !!user
  });

  // Create promotion mutation
  const createPromotionMutation = useMutation({
    mutationFn: (promotionData) => promotionService.createPromotion(promotionData),
    onSuccess: (data) => {
      // Navigate to payment or success page
      navigate(`/promotion/${data.promotion._id}/payment`);
    },
    onError: (error) => {
      console.error('Error creating promotion:', error);
      setIsProcessing(false);
    }
  });

  // Handle package selection
  const handlePackageSelect = (pkg) => {
    setSelectedPackage(pkg);
    setListingData(prev => ({
      ...prev,
      budget: pkg.price,
      duration: pkg.duration.hours
    }));
    setStep(2);
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPackage) return;

    setIsProcessing(true);
    
    try {
      await createPromotionMutation.mutateAsync({
        ...listingData,
        packageId: selectedPackage._id
      });
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const getPackageIcon = (type) => {
    const icons = {
      featured: Crown,
      promoted: Star,
      sponsored: Target,
      trending: TrendingUp,
      category: Target
    };
    return icons[type] || Star;
  };

  const getPackageColor = (type) => {
    const colors = {
      featured: 'from-yellow-400 to-orange-500',
      promoted: 'from-purple-500 to-pink-500',
      sponsored: 'from-green-500 to-emerald-500',
      trending: 'from-orange-500 to-red-500',
      category: 'from-blue-500 to-indigo-500'
    };
    return colors[type] || 'from-purple-500 to-pink-500';
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Please login to promote your listings</h1>
          <button 
            onClick={() => navigate('/login')}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg"
          >
            Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center space-x-4 mb-6">
            <button
              onClick={() => navigate('/trending')}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                Promote Your Listing
              </h1>
              <p className="text-gray-400">Step {step} of 3 - Choose your promotion package</p>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {step === 1 && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                  <h2 className="text-xl font-bold mb-4 flex items-center space-x-2">
                    <Sparkles className="h-5 w-5 text-purple-400" />
                    <span>Choose Promotion Package</span>
                  </h2>
                  <p className="text-gray-400 mb-6">
                    Select the perfect promotion package for your listing. Each package offers different levels of visibility and targeting options.
                  </p>

                  {/* Recommended Packages */}
                  {recommendedPackages && recommendedPackages.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold mb-3 text-yellow-400">⭐ Recommended for You</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {recommendedPackages.slice(0, 2).map((pkg) => {
                          const Icon = getPackageIcon(pkg.type);
                          const colorClass = getPackageColor(pkg.type);
                          
                          return (
                            <motion.div
                              key={pkg._id}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => handlePackageSelect(pkg)}
                              className={`relative bg-gradient-to-r ${colorClass} p-1 rounded-xl cursor-pointer`}
                            >
                              <div className="bg-gray-800 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center space-x-2">
                                    <Icon className="h-5 w-5 text-white" />
                                    <span className="font-bold text-white">{pkg.name}</span>
                                  </div>
                                  <div className="bg-yellow-400 text-yellow-900 px-2 py-1 rounded-full text-xs font-bold">
                                    RECOMMENDED
                                  </div>
                                </div>
                                <p className="text-gray-300 text-sm mb-3">{pkg.description.short}</p>
                                <div className="flex items-center justify-between">
                                  <span className="text-2xl font-bold text-white">${pkg.price}</span>
                                  <span className="text-gray-400 text-sm">{pkg.duration.hours}h</span>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* All Packages */}
                  <div className="space-y-4">
                    {packagesLoading ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-4 border-purple-500 border-t-transparent mx-auto mb-4"></div>
                        <p className="text-gray-400">Loading packages...</p>
                      </div>
                    ) : (
                      packages?.packages?.map((pkg) => {
                        const Icon = getPackageIcon(pkg.type);
                        const colorClass = getPackageColor(pkg.type);
                        
                        return (
                          <motion.div
                            key={pkg._id}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            onClick={() => handlePackageSelect(pkg)}
                            className="bg-gray-700 hover:bg-gray-600 rounded-xl p-6 border border-gray-600 hover:border-purple-500/50 cursor-pointer transition-all duration-300"
                          >
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center space-x-3">
                                <div className={`p-3 rounded-lg bg-gradient-to-r ${colorClass}`}>
                                  <Icon className="h-6 w-6 text-white" />
                                </div>
                                <div>
                                  <h3 className="text-lg font-bold text-white">{pkg.name}</h3>
                                  <p className="text-gray-400 text-sm capitalize">{pkg.tier} • {pkg.type}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-2xl font-bold text-white">${pkg.price}</div>
                                <div className="text-gray-400 text-sm">{pkg.duration.hours}h duration</div>
                              </div>
                            </div>
                            
                            <p className="text-gray-300 mb-4">{pkg.description.short}</p>
                            
                            <div className="grid grid-cols-2 gap-4 mb-4">
                              <div className="flex items-center space-x-2">
                                <Eye className="h-4 w-4 text-purple-400" />
                                <span className="text-sm text-gray-400">
                                  {pkg.features.impressions === 'unlimited' ? 'Unlimited' : `${pkg.features.maxImpressions || 'Limited'} impressions`}
                                </span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Target className="h-4 w-4 text-purple-400" />
                                <span className="text-sm text-gray-400">
                                  {pkg.features.priority}/10 priority
                                </span>
                              </div>
                            </div>

                            {pkg.guarantees.minImpressions && (
                              <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-3">
                                <div className="flex items-center space-x-2">
                                  <Check className="h-4 w-4 text-green-400" />
                                  <span className="text-sm text-green-400">
                                    Guaranteed {pkg.guarantees.minImpressions.toLocaleString()} impressions
                                  </span>
                                </div>
                              </div>
                            )}
                          </motion.div>
                        );
                      })
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && selectedPackage && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                  <h2 className="text-xl font-bold mb-4">Configure Your Promotion</h2>
                  
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Listing Information */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Listing Type
                      </label>
                      <select
                        value={listingData.listingType}
                        onChange={(e) => setListingData(prev => ({ ...prev, listingType: e.target.value }))}
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      >
                        <option value="ebay">eBay Listing</option>
                        <option value="custom">Custom Listing</option>
                        <option value="auction">Auction</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Listing ID / URL
                      </label>
                      <input
                        type="text"
                        value={listingData.listingId}
                        onChange={(e) => setListingData(prev => ({ ...prev, listingId: e.target.value }))}
                        placeholder="Enter your listing ID or URL"
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Target Category
                      </label>
                      <select
                        value={listingData.targetCategory}
                        onChange={(e) => setListingData(prev => ({ ...prev, targetCategory: e.target.value }))}
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      >
                        <option value="all">All Categories</option>
                        <option value="electronics">Electronics</option>
                        <option value="fashion">Fashion</option>
                        <option value="home">Home & Garden</option>
                        <option value="automotive">Automotive</option>
                        <option value="sports">Sports</option>
                        <option value="toys">Toys</option>
                        <option value="books">Books</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Target Keywords (Optional)
                      </label>
                      <input
                        type="text"
                        value={listingData.targetKeywords.join(', ')}
                        onChange={(e) => setListingData(prev => ({ 
                          ...prev, 
                          targetKeywords: e.target.value.split(',').map(k => k.trim()).filter(k => k)
                        }))}
                        placeholder="Enter keywords separated by commas"
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Duration (Hours)
                        </label>
                        <input
                          type="number"
                          value={listingData.duration}
                          onChange={(e) => setListingData(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                          min={selectedPackage.duration.minHours}
                          max={selectedPackage.duration.maxHours}
                          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Budget
                        </label>
                        <input
                          type="number"
                          value={listingData.budget}
                          onChange={(e) => setListingData(prev => ({ ...prev, budget: parseFloat(e.target.value) }))}
                          min={selectedPackage.price}
                          step="0.01"
                          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          required
                        />
                      </div>
                    </div>

                    <div className="flex space-x-4">
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                      >
                        Back to Packages
                      </button>
                      <button
                        type="submit"
                        disabled={isProcessing}
                        className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isProcessing ? 'Creating...' : 'Continue to Payment'}
                      </button>
                    </div>
                  </form>
                </div>
              </motion.div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Selected Package Summary */}
            {selectedPackage && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-gray-800 rounded-xl p-6 border border-gray-700"
              >
                <h3 className="text-lg font-bold mb-4">Selected Package</h3>
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg bg-gradient-to-r ${getPackageColor(selectedPackage.type)}`}>
                      {React.createElement(getPackageIcon(selectedPackage.type), { className: "h-5 w-5 text-white" })}
                    </div>
                    <div>
                      <div className="font-semibold text-white">{selectedPackage.name}</div>
                      <div className="text-sm text-gray-400">{selectedPackage.type} • {selectedPackage.tier}</div>
                    </div>
                  </div>
                  
                  <div className="border-t border-gray-600 pt-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-400">Price:</span>
                      <span className="text-xl font-bold text-white">${selectedPackage.price}</span>
                    </div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-400">Duration:</span>
                      <span className="text-white">{selectedPackage.duration.hours}h</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Priority:</span>
                      <span className="text-white">{selectedPackage.features.priority}/10</span>
                    </div>
                  </div>

                  {selectedPackage.guarantees.minImpressions && (
                    <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-3">
                      <div className="flex items-center space-x-2">
                        <Check className="h-4 w-4 text-green-400" />
                        <span className="text-sm text-green-400">
                          Guaranteed {selectedPackage.guarantees.minImpressions.toLocaleString()} impressions
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Promotion Benefits */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-xl p-6 border border-purple-500/30"
            >
              <h3 className="text-lg font-bold mb-4 flex items-center space-x-2">
                <Zap className="h-5 w-5 text-purple-400" />
                <span>Why Promote?</span>
              </h3>
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <Eye className="h-4 w-4 text-purple-400 mt-1" />
                  <div>
                    <div className="font-medium text-white">Increased Visibility</div>
                    <div className="text-sm text-gray-400">Get your listings in front of more potential buyers</div>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <MousePointer className="h-4 w-4 text-purple-400 mt-1" />
                  <div>
                    <div className="font-medium text-white">Higher Engagement</div>
                    <div className="text-sm text-gray-400">More clicks, views, and potential sales</div>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <Target className="h-4 w-4 text-purple-400 mt-1" />
                  <div>
                    <div className="font-medium text-white">Targeted Reach</div>
                    <div className="text-sm text-gray-400">Reach the right audience for your products</div>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <TrendingUp className="h-4 w-4 text-purple-400 mt-1" />
                  <div>
                    <div className="font-medium text-white">Better Performance</div>
                    <div className="text-sm text-gray-400">Proven to increase sales and auction success</div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Help Section */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-gray-800 rounded-xl p-6 border border-gray-700"
            >
              <h3 className="text-lg font-bold mb-4">Need Help?</h3>
              <div className="space-y-3 text-sm text-gray-400">
                <div>• Choose Featured for maximum visibility</div>
                <div>• Promoted packages offer good value</div>
                <div>• Category targeting improves relevance</div>
                <div>• Start with shorter durations to test</div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromoteListing;







