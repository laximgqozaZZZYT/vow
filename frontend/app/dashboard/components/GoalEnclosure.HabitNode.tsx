/**
 * Habit Node Component for Goal Enclosure Diagram
 * 
 * Renders a Habit as a compact element inside a Goal enclosure.
 * Supports completion styling and click interactions.
 * 
 * Requirements:
 * - 2.2: Display Habit name
 * - 4.2: Handle click to trigger onHabitEdit
 * - 6.3: Minimum touch target size (44x44px)
 */

import React, { memo, useCallback } from 'react';
import { NodeProps } from 'reactflow';
import type { HabitNodeData } from '../utils/goalEnclosureLayout';

export interface HabitNodeProps extends NodeProps<HabitNodeData> {
  /** Callback when the Habit is clicked for editing */
  onHabitEdit?: (habitId: string) => void;
}

/**
 * Habit Node Component
 * 
 * Renders a Habit as a compact element within a Goal enclosure.
 * Provides visual feedback for completion status and supports click interactions.
 */
function HabitNodeComponent({
  id,
  data,
  selected,
}: NodeProps<HabitNodeData>) {
  const { habit, isCompleted, parentGoalId, label } = data;

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Dispatch custom event for habit edit
    const event = new CustomEvent('habitNodeClick', {
      detail: { habitId: habit.id }
    });
    window.dispatchEvent(event);
  }, [habit.id]);

  return (
    <div
      data-testid={`habit-node-${habit.id}`}
      className={`
        habit-node
        flex items-center
        px-3 py-2
        rounded-md
        border
        transition-all
        duration-150
        ${isCompleted 
          ? 'bg-success/10 border-success/30 text-muted-foreground' 
          : 'bg-card border-border hover:border-primary/50'
        }
        ${selected ? 'ring-2 ring-primary' : ''}
        hover:shadow-sm
        cursor-pointer
      `}
      onClick={handleClick}
      style={{
        width: '100%',
        height: '100%',
        minWidth: 44,
        minHeight: 44,
      }}
    >
      {/* Completion checkbox indicator */}
      <div
        className={`
          flex-shrink-0
          w-4 h-4
          mr-2
          rounded
          border
          flex items-center justify-center
          ${isCompleted 
            ? 'bg-success border-success' 
            : 'border-border bg-background'
          }
        `}
      >
        {isCompleted && (
          <svg
            className="w-3 h-3 text-success-foreground"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </div>

      {/* Habit name */}
      <span
        className={`
          text-sm
          truncate
          flex-1
          ${isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'}
        `}
        title={label}
      >
        {label}
      </span>

      {/* Habit type indicator */}
      {habit.type === 'avoid' && (
        <span
          className="
            ml-2
            px-1.5 py-0.5
            text-xs
            rounded
            bg-destructive/10
            text-destructive
            flex-shrink-0
          "
          title="Avoid habit"
        >
          ✕
        </span>
      )}
    </div>
  );
}

// Memoize to prevent unnecessary re-renders
export const HabitNode = memo(HabitNodeComponent);

// Export node type for React Flow registration
export const habitNodeType = {
  habitNode: HabitNode,
};
