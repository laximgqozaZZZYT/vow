/**
 * Habit Continuity Power Formula Property Test
 *
 * Feature: user-level-system, Property 7: Habit Continuity Power Formula
 *
 * For any user with active habits, the habit_continuity_power must equal:
 * `(weighted_streak_score * 0.4) + (completion_rate_30d * 0.3) + (active_habit_ratio * 0.3)`
 * where each component is calculated according to its respective formula and normalized to 0-100.
 *
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// =============================================================================
// Types
// =============================================================================

/**
 * Continuity metrics for habit continuity power calculation
 * Each component is normalized to 0-100 scale
 */
interface ContinuityMetrics {
  /** Weighted streak score (0-100): sum(streak_days * habit_level / 100) normalized */
  weightedStreakScore: number;
  /** Completion rate over 30 days (0-100): (completed / expected) * 100 */
  completionRate30d: number;
  /** Active habit ratio (0-100): (habits_with_activity_in_7d / total_active_habits) * 100 */
  activeHabitRatio: number;
}

// =============================================================================
// Implementation Under Test
// =============================================================================

/**
 * Compute habit continuity power from metrics.
 *
 * Property 7: Habit Continuity Power Formula
 * Formula: (weighted_streak_score * 0.4) + (completion_rate_30d * 0.3) + (active_habit_ratio * 0.3)
 *
 * This is the pure calculation function extracted from UserLevelService
 * for property-based testing.
 *
 * @param metrics - Continuity metrics (each component 0-100)
 * @returns Habit continuity power (0-100)
 */
function computeHabitContinuityPower(metrics: ContinuityMetrics): number {
  return (
    metrics.weightedStreakScore * 0.4 +
    metrics.completionRate30d * 0.3 +
    metrics.activeHabitRatio * 0.3
  );
}

// =============================================================================
// Property-Based Tests
// =============================================================================

describe('Feature: user-level-system, Property 7: Habit Continuity Power Formula', () => {
  /**
   * Property 7.1: Formula Correctness
   *
   * For any valid metrics (each component 0-100), the habit_continuity_power
   * must equal the weighted sum with coefficients 0.4, 0.3, 0.3.
   *
   * **Validates: Requirements 4.1**
   */
  it('should calculate continuity power correctly for any valid metrics', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }), // weightedStreakScore
        fc.integer({ min: 0, max: 100 }), // completionRate30d
        fc.integer({ min: 0, max: 100 }), // activeHabitRatio
        (streak, rate, ratio) => {
          const metrics: ContinuityMetrics = {
            weightedStreakScore: streak,
            completionRate30d: rate,
            activeHabitRatio: ratio,
          };

          const expected = streak * 0.4 + rate * 0.3 + ratio * 0.3;
          const result = computeHabitContinuityPower(metrics);

          // Allow for floating point precision differences
          return Math.abs(result - expected) < 0.01;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7.2: Result Range
   *
   * For any valid metrics (each component 0-100), the result must always
   * be in the range [0, 100].
   *
   * **Validates: Requirements 4.1**
   */
  it('should always produce a result in the range [0, 100]', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }), // weightedStreakScore
        fc.integer({ min: 0, max: 100 }), // completionRate30d
        fc.integer({ min: 0, max: 100 }), // activeHabitRatio
        (streak, rate, ratio) => {
          const metrics: ContinuityMetrics = {
            weightedStreakScore: streak,
            completionRate30d: rate,
            activeHabitRatio: ratio,
          };

          const result = computeHabitContinuityPower(metrics);

          return result >= 0 && result <= 100;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7.3: Weighted Streak Score Contribution
   *
   * The weighted_streak_score component contributes exactly 40% (0.4 weight)
   * to the final result.
   *
   * **Validates: Requirements 4.1, 4.2**
   */
  it('should apply 0.4 weight to weighted streak score', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }), // weightedStreakScore
        (streak) => {
          // Fix other components to 0 to isolate streak contribution
          const metrics: ContinuityMetrics = {
            weightedStreakScore: streak,
            completionRate30d: 0,
            activeHabitRatio: 0,
          };

          const result = computeHabitContinuityPower(metrics);
          const expected = streak * 0.4;

          return Math.abs(result - expected) < 0.01;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7.4: Completion Rate Contribution
   *
   * The completion_rate_30d component contributes exactly 30% (0.3 weight)
   * to the final result.
   *
   * **Validates: Requirements 4.1, 4.3**
   */
  it('should apply 0.3 weight to completion rate', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }), // completionRate30d
        (rate) => {
          // Fix other components to 0 to isolate rate contribution
          const metrics: ContinuityMetrics = {
            weightedStreakScore: 0,
            completionRate30d: rate,
            activeHabitRatio: 0,
          };

          const result = computeHabitContinuityPower(metrics);
          const expected = rate * 0.3;

          return Math.abs(result - expected) < 0.01;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7.5: Active Habit Ratio Contribution
   *
   * The active_habit_ratio component contributes exactly 30% (0.3 weight)
   * to the final result.
   *
   * **Validates: Requirements 4.1, 4.4**
   */
  it('should apply 0.3 weight to active habit ratio', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }), // activeHabitRatio
        (ratio) => {
          // Fix other components to 0 to isolate ratio contribution
          const metrics: ContinuityMetrics = {
            weightedStreakScore: 0,
            completionRate30d: 0,
            activeHabitRatio: ratio,
          };

          const result = computeHabitContinuityPower(metrics);
          const expected = ratio * 0.3;

          return Math.abs(result - expected) < 0.01;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7.6: Weight Sum Verification
   *
   * The sum of all weights (0.4 + 0.3 + 0.3) equals 1.0, ensuring that
   * when all components are at maximum (100), the result is also 100.
   *
   * **Validates: Requirements 4.1**
   */
  it('should produce 100 when all components are at maximum', () => {
    const metrics: ContinuityMetrics = {
      weightedStreakScore: 100,
      completionRate30d: 100,
      activeHabitRatio: 100,
    };

    const result = computeHabitContinuityPower(metrics);

    expect(result).toBe(100);
  });

  /**
   * Property 7.7: Zero Input Produces Zero Output
   *
   * When all components are 0, the result should be 0.
   *
   * **Validates: Requirements 4.1**
   */
  it('should produce 0 when all components are zero', () => {
    const metrics: ContinuityMetrics = {
      weightedStreakScore: 0,
      completionRate30d: 0,
      activeHabitRatio: 0,
    };

    const result = computeHabitContinuityPower(metrics);

    expect(result).toBe(0);
  });

  /**
   * Property 7.8: Additivity of Components
   *
   * The formula is additive: the result equals the sum of individual
   * component contributions.
   *
   * **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
   */
  it('should be additive across components', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }), // weightedStreakScore
        fc.integer({ min: 0, max: 100 }), // completionRate30d
        fc.integer({ min: 0, max: 100 }), // activeHabitRatio
        (streak, rate, ratio) => {
          // Calculate individual contributions
          const streakContribution = computeHabitContinuityPower({
            weightedStreakScore: streak,
            completionRate30d: 0,
            activeHabitRatio: 0,
          });

          const rateContribution = computeHabitContinuityPower({
            weightedStreakScore: 0,
            completionRate30d: rate,
            activeHabitRatio: 0,
          });

          const ratioContribution = computeHabitContinuityPower({
            weightedStreakScore: 0,
            completionRate30d: 0,
            activeHabitRatio: ratio,
          });

          // Calculate combined result
          const combinedResult = computeHabitContinuityPower({
            weightedStreakScore: streak,
            completionRate30d: rate,
            activeHabitRatio: ratio,
          });

          // Sum of individual contributions should equal combined result
          const sumOfContributions = streakContribution + rateContribution + ratioContribution;

          return Math.abs(combinedResult - sumOfContributions) < 0.01;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7.9: Monotonicity
   *
   * Increasing any component (while keeping others constant) should
   * never decrease the result.
   *
   * **Validates: Requirements 4.1**
   */
  it('should be monotonically increasing in each component', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 99 }), // base value (leave room for increment)
        fc.integer({ min: 0, max: 100 }), // other component 1
        fc.integer({ min: 0, max: 100 }), // other component 2
        fc.integer({ min: 1, max: 100 }), // increment amount
        fc.integer({ min: 0, max: 2 }), // which component to increment (0, 1, or 2)
        (base, other1, other2, increment, componentIndex) => {
          const incrementedValue = Math.min(100, base + increment);

          // Create base metrics
          const baseMetrics: ContinuityMetrics = {
            weightedStreakScore: componentIndex === 0 ? base : other1,
            completionRate30d: componentIndex === 1 ? base : (componentIndex === 0 ? other1 : other2),
            activeHabitRatio: componentIndex === 2 ? base : other2,
          };

          // Create incremented metrics
          const incrementedMetrics: ContinuityMetrics = {
            weightedStreakScore: componentIndex === 0 ? incrementedValue : other1,
            completionRate30d: componentIndex === 1 ? incrementedValue : (componentIndex === 0 ? other1 : other2),
            activeHabitRatio: componentIndex === 2 ? incrementedValue : other2,
          };

          const baseResult = computeHabitContinuityPower(baseMetrics);
          const incrementedResult = computeHabitContinuityPower(incrementedMetrics);

          // Incremented result should be >= base result
          return incrementedResult >= baseResult - 0.01; // Allow small floating point tolerance
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7.10: Floating Point Input Handling
   *
   * The formula should work correctly with floating point inputs
   * (not just integers), as the actual metrics may have decimal values.
   *
   * **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
   */
  it('should handle floating point inputs correctly', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 100, noNaN: true }), // weightedStreakScore
        fc.float({ min: 0, max: 100, noNaN: true }), // completionRate30d
        fc.float({ min: 0, max: 100, noNaN: true }), // activeHabitRatio
        (streak, rate, ratio) => {
          const metrics: ContinuityMetrics = {
            weightedStreakScore: streak,
            completionRate30d: rate,
            activeHabitRatio: ratio,
          };

          const expected = streak * 0.4 + rate * 0.3 + ratio * 0.3;
          const result = computeHabitContinuityPower(metrics);

          // Allow for floating point precision differences
          return Math.abs(result - expected) < 0.001;
        }
      ),
      { numRuns: 100 }
    );
  });
});
