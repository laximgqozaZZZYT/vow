/**
 * Widget Router
 *
 * REST endpoints for widget data and operations.
 * Provides API access for embeddable dashboard widgets.
 *
 * All routes require API key authentication and are rate limited.
 *
 * Endpoints:
 * - GET /progress - Daily progress data
 * - GET /stats - Statistics data
 * - GET /next - Next habits data
 * - GET /stickies - Stickies data
 * - POST /habits/:habitId/complete - Complete a habit
 * - POST /stickies/:stickyId/toggle - Toggle sticky completion
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 7.1, 7.2
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { cors } from 'hono/cors';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { apiKeyAuthMiddleware, getApiKeyUserId } from '../middleware/apiKeyAuth.js';
import { createRateLimitMiddleware, DEFAULT_RATE_LIMIT_CONFIG } from '../middleware/rateLimiter.js';
import { getSettings, type Settings } from '../config.js';
import { getLogger } from '../utils/logger.js';
import { HabitRepository } from '../repositories/habitRepository.js';
import { ActivityRepository } from '../repositories/activityRepository.js';
import { GoalRepository } from '../repositories/goalRepository.js';
import { StickyRepository } from '../repositories/stickyRepository.js';
import { DashboardDataService } from '../services/dashboardDataService.js';
import { DataFetchError, getUserFriendlyMessage } from '../errors/index.js';
import { habitCompleteRequestSchema } from '../schemas/apiKey.js';

const logger = getLogger('routers.widgets');

/**
 * Get Supabase client instance.
 *
 * Creates a Supabase client using the anon key for server-side operations.
 *
 * @param settings - Application settings.
 * @returns Supabase client instance.
 * @throws Error if Supabase is not configured.
 */
function getSupabaseClient(settings: Settings): SupabaseClient {
  if (!settings.supabaseUrl || !settings.supabaseAnonKey) {
    throw new Error('Supabase is not configured');
  }
  return createClient(settings.supabaseUrl, settings.supabaseAnonKey);
}

/**
 * Create a DashboardDataService instance with all required repositories.
 *
 * @param supabase - Supabase client instance.
 * @returns DashboardDataService instance.
 */
function createDashboardDataService(supabase: SupabaseClient): DashboardDataService {
  const habitRepo = new HabitRepository(supabase);
  const activityRepo = new ActivityRepository(supabase);
  const goalRepo = new GoalRepository(supabase);
  const stickyRepo = new StickyRepository(supabase);

  return new DashboardDataService(habitRepo, activityRepo, goalRepo, stickyRepo);
}

/**
 * Create the Widget Router with all widget endpoints.
 *
 * This router provides API access for embeddable dashboard widgets.
 * All routes require API key authentication and are rate limited.
 *
 * CORS Configuration (Requirements 7.1, 7.2):
 * - Allows requests from any origin for widget endpoints
 * - Allows X-API-Key header in CORS preflight responses
 *
 * @returns Configured Hono router instance
 */
export function createWidgetRouter(): Hono {
  const router = new Hono();
  const settings = getSettings();

  // ---------------------------------------------------------------------------
  // CORS Middleware for Widget Endpoints
  // ---------------------------------------------------------------------------
  // Requirements 7.1, 7.2:
  // - Allow requests from any origin for /api/widgets/* endpoints
  // - Allow X-API-Key header in CORS preflight responses
  router.use(
    '*',
    cors({
      origin: '*', // Allow any origin for widget embedding
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'X-API-Key', 'Accept', 'Origin'],
      exposeHeaders: ['X-RateLimit-Remaining', 'X-RateLimit-Reset', 'Retry-After'],
      maxAge: 86400, // 24 hours
      credentials: false, // Cannot use credentials with wildcard origin
    })
  );

  // ---------------------------------------------------------------------------
  // API Key Authentication Middleware
  // ---------------------------------------------------------------------------
  // Requirements 2.1, 2.2, 2.3, 2.4:
  // - Validate X-API-Key header
  // - Return 401 for missing/invalid keys
  router.use('*', apiKeyAuthMiddleware());

  // ---------------------------------------------------------------------------
  // Rate Limiting Middleware
  // ---------------------------------------------------------------------------
  // Requirements 3.1, 3.2:
  // - Limit each API key to 100 requests per minute
  // - Return 429 with Retry-After header when exceeded
  const supabase = getSupabaseClient(settings);
  router.use('*', createRateLimitMiddleware(supabase, DEFAULT_RATE_LIMIT_CONFIG));

  // ---------------------------------------------------------------------------
  // Widget Data Endpoints
  // ---------------------------------------------------------------------------

  /**
   * GET /progress
   *
   * Returns daily progress data for the authenticated user.
   *
   * Requirements: 4.1
   * - Return daily progress data in JSON format
   * - Use DashboardDataService for consistency
   */
  router.get('/progress', async (c: Context) => {
    const userId = getApiKeyUserId(c);
    logger.info('Widget progress request', { userId });

    try {
      const dashboardService = createDashboardDataService(supabase);
      const progressData = await dashboardService.getDailyProgress(userId, 'user');

      logger.info('Widget progress request successful', {
        userId,
        totalHabits: progressData.totalHabits,
        completedHabits: progressData.completedHabits,
      });

      return c.json(progressData);
    } catch (error) {
      logger.error(
        'Widget progress request failed',
        error instanceof Error ? error : new Error(String(error)),
        { userId }
      );

      if (error instanceof DataFetchError) {
        return c.json(
          {
            error: 'DATA_FETCH_ERROR',
            message: getUserFriendlyMessage(error),
          },
          500
        );
      }

      return c.json(
        {
          error: 'INTERNAL_ERROR',
          message: 'Failed to fetch daily progress data',
        },
        500
      );
    }
  });

  /**
   * GET /stats
   *
   * Returns statistics data for the authenticated user.
   *
   * Requirements: 4.2
   * - Return statistics data in JSON format
   * - Use DashboardDataService for consistency
   */
  router.get('/stats', async (c: Context) => {
    const userId = getApiKeyUserId(c);
    logger.info('Widget stats request', { userId });

    try {
      const dashboardService = createDashboardDataService(supabase);
      const statsData = await dashboardService.getStatistics(userId, 'user');

      logger.info('Widget stats request successful', {
        userId,
        totalActiveHabits: statsData.totalActiveHabits,
        todayAchievementRate: statsData.todayAchievementRate,
      });

      return c.json(statsData);
    } catch (error) {
      logger.error(
        'Widget stats request failed',
        error instanceof Error ? error : new Error(String(error)),
        { userId }
      );

      if (error instanceof DataFetchError) {
        return c.json(
          {
            error: 'DATA_FETCH_ERROR',
            message: getUserFriendlyMessage(error),
          },
          500
        );
      }

      return c.json(
        {
          error: 'INTERNAL_ERROR',
          message: 'Failed to fetch statistics data',
        },
        500
      );
    }
  });

  /**
   * GET /next
   *
   * Returns next habits data for the authenticated user.
   *
   * Requirements: 4.3
   * - Return next habits data in JSON format
   * - Use DashboardDataService for consistency
   */
  router.get('/next', async (c: Context) => {
    const userId = getApiKeyUserId(c);
    logger.info('Widget next habits request', { userId });

    try {
      const dashboardService = createDashboardDataService(supabase);
      const nextHabitsData = await dashboardService.getNextHabits(userId, 'user');

      logger.info('Widget next habits request successful', {
        userId,
        count: nextHabitsData.count,
      });

      return c.json(nextHabitsData);
    } catch (error) {
      logger.error(
        'Widget next habits request failed',
        error instanceof Error ? error : new Error(String(error)),
        { userId }
      );

      if (error instanceof DataFetchError) {
        return c.json(
          {
            error: 'DATA_FETCH_ERROR',
            message: getUserFriendlyMessage(error),
          },
          500
        );
      }

      return c.json(
        {
          error: 'INTERNAL_ERROR',
          message: 'Failed to fetch next habits data',
        },
        500
      );
    }
  });

  /**
   * GET /stickies
   *
   * Returns stickies data for the authenticated user.
   *
   * Requirements: 4.4
   * - Return stickies data in JSON format
   * - Use DashboardDataService for consistency
   */
  router.get('/stickies', async (c: Context) => {
    const userId = getApiKeyUserId(c);
    logger.info('Widget stickies request', { userId });

    try {
      const dashboardService = createDashboardDataService(supabase);
      const stickiesData = await dashboardService.getStickies(userId, 'user');

      logger.info('Widget stickies request successful', {
        userId,
        incompleteCount: stickiesData.incompleteCount,
        completedCount: stickiesData.completedCount,
      });

      return c.json(stickiesData);
    } catch (error) {
      logger.error(
        'Widget stickies request failed',
        error instanceof Error ? error : new Error(String(error)),
        { userId }
      );

      if (error instanceof DataFetchError) {
        return c.json(
          {
            error: 'DATA_FETCH_ERROR',
            message: getUserFriendlyMessage(error),
          },
          500
        );
      }

      return c.json(
        {
          error: 'INTERNAL_ERROR',
          message: 'Failed to fetch stickies data',
        },
        500
      );
    }
  });

  // ---------------------------------------------------------------------------
  // Interactive Operation Endpoints
  // ---------------------------------------------------------------------------

  /**
   * POST /habits/:habitId/complete
   *
   * Records a completion activity for a habit.
   *
   * Requirements: 5.1, 5.3, 5.4
   * - Validate habitId belongs to API key owner
   * - Create activity record with amount
   * - Return updated progress data
   */
  router.post('/habits/:habitId/complete', async (c: Context) => {
    const userId = getApiKeyUserId(c);
    const habitId = c.req.param('habitId');
    logger.info('Widget habit complete request', { userId, habitId });

    try {
      // Parse and validate request body
      const body = await c.req.json().catch(() => ({}));
      const parseResult = habitCompleteRequestSchema.safeParse(body);

      if (!parseResult.success) {
        logger.warning('Invalid habit complete request body', {
          userId,
          habitId,
          errors: parseResult.error.errors,
        });
        return c.json(
          {
            error: 'INVALID_AMOUNT',
            message: 'Amount must be a positive number',
          },
          400
        );
      }

      const { amount } = parseResult.data;

      // Get habit repository and verify ownership
      const habitRepo = new HabitRepository(supabase);
      const habit = await habitRepo.getById(habitId);

      if (!habit) {
        logger.warning('Habit not found', { userId, habitId });
        return c.json(
          {
            error: 'HABIT_NOT_FOUND',
            message: 'Habit not found',
          },
          404
        );
      }

      // Verify the habit belongs to the API key owner (Requirement 5.3)
      if (habit.owner_id !== userId) {
        logger.warning('Forbidden: habit does not belong to user', {
          userId,
          habitId,
          habitOwnerId: habit.owner_id,
        });
        return c.json(
          {
            error: 'FORBIDDEN',
            message: 'You do not have access to this resource',
          },
          403
        );
      }

      // Create activity record (Requirement 5.1)
      const activityRepo = new ActivityRepository(supabase);
      const now = new Date();
      const activityData = {
        owner_type: habit.owner_type,
        owner_id: habit.owner_id,
        habit_id: habitId,
        habit_name: habit.name,
        kind: 'complete' as const,
        timestamp: now.toISOString(),
        amount: amount,
        date: now.toISOString().split('T')[0], // YYYY-MM-DD format
        completed: true,
      };

      await activityRepo.create(activityData);

      logger.info('Activity created for habit completion', {
        userId,
        habitId,
        amount,
      });

      // Return updated progress data (Requirement 5.4)
      const dashboardService = createDashboardDataService(supabase);
      const progressData = await dashboardService.getDailyProgress(userId, 'user');

      logger.info('Widget habit complete request successful', {
        userId,
        habitId,
        amount,
        totalHabits: progressData.totalHabits,
        completedHabits: progressData.completedHabits,
      });

      return c.json(progressData);
    } catch (error) {
      logger.error(
        'Widget habit complete request failed',
        error instanceof Error ? error : new Error(String(error)),
        { userId, habitId }
      );

      if (error instanceof DataFetchError) {
        return c.json(
          {
            error: 'DATA_FETCH_ERROR',
            message: getUserFriendlyMessage(error),
          },
          500
        );
      }

      return c.json(
        {
          error: 'INTERNAL_ERROR',
          message: 'Failed to complete habit',
        },
        500
      );
    }
  });

  /**
   * POST /stickies/:stickyId/toggle
   *
   * Toggles the completion status of a sticky.
   *
   * Requirements: 5.2, 5.3, 5.4
   * - Validate stickyId belongs to API key owner
   * - Toggle completion status
   * - Return updated sticky data
   */
  router.post('/stickies/:stickyId/toggle', async (c: Context) => {
    const userId = getApiKeyUserId(c);
    const stickyId = c.req.param('stickyId');
    logger.info('Widget sticky toggle request', { userId, stickyId });

    try {
      // Get sticky repository and fetch the sticky
      const stickyRepo = new StickyRepository(supabase);
      const sticky = await stickyRepo.getById(stickyId);

      // Check if sticky exists
      if (!sticky) {
        logger.warning('Sticky not found', { userId, stickyId });
        return c.json(
          {
            error: 'STICKY_NOT_FOUND',
            message: 'Sticky not found',
          },
          404
        );
      }

      // Verify the sticky belongs to the API key owner (Requirement 5.3)
      if (sticky.owner_id !== userId) {
        logger.warning('Forbidden: sticky does not belong to user', {
          userId,
          stickyId,
          stickyOwnerId: sticky.owner_id,
        });
        return c.json(
          {
            error: 'FORBIDDEN',
            message: 'You do not have access to this resource',
          },
          403
        );
      }

      // Toggle completion status (Requirement 5.2)
      // If completed, set to incomplete; if incomplete, set to completed
      let updatedSticky;
      if (sticky.completed) {
        updatedSticky = await stickyRepo.markIncomplete(stickyId);
      } else {
        updatedSticky = await stickyRepo.markCompleted(stickyId);
      }

      if (!updatedSticky) {
        logger.error('Failed to update sticky', new Error('Update returned null'), {
          userId,
          stickyId,
        });
        return c.json(
          {
            error: 'INTERNAL_ERROR',
            message: 'Failed to toggle sticky status',
          },
          500
        );
      }

      logger.info('Widget sticky toggle request successful', {
        userId,
        stickyId,
        previousCompleted: sticky.completed,
        newCompleted: updatedSticky.completed,
      });

      // Return updated sticky data matching stickyToggleResponseSchema (Requirement 5.4)
      return c.json({
        id: updatedSticky.id,
        name: updatedSticky.name,
        completed: updatedSticky.completed,
        completedAt: updatedSticky.completed_at ?? null,
      });
    } catch (error) {
      logger.error(
        'Widget sticky toggle request failed',
        error instanceof Error ? error : new Error(String(error)),
        { userId, stickyId }
      );

      if (error instanceof DataFetchError) {
        return c.json(
          {
            error: 'DATA_FETCH_ERROR',
            message: getUserFriendlyMessage(error),
          },
          500
        );
      }

      return c.json(
        {
          error: 'INTERNAL_ERROR',
          message: 'Failed to toggle sticky status',
        },
        500
      );
    }
  });

  logger.info('Widget router initialized');

  return router;
}

// Export default router instance
export const widgetRouter = createWidgetRouter();
