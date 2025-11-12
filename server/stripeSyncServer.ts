import { runMigrations, StripeSync } from '@supabase/stripe-sync-engine';
import express, { Express } from 'express';
import { type Server } from 'http';
import { type PoolConfig } from 'pg';
import { createTunnel, NgrokTunnel } from './ngrok';
import { createWebhook, deleteWebhook } from './stripeWebhook';

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
}

/**
 * Encapsulates the entire Stripe Sync orchestration:
 * - Creates ngrok tunnel
 * - Sets up Stripe webhook
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
   * Starts the complete Stripe Sync infrastructure:
   * 1. Gets public URL (from Replit or creates ngrok tunnel)
   * 2. Creates Stripe webhook endpoint
   * 3. Runs database migrations
   * 4. Starts Express server
   *
   * @returns Information about the running instance
   */
  async start(): Promise<StripeSyncServerInfo> {
    try {
      // 1. Determine public URL
      let publicUrl: string;
      let tunnelUrl: string;
      
      if (this.options.publicUrl) {
        // Use provided public URL (e.g., from Replit)
        publicUrl = this.options.publicUrl;
        tunnelUrl = publicUrl;
        console.log(`Using public URL: ${publicUrl}`);
      } else if (this.options.ngrokAuthToken) {
        // Create ngrok tunnel for local development
        this.tunnel = await createTunnel(this.options.port, this.options.ngrokAuthToken);
        publicUrl = this.tunnel.url;
        tunnelUrl = this.tunnel.url;
        console.log(`Created ngrok tunnel: ${tunnelUrl}`);
      } else {
        throw new Error('Either publicUrl or ngrokAuthToken must be provided');
      }
      
      const webhookUrl = `${publicUrl}:${this.options.port}${this.options.webhookPath}`;

      // 2. Create webhook and get the signing secret
      const webhook = await createWebhook(this.options.stripeApiKey, webhookUrl);
      this.webhookId = webhook.id;
      const webhookSecret = webhook.secret;

      // 3. Run migrations
      console.log('Running Stripe Sync database migrations...');
      await runMigrations({
        databaseUrl: this.options.databaseUrl,
        schema: this.options.schema,
      });
      console.log('✓ Database migrations complete');

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
      };
    } catch (error) {
      console.log('Failed to start Stripe Sync:');
      if (error instanceof Error) {
        console.error(error.message);
      }
      // Clean up on error
      await this.stop();
      throw error;
    }
  }

  /**
   * Stops all services and cleans up resources:
   * 1. Deletes Stripe webhook endpoint
   * 2. Closes ngrok tunnel
   * 3. Closes Express server
   */
  async stop(): Promise<void> {
    // Delete webhook endpoint
    if (this.webhookId) {
      try {
        await deleteWebhook(this.options.stripeApiKey, this.webhookId);
      } catch (error) {
        console.log('⚠ Could not delete webhook');
      }
    }

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

    console.log('✓ Cleanup complete');
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
