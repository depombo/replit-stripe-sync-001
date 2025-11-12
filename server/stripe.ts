import Stripe from "stripe";
import type { Express } from "express";
import express from "express";
import { db } from "./db";
import { customers, subscriptions, userCredits } from "@shared/schema";
import { eq } from "drizzle-orm";
import { storage } from "./storage";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is required");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-10-29.clover",
});

// Price IDs for our products (these should match your Stripe dashboard)
export const PRICE_IDS = {
  CREDITS_10: process.env.STRIPE_PRICE_10_PACK || "price_10pack",
  PRO_MONTHLY: process.env.STRIPE_PRICE_PRO || "price_pro",
  UNLIMITED_MONTHLY: process.env.STRIPE_PRICE_UNLIMITED || "price_unlimited",
};

// Credits mapping
export const CREDITS_MAP: Record<string, number> = {
  [PRICE_IDS.CREDITS_10]: 10,
};

// Subscription limits
export const SUBSCRIPTION_LIMITS: Record<string, number> = {
  [PRICE_IDS.PRO_MONTHLY]: 100,
  [PRICE_IDS.UNLIMITED_MONTHLY]: -1, // -1 means unlimited
};

// Minimal webhook handler for application-specific logic
// Note: Stripe Sync Engine handles all data syncing to the stripe schema
// This handler only processes events that require app-specific actions
export async function setupStripeWebhooks(app: Express) {
  app.post(
    "/api/stripe/webhook",
    express.raw({ type: "application/json" }),
    async (req, res) => {
      const sig = req.headers["stripe-signature"];

      if (!sig) {
        return res.status(400).send("Missing stripe-signature header");
      }

      let event: Stripe.Event;

      try {
        event = stripe.webhooks.constructEvent(
          req.body,
          sig,
          process.env.STRIPE_WEBHOOK_SECRET || ""
        );
      } catch (err: any) {
        console.error("Webhook signature verification failed:", err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      try {
        // Handle application-specific logic only
        switch (event.type) {
          case "checkout.session.completed": {
            const session = event.data.object as Stripe.Checkout.Session;
            
            // If this is a one-time payment for credits, grant them
            if (session.mode === "payment" && session.metadata?.priceId) {
              const priceId = session.metadata.priceId;
              const creditsToAdd = CREDITS_MAP[priceId];
              
              if (creditsToAdd) {
                // Get customer by Stripe customer ID from stripe schema
                const stripeCustomer = await storage.getStripeCustomerById(session.customer as string);

                if (stripeCustomer && stripeCustomer.metadata?.userId) {
                  await storage.addCredits(stripeCustomer.metadata.userId, creditsToAdd);
                  console.log(`Added ${creditsToAdd} credits to user ${stripeCustomer.metadata.userId}`);
                }
              }
            }
            break;
          }

          default:
            // All other events are handled by Stripe Sync Engine
            break;
        }

        res.json({ received: true });
      } catch (error) {
        console.error("Error processing webhook:", error);
        res.status(500).json({ error: "Webhook processing failed" });
      }
    }
  );

  console.log("Application webhook handler configured at /api/stripe/webhook");
}

// Helper to get or create Stripe customer
export async function getOrCreateStripeCustomer(
  userId: string,
  email: string
): Promise<string> {
  try {
    // First try to check stripe.customers table (may not exist until first webhook)
    const existingCustomer = await storage.getStripeCustomerByUserId(userId);
    if (existingCustomer) {
      return existingCustomer.id;
    }
  } catch (error: any) {
    // Table doesn't exist yet, will query Stripe API instead
    console.log('stripe.customers table not available, querying Stripe API directly');
  }

  // Search Stripe API for existing customer with this userId in metadata
  try {
    const customers = await stripe.customers.list({
      email,
      limit: 100,
    });

    const existingCustomer = customers.data.find(
      (c) => c.metadata?.userId === userId
    );

    if (existingCustomer) {
      return existingCustomer.id;
    }
  } catch (error) {
    console.error('Error searching Stripe customers:', error);
  }

  // Create new Stripe customer (will be synced to stripe.customers by webhook)
  const stripeCustomer = await stripe.customers.create({
    email,
    metadata: {
      userId,
    },
  });

  return stripeCustomer.id;
}

// Helper to create checkout session
export async function createCheckoutSession(
  customerId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string
) {
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: CREDITS_MAP[priceId] ? "payment" : "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      priceId,
    },
  });

  return session;
}
