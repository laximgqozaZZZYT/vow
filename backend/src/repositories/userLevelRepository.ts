/**
 * User Level Repository
 *
 * Database operations for user_levels, user_expertise, and user_level_history tables.
 *
 * Requirements: 1.1, 1.2, 1.3, 4.1, 5.1, 7.1
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// =============================================================================
// Types
// =============================================================================

/**
 * Level tier type
 * beginner: 0-49, intermediate: 50-99, advanced: 100-149, expert: 150-199
 */
export type LevelTier = 'beginner' | 'intermediate' | 'advanced' | 'expert';

/**
 * User level record from database
 */
export interface UserLevelRecord {
  id: string;
  user_id: string;
  overall_level: number;
  overall_tier: LevelTier;
  habit_continuity_power: number;
  resilience_score: number;
  total_experience_points: number;
  last_calculated_at: string;
  created_at: string;
  updated_at: string;
}

/**
 * User expertise record from database
 */
export interface UserExpertiseRecord {
  id: string;
  user_id: string;
  domain_code: string;
  domain_name: string;
  expertise_level: number;
  expertise_tier: LevelTier;
  experience_points: number;
  habit_count: number;
  task_count: number;
  last_activity_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * User level history record from database
 */
export interface UserLevelHistoryRecord {
  id: string;
  user_id: string;
  change_type: 'overall' | 'expertise' | 'continuity' | 'resilience';
  domain_code: string | null;
  old_level: number | null;
  new_level: number;
  change_reason: string;
  metrics_snapshot: MetricsSnapshot | null;
  created_at: string;
}

/**
 * Metrics snapshot for history records
 */
export interface MetricsSnapshot {
  overallLevel?: number;
  habitContinuityPower?: number;
  resilienceScore?: number;
  topExpertiseAvg?: number;
  domainLevels?: Record<string, number>;
}

/**
 * User level history filters
 */
export interface LevelHistoryFilters {
  dateRange?: { start: Date; end: Date };
  changeType?: 'all' | 'overall' | 'expertise' | 'continuity' | 'resilience';
  limit?: number;
}

// =============================================================================
// UserLevelRepository Class
// =============================================================================

/**
 * Repository for user level database operations.
 *
 * This repository encapsulates all database operations for the user_levels table,
 * providing methods for querying and updating user level data.
 */
export class UserLevelRepository {
  protected readonly supabase: SupabaseClient;
  protected readonly tableName = 'user_levels';

  /**
   * Initialize the UserLevelRepository.
   *
   * @param supabase - The Supabase client instance.
   */
  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Get user level by user ID.
   *
   * @param userId - The user ID.
   * @returns The user level record if found, null otherwise.
   */
  async getByUserId(userId: string): Promise<UserLevelRecord | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return null;
    }
    return data as UserLevelRecord;
  }

  /**
   * Create or update user level record.
   *
   * @param userId - The user ID.
   * @param data - The user level data to upsert.
   * @returns The upserted user level record.
   */
  async upsert(
    userId: string,
    data: Partial<Omit<UserLevelRecord, 'id' | 'user_id' | 'created_at'>>
  ): Promise<UserLevelRecord> {
    const { data: result, error } = await this.supabase
      .from(this.tableName)
      .upsert(
        {
          user_id: userId,
          ...data,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      .select()
      .single();

    if (error || !result) {
      throw new Error(`Failed to upsert user level: ${error?.message ?? 'Unknown error'}`);
    }
    return result as UserLevelRecord;
  }

  /**
   * Update user level metrics.
   *
   * @param userId - The user ID.
   * @param metrics - The metrics to update.
   * @returns The updated user level record.
   */
  async updateMetrics(
    userId: string,
    metrics: {
      overallLevel?: number;
      overallTier?: LevelTier;
      habitContinuityPower?: number;
      resilienceScore?: number;
      totalExperiencePoints?: number;
    }
  ): Promise<UserLevelRecord | null> {
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      last_calculated_at: new Date().toISOString(),
    };

    if (metrics.overallLevel !== undefined) {
      updateData['overall_level'] = metrics.overallLevel;
    }
    if (metrics.overallTier !== undefined) {
      updateData['overall_tier'] = metrics.overallTier;
    }
    if (metrics.habitContinuityPower !== undefined) {
      updateData['habit_continuity_power'] = metrics.habitContinuityPower;
    }
    if (metrics.resilienceScore !== undefined) {
      updateData['resilience_score'] = metrics.resilienceScore;
    }
    if (metrics.totalExperiencePoints !== undefined) {
      updateData['total_experience_points'] = metrics.totalExperiencePoints;
    }

    const { data, error } = await this.supabase
      .from(this.tableName)
      .update(updateData)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !data) {
      return null;
    }
    return data as UserLevelRecord;
  }
}

// =============================================================================
// UserExpertiseRepository Class
// =============================================================================

/**
 * Repository for user expertise database operations.
 *
 * This repository encapsulates all database operations for the user_expertise table,
 * providing methods for querying and updating user expertise data.
 */
export class UserExpertiseRepository {
  protected readonly supabase: SupabaseClient;
  protected readonly tableName = 'user_expertise';

  /**
   * Initialize the UserExpertiseRepository.
   *
   * @param supabase - The Supabase client instance.
   */
  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Get all expertise records for a user.
   *
   * @param userId - The user ID.
   * @param sortByLevel - Whether to sort by expertise level descending.
   * @returns Array of user expertise records.
   */
  async getByUserId(userId: string, sortByLevel = true): Promise<UserExpertiseRecord[]> {
    let query = this.supabase
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId);

    if (sortByLevel) {
      query = query.order('expertise_level', { ascending: false });
    }

    const { data, error } = await query;

    if (error || !data) {
      return [];
    }
    return data as UserExpertiseRecord[];
  }

  /**
   * Get top N expertise records for a user.
   *
   * @param userId - The user ID.
   * @param limit - Maximum number of records to return.
   * @returns Array of top user expertise records.
   */
  async getTopExpertise(userId: string, limit = 5): Promise<UserExpertiseRecord[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .order('expertise_level', { ascending: false })
      .limit(limit);

    if (error || !data) {
      return [];
    }
    return data as UserExpertiseRecord[];
  }

  /**
   * Get expertise for a specific domain.
   *
   * @param userId - The user ID.
   * @param domainCode - The domain code.
   * @returns The user expertise record if found, null otherwise.
   */
  async getByDomain(userId: string, domainCode: string): Promise<UserExpertiseRecord | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .eq('domain_code', domainCode)
      .single();

    if (error || !data) {
      return null;
    }
    return data as UserExpertiseRecord;
  }

  /**
   * Create or update expertise record.
   *
   * @param userId - The user ID.
   * @param domainCode - The domain code.
   * @param data - The expertise data to upsert.
   * @returns The upserted expertise record.
   */
  async upsert(
    userId: string,
    domainCode: string,
    data: Partial<Omit<UserExpertiseRecord, 'id' | 'user_id' | 'domain_code' | 'created_at'>>
  ): Promise<UserExpertiseRecord> {
    const { data: result, error } = await this.supabase
      .from(this.tableName)
      .upsert(
        {
          user_id: userId,
          domain_code: domainCode,
          ...data,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,domain_code' }
      )
      .select()
      .single();

    if (error || !result) {
      throw new Error(`Failed to upsert user expertise: ${error?.message ?? 'Unknown error'}`);
    }
    return result as UserExpertiseRecord;
  }

  /**
   * Get expertise records with activity in the last N days.
   *
   * @param userId - The user ID.
   * @param days - Number of days to look back.
   * @returns Array of expertise records with recent activity.
   */
  async getActiveExpertise(userId: string, days = 14): Promise<UserExpertiseRecord[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .gte('last_activity_at', cutoffDate.toISOString());

    if (error || !data) {
      return [];
    }
    return data as UserExpertiseRecord[];
  }

  /**
   * Get expertise records that need decay check.
   *
   * @param userId - The user ID.
   * @param gracePeriodDays - Grace period in days before decay starts.
   * @returns Array of expertise records that may need decay.
   */
  async getExpertiseForDecay(userId: string, gracePeriodDays = 14): Promise<UserExpertiseRecord[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - gracePeriodDays);

    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .gt('expertise_level', 0)
      .or(`last_activity_at.is.null,last_activity_at.lt.${cutoffDate.toISOString()}`);

    if (error || !data) {
      return [];
    }
    return data as UserExpertiseRecord[];
  }
}

// =============================================================================
// UserLevelHistoryRepository Class
// =============================================================================

/**
 * Repository for user level history database operations.
 *
 * This repository encapsulates all database operations for the user_level_history table,
 * providing methods for recording and querying level change history.
 */
export class UserLevelHistoryRepository {
  protected readonly supabase: SupabaseClient;
  protected readonly tableName = 'user_level_history';

  /**
   * Initialize the UserLevelHistoryRepository.
   *
   * @param supabase - The Supabase client instance.
   */
  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Get level history for a user with optional filters.
   *
   * @param userId - The user ID.
   * @param filters - Optional filters for the query.
   * @returns Array of level history records.
   */
  async getByUserId(
    userId: string,
    filters?: LevelHistoryFilters
  ): Promise<UserLevelHistoryRecord[]> {
    let query = this.supabase
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (filters?.dateRange) {
      query = query
        .gte('created_at', filters.dateRange.start.toISOString())
        .lte('created_at', filters.dateRange.end.toISOString());
    }

    if (filters?.changeType && filters.changeType !== 'all') {
      query = query.eq('change_type', filters.changeType);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error || !data) {
      return [];
    }
    return data as UserLevelHistoryRecord[];
  }

  /**
   * Record a level change in history.
   *
   * @param record - The history record to create.
   * @returns The created history record.
   */
  async recordChange(
    record: Omit<UserLevelHistoryRecord, 'id' | 'created_at'>
  ): Promise<UserLevelHistoryRecord> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .insert(record)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to record level change: ${error?.message ?? 'Unknown error'}`);
    }
    return data as UserLevelHistoryRecord;
  }

  /**
   * Get the most recent level change for a user.
   *
   * @param userId - The user ID.
   * @param changeType - Optional change type filter.
   * @returns The most recent history record if found, null otherwise.
   */
  async getLatestChange(
    userId: string,
    changeType?: 'overall' | 'expertise' | 'continuity' | 'resilience'
  ): Promise<UserLevelHistoryRecord | null> {
    let query = this.supabase
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (changeType) {
      query = query.eq('change_type', changeType);
    }

    const { data, error } = await query;

    if (error || !data || data.length === 0) {
      return null;
    }
    return data[0] as UserLevelHistoryRecord;
  }

  /**
   * Get history for a specific domain.
   *
   * @param userId - The user ID.
   * @param domainCode - The domain code.
   * @param limit - Maximum number of records to return.
   * @returns Array of history records for the domain.
   */
  async getByDomain(
    userId: string,
    domainCode: string,
    limit = 50
  ): Promise<UserLevelHistoryRecord[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .eq('domain_code', domainCode)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) {
      return [];
    }
    return data as UserLevelHistoryRecord[];
  }
}
