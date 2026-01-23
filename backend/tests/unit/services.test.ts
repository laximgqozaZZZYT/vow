/**
 * Service Unit Tests
 *
 * Tests for TypeScript services with mocked repositories.
 *
 * **Property 9: Streak Calculation**
 * For any habit with activities, the streak should equal the count of consecutive
 * days (ending today or yesterday) with at least one completion activity.
 *
 * **Property 10: Duplicate Completion Detection**
 * For any habit that has been completed today, attempting to complete it again
 * should return already_completed=true without creating a new activity.
 *
 * **Validates: Requirements 8.2, 8.3**
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HabitCompletionReporter } from '@/services/habitCompletionReporter';
import { DailyProgressCalculator } from '@/services/dailyProgressCalculator';
import { WeeklyReportGenerator } from '@/services/weeklyReportGenerator';
import { SlackBlockBuilder } from '@/services/slackBlockBuilder';
import type { HabitRepository } from '@/repositories/habitRepository';
import type { ActivityRepository } from '@/repositories/activityRepository';
import type { GoalRepository } from '@/repositories/goalRepository';
import type { SlackRepository } from '@/repositories/slackRepository';
import type { Habit, Activity, Goal } from '@/schemas/habit';

// ============================================================================
// Mock Repository Factory
// ============================================================================

/**
 * Creates a mock HabitRepository with all methods stubbed.
 */
function createMockHabitRepository(): HabitRepository {
  return {
    getById: vi.fn(),
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    exists: vi.fn(),
    count: vi.fn(),
    getActiveDoHabits: vi.fn(),
    findByName: vi.fn(),
    searchByName: vi.fn(),
    getByOwner: vi.fn(),
    getHabitsByGoal: vi.fn(),
    getHabitsWithTriggers: vi.fn(),
  } as unknown as HabitRepository;
}


/**
 * Creates a mock ActivityRepository with all methods stubbed.
 */
function createMockActivityRepository(): ActivityRepository {
  return {
    getById: vi.fn(),
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    exists: vi.fn(),
    count: vi.fn(),
    getActivitiesInRange: vi.fn(),
    getHabitActivities: vi.fn(),
    hasCompletionToday: vi.fn(),
    hasCompletionOnDate: vi.fn(),
    getActivitiesByOwnerInRange: vi.fn(),
    getLatestActivity: vi.fn(),
    countActivitiesInRange: vi.fn(),
    sumAmountInRange: vi.fn(),
  } as unknown as ActivityRepository;
}

/**
 * Creates a mock GoalRepository with all methods stubbed.
 */
function createMockGoalRepository(): GoalRepository {
  return {
    getById: vi.fn(),
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    exists: vi.fn(),
    count: vi.fn(),
    getByOwner: vi.fn(),
    getActiveGoals: vi.fn(),
    findByName: vi.fn(),
  } as unknown as GoalRepository;
}

/**
 * Creates a mock SlackRepository with all methods stubbed.
 */
function createMockSlackRepository(): SlackRepository {
  return {
    getById: vi.fn(),
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    exists: vi.fn(),
    count: vi.fn(),
    getConnectionBySlackUser: vi.fn(),
    getConnectionWithTokens: vi.fn(),
    getPreferences: vi.fn(),
    getValidConnectionsForReports: vi.fn(),
    upsertConnection: vi.fn(),
    upsertPreferences: vi.fn(),
    getFollowUpStatus: vi.fn(),
    upsertFollowUpStatus: vi.fn(),
  } as unknown as SlackRepository;
}


// ============================================================================
// Test Fixtures
// ============================================================================

const testHabit: Habit = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  owner_type: 'user',
  owner_id: '123e4567-e89b-12d3-a456-426614174001',
  name: 'Exercise',
  description: 'Daily exercise routine',
  goal_id: '123e4567-e89b-12d3-a456-426614174002',
  active: true,
  frequency: 'daily',
  target_count: 1,
  workload_unit: 'minutes',
  workload_per_count: 30,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-15T12:00:00Z',
};

const testGoal: Goal = {
  id: '123e4567-e89b-12d3-a456-426614174002',
  owner_type: 'user',
  owner_id: '123e4567-e89b-12d3-a456-426614174001',
  name: 'Health',
  description: 'Improve overall health',
  parent_id: null,
  status: 'active',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: null,
};

/**
 * Helper to create activity fixtures with specific dates.
 */
function createActivity(
  habitId: string,
  timestamp: string,
  amount = 1
): Activity {
  return {
    id: `activity-${Date.now()}-${Math.random()}`,
    owner_type: 'user',
    owner_id: '123e4567-e89b-12d3-a456-426614174001',
    habit_id: habitId,
    habit_name: 'Exercise',
    kind: 'complete',
    timestamp,
    amount,
    memo: null,
    created_at: timestamp,
  };
}

/**
 * Helper to get date string for N days ago.
 * Creates a timestamp at noon to avoid timezone edge cases.
 */
function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(12, 0, 0, 0); // Set to noon to avoid timezone issues
  return date.toISOString();
}

/**
 * Helper to get date string for today.
 * Creates a timestamp at noon to avoid timezone edge cases.
 */
function today(): string {
  const date = new Date();
  date.setHours(12, 0, 0, 0); // Set to noon to avoid timezone issues
  return date.toISOString();
}


// ============================================================================
// HabitCompletionReporter Tests
// ============================================================================

describe('HabitCompletionReporter', () => {
  let habitRepo: HabitRepository;
  let activityRepo: ActivityRepository;
  let goalRepo: GoalRepository;
  let reporter: HabitCompletionReporter;

  beforeEach(() => {
    habitRepo = createMockHabitRepository();
    activityRepo = createMockActivityRepository();
    goalRepo = createMockGoalRepository();
    reporter = new HabitCompletionReporter(habitRepo, activityRepo, goalRepo);
  });

  // ==========================================================================
  // Property 9: Streak Calculation
  // For any habit with activities, the streak should equal the count of
  // consecutive days (ending today or yesterday) with at least one completion.
  // ==========================================================================

  describe('Property 9: Streak Calculation', () => {
    /**
     * **Validates: Requirements 8.2**
     */
    it('should return 0 when no activities exist', async () => {
      vi.mocked(activityRepo.getHabitActivities).mockResolvedValue([]);

      const streak = await reporter.getHabitStreak('habit-123', 'user', 'owner-123');

      expect(streak).toBe(0);
    });

    it('should return 1 for activity completed today', async () => {
      const activities = [createActivity('habit-123', today())];
      vi.mocked(activityRepo.getHabitActivities).mockResolvedValue(activities);

      const streak = await reporter.getHabitStreak('habit-123', 'user', 'owner-123');

      expect(streak).toBe(1);
    });

    it('should return 1 for activity completed yesterday only', async () => {
      const activities = [createActivity('habit-123', daysAgo(1))];
      vi.mocked(activityRepo.getHabitActivities).mockResolvedValue(activities);

      const streak = await reporter.getHabitStreak('habit-123', 'user', 'owner-123');

      expect(streak).toBe(1);
    });


    it('should count consecutive days correctly', async () => {
      // Activities for today, yesterday, and 2 days ago
      const activities = [
        createActivity('habit-123', today()),
        createActivity('habit-123', daysAgo(1)),
        createActivity('habit-123', daysAgo(2)),
      ];
      vi.mocked(activityRepo.getHabitActivities).mockResolvedValue(activities);

      const streak = await reporter.getHabitStreak('habit-123', 'user', 'owner-123');

      expect(streak).toBe(3);
    });

    it('should break streak on gap day', async () => {
      // Activities for today and 2 days ago (gap on yesterday)
      const activities = [
        createActivity('habit-123', today()),
        createActivity('habit-123', daysAgo(2)),
      ];
      vi.mocked(activityRepo.getHabitActivities).mockResolvedValue(activities);

      const streak = await reporter.getHabitStreak('habit-123', 'user', 'owner-123');

      expect(streak).toBe(1);
    });

    it('should count multiple activities on same day as one', async () => {
      // Multiple activities on same day should count as 1
      const todayStr = today();
      const activities = [
        createActivity('habit-123', todayStr),
        createActivity('habit-123', todayStr),
        createActivity('habit-123', daysAgo(1)),
      ];
      vi.mocked(activityRepo.getHabitActivities).mockResolvedValue(activities);

      const streak = await reporter.getHabitStreak('habit-123', 'user', 'owner-123');

      expect(streak).toBe(2);
    });

    it('should return 0 when oldest activity is more than 1 day ago', async () => {
      // Activity only from 3 days ago (no recent activity)
      const activities = [createActivity('habit-123', daysAgo(3))];
      vi.mocked(activityRepo.getHabitActivities).mockResolvedValue(activities);

      const streak = await reporter.getHabitStreak('habit-123', 'user', 'owner-123');

      expect(streak).toBe(0);
    });
  });


  // ==========================================================================
  // Property 10: Duplicate Completion Detection
  // For any habit that has been completed today, attempting to complete it
  // again should return already_completed=true without creating a new activity.
  // ==========================================================================

  describe('Property 10: Duplicate Completion Detection', () => {
    /**
     * **Validates: Requirements 8.3**
     */
    it('should detect already completed habit and not create new activity', async () => {
      vi.mocked(habitRepo.getById).mockResolvedValue(testHabit);
      vi.mocked(activityRepo.hasCompletionToday).mockResolvedValue(true);
      vi.mocked(activityRepo.getHabitActivities).mockResolvedValue([
        createActivity(testHabit.id, today()),
      ]);

      const [success, message, result] = await reporter.completeHabitById(
        'owner-123',
        testHabit.id,
        'slack',
        'user'
      );

      expect(success).toBe(false);
      expect(message).toBe('Already completed today');
      expect(result?.already_completed).toBe(true);
      expect(activityRepo.create).not.toHaveBeenCalled();
    });

    it('should allow completion when not completed today', async () => {
      const newActivity = createActivity(testHabit.id, today());
      vi.mocked(habitRepo.getById).mockResolvedValue(testHabit);
      vi.mocked(activityRepo.hasCompletionToday).mockResolvedValue(false);
      vi.mocked(activityRepo.create).mockResolvedValue(newActivity);
      vi.mocked(activityRepo.getHabitActivities).mockResolvedValue([newActivity]);

      const [success, message, result] = await reporter.completeHabitById(
        'owner-123',
        testHabit.id,
        'slack',
        'user'
      );

      expect(success).toBe(true);
      expect(message).toBe('Habit completed');
      expect(result?.already_completed).toBeUndefined();
      expect(activityRepo.create).toHaveBeenCalled();
    });

    it('should return habit not found when habit does not exist', async () => {
      vi.mocked(habitRepo.getById).mockResolvedValue(null);

      const [success, message, result] = await reporter.completeHabitById(
        'owner-123',
        'non-existent-id',
        'slack',
        'user'
      );

      expect(success).toBe(false);
      expect(message).toBe('Habit not found');
      expect(result).toBeNull();
    });
  });


  // ==========================================================================
  // completeHabitByName Tests
  // ==========================================================================

  describe('completeHabitByName', () => {
    it('should find and complete habit by exact name match', async () => {
      const newActivity = createActivity(testHabit.id, today());
      vi.mocked(habitRepo.getByOwner).mockResolvedValue([testHabit]);
      vi.mocked(habitRepo.getById).mockResolvedValue(testHabit);
      vi.mocked(activityRepo.hasCompletionToday).mockResolvedValue(false);
      vi.mocked(activityRepo.create).mockResolvedValue(newActivity);
      vi.mocked(activityRepo.getHabitActivities).mockResolvedValue([newActivity]);

      const [success, message] = await reporter.completeHabitByName(
        'owner-123',
        'Exercise',
        'slack',
        'user'
      );

      expect(success).toBe(true);
      expect(message).toBe('Habit completed');
    });

    it('should find habit by partial name match', async () => {
      const newActivity = createActivity(testHabit.id, today());
      vi.mocked(habitRepo.getByOwner).mockResolvedValue([testHabit]);
      vi.mocked(habitRepo.getById).mockResolvedValue(testHabit);
      vi.mocked(activityRepo.hasCompletionToday).mockResolvedValue(false);
      vi.mocked(activityRepo.create).mockResolvedValue(newActivity);
      vi.mocked(activityRepo.getHabitActivities).mockResolvedValue([newActivity]);

      const [success, message] = await reporter.completeHabitByName(
        'owner-123',
        'Exer',
        'slack',
        'user'
      );

      expect(success).toBe(true);
      expect(message).toBe('Habit completed');
    });

    it('should return suggestions when habit not found', async () => {
      const similarHabit = { ...testHabit, name: 'Exercising' };
      vi.mocked(habitRepo.getByOwner).mockResolvedValue([similarHabit]);

      const [success, message, result] = await reporter.completeHabitByName(
        'owner-123',
        'Exercise',
        'slack',
        'user'
      );

      expect(success).toBe(false);
      expect(message).toContain('not found');
      expect(result).toHaveProperty('suggestions');
    });
  });


  // ==========================================================================
  // getIncompleteHabitsToday Tests
  // ==========================================================================

  describe('getIncompleteHabitsToday', () => {
    it('should return only incomplete habits', async () => {
      const habit1 = { ...testHabit, id: 'habit-1', name: 'Habit 1' };
      const habit2 = { ...testHabit, id: 'habit-2', name: 'Habit 2' };
      vi.mocked(habitRepo.getByOwner).mockResolvedValue([habit1, habit2]);
      vi.mocked(activityRepo.hasCompletionToday)
        .mockResolvedValueOnce(true)  // habit-1 completed
        .mockResolvedValueOnce(false); // habit-2 not completed
      vi.mocked(activityRepo.getHabitActivities).mockResolvedValue([]);

      const incomplete = await reporter.getIncompleteHabitsToday('owner-123', 'user');

      expect(incomplete).toHaveLength(1);
      expect(incomplete[0]?.name).toBe('Habit 2');
      expect(incomplete[0]?.completed).toBe(false);
    });

    it('should exclude inactive habits', async () => {
      const inactiveHabit = { ...testHabit, active: false };
      vi.mocked(habitRepo.getByOwner).mockResolvedValue([inactiveHabit]);

      const incomplete = await reporter.getIncompleteHabitsToday('owner-123', 'user');

      expect(incomplete).toHaveLength(0);
    });
  });

  // ==========================================================================
  // getAllHabitsWithStatus Tests
  // ==========================================================================

  describe('getAllHabitsWithStatus', () => {
    it('should return all habits with completion status and streak', async () => {
      vi.mocked(habitRepo.getByOwner).mockResolvedValue([testHabit]);
      vi.mocked(activityRepo.hasCompletionToday).mockResolvedValue(true);
      vi.mocked(activityRepo.getHabitActivities).mockResolvedValue([
        createActivity(testHabit.id, today()),
        createActivity(testHabit.id, daysAgo(1)),
      ]);
      vi.mocked(goalRepo.getById).mockResolvedValue(testGoal);

      const habits = await reporter.getAllHabitsWithStatus('owner-123', 'user');

      expect(habits).toHaveLength(1);
      expect(habits[0]?.completed).toBe(true);
      expect(habits[0]?.streak).toBe(2);
      expect(habits[0]?.goal_name).toBe('Health');
    });

    it('should use "No Goal" when goal not found', async () => {
      vi.mocked(habitRepo.getByOwner).mockResolvedValue([testHabit]);
      vi.mocked(activityRepo.hasCompletionToday).mockResolvedValue(false);
      vi.mocked(activityRepo.getHabitActivities).mockResolvedValue([]);
      vi.mocked(goalRepo.getById).mockResolvedValue(null);

      const habits = await reporter.getAllHabitsWithStatus('owner-123', 'user');

      expect(habits[0]?.goal_name).toBe('No Goal');
    });
  });


  // ==========================================================================
  // getTodaySummary Tests
  // ==========================================================================

  describe('getTodaySummary', () => {
    it('should return correct summary statistics', async () => {
      const habit1 = { ...testHabit, id: 'habit-1', name: 'Habit 1' };
      const habit2 = { ...testHabit, id: 'habit-2', name: 'Habit 2' };
      vi.mocked(habitRepo.getByOwner).mockResolvedValue([habit1, habit2]);
      vi.mocked(activityRepo.hasCompletionToday)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      vi.mocked(activityRepo.getHabitActivities).mockResolvedValue([]);
      vi.mocked(goalRepo.getById).mockResolvedValue(testGoal);

      const summary = await reporter.getTodaySummary('owner-123', 'user');

      expect(summary.completed).toBe(1);
      expect(summary.total).toBe(2);
      expect(summary.completion_rate).toBe(50);
      expect(summary.habits).toHaveLength(2);
    });

    it('should return 0% completion rate when no habits', async () => {
      vi.mocked(habitRepo.getByOwner).mockResolvedValue([]);

      const summary = await reporter.getTodaySummary('owner-123', 'user');

      expect(summary.completed).toBe(0);
      expect(summary.total).toBe(0);
      expect(summary.completion_rate).toBe(0);
    });
  });

  // ==========================================================================
  // incrementHabitProgress Tests
  // ==========================================================================

  describe('incrementHabitProgress', () => {
    it('should increment progress with specified amount', async () => {
      const newActivity = createActivity(testHabit.id, today(), 5);
      vi.mocked(habitRepo.getById).mockResolvedValue(testHabit);
      vi.mocked(activityRepo.create).mockResolvedValue(newActivity);
      vi.mocked(activityRepo.getHabitActivities).mockResolvedValue([newActivity]);

      const [success, message, result] = await reporter.incrementHabitProgress(
        'owner-123',
        testHabit.id,
        5,
        'slack',
        'user'
      );

      expect(success).toBe(true);
      expect(message).toBe('Progress updated');
      expect(result?.amount).toBe(5);
    });

    it('should use workload_per_count when amount not specified', async () => {
      const newActivity = createActivity(testHabit.id, today(), 30);
      vi.mocked(habitRepo.getById).mockResolvedValue(testHabit);
      vi.mocked(activityRepo.create).mockResolvedValue(newActivity);
      vi.mocked(activityRepo.getHabitActivities).mockResolvedValue([newActivity]);

      const [success, , result] = await reporter.incrementHabitProgress(
        'owner-123',
        testHabit.id,
        undefined,
        'slack',
        'user'
      );

      expect(success).toBe(true);
      expect(result?.amount).toBe(30); // workload_per_count from testHabit
    });
  });

  // ==========================================================================
  // getJstDayBoundaries Tests
  // ==========================================================================

  describe('getJstDayBoundaries', () => {
    it('should return start and end of JST day', () => {
      const [start, end] = reporter.getJstDayBoundaries();

      expect(start).toBeInstanceOf(Date);
      expect(end).toBeInstanceOf(Date);
      expect(end.getTime()).toBeGreaterThan(start.getTime());
    });
  });
});


// ============================================================================
// DailyProgressCalculator Tests
// ============================================================================

describe('DailyProgressCalculator', () => {
  let habitRepo: HabitRepository;
  let activityRepo: ActivityRepository;
  let goalRepo: GoalRepository;
  let calculator: DailyProgressCalculator;

  beforeEach(() => {
    habitRepo = createMockHabitRepository();
    activityRepo = createMockActivityRepository();
    goalRepo = createMockGoalRepository();
    calculator = new DailyProgressCalculator(habitRepo, activityRepo, goalRepo);
  });

  // ==========================================================================
  // getJstDayBoundaries Tests
  // ==========================================================================

  describe('getJstDayBoundaries', () => {
    it('should return valid date boundaries', () => {
      const [start, end] = calculator.getJstDayBoundaries();

      expect(start).toBeInstanceOf(Date);
      expect(end).toBeInstanceOf(Date);
      expect(end.getTime()).toBeGreaterThan(start.getTime());
    });

    it('should have end time after start time by approximately 24 hours', () => {
      const [start, end] = calculator.getJstDayBoundaries();
      const diffMs = end.getTime() - start.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      // Should be close to 24 hours (23:59:59.999 - 00:00:00.000)
      expect(diffHours).toBeGreaterThan(23);
      expect(diffHours).toBeLessThan(25);
    });
  });


  // ==========================================================================
  // getDailyProgress Tests
  // ==========================================================================

  describe('getDailyProgress', () => {
    it('should calculate progress for active do habits', async () => {
      const habitWithTarget = { ...testHabit, target_count: 3 };
      vi.mocked(habitRepo.getActiveDoHabits).mockResolvedValue([habitWithTarget]);
      vi.mocked(activityRepo.getActivitiesInRange).mockResolvedValue([
        createActivity(testHabit.id, today(), 1),
        createActivity(testHabit.id, today(), 1),
      ]);
      vi.mocked(goalRepo.getById).mockResolvedValue(testGoal);
      vi.mocked(activityRepo.getHabitActivities).mockResolvedValue([]);

      const progress = await calculator.getDailyProgress('owner-123', 'user');

      expect(progress).toHaveLength(1);
      expect(progress[0]?.habitName).toBe('Exercise');
      expect(progress[0]?.currentCount).toBe(2);
      expect(progress[0]?.totalCount).toBe(3);
      expect(progress[0]?.progressRate).toBeCloseTo(66.67, 1);
      expect(progress[0]?.completed).toBe(false);
    });

    it('should mark habit as completed when progress >= 100%', async () => {
      const habitWithTarget = { ...testHabit, target_count: 2 };
      vi.mocked(habitRepo.getActiveDoHabits).mockResolvedValue([habitWithTarget]);
      vi.mocked(activityRepo.getActivitiesInRange).mockResolvedValue([
        createActivity(testHabit.id, today(), 1),
        createActivity(testHabit.id, today(), 1),
      ]);
      vi.mocked(goalRepo.getById).mockResolvedValue(testGoal);
      vi.mocked(activityRepo.getHabitActivities).mockResolvedValue([]);

      const progress = await calculator.getDailyProgress('owner-123', 'user');

      expect(progress[0]?.progressRate).toBe(100);
      expect(progress[0]?.completed).toBe(true);
    });

    it('should return empty array when no active habits', async () => {
      vi.mocked(habitRepo.getActiveDoHabits).mockResolvedValue([]);
      vi.mocked(activityRepo.getActivitiesInRange).mockResolvedValue([]);

      const progress = await calculator.getDailyProgress('owner-123', 'user');

      expect(progress).toHaveLength(0);
    });

    it('should sort results by goal name', async () => {
      const habit1 = { ...testHabit, id: 'habit-1', name: 'Habit A', goal_id: 'goal-z' };
      const habit2 = { ...testHabit, id: 'habit-2', name: 'Habit B', goal_id: 'goal-a' };
      vi.mocked(habitRepo.getActiveDoHabits).mockResolvedValue([habit1, habit2]);
      vi.mocked(activityRepo.getActivitiesInRange).mockResolvedValue([]);
      vi.mocked(goalRepo.getById)
        .mockResolvedValueOnce({ ...testGoal, name: 'Zebra Goal' })
        .mockResolvedValueOnce({ ...testGoal, name: 'Alpha Goal' });
      vi.mocked(activityRepo.getHabitActivities).mockResolvedValue([]);

      const progress = await calculator.getDailyProgress('owner-123', 'user');

      expect(progress[0]?.goalName).toBe('Alpha Goal');
      expect(progress[1]?.goalName).toBe('Zebra Goal');
    });
  });


  // ==========================================================================
  // getHabitProgress Tests
  // ==========================================================================

  describe('getHabitProgress', () => {
    it('should return progress for specific habit', async () => {
      vi.mocked(habitRepo.getById).mockResolvedValue(testHabit);
      vi.mocked(activityRepo.getActivitiesInRange).mockResolvedValue([
        createActivity(testHabit.id, today(), 15),
      ]);
      vi.mocked(goalRepo.getById).mockResolvedValue(testGoal);
      vi.mocked(activityRepo.getHabitActivities).mockResolvedValue([]);

      const progress = await calculator.getHabitProgress('owner-123', testHabit.id, 'user');

      expect(progress).not.toBeNull();
      expect(progress?.habitId).toBe(testHabit.id);
      expect(progress?.currentCount).toBe(15);
    });

    it('should return null when habit not found', async () => {
      vi.mocked(habitRepo.getById).mockResolvedValue(null);

      const progress = await calculator.getHabitProgress('owner-123', 'non-existent', 'user');

      expect(progress).toBeNull();
    });
  });

  // ==========================================================================
  // getDashboardSummary Tests
  // ==========================================================================

  describe('getDashboardSummary', () => {
    it('should return dashboard summary with completion stats', async () => {
      const habit1 = { ...testHabit, id: 'habit-1', target_count: 1 };
      const habit2 = { ...testHabit, id: 'habit-2', target_count: 1 };
      vi.mocked(habitRepo.getActiveDoHabits).mockResolvedValue([habit1, habit2]);
      vi.mocked(activityRepo.getActivitiesInRange).mockResolvedValue([
        createActivity('habit-1', today(), 1),
      ]);
      vi.mocked(goalRepo.getById).mockResolvedValue(testGoal);
      vi.mocked(activityRepo.getHabitActivities).mockResolvedValue([]);

      const summary = await calculator.getDashboardSummary('owner-123', 'user');

      expect(summary.totalHabits).toBe(2);
      expect(summary.completedHabits).toBe(1);
      expect(summary.completionRate).toBe(50);
      expect(summary.dateDisplay).toMatch(/\d{4}年\d{1,2}月\d{1,2}日/);
    });

    it('should return 0% completion when no habits', async () => {
      vi.mocked(habitRepo.getActiveDoHabits).mockResolvedValue([]);
      vi.mocked(activityRepo.getActivitiesInRange).mockResolvedValue([]);

      const summary = await calculator.getDashboardSummary('owner-123', 'user');

      expect(summary.totalHabits).toBe(0);
      expect(summary.completedHabits).toBe(0);
      expect(summary.completionRate).toBe(0);
    });
  });
});


// ============================================================================
// WeeklyReportGenerator Tests
// ============================================================================

describe('WeeklyReportGenerator', () => {
  let slackRepo: SlackRepository;
  let habitRepo: HabitRepository;
  let activityRepo: ActivityRepository;
  let generator: WeeklyReportGenerator;

  beforeEach(() => {
    slackRepo = createMockSlackRepository();
    habitRepo = createMockHabitRepository();
    activityRepo = createMockActivityRepository();
    generator = new WeeklyReportGenerator(
      slackRepo,
      habitRepo,
      activityRepo,
      undefined, // Use default slack service
      'https://test.app'
    );
  });

  // ==========================================================================
  // generateReport Tests
  // ==========================================================================

  describe('generateReport', () => {
    it('should generate report with correct statistics', async () => {
      const habits = [
        { ...testHabit, id: 'habit-1', name: 'Habit 1' },
        { ...testHabit, id: 'habit-2', name: 'Habit 2' },
      ];
      vi.mocked(habitRepo.getByOwner).mockResolvedValue(habits);
      vi.mocked(activityRepo.getActivitiesInRange).mockResolvedValue([
        createActivity('habit-1', daysAgo(1)),
        createActivity('habit-1', daysAgo(2)),
        createActivity('habit-2', daysAgo(1)),
      ]);
      vi.mocked(activityRepo.getHabitActivities).mockResolvedValue([]);

      const report = await generator.generateReport('owner-123', 'user');

      expect(report.totalHabits).toBe(14); // 2 habits * 7 days
      expect(report.completedHabits).toBe(3);
      expect(report.completionRate).toBeCloseTo(21.43, 1);
    });

    it('should return empty report when no habits', async () => {
      vi.mocked(habitRepo.getByOwner).mockResolvedValue([]);

      const report = await generator.generateReport('owner-123', 'user');

      expect(report.totalHabits).toBe(0);
      expect(report.completedHabits).toBe(0);
      expect(report.completionRate).toBe(0);
      expect(report.bestStreak).toBe(0);
      expect(report.habitsNeedingAttention).toHaveLength(0);
    });


    it('should identify habits needing attention', async () => {
      const habits = [
        { ...testHabit, id: 'habit-1', name: 'Good Habit' },
        { ...testHabit, id: 'habit-2', name: 'Needs Attention' },
      ];
      vi.mocked(habitRepo.getByOwner).mockResolvedValue(habits);
      // Good habit has 5 completions, needs attention has 2
      vi.mocked(activityRepo.getActivitiesInRange).mockResolvedValue([
        createActivity('habit-1', daysAgo(0)),
        createActivity('habit-1', daysAgo(1)),
        createActivity('habit-1', daysAgo(2)),
        createActivity('habit-1', daysAgo(3)),
        createActivity('habit-1', daysAgo(4)),
        createActivity('habit-2', daysAgo(0)),
        createActivity('habit-2', daysAgo(1)),
      ]);
      vi.mocked(activityRepo.getHabitActivities).mockResolvedValue([]);

      const report = await generator.generateReport('owner-123', 'user');

      expect(report.habitsNeedingAttention).toContain('Needs Attention');
      expect(report.habitsNeedingAttention).not.toContain('Good Habit');
    });

    it('should find best streak habit', async () => {
      const habits = [
        { ...testHabit, id: 'habit-1', name: 'Low Streak' },
        { ...testHabit, id: 'habit-2', name: 'High Streak' },
      ];
      vi.mocked(habitRepo.getByOwner).mockResolvedValue(habits);
      vi.mocked(activityRepo.getActivitiesInRange).mockResolvedValue([]);
      // Mock different streaks for each habit
      vi.mocked(activityRepo.getHabitActivities)
        .mockResolvedValueOnce([createActivity('habit-1', today())])
        .mockResolvedValueOnce([
          createActivity('habit-2', today()),
          createActivity('habit-2', daysAgo(1)),
          createActivity('habit-2', daysAgo(2)),
        ]);

      const report = await generator.generateReport('owner-123', 'user');

      expect(report.bestStreak).toBe(3);
      expect(report.bestStreakHabit).toBe('High Streak');
    });
  });
});


// ============================================================================
// SlackBlockBuilder Tests
// ============================================================================

describe('SlackBlockBuilder', () => {
  // ==========================================================================
  // progressBar Tests
  // ==========================================================================

  describe('progressBar', () => {
    it('should return all empty for 0%', () => {
      const bar = SlackBlockBuilder.progressBar(0);
      expect(bar).toBe('⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜');
    });

    it('should return red blocks for < 50%', () => {
      const bar = SlackBlockBuilder.progressBar(30);
      expect(bar).toBe('🟥🟥🟥⬜⬜⬜⬜⬜⬜⬜');
    });

    it('should return yellow blocks for 50-74%', () => {
      const bar = SlackBlockBuilder.progressBar(60);
      expect(bar).toBe('🟨🟨🟨🟨🟨🟨⬜⬜⬜⬜');
    });

    it('should return blue blocks for 75-99%', () => {
      const bar = SlackBlockBuilder.progressBar(80);
      expect(bar).toBe('🟦🟦🟦🟦🟦🟦🟦🟦⬜⬜');
    });

    it('should return green blocks for >= 100%', () => {
      const bar = SlackBlockBuilder.progressBar(100);
      expect(bar).toBe('🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩');
    });

    it('should handle over 100%', () => {
      const bar = SlackBlockBuilder.progressBar(150);
      expect(bar).toBe('🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩');
    });
  });

  // ==========================================================================
  // streakDisplay Tests
  // ==========================================================================

  describe('streakDisplay', () => {
    it('should return empty string for 0 streak', () => {
      expect(SlackBlockBuilder.streakDisplay(0)).toBe('');
    });

    it('should return plain number for 1-2 days', () => {
      expect(SlackBlockBuilder.streakDisplay(1)).toBe('1日');
      expect(SlackBlockBuilder.streakDisplay(2)).toBe('2日');
    });

    it('should return sparkle emoji for 3-6 days', () => {
      expect(SlackBlockBuilder.streakDisplay(3)).toBe('✨3日');
      expect(SlackBlockBuilder.streakDisplay(6)).toBe('✨6日');
    });

    it('should return fire emoji for 7+ days', () => {
      expect(SlackBlockBuilder.streakDisplay(7)).toBe('🔥7日');
      expect(SlackBlockBuilder.streakDisplay(30)).toBe('🔥30日');
    });
  });


  // ==========================================================================
  // Block Builder Methods Tests
  // ==========================================================================

  describe('block builders', () => {
    it('should create section block', () => {
      const block = SlackBlockBuilder.section('Test text');
      expect(block.type).toBe('section');
      expect(block.text).toEqual({ type: 'mrkdwn', text: 'Test text' });
    });

    it('should create divider block', () => {
      const block = SlackBlockBuilder.divider();
      expect(block.type).toBe('divider');
    });

    it('should create header block', () => {
      const block = SlackBlockBuilder.header('Test Header');
      expect(block.type).toBe('header');
      expect(block.text).toEqual({ type: 'plain_text', text: 'Test Header', emoji: true });
    });

    it('should create button element', () => {
      const button = SlackBlockBuilder.button('Click Me', 'action_id', 'value', 'primary');
      expect(button.type).toBe('button');
      expect(button.action_id).toBe('action_id');
      expect(button.value).toBe('value');
      expect(button.style).toBe('primary');
    });

    it('should create context block', () => {
      const block = SlackBlockBuilder.context(['Text 1', 'Text 2']);
      expect(block.type).toBe('context');
      expect(block.elements).toHaveLength(2);
    });
  });

  // ==========================================================================
  // Message Builder Tests
  // ==========================================================================

  describe('message builders', () => {
    it('should build habit completion confirmation', () => {
      const blocks = SlackBlockBuilder.habitCompletionConfirm('Exercise', 5);
      expect(blocks).toHaveLength(1);
      expect(blocks[0]?.type).toBe('section');
    });

    it('should build already completed message', () => {
      const blocks = SlackBlockBuilder.habitAlreadyCompleted('Exercise');
      expect(blocks).toHaveLength(1);
    });

    it('should build habit not found with suggestions', () => {
      const blocks = SlackBlockBuilder.habitNotFound('Exrcise', ['Exercise', 'Exercising']);
      expect(blocks.length).toBeGreaterThan(0);
    });

    it('should build not connected message', () => {
      const blocks = SlackBlockBuilder.notConnected();
      expect(blocks).toHaveLength(1);
    });

    it('should build available commands', () => {
      const blocks = SlackBlockBuilder.availableCommands();
      expect(blocks.length).toBeGreaterThan(0);
    });

    it('should build empty dashboard', () => {
      const blocks = SlackBlockBuilder.dashboardEmpty();
      expect(blocks.length).toBeGreaterThan(0);
    });
  });


  // ==========================================================================
  // Weekly Report Message Tests
  // ==========================================================================

  describe('weeklyReport', () => {
    it('should build weekly report with high completion rate', () => {
      const report = {
        totalHabits: 14,
        completedHabits: 12,
        completionRate: 85.7,
        bestStreak: 7,
        bestStreakHabit: 'Exercise',
        habitsNeedingAttention: [],
        weekStart: new Date('2024-01-15'),
        weekEnd: new Date('2024-01-21'),
      };

      const blocks = SlackBlockBuilder.weeklyReport(report, 'https://app.test/report');

      expect(blocks.length).toBeGreaterThan(0);
      expect(blocks[0]?.type).toBe('header');
    });

    it('should include habits needing attention when present', () => {
      const report = {
        totalHabits: 14,
        completedHabits: 5,
        completionRate: 35.7,
        bestStreak: 2,
        bestStreakHabit: 'Reading',
        habitsNeedingAttention: ['Exercise', 'Meditation'],
        weekStart: new Date('2024-01-15'),
        weekEnd: new Date('2024-01-21'),
      };

      const blocks = SlackBlockBuilder.weeklyReport(report, 'https://app.test/report');

      // Should have attention section
      const hasAttentionSection = blocks.some(
        (b) => b.type === 'section' && JSON.stringify(b).includes('注意が必要')
      );
      expect(hasAttentionSection).toBe(true);
    });

    it('should build no activity report', () => {
      const blocks = SlackBlockBuilder.weeklyReportNoActivity('https://app.test');

      expect(blocks.length).toBeGreaterThan(0);
      expect(blocks[0]?.type).toBe('header');
    });
  });

  // ==========================================================================
  // Habit List Tests
  // ==========================================================================

  describe('habitList', () => {
    it('should build habit list with buttons', () => {
      const habits = [
        { id: 'habit-1', name: 'Exercise', streak: 5, completed: false, goal_name: 'Health' },
        { id: 'habit-2', name: 'Reading', streak: 3, completed: true, goal_name: 'Learning' },
      ];

      const blocks = SlackBlockBuilder.habitList(habits, true);

      expect(blocks.length).toBeGreaterThan(0);
      expect(blocks[0]?.type).toBe('header');
    });

    it('should build empty habit list message', () => {
      const blocks = SlackBlockBuilder.habitList([]);

      expect(blocks).toHaveLength(1);
    });

    it('should build habit list without buttons', () => {
      const habits = [
        { id: 'habit-1', name: 'Exercise', completed: true },
      ];

      const blocks = SlackBlockBuilder.habitList(habits, false);

      expect(blocks.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Habit Status Tests
  // ==========================================================================

  describe('habitStatus', () => {
    it('should build status with progress bar', () => {
      const habits = [
        { id: 'habit-1', name: 'Exercise', completed: true },
        { id: 'habit-2', name: 'Reading', completed: false },
      ];

      const blocks = SlackBlockBuilder.habitStatus(1, 2, habits);

      expect(blocks.length).toBeGreaterThan(0);
      expect(blocks[0]?.type).toBe('header');
    });
  });
});
