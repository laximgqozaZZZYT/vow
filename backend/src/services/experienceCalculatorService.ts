/**
 * Experience Calculator Service
 *
 * Calculates and awards experience points for habit completions.
 * Manages expertise level calculations based on accumulated experience.
 *
 * Key Formulas (from design.md):
 * - Base XP: habit_difficulty_level * 10
 * - Streak Bonus: min(streak_days * 2, 50)
 * - Total XP: base_xp + streak_bonus
 * - Expertise Level: min(199, floor(10 * log2(experience_points / 100 + 1)))
 *
 * XP Multiplier System (behavioral science-based):
 * - 0-49% completion: 0.3x (minimal effort)
 * - 50-79% completion: 0.6x (partial reinforcement)
 * - 80-99% completion: 0.8x (near completion)
 * - 100-120% completion: 1.0x (plan adherence - maximum reward)
 * - 121-150% completion: 0.9x (mild over-achievement)
 * - 151%+ completion: 0.7x (burnout prevention)
 *
 * Requirements: 6.1, 6.2, 6.3, 6.5
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getLogger } from '../utils/logger.js';
import {
  UserExpertiseRepository,
  UserLevelRepository,
  UserLevelHistoryRepository,
  type MetricsSnapshot,
} from '../repositories/userLevelRepository.js';
import { calculateTier, clampLevel } from './userLevelService.js';
import {
  calculateXPMultiplier,
  type XPMultiplierResult,
  type XPMultiplierTier,
} from './xpMultiplierService.js';

const logger = getLogger('experienceCalculatorService');

// =============================================================================
// Constants
// =============================================================================

/** Default habit difficulty level when not assessed (THLI-24) */
const DEFAULT_HABIT_LEVEL = 50;

/** Multiplier for base experience points calculation */
const BASE_XP_MULTIPLIER = 10;

/** Multiplier for streak bonus calculation */
const STREAK_BONUS_MULTIPLIER = 2;

/** Maximum streak bonus that can be awarded */
const MAX_STREAK_BONUS = 50;

/** Divisor for expertise level logarithmic calculation */
const EXPERTISE_LEVEL_DIVISOR = 100;

/** Multiplier for expertise level logarithmic calculation */
const EXPERTISE_LEVEL_MULTIPLIER = 10;

/** General domain code for unclassified habits */
const GENERAL_DOMAIN_CODE = '000';

/** General domain name */
const GENERAL_DOMAIN_NAME = '一般（未分類）';

// =============================================================================
// Types
// =============================================================================

/**
 * Domain points distribution for experience award
 */
export interface DomainPoints {
  domainCode: string;
  domainName: string;
  points: number;
  proportion: number; // 0.0 - 1.0
}

/**
 * Experience award result for a single domain
 */
export interface DomainUpdate {
  domainCode: string;
  domainName: string;
  oldExpertiseLevel: number;
  newExpertiseLevel: number;
  oldExperiencePoints: number;
  newExperiencePoints: number;
  levelChanged: boolean;
}

/**
 * Level change notification data
 */
export interface LevelChange {
  type: 'expertise' | 'overall';
  domainCode?: string;
  domainName?: string;
  oldLevel: number;
  newLevel: number;
}

/**
 * Result of awarding experience points
 */
export interface ExperienceAwardResult {
  totalPointsAwarded: number;
  domainUpdates: DomainUpdate[];
  levelChanges: LevelChange[];
}

/**
 * Experience log entry for audit purposes
 */
export interface ExperienceLogEntry {
  userId: string;
  habitId: string;
  activityId?: string;
  domainCode: string;
  pointsAwarded: number;
  habitLevel: number | null;
  qualityMultiplier: number;
  frequencyBonus: number;
  /** Completion rate (0-500%) - new field for XP multiplier system */
  completionRate?: number;
  /** Applied XP multiplier (0.3-1.0) - new field for XP multiplier system */
  appliedMultiplier?: number;
  /** Multiplier tier - new field for XP multiplier system */
  multiplierTier?: XPMultiplierTier;
  /** Multiplier reason key - new field for XP multiplier system */
  multiplierReason?: string;
}

/**
 * Extended experience award result with XP multiplier info
 */
export interface ExtendedExperienceAwardResult extends ExperienceAwardResult {
  /** XP multiplier result if completion-based calculation was used */
  xpMultiplierResult?: XPMultiplierResult;
  /** Base XP before multiplier */
  baseXP?: number;
  /** Final XP after multiplier */
  finalXP?: number;
}

// =============================================================================
// Pure Calculation Functions (Exported for Testing)
// =============================================================================

/**
 * Calculate experience points from habit completion.
 *
 * Formula: base_xp + streak_bonus
 * Where:
 * - base_xp = habit_difficulty_level * 10
 * - streak_bonus = min(streak_days * 2, 50)
 *
 * Property 9: Experience Points Calculation
 * Validates: Requirements 6.1, 6.2, 6.3
 *
 * @param difficultyLevel - Habit difficulty level (THLI-24), null uses default 50
 * @param streakDays - Current streak in days
 * @returns Total experience points to award
 */
export function calculateExperiencePoints(
  difficultyLevel: number | null,
  streakDays: number
): number {
  // Use default level if not assessed (Requirement 6.1)
  const level = difficultyLevel ?? DEFAULT_HABIT_LEVEL;

  // Calculate base XP: difficulty_level * 10 (Requirement 6.1)
  const baseXp = level * BASE_XP_MULTIPLIER;

  // Calculate streak bonus: min(streak_days * 2, 50) (Requirement 6.2)
  const streakBonus = Math.min(streakDays * STREAK_BONUS_MULTIPLIER, MAX_STREAK_BONUS);

  // Total XP = base_xp + streak_bonus (Requirement 6.3)
  return Math.floor(baseXp + streakBonus);
}

/**
 * Calculate expertise level from accumulated experience points.
 *
 * Formula: min(199, floor(10 * log2(experience_points / 100 + 1)))
 *
 * Property 10: Expertise Level Formula (Logarithmic Scale)
 * Validates: Requirements 6.5
 *
 * @param experiencePoints - Total accumulated experience points
 * @returns Expertise level (0-199)
 */
export function calculateExpertiseLevel(experiencePoints: number): number {
  if (experiencePoints <= 0) {
    return 0;
  }

  // Formula: floor(10 * log2(experience_points / 100 + 1))
  const rawLevel = Math.floor(
    EXPERTISE_LEVEL_MULTIPLIER * Math.log2(experiencePoints / EXPERTISE_LEVEL_DIVISOR + 1)
  );

  // Clamp to valid range [0, 199]
  return clampLevel(rawLevel);
}

/**
 * Distribute experience points proportionally across domains.
 *
 * Property 6: Proportional Experience Distribution
 * Validates: Requirements 3.6, 6.4
 *
 * @param totalPoints - Total experience points to distribute
 * @param domainCodes - Array of domain codes to distribute to
 * @param domainNames - Map of domain codes to names (optional)
 * @returns Array of domain points distributions
 */
export function distributeExperiencePoints(
  totalPoints: number,
  domainCodes: string[],
  domainNames?: Map<string, string>
): DomainPoints[] {
  // If no domains, assign to General domain (Property 5: Default Domain Assignment)
  if (!domainCodes || domainCodes.length === 0) {
    return [
      {
        domainCode: GENERAL_DOMAIN_CODE,
        domainName: GENERAL_DOMAIN_NAME,
        points: totalPoints,
        proportion: 1.0,
      },
    ];
  }

  // Calculate proportional distribution
  const proportion = 1.0 / domainCodes.length;
  const pointsPerDomain = Math.floor(totalPoints * proportion);

  // Handle remainder to ensure total points are distributed
  const remainder = totalPoints - pointsPerDomain * domainCodes.length;

  return domainCodes.map((code, index) => ({
    domainCode: code,
    domainName: domainNames?.get(code) ?? code,
    // Give remainder to first domain to ensure all points are distributed
    points: pointsPerDomain + (index === 0 ? remainder : 0),
    proportion,
  }));
}

// =============================================================================
// ExperienceCalculatorService Class
// =============================================================================

/**
 * Experience Calculator Service
 *
 * Manages experience point calculations and awards for habit completions.
 * Updates user expertise levels and records history.
 */
export class ExperienceCalculatorService {
  private readonly supabase: SupabaseClient;
  private readonly expertiseRepo: UserExpertiseRepository;
  private readonly userLevelRepo: UserLevelRepository;
  private readonly historyRepo: UserLevelHistoryRepository;

  /**
   * Initialize the ExperienceCalculatorService.
   *
   * @param supabase - Supabase client instance
   */
  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.expertiseRepo = new UserExpertiseRepository(supabase);
    this.userLevelRepo = new UserLevelRepository(supabase);
    this.historyRepo = new UserLevelHistoryRepository(supabase);
  }

  // ===========================================================================
  // Public Methods
  // ===========================================================================

  /**
   * Award experience points to a user for completing a habit.
   *
   * This method:
   * 1. Distributes XP across mapped domains (or General if none)
   * 2. Updates expertise records for each domain
   * 3. Recalculates expertise levels
   * 4. Records level changes in history
   * 5. Updates total experience points in user_levels
   *
   * Requirements: 6.4, 6.6, 6.7, 13.1
   *
   * @param userId - The user ID
   * @param habitId - The habit ID
   * @param domainCodes - Array of domain codes mapped to the habit
   * @param xp - Total experience points to award
   * @returns Experience award result with domain updates and level changes
   */
  async awardExperiencePoints(
    userId: string,
    habitId: string,
    domainCodes: string[],
    xp: number
  ): Promise<ExperienceAwardResult> {
    logger.info('Awarding experience points', {
      userId,
      habitId,
      domainCodes,
      xp,
    });

    try {
      // Get domain names for the codes
      const domainNames = await this.getDomainNames(domainCodes);

      // Distribute XP across domains
      const distribution = distributeExperiencePoints(xp, domainCodes, domainNames);

      const domainUpdates: DomainUpdate[] = [];
      const levelChanges: LevelChange[] = [];

      // Process each domain
      for (const domainPoints of distribution) {
        const update = await this.updateDomainExpertise(
          userId,
          domainPoints.domainCode,
          domainPoints.domainName,
          domainPoints.points
        );

        domainUpdates.push(update);

        // Track level changes for notifications
        if (update.levelChanged) {
          levelChanges.push({
            type: 'expertise',
            domainCode: update.domainCode,
            domainName: update.domainName,
            oldLevel: update.oldExpertiseLevel,
            newLevel: update.newExpertiseLevel,
          });

          // Record expertise level change in history
          await this.recordExpertiseLevelChange(
            userId,
            update.domainCode,
            update.oldExpertiseLevel,
            update.newExpertiseLevel
          );
        }
      }

      // Update total experience points in user_levels
      await this.updateTotalExperiencePoints(userId, xp);

      logger.info('Experience points awarded successfully', {
        userId,
        habitId,
        totalPointsAwarded: xp,
        domainsUpdated: domainUpdates.length,
        levelChanges: levelChanges.length,
      });

      return {
        totalPointsAwarded: xp,
        domainUpdates,
        levelChanges,
      };
    } catch (error) {
      logger.error('Failed to award experience points', error as Error, {
        userId,
        habitId,
        xp,
      });
      throw error;
    }
  }

  /**
   * Log experience award for audit purposes.
   *
   * Property 16: Experience Log Completeness
   * Property 7: Experience Log Field Completeness (XP Multiplier)
   * Validates: Requirements 13.5, 6.4
   *
   * @param entry - Experience log entry to record
   */
  async logExperienceAward(entry: ExperienceLogEntry): Promise<void> {
    logger.debug('Logging experience award', {
      userId: entry.userId,
      habitId: entry.habitId,
      domainCode: entry.domainCode,
      pointsAwarded: entry.pointsAwarded,
      completionRate: entry.completionRate,
      appliedMultiplier: entry.appliedMultiplier,
      multiplierTier: entry.multiplierTier,
    });

    try {
      const { error } = await this.supabase.from('experience_log').insert({
        user_id: entry.userId,
        habit_id: entry.habitId,
        activity_id: entry.activityId ?? null,
        domain_code: entry.domainCode,
        points_awarded: entry.pointsAwarded,
        habit_level: entry.habitLevel,
        quality_multiplier: entry.qualityMultiplier,
        frequency_bonus: entry.frequencyBonus,
        // New XP multiplier fields
        completion_rate: entry.completionRate ?? null,
        applied_multiplier: entry.appliedMultiplier ?? null,
        multiplier_tier: entry.multiplierTier ?? null,
        multiplier_reason: entry.multiplierReason ?? null,
      });

      if (error) {
        logger.warning('Failed to log experience award', {
          error: error.message,
          userId: entry.userId,
          habitId: entry.habitId,
          domainCode: entry.domainCode,
        });
        // Don't throw - logging failure shouldn't block the main operation
      }
    } catch (error) {
      logger.warning('Exception logging experience award', {
        error: String(error),
        userId: entry.userId,
        habitId: entry.habitId,
        domainCode: entry.domainCode,
      });
      // Don't throw - logging failure shouldn't block the main operation
    }
  }

  /**
   * Award experience points with XP multiplier based on completion rate.
   *
   * This method extends the standard awardExperiencePoints by applying
   * a behavioral science-based multiplier based on completion rate.
   *
   * Requirements: 1.1-1.9, 6.4
   *
   * @param userId - The user ID
   * @param habitId - The habit ID
   * @param domainCodes - Array of domain codes mapped to the habit
   * @param baseXP - Base experience points before multiplier
   * @param actualValue - Actual completed value (count or duration)
   * @param targetValue - Target value (count or duration)
   * @returns Extended experience award result with multiplier info
   */
  async awardExperiencePointsWithMultiplier(
    userId: string,
    habitId: string,
    domainCodes: string[],
    baseXP: number,
    actualValue: number,
    targetValue: number
  ): Promise<ExtendedExperienceAwardResult> {
    logger.info('Awarding experience points with multiplier', {
      userId,
      habitId,
      domainCodes,
      baseXP,
      actualValue,
      targetValue,
    });

    // Calculate XP multiplier based on completion rate
    const xpMultiplierResult = calculateXPMultiplier(actualValue, targetValue);

    // Apply multiplier to base XP
    const finalXP = Math.floor(baseXP * xpMultiplierResult.multiplier);

    logger.info('XP multiplier applied', {
      userId,
      habitId,
      baseXP,
      finalXP,
      completionRate: xpMultiplierResult.completionRate,
      multiplier: xpMultiplierResult.multiplier,
      tier: xpMultiplierResult.tier,
    });

    // Award the final XP using the standard method
    const result = await this.awardExperiencePoints(userId, habitId, domainCodes, finalXP);

    return {
      ...result,
      xpMultiplierResult,
      baseXP,
      finalXP,
    };
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Get domain names for a list of domain codes.
   *
   * @param domainCodes - Array of domain codes
   * @returns Map of domain codes to names
   */
  private async getDomainNames(domainCodes: string[]): Promise<Map<string, string>> {
    const domainNames = new Map<string, string>();

    if (!domainCodes || domainCodes.length === 0) {
      return domainNames;
    }

    try {
      const { data, error } = await this.supabase
        .from('occupation_domains')
        .select('minor_code, minor_name')
        .in('minor_code', domainCodes);

      if (!error && data) {
        for (const domain of data) {
          domainNames.set(domain.minor_code, domain.minor_name);
        }
      }
    } catch (error) {
      logger.warning('Failed to fetch domain names', { error: String(error), domainCodes });
    }

    return domainNames;
  }

  /**
   * Update expertise for a single domain.
   *
   * Property 18: Expertise Level Monotonicity
   * Expertise level must never decrease due to habit completion.
   *
   * @param userId - The user ID
   * @param domainCode - The domain code
   * @param domainName - The domain name
   * @param points - Experience points to add
   * @returns Domain update result
   */
  private async updateDomainExpertise(
    userId: string,
    domainCode: string,
    domainName: string,
    points: number
  ): Promise<DomainUpdate> {
    // Get current expertise record (if exists)
    const currentExpertise = await this.expertiseRepo.getByDomain(userId, domainCode);

    const oldExperiencePoints = currentExpertise?.experience_points ?? 0;
    const oldExpertiseLevel = currentExpertise?.expertise_level ?? 0;

    // Calculate new values
    const newExperiencePoints = oldExperiencePoints + points;
    const newExpertiseLevel = calculateExpertiseLevel(newExperiencePoints);
    const newTier = calculateTier(newExpertiseLevel);

    // Upsert expertise record
    await this.expertiseRepo.upsert(userId, domainCode, {
      domain_name: domainName,
      expertise_level: newExpertiseLevel,
      expertise_tier: newTier,
      experience_points: newExperiencePoints,
      habit_count: (currentExpertise?.habit_count ?? 0) + 1,
      last_activity_at: new Date().toISOString(),
    });

    return {
      domainCode,
      domainName,
      oldExpertiseLevel,
      newExpertiseLevel,
      oldExperiencePoints,
      newExperiencePoints,
      levelChanged: newExpertiseLevel !== oldExpertiseLevel,
    };
  }

  /**
   * Record expertise level change in history.
   *
   * Property 15: Level History Recording
   *
   * @param userId - The user ID
   * @param domainCode - The domain code
   * @param oldLevel - Previous expertise level
   * @param newLevel - New expertise level
   */
  private async recordExpertiseLevelChange(
    userId: string,
    domainCode: string,
    oldLevel: number,
    newLevel: number
  ): Promise<void> {
    try {
      const metricsSnapshot: MetricsSnapshot = {
        domainLevels: { [domainCode]: newLevel },
      };

      await this.historyRepo.recordChange({
        user_id: userId,
        change_type: 'expertise',
        domain_code: domainCode,
        old_level: oldLevel,
        new_level: newLevel,
        change_reason: 'expertise_gain',
        metrics_snapshot: metricsSnapshot,
      });
    } catch (error) {
      logger.warning('Failed to record expertise level change', {
        error: String(error),
        userId,
        domainCode,
        oldLevel,
        newLevel,
      });
      // Don't throw - history recording failure shouldn't block the main operation
    }
  }

  /**
   * Update total experience points in user_levels table.
   *
   * @param userId - The user ID
   * @param pointsToAdd - Experience points to add to total
   */
  private async updateTotalExperiencePoints(userId: string, pointsToAdd: number): Promise<void> {
    try {
      // Get current user level record
      const currentLevel = await this.userLevelRepo.getByUserId(userId);

      if (currentLevel) {
        // Update existing record
        await this.userLevelRepo.updateMetrics(userId, {
          totalExperiencePoints: currentLevel.total_experience_points + pointsToAdd,
        });
      } else {
        // Create new record if doesn't exist
        await this.userLevelRepo.upsert(userId, {
          overall_level: 0,
          overall_tier: 'beginner',
          habit_continuity_power: 0,
          resilience_score: 50,
          total_experience_points: pointsToAdd,
          last_calculated_at: new Date().toISOString(),
        });
      }
    } catch (error) {
      logger.warning('Failed to update total experience points', {
        error: String(error),
        userId,
        pointsToAdd,
      });
      // Don't throw - this is a secondary operation
    }
  }

  // ===========================================================================
  // Getters for Repositories (for testing and external access)
  // ===========================================================================

  /**
   * Get the expertise repository.
   */
  get expertiseRepository(): UserExpertiseRepository {
    return this.expertiseRepo;
  }

  /**
   * Get the user level repository.
   */
  get userLevelRepository(): UserLevelRepository {
    return this.userLevelRepo;
  }

  /**
   * Get the history repository.
   */
  get historyRepository(): UserLevelHistoryRepository {
    return this.historyRepo;
  }

  /**
   * Revoke experience points that were previously awarded for a habit completion.
   *
   * This method:
   * 1. Queries experience_log to find the exact points awarded for the activity/habit
   * 2. Subtracts those points from user_expertise for each domain
   * 3. Subtracts from user_levels.total_experience_points
   * 4. Recalculates expertise levels if needed
   * 5. Logs the revocation in experience_log with negative points
   *
   * Requirements: XP deduction when habit is reverted to incomplete
   *
   * @param userId - The user ID
   * @param habitId - The habit ID
   * @param activityId - Optional activity ID to find specific XP award
   * @returns Revocation result with points deducted and level changes
   */
  async revokeExperiencePoints(
    userId: string,
    habitId: string,
    activityId?: string
  ): Promise<ExperienceAwardResult> {
    logger.info('Revoking experience points', {
      userId,
      habitId,
      activityId,
    });

    try {
      // Find the experience log entries for this habit/activity
      const logEntries = await this.findExperienceLogEntries(userId, habitId, activityId);

      if (logEntries.length === 0) {
        logger.info('No experience log entries found to revoke', {
          userId,
          habitId,
          activityId,
        });
        return {
          totalPointsAwarded: 0,
          domainUpdates: [],
          levelChanges: [],
        };
      }

      const domainUpdates: DomainUpdate[] = [];
      const levelChanges: LevelChange[] = [];
      let totalPointsRevoked = 0;

      // Process each log entry and revoke points
      for (const entry of logEntries) {
        const update = await this.revokeDomainExpertise(
          userId,
          entry.domain_code,
          entry.points_awarded
        );

        if (update) {
          domainUpdates.push(update);
          totalPointsRevoked += entry.points_awarded;

          // Track level changes for notifications
          if (update.levelChanged) {
            levelChanges.push({
              type: 'expertise',
              domainCode: update.domainCode,
              domainName: update.domainName,
              oldLevel: update.oldExpertiseLevel,
              newLevel: update.newExpertiseLevel,
            });

            // Record expertise level change in history
            await this.recordExpertiseLevelChange(
              userId,
              update.domainCode,
              update.oldExpertiseLevel,
              update.newExpertiseLevel
            );
          }

          // Log the revocation with negative points
          await this.logExperienceRevocation(userId, habitId, activityId, entry);
        }
      }

      // Update total experience points in user_levels (subtract)
      if (totalPointsRevoked > 0) {
        await this.updateTotalExperiencePoints(userId, -totalPointsRevoked);
      }

      // Delete the original log entries
      await this.deleteExperienceLogEntries(logEntries.map(e => e.id));

      logger.info('Experience points revoked successfully', {
        userId,
        habitId,
        totalPointsRevoked,
        domainsUpdated: domainUpdates.length,
        levelChanges: levelChanges.length,
      });

      return {
        totalPointsAwarded: -totalPointsRevoked,
        domainUpdates,
        levelChanges,
      };
    } catch (error) {
      logger.error('Failed to revoke experience points', error as Error, {
        userId,
        habitId,
        activityId,
      });
      throw error;
    }
  }

  /**
   * Find experience log entries for a habit/activity.
   */
  private async findExperienceLogEntries(
    userId: string,
    habitId: string,
    activityId?: string
  ): Promise<Array<{ id: string; domain_code: string; points_awarded: number }>> {
    let query = this.supabase
      .from('experience_log')
      .select('id, domain_code, points_awarded')
      .eq('user_id', userId)
      .eq('habit_id', habitId)
      .gt('points_awarded', 0); // Only find positive awards (not revocations)

    if (activityId) {
      query = query.eq('activity_id', activityId);
    }

    const { data, error } = await query;

    if (error) {
      logger.warning('Failed to find experience log entries', {
        error: error.message,
        userId,
        habitId,
        activityId,
      });
      return [];
    }

    return data ?? [];
  }

  /**
   * Revoke expertise for a single domain.
   */
  private async revokeDomainExpertise(
    userId: string,
    domainCode: string,
    pointsToRevoke: number
  ): Promise<DomainUpdate | null> {
    // Get current expertise record
    const currentExpertise = await this.expertiseRepo.getByDomain(userId, domainCode);

    if (!currentExpertise) {
      logger.warning('No expertise record found for domain', {
        userId,
        domainCode,
      });
      return null;
    }

    const oldExperiencePoints = currentExpertise.experience_points;
    const oldExpertiseLevel = currentExpertise.expertise_level;

    // Calculate new values (ensure points don't go below 0)
    const newExperiencePoints = Math.max(0, oldExperiencePoints - pointsToRevoke);
    const newExpertiseLevel = calculateExpertiseLevel(newExperiencePoints);
    const newTier = calculateTier(newExpertiseLevel);

    // Update expertise record
    await this.expertiseRepo.upsert(userId, domainCode, {
      domain_name: currentExpertise.domain_name,
      expertise_level: newExpertiseLevel,
      expertise_tier: newTier,
      experience_points: newExperiencePoints,
      habit_count: Math.max(0, (currentExpertise.habit_count ?? 1) - 1),
      last_activity_at: new Date().toISOString(),
    });

    return {
      domainCode,
      domainName: currentExpertise.domain_name,
      oldExpertiseLevel,
      newExpertiseLevel,
      oldExperiencePoints,
      newExperiencePoints,
      levelChanged: newExpertiseLevel !== oldExpertiseLevel,
    };
  }

  /**
   * Log experience revocation for audit purposes.
   */
  private async logExperienceRevocation(
    userId: string,
    habitId: string,
    activityId: string | undefined,
    originalEntry: { domain_code: string; points_awarded: number }
  ): Promise<void> {
    try {
      await this.supabase.from('experience_log').insert({
        user_id: userId,
        habit_id: habitId,
        activity_id: activityId ?? null,
        domain_code: originalEntry.domain_code,
        points_awarded: -originalEntry.points_awarded, // Negative to indicate revocation
        habit_level: null,
        quality_multiplier: 1.0,
        frequency_bonus: 0,
        completion_rate: null,
        applied_multiplier: null,
        multiplier_tier: null,
        multiplier_reason: 'revocation',
      });
    } catch (error) {
      logger.warning('Failed to log experience revocation', {
        error: String(error),
        userId,
        habitId,
      });
    }
  }

  /**
   * Delete experience log entries after revocation.
   */
  private async deleteExperienceLogEntries(entryIds: string[]): Promise<void> {
    if (entryIds.length === 0) return;

    try {
      const { error } = await this.supabase
        .from('experience_log')
        .delete()
        .in('id', entryIds);

      if (error) {
        logger.warning('Failed to delete experience log entries', {
          error: error.message,
          entryIds,
        });
      }
    } catch (error) {
      logger.warning('Exception deleting experience log entries', {
        error: String(error),
        entryIds,
      });
    }
  }
}
