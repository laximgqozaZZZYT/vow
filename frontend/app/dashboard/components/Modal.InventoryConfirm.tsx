"use client";

/**
 * Modal.InventoryConfirm Component
 * 
 * Confirmation modal for starting habit inventory assessment.
 * Shows quota cost and allows user to confirm or cancel.
 * 
 * @module Modal.InventoryConfirm
 * 
 * Validates: Requirements 3.1, 3.5
 */

import React from 'react';
import type { QuotaStatus } from './Widget.QuotaStatus';

export interface InventoryConfirmModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Callback when user confirms to start inventory */
  onConfirm: (selectedHabitIds?: string[]) => void;
  /** Number of unassessed habits */
  unassessedCount: number;
  /** User's quota status */
  quotaStatus: QuotaStatus | null;
  /** List of unassessed habits for selection */
  habits?: Array<{ id: string; name: string }>;
  /** Loading state */
  loading?: boolean;
}

/**
 * Modal.InventoryConfirm component
 */
export default function InventoryConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  unassessedCount,
  quotaStatus,
  habits = [],
  loading = false,
}: InventoryConfirmModalProps) {
  const [selectedHabits, setSelectedHabits] = React.useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = React.useState(false);

  // Check if quota is insufficient
  const quotaInsufficient = quotaStatus && !quotaStatus.isUnlimited && 
    quotaStatus.remaining < unassessedCount;

  // Reset selection when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setSelectedHabits(new Set());
      setSelectMode(quotaInsufficient ?? false);
    }
  }, [isOpen, quotaInsufficient]);

  // Calculate estimated time
  const estimatedTimeMinutes = Math.ceil((selectMode ? selectedHabits.size : unassessedCount) * 2 / 60);

  // Handle habit selection toggle
  const toggleHabit = (habitId: string) => {
    const newSelected = new Set(selectedHabits);
    if (newSelected.has(habitId)) {
      newSelected.delete(habitId);
    } else {
      // Check quota limit
      if (quotaStatus && !quotaStatus.isUnlimited && newSelected.size >= quotaStatus.remaining) {
        return; // Can't select more than quota allows
      }
      newSelected.add(habitId);
    }
    setSelectedHabits(newSelected);
  };

  // Handle select all
  const selectAll = () => {
    const maxSelectable = quotaStatus?.isUnlimited 
      ? habits.length 
      : Math.min(habits.length, quotaStatus?.remaining ?? 0);
    setSelectedHabits(new Set(habits.slice(0, maxSelectable).map(h => h.id)));
  };

  // Handle confirm
  const handleConfirm = () => {
    if (selectMode && selectedHabits.size > 0) {
      onConfirm(Array.from(selectedHabits));
    } else if (!selectMode) {
      onConfirm();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md mx-4 p-6 bg-card rounded-xl shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold">すべての習慣を評価</h2>
            <p className="text-sm text-muted-foreground">
              {unassessedCount}件の習慣を一括評価します
            </p>
          </div>
        </div>

        {/* Quota Warning */}
        {quotaInsufficient && (
          <div className="mb-4 p-3 bg-warning/10 border border-warning/20 rounded-lg">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-warning">評価回数が不足しています</p>
                <p className="text-xs text-muted-foreground mt-1">
                  残り{quotaStatus?.remaining}回ですが、{unassessedCount}件の習慣があります。
                  評価する習慣を選択してください。
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Info Cards */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="text-xs text-muted-foreground">評価対象</div>
            <div className="text-xl font-semibold">
              {selectMode ? selectedHabits.size : unassessedCount}件
            </div>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="text-xs text-muted-foreground">推定時間</div>
            <div className="text-xl font-semibold">
              約{estimatedTimeMinutes}分
            </div>
          </div>
        </div>

        {/* Quota Status */}
        {quotaStatus && (
          <div className="mb-4 p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">評価回数</span>
              {quotaStatus.isUnlimited ? (
                <span className="text-primary font-medium">無制限</span>
              ) : (
                <span className={quotaInsufficient ? 'text-warning font-medium' : ''}>
                  残り {quotaStatus.remaining}/{quotaStatus.quotaLimit} 回
                </span>
              )}
            </div>
          </div>
        )}

        {/* Habit Selection (when quota insufficient) */}
        {selectMode && habits.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">評価する習慣を選択</span>
              <button
                onClick={selectAll}
                className="text-xs text-primary hover:underline"
              >
                上限まで選択
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto border border-border rounded-lg">
              {habits.map((habit) => (
                <label
                  key={habit.id}
                  className={`
                    flex items-center gap-3 p-3 cursor-pointer
                    hover:bg-muted/50 transition-colors
                    border-b border-border last:border-b-0
                    ${selectedHabits.has(habit.id) ? 'bg-primary/5' : ''}
                  `}
                >
                  <input
                    type="checkbox"
                    checked={selectedHabits.has(habit.id)}
                    onChange={() => toggleHabit(habit.id)}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="text-sm truncate">{habit.name}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {selectedHabits.size}/{quotaStatus?.remaining ?? 0} 件選択中
            </p>
          </div>
        )}

        {/* Description */}
        <p className="text-sm text-muted-foreground mb-6">
          各習慣のレベルを自動的に評価します。評価中は他の操作を行わないでください。
          途中でキャンセルした場合、進捗は保存されます。
        </p>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="
              flex-1 px-4 py-2.5
              bg-muted text-foreground
              rounded-lg
              hover:bg-muted/80
              focus-visible:outline-2 focus-visible:outline-primary
              transition-colors
              disabled:opacity-50
            "
          >
            キャンセル
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || (selectMode && selectedHabits.size === 0)}
            className="
              flex-1 px-4 py-2.5
              bg-primary text-primary-foreground
              rounded-lg shadow-sm
              hover:opacity-90
              focus-visible:outline-2 focus-visible:outline-primary
              transition-opacity
              disabled:opacity-50
              flex items-center justify-center gap-2
            "
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>準備中...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>評価を開始</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
