"use client";

/**
 * StickyColumn Component for Board Section
 * 
 * Displays a column for Sticky'n items in the Kanban board.
 * Shows pending stickies that can be checked off.
 * 
 * @module Board.StickyColumn
 */

import type { Sticky } from '../types';
import type { HabitStatus } from '../utils/habitStatusUtils';

/**
 * Column configuration for Kanban board
 */
export interface ColumnConfig {
  id: HabitStatus;
  title: string;
  titleJa: string;
  type: 'habit' | 'sticky' | 'mixed';
}

export interface StickyColumnProps {
  /** Column configuration */
  column: ColumnConfig;
  /** Stickies to display in this column */
  stickies: Sticky[];
  /** Callback when sticky is completed/uncompleted */
  onStickyComplete: (stickyId: string) => void;
  /** Callback when sticky edit is requested */
  onStickyEdit: (stickyId: string) => void;
}

/**
 * StickyCard component for individual sticky items
 */
function StickyCard({
  sticky,
  onComplete,
  onEdit
}: {
  sticky: Sticky;
  onComplete: () => void;
  onEdit: () => void;
}) {
  return (
    <div
      className={`
        p-3
        bg-card
        border
        rounded-lg
        shadow-sm
        transition-all
        duration-150
        hover:shadow-md
        ${sticky.completed ? 'border-success/50 bg-success/5' : 'border-border'}
      `}
    >
      <div className="flex items-start gap-2">
        {/* Checkbox */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onComplete();
          }}
          className={`
            flex-shrink-0
            w-5
            h-5
            mt-0.5
            rounded
            border-2
            transition-colors
            focus-visible:outline-2
            focus-visible:outline-primary
            ${sticky.completed 
              ? 'bg-success border-success text-white' 
              : 'border-border hover:border-primary'
            }
          `}
          aria-label={sticky.completed ? 'Mark as incomplete' : 'Mark as complete'}
        >
          {sticky.completed && (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-full h-full p-0.5"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </button>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className={`
              text-sm
              text-left
              hover:text-primary
              transition-colors
              ${sticky.completed ? 'line-through text-muted-foreground' : 'text-foreground'}
            `}
          >
            {sticky.name}
          </button>
          
          {sticky.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {sticky.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * StickyColumn component
 */
export default function StickyColumn({
  column,
  stickies,
  onStickyComplete,
  onStickyEdit
}: StickyColumnProps) {
  return (
    <div
      className={`
        flex
        flex-col
        flex-1
        min-w-[280px]
        max-w-[400px]
        bg-muted
        border
        border-border
        rounded-lg
        transition-all
        duration-200
      `}
    >
      {/* Column Header */}
      <div className="
        flex
        items-center
        justify-between
        px-4
        py-3
        border-b
        border-border
        bg-card
        rounded-t-lg
      ">
        <h3 className="text-sm font-semibold text-foreground">
          {column.titleJa}
        </h3>
        <span className="
          inline-flex
          items-center
          justify-center
          min-w-[24px]
          h-6
          px-2
          text-xs
          font-medium
          bg-muted
          text-muted-foreground
          rounded-full
        ">
          {stickies.length}
        </span>
      </div>
      
      {/* Sticky Cards List */}
      <div className="
        flex
        flex-col
        gap-2
        p-3
        overflow-y-auto
        min-h-[200px]
        flex-1
      ">
        {stickies.length === 0 ? (
          <div className="
            flex
            items-center
            justify-center
            h-full
            min-h-[100px]
            text-sm
            text-muted-foreground
            border-2
            border-dashed
            border-border
            rounded-lg
          ">
            Sticky'nがありません
          </div>
        ) : (
          stickies.map(sticky => (
            <StickyCard
              key={sticky.id}
              sticky={sticky}
              onComplete={() => onStickyComplete(sticky.id)}
              onEdit={() => onStickyEdit(sticky.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
