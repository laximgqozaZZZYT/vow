/**
 * Property-based tests for Goal Enclosure Layout
 * 
 * Tests the layout algorithm properties that should hold for any valid input:
 * - No overlapping nodes
 * - All nodes have minimum touch target size (44x44px)
 * - Parent enclosures contain their children
 * - Depth is correctly calculated
 * - Circular references are handled safely
 * 
 * Requirements tested:
 * - 3.1: Parent-child relationships
 * - 3.2: Nested Goal enclosures
 * - 3.3: Multiple levels of nesting
 * - 6.3: Touch targets minimum 44x44px
 * - 7.1: Automatically calculate enclosure sizes
 * - 7.2: Expand enclosures to accommodate Habits
 * - 7.4: Minimize visual overlap
 */

import * as fc from 'fast-check';
import {
  buildGoalTree,
  calculateLayout,
  DEFAULT_LAYOUT_CONFIG,
  NODE_ID_PREFIX,
  NODE_TYPES,
  type GoalTreeNode,
  type LayoutConfig,
} from '../app/dashboard/utils/goalEnclosureLayout';
import type { Goal, Habit } from '../app/dashboard/types';

// ============================================================================
// Arbitraries (Test Data Generators)
// ============================================================================

/** Generate a valid Goal ID */
const goalIdArb = fc.stringMatching(/^[a-z0-9]{8,16}$/);

/** Generate a valid Habit ID */
const habitIdArb = fc.stringMatching(/^[a-z0-9]{8,16}$/);

/** Generate a Goal name */
const goalNameArb = fc.string({ minLength: 0, maxLength: 100 });

/** Generate a Habit name */
const habitNameArb = fc.string({ minLength: 0, maxLength: 100 });

/** Generate a minimal Goal for testing */
const goalArb = (id?: string, parentId?: string | null): fc.Arbitrary<Goal> =>
  fc.record({
    id: id ? fc.constant(id) : goalIdArb,
    name: goalNameArb,
    parentId: parentId !== undefined ? fc.constant(parentId) : fc.constant(null),
    isCompleted: fc.boolean(),
    createdAt: fc.constant(new Date().toISOString()),
    updatedAt: fc.constant(new Date().toISOString()),
  });

/** Generate a minimal Habit for testing */
const habitArb = (goalId: string): fc.Arbitrary<Habit> =>
  fc.record({
    id: habitIdArb,
    goalId: fc.constant(goalId),
    name: habitNameArb,
    active: fc.boolean(),
    type: fc.constantFrom('do', 'avoid') as fc.Arbitrary<'do' | 'avoid'>,
    count: fc.integer({ min: 0, max: 100 }),
    must: fc.integer({ min: 1, max: 100 }),
    completed: fc.boolean(),
    createdAt: fc.constant(new Date().toISOString()),
    updatedAt: fc.constant(new Date().toISOString()),
  });

/** Generate a flat list of goals (no hierarchy) */
const flatGoalsArb = (count: number): fc.Arbitrary<Goal[]> =>
  fc.array(goalArb(), { minLength: count, maxLength: count });

/** Generate goals with a simple parent-child hierarchy */
const hierarchicalGoalsArb = (maxDepth: number, maxChildren: number): fc.Arbitrary<Goal[]> =>
  fc.integer({ min: 1, max: 10 }).chain((rootCount) => {
    const goals: Goal[] = [];
    let idCounter = 0;

    const generateLevel = (parentId: string | null, depth: number): void => {
      if (depth > maxDepth) return;

      const childCount = depth === 0 ? rootCount : Math.floor(Math.random() * (maxChildren + 1));
      for (let i = 0; i < childCount; i++) {
        const id = `goal-${idCounter++}`;
        goals.push({
          id,
          name: `Goal ${id}`,
          parentId,
          isCompleted: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        generateLevel(id, depth + 1);
      }
    };

    generateLevel(null, 0);
    return fc.constant(goals);
  });

// ============================================================================
// Property Tests
// ============================================================================

describe('Goal Enclosure Layout Property Tests', () => {
  describe('Property: No overlapping sibling nodes (Requirement 7.4)', () => {
    test('sibling root goals should not overlap horizontally', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 10 }),
          (goalCount) => {
            const goals: Goal[] = [];
            for (let i = 0; i < goalCount; i++) {
              goals.push({
                id: `goal-${i}`,
                name: `Goal ${i}`,
                parentId: null,
                isCompleted: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
            }
            const visibleIds = goals.map((g) => g.id);
            const result = calculateLayout(goals, [], visibleIds);

            const goalNodes = result.nodes.filter(
              (n) => n.type === NODE_TYPES.GOAL_ENCLOSURE && !n.parentNode
            );

            // Check no horizontal overlap between siblings
            for (let i = 0; i < goalNodes.length; i++) {
              for (let j = i + 1; j < goalNodes.length; j++) {
                const nodeA = goalNodes[i];
                const nodeB = goalNodes[j];
                const aRight = nodeA.position.x + (nodeA.style?.width ?? 0);
                const bLeft = nodeB.position.x;
                const bRight = nodeB.position.x + (nodeB.style?.width ?? 0);
                const aLeft = nodeA.position.x;

                // Either A is completely left of B, or B is completely left of A
                const noOverlap = aRight <= bLeft || bRight <= aLeft;
                expect(noOverlap).toBe(true);
              }
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    test('sibling child goals should not overlap horizontally', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 5 }),
          (childCount) => {
            const goals: Goal[] = [
              {
                id: 'parent',
                name: 'Parent',
                parentId: null,
                isCompleted: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ];
            for (let i = 0; i < childCount; i++) {
              goals.push({
                id: `child-${i}`,
                name: `Child ${i}`,
                parentId: 'parent',
                isCompleted: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
            }
            const visibleIds = goals.map((g) => g.id);
            const result = calculateLayout(goals, [], visibleIds);

            const childNodes = result.nodes.filter(
              (n) =>
                n.type === NODE_TYPES.GOAL_ENCLOSURE &&
                n.parentNode === `${NODE_ID_PREFIX.GOAL}parent`
            );

            for (let i = 0; i < childNodes.length; i++) {
              for (let j = i + 1; j < childNodes.length; j++) {
                const nodeA = childNodes[i];
                const nodeB = childNodes[j];
                const aRight = nodeA.position.x + (nodeA.style?.width ?? 0);
                const bLeft = nodeB.position.x;
                const bRight = nodeB.position.x + (nodeB.style?.width ?? 0);
                const aLeft = nodeA.position.x;

                const noOverlap = aRight <= bLeft || bRight <= aLeft;
                expect(noOverlap).toBe(true);
              }
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property: Minimum touch target size (Requirement 6.3)', () => {
    test('all goal enclosures should be at least 44x44px', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 20 }),
          fc.integer({ min: 0, max: 10 }),
          (goalCount, habitsPerGoal) => {
            const goals: Goal[] = [];
            const habits: Habit[] = [];

            for (let i = 0; i < goalCount; i++) {
              const goalId = `goal-${i}`;
              goals.push({
                id: goalId,
                name: `Goal ${i}`,
                parentId: null,
                isCompleted: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });

              for (let j = 0; j < habitsPerGoal; j++) {
                habits.push({
                  id: `habit-${i}-${j}`,
                  goalId,
                  name: `Habit ${j}`,
                  active: true,
                  type: 'do',
                  count: 0,
                  must: 1,
                  completed: false,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                });
              }
            }

            const visibleIds = goals.map((g) => g.id);
            const result = calculateLayout(goals, habits, visibleIds);

            const goalNodes = result.nodes.filter(
              (n) => n.type === NODE_TYPES.GOAL_ENCLOSURE
            );

            for (const node of goalNodes) {
              expect(node.style?.width).toBeGreaterThanOrEqual(44);
              expect(node.style?.height).toBeGreaterThanOrEqual(44);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    test('all habit nodes should be at least 44px tall', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 5 }),
          fc.integer({ min: 1, max: 10 }),
          (goalCount, habitsPerGoal) => {
            const goals: Goal[] = [];
            const habits: Habit[] = [];

            for (let i = 0; i < goalCount; i++) {
              const goalId = `goal-${i}`;
              goals.push({
                id: goalId,
                name: `Goal ${i}`,
                parentId: null,
                isCompleted: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });

              for (let j = 0; j < habitsPerGoal; j++) {
                habits.push({
                  id: `habit-${i}-${j}`,
                  goalId,
                  name: `Habit ${j}`,
                  active: true,
                  type: 'do',
                  count: 0,
                  must: 1,
                  completed: false,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                });
              }
            }

            const visibleIds = goals.map((g) => g.id);
            const result = calculateLayout(goals, habits, visibleIds);

            const habitNodes = result.nodes.filter(
              (n) => n.type === NODE_TYPES.HABIT_NODE
            );

            for (const node of habitNodes) {
              expect(node.style?.height).toBeGreaterThanOrEqual(44);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property: Depth calculation (Requirements 3.1, 3.2, 3.3)', () => {
    test('depth should increase by 1 for each nesting level', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 5 }),
          (maxDepth) => {
            const goals: Goal[] = [];
            let parentId: string | null = null;

            for (let depth = 0; depth <= maxDepth; depth++) {
              const id = `goal-depth-${depth}`;
              goals.push({
                id,
                name: `Goal at depth ${depth}`,
                parentId,
                isCompleted: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
              parentId = id;
            }

            const visibleIds = goals.map((g) => g.id);
            const result = calculateLayout(goals, [], visibleIds);

            for (let depth = 0; depth <= maxDepth; depth++) {
              const node = result.nodes.find(
                (n) => n.id === `${NODE_ID_PREFIX.GOAL}goal-depth-${depth}`
              );
              expect(node?.data.depth).toBe(depth);
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Property: Parent contains children (Requirement 7.3)', () => {
    test('parent enclosure should be larger than child enclosure', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 3 }),
          (childCount) => {
            const goals: Goal[] = [
              {
                id: 'parent',
                name: 'Parent',
                parentId: null,
                isCompleted: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ];

            for (let i = 0; i < childCount; i++) {
              goals.push({
                id: `child-${i}`,
                name: `Child ${i}`,
                parentId: 'parent',
                isCompleted: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
            }

            const visibleIds = goals.map((g) => g.id);
            const result = calculateLayout(goals, [], visibleIds);

            const parentNode = result.nodes.find(
              (n) => n.id === `${NODE_ID_PREFIX.GOAL}parent`
            );
            const childNodes = result.nodes.filter(
              (n) =>
                n.type === NODE_TYPES.GOAL_ENCLOSURE &&
                n.parentNode === `${NODE_ID_PREFIX.GOAL}parent`
            );

            // Parent should be larger than any single child
            for (const child of childNodes) {
              expect(parentNode?.style?.width).toBeGreaterThan(
                child.style?.width ?? 0
              );
              expect(parentNode?.style?.height).toBeGreaterThan(
                child.style?.height ?? 0
              );
            }
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe('Property: Circular reference safety', () => {
    test('should handle self-referencing goals without infinite loop', () => {
      const goal: Goal = {
        id: 'self-ref',
        name: 'Self Reference',
        parentId: 'self-ref',
        isCompleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Should complete without hanging
      const result = calculateLayout([goal], [], ['self-ref']);
      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].data.depth).toBe(0);
    });

    test('should handle mutual circular references without infinite loop', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 5 }),
          (cycleSize) => {
            const goals: Goal[] = [];

            // Create a cycle: goal-0 -> goal-1 -> ... -> goal-n -> goal-0
            for (let i = 0; i < cycleSize; i++) {
              goals.push({
                id: `cycle-${i}`,
                name: `Cycle ${i}`,
                parentId: `cycle-${(i + 1) % cycleSize}`,
                isCompleted: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
            }

            const visibleIds = goals.map((g) => g.id);

            // Should complete without hanging
            const result = calculateLayout(goals, [], visibleIds);

            // All goals should be treated as roots (cycle broken)
            expect(result.nodes.length).toBe(cycleSize);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Property: Empty and edge case handling', () => {
    test('should return empty result for empty inputs', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const result1 = calculateLayout([], [], []);
          expect(result1.nodes).toEqual([]);
          expect(result1.edges).toEqual([]);
          expect(result1.dimensions).toEqual({ width: 0, height: 0 });

          const result2 = calculateLayout(
            [
              {
                id: 'g1',
                name: 'Goal',
                parentId: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ],
            [],
            []
          );
          expect(result2.nodes).toEqual([]);
        }),
        { numRuns: 1 }
      );
    });

    test('should handle goals with non-existent parent gracefully', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }),
          (count) => {
            const goals: Goal[] = [];
            for (let i = 0; i < count; i++) {
              goals.push({
                id: `orphan-${i}`,
                name: `Orphan ${i}`,
                parentId: 'non-existent-parent',
                isCompleted: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
            }

            const visibleIds = goals.map((g) => g.id);
            const result = calculateLayout(goals, [], visibleIds);

            // All should be treated as roots
            expect(result.nodes.length).toBe(count);
            for (const node of result.nodes) {
              expect(node.data.depth).toBe(0);
              expect(node.parentNode).toBeUndefined();
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Property: Habit assignment correctness', () => {
    test('habits should be assigned to correct parent goal nodes', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 5 }),
          fc.integer({ min: 1, max: 5 }),
          (goalCount, habitsPerGoal) => {
            const goals: Goal[] = [];
            const habits: Habit[] = [];

            for (let i = 0; i < goalCount; i++) {
              const goalId = `goal-${i}`;
              goals.push({
                id: goalId,
                name: `Goal ${i}`,
                parentId: null,
                isCompleted: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });

              for (let j = 0; j < habitsPerGoal; j++) {
                habits.push({
                  id: `habit-${i}-${j}`,
                  goalId,
                  name: `Habit ${j} for Goal ${i}`,
                  active: true,
                  type: 'do',
                  count: 0,
                  must: 1,
                  completed: false,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                });
              }
            }

            const visibleIds = goals.map((g) => g.id);
            const result = calculateLayout(goals, habits, visibleIds);

            // Check each habit is assigned to correct parent
            for (let i = 0; i < goalCount; i++) {
              const goalNodeId = `${NODE_ID_PREFIX.GOAL}goal-${i}`;
              const habitNodes = result.nodes.filter(
                (n) =>
                  n.type === NODE_TYPES.HABIT_NODE &&
                  n.parentNode === goalNodeId
              );
              expect(habitNodes.length).toBe(habitsPerGoal);

              for (const habitNode of habitNodes) {
                expect(habitNode.data.parentGoalId).toBe(`goal-${i}`);
              }
            }
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe('Property: Dimensions are positive and reasonable', () => {
    test('total dimensions should encompass all nodes', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }),
          (goalCount) => {
            const goals: Goal[] = [];
            for (let i = 0; i < goalCount; i++) {
              goals.push({
                id: `goal-${i}`,
                name: `Goal ${i}`,
                parentId: null,
                isCompleted: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
            }

            const visibleIds = goals.map((g) => g.id);
            const result = calculateLayout(goals, [], visibleIds);

            // Find the rightmost and bottommost points
            let maxRight = 0;
            let maxBottom = 0;

            for (const node of result.nodes) {
              if (!node.parentNode) {
                // Only check root nodes for total dimensions
                const right = node.position.x + (node.style?.width ?? 0);
                const bottom = node.position.y + (node.style?.height ?? 0);
                maxRight = Math.max(maxRight, right);
                maxBottom = Math.max(maxBottom, bottom);
              }
            }

            // Dimensions should be at least as large as content
            expect(result.dimensions.width).toBeGreaterThanOrEqual(maxRight);
            expect(result.dimensions.height).toBeGreaterThanOrEqual(maxBottom);
          }
        ),
        { numRuns: 30 }
      );
    });
  });
});
