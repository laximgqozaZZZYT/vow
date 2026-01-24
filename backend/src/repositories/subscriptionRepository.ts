/**
 * Subscription Repository
 *
 * Database operations for subscriptions, token_usage, and token_quotas tables.
 *
 * Requirements: 2.6, 8.1, 8.2, 8.3
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { BaseRepository } from './base.js';
import type {
  Subscription,
  SubscriptionCreate,
  SubscriptionUpdate,
} from '../schemas/subscription.js';

/**
 * Repository for subscription database operations.
 */
export class SubscriptionRepository extends BaseRepository<Record<string, unknown>> {
  constructor(supabase: SupabaseClient) {
    super(supabase, 'subscriptions');
  }

  /**
   * Get subscription by user ID.
   */
  async getByUserId(userId: string): Promise<Subscription | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return null;
    }
    return data as Subscription;
  }

  /**
   * Get subscription by Stripe customer ID.
   */
  async getByStripeCustomerId(stripeCustomerId: string): Promise<Subscription | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('stripe_customer_id', stripeCustomerId)
      .single();

    if (error || !data) {
      return null;
    }
    return data as Subscription;
  }

  /**
   * Get subscription by Stripe subscription ID.
   */
  async getByStripeSubscriptionId(stripeSubscriptionId: string): Promise<Subscription | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('stripe_subscription_id', stripeSubscriptionId)
      .single();

    if (error || !data) {
      return null;
    }
    return data as Subscription;
  }

  /**
   * Create a new subscription.
   */
  async createSubscription(data: SubscriptionCreate): Promise<Subscription> {
    const { data: result, error } = await this.supabase
      .from(this.tableName)
      .insert(data)
      .select()
      .single();

    if (error || !result) {
      throw new Error(`Failed to create subscription: ${error?.message}`);
    }
    return result as Subscription;
  }

  /**
   * Update subscription by user ID.
   */
  async updateByUserId(userId: string, data: SubscriptionUpdate): Promise<Subscription | null> {
    const { data: result, error } = await this.supabase
      .from(this.tableName)
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !result) {
      return null;
    }
    return result as Subscription;
  }

  /**
   * Update subscription by Stripe customer ID.
   */
  async updateByStripeCustomerId(
    stripeCustomerId: string,
    data: SubscriptionUpdate
  ): Promise<Subscription | null> {
    const { data: result, error } = await this.supabase
      .from(this.tableName)
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('stripe_customer_id', stripeCustomerId)
      .select()
      .single();

    if (error || !result) {
      return null;
    }
    return result as Subscription;
  }
}
