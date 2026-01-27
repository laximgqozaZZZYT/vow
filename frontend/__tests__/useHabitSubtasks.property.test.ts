/**
 * Property-based tests for useHabitSubtasks Hook
 * 
 * Tests the core properties of the Habit-Sticky subtask relationship:
 * - Property 1: Subtask Grouping by Habit
 * - Property 9: Warning Indicator Logic
 * 
 * **Validates: Requirements 1.1, 5.1, 5.2**
 * 
 * Requirements tested:
 * - 1.1: WHEN a Sticky_n has one or more Related Habits selected, THE System SHALL treat that Sticky_n as a subtask of each related Habit
 * - 5.1: WHEN a Habit has one or more associated subtasks AND all subtasks are uncompleted, THE Habit_Card SHALL display a Warning_Indicator
 * - 5.2: WHEN a Habit has one or more associated subtasks AND at least one subtask is completed, THE Habit_Card SHALL NOT display a Warning_Indicator
 */

import * as fc from 'fast-check';
import { buildSubtasksByHabitMap } from '../app/dashboard/hooks/useHabitSubtasks';
import type { Habit, Sticky } from '../app/dashboard/types';

// ============================================================================
// Arbitraries (Test Data Generators)
// ============================================================================

/** Generate a valid ID string */
const idArb = fc.stringMatching(/^[a-z0-9]{8,16}$/);

/** Generate a minimal Habit for testing */
const habitArb = (id?: string): fc.Arbitrary<Habit> =>
  fc.record({
    id: id ? fc.constant(id) : idArb,
    goalId: idArb,
    name: fc.string({ minLength: 1, maxLength: 50 }),
    active: fc.boolean(),
    type: fc.constantFrom('do', 'avoid') as fc.Arbitrary<'do' | 'avoid'>,
    count: fc.integer({ min: 0, max: 100 }),
    must: fc.integer({ min: 1, max: 100 }),
    completed: fc.boolean(),
    createdAt: fc.constant(new Date().toISOString()),
    updatedAt: fc.constant(new Date().toISOString()),
  });

/** Generate a minimal Sticky for testing (without habit relations) */
const baseStickyArb = (id?: string): fc.Arbitrary<Omit<Sticky, 'habits'>> =>
  fc.record({
    id: id ? fc.constant(id) : idArb,
    name: fc.string({ minLength: 1, maxLength: 50 }),
    description: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
    completed: fc.boolean(),
    completedAt: fc.option(fc.constant(new Date().toISOString()), { nil: undefined }),
    displayOrder: fc.integer({ min: 0, max: 1000 }),
    createdAt: fc.constant(new Date().toISOString()),
    updatedAt: fc.constant(new Date().toISOString()),
  });

/**
 * Generate a Sticky with specific habit relations
 * @param habits - Array of habits to potentially relate to
 * @param relatedHabitIndices - Indices of habits this sticky should be related to
 */
const stickyWithHabitsArb = (
  habits: Habit[],
  relatedHabitIndices: number[]
): fc.Arbitrary<Sticky> =>
  baseStickyArb().map((baseSticky) => ({
    ...baseSticky,
    habits: relatedHabitIndices
      .filter((idx) => idx >= 0 && idx < habits.length)
      .map((idx) => habits[idx]),
  }));

/**
 * Generate a test scenario with habits and stickies with various relations
 */
interface TestScenario {
  habits: Habit[];
  stickies: Sticky[];
  /** Map of sticky index to array of habit indices it's related to */
  relations: Map<number, number[]>;
}

const testScenarioArb = (
  maxHabits: number = 5,
  maxStickies: number = 10
): fc.Arbitrary<TestScenario> =>
  fc.integer({ min: 1, max: maxHabits }).chain((habitCount) =>
    fc.integer({ min: 0, max: maxStickies }).chain((stickyCount) =>
      // Generate unique habit IDs first, then create habits with those IDs
      fc.array(idArb, { minLength: habitCount, maxLength: habitCount })
        .map((ids) => [...new Set(ids)]) // Ensure unique IDs
        .filter((ids) => ids.length === habitCount) // Only accept if we got enough unique IDs
        .chain((uniqueIds) =>
          fc.tuple(...uniqueIds.map((id) => habitArb(id)))
        )
        .chain((habits) =>
          fc
            .array(
              fc.tuple(
                baseStickyArb(),
                // Generate array of habit indices this sticky is related to (0 to all habits)
                fc.array(fc.integer({ min: 0, max: habitCount - 1 }), {
                  minLength: 0,
                  maxLength: habitCount,
                })
              ),
              { minLength: stickyCount, maxLength: stickyCount }
            )
            .map((stickyData) => {
              const relations = new Map<number, number[]>();
              const stickies: Sticky[] = stickyData.map(([baseSticky, habitIndices], idx) => {
                // Remove duplicates from habit indices
                const uniqueIndices = [...new Set(habitIndices)];
                relations.set(idx, uniqueIndices);
                return {
                  ...baseSticky,
                  habits: uniqueIndices.map((i) => habits[i]),
                };
              });
              return { habits: Array.from(habits), stickies, relations };
            })
        )
    )
  );

/**
 * Generate a scenario specifically for warning indicator testing
 * with controlled completion states
 * 
 * Updated logic: Warning shows when ANY subtask is incomplete (not ALL)
 */
interface WarningTestScenario {
  habitId: string;
  stickies: Sticky[];
  expectedWarning: boolean;
}

const warningScenarioArb = (): fc.Arbitrary<WarningTestScenario> =>
  fc.oneof(
    // Case 1: No subtasks -> no warning
    habitArb().map((habit) => ({
      habitId: habit.id,
      stickies: [],
      expectedWarning: false,
    })),
    // Case 2: All subtasks incomplete -> warning (has incomplete)
    fc.tuple(habitArb(), fc.integer({ min: 1, max: 5 })).chain(([habit, count]) =>
      fc
        .array(baseStickyArb(), { minLength: count, maxLength: count })
        .map((baseStickies) => ({
          habitId: habit.id,
          stickies: baseStickies.map((s) => ({
            ...s,
            completed: false,
            habits: [habit],
          })),
          expectedWarning: true,
        }))
    ),
    // Case 3: At least one subtask incomplete (mixed) -> warning (has incomplete)
    fc.tuple(habitArb(), fc.integer({ min: 2, max: 5 })).chain(([habit, count]) =>
      fc
        .tuple(
          fc.array(baseStickyArb(), { minLength: count, maxLength: count }),
          fc.integer({ min: 0, max: count - 1 }) // Index of incomplete sticky
        )
        .map(([baseStickies, incompleteIdx]) => ({
          habitId: habit.id,
          stickies: baseStickies.map((s, idx) => ({
            ...s,
            completed: idx !== incompleteIdx, // All complete except one
            habits: [habit],
          })),
          expectedWarning: true, // Warning because there's an incomplete subtask
        }))
    ),
    // Case 4: All subtasks complete -> no warning
    fc.tuple(habitArb(), fc.integer({ min: 1, max: 5 })).chain(([habit, count]) =>
      fc
        .array(baseStickyArb(), { minLength: count, maxLength: count })
        .map((baseStickies) => ({
          habitId: habit.id,
          stickies: baseStickies.map((s) => ({
            ...s,
            completed: true,
            habits: [habit],
          })),
          expectedWarning: false,
        }))
    )
  );

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate expected warning state based on subtasks
 * Warning shows when ANY subtask is incomplete (not ALL)
 * @param subtasks - Array of subtasks for a habit
 * @returns true if warning should be shown
 */
function calculateExpectedWarning(subtasks: Sticky[]): boolean {
  if (subtasks.length === 0) {
    return false;
  }
  // Warning if any subtask is incomplete
  return subtasks.some((s) => !s.completed);
}

/**
 * Count how many times a sticky appears across all habit entries
 * @param map - The subtasksByHabit map
 * @param stickyId - The sticky ID to count
 * @returns Number of habit entries containing this sticky
 */
function countStickyAppearances(
  map: Record<string, Sticky[]>,
  stickyId: string
): number {
  let count = 0;
  // Use Object.keys to safely iterate over null-prototype objects
  for (const habitId of Object.keys(map)) {
    if (map[habitId].some((s) => s.id === stickyId)) {
      count++;
    }
  }
  return count;
}

// ============================================================================
// Property Tests
// ============================================================================

describe('useHabitSubtasks Property Tests', () => {
  describe('Property 1: Subtask Grouping by Habit', () => {
    /**
     * **Validates: Requirements 1.1**
     * 
     * *For any* set of stickies with habit relations, the `subtasksByHabit` map 
     * SHALL correctly group each sticky under all its related habit IDs, such that 
     * a sticky with N related habits appears in exactly N habit entries.
     */
    test('sticky with N related habits appears in exactly N habit entries', () => {
      fc.assert(
        fc.property(testScenarioArb(5, 10), ({ habits, stickies, relations }) => {
          const map = buildSubtasksByHabitMap(stickies);

          // For each sticky, verify it appears in exactly the right number of habit entries
          stickies.forEach((sticky, stickyIdx) => {
            const relatedHabitIndices = relations.get(stickyIdx) || [];
            const expectedAppearances = relatedHabitIndices.length;
            const actualAppearances = countStickyAppearances(map, sticky.id);

            expect(actualAppearances).toBe(expectedAppearances);
          });
        }),
        { numRuns: 100 }
      );
    });

    /**
     * **Validates: Requirements 1.1**
     * 
     * Each sticky should appear under the correct habit IDs (not random ones)
     */
    test('sticky appears under correct habit IDs', () => {
      fc.assert(
        fc.property(testScenarioArb(5, 10), ({ habits, stickies }) => {
          const map = buildSubtasksByHabitMap(stickies);

          stickies.forEach((sticky) => {
            const relatedHabitIds = (sticky.habits || []).map((h) => h.id);

            // Verify sticky appears in each related habit's entry
            relatedHabitIds.forEach((habitId) => {
              const subtasks = map[habitId] || [];
              const found = subtasks.some((s) => s.id === sticky.id);
              expect(found).toBe(true);
            });

            // Verify sticky does NOT appear in unrelated habit entries
            habits.forEach((habit) => {
              if (!relatedHabitIds.includes(habit.id)) {
                const subtasks = map[habit.id] || [];
                const found = subtasks.some((s) => s.id === sticky.id);
                expect(found).toBe(false);
              }
            });
          });
        }),
        { numRuns: 100 }
      );
    });

    /**
     * **Validates: Requirements 1.1**
     * 
     * Stickies without habit relations should not appear in any habit entry
     */
    test('stickies without habit relations are not grouped', () => {
      fc.assert(
        fc.property(
          fc.array(baseStickyArb(), { minLength: 1, maxLength: 10 }),
          (baseStickies) => {
            // Create stickies with no habit relations
            const stickies: Sticky[] = baseStickies.map((s) => ({
              ...s,
              habits: [],
            }));

            const map = buildSubtasksByHabitMap(stickies);

            // Map should be empty
            expect(Object.keys(map).length).toBe(0);
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * **Validates: Requirements 1.1**
     * 
     * Empty stickies array should produce empty map
     */
    test('empty stickies array produces empty map', () => {
      const map = buildSubtasksByHabitMap([]);
      expect(Object.keys(map).length).toBe(0);
    });
  });

  describe('Property 9: Warning Indicator Logic', () => {
    /**
     * **Validates: Updated Requirements**
     * 
     * *For any* habit, the warning indicator SHALL be visible if and only if:
     * (1) the habit has at least one subtask, AND
     * (2) at least one subtask has `completed === false`.
     */
    test('warning shown iff has subtasks AND any incomplete', () => {
      fc.assert(
        fc.property(warningScenarioArb(), ({ habitId, stickies, expectedWarning }) => {
          const map = buildSubtasksByHabitMap(stickies);
          const subtasks = map[habitId] || [];
          const actualWarning = calculateExpectedWarning(subtasks);

          expect(actualWarning).toBe(expectedWarning);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * **Validates: Updated Requirements**
     * 
     * When any subtask is incomplete, warning should be true
     */
    test('any incomplete subtask triggers warning', () => {
      fc.assert(
        fc.property(
          fc.tuple(habitArb(), fc.integer({ min: 1, max: 10 })),
          ([habit, count]) => {
            return fc.assert(
              fc.property(
                fc.array(baseStickyArb(), { minLength: count, maxLength: count }),
                (baseStickies) => {
                  const stickies: Sticky[] = baseStickies.map((s) => ({
                    ...s,
                    completed: false, // All incomplete
                    habits: [habit],
                  }));

                  const map = buildSubtasksByHabitMap(stickies);
                  const subtasks = map[habit.id] || [];
                  const warning = calculateExpectedWarning(subtasks);

                  expect(warning).toBe(true);
                }
              ),
              { numRuns: 10 }
            );
          }
        ),
        { numRuns: 10 }
      );
    });

    /**
     * **Validates: Updated Requirements**
     * 
     * When all subtasks are complete, warning should be false
     */
    test('all complete subtasks prevents warning', () => {
      fc.assert(
        fc.property(
          fc.tuple(habitArb(), fc.integer({ min: 1, max: 10 })),
          ([habit, count]) => {
            return fc.assert(
              fc.property(
                fc.array(baseStickyArb(), { minLength: count, maxLength: count }),
                (baseStickies) => {
                  const stickies: Sticky[] = baseStickies.map((s) => ({
                    ...s,
                    completed: true, // All complete
                    habits: [habit],
                  }));

                  const map = buildSubtasksByHabitMap(stickies);
                  const subtasks = map[habit.id] || [];
                  const warning = calculateExpectedWarning(subtasks);

                  expect(warning).toBe(false);
                }
              ),
              { numRuns: 10 }
            );
          }
        ),
        { numRuns: 10 }
      );
    });

    /**
     * **Validates: Updated Requirements**
     * 
     * No subtasks means no warning (edge case)
     */
    test('no subtasks means no warning', () => {
      fc.assert(
        fc.property(habitArb(), (habit) => {
          const map = buildSubtasksByHabitMap([]);
          const subtasks = map[habit.id] || [];
          const warning = calculateExpectedWarning(subtasks);

          expect(warning).toBe(false);
        }),
        { numRuns: 50 }
      );
    });

    /**
     * **Validates: Updated Requirements**
     * 
     * Mixed completion states (some complete, some not) should show warning
     * because there are incomplete subtasks
     */
    test('mixed completion states show warning due to incomplete subtasks', () => {
      fc.assert(
        fc.property(
          fc.tuple(habitArb(), fc.integer({ min: 2, max: 10 })),
          ([habit, count]) => {
            return fc.assert(
              fc.property(
                fc.tuple(
                  fc.array(baseStickyArb(), { minLength: count, maxLength: count }),
                  fc.array(fc.boolean(), { minLength: count, maxLength: count })
                ),
                ([baseStickies, completionStates]) => {
                  // Ensure at least one is incomplete
                  const hasIncomplete = completionStates.some((c) => !c);
                  if (!hasIncomplete) {
                    completionStates[0] = false;
                  }

                  const stickies: Sticky[] = baseStickies.map((s, idx) => ({
                    ...s,
                    completed: completionStates[idx],
                    habits: [habit],
                  }));

                  const map = buildSubtasksByHabitMap(stickies);
                  const subtasks = map[habit.id] || [];
                  const warning = calculateExpectedWarning(subtasks);

                  // Warning should be true because there's at least one incomplete
                  expect(warning).toBe(true);
                }
              ),
              { numRuns: 10 }
            );
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe('Edge Cases', () => {
    /**
     * Stickies with undefined habits array should be handled gracefully
     */
    test('handles stickies with undefined habits array', () => {
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
      expect(Object.keys(map).length).toBe(0);
    });

    /**
     * Stickies with empty habits array should be handled gracefully
     */
    test('handles stickies with empty habits array', () => {
      const sticky: Sticky = {
        id: 'test-sticky',
        name: 'Test',
        completed: false,
        displayOrder: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        habits: [],
      };

      const map = buildSubtasksByHabitMap([sticky]);
      expect(Object.keys(map).length).toBe(0);
    });

    /**
     * Multiple stickies related to the same habit should all appear in that habit's entry
     */
    test('multiple stickies for same habit are all grouped', () => {
      fc.assert(
        fc.property(
          fc.tuple(habitArb(), fc.integer({ min: 2, max: 10 })),
          ([habit, count]) => {
            return fc.assert(
              fc.property(
                fc.array(baseStickyArb(), { minLength: count, maxLength: count }),
                (baseStickies) => {
                  const stickies: Sticky[] = baseStickies.map((s) => ({
                    ...s,
                    habits: [habit],
                  }));

                  const map = buildSubtasksByHabitMap(stickies);
                  const subtasks = map[habit.id] || [];

                  expect(subtasks.length).toBe(count);
                  stickies.forEach((sticky) => {
                    expect(subtasks.some((s) => s.id === sticky.id)).toBe(true);
                  });
                }
              ),
              { numRuns: 10 }
            );
          }
        ),
        { numRuns: 10 }
      );
    });
  });
});
