# ListAI - From Photo to Product in Seconds

## Overview
An AI-powered batch image upload tool that analyzes product images and generates e-commerce-ready product listings for Shopify, Etsy, and Amazon. Users upload 1-100 images with product context and brand voice, AI generates titles, descriptions, prices, categories, SEO metadata, and AEO (Answer Engine Optimization) content. Users can edit and push products to Shopify, Etsy, and/or Amazon. Store connections via manual credential entry. Monthly subscription at £30/month required to unlock full AI analysis (unlimited images).

## Recent Changes
- 2026-02-23: Added Instagram integration — connect Business/Creator accounts, import posts as products, post products with AI-generated captions
- 2026-02-21: Moved subscription management (subscribe/cancel) into a left sidebar, hidden by default, accessible via toggle button in header or "Upgrade to Pro" button
- 2026-02-19: Changed pricing from $0.50/image to £30/month subscription model
- 2026-02-19: Added subscriptions table (userId, stripeCustomerId, stripeSubscriptionId, status, currentPeriodEnd)
- 2026-02-19: Stripe Checkout now creates subscription (mode: 'subscription') in GBP instead of one-time payment
- 2026-02-19: Subscribers can unlock unlimited AI analysis; non-subscribers see "Upgrade to ListAI Pro" prompt
- 2026-02-19: Added subscription management endpoints (status, create-checkout, verify, cancel, unlock-images)
- 2026-02-19: Added auto-categorization with Shopify taxonomy paths and productType field
- 2026-02-17: Replaced custom email/password auth with Clerk authentication
- 2026-02-17: Added AEO (Answer Engine Optimization) — AI generates FAQ pairs and conversational snippets
- 2026-02-17: App renamed to "ListAI" with slogan "From Photo to Product in Seconds"
- 2026-02-16: Added Amazon SP-API, Etsy, Review Queue modal
- 2026-02-13: Added Stripe payment integration

## Tech Stack
- Frontend: React + Vite + TailwindCSS + shadcn/ui + Framer Motion
- Backend: Express + Drizzle ORM + PostgreSQL
- Auth: Clerk (@clerk/clerk-react + @clerk/express)
- AI: OpenAI (via Replit AI Integrations) - gpt-5.2 for image analysis
- Payments: Stripe (via Replit Stripe Integration) - Subscriptions (£30/month GBP), stripe-replit-sync
- External: Shopify Admin API (REST), Etsy Open API v3 (REST), Amazon SP-API (REST), Instagram Graph API v21.0

## Project Architecture
- `shared/schema.ts` - Database schema (images, shopify_connections, etsy_connections, amazon_connections, instagram_connections, paid_sessions, subscriptions tables)
- `server/routes.ts` - Express API routes (upload, CRUD, Shopify/Etsy/Amazon/Instagram push, payments, Clerk auth)
- `server/storage.ts` - Database storage layer
- `server/db.ts` - Database connection
- `server/stripeClient.ts` - Stripe client setup (via Replit connector)
- `server/webhookHandlers.ts` - Stripe webhook processing
- `client/src/App.tsx` - Root app with ClerkProvider, auth screens, routing
- `client/src/pages/Home.tsx` - Main page with Clerk UserButton, store connections, product management
- `client/src/components/upload-zone.tsx` - Drag & drop upload with payment flow
- `client/src/components/image-card.tsx` - Product card with edit/delete, SEO/AEO tabs
- `client/src/components/review-queue-modal.tsx` - Review queue modal for reviewing/editing/approving products
- `client/src/hooks/use-images.ts` - React Query hooks (images, payments, store connections)
- `client/src/hooks/use-auth.ts` - Clerk auth hook wrapper (useUser, signOut)

## Payment Flow (Subscription Model)
1. User uploads product images (FREE) with product context description + brand voice selection
2. AI generates quick preview using seller's context: title, category, productType, tags for each image
3. Products appear with "Preview" status showing basic info, productContext and brandTone stored per image
4. Locked fields: description, pricing, SEO, variants (shown as locked)
5. Non-subscribers see "Upgrade to ListAI Pro" banner → Subscribe button opens dialog → redirected to Stripe Checkout (£30/month subscription)
6. After subscription, subscribers click "Unlock All" → server checks active subscription → runs full AI analysis
7. Products updated with full descriptions, pricing, SEO, AEO, variants → paymentStatus = "paid"
8. User can review in Review Queue modal → push to Shopify/Etsy/Amazon (only paid products)

## API Endpoints
- GET /api/auth/clerk-config - Get Clerk publishable key for frontend
- GET /api/payments/config - Get Stripe publishable key and subscription pricing
- GET /api/subscription/status - Check user's subscription status
- POST /api/subscription/create-checkout - Create Stripe Checkout for £30/month subscription
- POST /api/subscription/verify - Verify subscription after Stripe checkout
- POST /api/subscription/cancel - Cancel subscription (at period end)
- POST /api/subscription/unlock-images - Unlock images with active subscription (runs full AI analysis)
- POST /api/images/upload - Upload images (FREE, quick AI preview only)
- GET /api/images - List products (user-scoped via Clerk userId)
- PUT /api/images/:id - Update product details (ownership checked)
- DELETE /api/images/:id - Delete product (ownership checked)
- POST /api/images/push-to-shopify - Push selected products to Shopify
- POST /api/images/push-to-etsy - Push selected products to Etsy
- POST /api/images/push-to-amazon - Push selected products to Amazon
- POST /api/shopify/connect - Connect Shopify store
- POST /api/shopify/disconnect - Disconnect Shopify store
- GET /api/shopify/status - Check Shopify connection status
- POST /api/etsy/connect - Connect Etsy store
- POST /api/etsy/disconnect - Disconnect Etsy store
- GET /api/etsy/status - Check Etsy connection status
- POST /api/amazon/connect - Connect Amazon seller account
- POST /api/amazon/disconnect - Disconnect Amazon seller account
- GET /api/amazon/status - Check Amazon connection status
- POST /api/instagram/connect - Connect Instagram Business/Creator account (accessToken + userId)
- POST /api/instagram/disconnect - Disconnect Instagram account
- GET /api/instagram/status - Check Instagram connection status
- POST /api/instagram/import - Import media from Instagram (optional mediaId for single, otherwise bulk)
- POST /api/instagram/post - Post product image to Instagram with caption (container-based publishing)
- POST /api/instagram/generate-caption - AI-generate Instagram caption with hashtags for a product
- POST /api/stripe/webhook - Stripe webhook handler

## Environment Variables
- DATABASE_URL (auto-provisioned)
- CLERK_PUBLISHABLE_KEY (from Clerk Dashboard)
- CLERK_SECRET_KEY (from Clerk Dashboard)
- AI_INTEGRATIONS_OPENAI_API_KEY (auto-provisioned)
- AI_INTEGRATIONS_OPENAI_BASE_URL (auto-provisioned)
- SHOPIFY_CLIENT_ID (from Shopify Partner Dashboard)
- SHOPIFY_CLIENT_SECRET (from Shopify Partner Dashboard)
- Stripe keys managed via Replit Stripe connector (auto-provisioned)

## User Preferences
- Dark theme with purple accent (AI/cyber aesthetic)
- Space Grotesk for headings, Inter for body text
- Pricing: £30/month subscription (unlimited images)
