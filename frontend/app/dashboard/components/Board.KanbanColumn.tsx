"use client";

/**
 * KanbanColumn Component for Board Section
 * 
 * Displays a single column in the Kanban board with:
 * - Column header (title in Japanese, habit count badge)
 * - List of HabitCard components
 * - Drop target styling for drag-and-drop
 * - Visual feedback when being dragged over
 * 
 * @module Board.KanbanColumn
 * 
 * Validates: Requirements 2.1, 2.2
 */

import { useCallback } from 'react';
import type { Habit, Activity, HabitAction } from '../types';
import type { HabitStatus } from '../utils/habitStatusUtils';
import HabitCard from './Board.HabitCard';

/**
 * Column configuration for Kanban board
 */
export interface ColumnConfig {
  id: HabitStatus;
  title: string;
  titleJa: string;
}

export interface KanbanColumnProps {
  /** Column configuration (id, title, titleJa) */
  column: ColumnConfig;
  /** Habits to display in this column */
  habits: Habit[];
  /** All activities (for HabitCard elapsed time calculation) */
  activities: Activity[];
  /** Callback when a habit action is triggered */
  onHabitAction: (habitId: string, action: HabitAction, amount?: number) => void;
  /** Callback when habit edit is requested */
  onHabitEdit: (habitId: string) => void;
  /** Callback when a habit is dropped in this column */
  onDrop: (habitId: string, targetStatus: HabitStatus) => void;
  /** Whether a card is being dragged over this column */
  isDragOver: boolean;
  /** Callback when drag enters this column */
  onDragOver: () => void;
  /** Callback when drag leaves this column */
  onDragLeave: () => void;
  /** Currently dragging habit ID (for visual feedback) */
  draggedHabitId?: string | null;
  /** Callback when drag starts on a habit card */
  onDragStart?: (habitId: string) => void;
  /** Callback when drag ends */
  onDragEnd?: () => void;
}

/**
 * KanbanColumn component
 * 
 * Renders a single column in the Kanban board with header and habit cards.
 * Supports drag-and-drop with visual feedback.
 */
export default function KanbanColumn({
  column,
  habits,
  activities,
  onHabitAction,
  onHabitEdit,
  onDrop,
  isDragOver,
  onDragOver,
  onDragLeave,
  draggedHabitId,
  onDragStart,
  onDragEnd
}: KanbanColumnProps) {
  
  /**
   * Handle drag over event
   * Prevents default to allow drop and notifies parent
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    onDragOver();
  }, [onDragOver]);
  
  /**
   * Handle drag leave event
   */
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only trigger if leaving the column itself, not child elements
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      onDragLeave();
    }
  }, [onDragLeave]);
  
  /**
   * Handle drop event
   * Extracts habit ID from dataTransfer and triggers onDrop
   */
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const habitId = e.dataTransfer.getData('text/plain');
    if (habitId) {
      onDrop(habitId, column.id);
    }
    onDragLeave();
  }, [column.id, onDrop, onDragLeave]);
  
  /**
   * Handle habit complete action
   */
  const handleHabitComplete = useCallback((habitId: string) => (amount?: number) => {
    onHabitAction(habitId, 'complete', amount);
  }, [onHabitAction]);
  
  /**
   * Handle habit edit
   */
  const handleHabitEdit = useCallback((habitId: string) => () => {
    onHabitEdit(habitId);
  }, [onHabitEdit]);
  
  /**
   * Handle drag start on a habit card
   */
  const handleCardDragStart = useCallback((habitId: string) => () => {
    onDragStart?.(habitId);
  }, [onDragStart]);
  
  /**
   * Handle drag end on a habit card
   */
  const handleCardDragEnd = useCallback(() => {
    onDragEnd?.();
  }, [onDragEnd]);
  
  return (
    <div
      data-kanban-column={column.id}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        flex
        flex-col
        flex-1
        min-w-[280px]
        max-w-[400px]
        bg-muted
        border
        rounded-lg
        transition-all
        duration-200
        ${isDragOver 
          ? 'border-primary border-2 bg-primary/5 shadow-lg' 
          : 'border-border'
        }
      `}
    >
      {/* Column Header - Requirement 2.2 */}
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
          {habits.length}
        </span>
      </div>
      
      {/* Habit Cards List */}
      <div className="
        flex
        flex-col
        gap-2
        p-3
        overflow-y-auto
        min-h-[200px]
        flex-1
      ">
        {habits.length === 0 ? (
          /* Empty state */
          <div className={`
            flex
            items-center
            justify-center
            h-full
            min-h-[100px]
            text-sm
            text-muted-foreground
            border-2
            border-dashed
            rounded-lg
            transition-colors
            ${isDragOver ? 'border-primary bg-primary/5' : 'border-border'}
          `}>
            {isDragOver ? 'ここにドロップ' : '習慣がありません'}
          </div>
        ) : (
          habits.map(habit => (
            <HabitCard
              key={habit.id}
              habit={habit}
              activities={activities}
              status={column.id}
              onComplete={handleHabitComplete(habit.id)}
              onEdit={handleHabitEdit(habit.id)}
              onDragStart={handleCardDragStart(habit.id)}
              onDragEnd={handleCardDragEnd}
              isDragging={draggedHabitId === habit.id}
            />
          ))
        )}
      </div>
    </div>
  );
}
