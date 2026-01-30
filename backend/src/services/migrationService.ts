/**
 * Migration Service
 *
 * Manages the migration of existing user levels to the new rebalanced system.
 * This service provides:
 * - Batch migration jobs for all users
 * - Single user migration with compression function
 * - Rollback capabilities
 * - Migration status tracking
 * - Migration report generation
 *
 * Requirements: 5.1, 5.2, 5.3, 12.3
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getLogger } from '../utils/logger.js';
import { LevelConfigService } from './levelConfigService.js';
import {
  UserLevelRepository,
  UserExpertiseRepository,
  UserLevelHistoryRepository,
  type UserLevelRecord,
  type UserExpertiseRecord,
} from '../repositories/userLevelRepository.js';

const logger = getLogger('migrationService');

// =============================================================================
// Types
// =============================================================================

/**
 * Migration job status
 */
export type MigrationJobStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

/**
 * Migration job information
 */
export interface MigrationJob {
  jobId: string;
  status: MigrationJobStatus;
  totalUsers: number;
  processedUsers: number;
  startedAt: Date;
  completedAt?: Date;
  errors: MigrationError[];
}

/**
 * Migration error information
 */
export interface MigrationError {
  userId: string;
  error: string;
  timestamp: Date;
}

/**
 * Expertise level migration result
 */
export interface ExpertiseLevelMigration {
  domainCode: string;
  domainName: string;
  oldLevel: number;
  newLevel: number;
}

/**
 * Single user migration result
 */
export interface MigrationResult {
  userId: string;
  oldLevel: number;
  newLevel: number;
  compressionApplied: number;
  pioneerBadgeAwarded: boolean;
  expertiseLevels: ExpertiseLevelMigration[];
  migratedAt: Date;
}

/**
 * Rollback result
 */
export interface RollbackResult {
  success: boolean;
  usersRolledBack: number;
  errors: MigrationError[];
  rolledBackAt: Date;
}

/**
 * Migration status for a user
 */
export interface MigrationStatus {
  userId: string;
  isMigrated: boolean;
  migrationDate?: Date;
  oldLevel?: number;
  newLevel?: number;
  pioneerBadgeAwarded: boolean;
  canRollback: boolean;
}

/**
 * Migration report
 */
export interface MigrationReport {
  totalUsers: number;
  migratedUsers: number;
  averageLevelChange: number;
  maxLevelChange: number;
  pioneerBadgesAwarded: number;
  levelDistribution: {
    beginner: number;
    intermediate: number;
    advanced: number;
    expert: number;
  };
  errors: MigrationError[];
  generatedAt: Date;
}

/**
 * User levels backup record from database
 */
interface UserLevelsBackupRecord {
  id: string;
  user_id: string;
  old_overall_level: number;
  old_overall_tier: string;
  old_habit_continuity_power: number;
  old_resilience_score: number;
  old_total_experience_points: number;
  old_expertise_levels: ExpertiseLevelBackup[];
  backup_reason: string;
  backup_timestamp: string;
  restored_at: string | null;
  created_at: string;
}

/**
 * Expertise level backup data
 */
interface ExpertiseLevelBackup {
  domainCode: string;
  domainName: string;
  level: number;
  experiencePoints: number;
}

// =============================================================================
// Constants
// =============================================================================

/** Compression rate for level migration (50%) */
const COMPRESSION_RATE = 0.5;

/** Default batch size for migration */
const DEFAULT_BATCH_SIZE = 100;

/** Delay between batches in milliseconds */
const BATCH_DELAY_MS = 1000;

/** Pioneer badge threshold (old level >= 100) */
const PIONEER_BADGE_THRESHOLD = 100;

// =============================================================================
// Pure Functions (Exported for Testing)
// =============================================================================

/**
 * Apply compression function to a level.
 *
 * Property 5: Level Compression Correctness
 * Formula: new_level = floor(old_level * 0.5)
 * Constraint: new_level >= floor(old_level * 0.5) (50% floor)
 *
 * Validates: Requirements 5.2, 5.3
 *
 * @param oldLevel - Original level before migration
 * @param compressionRate - Compression rate (default 0.5)
 * @returns New compressed level
 */
export function applyCompression(
  oldLevel: number,
  compressionRate: number = COMPRESSION_RATE
): number {
  if (oldLevel <= 0) {
    return 0;
  }

  // Apply compression: new_level = floor(old_level * compression_rate)
  const compressedLevel = Math.floor(oldLevel * compressionRate);

  // Cap decrease at 50% of original level (Requirement 5.3)
  const minLevel = Math.floor(oldLevel * 0.5);

  // Return the maximum of compressed level and minimum allowed level
  return Math.max(compressedLevel, minLevel);
}

/**
 * Check if user qualifies for Pioneer Badge.
 *
 * Validates: Requirement 5.7
 *
 * @param oldLevel - Original level before migration
 * @returns True if user qualifies for Pioneer Badge
 */
export function qualifiesForPioneerBadge(oldLevel: number): boolean {
  return oldLevel >= PIONEER_BADGE_THRESHOLD;
}

// =============================================================================
// MigrationService Class
// =============================================================================

/**
 * Migration Service
 *
 * Manages the migration of existing user levels to the new rebalanced system.
 */
export class MigrationService {
  private readonly supabase: SupabaseClient;
  private readonly configService: LevelConfigService;
  private readonly userLevelRepo: UserLevelRepository;
  private readonly expertiseRepo: UserExpertiseRepository;
  private readonly historyRepo: UserLevelHistoryRepository;

  /**
   * Initialize the MigrationService.
   *
   * @param supabase - Supabase client instance
   */
  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.configService = new LevelConfigService(supabase);
    this.userLevelRepo = new UserLevelRepository(supabase);
    this.expertiseRepo = new UserExpertiseRepository(supabase);
    this.historyRepo = new UserLevelHistoryRepository(supabase);
  }

  // ===========================================================================
  // Public Methods
  // ===========================================================================

  /**
   * Start a batch migration job.
   *
   * Migrates all users in batches with configurable batch size.
   * Sets migration_in_progress feature flag during execution.
   *
   * Requirements: 5.1, 12.4
   *
   * @param batchSize - Number of users to process per batch (default 100)
   * @returns Migration job information
   */
  async startMigration(batchSize: number = DEFAULT_BATCH_SIZE): Promise<MigrationJob> {
    const jobId = crypto.randomUUID();
    const startedAt = new Date();
    const errors: MigrationError[] = [];

    logger.info('Starting migration job', { jobId, batchSize });

    try {
      // Check if migration is already in progress
      const inProgress = await this.configService.isMigrationInProgress();
      if (inProgress) {
        logger.warning('Migration already in progress', { jobId });
        throw new Error('Migration is already in progress');
      }

      // Set migration_in_progress flag
      await this.configService.setFeatureFlag('migration_in_progress', true, 'migration_service');

      // Get total user count
      const { count: totalUsers } = await this.supabase
        .from('user_levels')
        .select('*', { count: 'exact', head: true })
        .eq('is_migrated', false);

      if (!totalUsers || totalUsers === 0) {
        logger.info('No users to migrate', { jobId });
        await this.configService.setFeatureFlag('migration_in_progress', false, 'migration_service');
        return {
          jobId,
          status: 'completed',
          totalUsers: 0,
          processedUsers: 0,
          startedAt,
          completedAt: new Date(),
          errors: [],
        };
      }

      let processedUsers = 0;
      let offset = 0;

      // Process users in batches
      while (offset < totalUsers) {
        const { data: users, error: fetchError } = await this.supabase
          .from('user_levels')
          .select('user_id')
          .eq('is_migrated', false)
          .range(offset, offset + batchSize - 1);

        if (fetchError) {
          logger.error('Failed to fetch users for migration', fetchError, { jobId, offset });
          errors.push({
            userId: 'batch_fetch',
            error: fetchError.message,
            timestamp: new Date(),
          });
          break;
        }

        if (!users || users.length === 0) {
          break;
        }

        // Process each user in the batch
        for (const user of users) {
          try {
            await this.migrateUser(user.user_id);
            processedUsers++;
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Failed to migrate user', error as Error, { jobId, userId: user.user_id });
            errors.push({
              userId: user.user_id,
              error: errorMessage,
              timestamp: new Date(),
            });
          }
        }

        offset += batchSize;

        // Add delay between batches to prevent overload
        if (offset < totalUsers) {
          await this.delay(BATCH_DELAY_MS);
        }
      }

      // Clear migration_in_progress flag
      await this.configService.setFeatureFlag('migration_in_progress', false, 'migration_service');

      // Enable level rebalancing if migration was successful
      if (errors.length === 0 || errors.length / totalUsers < 0.05) {
        await this.configService.setFeatureFlag('level_rebalancing_enabled', true, 'migration_service');
      }

      const completedAt = new Date();
      const status: MigrationJobStatus = errors.length === 0 ? 'completed' : 'completed';

      logger.info('Migration job completed', {
        jobId,
        totalUsers,
        processedUsers,
        errorCount: errors.length,
        duration: completedAt.getTime() - startedAt.getTime(),
      });

      return {
        jobId,
        status,
        totalUsers,
        processedUsers,
        startedAt,
        completedAt,
        errors,
      };
    } catch (error) {
      // Ensure flag is cleared on error
      await this.configService.setFeatureFlag('migration_in_progress', false, 'migration_service');

      logger.error('Migration job failed', error as Error, { jobId });

      return {
        jobId,
        status: 'failed',
        totalUsers: 0,
        processedUsers: 0,
        startedAt,
        completedAt: new Date(),
        errors: [{
          userId: 'job',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date(),
        }],
      };
    }
  }

  /**
   * Migrate a single user to the new level system.
   *
   * Algorithm:
   * 1. Create backup of current levels
   * 2. Apply compression function: new_level = floor(old_level * 0.5)
   * 3. Cap decrease at 50% of original level
   * 4. Compress expertise levels similarly
   * 5. Update database
   * 6. Record history
   * 7. Award Pioneer Badge if eligible
   *
   * Requirements: 5.1, 5.2, 5.3, 5.4, 5.7
   *
   * @param userId - User ID to migrate
   * @returns Migration result
   */
  async migrateUser(userId: string): Promise<MigrationResult> {
    logger.info('Migrating user', { userId });

    try {
      // 1. Get current user levels
      const currentLevels = await this.userLevelRepo.getByUserId(userId);
      if (!currentLevels) {
        throw new Error(`User level not found for user ${userId}`);
      }

      // Check if already migrated
      const isMigrated = (currentLevels as UserLevelRecord & { is_migrated?: boolean }).is_migrated;
      if (isMigrated) {
        logger.debug('User already migrated', { userId });
        throw new Error(`User ${userId} has already been migrated`);
      }

      // Get expertise levels
      const expertiseLevels = await this.expertiseRepo.getByUserId(userId);

      // 2. Create backup before migration
      await this.createBackup(userId, currentLevels, expertiseLevels);

      // 3. Apply compression function (Requirement 5.2)
      const oldOverallLevel = currentLevels.overall_level;
      const newOverallLevel = applyCompression(oldOverallLevel, COMPRESSION_RATE);

      // 4. Compress expertise levels similarly
      const migratedExpertiseLevels: ExpertiseLevelMigration[] = [];
      for (const expertise of expertiseLevels) {
        const newExpertiseLevel = applyCompression(expertise.expertise_level, COMPRESSION_RATE);
        migratedExpertiseLevels.push({
          domainCode: expertise.domain_code,
          domainName: expertise.domain_name,
          oldLevel: expertise.expertise_level,
          newLevel: newExpertiseLevel,
        });

        // Update expertise level in database
        await this.expertiseRepo.upsert(userId, expertise.domain_code, {
          expertise_level: newExpertiseLevel,
          expertise_tier: this.calculateTier(newExpertiseLevel),
        });
      }

      // 5. Determine tier for new level
      const newTier = this.calculateTier(newOverallLevel);

      // 6. Check for Pioneer Badge eligibility (Requirement 5.7)
      const pioneerBadgeAwarded = qualifiesForPioneerBadge(oldOverallLevel);

      // 7. Update user levels in database
      const { error: updateError } = await this.supabase
        .from('user_levels')
        .update({
          overall_level: newOverallLevel,
          overall_tier: newTier,
          formula_version: 'v2.0',
          is_migrated: true,
          migration_date: new Date().toISOString(),
          pioneer_badge_awarded: pioneerBadgeAwarded,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (updateError) {
        throw new Error(`Failed to update user levels: ${updateError.message}`);
      }

      // 8. Record history (Requirement 5.4)
      await this.historyRepo.recordChange({
        user_id: userId,
        change_type: 'overall',
        domain_code: null,
        old_level: oldOverallLevel,
        new_level: newOverallLevel,
        change_reason: 'system_rebalancing',
        metrics_snapshot: {
          overallLevel: newOverallLevel,
          habitContinuityPower: currentLevels.habit_continuity_power,
          resilienceScore: currentLevels.resilience_score,
        },
      });

      // 9. Log migration
      await this.logMigration(userId, oldOverallLevel, newOverallLevel, pioneerBadgeAwarded, {
        expertiseLevels: migratedExpertiseLevels,
      });

      // 10. Award Pioneer Badge if eligible
      if (pioneerBadgeAwarded) {
        await this.awardPioneerBadge(userId);
      }

      const migratedAt = new Date();

      logger.info('User migrated successfully', {
        userId,
        oldLevel: oldOverallLevel,
        newLevel: newOverallLevel,
        pioneerBadgeAwarded,
      });

      return {
        userId,
        oldLevel: oldOverallLevel,
        newLevel: newOverallLevel,
        compressionApplied: COMPRESSION_RATE,
        pioneerBadgeAwarded,
        expertiseLevels: migratedExpertiseLevels,
        migratedAt,
      };
    } catch (error) {
      logger.error('Failed to migrate user', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Rollback migration for a user or all users.
   *
   * Restores levels from the backup table within 1 hour (Requirement 12.3).
   *
   * Requirements: 12.3, 12.7
   *
   * @param userId - Optional user ID to rollback (if not provided, rolls back all)
   * @returns Rollback result
   */
  async rollbackMigration(userId?: string): Promise<RollbackResult> {
    logger.info('Starting rollback', { userId: userId ?? 'all' });

    const errors: MigrationError[] = [];
    let usersRolledBack = 0;

    try {
      if (userId) {
        // Rollback single user
        await this.rollbackSingleUser(userId);
        usersRolledBack = 1;
      } else {
        // Rollback all migrated users
        const { data: backups, error: fetchError } = await this.supabase
          .from('user_levels_backup')
          .select('user_id')
          .is('restored_at', null);

        if (fetchError) {
          throw new Error(`Failed to fetch backups: ${fetchError.message}`);
        }

        if (backups && backups.length > 0) {
          for (const backup of backups) {
            try {
              await this.rollbackSingleUser(backup.user_id);
              usersRolledBack++;
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              errors.push({
                userId: backup.user_id,
                error: errorMessage,
                timestamp: new Date(),
              });
            }
          }
        }

        // Disable level rebalancing feature flag
        await this.configService.setFeatureFlag('level_rebalancing_enabled', false, 'migration_service');
      }

      logger.info('Rollback completed', {
        usersRolledBack,
        errorCount: errors.length,
      });

      return {
        success: errors.length === 0,
        usersRolledBack,
        errors,
        rolledBackAt: new Date(),
      };
    } catch (error) {
      logger.error('Rollback failed', error as Error, { userId });

      return {
        success: false,
        usersRolledBack,
        errors: [{
          userId: userId ?? 'all',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date(),
        }],
        rolledBackAt: new Date(),
      };
    }
  }

  /**
   * Get migration status for a user.
   *
   * Requirements: 10.4
   *
   * @param userId - User ID to check
   * @returns Migration status
   */
  async getMigrationStatus(userId: string): Promise<MigrationStatus> {
    logger.debug('Getting migration status', { userId });

    try {
      // Get user level record
      const { data: userLevel, error: levelError } = await this.supabase
        .from('user_levels')
        .select('is_migrated, migration_date, pioneer_badge_awarded, overall_level')
        .eq('user_id', userId)
        .single();

      if (levelError || !userLevel) {
        return {
          userId,
          isMigrated: false,
          pioneerBadgeAwarded: false,
          canRollback: false,
        };
      }

      // Check if backup exists for rollback
      const { data: backup } = await this.supabase
        .from('user_levels_backup')
        .select('old_overall_level, backup_timestamp')
        .eq('user_id', userId)
        .is('restored_at', null)
        .single();

      const canRollback = backup !== null;

      const result: MigrationStatus = {
        userId,
        isMigrated: userLevel.is_migrated ?? false,
        pioneerBadgeAwarded: userLevel.pioneer_badge_awarded ?? false,
        canRollback,
      };

      if (userLevel.migration_date) {
        result.migrationDate = new Date(userLevel.migration_date);
      }
      if (backup?.old_overall_level !== undefined) {
        result.oldLevel = backup.old_overall_level;
      }
      if (userLevel.overall_level !== undefined) {
        result.newLevel = userLevel.overall_level;
      }

      return result;
    } catch (error) {
      logger.error('Failed to get migration status', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Generate a migration report.
   *
   * Requirements: 12.5
   *
   * @returns Migration report
   */
  async generateMigrationReport(): Promise<MigrationReport> {
    logger.info('Generating migration report');

    try {
      // Get total users
      const { count: totalUsers } = await this.supabase
        .from('user_levels')
        .select('*', { count: 'exact', head: true });

      // Get migrated users
      const { count: migratedUsers } = await this.supabase
        .from('user_levels')
        .select('*', { count: 'exact', head: true })
        .eq('is_migrated', true);

      // Get migration logs for statistics
      const { data: migrationLogs } = await this.supabase
        .from('migration_log')
        .select('old_level, new_level, pioneer_badge_awarded')
        .eq('migration_type', 'level_rebalancing');

      let totalLevelChange = 0;
      let maxLevelChange = 0;
      let pioneerBadgesAwarded = 0;

      if (migrationLogs && migrationLogs.length > 0) {
        for (const log of migrationLogs) {
          if (log.old_level !== null && log.new_level !== null) {
            const change = log.old_level - log.new_level;
            totalLevelChange += change;
            maxLevelChange = Math.max(maxLevelChange, change);
          }
          if (log.pioneer_badge_awarded) {
            pioneerBadgesAwarded++;
          }
        }
      }

      const averageLevelChange = migrationLogs && migrationLogs.length > 0
        ? totalLevelChange / migrationLogs.length
        : 0;

      // Get level distribution
      const { data: levelDistribution } = await this.supabase
        .from('user_levels')
        .select('overall_tier')
        .eq('is_migrated', true);

      const distribution = {
        beginner: 0,
        intermediate: 0,
        advanced: 0,
        expert: 0,
      };

      if (levelDistribution) {
        for (const record of levelDistribution) {
          const tier = record.overall_tier as keyof typeof distribution;
          if (tier in distribution) {
            distribution[tier]++;
          }
        }
      }

      // Get errors from migration logs
      const { data: errorLogs } = await this.supabase
        .from('migration_log')
        .select('user_id, details, migrated_at')
        .eq('migration_type', 'level_rebalancing')
        .not('details->error', 'is', null)
        .limit(100);

      const errors: MigrationError[] = (errorLogs ?? []).map(log => ({
        userId: log.user_id,
        error: (log.details as Record<string, unknown>)?.['error'] as string ?? 'Unknown error',
        timestamp: new Date(log.migrated_at),
      }));

      const report: MigrationReport = {
        totalUsers: totalUsers ?? 0,
        migratedUsers: migratedUsers ?? 0,
        averageLevelChange,
        maxLevelChange,
        pioneerBadgesAwarded,
        levelDistribution: distribution,
        errors,
        generatedAt: new Date(),
      };

      logger.info('Migration report generated', {
        totalUsers: report.totalUsers,
        migratedUsers: report.migratedUsers,
        averageLevelChange: report.averageLevelChange,
      });

      return report;
    } catch (error) {
      logger.error('Failed to generate migration report', error as Error);
      throw error;
    }
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Create a backup of user levels before migration.
   *
   * Requirements: 12.1, 12.2
   *
   * @param userId - User ID
   * @param userLevel - Current user level record
   * @param expertiseLevels - Current expertise levels
   */
  private async createBackup(
    userId: string,
    userLevel: UserLevelRecord,
    expertiseLevels: UserExpertiseRecord[]
  ): Promise<void> {
    const expertiseBackup: ExpertiseLevelBackup[] = expertiseLevels.map(exp => ({
      domainCode: exp.domain_code,
      domainName: exp.domain_name,
      level: exp.expertise_level,
      experiencePoints: exp.experience_points,
    }));

    const { error } = await this.supabase
      .from('user_levels_backup')
      .insert({
        user_id: userId,
        old_overall_level: userLevel.overall_level,
        old_overall_tier: userLevel.overall_tier,
        old_habit_continuity_power: userLevel.habit_continuity_power,
        old_resilience_score: userLevel.resilience_score,
        old_total_experience_points: userLevel.total_experience_points,
        old_expertise_levels: expertiseBackup,
        backup_reason: 'system_rebalancing',
        backup_timestamp: new Date().toISOString(),
      });

    if (error) {
      throw new Error(`Failed to create backup: ${error.message}`);
    }

    logger.debug('Backup created', { userId });
  }

  /**
   * Rollback a single user's migration.
   *
   * @param userId - User ID to rollback
   */
  private async rollbackSingleUser(userId: string): Promise<void> {
    logger.debug('Rolling back user', { userId });

    // Get backup
    const { data: backup, error: backupError } = await this.supabase
      .from('user_levels_backup')
      .select('*')
      .eq('user_id', userId)
      .is('restored_at', null)
      .single();

    if (backupError || !backup) {
      throw new Error(`No backup found for user ${userId}`);
    }

    const backupRecord = backup as UserLevelsBackupRecord;

    // Restore user levels
    const { error: updateError } = await this.supabase
      .from('user_levels')
      .update({
        overall_level: backupRecord.old_overall_level,
        overall_tier: backupRecord.old_overall_tier,
        habit_continuity_power: backupRecord.old_habit_continuity_power,
        resilience_score: backupRecord.old_resilience_score,
        is_migrated: false,
        migration_date: null,
        pioneer_badge_awarded: false,
        formula_version: 'v1.0',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (updateError) {
      throw new Error(`Failed to restore user levels: ${updateError.message}`);
    }

    // Restore expertise levels
    for (const expertise of backupRecord.old_expertise_levels) {
      await this.expertiseRepo.upsert(userId, expertise.domainCode, {
        expertise_level: expertise.level,
        expertise_tier: this.calculateTier(expertise.level),
        experience_points: expertise.experiencePoints,
      });
    }

    // Mark backup as restored
    await this.supabase
      .from('user_levels_backup')
      .update({ restored_at: new Date().toISOString() })
      .eq('id', backupRecord.id);

    // Record rollback in history
    await this.historyRepo.recordChange({
      user_id: userId,
      change_type: 'overall',
      domain_code: null,
      old_level: null,
      new_level: backupRecord.old_overall_level,
      change_reason: 'migration_rollback',
      metrics_snapshot: {
        overallLevel: backupRecord.old_overall_level,
        habitContinuityPower: backupRecord.old_habit_continuity_power,
        resilienceScore: backupRecord.old_resilience_score,
      },
    });

    // Log rollback
    await this.logMigration(
      userId,
      null,
      backupRecord.old_overall_level,
      false,
      { rollbackFrom: 'v2.0', rollbackTo: 'v1.0' },
      'rollback'
    );

    logger.debug('User rolled back', { userId });
  }

  /**
   * Log migration to migration_log table.
   *
   * @param userId - User ID
   * @param oldLevel - Old level (null for rollback)
   * @param newLevel - New level
   * @param pioneerBadgeAwarded - Whether Pioneer Badge was awarded
   * @param details - Additional details
   * @param migrationType - Type of migration
   */
  private async logMigration(
    userId: string,
    oldLevel: number | null,
    newLevel: number,
    pioneerBadgeAwarded: boolean,
    details: Record<string, unknown>,
    migrationType: 'level_rebalancing' | 'thli_recalibration' | 'rollback' = 'level_rebalancing'
  ): Promise<void> {
    const { error } = await this.supabase
      .from('migration_log')
      .insert({
        user_id: userId,
        migration_type: migrationType,
        old_level: oldLevel,
        new_level: newLevel,
        compression_rate: migrationType === 'level_rebalancing' ? COMPRESSION_RATE : null,
        pioneer_badge_awarded: pioneerBadgeAwarded,
        details,
        migrated_at: new Date().toISOString(),
      });

    if (error) {
      logger.warning('Failed to log migration', { userId, error: error.message });
    }
  }

  /**
   * Award Pioneer Badge to a user.
   *
   * Requirement: 5.7
   *
   * @param userId - User ID
   */
  private async awardPioneerBadge(userId: string): Promise<void> {
    logger.debug('Awarding Pioneer Badge', { userId });

    // Check if badges table exists and insert badge
    // This is a simplified implementation - actual badge system may vary
    try {
      const { error } = await this.supabase
        .from('user_badges')
        .upsert({
          user_id: userId,
          badge_code: 'pioneer',
          badge_name: 'Pioneer',
          description: 'Awarded to users who reached Lv.100+ before the level system rebalancing',
          awarded_at: new Date().toISOString(),
        }, { onConflict: 'user_id,badge_code' });

      if (error) {
        // Badge table might not exist yet - log warning but don't fail
        logger.warning('Failed to award Pioneer Badge', { userId, error: error.message });
      }
    } catch (error) {
      logger.warning('Pioneer Badge award failed', { userId, error });
    }
  }

  /**
   * Calculate tier from level.
   *
   * @param level - Level value
   * @returns Tier name
   */
  private calculateTier(level: number): 'beginner' | 'intermediate' | 'advanced' | 'expert' {
    if (level >= 500) return 'expert';
    if (level >= 100) return 'advanced';
    if (level >= 50) return 'intermediate';
    return 'beginner';
  }

  /**
   * Delay execution for specified milliseconds.
   *
   * @param ms - Milliseconds to delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new MigrationService instance.
 *
 * @param supabase - Supabase client instance
 * @returns MigrationService instance
 */
export function createMigrationService(supabase: SupabaseClient): MigrationService {
  return new MigrationService(supabase);
}
