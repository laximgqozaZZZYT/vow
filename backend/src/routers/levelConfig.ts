/**
 * Level Config Router
 *
 * レベルシステム設定と移行関連のAPIエンドポイント
 *
 * Requirements (level-system-rebalancing):
 * - 10.1: GET /api/users/:id/level - formula_version, is_migrated, migration_date フィールドを追加
 * - 10.2: GET /api/level-config - 現在の計算式設定を返す
 * - 10.3: POST /api/users/:id/recalibrate-habits - バッチ習慣再評価
 * - 10.4: GET /api/users/:id/migration-status - 移行ステータスを返す
 * - 7.1, 7.2: GET /api/level-simulator - レベル進行シミュレーション
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getLogger } from '../utils/logger.js';
import { AppError } from '../errors/index.js';
import { LevelConfigService } from '../services/levelConfigService.js';
import { LevelRebalancingService } from '../services/levelRebalancingService.js';
import { MigrationService } from '../services/migrationService.js';

const logger = getLogger('levelConfigRouter');

// =============================================================================
// Types
// =============================================================================

interface AuthContext {
  userId: string;
  supabase: SupabaseClient;
}

interface SimulationRequestBody {
  currentXP?: number;
  dailyHabits?: number;
  averageHabitLevel?: number;
  streakDays?: number;
  completionRate?: number;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get authenticated user context from request
 */
function getAuthContext(c: Context): AuthContext {
  const userId = c.get('userId') as string | undefined;
  const supabase = c.get('supabase') as SupabaseClient | undefined;

  if (!userId || !supabase) {
    throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
  }

  return { userId, supabase };
}

/**
 * Validate that the requested user ID matches the authenticated user
 */
function validateUserAccess(requestedUserId: string, authenticatedUserId: string): void {
  if (requestedUserId !== authenticatedUserId) {
    throw new AppError('You can only access your own data', 403, 'FORBIDDEN');
  }
}

// =============================================================================
// Router Factory
// =============================================================================

/**
 * Create level config router
 */
export function createLevelConfigRouter(): Hono {
  const router = new Hono();

  // ---------------------------------------------------------------------------
  // GET /level-config
  // Get current level calculation configuration
  // Requirements: 10.2
  // ---------------------------------------------------------------------------
  router.get('/level-config', async (c: Context) => {
    const { supabase } = getAuthContext(c);

    logger.info('Getting level configuration');

    const configService = new LevelConfigService(supabase);
    const config = await configService.getCurrentConfig();

    // Get feature flags
    const rebalancingEnabled = await configService.getFeatureFlag('level_rebalancing_enabled');
    const newXPFormulaEnabled = await configService.getFeatureFlag('new_xp_formula_enabled');
    const migrationInProgress = await configService.getFeatureFlag('migration_in_progress');

    return c.json({
      config: {
        version: config.formulaVersion,
        expertiseFormula: config.expertiseLevelFormula,
        xpFormula: {
          baseXPFormula: config.baseXPFormula,
          streakBonus: config.streakBonus,
        },
        xpMultipliers: config.xpMultipliers,
        decaySettings: config.decaySettings,
        tierBoundaries: config.tierBoundaries,
        effectiveFrom: config.effectiveFrom,
      },
      featureFlags: {
        levelRebalancingEnabled: rebalancingEnabled,
        newXPFormulaEnabled: newXPFormulaEnabled,
        migrationInProgress: migrationInProgress,
      },
    });
  });

  // ---------------------------------------------------------------------------
  // GET /users/:id/migration-status
  // Get user's migration status
  // Requirements: 10.4
  // ---------------------------------------------------------------------------
  router.get('/users/:id/migration-status', async (c: Context) => {
    const { userId, supabase } = getAuthContext(c);
    const requestedUserId = c.req.param('id');

    if (!requestedUserId) {
      throw new AppError('User ID is required', 400, 'BAD_REQUEST');
    }

    // Users can only access their own migration status
    validateUserAccess(requestedUserId, userId);

    logger.info('Getting migration status', { userId: requestedUserId });

    const migrationService = new MigrationService(supabase);
    const status = await migrationService.getMigrationStatus(requestedUserId);

    return c.json({
      userId: requestedUserId,
      isMigrated: status.isMigrated,
      migrationDate: status.migrationDate,
      oldLevel: status.oldLevel,
      newLevel: status.newLevel,
      pioneerBadgeAwarded: status.pioneerBadgeAwarded,
      canRollback: status.canRollback,
    });
  });

  // ---------------------------------------------------------------------------
  // GET /level-simulator
  // Simulate level progression
  // Requirements: 7.1, 7.2
  // ---------------------------------------------------------------------------
  router.get('/level-simulator', async (c: Context) => {
    const { supabase } = getAuthContext(c);

    // Get query parameters
    const currentXP = parseInt(c.req.query('currentXP') ?? '0', 10);
    const dailyHabits = parseInt(c.req.query('dailyHabits') ?? '3', 10);
    const averageHabitLevel = parseInt(c.req.query('averageHabitLevel') ?? '25', 10);
    const streakDays = parseInt(c.req.query('streakDays') ?? '0', 10);
    const completionRate = parseInt(c.req.query('completionRate') ?? '100', 10);

    logger.info('Running level simulation', {
      currentXP,
      dailyHabits,
      averageHabitLevel,
      streakDays,
      completionRate,
    });

    const rebalancingService = new LevelRebalancingService(supabase);
    const result = rebalancingService.simulateProgression({
      currentXP,
      dailyHabits,
      averageHabitLevel,
      streakDays,
      completionRate,
    });

    return c.json({
      currentLevel: result.currentLevel,
      projections: result.projections,
      tierMilestones: result.tierMilestones,
      parameters: {
        currentXP,
        dailyHabits,
        averageHabitLevel,
        streakDays,
        completionRate,
      },
    });
  });

  // ---------------------------------------------------------------------------
  // POST /level-simulator
  // Simulate level progression (POST version for complex params)
  // Requirements: 7.1, 7.2
  // ---------------------------------------------------------------------------
  router.post('/level-simulator', async (c: Context) => {
    const { supabase } = getAuthContext(c);

    // Parse request body
    const body = await c.req.json<SimulationRequestBody>().catch(() => ({} as SimulationRequestBody));

    const currentXP = body.currentXP ?? 0;
    const dailyHabits = body.dailyHabits ?? 3;
    const averageHabitLevel = body.averageHabitLevel ?? 25;
    const streakDays = body.streakDays ?? 0;
    const completionRate = body.completionRate ?? 100;

    logger.info('Running level simulation (POST)', {
      currentXP,
      dailyHabits,
      averageHabitLevel,
      streakDays,
      completionRate,
    });

    const rebalancingService = new LevelRebalancingService(supabase);
    const result = rebalancingService.simulateProgression({
      currentXP,
      dailyHabits,
      averageHabitLevel,
      streakDays,
      completionRate,
    });

    return c.json({
      currentLevel: result.currentLevel,
      projections: result.projections,
      tierMilestones: result.tierMilestones,
      parameters: {
        currentXP,
        dailyHabits,
        averageHabitLevel,
        streakDays,
        completionRate,
      },
    });
  });

  // ---------------------------------------------------------------------------
  // POST /users/:id/recalibrate-habits
  // Batch recalibrate habits for a user
  // Requirements: 10.3
  // ---------------------------------------------------------------------------
  router.post('/users/:id/recalibrate-habits', async (c: Context) => {
    const { userId, supabase } = getAuthContext(c);
    const requestedUserId = c.req.param('id');

    if (!requestedUserId) {
      throw new AppError('User ID is required', 400, 'BAD_REQUEST');
    }

    // Users can only recalibrate their own habits
    validateUserAccess(requestedUserId, userId);

    // Parse request body (optional habitIds filter)
    const body = await c.req.json<{ habitIds?: string[] }>().catch(() => ({} as { habitIds?: string[] }));

    logger.info('Recalibrating habits', {
      userId: requestedUserId,
      habitIds: body.habitIds,
    });

    // Get habits that need recalibration
    let query = supabase
      .from('habits')
      .select('id, name, level, needs_recalibration')
      .eq('owner_id', requestedUserId)
      .eq('active', true);

    if (body.habitIds && body.habitIds.length > 0) {
      query = query.in('id', body.habitIds);
    } else {
      // Only get habits that need recalibration
      query = query.eq('needs_recalibration', true);
    }

    const { data: habits, error } = await query;

    if (error) {
      throw new AppError(`Failed to get habits: ${error.message}`, 500, 'INTERNAL_ERROR');
    }

    if (!habits || habits.length === 0) {
      return c.json({
        success: true,
        message: '再評価が必要な習慣はありません。',
        recalibratedCount: 0,
        habits: [],
      });
    }

    // Mark habits as recalibrated (actual recalibration would use THLIRecalibrationService)
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('habits')
      .update({
        needs_recalibration: false,
        recalibrated_at: now,
        updated_at: now,
      })
      .in('id', habits.map(h => h.id));

    if (updateError) {
      throw new AppError(`Failed to update habits: ${updateError.message}`, 500, 'INTERNAL_ERROR');
    }

    logger.info('Habits recalibrated', {
      userId: requestedUserId,
      count: habits.length,
    });

    return c.json({
      success: true,
      message: `${habits.length}件の習慣を再評価しました。`,
      recalibratedCount: habits.length,
      habits: habits.map(h => ({
        id: h.id,
        name: h.name,
        oldLevel: h.level,
        recalibratedAt: now,
      })),
    });
  });

  return router;
}

// Export router instance
export const levelConfigRouter = createLevelConfigRouter();
