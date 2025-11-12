# PaletteForge - Color Palette Generator

## Overview

PaletteForge is a freemium SaaS application that generates beautiful color palettes using an intelligent algorithm. The application offers one free palette generation, with additional generations available through credit packs or subscription plans. Built as a full-stack TypeScript application with React frontend and Express backend, it integrates Stripe for payments and Replit Auth for authentication.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript, using Vite as the build tool and development server.

**UI Component Library**: shadcn/ui (Radix UI primitives) with Tailwind CSS for styling. The design follows a "new-york" style variant with a neutral color scheme and custom CSS variables for theming.

**Routing**: Wouter for lightweight client-side routing. The application has two main flows:
- Unauthenticated users see a landing page with a call-to-action to log in
- Authenticated users access the main application with palette generation and pricing pages

**State Management**: TanStack Query (React Query) for server state management with custom query client configuration. Authentication state is managed through a custom `useAuth` hook that queries the `/api/auth/user` endpoint.

**Design System**: Custom design tokens defined in CSS variables with support for light/dark themes. Typography uses Inter for UI/body text and Space Grotesk for headings, loaded from Google Fonts CDN. The design emphasizes letting generated colors shine through a minimal interface.

### Backend Architecture

**Framework**: Express.js running on Node.js with TypeScript.

**Authentication**: Replit OpenID Connect (OIDC) authentication using Passport.js strategy. Session management uses express-session with PostgreSQL session store (connect-pg-simple). Sessions persist for 7 days with secure, httpOnly cookies.

**API Design**: RESTful API with JSON responses. Key endpoints include:
- `/api/auth/user` - Get authenticated user information
- `/api/user/status` - Get user's generation count, credits, and subscription status
- `/api/generate` - Create a new color palette generation
- `/api/checkout` - Create Stripe checkout session for purchases
- `/api/stripe/webhook` - Handle Stripe webhook events

**Business Logic**: The application implements a freemium model with three tiers:
- Free: 1 generation
- Credits: Purchase packs of 10 generations
- Subscriptions: Pro (100/month) or Unlimited (-1 means unlimited)

Generation tracking is enforced server-side, checking user credits, monthly generation limits for subscribers, and preventing unauthorized access.

### Database Architecture

**Database**: PostgreSQL accessed via Neon serverless driver with WebSocket support.

**ORM**: Drizzle ORM for type-safe database queries and schema management.

**Schema Design**:

*Application Tables (public schema)*:
- `users` - Stores user profiles from Replit Auth (mandatory table)
- `sessions` - PostgreSQL session storage (mandatory table)
- `generations` - Logs each palette generation with user association
- `userCredits` - Manages credit balances for users

*Stripe Schema Tables (managed by Stripe Sync Engine)*:
- `stripe.customers` - Synced Stripe customer data with metadata containing userId mapping
- `stripe.subscriptions` - Synced Stripe subscription data with status and pricing information
- `stripe.payment_intents` - Payment transaction records
- Other Stripe objects synced automatically

The application queries the `stripe` schema as the source of truth for customer and subscription data, using JSONB metadata fields to link Stripe customers to application users.

### Payment Integration

**Payment Processor**: Stripe with automated data synchronization via Stripe Sync Engine.

**Stripe Sync Engine**: Runs on port 3001 using `@supabase/stripe-sync-engine` to automatically sync all Stripe data to PostgreSQL. The sync engine:
- Automatically creates and manages Stripe webhooks using Replit's public URL
- Syncs all Stripe objects (customers, subscriptions, payments) to the `stripe` schema
- Handles database migrations for Stripe schema tables
- Provides real-time synchronization of Stripe events

**Products**:
- One-time credit packs (10 generations)
- Recurring subscriptions (Pro: 100/month, Unlimited: unlimited)

**Webhook Handling**: 
- Stripe Sync Engine handles core webhook synchronization automatically
- Application webhook handler at `/api/stripe/webhook` processes application-specific logic (credit grants)
- Events are verified using Stripe signature validation with raw request body parsing

**Subscription Status**: The application treats multiple Stripe subscription statuses as valid paid states:
- `active` - Normal active subscription
- `trialing` - User in trial period
- `past_due` - Payment failed but in grace period
- `unpaid` - Subscription unpaid but not yet canceled

**Checkout Flow**: Server-side checkout session creation with success/cancel URLs. The client redirects to Stripe Checkout, and webhooks handle post-payment processing.

## External Dependencies

### Third-Party Services

**Replit Authentication**: OpenID Connect provider for user authentication. Requires `ISSUER_URL`, `REPL_ID`, and `SESSION_SECRET` environment variables.

**Stripe**: Payment processing and subscription management. Requires `STRIPE_SECRET_KEY` and price IDs for products (`STRIPE_PRICE_10_PACK`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_UNLIMITED`).

**Neon Database**: Serverless PostgreSQL database. Requires `DATABASE_URL` connection string with WebSocket support enabled.

### Key npm Packages

**UI & Styling**:
- `@radix-ui/*` - Accessible component primitives
- `tailwindcss` - Utility-first CSS framework
- `class-variance-authority` - Type-safe variant styling
- `lucide-react` - Icon library

**Data & State**:
- `@tanstack/react-query` - Server state management
- `drizzle-orm` - TypeScript ORM
- `zod` - Schema validation

**Authentication & Payments**:
- `openid-client` - OIDC authentication
- `passport` - Authentication middleware
- `stripe` - Stripe API client
- `@stripe/stripe-js` & `@stripe/react-stripe-js` - Stripe frontend integration
- `@supabase/stripe-sync-engine` - Automated Stripe data synchronization to PostgreSQL
- `fastify` - Web framework for Stripe Sync Engine server

**Routing & Forms**:
- `wouter` - Lightweight router
- `react-hook-form` - Form state management
- `@hookform/resolvers` - Form validation

### Development Tools

- `vite` - Build tool and dev server
- `tsx` - TypeScript execution for development
- `esbuild` - Production bundler for backend
- `drizzle-kit` - Database migration tool