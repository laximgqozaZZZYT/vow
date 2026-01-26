"use client";

/**
 * KanbanLayout Component for Board Section
 * 
 * Displays a Trello-style Kanban board with three columns:
 * - 予定 (Planned): Habits with no activity today
 * - 進行中 (In Progress): Habits that have been started but not completed
 * - 完了(日次) (Completed Daily): Habits completed today
 * 
 * Features:
 * - 3-column horizontal layout on desktop
 * - Horizontally scrollable container on mobile (< 768px)
 * - Drag-and-drop support via useKanbanDragDrop hook
 * - Mobile swipe navigation via useMobileSwipe hook
 * - Column indicators (dots) for mobile navigation
 * 
 * @module Board.KanbanLayout
 * 
 * Validates: Requirements 2.1, 5.1, 5.3
 */

import { useCallback, useMemo } from 'react';
import type { Habit, Activity, HabitAction } from '../types';
import type { HabitStatus } from '../utils/habitStatusUtils';
import { groupHabitsByStatus } from '../utils/habitStatusUtils';
import { useKanbanDragDrop } from '../hooks/useKanbanDragDrop';
import { useMobileSwipe } from '../hooks/useMobileSwipe';
import KanbanColumn from './Board.KanbanColumn';

/**
 * Column configuration for Kanban board
 */
export interface ColumnConfig {
  id: HabitStatus;
  title: string;
  titleJa: string;
}

/**
 * Props for KanbanLayout component
 */
export interface KanbanLayoutProps {
  /** All habits to display in the Kanban board */
  habits: Habit[];
  /** All activities (used for status determination and elapsed time) */
  activities: Activity[];
  /** Callback when a habit action is triggered (start, complete, pause) */
  onHabitAction: (habitId: string, action: HabitAction, amount?: number) => void;
  /** Callback when habit edit is requested */
  onHabitEdit: (habitId: string) => void;
}

/**
 * Column configuration - Requirement 2.1
 * Three columns: 予定 (Planned), 進行中 (In Progress), 完了(日次) (Completed Daily)
 */
const COLUMNS: ColumnConfig[] = [
  { id: 'planned', title: 'Planned', titleJa: '予定' },
  { id: 'in_progress', title: 'In Progress', titleJa: '進行中' },
  { id: 'completed_daily', title: 'Completed', titleJa: '完了(日次)' }
];

/**
 * KanbanLayout component
 * 
 * Renders a 3-column Kanban board with drag-and-drop support.
 * On mobile devices, displays columns in a horizontally scrollable
 * container with swipe navigation and column indicators.
 */
export default function KanbanLayout({
  habits,
  activities,
  onHabitAction,
  onHabitEdit
}: KanbanLayoutProps) {
  
  // Group habits by status for column distribution
  const habitsByStatus = useMemo(() => 
    groupHabitsByStatus(habits, activities),
    [habits, activities]
  );
  
  // Initialize drag-and-drop hook
  const {
    draggedHabitId,
    dropTargetColumn,
    sourceColumn,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd
  } = useKanbanDragDrop({ onHabitAction });
  
  // Initialize mobile swipe hook
  const {
    currentColumnIndex,
    containerRef,
    handleTouchStart: handleSwipeStart,
    handleTouchMove: handleSwipeMove,
    handleTouchEnd: handleSwipeEnd,
    goToColumn
  } = useMobileSwipe({ 
    totalColumns: COLUMNS.length,
    onColumnChange: undefined // Optional callback for column change
  });
  
  /**
   * Handle drop on a column
   * Wraps the drag-drop hook's handleDrop
   */
  const handleColumnDrop = useCallback((habitId: string, targetStatus: HabitStatus) => {
    handleDrop(targetStatus);
  }, [handleDrop]);
  
  /**
   * Handle drag start on a habit card
   * Determines the source column from the habit's current status
   */
  const handleCardDragStart = useCallback((habitId: string) => {
    // Find which column the habit is in
    let habitSourceColumn: HabitStatus = 'planned';
    for (const [status, habitsInColumn] of Object.entries(habitsByStatus)) {
      if (habitsInColumn.some(h => h.id === habitId)) {
        habitSourceColumn = status as HabitStatus;
        break;
      }
    }
    handleDragStart(habitId, habitSourceColumn);
  }, [habitsByStatus, handleDragStart]);
  
  /**
   * Handle touch start on a habit card (for mobile long-press drag)
   */
  const handleCardTouchStart = useCallback((habitId: string, event: React.TouchEvent) => {
    // Find which column the habit is in
    let habitSourceColumn: HabitStatus = 'planned';
    for (const [status, habitsInColumn] of Object.entries(habitsByStatus)) {
      if (habitsInColumn.some(h => h.id === habitId)) {
        habitSourceColumn = status as HabitStatus;
        break;
      }
    }
    handleTouchStart(habitId, habitSourceColumn, event);
  }, [habitsByStatus, handleTouchStart]);
  
  /**
   * Combined touch handler for mobile
   * Handles both swipe navigation and drag-and-drop
   */
  const handleCombinedTouchStart = useCallback((event: React.TouchEvent) => {
    // Let the swipe handler process the event
    handleSwipeStart(event);
  }, [handleSwipeStart]);
  
  const handleCombinedTouchMove = useCallback((event: React.TouchEvent) => {
    // Handle drag preview movement if dragging
    handleTouchMove(event);
    // Handle swipe navigation
    handleSwipeMove(event);
  }, [handleTouchMove, handleSwipeMove]);
  
  const handleCombinedTouchEnd = useCallback(() => {
    // Handle drag drop if dragging
    handleTouchEnd();
    // Handle swipe navigation
    handleSwipeEnd();
  }, [handleTouchEnd, handleSwipeEnd]);
  
  return (
    <div className="flex flex-col h-full">
      {/* Kanban Board Container */}
      <div
        ref={containerRef}
        onTouchStart={handleCombinedTouchStart}
        onTouchMove={handleCombinedTouchMove}
        onTouchEnd={handleCombinedTouchEnd}
        className="
          flex
          gap-4
          p-4
          overflow-x-auto
          overflow-y-hidden
          flex-1
          min-h-0
          
          /* Desktop: 3 columns side by side */
          md:overflow-x-visible
          
          /* Mobile: horizontal scroll container - Requirement 5.1 */
          snap-x
          snap-mandatory
          md:snap-none
          
          /* Smooth scrolling with reduced motion support */
          scroll-smooth
          motion-reduce:scroll-auto
          
          /* Hide scrollbar on mobile for cleaner look */
          scrollbar-hide
          [-webkit-overflow-scrolling:touch]
        "
        style={{
          // Ensure columns take full width on mobile for snap scrolling
          scrollSnapType: 'x mandatory'
        }}
      >
        {COLUMNS.map((column, index) => (
          <div
            key={column.id}
            className="
              /* Mobile: each column takes ~85% viewport width to show edge of next column */
              min-w-[85vw]
              max-w-[85vw]
              md:min-w-0
              md:max-w-none
              md:flex-1
              
              /* Snap alignment for mobile swipe */
              snap-center
              md:snap-align-none
              
              /* Add padding on first/last column for edge visibility */
              first:ml-2
              last:mr-2
              md:first:ml-0
              md:last:mr-0
            "
          >
            <KanbanColumn
              column={column}
              habits={habitsByStatus[column.id]}
              activities={activities}
              onHabitAction={onHabitAction}
              onHabitEdit={onHabitEdit}
              onDrop={handleColumnDrop}
              isDragOver={dropTargetColumn === column.id}
              onDragOver={() => handleDragOver(column.id)}
              onDragLeave={handleDragLeave}
              draggedHabitId={draggedHabitId}
              onDragStart={handleCardDragStart}
              onDragEnd={handleDragEnd}
            />
          </div>
        ))}
      </div>
      
      {/* Mobile Column Indicators - Requirement 5.3 */}
      <div className="
        flex
        justify-center
        gap-2
        py-3
        md:hidden
      ">
        {COLUMNS.map((column, index) => (
          <button
            key={column.id}
            onClick={() => goToColumn(index)}
            aria-label={`Go to ${column.titleJa} column`}
            aria-current={currentColumnIndex === index ? 'true' : 'false'}
            className={`
              w-2.5
              h-2.5
              rounded-full
              transition-all
              duration-200
              min-w-[44px]
              min-h-[44px]
              flex
              items-center
              justify-center
              focus-visible:outline-2
              focus-visible:outline-primary
              focus-visible:outline-offset-2
            `}
          >
            <span
              className={`
                w-2.5
                h-2.5
                rounded-full
                transition-all
                duration-200
                ${currentColumnIndex === index 
                  ? 'bg-primary scale-125' 
                  : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
                }
              `}
            />
          </button>
        ))}
      </div>
      
      {/* Mobile Column Label - Shows current column name */}
      <div className="
        text-center
        text-sm
        text-muted-foreground
        pb-2
        md:hidden
      ">
        {COLUMNS[currentColumnIndex]?.titleJa}
        <span className="text-xs ml-2">
          ({habitsByStatus[COLUMNS[currentColumnIndex]?.id]?.length || 0})
        </span>
      </div>
    </div>
  );
}
