/**
 * Subscription Schemas
 *
 * Type definitions for subscription-related data structures.
 *
 * Requirements: 8.1, 8.2, 8.3
 */

/**
 * Plan types available in the system.
 */
export type PlanType = 'free' | 'premium_basic' | 'premium_pro';

/**
 * Subscription status values.
 */
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'incomplete';

/**
 * Subscription database record.
 */
export interface Subscription {
  id: string;
  user_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string | null;
  plan_type: PlanType;
  status: SubscriptionStatus;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Data for creating a new subscription.
 */
export interface SubscriptionCreate {
  user_id: string;
  stripe_customer_id: string;
  stripe_subscription_id?: string;
  plan_type?: PlanType;
  status?: SubscriptionStatus;
  current_period_start?: string;
  current_period_end?: string;
}

/**
 * Data for updating a subscription.
 */
export interface SubscriptionUpdate {
  stripe_subscription_id?: string;
  plan_type?: PlanType;
  status?: SubscriptionStatus;
  current_period_start?: string;
  current_period_end?: string;
  cancel_at?: string | null;
}

/**
 * Token usage database record.
 */
export interface TokenUsage {
  id: string;
  user_id: string;
  feature: string;
  tokens_used: number;
  created_at: string;
}

/**
 * Data for creating a token usage record.
 */
export interface TokenUsageCreate {
  user_id: string;
  feature: string;
  tokens_used: number;
}

/**
 * Token quota database record.
 */
export interface TokenQuota {
  id: string;
  user_id: string;
  monthly_quota: number;
  used_quota: number;
  reset_at: string;
  created_at: string;
  updated_at: string;
}

/**
 * Data for creating/updating a token quota.
 */
export interface TokenQuotaUpsert {
  user_id: string;
  monthly_quota: number;
  used_quota?: number;
  reset_at: string;
}

/**
 * Subscription info for API responses.
 */
export interface SubscriptionInfo {
  id: string;
  planType: PlanType;
  status: SubscriptionStatus;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  stripeCustomerId: string;
  cancelAt: string | null;
}

/**
 * Token usage info for API responses.
 */
export interface TokenUsageInfo {
  monthlyQuota: number;
  usedQuota: number;
  resetAt: string;
  estimatedOperations: number;
  percentageUsed: number;
}

/**
 * Plan configuration.
 */
export interface PlanConfig {
  monthlyQuota: number;
  price: number;
  stripePriceId: string | undefined;
  features: string[];
  estimatedOperations?: number | undefined;
}

/**
 * Plan configuration map.
 */
export const PLAN_CONFIG: Record<PlanType, PlanConfig> = {
  free: {
    monthlyQuota: 0,
    price: 0,
    stripePriceId: undefined,
    features: [
      'basic_habits',
      'basic_goals',
      'slack_commands',
      'workload_coaching',
      'notice_section',
      'web_push_notifications',
    ],
  },
  premium_basic: {
    monthlyQuota: 500000,
    price: 980,
    stripePriceId: process.env['STRIPE_PRICE_ID_BASIC'] ?? undefined,
    features: [
      'basic_habits',
      'basic_goals',
      'slack_commands',
      'workload_coaching',
      'notice_section',
      'web_push_notifications',
      'ai_habit_parse',
      'ai_habit_edit',
      'slack_nl',
      'token_usage_dashboard',
    ],
    estimatedOperations: 500,
  },
  premium_pro: {
    monthlyQuota: 2000000,
    price: 1980,
    stripePriceId: process.env['STRIPE_PRICE_ID_PRO'] ?? undefined,
    features: [
      'basic_habits',
      'basic_goals',
      'slack_commands',
      'workload_coaching',
      'notice_section',
      'web_push_notifications',
      'ai_habit_parse',
      'ai_habit_edit',
      'slack_nl',
      'token_usage_dashboard',
      'ai_habit_suggestion',
      'chatgpt_connector',
      'priority_support',
    ],
    estimatedOperations: 2000,
  },
};

/**
 * Tokens per operation estimate (average).
 */
export const TOKENS_PER_OPERATION = 1000;
