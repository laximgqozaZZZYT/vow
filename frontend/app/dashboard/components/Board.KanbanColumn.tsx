"use client";

/**
 * KanbanColumn Component for Board Section
 * 
 * Displays a single column in the Kanban board with:
 * - Column header (title in Japanese, habit count badge)
 * - List of HabitCard components
 * - Optional completed stickies (for mixed columns)
 * - Drop target styling for drag-and-drop
 * - Visual feedback when being dragged over
 * 
 * @module Board.KanbanColumn
 * 
 * Validates: Requirements 2.1, 2.2
 */

import { useCallback } from 'react';
import type { Habit, Activity, HabitAction, Sticky } from '../types';
import type { HabitStatus } from '../utils/habitStatusUtils';
import HabitCard from './Board.HabitCard';

/**
 * Column configuration for Kanban board
 */
export interface ColumnConfig {
  id: HabitStatus;
  title: string;
  titleJa: string;
  type?: 'habit' | 'sticky' | 'mixed';
}

export interface KanbanColumnProps {
  /** Column configuration (id, title, titleJa) */
  column: ColumnConfig;
  /** Habits to display in this column */
  habits: Habit[];
  /** All activities (for HabitCard elapsed time calculation) */
  activities: Activity[];
  /** Callback when a habit action is triggered */
  onHabitAction: (habitId: string, action: HabitAction, amount?: number) => void;
  /** Callback when habit edit is requested */
  onHabitEdit: (habitId: string) => void;
  /** Callback when a habit is dropped in this column */
  onDrop: (habitId: string, targetStatus: HabitStatus) => void;
  /** Whether a card is being dragged over this column */
  isDragOver: boolean;
  /** Callback when drag enters this column */
  onDragOver: () => void;
  /** Callback when drag leaves this column */
  onDragLeave: () => void;
  /** Currently dragging habit ID (for visual feedback) */
  draggedHabitId?: string | null;
  /** Callback when drag starts on a habit card */
  onDragStart?: (habitId: string) => void;
  /** Callback when drag ends */
  onDragEnd?: () => void;
  /** Completed stickies to display (for mixed columns) */
  completedStickies?: Sticky[];
  /** Callback when sticky is completed/uncompleted */
  onStickyComplete?: (stickyId: string) => void;
  /** Callback when sticky edit is requested */
  onStickyEdit?: (stickyId: string) => void;
}

/**
 * KanbanColumn component
 * 
 * Renders a single column in the Kanban board with header and habit cards.
 * Supports drag-and-drop with visual feedback.
 */
export default function KanbanColumn({
  column,
  habits,
  activities,
  onHabitAction,
  onHabitEdit,
  onDrop,
  isDragOver,
  onDragOver,
  onDragLeave,
  draggedHabitId,
  onDragStart,
  onDragEnd,
  completedStickies,
  onStickyComplete,
  onStickyEdit
}: KanbanColumnProps) {
  
  // Calculate total count for mixed columns
  const totalCount = habits.length + (completedStickies?.length || 0);
  
  /**
   * Handle drag over event
   * Prevents default to allow drop and notifies parent
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    onDragOver();
  }, [onDragOver]);
  
  /**
   * Handle drag leave event
   */
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only trigger if leaving the column itself, not child elements
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      onDragLeave();
    }
  }, [onDragLeave]);
  
  /**
   * Handle drop event
   * Extracts habit ID from dataTransfer and triggers onDrop
   */
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const habitId = e.dataTransfer.getData('text/plain');
    if (habitId) {
      onDrop(habitId, column.id);
    }
    onDragLeave();
  }, [column.id, onDrop, onDragLeave]);
  
  /**
   * Handle habit complete action
   */
  const handleHabitComplete = useCallback((habitId: string) => (amount?: number) => {
    onHabitAction(habitId, 'complete', amount);
  }, [onHabitAction]);
  
  /**
   * Handle habit edit
   */
  const handleHabitEdit = useCallback((habitId: string) => () => {
    onHabitEdit(habitId);
  }, [onHabitEdit]);
  
  /**
   * Handle drag start on a habit card
   */
  const handleCardDragStart = useCallback((habitId: string) => () => {
    onDragStart?.(habitId);
  }, [onDragStart]);
  
  /**
   * Handle drag end on a habit card
   */
  const handleCardDragEnd = useCallback(() => {
    onDragEnd?.();
  }, [onDragEnd]);
  
  return (
    <div
      data-kanban-column={column.id}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        flex
        flex-col
        flex-1
        min-w-[280px]
        max-w-[400px]
        bg-muted
        border
        rounded-lg
        transition-all
        duration-200
        ${isDragOver 
          ? 'border-primary border-2 bg-primary/5 shadow-lg' 
          : 'border-border'
        }
      `}
    >
      {/* Column Header - Requirement 2.2 */}
      <div className="
        flex
        items-center
        justify-between
        px-4
        py-3
        border-b
        border-border
        bg-card
        rounded-t-lg
      ">
        <h3 className="text-sm font-semibold text-foreground">
          {column.titleJa}
        </h3>
        <span className="
          inline-flex
          items-center
          justify-center
          min-w-[24px]
          h-6
          px-2
          text-xs
          font-medium
          bg-muted
          text-muted-foreground
          rounded-full
        ">
          {totalCount}
        </span>
      </div>
      
      {/* Habit Cards List */}
      <div className="
        flex
        flex-col
        gap-2
        p-3
        overflow-y-auto
        min-h-[200px]
        flex-1
      ">
        {totalCount === 0 ? (
          /* Empty state */
          <div className={`
            flex
            items-center
            justify-center
            h-full
            min-h-[100px]
            text-sm
            text-muted-foreground
            border-2
            border-dashed
            rounded-lg
            transition-colors
            ${isDragOver ? 'border-primary bg-primary/5' : 'border-border'}
          `}>
            {isDragOver ? 'ここにドロップ' : '習慣がありません'}
          </div>
        ) : (
          <>
            {/* Habits */}
            {habits.map(habit => (
              <HabitCard
                key={habit.id}
                habit={habit}
                activities={activities}
                status={column.id}
                onComplete={handleHabitComplete(habit.id)}
                onEdit={handleHabitEdit(habit.id)}
                onDragStart={handleCardDragStart(habit.id)}
                onDragEnd={handleCardDragEnd}
                isDragging={draggedHabitId === habit.id}
              />
            ))}
            
            {/* Completed Stickies (for mixed columns) */}
            {completedStickies && completedStickies.length > 0 && (
              <>
                {habits.length > 0 && (
                  <div className="border-t border-border my-2" />
                )}
                <div className="text-xs text-muted-foreground mb-1">Sticky'n</div>
                {completedStickies.map(sticky => (
                  <CompletedStickyCard
                    key={sticky.id}
                    sticky={sticky}
                    onComplete={() => onStickyComplete?.(sticky.id)}
                    onEdit={() => onStickyEdit?.(sticky.id)}
                  />
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}


/**
 * CompletedStickyCard component for displaying completed stickies in mixed columns
 */
function CompletedStickyCard({
  sticky,
  onComplete,
  onEdit
}: {
  sticky: Sticky;
  onComplete: () => void;
  onEdit: () => void;
}) {
  return (
    <div
      className="
        p-3
        bg-card
        border
        border-success/50
        bg-success/5
        rounded-lg
        shadow-sm
        transition-all
        duration-150
      "
    >
      <div className="flex items-start gap-2">
        {/* Checkbox */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onComplete();
          }}
          className="
            flex-shrink-0
            w-5
            h-5
            mt-0.5
            rounded
            border-2
            bg-success
            border-success
            text-white
            transition-colors
            focus-visible:outline-2
            focus-visible:outline-primary
          "
          aria-label="Mark as incomplete"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-full h-full p-0.5"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </button>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="
              text-sm
              text-left
              line-through
              text-muted-foreground
              hover:text-primary
              transition-colors
            "
          >
            {sticky.name}
          </button>
        </div>
      </div>
    </div>
  );
}
