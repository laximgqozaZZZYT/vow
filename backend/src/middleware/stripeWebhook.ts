/**
 * Stripe Webhook Middleware
 *
 * Verifies Stripe webhook signatures and handles webhook events.
 *
 * Requirements: 2.7, 10.2
 */

import type { Context, Next } from 'hono';
import Stripe from 'stripe';
import { getSettings } from '../config.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('stripeWebhook');

/**
 * Stripe webhook signature verification middleware.
 *
 * Property 3: Stripe Signature Verification
 * For any incoming webhook request, the middleware SHALL accept requests
 * with valid signatures and reject requests with invalid signatures or
 * timestamps older than 5 minutes.
 *
 * Requirements: 2.7
 */
export async function verifyStripeSignature(c: Context, next: Next): Promise<Response | void> {
  const settings = getSettings();
  const webhookSecret = settings.stripeWebhookSecret;

  if (!webhookSecret) {
    logger.error('STRIPE_WEBHOOK_SECRET not configured');
    return c.json({ error: 'Webhook not configured' }, 500);
  }

  const signature = c.req.header('stripe-signature');
  if (!signature) {
    logger.warning('Missing Stripe signature header');
    return c.json({ error: 'Missing signature' }, 400);
  }

  try {
    // Get raw body for signature verification
    const rawBody = await c.req.text();

    // Verify signature using Stripe SDK
    const stripe = new Stripe(settings.stripeSecretKey ?? '', {
      apiVersion: '2025-02-24.acacia',
    });

    const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

    // Attach verified event to context
    c.set('stripeEvent', event);

    logger.info('Stripe signature verified', { eventType: event.type, eventId: event.id });

    await next();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.warning('Stripe signature verification failed', { error: message });
    return c.json({ error: 'Invalid signature' }, 400);
  }
}

/**
 * Get the verified Stripe event from context.
 */
export function getStripeEvent(c: Context): Stripe.Event | undefined {
  return c.get('stripeEvent') as Stripe.Event | undefined;
}
