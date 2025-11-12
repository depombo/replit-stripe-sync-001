import Stripe from "stripe";
import type { Express } from "express";
import express from "express";
import { db } from "./db";
import { customers, subscriptions } from "@shared/schema";
import { eq } from "drizzle-orm";
import { storage } from "./storage";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is required");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-10-29.clover",
});

// Price IDs for subscription products
export const PRICE_IDS = {
  PRO_MONTHLY: process.env.STRIPE_PRICE_PRO || "price_pro",
  UNLIMITED_MONTHLY: process.env.STRIPE_PRICE_UNLIMITED || "price_unlimited",
};

// Subscription limits (monthly generation limits)
export const SUBSCRIPTION_LIMITS: Record<string, number> = {
  [PRICE_IDS.PRO_MONTHLY]: 100,
  [PRICE_IDS.UNLIMITED_MONTHLY]: -1, // -1 means unlimited
};

// Helper to get or create Stripe customer
export async function getOrCreateStripeCustomer(
  userId: string,
  email: string
): Promise<string> {
  // Check if customer already exists in stripe.customers table
  const existingCustomer = await storage.getStripeCustomerByUserId(userId);
  if (existingCustomer) {
    return existingCustomer.id;
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

// Helper to create checkout session (subscription only)
export async function createCheckoutSession(
  customerId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string
) {
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
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
