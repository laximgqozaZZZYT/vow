/**
 * Lightning Line Utilities
 * 
 * Provides functions for calculating the lightning line (稲妻線) points
 * that visualize the difference between planned and actual progress.
 * 
 * @module lightningLineUtils
 * 
 * Validates: Requirements 7.2, 7.3, 7.4
 */

import type { GanttRowData } from './ganttDataUtils';

// ============================================================================
// Interfaces
// ============================================================================

/**
 * A single point on the lightning line
 */
export interface LightningPoint {
  /** Row index in the visible rows array */
  rowIndex: number;
  /** X offset from the today line (positive = ahead, negative = behind) */
  xOffset: number;
}

// ============================================================================
// Lightning Line Calculation
// ============================================================================

/**
 * Calculate the planned progress for a row at a given date
 * 
 * @param row - The row data
 * @param currentDate - The date to calculate progress for
 * @returns Planned progress percentage (0-100)
 */
function calculatePlannedProgress(row: GanttRowData, currentDate: Date): number {
  if (!row.startDate || !row.endDate) return 0;
  
  const startTime = row.startDate.getTime();
  const endTime = row.endDate.getTime();
  const currentTime = currentDate.getTime();
  
  // If current date is before start, planned progress is 0
  if (currentTime <= startTime) return 0;
  
  // If current date is after end, planned progress is 100
  if (currentTime >= endTime) return 100;
  
  const totalDuration = endTime - startTime;
  const elapsedDuration = currentTime - startTime;
  
  return (elapsedDuration / totalDuration) * 100;
}

/**
 * Calculate lightning line points for all visible rows
 * 
 * The lightning line shows the deviation between planned and actual progress.
 * - Positive xOffset: actual progress is ahead of planned (line shifts right)
 * - Negative xOffset: actual progress is behind planned (line shifts left)
 * 
 * @param rows - Visible row data
 * @param todayDate - Current date
 * @param dayWidth - Pixels per day in the timeline
 * @returns Array of lightning points
 * 
 * Validates: Requirements 7.2, 7.3, 7.4
 */
export function calculateLightningPoints(
  rows: GanttRowData[],
  todayDate: Date,
  dayWidth: number
): LightningPoint[] {
  return rows.map((row, index) => {
    // If no date range, no deviation
    if (!row.startDate || !row.endDate) {
      return { rowIndex: index, xOffset: 0 };
    }
    
    const plannedProgress = calculatePlannedProgress(row, todayDate);
    const actualProgress = row.progress;
    
    // Calculate the progress difference
    const progressDiff = actualProgress - plannedProgress;
    
    // Convert progress difference to pixel offset
    // progressDiff is in percentage points (0-100)
    // We need to convert this to days, then to pixels
    const totalDuration = row.endDate.getTime() - row.startDate.getTime();
    const totalDays = totalDuration / (24 * 60 * 60 * 1000);
    
    // progressDiff / 100 gives us the fraction of total duration
    const daysOffset = (progressDiff / 100) * totalDays;
    const xOffset = daysOffset * dayWidth;
    
    return { rowIndex: index, xOffset };
  });
}

/**
 * Generate SVG path data for the lightning line
 * 
 * @param points - Lightning points
 * @param todayX - X position of the today line
 * @param rowHeight - Height of each row
 * @param headerHeight - Height of the timeline header
 * @returns SVG path data string
 */
export function generateLightningPath(
  points: LightningPoint[],
  todayX: number,
  rowHeight: number,
  headerHeight: number
): string {
  if (points.length === 0) return '';
  
  const pathParts: string[] = [];
  
  // Start from the top
  const firstPoint = points[0];
  const startX = todayX + firstPoint.xOffset;
  const startY = headerHeight;
  pathParts.push(`M ${startX} ${startY}`);
  
  // Draw zigzag through each row
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    const x = todayX + point.xOffset;
    const rowCenterY = headerHeight + (i * rowHeight) + (rowHeight / 2);
    
    // Line to the center of this row
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
 * Calculate the maximum deviation from the today line
 * Useful for determining if the lightning line is visible
 * 
 * @param points - Lightning points
 * @returns Maximum absolute xOffset value
 */
export function getMaxDeviation(points: LightningPoint[]): number {
  if (points.length === 0) return 0;
  return Math.max(...points.map(p => Math.abs(p.xOffset)));
}
