'use client';

/**
 * Toast.MigrationComplete Component
 * 
 * レベルシステム移行完了の通知トースト
 * 
 * Features:
 * - 一回限りの通知表示
 * - 移行詳細モーダルへのリンク
 * - Pioneer Badge獲得通知
 * 
 * @module Toast.MigrationComplete
 * 
 * Validates: Requirements 5.5 (level-system-rebalancing)
 */

import React, { useEffect, useState } from 'react';

export interface MigrationCompleteToastProps {
  /** 表示するかどうか */
  isVisible: boolean;
  /** 閉じるハンドラ */
  onClose: () => void;
  /** 詳細を見るハンドラ */
  onViewDetails: () => void;
  /** Pioneer Badge獲得したかどうか */
  pioneerBadgeAwarded?: boolean;
  /** 旧レベル */
  oldLevel?: number;
  /** 新レベル */
  newLevel?: number;
}

/**
 * Toast.MigrationComplete コンポーネント
 */
export default function ToastMigrationComplete({
  isVisible,
  onClose,
  onViewDetails,
  pioneerBadgeAwarded = false,
  oldLevel,
  newLevel,
}: MigrationCompleteToastProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setIsAnimating(true);
    }
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div
      className={`
        fixed bottom-4 right-4 z-50
        max-w-sm w-full
        p-4
        bg-card border border-border
        rounded-lg shadow-lg
        transform transition-all duration-300
        ${isAnimating ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}
      `}
    >
      {/* ヘッダー */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          {pioneerBadgeAwarded ? (
            <div className="w-8 h-8 flex items-center justify-center bg-gradient-to-br from-amber-400 to-yellow-500 rounded-full">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
              </svg>
            </div>
          ) : (
            <div className="w-8 h-8 flex items-center justify-center bg-primary/20 rounded-full">
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          )}
          <div>
            <div className="font-semibold text-foreground">
              {pioneerBadgeAwarded ? '🏆 Pioneer Badge 獲得！' : 'レベルシステム更新'}
            </div>
            <div className="text-sm text-muted-foreground">
              {pioneerBadgeAwarded
                ? 'リバランス前の達成者として認定されました'
                : 'レベルシステムがリバランスされました'}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="閉じる"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* レベル変更表示 */}
      {oldLevel !== undefined && newLevel !== undefined && (
        <div className="flex items-center gap-2 mb-3 text-sm">
          <span className="text-muted-foreground">Lv. {oldLevel}</span>
          <span className="text-muted-foreground">→</span>
          <span className="font-medium text-foreground">Lv. {newLevel.toLocaleString()}</span>
        </div>
      )}

      {/* アクションボタン */}
      <div className="flex gap-2">
        <button
          onClick={onViewDetails}
          className="flex-1 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
        >
          詳細を見る
        </button>
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-sm bg-muted text-muted-foreground rounded-md hover:bg-muted/80 transition-colors"
        >
          閉じる
        </button>
      </div>
    </div>
  );
}

/**
 * 移行通知を表示するかどうかを判定するフック
 */
export function useMigrationNotification(
  isMigrated: boolean,
  migrationDate: string | null
): {
  shouldShow: boolean;
  markAsSeen: () => void;
} {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    if (!isMigrated || !migrationDate) {
      setShouldShow(false);
      return;
    }

    // ローカルストレージで既に見たかどうかを確認
    const seenKey = `migration_notification_seen_${migrationDate}`;
    const hasSeen = localStorage.getItem(seenKey) === 'true';

    if (!hasSeen) {
      setShouldShow(true);
    }
  }, [isMigrated, migrationDate]);

  const markAsSeen = () => {
    if (migrationDate) {
      const seenKey = `migration_notification_seen_${migrationDate}`;
      localStorage.setItem(seenKey, 'true');
    }
    setShouldShow(false);
  };

  return { shouldShow, markAsSeen };
}
