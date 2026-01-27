/**
 * Subscription Hook
 * 
 * Provides functions for managing subscription status and Stripe checkout.
 * 
 * Requirements: 1.4, 1.5, 1.6
 */

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

// Backend API endpoint
const API_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL || process.env.NEXT_PUBLIC_SLACK_API_URL || '';

// Plan types
export type PlanType = 'free' | 'premium_basic' | 'premium_pro';
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'incomplete';

// Subscription info from API
export interface SubscriptionInfo {
  id: string;
  planType: PlanType;
  status: SubscriptionStatus;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  stripeCustomerId: string;
  cancelAt: string | null;
}

// Token usage info from API
export interface TokenUsageInfo {
  monthlyQuota: number;
  usedQuota: number;
  resetAt: string;
  estimatedOperations: number;
  percentageUsed: number;
}

// Plan configuration
export interface PlanConfig {
  name: string;
  nameJa: string;
  monthlyQuota: number;
  price: number;
  features: string[];
  featuresJa: string[];
  estimatedOperations?: number;
  recommended?: boolean;
}

// Plan configurations
export const PLAN_CONFIGS: Record<PlanType, PlanConfig> = {
  free: {
    name: 'Free',
    nameJa: 'フリー',
    monthlyQuota: 0,
    price: 0,
    features: [
      'Basic habit management',
      'Basic goal management',
      'Slack slash commands',
      'Workload coaching (rule-based)',
      'Notice section',
      'Web push notifications',
    ],
    featuresJa: [
      '基本的なHabit管理',
      '基本的なGoal管理',
      'Slackスラッシュコマンド',
      'Workloadコーチング（ルールベース）',
      'Notice Section',
      'Web Push通知',
    ],
  },
  premium_basic: {
    name: 'Premium Basic',
    nameJa: 'プレミアム ベーシック',
    monthlyQuota: 500000,
    price: 980,
    features: [
      'All Free features',
      'Natural language habit creation',
      'Natural language habit editing',
      'Token usage dashboard',
    ],
    featuresJa: [
      'フリープランの全機能',
      '自然言語でHabit登録',
      '自然言語でHabit編集',
      'トークン使用量ダッシュボード',
    ],
    estimatedOperations: 500,
    recommended: true,
  },
  premium_pro: {
    name: 'Premium Pro',
    nameJa: 'プレミアム プロ',
    monthlyQuota: 2000000,
    price: 1980,
    features: [
      'All Premium Basic features',
      'AI habit suggestions for goals',
      'ChatGPT connector',
      'Priority support',
    ],
    featuresJa: [
      'プレミアム ベーシックの全機能',
      'Goal向けAI Habit提案',
      'ChatGPTコネクタ',
      '優先サポート',
    ],
    estimatedOperations: 2000,
  },
};

interface UseSubscriptionReturn {
  // State
  subscription: SubscriptionInfo | null;
  tokenUsage: TokenUsageInfo | null;
  loading: boolean;
  error: string | null;
  checkoutLoading: boolean;
  
  // Computed
  currentPlan: PlanType;
  isPremium: boolean;
  
  // Actions
  startCheckout: (planType: 'premium_basic' | 'premium_pro') => Promise<void>;
  openCustomerPortal: () => Promise<void>;
  cancelSubscription: () => Promise<boolean>;
  refreshStatus: () => Promise<void>;
}

export function useSubscription(): UseSubscriptionReturn {
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [tokenUsage, setTokenUsage] = useState<TokenUsageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // Computed values
  const currentPlan: PlanType = subscription?.planType ?? 'free';
  const isPremium = currentPlan !== 'free' && subscription?.status === 'active';

  /**
   * Get authentication headers with Supabase JWT token
   */
  const getAuthHeaders = useCallback(async (): Promise<HeadersInit> => {
    if (!supabase) {
      throw new Error('Supabase client not initialized');
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }
    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    };
  }, []);

  /**
   * Fetch current subscription status
   */
  const refreshStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/api/subscription/status`, {
        headers,
        credentials: 'include',
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          setSubscription(null);
          setTokenUsage(null);
          return;
        }
        throw new Error('Failed to fetch subscription status');
      }
      
      const data = await response.json();
      setSubscription(data.subscription);
      setTokenUsage(data.tokenUsage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setSubscription(null);
      setTokenUsage(null);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  /**
   * Start Stripe Checkout session
   */
  const startCheckout = useCallback(async (planType: 'premium_basic' | 'premium_pro') => {
    try {
      setCheckoutLoading(true);
      setError(null);
      
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/api/subscription/checkout`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          planType,
          successUrl: `${window.location.origin}/settings?subscription_success=true`,
          cancelUrl: `${window.location.origin}/settings?subscription_canceled=true`,
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create checkout session');
      }
      
      const { checkoutUrl } = await response.json();
      window.location.href = checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setCheckoutLoading(false);
    }
  }, [getAuthHeaders]);

  /**
   * Open Stripe Customer Portal
   */
  const openCustomerPortal = useCallback(async () => {
    try {
      setError(null);
      
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/api/subscription/portal`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          returnUrl: `${window.location.origin}/settings/subscription`,
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to open customer portal');
      }
      
      const { portalUrl } = await response.json();
      window.location.href = portalUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, [getAuthHeaders]);

  /**
   * Cancel subscription
   */
  const cancelSubscription = useCallback(async (): Promise<boolean> => {
    try {
      setError(null);
      
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/api/subscription/cancel`, {
        method: 'POST',
        headers,
        credentials: 'include',
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to cancel subscription');
      }
      
      await refreshStatus();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [getAuthHeaders, refreshStatus]);

  // Fetch status on mount
  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // Check for checkout callback params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    
    if (params.get('subscription_success') === 'true') {
      // Clear URL params and refresh
      window.history.replaceState({}, '', window.location.pathname);
      refreshStatus();
    }
    
    if (params.get('subscription_canceled') === 'true') {
      // Clear URL params
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [refreshStatus]);

  return {
    subscription,
    tokenUsage,
    loading,
    error,
    checkoutLoading,
    currentPlan,
    isPremium,
    startCheckout,
    openCustomerPortal,
    cancelSubscription,
    refreshStatus,
  };
}

export default useSubscription;
