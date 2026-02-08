"use client";

/**
 * SkillSetCard Component for MOC Task Kanban
 *
 * Displays a skill set card with:
 * - Status dot (colored by todo/in_progress/done)
 * - Skill set name (bold, truncated)
 * - Context menu button (edit/delete/execute)
 * - Note preview (if attached)
 * - Sticky count (if stickies exist)
 * - Goal/Habit badges
 * - Progress bar (during in_progress with progress data)
 * - Progress message
 *
 * @module MOC.SkillSetCard
 */

import { useState, useCallback } from 'react';
import type {
  SkillSet,
  SkillSetProgressReport,
} from '../types';

// ============================================================================
// Props
// ============================================================================

export interface SkillSetCardProps {
  skillSet: SkillSet;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onClick: () => void;
  onExecute?: () => void;
  onDelete?: () => void;
  progress?: SkillSetProgressReport;
  isRemoteCliConnected: boolean;
  locale: 'ja' | 'en';
}

// ============================================================================
// Helpers
// ============================================================================

/** Map status to status dot color class */
function getStatusDotColor(status: SkillSet['status']): string {
  switch (status) {
    case 'todo':
      return 'bg-warning';
    case 'in_progress':
      return 'bg-blue-500';
    case 'done':
      return 'bg-success';
    default:
      return 'bg-muted-foreground';
  }
}

// ============================================================================
// Component
// ============================================================================

/**
 * SkillSetCard component for the MOC Task Kanban board.
 *
 * Renders a draggable card representing a single SkillSet with
 * status indicator, metadata badges, and optional progress display.
 */
export default function SkillSetCard({
  skillSet,
  isDragging,
  onDragStart,
  onDragEnd,
  onClick,
  onExecute,
  onDelete,
  progress,
  isRemoteCliConnected,
  locale,
}: SkillSetCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  // -- Drag handlers --------------------------------------------------------

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', skillSet.id);
      onDragStart();
    },
    [skillSet.id, onDragStart],
  );

  const handleDragEnd = useCallback(() => {
    onDragEnd();
  }, [onDragEnd]);

  // -- Click handlers -------------------------------------------------------

  const handleCardClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('button')) return;
      onClick();
    },
    [onClick],
  );

  const handleMenuToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen((prev) => !prev);
  }, []);

  const handleExecute = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setMenuOpen(false);
      onExecute?.();
    },
    [onExecute],
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setMenuOpen(false);
      onDelete?.();
    },
    [onDelete],
  );

  const handleEdit = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setMenuOpen(false);
      onClick();
    },
    [onClick],
  );

  // -- Derived data ---------------------------------------------------------

  const stickyCount = skillSet.stickies?.length ?? 0;
  const hasNote = !!skillSet.note;
  const goalItems = skillSet.goals ?? [];
  const habitItems = skillSet.habits ?? [];
  const isInProgress = skillSet.status === 'in_progress';
  const showProgress = isInProgress && !!progress;

  // -- Labels ---------------------------------------------------------------

  const stepsLabel =
    locale === 'ja' ? `${stickyCount} steps` : `${stickyCount} steps`;
  const editLabel = locale === 'ja' ? '編集' : 'Edit';
  const executeLabel = locale === 'ja' ? '実行' : 'Execute';
  const deleteLabel = locale === 'ja' ? '削除' : 'Delete';

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={handleCardClick}
      className={`
        relative
        bg-card
        border border-border
        rounded-lg
        p-3
        shadow-sm
        hover:shadow-md
        transition-all
        duration-200
        cursor-grab
        active:cursor-grabbing
        ${isDragging ? 'opacity-50 scale-95 ring-2 ring-primary' : ''}
      `}
      style={{ touchAction: 'pan-y' }}
    >
      {/* ── Header row: status dot + title + menu ── */}
      <div className="flex items-start gap-2">
        {/* Status dot */}
        <div
          className={`flex-shrink-0 w-2.5 h-2.5 rounded-full mt-1.5 ${getStatusDotColor(skillSet.status)}`}
        />

        {/* Title */}
        <span className="flex-1 min-w-0 text-sm font-bold text-foreground truncate">
          {skillSet.name}
        </span>

        {/* Context menu button */}
        <div className="relative flex-shrink-0">
          <button
            onClick={handleMenuToggle}
            className="
              flex items-center justify-center
              w-6 h-6
              text-muted-foreground
              hover:text-foreground
              hover:bg-muted
              rounded
              transition-colors
            "
            aria-label="Menu"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <circle cx="12" cy="5" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="12" cy="19" r="2" />
            </svg>
          </button>

          {/* Dropdown menu */}
          {menuOpen && (
            <>
              {/* Backdrop to close menu */}
              <div
                className="fixed inset-0 z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                }}
              />
              <div className="absolute right-0 top-7 z-20 w-36 bg-popover border border-border rounded-md shadow-lg py-1">
                <button
                  onClick={handleEdit}
                  className="w-full text-left px-3 py-1.5 text-sm text-foreground hover:bg-muted transition-colors"
                >
                  {editLabel}
                </button>
                {onExecute && (
                  <button
                    onClick={handleExecute}
                    disabled={!isRemoteCliConnected}
                    className={`
                      w-full text-left px-3 py-1.5 text-sm transition-colors
                      ${isRemoteCliConnected
                        ? 'text-foreground hover:bg-muted'
                        : 'text-muted-foreground cursor-not-allowed'
                      }
                    `}
                  >
                    {executeLabel}
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={handleDelete}
                    className="w-full text-left px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    {deleteLabel}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Metadata: note preview, sticky count ── */}
      <div className="mt-2 space-y-1">
        {/* Note preview */}
        {hasNote && (
          <p className="text-xs text-muted-foreground truncate">
            {"📝"} {skillSet.note!.title}
          </p>
        )}

        {/* Sticky count */}
        {stickyCount > 0 && (
          <p className="text-xs text-muted-foreground">
            {"📋"} {stepsLabel}
          </p>
        )}
      </div>

      {/* ── Goal / Habit badges ── */}
      {(goalItems.length > 0 || habitItems.length > 0) && (
        <div className="mt-2 flex flex-wrap gap-1">
          {goalItems.map((gi) => (
            <span
              key={gi.id}
              className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded"
              title={gi.goal?.name}
            >
              {gi.goal?.name ?? gi.goalId.slice(0, 6)}
            </span>
          ))}
          {habitItems.map((hi) => (
            <span
              key={hi.id}
              className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium bg-green-500/10 text-green-600 dark:text-green-400 rounded"
              title={hi.habit?.name}
            >
              {hi.habit?.name ?? hi.habitId.slice(0, 6)}
            </span>
          ))}
        </div>
      )}

      {/* ── Progress bar (in_progress only) ── */}
      {showProgress && (
        <div className="mt-2">
          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
            <div
              className="h-1.5 rounded-full bg-blue-500 transition-all duration-500 ease-out"
              style={{ width: `${Math.min(progress.progress, 100)}%` }}
            />
          </div>
          {progress.message && (
            <p className="mt-1 text-[11px] text-muted-foreground truncate">
              {progress.message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
