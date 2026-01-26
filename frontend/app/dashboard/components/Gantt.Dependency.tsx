/**
 * Gantt Dependency Component
 * 
 * Renders a dependency arrow between two related Habits.
 * 
 * @module Gantt.Dependency
 * 
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4
 */

import { memo } from 'react';

export interface GanttDependencyProps {
  /** X position of the predecessor bar end */
  fromX: number;
  /** Y position of the predecessor row center */
  fromY: number;
  /** X position of the successor bar start */
  toX: number;
  /** Y position of the successor row center */
  toY: number;
  /** Whether this dependency is highlighted */
  isHighlighted?: boolean;
  /** Callback when mouse enters */
  onMouseEnter?: () => void;
  /** Callback when mouse leaves */
  onMouseLeave?: () => void;
}

/**
 * Generate SVG path for the dependency arrow
 * Creates a smooth curve from predecessor to successor
 */
function generateDependencyPath(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number
): string {
  // Add some horizontal offset for the curve
  const midX = fromX + (toX - fromX) / 2;
  
  // If going down or same level
  if (toY >= fromY) {
    return `
      M ${fromX} ${fromY}
      L ${fromX + 10} ${fromY}
      Q ${midX} ${fromY}, ${midX} ${(fromY + toY) / 2}
      Q ${midX} ${toY}, ${toX - 10} ${toY}
      L ${toX} ${toY}
    `;
  }
  
  // If going up
  return `
    M ${fromX} ${fromY}
    L ${fromX + 10} ${fromY}
    Q ${midX} ${fromY}, ${midX} ${(fromY + toY) / 2}
    Q ${midX} ${toY}, ${toX - 10} ${toY}
    L ${toX} ${toY}
  `;
}

/**
 * Gantt Dependency Component
 */
function GanttDependencyComponent({
  fromX,
  fromY,
  toX,
  toY,
  isHighlighted = false,
  onMouseEnter,
  onMouseLeave
}: GanttDependencyProps) {
  const path = generateDependencyPath(fromX, fromY, toX, toY);
  
  // Arrow head size
  const arrowSize = 6;

  return (
    <g
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ cursor: 'pointer' }}
    >
      {/* Dependency line */}
      <path
        d={path}
        fill="none"
        stroke={isHighlighted ? 'var(--color-primary)' : 'var(--color-border)'}
        strokeWidth={isHighlighted ? 2 : 1.5}
        strokeDasharray={isHighlighted ? 'none' : '4 2'}
        className="transition-all"
      />
      
      {/* Arrow head */}
      <polygon
        points={`
          ${toX},${toY}
          ${toX - arrowSize},${toY - arrowSize / 2}
          ${toX - arrowSize},${toY + arrowSize / 2}
        `}
        fill={isHighlighted ? 'var(--color-primary)' : 'var(--color-border)'}
        className="transition-all"
      />
    </g>
  );
}

export const GanttDependency = memo(GanttDependencyComponent);
export default GanttDependency;
