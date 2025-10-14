import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  Check, 
  Crown, 
  Zap, 
  Shield, 
  Star, 
  ArrowRight,
  CreditCard,
  Smartphone,
  DollarSign
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

// Initialize Stripe (with fallback for testing)
const stripePromise = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY && 
  process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY.startsWith('pk_') 
  ? loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY)
  : null;

const MockPaymentForm = ({ plan, onSuccess, onError }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleMockPayment = async () => {
    setLoading(true);
    setError(null);

    try {
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Create a mock payment intent ID
      const mockPaymentIntentId = `pi_mock_${Date.now()}`;
      
      // Confirm payment on our server
      const response = await api.post('/payments/confirm-payment', {
        paymentIntentId: mockPaymentIntentId
      });
      
      if (response.data) {
        onSuccess(response.data);
      }
    } catch (err) {
      setError(err.message || 'Mock payment failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="payment-form">
      <div className="payment-element-container">
        <div className="text-center p-8">
          <div className="text-yellow-400 mb-4">
            <CreditCard className="h-12 w-12 mx-auto" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Mock Payment Mode</h3>
          <p className="text-gray-400 mb-4">
            Stripe is not configured. This is a test payment that will simulate a successful transaction.
          </p>
          <div className="bg-gray-700 rounded-lg p-4 mb-4">
            <div className="text-sm text-gray-300">
              <div className="flex justify-between mb-2">
                <span>Plan:</span>
                <span className="text-white">{plan.name}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span>Amount:</span>
                <span className="text-white">${plan.price}</span>
              </div>
              <div className="flex justify-between">
                <span>Billing:</span>
                <span className="text-white">Every {plan.interval}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      <button 
        onClick={handleMockPayment}
        disabled={loading}
        className="payment-button"
      >
        {loading ? (
          <div className="loading-spinner"></div>
        ) : (
          <>
            <CreditCard className="w-5 h-5" />
            Complete Mock Payment - ${plan.price}/{plan.interval}
          </>
        )}
      </button>
    </div>
  );
};

const PaymentForm = ({ plan, onSuccess, onError }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: submitError } = await elements.submit();
      if (submitError) {
        setError(submitError.message);
        setLoading(false);
        return;
      }

      const { paymentIntent, error: confirmError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/premium?success=true`,
        },
        redirect: 'if_required',
      });

      if (confirmError) {
        setError(confirmError.message);
      } else if (paymentIntent.status === 'succeeded') {
        // Confirm payment on our server
        const response = await api.post('/payments/confirm-payment', {
          paymentIntentId: paymentIntent.id
        });
        
        if (response.data) {
          onSuccess(response.data);
        }
      }
    } catch (err) {
      setError(err.message || 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="payment-form">
      <div className="payment-element-container">
        <PaymentElement />
      </div>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      <button 
        type="submit" 
        disabled={!stripe || loading}
        className="payment-button"
      >
        {loading ? (
          <div className="loading-spinner"></div>
        ) : (
          <>
            <CreditCard className="w-5 h-5" />
            Subscribe for ${plan.price}/{plan.interval}
          </>
        )}
      </button>
    </form>
  );
};

const Premium = () => {
  const { user } = useAuth();
  const [plan, setPlan] = useState(null);
  const [clientSecret, setClientSecret] = useState(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchSubscriptionStatus();
    fetchPlans();
  }, []);

  const fetchSubscriptionStatus = async () => {
    try {
      const response = await api.get('/payments/subscription-status');
      setSubscriptionStatus(response.data);
    } catch (err) {
      console.error('Failed to fetch subscription status:', err);
    }
  };

  const fetchPlans = async () => {
    try {
      const response = await api.get('/payments/plans');
      const monthlyPlan = response.data.plans.find(p => p.id === 'premium_monthly');
      setPlan(monthlyPlan);
    } catch (err) {
      console.error('Failed to fetch plans:', err);
    } finally {
      setLoading(false);
    }
  };

  const createPaymentIntent = async () => {
    try {
      setLoading(true);
      const response = await api.post('/payments/create-payment-intent', {
        planId: 'monthly'
      });
      setClientSecret(response.data.clientSecret);
      setPlan(response.data.plan);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create payment intent');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = (data) => {
    setSuccess(true);
    setClientSecret(null);
    fetchSubscriptionStatus(); // Refresh subscription status
  };

  const handlePaymentError = (error) => {
    setError(error);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-900 pt-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white mb-4">Premium Subscription</h1>
            <p className="text-gray-400">Please login to subscribe to premium</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading && !plan) {
    return (
      <div className="min-h-screen bg-gray-900 pt-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
            <p className="text-gray-400 mt-4">Loading premium plans...</p>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-900 pt-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="bg-green-500/20 border border-green-500/30 rounded-xl p-8 mb-8">
              <Check className="h-16 w-16 text-green-400 mx-auto mb-4" />
              <h1 className="text-3xl font-bold text-white mb-4">Welcome to Premium!</h1>
              <p className="text-gray-300 text-lg">
                Your premium subscription has been activated successfully.
              </p>
              <p className="text-gray-400 mt-2">
                You now have unlimited searches and access to all premium features.
              </p>
            </div>
            <a href="/auctions" className="btn btn-primary">
              Start Browsing Auctions
            </a>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 pt-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-white mb-4">
              Upgrade to Premium
            </h1>
            <p className="text-xl text-gray-400">
              Unlock unlimited searches and premium features
            </p>
          </div>

          {/* Current Status */}
          {subscriptionStatus && (
            <div className="mb-8">
              {subscriptionStatus.isPremium ? (
                <div className="bg-green-500/20 border border-green-500/30 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <Crown className="h-6 w-6 text-green-400" />
                    <h2 className="text-xl font-bold text-white">Premium Active</h2>
                  </div>
                  <p className="text-gray-300">
                    Your premium subscription expires in {subscriptionStatus.daysRemaining} days
                  </p>
                </div>
              ) : (
                <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <Zap className="h-6 w-6 text-yellow-400" />
                    <h2 className="text-xl font-bold text-white">Free Tier</h2>
                  </div>
                  <p className="text-gray-300">
                    Upgrade to premium for unlimited searches and exclusive features
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Free vs Premium Comparison */}
          <div className="mb-12">
            <h2 className="text-3xl font-bold text-white text-center mb-8">Free vs Premium</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Free Tier */}
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <div className="flex items-center gap-3 mb-6">
                  <div className="bg-blue-500/20 p-3 rounded-lg">
                    <Zap className="h-6 w-6 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Free Tier</h3>
                    <p className="text-gray-400">Perfect for getting started</p>
                  </div>
                </div>
                
                <div className="space-y-4">
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
                
                <div className="mt-6 pt-6 border-t border-gray-700">
                  <div className="text-3xl font-bold text-white mb-2">$0</div>
                  <div className="text-gray-400">Forever free</div>
                </div>
              </div>

              {/* Premium Tier */}
              <div className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-xl p-6 border border-purple-500/30 relative">
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
                    Most Popular
                  </span>
                </div>
                
                <div className="flex items-center gap-3 mb-6">
                  <div className="bg-purple-500/20 p-3 rounded-lg">
                    <Crown className="h-6 w-6 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Premium</h3>
                    <p className="text-gray-400">For serious auction hunters</p>
                  </div>
                </div>
                
                <div className="space-y-4">
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
                </div>
                
                <div className="mt-6 pt-6 border-t border-purple-500/30">
                  <div className="text-3xl font-bold text-white mb-2">$7<span className="text-lg text-gray-400">/month</span></div>
                  <div className="text-gray-400">Cancel anytime</div>
                </div>
              </div>
            </div>
          </div>

          {/* Future Multi-App Subscription */}
          <div className="mb-12">
            <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-xl p-8 border border-blue-500/30">
              <div className="text-center">
                <div className="bg-blue-500/20 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <Star className="h-8 w-8 text-blue-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">Coming Soon: Multi-App Subscription</h3>
                <p className="text-gray-300 text-lg mb-6 max-w-3xl mx-auto">
                  We're building a unified subscription system that will give you access to multiple apps across different industries, all with one plan and one universal points system.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                    <div className="text-2xl mb-2">🛒</div>
                    <h4 className="font-semibold text-white mb-2">E-Commerce</h4>
                    <p className="text-sm text-gray-400">Auction platforms, marketplace tools, and shopping assistants</p>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                    <div className="text-2xl mb-2">🏠</div>
                    <h4 className="font-semibold text-white mb-2">Real Estate</h4>
                    <p className="text-sm text-gray-400">Property auctions, market analysis, and investment tools</p>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                    <div className="text-2xl mb-2">🚗</div>
                    <h4 className="font-semibold text-white mb-2">Automotive</h4>
                    <p className="text-sm text-gray-400">Car auctions, vehicle tracking, and automotive services</p>
                  </div>
                </div>
                
                <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
                  <h4 className="text-lg font-semibold text-white mb-3">Universal Benefits</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-400" />
                      <span className="text-gray-300">One subscription, multiple apps</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-400" />
                      <span className="text-gray-300">Shared points across all platforms</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-400" />
                      <span className="text-gray-300">Cross-platform achievements</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-400" />
                      <span className="text-gray-300">Unified dashboard & analytics</span>
                    </div>
                  </div>
                </div>
                
                <div className="mt-6">
                  <p className="text-blue-400 font-medium mb-4">
                    🚀 Early subscribers will get grandfathered pricing and exclusive access to new apps as they launch!
                  </p>
                  <Link 
                    to="/pricing" 
                    className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    View detailed pricing comparison
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Features */}
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-white mb-6">Why Upgrade to Premium?</h2>
              
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Zap className="h-6 w-6 text-purple-400 mt-1" />
                  <div>
                    <h3 className="text-lg font-semibold text-white">Unlimited Searches</h3>
                    <p className="text-gray-400">Search as many auctions as you want, no daily limits</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <Crown className="h-6 w-6 text-purple-400 mt-1" />
                  <div>
                    <h3 className="text-lg font-semibold text-white">Premium Auctions</h3>
                    <p className="text-gray-400">Access to exclusive premium-only auctions</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <Shield className="h-6 w-6 text-purple-400 mt-1" />
                  <div>
                    <h3 className="text-lg font-semibold text-white">Advanced Filters</h3>
                    <p className="text-gray-400">Use advanced filtering options to find exactly what you want</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <Star className="h-6 w-6 text-purple-400 mt-1" />
                  <div>
                    <h3 className="text-lg font-semibold text-white">Priority Support</h3>
                    <p className="text-gray-400">Get priority customer support and faster response times</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <DollarSign className="h-6 w-6 text-purple-400 mt-1" />
                  <div>
                    <h3 className="text-lg font-semibold text-white">Exclusive Deals</h3>
                    <p className="text-gray-400">Access to special deals and discounts not available to free users</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              {!clientSecret ? (
                <div>
                  <h2 className="text-2xl font-bold text-white mb-6">Choose Your Plan</h2>
                  
                  {plan && (
                    <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-xl p-6 mb-6 border border-purple-500/30">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                        <div className="text-right">
                          <div className="text-3xl font-bold text-purple-400">${plan.price}</div>
                          <div className="text-gray-400">per {plan.interval}</div>
                        </div>
                      </div>
                      
                      <ul className="space-y-2 mb-6">
                        {plan.features.map((feature, index) => (
                          <li key={index} className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-400" />
                            <span className="text-gray-300">{feature}</span>
                          </li>
                        ))}
                      </ul>
                      
                      <button
                        onClick={createPaymentIntent}
                        disabled={loading}
                        className="w-full btn btn-primary"
                      >
                        {loading ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mx-auto"></div>
                        ) : (
                          <>
                            <CreditCard className="w-5 h-5" />
                            Subscribe Now
                            <ArrowRight className="w-5 h-5" />
                          </>
                        )}
                      </button>
                    </div>
                  )}
                  
                  {/* Payment Methods */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white">Accepted Payment Methods</h3>
                    <div className="flex items-center gap-4 text-gray-400">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5" />
                        <span>Credit/Debit Cards</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Smartphone className="h-5 w-5" />
                        <span>Apple Pay</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5" />
                        <span>Cash App Pay</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <h2 className="text-2xl font-bold text-white mb-6">Complete Your Payment</h2>
                  
                  {plan && (
                    <div className="mb-6 p-4 bg-gray-700 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="text-white font-medium">{plan.name}</span>
                        <span className="text-purple-400 font-bold">${plan.price}/{plan.interval}</span>
                      </div>
                    </div>
                  )}
                  
                  {stripePromise ? (
                    <Elements stripe={stripePromise} options={{ clientSecret }}>
                      <PaymentForm 
                        plan={plan}
                        onSuccess={handlePaymentSuccess}
                        onError={handlePaymentError}
                      />
                    </Elements>
                  ) : (
                    <MockPaymentForm 
                      plan={plan}
                      onSuccess={handlePaymentSuccess}
                      onError={handlePaymentError}
                    />
                  )}
                  
                  <button
                    onClick={() => setClientSecret(null)}
                    className="w-full mt-4 btn btn-outline"
                  >
                    Back to Plans
                  </button>
                </div>
              )}
              
              {error && (
                <div className="mt-4 p-4 bg-red-500/20 border border-red-500/30 rounded-lg">
                  <p className="text-red-400">{error}</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Premium;
