"use client";

/**
 * TaskKanban Component - MOC Task Kanban Board
 *
 * Main Kanban board component that orchestrates:
 * - 3 columns (TODO / In Progress / Done) using TaskKanbanColumn
 * - Drag-and-drop via useTaskKanbanDragDrop
 * - Mobile swipe navigation via useMobileSwipe
 * - Auto-scroll during drag (Trello-like behavior)
 * - Modal control for SkillSet create/edit/view
 * - Column indicators for mobile
 *
 * Follows the pattern established by Board.KanbanLayout.tsx.
 *
 * @module MOC.TaskKanban
 */

import { useCallback, useMemo, useRef, useEffect, useState } from 'react';
import type {
  SkillSet,
  SkillSetStatus,
  SkillSetProgressReport,
  TaskKanbanColumnId,
  TaskKanbanColumnConfig,
  Note,
  CreateNotePayload,
  UpdateNotePayload,
  CreateSkillSetPayload,
  UpdateSkillSetPayload,
  Goal,
  Habit,
  Sticky,
} from '../types';
import { TASK_KANBAN_COLUMNS } from '../types';
import { useTaskKanbanDragDrop } from '../hooks/useTaskKanbanDragDrop';
import { useMobileSwipe } from '../hooks/useMobileSwipe';
import TaskKanbanColumn from './MOC.TaskKanbanColumn';
import { SkillSetModal } from './Modal.SkillSet';

// ============================================================================
// Props
// ============================================================================

export interface TaskKanbanProps {
  skillSets: SkillSet[];
  goals: Goal[];
  habits: Habit[];
  stickies: Sticky[];
  notes: Note[];
  locale: 'ja' | 'en';
  onCreateSkillSet: (payload: CreateSkillSetPayload) => Promise<void>;
  onUpdateSkillSet: (id: string, payload: UpdateSkillSetPayload) => Promise<void>;
  onDeleteSkillSet: (id: string) => Promise<void>;
  onExecuteSkillSet: (id: string) => Promise<void>;
  onCreateNote: (payload: CreateNotePayload) => Promise<Note>;
  onUpdateNote: (id: string, payload: UpdateNotePayload) => Promise<void>;
  onCreateSticky: (name: string, description?: string) => Promise<Sticky>;
  onStatusChange: (id: string, status: SkillSetStatus) => Promise<void>;
  executionProgress: Map<string, SkillSetProgressReport>;
  isRemoteCliConnected: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** Edge threshold for auto-scroll during drag (pixels from edge) */
const DRAG_SCROLL_EDGE_ZONE = 80;
/** Scroll speed for auto-scroll (pixels per frame) */
const DRAG_SCROLL_SPEED = 15;

// ============================================================================
// Modal State
// ============================================================================

interface ModalState {
  open: boolean;
  mode: 'create' | 'edit' | 'view';
  skillSet?: SkillSet;
}

const INITIAL_MODAL_STATE: ModalState = {
  open: false,
  mode: 'create',
};

// ============================================================================
// Component
// ============================================================================

/**
 * TaskKanban - Main Kanban board for MOC Task management.
 *
 * Groups skill sets by status into three columns and provides
 * drag-and-drop, mobile swipe, and modal-based CRUD operations.
 */
export default function TaskKanban({
  skillSets,
  goals,
  habits,
  stickies,
  notes,
  locale,
  onCreateSkillSet,
  onUpdateSkillSet,
  onDeleteSkillSet,
  onExecuteSkillSet,
  onCreateNote,
  onUpdateNote,
  onCreateSticky,
  onStatusChange,
  executionProgress,
  isRemoteCliConnected,
}: TaskKanbanProps) {
  // --------------------------------------------------------------------------
  // State
  // --------------------------------------------------------------------------

  const [modalState, setModalState] = useState<ModalState>(INITIAL_MODAL_STATE);

  // --------------------------------------------------------------------------
  // Group skill sets by status
  // --------------------------------------------------------------------------

  const skillSetsByStatus = useMemo(() => {
    const grouped: Record<TaskKanbanColumnId, SkillSet[]> = {
      todo: [],
      in_progress: [],
      done: [],
    };
    for (const ss of skillSets) {
      const key = ss.status as TaskKanbanColumnId;
      if (grouped[key]) {
        grouped[key].push(ss);
      } else {
        // Fallback: unknown statuses go to todo
        grouped.todo.push(ss);
      }
    }
    // Sort each column by displayOrder
    for (const key of Object.keys(grouped) as TaskKanbanColumnId[]) {
      grouped[key].sort((a, b) => a.displayOrder - b.displayOrder);
    }
    return grouped;
  }, [skillSets]);

  // --------------------------------------------------------------------------
  // Drag and Drop
  // --------------------------------------------------------------------------

  const handleStatusChange = useCallback(
    (skillSetId: string, newStatus: SkillSetStatus) => {
      onStatusChange(skillSetId, newStatus);
    },
    [onStatusChange],
  );

  const {
    draggedCardId,
    dropTargetColumn,
    sourceColumn,
    isDragging,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleTouchStart: handleDragTouchStart,
    handleTouchMove: handleDragTouchMove,
    handleTouchEnd: handleDragTouchEnd,
  } = useTaskKanbanDragDrop({ onStatusChange: handleStatusChange });

  // --------------------------------------------------------------------------
  // Mobile Swipe
  // --------------------------------------------------------------------------

  const {
    currentColumnIndex,
    containerRef,
    handleTouchStart: handleSwipeStart,
    handleTouchMove: handleSwipeMove,
    handleTouchEnd: handleSwipeEnd,
    goToColumn,
  } = useMobileSwipe({
    totalColumns: TASK_KANBAN_COLUMNS.length,
    onColumnChange: undefined,
  });

  // --------------------------------------------------------------------------
  // Auto-scroll during drag
  // --------------------------------------------------------------------------

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const scrollAnimationRef = useRef<number | null>(null);
  const currentTouchXRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);

  // Keep isDraggingRef in sync
  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  /**
   * Auto-scroll function: checks touch position and scrolls if near edge.
   */
  const performAutoScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    const touchX = currentTouchXRef.current;

    if (!container || touchX === null || !isDraggingRef.current) {
      scrollAnimationRef.current = null;
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const leftEdge = containerRect.left + DRAG_SCROLL_EDGE_ZONE;
    const rightEdge = containerRect.right - DRAG_SCROLL_EDGE_ZONE;

    let scrollDelta = 0;

    // Near left edge - scroll left
    if (touchX < leftEdge) {
      const distance = leftEdge - touchX;
      const intensity = Math.min(distance / DRAG_SCROLL_EDGE_ZONE, 1);
      scrollDelta = -DRAG_SCROLL_SPEED * (0.5 + intensity);
    }
    // Near right edge - scroll right
    else if (touchX > rightEdge) {
      const distance = touchX - rightEdge;
      const intensity = Math.min(distance / DRAG_SCROLL_EDGE_ZONE, 1);
      scrollDelta = DRAG_SCROLL_SPEED * (0.5 + intensity);
    }

    if (scrollDelta !== 0) {
      const maxScroll = container.scrollWidth - container.clientWidth;
      const newScrollLeft = Math.max(0, Math.min(maxScroll, container.scrollLeft + scrollDelta));
      container.scrollLeft = newScrollLeft;
    }

    // Continue animation loop while dragging
    if (isDraggingRef.current) {
      scrollAnimationRef.current = requestAnimationFrame(performAutoScroll);
    } else {
      scrollAnimationRef.current = null;
    }
  }, []);

  const startAutoScroll = useCallback(() => {
    if (!scrollAnimationRef.current) {
      scrollAnimationRef.current = requestAnimationFrame(performAutoScroll);
    }
  }, [performAutoScroll]);

  const stopAutoScroll = useCallback(() => {
    if (scrollAnimationRef.current) {
      cancelAnimationFrame(scrollAnimationRef.current);
      scrollAnimationRef.current = null;
    }
    currentTouchXRef.current = null;
  }, []);

  // Start/stop auto-scroll based on drag state
  useEffect(() => {
    if (isDragging) {
      startAutoScroll();
    } else {
      stopAutoScroll();
    }
  }, [isDragging, startAutoScroll, stopAutoScroll]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopAutoScroll();
  }, [stopAutoScroll]);

  // Global touch listener to track position during drag
  useEffect(() => {
    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (!isDraggingRef.current) return;
      const touch = e.touches[0];
      if (touch) {
        currentTouchXRef.current = touch.clientX;
      }
    };

    const handleGlobalTouchEnd = () => {
      currentTouchXRef.current = null;
    };

    document.addEventListener('touchmove', handleGlobalTouchMove, { passive: true });
    document.addEventListener('touchend', handleGlobalTouchEnd);
    document.addEventListener('touchcancel', handleGlobalTouchEnd);

    return () => {
      document.removeEventListener('touchmove', handleGlobalTouchMove);
      document.removeEventListener('touchend', handleGlobalTouchEnd);
      document.removeEventListener('touchcancel', handleGlobalTouchEnd);
    };
  }, []);

  // --------------------------------------------------------------------------
  // Column drop handler
  // --------------------------------------------------------------------------

  const handleColumnDrop = useCallback(
    (_skillSetId: string, targetStatus: TaskKanbanColumnId) => {
      handleDrop(targetStatus);
    },
    [handleDrop],
  );

  // --------------------------------------------------------------------------
  // Card drag-start handler (determines source column)
  // --------------------------------------------------------------------------

  const handleCardDragStart = useCallback(
    (cardId: string) => {
      let cardSourceColumn: TaskKanbanColumnId = 'todo';
      for (const [status, items] of Object.entries(skillSetsByStatus)) {
        if (items.some((ss) => ss.id === cardId)) {
          cardSourceColumn = status as TaskKanbanColumnId;
          break;
        }
      }
      handleDragStart(cardId, cardSourceColumn);
    },
    [skillSetsByStatus, handleDragStart],
  );

  // --------------------------------------------------------------------------
  // Combined touch handlers for mobile (swipe + drag)
  // --------------------------------------------------------------------------

  const handleCombinedTouchStart = useCallback(
    (event: React.TouchEvent) => {
      const touch = event.touches[0];
      currentTouchXRef.current = touch.clientX;
      handleSwipeStart(event);
    },
    [handleSwipeStart],
  );

  const handleCombinedTouchMove = useCallback(
    (event: React.TouchEvent) => {
      const touch = event.touches[0];
      currentTouchXRef.current = touch.clientX;

      // Handle drag preview movement if dragging
      handleDragTouchMove(event);

      // Handle swipe navigation only if not dragging
      if (!isDraggingRef.current) {
        handleSwipeMove(event);
      }
    },
    [handleDragTouchMove, handleSwipeMove],
  );

  const handleCombinedTouchEnd = useCallback(() => {
    currentTouchXRef.current = null;
    stopAutoScroll();
    handleDragTouchEnd();
    handleSwipeEnd();
  }, [handleDragTouchEnd, handleSwipeEnd, stopAutoScroll]);

  // --------------------------------------------------------------------------
  // Sync scrollContainerRef with containerRef from useMobileSwipe
  // --------------------------------------------------------------------------

  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      scrollContainerRef.current = node;
      if (containerRef) {
        (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }
    },
    [containerRef],
  );

  // --------------------------------------------------------------------------
  // Modal handlers
  // --------------------------------------------------------------------------

  const openCreateModal = useCallback(() => {
    setModalState({ open: true, mode: 'create' });
  }, []);

  const openViewModal = useCallback((skillSet: SkillSet) => {
    setModalState({ open: true, mode: 'view', skillSet });
  }, []);

  const closeModal = useCallback(() => {
    setModalState(INITIAL_MODAL_STATE);
  }, []);

  const handleModalSave = useCallback(
    async (payload: CreateSkillSetPayload | UpdateSkillSetPayload) => {
      if (modalState.mode === 'create') {
        await onCreateSkillSet(payload as CreateSkillSetPayload);
      } else if (modalState.mode === 'edit' && modalState.skillSet) {
        await onUpdateSkillSet(modalState.skillSet.id, payload as UpdateSkillSetPayload);
      }
    },
    [modalState, onCreateSkillSet, onUpdateSkillSet],
  );

  const handleModalDelete = useCallback(async () => {
    if (modalState.skillSet) {
      await onDeleteSkillSet(modalState.skillSet.id);
    }
  }, [modalState.skillSet, onDeleteSkillSet]);

  const handleModalExecute = useCallback(async () => {
    if (modalState.skillSet) {
      await onExecuteSkillSet(modalState.skillSet.id);
    }
  }, [modalState.skillSet, onExecuteSkillSet]);

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <div className="flex flex-col h-full">
      {/* Kanban Board Container */}
      <div
        ref={setRefs}
        onTouchStart={handleCombinedTouchStart}
        onTouchMove={handleCombinedTouchMove}
        onTouchEnd={handleCombinedTouchEnd}
        className="
          flex
          gap-2
          p-2
          overflow-x-auto
          overflow-y-visible
          flex-1
          min-h-0

          /* Desktop: columns side by side */
          md:overflow-x-visible
          md:gap-3
          md:p-3

          /* Mobile: horizontal scroll container */
          snap-x
          snap-mandatory
          md:snap-none

          /* Hide scrollbar on mobile for cleaner look */
          scrollbar-hide
          [-webkit-overflow-scrolling:touch]
        "
        style={{
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {TASK_KANBAN_COLUMNS.map((column) => (
          <div
            key={column.id}
            className="
              /* Mobile: each column takes ~80% viewport width */
              min-w-[80vw]
              max-w-[80vw]
              md:min-w-0
              md:max-w-none
              md:flex-1

              /* Snap alignment for mobile swipe */
              snap-center
              md:snap-align-none

              /* Padding on first/last column for edge visibility */
              first:ml-2
              last:mr-2
              md:first:ml-0
              md:last:mr-0
            "
          >
            <TaskKanbanColumn
              column={column}
              skillSets={skillSetsByStatus[column.id] || []}
              onDrop={handleColumnDrop}
              isDragOver={dropTargetColumn === column.id}
              onDragOver={() => handleDragOver(column.id)}
              onDragLeave={handleDragLeave}
              onCardClick={openViewModal}
              onCardDragStart={handleCardDragStart}
              onCardDragEnd={handleDragEnd}
              onNewSkillSet={column.id === 'todo' ? openCreateModal : undefined}
              onExecute={(ssId) => onExecuteSkillSet(ssId)}
              onDelete={(ssId) => onDeleteSkillSet(ssId)}
              executionProgress={executionProgress}
              isRemoteCliConnected={isRemoteCliConnected}
              locale={locale}
            />
          </div>
        ))}
      </div>

      {/* Mobile Column Indicators */}
      <div
        className="
          flex
          justify-center
          gap-2
          py-3
          md:hidden
        "
      >
        {TASK_KANBAN_COLUMNS.map((column, index) => (
          <button
            key={column.id}
            onClick={() => goToColumn(index)}
            aria-label={`Go to ${locale === 'ja' ? column.titleJa : column.title} column`}
            aria-current={currentColumnIndex === index ? 'true' : 'false'}
            className={`
              w-2.5
              h-2.5
              rounded-full
              transition-all
              duration-200
              min-w-[44px]
              min-h-[44px]
              flex
              items-center
              justify-center
              focus-visible:outline-2
              focus-visible:outline-primary
              focus-visible:outline-offset-2
            `}
          >
            <span
              className={`
                w-2.5
                h-2.5
                rounded-full
                transition-all
                duration-200
                ${
                  currentColumnIndex === index
                    ? 'bg-primary scale-125'
                    : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
                }
              `}
            />
          </button>
        ))}
      </div>

      {/* Mobile Column Label */}
      <div
        className="
          text-center
          text-sm
          text-muted-foreground
          pb-2
          md:hidden
        "
      >
        {locale === 'ja'
          ? TASK_KANBAN_COLUMNS[currentColumnIndex]?.titleJa
          : TASK_KANBAN_COLUMNS[currentColumnIndex]?.title}
        <span className="text-xs ml-2">
          ({skillSetsByStatus[TASK_KANBAN_COLUMNS[currentColumnIndex]?.id]?.length || 0})
        </span>
      </div>

      {/* SkillSet Modal */}
      {modalState.open && (
        <SkillSetModal
          mode={modalState.mode}
          skillSet={modalState.skillSet}
          notes={notes}
          stickies={stickies}
          goals={goals}
          habits={habits}
          locale={locale}
          onSave={handleModalSave}
          onDelete={modalState.mode === 'edit' ? handleModalDelete : undefined}
          onExecute={
            modalState.mode === 'view' || modalState.mode === 'edit'
              ? handleModalExecute
              : undefined
          }
          onCreateNote={onCreateNote}
          onUpdateNote={onUpdateNote}
          onCreateSticky={onCreateSticky}
          onClose={closeModal}
          isRemoteCliConnected={isRemoteCliConnected}
        />
      )}
    </div>
  );
}
