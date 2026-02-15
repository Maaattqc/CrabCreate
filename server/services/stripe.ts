import Stripe from 'stripe';
import config from '../config';
import * as repo from '../db/repositories';
import { decryptSecret } from './secrets';
import logger from './logger';

const stripe = new Stripe(config.stripeSecretKey);

export async function createCheckoutSession(
  userId: number,
  email: string,
  successUrl: string,
  cancelUrl: string,
): Promise<string> {
  const user = repo.findUserById(userId);
  if (!user) throw new Error('User not found');

  let customerId = user.stripe_customer_id ? decryptSecret(user.stripe_customer_id) : null;

  if (!customerId) {
    const customer = await stripe.customers.create({ email, metadata: { userId: String(userId) } });
    customerId = customer.id;
    repo.updateUserStripeCustomerId(userId, customerId);
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: {
          name: 'CrabCreate Pro',
          description: 'Plan Pro — tickets & pipelines illimités',
        },
        unit_amount: 4900,
        recurring: { interval: 'month' },
      },
      quantity: 1,
    }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { userId: String(userId) },
  });

  return session.url!;
}

export async function createPortalSession(userId: number): Promise<string> {
  const user = repo.findUserById(userId);
  if (!user) throw new Error('User not found');
  const customerId = user.stripe_customer_id ? decryptSecret(user.stripe_customer_id) : null;
  if (!customerId) throw new Error('No Stripe customer');

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: config.clientUrl + '/dashboard',
  });

  return session.url;
}

export function constructWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
  return stripe.webhooks.constructEvent(rawBody, signature, config.stripeWebhookSecret);
}

export async function handleWebhookEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== 'subscription') break;

      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string;
      const user = repo.findUserByStripeCustomerId(customerId);
      if (!user) {
        logger.error(`[Stripe] checkout.session.completed: no user for customer ${customerId.slice(0, 8)}...`);
        break;
      }

      repo.updateUserPlan(user.id, 'pro');
      repo.updateUserStripeSubscription(user.id, subscriptionId, 'active');
      repo.insertAuditLog(user.id, user.email, 'stripe_checkout_completed', 'user', user.id, `subscription: ${subscriptionId.slice(0, 12)}...`);
      logger.info(`[Stripe] User ${user.email} upgraded to pro`);
      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      const user = repo.findUserByStripeCustomerId(customerId);
      if (!user) {
        logger.error(`[Stripe] subscription.updated: no user for customer ${customerId.slice(0, 8)}...`);
        break;
      }

      const status = subscription.status;
      repo.updateUserStripeSubscription(user.id, subscription.id, status);

      if (status === 'canceled' || status === 'unpaid') {
        repo.updateUserPlan(user.id, 'free');
        repo.insertAuditLog(user.id, user.email, 'stripe_subscription_canceled', 'user', user.id, `status: ${status}`);
        logger.info(`[Stripe] User ${user.email} downgraded to free`);
      } else {
        repo.insertAuditLog(user.id, user.email, 'stripe_subscription_updated', 'user', user.id, `status: ${status}`);
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      const user = repo.findUserByStripeCustomerId(customerId);
      if (!user) {
        logger.error(`[Stripe] subscription.deleted: no user for customer ${customerId.slice(0, 8)}...`);
        break;
      }

      repo.updateUserPlan(user.id, 'free');
      repo.updateUserStripeSubscription(user.id, null, null);
      repo.insertAuditLog(user.id, user.email, 'stripe_subscription_deleted', 'user', user.id);
      logger.info(`[Stripe] User ${user.email} downgraded to free (subscription deleted)`);
      break;
    }
  }
}
