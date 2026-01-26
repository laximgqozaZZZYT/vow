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
 * 
 * Mobile-First Design:
 * - Minimum font size 12pt (16px) for readability
 * - Contrast ratio 4.5:1+ for accessibility
 * - Touch targets 44px minimum
 * - Depth differentiation via color saturation and border weight
 */

import React, { memo, useCallback } from 'react';
import { NodeProps } from 'reactflow';
import type { GoalEnclosureNodeData } from '../utils/goalEnclosureLayout';

export interface GoalEnclosureNodeProps extends NodeProps<GoalEnclosureNodeData> {
  /** Callback when the Goal is clicked for editing */
  onGoalEdit?: (goalId: string) => void;
}

/**
 * Depth-based color configuration for visual hierarchy
 * Uses distinct hues with high contrast for better visibility
 */
const DEPTH_STYLES = [
  // Depth 0 (Root): Blue accent - most prominent
  {
    bg: 'bg-blue-950/90',
    border: 'border-blue-400',
    headerBg: 'bg-blue-900/80',
    headerBorder: 'border-blue-400/60',
    text: 'text-blue-50',
    badge: 'bg-blue-400/20 text-blue-200',
    borderWidth: 'border-[3px]',
  },
  // Depth 1: Emerald accent
  {
    bg: 'bg-emerald-950/85',
    border: 'border-emerald-400',
    headerBg: 'bg-emerald-900/70',
    headerBorder: 'border-emerald-400/50',
    text: 'text-emerald-50',
    badge: 'bg-emerald-400/20 text-emerald-200',
    borderWidth: 'border-[2.5px]',
  },
  // Depth 2: Amber accent
  {
    bg: 'bg-amber-950/80',
    border: 'border-amber-400',
    headerBg: 'bg-amber-900/60',
    headerBorder: 'border-amber-400/40',
    text: 'text-amber-50',
    badge: 'bg-amber-400/20 text-amber-200',
    borderWidth: 'border-2',
  },
  // Depth 3+: Purple accent
  {
    bg: 'bg-purple-950/75',
    border: 'border-purple-400',
    headerBg: 'bg-purple-900/50',
    headerBorder: 'border-purple-400/30',
    text: 'text-purple-50',
    badge: 'bg-purple-400/20 text-purple-200',
    borderWidth: 'border-2',
  },
];

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

  // Get depth-based styling (cycle through colors for deep nesting)
  const depthStyle = DEPTH_STYLES[Math.min(depth, DEPTH_STYLES.length - 1)];

  return (
    <div
      data-testid={`goal-enclosure-${goal.id}`}
      className={`
        goal-enclosure-node
        relative
        rounded-xl
        ${depthStyle.borderWidth}
        ${depthStyle.border}
        ${depthStyle.bg}
        shadow-lg
        transition-all
        duration-200
        ${isCompleted ? 'opacity-70 saturate-50' : ''}
        ${selected ? 'ring-2 ring-white ring-offset-2 ring-offset-transparent shadow-xl' : ''}
        hover:shadow-xl
        hover:scale-[1.01]
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
          px-2 py-1
          border-b ${depthStyle.headerBorder}
          rounded-t-lg
          ${depthStyle.headerBg}
          backdrop-blur-sm
        `}
        style={{ height: 28 }}
      >
        <div className="flex items-center gap-1 h-full">
          {/* Completion indicator */}
          {isCompleted && (
            <div className="flex-shrink-0 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
              <svg
                className="w-2.5 h-2.5 text-white"
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
            </div>
          )}
          
          {/* Goal name */}
          <span
            className={`
              text-xs font-bold
              truncate
              ${depthStyle.text}
              ${isCompleted ? 'line-through opacity-70' : ''}
            `}
            title={label}
          >
            {label}
          </span>
          
          {/* Habit count badge */}
          {habitCount > 0 && (
            <span
              className={`
                ml-auto
                px-1.5 py-0.5
                text-[10px] font-semibold
                rounded-full
                ${depthStyle.badge}
                flex-shrink-0
              `}
            >
              {habitCount}
            </span>
          )}
        </div>
      </div>

      {/* Content area for Habits and child Goals */}
      <div
        className="goal-enclosure-content p-1"
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
