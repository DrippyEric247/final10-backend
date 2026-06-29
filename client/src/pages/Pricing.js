import React from 'react';
import { motion } from 'framer-motion';
import { 
  Check, 
  Star, 
  CreditCard,
  Smartphone,
  DollarSign,
  TrendingUp
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { FINAL10_TIERS, getMostPopularTierId } from '../lib/final10SubscriptionTiers';
import Final10Slogan from '../components/branding/Final10Slogan';
import '../styles/subscriptionPlans.css';

const Pricing = () => {
  const mostPopularTier = getMostPopularTierId();

  return (
    <div className="f10-subscription-page">
      <div className="f10-subscription-inner">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Header */}
          <div className="f10-subscription-hero mb-16">
            <h1>Choose Your Plan</h1>
            <p>
              Free, Premium, and Pro — three clear tiers with more Best Moves, faster alerts, and bigger rewards as you upgrade.
            </p>
            <Final10Slogan variant="section" as="p" className="f10-subscription-slogan" />
          </div>

          {/* Pricing Cards */}
          <div className="f10-subscription-grid mb-16">
            {FINAL10_TIERS.map((tier, idx) => {
              const isPro = tier.id === 'pro';
              const isPremium = tier.id === 'core';
              const isPopular = tier.id === mostPopularTier;
              const cardClass = tier.id === 'free'
                ? 'f10-subscription-card--free'
                : isPremium
                ? 'f10-subscription-card--premium'
                : 'f10-subscription-card--pro';
              return (
                <motion.div
                  key={tier.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + idx * 0.08 }}
                  className={`f10-subscription-card ${cardClass} ${isPopular ? 'is-popular' : ''}`}
                >
                  {isPopular ? (
                    <span className="f10-subscription-badge f10-subscription-badge--popular">Most Popular</span>
                  ) : null}
                  {isPro ? (
                    <span className="f10-subscription-badge f10-subscription-badge--pro">Full Power</span>
                  ) : null}
                  <div className="f10-subscription-card-hd">
                    <h2 className="f10-subscription-card-name">{tier.name}</h2>
                    <p className="f10-subscription-card-desc">{tier.description}</p>
                  </div>

                  <div className="f10-subscription-price">{tier.priceLabel}</div>
                  <div className="f10-subscription-price-sub">{tier.subLabel}</div>
                  <div className="f10-subscription-bestmoves">Best Moves: {tier.bestMovesLabel}</div>
                  {tier.eventBonus ? (
                    <div className="f10-subscription-event">Event bonus: {tier.eventBonus}</div>
                  ) : null}

                  <ul className="f10-subscription-features">
                    {tier.features.map((feature) => (
                      <li key={feature}>
                        <Check size={16} aria-hidden />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    to={tier.ctaPath}
                    className={`f10-subscription-cta ${
                      tier.id === 'free'
                        ? 'f10-subscription-cta--free'
                        : isPremium
                        ? 'f10-subscription-cta--premium'
                        : 'f10-subscription-cta--pro'
                    }`}
                    style={{ textDecoration: 'none', textAlign: 'center', display: 'block' }}
                  >
                    {tier.ctaLabel}
                  </Link>
                  {tier.id === 'free' ? (
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
            className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-2xl p-6 sm:p-12 border border-blue-500/30 mb-16"
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


