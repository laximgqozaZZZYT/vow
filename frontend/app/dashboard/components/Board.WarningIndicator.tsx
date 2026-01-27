"use client";

/**
 * WarningIndicator Component for Habit Cards
 * 
 * A visually distinct warning indicator that displays when a Habit
 * has subtasks but all of them are uncompleted.
 * 
 * Features:
 * - ⚠️ icon with warning color (yellow/orange)
 * - Optional tooltip support
 * - Accessible with aria-label
 * 
 * @module Board.WarningIndicator
 * 
 * Validates: Requirements 5.4
 */

import React, { memo } from 'react';

export interface WarningIndicatorProps {
  /** Optional tooltip text to display on hover */
  tooltip?: string;
}

/**
 * WarningIndicator component for displaying warning state on Habit cards
 * 
 * Displays a visually distinct warning icon (⚠️) with warning color styling.
 * Used to indicate that a Habit has subtasks but none are completed.
 * 
 * @param props - Component props
 * @returns JSX element
 * 
 * Validates: Requirements 5.4
 */
function WarningIndicatorComponent({
  tooltip = 'すべてのサブタスクが未完了です',
}: WarningIndicatorProps): React.ReactElement {
  return (
    <span
      role="img"
      aria-label={tooltip}
      title={tooltip}
      className="
        inline-flex
        items-center
        justify-center
        text-warning
        text-sm
        animate-pulse
      "
    >
      ⚠️
    </span>
  );
}

/**
 * Memoized WarningIndicator component for performance optimization
 */
export const WarningIndicator = memo(WarningIndicatorComponent);

export default WarningIndicator;
