/**
 * Goal Enclosure Node Component for React Flow
 * 
 * Renders a Goal as a rectangular enclosure that can contain Habits and child Goals.
 * Supports completion styling, dark mode, and click interactions.
 * 
 * Requirements:
 * - 1.1: Display Goal name in header
 * - 1.2: Show completion status visually
 * - 1.3: Support dark mode via CSS variables
 * - 1.4: Apply design system colors
 * - 4.1: Handle click to trigger onGoalEdit
 * - 6.2: Ensure dark mode compatibility
 */

import React, { memo, useCallback } from 'react';
import { NodeProps } from 'reactflow';
import type { GoalEnclosureNodeData } from '../utils/goalEnclosureLayout';

export interface GoalEnclosureNodeProps extends NodeProps<GoalEnclosureNodeData> {
  /** Callback when the Goal is clicked for editing */
  onGoalEdit?: (goalId: string) => void;
}

/**
 * Goal Enclosure Node Component
 * 
 * Renders a Goal as a container/enclosure that can hold Habits and nested Goals.
 * The node displays the Goal name in a header area and provides visual feedback
 * for completion status and selection state.
 */
function GoalEnclosureNodeComponent({ 
  id, 
  data, 
  selected,
}: NodeProps<GoalEnclosureNodeData>) {
  const { goal, habitCount, isCompleted, depth, label } = data;

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Dispatch custom event for goal edit
    const event = new CustomEvent('goalEnclosureClick', {
      detail: { goalId: goal.id }
    });
    window.dispatchEvent(event);
  }, [goal.id]);

  // Calculate depth-based styling
  const depthColors = [
    'bg-card border-border',           // depth 0 - root
    'bg-muted/50 border-border/80',    // depth 1
    'bg-muted/30 border-border/60',    // depth 2
    'bg-muted/20 border-border/40',    // depth 3+
  ];
  const colorClass = depthColors[Math.min(depth, depthColors.length - 1)];

  return (
    <div
      data-testid={`goal-enclosure-${goal.id}`}
      className={`
        goal-enclosure-node
        relative
        rounded-lg
        border-2
        shadow-sm
        transition-all
        duration-200
        ${colorClass}
        ${isCompleted ? 'opacity-60' : ''}
        ${selected ? 'ring-2 ring-primary shadow-md' : ''}
        hover:shadow-md
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
      {/* Header with Goal name */}
      <div
        className={`
          goal-enclosure-header
          px-3 py-2
          border-b border-border/50
          rounded-t-md
          ${isCompleted ? 'bg-muted/50' : 'bg-card/80'}
        `}
        style={{ minHeight: 40 }}
      >
        <div className="flex items-center gap-2">
          {/* Completion indicator */}
          {isCompleted && (
            <svg
              className="w-4 h-4 text-success flex-shrink-0"
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
          
          {/* Goal name */}
          <span
            className={`
              text-sm font-medium
              truncate
              ${isCompleted ? 'text-muted-foreground line-through' : 'text-foreground'}
            `}
            title={label}
          >
            {label}
          </span>
          
          {/* Habit count badge */}
          {habitCount > 0 && (
            <span
              className="
                ml-auto
                px-1.5 py-0.5
                text-xs
                rounded-full
                bg-primary/10
                text-primary
                flex-shrink-0
              "
            >
              {habitCount}
            </span>
          )}
        </div>
      </div>

      {/* Content area for Habits and child Goals */}
      <div
        className="goal-enclosure-content p-2"
        style={{ minHeight: 20 }}
      >
        {/* Child nodes (Habits and nested Goals) are rendered by React Flow */}
      </div>
    </div>
  );
}

// Memoize to prevent unnecessary re-renders
export const GoalEnclosureNode = memo(GoalEnclosureNodeComponent);

// Export node type for React Flow registration
export const goalEnclosureNodeType = {
  goalEnclosure: GoalEnclosureNode,
};
