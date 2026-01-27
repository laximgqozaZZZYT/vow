/**
 * Level Manager Service
 *
 * Manages level changes, detects level-up/level-down candidates,
 * and coordinates baby step generation.
 *
 * Requirements:
 * - 5.1, 5.4, 5.5: Level-up detection and application
 * - 6.1, 6.6: Level-down detection and application
 * - 9.1, 9.4: Level history retrieval
 * - 17.2, 17.3: Scheduled detection jobs
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getLogger } from '../utils/logger.js';
import { HabitRepository } from '../repositories/habitRepository.js';
import { ActivityRepository } from '../repositories/activityRepository.js';
import type { Habit } from '../schemas/habit.js';
import type {
  LevelSuggestion,
  LevelChange,
  LevelHistoryFilters,
  WorkloadChanges,
  BabyStepPlan,
  LevelChangeReason,
  SuggestionType,
  SuggestionStatus,
} from '../types/thli.js';
import { calculateLevelTier } from '../types/thli.js';

const logger = getLogger('levelManagerService');

// =============================================================================
// Constants
// =============================================================================

/** Days to analyze for level-up detection (Requirement 5.1) */
const LEVEL_UP_ANALYSIS_DAYS = 30;

/** Minimum completion rate for level-up (Requirement 5.1) */
const LEVEL_UP_MIN_COMPLETION_RATE = 0.9;

/** Minimum days since last level change for level-up (Requirement 5.5) */
const LEVEL_UP_MIN_DAYS_SINCE_CHANGE = 30;

/** Days to analyze for level-down detection (Requirement 6.1) */
const LEVEL_DOWN_ANALYSIS_DAYS = 14;

/** Maximum completion rate for level-down (Requirement 6.1) */
const LEVEL_DOWN_MAX_COMPLETION_RATE = 0.5;

/** Minimum days active for level-down (Requirement 6.1) */
const LEVEL_DOWN_MIN_DAYS_ACTIVE = 14;


// =============================================================================
// Database Row Types
// =============================================================================

/**
 * Database row type for level_history table
 */
interface LevelHistoryRow {
  id: string;
  entity_type: 'habit' | 'goal';
  entity_id: string;
  old_level: number | null;
  new_level: number;
  reason: string;
  workload_delta: WorkloadChanges | null;
  assessed_at: string;
  created_at: string;
}

/**
 * Database row type for level_suggestions table
 */
interface LevelSuggestionRow {
  id: string;
  habit_id: string;
  user_id: string;
  suggestion_type: SuggestionType;
  current_level: number;
  target_level: number;
  proposed_changes: WorkloadChanges | BabyStepPlan;
  reason: string;
  detected_at: string;
  status: SuggestionStatus;
  responded_at: string | null;
  created_at: string;
}

// =============================================================================
// LevelManagerService Class
// =============================================================================

/**
 * Level Manager Service
 *
 * Manages level changes, detects level-up/level-down candidates,
 * and coordinates baby step generation.
 *
 * Property 15: Level-Up Candidate Detection
 * For any active habit, if completion_rate >= 0.9 over the past 30 days
 * AND days_since_last_level_change >= 30 AND level IS NOT NULL,
 * then the habit must be flagged as a level-up candidate.
 *
 * Property 16: Level-Up Frequency Limit
 * Level-up suggestions must not be created more frequently than once per 30 days.
 *
 * Property 17: Level-Down Candidate Detection
 * For any active habit, if completion_rate < 0.5 over the past 14 days
 * AND days_active >= 14 AND level IS NOT NULL,
 * then the habit must be flagged as a level-down candidate.
 */
export class LevelManagerService {
  private readonly supabase: SupabaseClient;
  private readonly habitRepo: HabitRepository;
  private readonly activityRepo: ActivityRepository;

  /**
   * Initialize the LevelManagerService.
   *
   * @param supabase - Supabase client instance
   */
  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.habitRepo = new HabitRepository(supabase);
    this.activityRepo = new ActivityRepository(supabase);
  }


  // ===========================================================================
  // 8.1: detectLevelUpCandidates - レベルアップ候補の検出
  // ===========================================================================

  /**
   * Detect habits that are candidates for level-up.
   *
   * Requirements: 5.1, 17.2
   * Property 15: Level-Up Candidate Detection
   *
   * Criteria:
   * - completion_rate >= 0.9 over 30 days
   * - days_since_last_level_change >= 30
   * - level IS NOT NULL
   *
   * @param userId - The user to check
   * @returns Array of level-up candidates
   */
  async detectLevelUpCandidates(userId: string): Promise<LevelSuggestion[]> {
    logger.info('Detecting level-up candidates', { userId });

    const candidates: LevelSuggestion[] = [];

    try {
      // 1. Get all active habits with level for the user
      const habits = await this.getActiveHabitsWithLevel(userId);

      if (habits.length === 0) {
        logger.debug('No active habits with level found', { userId });
        return [];
      }

      // 2. Calculate date range for analysis (past 30 days)
      const now = new Date();
      const analysisStart = new Date(now);
      analysisStart.setDate(analysisStart.getDate() - LEVEL_UP_ANALYSIS_DAYS);

      // 3. Check each habit for level-up eligibility
      for (const habit of habits) {
        // Skip if level is null
        if (habit.level === null || habit.level === undefined) {
          continue;
        }

        // Check days since last level change (Requirement 5.5)
        const daysSinceLastChange = await this.getDaysSinceLastLevelChange(habit.id);
        if (daysSinceLastChange < LEVEL_UP_MIN_DAYS_SINCE_CHANGE) {
          logger.debug('Habit skipped: recent level change', {
            habitId: habit.id,
            daysSinceLastChange,
          });
          continue;
        }

        // Calculate completion rate over 30 days
        const completionRate = await this.calculateCompletionRate(
          habit,
          analysisStart,
          now
        );

        // Check if completion rate meets threshold (Requirement 5.1)
        if (completionRate >= LEVEL_UP_MIN_COMPLETION_RATE) {
          // Calculate target level (current + 10-20 points)
          const targetLevel = Math.min(199, habit.level + 15);

          // Create level-up suggestion
          const suggestion: LevelSuggestion = {
            id: '', // Will be set when stored
            habitId: habit.id,
            habitName: habit.name,
            suggestionType: 'level_up',
            currentLevel: habit.level,
            targetLevel,
            proposedChanges: this.calculateLevelUpWorkloadChanges(habit, targetLevel),
            reason: `完了率 ${(completionRate * 100).toFixed(0)}% (過去30日間)`,
            detectedAt: now,
            status: 'pending',
          };

          candidates.push(suggestion);

          logger.info('Level-up candidate detected', {
            habitId: habit.id,
            habitName: habit.name,
            currentLevel: habit.level,
            targetLevel,
            completionRate,
          });
        }
      }

      logger.info('Level-up detection complete', {
        userId,
        candidatesFound: candidates.length,
      });

      return candidates;
    } catch (error) {
      logger.error('Failed to detect level-up candidates', error as Error, { userId });
      throw error;
    }
  }


  // ===========================================================================
  // 8.2: detectLevelDownCandidates - レベルダウン候補の検出
  // ===========================================================================

  /**
   * Detect habits that are candidates for level-down.
   *
   * Requirements: 6.1, 17.3
   * Property 17: Level-Down Candidate Detection
   *
   * Criteria:
   * - completion_rate < 0.5 over 14 days
   * - days_active >= 14
   * - level IS NOT NULL
   *
   * @param userId - The user to check
   * @returns Array of level-down candidates
   */
  async detectLevelDownCandidates(userId: string): Promise<LevelSuggestion[]> {
    logger.info('Detecting level-down candidates', { userId });

    const candidates: LevelSuggestion[] = [];

    try {
      // 1. Get all active habits with level for the user
      const habits = await this.getActiveHabitsWithLevel(userId);

      if (habits.length === 0) {
        logger.debug('No active habits with level found', { userId });
        return [];
      }

      // 2. Calculate date range for analysis (past 14 days)
      const now = new Date();
      const analysisStart = new Date(now);
      analysisStart.setDate(analysisStart.getDate() - LEVEL_DOWN_ANALYSIS_DAYS);

      // 3. Check each habit for level-down eligibility
      for (const habit of habits) {
        // Skip if level is null
        if (habit.level === null || habit.level === undefined) {
          continue;
        }

        // Check days active (Requirement 6.1)
        const daysActive = await this.getDaysActive(habit.id);
        if (daysActive < LEVEL_DOWN_MIN_DAYS_ACTIVE) {
          logger.debug('Habit skipped: not active long enough', {
            habitId: habit.id,
            daysActive,
          });
          continue;
        }

        // Calculate completion rate over 14 days
        const completionRate = await this.calculateCompletionRate(
          habit,
          analysisStart,
          now
        );

        // Check if completion rate is below threshold (Requirement 6.1)
        if (completionRate < LEVEL_DOWN_MAX_COMPLETION_RATE) {
          // Calculate target level (Lv.50 = current * 0.5)
          const targetLevel = Math.floor(habit.level * 0.5);

          // Create level-down suggestion
          const suggestion: LevelSuggestion = {
            id: '', // Will be set when stored
            habitId: habit.id,
            habitName: habit.name,
            suggestionType: 'level_down',
            currentLevel: habit.level,
            targetLevel,
            proposedChanges: this.calculateLevelDownWorkloadChanges(habit, targetLevel),
            reason: `完了率 ${(completionRate * 100).toFixed(0)}% (過去14日間)`,
            detectedAt: now,
            status: 'pending',
          };

          candidates.push(suggestion);

          logger.info('Level-down candidate detected', {
            habitId: habit.id,
            habitName: habit.name,
            currentLevel: habit.level,
            targetLevel,
            completionRate,
          });
        }
      }

      logger.info('Level-down detection complete', {
        userId,
        candidatesFound: candidates.length,
      });

      return candidates;
    } catch (error) {
      logger.error('Failed to detect level-down candidates', error as Error, { userId });
      throw error;
    }
  }


  // ===========================================================================
  // 8.3: applyLevelUp - レベルアップの適用
  // ===========================================================================

  /**
   * Apply a level-up to a habit.
   *
   * Requirement 5.4: Update habit workload fields, update habit.level,
   * record in level_history with reason "level_up_progression"
   *
   * @param habitId - The habit to level up
   * @param targetLevel - The new target level
   * @param workloadChanges - Proposed workload changes
   * @returns Updated habit
   */
  async applyLevelUp(
    habitId: string,
    targetLevel: number,
    workloadChanges: WorkloadChanges
  ): Promise<Habit> {
    logger.info('Applying level-up', { habitId, targetLevel });

    try {
      // 1. Get current habit
      const habit = await this.habitRepo.getById(habitId);
      if (!habit) {
        throw new Error(`Habit not found: ${habitId}`);
      }

      const oldLevel = habit.level;

      // 2. Prepare update data
      const updateData: Partial<Habit> = {
        level: targetLevel,
        level_tier: calculateLevelTier(targetLevel),
        level_last_assessed_at: new Date().toISOString(),
      };

      // Apply workload changes
      if (workloadChanges.workloadPerCount) {
        updateData.workload_per_count = workloadChanges.workloadPerCount.new;
      }
      if (workloadChanges.frequency) {
        updateData.frequency = workloadChanges.frequency.new as 'daily' | 'weekly' | 'monthly';
      }
      if (workloadChanges.duration) {
        updateData.workload_per_count = workloadChanges.duration.new;
      }
      if (workloadChanges.targetCount) {
        updateData.target_count = workloadChanges.targetCount.new;
      }

      // 3. Update habit in database
      const { data: updatedHabit, error: updateError } = await this.supabase
        .from('habits')
        .update(updateData)
        .eq('id', habitId)
        .select()
        .single();

      if (updateError || !updatedHabit) {
        throw new Error(`Failed to update habit: ${updateError?.message ?? 'Unknown error'}`);
      }

      // 4. Record in level_history
      await this.recordLevelChange(
        'habit',
        habitId,
        oldLevel,
        targetLevel,
        'level_up_progression',
        workloadChanges
      );

      logger.info('Level-up applied successfully', {
        habitId,
        oldLevel,
        newLevel: targetLevel,
      });

      return updatedHabit as Habit;
    } catch (error) {
      logger.error('Failed to apply level-up', error as Error, { habitId, targetLevel });
      throw error;
    }
  }


  // ===========================================================================
  // 8.4: applyLevelDown - レベルダウンの適用
  // ===========================================================================

  /**
   * Apply a level-down (baby step) to a habit.
   *
   * Requirement 6.6: Update habit fields based on baby step plan,
   * update habit.level, record in level_history with reason
   * "level_down_baby_step_lv50" or "level_down_baby_step_lv10"
   *
   * @param habitId - The habit to level down
   * @param babyStepPlan - The baby step plan to apply
   * @returns Updated habit
   */
  async applyLevelDown(
    habitId: string,
    babyStepPlan: BabyStepPlan
  ): Promise<Habit> {
    logger.info('Applying level-down', { habitId, targetLevel: babyStepPlan.targetLevel });

    try {
      // 1. Get current habit
      const habit = await this.habitRepo.getById(habitId);
      if (!habit) {
        throw new Error(`Habit not found: ${habitId}`);
      }

      const oldLevel = habit.level;

      // 2. Determine reason based on target level
      const reason: LevelChangeReason = babyStepPlan.targetLevel <= 10
        ? 'level_down_baby_step_lv10'
        : 'level_down_baby_step_lv50';

      // 3. Prepare update data
      const updateData: Partial<Habit> = {
        level: babyStepPlan.targetLevel,
        level_tier: calculateLevelTier(babyStepPlan.targetLevel),
        level_last_assessed_at: new Date().toISOString(),
        name: babyStepPlan.name, // Update habit name to simplified version
      };

      // Apply workload changes from baby step plan
      const workloadChanges = babyStepPlan.workloadChanges;
      if (workloadChanges.workloadPerCount) {
        updateData.workload_per_count = workloadChanges.workloadPerCount.new;
      }
      if (workloadChanges.frequency) {
        updateData.frequency = workloadChanges.frequency.new as 'daily' | 'weekly' | 'monthly';
      }
      if (workloadChanges.duration) {
        updateData.workload_per_count = workloadChanges.duration.new;
      }
      if (workloadChanges.targetCount) {
        updateData.target_count = workloadChanges.targetCount.new;
      }

      // 4. Update habit in database
      const { data: updatedHabit, error: updateError } = await this.supabase
        .from('habits')
        .update(updateData)
        .eq('id', habitId)
        .select()
        .single();

      if (updateError || !updatedHabit) {
        throw new Error(`Failed to update habit: ${updateError?.message ?? 'Unknown error'}`);
      }

      // 5. Record in level_history
      await this.recordLevelChange(
        'habit',
        habitId,
        oldLevel,
        babyStepPlan.targetLevel,
        reason,
        workloadChanges
      );

      logger.info('Level-down applied successfully', {
        habitId,
        oldLevel,
        newLevel: babyStepPlan.targetLevel,
        reason,
      });

      return updatedHabit as Habit;
    } catch (error) {
      logger.error('Failed to apply level-down', error as Error, {
        habitId,
        targetLevel: babyStepPlan.targetLevel,
      });
      throw error;
    }
  }


  // ===========================================================================
  // 8.5: getLevelHistory - レベル履歴の取得
  // ===========================================================================

  /**
   * Get level history for a habit or goal.
   *
   * Requirements: 9.1, 9.4
   * Property 25: Level History Sorting
   * Property 26: Level History Filtering
   *
   * @param entityId - The habit or goal ID
   * @param entityType - The entity type ('habit' or 'goal')
   * @param filters - Optional filters (date range, change type)
   * @returns Array of level changes sorted by assessed_at DESC
   */
  async getLevelHistory(
    entityId: string,
    entityType: 'habit' | 'goal' = 'habit',
    filters?: LevelHistoryFilters
  ): Promise<LevelChange[]> {
    logger.info('Getting level history', { entityId, entityType, filters });

    try {
      // Build query
      let query = this.supabase
        .from('level_history')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('assessed_at', { ascending: false });

      // Apply date range filter
      if (filters?.dateRange) {
        query = query
          .gte('assessed_at', filters.dateRange.start.toISOString())
          .lte('assessed_at', filters.dateRange.end.toISOString());
      }

      // Apply change type filter
      if (filters?.changeType && filters.changeType !== 'all') {
        const reasonMap: Record<string, string[]> = {
          level_up: ['level_up_progression'],
          level_down: ['level_down_baby_step_lv50', 'level_down_baby_step_lv10'],
          re_assessment: ['re_assessment', 'initial_assessment'],
        };
        const reasons = reasonMap[filters.changeType];
        if (reasons) {
          query = query.in('reason', reasons);
        }
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to get level history: ${error.message}`);
      }

      // Convert database rows to LevelChange objects
      const history: LevelChange[] = (data ?? []).map((row: LevelHistoryRow) => ({
        id: row.id,
        entityType: row.entity_type,
        entityId: row.entity_id,
        oldLevel: row.old_level,
        newLevel: row.new_level,
        reason: row.reason as LevelChangeReason,
        workloadDelta: row.workload_delta ?? {},
        assessedAt: new Date(row.assessed_at),
        createdAt: new Date(row.created_at),
      }));

      logger.info('Level history retrieved', {
        entityId,
        entityType,
        count: history.length,
      });

      return history;
    } catch (error) {
      logger.error('Failed to get level history', error as Error, { entityId, entityType });
      throw error;
    }
  }


  // ===========================================================================
  // 8.6: Level-up frequency limit check
  // ===========================================================================

  /**
   * Check if a level-up is allowed based on frequency limit.
   *
   * Requirement 5.5: Ensure no level-up within 30 days of last change
   * Property 16: Level-Up Frequency Limit
   *
   * @param habitId - The habit ID to check
   * @returns True if level-up is allowed, false otherwise
   */
  async isLevelUpAllowed(habitId: string): Promise<boolean> {
    const daysSinceLastChange = await this.getDaysSinceLastLevelChange(habitId);
    return daysSinceLastChange >= LEVEL_UP_MIN_DAYS_SINCE_CHANGE;
  }

  /**
   * Get the number of days since the last level change for a habit.
   *
   * @param habitId - The habit ID
   * @returns Number of days since last level change, or Infinity if no history
   */
  private async getDaysSinceLastLevelChange(habitId: string): Promise<number> {
    try {
      const { data, error } = await this.supabase
        .from('level_history')
        .select('assessed_at')
        .eq('entity_type', 'habit')
        .eq('entity_id', habitId)
        .order('assessed_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        // No history found, allow level change
        return Infinity;
      }

      const lastChangeDate = new Date(data.assessed_at);
      const now = new Date();
      const diffMs = now.getTime() - lastChangeDate.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      return diffDays;
    } catch {
      // Error or no data, allow level change
      return Infinity;
    }
  }


  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  /**
   * Get all active habits with level for a user.
   *
   * @param userId - The user ID
   * @returns Array of habits with level IS NOT NULL
   */
  private async getActiveHabitsWithLevel(userId: string): Promise<Habit[]> {
    const { data, error } = await this.supabase
      .from('habits')
      .select('*')
      .eq('owner_type', 'user')
      .eq('owner_id', userId)
      .eq('active', true)
      .not('level', 'is', null);

    if (error || !data) {
      return [];
    }

    return data as Habit[];
  }

  /**
   * Calculate completion rate for a habit over a date range.
   *
   * @param habit - The habit
   * @param start - Start date
   * @param end - End date
   * @returns Completion rate (0-1)
   */
  private async calculateCompletionRate(
    habit: Habit,
    start: Date,
    end: Date
  ): Promise<number> {
    // Count completed activities in the range
    const completedCount = await this.activityRepo.countActivitiesInRange(
      habit.id,
      start,
      end,
      'complete'
    );

    // Calculate expected completions based on frequency
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    let expectedCount: number;

    switch (habit.frequency) {
      case 'daily':
        expectedCount = daysDiff;
        break;
      case 'weekly':
        expectedCount = Math.floor(daysDiff / 7);
        break;
      case 'monthly':
        expectedCount = Math.floor(daysDiff / 30);
        break;
      default:
        expectedCount = daysDiff;
    }

    // Ensure at least 1 expected to avoid division by zero
    expectedCount = Math.max(1, expectedCount);

    // Calculate rate (capped at 1.0)
    return Math.min(completedCount / expectedCount, 1.0);
  }

  /**
   * Get the number of days a habit has been active.
   *
   * @param habitId - The habit ID
   * @returns Number of days since habit creation
   */
  private async getDaysActive(habitId: string): Promise<number> {
    const habit = await this.habitRepo.getById(habitId);
    if (!habit || !habit.created_at) {
      return 0;
    }

    const createdAt = new Date(habit.created_at);
    const now = new Date();
    const diffMs = now.getTime() - createdAt.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }


  /**
   * Calculate workload changes for level-up.
   *
   * @param habit - The current habit
   * @param targetLevel - The target level
   * @returns Proposed workload changes
   */
  private calculateLevelUpWorkloadChanges(
    habit: Habit,
    targetLevel: number
  ): WorkloadChanges {
    const changes: WorkloadChanges = {};
    const levelIncrease = targetLevel - (habit.level ?? 0);
    const increasePercent = Math.round((levelIncrease / (habit.level ?? 1)) * 100);

    // Increase workload_per_count by 10-20%
    if (habit.workload_per_count) {
      const newWorkload = Math.round(habit.workload_per_count * (1 + increasePercent / 100));
      changes.workloadPerCount = {
        old: habit.workload_per_count,
        new: newWorkload,
        changePercent: increasePercent,
      };
    }

    // Optionally increase frequency
    if (habit.frequency === 'weekly') {
      changes.frequency = {
        old: 'weekly',
        new: 'daily',
      };
    } else if (habit.frequency === 'monthly') {
      changes.frequency = {
        old: 'monthly',
        new: 'weekly',
      };
    }

    return changes;
  }

  /**
   * Calculate workload changes for level-down.
   *
   * @param habit - The current habit
   * @param targetLevel - The target level
   * @returns Proposed workload changes
   */
  private calculateLevelDownWorkloadChanges(
    habit: Habit,
    targetLevel: number
  ): WorkloadChanges {
    const changes: WorkloadChanges = {};
    const levelDecrease = (habit.level ?? 0) - targetLevel;
    const decreasePercent = Math.round((levelDecrease / (habit.level ?? 1)) * 100);

    // Decrease workload_per_count
    if (habit.workload_per_count) {
      const newWorkload = Math.max(1, Math.round(habit.workload_per_count * (1 - decreasePercent / 100)));
      changes.workloadPerCount = {
        old: habit.workload_per_count,
        new: newWorkload,
        changePercent: -decreasePercent,
      };
    }

    // Decrease frequency
    if (habit.frequency === 'daily') {
      changes.frequency = {
        old: 'daily',
        new: 'weekly',
      };
    } else if (habit.frequency === 'weekly') {
      changes.frequency = {
        old: 'weekly',
        new: 'monthly',
      };
    }

    return changes;
  }


  /**
   * Record a level change in the level_history table.
   *
   * Property 3: Level Change History Invariant
   *
   * @param entityType - 'habit' or 'goal'
   * @param entityId - The entity ID
   * @param oldLevel - Previous level (null for initial)
   * @param newLevel - New level
   * @param reason - Reason for change
   * @param workloadDelta - Workload changes
   */
  private async recordLevelChange(
    entityType: 'habit' | 'goal',
    entityId: string,
    oldLevel: number | null | undefined,
    newLevel: number,
    reason: LevelChangeReason,
    workloadDelta: WorkloadChanges
  ): Promise<void> {
    const { error } = await this.supabase
      .from('level_history')
      .insert({
        entity_type: entityType,
        entity_id: entityId,
        old_level: oldLevel ?? null,
        new_level: newLevel,
        reason,
        workload_delta: workloadDelta,
        assessed_at: new Date().toISOString(),
      });

    if (error) {
      logger.error('Failed to record level change', new Error(error.message), {
        entityType,
        entityId,
        oldLevel,
        newLevel,
        reason,
      });
      throw new Error(`Failed to record level change: ${error.message}`);
    }

    logger.info('Level change recorded', {
      entityType,
      entityId,
      oldLevel,
      newLevel,
      reason,
    });
  }

  /**
   * Store a level suggestion in the database.
   *
   * @param suggestion - The level suggestion to store
   * @param userId - The user ID
   * @returns The stored suggestion with ID
   */
  async storeLevelSuggestion(
    suggestion: LevelSuggestion,
    userId: string
  ): Promise<LevelSuggestion> {
    const { data, error } = await this.supabase
      .from('level_suggestions')
      .insert({
        habit_id: suggestion.habitId,
        user_id: userId,
        suggestion_type: suggestion.suggestionType,
        current_level: suggestion.currentLevel,
        target_level: suggestion.targetLevel,
        proposed_changes: suggestion.proposedChanges,
        reason: suggestion.reason,
        detected_at: suggestion.detectedAt.toISOString(),
        status: suggestion.status,
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to store level suggestion: ${error?.message ?? 'Unknown error'}`);
    }

    return {
      ...suggestion,
      id: data.id,
    };
  }


  /**
   * Get pending level suggestions for a user.
   *
   * @param userId - The user ID
   * @returns Array of pending suggestions
   */
  async getPendingSuggestions(userId: string): Promise<LevelSuggestion[]> {
    const { data, error } = await this.supabase
      .from('level_suggestions')
      .select('*, habits(name)')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('detected_at', { ascending: false });

    if (error || !data) {
      return [];
    }

    return data.map((row: LevelSuggestionRow & { habits: { name: string } }) => ({
      id: row.id,
      habitId: row.habit_id,
      habitName: row.habits?.name ?? '',
      suggestionType: row.suggestion_type,
      currentLevel: row.current_level,
      targetLevel: row.target_level,
      proposedChanges: row.proposed_changes,
      reason: row.reason,
      detectedAt: new Date(row.detected_at),
      status: row.status,
    }));
  }

  /**
   * Update the status of a level suggestion.
   *
   * @param suggestionId - The suggestion ID
   * @param status - New status ('accepted' or 'dismissed')
   */
  async updateSuggestionStatus(
    suggestionId: string,
    status: 'accepted' | 'dismissed'
  ): Promise<void> {
    const { error } = await this.supabase
      .from('level_suggestions')
      .update({
        status,
        responded_at: new Date().toISOString(),
      })
      .eq('id', suggestionId);

    if (error) {
      throw new Error(`Failed to update suggestion status: ${error.message}`);
    }

    logger.info('Suggestion status updated', { suggestionId, status });
  }

  /**
   * Get the count of pending suggestions for a user.
   *
   * @param userId - The user ID
   * @returns Count of pending suggestions
   */
  async getPendingSuggestionCount(userId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from('level_suggestions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'pending');

    if (error || count === null) {
      return 0;
    }

    return count;
  }
}


// =============================================================================
// Factory Function and Singleton
// =============================================================================

/** Singleton instance */
let _levelManagerService: LevelManagerService | null = null;

/**
 * Get or create the singleton LevelManagerService instance.
 *
 * @param supabase - Supabase client instance
 * @returns LevelManagerService instance
 */
export function getLevelManagerService(supabase: SupabaseClient): LevelManagerService {
  if (_levelManagerService === null) {
    _levelManagerService = new LevelManagerService(supabase);
  }
  return _levelManagerService;
}

/**
 * Create a new LevelManagerService instance.
 *
 * @param supabase - Supabase client instance
 * @returns New LevelManagerService instance
 */
export function createLevelManagerService(supabase: SupabaseClient): LevelManagerService {
  return new LevelManagerService(supabase);
}

/**
 * Reset the singleton instance (useful for testing).
 */
export function resetLevelManagerService(): void {
  _levelManagerService = null;
}
