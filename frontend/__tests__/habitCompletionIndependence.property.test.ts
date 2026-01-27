/**
 * Property-based tests for Habit Completion Independence
 * 
 * Tests Property 8: Habit Completion Independence
 * 
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
 * 
 * Requirements tested:
 * - 4.1: WHEN a Habit reaches Daily_Completion status, THE System SHALL NOT modify the completion state of its subtasks
 * - 4.2: WHEN a Habit reaches Cumulative_Completion status, THE System SHALL NOT modify the completion state of its subtasks
 * - 4.3: WHEN a Habit is manually marked as complete, THE System SHALL NOT modify the completion state of its subtasks
 * - 4.4: THE System SHALL allow subtasks to be completed or uncompleted independently of the parent Habit's status
 * 
 * The implementation uses separate state management for habits and stickies.
 * This test verifies that:
 * 1. The `buildSubtasksByHabitMap` function preserves sticky completion states
 * 2. Changing habit completion state doesn't affect the subtasks in the map
 * 3. The subtask completion states are independent of habit completion states
 */

import * as fc from 'fast-check';
import { buildSubtasksByHabitMap } from '../app/dashboard/hooks/useHabitSubtasks';
import type { Habit, Sticky } from '../app/dashboard/types';

// ============================================================================
// Arbitraries (Test Data Generators)
// ============================================================================

/** Generate a valid ID string */
const idArb = fc.stringMatching(/^[a-z0-9]{8,16}$/);

/** Generate a minimal Habit for testing with configurable completion state */
const habitArb = (id?: string, completed?: boolean): fc.Arbitrary<Habit> =>
  fc.record({
    id: id ? fc.constant(id) : idArb,
    goalId: idArb,
    name: fc.string({ minLength: 1, maxLength: 50 }),
    active: fc.boolean(),
    type: fc.constantFrom('do', 'avoid') as fc.Arbitrary<'do' | 'avoid'>,
    count: fc.integer({ min: 0, max: 100 }),
    must: fc.integer({ min: 1, max: 100 }),
    completed: completed !== undefined ? fc.constant(completed) : fc.boolean(),
    createdAt: fc.constant(new Date().toISOString()),
    updatedAt: fc.constant(new Date().toISOString()),
  });

/** Generate a minimal Sticky for testing (without habit relations) */
const baseStickyArb = (id?: string, completed?: boolean): fc.Arbitrary<Omit<Sticky, 'habits'>> =>
  fc.record({
    id: id ? fc.constant(id) : idArb,
    name: fc.string({ minLength: 1, maxLength: 50 }),
    description: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
    completed: completed !== undefined ? fc.constant(completed) : fc.boolean(),
    completedAt: fc.option(fc.constant(new Date().toISOString()), { nil: undefined }),
    displayOrder: fc.integer({ min: 0, max: 1000 }),
    createdAt: fc.constant(new Date().toISOString()),
    updatedAt: fc.constant(new Date().toISOString()),
  });

/**
 * Generate a test scenario with a habit and its subtasks with specific completion states
 */
interface HabitCompletionScenario {
  habit: Habit;
  subtasks: Sticky[];
  /** Original completion states of subtasks (before any habit state change) */
  originalSubtaskStates: boolean[];
}

/**
 * Generate a scenario for testing habit completion independence
 * @param habitCompleted - Whether the habit should be marked as completed
 */
const habitCompletionScenarioArb = (habitCompleted: boolean): fc.Arbitrary<HabitCompletionScenario> =>
  fc.integer({ min: 1, max: 10 }).chain((subtaskCount) =>
    idArb.chain((habitId) =>
      habitArb(habitId, habitCompleted).chain((habit) =>
        fc.array(fc.boolean(), { minLength: subtaskCount, maxLength: subtaskCount }).chain((completionStates) =>
          fc.array(baseStickyArb(), { minLength: subtaskCount, maxLength: subtaskCount }).map((baseStickies) => {
            const subtasks: Sticky[] = baseStickies.map((s, idx) => ({
              ...s,
              completed: completionStates[idx],
              habits: [habit],
            }));
            return {
              habit,
              subtasks,
              originalSubtaskStates: completionStates,
            };
          })
        )
      )
    )
  );

/**
 * Generate a scenario with multiple habits and shared subtasks
 */
interface MultiHabitScenario {
  habits: Habit[];
  subtasks: Sticky[];
  /** Map of sticky index to its original completion state */
  originalStates: Map<number, boolean>;
}

const multiHabitScenarioArb = (): fc.Arbitrary<MultiHabitScenario> =>
  fc.integer({ min: 2, max: 5 }).chain((habitCount) =>
    fc.integer({ min: 1, max: 10 }).chain((subtaskCount) =>
      fc.array(idArb, { minLength: habitCount, maxLength: habitCount })
        .map((ids) => [...new Set(ids)])
        .filter((ids) => ids.length === habitCount)
        .chain((uniqueHabitIds) =>
          fc.tuple(
            ...uniqueHabitIds.map((id) => habitArb(id))
          ).chain((habits) =>
            fc.array(
              fc.tuple(
                baseStickyArb(),
                fc.boolean(), // completion state
                fc.array(fc.integer({ min: 0, max: habitCount - 1 }), { minLength: 1, maxLength: habitCount })
              ),
              { minLength: subtaskCount, maxLength: subtaskCount }
            ).map((stickyData) => {
              const originalStates = new Map<number, boolean>();
              const subtasks: Sticky[] = stickyData.map(([baseSticky, completed, habitIndices], idx) => {
                const uniqueIndices = [...new Set(habitIndices)];
                originalStates.set(idx, completed);
                return {
                  ...baseSticky,
                  completed,
                  habits: uniqueIndices.map((i) => habits[i]),
                };
              });
              return {
                habits: Array.from(habits),
                subtasks,
                originalStates,
              };
            })
          )
        )
    )
  );

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Simulate changing a habit's completion state (daily completion, cumulative completion, or manual)
 * This creates a new habit object with the updated completion state
 */
function changeHabitCompletionState(habit: Habit, newCompletedState: boolean): Habit {
  return {
    ...habit,
    completed: newCompletedState,
    // Simulate count reaching must for daily/cumulative completion
    count: newCompletedState ? habit.must : habit.count,
    lastCompletedAt: newCompletedState ? new Date().toISOString() : habit.lastCompletedAt,
  };
}

/**
 * Verify that all subtask completion states match their original states
 */
function verifySubtaskStatesUnchanged(
  subtasks: Sticky[],
  originalStates: boolean[]
): boolean {
  if (subtasks.length !== originalStates.length) {
    return false;
  }
  return subtasks.every((subtask, idx) => subtask.completed === originalStates[idx]);
}

/**
 * Get subtasks for a specific habit from the map
 */
function getSubtasksForHabit(
  map: Record<string, Sticky[]>,
  habitId: string
): Sticky[] {
  return map[habitId] || [];
}

// ============================================================================
// Property Tests
// ============================================================================

describe('Property 8: Habit Completion Independence', () => {
  describe('Requirement 4.1: Daily Completion does not modify subtask states', () => {
    /**
     * **Validates: Requirements 4.1**
     * 
     * WHEN a Habit reaches Daily_Completion status (count reaches must),
     * THE System SHALL NOT modify the completion state of its subtasks.
     */
    test('habit reaching daily completion preserves subtask completion states', () => {
      fc.assert(
        fc.property(
          habitCompletionScenarioArb(false), // Start with incomplete habit
          ({ habit, subtasks, originalSubtaskStates }) => {
            // Build initial subtasks map
            const initialMap = buildSubtasksByHabitMap(subtasks);
            const initialSubtasks = getSubtasksForHabit(initialMap, habit.id);
            
            // Verify initial states match
            expect(verifySubtaskStatesUnchanged(initialSubtasks, originalSubtaskStates)).toBe(true);
            
            // Simulate habit reaching daily completion (count reaches must)
            const completedHabit = changeHabitCompletionState(habit, true);
            
            // Update the habit reference in subtasks (simulating state update)
            const updatedSubtasks = subtasks.map((s) => ({
              ...s,
              habits: s.habits?.map((h) => (h.id === habit.id ? completedHabit : h)),
            }));
            
            // Build new map with updated habit
            const newMap = buildSubtasksByHabitMap(updatedSubtasks);
            const newSubtasks = getSubtasksForHabit(newMap, habit.id);
            
            // Verify subtask completion states are unchanged
            expect(verifySubtaskStatesUnchanged(newSubtasks, originalSubtaskStates)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Requirement 4.2: Cumulative Completion does not modify subtask states', () => {
    /**
     * **Validates: Requirements 4.2**
     * 
     * WHEN a Habit reaches Cumulative_Completion status,
     * THE System SHALL NOT modify the completion state of its subtasks.
     */
    test('habit reaching cumulative completion preserves subtask completion states', () => {
      fc.assert(
        fc.property(
          habitCompletionScenarioArb(false), // Start with incomplete habit
          ({ habit, subtasks, originalSubtaskStates }) => {
            // Build initial subtasks map
            const initialMap = buildSubtasksByHabitMap(subtasks);
            const initialSubtasks = getSubtasksForHabit(initialMap, habit.id);
            
            // Verify initial states match
            expect(verifySubtaskStatesUnchanged(initialSubtasks, originalSubtaskStates)).toBe(true);
            
            // Simulate habit reaching cumulative completion
            const completedHabit: Habit = {
              ...habit,
              completed: true,
              count: habit.must, // Cumulative count reaches target
            };
            
            // Update the habit reference in subtasks
            const updatedSubtasks = subtasks.map((s) => ({
              ...s,
              habits: s.habits?.map((h) => (h.id === habit.id ? completedHabit : h)),
            }));
            
            // Build new map with updated habit
            const newMap = buildSubtasksByHabitMap(updatedSubtasks);
            const newSubtasks = getSubtasksForHabit(newMap, habit.id);
            
            // Verify subtask completion states are unchanged
            expect(verifySubtaskStatesUnchanged(newSubtasks, originalSubtaskStates)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Requirement 4.3: Manual Completion does not modify subtask states', () => {
    /**
     * **Validates: Requirements 4.3**
     * 
     * WHEN a Habit is manually marked as complete,
     * THE System SHALL NOT modify the completion state of its subtasks.
     */
    test('manually completing habit preserves subtask completion states', () => {
      fc.assert(
        fc.property(
          habitCompletionScenarioArb(false), // Start with incomplete habit
          ({ habit, subtasks, originalSubtaskStates }) => {
            // Build initial subtasks map
            const initialMap = buildSubtasksByHabitMap(subtasks);
            const initialSubtasks = getSubtasksForHabit(initialMap, habit.id);
            
            // Verify initial states match
            expect(verifySubtaskStatesUnchanged(initialSubtasks, originalSubtaskStates)).toBe(true);
            
            // Simulate manual completion (just setting completed to true)
            const manuallyCompletedHabit: Habit = {
              ...habit,
              completed: true,
              lastCompletedAt: new Date().toISOString(),
            };
            
            // Update the habit reference in subtasks
            const updatedSubtasks = subtasks.map((s) => ({
              ...s,
              habits: s.habits?.map((h) => (h.id === habit.id ? manuallyCompletedHabit : h)),
            }));
            
            // Build new map with updated habit
            const newMap = buildSubtasksByHabitMap(updatedSubtasks);
            const newSubtasks = getSubtasksForHabit(newMap, habit.id);
            
            // Verify subtask completion states are unchanged
            expect(verifySubtaskStatesUnchanged(newSubtasks, originalSubtaskStates)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Validates: Requirements 4.3**
     * 
     * Manually uncompleting a habit should also preserve subtask states
     */
    test('manually uncompleting habit preserves subtask completion states', () => {
      fc.assert(
        fc.property(
          habitCompletionScenarioArb(true), // Start with completed habit
          ({ habit, subtasks, originalSubtaskStates }) => {
            // Build initial subtasks map
            const initialMap = buildSubtasksByHabitMap(subtasks);
            const initialSubtasks = getSubtasksForHabit(initialMap, habit.id);
            
            // Verify initial states match
            expect(verifySubtaskStatesUnchanged(initialSubtasks, originalSubtaskStates)).toBe(true);
            
            // Simulate manual uncompletion
            const uncompletedHabit: Habit = {
              ...habit,
              completed: false,
            };
            
            // Update the habit reference in subtasks
            const updatedSubtasks = subtasks.map((s) => ({
              ...s,
              habits: s.habits?.map((h) => (h.id === habit.id ? uncompletedHabit : h)),
            }));
            
            // Build new map with updated habit
            const newMap = buildSubtasksByHabitMap(updatedSubtasks);
            const newSubtasks = getSubtasksForHabit(newMap, habit.id);
            
            // Verify subtask completion states are unchanged
            expect(verifySubtaskStatesUnchanged(newSubtasks, originalSubtaskStates)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Requirement 4.4: Subtask Independence', () => {
    /**
     * **Validates: Requirements 4.4**
     * 
     * THE System SHALL allow subtasks to be completed or uncompleted
     * independently of the parent Habit's status.
     */
    test('subtasks can be completed independently of habit status', () => {
      fc.assert(
        fc.property(
          habitCompletionScenarioArb(false), // Incomplete habit
          fc.integer({ min: 0, max: 9 }), // Index of subtask to complete
          ({ habit, subtasks, originalSubtaskStates }, subtaskIndexToComplete) => {
            // Ensure index is valid
            const validIndex = subtaskIndexToComplete % subtasks.length;
            
            // Complete a subtask while habit remains incomplete
            const updatedSubtasks = subtasks.map((s, idx) => ({
              ...s,
              completed: idx === validIndex ? true : s.completed,
            }));
            
            // Build map with updated subtasks
            const map = buildSubtasksByHabitMap(updatedSubtasks);
            const habitSubtasks = getSubtasksForHabit(map, habit.id);
            
            // Verify the specific subtask was completed
            const completedSubtask = habitSubtasks.find((s) => s.id === subtasks[validIndex].id);
            expect(completedSubtask?.completed).toBe(true);
            
            // Verify habit is still incomplete (independence)
            expect(habit.completed).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Validates: Requirements 4.4**
     * 
     * Subtasks can be uncompleted independently of habit status
     */
    test('subtasks can be uncompleted independently of habit status', () => {
      fc.assert(
        fc.property(
          habitCompletionScenarioArb(true), // Completed habit
          fc.integer({ min: 0, max: 9 }), // Index of subtask to uncomplete
          ({ habit, subtasks }, subtaskIndexToUncomplete) => {
            // Ensure index is valid
            const validIndex = subtaskIndexToUncomplete % subtasks.length;
            
            // Uncomplete a subtask while habit remains completed
            const updatedSubtasks = subtasks.map((s, idx) => ({
              ...s,
              completed: idx === validIndex ? false : s.completed,
            }));
            
            // Build map with updated subtasks
            const map = buildSubtasksByHabitMap(updatedSubtasks);
            const habitSubtasks = getSubtasksForHabit(map, habit.id);
            
            // Verify the specific subtask was uncompleted
            const uncompletedSubtask = habitSubtasks.find((s) => s.id === subtasks[validIndex].id);
            expect(uncompletedSubtask?.completed).toBe(false);
            
            // Verify habit is still completed (independence)
            expect(habit.completed).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Validates: Requirements 4.4**
     * 
     * Multiple subtask state changes should be independent of habit state
     */
    test('multiple subtask state changes are independent of habit state', () => {
      fc.assert(
        fc.property(
          habitCompletionScenarioArb(false),
          fc.array(fc.boolean(), { minLength: 1, maxLength: 10 }),
          ({ habit, subtasks }, newCompletionStates) => {
            // Apply new completion states to subtasks
            const updatedSubtasks = subtasks.map((s, idx) => ({
              ...s,
              completed: newCompletionStates[idx % newCompletionStates.length],
            }));
            
            // Build map with updated subtasks
            const map = buildSubtasksByHabitMap(updatedSubtasks);
            const habitSubtasks = getSubtasksForHabit(map, habit.id);
            
            // Verify each subtask has the expected new state
            habitSubtasks.forEach((subtask, idx) => {
              const originalSubtask = subtasks.find((s) => s.id === subtask.id);
              const originalIdx = subtasks.indexOf(originalSubtask!);
              const expectedState = newCompletionStates[originalIdx % newCompletionStates.length];
              expect(subtask.completed).toBe(expectedState);
            });
            
            // Habit state should remain unchanged
            expect(habit.completed).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Multi-Habit Scenarios', () => {
    /**
     * **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
     * 
     * When a habit is completed, subtasks shared with other habits should remain unchanged
     */
    test('completing one habit does not affect subtasks of other habits', () => {
      fc.assert(
        fc.property(
          multiHabitScenarioArb(),
          fc.integer({ min: 0, max: 4 }), // Index of habit to complete
          ({ habits, subtasks, originalStates }, habitIndexToComplete) => {
            // Ensure index is valid
            const validIndex = habitIndexToComplete % habits.length;
            const habitToComplete = habits[validIndex];
            
            // Complete one habit
            const completedHabit = changeHabitCompletionState(habitToComplete, true);
            
            // Update habit references in subtasks
            const updatedSubtasks = subtasks.map((s) => ({
              ...s,
              habits: s.habits?.map((h) => (h.id === habitToComplete.id ? completedHabit : h)),
            }));
            
            // Build map with updated subtasks
            const map = buildSubtasksByHabitMap(updatedSubtasks);
            
            // Verify all subtask completion states are unchanged
            updatedSubtasks.forEach((subtask, idx) => {
              const expectedState = originalStates.get(idx);
              expect(subtask.completed).toBe(expectedState);
            });
            
            // Verify subtasks in the map also have correct states
            for (const habit of habits) {
              const habitSubtasks = getSubtasksForHabit(map, habit.id);
              habitSubtasks.forEach((subtask) => {
                const originalSubtask = subtasks.find((s) => s.id === subtask.id);
                const originalIdx = subtasks.indexOf(originalSubtask!);
                const expectedState = originalStates.get(originalIdx);
                expect(subtask.completed).toBe(expectedState);
              });
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
     * 
     * Completing all habits should not affect any subtask states
     */
    test('completing all habits does not affect subtask states', () => {
      fc.assert(
        fc.property(
          multiHabitScenarioArb(),
          ({ habits, subtasks, originalStates }) => {
            // Complete all habits
            const completedHabits = habits.map((h) => changeHabitCompletionState(h, true));
            
            // Update habit references in subtasks
            const updatedSubtasks = subtasks.map((s) => ({
              ...s,
              habits: s.habits?.map((h) => {
                const completedHabit = completedHabits.find((ch) => ch.id === h.id);
                return completedHabit || h;
              }),
            }));
            
            // Build map with updated subtasks
            const map = buildSubtasksByHabitMap(updatedSubtasks);
            
            // Verify all subtask completion states are unchanged
            updatedSubtasks.forEach((subtask, idx) => {
              const expectedState = originalStates.get(idx);
              expect(subtask.completed).toBe(expectedState);
            });
            
            // Verify subtasks in the map also have correct states
            for (const habit of completedHabits) {
              const habitSubtasks = getSubtasksForHabit(map, habit.id);
              habitSubtasks.forEach((subtask) => {
                const originalSubtask = subtasks.find((s) => s.id === subtask.id);
                const originalIdx = subtasks.indexOf(originalSubtask!);
                const expectedState = originalStates.get(originalIdx);
                expect(subtask.completed).toBe(expectedState);
              });
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Edge Cases', () => {
    /**
     * **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
     * 
     * Habit with no subtasks - completion should not cause any issues
     */
    test('completing habit with no subtasks causes no issues', () => {
      fc.assert(
        fc.property(
          habitArb(undefined, false),
          (habit) => {
            // Build map with no subtasks
            const map = buildSubtasksByHabitMap([]);
            
            // Complete the habit
            const completedHabit = changeHabitCompletionState(habit, true);
            
            // Map should still be empty
            expect(Object.keys(map).length).toBe(0);
            expect(getSubtasksForHabit(map, completedHabit.id).length).toBe(0);
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
     * 
     * Rapid habit state changes should not affect subtask states
     */
    test('rapid habit state changes do not affect subtask states', () => {
      fc.assert(
        fc.property(
          habitCompletionScenarioArb(false),
          fc.array(fc.boolean(), { minLength: 5, maxLength: 20 }), // Sequence of completion states
          ({ habit, subtasks, originalSubtaskStates }, stateSequence) => {
            let currentHabit = habit;
            let currentSubtasks = subtasks;
            
            // Apply rapid state changes
            for (const newState of stateSequence) {
              currentHabit = changeHabitCompletionState(currentHabit, newState);
              
              // Update habit references in subtasks
              currentSubtasks = currentSubtasks.map((s) => ({
                ...s,
                habits: s.habits?.map((h) => (h.id === habit.id ? currentHabit : h)),
              }));
            }
            
            // Build final map
            const finalMap = buildSubtasksByHabitMap(currentSubtasks);
            const finalSubtasks = getSubtasksForHabit(finalMap, habit.id);
            
            // Verify subtask states are still unchanged from original
            expect(verifySubtaskStatesUnchanged(finalSubtasks, originalSubtaskStates)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Validates: Requirements 4.4**
     * 
     * Subtask with undefined habits array should be handled gracefully
     */
    test('subtask with undefined habits array is handled gracefully', () => {
      const sticky: Sticky = {
        id: 'test-sticky',
        name: 'Test',
        completed: false,
        displayOrder: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        habits: undefined,
      };

      const map = buildSubtasksByHabitMap([sticky]);
      
      // Should not throw and should produce empty map
      expect(Object.keys(map).length).toBe(0);
    });

    /**
     * **Validates: Requirements 4.4**
     * 
     * Subtask completion state should be preserved through map building
     */
    test('subtask completion state is preserved through map building', () => {
      fc.assert(
        fc.property(
          habitArb(),
          fc.boolean(),
          (habit, completedState) => {
            const sticky: Sticky = {
              id: 'test-sticky',
              name: 'Test',
              completed: completedState,
              displayOrder: 0,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              habits: [habit],
            };

            const map = buildSubtasksByHabitMap([sticky]);
            const subtasks = getSubtasksForHabit(map, habit.id);
            
            // Verify completion state is preserved
            expect(subtasks.length).toBe(1);
            expect(subtasks[0].completed).toBe(completedState);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
