/**
 * Usage Quota Service for THLI-24 Assessments
 *
 * Manages THLI-24 assessment quotas for free and premium users.
 * Free users: 10 assessments per month
 * Premium users: Unlimited assessments (quota_limit = -1)
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getLogger } from '../utils/logger.js';
import type { QuotaStatus, QuotaPeriod } from '../types/thli.js';
import { calculateQuotaStatus, isQuotaAvailable } from '../types/thli.js';
import { getSubscriptionService } from './subscriptionService.js';

const logger = getLogger('usageQuotaService');

/**
 * Database row type for thli_assessment_quotas table
 */
interface THLIQuotaRow {
  id: string;
  user_id: string;
  quota_type: string;
  quota_used: number;
  quota_limit: number;
  period_start: string;
  period_end: string;
  created_at: string;
  updated_at: string;
}

/**
 * Quota check result
 */
export interface QuotaCheckResult {
  allowed: boolean;
  status: QuotaStatus;
  message?: string;
  upgradeRequired?: boolean;
}

/**
 * Quota exceeded error
 */
export class QuotaExceededError extends Error {
  readonly code = 'THLI_QUOTA_EXCEEDED';
  readonly upgradeRequired: boolean;
  readonly quotaStatus: QuotaStatus;

  constructor(quotaStatus: QuotaStatus) {
    super('今月のTHLI-24評価回数の上限に達しました');
    this.name = 'QuotaExceededError';
    this.upgradeRequired = true;
    this.quotaStatus = quotaStatus;
  }
}

/**
 * Usage Quota Service
 *
 * Manages THLI-24 assessment quotas for users.
 *
 * Property 21: Free User Quota Allocation
 * For any new free user, a quota record must be created with quota_limit = 10.
 *
 * Property 22: Premium User Unlimited Quota
 * For any premium user, the quota record must have quota_limit = -1.
 *
 * Property 11: Quota Enforcement During Assessment
 * For any free user attempting to initiate a THLI-24 assessment,
 * if quota_used >= quota_limit, the assessment must be prevented.
 *
 * Property 13: Quota Increment on Success Only
 * quota_used must be incremented by 1 only when assessment completes successfully.
 *
 * Property 23: Monthly Quota Reset
 * When a new month begins, a new quota record must be created with quota_used = 0.
 */
export class UsageQuotaService {
  private readonly supabase: SupabaseClient;
  private readonly tableName = 'thli_assessment_quotas';

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Check if user has remaining THLI assessments.
   *
   * Requirement 7.3: Query token_quotas for current period
   * Requirement 7.4: Block assessment if quota_used >= quota_limit
   *
   * @param userId - The user to check
   * @returns Quota status with allowed flag
   */
  async checkQuota(userId: string): Promise<QuotaCheckResult> {
    try {
      // Get or create quota for current period
      const quota = await this.getOrCreateCurrentQuota(userId);
      const status = this.convertToQuotaStatus(quota);

      // Check if quota is available
      // Property 11: Quota Enforcement During Assessment
      if (!isQuotaAvailable(status)) {
        logger.info('THLI quota exhausted', {
          userId,
          quotaUsed: status.quotaUsed,
          quotaLimit: status.quotaLimit,
        });

        return {
          allowed: false,
          status,
          message: '今月のTHLI-24評価回数の上限に達しました',
          upgradeRequired: true,
        };
      }

      return {
        allowed: true,
        status,
      };
    } catch (error) {
      logger.error('Failed to check THLI quota', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Consume one THLI assessment from user's quota.
   *
   * Requirement 7.6: Increment quota_used by 1
   * Requirement 4.5: Only on successful assessment completion
   *
   * Property 13: Quota Increment on Success Only
   *
   * @param userId - The user
   * @returns Updated quota status
   */
  async consumeAssessment(userId: string): Promise<QuotaStatus> {
    try {
      // Get current quota
      const quota = await this.getOrCreateCurrentQuota(userId);
      const status = this.convertToQuotaStatus(quota);

      // If unlimited, no need to increment (but still return status)
      if (status.isUnlimited) {
        logger.info('THLI assessment consumed (unlimited)', { userId });
        return status;
      }

      // Increment quota_used
      const { data: updatedQuota, error } = await this.supabase
        .from(this.tableName)
        .update({
          quota_used: quota.quota_used + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', quota.id)
        .select()
        .single();

      if (error || !updatedQuota) {
        throw new Error(`Failed to consume THLI assessment: ${error?.message ?? 'Unknown error'}`);
      }

      const updatedStatus = this.convertToQuotaStatus(updatedQuota as THLIQuotaRow);

      logger.info('THLI assessment consumed', {
        userId,
        quotaUsed: updatedStatus.quotaUsed,
        quotaLimit: updatedStatus.quotaLimit,
        remaining: updatedStatus.remaining,
      });

      return updatedStatus;
    } catch (error) {
      logger.error('Failed to consume THLI assessment', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Reset monthly quotas for all users.
   *
   * Requirement 7.5: Create new quota periods for new month
   *
   * Property 23: Monthly Quota Reset
   * When a new month begins, create new quota records with quota_used = 0.
   *
   * @returns Number of quotas reset
   */
  async resetMonthlyQuotas(): Promise<number> {
    try {
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

      // Get all users with expired quotas (period_end < now)
      const { data: expiredQuotas, error: fetchError } = await this.supabase
        .from(this.tableName)
        .select('user_id, quota_limit')
        .lt('period_end', now.toISOString());

      if (fetchError) {
        throw new Error(`Failed to fetch expired quotas: ${fetchError.message}`);
      }

      if (!expiredQuotas || expiredQuotas.length === 0) {
        logger.info('No expired THLI quotas to reset');
        return 0;
      }

      // Create new quota records for each user
      let resetCount = 0;
      for (const quota of expiredQuotas) {
        const { error: insertError } = await this.supabase
          .from(this.tableName)
          .upsert({
            user_id: quota.user_id,
            quota_type: 'thli_assessments',
            quota_used: 0,
            quota_limit: quota.quota_limit, // Preserve quota_limit
            period_start: periodStart.toISOString(),
            period_end: periodEnd.toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id,period_start',
          });

        if (!insertError) {
          resetCount++;
        } else {
          logger.warning('Failed to reset quota for user', { userId: quota.user_id, error: insertError.message });
        }
      }

      logger.info('Monthly THLI quotas reset', { resetCount, totalExpired: expiredQuotas.length });
      return resetCount;
    } catch (error) {
      logger.error('Failed to reset monthly THLI quotas', error as Error);
      throw error;
    }
  }

  /**
   * Get quota history for a user.
   *
   * @param userId - The user
   * @returns Array of quota periods
   */
  async getQuotaHistory(userId: string): Promise<QuotaPeriod[]> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('user_id', userId)
        .order('period_start', { ascending: false });

      if (error) {
        throw new Error(`Failed to get quota history: ${error.message}`);
      }

      return (data ?? []).map((row: THLIQuotaRow) => ({
        id: row.id,
        userId: row.user_id,
        quotaType: 'thli_assessments' as const,
        quotaUsed: row.quota_used,
        quotaLimit: row.quota_limit,
        periodStart: new Date(row.period_start),
        periodEnd: new Date(row.period_end),
        createdAt: new Date(row.created_at),
      }));
    } catch (error) {
      logger.error('Failed to get quota history', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Initialize quota for a new user.
   *
   * Requirement 7.1: Free users get quota_limit = 10
   * Requirement 7.2: Premium users get quota_limit = -1 (unlimited)
   *
   * Property 21: Free User Quota Allocation
   * Property 22: Premium User Unlimited Quota
   *
   * @param userId - The user ID
   * @param isPremium - Whether the user is premium
   * @returns Created quota status
   */
  async initializeQuota(userId: string, isPremium: boolean = false): Promise<QuotaStatus> {
    try {
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

      // Requirement 7.1: Free users get 10 assessments/month
      // Requirement 7.2: Premium users get unlimited (-1)
      const quotaLimit = isPremium ? -1 : 10;

      const { data, error } = await this.supabase
        .from(this.tableName)
        .upsert({
          user_id: userId,
          quota_type: 'thli_assessments',
          quota_used: 0,
          quota_limit: quotaLimit,
          period_start: periodStart.toISOString(),
          period_end: periodEnd.toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,period_start',
        })
        .select()
        .single();

      if (error || !data) {
        throw new Error(`Failed to initialize THLI quota: ${error?.message ?? 'Unknown error'}`);
      }

      const status = this.convertToQuotaStatus(data as THLIQuotaRow);

      logger.info('THLI quota initialized', {
        userId,
        isPremium,
        quotaLimit: status.quotaLimit,
      });

      return status;
    } catch (error) {
      logger.error('Failed to initialize THLI quota', error as Error, { userId, isPremium });
      throw error;
    }
  }

  /**
   * Update quota limit for a user (e.g., when upgrading to premium).
   *
   * @param userId - The user ID
   * @param isPremium - Whether the user is premium
   * @returns Updated quota status
   */
  async updateQuotaLimit(userId: string, isPremium: boolean): Promise<QuotaStatus> {
    try {
      const quotaLimit = isPremium ? -1 : 10;

      // Get current quota
      const quota = await this.getOrCreateCurrentQuota(userId);

      // Update quota limit
      const { data, error } = await this.supabase
        .from(this.tableName)
        .update({
          quota_limit: quotaLimit,
          updated_at: new Date().toISOString(),
        })
        .eq('id', quota.id)
        .select()
        .single();

      if (error || !data) {
        throw new Error(`Failed to update THLI quota limit: ${error?.message ?? 'Unknown error'}`);
      }

      const status = this.convertToQuotaStatus(data as THLIQuotaRow);

      logger.info('THLI quota limit updated', {
        userId,
        isPremium,
        quotaLimit: status.quotaLimit,
      });

      return status;
    } catch (error) {
      logger.error('Failed to update THLI quota limit', error as Error, { userId, isPremium });
      throw error;
    }
  }

  /**
   * Check quota and throw if insufficient.
   * Convenience method for use in assessment operations.
   *
   * Requirement 7.4: Block assessment if quota_used >= quota_limit
   *
   * @param userId - The user ID
   * @throws QuotaExceededError if quota is exhausted
   */
  async requireQuota(userId: string): Promise<QuotaStatus> {
    const result = await this.checkQuota(userId);

    if (!result.allowed) {
      throw new QuotaExceededError(result.status);
    }

    return result.status;
  }

  /**
   * Get or create quota for current period.
   *
   * @param userId - The user ID
   * @returns Quota row
   */
  private async getOrCreateCurrentQuota(userId: string): Promise<THLIQuotaRow> {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Try to get existing quota for current period
    const { data: existingQuota, error: fetchError } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .gte('period_end', now.toISOString())
      .lte('period_start', now.toISOString())
      .order('period_start', { ascending: false })
      .limit(1)
      .single();

    if (existingQuota && !fetchError) {
      return existingQuota as THLIQuotaRow;
    }

    // No quota for current period, create one
    // Check if user is premium
    const subscriptionService = getSubscriptionService(this.supabase);
    const planType = await subscriptionService.getPlanType(userId);
    const isPremium = planType !== 'free';

    // Get previous quota to preserve quota_limit if exists
    const { data: previousQuota } = await this.supabase
      .from(this.tableName)
      .select('quota_limit')
      .eq('user_id', userId)
      .order('period_start', { ascending: false })
      .limit(1)
      .single();

    // Determine quota limit
    let quotaLimit: number;
    if (previousQuota) {
      // Preserve previous quota_limit (in case of plan changes)
      quotaLimit = previousQuota.quota_limit;
    } else {
      // New user - set based on plan
      quotaLimit = isPremium ? -1 : 10;
    }

    // Create new quota record
    const { data: newQuota, error: createError } = await this.supabase
      .from(this.tableName)
      .upsert({
        user_id: userId,
        quota_type: 'thli_assessments',
        quota_used: 0,
        quota_limit: quotaLimit,
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,period_start',
      })
      .select()
      .single();

    if (createError || !newQuota) {
      throw new Error(`Failed to create THLI quota: ${createError?.message ?? 'Unknown error'}`);
    }

    logger.info('Created new THLI quota period', {
      userId,
      quotaLimit,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
    });

    return newQuota as THLIQuotaRow;
  }

  /**
   * Convert database row to QuotaStatus.
   *
   * @param row - Database row
   * @returns QuotaStatus
   */
  private convertToQuotaStatus(row: THLIQuotaRow): QuotaStatus {
    return calculateQuotaStatus(
      row.quota_used,
      row.quota_limit,
      new Date(row.period_start),
      new Date(row.period_end)
    );
  }
}

// Singleton instance
let _usageQuotaService: UsageQuotaService | null = null;

/**
 * Get or create the singleton usage quota service instance.
 */
export function getUsageQuotaService(supabase: SupabaseClient): UsageQuotaService {
  if (_usageQuotaService === null) {
    _usageQuotaService = new UsageQuotaService(supabase);
  }
  return _usageQuotaService;
}

/**
 * Reset the singleton instance (useful for testing).
 */
export function resetUsageQuotaService(): void {
  _usageQuotaService = null;
}
