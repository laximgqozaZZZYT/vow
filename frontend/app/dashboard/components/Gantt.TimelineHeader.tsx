/**
 * Gantt Timeline Header Component
 * 
 * Renders the timeline header with date labels and view mode controls.
 * 
 * @module Gantt.TimelineHeader
 * 
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.7
 */

import { memo } from 'react';
import type { TimelineCell, ViewMode } from '../hooks/useGanttTimeline';

export interface GanttTimelineHeaderProps {
  /** Timeline cells */
  cells: TimelineCell[];
  /** Current view mode */
  viewMode: ViewMode;
  /** Callback to change view mode */
  onViewModeChange: (mode: ViewMode) => void;
  /** Header height in pixels */
  headerHeight: number;
  /** X position of today */
  todayPosition: number;
  /** Callback to scroll to today */
  onScrollToToday: () => void;
}

/**
 * View Mode Button
 */
function ViewModeButton({
  mode,
  currentMode,
  label,
  onClick
}: {
  mode: ViewMode;
  currentMode: ViewMode;
  label: string;
  onClick: () => void;
}) {
  const isActive = mode === currentMode;
  
  return (
    <button
      onClick={onClick}
      className={`
        px-1.5 py-0.5 text-[10px] font-medium rounded
        transition-colors
        focus-visible:outline-2 focus-visible:outline-primary
        ${isActive
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted text-muted-foreground hover:bg-muted/80'
        }
      `}
      aria-pressed={isActive}
    >
      {label}
    </button>
  );
}

/**
 * Gantt Timeline Header Component
 */
function GanttTimelineHeaderComponent({
  cells,
  viewMode,
  onViewModeChange,
  headerHeight,
  todayPosition,
  onScrollToToday
}: GanttTimelineHeaderProps) {
  return (
    <div
      className="sticky top-0 z-10 bg-card border-b border-border"
      style={{ height: headerHeight }}
    >
      {/* Controls Row */}
      <div className="flex items-center justify-between px-1 py-0.5 border-b border-border bg-muted/50">
        <div className="flex items-center gap-0.5">
          <ViewModeButton
            mode="day"
            currentMode={viewMode}
            label="日"
            onClick={() => onViewModeChange('day')}
          />
          <ViewModeButton
            mode="week"
            currentMode={viewMode}
            label="週"
            onClick={() => onViewModeChange('week')}
          />
          <ViewModeButton
            mode="month"
            currentMode={viewMode}
            label="月"
            onClick={() => onViewModeChange('month')}
          />
        </div>
        
        <button
          onClick={onScrollToToday}
          className="
            px-1.5 py-0.5 text-[10px] font-medium
            bg-primary/10 text-primary
            rounded hover:bg-primary/20
            transition-colors
            focus-visible:outline-2 focus-visible:outline-primary
          "
        >
          今日
        </button>
      </div>
      
      {/* Timeline Cells */}
      <div className="flex h-6">
        {cells.map((cell, index) => (
          <div
            key={index}
            className={`
              flex items-center justify-center
              border-r border-border
              text-[10px]
              ${cell.isToday ? 'bg-primary/10 font-medium text-primary' : ''}
              ${cell.isWeekend ? 'bg-muted/50' : ''}
            `}
            style={{ width: cell.width, minWidth: cell.width }}
          >
            {cell.label}
          </div>
        ))}
      </div>
    </div>
  );
}

export const GanttTimelineHeader = memo(GanttTimelineHeaderComponent);
export default GanttTimelineHeader;
