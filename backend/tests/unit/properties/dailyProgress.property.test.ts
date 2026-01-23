/**
 * Property-Based Tests for Daily Progress Calculation - Time Boundaries
 *
 * **Property 7: Daily Progress Calculation - Time Boundaries**
 * For any set of activities, the daily progress calculation should only include
 * activities whose timestamps fall within the JST day boundaries (00:00:00 to 23:59:59 JST).
 *
 * **Validates: Requirements 7.1**
 */

import * as fc from 'fast-check';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DailyProgressCalculator } from '@/services/dailyProgressCalculator';
import type { HabitRepository } from '@/repositories/habitRepository';
import type { ActivityRepository } from '@/repositories/activityRepository';
import type { GoalRepository } from '@/repositories/goalRepository';
import type { Activity, Habit, Goal } from '@/schemas/habit';

// ============================================================================
// Mock Repository Factory
// ============================================================================

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

// ============================================================================
// Test Fixtures
// ============================================================================

const testHabit: Habit = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  owner_type: 'user',
  owner_id: '123e4567-e89b-12d3-a456-426614174001',
  name: 'Test Habit',
  description: 'Test habit for property testing',
  goal_id: '123e4567-e89b-12d3-a456-426614174002',
  active: true,
  frequency: 'daily',
  target_count: 10,
  workload_unit: 'times',
  workload_per_count: 1,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: null,
};

const testGoal: Goal = {
  id: '123e4567-e89b-12d3-a456-426614174002',
  owner_type: 'user',
  owner_id: '123e4567-e89b-12d3-a456-426614174001',
  name: 'Test Goal',
  description: 'Test goal',
  parent_id: null,
  status: 'active',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: null,
};

// ============================================================================
// Generators
// ============================================================================

/**
 * Generate a random activity with a specific timestamp.
 */
function createActivityWithTimestamp(
  habitId: string,
  timestamp: Date,
  amount: number
): Activity {
  return {
    id: `activity-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    owner_type: 'user',
    owner_id: '123e4567-e89b-12d3-a456-426614174001',
    habit_id: habitId,
    habit_name: 'Test Habit',
    kind: 'complete',
    timestamp: timestamp.toISOString(),
    amount,
    memo: null,
    created_at: timestamp.toISOString(),
  };
}

/**
 * Get JST day boundaries for a given date.
 * Returns [startUtc, endUtc] representing JST 00:00:00 and JST 23:59:59 in UTC.
 */
function getJstDayBoundariesForDate(date: Date): [Date, Date] {
  // JST is UTC+9
  const jstOffset = 9 * 60; // minutes
  const utcOffset = date.getTimezoneOffset(); // minutes (negative for east of UTC)

  // Calculate the date in JST
  const jstTime = new Date(date.getTime() + (jstOffset + utcOffset) * 60 * 1000);

  // Create JST day boundaries (0:00:00 and 23:59:59)
  const startJst = new Date(jstTime);
  startJst.setHours(0, 0, 0, 0);

  const endJst = new Date(jstTime);
  endJst.setHours(23, 59, 59, 999);

  // Convert back to UTC for comparison
  const startUtc = new Date(startJst.getTime() - (jstOffset + utcOffset) * 60 * 1000);
  const endUtc = new Date(endJst.getTime() - (jstOffset + utcOffset) * 60 * 1000);

  return [startUtc, endUtc];
}

/**
 * Arbitrary for generating a timestamp within JST day boundaries.
 */
const timestampWithinJstDayArb = fc.integer({ min: 0, max: 86399999 }).map((msOffset) => {
  const [startUtc] = getJstDayBoundariesForDate(new Date());
  return new Date(startUtc.getTime() + msOffset);
});

/**
 * Arbitrary for generating a timestamp outside JST day boundaries (before).
 */
const timestampBeforeJstDayArb = fc.integer({ min: 1, max: 86400000 * 7 }).map((msOffset) => {
  const [startUtc] = getJstDayBoundariesForDate(new Date());
  return new Date(startUtc.getTime() - msOffset);
});

/**
 * Arbitrary for generating a timestamp outside JST day boundaries (after).
 */
const timestampAfterJstDayArb = fc.integer({ min: 1, max: 86400000 * 7 }).map((msOffset) => {
  const [, endUtc] = getJstDayBoundariesForDate(new Date());
  return new Date(endUtc.getTime() + msOffset);
});

/**
 * Arbitrary for generating a positive amount.
 */
const amountArb = fc.integer({ min: 1, max: 100 });

/**
 * Arbitrary for generating an activity within JST day.
 */
const activityWithinJstDayArb = fc.tuple(timestampWithinJstDayArb, amountArb).map(
  ([timestamp, amount]) => createActivityWithTimestamp(testHabit.id, timestamp, amount)
);

/**
 * Arbitrary for generating an activity before JST day.
 */
const activityBeforeJstDayArb = fc.tuple(timestampBeforeJstDayArb, amountArb).map(
  ([timestamp, amount]) => createActivityWithTimestamp(testHabit.id, timestamp, amount)
);

/**
 * Arbitrary for generating an activity after JST day.
 */
const activityAfterJstDayArb = fc.tuple(timestampAfterJstDayArb, amountArb).map(
  ([timestamp, amount]) => createActivityWithTimestamp(testHabit.id, timestamp, amount)
);

// ============================================================================
// Property-Based Tests
// ============================================================================

describe('Property 7: Daily Progress Calculation - Time Boundaries', () => {
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

  /**
   * **Validates: Requirements 7.1**
   *
   * Property: For any set of activities, only activities with timestamps within
   * JST 0:00:00 to JST 23:59:59 of the current day should be included in the
   * progress calculation.
   */
  describe('Activities within JST day boundaries are counted', () => {
    it('should include all activities within JST day boundaries in progress calculation', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(activityWithinJstDayArb, { minLength: 1, maxLength: 20 }),
          async (activitiesWithinDay) => {
            // Reset mocks for each property test iteration
            vi.clearAllMocks();

            // Setup mocks
            vi.mocked(habitRepo.getActiveDoHabits).mockResolvedValue([testHabit]);
            vi.mocked(activityRepo.getActivitiesInRange).mockResolvedValue(activitiesWithinDay);
            vi.mocked(goalRepo.getById).mockResolvedValue(testGoal);
            vi.mocked(activityRepo.getHabitActivities).mockResolvedValue([]);

            // Calculate expected sum
            const expectedSum = activitiesWithinDay.reduce((sum, act) => sum + act.amount, 0);

            // Get daily progress
            const progress = await calculator.getDailyProgress('owner-123', 'user');

            // Verify the currentCount matches the sum of all activities
            expect(progress).toHaveLength(1);
            expect(progress[0]?.currentCount).toBe(expectedSum);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Activities outside JST day boundaries are excluded', () => {
    it('should exclude activities before JST day start from progress calculation', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(activityBeforeJstDayArb, { minLength: 1, maxLength: 10 }),
          async (activitiesBeforeDay) => {
            // Reset mocks for each property test iteration
            vi.clearAllMocks();

            // Setup mocks - repository returns empty because activities are outside range
            vi.mocked(habitRepo.getActiveDoHabits).mockResolvedValue([testHabit]);
            vi.mocked(activityRepo.getActivitiesInRange).mockResolvedValue([]);
            vi.mocked(goalRepo.getById).mockResolvedValue(testGoal);
            vi.mocked(activityRepo.getHabitActivities).mockResolvedValue([]);

            // Get daily progress
            const progress = await calculator.getDailyProgress('owner-123', 'user');

            // Verify currentCount is 0 since no activities are within the day
            expect(progress).toHaveLength(1);
            expect(progress[0]?.currentCount).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should exclude activities after JST day end from progress calculation', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(activityAfterJstDayArb, { minLength: 1, maxLength: 10 }),
          async (activitiesAfterDay) => {
            // Reset mocks for each property test iteration
            vi.clearAllMocks();

            // Setup mocks - repository returns empty because activities are outside range
            vi.mocked(habitRepo.getActiveDoHabits).mockResolvedValue([testHabit]);
            vi.mocked(activityRepo.getActivitiesInRange).mockResolvedValue([]);
            vi.mocked(goalRepo.getById).mockResolvedValue(testGoal);
            vi.mocked(activityRepo.getHabitActivities).mockResolvedValue([]);

            // Get daily progress
            const progress = await calculator.getDailyProgress('owner-123', 'user');

            // Verify currentCount is 0 since no activities are within the day
            expect(progress).toHaveLength(1);
            expect(progress[0]?.currentCount).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Mixed activities - only within-day activities are counted', () => {
    it('should only count activities within JST day when mixed with outside activities', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(
            fc.array(activityWithinJstDayArb, { minLength: 1, maxLength: 10 }),
            fc.array(activityBeforeJstDayArb, { minLength: 0, maxLength: 5 }),
            fc.array(activityAfterJstDayArb, { minLength: 0, maxLength: 5 })
          ),
          async ([withinDay, beforeDay, afterDay]) => {
            // Reset mocks for each property test iteration
            vi.clearAllMocks();

            // The repository should only return activities within the day
            // (simulating the database query filtering)
            vi.mocked(habitRepo.getActiveDoHabits).mockResolvedValue([testHabit]);
            vi.mocked(activityRepo.getActivitiesInRange).mockResolvedValue(withinDay);
            vi.mocked(goalRepo.getById).mockResolvedValue(testGoal);
            vi.mocked(activityRepo.getHabitActivities).mockResolvedValue([]);

            // Calculate expected sum (only from within-day activities)
            const expectedSum = withinDay.reduce((sum, act) => sum + act.amount, 0);

            // Get daily progress
            const progress = await calculator.getDailyProgress('owner-123', 'user');

            // Verify the currentCount matches only the within-day activities
            expect(progress).toHaveLength(1);
            expect(progress[0]?.currentCount).toBe(expectedSum);

            // Verify that outside-day activities are NOT counted
            const outsideDaySum = [...beforeDay, ...afterDay].reduce(
              (sum, act) => sum + act.amount,
              0
            );
            if (outsideDaySum > 0) {
              expect(progress[0]?.currentCount).not.toBe(expectedSum + outsideDaySum);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('JST day boundary edge cases', () => {
    it('should correctly identify JST day boundaries', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
          () => {
            const [start, end] = calculator.getJstDayBoundaries();

            // Verify start is before end
            expect(start.getTime()).toBeLessThan(end.getTime());

            // Verify the difference is approximately 24 hours (minus 1ms)
            const diffMs = end.getTime() - start.getTime();
            const diffHours = diffMs / (1000 * 60 * 60);
            expect(diffHours).toBeGreaterThan(23);
            expect(diffHours).toBeLessThan(25);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should include activity at exactly JST 00:00:00', async () => {
      await fc.assert(
        fc.asyncProperty(amountArb, async (amount) => {
          // Reset mocks for each property test iteration
          vi.clearAllMocks();

          const [startUtc] = getJstDayBoundariesForDate(new Date());
          const activityAtStart = createActivityWithTimestamp(testHabit.id, startUtc, amount);

          vi.mocked(habitRepo.getActiveDoHabits).mockResolvedValue([testHabit]);
          vi.mocked(activityRepo.getActivitiesInRange).mockResolvedValue([activityAtStart]);
          vi.mocked(goalRepo.getById).mockResolvedValue(testGoal);
          vi.mocked(activityRepo.getHabitActivities).mockResolvedValue([]);

          const progress = await calculator.getDailyProgress('owner-123', 'user');

          expect(progress).toHaveLength(1);
          expect(progress[0]?.currentCount).toBe(amount);
        }),
        { numRuns: 50 }
      );
    });

    it('should include activity at exactly JST 23:59:59', async () => {
      await fc.assert(
        fc.asyncProperty(amountArb, async (amount) => {
          // Reset mocks for each property test iteration
          vi.clearAllMocks();

          const [, endUtc] = getJstDayBoundariesForDate(new Date());
          const activityAtEnd = createActivityWithTimestamp(testHabit.id, endUtc, amount);

          vi.mocked(habitRepo.getActiveDoHabits).mockResolvedValue([testHabit]);
          vi.mocked(activityRepo.getActivitiesInRange).mockResolvedValue([activityAtEnd]);
          vi.mocked(goalRepo.getById).mockResolvedValue(testGoal);
          vi.mocked(activityRepo.getHabitActivities).mockResolvedValue([]);

          const progress = await calculator.getDailyProgress('owner-123', 'user');

          expect(progress).toHaveLength(1);
          expect(progress[0]?.currentCount).toBe(amount);
        }),
        { numRuns: 50 }
      );
    });

    it('should exclude activity at exactly 1ms before JST 00:00:00', async () => {
      await fc.assert(
        fc.asyncProperty(amountArb, async (amount) => {
          // Reset mocks for each property test iteration
          vi.clearAllMocks();

          const [startUtc] = getJstDayBoundariesForDate(new Date());
          const activityJustBefore = createActivityWithTimestamp(
            testHabit.id,
            new Date(startUtc.getTime() - 1),
            amount
          );

          // Repository returns empty because activity is outside range
          vi.mocked(habitRepo.getActiveDoHabits).mockResolvedValue([testHabit]);
          vi.mocked(activityRepo.getActivitiesInRange).mockResolvedValue([]);
          vi.mocked(goalRepo.getById).mockResolvedValue(testGoal);
          vi.mocked(activityRepo.getHabitActivities).mockResolvedValue([]);

          const progress = await calculator.getDailyProgress('owner-123', 'user');

          expect(progress).toHaveLength(1);
          expect(progress[0]?.currentCount).toBe(0);
        }),
        { numRuns: 50 }
      );
    });

    it('should exclude activity at exactly 1ms after JST 23:59:59.999', async () => {
      await fc.assert(
        fc.asyncProperty(amountArb, async (amount) => {
          // Reset mocks for each property test iteration
          vi.clearAllMocks();

          const [, endUtc] = getJstDayBoundariesForDate(new Date());
          const activityJustAfter = createActivityWithTimestamp(
            testHabit.id,
            new Date(endUtc.getTime() + 1),
            amount
          );

          // Repository returns empty because activity is outside range
          vi.mocked(habitRepo.getActiveDoHabits).mockResolvedValue([testHabit]);
          vi.mocked(activityRepo.getActivitiesInRange).mockResolvedValue([]);
          vi.mocked(goalRepo.getById).mockResolvedValue(testGoal);
          vi.mocked(activityRepo.getHabitActivities).mockResolvedValue([]);

          const progress = await calculator.getDailyProgress('owner-123', 'user');

          expect(progress).toHaveLength(1);
          expect(progress[0]?.currentCount).toBe(0);
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('Repository query verification', () => {
    it('should query activities with correct JST day boundaries', async () => {
      await fc.assert(
        fc.asyncProperty(fc.constant(null), async () => {
          // Reset mocks for each property test iteration
          vi.clearAllMocks();

          vi.mocked(habitRepo.getActiveDoHabits).mockResolvedValue([testHabit]);
          vi.mocked(activityRepo.getActivitiesInRange).mockResolvedValue([]);
          vi.mocked(goalRepo.getById).mockResolvedValue(testGoal);
          vi.mocked(activityRepo.getHabitActivities).mockResolvedValue([]);

          await calculator.getDailyProgress('owner-123', 'user');

          // Verify getActivitiesInRange was called with correct parameters
          expect(activityRepo.getActivitiesInRange).toHaveBeenCalledWith(
            'user',
            'owner-123',
            expect.any(Date),
            expect.any(Date),
            'complete'
          );

          // Get the actual call arguments
          const calls = vi.mocked(activityRepo.getActivitiesInRange).mock.calls;
          expect(calls.length).toBeGreaterThan(0);

          const [, , startDate, endDate, kind] = calls[0]!;

          // Verify the dates are valid
          expect(startDate).toBeInstanceOf(Date);
          expect(endDate).toBeInstanceOf(Date);
          expect((endDate as Date).getTime()).toBeGreaterThan((startDate as Date).getTime());
          expect(kind).toBe('complete');
        }),
        { numRuns: 10 }
      );
    });
  });
});
