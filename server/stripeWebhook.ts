import Stripe from 'stripe';

export interface WebhookInfo {
  id: string;
  secret: string;
}

export async function createWebhook(
  stripeApiKey: string,
  url: string
): Promise<WebhookInfo> {
  const stripe = new Stripe(stripeApiKey, {
    apiVersion: '2025-10-29.clover',
  });

  console.log(`Creating Stripe webhook endpoint: ${url}...`);

  const webhook = await stripe.webhookEndpoints.create({
    url,
    enabled_events: ['*'], // Listen to all events
  });

  console.log(`✓ Stripe webhook created: ${webhook.id}`);

  return {
    id: webhook.id,
    secret: webhook.secret!,
  };
}

export async function deleteWebhook(
  stripeApiKey: string,
  webhookId: string
): Promise<void> {
  const stripe = new Stripe(stripeApiKey, {
    apiVersion: '2025-10-29.clover',
  });

  console.log(`Deleting Stripe webhook: ${webhookId}...`);
  
  try {
    await stripe.webhookEndpoints.del(webhookId);
    console.log(`✓ Stripe webhook deleted`);
  } catch (error) {
    console.log(`⚠ Could not delete webhook: ${error}`);
  }
}
