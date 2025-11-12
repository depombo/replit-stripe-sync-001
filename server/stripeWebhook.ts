import Stripe from 'stripe';

export interface WebhookInfo {
  id: string;
  secret: string;
  url: string;
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
    url: webhook.url,
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

export async function listWebhooks(
  stripeApiKey: string
): Promise<WebhookInfo[]> {
  const stripe = new Stripe(stripeApiKey, {
    apiVersion: '2025-10-29.clover',
  });

  const webhooks = await stripe.webhookEndpoints.list();
  
  return webhooks.data.map(wh => ({
    id: wh.id,
    secret: wh.secret!,
    url: wh.url,
  }));
}

export async function getWebhook(
  stripeApiKey: string,
  webhookId: string
): Promise<WebhookInfo | null> {
  const stripe = new Stripe(stripeApiKey, {
    apiVersion: '2025-10-29.clover',
  });

  try {
    const webhook = await stripe.webhookEndpoints.retrieve(webhookId);
    return {
      id: webhook.id,
      secret: webhook.secret!,
      url: webhook.url,
    };
  } catch (error) {
    return null;
  }
}
