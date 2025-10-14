import React from 'react';
import { motion } from 'framer-motion';
import { 
  Check, 
  Crown, 
  Zap, 
  Shield, 
  Star, 
  ArrowRight,
  CreditCard,
  Smartphone,
  DollarSign,
  Users,
  Globe,
  TrendingUp
} from 'lucide-react';
import { Link } from 'react-router-dom';

const Pricing = () => {
  return (
    <div className="min-h-screen bg-gray-900 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Header */}
          <div className="text-center mb-16">
            <h1 className="text-5xl font-bold text-white mb-6">
              Choose Your Plan
            </h1>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              Start free and upgrade when you're ready. All plans include our core features with premium offering unlimited access and exclusive benefits.
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
            {/* Free Tier */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-gray-800 rounded-2xl p-8 border border-gray-700 relative"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="bg-blue-500/20 p-4 rounded-xl">
                  <Zap className="h-8 w-8 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Free Tier</h2>
                  <p className="text-gray-400">Perfect for getting started</p>
                </div>
              </div>

              <div className="mb-8">
                <div className="text-4xl font-bold text-white mb-2">$0</div>
                <div className="text-gray-400">Forever free</div>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-green-400" />
                  <span className="text-gray-300">5 searches per day</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-green-400" />
                  <span className="text-gray-300">Basic auction browsing</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-green-400" />
                  <span className="text-gray-300">Standard filters</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-green-400" />
                  <span className="text-gray-300">Daily tasks & points</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-green-400" />
                  <span className="text-gray-300">Community features</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-green-400" />
                  <span className="text-gray-300">Basic support</span>
                </div>
              </div>

              <Link 
                to="/register" 
                className="w-full btn btn-outline block text-center"
              >
                Get Started Free
              </Link>
            </motion.div>

            {/* Premium Tier */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-2xl p-8 border border-purple-500/30 relative"
            >
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-2 rounded-full text-sm font-semibold">
                  Most Popular
                </span>
              </div>

              <div className="flex items-center gap-4 mb-6">
                <div className="bg-purple-500/20 p-4 rounded-xl">
                  <Crown className="h-8 w-8 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Premium</h2>
                  <p className="text-gray-400">For serious auction hunters</p>
                </div>
              </div>

              <div className="mb-8">
                <div className="text-4xl font-bold text-white mb-2">$7<span className="text-lg text-gray-400">/month</span></div>
                <div className="text-gray-400">Cancel anytime</div>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-green-400" />
                  <span className="text-gray-300 font-semibold">Unlimited searches</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-green-400" />
                  <span className="text-gray-300 font-semibold">Premium auction access</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-green-400" />
                  <span className="text-gray-300 font-semibold">Advanced filters & AI insights</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-green-400" />
                  <span className="text-gray-300 font-semibold">Priority support</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-green-400" />
                  <span className="text-gray-300 font-semibold">Exclusive deals & discounts</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-green-400" />
                  <span className="text-gray-300 font-semibold">Early access to new features</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-green-400" />
                  <span className="text-gray-300 font-semibold">100 bonus points on upgrade</span>
                </div>
              </div>

              <Link 
                to="/premium" 
                className="w-full btn btn-primary block text-center"
              >
                <Crown className="w-5 h-5 inline mr-2" />
                Upgrade to Premium
                <ArrowRight className="w-5 h-5 inline ml-2" />
              </Link>
            </motion.div>
          </div>

          {/* Multi-App Subscription Future */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-2xl p-12 border border-blue-500/30 mb-16"
          >
            <div className="text-center">
              <div className="bg-blue-500/20 p-6 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center">
                <Star className="h-12 w-12 text-blue-400" />
              </div>
              <h2 className="text-3xl font-bold text-white mb-4">Coming Soon: Multi-App Subscription</h2>
              <p className="text-gray-300 text-lg mb-8 max-w-4xl mx-auto">
                We're building a unified ecosystem that will give you access to multiple apps across different industries, 
                all with one subscription and one universal points system. Your Final10 subscription will be the foundation 
                for our entire platform.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
                <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                  <div className="text-4xl mb-4">🛒</div>
                  <h3 className="text-xl font-semibold text-white mb-3">E-Commerce</h3>
                  <ul className="text-sm text-gray-400 space-y-2">
                    <li>• Auction platforms</li>
                    <li>• Marketplace tools</li>
                    <li>• Shopping assistants</li>
                    <li>• Price tracking</li>
                  </ul>
                </div>
                <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                  <div className="text-4xl mb-4">🏠</div>
                  <h3 className="text-xl font-semibold text-white mb-3">Real Estate</h3>
                  <ul className="text-sm text-gray-400 space-y-2">
                    <li>• Property auctions</li>
                    <li>• Market analysis</li>
                    <li>• Investment tools</li>
                    <li>• Neighborhood insights</li>
                  </ul>
                </div>
                <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                  <div className="text-4xl mb-4">🚗</div>
                  <h3 className="text-xl font-semibold text-white mb-3">Automotive</h3>
                  <ul className="text-sm text-gray-400 space-y-2">
                    <li>• Car auctions</li>
                    <li>• Vehicle tracking</li>
                    <li>• Maintenance tools</li>
                    <li>• Market valuations</li>
                  </ul>
                </div>
              </div>
              
              <div className="bg-gray-800/50 rounded-xl p-8 border border-gray-700 mb-8">
                <h3 className="text-2xl font-semibold text-white mb-6">Universal Benefits</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex items-center gap-3">
                    <Check className="h-6 w-6 text-green-400" />
                    <span className="text-gray-300">One subscription, multiple apps</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check className="h-6 w-6 text-green-400" />
                    <span className="text-gray-300">Shared points across all platforms</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check className="h-6 w-6 text-green-400" />
                    <span className="text-gray-300">Cross-platform achievements</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check className="h-6 w-6 text-green-400" />
                    <span className="text-gray-300">Unified dashboard & analytics</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check className="h-6 w-6 text-green-400" />
                    <span className="text-gray-300">Seamless data synchronization</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check className="h-6 w-6 text-green-400" />
                    <span className="text-gray-300">Priority access to new apps</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-gradient-to-r from-green-500/20 to-blue-500/20 rounded-xl p-6 border border-green-500/30">
                <div className="flex items-center justify-center gap-3 mb-3">
                  <TrendingUp className="h-6 w-6 text-green-400" />
                  <h4 className="text-xl font-semibold text-white">Early Adopter Benefits</h4>
                </div>
                <p className="text-green-400 font-medium text-lg">
                  🚀 Early subscribers will get grandfathered pricing and exclusive access to new apps as they launch!
                </p>
                <p className="text-gray-300 mt-2">
                  Your $7/month Final10 subscription will automatically include access to all future apps in our ecosystem.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Payment Methods */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-center"
          >
            <h2 className="text-2xl font-bold text-white mb-6">Accepted Payment Methods</h2>
            <div className="flex items-center justify-center gap-8 text-gray-400">
              <div className="flex items-center gap-2">
                <CreditCard className="h-6 w-6" />
                <span>Credit/Debit Cards</span>
              </div>
              <div className="flex items-center gap-2">
                <Smartphone className="h-6 w-6" />
                <span>Apple Pay</span>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="h-6 w-6" />
                <span>Cash App Pay</span>
              </div>
            </div>
            <p className="text-gray-500 mt-4">
              Secure payments powered by Stripe. Cancel anytime with no hidden fees.
            </p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default Pricing;


