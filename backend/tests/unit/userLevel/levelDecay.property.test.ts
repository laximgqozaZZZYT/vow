/**
 * Level Decay Rules Property Test
 *
 * Feature: user-level-system, Property 13: Level Decay Rules
 *
 * For any user expertise domain with no activity for more than 14 days:
 * 1. Decay begins after the 14-day grace period
 * 2. Decay rate is 1 point per week of inactivity
 * 3. Maximum decay is 20% of the original expertise_level
 * 4. Decay stops immediately when activity resumes
 *
 * **Validates: Requirements 8.1, 8.2, 8.3, 8.4**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  calculateDecay,
  GRACE_PERIOD_DAYS,
  DECAY_PER_WEEK,
  MAX_DECAY_PERCENT,
} from '../../../src/services/levelDecayService.js';

// =============================================================================
// Constants for Testing
// =============================================================================

/** Days per week */
const DAYS_PER_WEEK = 7;

/** Maximum valid expertise level */
const MAX_EXPERTISE_LEVEL = 199;

// =============================================================================
// Property-Based Tests
// =============================================================================

describe('Feature: user-level-system, Property 13: Level Decay Rules', () => {
  /**
   * Property 13.1: Decay begins after the 14-day grace period
   * **Validates: Requirement 8.1**
   *
   * For any expertise level and days of inactivity <= 14,
   * no decay should be applied.
   */
  describe('Grace Period (Requirement 8.1)', () => {
    it('should NOT apply decay within the 14-day grace period', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: MAX_EXPERTISE_LEVEL }), // expertiseLevel
          fc.integer({ min: 0, max: GRACE_PERIOD_DAYS }),   // daysSinceActivity
          (expertiseLevel, daysSinceActivity) => {
            const result = calculateDecay(expertiseLevel, daysSinceActivity);

            // Within grace period: no decay
            expect(result.shouldDecay).toBe(false);
            expect(result.decayAmount).toBe(0);
            expect(result.decayedLevel).toBe(expertiseLevel);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should start decay only after grace period ends', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: MAX_EXPERTISE_LEVEL }), // expertiseLevel
          fc.integer({ min: GRACE_PERIOD_DAYS + DAYS_PER_WEEK, max: 365 }), // daysSinceActivity (at least 1 week after grace)
          (expertiseLevel, daysSinceActivity) => {
            const result = calculateDecay(expertiseLevel, daysSinceActivity);

            // After grace period + at least 1 week: decay should apply
            // (unless max decay already reached)
            const maxDecay = Math.floor(expertiseLevel * MAX_DECAY_PERCENT);
            if (maxDecay > 0) {
              expect(result.shouldDecay).toBe(true);
              expect(result.decayAmount).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 13.2: Decay rate is 1 point per week of inactivity
   * **Validates: Requirement 8.2**
   *
   * For any expertise level and weeks of inactivity after grace period,
   * decay should be exactly (weeks * DECAY_PER_WEEK), capped at max decay.
   */
  describe('Decay Rate (Requirement 8.2)', () => {
    it('should decay at 1 point per week after grace period', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 50, max: MAX_EXPERTISE_LEVEL }), // expertiseLevel (high enough to see decay)
          fc.integer({ min: 1, max: 10 }), // weeksAfterGrace
          (expertiseLevel, weeksAfterGrace) => {
            const daysSinceActivity = GRACE_PERIOD_DAYS + (weeksAfterGrace * DAYS_PER_WEEK);
            const result = calculateDecay(expertiseLevel, daysSinceActivity);

            // Expected decay: weeks * 1 point, capped at 20%
            const rawDecay = weeksAfterGrace * DECAY_PER_WEEK;
            const maxDecay = Math.floor(expertiseLevel * MAX_DECAY_PERCENT);
            const expectedDecay = Math.min(rawDecay, maxDecay);

            expect(result.decayAmount).toBe(expectedDecay);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should calculate weeks correctly (floor division)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 50, max: MAX_EXPERTISE_LEVEL }), // expertiseLevel
          fc.integer({ min: 0, max: 6 }), // extraDays (less than a week)
          fc.integer({ min: 1, max: 5 }), // fullWeeks
          (expertiseLevel, extraDays, fullWeeks) => {
            // Days = grace + (fullWeeks * 7) + extraDays
            const daysSinceActivity = GRACE_PERIOD_DAYS + (fullWeeks * DAYS_PER_WEEK) + extraDays;
            const result = calculateDecay(expertiseLevel, daysSinceActivity);

            // Should only count full weeks
            const rawDecay = fullWeeks * DECAY_PER_WEEK;
            const maxDecay = Math.floor(expertiseLevel * MAX_DECAY_PERCENT);
            const expectedDecay = Math.min(rawDecay, maxDecay);

            expect(result.decayAmount).toBe(expectedDecay);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 13.3: Maximum decay is 20% of the original expertise_level
   * **Validates: Requirement 8.3**
   *
   * For any expertise level and any amount of inactivity,
   * decay should never exceed 20% of the original level.
   */
  describe('Maximum Decay Cap (Requirement 8.3)', () => {
    it('should never decay more than 20% of original level', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: MAX_EXPERTISE_LEVEL }), // expertiseLevel
          fc.integer({ min: 0, max: 1000 }), // daysSinceActivity (extreme values)
          (expertiseLevel, daysSinceActivity) => {
            const result = calculateDecay(expertiseLevel, daysSinceActivity);

            // Maximum allowed decay
            const maxAllowedDecay = Math.floor(expertiseLevel * MAX_DECAY_PERCENT);

            // Decay should never exceed 20%
            expect(result.decayAmount).toBeLessThanOrEqual(maxAllowedDecay);

            // Decayed level should be at least 80% of original
            const minAllowedLevel = expertiseLevel - maxAllowedDecay;
            expect(result.decayedLevel).toBeGreaterThanOrEqual(minAllowedLevel);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should cap decay at 20% even with extreme inactivity', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 10, max: MAX_EXPERTISE_LEVEL }), // expertiseLevel (enough to have meaningful 20%)
          fc.integer({ min: 365, max: 1000 }), // daysSinceActivity (very long inactivity - at least 1 year)
          (expertiseLevel, daysSinceActivity) => {
            const result = calculateDecay(expertiseLevel, daysSinceActivity);

            // With extreme inactivity (1+ year), raw decay would exceed 20%
            // so decay should be capped at exactly 20%
            const maxDecay = Math.floor(expertiseLevel * MAX_DECAY_PERCENT);
            const weeksAfterGrace = Math.floor((daysSinceActivity - GRACE_PERIOD_DAYS) / DAYS_PER_WEEK);
            const rawDecay = weeksAfterGrace * DECAY_PER_WEEK;

            // Only assert exact 20% cap when raw decay exceeds max
            if (rawDecay >= maxDecay) {
              expect(result.decayAmount).toBe(maxDecay);
              expect(result.decayedLevel).toBe(expertiseLevel - maxDecay);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 13.4: Decay stops immediately when activity resumes
   * **Validates: Requirement 8.4**
   *
   * This is implicitly tested by the grace period test - when activity
   * resumes, daysSinceActivity resets to 0, which is within grace period.
   */
  describe('Activity Resume (Requirement 8.4)', () => {
    it('should not decay when activity just resumed (0 days inactive)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: MAX_EXPERTISE_LEVEL }), // expertiseLevel
          (expertiseLevel) => {
            // Activity just resumed = 0 days since activity
            const result = calculateDecay(expertiseLevel, 0);

            expect(result.shouldDecay).toBe(false);
            expect(result.decayAmount).toBe(0);
            expect(result.decayedLevel).toBe(expertiseLevel);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional Property: Decay result consistency
   *
   * For any valid inputs, the decay calculation should be consistent:
   * - decayedLevel = currentLevel - decayAmount
   * - decayedLevel >= 0
   * - decayAmount >= 0
   */
  describe('Decay Result Consistency', () => {
    it('should maintain consistent decay calculation', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: MAX_EXPERTISE_LEVEL }), // expertiseLevel
          fc.integer({ min: 0, max: 500 }), // daysSinceActivity
          (expertiseLevel, daysSinceActivity) => {
            const result = calculateDecay(expertiseLevel, daysSinceActivity);

            // Consistency checks
            expect(result.decayAmount).toBeGreaterThanOrEqual(0);
            expect(result.decayedLevel).toBeGreaterThanOrEqual(0);
            expect(result.decayedLevel).toBe(result.currentLevel - result.decayAmount);
            expect(result.currentLevel).toBe(expertiseLevel);

            // shouldDecay should match decayAmount > 0
            expect(result.shouldDecay).toBe(result.decayAmount > 0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Edge Case: Level 0 should never decay
   */
  describe('Edge Cases', () => {
    it('should not decay level 0', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1000 }), // daysSinceActivity
          (daysSinceActivity) => {
            const result = calculateDecay(0, daysSinceActivity);

            expect(result.shouldDecay).toBe(false);
            expect(result.decayAmount).toBe(0);
            expect(result.decayedLevel).toBe(0);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle very low levels correctly', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 4 }), // Very low expertiseLevel (20% < 1)
          fc.integer({ min: GRACE_PERIOD_DAYS + DAYS_PER_WEEK, max: 100 }), // After grace period
          (expertiseLevel, daysSinceActivity) => {
            const result = calculateDecay(expertiseLevel, daysSinceActivity);

            // For levels 1-4, 20% rounds down to 0, so no decay
            const maxDecay = Math.floor(expertiseLevel * MAX_DECAY_PERCENT);
            if (maxDecay === 0) {
              expect(result.shouldDecay).toBe(false);
              expect(result.decayAmount).toBe(0);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
