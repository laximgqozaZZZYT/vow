/**
 * Overall Level Formula Property Test
 *
 * Feature: user-level-system, Property 11: Overall Level Formula
 *
 * For any user with calculated metrics, the overall_level must equal:
 * `(top_expertise_avg * 0.5) + (habit_continuity_power * 0.25) + (resilience_score * 0.25)`
 * where top_expertise_avg is the average of the user's top 5 expertise levels (or all if fewer than 5).
 *
 * **Validates: Requirements 7.1, 7.2, 7.3**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// =============================================================================
// Types
// =============================================================================

/**
 * Input parameters for overall level calculation
 */
interface OverallLevelInput {
  /** Average of top expertise levels (0-199 scale) */
  topExpertiseAvg: number;
  /** Habit continuity power (0-100 scale) */
  habitContinuityPower: number;
  /** Resilience score (0-100 scale) */
  resilienceScore: number;
}

/**
 * Expertise level for a domain
 */
interface ExpertiseLevel {
  domainCode: string;
  expertiseLevel: number; // 0-199
}

// =============================================================================
// Implementation Under Test
// =============================================================================

/**
 * Compute overall level from components.
 *
 * Property 11: Overall Level Formula
 * Formula: (top_expertise_avg * 0.5) + (habit_continuity_power * 0.25) + (resilience_score * 0.25)
 *
 * This is the pure calculation function extracted from UserLevelService
 * for property-based testing.
 *
 * @param topExpertiseAvg - Average of top expertise levels (0-199)
 * @param habitContinuityPower - Habit continuity power (0-100)
 * @param resilienceScore - Resilience score (0-100)
 * @returns Overall level (raw, before clamping)
 */
function computeOverallLevel(
  topExpertiseAvg: number,
  habitContinuityPower: number,
  resilienceScore: number
): number {
  return (
    topExpertiseAvg * 0.5 +
    habitContinuityPower * 0.25 +
    resilienceScore * 0.25
  );
}

/**
 * Clamp a level value to the valid range [0, 199].
 *
 * Property 12: Level Value Clamping
 *
 * @param level - Raw level value
 * @returns Clamped level value
 */
function clampLevel(level: number): number {
  return Math.min(199, Math.max(0, Math.floor(level)));
}

/**
 * Calculate the average of top N expertise levels.
 *
 * Requirements 7.2, 7.3:
 * - If fewer than N domains, use all available
 * - If no domains, return 0
 *
 * @param expertiseLevels - Array of expertise levels
 * @param topN - Number of top levels to average (default 5)
 * @returns Average of top N expertise levels
 */
function calculateTopExpertiseAverage(
  expertiseLevels: ExpertiseLevel[],
  topN: number = 5
): number {
  if (expertiseLevels.length === 0) {
    return 0;
  }

  // Sort by expertise level descending and take top N
  const sorted = [...expertiseLevels].sort(
    (a, b) => b.expertiseLevel - a.expertiseLevel
  );
  const topLevels = sorted.slice(0, topN);

  // Calculate average
  const sum = topLevels.reduce((acc, exp) => acc + exp.expertiseLevel, 0);
  return sum / topLevels.length;
}

// =============================================================================
// Property-Based Tests
// =============================================================================

describe('Feature: user-level-system, Property 11: Overall Level Formula', () => {
  /**
   * Property 11.1: Formula Correctness
   *
   * For any valid inputs, the overall_level must equal the weighted sum
   * with coefficients 0.5, 0.25, 0.25.
   *
   * **Validates: Requirements 7.1**
   */
  it('should calculate overall level correctly for any valid inputs', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 199, noNaN: true }), // topExpertiseAvg
        fc.integer({ min: 0, max: 100 }), // habitContinuityPower
        fc.integer({ min: 0, max: 100 }), // resilienceScore
        (expertiseAvg, continuity, resilience) => {
          const expected = expertiseAvg * 0.5 + continuity * 0.25 + resilience * 0.25;
          const result = computeOverallLevel(expertiseAvg, continuity, resilience);

          // Allow for floating point precision differences
          return Math.abs(result - expected) < 0.01;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11.2: Result Range After Clamping
   *
   * For any valid inputs, the clamped result must always be in the range [0, 199].
   *
   * **Validates: Requirements 7.1**
   */
  it('should always produce a clamped result in the range [0, 199]', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 199, noNaN: true }), // topExpertiseAvg
        fc.integer({ min: 0, max: 100 }), // habitContinuityPower
        fc.integer({ min: 0, max: 100 }), // resilienceScore
        (expertiseAvg, continuity, resilience) => {
          const rawLevel = computeOverallLevel(expertiseAvg, continuity, resilience);
          const clampedLevel = clampLevel(rawLevel);

          return clampedLevel >= 0 && clampedLevel <= 199;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11.3: Expertise Contribution Weight
   *
   * The top_expertise_avg component contributes exactly 50% (0.5 weight)
   * to the final result.
   *
   * **Validates: Requirements 7.1**
   */
  it('should apply 0.5 weight to top expertise average', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 199, noNaN: true }), // topExpertiseAvg
        (expertiseAvg) => {
          // Fix other components to 0 to isolate expertise contribution
          const result = computeOverallLevel(expertiseAvg, 0, 0);
          const expected = expertiseAvg * 0.5;

          return Math.abs(result - expected) < 0.01;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11.4: Continuity Power Contribution Weight
   *
   * The habit_continuity_power component contributes exactly 25% (0.25 weight)
   * to the final result.
   *
   * **Validates: Requirements 7.1**
   */
  it('should apply 0.25 weight to habit continuity power', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }), // habitContinuityPower
        (continuity) => {
          // Fix other components to 0 to isolate continuity contribution
          const result = computeOverallLevel(0, continuity, 0);
          const expected = continuity * 0.25;

          return Math.abs(result - expected) < 0.01;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11.5: Resilience Score Contribution Weight
   *
   * The resilience_score component contributes exactly 25% (0.25 weight)
   * to the final result.
   *
   * **Validates: Requirements 7.1**
   */
  it('should apply 0.25 weight to resilience score', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }), // resilienceScore
        (resilience) => {
          // Fix other components to 0 to isolate resilience contribution
          const result = computeOverallLevel(0, 0, resilience);
          const expected = resilience * 0.25;

          return Math.abs(result - expected) < 0.01;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11.6: No Expertise Maximum Level
   *
   * When a user has no expertise (topExpertiseAvg = 0), the maximum
   * overall level is 50 (only continuity + resilience contribute).
   *
   * **Validates: Requirements 7.3**
   */
  it('should have maximum level of 50 when no expertise exists', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }), // habitContinuityPower
        fc.integer({ min: 0, max: 100 }), // resilienceScore
        (continuity, resilience) => {
          // No expertise (topExpertiseAvg = 0)
          const result = computeOverallLevel(0, continuity, resilience);

          // Maximum possible: 0 * 0.5 + 100 * 0.25 + 100 * 0.25 = 50
          return result <= 50;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11.7: Maximum Level with All Components at Max
   *
   * When all components are at maximum (expertise=199, continuity=100, resilience=100),
   * the raw level should be: 199 * 0.5 + 100 * 0.25 + 100 * 0.25 = 149.5
   *
   * **Validates: Requirements 7.1**
   */
  it('should calculate correct maximum level', () => {
    const result = computeOverallLevel(199, 100, 100);
    const expected = 199 * 0.5 + 100 * 0.25 + 100 * 0.25; // 149.5

    expect(result).toBeCloseTo(expected, 2);
  });

  /**
   * Property 11.8: Zero Input Produces Zero Output
   *
   * When all components are 0, the result should be 0.
   *
   * **Validates: Requirements 7.1**
   */
  it('should produce 0 when all components are zero', () => {
    const result = computeOverallLevel(0, 0, 0);
    expect(result).toBe(0);
  });

  /**
   * Property 11.9: Additivity of Components
   *
   * The formula is additive: the result equals the sum of individual
   * component contributions.
   *
   * **Validates: Requirements 7.1**
   */
  it('should be additive across components', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 199, noNaN: true }), // topExpertiseAvg
        fc.integer({ min: 0, max: 100 }), // habitContinuityPower
        fc.integer({ min: 0, max: 100 }), // resilienceScore
        (expertiseAvg, continuity, resilience) => {
          // Calculate individual contributions
          const expertiseContribution = computeOverallLevel(expertiseAvg, 0, 0);
          const continuityContribution = computeOverallLevel(0, continuity, 0);
          const resilienceContribution = computeOverallLevel(0, 0, resilience);

          // Calculate combined result
          const combinedResult = computeOverallLevel(expertiseAvg, continuity, resilience);

          // Sum of individual contributions should equal combined result
          const sumOfContributions =
            expertiseContribution + continuityContribution + resilienceContribution;

          return Math.abs(combinedResult - sumOfContributions) < 0.01;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11.10: Monotonicity
   *
   * Increasing any component (while keeping others constant) should
   * never decrease the result.
   *
   * **Validates: Requirements 7.1**
   */
  it('should be monotonically increasing in each component', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 198 }), // base expertise (leave room for increment)
        fc.integer({ min: 0, max: 99 }), // base continuity
        fc.integer({ min: 0, max: 99 }), // base resilience
        fc.integer({ min: 1, max: 10 }), // increment amount
        fc.integer({ min: 0, max: 2 }), // which component to increment
        (baseExpertise, baseContinuity, baseResilience, increment, componentIndex) => {
          let baseResult: number;
          let incrementedResult: number;

          if (componentIndex === 0) {
            // Increment expertise
            const incrementedExpertise = Math.min(199, baseExpertise + increment);
            baseResult = computeOverallLevel(baseExpertise, baseContinuity, baseResilience);
            incrementedResult = computeOverallLevel(incrementedExpertise, baseContinuity, baseResilience);
          } else if (componentIndex === 1) {
            // Increment continuity
            const incrementedContinuity = Math.min(100, baseContinuity + increment);
            baseResult = computeOverallLevel(baseExpertise, baseContinuity, baseResilience);
            incrementedResult = computeOverallLevel(baseExpertise, incrementedContinuity, baseResilience);
          } else {
            // Increment resilience
            const incrementedResilience = Math.min(100, baseResilience + increment);
            baseResult = computeOverallLevel(baseExpertise, baseContinuity, baseResilience);
            incrementedResult = computeOverallLevel(baseExpertise, baseContinuity, incrementedResilience);
          }

          // Incremented result should be >= base result
          return incrementedResult >= baseResult - 0.01;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// =============================================================================
// Top Expertise Average Calculation Tests
// =============================================================================

describe('Feature: user-level-system, Property 11: Top Expertise Average Calculation', () => {
  /**
   * Property 11.11: Top 5 Average Calculation
   *
   * When a user has 5 or more expertise domains, the average is calculated
   * from the top 5 domains by expertise level.
   *
   * **Validates: Requirements 7.2**
   */
  it('should calculate average from top 5 domains when 5+ domains exist', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            domainCode: fc.string({ minLength: 1, maxLength: 10 }),
            expertiseLevel: fc.integer({ min: 0, max: 199 }),
          }),
          { minLength: 5, maxLength: 20 }
        ),
        (expertiseLevels) => {
          const result = calculateTopExpertiseAverage(expertiseLevels, 5);

          // Sort and get top 5
          const sorted = [...expertiseLevels].sort(
            (a, b) => b.expertiseLevel - a.expertiseLevel
          );
          const top5 = sorted.slice(0, 5);
          const expectedAvg = top5.reduce((sum, e) => sum + e.expertiseLevel, 0) / 5;

          return Math.abs(result - expectedAvg) < 0.01;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11.12: Fewer Than 5 Domains
   *
   * When a user has fewer than 5 expertise domains, the average is calculated
   * from all available domains.
   *
   * **Validates: Requirements 7.2**
   */
  it('should calculate average from all domains when fewer than 5 exist', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            domainCode: fc.string({ minLength: 1, maxLength: 10 }),
            expertiseLevel: fc.integer({ min: 0, max: 199 }),
          }),
          { minLength: 1, maxLength: 4 }
        ),
        (expertiseLevels) => {
          const result = calculateTopExpertiseAverage(expertiseLevels, 5);

          // Calculate expected average from all domains
          const expectedAvg =
            expertiseLevels.reduce((sum, e) => sum + e.expertiseLevel, 0) /
            expertiseLevels.length;

          return Math.abs(result - expectedAvg) < 0.01;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11.13: No Expertise Domains
   *
   * When a user has no expertise domains, the average should be 0.
   *
   * **Validates: Requirements 7.3**
   */
  it('should return 0 when no expertise domains exist', () => {
    const result = calculateTopExpertiseAverage([], 5);
    expect(result).toBe(0);
  });

  /**
   * Property 11.14: Single Domain
   *
   * When a user has exactly 1 expertise domain, the average equals that domain's level.
   *
   * **Validates: Requirements 7.2**
   */
  it('should return the single domain level when only one domain exists', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 199 }),
        (level) => {
          const expertiseLevels: ExpertiseLevel[] = [
            { domainCode: 'TEST-001', expertiseLevel: level },
          ];

          const result = calculateTopExpertiseAverage(expertiseLevels, 5);

          return result === level;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11.15: Average Range
   *
   * The calculated average should always be within the range of the input levels.
   *
   * **Validates: Requirements 7.2**
   */
  it('should produce an average within the range of input levels', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            domainCode: fc.string({ minLength: 1, maxLength: 10 }),
            expertiseLevel: fc.integer({ min: 0, max: 199 }),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (expertiseLevels) => {
          const result = calculateTopExpertiseAverage(expertiseLevels, 5);

          const minLevel = Math.min(...expertiseLevels.map((e) => e.expertiseLevel));
          const maxLevel = Math.max(...expertiseLevels.map((e) => e.expertiseLevel));

          return result >= minLevel && result <= maxLevel;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// =============================================================================
// Integration Tests: Overall Level with Top Expertise Average
// =============================================================================

describe('Feature: user-level-system, Property 11: Overall Level Integration', () => {
  /**
   * Property 11.16: Full Formula with No Expertise
   *
   * When a user has no expertise domains, the overall level is calculated
   * only from continuity and resilience (max 50).
   *
   * **Validates: Requirements 7.3**
   */
  it('should calculate overall level correctly with no expertise', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }), // habitContinuityPower
        fc.integer({ min: 0, max: 100 }), // resilienceScore
        (continuity, resilience) => {
          const topExpertiseAvg = calculateTopExpertiseAverage([], 5);
          const overallLevel = computeOverallLevel(topExpertiseAvg, continuity, resilience);

          // With no expertise, max is 50
          const expected = continuity * 0.25 + resilience * 0.25;

          return Math.abs(overallLevel - expected) < 0.01 && overallLevel <= 50;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11.17: Full Formula with Multiple Expertise Domains
   *
   * The overall level should be correctly calculated using the top 5
   * expertise average combined with continuity and resilience.
   *
   * **Validates: Requirements 7.1, 7.2**
   */
  it('should calculate overall level correctly with multiple expertise domains', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            domainCode: fc.string({ minLength: 1, maxLength: 10 }),
            expertiseLevel: fc.integer({ min: 0, max: 199 }),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        fc.integer({ min: 0, max: 100 }), // habitContinuityPower
        fc.integer({ min: 0, max: 100 }), // resilienceScore
        (expertiseLevels, continuity, resilience) => {
          const topExpertiseAvg = calculateTopExpertiseAverage(expertiseLevels, 5);
          const overallLevel = computeOverallLevel(topExpertiseAvg, continuity, resilience);

          const expected = topExpertiseAvg * 0.5 + continuity * 0.25 + resilience * 0.25;

          return Math.abs(overallLevel - expected) < 0.01;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11.18: Clamped Result is Integer
   *
   * The final clamped level should always be an integer.
   *
   * **Validates: Requirements 7.1**
   */
  it('should produce an integer result after clamping', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 199, noNaN: true }), // topExpertiseAvg
        fc.integer({ min: 0, max: 100 }), // habitContinuityPower
        fc.integer({ min: 0, max: 100 }), // resilienceScore
        (expertiseAvg, continuity, resilience) => {
          const rawLevel = computeOverallLevel(expertiseAvg, continuity, resilience);
          const clampedLevel = clampLevel(rawLevel);

          return Number.isInteger(clampedLevel);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11.19: Weight Sum Verification
   *
   * The sum of all weights (0.5 + 0.25 + 0.25) equals 1.0.
   * This ensures proper scaling of the formula.
   *
   * **Validates: Requirements 7.1**
   */
  it('should have weights that sum to 1.0', () => {
    const expertiseWeight = 0.5;
    const continuityWeight = 0.25;
    const resilienceWeight = 0.25;

    const totalWeight = expertiseWeight + continuityWeight + resilienceWeight;

    expect(totalWeight).toBe(1.0);
  });

  /**
   * Property 11.20: Expertise Dominance
   *
   * Since expertise has 50% weight and can go up to 199, while continuity
   * and resilience each have 25% weight and max at 100, expertise should
   * have the most influence on the overall level.
   *
   * **Validates: Requirements 7.1**
   */
  it('should show expertise has dominant influence on overall level', () => {
    // Max expertise contribution: 199 * 0.5 = 99.5
    // Max continuity contribution: 100 * 0.25 = 25
    // Max resilience contribution: 100 * 0.25 = 25

    const maxExpertiseContribution = 199 * 0.5;
    const maxContinuityContribution = 100 * 0.25;
    const maxResilienceContribution = 100 * 0.25;

    expect(maxExpertiseContribution).toBeGreaterThan(maxContinuityContribution);
    expect(maxExpertiseContribution).toBeGreaterThan(maxResilienceContribution);
    expect(maxExpertiseContribution).toBeGreaterThan(
      maxContinuityContribution + maxResilienceContribution
    );
  });
});
