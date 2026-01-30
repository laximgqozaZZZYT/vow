/**
 * User Level Service
 *
 * Manages user level calculation and tracking including:
 * - Overall user level (0-9999 with rebalancing, 0-199 legacy)
 * - Habit continuity power (0-100)
 * - Resilience score (0-100)
 * - Expertise levels per domain
 *
 * Requirements: 1.6, 4.1, 5.1, 7.1, 15.1
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getLogger } from '../utils/logger.js';
import { HabitRepository } from '../repositories/habitRepository.js';
import { ActivityRepository } from '../repositories/activityRepository.js';
import { LevelConfigService, type TierBoundaries } from './levelConfigService.js';
import {
  UserLevelRepository,
  UserExpertiseRepository,
  UserLevelHistoryRepository,
  type UserLevelRecord,
  type LevelTier,
  type MetricsSnapshot,
} from '../repositories/userLevelRepository.js';

const logger = getLogger('userLevelService');

// =============================================================================
// Constants
// =============================================================================

/** Days to analyze for completion rate calculation */
const COMPLETION_RATE_DAYS = 30;

/** Days to analyze for active habit ratio */
const ACTIVE_HABIT_DAYS = 7;

/** Days to analyze for resilience metrics */
const RESILIENCE_ANALYSIS_DAYS = 90;

/** Minimum consecutive misses to count as a break */
const MIN_BREAK_MISSES = 3;

/** Default resilience score for new users */
const DEFAULT_RESILIENCE_SCORE = 50;

/** Threshold for recording continuity changes in history */
const CONTINUITY_CHANGE_THRESHOLD = 5;

/** Legacy maximum level (before rebalancing) */
const LEGACY_MAX_LEVEL = 199;

/** New maximum level (after rebalancing) */
const NEW_MAX_LEVEL = 9999;

/**
 * Legacy tier boundaries (before rebalancing)
 * - beginner: 0-49
 * - intermediate: 50-99
 * - advanced: 100-149
 * - expert: 150-199
 */
const LEGACY_TIER_BOUNDARIES: TierBoundaries = {
  beginner: { min: 0, max: 49 },
  intermediate: { min: 50, max: 99 },
  advanced: { min: 100, max: 149 },
  expert: { min: 150, max: 199 },
};

/**
 * New tier boundaries (after rebalancing)
 * - beginner: 0-49
 * - intermediate: 50-99
 * - advanced: 100-499
 * - expert: 500-9999
 * 
 * Requirements: 1.6
 */
const NEW_TIER_BOUNDARIES: TierBoundaries = {
  beginner: { min: 0, max: 49 },
  intermediate: { min: 50, max: 99 },
  advanced: { min: 100, max: 499 },
  expert: { min: 500, max: 9999 },
};

// =============================================================================
// Types
// =============================================================================

/**
 * User level data returned by the service
 */
export interface UserLevel {
  id: string;
  userId: string;
  overallLevel: number;
  overallTier: LevelTier;
  habitContinuityPower: number;
  resilienceScore: number;
  totalExperiencePoints: number;
  lastCalculatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Continuity metrics for habit continuity power calculation
 */
export interface ContinuityMetrics {
  weightedStreakScore: number;
  completionRate30d: number;
  activeHabitRatio: number;
}

/**
 * Resilience metrics for resilience score calculation
 */
export interface ResilienceMetrics {
  recoveryRate: number;
  bounceBackCount: number;
  streakRecoveryRatio: number;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Calculate level tier from level value.
 * 
 * Property 1: Level Tier Calculation Correctness
 * 
 * Legacy boundaries (useNewBoundaries = false):
 * - beginner: 0-49
 * - intermediate: 50-99
 * - advanced: 100-149
 * - expert: 150-199
 * 
 * New boundaries (useNewBoundaries = true):
 * - beginner: 0-49
 * - intermediate: 50-99
 * - advanced: 100-499
 * - expert: 500-9999
 *
 * Requirements: 1.6
 *
 * @param level - Level value (0-199 legacy, 0-9999 new)
 * @param useNewBoundaries - Whether to use new tier boundaries (default: false for backward compatibility)
 * @returns Level tier
 */
export function calculateTier(level: number, useNewBoundaries = false): LevelTier {
  const boundaries = useNewBoundaries ? NEW_TIER_BOUNDARIES : LEGACY_TIER_BOUNDARIES;
  
  if (level >= boundaries.expert.min) {
    return 'expert';
  }
  if (level >= boundaries.advanced.min) {
    return 'advanced';
  }
  if (level >= boundaries.intermediate.min) {
    return 'intermediate';
  }
  return 'beginner';
}

/**
 * Clamp a level value to the valid range.
 * 
 * Legacy range: [0, 199]
 * New range: [0, 9999]
 *
 * Property 12: Level Value Clamping
 * Requirements: 1.6
 *
 * @param level - Raw level value
 * @param useNewMaxLevel - Whether to use new max level of 9999 (default: false for backward compatibility)
 * @returns Clamped level value
 */
export function clampLevel(level: number, useNewMaxLevel = false): number {
  const maxLevel = useNewMaxLevel ? NEW_MAX_LEVEL : LEGACY_MAX_LEVEL;
  return Math.min(maxLevel, Math.max(0, Math.floor(level)));
}

/**
 * Get the tier boundaries based on feature flag.
 * 
 * @param useNewBoundaries - Whether to use new tier boundaries
 * @returns Tier boundaries configuration
 */
export function getTierBoundaries(useNewBoundaries = false): TierBoundaries {
  return useNewBoundaries ? NEW_TIER_BOUNDARIES : LEGACY_TIER_BOUNDARIES;
}

/**
 * Get the maximum level based on feature flag.
 * 
 * @param useNewMaxLevel - Whether to use new max level
 * @returns Maximum level value
 */
export function getMaxLevel(useNewMaxLevel = false): number {
  return useNewMaxLevel ? NEW_MAX_LEVEL : LEGACY_MAX_LEVEL;
}

/**
 * Convert database record to UserLevel interface.
 *
 * @param record - Database record
 * @returns UserLevel object
 */
function toUserLevel(record: UserLevelRecord): UserLevel {
  return {
    id: record.id,
    userId: record.user_id,
    overallLevel: record.overall_level,
    overallTier: record.overall_tier,
    habitContinuityPower: record.habit_continuity_power,
    resilienceScore: record.resilience_score,
    totalExperiencePoints: record.total_experience_points,
    lastCalculatedAt: new Date(record.last_calculated_at),
    createdAt: new Date(record.created_at),
    updatedAt: new Date(record.updated_at),
  };
}

// =============================================================================
// UserLevelService Class
// =============================================================================

/**
 * User Level Service
 *
 * Manages user level calculation and tracking.
 *
 * Key Formulas:
 * - Habit Continuity Power (Req 4.1):
 *   (weighted_streak_score * 0.4) + (completion_rate_30d * 0.3) + (active_habit_ratio * 0.3)
 *
 * - Resilience Score (Req 5.1):
 *   (recovery_rate * 0.5) + (bounce_back_count * 0.3) + (streak_recovery_ratio * 0.2)
 *
 * - Overall Level (Req 7.1):
 *   (top_expertise_avg * 0.5) + (habit_continuity_power * 0.25) + (resilience_score * 0.25)
 */
export class UserLevelService {
  private readonly userLevelRepo: UserLevelRepository;
  private readonly expertiseRepo: UserExpertiseRepository;
  private readonly historyRepo: UserLevelHistoryRepository;
  private readonly habitRepo: HabitRepository;
  private readonly activityRepo: ActivityRepository;
  private readonly levelConfigService: LevelConfigService;

  /**
   * Initialize the UserLevelService.
   *
   * @param supabase - Supabase client instance
   */
  constructor(supabase: SupabaseClient) {
    this.userLevelRepo = new UserLevelRepository(supabase);
    this.expertiseRepo = new UserExpertiseRepository(supabase);
    this.historyRepo = new UserLevelHistoryRepository(supabase);
    this.habitRepo = new HabitRepository(supabase);
    this.activityRepo = new ActivityRepository(supabase);
    this.levelConfigService = new LevelConfigService(supabase);
  }

  // ===========================================================================
  // Public Methods - Feature Flag Helpers
  // ===========================================================================

  /**
   * Check if level rebalancing is enabled.
   * 
   * @returns True if level rebalancing feature flag is enabled
   */
  async isRebalancingEnabled(): Promise<boolean> {
    return this.levelConfigService.isRebalancingEnabled();
  }

  /**
   * Get tier boundaries based on current feature flag state.
   * 
   * @returns Tier boundaries (new or legacy based on feature flag)
   */
  async getCurrentTierBoundaries(): Promise<TierBoundaries> {
    const isRebalancingEnabled = await this.isRebalancingEnabled();
    return getTierBoundaries(isRebalancingEnabled);
  }

  /**
   * Get max level based on current feature flag state.
   * 
   * @returns Max level (9999 if rebalancing enabled, 199 otherwise)
   */
  async getCurrentMaxLevel(): Promise<number> {
    const isRebalancingEnabled = await this.isRebalancingEnabled();
    return getMaxLevel(isRebalancingEnabled);
  }

  /**
   * Calculate tier for a level using current feature flag state.
   * 
   * @param level - Level value
   * @returns Level tier
   */
  async calculateTierWithConfig(level: number): Promise<LevelTier> {
    const isRebalancingEnabled = await this.isRebalancingEnabled();
    return calculateTier(level, isRebalancingEnabled);
  }

  /**
   * Clamp level using current feature flag state.
   * 
   * @param level - Raw level value
   * @returns Clamped level value
   */
  async clampLevelWithConfig(level: number): Promise<number> {
    const isRebalancingEnabled = await this.isRebalancingEnabled();
    return clampLevel(level, isRebalancingEnabled);
  }

  // ===========================================================================
  // Public Methods
  // ===========================================================================

  /**
   * Get user level information.
   *
   * @param userId - The user ID
   * @returns User level data or null if not found
   */
  async getUserLevel(userId: string): Promise<UserLevel | null> {
    logger.info('Getting user level', { userId });

    try {
      const record = await this.userLevelRepo.getByUserId(userId);
      if (!record) {
        logger.debug('User level not found', { userId });
        return null;
      }
      return toUserLevel(record);
    } catch (error) {
      logger.error('Failed to get user level', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Calculate habit continuity power for a user.
   *
   * Property 7: Habit Continuity Power Formula
   * Formula: (weighted_streak_score * 0.4) + (completion_rate_30d * 0.3) + (active_habit_ratio * 0.3)
   *
   * Requirements: 4.1, 4.2, 4.3, 4.4
   *
   * @param userId - The user ID
   * @returns Habit continuity power (0-100)
   */
  async calculateHabitContinuityPower(userId: string): Promise<number> {
    logger.info('Calculating habit continuity power', { userId });

    try {
      const metrics = await this.getContinuityMetrics(userId);
      const power = this.computeHabitContinuityPower(metrics);

      logger.debug('Habit continuity power calculated', {
        userId,
        metrics,
        power,
      });

      return power;
    } catch (error) {
      logger.error('Failed to calculate habit continuity power', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Calculate resilience score for a user.
   *
   * Property 8: Resilience Score Formula
   * Formula: (recovery_rate * 0.5) + (bounce_back_count * 0.3) + (streak_recovery_ratio * 0.2)
   *
   * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
   *
   * @param userId - The user ID
   * @returns Resilience score (0-100)
   */
  async calculateResilienceScore(userId: string): Promise<number> {
    logger.info('Calculating resilience score', { userId });

    try {
      const metrics = await this.getResilienceMetrics(userId);
      const score = this.computeResilienceScore(metrics);

      logger.debug('Resilience score calculated', {
        userId,
        metrics,
        score,
      });

      return score;
    } catch (error) {
      logger.error('Failed to calculate resilience score', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Calculate overall user level.
   *
   * Property 11: Overall Level Formula
   * Formula: (top_expertise_avg * 0.5) + (habit_continuity_power * 0.25) + (resilience_score * 0.25)
   *
   * Requirements: 1.6, 7.1, 7.2, 7.3, 7.6
   *
   * @param userId - The user ID
   * @returns Overall level (0-199 legacy, 0-9999 with rebalancing)
   */
  async calculateOverallLevel(userId: string): Promise<number> {
    logger.info('Calculating overall level', { userId });

    try {
      // Check if rebalancing is enabled
      const isRebalancingEnabled = await this.isRebalancingEnabled();
      
      // Get total experience points from user_levels table
      const userLevel = await this.userLevelRepo.getByUserId(userId);
      const totalXP = userLevel?.total_experience_points ?? 0;

      // Calculate level from total XP using appropriate formula
      const rawLevel = this.calculateLevelFromXP(totalXP, isRebalancingEnabled);

      // Clamp to valid range based on feature flag
      const level = clampLevel(rawLevel, isRebalancingEnabled);

      logger.info('Overall level calculated from total XP', {
        userId,
        totalXP,
        rawLevel,
        level,
        isRebalancingEnabled,
      });

      return level;
    } catch (error) {
      logger.error('Failed to calculate overall level', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Calculate level from experience points using logarithmic formula.
   * 
   * Legacy formula: min(199, floor(10 * log2(xp / 100 + 1)))
   * New formula: min(9999, floor(5 * log2(xp / 1000 + 1)))
   *
   * @param xp - Total experience points
   * @param useNewFormula - Whether to use new formula (default: false for backward compatibility)
   * @returns Level (0-199 legacy, 0-9999 new)
   */
  private calculateLevelFromXP(xp: number, useNewFormula = false): number {
    if (xp <= 0) return 0;
    
    if (useNewFormula) {
      // New formula: min(9999, floor(5 * log2(xp / 1000 + 1)))
      return Math.min(NEW_MAX_LEVEL, Math.floor(5 * Math.log2(xp / 1000 + 1)));
    }
    
    // Legacy formula: min(199, floor(10 * log2(xp / 100 + 1)))
    return Math.min(LEGACY_MAX_LEVEL, Math.floor(10 * Math.log2(xp / 100 + 1)));
  }

  /**
   * Recalculate and save user level.
   *
   * Requirements: 1.6, 4.5, 5.6, 7.4, 7.5
   *
   * @param userId - The user ID
   * @returns Updated user level
   */
  async recalculateUserLevel(userId: string): Promise<UserLevel> {
    logger.info('Recalculating user level', { userId });

    try {
      // Check if rebalancing is enabled
      const isRebalancingEnabled = await this.isRebalancingEnabled();
      
      // Get current level for comparison
      const currentLevel = await this.userLevelRepo.getByUserId(userId);

      // Calculate overall level from total XP (simple formula)
      const overallLevel = await this.calculateOverallLevel(userId);
      const overallTier = calculateTier(overallLevel, isRebalancingEnabled);

      // Calculate continuity and resilience for display purposes (optional metrics)
      const habitContinuityPower = await this.calculateHabitContinuityPower(userId);
      const resilienceScore = await this.calculateResilienceScore(userId);

      // Update user level record
      const updatedRecord = await this.userLevelRepo.updateMetrics(userId, {
        overallLevel,
        overallTier,
        habitContinuityPower: Math.round(habitContinuityPower),
        resilienceScore: Math.round(resilienceScore),
      });

      if (!updatedRecord) {
        throw new Error(`Failed to update user level for user ${userId}`);
      }

      // Record history if significant changes occurred
      await this.recordLevelChanges(userId, currentLevel, updatedRecord);

      logger.info('User level recalculated', {
        userId,
        overallLevel,
        overallTier,
        totalXP: currentLevel?.total_experience_points ?? 0,
        habitContinuityPower,
        resilienceScore,
        isRebalancingEnabled,
      });

      return toUserLevel(updatedRecord);
    } catch (error) {
      logger.error('Failed to recalculate user level', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Initialize user level for a new user.
   *
   * Requirements: 1.6, 15.1, 15.2
   *
   * @param userId - The user ID
   * @returns Initialized user level
   */
  async initializeUserLevel(userId: string): Promise<UserLevel> {
    logger.info('Initializing user level', { userId });

    try {
      // Check if user level already exists
      const existing = await this.userLevelRepo.getByUserId(userId);
      if (existing) {
        logger.debug('User level already exists', { userId });
        return toUserLevel(existing);
      }

      // Check if rebalancing is enabled
      const isRebalancingEnabled = await this.isRebalancingEnabled();

      // Check if user has existing habits (e.g., migrated from guest)
      const habits = await this.habitRepo.getByOwner('user', userId, true);
      const hasExistingHabits = habits.length > 0;

      let initialLevel: UserLevelRecord;

      if (hasExistingHabits) {
        // Calculate initial level based on existing activity
        logger.debug('User has existing habits, calculating initial level', {
          userId,
          habitCount: habits.length,
        });

        const habitContinuityPower = await this.calculateHabitContinuityPower(userId);
        const resilienceScore = await this.calculateResilienceScore(userId);
        const overallLevel = await this.calculateOverallLevel(userId);

        initialLevel = await this.userLevelRepo.upsert(userId, {
          overall_level: overallLevel,
          overall_tier: calculateTier(overallLevel, isRebalancingEnabled),
          habit_continuity_power: Math.round(habitContinuityPower),
          resilience_score: Math.round(resilienceScore),
          total_experience_points: 0,
          last_calculated_at: new Date().toISOString(),
        });
      } else {
        // Create default initial level for new user
        initialLevel = await this.userLevelRepo.upsert(userId, {
          overall_level: 0,
          overall_tier: 'beginner',
          habit_continuity_power: 0,
          resilience_score: DEFAULT_RESILIENCE_SCORE,
          total_experience_points: 0,
          last_calculated_at: new Date().toISOString(),
        });
      }

      logger.info('User level initialized', {
        userId,
        overallLevel: initialLevel.overall_level,
        hasExistingHabits,
        isRebalancingEnabled,
      });

      return toUserLevel(initialLevel);
    } catch (error) {
      logger.error('Failed to initialize user level', error as Error, { userId });
      throw error;
    }
  }

  // ===========================================================================
  // Private Methods - Metrics Calculation
  // ===========================================================================

  /**
   * Get continuity metrics for a user.
   *
   * @param userId - The user ID
   * @returns Continuity metrics
   */
  private async getContinuityMetrics(userId: string): Promise<ContinuityMetrics> {
    const habits = await this.habitRepo.getByOwner('user', userId, true);

    if (habits.length === 0) {
      return {
        weightedStreakScore: 0,
        completionRate30d: 0,
        activeHabitRatio: 0,
      };
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - COMPLETION_RATE_DAYS);

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - ACTIVE_HABIT_DAYS);

    // Calculate weighted streak score
    let totalWeightedStreak = 0;
    let maxPossibleStreak = 0;

    // Calculate completion rate over 30 days
    let totalCompleted = 0;
    let totalExpected = 0;

    // Calculate active habit ratio
    let habitsWithRecentActivity = 0;

    for (const habit of habits) {
      const habitLevel = habit.level ?? 50; // Default level if not assessed

      // Get streak for this habit
      const streak = await this.getHabitStreak(habit.id);
      totalWeightedStreak += streak * (habitLevel / 100);
      maxPossibleStreak += COMPLETION_RATE_DAYS * (habitLevel / 100);

      // Get completion count for 30 days
      const completedCount = await this.activityRepo.countActivitiesInRange(
        habit.id,
        thirtyDaysAgo,
        now,
        'complete'
      );

      // Calculate expected completions based on frequency
      const expectedCount = this.getExpectedCompletions(habit.frequency, COMPLETION_RATE_DAYS);
      totalCompleted += completedCount;
      totalExpected += expectedCount;

      // Check for recent activity
      const recentActivity = await this.activityRepo.countActivitiesInRange(
        habit.id,
        sevenDaysAgo,
        now,
        'complete'
      );
      if (recentActivity > 0) {
        habitsWithRecentActivity++;
      }
    }

    // Normalize scores to 0-100
    const weightedStreakScore = maxPossibleStreak > 0
      ? Math.min(100, (totalWeightedStreak / maxPossibleStreak) * 100)
      : 0;

    const completionRate30d = totalExpected > 0
      ? Math.min(100, (totalCompleted / totalExpected) * 100)
      : 0;

    const activeHabitRatio = habits.length > 0
      ? (habitsWithRecentActivity / habits.length) * 100
      : 0;

    return {
      weightedStreakScore,
      completionRate30d,
      activeHabitRatio,
    };
  }

  /**
   * Get resilience metrics for a user.
   *
   * @param userId - The user ID
   * @returns Resilience metrics
   */
  private async getResilienceMetrics(userId: string): Promise<ResilienceMetrics> {
    const habits = await this.habitRepo.getByOwner('user', userId, true);

    if (habits.length === 0) {
      // No habits = perfect resilience (no breaks to recover from)
      return {
        recoveryRate: 100,
        bounceBackCount: 0,
        streakRecoveryRatio: 100,
      };
    }

    const now = new Date();
    const ninetyDaysAgo = new Date(now);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - RESILIENCE_ANALYSIS_DAYS);

    let totalRecoveryDays = 0;
    let breakCount = 0;
    let bounceBackCount = 0;
    let brokenStreaks = 0;
    let recoveredStreaks = 0;

    for (const habit of habits) {
      // Analyze breaks and recoveries for this habit
      const breakAnalysis = await this.analyzeHabitBreaks(
        habit.id,
        habit.frequency,
        ninetyDaysAgo,
        now
      );

      totalRecoveryDays += breakAnalysis.totalRecoveryDays;
      breakCount += breakAnalysis.breakCount;
      bounceBackCount += breakAnalysis.bounceBackCount;
      brokenStreaks += breakAnalysis.brokenStreaks;
      recoveredStreaks += breakAnalysis.recoveredStreaks;
    }

    // Calculate recovery rate (lower days = better, normalized to 0-100)
    // 1 day = 100, 7+ days = 0
    let recoveryRate: number;
    if (breakCount === 0) {
      recoveryRate = 100; // No breaks = perfect recovery
    } else {
      const avgRecoveryDays = totalRecoveryDays / breakCount;
      recoveryRate = Math.max(0, Math.min(100, (7 - avgRecoveryDays) / 6 * 100));
    }

    // Normalize bounce back count to 0-100
    // More bounce backs = better resilience (up to a point)
    const normalizedBounceBack = Math.min(100, bounceBackCount * 10);

    // Calculate streak recovery ratio
    const streakRecoveryRatio = brokenStreaks > 0
      ? Math.min(100, (recoveredStreaks / brokenStreaks) * 100)
      : 100;

    return {
      recoveryRate,
      bounceBackCount: normalizedBounceBack,
      streakRecoveryRatio,
    };
  }

  /**
   * Get top expertise average for a user.
  /**
   * Compute habit continuity power from metrics.
   *
   * Property 7: Habit Continuity Power Formula
   *
   * @param metrics - Continuity metrics
   * @returns Habit continuity power (0-100)
   */
  private computeHabitContinuityPower(metrics: ContinuityMetrics): number {
    return (
      metrics.weightedStreakScore * 0.4 +
      metrics.completionRate30d * 0.3 +
      metrics.activeHabitRatio * 0.3
    );
  }

  /**
   * Compute resilience score from metrics.
   *
   * Property 8: Resilience Score Formula
   *
   * @param metrics - Resilience metrics
   * @returns Resilience score (0-100)
   */
  private computeResilienceScore(metrics: ResilienceMetrics): number {
    return (
      metrics.recoveryRate * 0.5 +
      metrics.bounceBackCount * 0.3 +
      metrics.streakRecoveryRatio * 0.2
    );
  }

  // ===========================================================================
  // Private Methods - Helper Functions
  // ===========================================================================

  /**
   * Get current streak for a habit.
   *
   * @param habitId - The habit ID
   * @returns Current streak in days
   */
  private async getHabitStreak(habitId: string): Promise<number> {
    const activities = await this.activityRepo.getHabitActivities(habitId, 'complete', 365);

    if (activities.length === 0) {
      return 0;
    }

    // Sort by timestamp descending
    activities.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let currentDate = new Date(today);

    for (const activity of activities) {
      const activityDate = new Date(activity.timestamp);
      activityDate.setHours(0, 0, 0, 0);

      const daysDiff = Math.floor(
        (currentDate.getTime() - activityDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysDiff === 0) {
        // Activity on current date
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else if (daysDiff === 1) {
        // Activity on previous day (streak continues)
        streak++;
        currentDate = activityDate;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        // Gap in streak
        break;
      }
    }

    return streak;
  }

  /**
   * Get expected completions based on frequency.
   *
   * @param frequency - Habit frequency
   * @param days - Number of days
   * @returns Expected number of completions
   */
  private getExpectedCompletions(
    frequency: 'daily' | 'weekly' | 'monthly',
    days: number
  ): number {
    switch (frequency) {
      case 'daily':
        return days;
      case 'weekly':
        return Math.floor(days / 7);
      case 'monthly':
        return Math.floor(days / 30);
      default:
        return days;
    }
  }

  /**
   * Analyze breaks and recoveries for a habit.
   *
   * @param habitId - The habit ID
   * @param frequency - Habit frequency
   * @param start - Start date
   * @param end - End date
   * @returns Break analysis results
   */
  private async analyzeHabitBreaks(
    habitId: string,
    frequency: 'daily' | 'weekly' | 'monthly',
    start: Date,
    end: Date
  ): Promise<{
    totalRecoveryDays: number;
    breakCount: number;
    bounceBackCount: number;
    brokenStreaks: number;
    recoveredStreaks: number;
  }> {
    const activities = await this.activityRepo.getHabitActivities(habitId, 'complete', 365);

    // Filter to date range
    const rangeActivities = activities.filter(a => {
      const date = new Date(a.timestamp);
      return date >= start && date <= end;
    });

    if (rangeActivities.length === 0) {
      return {
        totalRecoveryDays: 0,
        breakCount: 0,
        bounceBackCount: 0,
        brokenStreaks: 0,
        recoveredStreaks: 0,
      };
    }

    // Sort by timestamp ascending
    rangeActivities.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    let totalRecoveryDays = 0;
    let breakCount = 0;
    let bounceBackCount = 0;
    let brokenStreaks = 0;
    let recoveredStreaks = 0;

    // Calculate expected gap based on frequency
    const expectedGapDays = frequency === 'daily' ? 1 : frequency === 'weekly' ? 7 : 30;
    const breakThreshold = expectedGapDays * MIN_BREAK_MISSES;

    for (let i = 1; i < rangeActivities.length; i++) {
      const prevActivity = rangeActivities[i - 1];
      const currActivity = rangeActivities[i];
      if (!prevActivity || !currActivity) continue;
      
      const prevDate = new Date(prevActivity.timestamp);
      const currDate = new Date(currActivity.timestamp);
      const gapDays = Math.floor(
        (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (gapDays > breakThreshold) {
        // This is a break
        breakCount++;
        brokenStreaks++;
        totalRecoveryDays += gapDays;

        // Check if they bounced back (resumed after break)
        if (i < rangeActivities.length - 1) {
          bounceBackCount++;
          recoveredStreaks++;
        }
      }
    }

    return {
      totalRecoveryDays,
      breakCount,
      bounceBackCount,
      brokenStreaks,
      recoveredStreaks,
    };
  }

  /**
   * Record level changes in history.
   *
   * Property 15: Level History Recording
   *
   * @param userId - The user ID
   * @param oldRecord - Previous user level record
   * @param newRecord - New user level record
   */
  private async recordLevelChanges(
    userId: string,
    oldRecord: UserLevelRecord | null,
    newRecord: UserLevelRecord
  ): Promise<void> {
    const metricsSnapshot: MetricsSnapshot = {
      overallLevel: newRecord.overall_level,
      habitContinuityPower: newRecord.habit_continuity_power,
      resilienceScore: newRecord.resilience_score,
    };

    // Record overall level change
    if (!oldRecord || oldRecord.overall_level !== newRecord.overall_level) {
      await this.historyRepo.recordChange({
        user_id: userId,
        change_type: 'overall',
        domain_code: null,
        old_level: oldRecord?.overall_level ?? null,
        new_level: newRecord.overall_level,
        change_reason: 'level_recalculation',
        metrics_snapshot: metricsSnapshot,
      });
    }

    // Record continuity power change if significant (> 5 points)
    if (oldRecord) {
      const continuityDelta = Math.abs(
        newRecord.habit_continuity_power - oldRecord.habit_continuity_power
      );
      if (continuityDelta > CONTINUITY_CHANGE_THRESHOLD) {
        await this.historyRepo.recordChange({
          user_id: userId,
          change_type: 'continuity',
          domain_code: null,
          old_level: oldRecord.habit_continuity_power,
          new_level: newRecord.habit_continuity_power,
          change_reason: 'continuity_change',
          metrics_snapshot: metricsSnapshot,
        });
      }
    }

    // Record resilience score change if significant
    if (oldRecord) {
      const resilienceDelta = Math.abs(
        newRecord.resilience_score - oldRecord.resilience_score
      );
      if (resilienceDelta > CONTINUITY_CHANGE_THRESHOLD) {
        await this.historyRepo.recordChange({
          user_id: userId,
          change_type: 'resilience',
          domain_code: null,
          old_level: oldRecord.resilience_score,
          new_level: newRecord.resilience_score,
          change_reason: 'resilience_change',
          metrics_snapshot: metricsSnapshot,
        });
      }
    }
  }

  // ===========================================================================
  // Getters for Repositories (for testing and external access)
  // ===========================================================================

  /**
   * Get the user level repository.
   */
  get userLevelRepository(): UserLevelRepository {
    return this.userLevelRepo;
  }

  /**
   * Get the expertise repository.
   */
  get expertiseRepository(): UserExpertiseRepository {
    return this.expertiseRepo;
  }

  /**
   * Get the history repository.
   */
  get historyRepository(): UserLevelHistoryRepository {
    return this.historyRepo;
  }

  /**
   * Get the level config service.
   */
  get levelConfig(): LevelConfigService {
    return this.levelConfigService;
  }
}
