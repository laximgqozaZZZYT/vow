/**
 * Gantt Chart Data Utilities
 * 
 * Provides functions for building hierarchical row data from Goals and Habits,
 * calculating progress, and building dependency relationships.
 * 
 * @module ganttDataUtils
 * 
 * Validates: Requirements 2.1-2.6, 4.1, 4.2, 4.5, 6.1
 */

import type { Goal, Habit, Activity } from '../types';
import type { HabitRelation } from '../types/shared';

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Row data for the Gantt chart
 * Represents either a Goal or a Habit in the chart
 */
export interface GanttRowData {
  /** Unique identifier (Goal ID or Habit ID) */
  id: string;
  /** Type of the row */
  type: 'goal' | 'habit';
  /** Display name */
  name: string;
  /** Hierarchy depth (0 = root goal) */
  depth: number;
  /** Whether the row is expanded (shows children) */
  isExpanded: boolean;
  /** Whether the row has children (child Goals or Habits) */
  hasChildren: boolean;
  /** Start date for the schedule bar */
  startDate: Date | null;
  /** End date for the schedule bar */
  endDate: Date | null;
  /** Progress percentage (0-100) */
  progress: number;
  /** Whether the item is completed */
  isCompleted: boolean;
  /** Parent ID (Goal's parentId or Habit's goalId) */
  parentId: string | null;
}

/**
 * Dependency data for connecting related Habits
 */
export interface DependencyData {
  /** Unique identifier for the dependency */
  id: string;
  /** ID of the predecessor row */
  fromRowId: string;
  /** ID of the successor row */
  toRowId: string;
  /** End date of the predecessor */
  fromEndDate: Date;
  /** Start date of the successor */
  toStartDate: Date;
}

// ============================================================================
// Progress Calculation
// ============================================================================

/**
 * Calculate progress for a single Habit based on activities
 * 
 * @param habit - The Habit to calculate progress for
 * @param activities - All activities
 * @returns Progress percentage (0-100)
 * 
 * Validates: Requirement 4.1, 4.2
 */
export function calculateHabitProgress(
  habit: Habit,
  activities: Activity[]
): number {
  if (habit.completed) return 100;
  
  const workloadTotal = habit.workloadTotal || habit.must || 0;
  if (workloadTotal <= 0) return 0;
  
  const completedWorkload = activities
    .filter(a => a.habitId === habit.id && a.kind === 'complete')
    .reduce((sum, a) => sum + (a.amount || 1), 0);
  
  return Math.min(100, (completedWorkload / workloadTotal) * 100);
}

/**
 * Calculate aggregate progress for a Goal based on its child Habits
 * 
 * @param goalId - The Goal ID
 * @param habits - All Habits
 * @param activities - All activities
 * @returns Progress percentage (0-100)
 * 
 * Validates: Requirement 4.5
 */
export function calculateGoalProgress(
  goalId: string,
  habits: Habit[],
  activities: Activity[]
): number {
  const childHabits = habits.filter(h => h.goalId === goalId);
  if (childHabits.length === 0) return 0;
  
  const totalProgress = childHabits.reduce(
    (sum, h) => sum + calculateHabitProgress(h, activities),
    0
  );
  
  return totalProgress / childHabits.length;
}

// ============================================================================
// Row Building
// ============================================================================

/**
 * Add a Habit row to the rows array
 */
function addHabitRow(
  habit: Habit,
  depth: number,
  rows: GanttRowData[],
  activities: Activity[]
): void {
  const progress = calculateHabitProgress(habit, activities);
  
  // Use createdAt as start date, or today if not available
  const startDate = habit.createdAt ? new Date(habit.createdAt) : new Date();
  
  // Use dueDate as end date, or 7 days from start if not available
  let endDate: Date;
  if (habit.dueDate) {
    endDate = new Date(habit.dueDate);
  } else {
    // Default to 7 days from start date
    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 7);
  }
  
  rows.push({
    id: habit.id,
    type: 'habit',
    name: habit.name,
    depth,
    isExpanded: false,
    hasChildren: false,
    startDate,
    endDate,
    progress,
    isCompleted: habit.completed,
    parentId: habit.goalId
  });
}

/**
 * Add a Goal row and its children to the rows array (recursive)
 */
function addGoalRow(
  goal: Goal,
  depth: number,
  rows: GanttRowData[],
  allGoals: Goal[],
  allHabits: Habit[],
  activities: Activity[],
  expandedIds: Set<string>
): void {
  const childGoals = allGoals.filter(g => g.parentId === goal.id);
  const childHabits = allHabits.filter(h => h.goalId === goal.id);
  const hasChildren = childGoals.length > 0 || childHabits.length > 0;
  const isExpanded = expandedIds.has(goal.id);
  
  // Calculate Goal progress from child Habits
  const progress = calculateGoalProgress(goal.id, allHabits, activities);
  
  // Use createdAt as start date, or today if not available
  const startDate = goal.createdAt ? new Date(goal.createdAt) : new Date();
  
  // Use dueDate as end date, or 30 days from start if not available
  let endDate: Date;
  if (goal.dueDate) {
    endDate = new Date(goal.dueDate);
  } else {
    // Default to 30 days from start date for Goals
    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 30);
  }
  
  rows.push({
    id: goal.id,
    type: 'goal',
    name: goal.name,
    depth,
    isExpanded,
    hasChildren,
    startDate,
    endDate,
    progress,
    isCompleted: goal.isCompleted ?? false,
    parentId: goal.parentId ?? null
  });
  
  if (isExpanded) {
    // Add child Goals first
    for (const childGoal of childGoals) {
      addGoalRow(childGoal, depth + 1, rows, allGoals, allHabits, activities, expandedIds);
    }
    // Then add child Habits
    for (const habit of childHabits) {
      addHabitRow(habit, depth + 1, rows, activities);
    }
  }
}

/**
 * Build hierarchical row data from Goals and Habits
 * 
 * @param goals - All Goals
 * @param habits - All Habits
 * @param activities - All activities
 * @param expandedIds - Set of expanded row IDs
 * @returns Array of GanttRowData in display order
 * 
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */
export function buildGanttRows(
  goals: Goal[],
  habits: Habit[],
  activities: Activity[],
  expandedIds: Set<string>
): GanttRowData[] {
  const rows: GanttRowData[] = [];
  
  // Get root-level Goals (no parentId)
  const rootGoals = goals.filter(g => !g.parentId);
  
  // Process each root Goal recursively
  for (const goal of rootGoals) {
    addGoalRow(goal, 0, rows, goals, habits, activities, expandedIds);
  }
  
  // Add orphan Habits (not belonging to any Goal)
  const orphanHabits = habits.filter(h => !h.goalId || !goals.some(g => g.id === h.goalId));
  for (const habit of orphanHabits) {
    addHabitRow(habit, 0, rows, activities);
  }
  
  return rows;
}

// ============================================================================
// Dependency Building
// ============================================================================

/**
 * Build dependency data from HabitRelations
 * 
 * @param habitRelations - All HabitRelations
 * @param rows - Current visible rows
 * @returns Array of DependencyData for 'next' relations
 * 
 * Validates: Requirement 6.1
 */
export function buildDependencies(
  habitRelations: HabitRelation[],
  rows: GanttRowData[]
): DependencyData[] {
  const rowMap = new Map(rows.map(r => [r.id, r]));
  
  return habitRelations
    .filter(rel => rel.relation === 'next')
    .map(rel => {
      const fromRow = rowMap.get(rel.habitId);
      const toRow = rowMap.get(rel.relatedHabitId);
      
      // Both rows must be visible
      if (!fromRow || !toRow) return null;
      
      return {
        id: rel.id,
        fromRowId: rel.habitId,
        toRowId: rel.relatedHabitId,
        fromEndDate: fromRow.endDate || new Date(),
        toStartDate: toRow.startDate || new Date()
      };
    })
    .filter((d): d is DependencyData => d !== null);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get all descendant IDs for a given row
 * Used for collapse/expand operations
 */
export function getDescendantIds(
  rowId: string,
  goals: Goal[],
  habits: Habit[]
): string[] {
  const descendants: string[] = [];
  
  // Find the row type
  const goal = goals.find(g => g.id === rowId);
  if (goal) {
    // Get child Goals
    const childGoals = goals.filter(g => g.parentId === rowId);
    for (const childGoal of childGoals) {
      descendants.push(childGoal.id);
      descendants.push(...getDescendantIds(childGoal.id, goals, habits));
    }
    // Get child Habits
    const childHabits = habits.filter(h => h.goalId === rowId);
    for (const habit of childHabits) {
      descendants.push(habit.id);
    }
  }
  
  return descendants;
}

/**
 * Find the row index for a given ID
 */
export function findRowIndex(rows: GanttRowData[], id: string): number {
  return rows.findIndex(r => r.id === id);
}
