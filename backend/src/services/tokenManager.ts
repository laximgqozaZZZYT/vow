/**
 * Token Manager Service
 *
 * Manages token quotas, usage tracking, and threshold notifications.
 *
 * Requirements: 5.1, 5.3, 5.4, 5.6, 5.7, 5.8, 5.10, 5.11
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { TokenUsageRepository, TokenQuotaRepository } from '../repositories/tokenRepository.js';
import { getLogger } from '../utils/logger.js';
import type { TokenUsageInfo, PlanType } from '../schemas/subscription.js';
import { PLAN_CONFIG, TOKENS_PER_OPERATION } from '../schemas/subscription.js';

const logger = getLogger('tokenManager');

/**
 * Token quota check result.
 */
export interface QuotaCheckResult {
  allowed: boolean;
  remainingTokens: number;
  resetAt: string;
  message?: string;
}

/**
 * Token quota exceeded error.
 */
export class QuotaExceededError extends Error {
  readonly code = 'QUOTA_EXCEEDED';
  readonly resetAt: string;

  constructor(resetAt: string) {
    super('今月のトークン上限に達しました');
    this.name = 'QuotaExceededError';
    this.resetAt = resetAt;
  }
}

/**
 * Premium required error.
 */
export class PremiumRequiredError extends Error {
  readonly code = 'PREMIUM_REQUIRED';

  constructor() {
    super('この機能はPremiumプランでのみ利用可能です');
    this.name = 'PremiumRequiredError';
  }
}

/**
 * Token Manager Service.
 *
 * Property 6: Token Usage Recording
 * For any AI operation, the Token_Manager SHALL record a token_usage entry
 * with the correct user_id, feature name, and tokens_used value.
 *
 * Property 7: Quota Enforcement
 * For any AI operation request where used_quota + estimated_tokens > monthly_quota,
 * the system SHALL reject the request before calling the AI provider.
 */
export class TokenManagerService {
  private readonly usageRepo: TokenUsageRepository;
  private readonly quotaRepo: TokenQuotaRepository;

  constructor(supabase: SupabaseClient) {
    this.usageRepo = new TokenUsageRepository(supabase);
    this.quotaRepo = new TokenQuotaRepository(supabase);
  }

  /**
   * Check if user has sufficient quota for an operation.
   *
   * Property 7: Quota Enforcement
   * Requirements: 5.3
   */
  async checkQuota(userId: string, estimatedTokens: number): Promise<QuotaCheckResult> {
    const quota = await this.quotaRepo.getByUserId(userId);

    // No quota record means free user
    if (!quota) {
      return {
        allowed: false,
        remainingTokens: 0,
        resetAt: new Date().toISOString(),
        message: 'この機能はPremiumプランでのみ利用可能です',
      };
    }

    const remainingTokens = quota.monthly_quota - quota.used_quota;

    if (remainingTokens < estimatedTokens) {
      return {
        allowed: false,
        remainingTokens,
        resetAt: quota.reset_at,
        message: '今月のトークン上限に達しました',
      };
    }

    return {
      allowed: true,
      remainingTokens,
      resetAt: quota.reset_at,
    };
  }

  /**
   * Record token usage and update quota.
   *
   * Property 6: Token Usage Recording
   * Requirements: 5.4
   */
  async recordUsage(userId: string, feature: string, tokensUsed: number): Promise<void> {
    // Record individual usage
    await this.usageRepo.create({
      user_id: userId,
      feature,
      tokens_used: tokensUsed,
    });

    // Update quota
    const updatedQuota = await this.quotaRepo.incrementUsedQuota(userId, tokensUsed);

    if (updatedQuota) {
      // Check for threshold notifications
      await this.checkThresholds(userId, updatedQuota.used_quota, updatedQuota.monthly_quota);
    }

    logger.info('Token usage recorded', { userId, feature, tokensUsed });
  }

  /**
   * Check and trigger threshold notifications.
   *
   * Property 10: Token Threshold Notifications
   * Requirements: 5.6, 5.7, 5.8
   */
  private async checkThresholds(
    userId: string,
    usedQuota: number,
    monthlyQuota: number
  ): Promise<void> {
    if (monthlyQuota === 0) return;

    const percentage = (usedQuota / monthlyQuota) * 100;

    if (percentage >= 100) {
      await this.sendThresholdNotification(userId, 100);
    } else if (percentage >= 90) {
      await this.sendThresholdNotification(userId, 90);
    } else if (percentage >= 70) {
      await this.sendThresholdNotification(userId, 70);
    }
  }

  /**
   * Send threshold notification.
   *
   * Requirements: 5.6, 5.7, 5.8
   */
  private async sendThresholdNotification(userId: string, percentage: number): Promise<void> {
    // TODO: Integrate with NotificationService when implemented
    logger.info('Token threshold reached', { userId, percentage });
  }

  /**
   * Get token usage info for a user.
   *
   * Requirements: 5.5, 5.11
   */
  async getUsage(userId: string): Promise<TokenUsageInfo> {
    const quota = await this.quotaRepo.getByUserId(userId);

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
   * Get usage history for a user.
   *
   * Requirements: 5.11
   */
  async getUsageHistory(
    userId: string,
    options?: { limit?: number; startDate?: string; endDate?: string }
  ) {
    return this.usageRepo.getByUserId(userId, options);
  }

  /**
   * Get usage breakdown by feature.
   */
  async getUsageByFeature(userId: string, startDate: string, endDate: string) {
    return this.usageRepo.getUsageByFeature(userId, startDate, endDate);
  }

  /**
   * Reset quota for a new billing period.
   *
   * Property 11: Quota Reset on Billing Cycle
   * Requirements: 5.10
   */
  async resetQuota(userId: string, newResetAt: string): Promise<void> {
    await this.quotaRepo.resetQuota(userId, newResetAt);
    logger.info('Token quota reset', { userId, newResetAt });
  }

  /**
   * Initialize quota for a new premium user.
   *
   * Property 9: Premium User Quota Allocation
   * Requirements: 5.1
   */
  async initializeQuota(userId: string, planType: PlanType, resetAt: string): Promise<void> {
    const planConfig = PLAN_CONFIG[planType];

    await this.quotaRepo.upsert({
      user_id: userId,
      monthly_quota: planConfig.monthlyQuota,
      used_quota: 0,
      reset_at: resetAt,
    });

    logger.info('Token quota initialized', { userId, planType, monthlyQuota: planConfig.monthlyQuota });
  }

  /**
   * Update quota for plan change.
   */
  async updateQuotaForPlanChange(userId: string, newPlanType: PlanType): Promise<void> {
    const planConfig = PLAN_CONFIG[newPlanType];
    await this.quotaRepo.updateMonthlyQuota(userId, planConfig.monthlyQuota);
    logger.info('Token quota updated for plan change', { userId, newPlanType });
  }

  /**
   * Check quota and throw if insufficient.
   * Convenience method for use in AI operations.
   */
  async requireQuota(userId: string, estimatedTokens: number): Promise<void> {
    const result = await this.checkQuota(userId, estimatedTokens);

    if (!result.allowed) {
      if (result.remainingTokens === 0 && result.message?.includes('Premium')) {
        throw new PremiumRequiredError();
      }
      throw new QuotaExceededError(result.resetAt);
    }
  }
}

// Singleton instance
let _tokenManager: TokenManagerService | null = null;

/**
 * Get or create the singleton token manager instance.
 */
export function getTokenManager(supabase: SupabaseClient): TokenManagerService {
  if (_tokenManager === null) {
    _tokenManager = new TokenManagerService(supabase);
  }
  return _tokenManager;
}

/**
 * Reset the singleton instance (useful for testing).
 */
export function resetTokenManager(): void {
  _tokenManager = null;
}
