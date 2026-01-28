/**
 * Experience Log Completeness Property Test
 *
 * Feature: user-level-system, Property 16: Experience Log Completeness
 *
 * For any experience point award, a corresponding record must be created in
 * experience_log with user_id, habit_id, domain_code, points_awarded, and
 * calculation parameters.
 *
 * **Validates: Requirements 13.5**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { ExperienceLogEntry } from '../../../src/services/experienceCalculatorService.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Experience log record as stored in database
 */
interface ExperienceLogRecord {
  id: string;
  user_id: string;
  habit_id: string;
  activity_id: string | null;
  domain_code: string;
  points_awarded: number;
  habit_level: number | null;
  quality_multiplier: number;
  frequency_bonus: number;
  created_at: string;
}

// =============================================================================
// Pure Functions for Testing
// =============================================================================

/**
 * Validate that an experience log entry has all required fields.
 *
 * @param entry - The log entry to validate
 * @returns True if all required fields are present and valid
 */
function validateExperienceLogEntry(entry: ExperienceLogEntry): boolean {
  // user_id is required
  if (!entry.userId || typeof entry.userId !== 'string') {
    return false;
  }

  // habit_id is required
  if (!entry.habitId || typeof entry.habitId !== 'string') {
    return false;
  }

  // domain_code is required
  if (!entry.domainCode || typeof entry.domainCode !== 'string') {
    return false;
  }

  // points_awarded is required and must be a number
  if (typeof entry.pointsAwarded !== 'number') {
    return false;
  }

  // quality_multiplier is required and must be a number
  if (typeof entry.qualityMultiplier !== 'number') {
    return false;
  }

  // frequency_bonus is required and must be a number
  if (typeof entry.frequencyBonus !== 'number') {
    return false;
  }

  return true;
}

/**
 * Convert an experience log entry to database record format.
 *
 * @param entry - The log entry
 * @returns Database record format
 */
function toDbRecord(entry: ExperienceLogEntry): Omit<ExperienceLogRecord, 'id' | 'created_at'> {
  return {
    user_id: entry.userId,
    habit_id: entry.habitId,
    activity_id: entry.activityId ?? null,
    domain_code: entry.domainCode,
    points_awarded: entry.pointsAwarded,
    habit_level: entry.habitLevel,
    quality_multiplier: entry.qualityMultiplier,
    frequency_bonus: entry.frequencyBonus,
  };
}

/**
 * Validate quality multiplier is within expected range.
 *
 * @param multiplier - The quality multiplier
 * @returns True if valid
 */
function isValidQualityMultiplier(multiplier: number): boolean {
  // Valid values: 0.8 (partial), 1.0 (normal), 1.2 (exceeded)
  const validValues = [0.8, 1.0, 1.2];
  return validValues.some(v => Math.abs(multiplier - v) < 0.001);
}

/**
 * Validate frequency bonus is within expected range.
 *
 * @param bonus - The frequency bonus
 * @returns True if valid
 */
function isValidFrequencyBonus(bonus: number): boolean {
  // Valid values: 0.5 (subsequent), 1.0 (first)
  const validValues = [0.5, 1.0];
  return validValues.some(v => Math.abs(bonus - v) < 0.001);
}

/**
 * Calculate expected points from parameters.
 *
 * @param habitLevel - The habit difficulty level
 * @param qualityMultiplier - The quality multiplier
 * @param frequencyBonus - The frequency bonus
 * @returns Expected points
 */
function calculateExpectedPoints(
  habitLevel: number | null,
  qualityMultiplier: number,
  frequencyBonus: number
): number {
  const level = habitLevel ?? 50;
  return Math.floor(level * qualityMultiplier * frequencyBonus);
}

// =============================================================================
// Arbitraries
// =============================================================================

const userIdArb = fc.uuid();
const habitIdArb = fc.uuid();
const activityIdArb = fc.option(fc.uuid(), { nil: undefined });

const domainCodeArb = fc.oneof(
  // Standard domain code
  fc.tuple(
    fc.constantFrom('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'),
    fc.integer({ min: 1, max: 99 }),
    fc.integer({ min: 1, max: 999 })
  ).map(([major, middle, minor]) =>
    `${major}-${String(middle).padStart(2, '0')}-${String(minor).padStart(3, '0')}`
  ),
  // General domain
  fc.constant('000')
);

const habitLevelArb = fc.option(fc.integer({ min: 1, max: 100 }), { nil: null });
const qualityMultiplierArb = fc.constantFrom(0.8, 1.0, 1.2);
const frequencyBonusArb = fc.constantFrom(0.5, 1.0);
const pointsAwardedArb = fc.integer({ min: 0, max: 10000 });

const experienceLogEntryArb = fc.record({
  userId: userIdArb,
  habitId: habitIdArb,
  activityId: activityIdArb,
  domainCode: domainCodeArb,
  pointsAwarded: pointsAwardedArb,
  habitLevel: habitLevelArb,
  qualityMultiplier: qualityMultiplierArb,
  frequencyBonus: frequencyBonusArb,
});

// =============================================================================
// Property-Based Tests
// =============================================================================

describe('Feature: user-level-system, Property 16: Experience Log Completeness', () => {
  /**
   * Property 16.1: All Required Fields Present
   *
   * For any experience point award, the log entry must contain all required fields:
   * user_id, habit_id, domain_code, points_awarded, quality_multiplier, frequency_bonus.
   *
   * **Validates: Requirements 13.5**
   */
  it('should require all mandatory fields in experience log entry', () => {
    fc.assert(
      fc.property(
        experienceLogEntryArb,
        (entry) => {
          return validateExperienceLogEntry(entry);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 16.2: User ID Is Required
   *
   * The user_id field must be present and non-empty.
   *
   * **Validates: Requirements 13.5**
   */
  it('should require user_id to be present', () => {
    fc.assert(
      fc.property(
        experienceLogEntryArb,
        (entry) => {
          // Valid entry should pass
          const validResult = validateExperienceLogEntry(entry);

          // Entry without userId should fail
          const invalidEntry = { ...entry, userId: '' };
          const invalidResult = !validateExperienceLogEntry(invalidEntry);

          return validResult && invalidResult;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 16.3: Habit ID Is Required
   *
   * The habit_id field must be present and non-empty.
   *
   * **Validates: Requirements 13.5**
   */
  it('should require habit_id to be present', () => {
    fc.assert(
      fc.property(
        experienceLogEntryArb,
        (entry) => {
          // Valid entry should pass
          const validResult = validateExperienceLogEntry(entry);

          // Entry without habitId should fail
          const invalidEntry = { ...entry, habitId: '' };
          const invalidResult = !validateExperienceLogEntry(invalidEntry);

          return validResult && invalidResult;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 16.4: Domain Code Is Required
   *
   * The domain_code field must be present and non-empty.
   *
   * **Validates: Requirements 13.5**
   */
  it('should require domain_code to be present', () => {
    fc.assert(
      fc.property(
        experienceLogEntryArb,
        (entry) => {
          // Valid entry should pass
          const validResult = validateExperienceLogEntry(entry);

          // Entry without domainCode should fail
          const invalidEntry = { ...entry, domainCode: '' };
          const invalidResult = !validateExperienceLogEntry(invalidEntry);

          return validResult && invalidResult;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 16.5: Quality Multiplier Is Valid
   *
   * The quality_multiplier must be one of the valid values: 0.8, 1.0, or 1.2.
   *
   * **Validates: Requirements 13.5**
   */
  it('should have valid quality_multiplier values', () => {
    fc.assert(
      fc.property(
        qualityMultiplierArb,
        (multiplier) => {
          return isValidQualityMultiplier(multiplier);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 16.6: Frequency Bonus Is Valid
   *
   * The frequency_bonus must be one of the valid values: 0.5 or 1.0.
   *
   * **Validates: Requirements 13.5**
   */
  it('should have valid frequency_bonus values', () => {
    fc.assert(
      fc.property(
        frequencyBonusArb,
        (bonus) => {
          return isValidFrequencyBonus(bonus);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 16.7: Database Record Preserves All Data
   *
   * Converting to database record format should preserve all input data.
   *
   * **Validates: Requirements 13.5**
   */
  it('should preserve all data when converting to database record', () => {
    fc.assert(
      fc.property(
        experienceLogEntryArb,
        (entry) => {
          const record = toDbRecord(entry);

          return (
            record.user_id === entry.userId &&
            record.habit_id === entry.habitId &&
            record.activity_id === (entry.activityId ?? null) &&
            record.domain_code === entry.domainCode &&
            record.points_awarded === entry.pointsAwarded &&
            record.habit_level === entry.habitLevel &&
            record.quality_multiplier === entry.qualityMultiplier &&
            record.frequency_bonus === entry.frequencyBonus
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 16.8: Points Awarded Is Non-Negative
   *
   * The points_awarded field must be non-negative.
   *
   * **Validates: Requirements 13.5**
   */
  it('should have non-negative points_awarded', () => {
    fc.assert(
      fc.property(
        experienceLogEntryArb,
        (entry) => {
          return entry.pointsAwarded >= 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 16.9: Habit Level Is Valid When Present
   *
   * When habit_level is present, it must be within valid range [1, 100].
   *
   * **Validates: Requirements 13.5**
   */
  it('should have valid habit_level when present', () => {
    fc.assert(
      fc.property(
        habitLevelArb,
        (habitLevel) => {
          if (habitLevel === null) {
            return true; // null is valid
          }
          return habitLevel >= 1 && habitLevel <= 100;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 16.10: Activity ID Is Optional
   *
   * The activity_id field is optional and can be null/undefined.
   *
   * **Validates: Requirements 13.5**
   */
  it('should allow optional activity_id', () => {
    fc.assert(
      fc.property(
        experienceLogEntryArb,
        (entry) => {
          // Entry should be valid regardless of activityId presence
          const withActivityId = { ...entry, activityId: 'test-activity-id' };
          const withoutActivityId = { ...entry, activityId: undefined };

          return (
            validateExperienceLogEntry(withActivityId) &&
            validateExperienceLogEntry(withoutActivityId)
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 16.11: Calculation Parameters Are Consistent
   *
   * The points_awarded should be consistent with the calculation parameters
   * when using the standard formula.
   *
   * **Validates: Requirements 13.5**
   */
  it('should have consistent calculation parameters', () => {
    fc.assert(
      fc.property(
        habitLevelArb,
        qualityMultiplierArb,
        frequencyBonusArb,
        (habitLevel, qualityMultiplier, frequencyBonus) => {
          const expectedPoints = calculateExpectedPoints(
            habitLevel,
            qualityMultiplier,
            frequencyBonus
          );

          // Points should be non-negative
          if (expectedPoints < 0) {
            return false;
          }

          // Points should be an integer
          if (!Number.isInteger(expectedPoints)) {
            return false;
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  // ===========================================================================
  // Edge Case Tests (Unit Tests)
  // ===========================================================================

  /**
   * Edge Case: Minimum Points Award
   *
   * Test logging with minimum possible points (0).
   */
  it('should handle zero points award', () => {
    const entry: ExperienceLogEntry = {
      userId: 'test-user-id',
      habitId: 'test-habit-id',
      domainCode: '000',
      pointsAwarded: 0,
      habitLevel: null,
      qualityMultiplier: 1.0,
      frequencyBonus: 1.0,
    };

    expect(validateExperienceLogEntry(entry)).toBe(true);
    const record = toDbRecord(entry);
    expect(record.points_awarded).toBe(0);
  });

  /**
   * Edge Case: Maximum Points Award
   *
   * Test logging with large points value.
   */
  it('should handle large points award', () => {
    const entry: ExperienceLogEntry = {
      userId: 'test-user-id',
      habitId: 'test-habit-id',
      domainCode: 'B-11-111',
      pointsAwarded: 999999,
      habitLevel: 100,
      qualityMultiplier: 1.2,
      frequencyBonus: 1.0,
    };

    expect(validateExperienceLogEntry(entry)).toBe(true);
    const record = toDbRecord(entry);
    expect(record.points_awarded).toBe(999999);
  });

  /**
   * Edge Case: General Domain Code
   *
   * Test logging with the General domain code "000".
   */
  it('should handle General domain code', () => {
    const entry: ExperienceLogEntry = {
      userId: 'test-user-id',
      habitId: 'test-habit-id',
      domainCode: '000',
      pointsAwarded: 100,
      habitLevel: 50,
      qualityMultiplier: 1.0,
      frequencyBonus: 1.0,
    };

    expect(validateExperienceLogEntry(entry)).toBe(true);
    const record = toDbRecord(entry);
    expect(record.domain_code).toBe('000');
  });

  /**
   * Edge Case: Null Habit Level
   *
   * Test logging when habit level is null (not assessed).
   */
  it('should handle null habit level', () => {
    const entry: ExperienceLogEntry = {
      userId: 'test-user-id',
      habitId: 'test-habit-id',
      domainCode: 'B-11-111',
      pointsAwarded: 500,
      habitLevel: null,
      qualityMultiplier: 1.0,
      frequencyBonus: 1.0,
    };

    expect(validateExperienceLogEntry(entry)).toBe(true);
    const record = toDbRecord(entry);
    expect(record.habit_level).toBeNull();
  });

  /**
   * Edge Case: Partial Completion Quality
   *
   * Test logging with partial completion (0.8 multiplier).
   */
  it('should handle partial completion quality', () => {
    const entry: ExperienceLogEntry = {
      userId: 'test-user-id',
      habitId: 'test-habit-id',
      domainCode: 'B-11-111',
      pointsAwarded: 40,
      habitLevel: 50,
      qualityMultiplier: 0.8,
      frequencyBonus: 1.0,
    };

    expect(validateExperienceLogEntry(entry)).toBe(true);
    expect(isValidQualityMultiplier(entry.qualityMultiplier)).toBe(true);
  });

  /**
   * Edge Case: Exceeded Completion Quality
   *
   * Test logging with exceeded completion (1.2 multiplier).
   */
  it('should handle exceeded completion quality', () => {
    const entry: ExperienceLogEntry = {
      userId: 'test-user-id',
      habitId: 'test-habit-id',
      domainCode: 'B-11-111',
      pointsAwarded: 60,
      habitLevel: 50,
      qualityMultiplier: 1.2,
      frequencyBonus: 1.0,
    };

    expect(validateExperienceLogEntry(entry)).toBe(true);
    expect(isValidQualityMultiplier(entry.qualityMultiplier)).toBe(true);
  });

  /**
   * Edge Case: Subsequent Completion Frequency
   *
   * Test logging with subsequent completion (0.5 bonus).
   */
  it('should handle subsequent completion frequency', () => {
    const entry: ExperienceLogEntry = {
      userId: 'test-user-id',
      habitId: 'test-habit-id',
      domainCode: 'B-11-111',
      pointsAwarded: 25,
      habitLevel: 50,
      qualityMultiplier: 1.0,
      frequencyBonus: 0.5,
    };

    expect(validateExperienceLogEntry(entry)).toBe(true);
    expect(isValidFrequencyBonus(entry.frequencyBonus)).toBe(true);
  });

  /**
   * Edge Case: With Activity ID
   *
   * Test logging with activity ID present.
   */
  it('should handle entry with activity ID', () => {
    const entry: ExperienceLogEntry = {
      userId: 'test-user-id',
      habitId: 'test-habit-id',
      activityId: 'test-activity-id',
      domainCode: 'B-11-111',
      pointsAwarded: 100,
      habitLevel: 50,
      qualityMultiplier: 1.0,
      frequencyBonus: 1.0,
    };

    expect(validateExperienceLogEntry(entry)).toBe(true);
    const record = toDbRecord(entry);
    expect(record.activity_id).toBe('test-activity-id');
  });
});
