/**
 * Experience Points Calculation Property Test
 *
 * Feature: user-level-system, Property 9: Experience Points Calculation
 *
 * For any habit completion, the experience points must equal:
 * - base_xp = habit_difficulty_level * 10
 * - streak_bonus = min(streak_days * 2, 50)
 * - total_xp = base_xp + streak_bonus
 *
 * Where:
 * - habit_level defaults to 50 if NULL
 * - streak_bonus is capped at 50
 * - Result is always a positive integer
 *
 * **Validates: Requirements 6.1, 6.2, 6.3, 16.2**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { calculateExperiencePoints } from '../../../src/services/experienceCalculatorService.js';

// =============================================================================
// Constants (from design.md)
// =============================================================================

/** Default habit difficulty level when not assessed (THLI-24) */
const DEFAULT_HABIT_LEVEL = 50;

/** Multiplier for base experience points calculation */
const BASE_XP_MULTIPLIER = 10;

/** Multiplier for streak bonus calculation */
const STREAK_BONUS_MULTIPLIER = 2;

/** Maximum streak bonus that can be awarded */
const MAX_STREAK_BONUS = 50;

// =============================================================================
// Property-Based Tests
// =============================================================================

describe('Feature: user-level-system, Property 9: Experience Points Calculation', () => {
  /**
   * Property 9.1: Base XP Equals Difficulty Level * 10
   *
   * For any valid difficulty level, base XP should equal difficulty_level * 10.
   *
   * **Validates: Requirements 6.1**
   */
  it('should calculate base XP as difficulty_level * 10', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }), // difficulty level (THLI-24 scale)
        (difficultyLevel) => {
          // With 0 streak days, total XP should equal base XP
          const xp = calculateExperiencePoints(difficultyLevel, 0);
          const expectedBaseXp = difficultyLevel * BASE_XP_MULTIPLIER;
          return xp === expectedBaseXp;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9.2: Streak Bonus Equals min(streak_days * 2, 50)
   *
   * For any streak days value, streak bonus should equal min(streak_days * 2, 50).
   *
   * **Validates: Requirements 6.2**
   */
  it('should calculate streak bonus as min(streak_days * 2, 50)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }), // streak days
        (streakDays) => {
          // Use a fixed difficulty level to isolate streak bonus calculation
          const fixedDifficultyLevel = 10;
          const xp = calculateExperiencePoints(fixedDifficultyLevel, streakDays);
          const baseXp = fixedDifficultyLevel * BASE_XP_MULTIPLIER;
          const actualStreakBonus = xp - baseXp;
          const expectedStreakBonus = Math.min(streakDays * STREAK_BONUS_MULTIPLIER, MAX_STREAK_BONUS);
          return actualStreakBonus === expectedStreakBonus;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9.3: Total XP Equals Base XP + Streak Bonus
   *
   * For any combination of difficulty level and streak days,
   * total XP should equal base_xp + streak_bonus.
   *
   * **Validates: Requirements 6.3**
   */
  it('should calculate total XP as base_xp + streak_bonus', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }), // difficulty level
        fc.integer({ min: 0, max: 100 }), // streak days
        (difficultyLevel, streakDays) => {
          const xp = calculateExperiencePoints(difficultyLevel, streakDays);
          const expectedBaseXp = difficultyLevel * BASE_XP_MULTIPLIER;
          const expectedStreakBonus = Math.min(streakDays * STREAK_BONUS_MULTIPLIER, MAX_STREAK_BONUS);
          const expectedTotalXp = expectedBaseXp + expectedStreakBonus;
          return xp === expectedTotalXp;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9.4: Streak Bonus Is Capped at 50
   *
   * For any streak days value >= 25, the streak bonus should be exactly 50.
   *
   * **Validates: Requirements 6.2**
   */
  it('should cap streak bonus at 50', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 25, max: 1000 }), // streak days >= 25 (where cap kicks in)
        (streakDays) => {
          // Use a fixed difficulty level to isolate streak bonus
          const fixedDifficultyLevel = 10;
          const xp = calculateExperiencePoints(fixedDifficultyLevel, streakDays);
          const baseXp = fixedDifficultyLevel * BASE_XP_MULTIPLIER;
          const actualStreakBonus = xp - baseXp;
          return actualStreakBonus === MAX_STREAK_BONUS;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9.5: Result Is Always a Positive Integer
   *
   * For any valid inputs, the result should always be a positive integer.
   *
   * **Validates: Requirements 16.2**
   */
  it('should always return a positive integer', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer({ min: 1, max: 100 }), // valid difficulty level
          fc.constant(null) // null difficulty level (uses default)
        ),
        fc.integer({ min: 0, max: 1000 }), // streak days
        (difficultyLevel, streakDays) => {
          const xp = calculateExperiencePoints(difficultyLevel, streakDays);
          return Number.isInteger(xp) && xp > 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9.6: Default Difficulty Level (50) Is Used When Null
   *
   * When difficulty level is null, the default value of 50 should be used.
   *
   * **Validates: Requirements 6.1, 16.2**
   */
  it('should use default difficulty level (50) when null is passed', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }), // streak days
        (streakDays) => {
          const xpWithNull = calculateExperiencePoints(null, streakDays);
          const xpWithDefault = calculateExperiencePoints(DEFAULT_HABIT_LEVEL, streakDays);
          return xpWithNull === xpWithDefault;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9.7: XP Increases Monotonically with Difficulty Level
   *
   * Higher difficulty levels should result in higher or equal XP.
   *
   * **Validates: Requirements 6.1**
   */
  it('should increase XP monotonically with difficulty level', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 99 }), // lower difficulty level
        fc.integer({ min: 1, max: 100 }), // offset for higher level
        fc.integer({ min: 0, max: 100 }), // streak days (fixed for comparison)
        (lowerLevel, offset, streakDays) => {
          const higherLevel = Math.min(100, lowerLevel + offset);
          const xpLower = calculateExperiencePoints(lowerLevel, streakDays);
          const xpHigher = calculateExperiencePoints(higherLevel, streakDays);
          return xpHigher >= xpLower;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9.8: XP Increases Monotonically with Streak Days (Up to Cap)
   *
   * Higher streak days should result in higher or equal XP (until cap is reached).
   *
   * **Validates: Requirements 6.2**
   */
  it('should increase XP monotonically with streak days (up to cap)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }), // difficulty level (fixed for comparison)
        fc.integer({ min: 0, max: 99 }), // lower streak days
        fc.integer({ min: 1, max: 100 }), // offset for higher streak
        (difficultyLevel, lowerStreak, offset) => {
          const higherStreak = lowerStreak + offset;
          const xpLower = calculateExperiencePoints(difficultyLevel, lowerStreak);
          const xpHigher = calculateExperiencePoints(difficultyLevel, higherStreak);
          return xpHigher >= xpLower;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9.9: Deterministic Calculation
   *
   * The same inputs should always produce the same output.
   *
   * **Validates: Requirements 6.1, 6.2, 6.3**
   */
  it('should produce deterministic results for the same inputs', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer({ min: 1, max: 100 }),
          fc.constant(null)
        ),
        fc.integer({ min: 0, max: 100 }),
        (difficultyLevel, streakDays) => {
          const xp1 = calculateExperiencePoints(difficultyLevel, streakDays);
          const xp2 = calculateExperiencePoints(difficultyLevel, streakDays);
          const xp3 = calculateExperiencePoints(difficultyLevel, streakDays);
          return xp1 === xp2 && xp2 === xp3;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9.10: Boundary Values for Streak Bonus
   *
   * Test that streak bonus transitions correctly at the cap boundary.
   *
   * **Validates: Requirements 6.2**
   */
  it('should correctly handle streak bonus boundary values', () => {
    const fixedDifficultyLevel = 10;
    const baseXp = fixedDifficultyLevel * BASE_XP_MULTIPLIER;

    // At streak = 24, bonus should be 48 (24 * 2)
    expect(calculateExperiencePoints(fixedDifficultyLevel, 24)).toBe(baseXp + 48);

    // At streak = 25, bonus should be 50 (cap reached)
    expect(calculateExperiencePoints(fixedDifficultyLevel, 25)).toBe(baseXp + 50);

    // At streak = 26, bonus should still be 50 (capped)
    expect(calculateExperiencePoints(fixedDifficultyLevel, 26)).toBe(baseXp + 50);

    // At streak = 100, bonus should still be 50 (capped)
    expect(calculateExperiencePoints(fixedDifficultyLevel, 100)).toBe(baseXp + 50);
  });

  /**
   * Property 9.11: Zero Streak Days
   *
   * With zero streak days, XP should equal base XP only.
   *
   * **Validates: Requirements 6.1, 6.2, 6.3**
   */
  it('should return base XP only when streak days is zero', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        (difficultyLevel) => {
          const xp = calculateExperiencePoints(difficultyLevel, 0);
          const expectedBaseXp = difficultyLevel * BASE_XP_MULTIPLIER;
          return xp === expectedBaseXp;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9.12: Minimum XP Value
   *
   * The minimum XP should be achieved with difficulty level 1 and streak 0.
   *
   * **Validates: Requirements 6.1, 16.2**
   */
  it('should have minimum XP of 10 (difficulty 1, streak 0)', () => {
    const minXp = calculateExperiencePoints(1, 0);
    expect(minXp).toBe(10); // 1 * 10 + 0 = 10
  });

  /**
   * Property 9.13: Maximum XP Value
   *
   * The maximum XP should be achieved with difficulty level 100 and streak >= 25.
   *
   * **Validates: Requirements 6.1, 6.2, 6.3**
   */
  it('should have maximum XP of 1050 (difficulty 100, streak >= 25)', () => {
    const maxXp = calculateExperiencePoints(100, 25);
    expect(maxXp).toBe(1050); // 100 * 10 + 50 = 1050

    // Verify that higher streak doesn't increase XP beyond cap
    const xpWithHigherStreak = calculateExperiencePoints(100, 100);
    expect(xpWithHigherStreak).toBe(1050);
  });

  /**
   * Property 9.14: Default Level Calculation
   *
   * When null is passed, the calculation should use default level 50.
   *
   * **Validates: Requirements 6.1, 16.2**
   */
  it('should calculate correctly with default level when null is passed', () => {
    // With null difficulty and 0 streak, XP should be 500 (50 * 10)
    expect(calculateExperiencePoints(null, 0)).toBe(500);

    // With null difficulty and 10 streak, XP should be 520 (50 * 10 + 10 * 2)
    expect(calculateExperiencePoints(null, 10)).toBe(520);

    // With null difficulty and 25 streak, XP should be 550 (50 * 10 + 50)
    expect(calculateExperiencePoints(null, 25)).toBe(550);
  });
});
