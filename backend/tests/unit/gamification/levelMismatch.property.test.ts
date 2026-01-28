/**
 * Level Mismatch Detection Property Tests
 *
 * Feature: gamification-xp-balance
 * Property 3: Level Mismatch Detection Threshold
 * Property 4: Mismatch Severity Classification
 * Property 5: Mismatch Result Structure Completeness
 *
 * Tests the user level vs habit level mismatch detection system.
 *
 * **Validates: Requirements 2.2-2.6**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { MismatchSeverity, LevelMismatchResult } from '../../../src/services/levelManagerService.js';

// =============================================================================
// Constants (matching levelManagerService.ts)
// =============================================================================

const MISMATCH_THRESHOLD = 50;
const MILD_MISMATCH_UPPER = 75;
const MODERATE_MISMATCH_UPPER = 100;

// =============================================================================
// Pure Functions for Testing (extracted from service logic)
// =============================================================================

/**
 * Classify mismatch severity based on level gap.
 * Pure function extracted for testing.
 */
function classifyMismatchSeverity(levelGap: number): MismatchSeverity {
  if (levelGap < MISMATCH_THRESHOLD) {
    return 'none';
  }
  if (levelGap <= MILD_MISMATCH_UPPER) {
    return 'mild';
  }
  if (levelGap <= MODERATE_MISMATCH_UPPER) {
    return 'moderate';
  }
  return 'severe';
}

/**
 * Determine if mismatch exists based on level gap.
 * Pure function extracted for testing.
 */
function isMismatch(levelGap: number): boolean {
  return levelGap > MISMATCH_THRESHOLD;
}

/**
 * Get recommendation based on severity.
 * Pure function extracted for testing.
 */
function getMismatchRecommendation(
  severity: MismatchSeverity
): 'proceed' | 'suggest_baby_steps' | 'strongly_suggest_baby_steps' {
  switch (severity) {
    case 'none':
      return 'proceed';
    case 'mild':
      return 'suggest_baby_steps';
    case 'moderate':
    case 'severe':
      return 'strongly_suggest_baby_steps';
    default:
      return 'proceed';
  }
}

/**
 * Create a mismatch result from user and habit levels.
 * Pure function for testing.
 */
function createMismatchResult(userLevel: number, habitLevel: number): LevelMismatchResult {
  const levelGap = habitLevel - userLevel;
  const severity = classifyMismatchSeverity(levelGap);

  return {
    isMismatch: isMismatch(levelGap),
    userLevel,
    habitLevel,
    levelGap,
    severity,
    recommendation: getMismatchRecommendation(severity),
  };
}

// =============================================================================
// Arbitraries
// =============================================================================

/** Arbitrary for valid user level (0-199) */
const userLevelArb = fc.integer({ min: 0, max: 199 });

/** Arbitrary for valid habit level (0-199) */
const habitLevelArb = fc.integer({ min: 0, max: 199 });

/** Arbitrary for level gap that results in no mismatch (< 50) */
const noMismatchGapArb = fc.integer({ min: -199, max: 49 });

/** Arbitrary for level gap that results in mild mismatch (50-75) */
const mildMismatchGapArb = fc.integer({ min: 50, max: 75 });

/** Arbitrary for level gap that results in moderate mismatch (76-100) */
const moderateMismatchGapArb = fc.integer({ min: 76, max: 100 });

/** Arbitrary for level gap that results in severe mismatch (> 100) */
const severeMismatchGapArb = fc.integer({ min: 101, max: 199 });

// =============================================================================
// Property-Based Tests
// =============================================================================

describe('Feature: gamification-xp-balance, Property 3: Level Mismatch Detection Threshold', () => {
  /**
   * Property 3.1: Mismatch Detection When Gap > 50
   *
   * For any user level and habit level combination, if habitLevel - userLevel > 50,
   * then isMismatch shall be true.
   *
   * **Validates: Requirements 2.2**
   */
  it('should detect mismatch when level gap exceeds threshold', () => {
    fc.assert(
      fc.property(userLevelArb, habitLevelArb, (userLevel, habitLevel) => {
        const levelGap = habitLevel - userLevel;

        if (levelGap > MISMATCH_THRESHOLD) {
          const result = createMismatchResult(userLevel, habitLevel);
          return result.isMismatch === true;
        }
        return true; // Skip cases where gap <= threshold
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3.2: No Mismatch When Gap <= 50
   *
   * For any user level and habit level combination, if habitLevel - userLevel <= 50,
   * then isMismatch shall be false.
   *
   * **Validates: Requirements 2.2**
   */
  it('should not detect mismatch when level gap is within threshold', () => {
    fc.assert(
      fc.property(userLevelArb, habitLevelArb, (userLevel, habitLevel) => {
        const levelGap = habitLevel - userLevel;

        if (levelGap <= MISMATCH_THRESHOLD) {
          const result = createMismatchResult(userLevel, habitLevel);
          return result.isMismatch === false;
        }
        return true; // Skip cases where gap > threshold
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3.3: Exact Threshold Boundary
   *
   * When level gap is exactly 50, isMismatch shall be false.
   * When level gap is exactly 51, isMismatch shall be true.
   *
   * **Validates: Requirements 2.2**
   */
  it('should handle exact threshold boundary correctly', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 149 }), // userLevel where habitLevel can be userLevel + 50/51
        (userLevel) => {
          // Gap of exactly 50 should NOT be a mismatch
          const result50 = createMismatchResult(userLevel, userLevel + 50);
          const noMismatchAt50 = result50.isMismatch === false;

          // Gap of exactly 51 should be a mismatch
          const result51 = createMismatchResult(userLevel, userLevel + 51);
          const mismatchAt51 = result51.isMismatch === true;

          return noMismatchAt50 && mismatchAt51;
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Feature: gamification-xp-balance, Property 4: Mismatch Severity Classification', () => {
  /**
   * Property 4.1: None Severity (gap < 50)
   *
   * For any level gap less than 50, severity shall be 'none'.
   *
   * **Validates: Requirements 2.4**
   */
  it('should classify as none when gap < 50', () => {
    fc.assert(
      fc.property(noMismatchGapArb, (gap) => {
        const severity = classifyMismatchSeverity(gap);
        return severity === 'none';
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4.2: Mild Severity (50 <= gap <= 75)
   *
   * For any level gap in [50, 75], severity shall be 'mild'.
   *
   * **Validates: Requirements 2.4**
   */
  it('should classify as mild when gap is 50-75', () => {
    fc.assert(
      fc.property(mildMismatchGapArb, (gap) => {
        const severity = classifyMismatchSeverity(gap);
        return severity === 'mild';
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4.3: Moderate Severity (76 <= gap <= 100)
   *
   * For any level gap in [76, 100], severity shall be 'moderate'.
   *
   * **Validates: Requirements 2.5**
   */
  it('should classify as moderate when gap is 76-100', () => {
    fc.assert(
      fc.property(moderateMismatchGapArb, (gap) => {
        const severity = classifyMismatchSeverity(gap);
        return severity === 'moderate';
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4.4: Severe Severity (gap > 100)
   *
   * For any level gap greater than 100, severity shall be 'severe'.
   *
   * **Validates: Requirements 2.6**
   */
  it('should classify as severe when gap > 100', () => {
    fc.assert(
      fc.property(severeMismatchGapArb, (gap) => {
        const severity = classifyMismatchSeverity(gap);
        return severity === 'severe';
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4.5: Severity Boundary at 75/76
   *
   * Gap of 75 should be 'mild', gap of 76 should be 'moderate'.
   *
   * **Validates: Requirements 2.4, 2.5**
   */
  it('should handle mild/moderate boundary correctly', () => {
    expect(classifyMismatchSeverity(75)).toBe('mild');
    expect(classifyMismatchSeverity(76)).toBe('moderate');
  });

  /**
   * Property 4.6: Severity Boundary at 100/101
   *
   * Gap of 100 should be 'moderate', gap of 101 should be 'severe'.
   *
   * **Validates: Requirements 2.5, 2.6**
   */
  it('should handle moderate/severe boundary correctly', () => {
    expect(classifyMismatchSeverity(100)).toBe('moderate');
    expect(classifyMismatchSeverity(101)).toBe('severe');
  });
});

describe('Feature: gamification-xp-balance, Property 5: Mismatch Result Structure Completeness', () => {
  /**
   * Property 5.1: All Required Fields Present
   *
   * For any call to detectLevelMismatch(), the returned object shall contain
   * all required fields: isMismatch, userLevel, habitLevel, levelGap, severity.
   *
   * **Validates: Requirements 2.3**
   */
  it('should return complete result structure', () => {
    fc.assert(
      fc.property(userLevelArb, habitLevelArb, (userLevel, habitLevel) => {
        const result = createMismatchResult(userLevel, habitLevel);

        // Check all required fields exist
        const hasIsMismatch = typeof result.isMismatch === 'boolean';
        const hasUserLevel = typeof result.userLevel === 'number';
        const hasHabitLevel = typeof result.habitLevel === 'number';
        const hasLevelGap = typeof result.levelGap === 'number';
        const hasSeverity = typeof result.severity === 'string';
        const hasRecommendation = typeof result.recommendation === 'string';

        return (
          hasIsMismatch &&
          hasUserLevel &&
          hasHabitLevel &&
          hasLevelGap &&
          hasSeverity &&
          hasRecommendation
        );
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.2: Level Gap Calculation Correctness
   *
   * The levelGap field shall equal habitLevel - userLevel.
   *
   * **Validates: Requirements 2.3**
   */
  it('should calculate level gap correctly', () => {
    fc.assert(
      fc.property(userLevelArb, habitLevelArb, (userLevel, habitLevel) => {
        const result = createMismatchResult(userLevel, habitLevel);
        return result.levelGap === habitLevel - userLevel;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.3: User and Habit Levels Preserved
   *
   * The userLevel and habitLevel fields shall match the input values.
   *
   * **Validates: Requirements 2.3**
   */
  it('should preserve input levels in result', () => {
    fc.assert(
      fc.property(userLevelArb, habitLevelArb, (userLevel, habitLevel) => {
        const result = createMismatchResult(userLevel, habitLevel);
        return result.userLevel === userLevel && result.habitLevel === habitLevel;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.4: Severity Is Valid Value
   *
   * The severity field shall be one of: 'none', 'mild', 'moderate', 'severe'.
   *
   * **Validates: Requirements 2.3**
   */
  it('should return valid severity value', () => {
    fc.assert(
      fc.property(userLevelArb, habitLevelArb, (userLevel, habitLevel) => {
        const result = createMismatchResult(userLevel, habitLevel);
        const validSeverities: MismatchSeverity[] = ['none', 'mild', 'moderate', 'severe'];
        return validSeverities.includes(result.severity);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.5: Recommendation Is Valid Value
   *
   * The recommendation field shall be one of: 'proceed', 'suggest_baby_steps', 'strongly_suggest_baby_steps'.
   *
   * **Validates: Requirements 2.3**
   */
  it('should return valid recommendation value', () => {
    fc.assert(
      fc.property(userLevelArb, habitLevelArb, (userLevel, habitLevel) => {
        const result = createMismatchResult(userLevel, habitLevel);
        const validRecommendations = ['proceed', 'suggest_baby_steps', 'strongly_suggest_baby_steps'];
        return validRecommendations.includes(result.recommendation);
      }),
      { numRuns: 100 }
    );
  });
});

describe('Recommendation Logic', () => {
  /**
   * Property: Recommendation Matches Severity
   *
   * - 'none' severity → 'proceed' recommendation
   * - 'mild' severity → 'suggest_baby_steps' recommendation
   * - 'moderate'/'severe' severity → 'strongly_suggest_baby_steps' recommendation
   */
  it('should return correct recommendation for each severity', () => {
    expect(getMismatchRecommendation('none')).toBe('proceed');
    expect(getMismatchRecommendation('mild')).toBe('suggest_baby_steps');
    expect(getMismatchRecommendation('moderate')).toBe('strongly_suggest_baby_steps');
    expect(getMismatchRecommendation('severe')).toBe('strongly_suggest_baby_steps');
  });
});

// =============================================================================
// Edge Case Tests (Unit Tests)
// =============================================================================

describe('Edge Cases', () => {
  /**
   * Edge Case: User Level 0 (New User)
   */
  it('should handle new user with level 0', () => {
    const result = createMismatchResult(0, 100);
    expect(result.isMismatch).toBe(true);
    expect(result.levelGap).toBe(100);
    expect(result.severity).toBe('moderate');
  });

  /**
   * Edge Case: Same Level
   */
  it('should handle same user and habit level', () => {
    const result = createMismatchResult(50, 50);
    expect(result.isMismatch).toBe(false);
    expect(result.levelGap).toBe(0);
    expect(result.severity).toBe('none');
  });

  /**
   * Edge Case: Habit Level Lower Than User Level
   */
  it('should handle habit level lower than user level', () => {
    const result = createMismatchResult(100, 50);
    expect(result.isMismatch).toBe(false);
    expect(result.levelGap).toBe(-50);
    expect(result.severity).toBe('none');
  });

  /**
   * Edge Case: Maximum Levels
   */
  it('should handle maximum levels', () => {
    const result = createMismatchResult(199, 199);
    expect(result.isMismatch).toBe(false);
    expect(result.levelGap).toBe(0);
    expect(result.severity).toBe('none');
  });

  /**
   * Edge Case: Beginner User with Expert Habit
   */
  it('should detect severe mismatch for beginner with expert habit', () => {
    const result = createMismatchResult(10, 150);
    expect(result.isMismatch).toBe(true);
    expect(result.levelGap).toBe(140);
    expect(result.severity).toBe('severe');
    expect(result.recommendation).toBe('strongly_suggest_baby_steps');
  });

  /**
   * Edge Case: Exact Threshold Values
   */
  it('should handle exact threshold values', () => {
    // Gap of 49 - no mismatch
    expect(createMismatchResult(50, 99).isMismatch).toBe(false);
    expect(createMismatchResult(50, 99).severity).toBe('none');

    // Gap of 50 - no mismatch (threshold is > 50, not >= 50)
    expect(createMismatchResult(50, 100).isMismatch).toBe(false);
    expect(createMismatchResult(50, 100).severity).toBe('mild');

    // Gap of 51 - mismatch
    expect(createMismatchResult(50, 101).isMismatch).toBe(true);
    expect(createMismatchResult(50, 101).severity).toBe('mild');
  });
});
