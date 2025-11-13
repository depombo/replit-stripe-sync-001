import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { StripeAutoSync } from "@supabase/stripe-sync-engine";

const app = express();

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Initialize Stripe Sync Engine handler if configured
  let stripeAutoSync: StripeAutoSync | null = null;

  if (process.env.STRIPE_SECRET_KEY && process.env.DATABASE_URL) {
    // Determine public URL (Replit provides REPLIT_DOMAINS or allow override with PUBLIC_URL)
    const getPublicUrl = (): string => {
      if (process.env.PUBLIC_URL) {
        // Allow override for local testing
        console.log(`Using PUBLIC_URL override: ${process.env.PUBLIC_URL}`);
        return process.env.PUBLIC_URL;
      }

      const replitDomains = process.env.REPLIT_DOMAINS;

      if (!replitDomains) {
        throw new Error('REPLIT_DOMAINS environment variable is required for webhook setup');
      }

      // Parse REPLIT_DOMAINS (can be comma-separated string or JSON array)
      let domain: string;
      try {
        const parsed = JSON.parse(replitDomains);
        domain = Array.isArray(parsed) ? parsed[0] : replitDomains.split(',')[0];
      } catch {
        // Not JSON, treat as comma-separated string
        domain = replitDomains.split(',')[0];
      }

      return `https://${domain}`;
    };

    stripeAutoSync = new StripeAutoSync({
      databaseUrl: process.env.DATABASE_URL,
      stripeApiKey: process.env.STRIPE_SECRET_KEY,
      baseUrl: getPublicUrl,
      webhookPath: '/stripe-webhooks',
      schema: 'stripe',
    });

    // Start Stripe Sync (creates webhook, mounts handler, and applies body parsing)
    try {
      const syncInfo = await stripeAutoSync.start(app);

      log(`Stripe Sync Engine running:`);
      log(`  - Webhook URL: ${syncInfo.webhookUrl}`);
      log(`  - Public URL: ${syncInfo.baseUrl}`);
      log(`  - UUID: ${syncInfo.webhookUuid}`);
    } catch (error) {
      console.error('FATAL: Failed to start Stripe Sync Engine:', error);
      await stripeAutoSync.stop();
      process.exit(1);
    }

    // Body parsing middleware is automatically applied by start()
  } else {
    // Stripe is required for this SaaS application - fail fast if not configured
    console.error('FATAL: Stripe is required but STRIPE_SECRET_KEY or DATABASE_URL is missing');
    process.exit(1);
  }

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    log('Shutting down...');
    if (stripeAutoSync) {
      await stripeAutoSync.stop();
    }
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
})();
