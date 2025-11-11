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

export async function setupStripeWebhooks(app: Express) {
  // Stripe webhooks require raw body for signature verification
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
        // Handle the event
        switch (event.type) {
          case "customer.created":
          case "customer.updated": {
            const customer = event.data.object as Stripe.Customer;
            const userId = customer.metadata?.userId;
            
            if (userId) {
              await db
                .insert(customers)
                .values({
                  stripeCustomerId: customer.id,
                  userId,
                  email: customer.email || null,
                })
                .onConflictDoUpdate({
                  target: customers.stripeCustomerId,
                  set: {
                    email: customer.email || null,
                    updatedAt: new Date(),
                  },
                });
            }
            break;
          }

          case "customer.subscription.created":
          case "customer.subscription.updated": {
            const subscription = event.data.object as Stripe.Subscription;
            
            // Get customer from our DB
            const [customer] = await db
              .select()
              .from(customers)
              .where(eq(customers.stripeCustomerId, subscription.customer as string));

            if (customer) {
              await db
                .insert(subscriptions)
                .values({
                  stripeSubscriptionId: subscription.id,
                  customerId: customer.id,
                  status: subscription.status,
                  priceId: subscription.items.data[0]?.price.id || null,
                  productId: subscription.items.data[0]?.price.product as string || null,
                  currentPeriodStart: new Date(subscription.current_period_start * 1000),
                  currentPeriodEnd: new Date(subscription.current_period_end * 1000),
                  cancelAtPeriodEnd: subscription.cancel_at_period_end,
                })
                .onConflictDoUpdate({
                  target: subscriptions.stripeSubscriptionId,
                  set: {
                    status: subscription.status,
                    priceId: subscription.items.data[0]?.price.id || null,
                    currentPeriodStart: new Date(subscription.current_period_start * 1000),
                    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
                    cancelAtPeriodEnd: subscription.cancel_at_period_end,
                    updatedAt: new Date(),
                  },
                });
            }
            break;
          }

          case "customer.subscription.deleted": {
            const subscription = event.data.object as Stripe.Subscription;
            
            await db
              .update(subscriptions)
              .set({
                status: "canceled",
                updatedAt: new Date(),
              })
              .where(eq(subscriptions.stripeSubscriptionId, subscription.id));
            break;
          }

          case "checkout.session.completed": {
            const session = event.data.object as Stripe.Checkout.Session;
            
            // If this is a one-time payment, grant credits
            if (session.mode === "payment" && session.metadata?.priceId) {
              const priceId = session.metadata.priceId;
              const creditsToAdd = CREDITS_MAP[priceId];
              
              if (creditsToAdd) {
                // Get customer
                const [customer] = await db
                  .select()
                  .from(customers)
                  .where(eq(customers.stripeCustomerId, session.customer as string));

                if (customer && customer.userId) {
                  await storage.addCredits(customer.userId, creditsToAdd);
                }
              }
            }
            break;
          }

          default:
            console.log(`Unhandled event type: ${event.type}`);
        }

        res.json({ received: true });
      } catch (error) {
        console.error("Error processing webhook:", error);
        res.status(500).json({ error: "Webhook processing failed" });
      }
    }
  );

  console.log("Stripe webhook handler configured at /api/stripe/webhook");
}

// Helper to get or create Stripe customer
export async function getOrCreateStripeCustomer(
  userId: string,
  email: string
): Promise<string> {
  // Check if customer already exists in our DB
  const [existingCustomer] = await db
    .select()
    .from(customers)
    .where(eq(customers.userId, userId));

  if (existingCustomer) {
    return existingCustomer.stripeCustomerId;
  }

  // Create new Stripe customer
  const stripeCustomer = await stripe.customers.create({
    email,
    metadata: {
      userId,
    },
  });

  // Save to database
  await db.insert(customers).values({
    stripeCustomerId: stripeCustomer.id,
    userId,
    email,
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
