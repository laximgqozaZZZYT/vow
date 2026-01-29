/**
 * XP Recovery Service
 *
 * Recalculates experience points from all completed activities.
 * This service calculates total XP by summing up XP from all completed activities,
 * ensuring no duplicate counting.
 *
 * Key Features:
 * - Calculates total XP from ALL completed activities (no incremental updates)
 * - Simple formula: habit_level * 10 per completion
 * - Overwrites total_experience_points (no accumulation/duplication)
 * - Recalculates user level from total XP
 * - Calculates tag-based skill levels from habit tags
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getLogger } from '../utils/logger.js';
import { ActivityRepository } from '../repositories/activityRepository.js';
import { JobExecutionLogRepository } from '../repositories/jobExecutionLogRepository.js';
import { UserLevelRepository } from '../repositories/userLevelRepository.js';
import { TagRepository, type TagWithXP } from '../repositories/tagRepository.js';

const logger = getLogger('xpRecoveryService');

// =============================================================================
// Constants
// =============================================================================

/** Default habit level when not assessed */
const DEFAULT_HABIT_LEVEL = 50;

/** XP multiplier per habit level */
const XP_PER_LEVEL = 10;

// =============================================================================
// Types
// =============================================================================

/**
 * Result of XP recalculation for a user.
 */
export interface RecoveryResult {
  /** User ID that was processed */
  userId: string;
  /** Total XP calculated from all activities */
  totalXPAwarded: number;
  /** Number of activities processed */
  activitiesProcessed: number;
  /** Number of activities skipped (none in new implementation) */
  activitiesSkipped: number;
  /** Errors encountered during processing */
  errors: RecoveryError[];
  /** When processing started */
  startedAt: Date;
  /** When processing completed */
  completedAt: Date;
  /** Calculated user level */
  userLevel?: number;
  /** Tag-based skill levels */
  skillLevels?: TagWithXP[];
}

/**
 * Error information for failed processing.
 */
export interface RecoveryError {
  /** Activity ID that failed */
  activityId: string;
  /** Error message */
  message: string;
  /** When the error occurred */
  timestamp: Date;
}

// =============================================================================
// XPRecoveryService Class
// =============================================================================

/**
 * XP Recovery Service
 *
 * Recalculates total XP from all completed activities.
 * Formula: SUM(habit_level * 10) for each completed activity
 */
export class XPRecoveryService {
  private readonly supabase: SupabaseClient;
  private readonly activityRepo: ActivityRepository;
  private readonly jobLogRepo: JobExecutionLogRepository;
  private readonly userLevelRepo: UserLevelRepository;
  private readonly tagRepo: TagRepository;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.activityRepo = new ActivityRepository(supabase);
    this.jobLogRepo = new JobExecutionLogRepository(supabase);
    this.userLevelRepo = new UserLevelRepository(supabase);
    this.tagRepo = new TagRepository(supabase);

    logger.info('XPRecoveryService initialized');
  }

  /**
   * Recalculate total XP for a user from all completed activities.
   *
   * This method:
   * 1. Gets ALL completed activities for the user
   * 2. Calculates XP for each: habit_level * 10
   * 3. Sums up total XP
   * 4. Calculates user level from total XP
   * 5. Overwrites user_levels with new values
   *
   * @param userId - The user ID to recalculate XP for
   * @returns Recovery result with total XP and level
   */
  async recalculateForUser(userId: string): Promise<RecoveryResult> {
    const startedAt = new Date();
    logger.info('Starting XP recalculation for user', { userId });

    const errors: RecoveryError[] = [];
    let totalXP = 0;
    let activitiesProcessed = 0;
    let jobId: string | undefined;
    let userLevel = 0;

    try {
      // 1. Start job log
      jobId = await this.jobLogRepo.startJob('xp_recovery_single', { userId });
      logger.debug('Job log started', { jobId, userId });

      // 2. Get ALL completed activities for the user
      const activities = await this.activityRepo.getCompletedActivities(userId);
      logger.info('Retrieved completed activities', {
        userId,
        activityCount: activities.length,
      });

      // 3. Calculate total XP from all activities
      for (const activity of activities) {
        try {
          const habitLevel = activity.habit?.thliLevel ?? DEFAULT_HABIT_LEVEL;
          const xp = habitLevel * XP_PER_LEVEL;
          totalXP += xp;
          activitiesProcessed++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          errors.push({
            activityId: activity.id,
            message: errorMessage,
            timestamp: new Date(),
          });
          logger.warning('Failed to calculate XP for activity', {
            activityId: activity.id,
            error: errorMessage,
          });
        }
      }

      logger.info('Total XP calculated', {
        userId,
        totalXP,
        activitiesProcessed,
      });

      // 4. Calculate user level from total XP
      // Formula: min(199, floor(10 * log2(xp / 100 + 1)))
      userLevel = this.calculateLevelFromXP(totalXP);
      const userTier = this.calculateTier(userLevel);

      logger.info('User level calculated', {
        userId,
        totalXP,
        userLevel,
        userTier,
      });

      // 5. Update user_levels with total XP and level (single update)
      await this.updateUserLevel(userId, totalXP, userLevel, userTier);

      logger.info('User level updated successfully', {
        userId,
        totalXP,
        userLevel,
        userTier,
      });

      // 6. Calculate tag-based skill levels
      const skillLevels = await this.calculateSkillLevels(userId, activities);
      logger.info('Skill levels calculated', {
        userId,
        skillCount: skillLevels.length,
      });

      // 7. Complete job log
      await this.jobLogRepo.completeJob(jobId, {
        activitiesProcessed,
        xpAwarded: totalXP,
        skipped: 0,
        errors: errors.map((e) => ({ activityId: e.activityId, message: e.message })),
      });

      const completedAt = new Date();

      return {
        userId,
        totalXPAwarded: totalXP,
        activitiesProcessed,
        activitiesSkipped: 0,
        errors,
        startedAt,
        completedAt,
        userLevel,
        skillLevels,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('XP recalculation failed for user', error as Error, { userId });

      if (jobId) {
        try {
          await this.jobLogRepo.failJob(jobId, [{ message: errorMessage }]);
        } catch (logError) {
          logger.error('Failed to record job failure', logError as Error, { jobId });
        }
      }

      errors.push({
        activityId: 'system',
        message: errorMessage,
        timestamp: new Date(),
      });

      const completedAt = new Date();

      return {
        userId,
        totalXPAwarded: totalXP,
        activitiesProcessed,
        activitiesSkipped: 0,
        errors,
        startedAt,
        completedAt,
        userLevel,
      };
    }
  }

  /**
   * Calculate tag-based skill levels from completed activities.
   *
   * For each tag associated with habits, calculates:
   * - Total XP from all activities of habits with that tag
   * - Activity count
   * - Skill level using the same formula as user level
   *
   * @param userId - The user ID
   * @param activities - Completed activities with habit info
   * @returns Array of tag skill levels
   */
  private async calculateSkillLevels(
    userId: string,
    activities: { habitId: string; habit: { thliLevel: number | null } }[]
  ): Promise<TagWithXP[]> {
    // Get habit-tag associations for the user
    const habitTagMap = await this.tagRepo.getHabitTagsForUser(userId);
    
    if (habitTagMap.size === 0) {
      return [];
    }

    // Calculate XP per tag
    const tagXPMap = new Map<string, { totalXP: number; activityCount: number }>();
    
    for (const activity of activities) {
      const tagIds = habitTagMap.get(activity.habitId);
      if (!tagIds || tagIds.length === 0) {
        continue;
      }

      const habitLevel = activity.habit?.thliLevel ?? DEFAULT_HABIT_LEVEL;
      const xp = habitLevel * XP_PER_LEVEL;

      for (const tagId of tagIds) {
        const current = tagXPMap.get(tagId) ?? { totalXP: 0, activityCount: 0 };
        current.totalXP += xp;
        current.activityCount += 1;
        tagXPMap.set(tagId, current);
      }
    }

    if (tagXPMap.size === 0) {
      return [];
    }

    // Get tag details
    const tagIds = Array.from(tagXPMap.keys());
    const tagDetails = await this.tagRepo.getTagsByIds(tagIds);

    // Build result with skill levels
    const skillLevels: TagWithXP[] = [];
    
    for (const [tagId, xpData] of tagXPMap) {
      const tag = tagDetails.get(tagId);
      if (!tag) {
        continue;
      }

      skillLevels.push({
        tagId,
        tagName: tag.name,
        tagColor: tag.color,
        totalXP: xpData.totalXP,
        activityCount: xpData.activityCount,
        level: this.calculateLevelFromXP(xpData.totalXP),
      });
    }

    // Sort by XP descending
    skillLevels.sort((a, b) => b.totalXP - a.totalXP);

    return skillLevels;
  }

  /**
   * Calculate level from experience points using logarithmic formula.
   * Formula: min(199, floor(10 * log2(xp / 100 + 1)))
   *
   * @param xp - Total experience points
   * @returns Level (0-199)
   */
  private calculateLevelFromXP(xp: number): number {
    if (xp <= 0) return 0;
    return Math.min(199, Math.floor(10 * Math.log2(xp / 100 + 1)));
  }

  /**
   * Calculate tier from level.
   * beginner: 0-49, intermediate: 50-99, advanced: 100-149, expert: 150-199
   */
  private calculateTier(level: number): 'beginner' | 'intermediate' | 'advanced' | 'expert' {
    if (level < 50) return 'beginner';
    if (level < 100) return 'intermediate';
    if (level < 150) return 'advanced';
    return 'expert';
  }

  /**
   * Update user level record with total XP and calculated level.
   *
   * @param userId - The user ID
   * @param totalXP - Total XP to set
   * @param level - Calculated level
   * @param tier - Calculated tier
   */
  private async updateUserLevel(
    userId: string,
    totalXP: number,
    level: number,
    tier: 'beginner' | 'intermediate' | 'advanced' | 'expert'
  ): Promise<void> {
    // Get current user level record
    const currentLevel = await this.userLevelRepo.getByUserId(userId);

    if (currentLevel) {
      // Update existing record
      await this.userLevelRepo.updateMetrics(userId, {
        totalExperiencePoints: totalXP,
        overallLevel: level,
        overallTier: tier,
      });
    } else {
      // Create new record if doesn't exist
      await this.userLevelRepo.upsert(userId, {
        overall_level: level,
        overall_tier: tier,
        habit_continuity_power: 0,
        resilience_score: 50,
        total_experience_points: totalXP,
        last_calculated_at: new Date().toISOString(),
      });
    }

    logger.info('User level record updated', { userId, totalXP, level, tier });
  }

  /**
   * Recalculate XP for all users.
   *
   * @returns Aggregated recovery result
   */
  async recalculateForAllUsers(): Promise<RecoveryResult> {
    const startedAt = new Date();
    logger.info('Starting XP recalculation for all users');

    const errors: RecoveryError[] = [];
    let totalXP = 0;
    let activitiesProcessed = 0;
    let jobId: string | undefined;

    try {
      jobId = await this.jobLogRepo.startJob('xp_recovery', {
        type: 'all_users',
        startedAt: startedAt.toISOString(),
      });

      // Get all user IDs with completed activities
      const userIds = await this.getAllUserIds();
      logger.info('Found users with completed activities', { userCount: userIds.length });

      for (const userId of userIds) {
        try {
          const result = await this.recalculateForUser(userId);
          totalXP += result.totalXPAwarded;
          activitiesProcessed += result.activitiesProcessed;
          errors.push(...result.errors);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          errors.push({
            activityId: `user:${userId}`,
            message: errorMessage,
            timestamp: new Date(),
          });
        }
      }

      await this.jobLogRepo.completeJob(jobId, {
        activitiesProcessed,
        xpAwarded: totalXP,
        skipped: 0,
        errors: errors.map((e) => ({ activityId: e.activityId, message: e.message })),
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('XP recalculation for all users failed', error as Error);

      if (jobId) {
        try {
          await this.jobLogRepo.failJob(jobId, [{ message: errorMessage }]);
        } catch (logError) {
          logger.error('Failed to record job failure', logError as Error, { jobId });
        }
      }

      errors.push({
        activityId: 'system',
        message: errorMessage,
        timestamp: new Date(),
      });
    }

    return {
      userId: 'all',
      totalXPAwarded: totalXP,
      activitiesProcessed,
      activitiesSkipped: 0,
      errors,
      startedAt,
      completedAt: new Date(),
    };
  }

  /**
   * Get all distinct user IDs with completed activities.
   */
  private async getAllUserIds(): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('activities')
      .select('owner_id')
      .eq('owner_type', 'user')
      .eq('kind', 'complete');

    if (error || !data) {
      logger.error('Failed to fetch user IDs', error);
      return [];
    }

    const userIdSet = new Set<string>();
    for (const row of data) {
      if (row.owner_id) {
        userIdSet.add(row.owner_id as string);
      }
    }

    return Array.from(userIdSet);
  }

  // Getters for repositories (for testing)
  get activityRepository(): ActivityRepository {
    return this.activityRepo;
  }

  get jobExecutionLogRepository(): JobExecutionLogRepository {
    return this.jobLogRepo;
  }

  get userLevelRepository(): UserLevelRepository {
    return this.userLevelRepo;
  }
}
