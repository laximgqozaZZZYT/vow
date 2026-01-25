/**
 * Subscription Service
 *
 * Manages Stripe subscriptions, checkout sessions, and subscription lifecycle.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.8, 2.9, 2.10
 */

import Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SubscriptionRepository } from '../repositories/subscriptionRepository.js';
import { TokenQuotaRepository } from '../repositories/tokenRepository.js';
import { getLogger } from '../utils/logger.js';
import { getAdminService } from './adminService.js';
import type {
  SubscriptionInfo,
  PlanType,
  TokenUsageInfo,
} from '../schemas/subscription.js';
import { PLAN_CONFIG, TOKENS_PER_OPERATION } from '../schemas/subscription.js';

const logger = getLogger('subscriptionService');

/**
 * Subscription service error.
 */
export class SubscriptionError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'SubscriptionError';
    this.code = code;
  }
}

/**
 * Service for managing subscriptions and Stripe integration.
 */
export class SubscriptionService {
  private readonly stripe: Stripe;
  private readonly subscriptionRepo: SubscriptionRepository;
  private readonly tokenQuotaRepo: TokenQuotaRepository;
  private readonly supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    const stripeSecretKey = process.env['STRIPE_SECRET_KEY'];

    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY is required');
    }

    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2025-02-24.acacia',
    });
    this.supabase = supabase;
    this.subscriptionRepo = new SubscriptionRepository(supabase);
    this.tokenQuotaRepo = new TokenQuotaRepository(supabase);
  }

  /**
   * Create a Stripe Checkout session for subscription.
   *
   * Requirements: 2.1
   */
  async createCheckoutSession(
    userId: string,
    userEmail: string,
    planType: 'premium_basic' | 'premium_pro',
    successUrl: string,
    cancelUrl: string
  ): Promise<{ checkoutUrl: string; sessionId: string }> {
    const planConfig = PLAN_CONFIG[planType];
    if (!planConfig.stripePriceId) {
      throw new SubscriptionError('Invalid plan type', 'INVALID_PLAN');
    }

    // Get or create Stripe customer
    let subscription = await this.subscriptionRepo.getByUserId(userId);
    let customerId: string;

    if (subscription?.stripe_customer_id) {
      customerId = subscription.stripe_customer_id;
    } else {
      // Create new Stripe customer
      const customer = await this.stripe.customers.create({
        email: userEmail,
        metadata: { user_id: userId },
      });
      customerId = customer.id;

      // Create subscription record
      subscription = await this.subscriptionRepo.createSubscription({
        user_id: userId,
        stripe_customer_id: customerId,
        plan_type: 'free',
        status: 'incomplete',
      });
    }

    // Create checkout session
    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [
        {
          price: planConfig.stripePriceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        user_id: userId,
        plan_type: planType,
      },
      subscription_data: {
        metadata: {
          user_id: userId,
          plan_type: planType,
        },
      },
    });

    if (!session.url) {
      throw new SubscriptionError('Failed to create checkout session', 'CHECKOUT_FAILED');
    }

    logger.info('Created checkout session', { userId, planType, sessionId: session.id });

    return {
      checkoutUrl: session.url,
      sessionId: session.id,
    };
  }

  /**
   * Handle checkout.session.completed webhook event.
   *
   * Requirements: 2.2
   */
  async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const userId = session.metadata?.['user_id'];
    const planType = session.metadata?.['plan_type'] as PlanType | undefined;
    const customerId = session.customer as string;
    const subscriptionId = session.subscription as string;

    if (!userId || !planType) {
      logger.error('Missing metadata in checkout session', undefined, { sessionId: session.id });
      return;
    }

    // Get subscription details from Stripe
    const stripeSubscription = await this.stripe.subscriptions.retrieve(subscriptionId);

    // Update subscription in database
    await this.subscriptionRepo.updateByStripeCustomerId(customerId, {
      stripe_subscription_id: subscriptionId,
      plan_type: planType,
      status: 'active',
      current_period_start: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
    });

    // Initialize token quota
    const planConfig = PLAN_CONFIG[planType];
    await this.tokenQuotaRepo.upsert({
      user_id: userId,
      monthly_quota: planConfig.monthlyQuota,
      used_quota: 0,
      reset_at: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
    });

    logger.info('Checkout completed', { userId, planType, subscriptionId });
  }

  /**
   * Handle invoice.paid webhook event.
   *
   * Requirements: 2.3
   */
  async handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    const customerId = invoice.customer as string;
    const subscriptionId = invoice.subscription as string;

    if (!subscriptionId) {
      return; // Not a subscription invoice
    }

    // Get subscription from database
    const subscription = await this.subscriptionRepo.getByStripeCustomerId(customerId);
    if (!subscription) {
      logger.warning('Subscription not found for invoice', { customerId });
      return;
    }

    // Get subscription details from Stripe
    const stripeSubscription = await this.stripe.subscriptions.retrieve(subscriptionId);

    // Update subscription period
    await this.subscriptionRepo.updateByStripeCustomerId(customerId, {
      status: 'active',
      current_period_start: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
    });

    // Reset token quota for new billing period
    await this.tokenQuotaRepo.resetQuota(
      subscription.user_id,
      new Date(stripeSubscription.current_period_end * 1000).toISOString()
    );

    logger.info('Invoice paid, quota reset', { userId: subscription.user_id });
  }

  /**
   * Handle invoice.payment_failed webhook event.
   *
   * Requirements: 2.5
   */
  async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const customerId = invoice.customer as string;

    // Update subscription status
    await this.subscriptionRepo.updateByStripeCustomerId(customerId, {
      status: 'past_due',
    });

    logger.warning('Payment failed', { customerId });
    // TODO: Send notification to user
  }

  /**
   * Handle customer.subscription.deleted webhook event.
   *
   * Requirements: 2.4
   */
  async handleSubscriptionDeleted(stripeSubscription: Stripe.Subscription): Promise<void> {
    const customerId = stripeSubscription.customer as string;

    // Get subscription from database
    const subscription = await this.subscriptionRepo.getByStripeCustomerId(customerId);
    if (!subscription) {
      logger.warning('Subscription not found for deletion', { customerId });
      return;
    }

    // Downgrade to free plan - use null instead of undefined for optional fields
    await this.subscriptionRepo.updateByStripeCustomerId(customerId, {
      plan_type: 'free',
      status: 'canceled',
    });

    // Remove token quota
    await this.tokenQuotaRepo.delete(subscription.user_id);

    logger.info('Subscription deleted', { userId: subscription.user_id });
  }


  /**
   * Get subscription status for a user.
   */
  async getSubscriptionStatus(userId: string): Promise<SubscriptionInfo | null> {
    const subscription = await this.subscriptionRepo.getByUserId(userId);
    if (!subscription) {
      return null;
    }

    return {
      id: subscription.id,
      planType: subscription.plan_type,
      status: subscription.status,
      currentPeriodStart: subscription.current_period_start,
      currentPeriodEnd: subscription.current_period_end,
      stripeCustomerId: subscription.stripe_customer_id,
      cancelAt: subscription.cancel_at,
    };
  }

  /**
   * Get token usage info for a user.
   */
  async getTokenUsageInfo(userId: string): Promise<TokenUsageInfo> {
    const quota = await this.tokenQuotaRepo.getByUserId(userId);

    if (!quota) {
      return {
        monthlyQuota: 0,
        usedQuota: 0,
        resetAt: new Date().toISOString(),
        estimatedOperations: 0,
        percentageUsed: 0,
      };
    }

    const remainingTokens = Math.max(0, quota.monthly_quota - quota.used_quota);
    const estimatedOperations = Math.floor(remainingTokens / TOKENS_PER_OPERATION);
    const percentageUsed = quota.monthly_quota > 0
      ? Math.round((quota.used_quota / quota.monthly_quota) * 100)
      : 0;

    return {
      monthlyQuota: quota.monthly_quota,
      usedQuota: quota.used_quota,
      resetAt: quota.reset_at,
      estimatedOperations,
      percentageUsed,
    };
  }

  /**
   * Create a Stripe Customer Portal session.
   *
   * Requirements: 2.8
   */
  async createCustomerPortalSession(userId: string, returnUrl: string): Promise<string> {
    const subscription = await this.subscriptionRepo.getByUserId(userId);
    if (!subscription?.stripe_customer_id) {
      throw new SubscriptionError('No subscription found', 'SUBSCRIPTION_NOT_FOUND');
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: returnUrl,
    });

    return session.url;
  }

  /**
   * Cancel a subscription.
   *
   * Requirements: 2.9
   */
  async cancelSubscription(userId: string): Promise<{ cancelAt: string }> {
    const subscription = await this.subscriptionRepo.getByUserId(userId);
    if (!subscription?.stripe_subscription_id) {
      throw new SubscriptionError('No active subscription found', 'SUBSCRIPTION_NOT_FOUND');
    }

    // Cancel at period end (not immediately)
    const stripeSubscription = await this.stripe.subscriptions.update(
      subscription.stripe_subscription_id,
      { cancel_at_period_end: true }
    );

    const cancelAt = new Date(stripeSubscription.current_period_end * 1000).toISOString();

    // Update database
    await this.subscriptionRepo.updateByUserId(userId, {
      cancel_at: cancelAt,
    });

    logger.info('Subscription scheduled for cancellation', { userId, cancelAt });

    return { cancelAt };
  }

  /**
   * Check if a user has premium access.
   * Admins always have premium access without subscription.
   *
   * Requirements: 13.2
   */
  async hasPremiumAccess(userId: string, userEmail?: string): Promise<boolean> {
    // Check admin status first - admins always have premium access
    const adminService = getAdminService(this.supabase);
    const isAdmin = await adminService.isAdmin(userId, userEmail);
    if (isAdmin) {
      logger.info('Premium access granted to admin', { userId });
      return true;
    }

    const subscription = await this.subscriptionRepo.getByUserId(userId);
    if (!subscription) {
      return false;
    }

    return (
      subscription.status === 'active' &&
      (subscription.plan_type === 'premium_basic' || subscription.plan_type === 'premium_pro')
    );
  }

  /**
   * Check if a user has access to a specific feature.
   * Admins have access to all features.
   *
   * Requirements: 13.2
   */
  async hasFeatureAccess(userId: string, feature: string, userEmail?: string): Promise<boolean> {
    // Check admin status first - admins have access to all features
    const adminService = getAdminService(this.supabase);
    const isAdmin = await adminService.isAdmin(userId, userEmail);
    if (isAdmin) {
      logger.info('Feature access granted to admin', { userId, feature });
      return true;
    }

    const subscription = await this.subscriptionRepo.getByUserId(userId);
    const planType = subscription?.plan_type ?? 'free';
    const planConfig = PLAN_CONFIG[planType];

    return planConfig.features.includes(feature);
  }

  /**
   * Get the plan type for a user.
   */
  async getPlanType(userId: string): Promise<PlanType> {
    const subscription = await this.subscriptionRepo.getByUserId(userId);
    return subscription?.plan_type ?? 'free';
  }
}

// Singleton instance
let _subscriptionService: SubscriptionService | null = null;

/**
 * Get or create the singleton subscription service instance.
 */
export function getSubscriptionService(supabase: SupabaseClient): SubscriptionService {
  if (_subscriptionService === null) {
    _subscriptionService = new SubscriptionService(supabase);
  }
  return _subscriptionService;
}

/**
 * Reset the singleton instance (useful for testing).
 */
export function resetSubscriptionService(): void {
  _subscriptionService = null;
}
