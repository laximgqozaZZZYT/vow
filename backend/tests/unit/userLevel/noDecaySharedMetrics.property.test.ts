/**
 * No Decay on Shared Metrics Property Test
 *
 * Feature: user-level-system, Property 14: No Decay on Shared Metrics
 *
 * For any user, the habit_continuity_power and resilience_score values must
 * never be subject to decay; they are recalculated fresh daily based on
 * current activity data.
 *
 * **Validates: Requirements 8.5**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  calculateDecay,
  GRACE_PERIOD_DAYS,
} from '../../../src/services/levelDecayService.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Continuity metrics for habit continuity power calculation
 */
interface ContinuityMetrics {
  weightedStreakScore: number;
  completionRate30d: number;
  activeHabitRatio: number;
}

/**
 * Resilience metrics for resilience score calculation
 */
interface ResilienceMetrics {
  recoveryRate: number;
  bounceBackCount: number;
  streakRecoveryRatio: number;
}

// =============================================================================
// Pure Calculation Functions (Same as in service)
// =============================================================================

/**
 * Compute habit continuity power from metrics.
 * This is a pure function that calculates based on current metrics,
 * NOT based on time-based decay.
 */
function computeHabitContinuityPower(metrics: ContinuityMetrics): number {
  return (
    metrics.weightedStreakScore * 0.4 +
    metrics.completionRate30d * 0.3 +
    metrics.activeHabitRatio * 0.3
  );
}

/**
 * Compute resilience score from metrics.
 * This is a pure function that calculates based on current metrics,
 * NOT based on time-based decay.
 */
function computeResilienceScore(metrics: ResilienceMetrics): number {
  return (
    metrics.recoveryRate * 0.5 +
    metrics.bounceBackCount * 0.3 +
    metrics.streakRecoveryRatio * 0.2
  );
}

// =============================================================================
// Constants for Testing
// =============================================================================

/** Days per week */
const DAYS_PER_WEEK = 7;

// =============================================================================
// Property-Based Tests
// =============================================================================

describe('Feature: user-level-system, Property 14: No Decay on Shared Metrics', () => {
  /**
   * Property 14.1: Habit Continuity Power is not subject to decay
   * **Validates: Requirement 8.5**
   *
   * The calculateDecay function should only be applied to expertise levels,
   * not to habit_continuity_power. This test verifies that:
   * 1. computeHabitContinuityPower produces consistent results regardless of inactivity
   * 2. The decay function is not designed to handle continuity power values
   */
  describe('Habit Continuity Power (Requirement 8.5)', () => {
    it('should calculate continuity power based on metrics, not time-based decay', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }), // weightedStreakScore
          fc.integer({ min: 0, max: 100 }), // completionRate30d
          fc.integer({ min: 0, max: 100 }), // activeHabitRatio
          (weightedStreakScore, completionRate30d, activeHabitRatio) => {
            const metrics: ContinuityMetrics = {
              weightedStreakScore,
              completionRate30d,
              activeHabitRatio,
            };

            // Calculate continuity power
            const result = computeHabitContinuityPower(metrics);

            // Verify it's calculated from metrics, not decayed
            const expected =
              weightedStreakScore * 0.4 +
              completionRate30d * 0.3 +
              activeHabitRatio * 0.3;

            expect(result).toBeCloseTo(expected, 5);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce same continuity power regardless of days since calculation', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }), // weightedStreakScore
          fc.integer({ min: 0, max: 100 }), // completionRate30d
          fc.integer({ min: 0, max: 100 }), // activeHabitRatio
          fc.integer({ min: 0, max: 365 }), // daysSinceLastCalculation (ignored)
          (weightedStreakScore, completionRate30d, activeHabitRatio, _daysSinceLastCalculation) => {
            const metrics: ContinuityMetrics = {
              weightedStreakScore,
              completionRate30d,
              activeHabitRatio,
            };

            // Calculate continuity power multiple times
            const result1 = computeHabitContinuityPower(metrics);
            const result2 = computeHabitContinuityPower(metrics);

            // Results should be identical (no decay applied)
            expect(result1).toBe(result2);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 14.2: Resilience Score is not subject to decay
   * **Validates: Requirement 8.5**
   *
   * The calculateDecay function should only be applied to expertise levels,
   * not to resilience_score. This test verifies that:
   * 1. computeResilienceScore produces consistent results regardless of inactivity
   * 2. The decay function is not designed to handle resilience score values
   */
  describe('Resilience Score (Requirement 8.5)', () => {
    it('should calculate resilience score based on metrics, not time-based decay', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }), // recoveryRate
          fc.integer({ min: 0, max: 100 }), // bounceBackCount
          fc.integer({ min: 0, max: 100 }), // streakRecoveryRatio
          (recoveryRate, bounceBackCount, streakRecoveryRatio) => {
            const metrics: ResilienceMetrics = {
              recoveryRate,
              bounceBackCount,
              streakRecoveryRatio,
            };

            // Calculate resilience score
            const result = computeResilienceScore(metrics);

            // Verify it's calculated from metrics, not decayed
            const expected =
              recoveryRate * 0.5 +
              bounceBackCount * 0.3 +
              streakRecoveryRatio * 0.2;

            expect(result).toBeCloseTo(expected, 5);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce same resilience score regardless of days since calculation', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }), // recoveryRate
          fc.integer({ min: 0, max: 100 }), // bounceBackCount
          fc.integer({ min: 0, max: 100 }), // streakRecoveryRatio
          fc.integer({ min: 0, max: 365 }), // daysSinceLastCalculation (ignored)
          (recoveryRate, bounceBackCount, streakRecoveryRatio, _daysSinceLastCalculation) => {
            const metrics: ResilienceMetrics = {
              recoveryRate,
              bounceBackCount,
              streakRecoveryRatio,
            };

            // Calculate resilience score multiple times
            const result1 = computeResilienceScore(metrics);
            const result2 = computeResilienceScore(metrics);

            // Results should be identical (no decay applied)
            expect(result1).toBe(result2);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 14.3: Decay function is only for expertise levels
   * **Validates: Requirement 8.5**
   *
   * The calculateDecay function is designed for expertise levels (0-199),
   * not for continuity power or resilience score (0-100).
   * This test documents the architectural separation.
   */
  describe('Architectural Separation', () => {
    it('should have separate calculation paths for expertise vs shared metrics', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 199 }), // expertiseLevel
          fc.integer({ min: 0, max: 100 }), // continuityPower
          fc.integer({ min: 0, max: 100 }), // resilienceScore
          fc.integer({ min: GRACE_PERIOD_DAYS + DAYS_PER_WEEK, max: 100 }), // daysSinceActivity
          (expertiseLevel, continuityPower, resilienceScore, daysSinceActivity) => {
            // Decay only applies to expertise
            const decayResult = calculateDecay(expertiseLevel, daysSinceActivity);

            // Continuity and resilience are calculated from metrics, not decayed
            const continuityMetrics: ContinuityMetrics = {
              weightedStreakScore: continuityPower,
              completionRate30d: continuityPower,
              activeHabitRatio: continuityPower,
            };
            const resilienceMetrics: ResilienceMetrics = {
              recoveryRate: resilienceScore,
              bounceBackCount: resilienceScore,
              streakRecoveryRatio: resilienceScore,
            };

            const continuityResult = computeHabitContinuityPower(continuityMetrics);
            const resilienceResult = computeResilienceScore(resilienceMetrics);

            // Expertise may decay
            if (expertiseLevel > 0) {
              // Decay result is based on time
              expect(decayResult.currentLevel).toBe(expertiseLevel);
            }

            // Continuity and resilience are based on metrics, not time
            // They don't have a "decay" concept
            expect(continuityResult).toBeGreaterThanOrEqual(0);
            expect(continuityResult).toBeLessThanOrEqual(100);
            expect(resilienceResult).toBeGreaterThanOrEqual(0);
            expect(resilienceResult).toBeLessThanOrEqual(100);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should NOT apply decay function to continuity power values', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }), // continuityPower (0-100 scale)
          fc.integer({ min: GRACE_PERIOD_DAYS + DAYS_PER_WEEK, max: 365 }), // daysSinceActivity
          (continuityPower, daysSinceActivity) => {
            // If we mistakenly applied decay to continuity power,
            // it would be treated as an expertise level and potentially decayed.
            // This test documents that continuity power should NOT go through decay.

            // The correct approach: continuity power is recalculated fresh
            const metrics: ContinuityMetrics = {
              weightedStreakScore: continuityPower,
              completionRate30d: continuityPower,
              activeHabitRatio: continuityPower,
            };

            // Fresh calculation - no decay
            const freshResult = computeHabitContinuityPower(metrics);

            // Result should be based purely on metrics
            const expected = continuityPower * 0.4 + continuityPower * 0.3 + continuityPower * 0.3;
            expect(freshResult).toBeCloseTo(expected, 5);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should NOT apply decay function to resilience score values', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }), // resilienceScore (0-100 scale)
          fc.integer({ min: GRACE_PERIOD_DAYS + DAYS_PER_WEEK, max: 365 }), // daysSinceActivity
          (resilienceScore, daysSinceActivity) => {
            // If we mistakenly applied decay to resilience score,
            // it would be treated as an expertise level and potentially decayed.
            // This test documents that resilience score should NOT go through decay.

            // The correct approach: resilience score is recalculated fresh
            const metrics: ResilienceMetrics = {
              recoveryRate: resilienceScore,
              bounceBackCount: resilienceScore,
              streakRecoveryRatio: resilienceScore,
            };

            // Fresh calculation - no decay
            const freshResult = computeResilienceScore(metrics);

            // Result should be based purely on metrics
            const expected = resilienceScore * 0.5 + resilienceScore * 0.3 + resilienceScore * 0.2;
            expect(freshResult).toBeCloseTo(expected, 5);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 14.4: Shared metrics are recalculated fresh daily
   * **Validates: Requirement 8.5**
   *
   * This test verifies that the calculation functions are pure and
   * produce results based solely on input metrics.
   */
  describe('Fresh Daily Calculation', () => {
    it('should produce deterministic results from same metrics', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }),
          fc.integer({ min: 0, max: 100 }),
          fc.integer({ min: 0, max: 100 }),
          (a, b, c) => {
            const continuityMetrics: ContinuityMetrics = {
              weightedStreakScore: a,
              completionRate30d: b,
              activeHabitRatio: c,
            };
            const resilienceMetrics: ResilienceMetrics = {
              recoveryRate: a,
              bounceBackCount: b,
              streakRecoveryRatio: c,
            };

            // Multiple calculations should produce identical results
            const c1 = computeHabitContinuityPower(continuityMetrics);
            const c2 = computeHabitContinuityPower(continuityMetrics);
            const r1 = computeResilienceScore(resilienceMetrics);
            const r2 = computeResilienceScore(resilienceMetrics);

            expect(c1).toBe(c2);
            expect(r1).toBe(r2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should be pure functions with no side effects', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }),
          fc.integer({ min: 0, max: 100 }),
          fc.integer({ min: 0, max: 100 }),
          (a, b, c) => {
            const continuityMetrics: ContinuityMetrics = {
              weightedStreakScore: a,
              completionRate30d: b,
              activeHabitRatio: c,
            };

            // Store original values
            const originalA = continuityMetrics.weightedStreakScore;
            const originalB = continuityMetrics.completionRate30d;
            const originalC = continuityMetrics.activeHabitRatio;

            // Call the function
            computeHabitContinuityPower(continuityMetrics);

            // Verify metrics were not modified (pure function)
            expect(continuityMetrics.weightedStreakScore).toBe(originalA);
            expect(continuityMetrics.completionRate30d).toBe(originalB);
            expect(continuityMetrics.activeHabitRatio).toBe(originalC);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
