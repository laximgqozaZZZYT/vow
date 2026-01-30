/**
 * Experience Log Repository
 *
 * Database operations for experience_log table using the repository pattern.
 * Provides methods for querying experience point awards and checking for duplicates.
 *
 * Requirements: XP Recovery 2.1, 2.2
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// =============================================================================
// Types
// =============================================================================

/**
 * Experience log record from database
 */
export interface ExperienceLogRecord {
  id: string;
  user_id: string;
  habit_id: string | null;
  activity_id: string | null;
  domain_code: string;
  points_awarded: number;
  habit_level: number | null;
  quality_multiplier: number;
  frequency_bonus: number;
  completion_rate?: number | null;
  applied_multiplier?: number | null;
  multiplier_tier?: string | null;
  multiplier_reason?: string | null;
  created_at: string;
}

/**
 * Data for creating a new experience log entry
 */
export interface CreateExperienceLogData {
  user_id: string;
  habit_id?: string | null;
  activity_id?: string | null;
  domain_code: string;
  points_awarded: number;
  habit_level?: number | null;
  quality_multiplier: number;
  frequency_bonus: number;
  completion_rate?: number | null;
  applied_multiplier?: number | null;
  multiplier_tier?: string | null;
  multiplier_reason?: string | null;
}

// =============================================================================
// ExperienceLogRepository Class
// =============================================================================

/**
 * Repository for experience log database operations.
 *
 * This repository encapsulates all database operations for the experience_log table,
 * providing methods for querying experience point awards and checking for duplicate
 * activity processing to prevent double XP awards.
 */
export class ExperienceLogRepository {
  protected readonly supabase: SupabaseClient;
  protected readonly tableName = 'experience_log';

  /**
   * Initialize the ExperienceLogRepository.
   *
   * @param supabase - The Supabase client instance.
   */
  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Get activity IDs that have already been processed for experience points.
   *
   * This method checks which activities from the provided list have already
   * received experience points, enabling duplicate prevention during XP recovery.
   * Uses the activity_id index for efficient lookups.
   *
   * @param userId - The unique identifier of the user.
   * @param activityIds - Array of activity IDs to check for existing XP awards.
   * @returns Array of activity IDs that have already been processed (have XP records).
   *
   * Requirements:
   * - 2.1: experience_logテーブルで同一activity_idの記録が存在するかチェックする
   * - 2.2: 同一activity_idの記録が既に存在する場合、経験値付与をスキップする
   */
  async getProcessedActivityIds(
    userId: string,
    activityIds: string[]
  ): Promise<string[]> {
    // Return empty array if no activity IDs provided
    if (!activityIds || activityIds.length === 0) {
      return [];
    }

    // Query experience_log for existing records with matching activity_ids
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('activity_id')
      .eq('user_id', userId)
      .in('activity_id', activityIds)
      .not('activity_id', 'is', null);

    if (error || !data) {
      return [];
    }

    // Extract unique activity IDs from results
    const processedIds = new Set<string>();
    for (const record of data) {
      if (record.activity_id) {
        processedIds.add(record.activity_id as string);
      }
    }

    return Array.from(processedIds);
  }

  /**
   * Get experience logs for a user.
   *
   * @param userId - The unique identifier of the user.
   * @param limit - Maximum number of records to return. Defaults to 100.
   * @returns Array of experience log records, ordered by created_at descending.
   */
  async getByUserId(userId: string, limit = 100): Promise<ExperienceLogRecord[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) {
      return [];
    }
    return data as ExperienceLogRecord[];
  }

  /**
   * Get experience logs for a specific domain.
   *
   * @param userId - The unique identifier of the user.
   * @param domainCode - The domain code to filter by.
   * @param limit - Maximum number of records to return. Defaults to 100.
   * @returns Array of experience log records for the domain.
   */
  async getByDomain(
    userId: string,
    domainCode: string,
    limit = 100
  ): Promise<ExperienceLogRecord[]> {
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
    return data as ExperienceLogRecord[];
  }

  /**
   * Get total experience points for a user.
   *
   * @param userId - The unique identifier of the user.
   * @returns Total experience points awarded to the user.
   */
  async getTotalPoints(userId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('points_awarded')
      .eq('user_id', userId);

    if (error || !data) {
      return 0;
    }

    return data.reduce((sum, record) => sum + (record.points_awarded ?? 0), 0);
  }

  /**
   * Get total experience points for a user in a specific domain.
   *
   * @param userId - The unique identifier of the user.
   * @param domainCode - The domain code to filter by.
   * @returns Total experience points awarded in the domain.
   */
  async getTotalPointsByDomain(userId: string, domainCode: string): Promise<number> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('points_awarded')
      .eq('user_id', userId)
      .eq('domain_code', domainCode);

    if (error || !data) {
      return 0;
    }

    return data.reduce((sum, record) => sum + (record.points_awarded ?? 0), 0);
  }

  /**
   * Create a new experience log entry.
   *
   * @param data - The experience log data to create.
   * @returns The created experience log record.
   * @throws Error if the creation fails.
   */
  async createLog(data: CreateExperienceLogData): Promise<ExperienceLogRecord> {
    const { data: result, error } = await this.supabase
      .from(this.tableName)
      .insert(data)
      .select()
      .single();

    if (error || !result) {
      throw new Error(`Failed to create experience log: ${error?.message ?? 'Unknown error'}`);
    }
    return result as ExperienceLogRecord;
  }

  /**
   * Create multiple experience log entries in a batch.
   *
   * @param logs - Array of experience log data to create.
   * @returns Array of created experience log records.
   * @throws Error if the creation fails.
   */
  async createLogs(logs: CreateExperienceLogData[]): Promise<ExperienceLogRecord[]> {
    if (logs.length === 0) {
      return [];
    }

    const { data: result, error } = await this.supabase
      .from(this.tableName)
      .insert(logs)
      .select();

    if (error || !result) {
      throw new Error(`Failed to create experience logs: ${error?.message ?? 'Unknown error'}`);
    }
    return result as ExperienceLogRecord[];
  }

  /**
   * Check if an activity has already been processed for experience points.
   *
   * @param userId - The unique identifier of the user.
   * @param activityId - The activity ID to check.
   * @returns True if the activity has already been processed, false otherwise.
   */
  async isActivityProcessed(userId: string, activityId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('id')
      .eq('user_id', userId)
      .eq('activity_id', activityId)
      .limit(1);

    if (error) {
      return false;
    }
    return Array.isArray(data) && data.length > 0;
  }

  /**
   * Count experience log entries for a user.
   *
   * @param userId - The unique identifier of the user.
   * @returns The count of experience log entries.
   */
  async countByUserId(userId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from(this.tableName)
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (error || count === null) {
      return 0;
    }
    return count;
  }
}
