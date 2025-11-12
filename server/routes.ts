import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { 
  setupStripeWebhooks, 
  stripe, 
  getOrCreateStripeCustomer, 
  createCheckoutSession,
  PRICE_IDS,
  CREDITS_MAP,
  SUBSCRIPTION_LIMITS 
} from "./stripe";
import { insertGenerationSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);
  
  // Setup webhook handler for application-specific logic
  // (Stripe Sync Engine on port 3001 handles all data syncing)
  await setupStripeWebhooks(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Get user generation status
  app.get('/api/user/status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Get total generations
      const generations = await storage.getUserGenerations(userId);
      const totalGenerations = generations.length;
      
      // Get this month's generations
      const monthlyGenerations = await storage.countUserGenerationsThisMonth(userId);
      
      // Get credits
      const userCredits = await storage.getUserCredits(userId);
      const credits = userCredits?.credits || 0;
      
      // Check for active subscription from stripe schema
      const stripeCustomer = await storage.getStripeCustomerByUserId(userId);
      let subscription = null;
      let monthlyLimit = 1; // Default free limit
      
      if (stripeCustomer) {
        subscription = await storage.getActiveSubscription(stripeCustomer.id);
        if (subscription && subscription.items?.data?.[0]?.price?.id) {
          const priceId = subscription.items.data[0].price.id;
          const limit = SUBSCRIPTION_LIMITS[priceId];
          if (limit !== undefined) {
            monthlyLimit = limit; // -1 for unlimited
          }
        }
      }
      
      // Calculate remaining generations
      let remainingGenerations = 1 - totalGenerations; // Free tier: 1 generation total
      
      if (subscription) {
        // Has active subscription
        if (monthlyLimit === -1) {
          remainingGenerations = -1; // Unlimited
        } else {
          remainingGenerations = monthlyLimit - monthlyGenerations;
        }
      } else if (credits > 0) {
        // Has credits
        remainingGenerations = credits;
      }
      
      res.json({
        totalGenerations,
        monthlyGenerations,
        credits,
        remainingGenerations,
        hasSubscription: !!subscription,
        subscriptionStatus: subscription?.status || null,
        isUnlimited: monthlyLimit === -1,
      });
    } catch (error) {
      console.error("Error fetching user status:", error);
      res.status(500).json({ message: "Failed to fetch user status" });
    }
  });

  // Generate palette
  app.post('/api/generate', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Check if user can generate
      const statusResponse = await fetch(`${req.protocol}://${req.get('host')}/api/user/status`, {
        headers: {
          cookie: req.headers.cookie || '',
        },
      });
      
      if (!statusResponse.ok) {
        return res.status(500).json({ message: "Failed to check generation status" });
      }
      
      const status = await statusResponse.json();
      
      if (status.remainingGenerations === 0) {
        return res.status(403).json({ 
          message: "No generations remaining",
          needsUpgrade: true 
        });
      }
      
      // Validate request
      const result = insertGenerationSchema.safeParse({
        userId,
        palette: req.body.palette,
        harmony: req.body.harmony,
      });
      
      if (!result.success) {
        return res.status(400).json({ message: "Invalid request data" });
      }
      
      // Create generation
      const generation = await storage.createGeneration(result.data);
      
      // Deduct credit if using credits (not subscription or free tier)
      if (status.credits > 0 && !status.hasSubscription) {
        await storage.deductCredit(userId);
      }
      
      res.json(generation);
    } catch (error) {
      console.error("Error generating palette:", error);
      res.status(500).json({ message: "Failed to generate palette" });
    }
  });

  // Get user's generations
  app.get('/api/generations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const generations = await storage.getUserGenerations(userId);
      res.json(generations);
    } catch (error) {
      console.error("Error fetching generations:", error);
      res.status(500).json({ message: "Failed to fetch generations" });
    }
  });

  // Create Stripe checkout session
  app.post('/api/checkout', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { priceId } = req.body;
      
      if (!priceId) {
        return res.status(400).json({ message: "Price ID is required" });
      }
      
      // Validate price ID
      const validPriceIds = Object.values(PRICE_IDS);
      if (!validPriceIds.includes(priceId)) {
        return res.status(400).json({ message: "Invalid price ID" });
      }
      
      // Get user
      const user = await storage.getUser(userId);
      if (!user || !user.email) {
        return res.status(400).json({ message: "User email is required" });
      }
      
      // Get or create Stripe customer
      const stripeCustomerId = await getOrCreateStripeCustomer(userId, user.email);
      
      // Create checkout session
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const session = await createCheckoutSession(
        stripeCustomerId,
        priceId,
        `${baseUrl}/?success=true`,
        `${baseUrl}/?canceled=true`
      );
      
      res.json({ url: session.url });
    } catch (error) {
      console.error("Error creating checkout session:", error);
      res.status(500).json({ message: "Failed to create checkout session" });
    }
  });

  // Note: Payment success is handled by our webhook handler at /api/stripe/webhook
  // Credit grants are processed when checkout.session.completed events arrive

  const httpServer = createServer(app);
  return httpServer;
}
