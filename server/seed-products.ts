import { getUncachableStripeClient } from './stripeClient';

async function createProducts() {
  const stripe = await getUncachableStripeClient();

  const existing = await stripe.products.search({ query: "name:'AI Image Analysis'" });
  if (existing.data.length > 0) {
    console.log('Product already exists:', existing.data[0].id);
    const prices = await stripe.prices.list({ product: existing.data[0].id, active: true });
    if (prices.data.length > 0) {
      console.log('Price already exists:', prices.data[0].id, '- $' + (prices.data[0].unit_amount! / 100).toFixed(2));
    }
    return;
  }

  const product = await stripe.products.create({
    name: 'AI Image Analysis',
    description: 'AI-powered product image analysis for Shopify listings. Generates titles, descriptions, prices, SEO metadata, variants, and more.',
    metadata: {
      type: 'per_image_analysis',
      cost_per_100: '12.00',
    },
  });

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: 12,
    currency: 'usd',
    metadata: {
      description: '$0.12 per image analysis',
    },
  });

  console.log('Created product:', product.id);
  console.log('Created price:', price.id, '- $0.12 per image');
}

createProducts().catch(console.error);
