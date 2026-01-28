/**
 * Expertise Level Calculation Property Test
 *
 * Feature: user-level-system, Property 10: Expertise Level Formula (Logarithmic Scale)
 *
 * For any domain with accumulated experience_points, the expertise_level must equal:
 * min(199, floor(10 * log2(experience_points / 100 + 1)))
 *
 * Properties to verify:
 * 1. Formula correctness: floor(10 * log2(xp / 100 + 1))
 * 2. Result is always in range [0, 199]
 * 3. Result is capped at 199 for very high XP values
 * 4. Result is 0 for 0 or negative XP
 * 5. Result increases monotonically with XP (logarithmic growth)
 * 6. Result is always an integer
 * 7. Specific boundary values (e.g., XP=100 → level=10)
 *
 * **Validates: Requirements 6.5**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { calculateExpertiseLevel } from '../../../src/services/experienceCalculatorService.js';

// =============================================================================
// Constants (from design.md)
// =============================================================================

/** Divisor for expertise level logarithmic calculation */
const EXPERTISE_LEVEL_DIVISOR = 100;

/** Multiplier for expertise level logarithmic calculation */
const EXPERTISE_LEVEL_MULTIPLIER = 10;

/** Maximum expertise level */
const MAX_EXPERTISE_LEVEL = 199;

/** Minimum expertise level */
const MIN_EXPERTISE_LEVEL = 0;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Reference implementation of the expertise level formula.
 * Used to verify the actual implementation matches the specification.
 *
 * Formula: min(199, floor(10 * log2(experience_points / 100 + 1)))
 */
function referenceCalculateExpertiseLevel(experiencePoints: number): number {
  if (experiencePoints <= 0) {
    return 0;
  }
  const rawLevel = Math.floor(
    EXPERTISE_LEVEL_MULTIPLIER * Math.log2(experiencePoints / EXPERTISE_LEVEL_DIVISOR + 1)
  );
  return Math.min(MAX_EXPERTISE_LEVEL, Math.max(MIN_EXPERTISE_LEVEL, rawLevel));
}

// =============================================================================
// Property-Based Tests
// =============================================================================

describe('Feature: user-level-system, Property 10: Expertise Level Formula (Logarithmic Scale)', () => {
  /**
   * Property 10.1: Formula Correctness
   *
   * For any experience points value, the expertise level must equal:
   * min(199, floor(10 * log2(experience_points / 100 + 1)))
   *
   * **Validates: Requirements 6.5**
   */
  it('should calculate expertise level correctly using the logarithmic formula', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10_000_000 }), // experience points
        (xp) => {
          const actual = calculateExpertiseLevel(xp);
          const expected = referenceCalculateExpertiseLevel(xp);
          return actual === expected;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10.2: Result Is Always in Range [0, 199]
   *
   * For any experience points value (including edge cases),
   * the result must always be within the valid range [0, 199].
   *
   * **Validates: Requirements 6.5**
   */
  it('should always return a value in range [0, 199]', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1000, max: 100_000_000 }), // include negative and very large values
        (xp) => {
          const level = calculateExpertiseLevel(xp);
          return level >= MIN_EXPERTISE_LEVEL && level <= MAX_EXPERTISE_LEVEL;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10.3: Result Is Capped at 199 for Very High XP Values
   *
   * For experience points values that would result in a level > 199,
   * the result must be capped at exactly 199.
   *
   * **Validates: Requirements 6.5**
   */
  it('should cap expertise level at 199 for very high XP values', () => {
    fc.assert(
      fc.property(
        // Generate XP values that would exceed level 199 without capping
        // Level 199 requires: floor(10 * log2(xp/100 + 1)) >= 199
        // log2(xp/100 + 1) >= 19.9
        // xp/100 + 1 >= 2^19.9 ≈ 978,619
        // xp >= 97,861,800
        fc.integer({ min: 100_000_000, max: 1_000_000_000 }),
        (xp) => {
          const level = calculateExpertiseLevel(xp);
          return level === MAX_EXPERTISE_LEVEL;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10.4: Result Is 0 for 0 or Negative XP
   *
   * For experience points values that are 0 or negative,
   * the result must be exactly 0.
   *
   * **Validates: Requirements 6.5**
   */
  it('should return 0 for 0 or negative XP values', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -10000, max: 0 }), // 0 and negative values
        (xp) => {
          const level = calculateExpertiseLevel(xp);
          return level === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10.5: Result Increases Monotonically with XP (Logarithmic Growth)
   *
   * For any two experience points values where xp1 < xp2,
   * the expertise level for xp2 must be >= the level for xp1.
   *
   * **Validates: Requirements 6.5**
   */
  it('should increase monotonically with XP (logarithmic growth)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10_000_000 }), // lower XP
        fc.integer({ min: 1, max: 10_000_000 }), // additional XP
        (xp1, additionalXp) => {
          const xp2 = xp1 + additionalXp;
          const level1 = calculateExpertiseLevel(xp1);
          const level2 = calculateExpertiseLevel(xp2);
          return level2 >= level1;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10.6: Result Is Always an Integer
   *
   * For any experience points value, the result must always be an integer.
   *
   * **Validates: Requirements 6.5**
   */
  it('should always return an integer', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100_000_000 }),
        (xp) => {
          const level = calculateExpertiseLevel(xp);
          return Number.isInteger(level);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10.7: Specific Boundary Values
   *
   * Test specific boundary values to ensure the formula is correctly implemented.
   *
   * **Validates: Requirements 6.5**
   */
  it('should calculate correct values for specific boundary cases', () => {
    // XP = 0 → level = 0
    expect(calculateExpertiseLevel(0)).toBe(0);

    // XP = 100 → level = floor(10 * log2(100/100 + 1)) = floor(10 * log2(2)) = floor(10 * 1) = 10
    expect(calculateExpertiseLevel(100)).toBe(10);

    // XP = 300 → level = floor(10 * log2(300/100 + 1)) = floor(10 * log2(4)) = floor(10 * 2) = 20
    expect(calculateExpertiseLevel(300)).toBe(20);

    // XP = 700 → level = floor(10 * log2(700/100 + 1)) = floor(10 * log2(8)) = floor(10 * 3) = 30
    expect(calculateExpertiseLevel(700)).toBe(30);

    // XP = 1500 → level = floor(10 * log2(1500/100 + 1)) = floor(10 * log2(16)) = floor(10 * 4) = 40
    expect(calculateExpertiseLevel(1500)).toBe(40);

    // XP = 3100 → level = floor(10 * log2(3100/100 + 1)) = floor(10 * log2(32)) = floor(10 * 5) = 50
    expect(calculateExpertiseLevel(3100)).toBe(50);
  });

  /**
   * Property 10.8: Deterministic Calculation
   *
   * The same input should always produce the same output.
   *
   * **Validates: Requirements 6.5**
   */
  it('should produce deterministic results for the same input', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10_000_000 }),
        (xp) => {
          const level1 = calculateExpertiseLevel(xp);
          const level2 = calculateExpertiseLevel(xp);
          const level3 = calculateExpertiseLevel(xp);
          return level1 === level2 && level2 === level3;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10.9: Level Progression Follows Logarithmic Scale
   *
   * Each level increase requires exponentially more XP (logarithmic growth).
   * Specifically, to go from level L to level L+10, XP must approximately double.
   *
   * **Validates: Requirements 6.5**
   */
  it('should follow logarithmic scale where doubling XP increases level by ~10', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 1_000_000 }), // base XP (must be > 0 for meaningful test)
        (baseXp) => {
          const doubledXp = baseXp * 2;
          const levelBase = calculateExpertiseLevel(baseXp);
          const levelDoubled = calculateExpertiseLevel(doubledXp);

          // When XP doubles, level should increase by approximately 10
          // Due to the formula: log2(2x/100 + 1) ≈ log2(x/100 + 1) + 1 (for large x)
          // So level increase ≈ 10 * 1 = 10
          // Allow some tolerance due to the +1 in the formula
          const levelIncrease = levelDoubled - levelBase;
          return levelIncrease >= 0 && levelIncrease <= 15;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10.10: Minimum XP for Each Level Tier
   *
   * Verify the minimum XP required to reach each tier boundary.
   *
   * **Validates: Requirements 6.5**
   */
  it('should require correct minimum XP for tier boundaries', () => {
    // Tier boundaries: beginner (0-49), intermediate (50-99), advanced (100-149), expert (150-199)

    // To reach level 50: floor(10 * log2(xp/100 + 1)) >= 50
    // log2(xp/100 + 1) >= 5
    // xp/100 + 1 >= 32
    // xp >= 3100
    const level49 = calculateExpertiseLevel(3099);
    const level50 = calculateExpertiseLevel(3100);
    expect(level49).toBeLessThan(50);
    expect(level50).toBe(50);

    // To reach level 100: floor(10 * log2(xp/100 + 1)) >= 100
    // log2(xp/100 + 1) >= 10
    // xp/100 + 1 >= 1024
    // xp >= 102300
    const level99 = calculateExpertiseLevel(102299);
    const level100 = calculateExpertiseLevel(102300);
    expect(level99).toBeLessThan(100);
    expect(level100).toBe(100);

    // To reach level 150: floor(10 * log2(xp/100 + 1)) >= 150
    // log2(xp/100 + 1) >= 15
    // xp/100 + 1 >= 32768
    // xp >= 3276700
    const level149 = calculateExpertiseLevel(3276699);
    const level150 = calculateExpertiseLevel(3276700);
    expect(level149).toBeLessThan(150);
    expect(level150).toBe(150);
  });

  /**
   * Property 10.11: Small XP Values
   *
   * Test behavior for small XP values (1-99).
   *
   * **Validates: Requirements 6.5**
   */
  it('should handle small XP values correctly', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 99 }),
        (xp) => {
          const level = calculateExpertiseLevel(xp);
          // For XP < 100, level should be less than 10
          // floor(10 * log2(xp/100 + 1)) where xp < 100
          // log2(xp/100 + 1) < log2(2) = 1
          // So level < 10
          return level >= 0 && level < 10;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10.12: XP = 1 Edge Case
   *
   * Test the minimum positive XP value.
   *
   * **Validates: Requirements 6.5**
   */
  it('should calculate correct level for XP = 1', () => {
    // XP = 1 → level = floor(10 * log2(1/100 + 1)) = floor(10 * log2(1.01)) ≈ floor(10 * 0.0143) = 0
    const level = calculateExpertiseLevel(1);
    expect(level).toBe(0);
  });

  /**
   * Property 10.13: Large XP Values Near Cap
   *
   * Test behavior for XP values near the level 199 cap.
   *
   * **Validates: Requirements 6.5**
   */
  it('should correctly handle XP values near the level 199 cap', () => {
    // To reach level 199: floor(10 * log2(xp/100 + 1)) >= 199
    // log2(xp/100 + 1) >= 19.9
    // xp/100 + 1 >= 2^19.9 ≈ 978619
    // xp >= 97861800

    // Just below cap
    const levelBeforeCap = calculateExpertiseLevel(97_861_700);
    expect(levelBeforeCap).toBeLessThanOrEqual(199);

    // At cap
    const levelAtCap = calculateExpertiseLevel(97_861_900);
    expect(levelAtCap).toBe(199);

    // Well above cap
    const levelAboveCap = calculateExpertiseLevel(1_000_000_000);
    expect(levelAboveCap).toBe(199);
  });

  /**
   * Property 10.14: Non-Negative Result
   *
   * The result should never be negative, even for edge cases.
   *
   * **Validates: Requirements 6.5**
   */
  it('should never return a negative value', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer({ min: -1_000_000, max: 1_000_000_000 }),
          fc.constant(0),
          fc.constant(-1),
          fc.constant(Number.MIN_SAFE_INTEGER)
        ),
        (xp) => {
          const level = calculateExpertiseLevel(xp);
          return level >= 0;
        }
      ),
      { numRuns: 100 }
    );
  });
});
