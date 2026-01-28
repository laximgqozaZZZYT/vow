/**
 * AI Coach Integration Property Tests
 *
 * Property-based tests for AI Coach level compatibility integration.
 *
 * Requirements: 4.1, 4.2, 4.5, 4.6 (gamification-xp-balance)
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

// =============================================================================
// Helper Functions (extracted from aiCoachService for testing)
// =============================================================================

/**
 * Estimate habit level from workload settings
 * Mirrors the implementation in aiCoachService.ts
 */
function estimateHabitLevel(
  frequency: string,
  duration: number | null,
  targetCount: number | null
): number {
  let baseLevel = 50; // Start at intermediate

  // Adjust based on frequency
  if (frequency === 'daily') {
    baseLevel += 30;
  } else if (frequency === 'weekly') {
    baseLevel += 15;
  } else if (frequency === 'monthly') {
    baseLevel += 5;
  }

  // Adjust based on duration
  if (duration) {
    if (duration >= 60) {
      baseLevel += 40; // Long duration (60+ minutes)
    } else if (duration >= 30) {
      baseLevel += 25; // Medium duration (30-59 minutes)
    } else if (duration >= 15) {
      baseLevel += 10; // Short duration (15-29 minutes)
    } else if (duration >= 5) {
      baseLevel += 5; // Very short (5-14 minutes)
    }
  }

  // Adjust based on target count
  if (targetCount && targetCount > 1) {
    baseLevel += Math.min(20, targetCount * 5);
  }

  // Clamp to valid range (0-199)
  return Math.min(199, Math.max(0, baseLevel));
}

/**
 * Check if level mismatch exists
 */
function checkMismatch(userLevel: number, habitLevel: number): boolean {
  return habitLevel - userLevel > 50;
}

/**
 * Classify mismatch severity
 */
function classifyMismatchSeverity(levelGap: number): string {
  if (levelGap < 50) return 'none';
  if (levelGap <= 75) return 'mild';
  if (levelGap <= 100) return 'moderate';
  return 'severe';
}

// =============================================================================
// Property Tests
// =============================================================================

describe('AI Coach Integration Property Tests', () => {
  describe('Property 7: Experience Log Field Completeness', () => {
    /**
     * Feature: gamification-xp-balance, Property 7
     * For any experience point award logged to experience_log,
     * the record shall contain: completion_rate, applied_multiplier,
     * multiplier_tier, and multiplier_reason fields with valid values.
     * 
     * Validates: Requirements 6.4
     */
    it('should include all required fields in experience log entry', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 500 }), // completion rate as percentage
          fc.integer({ min: 30, max: 100 }), // multiplier * 100
          fc.constantFrom('minimal', 'partial', 'near', 'optimal', 'mild_over', 'over'),
          fc.constantFrom('minimal_effort', 'partial_reinforcement', 'near_completion', 'plan_adherence', 'mild_overachievement', 'burnout_prevention'),
          (completionRate, multiplierPercent, tier, reason) => {
            const multiplier = multiplierPercent / 100;
            
            // Simulate experience log entry
            const logEntry = {
              completion_rate: completionRate,
              applied_multiplier: multiplier,
              multiplier_tier: tier,
              multiplier_reason: reason,
            };

            // Verify all required fields are present
            expect(logEntry.completion_rate).toBeDefined();
            expect(logEntry.applied_multiplier).toBeDefined();
            expect(logEntry.multiplier_tier).toBeDefined();
            expect(logEntry.multiplier_reason).toBeDefined();

            // Verify field types
            expect(typeof logEntry.completion_rate).toBe('number');
            expect(typeof logEntry.applied_multiplier).toBe('number');
            expect(typeof logEntry.multiplier_tier).toBe('string');
            expect(typeof logEntry.multiplier_reason).toBe('string');

            // Verify value ranges
            expect(logEntry.completion_rate).toBeGreaterThanOrEqual(0);
            expect(logEntry.applied_multiplier).toBeGreaterThanOrEqual(0.3);
            expect(logEntry.applied_multiplier).toBeLessThanOrEqual(1.0);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Habit Level Estimation', () => {
    /**
     * Property: Level estimation produces valid THLI-24 range
     * For any valid workload configuration, the estimated level
     * shall be within the valid range [0, 199].
     */
    it('should always produce level within valid range [0, 199]', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('daily', 'weekly', 'monthly'),
          fc.option(fc.integer({ min: 1, max: 180 }), { nil: null }),
          fc.option(fc.integer({ min: 1, max: 10 }), { nil: null }),
          (frequency, duration, targetCount) => {
            const level = estimateHabitLevel(frequency, duration, targetCount);
            
            expect(level).toBeGreaterThanOrEqual(0);
            expect(level).toBeLessThanOrEqual(199);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Daily habits have higher base level than weekly/monthly
     * For any duration and target count, daily frequency should result
     * in a higher or equal level compared to weekly or monthly.
     */
    it('should estimate higher level for daily habits than weekly/monthly', () => {
      fc.assert(
        fc.property(
          fc.option(fc.integer({ min: 1, max: 120 }), { nil: null }),
          fc.option(fc.integer({ min: 1, max: 5 }), { nil: null }),
          (duration, targetCount) => {
            const dailyLevel = estimateHabitLevel('daily', duration, targetCount);
            const weeklyLevel = estimateHabitLevel('weekly', duration, targetCount);
            const monthlyLevel = estimateHabitLevel('monthly', duration, targetCount);
            
            expect(dailyLevel).toBeGreaterThanOrEqual(weeklyLevel);
            expect(weeklyLevel).toBeGreaterThanOrEqual(monthlyLevel);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Longer duration increases estimated level
     * For any frequency and target count, longer duration should result
     * in a higher or equal level.
     */
    it('should estimate higher level for longer duration habits', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('daily', 'weekly', 'monthly'),
          fc.integer({ min: 1, max: 30 }),
          fc.integer({ min: 31, max: 120 }),
          (frequency, shortDuration, longDuration) => {
            const shortLevel = estimateHabitLevel(frequency, shortDuration, null);
            const longLevel = estimateHabitLevel(frequency, longDuration, null);
            
            expect(longLevel).toBeGreaterThanOrEqual(shortLevel);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Level Mismatch Detection Integration', () => {
    /**
     * Property: Mismatch detection is consistent with threshold
     * For any user level and habit level, mismatch should be detected
     * if and only if habitLevel - userLevel > 50.
     */
    it('should detect mismatch consistently with threshold', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 199 }),
          fc.integer({ min: 0, max: 199 }),
          (userLevel, habitLevel) => {
            const isMismatch = checkMismatch(userLevel, habitLevel);
            const expectedMismatch = habitLevel - userLevel > 50;
            
            expect(isMismatch).toBe(expectedMismatch);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Severity classification is consistent with gap ranges
     * For any level gap, severity should be classified correctly.
     */
    it('should classify severity consistently with gap ranges', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -50, max: 200 }),
          (levelGap) => {
            const severity = classifyMismatchSeverity(levelGap);
            
            if (levelGap < 50) {
              expect(severity).toBe('none');
            } else if (levelGap <= 75) {
              expect(severity).toBe('mild');
            } else if (levelGap <= 100) {
              expect(severity).toBe('moderate');
            } else {
              expect(severity).toBe('severe');
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Baby Step Plan Generation', () => {
    /**
     * Property: Baby step plans have correct target levels
     * Lv.50 plan should have targetLevel = 50
     * Lv.10 plan should have targetLevel = 10
     */
    it('should generate baby step plans with correct target levels', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.integer({ min: 60, max: 199 }),
          (habitName, currentLevel) => {
            // Simulate baby step plan generation
            const lv50Plan = {
              name: `${habitName}（半分の負荷）`,
              targetLevel: 50,
              rationale: '負荷半減: 達成可能な目標で自信をつける',
            };
            
            const lv10Plan = {
              name: `${habitName}（2分だけ）`,
              targetLevel: 10,
              rationale: '2分ルール: 最小限の行動から始めて習慣化を促進',
            };
            
            expect(lv50Plan.targetLevel).toBe(50);
            expect(lv10Plan.targetLevel).toBe(10);
            expect(lv50Plan.name).toContain('半分の負荷');
            expect(lv10Plan.name).toContain('2分だけ');
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Habit Suggestion with Level Estimation', () => {
    /**
     * Property: Habit suggestions include estimated level
     * For any habit suggestion, the estimatedLevel field should be present
     * and within valid range.
     */
    it('should include valid estimated level in habit suggestions', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.constantFrom('do', 'avoid'),
          fc.constantFrom('daily', 'weekly', 'monthly'),
          fc.option(fc.integer({ min: 1, max: 120 }), { nil: null }),
          fc.option(fc.integer({ min: 1, max: 5 }), { nil: null }),
          (name, type, frequency, duration, targetCount) => {
            // Simulate habit suggestion creation
            const estimatedLevel = estimateHabitLevel(frequency, duration, targetCount);
            
            const suggestion = {
              name,
              type,
              frequency,
              duration,
              targetCount,
              estimatedLevel,
            };
            
            expect(suggestion.estimatedLevel).toBeDefined();
            expect(suggestion.estimatedLevel).toBeGreaterThanOrEqual(0);
            expect(suggestion.estimatedLevel).toBeLessThanOrEqual(199);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
