/**
 * User Level Router
 *
 * ユーザーレベルシステム関連のAPIエンドポイント
 *
 * Requirements:
 * - 12.1: GET /api/users/:id/level - ユーザーの総合レベル情報
 * - 12.2: GET /api/users/:id/expertise - ユーザーの専門性一覧
 * - 12.3: GET /api/users/:id/expertise/:domain_code - 特定ドメインの詳細
 * - 12.4: GET /api/users/:id/level-history - レベル変更履歴
 * - 2.4: GET /api/domains - 職業分類ドメイン一覧
 * - 2.5: GET /api/domains/search - キーワードでドメインを検索
 * - 3.7: POST /api/habits/:id/suggest-domains - AIによるドメイン提案
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getLogger } from '../utils/logger.js';
import { AppError } from '../errors/index.js';
import { DomainMappingService } from '../services/domainMappingService.js';
import {
  UserLevelRepository,
  UserExpertiseRepository,
  UserLevelHistoryRepository,
  type LevelHistoryFilters,
} from '../repositories/userLevelRepository.js';
import { HabitRepository } from '../repositories/habitRepository.js';

const logger = getLogger('userLevelRouter');

// =============================================================================
// Types
// =============================================================================

interface AuthContext {
  userId: string;
  supabase: SupabaseClient;
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
    throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  }

  return { userId, supabase };
}

/**
 * Validate that the requested user ID matches the authenticated user
 */
function validateUserAccess(requestedUserId: string, authenticatedUserId: string): void {
  if (requestedUserId !== authenticatedUserId) {
    throw new AppError('FORBIDDEN', 'You can only access your own data', 403);
  }
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
    throw new AppError('NOT_FOUND', 'Habit not found', 404);
  }

  if (habit.owner_id !== userId) {
    throw new AppError('FORBIDDEN', 'You do not have access to this habit', 403);
  }
}

// =============================================================================
// Router Factory
// =============================================================================

/**
 * Create user level router
 */
export function createUserLevelRouter(): Hono {
  const router = new Hono();

  // ---------------------------------------------------------------------------
  // GET /users/:id/level
  // Get user's overall level information
  // Requirements: 12.1
  // ---------------------------------------------------------------------------
  router.get('/users/:id/level', async (c: Context) => {
    const { userId, supabase } = getAuthContext(c);
    const requestedUserId = c.req.param('id');

    if (!requestedUserId) {
      throw new AppError('BAD_REQUEST', 'User ID is required', 400);
    }

    // Users can only access their own level data
    validateUserAccess(requestedUserId, userId);

    logger.info('Getting user level', { userId: requestedUserId });

    const userLevelRepo = new UserLevelRepository(supabase);
    const userLevel = await userLevelRepo.getByUserId(requestedUserId);

    if (!userLevel) {
      // Return default level for users without a record
      return c.json({
        userId: requestedUserId,
        overallLevel: 0,
        overallTier: 'beginner',
        habitContinuityPower: 0,
        resilienceScore: 50,
        totalExperiencePoints: 0,
        lastCalculatedAt: null,
      });
    }

    return c.json({
      userId: userLevel.user_id,
      overallLevel: userLevel.overall_level,
      overallTier: userLevel.overall_tier,
      habitContinuityPower: userLevel.habit_continuity_power,
      resilienceScore: userLevel.resilience_score,
      totalExperiencePoints: userLevel.total_experience_points,
      lastCalculatedAt: userLevel.last_calculated_at,
    });
  });

  // ---------------------------------------------------------------------------
  // GET /users/:id/expertise
  // Get user's expertise list
  // Requirements: 12.2
  // ---------------------------------------------------------------------------
  router.get('/users/:id/expertise', async (c: Context) => {
    const { userId, supabase } = getAuthContext(c);
    const requestedUserId = c.req.param('id');

    if (!requestedUserId) {
      throw new AppError('BAD_REQUEST', 'User ID is required', 400);
    }

    // Users can only access their own expertise data
    validateUserAccess(requestedUserId, userId);

    logger.info('Getting user expertise list', { userId: requestedUserId });

    // Get query parameters
    const sortBy = c.req.query('sortBy') ?? 'level'; // 'level' or 'activity'
    const limit = parseInt(c.req.query('limit') ?? '50', 10);

    const expertiseRepo = new UserExpertiseRepository(supabase);
    const expertise = await expertiseRepo.getByUserId(
      requestedUserId,
      sortBy === 'level'
    );

    // Apply limit
    const limitedExpertise = expertise.slice(0, limit);

    return c.json({
      userId: requestedUserId,
      expertise: limitedExpertise.map((e) => ({
        domainCode: e.domain_code,
        domainName: e.domain_name,
        expertiseLevel: e.expertise_level,
        expertiseTier: e.expertise_tier,
        experiencePoints: e.experience_points,
        habitCount: e.habit_count,
        lastActivityAt: e.last_activity_at,
      })),
      totalCount: expertise.length,
    });
  });

  // ---------------------------------------------------------------------------
  // GET /users/:id/expertise/:domain_code
  // Get specific domain expertise details
  // Requirements: 12.3
  // ---------------------------------------------------------------------------
  router.get('/users/:id/expertise/:domain_code', async (c: Context) => {
    const { userId, supabase } = getAuthContext(c);
    const requestedUserId = c.req.param('id');
    const domainCode = c.req.param('domain_code');

    if (!requestedUserId) {
      throw new AppError('BAD_REQUEST', 'User ID is required', 400);
    }

    if (!domainCode) {
      throw new AppError('BAD_REQUEST', 'Domain code is required', 400);
    }

    // Users can only access their own expertise data
    validateUserAccess(requestedUserId, userId);

    logger.info('Getting domain expertise details', {
      userId: requestedUserId,
      domainCode,
    });

    const expertiseRepo = new UserExpertiseRepository(supabase);
    const expertise = await expertiseRepo.getByDomain(requestedUserId, domainCode);

    if (!expertise) {
      throw new AppError('NOT_FOUND', 'Expertise record not found for this domain', 404);
    }

    // Get domain details
    const domainService = new DomainMappingService(supabase);
    const domain = await domainService.getDomainByCode(domainCode);

    // Get history for this domain
    const historyRepo = new UserLevelHistoryRepository(supabase);
    const history = await historyRepo.getByDomain(requestedUserId, domainCode, 10);

    return c.json({
      userId: requestedUserId,
      domainCode: expertise.domain_code,
      domainName: expertise.domain_name,
      expertiseLevel: expertise.expertise_level,
      expertiseTier: expertise.expertise_tier,
      experiencePoints: expertise.experience_points,
      habitCount: expertise.habit_count,
      taskCount: expertise.task_count,
      lastActivityAt: expertise.last_activity_at,
      domain: domain
        ? {
            majorCode: domain.majorCode,
            majorName: domain.majorName,
            middleCode: domain.middleCode,
            middleName: domain.middleName,
            minorCode: domain.minorCode,
            minorName: domain.minorName,
          }
        : null,
      recentHistory: history.map((h) => ({
        id: h.id,
        changeType: h.change_type,
        oldLevel: h.old_level,
        newLevel: h.new_level,
        changeReason: h.change_reason,
        createdAt: h.created_at,
      })),
    });
  });

  // ---------------------------------------------------------------------------
  // GET /users/:id/level-history
  // Get user's level change history
  // Requirements: 12.4
  // ---------------------------------------------------------------------------
  router.get('/users/:id/level-history', async (c: Context) => {
    const { userId, supabase } = getAuthContext(c);
    const requestedUserId = c.req.param('id');

    if (!requestedUserId) {
      throw new AppError('BAD_REQUEST', 'User ID is required', 400);
    }

    // Users can only access their own history
    validateUserAccess(requestedUserId, userId);

    logger.info('Getting user level history', { userId: requestedUserId });

    // Get query parameters for filtering
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');
    const changeType = c.req.query('changeType') as
      | 'all'
      | 'overall'
      | 'expertise'
      | 'continuity'
      | 'resilience'
      | undefined;
    const limit = parseInt(c.req.query('limit') ?? '50', 10);

    // Build filters
    const filters: LevelHistoryFilters = {
      limit,
    };

    if (startDate && endDate) {
      filters.dateRange = {
        start: new Date(startDate),
        end: new Date(endDate),
      };
    }

    if (changeType && changeType !== 'all') {
      filters.changeType = changeType;
    }

    const historyRepo = new UserLevelHistoryRepository(supabase);
    const history = await historyRepo.getByUserId(requestedUserId, filters);

    return c.json({
      userId: requestedUserId,
      history: history.map((h) => ({
        id: h.id,
        changeType: h.change_type,
        domainCode: h.domain_code,
        oldLevel: h.old_level,
        newLevel: h.new_level,
        changeReason: h.change_reason,
        metricsSnapshot: h.metrics_snapshot,
        createdAt: h.created_at,
      })),
      totalCount: history.length,
    });
  });

  // ---------------------------------------------------------------------------
  // GET /domains
  // Get occupation domain list with pagination
  // Requirements: 2.4
  // ---------------------------------------------------------------------------
  router.get('/domains', async (c: Context) => {
    const { supabase } = getAuthContext(c);

    logger.info('Getting domain list');

    // Get query parameters
    const page = parseInt(c.req.query('page') ?? '1', 10);
    const pageSize = parseInt(c.req.query('pageSize') ?? '50', 10);
    const majorCode = c.req.query('majorCode');

    const domainService = new DomainMappingService(supabase);
    const result = await domainService.getAllDomains({
      page,
      pageSize,
      majorCode,
    });

    return c.json({
      domains: result.domains.map((d) => ({
        id: d.id,
        majorCode: d.majorCode,
        majorName: d.majorName,
        middleCode: d.middleCode,
        middleName: d.middleName,
        minorCode: d.minorCode,
        minorName: d.minorName,
        keywords: d.keywords,
      })),
      pagination: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        hasMore: result.hasMore,
      },
    });
  });

  // ---------------------------------------------------------------------------
  // GET /domains/search
  // Search domains by keyword
  // Requirements: 2.5
  // ---------------------------------------------------------------------------
  router.get('/domains/search', async (c: Context) => {
    const { supabase } = getAuthContext(c);

    const query = c.req.query('q');

    if (!query || query.trim().length === 0) {
      throw new AppError('BAD_REQUEST', 'Search query is required', 400);
    }

    logger.info('Searching domains', { query });

    const domainService = new DomainMappingService(supabase);
    const domains = await domainService.searchDomains(query.trim());

    return c.json({
      query,
      domains: domains.map((d) => ({
        id: d.id,
        majorCode: d.majorCode,
        majorName: d.majorName,
        middleCode: d.middleCode,
        middleName: d.middleName,
        minorCode: d.minorCode,
        minorName: d.minorName,
        keywords: d.keywords,
      })),
      totalCount: domains.length,
    });
  });

  // ---------------------------------------------------------------------------
  // POST /habits/:id/suggest-domains
  // Get AI domain suggestions for a habit
  // Requirements: 3.7
  // ---------------------------------------------------------------------------
  router.post('/habits/:id/suggest-domains', async (c: Context) => {
    const { userId, supabase } = getAuthContext(c);
    const habitId = c.req.param('id');

    if (!habitId) {
      throw new AppError('BAD_REQUEST', 'Habit ID is required', 400);
    }

    logger.info('Getting domain suggestions for habit', { userId, habitId });

    // Validate habit ownership
    const habitRepo = new HabitRepository(supabase);
    await validateHabitOwnership(habitRepo, habitId, userId);

    // Get habit details
    const habit = await habitRepo.getById(habitId);
    if (!habit) {
      throw new AppError('NOT_FOUND', 'Habit not found', 404);
    }

    // Get domain suggestions
    const domainService = new DomainMappingService(supabase);
    const suggestions = await domainService.suggestDomains(
      habit.name,
      habit.notes ?? null
    );

    return c.json({
      habitId,
      habitName: habit.name,
      suggestions: suggestions.map((s) => ({
        domainCode: s.domainCode,
        domainName: s.domainName,
        majorCategory: s.majorCategory,
        confidence: s.confidence,
        reason: s.reason,
      })),
      totalCount: suggestions.length,
    });
  });

  // ---------------------------------------------------------------------------
  // PUT /habits/:id/domains
  // Update habit's domain codes
  // Requirements: 3.3, 3.4
  // ---------------------------------------------------------------------------
  router.put('/habits/:id/domains', async (c: Context) => {
    const { userId, supabase } = getAuthContext(c);
    const habitId = c.req.param('id');

    if (!habitId) {
      throw new AppError('BAD_REQUEST', 'Habit ID is required', 400);
    }

    // Parse request body
    const body = await c.req.json<{ domainCodes: string[] }>();

    if (!body.domainCodes || !Array.isArray(body.domainCodes)) {
      throw new AppError('BAD_REQUEST', 'domainCodes array is required', 400);
    }

    // Validate max 3 domains
    if (body.domainCodes.length > 3) {
      throw new AppError('BAD_REQUEST', 'Maximum 3 domains allowed per habit', 400);
    }

    logger.info('Updating habit domains', {
      userId,
      habitId,
      domainCodes: body.domainCodes,
    });

    // Validate habit ownership
    const habitRepo = new HabitRepository(supabase);
    await validateHabitOwnership(habitRepo, habitId, userId);

    // Validate domain codes exist
    if (body.domainCodes.length > 0) {
      const domainService = new DomainMappingService(supabase);
      for (const code of body.domainCodes) {
        if (code !== '000') {
          // Skip validation for General domain
          const domain = await domainService.getDomainByCode(code);
          if (!domain) {
            throw new AppError('BAD_REQUEST', `Invalid domain code: ${code}`, 400);
          }
        }
      }
    }

    // Update habit
    const { error } = await supabase
      .from('habits')
      .update({
        domain_codes: body.domainCodes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', habitId);

    if (error) {
      throw new AppError('INTERNAL_ERROR', `Failed to update habit: ${error.message}`, 500);
    }

    // Get updated habit
    const updatedHabit = await habitRepo.getById(habitId);

    return c.json({
      success: true,
      habitId,
      domainCodes: updatedHabit?.domain_codes ?? [],
      message: 'ドメインを更新しました。',
    });
  });

  return router;
}

// Export router instance
export const userLevelRouter = createUserLevelRouter();
