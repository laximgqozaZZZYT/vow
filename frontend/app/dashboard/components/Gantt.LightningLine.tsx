/**
 * Gantt Lightning Line Component
 * 
 * Renders the lightning line (稲妻線) showing planned vs actual progress deviation.
 * 
 * @module Gantt.LightningLine
 * 
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
 */

import { memo } from 'react';
import type { LightningPoint } from '../utils/lightningLineUtils';

export interface GanttLightningLineProps {
  /** Lightning line points */
  points: LightningPoint[];
  /** X position of today */
  todayX: number;
  /** Height of each row */
  rowHeight: number;
  /** Height of the header */
  headerHeight: number;
  /** Whether the lightning line is visible */
  visible: boolean;
}

/**
 * Generate SVG path for the lightning line
 */
function generatePath(
  points: LightningPoint[],
  todayX: number,
  rowHeight: number,
  headerHeight: number
): string {
  if (points.length === 0) return '';

  const pathParts: string[] = [];
  
  // Start from the top of the first row
  const firstPoint = points[0];
  const startX = todayX + firstPoint.xOffset;
  const startY = headerHeight;
  pathParts.push(`M ${startX} ${startY}`);

  // Draw through each row center
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    const x = todayX + point.xOffset;
    const rowCenterY = headerHeight + (i * rowHeight) + (rowHeight / 2);
    pathParts.push(`L ${x} ${rowCenterY}`);
  }

  // Extend to the bottom
  const lastPoint = points[points.length - 1];
  const endX = todayX + lastPoint.xOffset;
  const endY = headerHeight + (points.length * rowHeight);
  pathParts.push(`L ${endX} ${endY}`);

  return pathParts.join(' ');
}

/**
 * Gantt Lightning Line Component
 */
function GanttLightningLineComponent({
  points,
  todayX,
  rowHeight,
  headerHeight,
  visible
}: GanttLightningLineProps) {
  if (!visible || points.length === 0) return null;

  const path = generatePath(points, todayX, rowHeight, headerHeight);

  return (
    <g className="pointer-events-none">
      {/* Glow effect */}
      <path
        d={path}
        fill="none"
        stroke="#f59e0b"
        strokeWidth={6}
        opacity={0.3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Main line */}
      <path
        d={path}
        fill="none"
        stroke="#f59e0b"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Points at each row */}
      {points.map((point, index) => {
        const x = todayX + point.xOffset;
        const y = headerHeight + (index * rowHeight) + (rowHeight / 2);
        
        return (
          <circle
            key={index}
            cx={x}
            cy={y}
            r={4}
            fill="#f59e0b"
            stroke="#ffffff"
            strokeWidth={2}
          />
        );
      })}
    </g>
  );
}

export const GanttLightningLine = memo(GanttLightningLineComponent);
export default GanttLightningLine;
