/**
 * Gantt Tooltip Component
 * 
 * Displays detailed information when hovering over a bar.
 * 
 * @module Gantt.Tooltip
 * 
 * Validates: Requirement 9.3
 */

import { memo } from 'react';
import type { GanttRowData } from '../utils/ganttDataUtils';

export interface GanttTooltipProps {
  /** Row data to display */
  row: GanttRowData | null;
  /** X position */
  x: number;
  /** Y position */
  y: number;
  /** Whether the tooltip is visible */
  visible: boolean;
}

/**
 * Format date for display
 */
function formatDate(date: Date | null): string {
  if (!date) return '-';
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Gantt Tooltip Component
 */
function GanttTooltipComponent({
  row,
  x,
  y,
  visible
}: GanttTooltipProps) {
  if (!visible || !row) return null;

  return (
    <div
      className="
        fixed z-50 pointer-events-none
        px-3 py-2
        bg-card border border-border
        rounded-lg shadow-lg
        text-sm
        max-w-xs
      "
      style={{
        left: x + 10,
        top: y - 10,
        transform: 'translateY(-100%)'
      }}
    >
      {/* Name */}
      <div className="font-medium text-foreground truncate">
        {row.name}
      </div>
      
      {/* Type */}
      <div className="text-xs text-muted-foreground mt-0.5">
        {row.type === 'goal' ? 'ゴール' : '習慣'}
      </div>
      
      {/* Dates */}
      <div className="flex gap-4 mt-2 text-xs">
        <div>
          <span className="text-muted-foreground">開始: </span>
          <span className="text-foreground">{formatDate(row.startDate)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">期限: </span>
          <span className="text-foreground">{formatDate(row.endDate)}</span>
        </div>
      </div>
      
      {/* Progress */}
      <div className="mt-2">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-muted-foreground">進捗</span>
          <span className={row.progress >= 100 ? 'text-success' : 'text-foreground'}>
            {Math.round(row.progress)}%
          </span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              row.progress >= 100 ? 'bg-success' : 'bg-primary'
            }`}
            style={{ width: `${Math.min(100, row.progress)}%` }}
          />
        </div>
      </div>
      
      {/* Status */}
      {row.isCompleted && (
        <div className="mt-2 text-xs text-success flex items-center gap-1">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          完了
        </div>
      )}
    </div>
  );
}

export const GanttTooltip = memo(GanttTooltipComponent);
export default GanttTooltip;
