/**
 * Gantt Bar Component
 * 
 * Renders a schedule bar with progress indicator for a single row.
 * 
 * @module Gantt.Bar
 * 
 * Validates: Requirements 3.1, 3.2, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4
 */

import { memo } from 'react';

export interface GanttBarProps {
  /** X position of the bar start */
  x: number;
  /** Width of the bar in pixels */
  width: number;
  /** Y position of the bar */
  y: number;
  /** Height of the bar */
  height: number;
  /** Progress percentage (0-100) */
  progress: number;
  /** Whether the item is completed */
  isCompleted: boolean;
  /** Whether this is a Goal (vs Habit) */
  isGoal: boolean;
  /** Callback when mouse enters */
  onMouseEnter?: () => void;
  /** Callback when mouse leaves */
  onMouseLeave?: () => void;
}

/**
 * Gantt Bar Component
 * 
 * Renders a horizontal bar representing a scheduled item with progress fill.
 */
function GanttBarComponent({
  x,
  width,
  y,
  height,
  progress,
  isCompleted,
  isGoal,
  onMouseEnter,
  onMouseLeave
}: GanttBarProps) {
  // Don't render if width is too small
  if (width < 2) return null;

  const progressWidth = (progress / 100) * width;
  const cornerRadius = Math.min(4, height / 2);

  return (
    <g
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ cursor: 'pointer' }}
    >
      {/* Background bar (planned period) */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={cornerRadius}
        ry={cornerRadius}
        fill={isGoal ? '#3b82f6' : '#64748b'}
        opacity={isCompleted ? 0.3 : 0.25}
      />
      
      {/* Progress bar (actual progress) */}
      {progressWidth > 0 && (
        <rect
          x={x}
          y={y}
          width={Math.min(progressWidth, width)}
          height={height}
          rx={cornerRadius}
          ry={cornerRadius}
          fill={isCompleted ? '#22c55e' : '#3b82f6'}
          opacity={0.9}
        />
      )}
      
      {/* Border */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={cornerRadius}
        ry={cornerRadius}
        fill="none"
        stroke={isGoal ? '#3b82f6' : '#94a3b8'}
        strokeWidth={1}
        opacity={isCompleted ? 0.5 : 0.8}
      />
    </g>
  );
}

export const GanttBar = memo(GanttBarComponent);
export default GanttBar;
