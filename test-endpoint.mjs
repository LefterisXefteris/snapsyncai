import { config } from 'dotenv';
config({ path: '.env.vercel.prod' });

import Stripe from 'stripe';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

async function test() {
    try {
        const SUBSCRIPTION_PRICE_PENCE = 3000;

        // 1. DB Query
        console.log('Querying DB...');
        const result = await pool.query(
            `SELECT pr.id as price_id, pr.unit_amount FROM stripe.products p JOIN stripe.prices pr ON pr.product = p.id WHERE p.active = true AND p.metadata->>'type' = 'monthly_subscription' AND pr.active = true AND pr.type = 'recurring' AND pr.recurring->>'interval' = 'month' ORDER BY pr.created DESC LIMIT 1`
        );

        let priceId;

        if (result.rows.length > 0 && Number(result.rows[0].unit_amount) === SUBSCRIPTION_PRICE_PENCE) {
            priceId = result.rows[0].price_id;
            console.log('Found price in DB:', priceId);
        } else {
            console.log('Price not found in DB or wrong amount. Finding product...');
            const productResult = await pool.query(
                `SELECT p.id as product_id FROM stripe.products p WHERE p.active = true AND p.metadata->>'type' = 'monthly_subscription' LIMIT 1`
            );

            let productId;
            if (productResult.rows.length > 0) {
                productId = productResult.rows[0].product_id;
                console.log('Found product in DB:', productId);
            } else {
                console.log('Product not found in DB. Creating in Stripe...');
                const product = await stripe.products.create({
                    name: 'ListAI Pro',
                    description: 'Unlimited AI-powered product listing generation',
                    metadata: { type: 'monthly_subscription' },
                });
                productId = product.id;
            }

            console.log('Creating price in Stripe...');
            const price = await stripe.prices.create({
                product: productId,
                unit_amount: SUBSCRIPTION_PRICE_PENCE,
                currency: 'gbp',
                recurring: { interval: 'month' },
            });
            priceId = price.id;
        }

        console.log('Using Price ID:', priceId);

        console.log('Creating session...');
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{ price: priceId, quantity: 1 }],
            mode: 'subscription',
            success_url: `https://test.com/success`,
            cancel_url: `https://test.com/cancel`,
            metadata: { userId: 'user_123' },
        });

        console.log('Session successful:', session.url);
    } catch (err) {
        console.error('Test script error:', err);
    } finally {
        pool.end();
    }
}

test();
