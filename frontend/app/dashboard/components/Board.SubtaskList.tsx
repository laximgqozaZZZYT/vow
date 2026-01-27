"use client";

/**
 * SubtaskList Component for Board Section
 * 
 * Displays subtasks (Sticky'n items) associated with a Habit in the expanded view.
 * Uses the same visual format as standalone Sticky'n items in the Kanban board.
 * 
 * @module Board.SubtaskList
 * 
 * Validates: Requirements 3.2, 3.3, 6.1, 6.2
 */

import { useCallback } from 'react';
import type { Sticky } from '../types';

/**
 * Props for SubtaskList component
 */
export interface SubtaskListProps {
  /** Subtasks to display */
  subtasks: Sticky[];
  /** Callback when subtask completion is toggled */
  onComplete: (stickyId: string) => void;
  /** Callback when subtask edit is requested */
  onEdit: (stickyId: string) => void;
}

/**
 * SubtaskList component
 * 
 * Renders a list of subtasks (Sticky'n items) in the same format as
 * standalone Sticky'n items in the Kanban board.
 * 
 * **Validates: Requirements 3.2** - Displays all Sticky_n items associated with the Habit
 * **Validates: Requirements 3.3** - Uses the same visual format as standalone Sticky_n items
 */
export default function SubtaskList({
  subtasks,
  onComplete,
  onEdit
}: SubtaskListProps) {
  if (subtasks.length === 0) {
    return null;
  }

  return (
    <div className="
      flex
      flex-col
      gap-2
      mt-2
      pt-2
      border-t
      border-border
      ml-4
    ">
      <span className="text-xs text-muted-foreground">サブタスク</span>
      {subtasks.map(subtask => (
        <SubtaskItem
          key={subtask.id}
          subtask={subtask}
          onComplete={() => onComplete(subtask.id)}
          onEdit={() => onEdit(subtask.id)}
        />
      ))}
    </div>
  );
}

/**
 * Props for SubtaskItem component
 */
interface SubtaskItemProps {
  /** Subtask to display */
  subtask: Sticky;
  /** Callback when completion is toggled */
  onComplete: () => void;
  /** Callback when edit is requested */
  onEdit: () => void;
}

/**
 * SubtaskItem component
 * 
 * Renders a single subtask item with checkbox and name.
 * Styled consistently with PendingStickyCard and CompletedStickyCard.
 * 
 * **Validates: Requirements 6.1** - Checkbox click toggles completion state
 * **Validates: Requirements 6.2** - Name click opens edit modal
 */
function SubtaskItem({
  subtask,
  onComplete,
  onEdit
}: SubtaskItemProps) {
  const isCompleted = subtask.completed;

  /**
   * Handle card click (opens edit modal)
   * Ignores clicks on the checkbox button
   * Stops propagation to prevent parent HabitCard click handler
   */
  const handleCardClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;
    onEdit();
  }, [onEdit]);

  /**
   * Handle checkbox click
   * Stops propagation to prevent card click handler
   */
  const handleCheckboxClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onComplete();
  }, [onComplete]);

  return (
    <div
      onClick={handleCardClick}
      className={`
        p-3
        bg-card
        border
        rounded-lg
        shadow-sm
        transition-all
        duration-150
        cursor-pointer
        hover:shadow-md
        ${isCompleted 
          ? 'border-success/50 bg-success/5 hover:border-success' 
          : 'border-warning/50 bg-warning/5 hover:border-warning'
        }
      `}
    >
      <div className="flex items-start gap-2">
        {/* Checkbox - Validates: Requirements 6.1 */}
        <button
          onClick={handleCheckboxClick}
          className={`
            flex-shrink-0
            w-6
            h-6
            mt-0.5
            rounded
            border-2
            transition-colors
            focus-visible:outline-2
            focus-visible:outline-primary
            min-w-[44px]
            min-h-[44px]
            flex
            items-center
            justify-center
            ${isCompleted 
              ? 'bg-success border-success text-white' 
              : 'border-warning bg-transparent hover:bg-warning/10'
            }
          `}
          aria-label={isCompleted ? "Mark as incomplete" : "Mark as complete"}
        >
          {isCompleted && (
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
          )}
        </button>
        
        {/* Content - Validates: Requirements 6.2 (click opens edit modal) */}
        <div className="flex-1 min-w-0">
          <span
            className={`
              text-sm
              text-left
              ${isCompleted 
                ? 'line-through text-muted-foreground' 
                : 'text-foreground'
              }
            `}
          >
            {subtask.name}
          </span>
        </div>
      </div>
    </div>
  );
}
