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
import { FINAL10_TIERS, getMostPopularTierId } from '../lib/final10SubscriptionTiers';

const Pricing = () => {
  const mostPopularTier = getMostPopularTierId();

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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-16">
            {FINAL10_TIERS.map((tier, idx) => {
              const isPro = tier.id === "pro" || tier.id === "elite";
              const isPopular = tier.id === mostPopularTier;
              return (
                <motion.div
                  key={tier.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + idx * 0.08 }}
                  className={`rounded-2xl p-8 border relative ${
                    isPro
                      ? "bg-gradient-to-br from-amber-500/18 via-purple-600/16 to-pink-600/18 border-amber-400/50 shadow-[0_0_34px_rgba(250,204,21,0.18)]"
                      : tier.id === "core"
                      ? "bg-gradient-to-br from-purple-600/20 to-pink-600/20 border-purple-500/35"
                      : "bg-gray-800 border-gray-700"
                  }`}
                  style={isPro ? { animation: "pulse 3.1s ease-in-out infinite" } : undefined}
                >
                  {isPopular ? (
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                      <span className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-2 rounded-full text-sm font-semibold">
                        Most Popular
                      </span>
                    </div>
                  ) : null}
                  <div className="flex items-center gap-4 mb-6">
                    <div className={`p-4 rounded-xl ${isPro ? "bg-amber-400/20" : tier.id === "core" ? "bg-purple-500/20" : "bg-blue-500/20"}`}>
                      {isPro ? (
                        <Shield className="h-8 w-8 text-amber-300" />
                      ) : tier.id === "core" ? (
                        <Crown className="h-8 w-8 text-purple-300" />
                      ) : (
                        <Zap className="h-8 w-8 text-blue-400" />
                      )}
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">{tier.name}</h2>
                      <p className="text-gray-300">{tier.description}</p>
                    </div>
                  </div>

                  <div className="mb-8">
                    <div className="text-4xl font-bold text-white mb-2">{tier.priceLabel}</div>
                    <div className="text-gray-300">{tier.subLabel}</div>
                  </div>

                  <div className="space-y-4 mb-8">
                    {tier.features.map((feature) => (
                      <div key={feature} className="flex items-center gap-3">
                        <Check className="h-5 w-5 text-green-400" />
                        <span className={`text-gray-200 ${feature === tier.savvyMultiplier ? "font-semibold" : ""}`}>
                          {feature}
                        </span>
                      </div>
                    ))}
                  </div>

                  <Link
                    to={tier.ctaPath}
                    className={`w-full block text-center ${
                      tier.id === "free" ? "btn btn-outline" : "btn btn-primary"
                    }`}
                  >
                    {tier.id !== "free" ? <Crown className="w-5 h-5 inline mr-2" /> : null}
                    {tier.ctaLabel}
                    {tier.id !== "free" ? <ArrowRight className="w-5 h-5 inline ml-2" /> : null}
                  </Link>
                  {tier.id === "free" ? (
                    <p className="text-xs text-gray-400 mt-3 text-center">
                      Free stays fully usable. Upgrade only for speed and advantage.
                    </p>
                  ) : null}
                </motion.div>
              );
            })}
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


