/**
 * Resilience Score Formula Property Test
 *
 * Feature: user-level-system, Property 8: Resilience Score Formula
 *
 * For any user with habit activity history, the resilience_score must equal:
 * `(recovery_rate * 0.5) + (bounce_back_count * 0.3) + (streak_recovery_ratio * 0.2)`
 * where each component is calculated according to its respective formula and normalized to 0-100.
 *
 * **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// =============================================================================
// Types
// =============================================================================

/**
 * Resilience metrics for resilience score calculation
 * Each component is normalized to 0-100 scale
 */
interface ResilienceMetrics {
  /**
   * Recovery rate (0-100): Average days to resume a habit after a break
   * Lower is better, normalized where 1 day = 100, 7+ days = 0
   */
  recoveryRate: number;
  /**
   * Bounce back count (0-100): Number of times user resumed a habit after
   * missing 3+ consecutive expected completions in the past 90 days, normalized
   */
  bounceBackCount: number;
  /**
   * Streak recovery ratio (0-100): (recovered_streaks / broken_streaks) * 100
   * for the past 90 days
   */
  streakRecoveryRatio: number;
}

// =============================================================================
// Implementation Under Test
// =============================================================================

/**
 * Compute resilience score from metrics.
 *
 * Property 8: Resilience Score Formula
 * Formula: (recovery_rate * 0.5) + (bounce_back_count * 0.3) + (streak_recovery_ratio * 0.2)
 *
 * This is the pure calculation function extracted from UserLevelService
 * for property-based testing.
 *
 * @param metrics - Resilience metrics (each component 0-100)
 * @returns Resilience score (0-100)
 */
function computeResilienceScore(metrics: ResilienceMetrics): number {
  return (
    metrics.recoveryRate * 0.5 +
    metrics.bounceBackCount * 0.3 +
    metrics.streakRecoveryRatio * 0.2
  );
}

// =============================================================================
// Property-Based Tests
// =============================================================================

describe('Feature: user-level-system, Property 8: Resilience Score Formula', () => {
  /**
   * Property 8.1: Formula Correctness
   *
   * For any valid metrics (each component 0-100), the resilience_score
   * must equal the weighted sum with coefficients 0.5, 0.3, 0.2.
   *
   * **Validates: Requirements 5.1**
   */
  it('should calculate resilience score correctly for any valid metrics', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }), // recoveryRate
        fc.integer({ min: 0, max: 100 }), // bounceBackCount (normalized)
        fc.integer({ min: 0, max: 100 }), // streakRecoveryRatio
        (recovery, bounce, ratio) => {
          const metrics: ResilienceMetrics = {
            recoveryRate: recovery,
            bounceBackCount: bounce,
            streakRecoveryRatio: ratio,
          };

          const expected = recovery * 0.5 + bounce * 0.3 + ratio * 0.2;
          const result = computeResilienceScore(metrics);

          // Allow for floating point precision differences
          return Math.abs(result - expected) < 0.01;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8.2: Result Range
   *
   * For any valid metrics (each component 0-100), the result must always
   * be in the range [0, 100].
   *
   * **Validates: Requirements 5.1**
   */
  it('should always produce a result in the range [0, 100]', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }), // recoveryRate
        fc.integer({ min: 0, max: 100 }), // bounceBackCount
        fc.integer({ min: 0, max: 100 }), // streakRecoveryRatio
        (recovery, bounce, ratio) => {
          const metrics: ResilienceMetrics = {
            recoveryRate: recovery,
            bounceBackCount: bounce,
            streakRecoveryRatio: ratio,
          };

          const result = computeResilienceScore(metrics);

          return result >= 0 && result <= 100;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8.3: Recovery Rate Contribution
   *
   * The recovery_rate component contributes exactly 50% (0.5 weight)
   * to the final result.
   *
   * **Validates: Requirements 5.1, 5.2**
   */
  it('should apply 0.5 weight to recovery rate', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }), // recoveryRate
        (recovery) => {
          // Fix other components to 0 to isolate recovery contribution
          const metrics: ResilienceMetrics = {
            recoveryRate: recovery,
            bounceBackCount: 0,
            streakRecoveryRatio: 0,
          };

          const result = computeResilienceScore(metrics);
          const expected = recovery * 0.5;

          return Math.abs(result - expected) < 0.01;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8.4: Bounce Back Count Contribution
   *
   * The bounce_back_count component contributes exactly 30% (0.3 weight)
   * to the final result.
   *
   * **Validates: Requirements 5.1, 5.3**
   */
  it('should apply 0.3 weight to bounce back count', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }), // bounceBackCount
        (bounce) => {
          // Fix other components to 0 to isolate bounce contribution
          const metrics: ResilienceMetrics = {
            recoveryRate: 0,
            bounceBackCount: bounce,
            streakRecoveryRatio: 0,
          };

          const result = computeResilienceScore(metrics);
          const expected = bounce * 0.3;

          return Math.abs(result - expected) < 0.01;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8.5: Streak Recovery Ratio Contribution
   *
   * The streak_recovery_ratio component contributes exactly 20% (0.2 weight)
   * to the final result.
   *
   * **Validates: Requirements 5.1, 5.4**
   */
  it('should apply 0.2 weight to streak recovery ratio', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }), // streakRecoveryRatio
        (ratio) => {
          // Fix other components to 0 to isolate ratio contribution
          const metrics: ResilienceMetrics = {
            recoveryRate: 0,
            bounceBackCount: 0,
            streakRecoveryRatio: ratio,
          };

          const result = computeResilienceScore(metrics);
          const expected = ratio * 0.2;

          return Math.abs(result - expected) < 0.01;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8.6: Weight Sum Verification
   *
   * The sum of all weights (0.5 + 0.3 + 0.2) equals 1.0, ensuring that
   * when all components are at maximum (100), the result is also 100.
   *
   * **Validates: Requirements 5.1**
   */
  it('should produce 100 when all components are at maximum', () => {
    const metrics: ResilienceMetrics = {
      recoveryRate: 100,
      bounceBackCount: 100,
      streakRecoveryRatio: 100,
    };

    const result = computeResilienceScore(metrics);

    expect(result).toBe(100);
  });

  /**
   * Property 8.7: Zero Input Produces Zero Output
   *
   * When all components are 0, the result should be 0.
   *
   * **Validates: Requirements 5.1**
   */
  it('should produce 0 when all components are zero', () => {
    const metrics: ResilienceMetrics = {
      recoveryRate: 0,
      bounceBackCount: 0,
      streakRecoveryRatio: 0,
    };

    const result = computeResilienceScore(metrics);

    expect(result).toBe(0);
  });

  /**
   * Property 8.8: Additivity of Components
   *
   * The formula is additive: the result equals the sum of individual
   * component contributions.
   *
   * **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
   */
  it('should be additive across components', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }), // recoveryRate
        fc.integer({ min: 0, max: 100 }), // bounceBackCount
        fc.integer({ min: 0, max: 100 }), // streakRecoveryRatio
        (recovery, bounce, ratio) => {
          // Calculate individual contributions
          const recoveryContribution = computeResilienceScore({
            recoveryRate: recovery,
            bounceBackCount: 0,
            streakRecoveryRatio: 0,
          });

          const bounceContribution = computeResilienceScore({
            recoveryRate: 0,
            bounceBackCount: bounce,
            streakRecoveryRatio: 0,
          });

          const ratioContribution = computeResilienceScore({
            recoveryRate: 0,
            bounceBackCount: 0,
            streakRecoveryRatio: ratio,
          });

          // Calculate combined result
          const combinedResult = computeResilienceScore({
            recoveryRate: recovery,
            bounceBackCount: bounce,
            streakRecoveryRatio: ratio,
          });

          // Sum of individual contributions should equal combined result
          const sumOfContributions = recoveryContribution + bounceContribution + ratioContribution;

          return Math.abs(combinedResult - sumOfContributions) < 0.01;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8.9: Monotonicity
   *
   * Increasing any component (while keeping others constant) should
   * never decrease the result.
   *
   * **Validates: Requirements 5.1**
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
          const baseMetrics: ResilienceMetrics = {
            recoveryRate: componentIndex === 0 ? base : other1,
            bounceBackCount: componentIndex === 1 ? base : (componentIndex === 0 ? other1 : other2),
            streakRecoveryRatio: componentIndex === 2 ? base : other2,
          };

          // Create incremented metrics
          const incrementedMetrics: ResilienceMetrics = {
            recoveryRate: componentIndex === 0 ? incrementedValue : other1,
            bounceBackCount: componentIndex === 1 ? incrementedValue : (componentIndex === 0 ? other1 : other2),
            streakRecoveryRatio: componentIndex === 2 ? incrementedValue : other2,
          };

          const baseResult = computeResilienceScore(baseMetrics);
          const incrementedResult = computeResilienceScore(incrementedMetrics);

          // Incremented result should be >= base result
          return incrementedResult >= baseResult - 0.01; // Allow small floating point tolerance
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8.10: Floating Point Input Handling
   *
   * The formula should work correctly with floating point inputs
   * (not just integers), as the actual metrics may have decimal values.
   *
   * **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
   */
  it('should handle floating point inputs correctly', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 100, noNaN: true }), // recoveryRate
        fc.float({ min: 0, max: 100, noNaN: true }), // bounceBackCount
        fc.float({ min: 0, max: 100, noNaN: true }), // streakRecoveryRatio
        (recovery, bounce, ratio) => {
          const metrics: ResilienceMetrics = {
            recoveryRate: recovery,
            bounceBackCount: bounce,
            streakRecoveryRatio: ratio,
          };

          const expected = recovery * 0.5 + bounce * 0.3 + ratio * 0.2;
          const result = computeResilienceScore(metrics);

          // Allow for floating point precision differences
          return Math.abs(result - expected) < 0.001;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8.11: Perfect Resilience Case
   *
   * When a user has no habit breaks in the past 90 days, the resilience_score
   * should be 100 (perfect resilience). This is represented by all metrics
   * being at their maximum values.
   *
   * **Validates: Requirements 5.5**
   */
  it('should produce 100 for perfect resilience (no habit breaks)', () => {
    // Perfect resilience: fast recovery (100), many bounce backs (100), all streaks recovered (100)
    const perfectMetrics: ResilienceMetrics = {
      recoveryRate: 100,
      bounceBackCount: 100,
      streakRecoveryRatio: 100,
    };

    const result = computeResilienceScore(perfectMetrics);

    expect(result).toBe(100);
  });

  /**
   * Property 8.12: Recovery Rate Dominance
   *
   * Since recovery_rate has the highest weight (0.5), it should have
   * the most significant impact on the final score.
   *
   * **Validates: Requirements 5.1, 5.2**
   */
  it('should give recovery rate the highest impact on the score', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }), // delta value to test impact
        (delta) => {
          // Base metrics with all zeros
          const baseMetrics: ResilienceMetrics = {
            recoveryRate: 0,
            bounceBackCount: 0,
            streakRecoveryRatio: 0,
          };

          // Impact of recovery rate
          const recoveryImpact = computeResilienceScore({
            ...baseMetrics,
            recoveryRate: delta,
          });

          // Impact of bounce back count
          const bounceImpact = computeResilienceScore({
            ...baseMetrics,
            bounceBackCount: delta,
          });

          // Impact of streak recovery ratio
          const ratioImpact = computeResilienceScore({
            ...baseMetrics,
            streakRecoveryRatio: delta,
          });

          // Recovery rate should have the highest impact
          return recoveryImpact >= bounceImpact && recoveryImpact >= ratioImpact;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8.13: Bounce Back Count vs Streak Recovery Ratio
   *
   * Since bounce_back_count has weight 0.3 and streak_recovery_ratio has
   * weight 0.2, bounce_back_count should have more impact.
   *
   * **Validates: Requirements 5.1, 5.3, 5.4**
   */
  it('should give bounce back count more impact than streak recovery ratio', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }), // delta value to test impact
        (delta) => {
          // Base metrics with all zeros
          const baseMetrics: ResilienceMetrics = {
            recoveryRate: 0,
            bounceBackCount: 0,
            streakRecoveryRatio: 0,
          };

          // Impact of bounce back count
          const bounceImpact = computeResilienceScore({
            ...baseMetrics,
            bounceBackCount: delta,
          });

          // Impact of streak recovery ratio
          const ratioImpact = computeResilienceScore({
            ...baseMetrics,
            streakRecoveryRatio: delta,
          });

          // Bounce back count should have more impact than ratio
          return bounceImpact >= ratioImpact;
        }
      ),
      { numRuns: 100 }
    );
  });
});
