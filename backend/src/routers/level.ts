/**
 * Level Router
 *
 * THLI-24レベル評価関連のAPIエンドポイント
 *
 * Requirements:
 * - 13.1: POST /api/habits/:id/assess-level
 * - 13.2: GET /api/habits/:id/level-history
 * - 13.3: POST /api/habits/:id/accept-baby-step
 * - 13.4: POST /api/habits/:id/accept-level-up
 * - 13.5: GET /api/users/:id/thli-quota
 * - 13.6: GET /api/habits/:id/level-details
 * - 3.1-3.7: Habit Inventory Feature
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { getLogger } from '../utils/logger.js';
import { AppError } from '../errors/index.js';
import { THLIAssessmentService } from '../services/thliAssessmentService.js';
import { LevelManagerService } from '../services/levelManagerService.js';
import { UsageQuotaService } from '../services/usageQuotaService.js';
import { HabitRepository } from '../repositories/habitRepository.js';
import { detectLanguageFromHeaders, type SupportedLanguage } from '../utils/languageDetection.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { BabyStepPlan, WorkloadChanges } from '../types/thli.js';

const logger = getLogger('levelRouter');

// =============================================================================
// Types
// =============================================================================

interface AuthContext {
  userId: string;
  supabase: SupabaseClient;
}

interface AssessLevelBody {
  conversationContext?: Record<string, unknown>;
  language?: SupportedLanguage;
}

interface AcceptBabyStepBody {
  planType: 'lv50' | 'lv10';
  proposedChanges: BabyStepPlan;
}

interface AcceptLevelUpBody {
  targetLevel: number;
  workloadChanges: WorkloadChanges;
}

interface CheckHabitCompatibilityBody {
  proposedLevel: number;
  habitName?: string;
}

interface WorkloadLevelConsistencyResult {
  isConsistent: boolean;
  assessedLevel: number | null;
  estimatedLevelFromWorkload: number;
  levelDifference: number;
  recommendation: 'consistent' | 'reassess_level' | 'adjust_workload';
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
 * Validate habit ownership
 */
async function validateHabitOwnership(
  habitRepo: HabitRepository,
  habitId: string,
  userId: string
): Promise<void> {
  const habit = await habitRepo.getById(habitId);
  
  if (!habit) {
    throw new AppError('Habit not found', 404, 'NOT_FOUND');
  }

  if (habit.owner_id !== userId) {
    throw new AppError('You do not have access to this habit', 403, 'FORBIDDEN');
  }
}

/**
 * Estimate habit level from workload settings.
 * Used for workload-level consistency check.
 * 
 * Requirements: 5.5 (gamification-xp-balance)
 */
function estimateLevelFromWorkload(habit: {
  frequency?: string;
  workload_per_count?: number;
  workload_unit?: string | null | undefined;
  target_count?: number;
}): number {
  let baseLevel = 50; // Start at intermediate

  // Adjust based on frequency
  if (habit.frequency === 'daily') {
    baseLevel += 30;
  } else if (habit.frequency === 'weekly') {
    baseLevel += 15;
  } else if (habit.frequency === 'monthly') {
    baseLevel += 5;
  }

  // Adjust based on workload duration/count
  if (habit.workload_per_count) {
    if (habit.workload_per_count >= 60) {
      baseLevel += 40; // Long duration (60+ minutes)
    } else if (habit.workload_per_count >= 30) {
      baseLevel += 25; // Medium duration (30-59 minutes)
    } else if (habit.workload_per_count >= 15) {
      baseLevel += 10; // Short duration (15-29 minutes)
    } else if (habit.workload_per_count >= 5) {
      baseLevel += 5; // Very short (5-14 minutes)
    }
    // Under 5 minutes: no additional level
  }

  // Adjust based on target count
  if (habit.target_count && habit.target_count > 1) {
    baseLevel += Math.min(20, habit.target_count * 5);
  }

  // Clamp to valid range (0-199)
  return Math.min(199, Math.max(0, baseLevel));
}

/**
 * Perform a quick assessment for batch inventory mode
 * Uses habit metadata to estimate level without full conversation
 */
async function performQuickAssessment(
  habit: {
    id: string;
    name: string;
    frequency?: string;
    workload_per_count?: number;
    workload_unit?: string | null | undefined;
    goal_id?: string | null | undefined;
  },
  supabase: SupabaseClient
): Promise<{
  level: number;
  tier: string;
  firewallTriggered: boolean;
  voiQuestions?: { factId: string; question: string }[];
}> {
  // Simple heuristic-based assessment for batch mode
  let baseLevel = 50; // Start at intermediate

  // Adjust based on frequency
  if (habit.frequency === 'daily') {
    baseLevel += 20;
  } else if (habit.frequency === 'weekly') {
    baseLevel += 10;
  }

  // Adjust based on workload
  if (habit.workload_per_count) {
    if (habit.workload_per_count >= 60) {
      baseLevel += 30; // Long duration
    } else if (habit.workload_per_count >= 30) {
      baseLevel += 15;
    } else if (habit.workload_per_count >= 15) {
      baseLevel += 5;
    }
  }

  // Clamp to valid range
  const level = Math.min(199, Math.max(0, baseLevel));

  // Calculate tier
  let tier: string;
  if (level < 50) tier = 'beginner';
  else if (level < 100) tier = 'intermediate';
  else if (level < 150) tier = 'advanced';
  else tier = 'expert';

  // Update habit with level
  const now = new Date().toISOString();
  await supabase
    .from('habits')
    .update({
      level,
      level_tier: tier,
      level_last_assessed_at: now,
      level_assessment_data: {
        assessmentType: 'quick_inventory',
        level,
        tier,
        promptVersion: 'quick-v1.0',
        assessedAt: now,
      },
      updated_at: now,
    })
    .eq('id', habit.id);

  // Record in level_history
  await supabase.from('level_history').insert({
    entity_type: 'habit',
    entity_id: habit.id,
    old_level: null,
    new_level: level,
    reason: 'initial_assessment',
    workload_delta: {},
    assessed_at: now,
  });

  return {
    level,
    tier,
    firewallTriggered: false,
  };
}

// =============================================================================
// Router Factory
// =============================================================================

/**
 * Create level router
 */
export function createLevelRouter(): Hono {
  const router = new Hono();

  // ---------------------------------------------------------------------------
  // POST /habits/:id/assess-level
  // Initiate a THLI-24 assessment for a habit
  // Requirements: 13.1, 15.2
  // ---------------------------------------------------------------------------
  router.post('/habits/:id/assess-level', async (c: Context) => {
    const { userId, supabase } = getAuthContext(c);
    const habitId = c.req.param('id');

    if (!habitId) {
      throw new AppError('Habit ID is required', 400, 'BAD_REQUEST');
    }

    logger.info('Initiating THLI-24 assessment', { userId, habitId });

    // Validate habit ownership
    const habitRepo = new HabitRepository(supabase);
    await validateHabitOwnership(habitRepo, habitId, userId);

    // Check quota
    const quotaService = new UsageQuotaService(supabase);
    const quotaStatus = await quotaService.checkQuota(userId);

    if (!quotaStatus.allowed) {
      return c.json({
        error: 'QUOTA_EXCEEDED',
        message: '今月のTHLI-24評価回数の上限に達しました。',
        quotaStatus: quotaStatus.status,
        upgradeRequired: true,
      }, 403);
    }

    // Parse request body
    const body = await c.req.json<AssessLevelBody>().catch(() => ({} as Partial<AssessLevelBody>));

    // Detect language from request
    // Priority: 1. Body language param, 2. Headers, 3. Default (ja)
    // Requirements: 15.2 - Detect user's language preference
    const headers = Object.fromEntries(
      [...c.req.raw.headers.entries()].map(([k, v]) => [k.toLowerCase(), v])
    );
    const language: SupportedLanguage = body.language ?? detectLanguageFromHeaders(headers);

    logger.debug('Language detected for assessment', { language, habitId });

    // Initiate assessment
    const assessmentService = new THLIAssessmentService(supabase);
    const session = await assessmentService.initiateAssessment(
      habitId,
      userId,
      language
    );

    logger.info('THLI-24 assessment initiated', {
      userId,
      habitId,
      sessionId: session.sessionId,
      status: session.status,
      language,
    });

    return c.json({
      assessmentId: session.sessionId,
      status: session.status,
      conversationId: session.conversationId,
      quotaRemaining: quotaStatus.status.remaining - 1,
      language,
    }, 201);
  });

  // ---------------------------------------------------------------------------
  // GET /habits/:id/level-history
  // Get level change history for a habit
  // Requirements: 13.2
  // ---------------------------------------------------------------------------
  router.get('/habits/:id/level-history', async (c: Context) => {
    const { userId, supabase } = getAuthContext(c);
    const habitId = c.req.param('id');

    if (!habitId) {
      throw new AppError('Habit ID is required', 400, 'BAD_REQUEST');
    }

    // Validate habit ownership
    const habitRepo = new HabitRepository(supabase);
    await validateHabitOwnership(habitRepo, habitId, userId);

    // Get query parameters for filtering
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');
    const changeType = c.req.query('changeType') as 'all' | 'level_up' | 'level_down' | 're_assessment' | undefined;

    // Build filters
    const filters: {
      dateRange?: { start: Date; end: Date };
      changeType?: 'all' | 'level_up' | 'level_down' | 're_assessment';
    } = {};

    if (startDate && endDate) {
      filters.dateRange = {
        start: new Date(startDate),
        end: new Date(endDate),
      };
    }

    if (changeType) {
      filters.changeType = changeType;
    }

    // Get level history
    const levelManager = new LevelManagerService(supabase);
    const history = await levelManager.getLevelHistory(habitId, 'habit', filters);

    return c.json({
      habitId,
      history: history.map(h => ({
        id: h.id,
        oldLevel: h.oldLevel,
        newLevel: h.newLevel,
        reason: h.reason,
        workloadDelta: h.workloadDelta,
        assessedAt: h.assessedAt,
        createdAt: h.createdAt,
      })),
    });
  });

  // ---------------------------------------------------------------------------
  // POST /habits/:id/accept-baby-step
  // Accept a baby step plan and apply it to the habit
  // Requirements: 13.3
  // ---------------------------------------------------------------------------
  router.post('/habits/:id/accept-baby-step', async (c: Context) => {
    const { userId, supabase } = getAuthContext(c);
    const habitId = c.req.param('id');

    if (!habitId) {
      throw new AppError('Habit ID is required', 400, 'BAD_REQUEST');
    }

    // Parse request body
    const body = await c.req.json<AcceptBabyStepBody>();

    if (!body.planType || !body.proposedChanges) {
      throw new AppError('planType and proposedChanges are required', 400, 'BAD_REQUEST');
    }

    if (body.planType !== 'lv50' && body.planType !== 'lv10') {
      throw new AppError('planType must be "lv50" or "lv10"', 400, 'BAD_REQUEST');
    }

    logger.info('Accepting baby step plan', { userId, habitId, planType: body.planType });

    // Validate habit ownership
    const habitRepo = new HabitRepository(supabase);
    await validateHabitOwnership(habitRepo, habitId, userId);

    // Apply baby step
    const levelManager = new LevelManagerService(supabase);
    const updatedHabit = await levelManager.applyLevelDown(habitId, body.proposedChanges);

    logger.info('Baby step plan applied', {
      userId,
      habitId,
      planType: body.planType,
      newLevel: updatedHabit.level,
    });

    return c.json({
      success: true,
      habit: {
        id: updatedHabit.id,
        name: updatedHabit.name,
        level: updatedHabit.level,
        levelTier: updatedHabit.level_tier,
      },
      message: `習慣「${updatedHabit.name}」をLv.${body.planType === 'lv50' ? '50' : '10'}プランに調整しました。`,
    });
  });

  // ---------------------------------------------------------------------------
  // POST /habits/:id/accept-level-up
  // Accept a level-up suggestion and apply it to the habit
  // Requirements: 13.4
  // ---------------------------------------------------------------------------
  router.post('/habits/:id/accept-level-up', async (c: Context) => {
    const { userId, supabase } = getAuthContext(c);
    const habitId = c.req.param('id');

    if (!habitId) {
      throw new AppError('Habit ID is required', 400, 'BAD_REQUEST');
    }

    // Parse request body
    const body = await c.req.json<AcceptLevelUpBody>();

    if (body.targetLevel === undefined || !body.workloadChanges) {
      throw new AppError('targetLevel and workloadChanges are required', 400, 'BAD_REQUEST');
    }

    if (body.targetLevel < 0 || body.targetLevel > 199) {
      throw new AppError('targetLevel must be between 0 and 199', 400, 'BAD_REQUEST');
    }

    logger.info('Accepting level-up', { userId, habitId, targetLevel: body.targetLevel });

    // Validate habit ownership
    const habitRepo = new HabitRepository(supabase);
    await validateHabitOwnership(habitRepo, habitId, userId);

    // Apply level-up
    const levelManager = new LevelManagerService(supabase);
    const updatedHabit = await levelManager.applyLevelUp(
      habitId,
      body.targetLevel,
      body.workloadChanges
    );

    logger.info('Level-up applied', {
      userId,
      habitId,
      newLevel: updatedHabit.level,
    });

    return c.json({
      success: true,
      habit: {
        id: updatedHabit.id,
        name: updatedHabit.name,
        level: updatedHabit.level,
        levelTier: updatedHabit.level_tier,
      },
      message: `習慣「${updatedHabit.name}」をレベル${body.targetLevel}にアップしました！`,
    });
  });

  // ---------------------------------------------------------------------------
  // GET /users/:id/thli-quota
  // Get THLI-24 assessment quota status for a user
  // Requirements: 13.5
  // ---------------------------------------------------------------------------
  router.get('/users/:id/thli-quota', async (c: Context) => {
    const { userId, supabase } = getAuthContext(c);
    const requestedUserId = c.req.param('id');

    // Users can only check their own quota
    if (requestedUserId !== userId) {
      throw new AppError('You can only check your own quota', 403, 'FORBIDDEN');
    }

    const quotaService = new UsageQuotaService(supabase);
    const quotaResult = await quotaService.checkQuota(userId);

    return c.json({
      quotaUsed: quotaResult.status.quotaUsed,
      quotaLimit: quotaResult.status.quotaLimit,
      remaining: quotaResult.status.remaining,
      periodStart: quotaResult.status.periodStart,
      periodEnd: quotaResult.status.periodEnd,
      isUnlimited: quotaResult.status.isUnlimited,
    });
  });

  // ---------------------------------------------------------------------------
  // GET /habits/:id/level-details
  // Get full THLI-24 assessment details for a habit
  // Requirements: 13.6
  // ---------------------------------------------------------------------------
  router.get('/habits/:id/level-details', async (c: Context) => {
    const { userId, supabase } = getAuthContext(c);
    const habitId = c.req.param('id');

    if (!habitId) {
      throw new AppError('Habit ID is required', 400, 'BAD_REQUEST');
    }

    // Validate habit ownership
    const habitRepo = new HabitRepository(supabase);
    await validateHabitOwnership(habitRepo, habitId, userId);

    // Get habit with level details
    const habit = await habitRepo.getById(habitId);

    if (!habit) {
      throw new AppError('Habit not found', 404, 'NOT_FOUND');
    }

    // Get level history
    const levelManager = new LevelManagerService(supabase);
    const history = await levelManager.getLevelHistory(habitId, 'habit', { changeType: 'all' });

    return c.json({
      habitId: habit.id,
      habitName: habit.name,
      level: habit.level,
      levelTier: habit.level_tier,
      assessmentData: habit.level_assessment_data,
      lastAssessedAt: habit.level_last_assessed_at,
      crossFrameworkScores: habit.level_assessment_data 
        ? (habit.level_assessment_data as Record<string, unknown>)['crossFramework'] 
        : null,
      recentHistory: history.slice(0, 5),
    });
  });

  // ---------------------------------------------------------------------------
  // GET /suggestions/pending
  // Get pending level suggestions for the current user
  // Requirements: 17.5
  // ---------------------------------------------------------------------------
  router.get('/suggestions/pending', async (c: Context) => {
    const { userId, supabase } = getAuthContext(c);

    logger.info('Getting pending level suggestions', { userId });

    const levelManager = new LevelManagerService(supabase);
    const suggestions = await levelManager.getPendingSuggestions(userId);

    return c.json({
      suggestions: suggestions.map(s => ({
        id: s.id,
        habitId: s.habitId,
        habitName: s.habitName,
        suggestionType: s.suggestionType,
        currentLevel: s.currentLevel,
        targetLevel: s.targetLevel,
        proposedChanges: s.proposedChanges,
        reason: s.reason,
        detectedAt: s.detectedAt,
        status: s.status,
      })),
      count: suggestions.length,
    });
  });

  // ---------------------------------------------------------------------------
  // GET /suggestions/count
  // Get count of pending level suggestions for notification badge
  // Requirements: 17.5
  // ---------------------------------------------------------------------------
  router.get('/suggestions/count', async (c: Context) => {
    const { userId, supabase } = getAuthContext(c);

    const levelManager = new LevelManagerService(supabase);
    const count = await levelManager.getPendingSuggestionCount(userId);

    return c.json({
      count,
      hasNotifications: count > 0,
    });
  });

  // ---------------------------------------------------------------------------
  // POST /suggestions/:id/accept
  // Accept a level suggestion
  // Requirements: 17.5
  // ---------------------------------------------------------------------------
  router.post('/suggestions/:id/accept', async (c: Context) => {
    const { userId, supabase } = getAuthContext(c);
    const suggestionId = c.req.param('id');

    if (!suggestionId) {
      throw new AppError('Suggestion ID is required', 400, 'BAD_REQUEST');
    }

    logger.info('Accepting level suggestion', { userId, suggestionId });

    const levelManager = new LevelManagerService(supabase);
    
    // Get the suggestion first
    const suggestions = await levelManager.getPendingSuggestions(userId);
    const suggestion = suggestions.find(s => s.id === suggestionId);

    if (!suggestion) {
      throw new AppError('Suggestion not found', 404, 'NOT_FOUND');
    }

    // Apply the suggestion based on type
    if (suggestion.suggestionType === 'level_up') {
      await levelManager.applyLevelUp(
        suggestion.habitId,
        suggestion.targetLevel,
        suggestion.proposedChanges as WorkloadChanges
      );
    } else {
      await levelManager.applyLevelDown(
        suggestion.habitId,
        suggestion.proposedChanges as BabyStepPlan
      );
    }

    // Update suggestion status
    await levelManager.updateSuggestionStatus(suggestionId, 'accepted');

    return c.json({
      success: true,
      message: suggestion.suggestionType === 'level_up'
        ? `習慣をレベル${suggestion.targetLevel}にアップしました！`
        : `習慣をレベル${suggestion.targetLevel}に調整しました。`,
    });
  });

  // ---------------------------------------------------------------------------
  // POST /suggestions/:id/dismiss
  // Dismiss a level suggestion
  // Requirements: 17.5
  // ---------------------------------------------------------------------------
  router.post('/suggestions/:id/dismiss', async (c: Context) => {
    const { userId, supabase } = getAuthContext(c);
    const suggestionId = c.req.param('id');

    if (!suggestionId) {
      throw new AppError('Suggestion ID is required', 400, 'BAD_REQUEST');
    }

    logger.info('Dismissing level suggestion', { userId, suggestionId });

    const levelManager = new LevelManagerService(supabase);
    await levelManager.updateSuggestionStatus(suggestionId, 'dismissed');

    return c.json({
      success: true,
      message: '提案を却下しました。',
    });
  });

  // ---------------------------------------------------------------------------
  // GET /habits/:id/level-compatibility
  // Check level compatibility for an existing habit
  // Requirements: 2.7 (gamification-xp-balance)
  // ---------------------------------------------------------------------------
  router.get('/habits/:id/level-compatibility', async (c: Context) => {
    const { userId, supabase } = getAuthContext(c);
    const habitId = c.req.param('id');

    if (!habitId) {
      throw new AppError('Habit ID is required', 400, 'BAD_REQUEST');
    }

    logger.info('Checking level compatibility for habit', { userId, habitId });

    // Validate habit ownership
    const habitRepo = new HabitRepository(supabase);
    await validateHabitOwnership(habitRepo, habitId, userId);

    // Get habit details
    const habit = await habitRepo.getById(habitId);
    if (!habit) {
      throw new AppError('Habit not found', 404, 'NOT_FOUND');
    }

    const levelManager = new LevelManagerService(supabase);

    // If habit has no level, return early
    if (habit.level === null || habit.level === undefined) {
      return c.json({
        habitId,
        habitLevel: null,
        userLevel: 0,
        mismatch: {
          isMismatch: false,
          userLevel: 0,
          habitLevel: 0,
          levelGap: 0,
          severity: 'none',
          recommendation: 'proceed',
        },
        message: '習慣のレベルが未評価です。',
      });
    }

    // Check level compatibility
    const result = await levelManager.checkHabitLevelCompatibility(
      userId,
      habit.level,
      habit.name
    );

    return c.json({
      habitId,
      habitLevel: habit.level,
      userLevel: result.mismatch.userLevel,
      mismatch: result.mismatch,
      babyStepPlans: result.babyStepPlans,
    });
  });

  // ---------------------------------------------------------------------------
  // POST /users/:id/check-habit-compatibility
  // Check compatibility for a proposed habit level
  // Requirements: 2.8 (gamification-xp-balance)
  // ---------------------------------------------------------------------------
  router.post('/users/:id/check-habit-compatibility', async (c: Context) => {
    const { userId, supabase } = getAuthContext(c);
    const requestedUserId = c.req.param('id');

    // Users can only check their own compatibility
    if (requestedUserId !== userId) {
      throw new AppError('You can only check your own compatibility', 403, 'FORBIDDEN');
    }

    // Parse request body
    const body = await c.req.json<CheckHabitCompatibilityBody>();

    if (body.proposedLevel === undefined || body.proposedLevel === null) {
      throw new AppError('proposedLevel is required', 400, 'BAD_REQUEST');
    }

    if (body.proposedLevel < 0 || body.proposedLevel > 199) {
      throw new AppError('proposedLevel must be between 0 and 199', 400, 'BAD_REQUEST');
    }

    logger.info('Checking habit compatibility for user', {
      userId,
      proposedLevel: body.proposedLevel,
      habitName: body.habitName,
    });

    const levelManager = new LevelManagerService(supabase);
    const result = await levelManager.checkHabitLevelCompatibility(
      userId,
      body.proposedLevel,
      body.habitName ?? '新しい習慣'
    );

    return c.json({
      mismatch: result.mismatch,
      babyStepPlans: result.babyStepPlans,
    });
  });

  // ---------------------------------------------------------------------------
  // GET /habits/:id/workload-level-consistency
  // Check workload and level consistency
  // Requirements: 5.5 (gamification-xp-balance)
  // ---------------------------------------------------------------------------
  router.get('/habits/:id/workload-level-consistency', async (c: Context) => {
    const { userId, supabase } = getAuthContext(c);
    const habitId = c.req.param('id');

    if (!habitId) {
      throw new AppError('Habit ID is required', 400, 'BAD_REQUEST');
    }

    logger.info('Checking workload-level consistency', { userId, habitId });

    // Validate habit ownership
    const habitRepo = new HabitRepository(supabase);
    await validateHabitOwnership(habitRepo, habitId, userId);

    // Get habit details
    const habit = await habitRepo.getById(habitId);
    if (!habit) {
      throw new AppError('Habit not found', 404, 'NOT_FOUND');
    }

    // Estimate level from workload
    const estimatedLevel = estimateLevelFromWorkload(habit);

    // Calculate consistency
    const assessedLevel = habit.level ?? null;
    const levelDifference = assessedLevel !== null
      ? Math.abs(assessedLevel - estimatedLevel)
      : 0;

    // Determine consistency (threshold: 20 points)
    const isConsistent = assessedLevel === null || levelDifference <= 20;

    // Determine recommendation
    let recommendation: 'consistent' | 'reassess_level' | 'adjust_workload';
    if (isConsistent) {
      recommendation = 'consistent';
    } else if (estimatedLevel > (assessedLevel ?? 0)) {
      recommendation = 'reassess_level';
    } else {
      recommendation = 'adjust_workload';
    }

    const result: WorkloadLevelConsistencyResult = {
      isConsistent,
      assessedLevel,
      estimatedLevelFromWorkload: estimatedLevel,
      levelDifference,
      recommendation,
    };

    return c.json({
      habitId,
      habitName: habit.name,
      ...result,
    });
  });

  // ---------------------------------------------------------------------------
  // GET /inventory/unassessed
  // Get all unassessed habits for inventory
  // Requirements: 3.1
  // ---------------------------------------------------------------------------
  router.get('/inventory/unassessed', async (c: Context) => {
    const { userId, supabase } = getAuthContext(c);

    logger.info('Getting unassessed habits for inventory', { userId });

    // Query all active habits where level IS NULL
    const { data: habits, error } = await supabase
      .from('habits')
      .select('id, name, frequency, workload_per_count, workload_unit, created_at')
      .eq('owner_type', 'user')
      .eq('owner_id', userId)
      .eq('active', true)
      .is('level', null)
      .order('created_at', { ascending: true });

    if (error) {
      throw new AppError(`Failed to get unassessed habits: ${error.message}`, 500, 'INTERNAL_ERROR');
    }

    // Get quota status
    const quotaService = new UsageQuotaService(supabase);
    const quotaResult = await quotaService.checkQuota(userId);

    return c.json({
      habits: habits ?? [],
      totalCount: habits?.length ?? 0,
      quotaStatus: {
        quotaUsed: quotaResult.status.quotaUsed,
        quotaLimit: quotaResult.status.quotaLimit,
        remaining: quotaResult.status.remaining,
        isUnlimited: quotaResult.status.isUnlimited,
      },
    });
  });

  // ---------------------------------------------------------------------------
  // POST /inventory/start
  // Start a batch inventory assessment
  // Requirements: 3.1, 3.2, 3.5
  // ---------------------------------------------------------------------------
  router.post('/inventory/start', async (c: Context) => {
    const { userId, supabase } = getAuthContext(c);

    logger.info('Starting habit inventory', { userId });

    // Parse request body
    const body = await c.req.json<{ habitIds?: string[] }>().catch(() => ({} as { habitIds?: string[] }));

    // Get quota status
    const quotaService = new UsageQuotaService(supabase);
    const quotaResult = await quotaService.checkQuota(userId);

    // Query unassessed habits
    let query = supabase
      .from('habits')
      .select('id, name, frequency, workload_per_count, workload_unit, goal_id')
      .eq('owner_type', 'user')
      .eq('owner_id', userId)
      .eq('active', true)
      .is('level', null);

    // If specific habit IDs provided, filter by them
    if (body.habitIds && body.habitIds.length > 0) {
      query = query.in('id', body.habitIds);
    }

    const { data: habits, error } = await query.order('created_at', { ascending: true });

    if (error) {
      throw new AppError(`Failed to get habits: ${error.message}`, 500, 'INTERNAL_ERROR');
    }

    const unassessedCount = habits?.length ?? 0;

    // Check quota (Requirement 3.5)
    if (!quotaResult.status.isUnlimited && quotaResult.status.remaining < unassessedCount) {
      return c.json({
        error: 'INSUFFICIENT_QUOTA',
        message: `評価回数が不足しています。残り${quotaResult.status.remaining}回ですが、${unassessedCount}件の習慣があります。`,
        quotaStatus: quotaResult.status,
        unassessedCount,
        requiresSelection: true,
      }, 400);
    }

    // Create inventory session ID
    const inventoryId = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    logger.info('Habit inventory started', {
      userId,
      inventoryId,
      habitCount: unassessedCount,
    });

    return c.json({
      inventoryId,
      habits: habits ?? [],
      totalCount: unassessedCount,
      quotaStatus: {
        quotaUsed: quotaResult.status.quotaUsed,
        quotaLimit: quotaResult.status.quotaLimit,
        remaining: quotaResult.status.remaining,
        isUnlimited: quotaResult.status.isUnlimited,
      },
      estimatedTimeSeconds: unassessedCount * 2, // 2 seconds per habit
    }, 201);
  });

  // ---------------------------------------------------------------------------
  // POST /inventory/:id/assess-next
  // Assess the next habit in the inventory
  // Requirements: 3.2, 3.3
  // ---------------------------------------------------------------------------
  router.post('/inventory/:id/assess-next', async (c: Context) => {
    const { userId, supabase } = getAuthContext(c);
    const inventoryId = c.req.param('id');

    if (!inventoryId) {
      throw new AppError('Inventory ID is required', 400, 'BAD_REQUEST');
    }

    // Parse request body
    const body = await c.req.json<{ habitId: string }>().catch(() => ({ habitId: '' }));

    if (!body.habitId) {
      throw new AppError('habitId is required', 400, 'BAD_REQUEST');
    }

    logger.info('Assessing next habit in inventory', { userId, inventoryId, habitId: body.habitId });

    // Validate habit ownership
    const habitRepo = new HabitRepository(supabase);
    await validateHabitOwnership(habitRepo, body.habitId, userId);

    // Check quota
    const quotaService = new UsageQuotaService(supabase);
    const quotaResult = await quotaService.checkQuota(userId);

    if (!quotaResult.allowed) {
      return c.json({
        error: 'QUOTA_EXCEEDED',
        message: '今月のTHLI-24評価回数の上限に達しました。',
        quotaStatus: quotaResult.status,
      }, 403);
    }

    try {
      // Get habit details
      const habit = await habitRepo.getById(body.habitId);
      if (!habit) {
        throw new AppError('Habit not found', 404, 'NOT_FOUND');
      }

      // Perform quick assessment based on habit metadata
      const quickAssessment = await performQuickAssessment(habit, supabase);

      // Consume quota
      await quotaService.consumeAssessment(userId);

      return c.json({
        success: true,
        habitId: body.habitId,
        habitName: habit.name,
        level: quickAssessment.level,
        levelTier: quickAssessment.tier,
        firewallTriggered: quickAssessment.firewallTriggered,
        voiQuestions: quickAssessment.voiQuestions,
      });
    } catch (error) {
      logger.error('Failed to assess habit in inventory', error as Error, {
        userId,
        inventoryId,
        habitId: body.habitId,
      });

      // Mark as pending_data if firewall triggered (Requirement 3.3)
      if ((error as Error).message?.includes('FIREWALL')) {
        return c.json({
          success: false,
          habitId: body.habitId,
          status: 'pending_data',
          message: 'データが不足しています。後で詳細な評価が必要です。',
        });
      }

      throw error;
    }
  });

  return router;
}

// Export router instance
export const levelRouter = createLevelRouter();
