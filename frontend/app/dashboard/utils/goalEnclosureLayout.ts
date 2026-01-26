/**
 * Goal Enclosure Layout Types and Interfaces
 *
 * This module defines the types and configuration for the Goal Enclosure Diagram
 * layout calculation. The diagram displays Goals as rectangular enclosures
 * containing their associated Habits, with support for hierarchical relationships.
 * 
 * Supports L-shaped and bent layouts for tall enclosures (Modular Tetris style).
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
  /** Maximum width for enclosures (px) */
  maxEnclosureWidth: number;
  /** Maximum height for enclosures (px) */
  maxEnclosureHeight: number;
}

/**
 * Default layout configuration values.
 * Optimized for tight packing without overlap.
 */
export const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  padding: 4,
  habitHeight: 32,
  habitGap: 2,
  minEnclosureWidth: 160,
  minEnclosureHeight: 60,
  nestedPadding: 4,
  headerHeight: 28,
  enclosureGap: 2,
  maxEnclosureWidth: 400,
  maxEnclosureHeight: 300,
};

// ============================================================================
// Tree Structure Types
// ============================================================================

/**
 * Segment of a bent Goal enclosure.
 * A Goal can be split into multiple segments to form L-shape or other bent shapes.
 */
export interface GoalSegment {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Which habits are in this segment (indices) */
  habitIndices: number[];
  /** Which children are in this segment (indices) */
  childIndices: number[];
  /** Is this the header segment (contains goal name) */
  isHeader: boolean;
}

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
  /** Calculated width of the enclosure (px) - bounding box */
  width: number;
  /** Calculated height of the enclosure (px) - bounding box */
  height: number;
  /** X position relative to parent or canvas (px) */
  x: number;
  /** Y position relative to parent or canvas (px) */
  y: number;
  /** Segments for bent layout (if bent) */
  segments?: GoalSegment[];
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

/** Habit width constant - compact */
const HABIT_WIDTH = 140;

/**
 * Calculates the size of a GoalTreeNode with max width/height constraints.
 * Habits and children wrap to next row when exceeding max width.
 * 
 * @param node - The GoalTreeNode to calculate size for
 * @param config - Layout configuration
 */
function calculateNodeSize(node: GoalTreeNode, config: LayoutConfig): void {
  // First, recursively calculate sizes for all children (bottom-up)
  for (const child of node.children) {
    calculateNodeSize(child, config);
  }

  const { padding, habitHeight, habitGap, headerHeight, enclosureGap, maxEnclosureWidth } = config;
  
  const habitsCount = node.habits.length;
  const childCount = node.children.length;
  
  // Available content width (inside padding)
  const maxContentWidth = maxEnclosureWidth - padding * 2;
  
  // Calculate habits layout with wrapping
  let habitsWidth = 0;
  let habitsHeight = 0;
  
  if (habitsCount > 0) {
    // Calculate how many habits fit per row
    const habitsPerRow = Math.max(1, Math.floor((maxContentWidth + habitGap) / (HABIT_WIDTH + habitGap)));
    const habitRows = Math.ceil(habitsCount / habitsPerRow);
    const actualHabitsPerRow = Math.min(habitsCount, habitsPerRow);
    
    habitsWidth = actualHabitsPerRow * HABIT_WIDTH + (actualHabitsPerRow - 1) * habitGap;
    habitsHeight = habitRows * habitHeight + (habitRows - 1) * habitGap;
  }
  
  // Calculate children layout with wrapping
  let childrenWidth = 0;
  let childrenHeight = 0;
  
  if (childCount > 0) {
    // Flow layout: place children left-to-right, wrap when exceeding max width
    let currentRowWidth = 0;
    let currentRowHeight = 0;
    let totalHeight = 0;
    let maxRowWidth = 0;
    
    for (const child of node.children) {
      if (currentRowWidth > 0 && currentRowWidth + enclosureGap + child.width > maxContentWidth) {
        // Wrap to next row
        maxRowWidth = Math.max(maxRowWidth, currentRowWidth);
        totalHeight += currentRowHeight + enclosureGap;
        currentRowWidth = child.width;
        currentRowHeight = child.height;
      } else {
        if (currentRowWidth > 0) {
          currentRowWidth += enclosureGap;
        }
        currentRowWidth += child.width;
        currentRowHeight = Math.max(currentRowHeight, child.height);
      }
    }
    // Add last row
    maxRowWidth = Math.max(maxRowWidth, currentRowWidth);
    totalHeight += currentRowHeight;
    
    childrenWidth = maxRowWidth;
    childrenHeight = totalHeight;
  }
  
  const contentWidth = Math.max(habitsWidth, childrenWidth);
  const contentHeight = habitsHeight + 
    (habitsHeight > 0 && childrenHeight > 0 ? enclosureGap : 0) + 
    childrenHeight;
  
  node.width = Math.min(
    Math.max(contentWidth + padding * 2, config.minEnclosureWidth),
    maxEnclosureWidth
  );
  node.height = Math.max(headerHeight + contentHeight + padding * 2, config.minEnclosureHeight);
  
  // Clear segments - not using bent layout anymore
  node.segments = undefined;
}

/**
 * Positions sibling nodes using a 2D bin-packing algorithm (Modular Tetris style).
 * Places nodes to fill gaps efficiently with minimal wasted space.
 * 
 * Algorithm (Guillotine bin packing):
 * 1. Sort nodes by area (largest first)
 * 2. Maintain list of free rectangles
 * 3. For each node, find best-fit free rectangle
 * 4. Split remaining space into new free rectangles
 * 
 * @param nodes - Array of sibling GoalTreeNodes
 * @param startX - Starting X position
 * @param startY - Starting Y position
 * @param config - Layout configuration
 * @returns Object with total width and height occupied
 */
function positionSiblingsGrid(
  nodes: GoalTreeNode[],
  startX: number,
  startY: number,
  config: LayoutConfig,
  _unused: number = 1200
): { width: number; height: number } {
  if (nodes.length === 0) {
    return { width: 0, height: 0 };
  }

  const gap = config.enclosureGap;
  
  // Sort nodes by area (largest first) for better packing
  const sortedNodes = [...nodes].sort((a, b) => {
    const areaA = a.width * a.height;
    const areaB = b.width * b.height;
    return areaB - areaA;
  });
  
  // Free rectangles (available spaces)
  interface FreeRect {
    x: number;
    y: number;
    width: number;
    height: number;
  }
  
  // Start with a large initial free rectangle
  const initialWidth = sortedNodes.reduce((sum, n) => sum + n.width + gap, 0);
  const initialHeight = sortedNodes.reduce((sum, n) => Math.max(sum, n.height), 0) * 3;
  
  let freeRects: FreeRect[] = [
    { x: 0, y: 0, width: initialWidth, height: initialHeight }
  ];
  
  let maxX = 0;
  let maxY = 0;
  
  for (const node of sortedNodes) {
    const nodeW = node.width + gap;
    const nodeH = node.height + gap;
    
    // Find best-fit free rectangle (smallest area that fits)
    let bestRect: FreeRect | null = null;
    let bestRectIndex = -1;
    let bestScore = Infinity;
    
    for (let i = 0; i < freeRects.length; i++) {
      const rect = freeRects[i];
      if (rect.width >= nodeW && rect.height >= nodeH) {
        // Score: prefer rectangles that minimize wasted space
        const score = rect.width * rect.height - nodeW * nodeH;
        if (score < bestScore) {
          bestScore = score;
          bestRect = rect;
          bestRectIndex = i;
        }
      }
    }
    
    if (bestRect) {
      // Place node in this rectangle
      node.x = startX + bestRect.x;
      node.y = startY + bestRect.y;
      
      maxX = Math.max(maxX, node.x + node.width - startX);
      maxY = Math.max(maxY, node.y + node.height - startY);
      
      // Remove used rectangle
      freeRects.splice(bestRectIndex, 1);
      
      // Split remaining space (Guillotine split)
      // Right remainder
      if (bestRect.width - nodeW > gap) {
        freeRects.push({
          x: bestRect.x + nodeW,
          y: bestRect.y,
          width: bestRect.width - nodeW,
          height: nodeH,
        });
      }
      
      // Bottom remainder
      if (bestRect.height - nodeH > gap) {
        freeRects.push({
          x: bestRect.x,
          y: bestRect.y + nodeH,
          width: bestRect.width,
          height: bestRect.height - nodeH,
        });
      }
      
      // Merge overlapping free rectangles to reduce fragmentation
      freeRects = mergeFreeRects(freeRects);
    }
  }
  
  return { width: maxX, height: maxY };
}

/**
 * Merge overlapping or adjacent free rectangles
 */
function mergeFreeRects(rects: { x: number; y: number; width: number; height: number }[]): { x: number; y: number; width: number; height: number }[] {
  // Simple deduplication - remove rectangles fully contained in others
  const result: { x: number; y: number; width: number; height: number }[] = [];
  
  for (const rect of rects) {
    let isContained = false;
    for (const other of rects) {
      if (rect !== other &&
          rect.x >= other.x &&
          rect.y >= other.y &&
          rect.x + rect.width <= other.x + other.width &&
          rect.y + rect.height <= other.y + other.height) {
        isContained = true;
        break;
      }
    }
    if (!isContained) {
      result.push(rect);
    }
  }
  
  return result;
}

/**
 * Positions child nodes within their parent enclosure.
 * Uses flow layout with wrapping based on max width.
 * 
 * @param node - The parent GoalTreeNode
 * @param config - Layout configuration
 */
function positionChildNodes(node: GoalTreeNode, config: LayoutConfig): void {
  const { padding, headerHeight, habitHeight, habitGap, enclosureGap, maxEnclosureWidth } = config;
  
  const maxContentWidth = maxEnclosureWidth - padding * 2;
  
  // Calculate habits area with wrapping
  const habitsCount = node.habits.length;
  let habitsHeight = 0;
  
  if (habitsCount > 0) {
    const habitsPerRow = Math.max(1, Math.floor((maxContentWidth + habitGap) / (HABIT_WIDTH + habitGap)));
    const habitRows = Math.ceil(habitsCount / habitsPerRow);
    habitsHeight = habitRows * habitHeight + (habitRows - 1) * habitGap;
  }

  const childrenStartY = headerHeight + padding + habitsHeight + 
    (habitsHeight > 0 && node.children.length > 0 ? enclosureGap : 0);
  
  if (node.children.length > 0) {
    // Flow layout with wrapping
    let currentX = padding;
    let currentY = childrenStartY;
    let rowMaxHeight = 0;
    
    for (const child of node.children) {
      // Check if child fits in current row
      if (currentX > padding && currentX + child.width > node.width - padding) {
        // Wrap to next row
        currentX = padding;
        currentY += rowMaxHeight + enclosureGap;
        rowMaxHeight = 0;
      }
      
      child.x = currentX;
      child.y = currentY;
      
      currentX += child.width + enclosureGap;
      rowMaxHeight = Math.max(rowMaxHeight, child.height);
    }
  }

  // Recursively position grandchildren
  for (const child of node.children) {
    positionChildNodes(child, config);
  }
}

/**
 * Converts a GoalTreeNode to React Flow nodes.
 * Creates enclosure nodes with proper parent-child relationships.
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
  const { padding, headerHeight, habitHeight, habitGap, maxEnclosureWidth } = config;

  const goalNodeId = `${NODE_ID_PREFIX.GOAL}${treeNode.goal.id}`;
  
  // Create the enclosure node
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

  // Add habits with wrapping layout
  const maxContentWidth = maxEnclosureWidth - padding * 2;
  const habitsPerRow = Math.max(1, Math.floor((maxContentWidth + habitGap) / (HABIT_WIDTH + habitGap)));
  
  treeNode.habits.forEach((habit, index) => {
    const col = index % habitsPerRow;
    const row = Math.floor(index / habitsPerRow);
    
    const habitX = padding + col * (HABIT_WIDTH + habitGap);
    const habitY = headerHeight + padding + row * (habitHeight + habitGap);
    
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
        width: HABIT_WIDTH,
        height: habitHeight,
      },
    };
    nodes.push(habitNode);
  });

  // Recursively convert child nodes - they are nested inside this goal
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

  // Step 3: Position root nodes using bin-packing (Tetris-style)
  // Pack nodes efficiently to fill rectangular space
  const gridDimensions = positionSiblingsGrid(rootNodes, 0, 0, config, 1400);

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
