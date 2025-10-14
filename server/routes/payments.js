const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// Premium subscription plans
const PLANS = {
  monthly: {
    id: 'premium_monthly',
    name: 'Premium Monthly',
    price: 700, // $7.00 in cents
    interval: 'month',
    features: [
      'Unlimited searches',
      'Premium auction access',
      'Advanced filters',
      'Priority support',
      'Exclusive deals'
    ]
  }
};

// Create payment intent for premium subscription
router.post('/create-payment-intent', auth, async (req, res) => {
  try {
    const { planId = 'monthly' } = req.body;
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user already has active premium
    if (user.membershipTier === 'premium' && user.subscriptionExpires && new Date(user.subscriptionExpires) > new Date()) {
      return res.status(400).json({ 
        message: 'You already have an active premium subscription',
        currentExpiry: user.subscriptionExpires
      });
    }

    const plan = PLANS[planId];
    if (!plan) {
      return res.status(400).json({ message: 'Invalid plan' });
    }

    // Create payment intent
    let paymentIntent;
    
    if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY.startsWith('sk_')) {
      // Real Stripe integration
      paymentIntent = await stripe.paymentIntents.create({
        amount: plan.price,
        currency: 'usd',
        metadata: {
          userId: user._id.toString(),
          planId: plan.id,
          userEmail: user.email
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });
    } else {
      // Mock payment intent for testing
      paymentIntent = {
        id: `pi_mock_${Date.now()}`,
        client_secret: `pi_mock_${Date.now()}_secret_mock`,
        status: 'requires_payment_method'
      };
    }

    res.json({
      clientSecret: paymentIntent.client_secret,
      plan: {
        id: plan.id,
        name: plan.name,
        price: plan.price / 100, // Convert cents to dollars
        interval: plan.interval,
        features: plan.features
      }
    });

  } catch (error) {
    console.error('Payment intent creation error:', error);
    res.status(500).json({ message: 'Failed to create payment intent' });
  }
});

// Handle successful payment
router.post('/confirm-payment', auth, async (req, res) => {
  try {
    const { paymentIntentId } = req.body;
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Retrieve payment intent from Stripe (or mock)
    let paymentIntent;
    
    if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY.startsWith('sk_')) {
      // Real Stripe integration
      paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      
      if (paymentIntent.status !== 'succeeded') {
        return res.status(400).json({ message: 'Payment not completed' });
      }
    } else {
      // Mock payment intent for testing
      if (!paymentIntentId.startsWith('pi_mock_')) {
        return res.status(400).json({ message: 'Invalid mock payment intent' });
      }
      paymentIntent = {
        id: paymentIntentId,
        status: 'succeeded',
        metadata: {
          userId: user._id.toString(),
          planId: 'premium_monthly'
        }
      };
    }

    // Verify the payment was for this user
    if (paymentIntent.metadata.userId !== user._id.toString()) {
      return res.status(400).json({ message: 'Payment verification failed' });
    }

    // Calculate subscription expiry (1 month from now)
    const subscriptionExpires = new Date();
    subscriptionExpires.setMonth(subscriptionExpires.getMonth() + 1);

    // Update user to premium
    await User.findByIdAndUpdate(user._id, {
      membershipTier: 'premium',
      subscriptionExpires: subscriptionExpires,
      $inc: { points: 100 } // Bonus points for upgrading
    });

    // Log the transaction (you might want to create a PaymentLog model)
    console.log(`Premium subscription activated for user ${user._id} via payment ${paymentIntentId}`);

    res.json({
      message: 'Premium subscription activated successfully!',
      subscriptionExpires: subscriptionExpires,
      bonusPoints: 100
    });

  } catch (error) {
    console.error('Payment confirmation error:', error);
    res.status(500).json({ message: 'Failed to confirm payment' });
  }
});

// Get current subscription status
router.get('/subscription-status', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isPremium = user.membershipTier === 'premium' && 
                     user.subscriptionExpires && 
                     new Date(user.subscriptionExpires) > new Date();

    res.json({
      isPremium,
      membershipTier: user.membershipTier,
      subscriptionExpires: user.subscriptionExpires,
      daysRemaining: isPremium ? Math.ceil((new Date(user.subscriptionExpires) - new Date()) / (1000 * 60 * 60 * 24)) : 0
    });

  } catch (error) {
    console.error('Subscription status error:', error);
    res.status(500).json({ message: 'Failed to get subscription status' });
  }
});

// Cancel subscription (for future implementation)
router.post('/cancel-subscription', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // For now, just set subscription to expire at end of current period
    // In a full implementation, you'd cancel the Stripe subscription
    await User.findByIdAndUpdate(user._id, {
      membershipTier: 'free',
      subscriptionExpires: null
    });

    res.json({ message: 'Subscription cancelled successfully' });

  } catch (error) {
    console.error('Subscription cancellation error:', error);
    res.status(500).json({ message: 'Failed to cancel subscription' });
  }
});

// Get available plans
router.get('/plans', (req, res) => {
  const plans = Object.values(PLANS).map(plan => ({
    id: plan.id,
    name: plan.name,
    price: plan.price / 100, // Convert cents to dollars
    interval: plan.interval,
    features: plan.features
  }));

  res.json({ plans });
});

module.exports = router;
