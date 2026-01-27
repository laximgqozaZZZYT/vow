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
import type { HabitSubtasksMap } from '../hooks/useHabitSubtasks';
import HabitCard from './Board.HabitCard';

/**
 * Column configuration for Kanban board
 */
export interface ColumnConfig {
  id: HabitStatus;
  title: string;
  titleJa: string;
  type?: 'habit' | 'sticky' | 'mixed' | 'planned_with_stickies';
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
  /** Pending stickies to display (for planned column) */
  pendingStickies?: Sticky[];
  /** Callback when sticky is completed/uncompleted */
  onStickyComplete?: (stickyId: string) => void;
  /** Callback when sticky edit is requested */
  onStickyEdit?: (stickyId: string) => void;
  /** Callback when new habit is requested */
  onNewHabit?: () => void;
  /** Callback when new sticky is requested */
  onNewSticky?: () => void;
  /** Map of habit IDs to their subtasks - Task 6.1 (Requirements: 1.1) */
  subtasksByHabit?: HabitSubtasksMap;
  /** Function to check if a habit is expanded - Task 6.2 (Requirements: 7.1, 7.2) */
  isExpanded?: (habitId: string) => boolean;
  /** Callback to toggle expand state - Task 6.2 (Requirements: 7.1, 7.2) */
  onToggleExpand?: (habitId: string) => void;
  /** Callback when subtask completion is toggled - Task 6.3 (Requirements: 6.1) */
  onSubtaskComplete?: (stickyId: string) => void;
  /** Callback when subtask edit is requested - Task 6.3 (Requirements: 6.2) */
  onSubtaskEdit?: (stickyId: string) => void;
  /** Function to check if a habit needs warning indicator - Task 6.4 (Requirements: 5.1, 5.2, 5.5) */
  needsWarning?: (habitId: string) => boolean;
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
  pendingStickies,
  onStickyComplete,
  onStickyEdit,
  onNewHabit,
  onNewSticky,
  subtasksByHabit,
  isExpanded,
  onToggleExpand,
  onSubtaskComplete,
  onSubtaskEdit,
  needsWarning
}: KanbanColumnProps) {
  
  // Calculate total count for mixed columns or planned column with stickies
  const totalCount = habits.length + (completedStickies?.length || 0) + (pendingStickies?.length || 0);
  
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
        min-w-0
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
        {/* Add Habit Button for planned column */}
        {column.id === 'planned' && onNewHabit && (
          <button
            onClick={onNewHabit}
            className="
              flex items-center justify-center gap-1.5
              px-3 py-2
              text-xs font-medium
              bg-primary hover:bg-primary/90
              text-primary-foreground
              rounded-md
              transition-colors
              shadow-sm
              min-h-[36px]
              mb-1
            "
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Habit
          </button>
        )}
        
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
                subtasks={subtasksByHabit?.[habit.id]}
                isExpanded={isExpanded?.(habit.id)}
                onToggleExpand={onToggleExpand ? () => onToggleExpand(habit.id) : undefined}
                onSubtaskComplete={onSubtaskComplete}
                onSubtaskEdit={onSubtaskEdit}
                showWarning={needsWarning?.(habit.id)}
                level={habit.level}
              />
            ))}
            
            {/* Pending Stickies (for planned column) */}
            {pendingStickies && pendingStickies.length > 0 && (
              <>
                {habits.length > 0 && (
                  <div className="border-t border-border my-2" />
                )}
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">Sticky'n</span>
                  {onNewSticky && (
                    <button
                      onClick={onNewSticky}
                      className="
                        flex items-center justify-center
                        w-6 h-6
                        text-warning hover:text-warning/80
                        bg-warning/10 hover:bg-warning/20
                        rounded
                        transition-colors
                      "
                      aria-label="Add Sticky'n"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    </button>
                  )}
                </div>
                {pendingStickies.map(sticky => (
                  <PendingStickyCard
                    key={sticky.id}
                    sticky={sticky}
                    onComplete={() => onStickyComplete?.(sticky.id)}
                    onEdit={() => onStickyEdit?.(sticky.id)}
                  />
                ))}
              </>
            )}
            
            {/* Show Sticky'n add button even when no stickies exist (for planned column) */}
            {column.id === 'planned' && (!pendingStickies || pendingStickies.length === 0) && onNewSticky && (
              <>
                {habits.length > 0 && (
                  <div className="border-t border-border my-2" />
                )}
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">Sticky'n</span>
                  <button
                    onClick={onNewSticky}
                    className="
                      flex items-center justify-center
                      w-6 h-6
                      text-warning hover:text-warning/80
                      bg-warning/10 hover:bg-warning/20
                      rounded
                      transition-colors
                    "
                    aria-label="Add Sticky'n"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </button>
                </div>
              </>
            )}
            
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
 * PendingStickyCard component for displaying pending stickies in planned column
 */
function PendingStickyCard({
  sticky,
  onComplete,
  onEdit
}: {
  sticky: Sticky;
  onComplete: () => void;
  onEdit: () => void;
}) {
  // Handle card tap (single tap opens edit modal)
  const handleCardClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;
    onEdit();
  }, [onEdit]);

  return (
    <div
      onClick={handleCardClick}
      className="
        p-3
        bg-card
        border
        border-warning/50
        bg-warning/5
        rounded-lg
        shadow-sm
        transition-all
        duration-150
        cursor-pointer
        hover:shadow-md
        hover:border-warning
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
            w-6
            h-6
            mt-0.5
            rounded
            border-2
            border-warning
            bg-transparent
            transition-colors
            hover:bg-warning/10
            focus-visible:outline-2
            focus-visible:outline-primary
            min-w-[44px]
            min-h-[44px]
            flex
            items-center
            justify-center
          "
          aria-label="Mark as complete"
        />
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <span
            className="
              text-sm
              text-left
              text-foreground
            "
          >
            {sticky.name}
          </span>
        </div>
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
  // Handle card tap (single tap opens edit modal)
  const handleCardClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;
    onEdit();
  }, [onEdit]);

  return (
    <div
      onClick={handleCardClick}
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
        cursor-pointer
        hover:shadow-md
        hover:border-success
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
            w-6
            h-6
            mt-0.5
            rounded
            border-2
            bg-success
            border-success
            text-white
            transition-colors
            focus-visible:outline-2
            focus-visible:outline-primary
            min-w-[44px]
            min-h-[44px]
            flex
            items-center
            justify-center
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
            className="w-4 h-4"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </button>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <span
            className="
              text-sm
              text-left
              line-through
              text-muted-foreground
            "
          >
            {sticky.name}
          </span>
        </div>
      </div>
    </div>
  );
}
