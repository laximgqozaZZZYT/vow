"use client";

/**
 * ExpandButton Component for Habit Cards
 * 
 * A button that toggles the expand/collapse state of subtask lists
 * in Habit cards on the Kanban board.
 * 
 * Features:
 * - Displays ▼ when collapsed and ▲ when expanded
 * - Shows subtask count badge
 * - Minimum 44x44px touch target for accessibility
 * 
 * @module Board.ExpandButton
 * 
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4
 */

import React, { memo, useCallback } from 'react';

export interface ExpandButtonProps {
  /** Whether the subtask list is expanded */
  isExpanded: boolean;
  /** Callback when the button is clicked */
  onClick: () => void;
  /** Number of subtasks (displayed as badge) */
  count: number;
}

/**
 * ExpandButton component for toggling subtask visibility
 * 
 * Displays an expand/collapse icon with a subtask count badge.
 * Designed with accessibility in mind, ensuring a minimum 44x44px touch target.
 * 
 * @param props - Component props
 * @returns JSX element or null if count is 0
 * 
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4
 */
function ExpandButtonComponent({
  isExpanded,
  onClick,
  count,
}: ExpandButtonProps): React.ReactElement | null {
  // Don't render if there are no subtasks (Requirement 2.2)
  if (count <= 0) {
    return null;
  }

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onClick();
  }, [onClick]);

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-expanded={isExpanded}
      aria-label={isExpanded ? `サブタスクを折りたたむ (${count}件)` : `サブタスクを展開 (${count}件)`}
      title={isExpanded ? 'サブタスクを折りたたむ' : 'サブタスクを展開'}
      className="
        inline-flex
        items-center
        justify-center
        gap-1
        min-w-[44px]
        min-h-[44px]
        px-2
        py-1
        text-sm
        font-medium
        text-muted-foreground
        bg-muted
        hover:bg-muted/80
        hover:text-foreground
        active:bg-muted/60
        rounded-md
        transition-colors
        focus-visible:outline-2
        focus-visible:outline-primary
        focus-visible:outline-offset-2
      "
    >
      {/* Subtask count badge */}
      <span className="
        inline-flex
        items-center
        justify-center
        min-w-[20px]
        h-5
        px-1.5
        text-xs
        font-semibold
        bg-primary/10
        text-primary
        rounded-full
      ">
        {count}
      </span>
      
      {/* Expand/Collapse icon - Requirement 2.3 */}
      <span className="text-base" aria-hidden="true">
        {isExpanded ? '▲' : '▼'}
      </span>
    </button>
  );
}

/**
 * Memoized ExpandButton component for performance optimization
 */
export const ExpandButton = memo(ExpandButtonComponent);

export default ExpandButton;
