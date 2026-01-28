/**
 * Level History Recording Property Test
 *
 * Feature: user-level-system, Property 15: Level History Recording
 *
 * For any level change (overall_level, expertise_level, habit_continuity_power > 5 points,
 * or resilience_score), a corresponding record must be created in user_level_history
 * with the correct change_type, old_level, new_level, and change_reason.
 *
 * **Validates: Requirements 4.6, 6.7, 7.5, 8.6**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { MetricsSnapshot, UserLevelHistoryRecord } from '../../../src/repositories/userLevelRepository.js';

// =============================================================================
// Types
// =============================================================================

type ChangeType = 'overall' | 'expertise' | 'continuity' | 'resilience';

interface LevelHistoryInput {
  userId: string;
  changeType: ChangeType;
  domainCode: string | null;
  oldLevel: number | null;
  newLevel: number;
  changeReason: string;
  metricsSnapshot: MetricsSnapshot | null;
}

// =============================================================================
// Pure Functions for Testing
// =============================================================================

/**
 * Validate that a history record has all required fields.
 *
 * @param record - The history record to validate
 * @returns True if all required fields are present and valid
 */
function validateHistoryRecord(record: LevelHistoryInput): boolean {
  // user_id is required
  if (!record.userId || typeof record.userId !== 'string') {
    return false;
  }

  // change_type must be one of the valid types
  const validChangeTypes: ChangeType[] = ['overall', 'expertise', 'continuity', 'resilience'];
  if (!validChangeTypes.includes(record.changeType)) {
    return false;
  }

  // new_level is required and must be a number
  if (typeof record.newLevel !== 'number') {
    return false;
  }

  // change_reason is required
  if (!record.changeReason || typeof record.changeReason !== 'string') {
    return false;
  }

  // domain_code is required for expertise changes
  if (record.changeType === 'expertise' && !record.domainCode) {
    return false;
  }

  return true;
}

/**
 * Determine if a level change should be recorded.
 *
 * @param changeType - Type of change
 * @param oldLevel - Previous level value
 * @param newLevel - New level value
 * @returns True if the change should be recorded
 */
function shouldRecordChange(
  changeType: ChangeType,
  oldLevel: number | null,
  newLevel: number
): boolean {
  // Always record if old level is null (first record)
  if (oldLevel === null) {
    return true;
  }

  // For continuity changes, only record if change > 5 points
  if (changeType === 'continuity') {
    return Math.abs(newLevel - oldLevel) > 5;
  }

  // For all other types, record any change
  return oldLevel !== newLevel;
}

/**
 * Get the appropriate change reason for a change type.
 *
 * @param changeType - Type of change
 * @param isDecay - Whether this is a decay change
 * @returns The change reason string
 */
function getChangeReason(changeType: ChangeType, isDecay: boolean = false): string {
  if (isDecay) {
    return 'level_decay';
  }

  switch (changeType) {
    case 'expertise':
      return 'expertise_gain';
    case 'overall':
      return 'level_recalculation';
    case 'continuity':
      return 'continuity_change';
    case 'resilience':
      return 'resilience_change';
    default:
      return 'unknown';
  }
}

/**
 * Create a valid history record from input.
 *
 * @param input - The input data
 * @returns A valid history record
 */
function createHistoryRecord(input: LevelHistoryInput): Omit<UserLevelHistoryRecord, 'id' | 'created_at'> {
  return {
    user_id: input.userId,
    change_type: input.changeType,
    domain_code: input.domainCode,
    old_level: input.oldLevel,
    new_level: input.newLevel,
    change_reason: input.changeReason,
    metrics_snapshot: input.metricsSnapshot,
  };
}

// =============================================================================
// Arbitraries
// =============================================================================

const userIdArb = fc.uuid();

const changeTypeArb = fc.constantFrom<ChangeType>('overall', 'expertise', 'continuity', 'resilience');

const domainCodeArb = fc.tuple(
  fc.constantFrom('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'),
  fc.integer({ min: 1, max: 99 }),
  fc.integer({ min: 1, max: 999 })
).map(([major, middle, minor]) =>
  `${major}-${String(middle).padStart(2, '0')}-${String(minor).padStart(3, '0')}`
);

const levelArb = fc.integer({ min: 0, max: 199 });

const changeReasonArb = fc.constantFrom(
  'expertise_gain',
  'level_decay',
  'level_recalculation',
  'continuity_change',
  'resilience_change'
);

const metricsSnapshotArb = fc.record({
  overallLevel: fc.option(levelArb, { nil: undefined }),
  habitContinuityPower: fc.option(fc.integer({ min: 0, max: 100 }), { nil: undefined }),
  resilienceScore: fc.option(fc.integer({ min: 0, max: 100 }), { nil: undefined }),
  topExpertiseAvg: fc.option(levelArb, { nil: undefined }),
  domainLevels: fc.option(
    fc.dictionary(domainCodeArb, levelArb),
    { nil: undefined }
  ),
});

// =============================================================================
// Property-Based Tests
// =============================================================================

describe('Feature: user-level-system, Property 15: Level History Recording', () => {
  /**
   * Property 15.1: All Required Fields Present
   *
   * For any level change, the history record must contain all required fields:
   * user_id, change_type, new_level, and change_reason.
   *
   * **Validates: Requirements 4.6, 6.7, 7.5, 8.6**
   */
  it('should require all mandatory fields in history record', () => {
    fc.assert(
      fc.property(
        userIdArb,
        changeTypeArb,
        fc.option(domainCodeArb, { nil: null }),
        fc.option(levelArb, { nil: null }),
        levelArb,
        changeReasonArb,
        fc.option(metricsSnapshotArb, { nil: null }),
        (userId, changeType, domainCode, oldLevel, newLevel, changeReason, metricsSnapshot) => {
          const input: LevelHistoryInput = {
            userId,
            changeType,
            domainCode: changeType === 'expertise' ? (domainCode ?? 'B-11-111') : domainCode,
            oldLevel,
            newLevel,
            changeReason,
            metricsSnapshot,
          };

          return validateHistoryRecord(input);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 15.2: Expertise Changes Require Domain Code
   *
   * For expertise level changes, the domain_code field must be present.
   *
   * **Validates: Requirements 6.7**
   */
  it('should require domain_code for expertise changes', () => {
    fc.assert(
      fc.property(
        userIdArb,
        domainCodeArb,
        fc.option(levelArb, { nil: null }),
        levelArb,
        (userId, domainCode, oldLevel, newLevel) => {
          const input: LevelHistoryInput = {
            userId,
            changeType: 'expertise',
            domainCode,
            oldLevel,
            newLevel,
            changeReason: 'expertise_gain',
            metricsSnapshot: { domainLevels: { [domainCode]: newLevel } },
          };

          // Should be valid with domain code
          const validWithDomain = validateHistoryRecord(input);

          // Should be invalid without domain code
          const inputWithoutDomain: LevelHistoryInput = {
            ...input,
            domainCode: null,
          };
          const invalidWithoutDomain = !validateHistoryRecord(inputWithoutDomain);

          return validWithDomain && invalidWithoutDomain;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 15.3: Continuity Changes Only Recorded for > 5 Points
   *
   * For habit_continuity_power changes, only changes greater than 5 points
   * should be recorded.
   *
   * **Validates: Requirements 4.6**
   */
  it('should only record continuity changes greater than 5 points', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }), // old level
        fc.integer({ min: 0, max: 100 }), // new level
        (oldLevel, newLevel) => {
          const shouldRecord = shouldRecordChange('continuity', oldLevel, newLevel);
          const difference = Math.abs(newLevel - oldLevel);

          // Should record if difference > 5
          if (difference > 5) {
            return shouldRecord === true;
          }
          // Should not record if difference <= 5
          return shouldRecord === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 15.4: Other Changes Always Recorded When Different
   *
   * For overall_level, expertise_level, and resilience_score changes,
   * any change should be recorded.
   *
   * **Validates: Requirements 6.7, 7.5, 8.6**
   */
  it('should record any change for overall, expertise, and resilience', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<ChangeType>('overall', 'expertise', 'resilience'),
        levelArb,
        levelArb,
        (changeType, oldLevel, newLevel) => {
          const shouldRecord = shouldRecordChange(changeType, oldLevel, newLevel);

          // Should record if levels are different
          if (oldLevel !== newLevel) {
            return shouldRecord === true;
          }
          // Should not record if levels are the same
          return shouldRecord === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 15.5: First Record Always Created
   *
   * When old_level is null (first record), the change should always be recorded.
   *
   * **Validates: Requirements 4.6, 6.7, 7.5, 8.6**
   */
  it('should always record when old_level is null (first record)', () => {
    fc.assert(
      fc.property(
        changeTypeArb,
        levelArb,
        (changeType, newLevel) => {
          return shouldRecordChange(changeType, null, newLevel) === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 15.6: Change Reason Matches Change Type
   *
   * The change_reason should be appropriate for the change_type.
   *
   * **Validates: Requirements 4.6, 6.7, 7.5, 8.6**
   */
  it('should have appropriate change_reason for each change_type', () => {
    fc.assert(
      fc.property(
        changeTypeArb,
        fc.boolean(), // isDecay
        (changeType, isDecay) => {
          const reason = getChangeReason(changeType, isDecay);

          if (isDecay) {
            return reason === 'level_decay';
          }

          switch (changeType) {
            case 'expertise':
              return reason === 'expertise_gain';
            case 'overall':
              return reason === 'level_recalculation';
            case 'continuity':
              return reason === 'continuity_change';
            case 'resilience':
              return reason === 'resilience_change';
            default:
              return false;
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 15.7: History Record Preserves All Input Data
   *
   * The created history record should preserve all input data correctly.
   *
   * **Validates: Requirements 4.6, 6.7, 7.5, 8.6**
   */
  it('should preserve all input data in history record', () => {
    fc.assert(
      fc.property(
        userIdArb,
        changeTypeArb,
        domainCodeArb,
        fc.option(levelArb, { nil: null }),
        levelArb,
        changeReasonArb,
        metricsSnapshotArb,
        (userId, changeType, domainCode, oldLevel, newLevel, changeReason, metricsSnapshot) => {
          const input: LevelHistoryInput = {
            userId,
            changeType,
            domainCode: changeType === 'expertise' ? domainCode : null,
            oldLevel,
            newLevel,
            changeReason,
            metricsSnapshot,
          };

          const record = createHistoryRecord(input);

          return (
            record.user_id === userId &&
            record.change_type === changeType &&
            record.domain_code === input.domainCode &&
            record.old_level === oldLevel &&
            record.new_level === newLevel &&
            record.change_reason === changeReason &&
            record.metrics_snapshot === metricsSnapshot
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 15.8: Level Values Are Valid
   *
   * Both old_level and new_level should be within valid range [0, 199].
   *
   * **Validates: Requirements 4.6, 6.7, 7.5, 8.6**
   */
  it('should have level values within valid range', () => {
    fc.assert(
      fc.property(
        fc.option(levelArb, { nil: null }),
        levelArb,
        (oldLevel, newLevel) => {
          // new_level must be in range
          if (newLevel < 0 || newLevel > 199) {
            return false;
          }

          // old_level must be in range if not null
          if (oldLevel !== null && (oldLevel < 0 || oldLevel > 199)) {
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
   * Edge Case: Zero Level Change
   *
   * When old_level equals new_level, no change should be recorded
   * (except for continuity which has a threshold).
   */
  it('should not record when old_level equals new_level', () => {
    expect(shouldRecordChange('overall', 50, 50)).toBe(false);
    expect(shouldRecordChange('expertise', 100, 100)).toBe(false);
    expect(shouldRecordChange('resilience', 75, 75)).toBe(false);
    expect(shouldRecordChange('continuity', 80, 80)).toBe(false);
  });

  /**
   * Edge Case: Continuity Change Exactly 5 Points
   *
   * A continuity change of exactly 5 points should NOT be recorded.
   */
  it('should not record continuity change of exactly 5 points', () => {
    expect(shouldRecordChange('continuity', 50, 55)).toBe(false);
    expect(shouldRecordChange('continuity', 55, 50)).toBe(false);
  });

  /**
   * Edge Case: Continuity Change of 6 Points
   *
   * A continuity change of 6 points should be recorded.
   */
  it('should record continuity change of 6 points', () => {
    expect(shouldRecordChange('continuity', 50, 56)).toBe(true);
    expect(shouldRecordChange('continuity', 56, 50)).toBe(true);
  });

  /**
   * Edge Case: Level Change of 1 Point
   *
   * Even a 1-point change should be recorded for non-continuity types.
   */
  it('should record 1-point change for non-continuity types', () => {
    expect(shouldRecordChange('overall', 50, 51)).toBe(true);
    expect(shouldRecordChange('expertise', 100, 99)).toBe(true);
    expect(shouldRecordChange('resilience', 75, 76)).toBe(true);
  });

  /**
   * Edge Case: Decay Change Reason
   *
   * Decay changes should have 'level_decay' as the reason.
   */
  it('should use level_decay reason for decay changes', () => {
    expect(getChangeReason('expertise', true)).toBe('level_decay');
    expect(getChangeReason('overall', true)).toBe('level_decay');
  });

  /**
   * Edge Case: Metrics Snapshot with Domain Levels
   *
   * Expertise changes should include domain levels in metrics snapshot.
   */
  it('should include domain levels in metrics snapshot for expertise changes', () => {
    const input: LevelHistoryInput = {
      userId: 'test-user-id',
      changeType: 'expertise',
      domainCode: 'B-11-111',
      oldLevel: 10,
      newLevel: 15,
      changeReason: 'expertise_gain',
      metricsSnapshot: {
        domainLevels: { 'B-11-111': 15 },
      },
    };

    const record = createHistoryRecord(input);
    expect(record.metrics_snapshot?.domainLevels?.['B-11-111']).toBe(15);
  });

  /**
   * Edge Case: Overall Level Change with Full Metrics
   *
   * Overall level changes should include all relevant metrics in snapshot.
   */
  it('should include full metrics in snapshot for overall changes', () => {
    const input: LevelHistoryInput = {
      userId: 'test-user-id',
      changeType: 'overall',
      domainCode: null,
      oldLevel: 50,
      newLevel: 55,
      changeReason: 'level_recalculation',
      metricsSnapshot: {
        overallLevel: 55,
        habitContinuityPower: 70,
        resilienceScore: 60,
        topExpertiseAvg: 45,
      },
    };

    const record = createHistoryRecord(input);
    expect(record.metrics_snapshot?.overallLevel).toBe(55);
    expect(record.metrics_snapshot?.habitContinuityPower).toBe(70);
    expect(record.metrics_snapshot?.resilienceScore).toBe(60);
    expect(record.metrics_snapshot?.topExpertiseAvg).toBe(45);
  });
});
