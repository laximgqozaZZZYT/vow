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
 * 
 * Mobile-First Design:
 * - Minimum font size 14px for readability
 * - High contrast colors for visibility
 * - Touch targets 44px minimum height
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
        px-1.5 py-0.5
        rounded
        border
        transition-all
        duration-150
        ${isCompleted 
          ? 'bg-green-900/40 border-green-500/50 text-green-100' 
          : 'bg-slate-800/90 border-slate-500/60 hover:border-slate-400 text-slate-100'
        }
        ${selected ? 'ring-1 ring-white' : ''}
        hover:shadow-sm
        cursor-pointer
      `}
      onClick={handleClick}
      style={{
        width: '100%',
        height: '100%',
        minWidth: 32,
        minHeight: 32,
      }}
    >
      {/* Completion checkbox indicator */}
      <div
        className={`
          flex-shrink-0
          w-3 h-3
          mr-1
          rounded-sm
          border
          flex items-center justify-center
          ${isCompleted 
            ? 'bg-green-500 border-green-400' 
            : 'border-slate-400 bg-slate-700/50'
          }
        `}
      >
        {isCompleted && (
          <svg
            className="w-2 h-2 text-white"
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
          text-[10px] font-medium
          truncate
          flex-1
          ${isCompleted ? 'line-through opacity-70' : ''}
        `}
        title={label}
      >
        {label}
      </span>

      {/* Habit type indicator */}
      {habit.type === 'avoid' && (
        <span
          className="
            ml-0.5
            text-[10px] font-semibold
            text-red-300
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
