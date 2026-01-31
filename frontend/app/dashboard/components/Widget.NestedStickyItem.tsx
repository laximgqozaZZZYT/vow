/**
 * Widget.NestedStickyItem - ネスト対応Sticky'nアイテムコンポーネント
 *
 * 機能:
 * - インデント表示で階層を視覚化
 * - 展開/折りたたみ機能
 * - 子Sticky'n追加ボタン
 * - ドラッグ&ドロップ対応
 * - モバイルフレンドリー（控えめなインデント）
 */

'use client';

import { useState, useRef } from 'react';
import type { Sticky } from '../types/index';
import { MAX_NESTING_DEPTH } from '../hooks/useNestedStickies';
import { AIAgentBadge, hasAIAgentTag } from './Badge.AIAgent';

interface NestedStickyItemProps {
  sticky: Sticky;
  isExpanded: boolean;
  hasChildren: boolean;
  isLeftHanded?: boolean;
  isEditing?: boolean;
  editingName?: string;
  onNameClick: (sticky: Sticky) => void;
  onNameChange: (value: string) => void;
  onNameBlur: (stickyId: string) => void;
  onComplete: (stickyId: string) => void;
  onEdit: (stickyId: string) => void;
  onDelete: (stickyId: string) => void;
  onAddChild: (parentId: string) => void;
  onToggleExpand: (stickyId: string) => void;
  onDragStart?: (e: React.DragEvent, stickyId: string) => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
  isDropTarget?: boolean;
  isHighlighted?: boolean;
}

/** 深さに応じたインデント幅（モバイルでは控えめに） */
const getIndentWidth = (depth: number, isMobile: boolean): number => {
  const baseIndent = isMobile ? 16 : 24; // モバイル: 16px, PC: 24px
  return depth * baseIndent;
};

export function NestedStickyItem({
  sticky,
  isExpanded,
  hasChildren,
  isLeftHanded = false,
  isEditing = false,
  editingName = '',
  onNameClick,
  onNameChange,
  onNameBlur,
  onComplete,
  onEdit,
  onDelete,
  onAddChild,
  onToggleExpand,
  onDragStart,
  onDragEnd,
  isDragging = false,
  isDropTarget = false,
  isHighlighted = false,
}: NestedStickyItemProps) {
  const depth = sticky.depth ?? 0;
  const isCompleted = sticky.completed;
  const canAddChild = depth < MAX_NESTING_DEPTH;
  const itemRef = useRef<HTMLDivElement>(null);

  // モバイル検出（簡易版）
  const [isMobile] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < 640
  );

  const indentWidth = getIndentWidth(depth, isMobile);

  // ドラッグ開始ハンドラ
  const handleDragStart = (e: React.DragEvent) => {
    if (isCompleted) return;
    onDragStart?.(e, sticky.id);
  };

  return (
    <div
      ref={itemRef}
      draggable={!isCompleted}
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      className={`
        group flex items-start gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg transition-all duration-200
        ${isCompleted
          ? 'bg-zinc-800/50'
          : 'bg-zinc-800 hover:bg-zinc-700/80'
        }
        ${isDragging ? 'opacity-50 scale-95' : ''}
        ${isDropTarget ? 'ring-2 ring-emerald-500 bg-emerald-500/10' : ''}
        ${isHighlighted ? 'ring-2 ring-emerald-500 ring-offset-2 ring-offset-zinc-900' : ''}
        ${isLeftHanded ? 'flex-row-reverse' : ''}
        ${!isCompleted ? 'cursor-move' : ''}
      `}
      style={{ marginLeft: `${indentWidth}px` }}
    >
      {/* 展開/折りたたみボタン */}
      <div className="flex-shrink-0 w-5 h-7 flex items-center justify-center">
        {hasChildren ? (
          <button
            onClick={() => onToggleExpand(sticky.id)}
            className="w-5 h-5 flex items-center justify-center text-zinc-500 hover:text-zinc-300 transition-colors"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            <svg
              className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <span className="w-3 h-3 rounded-full bg-zinc-700" />
        )}
      </div>

      {/* チェックボックス */}
      <button
        onClick={() => onComplete(sticky.id)}
        className={`
          flex-shrink-0 w-6 h-6 sm:w-7 sm:h-7 rounded flex items-center justify-center transition-colors
          ${isCompleted
            ? 'bg-emerald-600 text-white'
            : 'bg-zinc-700 border-2 border-zinc-600 hover:border-emerald-500'
          }
        `}
        title={isCompleted ? 'Mark as incomplete' : 'Mark as complete'}
      >
        {isCompleted && (
          <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      {/* コンテンツ */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input
            type="text"
            value={editingName}
            onChange={(e) => onNameChange(e.target.value)}
            onBlur={() => onNameBlur(sticky.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onNameBlur(sticky.id);
              if (e.key === 'Escape') onNameBlur(sticky.id);
            }}
            autoFocus
            placeholder="Enter name..."
            className="w-full px-2 py-1 text-sm bg-zinc-700 border border-zinc-600 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500 text-zinc-100"
          />
        ) : (
          <div
            onClick={() => !isCompleted && onNameClick(sticky)}
            className={`
              text-sm leading-relaxed cursor-pointer
              ${isCompleted
                ? 'line-through text-zinc-500'
                : 'text-zinc-100 hover:text-white'
              }
            `}
          >
            {sticky.name || "New Sticky'n"}
          </div>
        )}
        {sticky.description && !isCompleted && (
          <div className="text-xs text-zinc-500 mt-1 line-clamp-2">
            {sticky.description}
          </div>
        )}
        {/* AI Agent Badge - displayed when sticky has AIエージェント tag */}
        {hasAIAgentTag(sticky.tags) && (
          <div className="mt-1">
            <AIAgentBadge size="sm" />
          </div>
        )}
        {/* 深さインジケーター（デバッグ/視認用） */}
        {depth > 0 && (
          <div className="flex items-center gap-1 mt-1">
            {Array.from({ length: depth }).map((_, i) => (
              <span
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-zinc-600"
              />
            ))}
          </div>
        )}
      </div>

      {/* アクションボタン */}
      <div className={`
        flex items-center gap-1 sm:gap-2 opacity-0 group-hover:opacity-100 transition-opacity
        ${isLeftHanded ? 'flex-row-reverse' : ''}
      `}>
        {/* 子Sticky追加ボタン */}
        {!isCompleted && canAddChild && (
          <button
            onClick={() => onAddChild(sticky.id)}
            className="p-1 sm:px-2 sm:py-1 text-xs text-zinc-400 hover:text-emerald-400 transition-colors"
            title="Add child Sticky'n"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        )}
        {!isCompleted && (
          <button
            onClick={() => onEdit(sticky.id)}
            className="px-1 sm:px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Edit
          </button>
        )}
        <button
          onClick={() => onDelete(sticky.id)}
          className="px-1 sm:px-2 py-1 text-xs text-red-400 hover:text-red-300 transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

export default NestedStickyItem;
