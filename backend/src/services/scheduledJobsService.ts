/**
 * Scheduled Jobs Service
 *
 * Handles scheduled job execution for level management and quota reset.
 * Jobs run daily at 2 AM JST (cron: 0 2 * * *).
 *
 * Requirements:
 * - 17.1: Daily scheduled job for level detection
 * - 17.2: Level-up detection (completion_rate >= 0.9, 30 days)
 * - 17.3: Level-down detection (completion_rate < 0.5, 14 days)
 * - 17.4: Store candidates in level_suggestions table
 * - 17.6: Rate limits (max 100 habits, 1-second delay)
 * - 17.7: Log executions to job_execution_log
 * - 7.5: Monthly quota reset
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getLogger } from '../utils/logger.js';
import { LevelManagerService } from './levelManagerService.js';
import { UsageQuotaService } from './usageQuotaService.js';
import { BabyStepGeneratorService } from './babyStepGeneratorService.js';
import type { LevelSuggestion, LevelEstimate, THLIVariable } from '../types/thli.js';

const logger = getLogger('scheduledJobsService');

// =============================================================================
// Constants - Requirement 17.6: Rate Limits
// =============================================================================

/** Maximum habits to process per job run */
const MAX_HABITS_PER_RUN = 100;

/** Delay between assessments in milliseconds */
const DELAY_BETWEEN_ASSESSMENTS_MS = 1000;

// =============================================================================
// Types
// =============================================================================

/** Job names for logging */
type JobName =
  | 'level_up_detection'
  | 'level_down_detection'
  | 'monthly_quota_reset'
  | 'combined_level_detection';


/** Job execution status */
type JobStatus = 'running' | 'completed' | 'failed';

/** Job execution log entry */
interface JobExecutionLog {
  id: string;
  jobName: JobName;
  startedAt: Date;
  completedAt: Date | null;
  status: JobStatus;
  habitsProcessed: number;
  suggestionsCreated: number;
  quotasReset: number;
  errors: string[];
  metadata: Record<string, unknown>;
}

/** Job execution result */
interface JobExecutionResult {
  success: boolean;
  jobName: JobName;
  habitsProcessed: number;
  suggestionsCreated: number;
  quotasReset: number;
  errors: string[];
  duration: number;
}

/** Database row type for job_execution_log */
interface JobExecutionLogRow {
  id: string;
  job_name: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  habits_processed: number;
  suggestions_created: number;
  quotas_reset: number;
  errors: string[];
  metadata: Record<string, unknown>;
  created_at: string;
}

// =============================================================================
// ScheduledJobsService Class
// =============================================================================

/**
 * Scheduled Jobs Service
 *
 * Manages execution of scheduled jobs for level management.
 *
 * Property 39: Level Suggestion Creation on Detection
 * For any habit detected as a level-up or level-down candidate,
 * a record must be created in level_suggestions table.
 *
 * Property 40: Scheduled Job Execution Logging
 * For any scheduled job execution, a record must be created
 * in job_execution_log table.
 */
export class ScheduledJobsService {
  private readonly supabase: SupabaseClient;
  private readonly levelManager: LevelManagerService;
  private readonly quotaService: UsageQuotaService;
  private readonly babyStepGenerator: BabyStepGeneratorService;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.levelManager = new LevelManagerService(supabase);
    this.quotaService = new UsageQuotaService(supabase);
    this.babyStepGenerator = new BabyStepGeneratorService(supabase);
  }


  // ===========================================================================
  // 15.1: Level-Up Detection Job
  // Requirements: 5.7, 17.1, 17.2, 17.4, 17.6, 17.7
  // ===========================================================================

  /**
   * Run the level-up detection job.
   *
   * - Runs daily at 2 AM JST
   * - Calls LevelManagerService.detectLevelUpCandidates()
   * - Creates level_suggestions records
   * - Logs execution to job_execution_log
   * - Respects rate limits (max 100 habits, 1-second delay)
   *
   * @returns Job execution result
   */
  async runLevelUpDetectionJob(): Promise<JobExecutionResult> {
    const jobName: JobName = 'level_up_detection';
    const startTime = Date.now();
    const errors: string[] = [];
    let habitsProcessed = 0;
    let suggestionsCreated = 0;

    // Start job execution log
    const logId = await this.startJobLog(jobName);

    logger.info('Starting level-up detection job', { logId });

    try {
      // Get all users with active habits
      const users = await this.getActiveUsers();

      // Process each user (with rate limiting)
      for (const userId of users) {
        if (habitsProcessed >= MAX_HABITS_PER_RUN) {
          logger.info('Rate limit reached, stopping job', {
            habitsProcessed,
            maxHabits: MAX_HABITS_PER_RUN,
          });
          break;
        }

        try {
          // Detect level-up candidates for this user
          const candidates = await this.levelManager.detectLevelUpCandidates(userId);

          for (const candidate of candidates) {
            if (habitsProcessed >= MAX_HABITS_PER_RUN) break;

            // Store suggestion in database
            await this.levelManager.storeLevelSuggestion(candidate, userId);
            suggestionsCreated++;
            habitsProcessed++;

            // Rate limiting delay
            await this.delay(DELAY_BETWEEN_ASSESSMENTS_MS);
          }
        } catch (error) {
          const errorMsg = `Failed to process user ${userId}: ${(error as Error).message}`;
          errors.push(errorMsg);
          logger.error('Error processing user for level-up', error as Error, { userId });
        }
      }

      // Complete job log
      await this.completeJobLog(logId, 'completed', habitsProcessed, suggestionsCreated, 0, errors);

      const duration = Date.now() - startTime;
      logger.info('Level-up detection job completed', {
        logId,
        habitsProcessed,
        suggestionsCreated,
        duration,
        errors: errors.length,
      });

      return {
        success: errors.length === 0,
        jobName,
        habitsProcessed,
        suggestionsCreated,
        quotasReset: 0,
        errors,
        duration,
      };
    } catch (error) {
      const errorMsg = `Job failed: ${(error as Error).message}`;
      errors.push(errorMsg);
      await this.completeJobLog(logId, 'failed', habitsProcessed, suggestionsCreated, 0, errors);
      logger.error('Level-up detection job failed', error as Error, { logId });

      return {
        success: false,
        jobName,
        habitsProcessed,
        suggestionsCreated,
        quotasReset: 0,
        errors,
        duration: Date.now() - startTime,
      };
    }
  }


  // ===========================================================================
  // 15.2: Level-Down Detection Job
  // Requirements: 17.1, 17.3, 17.4, 17.6, 17.7
  // ===========================================================================

  /**
   * Run the level-down detection job.
   *
   * - Runs daily at 2 AM JST
   * - Calls LevelManagerService.detectLevelDownCandidates()
   * - Generates baby step plans for each candidate
   * - Creates level_suggestions records
   * - Logs execution to job_execution_log
   *
   * @returns Job execution result
   */
  async runLevelDownDetectionJob(): Promise<JobExecutionResult> {
    const jobName: JobName = 'level_down_detection';
    const startTime = Date.now();
    const errors: string[] = [];
    let habitsProcessed = 0;
    let suggestionsCreated = 0;

    // Start job execution log
    const logId = await this.startJobLog(jobName);

    logger.info('Starting level-down detection job', { logId });

    try {
      // Get all users with active habits
      const users = await this.getActiveUsers();

      // Process each user (with rate limiting)
      for (const userId of users) {
        if (habitsProcessed >= MAX_HABITS_PER_RUN) {
          logger.info('Rate limit reached, stopping job', {
            habitsProcessed,
            maxHabits: MAX_HABITS_PER_RUN,
          });
          break;
        }

        try {
          // Detect level-down candidates for this user
          const candidates = await this.levelManager.detectLevelDownCandidates(userId);

          for (const candidate of candidates) {
            if (habitsProcessed >= MAX_HABITS_PER_RUN) break;

            try {
              // Generate baby step plans for the candidate
              const mockAssessment = this.createMockAssessment(candidate.currentLevel);
              const babyStepPlans = await this.babyStepGenerator.generateBabySteps(
                candidate.habitId,
                mockAssessment
              );

              // Update candidate with baby step plans
              const enrichedCandidate: LevelSuggestion = {
                ...candidate,
                proposedChanges: babyStepPlans.lv50, // Default to Lv.50 plan
              };

              // Store suggestion in database
              await this.levelManager.storeLevelSuggestion(enrichedCandidate, userId);
              suggestionsCreated++;
            } catch (babyStepError) {
              // If baby step generation fails, store suggestion without plans
              await this.levelManager.storeLevelSuggestion(candidate, userId);
              suggestionsCreated++;
              errors.push(`Baby step generation failed for habit ${candidate.habitId}: ${(babyStepError as Error).message}`);
            }

            habitsProcessed++;

            // Rate limiting delay
            await this.delay(DELAY_BETWEEN_ASSESSMENTS_MS);
          }
        } catch (error) {
          const errorMsg = `Failed to process user ${userId}: ${(error as Error).message}`;
          errors.push(errorMsg);
          logger.error('Error processing user for level-down', error as Error, { userId });
        }
      }

      // Complete job log
      await this.completeJobLog(logId, 'completed', habitsProcessed, suggestionsCreated, 0, errors);

      const duration = Date.now() - startTime;
      logger.info('Level-down detection job completed', {
        logId,
        habitsProcessed,
        suggestionsCreated,
        duration,
        errors: errors.length,
      });

      return {
        success: errors.length === 0,
        jobName,
        habitsProcessed,
        suggestionsCreated,
        quotasReset: 0,
        errors,
        duration,
      };
    } catch (error) {
      const errorMsg = `Job failed: ${(error as Error).message}`;
      errors.push(errorMsg);
      await this.completeJobLog(logId, 'failed', habitsProcessed, suggestionsCreated, 0, errors);
      logger.error('Level-down detection job failed', error as Error, { logId });

      return {
        success: false,
        jobName,
        habitsProcessed,
        suggestionsCreated,
        quotasReset: 0,
        errors,
        duration: Date.now() - startTime,
      };
    }
  }


  // ===========================================================================
  // 15.3: Monthly Quota Reset Job
  // Requirement: 7.5
  // ===========================================================================

  /**
   * Run the monthly quota reset job.
   *
   * - Runs on first day of each month
   * - Calls UsageQuotaService.resetMonthlyQuotas()
   * - Logs execution to job_execution_log
   *
   * @returns Job execution result
   */
  async runMonthlyQuotaResetJob(): Promise<JobExecutionResult> {
    const jobName: JobName = 'monthly_quota_reset';
    const startTime = Date.now();
    const errors: string[] = [];
    let quotasReset = 0;

    // Start job execution log
    const logId = await this.startJobLog(jobName);

    logger.info('Starting monthly quota reset job', { logId });

    try {
      // Reset all expired quotas
      quotasReset = await this.quotaService.resetMonthlyQuotas();

      // Complete job log
      await this.completeJobLog(logId, 'completed', 0, 0, quotasReset, errors);

      const duration = Date.now() - startTime;
      logger.info('Monthly quota reset job completed', {
        logId,
        quotasReset,
        duration,
      });

      return {
        success: true,
        jobName,
        habitsProcessed: 0,
        suggestionsCreated: 0,
        quotasReset,
        errors,
        duration,
      };
    } catch (error) {
      const errorMsg = `Job failed: ${(error as Error).message}`;
      errors.push(errorMsg);
      await this.completeJobLog(logId, 'failed', 0, 0, quotasReset, errors);
      logger.error('Monthly quota reset job failed', error as Error, { logId });

      return {
        success: false,
        jobName,
        habitsProcessed: 0,
        suggestionsCreated: 0,
        quotasReset,
        errors,
        duration: Date.now() - startTime,
      };
    }
  }

  // ===========================================================================
  // Combined Level Detection Job (runs both level-up and level-down)
  // ===========================================================================

  /**
   * Run combined level detection job (both level-up and level-down).
   *
   * This is the main job that should be scheduled to run daily at 2 AM JST.
   * It combines both detection jobs to minimize database queries.
   *
   * @returns Job execution result
   */
  async runCombinedLevelDetectionJob(): Promise<JobExecutionResult> {
    const jobName: JobName = 'combined_level_detection';
    const startTime = Date.now();
    const errors: string[] = [];
    let habitsProcessed = 0;
    let suggestionsCreated = 0;

    // Start job execution log
    const logId = await this.startJobLog(jobName);

    logger.info('Starting combined level detection job', { logId });

    try {
      // Get all users with active habits
      const users = await this.getActiveUsers();

      // Process each user
      for (const userId of users) {
        if (habitsProcessed >= MAX_HABITS_PER_RUN) {
          logger.info('Rate limit reached, stopping job', {
            habitsProcessed,
            maxHabits: MAX_HABITS_PER_RUN,
          });
          break;
        }

        try {
          // Detect level-up candidates
          const levelUpCandidates = await this.levelManager.detectLevelUpCandidates(userId);
          for (const candidate of levelUpCandidates) {
            if (habitsProcessed >= MAX_HABITS_PER_RUN) break;
            await this.levelManager.storeLevelSuggestion(candidate, userId);
            suggestionsCreated++;
            habitsProcessed++;
            await this.delay(DELAY_BETWEEN_ASSESSMENTS_MS);
          }

          // Detect level-down candidates
          const levelDownCandidates = await this.levelManager.detectLevelDownCandidates(userId);
          for (const candidate of levelDownCandidates) {
            if (habitsProcessed >= MAX_HABITS_PER_RUN) break;
            
            try {
              const mockAssessment = this.createMockAssessment(candidate.currentLevel);
              const babyStepPlans = await this.babyStepGenerator.generateBabySteps(
                candidate.habitId,
                mockAssessment
              );
              const enrichedCandidate: LevelSuggestion = {
                ...candidate,
                proposedChanges: babyStepPlans.lv50,
              };
              await this.levelManager.storeLevelSuggestion(enrichedCandidate, userId);
            } catch {
              await this.levelManager.storeLevelSuggestion(candidate, userId);
            }
            
            suggestionsCreated++;
            habitsProcessed++;
            await this.delay(DELAY_BETWEEN_ASSESSMENTS_MS);
          }
        } catch (error) {
          errors.push(`Failed to process user ${userId}: ${(error as Error).message}`);
          logger.error('Error processing user', error as Error, { userId });
        }
      }

      await this.completeJobLog(logId, 'completed', habitsProcessed, suggestionsCreated, 0, errors);

      const duration = Date.now() - startTime;
      logger.info('Combined level detection job completed', {
        logId,
        habitsProcessed,
        suggestionsCreated,
        duration,
        errors: errors.length,
      });

      return {
        success: errors.length === 0,
        jobName,
        habitsProcessed,
        suggestionsCreated,
        quotasReset: 0,
        errors,
        duration,
      };
    } catch (error) {
      const errorMsg = `Job failed: ${(error as Error).message}`;
      errors.push(errorMsg);
      await this.completeJobLog(logId, 'failed', habitsProcessed, suggestionsCreated, 0, errors);
      logger.error('Combined level detection job failed', error as Error, { logId });

      return {
        success: false,
        jobName,
        habitsProcessed,
        suggestionsCreated,
        quotasReset: 0,
        errors,
        duration: Date.now() - startTime,
      };
    }
  }


  // ===========================================================================
  // Job Execution Logging - Requirement 17.7
  // ===========================================================================

  /**
   * Start a job execution log entry.
   *
   * @param jobName - Name of the job
   * @returns Log entry ID
   */
  private async startJobLog(jobName: JobName): Promise<string> {
    const { data, error } = await this.supabase
      .from('job_execution_log')
      .insert({
        job_name: jobName,
        started_at: new Date().toISOString(),
        status: 'running',
        habits_processed: 0,
        suggestions_created: 0,
        quotas_reset: 0,
        errors: [],
        metadata: {},
      })
      .select('id')
      .single();

    if (error || !data) {
      logger.error('Failed to start job log', new Error(error?.message ?? 'Unknown error'), { jobName });
      // Return a temporary ID if logging fails
      return `temp_${Date.now()}`;
    }

    return data.id;
  }

  /**
   * Complete a job execution log entry.
   *
   * @param logId - Log entry ID
   * @param status - Final status
   * @param habitsProcessed - Number of habits processed
   * @param suggestionsCreated - Number of suggestions created
   * @param quotasReset - Number of quotas reset
   * @param errors - Array of error messages
   */
  private async completeJobLog(
    logId: string,
    status: JobStatus,
    habitsProcessed: number,
    suggestionsCreated: number,
    quotasReset: number,
    errors: string[]
  ): Promise<void> {
    // Skip if temporary ID
    if (logId.startsWith('temp_')) {
      return;
    }

    const { error } = await this.supabase
      .from('job_execution_log')
      .update({
        completed_at: new Date().toISOString(),
        status,
        habits_processed: habitsProcessed,
        suggestions_created: suggestionsCreated,
        quotas_reset: quotasReset,
        errors,
      })
      .eq('id', logId);

    if (error) {
      logger.error('Failed to complete job log', new Error(error.message), { logId });
    }
  }

  /**
   * Get recent job execution logs.
   *
   * @param limit - Maximum number of logs to return
   * @returns Array of job execution logs
   */
  async getRecentJobLogs(limit: number = 10): Promise<JobExecutionLog[]> {
    const { data, error } = await this.supabase
      .from('job_execution_log')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit);

    if (error || !data) {
      return [];
    }

    return data.map((row: JobExecutionLogRow) => ({
      id: row.id,
      jobName: row.job_name as JobName,
      startedAt: new Date(row.started_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : null,
      status: row.status as JobStatus,
      habitsProcessed: row.habits_processed,
      suggestionsCreated: row.suggestions_created,
      quotasReset: row.quotas_reset,
      errors: row.errors,
      metadata: row.metadata,
    }));
  }


  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  /**
   * Get all users with active habits.
   *
   * @returns Array of user IDs
   */
  private async getActiveUsers(): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('habits')
      .select('owner_id')
      .eq('owner_type', 'user')
      .eq('active', true)
      .not('level', 'is', null);

    if (error || !data) {
      return [];
    }

    // Get unique user IDs
    const userIds = [...new Set(data.map((h: { owner_id: string }) => h.owner_id))];
    return userIds;
  }

  /**
   * Create a mock assessment for baby step generation.
   *
   * @param currentLevel - Current habit level
   * @returns Mock level estimate
   */
  private createMockAssessment(currentLevel: number): LevelEstimate {
    // Create minimal mock variables for baby step generation
    const mockVariables: THLIVariable[] = [
      { id: '⑱', name: 'Frequency', domain: 'temporal', score: 4.1, stoplight: 'yellow', rationale: '', causingFacts: [] },
      { id: '⑬', name: 'Duration', domain: 'temporal', score: 4.1, stoplight: 'yellow', rationale: '', causingFacts: [] },
    ];

    return {
      optimistic: currentLevel - 10,
      expected: { min: currentLevel - 5, max: currentLevel + 5 },
      conservative: currentLevel + 10,
      tier: currentLevel < 50 ? 'beginner' : currentLevel < 100 ? 'intermediate' : currentLevel < 150 ? 'advanced' : 'expert',
      variables: mockVariables,
      ici: 0.8,
      abUsed: 0,
      firewallTriggered: false,
      promptVersion: 'mock-v1.0',
    };
  }

  /**
   * Delay execution for rate limiting.
   *
   * @param ms - Milliseconds to delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/** Singleton instance */
let _scheduledJobsService: ScheduledJobsService | null = null;

/**
 * Get or create the singleton ScheduledJobsService instance.
 *
 * @param supabase - Supabase client instance
 * @returns ScheduledJobsService instance
 */
export function getScheduledJobsService(supabase: SupabaseClient): ScheduledJobsService {
  if (_scheduledJobsService === null) {
    _scheduledJobsService = new ScheduledJobsService(supabase);
  }
  return _scheduledJobsService;
}

/**
 * Create a new ScheduledJobsService instance.
 *
 * @param supabase - Supabase client instance
 * @returns New ScheduledJobsService instance
 */
export function createScheduledJobsService(supabase: SupabaseClient): ScheduledJobsService {
  return new ScheduledJobsService(supabase);
}

/**
 * Reset the singleton instance (useful for testing).
 */
export function resetScheduledJobsService(): void {
  _scheduledJobsService = null;
}
