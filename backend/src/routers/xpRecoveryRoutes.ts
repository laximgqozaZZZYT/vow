/**
 * XP Recovery Router
 *
 * API endpoints for XP recovery (recalculation) operations.
 * Allows users to recalculate their experience points from past habit completions.
 *
 * Requirements:
 * - 4.1: POST /api/admin/recalculate-xp - 全ユーザーの経験値再計算（管理者のみ）
 * - 4.2: POST /api/users/:id/recalculate-xp - 特定ユーザーの経験値再計算
 * - 4.3: 認証済みユーザーのみアクセスを許可する
 * - 4.4: 処理結果をJSON形式で返却する
 * - 4.5: エラー詳細を含むレスポンスを返却する
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getLogger } from '../utils/logger.js';
import { AppError } from '../errors/index.js';
import { XPRecoveryService } from '../services/xpRecoveryService.js';

const logger = getLogger('xpRecoveryRouter');

// =============================================================================
// Types
// =============================================================================

interface AuthContext {
  userId: string;
  supabase: SupabaseClient;
  isServiceRole?: boolean | undefined;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get authenticated user context from request.
 * Requirement 4.3: 認証済みユーザーのみアクセスを許可する
 */
function getAuthContext(c: Context): AuthContext {
  const userId = c.get('userId') as string | undefined;
  const supabase = c.get('supabase') as SupabaseClient | undefined;
  const isServiceRole = c.get('isServiceRole') as boolean | undefined;

  if (!userId || !supabase) {
    throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
  }

  return { userId, supabase, isServiceRole };
}

/**
 * Validate that the requested user ID matches the authenticated user.
 * Users can only recalculate their own XP.
 */
function validateUserAccess(requestedUserId: string, authenticatedUserId: string): void {
  if (requestedUserId !== authenticatedUserId) {
    throw new AppError('You can only recalculate your own XP', 403, 'FORBIDDEN');
  }
}

/**
 * Validate that the request is from a service role or admin.
 * Required for admin-only endpoints.
 */
function requireServiceRole(c: Context): void {
  const apiKey = c.req.header('x-api-key');

  // Allow if API key matches service key
  const serviceKey = process.env['JOBS_SERVICE_KEY'];
  if (serviceKey && apiKey === serviceKey) {
    return;
  }

  // Allow if service role token
  const isServiceRole = c.get('isServiceRole') as boolean | undefined;
  if (isServiceRole) {
    return;
  }

  throw new AppError('Admin access required for this operation', 403, 'FORBIDDEN');
}

// =============================================================================
// Router Factory
// =============================================================================

/**
 * Create XP recovery router.
 *
 * Endpoints:
 * - POST /users/:id/recalculate-xp - Recalculate XP for a specific user
 * - POST /admin/recalculate-xp - Recalculate XP for all users (admin only)
 */
export function createXPRecoveryRouter(): Hono {
  const router = new Hono();

  // ---------------------------------------------------------------------------
  // POST /users/:id/recalculate-xp
  // Recalculate XP for a specific user
  // Requirements: 4.2, 4.3, 4.4, 4.5
  // ---------------------------------------------------------------------------
  router.post('/users/:id/recalculate-xp', async (c: Context) => {
    const { userId, supabase } = getAuthContext(c);
    const requestedUserId = c.req.param('id');

    if (!requestedUserId) {
      throw new AppError('User ID is required', 400, 'BAD_REQUEST');
    }

    // Users can only recalculate their own XP
    validateUserAccess(requestedUserId, userId);

    logger.info('Starting XP recalculation for user', { userId: requestedUserId });

    const startTime = Date.now();
    const xpRecoveryService = new XPRecoveryService(supabase);

    try {
      const result = await xpRecoveryService.recalculateForUser(requestedUserId);

      const duration = Date.now() - startTime;

      logger.info('XP recalculation completed for user', {
        userId: requestedUserId,
        totalXPAwarded: result.totalXPAwarded,
        activitiesProcessed: result.activitiesProcessed,
        skipped: result.activitiesSkipped,
        errorCount: result.errors.length,
        duration,
      });

      // Requirement 4.4: 処理結果をJSON形式で返却する
      return c.json({
        success: true,
        totalXPAwarded: result.totalXPAwarded,
        activitiesProcessed: result.activitiesProcessed,
        skipped: result.activitiesSkipped,
        newLevel: result.userLevel,
        skillLevels: result.skillLevels?.map((s) => ({
          tagId: s.tagId,
          tagName: s.tagName,
          tagColor: s.tagColor,
          totalXP: s.totalXP,
          activityCount: s.activityCount,
          level: s.level,
        })) ?? [],
        errors: result.errors.map((e) => ({
          activityId: e.activityId,
          message: e.message,
        })),
      });
    } catch (error) {
      // Requirement 4.5: エラー詳細を含むレスポンスを返却する
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('XP recalculation failed for user', error as Error, {
        userId: requestedUserId,
      });

      return c.json(
        {
          success: false,
          totalXPAwarded: 0,
          activitiesProcessed: 0,
          skipped: 0,
          errors: [
            {
              activityId: 'system',
              message: errorMessage,
            },
          ],
        },
        500
      );
    }
  });

  // ---------------------------------------------------------------------------
  // POST /admin/recalculate-xp
  // Recalculate XP for all users (admin only)
  // Requirements: 4.1, 4.3, 4.4, 4.5
  // ---------------------------------------------------------------------------
  router.post('/admin/recalculate-xp', async (c: Context) => {
    // Require admin/service role access
    requireServiceRole(c);

    const { supabase } = getAuthContext(c);

    logger.info('Starting XP recalculation for all users');

    const startTime = Date.now();
    const xpRecoveryService = new XPRecoveryService(supabase);

    try {
      const result = await xpRecoveryService.recalculateForAllUsers();

      const duration = Date.now() - startTime;

      logger.info('XP recalculation completed for all users', {
        totalXPAwarded: result.totalXPAwarded,
        activitiesProcessed: result.activitiesProcessed,
        skipped: result.activitiesSkipped,
        errorCount: result.errors.length,
        duration,
      });

      // Requirement 4.4: 処理結果をJSON形式で返却する
      return c.json({
        success: true,
        usersProcessed: result.activitiesProcessed > 0 ? 1 : 0, // Simplified for now
        totalXPAwarded: result.totalXPAwarded,
        totalActivitiesProcessed: result.activitiesProcessed,
        totalSkipped: result.activitiesSkipped,
        errors: result.errors.map((e) => ({
          userId: e.activityId.startsWith('user:') ? e.activityId.split(':')[1] : undefined,
          message: e.message,
        })),
        duration,
      });
    } catch (error) {
      // Requirement 4.5: エラー詳細を含むレスポンスを返却する
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('XP recalculation failed for all users', error as Error);

      return c.json(
        {
          success: false,
          usersProcessed: 0,
          totalXPAwarded: 0,
          totalActivitiesProcessed: 0,
          totalSkipped: 0,
          errors: [
            {
              userId: undefined,
              message: errorMessage,
            },
          ],
          duration: Date.now() - startTime,
        },
        500
      );
    }
  });

  return router;
}

// Export router instance
export const xpRecoveryRouter = createXPRecoveryRouter();
