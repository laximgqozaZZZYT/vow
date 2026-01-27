/**
 * Jobs Router
 *
 * API endpoints for triggering and monitoring scheduled jobs.
 * These endpoints are designed to be called by AWS EventBridge/CloudWatch Events
 * or manually for testing.
 *
 * Requirements:
 * - 17.1: Daily scheduled job (cron: 0 2 * * *)
 * - 17.7: Log executions to job_execution_log
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { getLogger } from '../utils/logger.js';
import { AppError } from '../errors/index.js';
import { ScheduledJobsService } from '../services/scheduledJobsService.js';
import type { SupabaseClient } from '@supabase/supabase-js';

const logger = getLogger('jobsRouter');

// =============================================================================
// Types
// =============================================================================

interface AuthContext {
  userId: string | undefined;
  supabase: SupabaseClient;
  isServiceRole: boolean | undefined;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get context from request (service role or authenticated user)
 */
function getContext(c: Context): AuthContext {
  const supabase = c.get('supabase') as SupabaseClient | undefined;
  const userId = c.get('userId') as string | undefined;
  const isServiceRole = c.get('isServiceRole') as boolean | undefined;

  if (!supabase) {
    throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
  }

  return { userId, supabase, isServiceRole };
}


/**
 * Validate that the request is from a service role or admin
 */
function requireServiceRole(c: Context): void {
  const apiKey = c.req.header('x-api-key');
  
  // Allow if API key matches service key (for EventBridge/CloudWatch)
  const serviceKey = process.env['JOBS_SERVICE_KEY'];
  if (serviceKey && apiKey === serviceKey) {
    return;
  }

  // Allow if service role token
  const { isServiceRole } = getContext(c);
  if (isServiceRole) {
    return;
  }

  throw new AppError('Service role required for job execution', 403, 'FORBIDDEN');
}

// =============================================================================
// Router Factory
// =============================================================================

/**
 * Create jobs router
 */
export function createJobsRouter(): Hono {
  const router = new Hono();

  // ---------------------------------------------------------------------------
  // POST /jobs/level-detection
  // Run combined level detection job (level-up and level-down)
  // Requirements: 17.1, 17.2, 17.3
  // ---------------------------------------------------------------------------
  router.post('/level-detection', async (c: Context) => {
    requireServiceRole(c);
    const { supabase } = getContext(c);

    logger.info('Triggering combined level detection job');

    const jobsService = new ScheduledJobsService(supabase);
    const result = await jobsService.runCombinedLevelDetectionJob();

    return c.json({
      success: result.success,
      jobName: result.jobName,
      habitsProcessed: result.habitsProcessed,
      suggestionsCreated: result.suggestionsCreated,
      errors: result.errors,
      durationMs: result.duration,
    }, result.success ? 200 : 500);
  });

  // ---------------------------------------------------------------------------
  // POST /jobs/level-up-detection
  // Run level-up detection job only
  // Requirements: 17.1, 17.2
  // ---------------------------------------------------------------------------
  router.post('/level-up-detection', async (c: Context) => {
    requireServiceRole(c);
    const { supabase } = getContext(c);

    logger.info('Triggering level-up detection job');

    const jobsService = new ScheduledJobsService(supabase);
    const result = await jobsService.runLevelUpDetectionJob();

    return c.json({
      success: result.success,
      jobName: result.jobName,
      habitsProcessed: result.habitsProcessed,
      suggestionsCreated: result.suggestionsCreated,
      errors: result.errors,
      durationMs: result.duration,
    }, result.success ? 200 : 500);
  });

  // ---------------------------------------------------------------------------
  // POST /jobs/level-down-detection
  // Run level-down detection job only
  // Requirements: 17.1, 17.3
  // ---------------------------------------------------------------------------
  router.post('/level-down-detection', async (c: Context) => {
    requireServiceRole(c);
    const { supabase } = getContext(c);

    logger.info('Triggering level-down detection job');

    const jobsService = new ScheduledJobsService(supabase);
    const result = await jobsService.runLevelDownDetectionJob();

    return c.json({
      success: result.success,
      jobName: result.jobName,
      habitsProcessed: result.habitsProcessed,
      suggestionsCreated: result.suggestionsCreated,
      errors: result.errors,
      durationMs: result.duration,
    }, result.success ? 200 : 500);
  });

  // ---------------------------------------------------------------------------
  // POST /jobs/quota-reset
  // Run monthly quota reset job
  // Requirement: 7.5
  // ---------------------------------------------------------------------------
  router.post('/quota-reset', async (c: Context) => {
    requireServiceRole(c);
    const { supabase } = getContext(c);

    logger.info('Triggering monthly quota reset job');

    const jobsService = new ScheduledJobsService(supabase);
    const result = await jobsService.runMonthlyQuotaResetJob();

    return c.json({
      success: result.success,
      jobName: result.jobName,
      quotasReset: result.quotasReset,
      errors: result.errors,
      durationMs: result.duration,
    }, result.success ? 200 : 500);
  });

  // ---------------------------------------------------------------------------
  // GET /jobs/logs
  // Get recent job execution logs
  // Requirement: 17.7
  // ---------------------------------------------------------------------------
  router.get('/logs', async (c: Context) => {
    requireServiceRole(c);
    const { supabase } = getContext(c);

    const limitStr = c.req.query('limit') ?? '10';
    const limit = parseInt(limitStr, 10);

    const jobsService = new ScheduledJobsService(supabase);
    const logs = await jobsService.getRecentJobLogs(Math.min(limit, 100));

    return c.json({
      logs: logs.map((log) => ({
        id: log.id,
        jobName: log.jobName,
        startedAt: log.startedAt.toISOString(),
        completedAt: log.completedAt?.toISOString() ?? null,
        status: log.status,
        habitsProcessed: log.habitsProcessed,
        suggestionsCreated: log.suggestionsCreated,
        quotasReset: log.quotasReset,
        errorCount: log.errors.length,
      })),
      total: logs.length,
    });
  });

  return router;
}

// Export router instance
export const jobsRouter = createJobsRouter();
