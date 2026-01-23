/**
 * Property-Based Tests for Daily Progress Calculation - Amount Summation
 *
 * **Property 8: Daily Progress Calculation - Amount Summation**
 * For any set of activities with amounts, the total progress should equal the sum
 * of all activity amounts. The summation should be commutative (order-independent)
 * and associative.
 *
 * **Validates: Requirements 7.2, 7.3**
 *
 * Requirements:
 * - 7.2: Sum the amount field from activities with kind="complete"
 * - 7.3: Use workload_per_count as default when amount is null
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

const testHabitId = '123e4567-e89b-12d3-a456-426614174000';
const testOwnerId = '123e4567-e89b-12d3-a456-426614174001';
const testGoalId = '123e4567-e89b-12d3-a456-426614174002';

function createTestHabit(workloadPerCount: number = 1, targetCount: number = 10): Habit {
  return {
    id: testHabitId,
    owner_type: 'user',
    owner_id: testOwnerId,
    name: 'Test Habit',
    description: 'Test habit for property testing',
    goal_id: testGoalId,
    active: true,
    frequency: 'daily',
    target_count: targetCount,
    workload_unit: 'times',
    workload_per_count: workloadPerCount,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: null,
  };
}

const testGoal: Goal = {
  id: testGoalId,
  owner_type: 'user',
  owner_id: testOwnerId,
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
 * Generate a random activity with a specific amount.
 */
function createActivityWithAmount(
  habitId: string,
  amount: number
): Activity {
  const now = new Date();
  return {
    id: `activity-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    owner_type: 'user',
    owner_id: testOwnerId,
    habit_id: habitId,
    habit_name: 'Test Habit',
    kind: 'complete',
    timestamp: now.toISOString(),
    amount,
    memo: null,
    created_at: now.toISOString(),
  };
}

/**
 * Arbitrary for generating a positive amount (integer).
 */
const positiveAmountArb = fc.integer({ min: 1, max: 1000 });

/**
 * Arbitrary for generating a positive workload_per_count.
 */
const workloadPerCountArb = fc.integer({ min: 1, max: 100 });

/**
 * Arbitrary for generating an array of positive amounts.
 */
const amountsArrayArb = fc.array(positiveAmountArb, { minLength: 1, maxLength: 50 });

/**
 * Arbitrary for generating activities with specific amounts.
 */
function activitiesWithAmountsArb(habitId: string) {
  return amountsArrayArb.map((amounts) =>
    amounts.map((amount) => createActivityWithAmount(habitId, amount))
  );
}

// ============================================================================
// Property-Based Tests
// ============================================================================

describe('Property 8: Daily Progress Calculation - Amount Summation', () => {
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
   * **Validates: Requirements 7.2**
   *
   * Property: For any set of activities with amounts, the currentCount should
   * equal the sum of all activity amounts.
   */
  describe('Total equals sum of all amounts', () => {
    it('should calculate currentCount as the sum of all activity amounts', async () => {
      await fc.assert(
        fc.asyncProperty(
          activitiesWithAmountsArb(testHabitId),
          async (activities) => {
            // Reset mocks for each property test iteration
            vi.clearAllMocks();

            const testHabit = createTestHabit();

            // Setup mocks
            vi.mocked(habitRepo.getActiveDoHabits).mockResolvedValue([testHabit]);
            vi.mocked(activityRepo.getActivitiesInRange).mockResolvedValue(activities);
            vi.mocked(goalRepo.getById).mockResolvedValue(testGoal);
            vi.mocked(activityRepo.getHabitActivities).mockResolvedValue([]);

            // Calculate expected sum
            const expectedSum = activities.reduce((sum, act) => sum + act.amount, 0);

            // Get daily progress
            const progress = await calculator.getDailyProgress(testOwnerId, 'user');

            // Verify the currentCount matches the sum of all activity amounts
            expect(progress).toHaveLength(1);
            expect(progress[0]?.currentCount).toBe(expectedSum);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Validates: Requirements 7.2**
   *
   * Property: Summation should be commutative - order of activities doesn't matter.
   */
  describe('Commutativity - order independence', () => {
    it('should produce the same result regardless of activity order', async () => {
      await fc.assert(
        fc.asyncProperty(
          amountsArrayArb,
          async (amounts) => {
            // Reset mocks for each property test iteration
            vi.clearAllMocks();

            const testHabit = createTestHabit();

            // Create activities in original order
            const activitiesOriginal = amounts.map((amount) =>
              createActivityWithAmount(testHabitId, amount)
            );

            // Create activities in reversed order
            const activitiesReversed = [...amounts].reverse().map((amount) =>
              createActivityWithAmount(testHabitId, amount)
            );

            // Setup mocks for original order
            vi.mocked(habitRepo.getActiveDoHabits).mockResolvedValue([testHabit]);
            vi.mocked(activityRepo.getActivitiesInRange).mockResolvedValue(activitiesOriginal);
            vi.mocked(goalRepo.getById).mockResolvedValue(testGoal);
            vi.mocked(activityRepo.getHabitActivities).mockResolvedValue([]);

            // Get progress with original order
            const progressOriginal = await calculator.getDailyProgress(testOwnerId, 'user');

            // Reset and setup mocks for reversed order
            vi.clearAllMocks();
            vi.mocked(habitRepo.getActiveDoHabits).mockResolvedValue([testHabit]);
            vi.mocked(activityRepo.getActivitiesInRange).mockResolvedValue(activitiesReversed);
            vi.mocked(goalRepo.getById).mockResolvedValue(testGoal);
            vi.mocked(activityRepo.getHabitActivities).mockResolvedValue([]);

            // Get progress with reversed order
            const progressReversed = await calculator.getDailyProgress(testOwnerId, 'user');

            // Verify both produce the same currentCount
            expect(progressOriginal[0]?.currentCount).toBe(progressReversed[0]?.currentCount);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce the same result with shuffled activity order', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(amountsArrayArb, fc.integer({ min: 0, max: 1000000 })),
          async ([amounts, seed]) => {
            // Reset mocks for each property test iteration
            vi.clearAllMocks();

            const testHabit = createTestHabit();

            // Create activities in original order
            const activitiesOriginal = amounts.map((amount) =>
              createActivityWithAmount(testHabitId, amount)
            );

            // Shuffle activities using seed for reproducibility
            const shuffled = [...activitiesOriginal];
            for (let i = shuffled.length - 1; i > 0; i--) {
              const j = (seed + i) % (i + 1);
              [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
            }

            // Setup mocks for original order
            vi.mocked(habitRepo.getActiveDoHabits).mockResolvedValue([testHabit]);
            vi.mocked(activityRepo.getActivitiesInRange).mockResolvedValue(activitiesOriginal);
            vi.mocked(goalRepo.getById).mockResolvedValue(testGoal);
            vi.mocked(activityRepo.getHabitActivities).mockResolvedValue([]);

            // Get progress with original order
            const progressOriginal = await calculator.getDailyProgress(testOwnerId, 'user');

            // Reset and setup mocks for shuffled order
            vi.clearAllMocks();
            vi.mocked(habitRepo.getActiveDoHabits).mockResolvedValue([testHabit]);
            vi.mocked(activityRepo.getActivitiesInRange).mockResolvedValue(shuffled);
            vi.mocked(goalRepo.getById).mockResolvedValue(testGoal);
            vi.mocked(activityRepo.getHabitActivities).mockResolvedValue([]);

            // Get progress with shuffled order
            const progressShuffled = await calculator.getDailyProgress(testOwnerId, 'user');

            // Verify both produce the same currentCount
            expect(progressOriginal[0]?.currentCount).toBe(progressShuffled[0]?.currentCount);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Validates: Requirements 7.2**
   *
   * Property: Summation should be associative - grouping doesn't matter.
   * sum(a, b, c) = sum(sum(a, b), c) = sum(a, sum(b, c))
   */
  describe('Associativity - grouping independence', () => {
    it('should produce the same result regardless of how activities are grouped', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(
            fc.array(positiveAmountArb, { minLength: 1, maxLength: 20 }),
            fc.array(positiveAmountArb, { minLength: 1, maxLength: 20 }),
            fc.array(positiveAmountArb, { minLength: 1, maxLength: 20 })
          ),
          async ([group1, group2, group3]) => {
            // Reset mocks for each property test iteration
            vi.clearAllMocks();

            const testHabit = createTestHabit();

            // Create all activities combined
            const allAmounts = [...group1, ...group2, ...group3];
            const allActivities = allAmounts.map((amount) =>
              createActivityWithAmount(testHabitId, amount)
            );

            // Calculate expected sum
            const expectedSum = allAmounts.reduce((sum, amount) => sum + amount, 0);

            // Setup mocks
            vi.mocked(habitRepo.getActiveDoHabits).mockResolvedValue([testHabit]);
            vi.mocked(activityRepo.getActivitiesInRange).mockResolvedValue(allActivities);
            vi.mocked(goalRepo.getById).mockResolvedValue(testGoal);
            vi.mocked(activityRepo.getHabitActivities).mockResolvedValue([]);

            // Get daily progress
            const progress = await calculator.getDailyProgress(testOwnerId, 'user');

            // Verify the currentCount equals the sum of all groups
            expect(progress).toHaveLength(1);
            expect(progress[0]?.currentCount).toBe(expectedSum);

            // Also verify associativity: sum(group1) + sum(group2) + sum(group3) = total
            const sum1 = group1.reduce((s, a) => s + a, 0);
            const sum2 = group2.reduce((s, a) => s + a, 0);
            const sum3 = group3.reduce((s, a) => s + a, 0);
            expect(sum1 + sum2 + sum3).toBe(expectedSum);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Validates: Requirements 7.3**
   *
   * Property: When amount is null/undefined, workload_per_count should be used as default.
   */
  describe('Default amount handling', () => {
    it('should use workload_per_count when activity amount is null', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(
            workloadPerCountArb,
            fc.integer({ min: 1, max: 20 })
          ),
          async ([workloadPerCount, activityCount]) => {
            // Reset mocks for each property test iteration
            vi.clearAllMocks();

            const testHabit = createTestHabit(workloadPerCount);

            // Create activities with null amounts (simulating missing amount field)
            const activitiesWithNullAmount: Activity[] = [];
            for (let i = 0; i < activityCount; i++) {
              const activity = createActivityWithAmount(testHabitId, 1);
              // Set amount to undefined to simulate null/missing amount
              (activity as Activity & { amount: number | undefined }).amount = undefined as unknown as number;
              activitiesWithNullAmount.push(activity);
            }

            // Setup mocks
            vi.mocked(habitRepo.getActiveDoHabits).mockResolvedValue([testHabit]);
            vi.mocked(activityRepo.getActivitiesInRange).mockResolvedValue(activitiesWithNullAmount);
            vi.mocked(goalRepo.getById).mockResolvedValue(testGoal);
            vi.mocked(activityRepo.getHabitActivities).mockResolvedValue([]);

            // Expected sum: activityCount * workloadPerCount (since each null amount defaults to workloadPerCount)
            const expectedSum = activityCount * workloadPerCount;

            // Get daily progress
            const progress = await calculator.getDailyProgress(testOwnerId, 'user');

            // Verify the currentCount uses workloadPerCount as default
            expect(progress).toHaveLength(1);
            expect(progress[0]?.currentCount).toBe(expectedSum);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle mix of activities with and without amounts', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(
            workloadPerCountArb,
            fc.array(positiveAmountArb, { minLength: 1, maxLength: 10 }),
            fc.integer({ min: 1, max: 10 })
          ),
          async ([workloadPerCount, explicitAmounts, nullAmountCount]) => {
            // Reset mocks for each property test iteration
            vi.clearAllMocks();

            const testHabit = createTestHabit(workloadPerCount);

            // Create activities with explicit amounts
            const activitiesWithAmount = explicitAmounts.map((amount) =>
              createActivityWithAmount(testHabitId, amount)
            );

            // Create activities with null amounts
            const activitiesWithNullAmount: Activity[] = [];
            for (let i = 0; i < nullAmountCount; i++) {
              const activity = createActivityWithAmount(testHabitId, 1);
              (activity as Activity & { amount: number | undefined }).amount = undefined as unknown as number;
              activitiesWithNullAmount.push(activity);
            }

            // Combine all activities
            const allActivities = [...activitiesWithAmount, ...activitiesWithNullAmount];

            // Setup mocks
            vi.mocked(habitRepo.getActiveDoHabits).mockResolvedValue([testHabit]);
            vi.mocked(activityRepo.getActivitiesInRange).mockResolvedValue(allActivities);
            vi.mocked(goalRepo.getById).mockResolvedValue(testGoal);
            vi.mocked(activityRepo.getHabitActivities).mockResolvedValue([]);

            // Expected sum: sum of explicit amounts + (nullAmountCount * workloadPerCount)
            const explicitSum = explicitAmounts.reduce((sum, amount) => sum + amount, 0);
            const defaultSum = nullAmountCount * workloadPerCount;
            const expectedSum = explicitSum + defaultSum;

            // Get daily progress
            const progress = await calculator.getDailyProgress(testOwnerId, 'user');

            // Verify the currentCount correctly handles both explicit and default amounts
            expect(progress).toHaveLength(1);
            expect(progress[0]?.currentCount).toBe(expectedSum);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Validates: Requirements 7.2**
   *
   * Property: Empty activities should result in zero currentCount.
   */
  describe('Empty activities handling', () => {
    it('should return zero currentCount when no activities exist', async () => {
      await fc.assert(
        fc.asyncProperty(
          workloadPerCountArb,
          async (workloadPerCount) => {
            // Reset mocks for each property test iteration
            vi.clearAllMocks();

            const testHabit = createTestHabit(workloadPerCount);

            // Setup mocks with empty activities
            vi.mocked(habitRepo.getActiveDoHabits).mockResolvedValue([testHabit]);
            vi.mocked(activityRepo.getActivitiesInRange).mockResolvedValue([]);
            vi.mocked(goalRepo.getById).mockResolvedValue(testGoal);
            vi.mocked(activityRepo.getHabitActivities).mockResolvedValue([]);

            // Get daily progress
            const progress = await calculator.getDailyProgress(testOwnerId, 'user');

            // Verify currentCount is 0
            expect(progress).toHaveLength(1);
            expect(progress[0]?.currentCount).toBe(0);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * **Validates: Requirements 7.2**
   *
   * Property: Single activity should have currentCount equal to its amount.
   */
  describe('Single activity handling', () => {
    it('should return the activity amount as currentCount for single activity', async () => {
      await fc.assert(
        fc.asyncProperty(
          positiveAmountArb,
          async (amount) => {
            // Reset mocks for each property test iteration
            vi.clearAllMocks();

            const testHabit = createTestHabit();
            const singleActivity = createActivityWithAmount(testHabitId, amount);

            // Setup mocks
            vi.mocked(habitRepo.getActiveDoHabits).mockResolvedValue([testHabit]);
            vi.mocked(activityRepo.getActivitiesInRange).mockResolvedValue([singleActivity]);
            vi.mocked(goalRepo.getById).mockResolvedValue(testGoal);
            vi.mocked(activityRepo.getHabitActivities).mockResolvedValue([]);

            // Get daily progress
            const progress = await calculator.getDailyProgress(testOwnerId, 'user');

            // Verify currentCount equals the single activity's amount
            expect(progress).toHaveLength(1);
            expect(progress[0]?.currentCount).toBe(amount);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Validates: Requirements 7.2**
   *
   * Property: Activities for different habits should be summed separately.
   */
  describe('Multiple habits handling', () => {
    it('should sum activities separately for each habit', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(
            fc.array(positiveAmountArb, { minLength: 1, maxLength: 10 }),
            fc.array(positiveAmountArb, { minLength: 1, maxLength: 10 })
          ),
          async ([amounts1, amounts2]) => {
            // Reset mocks for each property test iteration
            vi.clearAllMocks();

            const habitId1 = '123e4567-e89b-12d3-a456-426614174100';
            const habitId2 = '123e4567-e89b-12d3-a456-426614174200';

            const testHabit1: Habit = {
              ...createTestHabit(),
              id: habitId1,
              name: 'Habit 1',
            };

            const testHabit2: Habit = {
              ...createTestHabit(),
              id: habitId2,
              name: 'Habit 2',
            };

            // Create activities for habit 1
            const activities1 = amounts1.map((amount) =>
              createActivityWithAmount(habitId1, amount)
            );

            // Create activities for habit 2
            const activities2 = amounts2.map((amount) =>
              createActivityWithAmount(habitId2, amount)
            );

            // Combine all activities
            const allActivities = [...activities1, ...activities2];

            // Setup mocks
            vi.mocked(habitRepo.getActiveDoHabits).mockResolvedValue([testHabit1, testHabit2]);
            vi.mocked(activityRepo.getActivitiesInRange).mockResolvedValue(allActivities);
            vi.mocked(goalRepo.getById).mockResolvedValue(testGoal);
            vi.mocked(activityRepo.getHabitActivities).mockResolvedValue([]);

            // Calculate expected sums
            const expectedSum1 = amounts1.reduce((sum, amount) => sum + amount, 0);
            const expectedSum2 = amounts2.reduce((sum, amount) => sum + amount, 0);

            // Get daily progress
            const progress = await calculator.getDailyProgress(testOwnerId, 'user');

            // Verify each habit has correct currentCount
            expect(progress).toHaveLength(2);

            const habit1Progress = progress.find((p) => p.habitId === habitId1);
            const habit2Progress = progress.find((p) => p.habitId === habitId2);

            expect(habit1Progress?.currentCount).toBe(expectedSum1);
            expect(habit2Progress?.currentCount).toBe(expectedSum2);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Validates: Requirements 7.2**
   *
   * Property: Progress rate should be correctly calculated from currentCount and totalCount.
   */
  describe('Progress rate calculation', () => {
    it('should calculate progressRate as (currentCount / totalCount) * 100', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(
            fc.array(positiveAmountArb, { minLength: 1, maxLength: 10 }),
            fc.integer({ min: 1, max: 100 })
          ),
          async ([amounts, targetCount]) => {
            // Reset mocks for each property test iteration
            vi.clearAllMocks();

            const testHabit = createTestHabit(1, targetCount);
            const activities = amounts.map((amount) =>
              createActivityWithAmount(testHabitId, amount)
            );

            // Setup mocks
            vi.mocked(habitRepo.getActiveDoHabits).mockResolvedValue([testHabit]);
            vi.mocked(activityRepo.getActivitiesInRange).mockResolvedValue(activities);
            vi.mocked(goalRepo.getById).mockResolvedValue(testGoal);
            vi.mocked(activityRepo.getHabitActivities).mockResolvedValue([]);

            // Calculate expected values
            const expectedCurrentCount = amounts.reduce((sum, amount) => sum + amount, 0);
            const expectedProgressRate = (expectedCurrentCount / targetCount) * 100;

            // Get daily progress
            const progress = await calculator.getDailyProgress(testOwnerId, 'user');

            // Verify progressRate calculation
            expect(progress).toHaveLength(1);
            expect(progress[0]?.currentCount).toBe(expectedCurrentCount);
            expect(progress[0]?.totalCount).toBe(targetCount);
            expect(progress[0]?.progressRate).toBeCloseTo(expectedProgressRate, 5);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should mark habit as completed when progressRate >= 100', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(
            fc.integer({ min: 10, max: 100 }),
            fc.integer({ min: 1, max: 10 })
          ),
          async ([amount, targetCount]) => {
            // Ensure amount >= targetCount for completion
            const actualAmount = Math.max(amount, targetCount);

            // Reset mocks for each property test iteration
            vi.clearAllMocks();

            const testHabit = createTestHabit(1, targetCount);
            const activity = createActivityWithAmount(testHabitId, actualAmount);

            // Setup mocks
            vi.mocked(habitRepo.getActiveDoHabits).mockResolvedValue([testHabit]);
            vi.mocked(activityRepo.getActivitiesInRange).mockResolvedValue([activity]);
            vi.mocked(goalRepo.getById).mockResolvedValue(testGoal);
            vi.mocked(activityRepo.getHabitActivities).mockResolvedValue([]);

            // Get daily progress
            const progress = await calculator.getDailyProgress(testOwnerId, 'user');

            // Verify completed status
            expect(progress).toHaveLength(1);
            expect(progress[0]?.progressRate).toBeGreaterThanOrEqual(100);
            expect(progress[0]?.completed).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
