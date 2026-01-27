'use client';

import React, { useState, useCallback } from 'react';

/**
 * StickyFooter - 固定フッターコンポーネント
 * 
 * モーダル下部に固定表示されるアクションボタン群。
 * スクロール位置に関係なく常に表示される。
 * 
 * @validates Requirements 4.1, 4.2, 4.3, 4.4
 */

export interface StickyFooterProps {
  /** 保存ボタンクリック時のコールバック */
  onSave: () => void;
  /** キャンセルボタンクリック時のコールバック */
  onCancel: () => void;
  /** 削除ボタンクリック時のコールバック（オプション） */
  onDelete?: () => void;
  /** 完了ボタンクリック時のコールバック（オプション、Goalモーダル用） */
  onComplete?: () => void;
  /** 保存ボタンの無効化 */
  saveDisabled?: boolean;
  /** ローディング状態 */
  isLoading?: boolean;
  /** 削除確認が必要かどうか */
  confirmDelete?: boolean;
  /** 削除確認メッセージ */
  deleteConfirmMessage?: string;
  /** 保存ボタンのラベル */
  saveLabel?: string;
  /** キャンセルボタンのラベル */
  cancelLabel?: string;
  /** 削除ボタンのラベル */
  deleteLabel?: string;
  /** 完了ボタンのラベル */
  completeLabel?: string;
}

export function StickyFooter({
  onSave,
  onCancel,
  onDelete,
  onComplete,
  saveDisabled = false,
  isLoading = false,
  confirmDelete = true,
  deleteConfirmMessage = 'Are you sure you want to delete this item?',
  saveLabel = '保存',
  cancelLabel = 'キャンセル',
  deleteLabel = '削除',
  completeLabel = 'Completed',
}: StickyFooterProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDeleteClick = useCallback(() => {
    if (confirmDelete) {
      setShowDeleteConfirm(true);
    } else {
      onDelete?.();
    }
  }, [confirmDelete, onDelete]);

  const handleDeleteConfirm = useCallback(() => {
    onDelete?.();
    setShowDeleteConfirm(false);
  }, [onDelete]);

  const handleDeleteCancel = useCallback(() => {
    setShowDeleteConfirm(false);
  }, []);

  return (
    <div 
      className="
        sticky bottom-0 left-0 right-0
        bg-card border-t border-border
        px-4 py-3 mt-4
        shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]
        dark:shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.3)]
        z-10
      "
    >
      {/* 削除確認ダイアログ */}
      {showDeleteConfirm && (
        <div className="mb-3 p-3 bg-destructive/10 border border-destructive/30 rounded-md">
          <p className="text-sm text-destructive mb-2">{deleteConfirmMessage}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDeleteConfirm}
              className="
                px-3 py-1.5 text-sm font-medium
                bg-destructive text-destructive-foreground
                rounded-md transition-colors
                hover:bg-destructive/90
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive
                min-h-[36px]
              "
            >
              削除する
            </button>
            <button
              type="button"
              onClick={handleDeleteCancel}
              className="
                px-3 py-1.5 text-sm font-medium
                bg-muted text-muted-foreground
                rounded-md transition-colors
                hover:bg-muted/80
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
                min-h-[36px]
              "
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        {/* 左側: 保存・キャンセル・完了ボタン */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onSave}
            disabled={saveDisabled || isLoading}
            className="
              inline-flex items-center justify-center
              px-4 py-2 text-sm font-medium
              bg-primary text-primary-foreground
              rounded-md transition-colors
              hover:bg-primary/90
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
              disabled:cursor-not-allowed disabled:opacity-50
              min-h-[44px] min-w-[80px]
            "
          >
            {isLoading ? (
              <>
                <svg 
                  className="animate-spin -ml-1 mr-2 h-4 w-4" 
                  xmlns="http://www.w3.org/2000/svg" 
                  fill="none" 
                  viewBox="0 0 24 24"
                >
                  <circle 
                    className="opacity-25" 
                    cx="12" 
                    cy="12" 
                    r="10" 
                    stroke="currentColor" 
                    strokeWidth="4"
                  />
                  <path 
                    className="opacity-75" 
                    fill="currentColor" 
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                保存中...
              </>
            ) : (
              saveLabel
            )}
          </button>

          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="
              inline-flex items-center justify-center
              px-4 py-2 text-sm font-medium
              bg-transparent text-foreground
              rounded-md transition-colors
              hover:bg-accent
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
              disabled:cursor-not-allowed disabled:opacity-50
              min-h-[44px] min-w-[80px]
            "
          >
            {cancelLabel}
          </button>

          {onComplete && (
            <button
              type="button"
              onClick={onComplete}
              disabled={isLoading}
              className="
                inline-flex items-center justify-center
                px-4 py-2 text-sm font-medium
                bg-success text-success-foreground
                rounded-md transition-colors
                hover:bg-success/90
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success
                disabled:cursor-not-allowed disabled:opacity-50
                min-h-[44px]
              "
            >
              {completeLabel}
            </button>
          )}
        </div>

        {/* 右側: 削除ボタン（視覚的に分離） */}
        {onDelete && !showDeleteConfirm && (
          <button
            type="button"
            onClick={handleDeleteClick}
            disabled={isLoading}
            className="
              inline-flex items-center justify-center
              px-3 py-2 text-sm font-medium
              text-destructive
              rounded-md transition-colors
              hover:bg-destructive/10
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive
              disabled:cursor-not-allowed disabled:opacity-50
              min-h-[44px]
            "
          >
            {deleteLabel}
          </button>
        )}
      </div>
    </div>
  );
}

export default StickyFooter;
