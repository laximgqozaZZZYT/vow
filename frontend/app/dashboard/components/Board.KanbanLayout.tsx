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
const DRAG_SCROLL_THRESHOLD = 60;
/** Scroll speed for auto-scroll (pixels per frame) */
const DRAG_SCROLL_SPEED = 12;
/** Drag preview width (used to detect when preview is cut off) */
const DRAG_PREVIEW_WIDTH = 100;

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
  
  // Separate ref for scroll container to ensure we have direct control
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  
  // Auto-scroll state
  const scrollAnimationRef = useRef<number | null>(null);
  const dragPreviewPositionRef = useRef<{ left: number; right: number } | null>(null);
  const isDraggingRef = useRef(false);
  
  // Touch position tracking refs
  const touchPositionRef = useRef<{ x: number; y: number } | null>(null);
  const lastTouchXRef = useRef<number | null>(null);
  const dragDirectionRef = useRef<'left' | 'right' | null>(null);

  // Keep isDraggingRef in sync with isDragging state
  useEffect(() => {
    isDraggingRef.current = isDragging;
    
    // Start auto-scroll when dragging starts
    if (isDragging && !scrollAnimationRef.current) {
      scrollAnimationRef.current = requestAnimationFrame(performAutoScroll);
    }
    
    // Stop auto-scroll when dragging ends
    if (!isDragging && scrollAnimationRef.current) {
      cancelAnimationFrame(scrollAnimationRef.current);
      scrollAnimationRef.current = null;
      dragPreviewPositionRef.current = null;
    }
  }, [isDragging]);

  /**
   * Auto-scroll container when drag preview is cut off at screen edges
   * Scrolls when the drag preview extends beyond the visible area
   */
  const performAutoScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    
    // Must have container, preview position, and be dragging
    if (!container || !dragPreviewPositionRef.current || !isDraggingRef.current) {
      scrollAnimationRef.current = null;
      return;
    }
    
    const containerRect = container.getBoundingClientRect();
    const { left: previewLeft, right: previewRight } = dragPreviewPositionRef.current;
    
    let scrollDelta = 0;
    
    // Check if drag preview is cut off on the left
    if (previewLeft < containerRect.left) {
      // Preview is cut off on left - scroll left
      const cutOffAmount = containerRect.left - previewLeft;
      const intensity = Math.min(cutOffAmount / DRAG_PREVIEW_WIDTH, 1);
      scrollDelta = -DRAG_SCROLL_SPEED * (1 + intensity);
    }
    // Check if drag preview is cut off on the right
    else if (previewRight > containerRect.right) {
      // Preview is cut off on right - scroll right
      const cutOffAmount = previewRight - containerRect.right;
      const intensity = Math.min(cutOffAmount / DRAG_PREVIEW_WIDTH, 1);
      scrollDelta = DRAG_SCROLL_SPEED * (1 + intensity);
    }
    
    if (scrollDelta !== 0) {
      // Check scroll bounds
      const maxScroll = container.scrollWidth - container.clientWidth;
      const newScrollLeft = container.scrollLeft + scrollDelta;
      
      // Apply scroll within bounds
      if (newScrollLeft >= 0 && newScrollLeft <= maxScroll) {
        container.scrollLeft = newScrollLeft;
      } else if (newScrollLeft < 0) {
        container.scrollLeft = 0;
      } else {
        container.scrollLeft = maxScroll;
      }
    }
    
    // Continue the animation loop while dragging
    if (isDraggingRef.current) {
      scrollAnimationRef.current = requestAnimationFrame(performAutoScroll);
    } else {
      scrollAnimationRef.current = null;
    }
  }, []);
  
  // Cleanup auto-scroll on unmount
  useEffect(() => {
    return () => {
      if (scrollAnimationRef.current) {
        cancelAnimationFrame(scrollAnimationRef.current);
      }
    };
  }, []);
  
  // Global touch move listener to track drag preview position during drag
  // This is needed because the drag preview element captures touch events
  useEffect(() => {
    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (!isDraggingRef.current) return;
      
      const touch = e.touches[0];
      if (touch) {
        const touchX = touch.clientX;
        const touchY = touch.clientY;
        
        touchPositionRef.current = { x: touchX, y: touchY };
        
        // Calculate drag preview bounds (preview is 100px wide, centered on touch)
        // The preview is positioned at left: touchX - 50, so:
        // - Preview left edge = touchX - 50
        // - Preview right edge = touchX + 50
        dragPreviewPositionRef.current = {
          left: touchX - 50,
          right: touchX + 50
        };
        
        // Track direction
        const prevX = lastTouchXRef.current;
        if (prevX !== null) {
          const deltaX = touchX - prevX;
          if (Math.abs(deltaX) > 1) {
            dragDirectionRef.current = deltaX > 0 ? 'right' : 'left';
          }
        }
        lastTouchXRef.current = touchX;
      }
    };
    
    const handleGlobalTouchEnd = () => {
      if (isDraggingRef.current) {
        touchPositionRef.current = null;
        lastTouchXRef.current = null;
        dragDirectionRef.current = null;
        dragPreviewPositionRef.current = null;
      }
    };
    
    // Add listeners with passive: false to allow preventDefault if needed
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
   * Combined touch handler for mobile with auto-scroll
   */
  const handleCombinedTouchStart = useCallback((event: React.TouchEvent) => {
    const touch = event.touches[0];
    touchPositionRef.current = { x: touch.clientX, y: touch.clientY };
    lastTouchXRef.current = touch.clientX;
    dragDirectionRef.current = null;
    dragPreviewPositionRef.current = null;
    handleSwipeStart(event);
  }, [handleSwipeStart]);
  
  const handleCombinedTouchMove = useCallback((event: React.TouchEvent) => {
    const touch = event.touches[0];
    const currentX = touch.clientX;
    const currentY = touch.clientY;
    
    // Update position refs
    const prevX = lastTouchXRef.current;
    lastTouchXRef.current = currentX;
    touchPositionRef.current = { x: currentX, y: currentY };
    
    // Track drag direction based on movement (only when dragging)
    if (isDraggingRef.current && prevX !== null) {
      const deltaX = currentX - prevX;
      if (Math.abs(deltaX) > 1) { // Lower threshold for more responsive direction tracking
        dragDirectionRef.current = deltaX > 0 ? 'right' : 'left';
      }
      
      // Update drag preview position for auto-scroll detection
      // Preview is 100px wide, centered on touch position
      dragPreviewPositionRef.current = {
        left: currentX - 50,
        right: currentX + 50
      };
    }
    
    // Handle drag preview movement if dragging
    handleTouchMove(event);
    
    // Handle swipe navigation (only if not dragging)
    if (!isDraggingRef.current) {
      handleSwipeMove(event);
    }
  }, [handleTouchMove, handleSwipeMove]);
  
  const handleCombinedTouchEnd = useCallback(() => {
    touchPositionRef.current = null;
    lastTouchXRef.current = null;
    dragDirectionRef.current = null;
    dragPreviewPositionRef.current = null;
    
    // Stop auto-scroll
    if (scrollAnimationRef.current) {
      cancelAnimationFrame(scrollAnimationRef.current);
      scrollAnimationRef.current = null;
    }
    
    // Handle drag drop if dragging
    handleTouchEnd();
    // Handle swipe navigation
    handleSwipeEnd();
  }, [handleTouchEnd, handleSwipeEnd]);
  
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
          gap-4
          p-4
          overflow-x-auto
          overflow-y-visible
          flex-1
          min-h-0
          
          /* Desktop: columns side by side */
          md:overflow-x-visible
          
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
