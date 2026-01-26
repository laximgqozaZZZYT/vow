import { useState, useRef, useCallback, useEffect } from 'react';
import type { HabitAction } from '../types';

/**
 * Habit status for Kanban columns
 */
export type HabitStatus = 'planned' | 'in_progress' | 'completed_daily';

/**
 * Props for useKanbanDragDrop hook
 */
export interface UseKanbanDragDropProps {
  onHabitAction: (habitId: string, action: HabitAction, amount?: number) => void;
}

/**
 * Return type for useKanbanDragDrop hook
 */
export interface UseKanbanDragDropReturn {
  /** Currently dragged habit ID */
  draggedHabitId: string | null;
  /** Current drop target column */
  dropTargetColumn: HabitStatus | null;
  /** Source column of the dragged habit */
  sourceColumn: HabitStatus | null;
  /** Whether a drag operation is in progress */
  isDragging: boolean;
  /** Handle drag start for desktop */
  handleDragStart: (habitId: string, sourceColumn: HabitStatus, event?: React.DragEvent) => void;
  /** Handle drag end */
  handleDragEnd: () => void;
  /** Handle drag over a column */
  handleDragOver: (column: HabitStatus, event?: React.DragEvent) => void;
  /** Handle drag leave from a column */
  handleDragLeave: () => void;
  /** Handle drop on a column */
  handleDrop: (targetColumn: HabitStatus) => void;
  /** Handle touch start for mobile (long press) */
  handleTouchStart: (habitId: string, sourceColumn: HabitStatus, event: React.TouchEvent) => void;
  /** Handle touch move for mobile */
  handleTouchMove: (event: React.TouchEvent) => void;
  /** Handle touch end for mobile */
  handleTouchEnd: () => void;
}

/**
 * Action mapping for drops based on target column
 * - Drop in 'in_progress' → 'start' action
 * - Drop in 'completed_daily' → 'complete' action
 * - Drop in 'planned' from 'in_progress' → 'reset' action (cancel start without modal)
 * - Drop in 'planned' from 'completed_daily' → 'reset' action (undo completion)
 */
const getActionForDrop = (
  targetColumn: HabitStatus,
  sourceColumn: HabitStatus | null
): HabitAction | null => {
  // No action if dropping in the same column
  if (targetColumn === sourceColumn) {
    return null;
  }

  switch (targetColumn) {
    case 'in_progress':
      return 'start';
    case 'completed_daily':
      return 'complete';
    case 'planned':
      // Allow moving back to planned from in_progress or completed_daily
      // Use 'reset' action to avoid opening modal
      if (sourceColumn === 'in_progress' || sourceColumn === 'completed_daily') {
        return 'reset';
      }
      return null;
    default:
      return null;
  }
};

/** Long press duration in milliseconds for touch drag initiation */
const LONG_PRESS_DURATION = 400;

/**
 * Custom hook for Kanban board drag and drop functionality
 * 
 * Supports both desktop drag events and mobile touch events with long press.
 * Maps drop actions to habit status changes (start, complete, pause).
 * 
 * @param props - Hook configuration
 * @returns Drag and drop state and handlers
 * 
 * @example
 * ```tsx
 * const {
 *   draggedHabitId,
 *   dropTargetColumn,
 *   handleDragStart,
 *   handleDragEnd,
 *   handleDragOver,
 *   handleDrop,
 * } = useKanbanDragDrop({ onHabitAction });
 * ```
 */
export function useKanbanDragDrop({
  onHabitAction
}: UseKanbanDragDropProps): UseKanbanDragDropReturn {
  // Drag state
  const [draggedHabitId, setDraggedHabitId] = useState<string | null>(null);
  const [dropTargetColumn, setDropTargetColumn] = useState<HabitStatus | null>(null);
  const [sourceColumn, setSourceColumn] = useState<HabitStatus | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Touch handling refs
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const dragPreviewRef = useRef<HTMLDivElement | null>(null);
  const pendingDragRef = useRef<{ habitId: string; sourceColumn: HabitStatus } | null>(null);
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
   * Create a visual drag preview element for touch dragging
   */
  const createDragPreview = useCallback((habitId: string, x: number, y: number) => {
    // Remove existing preview
    if (dragPreviewRef.current && document.body.contains(dragPreviewRef.current)) {
      document.body.removeChild(dragPreviewRef.current);
    }

    const preview = document.createElement('div');
    preview.className = 'kanban-drag-preview';
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
    preview.innerHTML = `<span style="margin-right: 8px;">📋</span>移動中...`;

    document.body.appendChild(preview);
    dragPreviewRef.current = preview;
  }, []);

  /**
   * Handle drag start (desktop)
   */
  const handleDragStart = useCallback((
    habitId: string,
    habitSourceColumn: HabitStatus,
    event?: React.DragEvent
  ) => {
    setDraggedHabitId(habitId);
    setSourceColumn(habitSourceColumn);
    setIsDragging(true);

    if (event) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('application/json', JSON.stringify({
        habitId,
        sourceColumn: habitSourceColumn
      }));

      // Create custom drag image
      const dragImage = document.createElement('div');
      dragImage.className = 'kanban-drag-image';
      dragImage.style.cssText = `
        position: absolute;
        top: -1000px;
        background: var(--color-card, white);
        border: 2px solid var(--color-primary, #3b82f6);
        border-radius: 8px;
        padding: 8px 12px;
        font-size: 14px;
      `;
      dragImage.innerHTML = `<span style="margin-right: 8px;">📋</span>移動中...`;
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
   * Handle drag end - reset all drag state
   */
  const handleDragEnd = useCallback(() => {
    setDraggedHabitId(null);
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
   * Handle drag over a column
   */
  const handleDragOver = useCallback((column: HabitStatus, event?: React.DragEvent) => {
    event?.preventDefault();
    setDropTargetColumn(column);
  }, []);

  /**
   * Handle drag leave from a column
   */
  const handleDragLeave = useCallback(() => {
    setDropTargetColumn(null);
  }, []);

  /**
   * Handle drop on a target column
   * Maps the drop to the appropriate habit action
   */
  const handleDrop = useCallback((targetColumn: HabitStatus) => {
    if (!draggedHabitId) {
      handleDragEnd();
      return;
    }

    const action = getActionForDrop(targetColumn, sourceColumn);

    if (action) {
      try {
        onHabitAction(draggedHabitId, action);
      } catch (error) {
        // On failure, the card returns to original position (handled by state reset)
        console.error('Failed to execute habit action:', error);
      }
    }

    handleDragEnd();
  }, [draggedHabitId, sourceColumn, onHabitAction, handleDragEnd]);

  /**
   * Handle touch start for mobile (initiates long press detection)
   */
  const handleTouchStart = useCallback((
    habitId: string,
    habitSourceColumn: HabitStatus,
    event: React.TouchEvent
  ) => {
    const touch = event.touches[0];
    touchPosRef.current = { x: touch.clientX, y: touch.clientY };
    pendingDragRef.current = { habitId, sourceColumn: habitSourceColumn };

    // Clear existing timer
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }

    // Start long press timer
    longPressTimerRef.current = setTimeout(() => {
      const pending = pendingDragRef.current;
      const pos = touchPosRef.current;

      if (pending && pos) {
        setDraggedHabitId(pending.habitId);
        setSourceColumn(pending.sourceColumn);
        setIsDragging(true);
        createDragPreview(pending.habitId, pos.x, pos.y);

        // Haptic feedback
        if ('vibrate' in navigator) {
          navigator.vibrate(50);
        }
      }
    }, LONG_PRESS_DURATION);
  }, [createDragPreview]);

  /**
   * Handle touch move for mobile dragging
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

    // Detect drop target column
    dragPreviewRef.current.style.display = 'none';
    const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
    dragPreviewRef.current.style.display = '';

    const dropElement = elementBelow?.closest('[data-kanban-column]');

    if (dropElement) {
      const columnId = dropElement.getAttribute('data-kanban-column') as HabitStatus;
      if (columnId) {
        setDropTargetColumn(columnId);
      }
    } else {
      setDropTargetColumn(null);
    }
  }, [isDragging]);

  /**
   * Handle touch end for mobile
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
    draggedHabitId,
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
    handleTouchEnd
  };
}

export default useKanbanDragDrop;
