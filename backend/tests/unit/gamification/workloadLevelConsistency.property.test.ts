/**
 * Property-Based Tests for Workload-Level Consistency
 *
 * Feature: gamification-xp-balance
 * Property 9: Workload-Level Consistency Detection
 *
 * For any habit where the estimated level from workload differs from the
 * assessed level by more than 20 points, the system shall flag isConsistent = false.
 *
 * **Validates: Requirements 5.3**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

// =============================================================================
// Types (mirroring the service types)
// =============================================================================

type Frequency = 'daily' | 'weekly' | 'monthly';

interface MockHabit {
  id: string;
  level: number | null;
  frequency: Frequency;
  workload_per_count: number;
  target_count: number;
}

interface WorkloadLevelConsistencyResult {
  habitId: string;
  isConsistent: boolean;
  assessedLevel: number | null;
  estimatedLevelFromWorkload: number;
  levelDifference: number;
  recommendation: 'consistent' | 'reassess_level' | 'adjust_workload';
}

// =============================================================================
// Pure Functions Under Test (extracted from service for testing)
// =============================================================================

/**
 * Estimate habit level from workload settings.
 * This is a pure function that can be tested independently.
 */
function estimateLevelFromWorkload(habit: MockHabit): number {
  let level = 0;

  // Frequency contribution (⑱ variable)
  switch (habit.frequency) {
    case 'daily':
      level += 30;
      break;
    case 'weekly':
      level += 15;
      break;
    case 'monthly':
      level += 5;
      break;
    default:
      level += 20;
  }

  // Duration/workload contribution (⑲ variable)
  const workloadPerCount = habit.workload_per_count ?? 1;
  if (workloadPerCount <= 5) {
    level += 5;
  } else if (workloadPerCount <= 15) {
    level += 15;
  } else if (workloadPerCount <= 30) {
    level += 25;
  } else if (workloadPerCount <= 60) {
    level += 40;
  } else {
    level += 60;
  }

  // Target count contribution (⑳ variable)
  const targetCount = habit.target_count ?? 1;
  if (targetCount <= 1) {
    level += 5;
  } else if (targetCount <= 3) {
    level += 15;
  } else if (targetCount <= 5) {
    level += 25;
  } else if (targetCount <= 10) {
    level += 40;
  } else {
    level += 60;
  }

  // Clamp to valid range
  return Math.min(199, Math.max(0, level));
}

/**
 * Validate workload-level consistency.
 * Pure function for testing.
 */
function validateWorkloadLevelConsistency(habit: MockHabit): WorkloadLevelConsistencyResult {
  const CONSISTENCY_THRESHOLD = 20;

  const assessedLevel = habit.level;
  const estimatedLevelFromWorkload = estimateLevelFromWorkload(habit);

  // Calculate difference
  const levelDifference = assessedLevel !== null
    ? Math.abs(assessedLevel - estimatedLevelFromWorkload)
    : 0;

  // Check consistency (threshold: 20 points)
  const isConsistent = assessedLevel === null || levelDifference <= CONSISTENCY_THRESHOLD;

  // Determine recommendation
  let recommendation: 'consistent' | 'reassess_level' | 'adjust_workload';
  if (isConsistent) {
    recommendation = 'consistent';
  } else if (assessedLevel !== null && estimatedLevelFromWorkload > assessedLevel) {
    recommendation = 'reassess_level';
  } else {
    recommendation = 'adjust_workload';
  }

  return {
    habitId: habit.id,
    isConsistent,
    assessedLevel,
    estimatedLevelFromWorkload,
    levelDifference,
    recommendation,
  };
}

// =============================================================================
// Arbitraries
// =============================================================================

const frequencyArb = fc.constantFrom<Frequency>('daily', 'weekly', 'monthly');

const habitArb = fc.record({
  id: fc.uuid(),
  level: fc.oneof(fc.constant(null), fc.integer({ min: 0, max: 199 })),
  frequency: frequencyArb,
  workload_per_count: fc.integer({ min: 1, max: 120 }),
  target_count: fc.integer({ min: 1, max: 20 }),
});

const habitWithLevelArb = fc.record({
  id: fc.uuid(),
  level: fc.integer({ min: 0, max: 199 }),
  frequency: frequencyArb,
  workload_per_count: fc.integer({ min: 1, max: 120 }),
  target_count: fc.integer({ min: 1, max: 20 }),
});

// =============================================================================
// Property Tests
// =============================================================================

describe('Workload-Level Consistency Properties', () => {
  /**
   * Property 9: Workload-Level Consistency Detection
   *
   * For any habit where the estimated level from workload differs from the
   * assessed level by more than 20 points, the system shall flag isConsistent = false.
   */
  describe('Property 9: Workload-Level Consistency Detection', () => {
    it('should flag isConsistent = false when level difference > 20', () => {
      fc.assert(
        fc.property(habitWithLevelArb, (habit) => {
          const result = validateWorkloadLevelConsistency(habit);
          const estimatedLevel = estimateLevelFromWorkload(habit);
          const actualDifference = Math.abs(habit.level - estimatedLevel);

          // Property: if difference > 20, isConsistent must be false
          if (actualDifference > 20) {
            expect(result.isConsistent).toBe(false);
          }

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('should flag isConsistent = true when level difference <= 20', () => {
      fc.assert(
        fc.property(habitWithLevelArb, (habit) => {
          const result = validateWorkloadLevelConsistency(habit);
          const estimatedLevel = estimateLevelFromWorkload(habit);
          const actualDifference = Math.abs(habit.level - estimatedLevel);

          // Property: if difference <= 20, isConsistent must be true
          if (actualDifference <= 20) {
            expect(result.isConsistent).toBe(true);
          }

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('should always return isConsistent = true when assessedLevel is null', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.uuid(),
            level: fc.constant(null),
            frequency: frequencyArb,
            workload_per_count: fc.integer({ min: 1, max: 120 }),
            target_count: fc.integer({ min: 1, max: 20 }),
          }),
          (habit) => {
            const result = validateWorkloadLevelConsistency(habit);

            // Property: null assessed level always means consistent
            expect(result.isConsistent).toBe(true);
            expect(result.recommendation).toBe('consistent');

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Level Estimation Properties', () => {
    it('should always return a level in valid range [0, 199]', () => {
      fc.assert(
        fc.property(habitArb, (habit) => {
          const estimatedLevel = estimateLevelFromWorkload(habit);

          expect(estimatedLevel).toBeGreaterThanOrEqual(0);
          expect(estimatedLevel).toBeLessThanOrEqual(199);

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('should return higher level for daily frequency than weekly', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 60 }),
          fc.integer({ min: 1, max: 10 }),
          (workloadPerCount, targetCount) => {
            const dailyHabit: MockHabit = {
              id: 'test',
              level: null,
              frequency: 'daily',
              workload_per_count: workloadPerCount,
              target_count: targetCount,
            };

            const weeklyHabit: MockHabit = {
              id: 'test',
              level: null,
              frequency: 'weekly',
              workload_per_count: workloadPerCount,
              target_count: targetCount,
            };

            const dailyLevel = estimateLevelFromWorkload(dailyHabit);
            const weeklyLevel = estimateLevelFromWorkload(weeklyHabit);

            // Daily should always be higher than weekly (30 vs 15 contribution)
            expect(dailyLevel).toBeGreaterThan(weeklyLevel);

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should return higher level for higher workload per count', () => {
      fc.assert(
        fc.property(
          frequencyArb,
          fc.integer({ min: 1, max: 10 }),
          (frequency, targetCount) => {
            const lowWorkloadHabit: MockHabit = {
              id: 'test',
              level: null,
              frequency,
              workload_per_count: 5,
              target_count: targetCount,
            };

            const highWorkloadHabit: MockHabit = {
              id: 'test',
              level: null,
              frequency,
              workload_per_count: 61,
              target_count: targetCount,
            };

            const lowLevel = estimateLevelFromWorkload(lowWorkloadHabit);
            const highLevel = estimateLevelFromWorkload(highWorkloadHabit);

            // Higher workload should result in higher level
            expect(highLevel).toBeGreaterThan(lowLevel);

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Recommendation Properties', () => {
    it('should recommend reassess_level when estimated > assessed', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.uuid(),
            level: fc.integer({ min: 0, max: 50 }), // Low assessed level
            frequency: fc.constant<Frequency>('daily'),
            workload_per_count: fc.integer({ min: 61, max: 120 }), // High workload
            target_count: fc.integer({ min: 11, max: 20 }), // High target
          }),
          (habit) => {
            const result = validateWorkloadLevelConsistency(habit);

            // If inconsistent and estimated > assessed, should recommend reassess
            if (!result.isConsistent && result.estimatedLevelFromWorkload > habit.level) {
              expect(result.recommendation).toBe('reassess_level');
            }

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should recommend adjust_workload when estimated < assessed', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.uuid(),
            level: fc.integer({ min: 150, max: 199 }), // High assessed level
            frequency: fc.constant<Frequency>('monthly'),
            workload_per_count: fc.integer({ min: 1, max: 5 }), // Low workload
            target_count: fc.integer({ min: 1, max: 1 }), // Low target
          }),
          (habit) => {
            const result = validateWorkloadLevelConsistency(habit);

            // If inconsistent and estimated < assessed, should recommend adjust workload
            if (!result.isConsistent && result.estimatedLevelFromWorkload < habit.level) {
              expect(result.recommendation).toBe('adjust_workload');
            }

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should always recommend consistent when isConsistent is true', () => {
      fc.assert(
        fc.property(habitArb, (habit) => {
          const result = validateWorkloadLevelConsistency(habit);

          if (result.isConsistent) {
            expect(result.recommendation).toBe('consistent');
          }

          return true;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Result Structure Completeness', () => {
    it('should always return all required fields', () => {
      fc.assert(
        fc.property(habitArb, (habit) => {
          const result = validateWorkloadLevelConsistency(habit);

          // All required fields must be present
          expect(result).toHaveProperty('habitId');
          expect(result).toHaveProperty('isConsistent');
          expect(result).toHaveProperty('assessedLevel');
          expect(result).toHaveProperty('estimatedLevelFromWorkload');
          expect(result).toHaveProperty('levelDifference');
          expect(result).toHaveProperty('recommendation');

          // Type checks
          expect(typeof result.habitId).toBe('string');
          expect(typeof result.isConsistent).toBe('boolean');
          expect(typeof result.estimatedLevelFromWorkload).toBe('number');
          expect(typeof result.levelDifference).toBe('number');
          expect(['consistent', 'reassess_level', 'adjust_workload']).toContain(result.recommendation);

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('should correctly calculate levelDifference', () => {
      fc.assert(
        fc.property(habitWithLevelArb, (habit) => {
          const result = validateWorkloadLevelConsistency(habit);
          const expectedDifference = Math.abs(habit.level - result.estimatedLevelFromWorkload);

          expect(result.levelDifference).toBe(expectedDifference);

          return true;
        }),
        { numRuns: 100 }
      );
    });
  });
});
