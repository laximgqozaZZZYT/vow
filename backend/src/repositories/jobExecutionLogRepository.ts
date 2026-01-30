/**
 * Job Execution Log Repository
 *
 * Database operations for job_execution_log table using the repository pattern.
 * Provides methods for recording job execution lifecycle (start, complete, fail).
 *
 * Requirements: XP Recovery 7.1, 7.2, 7.3, 7.4
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// =============================================================================
// Types
// =============================================================================

/**
 * Valid job names for the job_execution_log table
 */
export type JobName =
  | 'level_up_detection'
  | 'level_down_detection'
  | 'monthly_quota_reset'
  | 'combined_level_detection'
  | 'xp_recovery'
  | 'xp_recovery_single';

/**
 * Job execution status
 */
export type JobStatus = 'running' | 'completed' | 'failed';

/**
 * Job execution log record from database
 */
export interface JobExecutionLogRecord {
  id: string;
  job_name: JobName;
  started_at: string;
  completed_at: string | null;
  status: JobStatus;
  habits_processed: number;
  suggestions_created: number;
  quotas_reset: number;
  errors: unknown[];
  metadata: Record<string, unknown>;
  created_at: string;
}

/**
 * Result data for completing a job
 *
 * Requirements:
 * - 7.3: 処理Activity数、付与XP合計を記録する
 */
export interface JobResult {
  activitiesProcessed: number;
  xpAwarded: number;
  skipped: number;
  errors: unknown[];
}

// =============================================================================
// JobExecutionLogRepository Class
// =============================================================================

/**
 * Repository for job execution log database operations.
 *
 * This repository encapsulates all database operations for the job_execution_log table,
 * providing methods for recording job execution lifecycle including start, completion,
 * and failure states. Used primarily for XP recovery job tracking.
 *
 * Requirements:
 * - 7.1: 再計算処理が開始された時にjob_execution_logテーブルに開始記録を追加する
 * - 7.2: 再計算処理が完了した時にjob_execution_logテーブルに完了記録を追加する
 * - 7.3: 処理対象ユーザーID、処理Activity数、付与XP合計、処理時間を記録する
 * - 7.4: 再計算処理が失敗した時にjob_execution_logにエラー詳細を記録する
 */
export class JobExecutionLogRepository {
  protected readonly supabase: SupabaseClient;
  protected readonly tableName = 'job_execution_log';

  /**
   * Initialize the JobExecutionLogRepository.
   *
   * @param supabase - The Supabase client instance.
   */
  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Record the start of a job execution.
   *
   * Creates a new job execution log record with status 'running'.
   * The returned job ID should be used for subsequent completeJob or failJob calls.
   *
   * @param jobName - The name of the job being executed.
   * @param metadata - Optional metadata to store with the job record.
   * @returns The unique identifier of the created job log record.
   * @throws Error if the record creation fails.
   *
   * Requirements:
   * - 7.1: 再計算処理が開始された時にjob_execution_logテーブルに開始記録を追加する
   * - 7.3: 処理対象ユーザーIDをmetadataに記録する
   */
  async startJob(jobName: JobName, metadata?: Record<string, unknown>): Promise<string> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .insert({
        job_name: jobName,
        started_at: new Date().toISOString(),
        status: 'running' as JobStatus,
        habits_processed: 0,
        suggestions_created: 0,
        quotas_reset: 0,
        errors: [],
        metadata: metadata ?? {},
      })
      .select('id')
      .single();

    if (error || !data) {
      throw new Error(`Failed to start job ${jobName}: ${error?.message ?? 'Unknown error'}`);
    }

    return data.id as string;
  }

  /**
   * Record the successful completion of a job execution.
   *
   * Updates the job execution log record with completion status and results.
   * The metadata is merged with the original metadata, adding processing statistics.
   *
   * @param jobId - The unique identifier of the job log record.
   * @param result - The processing result containing statistics.
   * @throws Error if the update fails.
   *
   * Requirements:
   * - 7.2: 再計算処理が完了した時にjob_execution_logテーブルに完了記録を追加する
   * - 7.3: 処理Activity数、付与XP合計、処理時間を記録する
   */
  async completeJob(jobId: string, result: JobResult): Promise<void> {
    // First, get the existing record to merge metadata
    const { data: existing, error: fetchError } = await this.supabase
      .from(this.tableName)
      .select('metadata, started_at')
      .eq('id', jobId)
      .single();

    if (fetchError || !existing) {
      throw new Error(`Failed to fetch job ${jobId}: ${fetchError?.message ?? 'Job not found'}`);
    }

    const completedAt = new Date();
    const startedAt = new Date(existing.started_at as string);
    const durationMs = completedAt.getTime() - startedAt.getTime();

    // Merge existing metadata with result data
    const updatedMetadata = {
      ...(existing.metadata as Record<string, unknown>),
      activitiesProcessed: result.activitiesProcessed,
      xpAwarded: result.xpAwarded,
      skipped: result.skipped,
      durationMs,
    };

    const { error } = await this.supabase
      .from(this.tableName)
      .update({
        completed_at: completedAt.toISOString(),
        status: 'completed' as JobStatus,
        habits_processed: result.activitiesProcessed, // Reuse habits_processed for activities
        errors: result.errors,
        metadata: updatedMetadata,
      })
      .eq('id', jobId);

    if (error) {
      throw new Error(`Failed to complete job ${jobId}: ${error.message}`);
    }
  }

  /**
   * Record the failure of a job execution.
   *
   * Updates the job execution log record with failed status and error details.
   *
   * @param jobId - The unique identifier of the job log record.
   * @param errors - Array of error information to record.
   * @throws Error if the update fails.
   *
   * Requirements:
   * - 7.4: 再計算処理が失敗した時にjob_execution_logにエラー詳細を記録する
   */
  async failJob(jobId: string, errors: unknown[]): Promise<void> {
    // First, get the existing record to calculate duration
    const { data: existing, error: fetchError } = await this.supabase
      .from(this.tableName)
      .select('metadata, started_at')
      .eq('id', jobId)
      .single();

    if (fetchError || !existing) {
      throw new Error(`Failed to fetch job ${jobId}: ${fetchError?.message ?? 'Job not found'}`);
    }

    const completedAt = new Date();
    const startedAt = new Date(existing.started_at as string);
    const durationMs = completedAt.getTime() - startedAt.getTime();

    // Merge existing metadata with failure data
    const updatedMetadata = {
      ...(existing.metadata as Record<string, unknown>),
      durationMs,
      failedAt: completedAt.toISOString(),
    };

    const { error } = await this.supabase
      .from(this.tableName)
      .update({
        completed_at: completedAt.toISOString(),
        status: 'failed' as JobStatus,
        errors: errors,
        metadata: updatedMetadata,
      })
      .eq('id', jobId);

    if (error) {
      throw new Error(`Failed to record job failure ${jobId}: ${error.message}`);
    }
  }

  /**
   * Get a job execution log record by ID.
   *
   * @param jobId - The unique identifier of the job log record.
   * @returns The job execution log record if found, null otherwise.
   */
  async getById(jobId: string): Promise<JobExecutionLogRecord | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('id', jobId)
      .single();

    if (error || !data) {
      return null;
    }
    return data as JobExecutionLogRecord;
  }

  /**
   * Get recent job execution logs by job name.
   *
   * @param jobName - The name of the job to filter by.
   * @param limit - Maximum number of records to return. Defaults to 10.
   * @returns Array of job execution log records, ordered by started_at descending.
   */
  async getByJobName(jobName: JobName, limit = 10): Promise<JobExecutionLogRecord[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('job_name', jobName)
      .order('started_at', { ascending: false })
      .limit(limit);

    if (error || !data) {
      return [];
    }
    return data as JobExecutionLogRecord[];
  }

  /**
   * Get the most recent job execution for a specific job name.
   *
   * @param jobName - The name of the job to filter by.
   * @returns The most recent job execution log record if found, null otherwise.
   */
  async getLatestByJobName(jobName: JobName): Promise<JobExecutionLogRecord | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('job_name', jobName)
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }
    return data as JobExecutionLogRecord;
  }

  /**
   * Get job execution logs for a specific user (from metadata).
   *
   * @param userId - The user ID to filter by (stored in metadata.userId).
   * @param limit - Maximum number of records to return. Defaults to 10.
   * @returns Array of job execution log records for the user.
   */
  async getByUserId(userId: string, limit = 10): Promise<JobExecutionLogRecord[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .contains('metadata', { userId })
      .order('started_at', { ascending: false })
      .limit(limit);

    if (error || !data) {
      return [];
    }
    return data as JobExecutionLogRecord[];
  }

  /**
   * Check if there is a running job for a specific job name.
   *
   * @param jobName - The name of the job to check.
   * @returns True if there is a running job, false otherwise.
   */
  async hasRunningJob(jobName: JobName): Promise<boolean> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('id')
      .eq('job_name', jobName)
      .eq('status', 'running')
      .limit(1);

    if (error) {
      return false;
    }
    return Array.isArray(data) && data.length > 0;
  }

  /**
   * Get all running jobs.
   *
   * @returns Array of running job execution log records.
   */
  async getRunningJobs(): Promise<JobExecutionLogRecord[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('status', 'running')
      .order('started_at', { ascending: false });

    if (error || !data) {
      return [];
    }
    return data as JobExecutionLogRecord[];
  }
}
