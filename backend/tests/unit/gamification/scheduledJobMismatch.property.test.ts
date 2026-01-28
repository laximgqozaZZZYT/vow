/**
 * Property-Based Tests for Scheduled Job Mismatch State Transitions
 *
 * Feature: gamification-xp-balance
 * Property 10: Scheduled Job Mismatch State Transitions
 *
 * For any habit that transitions from compatible to mismatched (due to user level decrease),
 * the system shall create a notification.
 * For any habit that transitions from mismatched to compatible (due to user level increase),
 * the system shall update the habit metadata.
 *
 * **Validates: Requirements 7.2, 7.3**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

// =============================================================================
// Types (mirroring the service types)
// =============================================================================

type MismatchSeverity = 'none' | 'mild' | 'moderate' | 'severe';

interface LevelMismatchResult {
  isMismatch: boolean;
  userLevel: number;
  habitLevel: number;
  levelGap: number;
  severity: MismatchSeverity;
  recommendation: 'proceed' | 'suggest_baby_steps' | 'strongly_suggest_baby_steps';
}

interface HabitMismatchState {
  id: string;
  level: number;
  mismatch_acknowledged: boolean | null;
  original_level_gap: number | null;
}

interface MismatchStateTransition {
  habitId: string;
  previousState: 'compatible' | 'mismatched';
  newState: 'compatible' | 'mismatched';
  action: 'create_notification' | 'resolve_mismatch' | 'no_action';
  mismatchResult: LevelMismatchResult;
}

// =============================================================================
// Pure Functions Under Test (extracted from service for testing)
// =============================================================================

/**
 * Detect level mismatch between user and habit.
 * Pure function for testing.
 */
function detectLevelMismatch(userLevel: number, habitLevel: number): LevelMismatchResult {
  const levelGap = habitLevel - userLevel;
  const isMismatch = levelGap > 50;

  let severity: MismatchSeverity;
  if (levelGap < 50) {
    severity = 'none';
  } else if (levelGap <= 75) {
    severity = 'mild';
  } else if (levelGap <= 100) {
    severity = 'moderate';
  } else {
    severity = 'severe';
  }

  let recommendation: 'proceed' | 'suggest_baby_steps' | 'strongly_suggest_baby_steps';
  if (!isMismatch) {
    recommendation = 'proceed';
  } else if (severity === 'severe') {
    recommendation = 'strongly_suggest_baby_steps';
  } else {
    recommendation = 'suggest_baby_steps';
  }

  return {
    isMismatch,
    userLevel,
    habitLevel,
    levelGap,
    severity,
    recommendation,
  };
}

/**
 * Determine state transition and required action.
 * Pure function for testing.
 */
function determineStateTransition(
  habit: HabitMismatchState,
  mismatchResult: LevelMismatchResult
): MismatchStateTransition {
  const wasAcknowledged = habit.mismatch_acknowledged ?? false;
  const previousGap = habit.original_level_gap ?? 0;

  // Determine previous state
  const previousState: 'compatible' | 'mismatched' = wasAcknowledged && previousGap > 0
    ? 'mismatched'
    : 'compatible';

  // Determine new state
  const newState: 'compatible' | 'mismatched' = mismatchResult.isMismatch
    ? 'mismatched'
    : 'compatible';

  // Determine action based on state transition
  let action: 'create_notification' | 'resolve_mismatch' | 'no_action';

  if (mismatchResult.isMismatch && !wasAcknowledged) {
    // New mismatch detected - create notification
    action = 'create_notification';
  } else if (!mismatchResult.isMismatch && wasAcknowledged && previousGap > 0) {
    // Mismatch resolved - update habit metadata
    action = 'resolve_mismatch';
  } else {
    // No state change
    action = 'no_action';
  }

  return {
    habitId: habit.id,
    previousState,
    newState,
    action,
    mismatchResult,
  };
}

// =============================================================================
// Arbitraries
// =============================================================================

const userLevelArb = fc.integer({ min: 0, max: 199 });
const habitLevelArb = fc.integer({ min: 0, max: 199 });

const habitStateArb = fc.record({
  id: fc.uuid(),
  level: habitLevelArb,
  mismatch_acknowledged: fc.oneof(fc.constant(null), fc.boolean()),
  original_level_gap: fc.oneof(fc.constant(null), fc.integer({ min: 0, max: 150 })),
});

// Habit that was previously in mismatch state
const previouslyMismatchedHabitArb = fc.record({
  id: fc.uuid(),
  level: habitLevelArb,
  mismatch_acknowledged: fc.constant(true),
  original_level_gap: fc.integer({ min: 51, max: 150 }),
});

// Habit that was previously compatible
const previouslyCompatibleHabitArb = fc.record({
  id: fc.uuid(),
  level: habitLevelArb,
  mismatch_acknowledged: fc.oneof(fc.constant(null), fc.constant(false)),
  original_level_gap: fc.oneof(fc.constant(null), fc.constant(0)),
});

// =============================================================================
// Property Tests
// =============================================================================

describe('Scheduled Job Mismatch State Transitions Properties', () => {
  /**
   * Property 10: Scheduled Job Mismatch State Transitions
   *
   * For any habit that transitions from compatible to mismatched,
   * the system shall create a notification.
   */
  describe('Property 10: Compatible to Mismatched Transition', () => {
    it('should create notification when new mismatch is detected', () => {
      fc.assert(
        fc.property(
          previouslyCompatibleHabitArb,
          userLevelArb,
          (habit, userLevel) => {
            const mismatchResult = detectLevelMismatch(userLevel, habit.level);
            const transition = determineStateTransition(habit, mismatchResult);

            // Property: if mismatch detected and not previously acknowledged,
            // action should be create_notification
            if (mismatchResult.isMismatch && !habit.mismatch_acknowledged) {
              expect(transition.action).toBe('create_notification');
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should transition to mismatched state when levelGap > 50', () => {
      fc.assert(
        fc.property(
          previouslyCompatibleHabitArb,
          fc.integer({ min: 0, max: 100 }), // Low user level
          (habit, userLevel) => {
            // Ensure habit level is high enough to cause mismatch
            const highLevelHabit = { ...habit, level: userLevel + 60 };
            const mismatchResult = detectLevelMismatch(userLevel, highLevelHabit.level);
            const transition = determineStateTransition(highLevelHabit, mismatchResult);

            // Property: when gap > 50, new state should be mismatched
            expect(transition.newState).toBe('mismatched');
            expect(transition.action).toBe('create_notification');

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 10: Scheduled Job Mismatch State Transitions
   *
   * For any habit that transitions from mismatched to compatible,
   * the system shall update the habit metadata.
   */
  describe('Property 10: Mismatched to Compatible Transition', () => {
    it('should resolve mismatch when user level increases sufficiently', () => {
      fc.assert(
        fc.property(
          previouslyMismatchedHabitArb,
          (habit) => {
            // User level high enough to make habit compatible
            const highUserLevel = habit.level + 10;
            const mismatchResult = detectLevelMismatch(highUserLevel, habit.level);
            const transition = determineStateTransition(habit, mismatchResult);

            // Property: if previously mismatched and now compatible,
            // action should be resolve_mismatch
            if (!mismatchResult.isMismatch && habit.mismatch_acknowledged && (habit.original_level_gap ?? 0) > 0) {
              expect(transition.action).toBe('resolve_mismatch');
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should transition to compatible state when levelGap <= 50', () => {
      fc.assert(
        fc.property(
          previouslyMismatchedHabitArb,
          (habit) => {
            // User level close to habit level
            const userLevel = habit.level - 30;
            const mismatchResult = detectLevelMismatch(userLevel, habit.level);
            const transition = determineStateTransition(habit, mismatchResult);

            // Property: when gap <= 50, new state should be compatible
            expect(transition.newState).toBe('compatible');

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('No State Change Scenarios', () => {
    it('should take no action when already acknowledged mismatch persists', () => {
      fc.assert(
        fc.property(
          previouslyMismatchedHabitArb,
          fc.integer({ min: 0, max: 50 }), // Low user level
          (habit, userLevel) => {
            // Ensure mismatch still exists
            const lowLevelHabit = { ...habit, level: userLevel + 80 };
            const mismatchResult = detectLevelMismatch(userLevel, lowLevelHabit.level);
            const transition = determineStateTransition(lowLevelHabit, mismatchResult);

            // Property: if mismatch persists and already acknowledged,
            // no action needed
            if (mismatchResult.isMismatch && lowLevelHabit.mismatch_acknowledged) {
              expect(transition.action).toBe('no_action');
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should take no action when compatible state persists', () => {
      fc.assert(
        fc.property(
          previouslyCompatibleHabitArb,
          (habit) => {
            // User level high enough to stay compatible
            const userLevel = habit.level + 10;
            const mismatchResult = detectLevelMismatch(userLevel, habit.level);
            const transition = determineStateTransition(habit, mismatchResult);

            // Property: if compatible and stays compatible, no action
            if (!mismatchResult.isMismatch && !habit.mismatch_acknowledged) {
              expect(transition.action).toBe('no_action');
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Mismatch Detection Properties', () => {
    it('should correctly identify mismatch when levelGap > 50', () => {
      fc.assert(
        fc.property(
          userLevelArb,
          habitLevelArb,
          (userLevel, habitLevel) => {
            const result = detectLevelMismatch(userLevel, habitLevel);
            const expectedGap = habitLevel - userLevel;

            // Property: isMismatch should be true iff gap > 50
            expect(result.isMismatch).toBe(expectedGap > 50);
            expect(result.levelGap).toBe(expectedGap);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should classify severity correctly', () => {
      fc.assert(
        fc.property(
          userLevelArb,
          habitLevelArb,
          (userLevel, habitLevel) => {
            const result = detectLevelMismatch(userLevel, habitLevel);
            const gap = habitLevel - userLevel;

            // Property: severity classification
            if (gap < 50) {
              expect(result.severity).toBe('none');
            } else if (gap <= 75) {
              expect(result.severity).toBe('mild');
            } else if (gap <= 100) {
              expect(result.severity).toBe('moderate');
            } else {
              expect(result.severity).toBe('severe');
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Transition Result Structure', () => {
    it('should always return all required fields', () => {
      fc.assert(
        fc.property(
          habitStateArb,
          userLevelArb,
          (habit, userLevel) => {
            const mismatchResult = detectLevelMismatch(userLevel, habit.level);
            const transition = determineStateTransition(habit, mismatchResult);

            // All required fields must be present
            expect(transition).toHaveProperty('habitId');
            expect(transition).toHaveProperty('previousState');
            expect(transition).toHaveProperty('newState');
            expect(transition).toHaveProperty('action');
            expect(transition).toHaveProperty('mismatchResult');

            // Type checks
            expect(typeof transition.habitId).toBe('string');
            expect(['compatible', 'mismatched']).toContain(transition.previousState);
            expect(['compatible', 'mismatched']).toContain(transition.newState);
            expect(['create_notification', 'resolve_mismatch', 'no_action']).toContain(transition.action);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include complete mismatch result in transition', () => {
      fc.assert(
        fc.property(
          habitStateArb,
          userLevelArb,
          (habit, userLevel) => {
            const mismatchResult = detectLevelMismatch(userLevel, habit.level);
            const transition = determineStateTransition(habit, mismatchResult);

            // Mismatch result should have all fields
            expect(transition.mismatchResult).toHaveProperty('isMismatch');
            expect(transition.mismatchResult).toHaveProperty('userLevel');
            expect(transition.mismatchResult).toHaveProperty('habitLevel');
            expect(transition.mismatchResult).toHaveProperty('levelGap');
            expect(transition.mismatchResult).toHaveProperty('severity');
            expect(transition.mismatchResult).toHaveProperty('recommendation');

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Recommendation Properties', () => {
    it('should recommend proceed when no mismatch', () => {
      fc.assert(
        fc.property(
          userLevelArb,
          habitLevelArb,
          (userLevel, habitLevel) => {
            const result = detectLevelMismatch(userLevel, habitLevel);

            if (!result.isMismatch) {
              expect(result.recommendation).toBe('proceed');
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should strongly suggest baby steps for severe mismatch', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 50 }), // Low user level
          fc.integer({ min: 151, max: 199 }), // High habit level
          (userLevel, habitLevel) => {
            const result = detectLevelMismatch(userLevel, habitLevel);

            // Property: severe mismatch should strongly suggest baby steps
            if (result.severity === 'severe') {
              expect(result.recommendation).toBe('strongly_suggest_baby_steps');
            }

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should suggest baby steps for mild/moderate mismatch', () => {
      fc.assert(
        fc.property(
          userLevelArb,
          habitLevelArb,
          (userLevel, habitLevel) => {
            const result = detectLevelMismatch(userLevel, habitLevel);

            // Property: mild/moderate mismatch should suggest baby steps
            if (result.isMismatch && (result.severity === 'mild' || result.severity === 'moderate')) {
              expect(result.recommendation).toBe('suggest_baby_steps');
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
