'use client';

/**
 * useTaskKanbanDragDrop Hook
 *
 * Drag-and-drop handler for the Task Kanban board (Skill Sets).
 * Supports both desktop HTML5 drag API and mobile long-press + touch drag.
 *
 * Modeled after useKanbanDragDrop but uses SkillSetStatus / TaskKanbanColumnId
 * instead of HabitStatus / HabitAction.
 *
 * @module hooks/useTaskKanbanDragDrop
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import type { SkillSetStatus, TaskKanbanColumnId } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface UseTaskKanbanDragDropProps {
  onStatusChange: (skillSetId: string, newStatus: SkillSetStatus) => void;
}

export interface UseTaskKanbanDragDropReturn {
  /** Currently dragged card ID */
  draggedCardId: string | null;
  /** Current drop target column */
  dropTargetColumn: TaskKanbanColumnId | null;
  /** Source column of the dragged card */
  sourceColumn: TaskKanbanColumnId | null;
  /** Whether a drag operation is in progress */
  isDragging: boolean;
  /** Handle drag start for desktop */
  handleDragStart: (cardId: string, sourceColumn: TaskKanbanColumnId, event?: React.DragEvent) => void;
  /** Handle drag end */
  handleDragEnd: () => void;
  /** Handle drag over a column */
  handleDragOver: (column: TaskKanbanColumnId, event?: React.DragEvent) => void;
  /** Handle drag leave from a column */
  handleDragLeave: () => void;
  /** Handle drop on a column */
  handleDrop: (targetColumn: TaskKanbanColumnId) => void;
  /** Handle touch start for mobile (long press) */
  handleTouchStart: (cardId: string, sourceColumn: TaskKanbanColumnId, event: React.TouchEvent) => void;
  /** Handle touch move for mobile */
  handleTouchMove: (event: React.TouchEvent) => void;
  /** Handle touch end for mobile */
  handleTouchEnd: () => void;
}

// ============================================================================
// Constants
// ============================================================================

/** Long press duration in milliseconds for touch drag initiation */
const LONG_PRESS_DURATION = 400;

// ============================================================================
// Hook
// ============================================================================

/**
 * Custom hook for Task Kanban board drag and drop functionality.
 *
 * Supports both desktop drag events and mobile touch events with long press.
 * Calls onStatusChange when a card is dropped on a different column.
 *
 * @param props - Hook configuration
 * @returns Drag and drop state and handlers
 *
 * @example
 * ```tsx
 * const {
 *   draggedCardId,
 *   dropTargetColumn,
 *   handleDragStart,
 *   handleDragEnd,
 *   handleDragOver,
 *   handleDrop,
 * } = useTaskKanbanDragDrop({ onStatusChange });
 * ```
 */
export function useTaskKanbanDragDrop({
  onStatusChange,
}: UseTaskKanbanDragDropProps): UseTaskKanbanDragDropReturn {
  // Drag state
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [dropTargetColumn, setDropTargetColumn] = useState<TaskKanbanColumnId | null>(null);
  const [sourceColumn, setSourceColumn] = useState<TaskKanbanColumnId | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Touch handling refs
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const dragPreviewRef = useRef<HTMLDivElement | null>(null);
  const pendingDragRef = useRef<{ cardId: string; sourceColumn: TaskKanbanColumnId } | null>(null);
  const touchPosRef = useRef<{ x: number; y: number } | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
      if (dragPreviewRef.current && document.body.contains(dragPreviewRef.current)) {
        document.body.removeChild(dragPreviewRef.current);
      }
    };
  }, []);

  /**
   * Create a visual drag preview element for touch dragging.
   */
  const createDragPreview = useCallback((_cardId: string, x: number, y: number) => {
    // Remove existing preview
    if (dragPreviewRef.current && document.body.contains(dragPreviewRef.current)) {
      document.body.removeChild(dragPreviewRef.current);
    }

    const preview = document.createElement('div');
    preview.className = 'task-kanban-drag-preview';
    preview.style.cssText = `
      position: fixed;
      z-index: 9999;
      background: var(--color-card, white);
      border: 2px solid var(--color-primary, #3b82f6);
      border-radius: 8px;
      padding: 8px 12px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
      pointer-events: none;
      font-size: 14px;
      max-width: 200px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      left: ${x - 50}px;
      top: ${y - 25}px;
    `;
    preview.textContent = 'Moving...';

    document.body.appendChild(preview);
    dragPreviewRef.current = preview;
  }, []);

  /**
   * Handle drag start (desktop).
   */
  const handleDragStart = useCallback((
    cardId: string,
    cardSourceColumn: TaskKanbanColumnId,
    event?: React.DragEvent,
  ) => {
    setDraggedCardId(cardId);
    setSourceColumn(cardSourceColumn);
    setIsDragging(true);

    if (event) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('application/json', JSON.stringify({
        cardId,
        sourceColumn: cardSourceColumn,
      }));

      // Create custom drag image
      const dragImage = document.createElement('div');
      dragImage.className = 'task-kanban-drag-image';
      dragImage.style.cssText = `
        position: absolute;
        top: -1000px;
        background: var(--color-card, white);
        border: 2px solid var(--color-primary, #3b82f6);
        border-radius: 8px;
        padding: 8px 12px;
        font-size: 14px;
      `;
      dragImage.textContent = 'Moving...';
      document.body.appendChild(dragImage);
      event.dataTransfer.setDragImage(dragImage, 50, 25);

      // Remove drag image on next frame
      requestAnimationFrame(() => {
        if (document.body.contains(dragImage)) {
          document.body.removeChild(dragImage);
        }
      });
    }
  }, []);

  /**
   * Handle drag end -- reset all drag state.
   */
  const handleDragEnd = useCallback(() => {
    setDraggedCardId(null);
    setDropTargetColumn(null);
    setSourceColumn(null);
    setIsDragging(false);
    pendingDragRef.current = null;
    touchPosRef.current = null;

    // Clear long press timer
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    // Remove drag preview
    if (dragPreviewRef.current && document.body.contains(dragPreviewRef.current)) {
      document.body.removeChild(dragPreviewRef.current);
      dragPreviewRef.current = null;
    }
  }, []);

  /**
   * Handle drag over a column.
   */
  const handleDragOver = useCallback((column: TaskKanbanColumnId, event?: React.DragEvent) => {
    event?.preventDefault();
    setDropTargetColumn(column);
  }, []);

  /**
   * Handle drag leave from a column.
   */
  const handleDragLeave = useCallback(() => {
    setDropTargetColumn(null);
  }, []);

  /**
   * Handle drop on a target column.
   * Calls onStatusChange if the card is dropped on a different column.
   */
  const handleDrop = useCallback((targetColumn: TaskKanbanColumnId) => {
    if (!draggedCardId) {
      handleDragEnd();
      return;
    }

    // Only trigger status change if dropped on a different column
    if (targetColumn !== sourceColumn) {
      try {
        onStatusChange(draggedCardId, targetColumn as SkillSetStatus);
      } catch (error) {
        // On failure, the card returns to original position (handled by state reset)
        console.error('[useTaskKanbanDragDrop] Failed to change status:', error);
      }
    }

    handleDragEnd();
  }, [draggedCardId, sourceColumn, onStatusChange, handleDragEnd]);

  /**
   * Handle touch start for mobile (initiates long press detection).
   */
  const handleTouchStart = useCallback((
    cardId: string,
    cardSourceColumn: TaskKanbanColumnId,
    event: React.TouchEvent,
  ) => {
    const touch = event.touches[0];
    touchPosRef.current = { x: touch.clientX, y: touch.clientY };
    pendingDragRef.current = { cardId, sourceColumn: cardSourceColumn };

    // Clear existing timer
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }

    // Start long press timer
    longPressTimerRef.current = setTimeout(() => {
      const pending = pendingDragRef.current;
      const pos = touchPosRef.current;

      if (pending && pos) {
        setDraggedCardId(pending.cardId);
        setSourceColumn(pending.sourceColumn);
        setIsDragging(true);
        createDragPreview(pending.cardId, pos.x, pos.y);

        // Haptic feedback
        if ('vibrate' in navigator) {
          navigator.vibrate(50);
        }
      }
    }, LONG_PRESS_DURATION);
  }, [createDragPreview]);

  /**
   * Handle touch move for mobile dragging.
   */
  const handleTouchMove = useCallback((event: React.TouchEvent) => {
    const touch = event.touches[0];
    const startPos = touchPosRef.current;

    // Cancel long press if moved before drag started
    if (!isDragging && startPos) {
      const dx = Math.abs(touch.clientX - startPos.x);
      const dy = Math.abs(touch.clientY - startPos.y);
      if (dx > 10 || dy > 10) {
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
        pendingDragRef.current = null;
        return;
      }
    }

    if (!isDragging || !dragPreviewRef.current) return;

    event.preventDefault();

    // Update drag preview position
    dragPreviewRef.current.style.left = `${touch.clientX - 50}px`;
    dragPreviewRef.current.style.top = `${touch.clientY - 25}px`;

    // Detect drop target column by looking at the element under the touch point
    dragPreviewRef.current.style.display = 'none';
    const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
    dragPreviewRef.current.style.display = '';

    const dropElement = elementBelow?.closest('[data-task-kanban-column]');

    if (dropElement) {
      const columnId = dropElement.getAttribute('data-task-kanban-column') as TaskKanbanColumnId;
      if (columnId) {
        setDropTargetColumn(columnId);
      }
    } else {
      setDropTargetColumn(null);
    }
  }, [isDragging]);

  /**
   * Handle touch end for mobile.
   */
  const handleTouchEnd = useCallback(() => {
    // Clear long press timer
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    if (!isDragging) {
      pendingDragRef.current = null;
      touchPosRef.current = null;
      return;
    }

    if (dropTargetColumn) {
      handleDrop(dropTargetColumn);
    } else {
      handleDragEnd();
    }
  }, [isDragging, dropTargetColumn, handleDrop, handleDragEnd]);

  return {
    draggedCardId,
    dropTargetColumn,
    sourceColumn,
    isDragging,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
}

export default useTaskKanbanDragDrop;
