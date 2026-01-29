/**
 * useGanttData Hook
 * 
 * Manages the data transformation and state for the Gantt chart.
 * Handles row building, expand/collapse state, and dependency calculation.
 * 
 * @module useGanttData
 * 
 * Validates: Requirements 2.4, 2.5, 2.6
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import type { Goal, Habit, Activity } from '../types';
import type { HabitRelation } from '../types/shared';
import {
  buildGanttRows,
  buildDependencies,
  getDescendantIds,
  type GanttRowData,
  type DependencyData,
  type ProgressViewMode
} from '../utils/ganttDataUtils';

// ============================================================================
// Interfaces
// ============================================================================

export interface UseGanttDataProps {
  /** All Goals */
  goals: Goal[];
  /** All Habits */
  habits: Habit[];
  /** All Activities */
  activities: Activity[];
  /** All HabitRelations */
  habitRelations: HabitRelation[];
  /** View mode for progress calculation (ignored - always cumulative) */
  viewMode?: ProgressViewMode;
}

export interface UseGanttDataReturn {
  /** Visible rows in display order */
  rows: GanttRowData[];
  /** Dependency connections between rows */
  dependencies: DependencyData[];
  /** Toggle expand/collapse for a row */
  toggleExpand: (id: string) => void;
  /** Expand a specific row */
  expand: (id: string) => void;
  /** Collapse a specific row */
  collapse: (id: string) => void;
  /** Expand all rows */
  expandAll: () => void;
  /** Collapse all rows */
  collapseAll: () => void;
  /** Set of currently expanded row IDs */
  expandedIds: Set<string>;
  /** Check if a row is expanded */
  isExpanded: (id: string) => boolean;
  /** Refresh workload data */
  refreshWorkloads: () => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate cumulative workload for a habit from activities
 * @param habitId - The habit ID
 * @param activities - All activities
 * @returns Total cumulative workload
 */
function calculateCumulativeWorkload(habitId: string, activities: Activity[]): number {
  return activities
    .filter(a => a.habitId === habitId && a.kind === 'complete')
    .reduce((sum, a) => sum + (a.amount ?? 1), 0);
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Custom hook for managing Gantt chart data
 * 
 * @param props - Goals, Habits, Activities, and HabitRelations
 * @returns Row data, dependencies, and expand/collapse controls
 */
export function useGanttData({
  goals,
  habits,
  activities,
  habitRelations,
  viewMode = 'month'
}: UseGanttDataProps): UseGanttDataReturn {
  // Track which rows are expanded
  // By default, expand all root-level Goals
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const rootGoalIds = goals.filter(g => !g.parentId).map(g => g.id);
    return new Set(rootGoalIds);
  });

  // Track cumulative workloads for all habits (calculated from activities)
  const cumulativeWorkloads = useMemo(() => {
    const workloads = new Map<string, number>();
    
    for (const habit of habits) {
      const cumulative = calculateCumulativeWorkload(habit.id, activities);
      workloads.set(habit.id, cumulative);
    }
    
    return workloads;
  }, [habits, activities]);

  /**
   * Refresh workload data (no-op since we calculate from activities)
   */
  const refreshWorkloads = useCallback(() => {
    // Workloads are calculated from activities in useMemo, so this is a no-op
  }, []);

  /**
   * Toggle expand/collapse for a row
   * Validates: Requirement 2.4, 2.5
   */
  const toggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        // Collapse: remove this ID and all descendants
        next.delete(id);
        const descendants = getDescendantIds(id, goals, habits);
        for (const descId of descendants) {
          next.delete(descId);
        }
      } else {
        // Expand: add this ID
        next.add(id);
      }
      return next;
    });
  }, [goals, habits]);

  /**
   * Expand a specific row
   */
  const expand = useCallback((id: string) => {
    setExpandedIds(prev => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  /**
   * Collapse a specific row
   */
  const collapse = useCallback((id: string) => {
    setExpandedIds(prev => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      // Also collapse all descendants
      const descendants = getDescendantIds(id, goals, habits);
      for (const descId of descendants) {
        next.delete(descId);
      }
      return next;
    });
  }, [goals, habits]);

  /**
   * Expand all rows
   */
  const expandAll = useCallback(() => {
    const allGoalIds = goals.map(g => g.id);
    setExpandedIds(new Set(allGoalIds));
  }, [goals]);

  /**
   * Collapse all rows
   */
  const collapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  /**
   * Check if a row is expanded
   */
  const isExpanded = useCallback((id: string) => {
    return expandedIds.has(id);
  }, [expandedIds]);

  /**
   * Build rows from Goals and Habits
   * Validates: Requirements 2.1, 2.2, 2.3, 2.6
   */
  const rows = useMemo(() => {
    return buildGanttRows(goals, habits, cumulativeWorkloads, expandedIds, viewMode);
  }, [goals, habits, cumulativeWorkloads, expandedIds, viewMode]);

  /**
   * Build dependencies from HabitRelations
   * Validates: Requirement 6.1
   */
  const dependencies = useMemo(() => {
    return buildDependencies(habitRelations, rows);
  }, [habitRelations, rows]);

  return {
    rows,
    dependencies,
    toggleExpand,
    expand,
    collapse,
    expandAll,
    collapseAll,
    expandedIds,
    isExpanded,
    refreshWorkloads
  };
}

export default useGanttData;
