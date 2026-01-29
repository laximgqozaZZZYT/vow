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
// Effective Deadline Calculation
// ============================================================================

/**
 * Parse a date value safely, returning null if invalid
 * @param dateValue - Date string, Date object, or null/undefined
 * @returns Parsed Date or null if invalid
 */
function parseDate(dateValue: string | Date | null | undefined): Date | null {
  if (!dateValue) return null;
  
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  
  // Check if the date is valid
  if (isNaN(date.getTime())) return null;
  
  return date;
}

/**
 * Add years to a date
 * @param date - Base date
 * @param years - Number of years to add
 * @returns New Date with years added
 */
function addYears(date: Date, years: number): Date {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + years);
  return result;
}

/**
 * Calculate the effective deadline for a Goal
 * 
 * The effective deadline is determined by the following priority:
 * 1. The Goal's own dueDate if set
 * 2. The parent Goal's effective deadline (recursive)
 * 3. The Goal's createdAt + 1 year as fallback
 * 
 * Circular references are prevented by tracking visited Goal IDs.
 * 
 * @param goal - The Goal to calculate effective deadline for
 * @param allGoals - All Goals (for parent lookup)
 * @param visitedIds - Set of visited Goal IDs (for circular reference prevention)
 * @returns The effective deadline Date
 * 
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4
 */
export function getGoalEffectiveDeadline(
  goal: Goal,
  allGoals: Goal[],
  visitedIds: Set<string> = new Set()
): Date {
  // Circular reference check - if we've already visited this goal, use fallback
  if (visitedIds.has(goal.id)) {
    const createdAt = parseDate(goal.createdAt);
    return createdAt ? addYears(createdAt, 1) : addYears(new Date(), 1);
  }
  
  // Mark this goal as visited
  visitedIds.add(goal.id);
  
  // Step 1: If the Goal has its own dueDate, use it
  const ownDueDate = parseDate(goal.dueDate);
  if (ownDueDate) {
    return ownDueDate;
  }
  
  // Step 2: If the Goal has a parent, recursively get parent's effective deadline
  if (goal.parentId) {
    const parentGoal = allGoals.find(g => g.id === goal.parentId);
    if (parentGoal) {
      return getGoalEffectiveDeadline(parentGoal, allGoals, visitedIds);
    }
  }
  
  // Step 3: No dueDate and no parent with dueDate - use createdAt + 1 year
  const createdAt = parseDate(goal.createdAt);
  if (createdAt) {
    return addYears(createdAt, 1);
  }
  
  // Fallback: use current date + 1 year if createdAt is invalid
  return addYears(new Date(), 1);
}

/**
 * Calculate the effective deadline for a Habit
 * 
 * The effective deadline is determined by the following priority:
 * 1. The Habit's own dueDate if set
 * 2. If no dueDate: the SHORTER of Goal's effective deadline OR Habit's createdAt + 1 year
 * 3. If no linked Goal: Habit's createdAt + 1 year as fallback
 * 
 * @param habit - The Habit to calculate effective deadline for
 * @param allGoals - All Goals (for Goal lookup and effective deadline calculation)
 * @returns The effective deadline Date
 * 
 * Validates: Requirements 2.1, 2.2, 2.3
 */
export function getHabitEffectiveDeadline(
  habit: Habit,
  allGoals: Goal[]
): Date {
  // Step 1: If the Habit has its own dueDate, use it
  const ownDueDate = parseDate(habit.dueDate);
  if (ownDueDate) {
    return ownDueDate;
  }
  
  // Calculate Habit's createdAt + 1 year as one candidate
  const createdAt = parseDate(habit.createdAt);
  const createdAtPlusOneYear = createdAt 
    ? addYears(createdAt, 1) 
    : addYears(new Date(), 1);
  
  // Step 2: If the Habit has a linked Goal, use the SHORTER of:
  // - Goal's effective deadline
  // - Habit's createdAt + 1 year
  if (habit.goalId) {
    const linkedGoal = allGoals.find(g => g.id === habit.goalId);
    if (linkedGoal) {
      const goalDeadline = getGoalEffectiveDeadline(linkedGoal, allGoals);
      // Return the earlier (shorter) deadline
      return goalDeadline.getTime() < createdAtPlusOneYear.getTime()
        ? goalDeadline
        : createdAtPlusOneYear;
    }
  }
  
  // Step 3: No dueDate and no linked Goal - use createdAt + 1 year
  return createdAtPlusOneYear;
}

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
 * Normalize a numeric value to ensure it's non-negative
 * @param value - The value to normalize
 * @returns The value if positive, 0 otherwise
 * 
 * Validates: Requirements 6.4, 6.5
 */
function normalizeNonNegative(value: number): number {
  return value < 0 ? 0 : value;
}

/**
 * Calculate the elapsed ratio based on time
 * 
 * @param createdAt - Start date (registration date)
 * @param effectiveDeadline - End date (effective deadline)
 * @param currentDate - Current date (optional, defaults to now)
 * @returns Elapsed ratio (0-100)
 * 
 * Edge cases:
 * - If createdAt > effectiveDeadline: return 0 (Requirement 6.1)
 * - If currentDate > effectiveDeadline: return 100 (Requirement 6.2)
 * - If currentDate < createdAt: return 0 (Requirement 6.3)
 * 
 * Validates: Requirements 6.1, 6.2, 6.3
 */
export function calculateElapsedRatio(
  createdAt: Date | null,
  effectiveDeadline: Date | null,
  currentDate: Date = new Date()
): number {
  // If either date is invalid, return 0
  if (!createdAt || !effectiveDeadline) {
    return 0;
  }
  
  const startTime = createdAt.getTime();
  const endTime = effectiveDeadline.getTime();
  const currentTime = currentDate.getTime();
  
  // Requirement 6.1: If createdAt > effectiveDeadline, return 0
  if (startTime > endTime) {
    return 0;
  }
  
  // Requirement 6.3: If currentDate < createdAt, return 0
  if (currentTime < startTime) {
    return 0;
  }
  
  // Requirement 6.2: If currentDate > effectiveDeadline, return 100
  if (currentTime > endTime) {
    return 100;
  }
  
  // Calculate elapsed ratio
  const totalDuration = endTime - startTime;
  if (totalDuration === 0) {
    // If start and end are the same, consider it 100% elapsed
    return 100;
  }
  
  const elapsedDuration = currentTime - startTime;
  return Math.min(100, (elapsedDuration / totalDuration) * 100);
}

/**
 * Calculate the number of days between two dates
 * @param startDate - Start date
 * @param endDate - End date (defaults to now)
 * @returns Number of days (minimum 1)
 */
function calculateDaysSince(startDate: Date, endDate: Date = new Date()): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const days = Math.floor((endDate.getTime() - startDate.getTime()) / msPerDay);
  return Math.max(1, days); // Minimum 1 day to avoid division by zero
}

/**
 * Calculate cumulative workload from activities
 * 
 * Uses the cumulativeWorkload field if available (from the latest activity),
 * otherwise falls back to summing amounts from all complete activities.
 * 
 * @param habitId - The Habit ID
 * @param activities - All activities
 * @returns Cumulative workload (total workload from habit creation)
 */
function calculateCumulativeWorkload(habitId: string, activities: Activity[]): number {
  // Filter activities for this habit with 'complete' kind
  const completeActivities = activities
    .filter(a => a.habitId === habitId && a.kind === 'complete')
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  
  if (completeActivities.length === 0) {
    return 0;
  }
  
  // Try to use cumulativeWorkload from the latest activity
  const latestActivity = completeActivities[0];
  if (latestActivity.cumulativeWorkload !== undefined && latestActivity.cumulativeWorkload !== null) {
    // Debug log
    if (typeof window !== 'undefined' && (window as any).__DEBUG_GANTT__) {
      console.log(`[Gantt] Habit ${habitId}: Using cumulativeWorkload from latest activity: ${latestActivity.cumulativeWorkload}`);
    }
    return normalizeNonNegative(latestActivity.cumulativeWorkload);
  }
  
  // Fallback: sum amounts from all complete activities
  const total = completeActivities.reduce((sum, a) => sum + (a.amount || 1), 0);
  
  // Debug log
  if (typeof window !== 'undefined' && (window as any).__DEBUG_GANTT__) {
    console.log(`[Gantt] Habit ${habitId}: Summed ${completeActivities.length} activities, total workload: ${total}`);
  }
  
  return normalizeNonNegative(total);
}

/**
 * Calculate progress for a single Habit based on activities
 * 
 * Required inputs:
 * - Habit登録日: habit.createdAt
 * - Workload Total(Day): habit.workloadPerCount (1日あたりの目標)
 * - Workload Total(End): habit.workloadTotal or habit.workloadTotalEnd (最終目標)
 * - Habit期限: habit.dueDate
 * - 累計Workload: Activityから集計
 * 
 * Algorithm:
 * 1. If completed, return 100%
 * 2. Calculate cumulative workload from activities
 * 3. If workloadTotal (End) is set:
 *    - Return min(100, (cumulativeWorkload / workloadTotal) * 100)
 * 4. If workloadTotal is NOT set but workloadPerCount (Day) is set:
 *    - Calculate expected workload = workloadPerCount * days since registration
 *    - Return min(100, (cumulativeWorkload / expectedWorkload) * 100)
 * 5. If neither is set, return 0%
 * 
 * @param habit - The Habit to calculate progress for
 * @param activities - All activities (REQUIRED for cumulative workload calculation)
 * @param allGoals - All Goals (for effective deadline calculation)
 * @returns Progress percentage (0-100)
 * 
 * Validates: Requirements 3.3, 3.4, 3.5, 6.1, 6.4, 6.5
 */
export function calculateHabitProgress(
  habit: Habit,
  activities: Activity[],
  allGoals: Goal[] = []
): number {
  // Step 1: 完了済みなら100%
  if (habit.completed) return 100;
  
  // Step 2: Activityから累計Workloadを集計（必須）
  const cumulativeWorkload = calculateCumulativeWorkload(habit.id, activities);
  
  // Step 3: 登録日を取得
  const createdAt = parseDate(habit.createdAt);
  
  // Step 4: エッジケース - 登録日が実効期限より後の場合は0%
  const effectiveDeadline = getHabitEffectiveDeadline(habit, allGoals);
  if (createdAt && effectiveDeadline && createdAt.getTime() > effectiveDeadline.getTime()) {
    return 0;
  }
  
  // Step 5: Workload Total(End) が設定されている場合
  // habit.workloadTotal または habit.workloadTotalEnd を使用
  const workloadTotalEnd = normalizeNonNegative(habit.workloadTotal || habit.workloadTotalEnd || 0);
  
  if (workloadTotalEnd > 0) {
    // 進捗率 = 累計Workload / Workload Total(End) * 100
    const progress = Math.min(100, (cumulativeWorkload / workloadTotalEnd) * 100);
    
    // Debug log
    if (typeof window !== 'undefined' && (window as any).__DEBUG_GANTT__) {
      console.log(`[Gantt] Habit "${habit.name}": cumulative=${cumulativeWorkload}, totalEnd=${workloadTotalEnd}, progress=${progress}%`);
    }
    
    return progress;
  }
  
  // Step 6: Workload Total(End)が未設定だがWorkload Total(Day)が設定されている場合
  // habit.workloadPerCount を使用
  const workloadPerDay = normalizeNonNegative(habit.workloadPerCount || 0);
  
  if (workloadPerDay > 0 && createdAt) {
    // 登録日からの日数を計算
    const daysSinceCreation = calculateDaysSince(createdAt);
    // 期待される累計Workload = Workload Total(Day) * 登録日からの日数
    const expectedWorkload = workloadPerDay * daysSinceCreation;
    
    if (expectedWorkload > 0) {
      // 進捗率 = 累計Workload / 期待される累計Workload * 100
      const progress = Math.min(100, (cumulativeWorkload / expectedWorkload) * 100);
      
      // Debug log
      if (typeof window !== 'undefined' && (window as any).__DEBUG_GANTT__) {
        console.log(`[Gantt] Habit "${habit.name}": cumulative=${cumulativeWorkload}, perDay=${workloadPerDay}, days=${daysSinceCreation}, expected=${expectedWorkload}, progress=${progress}%`);
      }
      
      return progress;
    }
  }
  
  // Debug log
  if (typeof window !== 'undefined' && (window as any).__DEBUG_GANTT__) {
    console.log(`[Gantt] Habit "${habit.name}": No workload settings, returning 0%. workloadTotal=${habit.workloadTotal}, workloadTotalEnd=${habit.workloadTotalEnd}, workloadPerCount=${habit.workloadPerCount}`);
  }
  
  // Step 7: どちらも設定されていない場合は0%
  return 0;
}

/**
 * Calculate aggregate progress for a Goal based on its child Habits
 * 
 * Algorithm:
 * 1. If Goal is completed (isCompleted=true), return 100%
 * 2. If Goal has no child Habits, return 0%
 * 3. Calculate average progress of all child Habits
 * 
 * @param goalId - The Goal ID
 * @param habits - All Habits
 * @param activities - All activities
 * @param allGoals - All Goals (for effective deadline calculation and Goal lookup)
 * @returns Progress percentage (0-100)
 * 
 * Validates: Requirements 4.1, 4.2, 4.3
 */
export function calculateGoalProgress(
  goalId: string,
  habits: Habit[],
  activities: Activity[],
  allGoals: Goal[] = []
): number {
  // Step 1: 完了済みなら100%
  // Validates: Requirement 4.3
  const goal = allGoals.find(g => g.id === goalId);
  if (goal?.isCompleted) {
    return 100;
  }
  
  // Step 2: Habitがなければ0%
  // Validates: Requirement 4.2
  const childHabits = habits.filter(h => h.goalId === goalId);
  if (childHabits.length === 0) {
    return 0;
  }
  
  // Step 3: 子Habitの進捗率の平均を計算
  // Validates: Requirement 4.1
  const totalProgress = childHabits.reduce(
    (sum, h) => sum + calculateHabitProgress(h, activities, allGoals),
    0
  );
  
  return totalProgress / childHabits.length;
}

// ============================================================================
// Row Building
// ============================================================================

/**
 * Add a Habit row to the rows array
 * 
 * Uses getHabitEffectiveDeadline to determine the endDate based on:
 * 1. Habit's own dueDate if set
 * 2. Linked Goal's effective deadline
 * 3. Habit's createdAt + 1 year as fallback
 * 
 * Validates: Requirements 5.1, 5.2, 5.3
 */
function addHabitRow(
  habit: Habit,
  depth: number,
  rows: GanttRowData[],
  activities: Activity[],
  allGoals: Goal[] = []
): void {
  const progress = calculateHabitProgress(habit, activities, allGoals);
  
  // Use createdAt as start date, or today if not available
  const startDate = habit.createdAt ? new Date(habit.createdAt) : new Date();
  
  // Use effective deadline for endDate (inherits from Goal if not set)
  // Validates: Requirements 5.1, 5.2
  const endDate = getHabitEffectiveDeadline(habit, allGoals);
  
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
 * 
 * Uses getGoalEffectiveDeadline to determine the endDate based on:
 * 1. Goal's own dueDate if set
 * 2. Parent Goal's effective deadline (recursive)
 * 3. Goal's createdAt + 1 year as fallback
 * 
 * Validates: Requirements 5.1, 5.2, 5.3
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
  const progress = calculateGoalProgress(goal.id, allHabits, activities, allGoals);
  
  // Use createdAt as start date, or today if not available
  const startDate = goal.createdAt ? new Date(goal.createdAt) : new Date();
  
  // Use effective deadline for endDate (inherits from parent Goal if not set)
  // Validates: Requirements 5.1, 5.2
  const endDate = getGoalEffectiveDeadline(goal, allGoals);
  
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
      addHabitRow(habit, depth + 1, rows, activities, allGoals);
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
    addHabitRow(habit, 0, rows, activities, goals);
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
