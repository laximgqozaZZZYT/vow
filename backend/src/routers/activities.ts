/**
 * Activities Router
 *
 * Handles activity creation with experience point integration.
 * When a habit is completed (kind = 'complete'), experience points
 * are automatically awarded to the user.
 *
 * Requirements: 6.6, 13.1, 13.5
 */

import { Hono } from 'hono';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getLogger } from '../utils/logger.js';
import { ActivityRepository } from '../repositories/activityRepository.js';
import { HabitRepository } from '../repositories/habitRepository.js';
import {
  ExperienceCalculatorService,
  calculateExperiencePoints,
} from '../services/experienceCalculatorService.js';
import { activitySchema } from '../schemas/habit.js';

const logger = getLogger('activitiesRouter');

// =============================================================================
// Types
// =============================================================================

interface ActivityCreatePayload {
  kind: 'start' | 'complete' | 'skip' | 'pause' | 'partial';
  habitId: string;
  habitName?: string;
  timestamp?: string;
  amount?: number;
  prevCount?: number;
  newCount?: number;
  durationSeconds?: number;
  memo?: string;
}

interface ExperienceAwardResponse {
  totalPointsAwarded: number;
  domainUpdates: Array<{
    domainCode: string;
    domainName: string;
    oldExpertiseLevel: number;
    newExpertiseLevel: number;
    levelChanged: boolean;
  }>;
  levelChanges: Array<{
    type: 'expertise' | 'overall';
    domainCode?: string;
    domainName?: string;
    oldLevel: number;
    newLevel: number;
  }>;
}

// =============================================================================
// Router
// =============================================================================

export function createActivitiesRouter(supabase: SupabaseClient) {
  const router = new Hono();
  const activityRepo = new ActivityRepository(supabase);
  const habitRepo = new HabitRepository(supabase);
  const experienceService = new ExperienceCalculatorService(supabase);

  /**
   * POST /activities
   *
   * Create a new activity. If the activity is a completion (kind = 'complete'),
   * experience points are automatically awarded.
   *
   * Requirements: 6.6, 13.1
   */
  router.post('/', async (c) => {
    try {
      const userId = c.get('userId') as string;
      if (!userId) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const payload = await c.req.json<ActivityCreatePayload>();
      logger.info('Creating activity', {
        userId,
        habitId: payload.habitId,
        kind: payload.kind,
      });

      // Validate payload
      if (!payload.habitId || !payload.kind) {
        return c.json({ error: 'habitId and kind are required' }, 400);
      }

      // Get habit details for experience calculation
      const habit = await habitRepo.getById(payload.habitId);
      if (!habit) {
        return c.json({ error: 'Habit not found' }, 404);
      }

      // Create activity record
      const activityData = {
        kind: payload.kind,
        habit_id: payload.habitId,
        habit_name: payload.habitName ?? habit.name,
        timestamp: payload.timestamp ?? new Date().toISOString(),
        amount: payload.amount ?? 1,
        prev_count: payload.prevCount,
        new_count: payload.newCount,
        duration_seconds: payload.durationSeconds,
        memo: payload.memo,
        owner_type: 'user',
        owner_id: userId,
        date: new Date(payload.timestamp ?? new Date()).toISOString().split('T')[0],
        completed: payload.kind === 'complete',
      };

      const activity = await activityRepo.create(activityData);

      // Award experience points if this is a completion
      let experienceAward: ExperienceAwardResponse | null = null;
      if (payload.kind === 'complete') {
        experienceAward = await awardExperienceForCompletion(
          experienceService,
          activityRepo,
          userId,
          habit,
          activity.id
        );
      }

      logger.info('Activity created successfully', {
        userId,
        activityId: activity.id,
        kind: payload.kind,
        experienceAwarded: experienceAward?.totalPointsAwarded ?? 0,
      });

      return c.json({
        activity: {
          id: activity.id,
          kind: activity.kind,
          habitId: activity.habit_id,
          habitName: activity.habit_name,
          timestamp: activity.timestamp,
          amount: activity.amount,
          prevCount: activity.prev_count,
          newCount: activity.new_count,
          durationSeconds: activity.duration_seconds,
        },
        experienceAward,
      });
    } catch (error) {
      logger.error('Failed to create activity', error as Error);
      return c.json({ error: 'Failed to create activity' }, 500);
    }
  });

  return router;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Award experience points for a habit completion.
 *
 * Requirements: 6.6, 13.1, 13.5
 *
 * @param experienceService - Experience calculator service
 * @param activityRepo - Activity repository
 * @param userId - User ID
 * @param habit - Habit record
 * @param activityId - Activity ID for logging
 * @returns Experience award result
 */
async function awardExperienceForCompletion(
  experienceService: ExperienceCalculatorService,
  activityRepo: ActivityRepository,
  userId: string,
  habit: any,
  activityId: string
): Promise<ExperienceAwardResponse> {
  logger.info('Awarding experience for habit completion', {
    userId,
    habitId: habit.id,
    habitName: habit.name,
    habitLevel: habit.level,
    domainCodes: habit.domain_codes,
  });

  // Get streak for bonus calculation
  const streak = await calculateStreak(activityRepo, habit.id);

  // Calculate experience points
  const xp = calculateExperiencePoints(habit.level, streak);

  // Get domain codes (use General if none mapped)
  const domainCodes: string[] = habit.domain_codes ?? [];

  // Award experience points
  const result = await experienceService.awardExperiencePoints(
    userId,
    habit.id,
    domainCodes,
    xp
  );

  // Log experience award for audit (Property 16: Experience Log Completeness)
  for (const update of result.domainUpdates) {
    await experienceService.logExperienceAward({
      userId,
      habitId: habit.id,
      activityId,
      domainCode: update.domainCode,
      pointsAwarded: update.newExperiencePoints - update.oldExperiencePoints,
      habitLevel: habit.level,
      qualityMultiplier: 1.0, // Normal completion
      frequencyBonus: 1.0, // First completion (simplified)
    });
  }

  return result;
}

/**
 * Calculate current streak for a habit.
 *
 * @param activityRepo - Activity repository
 * @param habitId - Habit ID
 * @returns Current streak in days
 */
async function calculateStreak(
  activityRepo: ActivityRepository,
  habitId: string
): Promise<number> {
  try {
    const activities = await activityRepo.getHabitActivities(habitId, 'complete', 365);

    if (activities.length === 0) {
      return 0;
    }

    // Sort by timestamp descending
    const sorted = activities.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    let streak = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    for (const activity of sorted) {
      const activityDate = new Date(activity.timestamp);
      activityDate.setHours(0, 0, 0, 0);

      const diffDays = Math.floor(
        (currentDate.getTime() - activityDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (diffDays === 0 || diffDays === 1) {
        streak++;
        currentDate = activityDate;
      } else {
        break;
      }
    }

    return streak;
  } catch (error) {
    logger.warning('Failed to calculate streak', { error: String(error), habitId });
    return 0;
  }
}
