import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';
import { 
  ArrowLeft,
  CreditCard,
  Check,
  AlertCircle,
  Loader,
  Shield,
  Lock
} from 'lucide-react';
import promotionService from '../services/promotionService';
import { useAuth } from '../context/AuthContext';

// Initialize Stripe (with fallback for testing)
const stripePromise = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY && 
  process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY.startsWith('pk_') 
  ? loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY)
  : null;

const MockPaymentForm = ({ promotion, onSuccess, onError }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleMockPayment = async () => {
    setLoading(true);
    setError(null);

    try {
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock successful payment
      const mockPaymentData = {
        paymentIntentId: `pi_mock_${Date.now()}`,
        amount: promotion.budget,
        status: 'succeeded'
      };

      await promotionService.confirmPayment({
        paymentId: promotion.paymentId,
        paymentIntentId: mockPaymentData.paymentIntentId
      });

      onSuccess(mockPaymentData);
    } catch (err) {
      setError(err.message || 'Payment failed');
      onError(err);
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
                <span>Promotion:</span>
                <span className="text-white">{promotion.promotionPackage.name}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span>Amount:</span>
                <span className="text-white">${promotion.budget}</span>
              </div>
              <div className="flex justify-between">
                <span>Duration:</span>
                <span className="text-white">{promotion.duration}h</span>
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
          <Loader className="w-5 h-5 animate-spin mx-auto" />
        ) : (
          <>
            <CreditCard className="w-5 h-5" />
            Complete Mock Payment - ${promotion.budget}
          </>
        )}
      </button>
    </div>
  );
};

const PaymentForm = ({ promotion, onSuccess, onError }) => {
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
          return_url: `${window.location.origin}/promotion/${promotion._id}/success`,
        },
        redirect: 'if_required',
      });

      if (confirmError) {
        setError(confirmError.message);
      } else if (paymentIntent.status === 'succeeded') {
        // Confirm payment on our server
        await promotionService.confirmPayment({
          paymentId: promotion.paymentId,
          paymentIntentId: paymentIntent.id
        });
        
        onSuccess(paymentIntent);
      }
    } catch (err) {
      setError(err.message || 'Payment failed');
      onError(err);
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
          <Loader className="w-5 h-5 animate-spin mx-auto" />
        ) : (
          <>
            <CreditCard className="w-5 h-5" />
            Pay ${promotion.budget}
          </>
        )}
      </button>
    </form>
  );
};

const PromotionPayment = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();
  
  const [clientSecret, setClientSecret] = useState(null);
  const [paymentData, setPaymentData] = useState(null);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  // Fetch promotion details
  const { data: promotion, isLoading } = useQuery({
    queryKey: ['promotion', id],
    queryFn: () => promotionService.getPromotion(id),
    enabled: !!id && !!user
  });

  // Create payment intent mutation
  const createPaymentIntentMutation = useMutation({
    mutationFn: () => promotionService.createPaymentIntent(id),
    onSuccess: (data) => {
      setClientSecret(data.clientSecret);
      setPaymentData(data);
    },
    onError: (error) => {
      setError(error.response?.data?.message || 'Failed to create payment intent');
    }
  });

  // Confirm payment mutation
  const confirmPaymentMutation = useMutation({
    mutationFn: (paymentData) => promotionService.confirmPayment(paymentData),
    onSuccess: () => {
      setSuccess(true);
      // Invalidate and refetch relevant queries
      queryClient.invalidateQueries(['promotion', id]);
      queryClient.invalidateQueries(['my-promotions']);
      queryClient.invalidateQueries(['promoted-trending']);
    },
    onError: (error) => {
      setError(error.response?.data?.message || 'Payment confirmation failed');
    }
  });

  useEffect(() => {
    if (promotion && promotion.status === 'pending') {
      createPaymentIntentMutation.mutate();
    }
  }, [promotion]);

  const handlePaymentSuccess = (paymentIntent) => {
    confirmPaymentMutation.mutate({
      paymentId: paymentData.paymentId,
      paymentIntentId: paymentIntent.id
    });
  };

  const handlePaymentError = (error) => {
    setError(error.message || 'Payment failed');
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Please login to complete payment</h1>
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <Loader className="h-8 w-8 animate-spin mx-auto mb-4 text-purple-500" />
          <p className="text-gray-400">Loading promotion details...</p>
        </div>
      </div>
    );
  }

  if (!promotion) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Promotion not found</h1>
          <button 
            onClick={() => navigate('/trending')}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg"
          >
            Back to Trending
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md mx-auto"
        >
          <div className="bg-green-500/20 border border-green-500/30 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
            <Check className="h-10 w-10 text-green-400" />
          </div>
          <h1 className="text-2xl font-bold mb-4 text-green-400">Payment Successful!</h1>
          <p className="text-gray-400 mb-6">
            Your promotion has been activated and is now live on the Trending page.
          </p>
          <div className="space-y-4">
            <button 
              onClick={() => navigate('/trending')}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium py-3 px-6 rounded-lg transition-all duration-300"
            >
              View Your Promotion
            </button>
            <button 
              onClick={() => navigate('/promotion-dashboard')}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-3 px-6 rounded-lg transition-colors"
            >
              Manage Promotions
            </button>
          </div>
        </motion.div>
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
              onClick={() => navigate('/promote-listing')}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                Complete Payment
              </h1>
              <p className="text-gray-400">Secure payment for your promotion</p>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Payment Form */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-gray-800 rounded-xl p-8 border border-gray-700"
            >
              <div className="flex items-center space-x-2 mb-6">
                <Shield className="h-5 w-5 text-green-400" />
                <span className="text-green-400 font-medium">Secure Payment</span>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="h-5 w-5 text-red-400" />
                    <p className="text-red-400">{error}</p>
                  </div>
                </div>
              )}

              {createPaymentIntentMutation.isLoading ? (
                <div className="text-center py-8">
                  <Loader className="h-8 w-8 animate-spin mx-auto mb-4 text-purple-500" />
                  <p className="text-gray-400">Preparing payment...</p>
                </div>
              ) : clientSecret && paymentData ? (
                stripePromise ? (
                  <Elements stripe={stripePromise} options={{ clientSecret }}>
                    <PaymentForm 
                      promotion={{ ...promotion, paymentId: paymentData.paymentId }}
                      onSuccess={handlePaymentSuccess}
                      onError={handlePaymentError}
                    />
                  </Elements>
                ) : (
                  <MockPaymentForm 
                    promotion={{ ...promotion, paymentId: paymentData.paymentId }}
                    onSuccess={handlePaymentSuccess}
                    onError={handlePaymentError}
                  />
                )
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-400">Unable to process payment</p>
                </div>
              )}
            </motion.div>
          </div>

          {/* Payment Summary */}
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-gray-800 rounded-xl p-6 border border-gray-700"
            >
              <h3 className="text-lg font-bold mb-4">Payment Summary</h3>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-400">Promotion Package:</span>
                  <span className="text-white font-medium">{promotion.promotionPackage?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Duration:</span>
                  <span className="text-white">{promotion.duration} hours</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Target Category:</span>
                  <span className="text-white capitalize">{promotion.targetCategory}</span>
                </div>
                <div className="border-t border-gray-600 pt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-medium">Total:</span>
                    <span className="text-2xl font-bold text-purple-400">${promotion.budget}</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Security Info */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-gray-800 rounded-xl p-6 border border-gray-700"
            >
              <h3 className="text-lg font-bold mb-4 flex items-center space-x-2">
                <Lock className="h-5 w-5 text-green-400" />
                <span>Secure Payment</span>
              </h3>
              <div className="space-y-3 text-sm text-gray-400">
                <div>• Your payment information is encrypted</div>
                <div>• We use industry-standard security</div>
                <div>• You can cancel anytime</div>
                <div>• 24/7 customer support</div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .payment-form {
          @apply space-y-6;
        }
        
        .payment-element-container {
          @apply bg-gray-700 rounded-lg p-4 border border-gray-600;
        }
        
        .payment-button {
          @apply w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2;
        }
        
        .error-message {
          @apply p-4 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400;
        }
      `}</style>
    </div>
  );
};

export default PromotionPayment;






