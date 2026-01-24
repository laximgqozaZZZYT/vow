/**
 * Token Repository
 *
 * Database operations for token_usage and token_quotas tables.
 *
 * Requirements: 5.1, 5.4, 5.10, 5.11
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  TokenUsage,
  TokenUsageCreate,
  TokenQuota,
  TokenQuotaUpsert,
} from '../schemas/subscription.js';

/**
 * Repository for token usage database operations.
 */
export class TokenUsageRepository {
  private readonly supabase: SupabaseClient;
  private readonly tableName = 'token_usage';

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Record token usage.
   */
  async create(data: TokenUsageCreate): Promise<TokenUsage> {
    const { data: result, error } = await this.supabase
      .from(this.tableName)
      .insert(data)
      .select()
      .single();

    if (error || !result) {
      throw new Error(`Failed to record token usage: ${error?.message ?? 'Unknown error'}`);
    }
    return result as TokenUsage;
  }

  /**
   * Get token usage history for a user.
   */
  async getByUserId(
    userId: string,
    options?: { limit?: number; startDate?: string; endDate?: string }
  ): Promise<TokenUsage[]> {
    let query = this.supabase
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (options?.startDate) {
      query = query.gte('created_at', options.startDate);
    }
    if (options?.endDate) {
      query = query.lte('created_at', options.endDate);
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error || !data) {
      return [];
    }
    return data as TokenUsage[];
  }

  /**
   * Get total tokens used by a user in a date range.
   */
  async getTotalUsage(userId: string, startDate: string, endDate: string): Promise<number> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('tokens_used')
      .eq('user_id', userId)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (error || !data) {
      return 0;
    }

    return data.reduce((sum, record) => sum + (record.tokens_used ?? 0), 0);
  }

  /**
   * Get usage breakdown by feature.
   */
  async getUsageByFeature(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<Record<string, number>> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('feature, tokens_used')
      .eq('user_id', userId)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (error || !data) {
      return {};
    }

    const breakdown: Record<string, number> = {};
    for (const record of data) {
      const feature = record.feature as string;
      breakdown[feature] = (breakdown[feature] ?? 0) + (record.tokens_used ?? 0);
    }
    return breakdown;
  }

  /**
   * Delete old usage records (for data retention).
   */
  async deleteOldRecords(beforeDate: string): Promise<number> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .delete()
      .lt('created_at', beforeDate)
      .select('id');

    if (error || !data) {
      return 0;
    }
    return data.length;
  }
}

/**
 * Repository for token quota database operations.
 */
export class TokenQuotaRepository {
  private readonly supabase: SupabaseClient;
  private readonly tableName = 'token_quotas';

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Get token quota for a user.
   */
  async getByUserId(userId: string): Promise<TokenQuota | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return null;
    }
    return data as TokenQuota;
  }

  /**
   * Create or update token quota (upsert).
   */
  async upsert(data: TokenQuotaUpsert): Promise<TokenQuota> {
    const { data: result, error } = await this.supabase
      .from(this.tableName)
      .upsert(
        {
          ...data,
          used_quota: data.used_quota ?? 0,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      .select()
      .single();

    if (error || !result) {
      throw new Error(`Failed to upsert token quota: ${error?.message ?? 'Unknown error'}`);
    }
    return result as TokenQuota;
  }

  /**
   * Increment used quota.
   */
  async incrementUsedQuota(userId: string, tokensUsed: number): Promise<TokenQuota | null> {
    // First get current quota
    const current = await this.getByUserId(userId);
    if (!current) {
      return null;
    }

    const newUsedQuota = current.used_quota + tokensUsed;

    const { data, error } = await this.supabase
      .from(this.tableName)
      .update({
        used_quota: newUsedQuota,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !data) {
      return null;
    }
    return data as TokenQuota;
  }

  /**
   * Reset quota for a new billing period.
   */
  async resetQuota(userId: string, newResetAt: string): Promise<TokenQuota | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .update({
        used_quota: 0,
        reset_at: newResetAt,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !data) {
      return null;
    }
    return data as TokenQuota;
  }

  /**
   * Update monthly quota (for plan changes).
   */
  async updateMonthlyQuota(userId: string, monthlyQuota: number): Promise<TokenQuota | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .update({
        monthly_quota: monthlyQuota,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !data) {
      return null;
    }
    return data as TokenQuota;
  }

  /**
   * Delete quota record.
   */
  async delete(userId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from(this.tableName)
      .delete()
      .eq('user_id', userId);

    return !error;
  }
}
