/**
 * Subscription Router
 *
 * API endpoints for subscription management and Stripe webhooks.
 *
 * Requirements: 1.4, 2.1, 2.2, 2.3, 2.4, 2.5, 2.8, 2.9, 2.10
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { getSupabaseClient } from '../utils/supabase.js';
import { getSubscriptionService, SubscriptionError } from '../services/subscriptionService.js';
import { verifyStripeSignature, getStripeEvent } from '../middleware/stripeWebhook.js';
import { getLogger } from '../utils/logger.js';
import type { AuthContext } from '../middleware/auth.js';

const logger = getLogger('subscriptionRouter');

// Request schemas
const checkoutSchema = z.object({
  planType: z.enum(['premium_basic', 'premium_pro']),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

const portalSchema = z.object({
  returnUrl: z.string().url(),
});

// Create router
const subscriptionRouter = new Hono<{ Variables: AuthContext }>();

/**
 * POST /api/subscription/checkout
 * Create a Stripe Checkout session.
 *
 * Requirements: 1.4, 2.1
 */
subscriptionRouter.post(
  '/checkout',
  zValidator('json', checkoutSchema),
  async (c: Context<{ Variables: AuthContext }>) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { planType, successUrl, cancelUrl } = c.req.valid('json' as never);

    try {
      const supabase = getSupabaseClient();
      const service = getSubscriptionService(supabase);

      const result = await service.createCheckoutSession(
        user['id'] as string,
        (user.email ?? '') as string,
        planType,
        successUrl,
        cancelUrl
      );

      return c.json(result);
    } catch (err) {
      if (err instanceof SubscriptionError) {
        return c.json({ error: err.code, message: err.message }, 400);
      }
      logger.error('Checkout error', err instanceof Error ? err : undefined);
      return c.json({ error: 'CHECKOUT_FAILED' }, 500);
    }
  }
);

/**
 * GET /api/subscription/status
 * Get current subscription status.
 */
subscriptionRouter.get('/status', async (c: Context<{ Variables: AuthContext }>) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const supabase = getSupabaseClient();
    const service = getSubscriptionService(supabase);

    const subscription = await service.getSubscriptionStatus(user['id'] as string);
    const tokenUsage = await service.getTokenUsageInfo(user['id'] as string);

    return c.json({
      subscription,
      tokenUsage,
    });
  } catch (err) {
    logger.error('Status error', err instanceof Error ? err : undefined);
    return c.json({ error: 'INTERNAL_ERROR' }, 500);
  }
});

/**
 * POST /api/subscription/portal
 * Create a Stripe Customer Portal session.
 *
 * Requirements: 2.8
 */
subscriptionRouter.post(
  '/portal',
  zValidator('json', portalSchema),
  async (c: Context<{ Variables: AuthContext }>) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { returnUrl } = c.req.valid('json' as never);

    try {
      const supabase = getSupabaseClient();
      const service = getSubscriptionService(supabase);

      const portalUrl = await service.createCustomerPortalSession(user['id'] as string, returnUrl);

      return c.json({ portalUrl });
    } catch (err) {
      if (err instanceof SubscriptionError) {
        return c.json({ error: err.code, message: err.message }, 400);
      }
      logger.error('Portal error', err instanceof Error ? err : undefined);
      return c.json({ error: 'PORTAL_FAILED' }, 500);
    }
  }
);

/**
 * POST /api/subscription/cancel
 * Cancel the current subscription.
 *
 * Requirements: 2.9
 */
subscriptionRouter.post('/cancel', async (c: Context<{ Variables: AuthContext }>) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const supabase = getSupabaseClient();
    const service = getSubscriptionService(supabase);

    const result = await service.cancelSubscription(user['id'] as string);

    return c.json({
      success: true,
      cancelAt: result.cancelAt,
      message: 'サブスクリプションは請求期間終了時にキャンセルされます',
    });
  } catch (err) {
    if (err instanceof SubscriptionError) {
      return c.json({ error: err.code, message: err.message }, 400);
    }
    logger.error('Cancel error', err instanceof Error ? err : undefined);
    return c.json({ error: 'CANCEL_FAILED' }, 500);
  }
});

/**
 * POST /api/webhooks/stripe
 * Handle Stripe webhook events.
 *
 * Requirements: 2.2, 2.3, 2.4, 2.5
 */
subscriptionRouter.post('/webhooks/stripe', verifyStripeSignature, async (c: Context) => {
  const event = getStripeEvent(c);
  if (!event) {
    return c.json({ error: 'No event' }, 400);
  }

  try {
    const supabase = getSupabaseClient();
    const service = getSubscriptionService(supabase);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        await service.handleCheckoutCompleted(session);
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object;
        await service.handleInvoicePaid(invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        await service.handlePaymentFailed(invoice);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        await service.handleSubscriptionDeleted(subscription);
        break;
      }

      default:
        logger.info('Unhandled webhook event', { type: event.type });
    }

    return c.json({ received: true });
  } catch (err) {
    logger.error('Webhook processing error', err instanceof Error ? err : undefined, { eventType: event.type });
    return c.json({ error: 'WEBHOOK_PROCESSING_FAILED' }, 500);
  }
});

export { subscriptionRouter };
