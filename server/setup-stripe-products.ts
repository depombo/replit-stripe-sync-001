import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
});

async function setupStripeProducts() {
  console.log('🚀 Setting up Stripe products and prices...\n');

  try {
    // 1. Create Credit Pack Product
    console.log('📦 Creating Credit Pack product...');
    const creditPackProduct = await stripe.products.create({
      name: '10 Generation Credits',
      description: '10 color palette generations - use at your own pace',
      metadata: {
        type: 'credits',
        generations: '10',
      },
    });
    console.log(`✅ Product created: ${creditPackProduct.id}`);

    const creditPackPrice = await stripe.prices.create({
      product: creditPackProduct.id,
      unit_amount: 499, // $4.99
      currency: 'usd',
      metadata: {
        generations: '10',
      },
    });
    console.log(`✅ Price created: ${creditPackPrice.id}\n`);

    // 2. Create Pro Subscription Product
    console.log('⭐ Creating Pro subscription product...');
    const proProduct = await stripe.products.create({
      name: 'Pro Plan',
      description: '100 color palette generations per month',
      metadata: {
        type: 'subscription',
        tier: 'pro',
        generations: '100',
      },
    });
    console.log(`✅ Product created: ${proProduct.id}`);

    const proPrice = await stripe.prices.create({
      product: proProduct.id,
      unit_amount: 999, // $9.99
      currency: 'usd',
      recurring: {
        interval: 'month',
      },
      metadata: {
        generations: '100',
      },
    });
    console.log(`✅ Price created: ${proPrice.id}\n`);

    // 3. Create Unlimited Subscription Product
    console.log('🚀 Creating Unlimited subscription product...');
    const unlimitedProduct = await stripe.products.create({
      name: 'Unlimited Plan',
      description: 'Unlimited color palette generations',
      metadata: {
        type: 'subscription',
        tier: 'unlimited',
        generations: 'unlimited',
      },
    });
    console.log(`✅ Product created: ${unlimitedProduct.id}`);

    const unlimitedPrice = await stripe.prices.create({
      product: unlimitedProduct.id,
      unit_amount: 1999, // $19.99
      currency: 'usd',
      recurring: {
        interval: 'month',
      },
      metadata: {
        generations: 'unlimited',
      },
    });
    console.log(`✅ Price created: ${unlimitedPrice.id}\n`);

    // Output the environment variables
    console.log('━'.repeat(60));
    console.log('✅ All products and prices created successfully!\n');
    console.log('📋 Add these to your Replit Secrets:\n');
    console.log('━'.repeat(60));
    console.log(`STRIPE_PRICE_10_PACK=${creditPackPrice.id}`);
    console.log(`STRIPE_PRICE_PRO=${proPrice.id}`);
    console.log(`STRIPE_PRICE_UNLIMITED=${unlimitedPrice.id}`);
    console.log('');
    console.log('Frontend environment variables (same values):');
    console.log(`VITE_STRIPE_PRICE_10_PACK=${creditPackPrice.id}`);
    console.log(`VITE_STRIPE_PRICE_PRO=${proPrice.id}`);
    console.log(`VITE_STRIPE_PRICE_UNLIMITED=${unlimitedPrice.id}`);
    console.log('━'.repeat(60));
    console.log('\n💡 Copy these values to Replit Secrets, then restart the app.\n');

  } catch (error: any) {
    console.error('❌ Error setting up Stripe products:', error.message);
    if (error.type === 'StripeAuthenticationError') {
      console.error('\n⚠️  Make sure STRIPE_SECRET_KEY is set in your environment');
    }
    process.exit(1);
  }
}

setupStripeProducts();
