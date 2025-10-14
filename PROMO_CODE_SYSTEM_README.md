# Promo Code & Influencer System

A comprehensive promo code and influencer commission system for Node.js/Express/MongoDB with React frontend.

## 🚀 Features

### Core Functionality
- **Promo Code Creation**: Users can create custom promo codes with various discount types
- **Code Validation**: Real-time validation with usage limits and expiration dates
- **Commission Tracking**: Automatic commission calculation and tracking for creators
- **Analytics Dashboard**: Comprehensive analytics for creators and admins
- **Payout Management**: Admin-controlled commission approval and payout system

### Discount Types
- **Percentage**: X% off total order
- **Fixed Amount**: $X off total order  
- **Free Shipping**: Free shipping on orders

### Usage Controls
- **Total Usage Limit**: Maximum number of times a code can be used
- **Per-User Limit**: How many times a single user can use the code
- **Minimum Order Value**: Required minimum order amount
- **Expiration Dates**: Time-based code validity
- **Creator Attribution**: Track which creator/influencer gets commission

## 📁 File Structure

### Backend (Server)
```
server/
├── models/
│   ├── PromoCode.js          # Main promo code model
│   ├── PromoCodeUsage.js     # Usage tracking model
│   └── Commission.js         # Commission tracking model
├── routes/
│   └── promoCodes.js         # API routes for promo codes
├── middleware/
│   ├── auth.js               # Authentication middleware
│   └── promoCodeValidation.js # Validation middleware
└── utils/
    └── promoCodeUtils.js     # Utility functions
```

### Frontend (Client)
```
src/
├── components/
│   ├── PromoCodeEntry.js     # Code entry component
│   ├── PromoCodeCreator.js   # Code creation form
│   └── PromoCodeAnalytics.js # Analytics dashboard
├── pages/
│   ├── PromoCodeDashboard.js # Creator dashboard
│   └── AdminPromoCodeDashboard.js # Admin dashboard
└── services/
    └── promoCodeService.js   # API service layer
```

## 🛠 Installation & Setup

### 1. Backend Setup

The promo code routes are already integrated into your main server file (`server/index.js`). Make sure you have the required dependencies:

```bash
# Required packages (likely already installed)
npm install mongoose express jsonwebtoken
```

### 2. Database Models

The system uses three main MongoDB collections:

- **promocodes**: Stores promo code definitions
- **promocodeusages**: Tracks individual code redemptions
- **commissions**: Manages creator commission payouts

### 3. Frontend Integration

Add the promo code components to your React app:

```jsx
// Example: Add to your checkout page
import PromoCodeEntry from '../components/PromoCodeEntry';

function CheckoutPage() {
  const [appliedCode, setAppliedCode] = useState(null);
  const [orderValue, setOrderValue] = useState(100);

  const handleCodeApplied = (codeData) => {
    setAppliedCode(codeData);
    // Update your order total
  };

  const handleCodeRemoved = () => {
    setAppliedCode(null);
    // Reset order total
  };

  return (
    <div>
      <h2>Checkout</h2>
      <PromoCodeEntry
        onCodeApplied={handleCodeApplied}
        onCodeRemoved={handleCodeRemoved}
        orderValue={orderValue}
        appliedCode={appliedCode}
      />
    </div>
  );
}
```

## 📊 API Endpoints

### Public Endpoints
- `GET /api/promo-codes/public` - Get all active public promo codes
- `POST /api/promo-codes/validate` - Validate a promo code
- `POST /api/promo-codes/apply` - Apply a promo code to an order

### Creator Endpoints
- `GET /api/promo-codes/creator/my-codes` - Get creator's promo codes
- `GET /api/promo-codes/creator/stats` - Get creator statistics
- `GET /api/promo-codes/creator/commissions` - Get creator's commissions
- `POST /api/promo-codes/creator/create` - Create new promo code
- `PUT /api/promo-codes/creator/:id` - Update promo code
- `GET /api/promo-codes/creator/:id/usage` - Get code usage history

### Admin Endpoints
- `GET /api/promo-codes/admin/all` - Get all promo codes
- `GET /api/promo-codes/admin/analytics` - Get admin analytics
- `POST /api/promo-codes/admin/create` - Create promo code (admin)
- `PUT /api/promo-codes/admin/:id` - Update promo code (admin)
- `DELETE /api/promo-codes/admin/:id` - Delete promo code
- `GET /api/promo-codes/admin/commissions` - Get all commissions
- `PUT /api/promo-codes/admin/commissions/:id/approve` - Approve commission
- `PUT /api/promo-codes/admin/commissions/:id/pay` - Pay commission

## 💡 Usage Examples

### Creating a Promo Code

```javascript
// Frontend: Create promo code
const createPromoCode = async () => {
  const promoData = {
    code: 'SAVE20',
    description: '20% off your first order',
    discountType: 'percentage',
    discountValue: 20,
    usageLimit: 100,
    userUsageLimit: 1,
    minimumOrderValue: 50,
    commissionRate: 5,
    validUntil: '2024-12-31T23:59:59Z'
  };

  try {
    const response = await promoCodeService.createPromoCode(promoData);
    console.log('Promo code created:', response.data);
  } catch (error) {
    console.error('Error creating promo code:', error);
  }
};
```

### Applying a Promo Code

```javascript
// Frontend: Apply promo code during checkout
const applyPromoCode = async (code, orderValue) => {
  try {
    // First validate the code
    const validation = await promoCodeService.validatePromoCode(code, orderValue);
    
    if (validation.data.valid) {
      // Apply the code
      const application = await promoCodeService.applyPromoCode(code, orderValue);
      
      console.log('Code applied successfully');
      console.log('Discount:', application.data.discount);
      console.log('Final amount:', application.data.discount.finalAmount);
    }
  } catch (error) {
    console.error('Error applying promo code:', error.response.data.message);
  }
};
```

### Admin: Managing Commissions

```javascript
// Backend: Approve and pay commissions
const approveCommission = async (req, res) => {
  try {
    const { commissionId } = req.params;
    const commission = await Commission.findById(commissionId);
    
    if (commission) {
      await commission.approve(req.user.id);
      res.json({ message: 'Commission approved successfully' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error approving commission' });
  }
};

const payCommission = async (req, res) => {
  try {
    const { commissionId } = req.params;
    const { paidAmount, transactionId } = req.body;
    
    const commission = await Commission.findById(commissionId);
    if (commission) {
      await commission.pay(paidAmount, transactionId);
      res.json({ message: 'Commission paid successfully' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error paying commission' });
  }
};
```

## 🔧 Configuration

### Environment Variables

Add these to your `.env` file:

```env
# JWT Secret (for authentication)
JWT_SECRET=your_jwt_secret_here

# Database
MONGODB_URI=mongodb://localhost:27017/final10

# Client URL (for referral links)
CLIENT_URL=http://localhost:3000
```

### User Roles

The system supports different user roles:

- **Regular Users**: Can use promo codes
- **Creators/Influencers**: Can create promo codes and earn commissions
- **Admins**: Can manage all promo codes and approve/pay commissions

### Commission Settings

- **Default Commission Rate**: 5% (configurable per code)
- **Minimum Payout**: $25 (configurable)
- **Payout Methods**: PayPal, Bank Transfer, Check, Points

## 📈 Analytics & Reporting

### Creator Analytics
- Total codes created
- Active codes
- Total usage
- Total revenue generated
- Commission earned
- Usage trends over time

### Admin Analytics
- System-wide promo code performance
- Top performing codes
- Pending payouts
- Revenue attribution
- Commission payouts

## 🔒 Security Features

- **Code Format Validation**: Only alphanumeric characters, underscores, and hyphens
- **Usage Limits**: Prevent abuse with per-user and total usage limits
- **Authentication**: All endpoints require valid JWT tokens
- **Authorization**: Role-based access control
- **Input Validation**: Comprehensive validation on all inputs
- **Rate Limiting**: Built-in rate limiting for API endpoints

## 🚀 Deployment Considerations

### Production Setup
1. **Database Indexes**: Ensure proper MongoDB indexes for performance
2. **Caching**: Consider Redis caching for frequently accessed codes
3. **Monitoring**: Set up monitoring for promo code usage and performance
4. **Backup**: Regular database backups for commission tracking
5. **Security**: Use HTTPS and secure JWT secrets

### Performance Optimization
- Index on `code`, `creator`, `isActive`, and date fields
- Use aggregation pipelines for analytics
- Implement caching for public promo codes
- Consider pagination for large datasets

## 🧪 Testing

### Unit Tests
Test individual functions like code validation, commission calculation, etc.

### Integration Tests
Test the full flow from code creation to commission payout.

### Load Testing
Test promo code validation under high load.

## 📝 Customization

### Adding New Discount Types
1. Update the `discountType` enum in the PromoCode model
2. Modify the `calculateDiscount` method
3. Update the frontend validation

### Custom Commission Rules
1. Modify the `calculateCommission` utility function
2. Update the commission creation logic
3. Adjust the admin approval workflow

### Additional Analytics
1. Extend the analytics aggregation pipelines
2. Add new chart types to the frontend
3. Create custom reporting endpoints

## 🤝 Contributing

1. Follow the existing code style
2. Add tests for new features
3. Update documentation
4. Ensure backward compatibility

## 📄 License

This promo code system is part of your Final10 project and follows your existing license terms.

---

## 🎯 Quick Start Checklist

- [ ] Backend models created and routes integrated
- [ ] Frontend components added to your React app
- [ ] Database indexes created
- [ ] User roles configured
- [ ] Commission settings configured
- [ ] Admin dashboard accessible
- [ ] Creator dashboard functional
- [ ] Promo code entry component integrated
- [ ] Analytics working
- [ ] Payout system tested

Your promo code and influencer system is now ready to use! 🎉







