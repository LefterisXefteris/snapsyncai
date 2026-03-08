import { getStripeSync, getUncachableStripeClient } from './stripeClient';
import { storage } from './storage';

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'This usually means express.json() parsed the body before reaching this handler. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);

    try {
      const event = JSON.parse(payload.toString());
      await WebhookHandlers.handleSubscriptionEvents(event);
    } catch (e) {
      console.error("Error handling subscription webhook event:", e);
    }
  }

  static async handleSubscriptionEvents(event: any): Promise<void> {
    const type = event.type;
    const data = event.data?.object;

    if (!data) return;

    if (type === 'checkout.session.completed' && data.mode === 'subscription') {
      const userId = data.metadata?.userId;
      const subscriptionId = typeof data.subscription === 'string' ? data.subscription : data.subscription?.id;
      const customerId = typeof data.customer === 'string' ? data.customer : data.customer?.id;

      if (userId && subscriptionId && customerId) {
        try {
          const stripe = await getUncachableStripeClient();
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          let periodEnd: Date | null = null;
          if (sub.current_period_end) {
            periodEnd = new Date(sub.current_period_end * 1000);
          }
          await storage.upsertSubscription({
            userId,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            status: sub.status,
            currentPeriodEnd: periodEnd,
          });
          console.log(`Webhook: Subscription ${subscriptionId} saved for user ${userId} with status ${sub.status}`);
        } catch (e) {
          console.error("Webhook: Error saving subscription from checkout:", e);
        }
      }
    }

    if (type === 'customer.subscription.updated' || type === 'customer.subscription.deleted') {
      const subscriptionId = data.id;
      const status = data.status;
      let periodEnd: Date | undefined;
      if (data.current_period_end) {
        try {
          periodEnd = new Date(data.current_period_end * 1000);
        } catch (e) {}
      }
      try {
        await storage.updateSubscriptionStatus(subscriptionId, status, periodEnd);
        console.log(`Webhook: Subscription ${subscriptionId} updated to ${status}`);
      } catch (e) {
        console.error("Webhook: Error updating subscription status:", e);
      }
    }
  }
}
