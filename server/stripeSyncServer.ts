import { StripeSync } from '@supabase/stripe-sync-engine';
import { runStripeMigrations } from './stripeMigrations';
import express, { Express } from 'express';
import { type PoolConfig } from 'pg';
import { createWebhook, deleteWebhook } from './stripeWebhook';

export interface StripeSyncHandlerOptions {
  databaseUrl: string;
  stripeApiKey: string;
  publicUrl: string; // Required - from REPLIT_DOMAINS env var
  webhookPath?: string;
  schema?: string;
  stripeApiVersion?: string;
  autoExpandLists?: boolean;
  backfillRelatedEntities?: boolean;
  expressApp: Express; // Main Express app to mount routes on
}

export interface StripeSyncHandlerInfo {
  tunnelUrl: string;
  webhookUrl: string;
  status: 'ready' | 'degraded';
  reason?: string;
}

/**
 * Encapsulates the entire Stripe Sync orchestration:
 * - Uses Replit's public URL (REPLIT_DOMAINS env var)
 * - Sets up Stripe webhook
 * - Runs database migrations
 * - Mounts webhook handler on provided Express app
 */
export class StripeSyncHandler {
  private options: StripeSyncHandlerOptions & {
    webhookPath: string;
    schema: string;
    stripeApiVersion: string;
    autoExpandLists: boolean;
    backfillRelatedEntities: boolean;
  };
  private webhookId: string | null = null;
  private stripeSync: StripeSync | null = null;

  constructor(options: StripeSyncHandlerOptions) {
    this.options = {
      webhookPath: '/stripe-webhooks',
      schema: 'stripe',
      stripeApiVersion: '2020-08-27',
      autoExpandLists: false,
      backfillRelatedEntities: true,
      ...options,
    };
  }

  /**
   * Starts the complete Stripe Sync infrastructure:
   * 1. Uses public URL from Replit (REPLIT_DOMAINS env var)
   * 2. Runs database migrations
   * 3. Creates StripeSync instance
   * 4. Mounts webhook routes on Express app
   * 5. Creates Stripe webhook endpoint
   *
   * @returns Information about the running instance with status
   */
  async start(): Promise<StripeSyncHandlerInfo> {
    try {
      // 1. Use Replit's public URL
      const publicUrl = this.options.publicUrl;
      console.log(`Using public URL: ${publicUrl}`);
      
      // Webhook URL is just publicUrl + path (no port - Autoscale only exposes one port)
      const webhookUrl = `${publicUrl}${this.options.webhookPath}`;

      // 2. Run migrations
      try {
        console.log('Running Stripe Sync database migrations...');
        await runStripeMigrations(this.options.schema);
        console.log('✓ Database migrations complete');
      } catch (error: any) {
        console.error('Database migration failed:', error);
        return {
          tunnelUrl: publicUrl,
          webhookUrl,
          status: 'degraded',
          reason: `Migration failed: ${error.message}`
        };
      }

      // 3. Create webhook and get the signing secret
      let webhook;
      try {
        webhook = await createWebhook(this.options.stripeApiKey, webhookUrl);
        this.webhookId = webhook.id;
      } catch (error: any) {
        // Handle webhook creation failures gracefully
        if (error.message?.includes('maximum') || error.code === 'resource_exhausted') {
          console.warn('⚠ Stripe webhook limit reached. App will run in degraded mode.');
          console.warn('⚠ Please delete unused webhooks from: https://dashboard.stripe.com/webhooks');
          return {
            tunnelUrl: publicUrl,
            webhookUrl,
            status: 'degraded',
            reason: 'Webhook limit reached. Please clean up old webhooks in Stripe Dashboard.'
          };
        }
        throw error; // Re-throw other errors
      }
      
      const webhookSecret = webhook.secret;

      // 4. Create StripeSync instance
      const poolConfig: PoolConfig = {
        max: 10,
        connectionString: this.options.databaseUrl,
        keepAlive: true,
      };

      this.stripeSync = new StripeSync({
        databaseUrl: this.options.databaseUrl,
        schema: this.options.schema,
        stripeSecretKey: this.options.stripeApiKey,
        stripeWebhookSecret: webhookSecret,
        stripeApiVersion: this.options.stripeApiVersion,
        autoExpandLists: this.options.autoExpandLists,
        backfillRelatedEntities: this.options.backfillRelatedEntities,
        poolConfig,
      });

      // 5. Webhook routes already mounted (must be done before calling start())
      console.log(`Stripe Sync webhook mounted at ${this.options.webhookPath}`);

      return {
        tunnelUrl: publicUrl,
        webhookUrl,
        status: 'ready',
      };
    } catch (error) {
      console.error('Failed to start Stripe Sync:', error);
      // Clean up on error
      await this.stop();
      
      return {
        tunnelUrl: this.options.publicUrl,
        webhookUrl: `${this.options.publicUrl}${this.options.webhookPath}`,
        status: 'degraded',
        reason: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Mounts the Stripe webhook handler on the provided Express app.
   * Applies raw body parser middleware for signature verification.
   * IMPORTANT: Must be called BEFORE app.use(express.json()) to ensure raw body parsing.
   */
  mountWebhook(app: Express): void {
    // Apply raw body parser ONLY to this webhook route
    app.use(this.options.webhookPath, express.raw({ type: 'application/json' }));
    
    // Mount the webhook handler
    app.post(
      this.options.webhookPath,
      async (req, res) => {
        const sig = req.headers['stripe-signature'];
        if (!sig || typeof sig !== 'string') {
          console.error('[Webhook] Missing stripe-signature header');
          return res.status(400).send({ error: 'Missing stripe-signature header' });
        }

        // express.raw puts the raw body in req.body as a Buffer
        const rawBody = req.body;
        if (!rawBody || !Buffer.isBuffer(rawBody)) {
          console.error('[Webhook] Body is not a Buffer!', {
            hasBody: !!rawBody,
            bodyType: typeof rawBody,
            isBuffer: Buffer.isBuffer(rawBody),
            bodyConstructor: rawBody?.constructor?.name
          });
          return res.status(400).send({ error: 'Missing raw body for signature verification' });
        }

        try {
          // Process webhook with Stripe Sync Engine
          // All subscription data is automatically synced to the stripe schema
          await this.stripeSync!.processWebhook(rawBody, sig);
          
          return res.status(200).send({ received: true });
        } catch (error: any) {
          console.error('[Webhook] Processing error:', error.message);
          return res.status(400).send({ error: error.message });
        }
      }
    );
  }

  /**
   * Stops all services and cleans up resources:
   * 1. Deletes Stripe webhook endpoint
   */
  async stop(): Promise<void> {
    // Delete webhook endpoint to prevent accumulation
    if (this.webhookId) {
      try {
        await deleteWebhook(this.options.stripeApiKey, this.webhookId);
      } catch (error: any) {
        console.log(`⚠ Could not delete webhook: ${error.message || error}`);
      }
    }

    console.log('✓ Cleanup complete');
  }
}
