# eBay API Setup Guide

## Current Issue
You're getting an `invalid_scope` error when trying to access the eBay API. This means your eBay application doesn't have the correct scopes configured.

## Step-by-Step Setup

### 1. Create eBay Developer Account
1. Go to https://developer.ebay.com/
2. Sign in with your eBay account
3. If you don't have an eBay account, create one first

### 2. Create a New Application
1. Go to "My Account" > "Applications"
2. Click "Create an App Key"
3. Fill out the application form:
   - **App Name**: Your app name (e.g., "Final10 Auction App")
   - **App Type**: Select "Web Application"
   - **App Purpose**: Select "Commercial" or "Personal" as appropriate
   - **App Description**: Describe your application

### 3. Configure Scopes
**IMPORTANT**: You need to enable the correct scopes for your application:

1. In your app settings, go to "OAuth Scopes"
2. Enable these scopes:
   - `https://api.ebay.com/oauth/api_scope/buy.browse` (for searching items)
   - `https://api.ebay.com/oauth/api_scope/buy.item.feed` (for item details)

### 4. Get Your Credentials
1. After creating the app, you'll see:
   - **Client ID** (App ID)
   - **Client Secret** (Cert ID)
2. Copy these values

### 5. Environment Configuration
Create a `.env` file in your server directory with:

```env
# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/final10

# Server Configuration
PORT=5000
NODE_ENV=development

# eBay API Configuration
EBAY_CLIENT_ID=your_actual_client_id_here
EBAY_CLIENT_SECRET=your_actual_client_secret_here

# JWT Secret
JWT_SECRET=your_jwt_secret_here
```

### 6. Test Your Setup
Run the test script:
```bash
node test-ebay-setup.js
```

## Common Issues

### Issue 1: "invalid_scope" Error
- **Cause**: Your app doesn't have the required scopes enabled
- **Solution**: Go to your eBay app settings and enable the `buy.browse` scope

### Issue 2: "invalid_client" Error
- **Cause**: Wrong credentials or app not properly configured
- **Solution**: Double-check your Client ID and Client Secret

### Issue 3: "client authentication failed"
- **Cause**: Credentials are incorrect or app is not approved
- **Solution**: Verify credentials and ensure app is in "Live" status

## Sandbox vs Production

### Sandbox (for testing)
- Use sandbox credentials for development
- Limited data but good for testing
- URL: `https://api.sandbox.ebay.com/`

### Production (for live app)
- Use production credentials for live app
- Full access to eBay data
- URL: `https://api.ebay.com/`

## Alternative Approach (if scopes don't work)

If you continue having issues with the `buy.browse` scope, you can try:

1. **Use a different scope**: Some apps work better with `https://api.ebay.com/oauth/api_scope`
2. **Contact eBay Support**: If your app needs special approval for certain scopes
3. **Use eBay's public APIs**: Some endpoints don't require authentication

## Testing Your Setup

After setting up your credentials, test with:

```bash
# Test the setup
node test-ebay-setup.js

# Test a search
curl "http://localhost:5000/api/ebay/search?q=iPhone"
```

## Next Steps

1. Set up your eBay developer account
2. Create an application with the correct scopes
3. Add your credentials to the `.env` file
4. Test the setup
5. Your eBay integration should work!

## Support

If you continue having issues:
1. Check eBay's developer documentation: https://developer.ebay.com/
2. Contact eBay developer support
3. Check the eBay developer forums

