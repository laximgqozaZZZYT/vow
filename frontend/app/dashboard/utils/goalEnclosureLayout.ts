/**
 * Goal Enclosure Layout Types and Interfaces
 *
 * This module defines the types and configuration for the Goal Enclosure Diagram
 * layout calculation. The diagram displays Goals as rectangular enclosures
 * containing their associated Habits, with support for hierarchical relationships.
 *
 * Requirements:
 * - 7.1: Automatically calculate enclosure sizes based on content
 * - 7.2: Expand enclosures to accommodate all Habits
 * - 7.3: Position parent enclosures to contain or connect to child enclosures
 */

import type { Node, Edge } from 'reactflow';
import type { Goal, Habit } from '../types';

// ============================================================================
// Layout Configuration
// ============================================================================

/**
 * Configuration for the layout algorithm.
 * Controls spacing, sizing, and padding of enclosures and elements.
 */
export interface LayoutConfig {
  /** Padding inside enclosures (px) */
  padding: number;
  /** Height of habit elements (px) */
  habitHeight: number;
  /** Gap between habits (px) */
  habitGap: number;
  /** Minimum width for enclosures (px) */
  minEnclosureWidth: number;
  /** Minimum height for enclosures (px) */
  minEnclosureHeight: number;
  /** Additional padding for nested goals (px) */
  nestedPadding: number;
  /** Height of the goal header area (px) */
  headerHeight: number;
  /** Gap between sibling enclosures (px) */
  enclosureGap: number;
}

/**
 * Default layout configuration values.
 * Based on design system spacing (8px base) and accessibility requirements.
 */
export const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  padding: 16,           // --spacing-4 (16px)
  habitHeight: 44,       // Minimum touch target size for accessibility (6.3)
  habitGap: 8,           // --spacing-2 (8px)
  minEnclosureWidth: 200,
  minEnclosureHeight: 100,
  nestedPadding: 8,      // --spacing-2 (8px)
  headerHeight: 40,      // Space for goal name header
  enclosureGap: 24,      // --spacing-6 (24px) between sibling enclosures
};

// ============================================================================
// Tree Structure Types
// ============================================================================

/**
 * Tree node for layout calculation.
 * Represents a Goal with its associated Habits and child Goals in a tree structure.
 * Used internally by the layout algorithm to calculate positions and sizes.
 */
export interface GoalTreeNode {
  /** The Goal data */
  goal: Goal;
  /** Habits belonging to this Goal */
  habits: Habit[];
  /** Child Goals (nested enclosures) */
  children: GoalTreeNode[];
  /** Nesting depth (0 = root, 1 = child, etc.) */
  depth: number;
  /** Calculated width of the enclosure (px) */
  width: number;
  /** Calculated height of the enclosure (px) */
  height: number;
  /** X position relative to parent or canvas (px) */
  x: number;
  /** Y position relative to parent or canvas (px) */
  y: number;
}

// ============================================================================
// Layout Result Types
// ============================================================================

/**
 * Result of the layout calculation.
 * Contains React Flow nodes and edges ready for rendering.
 */
export interface LayoutResult {
  /** React Flow nodes (Goal enclosures and Habit elements) */
  nodes: Node[];
  /** React Flow edges (connections between elements, if any) */
  edges: Edge[];
  /** Total dimensions of the diagram */
  dimensions: {
    width: number;
    height: number;
  };
}

// ============================================================================
// React Flow Node Data Types
// ============================================================================

/**
 * Data for Goal enclosure nodes in React Flow.
 * Used by the GoalEnclosureNode component.
 */
export interface GoalEnclosureNodeData {
  /** The Goal data */
  goal: Goal;
  /** Number of Habits in this Goal */
  habitCount: number;
  /** Whether the Goal is completed */
  isCompleted: boolean;
  /** Nesting depth (0 = root, 1 = child, etc.) */
  depth: number;
  /** Label for display (Goal name) */
  label: string;
}

/**
 * Data for Habit nodes in React Flow.
 * Used by the HabitNode component.
 */
export interface HabitNodeData {
  /** The Habit data */
  habit: Habit;
  /** Whether the Habit is completed */
  isCompleted: boolean;
  /** ID of the parent Goal */
  parentGoalId: string;
  /** Label for display (Habit name) */
  label: string;
}

// ============================================================================
// React Flow Node Types (Extended)
// ============================================================================

/**
 * React Flow node for Goal enclosures.
 * Extends the base Node type with specific data and styling.
 */
export interface EnclosureNode extends Node<GoalEnclosureNodeData> {
  type: 'goalEnclosure';
  style: {
    width: number;
    height: number;
  };
  /** Parent node ID for nested enclosures */
  parentNode?: string;
  /** Extent constraint for nested nodes */
  extent?: 'parent';
}

/**
 * React Flow node for Habits.
 * Always rendered inside a Goal enclosure.
 */
export interface HabitFlowNode extends Node<HabitNodeData> {
  type: 'habitNode';
  /** Parent Goal enclosure node ID */
  parentNode: string;
  /** Extent constraint - always 'parent' for Habits */
  extent: 'parent';
}

// ============================================================================
// Visibility State
// ============================================================================

/**
 * State for controlling which Goals and Habits are visible in the diagram.
 */
export interface VisibilityState {
  /** IDs of Goals that should be visible */
  visibleGoalIds: string[];
  /** Whether to show Habits without a valid Goal */
  showUnassignedHabits: boolean;
}

/**
 * Default visibility state - show all Goals, hide unassigned Habits.
 */
export const DEFAULT_VISIBILITY_STATE: VisibilityState = {
  visibleGoalIds: [],
  showUnassignedHabits: false,
};

// ============================================================================
// Node Type Constants
// ============================================================================

/**
 * Custom node type identifiers for React Flow.
 */
export const NODE_TYPES = {
  GOAL_ENCLOSURE: 'goalEnclosure',
  HABIT_NODE: 'habitNode',
} as const;

/**
 * Node ID prefixes for distinguishing node types.
 */
export const NODE_ID_PREFIX = {
  GOAL: 'goal-',
  HABIT: 'habit-',
  UNASSIGNED: 'unassigned-',
} as const;

// ============================================================================
// Tree Building Functions
// ============================================================================

/**
 * Builds a tree structure from a flat array of Goals.
 * 
 * This function:
 * 1. Filters goals based on visibleGoalIds
 * 2. Builds a map of goalId -> habits
 * 3. Builds tree structure from parentId relationships
 * 4. Detects and breaks circular references
 * 5. Calculates depth for each node
 * 
 * Requirements:
 * - 3.1: Visually represent parent-child relationships
 * - 3.2: Render child Goal enclosures inside or connected to parent
 * - 3.3: Support at least 3 levels of nesting
 * 
 * @param goals - Flat array of all Goals
 * @param habits - Flat array of all Habits
 * @param visibleGoalIds - Array of Goal IDs that should be visible
 * @returns Array of root-level GoalTreeNodes
 */
export function buildGoalTree(
  goals: Goal[],
  habits: Habit[],
  visibleGoalIds: string[]
): GoalTreeNode[] {
  // Handle empty inputs
  if (!goals || goals.length === 0) {
    return [];
  }

  // Create a set of visible goal IDs for O(1) lookup
  const visibleSet = new Set(visibleGoalIds);

  // Filter goals to only include visible ones
  const visibleGoals = goals.filter((goal) => visibleSet.has(goal.id));

  // If no visible goals, return empty array
  if (visibleGoals.length === 0) {
    return [];
  }

  // Build a map of goalId -> habits for O(1) lookup
  const habitsByGoalId = new Map<string, Habit[]>();
  for (const habit of habits) {
    if (habit.goalId) {
      const existing = habitsByGoalId.get(habit.goalId) || [];
      existing.push(habit);
      habitsByGoalId.set(habit.goalId, existing);
    }
  }

  // Create a map of goalId -> Goal for O(1) lookup
  const goalMap = new Map<string, Goal>();
  for (const goal of visibleGoals) {
    goalMap.set(goal.id, goal);
  }

  // Detect circular references using DFS
  // Returns a set of goal IDs that are part of cycles
  const detectCycles = (): Set<string> => {
    const cycleNodes = new Set<string>();
    const visited = new Set<string>();
    const inStack = new Set<string>();

    const dfs = (goalId: string, path: string[]): boolean => {
      if (inStack.has(goalId)) {
        // Found a cycle - mark all nodes in the cycle
        const cycleStart = path.indexOf(goalId);
        for (let i = cycleStart; i < path.length; i++) {
          cycleNodes.add(path[i]);
        }
        return true;
      }

      if (visited.has(goalId)) {
        return false;
      }

      visited.add(goalId);
      inStack.add(goalId);
      path.push(goalId);

      const goal = goalMap.get(goalId);
      if (goal?.parentId && goalMap.has(goal.parentId)) {
        dfs(goal.parentId, path);
      }

      path.pop();
      inStack.delete(goalId);
      return false;
    };

    // Run DFS from each visible goal
    for (const goal of visibleGoals) {
      if (!visited.has(goal.id)) {
        dfs(goal.id, []);
      }
    }

    return cycleNodes;
  };

  const cycleNodes = detectCycles();

  // Build tree nodes with initial values (dimensions will be calculated later)
  const treeNodeMap = new Map<string, GoalTreeNode>();

  for (const goal of visibleGoals) {
    const treeNode: GoalTreeNode = {
      goal,
      habits: habitsByGoalId.get(goal.id) || [],
      children: [],
      depth: 0, // Will be calculated after tree is built
      width: 0, // Will be calculated by layout algorithm
      height: 0,
      x: 0,
      y: 0,
    };
    treeNodeMap.set(goal.id, treeNode);
  }

  // Build parent-child relationships
  // A goal is a root if:
  // 1. It has no parentId, OR
  // 2. Its parentId is not in the visible set, OR
  // 3. It's part of a cycle (break cycle by treating as root)
  const rootNodes: GoalTreeNode[] = [];

  for (const goal of visibleGoals) {
    const treeNode = treeNodeMap.get(goal.id)!;
    const parentId = goal.parentId;

    // Determine if this node should be a root
    const hasNoParent = !parentId;
    const parentNotVisible = parentId && !goalMap.has(parentId);
    const isInCycle = cycleNodes.has(goal.id);

    if (hasNoParent || parentNotVisible || isInCycle) {
      // This is a root node
      rootNodes.push(treeNode);
    } else if (parentId) {
      // This node has a visible parent - add as child
      const parentNode = treeNodeMap.get(parentId);
      if (parentNode) {
        parentNode.children.push(treeNode);
      }
    }
  }

  // Calculate depth for each node using BFS
  const calculateDepths = (nodes: GoalTreeNode[], depth: number): void => {
    for (const node of nodes) {
      node.depth = depth;
      if (node.children.length > 0) {
        calculateDepths(node.children, depth + 1);
      }
    }
  };

  calculateDepths(rootNodes, 0);

  return rootNodes;
}

// ============================================================================
// Layout Calculation Functions
// ============================================================================

/**
 * Calculates the size of a GoalTreeNode based on its content.
 * This is done bottom-up: children are sized first, then parents.
 * 
 * The size calculation considers:
 * - Header height for the goal name
 * - Habits stacked vertically with gaps
 * - Child goals arranged horizontally with gaps
 * - Padding around all content
 * - Minimum size constraints (44x44px for touch targets)
 * 
 * Requirements:
 * - 7.1: Automatically calculate enclosure sizes based on content
 * - 7.2: Expand enclosures to accommodate all Habits
 * - 6.3: Touch targets minimum 44x44px
 * 
 * @param node - The GoalTreeNode to calculate size for
 * @param config - Layout configuration
 */
function calculateNodeSize(node: GoalTreeNode, config: LayoutConfig): void {
  // First, recursively calculate sizes for all children (bottom-up)
  for (const child of node.children) {
    calculateNodeSize(child, config);
  }

  // Calculate content dimensions
  const { padding, habitHeight, habitGap, headerHeight, enclosureGap, nestedPadding } = config;

  // Calculate habits area height (habits stacked vertically)
  const habitsCount = node.habits.length;
  const habitsHeight = habitsCount > 0
    ? habitsCount * habitHeight + (habitsCount - 1) * habitGap
    : 0;

  // Calculate children area dimensions (children arranged horizontally)
  let childrenWidth = 0;
  let childrenHeight = 0;

  if (node.children.length > 0) {
    // Children are arranged horizontally with gaps
    for (const child of node.children) {
      childrenWidth += child.width;
      childrenHeight = Math.max(childrenHeight, child.height);
    }
    // Add gaps between children
    childrenWidth += (node.children.length - 1) * enclosureGap;
  }

  // Calculate minimum width needed for habits (assuming fixed habit width)
  const habitWidth = 180; // Fixed width for habit elements
  const habitsWidth = habitsCount > 0 ? habitWidth : 0;

  // Calculate total content width and height
  // Content layout: header on top, then habits and children side by side
  // For simplicity, we'll stack habits above children
  const contentWidth = Math.max(habitsWidth, childrenWidth);
  const contentHeight = habitsHeight + (habitsHeight > 0 && childrenHeight > 0 ? habitGap : 0) + childrenHeight;

  // Add padding and header
  const totalWidth = contentWidth + padding * 2;
  const totalHeight = headerHeight + contentHeight + padding * 2;

  // Apply minimum size constraints (including touch target minimum of 44x44px)
  const minWidth = Math.max(config.minEnclosureWidth, 44);
  const minHeight = Math.max(config.minEnclosureHeight, 44);

  node.width = Math.max(totalWidth, minWidth);
  node.height = Math.max(totalHeight, minHeight);
}

/**
 * Positions sibling nodes to avoid overlap.
 * Siblings are arranged horizontally with gaps between them.
 * 
 * Requirements:
 * - 7.4: Minimize visual overlap between enclosures
 * 
 * @param nodes - Array of sibling GoalTreeNodes
 * @param startX - Starting X position
 * @param startY - Starting Y position
 * @param config - Layout configuration
 * @returns Total width occupied by all siblings
 */
function positionSiblings(
  nodes: GoalTreeNode[],
  startX: number,
  startY: number,
  config: LayoutConfig
): number {
  let currentX = startX;

  for (const node of nodes) {
    node.x = currentX;
    node.y = startY;
    currentX += node.width + config.enclosureGap;
  }

  // Return total width (excluding trailing gap)
  return nodes.length > 0
    ? currentX - config.enclosureGap - startX
    : 0;
}

/**
 * Positions child nodes within their parent enclosure.
 * This is done top-down: parents are positioned first, then children.
 * 
 * Requirements:
 * - 7.3: Position parent enclosures to contain or connect to child enclosures
 * 
 * @param node - The parent GoalTreeNode
 * @param config - Layout configuration
 */
function positionChildNodes(node: GoalTreeNode, config: LayoutConfig): void {
  const { padding, headerHeight, habitHeight, habitGap } = config;

  // Calculate where children should start (after header and habits)
  const habitsCount = node.habits.length;
  const habitsHeight = habitsCount > 0
    ? habitsCount * habitHeight + (habitsCount - 1) * habitGap
    : 0;

  // Children start after header, habits, and a gap
  const childrenStartY = headerHeight + padding + habitsHeight + (habitsHeight > 0 ? habitGap : 0);
  const childrenStartX = padding;

  // Position children horizontally
  positionSiblings(node.children, childrenStartX, childrenStartY, config);

  // Recursively position grandchildren
  for (const child of node.children) {
    positionChildNodes(child, config);
  }
}

/**
 * Converts a GoalTreeNode to React Flow nodes (enclosure + habits).
 * 
 * @param treeNode - The GoalTreeNode to convert
 * @param parentNodeId - ID of the parent React Flow node (undefined for root)
 * @param config - Layout configuration
 * @returns Array of React Flow nodes
 */
function treeNodeToFlowNodes(
  treeNode: GoalTreeNode,
  parentNodeId: string | undefined,
  config: LayoutConfig
): Node[] {
  const nodes: Node[] = [];
  const { padding, headerHeight, habitHeight, habitGap } = config;

  // Create the Goal enclosure node
  const goalNodeId = `${NODE_ID_PREFIX.GOAL}${treeNode.goal.id}`;
  const enclosureNode: EnclosureNode = {
    id: goalNodeId,
    type: NODE_TYPES.GOAL_ENCLOSURE,
    position: { x: treeNode.x, y: treeNode.y },
    data: {
      goal: treeNode.goal,
      habitCount: treeNode.habits.length,
      isCompleted: treeNode.goal.isCompleted ?? false,
      depth: treeNode.depth,
      label: treeNode.goal.name || 'Unnamed Goal',
    },
    style: {
      width: treeNode.width,
      height: treeNode.height,
    },
    ...(parentNodeId && {
      parentNode: parentNodeId,
      extent: 'parent' as const,
    }),
  };
  nodes.push(enclosureNode);

  // Create Habit nodes inside the enclosure
  let habitY = headerHeight + padding;
  const habitWidth = 180; // Fixed width for habit elements
  const habitX = padding;

  for (const habit of treeNode.habits) {
    const habitNode: HabitFlowNode = {
      id: `${NODE_ID_PREFIX.HABIT}${habit.id}`,
      type: NODE_TYPES.HABIT_NODE,
      position: { x: habitX, y: habitY },
      data: {
        habit,
        isCompleted: habit.completed ?? false,
        parentGoalId: treeNode.goal.id,
        label: habit.name || 'Unnamed Habit',
      },
      parentNode: goalNodeId,
      extent: 'parent',
      style: {
        width: habitWidth,
        height: habitHeight,
      },
    };
    nodes.push(habitNode);
    habitY += habitHeight + habitGap;
  }

  // Recursively convert child nodes
  for (const child of treeNode.children) {
    const childNodes = treeNodeToFlowNodes(child, goalNodeId, config);
    nodes.push(...childNodes);
  }

  return nodes;
}

/**
 * Calculates the layout for the Goal Enclosure Diagram.
 * 
 * This function:
 * 1. Calls buildGoalTree to get the tree structure
 * 2. Calculates sizes for each node (bottom-up, from leaves to roots)
 * 3. Positions nodes (top-down, from roots to leaves)
 * 4. Converts GoalTreeNodes to React Flow nodes
 * 5. Returns LayoutResult with nodes, edges, and dimensions
 * 
 * Requirements:
 * - 7.1: Automatically calculate enclosure sizes based on content
 * - 7.2: Expand enclosures to accommodate all Habits
 * - 7.3: Position parent enclosures to contain or connect to child enclosures
 * - 7.4: Minimize visual overlap between enclosures
 * - 6.3: Touch targets minimum 44x44px
 * 
 * @param goals - Array of all Goals
 * @param habits - Array of all Habits
 * @param visibleGoalIds - Array of Goal IDs that should be visible
 * @param config - Layout configuration (defaults to DEFAULT_LAYOUT_CONFIG)
 * @returns LayoutResult with React Flow nodes, edges, and dimensions
 */
export function calculateLayout(
  goals: Goal[],
  habits: Habit[],
  visibleGoalIds: string[],
  config: LayoutConfig = DEFAULT_LAYOUT_CONFIG
): LayoutResult {
  // Handle empty inputs
  if (!goals || goals.length === 0 || !visibleGoalIds || visibleGoalIds.length === 0) {
    return {
      nodes: [],
      edges: [],
      dimensions: { width: 0, height: 0 },
    };
  }

  // Step 1: Build the tree structure
  const rootNodes = buildGoalTree(goals, habits, visibleGoalIds);

  // Handle case where no visible goals result in tree nodes
  if (rootNodes.length === 0) {
    return {
      nodes: [],
      edges: [],
      dimensions: { width: 0, height: 0 },
    };
  }

  // Step 2: Calculate sizes (bottom-up)
  for (const root of rootNodes) {
    calculateNodeSize(root, config);
  }

  // Step 3: Position root nodes (top-down)
  // Root nodes are arranged horizontally at the top
  positionSiblings(rootNodes, 0, 0, config);

  // Step 4: Position child nodes within each root
  for (const root of rootNodes) {
    positionChildNodes(root, config);
  }

  // Step 5: Convert to React Flow nodes
  const nodes: Node[] = [];
  for (const root of rootNodes) {
    const flowNodes = treeNodeToFlowNodes(root, undefined, config);
    nodes.push(...flowNodes);
  }

  // Step 6: Calculate total dimensions
  let totalWidth = 0;
  let totalHeight = 0;

  for (const root of rootNodes) {
    totalWidth = Math.max(totalWidth, root.x + root.width);
    totalHeight = Math.max(totalHeight, root.y + root.height);
  }

  // Add some margin around the diagram
  const margin = config.enclosureGap;
  totalWidth += margin;
  totalHeight += margin;

  // Currently no edges are needed for the enclosure diagram
  // (hierarchy is shown through nesting, not connections)
  const edges: Edge[] = [];

  return {
    nodes,
    edges,
    dimensions: {
      width: totalWidth,
      height: totalHeight,
    },
  };
}
