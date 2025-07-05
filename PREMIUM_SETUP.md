# Premium Trial Setup Guide

This guide will help you set up the premium trial functionality for your QR Menu application.

## Required Environment Variables

Add these environment variables to your `.env.local` file:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key_here
NEXT_PUBLIC_STRIPE_PRICE_ID=price_your_stripe_price_id_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Application Configuration
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

## Stripe Setup Instructions

### 1. Create a Stripe Account
- Go to [stripe.com](https://stripe.com) and create an account
- Switch to test mode for development

### 2. Get Your API Keys
- Go to Developers → API keys in your Stripe dashboard
- Copy your Publishable key and Secret key
- Add them to your environment variables

### 3. Create a Product and Price
- Go to Products in your Stripe dashboard
- Create a new product called "QR Menu Premium"
- Add a recurring price of $9.99/month
- Copy the price ID (starts with `price_`) and add it to `NEXT_PUBLIC_STRIPE_PRICE_ID`

### 4. Set Up Webhooks
- Go to Developers → Webhooks in your Stripe dashboard
- Add endpoint: `https://yourdomain.com/api/webhook`
- Select these events:
  - `checkout.session.completed`
  - `customer.subscription.trial_will_end`
  - `customer.subscription.deleted`
- Copy the webhook signing secret and add it to `STRIPE_WEBHOOK_SECRET`

## Features Implemented

### Premium Trial Flow
1. **Upgrade Button**: Users see an "Upgrade to Premium" button in the dashboard
2. **Premium Modal**: Shows detailed features and pricing information
3. **7-Day Free Trial**: Users get a 7-day free trial before being charged
4. **Stripe Checkout**: Secure payment processing through Stripe
5. **Success Handling**: Users see confirmation messages after successful payment
6. **Webhook Integration**: Automatically updates premium status in Firebase

### Premium Features Displayed
- Unlimited menu items
- Advanced analytics
- Custom branding
- Priority support
- Printable flyers

### User Experience
- Clear feature descriptions with checkmarks
- Professional pricing display
- Trial period clearly communicated
- Secure payment processing
- Success/error notifications

## Testing the Implementation

1. Start your development server: `npm run dev`
2. Create a restaurant and go to the dashboard
3. Click "Upgrade to Premium" button
4. Complete the Stripe checkout with test card: `4242 4242 4242 4242`
5. Verify the premium status is updated in Firebase
6. Check that success messages appear

## Test Card Numbers

Use these test card numbers in Stripe test mode:
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- Requires authentication: `4000 0025 0000 3155`

## Troubleshooting

### Common Issues
1. **Webhook not working**: Make sure your webhook endpoint is publicly accessible
2. **Price ID not found**: Verify the price ID exists in your Stripe dashboard
3. **Environment variables**: Double-check all environment variables are set correctly
4. **CORS issues**: Ensure your domain is allowed in Stripe settings

### Debug Steps
1. Check browser console for JavaScript errors
2. Check server logs for API errors
3. Verify Stripe webhook events in the dashboard
4. Test with Stripe CLI for local development

## Production Deployment

Before going live:
1. Switch to Stripe live mode
2. Update environment variables with live keys
3. Set up production webhook endpoint
4. Test the complete flow with real cards
5. Monitor webhook events and errors 