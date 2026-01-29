"use client";

/**
 * Modal.XPRecoveryConfirm Component
 * 
 * Confirmation dialog for XP recalculation.
 * Shows a warning message and allows user to confirm or cancel the operation.
 * 
 * @module Modal.XPRecoveryConfirm
 * 
 * Validates: Requirements 5.2
 */

import React from 'react';

export interface XPRecoveryConfirmModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when modal is closed (cancel) */
  onClose: () => void;
  /** Callback when user confirms to start recalculation */
  onConfirm: () => void;
  /** Loading state during recalculation */
  loading?: boolean;
}

/**
 * Modal.XPRecoveryConfirm component
 * 
 * Displays a confirmation dialog before executing XP recalculation.
 * Explains what will happen and provides "実行" (Execute) and "キャンセル" (Cancel) buttons.
 */
export default function XPRecoveryConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  loading = false,
}: XPRecoveryConfirmModalProps) {
  // Handle escape key to close modal
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !loading) {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, loading, onClose]);

  // Prevent body scroll when modal is open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={loading ? undefined : onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="xp-recovery-title"
      aria-describedby="xp-recovery-description"
    >
      <div 
        className="w-full max-w-md mx-4 p-6 bg-card rounded-xl shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center">
            <svg 
              className="w-5 h-5 text-warning" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
              />
            </svg>
          </div>
          <div>
            <h2 id="xp-recovery-title" className="text-lg font-semibold">
              経験値の再計算
            </h2>
            <p className="text-sm text-muted-foreground">
              この操作を実行しますか？
            </p>
          </div>
        </div>

        {/* Description */}
        <div id="xp-recovery-description" className="mb-6 space-y-3">
          <p className="text-sm text-muted-foreground">
            過去に完了した習慣の履歴から経験値を再計算し、レベルを更新します。
          </p>
          
          {/* Info box */}
          <div className="p-3 bg-muted/50 rounded-lg">
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex items-start gap-2">
                <svg 
                  className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M5 13l4 4L19 7" 
                  />
                </svg>
                <span>既に付与済みの経験値は重複して付与されません</span>
              </li>
              <li className="flex items-start gap-2">
                <svg 
                  className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M5 13l4 4L19 7" 
                  />
                </svg>
                <span>処理には数秒〜数分かかる場合があります</span>
              </li>
              <li className="flex items-start gap-2">
                <svg 
                  className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M5 13l4 4L19 7" 
                  />
                </svg>
                <span>レベルが更新される可能性があります</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="
              flex-1 px-4 py-2.5
              bg-muted text-foreground
              rounded-md
              hover:bg-muted/80
              focus-visible:outline-2 focus-visible:outline-primary
              transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          >
            キャンセル
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="
              flex-1 px-4 py-2.5
              bg-primary text-primary-foreground
              rounded-md shadow-sm
              hover:opacity-90
              focus-visible:outline-2 focus-visible:outline-primary
              transition-opacity
              disabled:opacity-50 disabled:cursor-not-allowed
              flex items-center justify-center gap-2
            "
          >
            {loading ? (
              <>
                <svg 
                  className="w-4 h-4 animate-spin" 
                  fill="none" 
                  viewBox="0 0 24 24"
                  aria-hidden="true"
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
                <span>処理中...</span>
              </>
            ) : (
              <>
                <svg 
                  className="w-4 h-4" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                  />
                </svg>
                <span>実行</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
