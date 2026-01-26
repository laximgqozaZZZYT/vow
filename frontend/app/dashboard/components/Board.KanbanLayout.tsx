"use client";

/**
 * KanbanLayout Component for Board Section
 * 
 * Displays a Trello-style Kanban board with four columns:
 * - 予定 (Planned): Habits with no activity today + pending Sticky'n
 * - 進行中 (In Progress): Habits that have been started but not completed
 * - 完了(日次) (Completed Daily): Habits completed today
 * - 完了 (Completed): Fully completed habits and checked stickies
 * 
 * Features:
 * - 4-column horizontal layout on desktop
 * - Horizontally scrollable container on mobile (< 768px)
 * - Drag-and-drop support via useKanbanDragDrop hook
 * - Mobile swipe navigation via useMobileSwipe hook
 * - Auto-scroll follows drag direction (Trello-like behavior)
 * - Column indicators (dots) for mobile navigation
 * 
 * @module Board.KanbanLayout
 */

import { useCallback, useMemo, useRef, useEffect, useState } from 'react';
import type { Habit, Activity, HabitAction, Sticky } from '../types';
import type { HabitStatus } from '../utils/habitStatusUtils';
import { groupHabitsByStatus, groupStickiesByStatus } from '../utils/habitStatusUtils';
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
  type: 'habit' | 'sticky' | 'mixed' | 'planned_with_stickies';
}

/**
 * Props for KanbanLayout component
 */
export interface KanbanLayoutProps {
  /** All habits to display in the Kanban board */
  habits: Habit[];
  /** All activities (used for status determination and elapsed time) */
  activities: Activity[];
  /** All stickies to display */
  stickies: Sticky[];
  /** Callback when a habit action is triggered (start, complete, pause) */
  onHabitAction: (habitId: string, action: HabitAction, amount?: number) => void;
  /** Callback when habit edit is requested */
  onHabitEdit: (habitId: string) => void;
  /** Callback when sticky is completed/uncompleted */
  onStickyComplete: (stickyId: string) => void;
  /** Callback when sticky edit is requested */
  onStickyEdit: (stickyId: string) => void;
}

/**
 * Column configuration
 * Four columns: 予定 (with Sticky'n), 進行中, 完了(日次), 完了
 */
const COLUMNS: ColumnConfig[] = [
  { id: 'planned', title: 'Planned', titleJa: '予定', type: 'planned_with_stickies' },
  { id: 'in_progress', title: 'In Progress', titleJa: '進行中', type: 'habit' },
  { id: 'completed_daily', title: 'Daily Done', titleJa: '完了(日次)', type: 'habit' },
  { id: 'completed', title: 'Completed', titleJa: '完了', type: 'mixed' }
];

/** Edge threshold for auto-scroll during drag (pixels from edge) */
const DRAG_SCROLL_EDGE_ZONE = 80;
/** Scroll speed for auto-scroll (pixels per frame) */
const DRAG_SCROLL_SPEED = 15;

/**
 * KanbanLayout component
 */
export default function KanbanLayout({
  habits,
  activities,
  stickies,
  onHabitAction,
  onHabitEdit,
  onStickyComplete,
  onStickyEdit
}: KanbanLayoutProps) {
  
  // Group habits by status for column distribution
  const habitsByStatus = useMemo(() => 
    groupHabitsByStatus(habits, activities),
    [habits, activities]
  );
  
  // Group stickies by completion status
  const stickiesByStatus = useMemo(() => 
    groupStickiesByStatus(stickies),
    [stickies]
  );
  
  // Initialize drag-and-drop hook
  const {
    draggedHabitId,
    dropTargetColumn,
    sourceColumn,
    isDragging,
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
    onColumnChange: undefined
  });
  
  // Scroll container ref
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  
  // Auto-scroll refs
  const scrollAnimationRef = useRef<number | null>(null);
  const currentTouchXRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);

  // Sync isDraggingRef
  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  /**
   * Auto-scroll function - checks touch position and scrolls if near edge
   */
  const performAutoScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    const touchX = currentTouchXRef.current;
    
    if (!container || touchX === null || !isDraggingRef.current) {
      scrollAnimationRef.current = null;
      return;
    }
    
    const containerRect = container.getBoundingClientRect();
    const leftEdge = containerRect.left + DRAG_SCROLL_EDGE_ZONE;
    const rightEdge = containerRect.right - DRAG_SCROLL_EDGE_ZONE;
    
    let scrollDelta = 0;
    
    // Near left edge - scroll left
    if (touchX < leftEdge) {
      const distance = leftEdge - touchX;
      const intensity = Math.min(distance / DRAG_SCROLL_EDGE_ZONE, 1);
      scrollDelta = -DRAG_SCROLL_SPEED * (0.5 + intensity);
    }
    // Near right edge - scroll right
    else if (touchX > rightEdge) {
      const distance = touchX - rightEdge;
      const intensity = Math.min(distance / DRAG_SCROLL_EDGE_ZONE, 1);
      scrollDelta = DRAG_SCROLL_SPEED * (0.5 + intensity);
    }
    
    if (scrollDelta !== 0) {
      const maxScroll = container.scrollWidth - container.clientWidth;
      const newScrollLeft = Math.max(0, Math.min(maxScroll, container.scrollLeft + scrollDelta));
      container.scrollLeft = newScrollLeft;
    }
    
    // Continue animation loop
    if (isDraggingRef.current) {
      scrollAnimationRef.current = requestAnimationFrame(performAutoScroll);
    } else {
      scrollAnimationRef.current = null;
    }
  }, []);

  /**
   * Start auto-scroll animation
   */
  const startAutoScroll = useCallback(() => {
    if (!scrollAnimationRef.current) {
      scrollAnimationRef.current = requestAnimationFrame(performAutoScroll);
    }
  }, [performAutoScroll]);

  /**
   * Stop auto-scroll animation
   */
  const stopAutoScroll = useCallback(() => {
    if (scrollAnimationRef.current) {
      cancelAnimationFrame(scrollAnimationRef.current);
      scrollAnimationRef.current = null;
    }
    currentTouchXRef.current = null;
  }, []);

  // Start/stop auto-scroll based on drag state
  useEffect(() => {
    if (isDragging) {
      startAutoScroll();
    } else {
      stopAutoScroll();
    }
  }, [isDragging, startAutoScroll, stopAutoScroll]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => stopAutoScroll();
  }, [stopAutoScroll]);
  
  // Global touch listener to track position during drag
  useEffect(() => {
    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (!isDraggingRef.current) return;
      const touch = e.touches[0];
      if (touch) {
        currentTouchXRef.current = touch.clientX;
      }
    };
    
    const handleGlobalTouchEnd = () => {
      currentTouchXRef.current = null;
    };
    
    document.addEventListener('touchmove', handleGlobalTouchMove, { passive: true });
    document.addEventListener('touchend', handleGlobalTouchEnd);
    document.addEventListener('touchcancel', handleGlobalTouchEnd);
    
    return () => {
      document.removeEventListener('touchmove', handleGlobalTouchMove);
      document.removeEventListener('touchend', handleGlobalTouchEnd);
      document.removeEventListener('touchcancel', handleGlobalTouchEnd);
    };
  }, []);
  
  /**
   * Handle drop on a column
   */
  const handleColumnDrop = useCallback((habitId: string, targetStatus: HabitStatus) => {
    handleDrop(targetStatus);
  }, [handleDrop]);
  
  /**
   * Handle drag start on a habit card
   */
  const handleCardDragStart = useCallback((habitId: string) => {
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
   * Combined touch handlers for mobile
   */
  const handleCombinedTouchStart = useCallback((event: React.TouchEvent) => {
    const touch = event.touches[0];
    currentTouchXRef.current = touch.clientX;
    handleSwipeStart(event);
  }, [handleSwipeStart]);
  
  const handleCombinedTouchMove = useCallback((event: React.TouchEvent) => {
    const touch = event.touches[0];
    currentTouchXRef.current = touch.clientX;
    
    // Handle drag preview movement if dragging
    handleTouchMove(event);
    
    // Handle swipe navigation (only if not dragging)
    if (!isDraggingRef.current) {
      handleSwipeMove(event);
    }
  }, [handleTouchMove, handleSwipeMove]);
  
  const handleCombinedTouchEnd = useCallback(() => {
    currentTouchXRef.current = null;
    stopAutoScroll();
    handleTouchEnd();
    handleSwipeEnd();
  }, [handleTouchEnd, handleSwipeEnd, stopAutoScroll]);
  
  // Sync scrollContainerRef with containerRef from useMobileSwipe
  const setRefs = useCallback((node: HTMLDivElement | null) => {
    scrollContainerRef.current = node;
    // Also update the containerRef from useMobileSwipe
    if (containerRef) {
      (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    }
  }, [containerRef]);
  
  /**
   * Get column count for display
   */
  const getColumnCount = (columnId: HabitStatus): number => {
    switch (columnId) {
      case 'planned':
        // Planned column includes both habits and pending stickies
        return (habitsByStatus.planned?.length || 0) + stickiesByStatus.pending.length;
      case 'completed':
        return habitsByStatus.completed.length + stickiesByStatus.completed.length;
      default:
        return habitsByStatus[columnId]?.length || 0;
    }
  };
  
  return (
    <div className="flex flex-col h-full">
      {/* Kanban Board Container */}
      <div
        ref={setRefs}
        onTouchStart={handleCombinedTouchStart}
        onTouchMove={handleCombinedTouchMove}
        onTouchEnd={handleCombinedTouchEnd}
        className="
          flex
          gap-2
          p-2
          overflow-x-auto
          overflow-y-visible
          flex-1
          min-h-0
          
          /* Desktop: columns side by side */
          md:overflow-x-visible
          md:gap-3
          md:p-3
          
          /* Mobile: horizontal scroll container */
          snap-x
          snap-mandatory
          md:snap-none
          
          /* Hide scrollbar on mobile for cleaner look */
          scrollbar-hide
          [-webkit-overflow-scrolling:touch]
        "
        style={{
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {COLUMNS.map((column, index) => (
          <div
            key={column.id}
            className="
              /* Mobile: each column takes ~70% viewport width to show adjacent columns */
              min-w-[70vw]
              max-w-[70vw]
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
            {column.type === 'mixed' ? (
              <KanbanColumn
                column={column}
                habits={habitsByStatus.completed}
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
                completedStickies={stickiesByStatus.completed}
                onStickyComplete={onStickyComplete}
                onStickyEdit={onStickyEdit}
              />
            ) : column.type === 'planned_with_stickies' ? (
              <KanbanColumn
                column={column}
                habits={habitsByStatus.planned || []}
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
                pendingStickies={stickiesByStatus.pending}
                onStickyComplete={onStickyComplete}
                onStickyEdit={onStickyEdit}
              />
            ) : (
              <KanbanColumn
                column={column}
                habits={habitsByStatus[column.id] || []}
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
            )}
          </div>
        ))}
      </div>
      
      {/* Mobile Column Indicators */}
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
      
      {/* Mobile Column Label */}
      <div className="
        text-center
        text-sm
        text-muted-foreground
        pb-2
        md:hidden
      ">
        {COLUMNS[currentColumnIndex]?.titleJa}
        <span className="text-xs ml-2">
          ({getColumnCount(COLUMNS[currentColumnIndex]?.id)})
        </span>
      </div>
    </div>
  );
}
