/**
 * Unit tests for goalEnclosureLayout.ts
 * 
 * Tests the buildGoalTree and calculateLayout functions which convert
 * a flat array of Goals into a tree structure and calculate positions.
 * 
 * Requirements tested:
 * - 3.1: Parent-child relationships
 * - 3.2: Nested Goal enclosures
 * - 3.3: Multiple levels of nesting (at least 3)
 * - 7.1: Automatically calculate enclosure sizes based on content
 * - 7.2: Expand enclosures to accommodate all Habits
 * - 7.3: Position parent enclosures to contain child enclosures
 * - 7.4: Minimize visual overlap between enclosures
 * - 6.3: Touch targets minimum 44x44px
 */

import { 
  buildGoalTree, 
  calculateLayout, 
  DEFAULT_LAYOUT_CONFIG,
  NODE_ID_PREFIX,
  NODE_TYPES,
  type GoalTreeNode,
  type LayoutConfig,
} from '../goalEnclosureLayout';
import type { Goal, Habit } from '../../types';

// Helper to create a minimal Goal for testing
const createGoal = (id: string, name: string, parentId?: string | null): Goal => ({
  id,
  name,
  parentId: parentId ?? null,
  isCompleted: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

// Helper to create a minimal Habit for testing
const createHabit = (id: string, goalId: string, name: string): Habit => ({
  id,
  goalId,
  name,
  active: true,
  type: 'do',
  count: 0,
  must: 1,
  completed: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

describe('buildGoalTree', () => {
  describe('empty inputs', () => {
    it('should return empty array when goals is empty', () => {
      const result = buildGoalTree([], [], []);
      expect(result).toEqual([]);
    });

    it('should return empty array when visibleGoalIds is empty', () => {
      const goals = [createGoal('1', 'Goal 1')];
      const result = buildGoalTree(goals, [], []);
      expect(result).toEqual([]);
    });

    it('should return empty array when no goals match visibleGoalIds', () => {
      const goals = [createGoal('1', 'Goal 1')];
      const result = buildGoalTree(goals, [], ['non-existent']);
      expect(result).toEqual([]);
    });
  });

  describe('single goal', () => {
    it('should return single root node for one visible goal', () => {
      const goals = [createGoal('1', 'Goal 1')];
      const result = buildGoalTree(goals, [], ['1']);

      expect(result).toHaveLength(1);
      expect(result[0].goal.id).toBe('1');
      expect(result[0].goal.name).toBe('Goal 1');
      expect(result[0].depth).toBe(0);
      expect(result[0].children).toEqual([]);
    });

    it('should include habits for the goal', () => {
      const goals = [createGoal('1', 'Goal 1')];
      const habits = [
        createHabit('h1', '1', 'Habit 1'),
        createHabit('h2', '1', 'Habit 2'),
      ];
      const result = buildGoalTree(goals, habits, ['1']);

      expect(result).toHaveLength(1);
      expect(result[0].habits).toHaveLength(2);
      expect(result[0].habits[0].name).toBe('Habit 1');
      expect(result[0].habits[1].name).toBe('Habit 2');
    });
  });

  describe('parent-child relationships (Requirement 3.1, 3.2)', () => {
    it('should build parent-child relationship correctly', () => {
      const goals = [
        createGoal('parent', 'Parent Goal'),
        createGoal('child', 'Child Goal', 'parent'),
      ];
      const result = buildGoalTree(goals, [], ['parent', 'child']);

      expect(result).toHaveLength(1);
      expect(result[0].goal.id).toBe('parent');
      expect(result[0].children).toHaveLength(1);
      expect(result[0].children[0].goal.id).toBe('child');
    });

    it('should calculate depth correctly for parent-child', () => {
      const goals = [
        createGoal('parent', 'Parent Goal'),
        createGoal('child', 'Child Goal', 'parent'),
      ];
      const result = buildGoalTree(goals, [], ['parent', 'child']);

      expect(result[0].depth).toBe(0);
      expect(result[0].children[0].depth).toBe(1);
    });

    it('should treat child as root when parent is not visible', () => {
      const goals = [
        createGoal('parent', 'Parent Goal'),
        createGoal('child', 'Child Goal', 'parent'),
      ];
      // Only child is visible
      const result = buildGoalTree(goals, [], ['child']);

      expect(result).toHaveLength(1);
      expect(result[0].goal.id).toBe('child');
      expect(result[0].depth).toBe(0);
    });
  });

  describe('multiple levels of nesting (Requirement 3.3)', () => {
    it('should support 3 levels of nesting', () => {
      const goals = [
        createGoal('level0', 'Level 0'),
        createGoal('level1', 'Level 1', 'level0'),
        createGoal('level2', 'Level 2', 'level1'),
      ];
      const result = buildGoalTree(goals, [], ['level0', 'level1', 'level2']);

      expect(result).toHaveLength(1);
      expect(result[0].goal.id).toBe('level0');
      expect(result[0].depth).toBe(0);

      expect(result[0].children).toHaveLength(1);
      expect(result[0].children[0].goal.id).toBe('level1');
      expect(result[0].children[0].depth).toBe(1);

      expect(result[0].children[0].children).toHaveLength(1);
      expect(result[0].children[0].children[0].goal.id).toBe('level2');
      expect(result[0].children[0].children[0].depth).toBe(2);
    });

    it('should support more than 3 levels of nesting', () => {
      const goals = [
        createGoal('l0', 'Level 0'),
        createGoal('l1', 'Level 1', 'l0'),
        createGoal('l2', 'Level 2', 'l1'),
        createGoal('l3', 'Level 3', 'l2'),
        createGoal('l4', 'Level 4', 'l3'),
      ];
      const result = buildGoalTree(goals, [], ['l0', 'l1', 'l2', 'l3', 'l4']);

      // Traverse to level 4
      let node = result[0];
      for (let i = 0; i < 4; i++) {
        expect(node.depth).toBe(i);
        node = node.children[0];
      }
      expect(node.depth).toBe(4);
      expect(node.goal.id).toBe('l4');
    });
  });

  describe('multiple root goals', () => {
    it('should handle multiple root goals', () => {
      const goals = [
        createGoal('root1', 'Root 1'),
        createGoal('root2', 'Root 2'),
        createGoal('root3', 'Root 3'),
      ];
      const result = buildGoalTree(goals, [], ['root1', 'root2', 'root3']);

      expect(result).toHaveLength(3);
      expect(result.map(n => n.goal.id)).toContain('root1');
      expect(result.map(n => n.goal.id)).toContain('root2');
      expect(result.map(n => n.goal.id)).toContain('root3');
    });

    it('should handle multiple siblings under one parent', () => {
      const goals = [
        createGoal('parent', 'Parent'),
        createGoal('child1', 'Child 1', 'parent'),
        createGoal('child2', 'Child 2', 'parent'),
        createGoal('child3', 'Child 3', 'parent'),
      ];
      const result = buildGoalTree(goals, [], ['parent', 'child1', 'child2', 'child3']);

      expect(result).toHaveLength(1);
      expect(result[0].children).toHaveLength(3);
    });
  });

  describe('circular reference handling', () => {
    it('should break simple circular reference (A -> B -> A)', () => {
      // Create goals with circular reference
      const goalA: Goal = {
        id: 'A',
        name: 'Goal A',
        parentId: 'B',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const goalB: Goal = {
        id: 'B',
        name: 'Goal B',
        parentId: 'A',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = buildGoalTree([goalA, goalB], [], ['A', 'B']);

      // Both should be treated as roots due to cycle detection
      expect(result).toHaveLength(2);
      // Neither should have the other as a child (cycle broken)
      expect(result[0].children).toHaveLength(0);
      expect(result[1].children).toHaveLength(0);
    });

    it('should break self-referencing goal', () => {
      const goal: Goal = {
        id: 'self',
        name: 'Self Reference',
        parentId: 'self',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = buildGoalTree([goal], [], ['self']);

      expect(result).toHaveLength(1);
      expect(result[0].goal.id).toBe('self');
      expect(result[0].children).toHaveLength(0);
    });
  });

  describe('invalid parentId handling', () => {
    it('should treat goal with non-existent parentId as root', () => {
      const goals = [
        createGoal('orphan', 'Orphan Goal', 'non-existent-parent'),
      ];
      const result = buildGoalTree(goals, [], ['orphan']);

      expect(result).toHaveLength(1);
      expect(result[0].goal.id).toBe('orphan');
      expect(result[0].depth).toBe(0);
    });
  });

  describe('habit assignment', () => {
    it('should assign habits to correct goals', () => {
      const goals = [
        createGoal('g1', 'Goal 1'),
        createGoal('g2', 'Goal 2'),
      ];
      const habits = [
        createHabit('h1', 'g1', 'Habit for G1'),
        createHabit('h2', 'g2', 'Habit for G2'),
        createHabit('h3', 'g1', 'Another Habit for G1'),
      ];
      const result = buildGoalTree(goals, habits, ['g1', 'g2']);

      const g1Node = result.find(n => n.goal.id === 'g1');
      const g2Node = result.find(n => n.goal.id === 'g2');

      expect(g1Node?.habits).toHaveLength(2);
      expect(g2Node?.habits).toHaveLength(1);
    });

    it('should not include habits for non-visible goals', () => {
      const goals = [
        createGoal('visible', 'Visible Goal'),
        createGoal('hidden', 'Hidden Goal'),
      ];
      const habits = [
        createHabit('h1', 'visible', 'Visible Habit'),
        createHabit('h2', 'hidden', 'Hidden Habit'),
      ];
      const result = buildGoalTree(goals, habits, ['visible']);

      expect(result).toHaveLength(1);
      expect(result[0].habits).toHaveLength(1);
      expect(result[0].habits[0].name).toBe('Visible Habit');
    });
  });
});


describe('calculateLayout', () => {
  describe('empty inputs', () => {
    it('should return empty result when goals is empty', () => {
      const result = calculateLayout([], [], []);
      expect(result.nodes).toEqual([]);
      expect(result.edges).toEqual([]);
      expect(result.dimensions).toEqual({ width: 0, height: 0 });
    });

    it('should return empty result when visibleGoalIds is empty', () => {
      const goals = [createGoal('1', 'Goal 1')];
      const result = calculateLayout(goals, [], []);
      expect(result.nodes).toEqual([]);
      expect(result.edges).toEqual([]);
    });

    it('should return empty result when no goals match visibleGoalIds', () => {
      const goals = [createGoal('1', 'Goal 1')];
      const result = calculateLayout(goals, [], ['non-existent']);
      expect(result.nodes).toEqual([]);
    });
  });

  describe('single goal layout (Requirement 7.1)', () => {
    it('should create enclosure node for single goal', () => {
      const goals = [createGoal('1', 'Goal 1')];
      const result = calculateLayout(goals, [], ['1']);

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].id).toBe(`${NODE_ID_PREFIX.GOAL}1`);
      expect(result.nodes[0].type).toBe(NODE_TYPES.GOAL_ENCLOSURE);
    });

    it('should set correct data on enclosure node', () => {
      const goals = [createGoal('1', 'Goal 1')];
      const result = calculateLayout(goals, [], ['1']);

      const node = result.nodes[0];
      expect(node.data.goal.id).toBe('1');
      expect(node.data.goal.name).toBe('Goal 1');
      expect(node.data.label).toBe('Goal 1');
      expect(node.data.depth).toBe(0);
      expect(node.data.habitCount).toBe(0);
    });

    it('should apply minimum size constraints', () => {
      const goals = [createGoal('1', 'Goal 1')];
      const result = calculateLayout(goals, [], ['1']);

      const node = result.nodes[0];
      expect(node.style?.width).toBeGreaterThanOrEqual(DEFAULT_LAYOUT_CONFIG.minEnclosureWidth);
      expect(node.style?.height).toBeGreaterThanOrEqual(DEFAULT_LAYOUT_CONFIG.minEnclosureHeight);
    });
  });

  describe('goal with habits layout (Requirement 7.2)', () => {
    it('should create habit nodes inside goal enclosure', () => {
      const goals = [createGoal('1', 'Goal 1')];
      const habits = [
        createHabit('h1', '1', 'Habit 1'),
        createHabit('h2', '1', 'Habit 2'),
      ];
      const result = calculateLayout(goals, habits, ['1']);

      // 1 goal node + 2 habit nodes
      expect(result.nodes).toHaveLength(3);

      const habitNodes = result.nodes.filter(n => n.type === NODE_TYPES.HABIT_NODE);
      expect(habitNodes).toHaveLength(2);
    });

    it('should set parentNode on habit nodes', () => {
      const goals = [createGoal('1', 'Goal 1')];
      const habits = [createHabit('h1', '1', 'Habit 1')];
      const result = calculateLayout(goals, habits, ['1']);

      const habitNode = result.nodes.find(n => n.type === NODE_TYPES.HABIT_NODE);
      expect(habitNode?.parentNode).toBe(`${NODE_ID_PREFIX.GOAL}1`);
      expect(habitNode?.extent).toBe('parent');
    });

    it('should expand enclosure to fit habits', () => {
      const goals = [createGoal('1', 'Goal 1')];
      const habits = [
        createHabit('h1', '1', 'Habit 1'),
        createHabit('h2', '1', 'Habit 2'),
        createHabit('h3', '1', 'Habit 3'),
      ];
      const result = calculateLayout(goals, habits, ['1']);

      const goalNode = result.nodes.find(n => n.type === NODE_TYPES.GOAL_ENCLOSURE);
      const expectedMinHeight = 
        DEFAULT_LAYOUT_CONFIG.headerHeight + 
        DEFAULT_LAYOUT_CONFIG.padding * 2 +
        3 * DEFAULT_LAYOUT_CONFIG.habitHeight +
        2 * DEFAULT_LAYOUT_CONFIG.habitGap;

      expect(goalNode?.style?.height).toBeGreaterThanOrEqual(expectedMinHeight);
    });

    it('should set correct data on habit nodes', () => {
      const goals = [createGoal('1', 'Goal 1')];
      const habits = [createHabit('h1', '1', 'Habit 1')];
      const result = calculateLayout(goals, habits, ['1']);

      const habitNode = result.nodes.find(n => n.type === NODE_TYPES.HABIT_NODE);
      expect(habitNode?.data.habit.id).toBe('h1');
      expect(habitNode?.data.habit.name).toBe('Habit 1');
      expect(habitNode?.data.label).toBe('Habit 1');
      expect(habitNode?.data.parentGoalId).toBe('1');
    });
  });

  describe('touch target minimum size (Requirement 6.3)', () => {
    it('should ensure habit nodes are at least 44x44px', () => {
      const goals = [createGoal('1', 'Goal 1')];
      const habits = [createHabit('h1', '1', 'Habit 1')];
      const result = calculateLayout(goals, habits, ['1']);

      const habitNode = result.nodes.find(n => n.type === NODE_TYPES.HABIT_NODE);
      expect(habitNode?.style?.height).toBeGreaterThanOrEqual(44);
      expect(habitNode?.style?.width).toBeGreaterThanOrEqual(44);
    });

    it('should ensure goal enclosures are at least 44x44px', () => {
      const goals = [createGoal('1', 'Goal 1')];
      const result = calculateLayout(goals, [], ['1']);

      const goalNode = result.nodes[0];
      expect(goalNode.style?.width).toBeGreaterThanOrEqual(44);
      expect(goalNode.style?.height).toBeGreaterThanOrEqual(44);
    });
  });

  describe('nested goals layout (Requirement 7.3)', () => {
    it('should set parentNode for nested goal enclosures', () => {
      const goals = [
        createGoal('parent', 'Parent Goal'),
        createGoal('child', 'Child Goal', 'parent'),
      ];
      const result = calculateLayout(goals, [], ['parent', 'child']);

      const childNode = result.nodes.find(n => n.id === `${NODE_ID_PREFIX.GOAL}child`);
      expect(childNode?.parentNode).toBe(`${NODE_ID_PREFIX.GOAL}parent`);
      expect(childNode?.extent).toBe('parent');
    });

    it('should calculate correct depth for nested goals', () => {
      const goals = [
        createGoal('parent', 'Parent Goal'),
        createGoal('child', 'Child Goal', 'parent'),
      ];
      const result = calculateLayout(goals, [], ['parent', 'child']);

      const parentNode = result.nodes.find(n => n.id === `${NODE_ID_PREFIX.GOAL}parent`);
      const childNode = result.nodes.find(n => n.id === `${NODE_ID_PREFIX.GOAL}child`);

      expect(parentNode?.data.depth).toBe(0);
      expect(childNode?.data.depth).toBe(1);
    });

    it('should expand parent to contain child enclosure', () => {
      const goals = [
        createGoal('parent', 'Parent Goal'),
        createGoal('child', 'Child Goal', 'parent'),
      ];
      const result = calculateLayout(goals, [], ['parent', 'child']);

      const parentNode = result.nodes.find(n => n.id === `${NODE_ID_PREFIX.GOAL}parent`);
      const childNode = result.nodes.find(n => n.id === `${NODE_ID_PREFIX.GOAL}child`);

      // Parent should be larger than child
      expect(parentNode?.style?.width).toBeGreaterThan(childNode?.style?.width ?? 0);
      expect(parentNode?.style?.height).toBeGreaterThan(childNode?.style?.height ?? 0);
    });
  });

  describe('sibling positioning (Requirement 7.4)', () => {
    it('should position sibling goals without overlap', () => {
      const goals = [
        createGoal('g1', 'Goal 1'),
        createGoal('g2', 'Goal 2'),
      ];
      const result = calculateLayout(goals, [], ['g1', 'g2']);

      const node1 = result.nodes.find(n => n.id === `${NODE_ID_PREFIX.GOAL}g1`);
      const node2 = result.nodes.find(n => n.id === `${NODE_ID_PREFIX.GOAL}g2`);

      // Nodes should not overlap horizontally
      const node1Right = (node1?.position.x ?? 0) + (node1?.style?.width ?? 0);
      const node2Left = node2?.position.x ?? 0;

      expect(node2Left).toBeGreaterThanOrEqual(node1Right);
    });

    it('should position sibling children without overlap', () => {
      const goals = [
        createGoal('parent', 'Parent'),
        createGoal('child1', 'Child 1', 'parent'),
        createGoal('child2', 'Child 2', 'parent'),
      ];
      const result = calculateLayout(goals, [], ['parent', 'child1', 'child2']);

      const child1 = result.nodes.find(n => n.id === `${NODE_ID_PREFIX.GOAL}child1`);
      const child2 = result.nodes.find(n => n.id === `${NODE_ID_PREFIX.GOAL}child2`);

      // Children should not overlap horizontally
      const child1Right = (child1?.position.x ?? 0) + (child1?.style?.width ?? 0);
      const child2Left = child2?.position.x ?? 0;

      expect(child2Left).toBeGreaterThanOrEqual(child1Right);
    });
  });

  describe('dimensions calculation', () => {
    it('should calculate total dimensions for single goal', () => {
      const goals = [createGoal('1', 'Goal 1')];
      const result = calculateLayout(goals, [], ['1']);

      expect(result.dimensions.width).toBeGreaterThan(0);
      expect(result.dimensions.height).toBeGreaterThan(0);
    });

    it('should calculate total dimensions for multiple goals', () => {
      const goals = [
        createGoal('g1', 'Goal 1'),
        createGoal('g2', 'Goal 2'),
      ];
      const result = calculateLayout(goals, [], ['g1', 'g2']);

      // Width should accommodate both goals side by side
      const node1 = result.nodes.find(n => n.id === `${NODE_ID_PREFIX.GOAL}g1`);
      const node2 = result.nodes.find(n => n.id === `${NODE_ID_PREFIX.GOAL}g2`);
      const expectedMinWidth = 
        (node1?.style?.width ?? 0) + 
        (node2?.style?.width ?? 0) + 
        DEFAULT_LAYOUT_CONFIG.enclosureGap;

      expect(result.dimensions.width).toBeGreaterThanOrEqual(expectedMinWidth);
    });
  });

  describe('completion status', () => {
    it('should propagate goal completion status to node data', () => {
      const goals = [{
        ...createGoal('1', 'Completed Goal'),
        isCompleted: true,
      }];
      const result = calculateLayout(goals, [], ['1']);

      expect(result.nodes[0].data.isCompleted).toBe(true);
    });

    it('should propagate habit completion status to node data', () => {
      const goals = [createGoal('1', 'Goal 1')];
      const habits = [{
        ...createHabit('h1', '1', 'Completed Habit'),
        completed: true,
      }];
      const result = calculateLayout(goals, habits, ['1']);

      const habitNode = result.nodes.find(n => n.type === NODE_TYPES.HABIT_NODE);
      expect(habitNode?.data.isCompleted).toBe(true);
    });
  });

  describe('custom config', () => {
    it('should respect custom layout config', () => {
      const goals = [createGoal('1', 'Goal 1')];
      const customConfig: LayoutConfig = {
        ...DEFAULT_LAYOUT_CONFIG,
        minEnclosureWidth: 300,
        minEnclosureHeight: 200,
      };
      const result = calculateLayout(goals, [], ['1'], customConfig);

      expect(result.nodes[0].style?.width).toBeGreaterThanOrEqual(300);
      expect(result.nodes[0].style?.height).toBeGreaterThanOrEqual(200);
    });
  });

  describe('unnamed elements', () => {
    it('should use placeholder for unnamed goal', () => {
      const goals = [{
        ...createGoal('1', ''),
        name: '',
      }];
      const result = calculateLayout(goals, [], ['1']);

      expect(result.nodes[0].data.label).toBe('Unnamed Goal');
    });

    it('should use placeholder for unnamed habit', () => {
      const goals = [createGoal('1', 'Goal 1')];
      const habits = [{
        ...createHabit('h1', '1', ''),
        name: '',
      }];
      const result = calculateLayout(goals, habits, ['1']);

      const habitNode = result.nodes.find(n => n.type === NODE_TYPES.HABIT_NODE);
      expect(habitNode?.data.label).toBe('Unnamed Habit');
    });
  });
});
