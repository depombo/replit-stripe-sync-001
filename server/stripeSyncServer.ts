import { StripeSync } from '@supabase/stripe-sync-engine';
import { runStripeMigrations } from './stripeMigrations';
import express, { Express } from 'express';
import { type Server } from 'http';
import { type PoolConfig } from 'pg';
import { createTunnel, NgrokTunnel } from './ngrok';
import { createWebhook, deleteWebhook, listWebhooks, getWebhook } from './stripeWebhook';
import { pool } from './db';
import { webhookState } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-serverless';

const db = drizzle(pool);

export interface StripeSyncServerOptions {
  databaseUrl: string;
  stripeApiKey: string;
  ngrokAuthToken?: string;
  publicUrl?: string; // Use this instead of ngrok if provided
  port?: number;
  webhookPath?: string;
  schema?: string;
  stripeApiVersion?: string;
  autoExpandLists?: boolean;
  backfillRelatedEntities?: boolean;
}

export interface StripeSyncServerInfo {
  tunnelUrl: string;
  webhookUrl: string;
  port: number;
  status: 'ready' | 'degraded';
  reason?: string;
}

interface WebhookConfig {
  id: string;
  secret: string;
  url: string;
  source: 'cache' | 'stripe' | 'created';
}

/**
 * Encapsulates the entire Stripe Sync orchestration:
 * - Creates or reuses ngrok tunnel
 * - Sets up or reuses Stripe webhook
 * - Runs database migrations
 * - Starts Express server with webhook handler
 */
export class StripeSyncServer {
  private options: StripeSyncServerOptions & {
    port: number;
    webhookPath: string;
    schema: string;
    stripeApiVersion: string;
    autoExpandLists: boolean;
    backfillRelatedEntities: boolean;
  };
  private tunnel: NgrokTunnel | null = null;
  private app: Express | null = null;
  private server: Server | null = null;
  private webhookId: string | null = null;
  private stripeSync: StripeSync | null = null;

  constructor(options: StripeSyncServerOptions) {
    this.options = {
      port: 3001,
      webhookPath: '/webhooks',
      schema: 'stripe',
      stripeApiVersion: '2020-08-27',
      autoExpandLists: false,
      backfillRelatedEntities: true,
      ...options,
    };
  }

  /**
   * Starts the complete Stripe Sync infrastructure with webhook reuse:
   * 1. Gets public URL (from Replit or creates ngrok tunnel)
   * 2. Checks for existing webhook in database cache
   * 3. Validates cached webhook still exists in Stripe
   * 4. Falls back to listing Stripe webhooks and reusing matching URL
   * 5. Creates new webhook only if none found
   * 6. Runs database migrations
   * 7. Starts Express server
   *
   * @returns Information about the running instance with status
   */
  async start(): Promise<StripeSyncServerInfo> {
    const environment = process.env.NODE_ENV || 'development';
    
    try {
      // 1. Determine public URL
      let publicUrl: string;
      let tunnelUrl: string;
      
      if (this.options.publicUrl) {
        publicUrl = this.options.publicUrl;
        tunnelUrl = publicUrl;
        console.log(`Using public URL: ${publicUrl}`);
      } else if (this.options.ngrokAuthToken) {
        this.tunnel = await createTunnel(this.options.port, this.options.ngrokAuthToken);
        publicUrl = this.tunnel.url;
        tunnelUrl = this.tunnel.url;
        console.log(`Created ngrok tunnel: ${tunnelUrl}`);
      } else {
        throw new Error('Either publicUrl or ngrokAuthToken must be provided');
      }
      
      const webhookUrl = `${publicUrl}:${this.options.port}${this.options.webhookPath}`;

      // 2. Get or create webhook (with reuse logic)
      let webhook: WebhookConfig;
      try {
        webhook = await this.getOrCreateWebhook(webhookUrl, publicUrl, environment);
      } catch (error: any) {
        // Handle webhook creation failures gracefully
        if (error.message?.includes('maximum') || error.code === 'resource_exhausted') {
          console.warn('⚠ Stripe webhook limit reached. App will run in degraded mode.');
          console.warn('⚠ Please delete unused webhooks from: https://dashboard.stripe.com/webhooks');
          return {
            tunnelUrl,
            webhookUrl,
            port: this.options.port,
            status: 'degraded',
            reason: 'Webhook limit reached. Please clean up old webhooks in Stripe Dashboard.'
          };
        }
        throw error; // Re-throw other errors
      }
      
      this.webhookId = webhook.id;
      const webhookSecret = webhook.secret;

      // 3. Run migrations (custom implementation with Neon compatibility)
      try {
        console.log('Running Stripe Sync database migrations...');
        await runStripeMigrations(this.options.schema);
        console.log('✓ Database migrations complete');
      } catch (error: any) {
        console.error('⚠ Migration error:', error.message);
        return {
          tunnelUrl,
          webhookUrl,
          port: this.options.port,
          status: 'degraded',
          reason: `Migration failed: ${error.message}`
        };
      }

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

      // 5. Start Express server
      console.log(`Starting Stripe Sync server on port ${this.options.port}...`);
      this.app = this.createExpressServer();
      this.server = this.app.listen(this.options.port, '0.0.0.0', () => {
        console.log(`✓ Stripe Sync server started on port ${this.options.port}`);
      });

      return {
        tunnelUrl,
        webhookUrl,
        port: this.options.port,
        status: 'ready',
      };
    } catch (error) {
      console.error('Failed to start Stripe Sync:', error);
      // Clean up on error
      await this.stop();
      
      return {
        tunnelUrl: '',
        webhookUrl: '',
        port: this.options.port,
        status: 'degraded',
        reason: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Gets or creates a webhook endpoint with intelligent reuse logic:
   * 1. Check database cache for existing webhook
   * 2. Verify cached webhook still exists in Stripe
   * 3. List Stripe webhooks and find matching URL
   * 4. Create new webhook only as last resort
   */
  private async getOrCreateWebhook(
    webhookUrl: string,
    publicUrl: string,
    environment: string
  ): Promise<WebhookConfig> {
    // 1. Check database cache
    const cached = await db
      .select()
      .from(webhookState)
      .where(eq(webhookState.publicUrl, publicUrl))
      .limit(1);

    if (cached.length > 0) {
      const cachedWebhook = cached[0];
      console.log(`Found cached webhook: ${cachedWebhook.webhookEndpointId}`);
      
      // Verify it still exists in Stripe
      try {
        const stripeWebhook = await getWebhook(this.options.stripeApiKey, cachedWebhook.webhookEndpointId);
        if (stripeWebhook && stripeWebhook.url === webhookUrl) {
          console.log('✓ Reusing cached webhook endpoint');
          
          // Update last verified timestamp
          await db
            .update(webhookState)
            .set({ lastVerified: new Date(), updatedAt: new Date() })
            .where(eq(webhookState.id, cachedWebhook.id));
          
          return {
            id: cachedWebhook.webhookEndpointId,
            secret: cachedWebhook.webhookSecret,
            url: cachedWebhook.webhookUrl,
            source: 'cache',
          };
        }
      } catch (error) {
        console.log('⚠ Cached webhook no longer exists in Stripe, will create new one');
        // Delete stale cache entry
        await db.delete(webhookState).where(eq(webhookState.id, cachedWebhook.id));
      }
    }

    // 2. List existing webhooks and find matching URL
    try {
      const existingWebhooks = await listWebhooks(this.options.stripeApiKey);
      const matchingWebhook = existingWebhooks.find((wh: WebhookConfig) => wh.url === webhookUrl);
      
      if (matchingWebhook) {
        console.log(`✓ Found existing Stripe webhook: ${matchingWebhook.id}`);
        
        // Cache it for future use
        await db.insert(webhookState).values({
          environment,
          publicUrl,
          webhookEndpointId: matchingWebhook.id,
          webhookSecret: matchingWebhook.secret,
          webhookUrl: matchingWebhook.url,
          lastVerified: new Date(),
        }).onConflictDoUpdate({
          target: webhookState.publicUrl,
          set: {
            webhookEndpointId: matchingWebhook.id,
            webhookSecret: matchingWebhook.secret,
            webhookUrl: matchingWebhook.url,
            lastVerified: new Date(),
            updatedAt: new Date(),
          },
        });
        
        return {
          id: matchingWebhook.id,
          secret: matchingWebhook.secret,
          url: matchingWebhook.url,
          source: 'stripe',
        };
      }
    } catch (error) {
      console.log('⚠ Could not list existing webhooks:', error);
    }

    // 3. Create new webhook as last resort
    console.log(`Creating Stripe webhook endpoint: ${webhookUrl}...`);
    const webhook = await createWebhook(this.options.stripeApiKey, webhookUrl);
    console.log(`✓ Stripe webhook created: ${webhook.id}`);
    
    // Cache the new webhook
    await db.insert(webhookState).values({
      environment,
      publicUrl,
      webhookEndpointId: webhook.id,
      webhookSecret: webhook.secret,
      webhookUrl,
      lastVerified: new Date(),
    }).onConflictDoUpdate({
      target: webhookState.publicUrl,
      set: {
        webhookEndpointId: webhook.id,
        webhookSecret: webhook.secret,
        webhookUrl,
        lastVerified: new Date(),
        updatedAt: new Date(),
      },
    });
    
    return {
      id: webhook.id,
      secret: webhook.secret,
      url: webhookUrl,
      source: 'created',
    };
  }

  /**
   * Stops all services and cleans up resources:
   * 1. Closes ngrok tunnel
   * 2. Closes Express server
   * (NOTE: We do NOT delete the webhook so it can be reused)
   */
  async stop(): Promise<void> {
    // Close tunnel
    if (this.tunnel) {
      try {
        await this.tunnel.close();
      } catch (error) {
        console.log('⚠ Could not close tunnel');
      }
    }

    // Close server
    if (this.server) {
      try {
        await new Promise<void>((resolve, reject) => {
          this.server!.close((err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        console.log('✓ Stripe Sync server stopped');
      } catch (error) {
        console.log('⚠ Server already stopped');
      }
    }

    console.log('✓ Cleanup complete (webhook endpoint preserved for reuse)');
  }

  /**
   * Creates and configures the Express server with webhook handling.
   */
  private createExpressServer(): Express {
    const app = express();

    // Webhook route - needs raw body for signature verification
    app.post(
      this.options.webhookPath,
      express.raw({ type: 'application/json' }),
      async (req, res) => {
        const sig = req.headers['stripe-signature'];
        if (!sig || typeof sig !== 'string') {
          return res.status(400).send({ error: 'Missing stripe-signature header' });
        }

        try {
          await this.stripeSync!.processWebhook(req.body, sig);
          return res.status(200).send({ received: true });
        } catch (error: any) {
          console.error('Webhook processing error:', error);
          return res.status(400).send({ error: error.message });
        }
      }
    );

    // Health check
    app.get('/health', async (req, res) => {
      return res.status(200).send({ status: 'ok' });
    });

    return app;
  }
}
