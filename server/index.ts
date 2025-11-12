import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { StripeSyncHandler } from "./stripeSyncServer";

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
  let stripeSyncHandler: StripeSyncHandler | null = null;
  
  if (process.env.STRIPE_SECRET_KEY && process.env.DATABASE_URL) {
    // Determine public URL (Replit provides REPLIT_DOMAINS or allow override with PUBLIC_URL)
    let publicUrl: string;
    
    if (process.env.PUBLIC_URL) {
      // Allow override for local testing
      publicUrl = process.env.PUBLIC_URL;
      console.log(`Using PUBLIC_URL override: ${publicUrl}`);
    } else {
      const replitDomains = process.env.REPLIT_DOMAINS;
      
      if (!replitDomains) {
        console.error('FATAL: REPLIT_DOMAINS environment variable is required for webhook setup');
        console.error('This variable is automatically provided by Replit in both development and production');
        console.error('For local testing, set PUBLIC_URL environment variable');
        process.exit(1);
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
      
      publicUrl = `https://${domain}`;
    }
    
    stripeSyncHandler = new StripeSyncHandler({
      databaseUrl: process.env.DATABASE_URL,
      stripeApiKey: process.env.STRIPE_SECRET_KEY,
      publicUrl,
      webhookPath: '/stripe-webhooks',
      schema: 'stripe',
      expressApp: app,
    });

    // CRITICAL: Mount webhook routes BEFORE general JSON parser
    // Webhook needs raw body for signature verification
    stripeSyncHandler.mountWebhook(app);
  } else {
    // Stripe is required for this SaaS application - fail fast if not configured
    console.error('FATAL: Stripe is required but STRIPE_SECRET_KEY or DATABASE_URL is missing');
    process.exit(1);
  }

  // Body parsing for all routes EXCEPT Stripe webhook (which needs raw body)
  app.use((req, res, next) => {
    if (req.path === '/stripe-webhooks') {
      // Skip JSON parsing for webhook - it already has raw body parser
      return next();
    }
    express.json()(req, res, (err) => {
      if (err) return next(err);
      express.urlencoded({ extended: false })(req, res, next);
    });
  });

  // Continue with Stripe initialization (migrations and webhook creation)
  if (stripeSyncHandler) {
    const syncInfo = await stripeSyncHandler.start();
    
    if (syncInfo.status === 'degraded') {
      console.warn('⚠ Stripe Sync Engine running in DEGRADED mode');
      console.warn(`⚠ Reason: ${syncInfo.reason}`);
      
      // In development, fail fast to catch issues early
      if (app.get("env") === "development") {
        console.error('FATAL (dev mode): Stripe Sync Engine failed to start properly');
        await stripeSyncHandler.stop(); // Clean up before exit
        process.exit(1);
      }
      
      // In production, continue with limited functionality
      console.warn('⚠ Continuing in production with limited Stripe functionality');
    } else {
      log(`Stripe Sync Engine running:`);
      log(`  - Webhook URL: ${syncInfo.webhookUrl}`);
      log(`  - Public URL: ${syncInfo.tunnelUrl}`);
    }
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
    if (stripeSyncHandler) {
      await stripeSyncHandler.stop();
    }
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
})();
