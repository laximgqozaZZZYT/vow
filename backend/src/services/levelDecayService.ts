/**
 * Level Decay Service
 *
 * Manages level decay for inactive users. Expertise levels decay over time
 * when users are inactive in specific domains.
 *
 * Level Decay Rules (from design.md):
 * - Grace period: 14 days of inactivity before decay starts
 * - Decay rate: 1 point per week after grace period
 * - Maximum decay: 20% of original level
 * - Decay applies only to expertise levels, NOT to habit_continuity_power or resilience_score
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getLogger } from '../utils/logger.js';
import {
  UserExpertiseRepository,
  UserLevelHistoryRepository,
  type UserExpertiseRecord,
  type MetricsSnapshot,
} from '../repositories/userLevelRepository.js';
import { calculateTier } from './userLevelService.js';

const logger = getLogger('levelDecayService');

// =============================================================================
// Constants
// =============================================================================

/** Grace period in days before decay starts (Requirement 8.1) */
export const GRACE_PERIOD_DAYS = 14;

/** Decay rate: points per week of inactivity (Requirement 8.2) */
export const DECAY_PER_WEEK = 1;

/** Maximum decay as a percentage of original level (Requirement 8.3) */
export const MAX_DECAY_PERCENT = 0.20;

/** Milliseconds per day */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Days per week */
const DAYS_PER_WEEK = 7;

// =============================================================================
// Types
// =============================================================================

/**
 * Result of decay calculation for a single expertise domain
 */
export interface DecayCalculation {
  /** Whether decay should be applied */
  shouldDecay: boolean;
  /** Current expertise level before decay */
  currentLevel: number;
  /** Level after decay is applied */
  decayedLevel: number;
  /** Amount of decay to apply */
  decayAmount: number;
  /** Reason for the decay calculation result */
  reason: string;
}

/**
 * Detail of decay applied to a single domain
 */
export interface DecayDetail {
  /** Domain code */
  domainCode: string;
  /** Domain name */
  domainName: string;
  /** Level before decay */
  oldLevel: number;
  /** Level after decay */
  newLevel: number;
  /** Amount decayed */
  decayAmount: number;
  /** Days since last activity */
  daysSinceActivity: number;
}

/**
 * Result of applying decay to a user
 */
export interface DecayResult {
  /** User ID */
  userId: string;
  /** Number of domains that had decay applied */
  domainsDecayed: number;
  /** Total points decayed across all domains */
  totalPointsDecayed: number;
  /** Details of each domain's decay */
  decayDetails: DecayDetail[];
}

/**
 * Expertise record with decay eligibility information
 */
export interface ExpertiseWithDecay {
  /** The expertise record */
  expertise: UserExpertiseRecord;
  /** Days since last activity */
  daysSinceActivity: number;
  /** Whether this expertise is eligible for decay */
  isEligibleForDecay: boolean;
  /** Calculated decay if applied */
  calculatedDecay: DecayCalculation;
}

/**
 * Result of batch decay operation
 */
export interface BatchDecayResult {
  /** Number of users processed */
  usersProcessed: number;
  /** Number of users that had decay applied */
  usersDecayed: number;
  /** Total domains decayed across all users */
  totalDomainsDecayed: number;
  /** Total points decayed across all users */
  totalPointsDecayed: number;
  /** Any errors that occurred */
  errors: string[];
}

// =============================================================================
// Pure Calculation Functions (Exported for Testing)
// =============================================================================

/**
 * Calculate decay amount for an expertise level based on days of inactivity.
 *
 * Property 13: Level Decay Rules
 * - Decay begins after the 14-day grace period (Requirement 8.1)
 * - Decay rate is 1 point per week of inactivity (Requirement 8.2)
 * - Maximum decay is 20% of the original expertise_level (Requirement 8.3)
 *
 * @param expertiseLevel - Current expertise level (0-199)
 * @param daysSinceLastActivity - Days since last activity in this domain
 * @returns Decay calculation result
 */
export function calculateDecay(
  expertiseLevel: number,
  daysSinceLastActivity: number
): DecayCalculation {
  // Validate inputs
  if (expertiseLevel <= 0) {
    return {
      shouldDecay: false,
      currentLevel: expertiseLevel,
      decayedLevel: expertiseLevel,
      decayAmount: 0,
      reason: 'Level is already 0, no decay needed',
    };
  }

  // Check grace period (Requirement 8.1)
  if (daysSinceLastActivity <= GRACE_PERIOD_DAYS) {
    return {
      shouldDecay: false,
      currentLevel: expertiseLevel,
      decayedLevel: expertiseLevel,
      decayAmount: 0,
      reason: `Within ${GRACE_PERIOD_DAYS}-day grace period (${daysSinceLastActivity} days inactive)`,
    };
  }

  // Calculate weeks of inactivity after grace period (Requirement 8.2)
  const daysAfterGrace = daysSinceLastActivity - GRACE_PERIOD_DAYS;
  const weeksInactive = Math.floor(daysAfterGrace / DAYS_PER_WEEK);

  if (weeksInactive <= 0) {
    return {
      shouldDecay: false,
      currentLevel: expertiseLevel,
      decayedLevel: expertiseLevel,
      decayAmount: 0,
      reason: `Less than 1 week after grace period (${daysAfterGrace} days after grace)`,
    };
  }

  // Calculate raw decay: 1 point per week (Requirement 8.2)
  const rawDecay = weeksInactive * DECAY_PER_WEEK;

  // Calculate maximum allowed decay: 20% of original level (Requirement 8.3)
  const maxDecay = Math.floor(expertiseLevel * MAX_DECAY_PERCENT);

  // Apply the lesser of raw decay or max decay
  const actualDecay = Math.min(rawDecay, maxDecay);

  // Ensure we don't go below 0
  const decayedLevel = Math.max(0, expertiseLevel - actualDecay);
  const finalDecayAmount = expertiseLevel - decayedLevel;

  if (finalDecayAmount <= 0) {
    return {
      shouldDecay: false,
      currentLevel: expertiseLevel,
      decayedLevel: expertiseLevel,
      decayAmount: 0,
      reason: `Maximum decay (${MAX_DECAY_PERCENT * 100}%) already reached`,
    };
  }

  return {
    shouldDecay: true,
    currentLevel: expertiseLevel,
    decayedLevel,
    decayAmount: finalDecayAmount,
    reason: `${weeksInactive} weeks inactive after grace period, decay capped at ${MAX_DECAY_PERCENT * 100}% (max ${maxDecay} points)`,
  };
}

/**
 * Calculate days since last activity from a date.
 *
 * @param lastActivityAt - Last activity timestamp (ISO string or null)
 * @param referenceDate - Reference date for calculation (defaults to now)
 * @returns Days since last activity, or Infinity if never active
 */
export function calculateDaysSinceActivity(
  lastActivityAt: string | null,
  referenceDate: Date = new Date()
): number {
  if (!lastActivityAt) {
    // Never had activity - treat as infinite days
    return Infinity;
  }

  const lastActivity = new Date(lastActivityAt);
  const diffMs = referenceDate.getTime() - lastActivity.getTime();
  return Math.floor(diffMs / MS_PER_DAY);
}

// =============================================================================
// LevelDecayService Class
// =============================================================================

/**
 * Level Decay Service
 *
 * Manages level decay for inactive users. This service:
 * 1. Identifies expertise domains eligible for decay
 * 2. Calculates appropriate decay amounts
 * 3. Applies decay to expertise levels
 * 4. Records decay in level history
 *
 * Important: Decay applies ONLY to expertise levels (Requirement 8.4).
 * habit_continuity_power and resilience_score are NOT subject to decay (Requirement 8.5).
 */
export class LevelDecayService {
  private readonly supabase: SupabaseClient;
  private readonly expertiseRepo: UserExpertiseRepository;
  private readonly historyRepo: UserLevelHistoryRepository;

  /**
   * Initialize the LevelDecayService.
   *
   * @param supabase - Supabase client instance
   */
  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.expertiseRepo = new UserExpertiseRepository(supabase);
    this.historyRepo = new UserLevelHistoryRepository(supabase);
  }

  // ===========================================================================
  // Public Methods
  // ===========================================================================

  /**
   * Get expertise records eligible for decay for a user.
   *
   * Returns all expertise records with their decay eligibility status
   * and calculated decay amounts.
   *
   * @param userId - The user ID
   * @returns Array of expertise records with decay information
   */
  async getDecayableExpertise(userId: string): Promise<ExpertiseWithDecay[]> {
    logger.info('Getting decayable expertise', { userId });

    try {
      // Get all expertise records that might need decay
      const expertiseRecords = await this.expertiseRepo.getExpertiseForDecay(
        userId,
        GRACE_PERIOD_DAYS
      );

      const now = new Date();
      const results: ExpertiseWithDecay[] = [];

      for (const expertise of expertiseRecords) {
        const daysSinceActivity = calculateDaysSinceActivity(
          expertise.last_activity_at,
          now
        );

        const calculatedDecay = calculateDecay(
          expertise.expertise_level,
          daysSinceActivity
        );

        results.push({
          expertise,
          daysSinceActivity,
          isEligibleForDecay: calculatedDecay.shouldDecay,
          calculatedDecay,
        });
      }

      logger.debug('Decayable expertise retrieved', {
        userId,
        totalRecords: results.length,
        eligibleForDecay: results.filter(r => r.isEligibleForDecay).length,
      });

      return results;
    } catch (error) {
      logger.error('Failed to get decayable expertise', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Apply decay to all eligible expertise domains for a user.
   *
   * This method:
   * 1. Gets all expertise records eligible for decay
   * 2. Calculates decay for each
   * 3. Updates expertise levels
   * 4. Records changes in history
   *
   * Requirements: 8.1, 8.2, 8.3, 8.4, 8.6
   *
   * @param userId - The user ID
   * @returns Decay result with details of all decayed domains
   */
  async applyDecay(userId: string): Promise<DecayResult> {
    logger.info('Applying decay for user', { userId });

    try {
      const decayableExpertise = await this.getDecayableExpertise(userId);
      const decayDetails: DecayDetail[] = [];
      let totalPointsDecayed = 0;

      for (const item of decayableExpertise) {
        if (!item.isEligibleForDecay) {
          continue;
        }

        const { expertise, daysSinceActivity, calculatedDecay } = item;

        // Apply decay to the expertise record
        await this.applyDecayToExpertise(
          userId,
          expertise.domain_code,
          calculatedDecay.decayedLevel
        );

        // Record in history (Requirement 8.6)
        await this.recordDecayHistory(
          userId,
          expertise.domain_code,
          calculatedDecay.currentLevel,
          calculatedDecay.decayedLevel
        );

        decayDetails.push({
          domainCode: expertise.domain_code,
          domainName: expertise.domain_name,
          oldLevel: calculatedDecay.currentLevel,
          newLevel: calculatedDecay.decayedLevel,
          decayAmount: calculatedDecay.decayAmount,
          daysSinceActivity,
        });

        totalPointsDecayed += calculatedDecay.decayAmount;
      }

      const result: DecayResult = {
        userId,
        domainsDecayed: decayDetails.length,
        totalPointsDecayed,
        decayDetails,
      };

      logger.info('Decay applied successfully', {
        userId,
        domainsDecayed: result.domainsDecayed,
        totalPointsDecayed: result.totalPointsDecayed,
      });

      return result;
    } catch (error) {
      logger.error('Failed to apply decay', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Apply decay to all users in batch.
   *
   * This method is designed to be called by the scheduled job service.
   * It processes users in batches to avoid database overload.
   *
   * Requirements: 8.7, 14.5
   *
   * @param batchSize - Number of users to process per batch (default 100)
   * @param delayMs - Delay between batches in milliseconds (default 1000)
   * @returns Batch decay result
   */
  async applyDecayBatch(
    batchSize = 100,
    delayMs = 1000
  ): Promise<BatchDecayResult> {
    logger.info('Starting batch decay process', { batchSize, delayMs });

    const result: BatchDecayResult = {
      usersProcessed: 0,
      usersDecayed: 0,
      totalDomainsDecayed: 0,
      totalPointsDecayed: 0,
      errors: [],
    };

    try {
      // Get all users with expertise records
      const userIds = await this.getUsersWithExpertise();

      logger.info('Found users with expertise', { count: userIds.length });

      // Process in batches
      for (let i = 0; i < userIds.length; i += batchSize) {
        const batch = userIds.slice(i, i + batchSize);

        for (const userId of batch) {
          try {
            const decayResult = await this.applyDecay(userId);
            result.usersProcessed++;

            if (decayResult.domainsDecayed > 0) {
              result.usersDecayed++;
              result.totalDomainsDecayed += decayResult.domainsDecayed;
              result.totalPointsDecayed += decayResult.totalPointsDecayed;
            }
          } catch (error) {
            const errorMessage = `Failed to apply decay for user ${userId}: ${String(error)}`;
            logger.warning(errorMessage);
            result.errors.push(errorMessage);
          }
        }

        // Delay between batches (except for last batch)
        if (i + batchSize < userIds.length && delayMs > 0) {
          await this.delay(delayMs);
        }
      }

      logger.info('Batch decay process completed', {
        usersProcessed: result.usersProcessed,
        usersDecayed: result.usersDecayed,
        totalDomainsDecayed: result.totalDomainsDecayed,
        totalPointsDecayed: result.totalPointsDecayed,
        errorCount: result.errors.length,
      });

      return result;
    } catch (error) {
      logger.error('Batch decay process failed', error as Error);
      result.errors.push(`Batch process error: ${String(error)}`);
      return result;
    }
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Apply decay to a single expertise record.
   *
   * @param userId - The user ID
   * @param domainCode - The domain code
   * @param newLevel - The new expertise level after decay
   */
  private async applyDecayToExpertise(
    userId: string,
    domainCode: string,
    newLevel: number
  ): Promise<void> {
    const newTier = calculateTier(newLevel);

    await this.expertiseRepo.upsert(userId, domainCode, {
      expertise_level: newLevel,
      expertise_tier: newTier,
      // Note: We don't update last_activity_at - decay doesn't count as activity
    });
  }

  /**
   * Record decay in level history.
   *
   * Property 15: Level History Recording
   * Requirement 8.6
   *
   * @param userId - The user ID
   * @param domainCode - The domain code
   * @param oldLevel - Previous expertise level
   * @param newLevel - New expertise level after decay
   */
  private async recordDecayHistory(
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
        change_reason: 'level_decay',
        metrics_snapshot: metricsSnapshot,
      });
    } catch (error) {
      logger.warning('Failed to record decay history', {
        error: String(error),
        userId,
        domainCode,
        oldLevel,
        newLevel,
      });
      // Don't throw - history recording failure shouldn't block decay
    }
  }

  /**
   * Get all user IDs that have expertise records.
   *
   * @returns Array of user IDs
   */
  private async getUsersWithExpertise(): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('user_expertise')
      .select('user_id')
      .gt('expertise_level', 0);

    if (error) {
      logger.error('Failed to get users with expertise', new Error(error.message));
      return [];
    }

    // Get unique user IDs
    const userIdSet = new Set<string>();
    for (const row of data ?? []) {
      userIdSet.add(row.user_id as string);
    }
    return Array.from(userIdSet);
  }

  /**
   * Delay execution for a specified time.
   *
   * @param ms - Milliseconds to delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
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
   * Get the history repository.
   */
  get historyRepository(): UserLevelHistoryRepository {
    return this.historyRepo;
  }
}
