import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
});

async function cleanupWebhooks() {
  console.log('🧹 Cleaning up Stripe webhook endpoints...\n');

  try {
    const webhooks = await stripe.webhookEndpoints.list({ limit: 100 });
    
    if (webhooks.data.length === 0) {
      console.log('✅ No webhooks found. All clean!');
      return;
    }

    console.log(`📊 Found ${webhooks.data.length} webhook endpoints:\n`);
    
    // Sort by creation date (oldest first)
    const sortedWebhooks = webhooks.data.sort((a, b) => a.created - b.created);
    
    // Display all webhooks
    sortedWebhooks.forEach((webhook, index) => {
      const date = new Date(webhook.created * 1000).toLocaleString();
      const status = webhook.status;
      const url = webhook.url;
      console.log(`${index + 1}. [${status}] ${url}`);
      console.log(`   Created: ${date} | ID: ${webhook.id}`);
    });

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🗑️  Deleting ${sortedWebhooks.length} webhook(s)...`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    // Delete all webhooks
    let deleted = 0;
    for (const webhook of sortedWebhooks) {
      try {
        await stripe.webhookEndpoints.del(webhook.id);
        console.log(`✅ Deleted: ${webhook.url}`);
        deleted++;
      } catch (error: any) {
        console.error(`❌ Failed to delete ${webhook.id}: ${error.message}`);
      }
    }

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✅ Cleanup complete! Deleted ${deleted}/${sortedWebhooks.length} webhooks`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    console.log('💡 You can now restart your application.');

  } catch (error: any) {
    console.error('❌ Error cleaning up webhooks:', error.message);
    if (error.type === 'StripeAuthenticationError') {
      console.error('\n⚠️  Make sure STRIPE_SECRET_KEY is set in your environment');
    }
    process.exit(1);
  }
}

cleanupWebhooks();
