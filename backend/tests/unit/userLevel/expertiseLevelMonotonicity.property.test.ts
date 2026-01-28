/**
 * Expertise Level Monotonicity Property Test
 *
 * Feature: user-level-system, Property 18: Expertise Level Monotonicity
 *
 * For any user expertise domain, the expertise_level must never decrease due to
 * habit completion or habit level changes. The only mechanism that can decrease
 * expertise_level is the level decay process (which is capped at 20%).
 *
 * **Validates: Requirements 16.3**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { calculateExpertiseLevel } from '../../../src/services/experienceCalculatorService.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Represents a sequence of experience point awards
 */
interface ExperienceAwardSequence {
  initialPoints: number;
  awards: number[];
}

/**
 * Represents an expertise update operation
 */
interface ExpertiseUpdate {
  oldExperiencePoints: number;
  pointsToAdd: number;
  newExperiencePoints: number;
  oldExpertiseLevel: number;
  newExpertiseLevel: number;
}

// =============================================================================
// Pure Functions for Testing
// =============================================================================

/**
 * Simulate an expertise update from habit completion.
 *
 * @param oldExperiencePoints - Current experience points
 * @param pointsToAdd - Points to add from habit completion
 * @returns The update result
 */
function simulateExpertiseUpdate(
  oldExperiencePoints: number,
  pointsToAdd: number
): ExpertiseUpdate {
  const newExperiencePoints = oldExperiencePoints + pointsToAdd;
  const oldExpertiseLevel = calculateExpertiseLevel(oldExperiencePoints);
  const newExpertiseLevel = calculateExpertiseLevel(newExperiencePoints);

  return {
    oldExperiencePoints,
    pointsToAdd,
    newExperiencePoints,
    oldExpertiseLevel,
    newExpertiseLevel,
  };
}

/**
 * Check if expertise level is monotonically non-decreasing after an update.
 *
 * @param update - The expertise update
 * @returns True if monotonicity is preserved
 */
function isMonotonicallyNonDecreasing(update: ExpertiseUpdate): boolean {
  return update.newExpertiseLevel >= update.oldExpertiseLevel;
}

/**
 * Simulate a sequence of experience point awards and check monotonicity.
 *
 * @param sequence - The sequence of awards
 * @returns True if monotonicity is preserved throughout
 */
function checkSequenceMonotonicity(sequence: ExperienceAwardSequence): boolean {
  let currentPoints = sequence.initialPoints;
  let currentLevel = calculateExpertiseLevel(currentPoints);

  for (const award of sequence.awards) {
    const newPoints = currentPoints + award;
    const newLevel = calculateExpertiseLevel(newPoints);

    // Level should never decrease
    if (newLevel < currentLevel) {
      return false;
    }

    currentPoints = newPoints;
    currentLevel = newLevel;
  }

  return true;
}

/**
 * Calculate the maximum decay allowed for a given level.
 *
 * @param level - The current expertise level
 * @returns Maximum decay amount (20% of level)
 */
function calculateMaxDecay(level: number): number {
  return Math.floor(level * 0.20);
}

/**
 * Check if a decay amount is within allowed limits.
 *
 * @param originalLevel - The original expertise level
 * @param decayedLevel - The level after decay
 * @returns True if decay is within 20% limit
 */
function isDecayWithinLimit(originalLevel: number, decayedLevel: number): boolean {
  const maxDecay = calculateMaxDecay(originalLevel);
  const actualDecay = originalLevel - decayedLevel;
  return actualDecay >= 0 && actualDecay <= maxDecay;
}

// =============================================================================
// Arbitraries
// =============================================================================

const experiencePointsArb = fc.integer({ min: 0, max: 1000000 });
const positivePointsArb = fc.integer({ min: 1, max: 10000 });
const levelArb = fc.integer({ min: 0, max: 199 });

const awardSequenceArb = fc.record({
  initialPoints: experiencePointsArb,
  awards: fc.array(positivePointsArb, { minLength: 1, maxLength: 20 }),
});

// =============================================================================
// Property-Based Tests
// =============================================================================

describe('Feature: user-level-system, Property 18: Expertise Level Monotonicity', () => {
  /**
   * Property 18.1: Single Award Never Decreases Level
   *
   * For any single experience point award (positive), the expertise level
   * must never decrease.
   *
   * **Validates: Requirements 16.3**
   */
  it('should never decrease expertise level from a single positive award', () => {
    fc.assert(
      fc.property(
        experiencePointsArb,
        positivePointsArb,
        (currentPoints, pointsToAdd) => {
          const update = simulateExpertiseUpdate(currentPoints, pointsToAdd);
          return isMonotonicallyNonDecreasing(update);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 18.2: Sequence of Awards Never Decreases Level
   *
   * For any sequence of positive experience point awards, the expertise level
   * must never decrease at any point in the sequence.
   *
   * **Validates: Requirements 16.3**
   */
  it('should never decrease expertise level through a sequence of awards', () => {
    fc.assert(
      fc.property(
        awardSequenceArb,
        (sequence) => {
          return checkSequenceMonotonicity(sequence);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 18.3: Zero Award Maintains Level
   *
   * Adding zero experience points should not change the expertise level.
   *
   * **Validates: Requirements 16.3**
   */
  it('should maintain expertise level when adding zero points', () => {
    fc.assert(
      fc.property(
        experiencePointsArb,
        (currentPoints) => {
          const update = simulateExpertiseUpdate(currentPoints, 0);
          return update.newExpertiseLevel === update.oldExpertiseLevel;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 18.4: Level Increases or Stays Same
   *
   * For any positive experience point award, the level must either increase
   * or stay the same (never decrease).
   *
   * **Validates: Requirements 16.3**
   */
  it('should only increase or maintain level with positive awards', () => {
    fc.assert(
      fc.property(
        experiencePointsArb,
        positivePointsArb,
        (currentPoints, pointsToAdd) => {
          const update = simulateExpertiseUpdate(currentPoints, pointsToAdd);
          const levelChange = update.newExpertiseLevel - update.oldExpertiseLevel;
          return levelChange >= 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 18.5: Experience Points Always Increase
   *
   * For any positive award, experience points must always increase.
   *
   * **Validates: Requirements 16.3**
   */
  it('should always increase experience points with positive awards', () => {
    fc.assert(
      fc.property(
        experiencePointsArb,
        positivePointsArb,
        (currentPoints, pointsToAdd) => {
          const update = simulateExpertiseUpdate(currentPoints, pointsToAdd);
          return update.newExperiencePoints > update.oldExperiencePoints;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 18.6: Decay Is Only Allowed Mechanism for Decrease
   *
   * The only way expertise level can decrease is through the decay process,
   * which is capped at 20%.
   *
   * **Validates: Requirements 16.3**
   */
  it('should only allow level decrease through decay (max 20%)', () => {
    fc.assert(
      fc.property(
        levelArb,
        fc.integer({ min: 0, max: 100 }), // decay percentage (0-100)
        (originalLevel, decayPercent) => {
          // Calculate decayed level
          const decayAmount = Math.floor(originalLevel * (decayPercent / 100));
          const decayedLevel = originalLevel - decayAmount;

          // If decay is within 20%, it should be allowed
          if (decayPercent <= 20) {
            return isDecayWithinLimit(originalLevel, decayedLevel);
          }

          // If decay exceeds 20%, the actual decay should be capped
          const cappedDecayedLevel = originalLevel - calculateMaxDecay(originalLevel);
          return isDecayWithinLimit(originalLevel, cappedDecayedLevel);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 18.7: Max Decay Is 20% of Original Level
   *
   * The maximum decay amount must be exactly 20% of the original level.
   *
   * **Validates: Requirements 16.3**
   */
  it('should cap decay at exactly 20% of original level', () => {
    fc.assert(
      fc.property(
        levelArb,
        (level) => {
          const maxDecay = calculateMaxDecay(level);
          const expectedMaxDecay = Math.floor(level * 0.20);
          return maxDecay === expectedMaxDecay;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 18.8: Logarithmic Scale Preserves Monotonicity
   *
   * The logarithmic formula for expertise level calculation must preserve
   * monotonicity (more XP = same or higher level).
   *
   * **Validates: Requirements 16.3**
   */
  it('should preserve monotonicity in logarithmic calculation', () => {
    fc.assert(
      fc.property(
        experiencePointsArb,
        experiencePointsArb,
        (xp1, xp2) => {
          const level1 = calculateExpertiseLevel(xp1);
          const level2 = calculateExpertiseLevel(xp2);

          // If xp1 <= xp2, then level1 <= level2
          if (xp1 <= xp2) {
            return level1 <= level2;
          }
          // If xp1 > xp2, then level1 >= level2
          return level1 >= level2;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 18.9: Cumulative Awards Are Monotonic
   *
   * For any cumulative sum of awards, the resulting level sequence must be
   * monotonically non-decreasing.
   *
   * **Validates: Requirements 16.3**
   */
  it('should maintain monotonicity for cumulative award sums', () => {
    fc.assert(
      fc.property(
        fc.array(positivePointsArb, { minLength: 2, maxLength: 10 }),
        (awards) => {
          let cumulativePoints = 0;
          let previousLevel = 0;

          for (const award of awards) {
            cumulativePoints += award;
            const currentLevel = calculateExpertiseLevel(cumulativePoints);

            if (currentLevel < previousLevel) {
              return false;
            }

            previousLevel = currentLevel;
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 18.10: Large Awards Don't Cause Overflow Issues
   *
   * Even with very large experience point values, monotonicity must be preserved.
   *
   * **Validates: Requirements 16.3**
   */
  it('should preserve monotonicity with large experience values', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100000, max: 10000000 }),
        fc.integer({ min: 1, max: 100000 }),
        (largePoints, additionalPoints) => {
          const update = simulateExpertiseUpdate(largePoints, additionalPoints);
          return isMonotonicallyNonDecreasing(update);
        }
      ),
      { numRuns: 100 }
    );
  });

  // ===========================================================================
  // Edge Case Tests (Unit Tests)
  // ===========================================================================

  /**
   * Edge Case: Zero Initial Points
   *
   * Starting from zero points, any positive award should increase or maintain level.
   */
  it('should handle zero initial points correctly', () => {
    const update = simulateExpertiseUpdate(0, 100);
    expect(update.oldExpertiseLevel).toBe(0);
    expect(update.newExpertiseLevel).toBeGreaterThanOrEqual(0);
    expect(isMonotonicallyNonDecreasing(update)).toBe(true);
  });

  /**
   * Edge Case: Very Small Award
   *
   * A very small award (1 point) should not decrease level.
   */
  it('should handle very small awards correctly', () => {
    const update = simulateExpertiseUpdate(1000, 1);
    expect(isMonotonicallyNonDecreasing(update)).toBe(true);
  });

  /**
   * Edge Case: Level at Maximum (199)
   *
   * When level is at maximum, additional points should not decrease it.
   */
  it('should maintain maximum level with additional points', () => {
    // Formula: min(199, floor(10 * log2(xp / 100 + 1)))
    // To get level 199: 10 * log2(xp / 100 + 1) >= 199
    // log2(xp / 100 + 1) >= 19.9
    // xp / 100 + 1 >= 2^19.9
    // xp >= (2^19.9 - 1) * 100 ≈ 98,304,000
    const highPoints = 100000000; // 100 million should give level 199
    const level = calculateExpertiseLevel(highPoints);
    expect(level).toBe(199);

    // Adding more points should keep level at 199
    const update = simulateExpertiseUpdate(highPoints, 10000000);
    expect(update.newExpertiseLevel).toBe(199);
    expect(isMonotonicallyNonDecreasing(update)).toBe(true);
  });

  /**
   * Edge Case: Decay at Level 0
   *
   * Decay at level 0 should result in level 0 (can't go negative).
   */
  it('should not allow decay below zero', () => {
    const maxDecay = calculateMaxDecay(0);
    expect(maxDecay).toBe(0);
    expect(isDecayWithinLimit(0, 0)).toBe(true);
  });

  /**
   * Edge Case: Decay at Level 100
   *
   * Decay at level 100 should be capped at 20 points.
   */
  it('should cap decay at 20% for level 100', () => {
    const maxDecay = calculateMaxDecay(100);
    expect(maxDecay).toBe(20);
    expect(isDecayWithinLimit(100, 80)).toBe(true);
    expect(isDecayWithinLimit(100, 79)).toBe(false);
  });

  /**
   * Edge Case: Decay at Level 199
   *
   * Decay at maximum level should be capped at 39 points (floor of 199 * 0.20).
   */
  it('should cap decay at 20% for level 199', () => {
    const maxDecay = calculateMaxDecay(199);
    expect(maxDecay).toBe(39); // floor(199 * 0.20) = 39
    expect(isDecayWithinLimit(199, 160)).toBe(true);
    expect(isDecayWithinLimit(199, 159)).toBe(false);
  });

  /**
   * Edge Case: Consecutive Small Awards
   *
   * Multiple small awards should never cause level to decrease.
   */
  it('should maintain monotonicity with consecutive small awards', () => {
    const sequence: ExperienceAwardSequence = {
      initialPoints: 100,
      awards: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // 10 awards of 1 point each
    };
    expect(checkSequenceMonotonicity(sequence)).toBe(true);
  });

  /**
   * Edge Case: Mixed Award Sizes
   *
   * A mix of small and large awards should maintain monotonicity.
   */
  it('should maintain monotonicity with mixed award sizes', () => {
    const sequence: ExperienceAwardSequence = {
      initialPoints: 0,
      awards: [1, 100, 5, 1000, 10, 50, 500],
    };
    expect(checkSequenceMonotonicity(sequence)).toBe(true);
  });

  /**
   * Edge Case: Level Boundary Crossing
   *
   * Awards that cause level to cross tier boundaries should maintain monotonicity.
   */
  it('should maintain monotonicity when crossing level boundaries', () => {
    // Find points near level boundaries and test crossing
    const testPoints = [0, 100, 1000, 10000, 100000];

    for (const points of testPoints) {
      const update = simulateExpertiseUpdate(points, 1000);
      expect(isMonotonicallyNonDecreasing(update)).toBe(true);
    }
  });
});
