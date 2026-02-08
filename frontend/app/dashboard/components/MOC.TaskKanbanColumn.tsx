"use client";

/**
 * TaskKanbanColumn Component for MOC Task Kanban
 *
 * Displays a single column in the MOC Task Kanban board with:
 * - Column header (title, card count badge, accent color)
 * - Drop target highlighting for drag-and-drop
 * - Vertical stack of SkillSetCard components
 * - Empty state message
 * - "New Skill Set" button (TODO column only)
 *
 * @module MOC.TaskKanbanColumn
 */

import { useCallback } from 'react';
import type {
  SkillSet,
  SkillSetProgressReport,
  TaskKanbanColumnConfig,
  TaskKanbanColumnId,
} from '../types';
import SkillSetCard from './MOC.SkillSetCard';

// ============================================================================
// Props
// ============================================================================

export interface TaskKanbanColumnProps {
  column: TaskKanbanColumnConfig;
  skillSets: SkillSet[];
  onDrop: (skillSetId: string, targetStatus: TaskKanbanColumnId) => void;
  isDragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onCardClick: (skillSet: SkillSet) => void;
  onCardDragStart: (cardId: string) => void;
  onCardDragEnd: () => void;
  onNewSkillSet?: () => void;
  onExecute?: (skillSetId: string) => void;
  onDelete?: (skillSetId: string) => void;
  executionProgress: Map<string, SkillSetProgressReport>;
  isRemoteCliConnected: boolean;
  locale: 'ja' | 'en';
}

// ============================================================================
// Component
// ============================================================================

/**
 * TaskKanbanColumn component for the MOC Task Kanban board.
 *
 * Renders a column with header, card list, drop-target handling,
 * and an optional "new skill set" button for the TODO column.
 */
export default function TaskKanbanColumn({
  column,
  skillSets,
  onDrop,
  isDragOver,
  onDragOver,
  onDragLeave,
  onCardClick,
  onCardDragStart,
  onCardDragEnd,
  onNewSkillSet,
  onExecute,
  onDelete,
  executionProgress,
  isRemoteCliConnected,
  locale,
}: TaskKanbanColumnProps) {
  const count = skillSets.length;
  const title = locale === 'ja' ? column.titleJa : column.title;
  const isTodoColumn = column.id === 'todo';

  // -- Drag/Drop handlers ---------------------------------------------------

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      onDragOver(e);
    },
    [onDragOver],
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      // Only trigger when actually leaving the column, not child elements
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX;
      const y = e.clientY;
      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
        onDragLeave();
      }
    },
    [onDragLeave],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const skillSetId = e.dataTransfer.getData('text/plain');
      if (skillSetId) {
        onDrop(skillSetId, column.id);
      }
      onDragLeave();
    },
    [column.id, onDrop, onDragLeave],
  );

  // -- Labels ---------------------------------------------------------------

  const emptyLabel =
    locale === 'ja' ? 'スキルセットがありません' : 'No skill sets';
  const dropLabel =
    locale === 'ja' ? 'ここにドロップ' : 'Drop here';
  const newSkillSetLabel =
    locale === 'ja' ? '+ 新規スキルセット' : '+ New Skill Set';

  return (
    <div
      data-task-kanban-column={column.id}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        flex flex-col
        bg-muted/30
        rounded-lg
        min-h-[200px]
        h-full
        border-l-4
        ${column.accentColor}
        transition-all
        duration-200
        ${isDragOver ? 'border-dashed ring-1 ring-primary/30' : ''}
      `}
      style={isDragOver ? { backgroundColor: 'var(--color-primary, #3b82f6)08' } : undefined}
    >
      {/* ── Column header ── */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${column.statusDotColor}`} />
          <h3 className="text-sm font-medium text-foreground">{title}</h3>
        </div>
        <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
          {count}
        </span>
      </div>

      {/* ── Card list ── */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {count === 0 ? (
          <div
            className={`
              flex items-center justify-center
              h-full min-h-[100px]
              text-sm text-muted-foreground
              border-2 border-dashed rounded-lg
              transition-colors
              ${isDragOver ? 'border-primary bg-primary/5' : 'border-border'}
            `}
          >
            {isDragOver ? dropLabel : emptyLabel}
          </div>
        ) : (
          skillSets.map((ss) => (
            <SkillSetCard
              key={ss.id}
              skillSet={ss}
              isDragging={false}
              onDragStart={() => onCardDragStart(ss.id)}
              onDragEnd={onCardDragEnd}
              onClick={() => onCardClick(ss)}
              onExecute={onExecute ? () => onExecute(ss.id) : undefined}
              onDelete={onDelete ? () => onDelete(ss.id) : undefined}
              progress={executionProgress.get(ss.id)}
              isRemoteCliConnected={isRemoteCliConnected}
              locale={locale}
            />
          ))
        )}
      </div>

      {/* ── New Skill Set button (TODO column only) ── */}
      {isTodoColumn && onNewSkillSet && (
        <div className="p-2 border-t border-border">
          <button
            onClick={onNewSkillSet}
            className="
              w-full
              flex items-center justify-center gap-1.5
              px-3 py-2
              text-xs font-medium
              text-muted-foreground
              hover:text-foreground
              hover:bg-muted
              border border-dashed border-border
              hover:border-primary/50
              rounded-md
              transition-colors
            "
          >
            {newSkillSetLabel}
          </button>
        </div>
      )}
    </div>
  );
}
