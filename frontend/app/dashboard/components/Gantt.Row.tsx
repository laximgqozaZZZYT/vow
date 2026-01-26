/**
 * Gantt Row Component
 * 
 * Renders a single row in the Gantt chart row names panel.
 * Includes expand/collapse toggle, indentation, and row name.
 * 
 * @module Gantt.Row
 * 
 * Validates: Requirements 2.1, 2.2, 2.4, 2.5, 2.6, 5.1, 5.2, 5.3, 5.4, 9.1, 9.2
 */

import { memo } from 'react';
import type { GanttRowData } from '../utils/ganttDataUtils';

export interface GanttRowProps {
  /** Row data */
  row: GanttRowData;
  /** Row height in pixels */
  rowHeight: number;
  /** Indentation width per level */
  indentWidth?: number;
  /** Whether this row is highlighted */
  isHighlighted?: boolean;
  /** Callback when expand/collapse is toggled */
  onToggleExpand: (id: string) => void;
  /** Callback when row is clicked */
  onClick: () => void;
}

/**
 * Expand/Collapse Toggle Icon
 */
function ExpandIcon({ isExpanded }: { isExpanded: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}
    >
      <path
        d="M4 2L8 6L4 10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Goal Icon
 */
function GoalIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-primary"
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

/**
 * Habit Icon
 */
function HabitIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-muted-foreground"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

/**
 * Gantt Row Component
 */
function GanttRowComponent({
  row,
  rowHeight,
  indentWidth = 16,
  isHighlighted = false,
  onToggleExpand,
  onClick
}: GanttRowProps) {
  const indent = row.depth * indentWidth;
  const minHeight = Math.max(rowHeight, 36); // Reduced touch target for compact view

  return (
    <div
      className={`
        flex items-center gap-0.5
        border-b border-border
        hover:bg-muted/50
        transition-colors
        cursor-pointer
        ${isHighlighted ? 'bg-primary/10' : ''}
        ${row.isCompleted ? 'opacity-60' : ''}
      `}
      style={{
        height: minHeight,
        paddingLeft: indent + 4,
        paddingRight: 4
      }}
      onClick={onClick}
      role="row"
      aria-expanded={row.hasChildren ? row.isExpanded : undefined}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {/* Expand/Collapse Toggle */}
      {row.hasChildren ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand(row.id);
          }}
          className="
            w-5 h-5 flex items-center justify-center
            rounded hover:bg-muted
            text-muted-foreground
            focus-visible:outline-2 focus-visible:outline-primary
          "
          aria-label={row.isExpanded ? '折りたたむ' : '展開する'}
        >
          <ExpandIcon isExpanded={row.isExpanded} />
        </button>
      ) : (
        <div className="w-5" /> // Spacer
      )}

      {/* Type Icon */}
      <div className="flex-shrink-0">
        {row.type === 'goal' ? <GoalIcon /> : <HabitIcon />}
      </div>

      {/* Row Name */}
      <span
        className={`
          flex-1 truncate text-xs
          ${row.type === 'goal' ? 'font-medium' : ''}
          ${row.isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'}
        `}
        title={row.name}
      >
        {row.name}
      </span>

      {/* Progress Badge */}
      <span
        className={`
          flex-shrink-0 text-[10px] px-1 py-0.5 rounded
          ${row.progress >= 100
            ? 'bg-success/20 text-success'
            : row.progress > 0
              ? 'bg-primary/20 text-primary'
              : 'bg-muted text-muted-foreground'
          }
        `}
      >
        {Math.round(row.progress)}%
      </span>
    </div>
  );
}

export const GanttRow = memo(GanttRowComponent);
export default GanttRow;
