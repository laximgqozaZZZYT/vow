'use client';

/**
 * Modal.MigrationDetails Component
 * 
 * レベルシステム移行の詳細を表示するモーダル
 * 
 * Features:
 * - 移行前後のレベル比較
 * - Pioneer Badge表示
 * - 移行日時表示
 * - 新しいティア境界の説明
 * 
 * @module Modal.MigrationDetails
 * 
 * Validates: Requirements 5.6 (level-system-rebalancing)
 */

import React from 'react';
import { calculateTier, getTierColors } from './LevelBadge';

export interface MigrationDetailsProps {
  /** モーダルを開いているかどうか */
  isOpen: boolean;
  /** モーダルを閉じるハンドラ */
  onClose: () => void;
  /** 移行前のレベル */
  oldLevel: number | null;
  /** 移行後のレベル */
  newLevel: number;
  /** Pioneer Badge授与済みかどうか */
  pioneerBadgeAwarded: boolean;
  /** 移行日時 */
  migrationDate: string | null;
  /** ユーザー名（オプション） */
  userName?: string;
}

/**
 * Modal.MigrationDetails コンポーネント
 */
export default function ModalMigrationDetails({
  isOpen,
  onClose,
  oldLevel,
  newLevel,
  pioneerBadgeAwarded,
  migrationDate,
  userName,
}: MigrationDetailsProps) {
  if (!isOpen) return null;

  const oldTier = oldLevel !== null ? calculateTier(oldLevel) : null;
  const newTier = calculateTier(newLevel);
  const oldColors = oldTier ? getTierColors(oldTier) : null;
  const newColors = getTierColors(newTier);

  const formattedDate = migrationDate
    ? new Date(migrationDate).toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md p-6 bg-card rounded-xl shadow-lg mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-foreground">
            レベルシステム移行完了
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="閉じる"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Pioneer Badge */}
        {pioneerBadgeAwarded && (
          <div className="mb-6 p-4 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/30 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 flex items-center justify-center bg-gradient-to-br from-amber-400 to-yellow-500 rounded-full shadow-lg">
                <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                </svg>
              </div>
              <div>
                <div className="font-bold text-amber-700 dark:text-amber-400">
                  🏆 Pioneer Badge 獲得！
                </div>
                <div className="text-sm text-amber-600 dark:text-amber-500">
                  リバランス前にLv.100以上を達成した先駆者の証
                </div>
              </div>
            </div>
          </div>
        )}

        {/* レベル比較 */}
        <div className="mb-6">
          <div className="text-sm text-muted-foreground mb-3">レベル変更</div>
          <div className="flex items-center justify-center gap-4">
            {/* 旧レベル */}
            {oldLevel !== null && oldColors && (
              <div className="text-center">
                <div className="text-xs text-muted-foreground mb-1">移行前</div>
                <div className={`px-4 py-2 rounded-lg ${oldColors.bg} ${oldColors.text} border ${oldColors.border}`}>
                  <div className="text-2xl font-bold">Lv. {oldLevel}</div>
                  <div className="text-xs opacity-80">{oldColors.labelJa}</div>
                </div>
              </div>
            )}

            {/* 矢印 */}
            {oldLevel !== null && (
              <div className="text-2xl text-muted-foreground">→</div>
            )}

            {/* 新レベル */}
            <div className="text-center">
              <div className="text-xs text-muted-foreground mb-1">
                {oldLevel !== null ? '移行後' : '現在'}
              </div>
              <div className={`px-4 py-2 rounded-lg ${newColors.bg} ${newColors.text} border ${newColors.border} ${newTier === 'expert' ? newColors.glow : ''}`}>
                <div className="text-2xl font-bold">Lv. {newLevel.toLocaleString()}</div>
                <div className="text-xs opacity-80">{newColors.labelJa}</div>
              </div>
            </div>
          </div>
        </div>

        {/* 移行情報 */}
        {formattedDate && (
          <div className="mb-6 p-3 bg-muted rounded-lg">
            <div className="text-sm text-muted-foreground">
              移行日時: <span className="text-foreground">{formattedDate}</span>
            </div>
          </div>
        )}

        {/* 新しいティア境界の説明 */}
        <div className="mb-6">
          <div className="text-sm text-muted-foreground mb-2">新しいティア境界</div>
          <div className="space-y-2">
            {[
              { tier: 'beginner', range: '0-49', label: '初級' },
              { tier: 'intermediate', range: '50-99', label: '中級' },
              { tier: 'advanced', range: '100-499', label: '上級' },
              { tier: 'expert', range: '500-9999', label: '達人' },
            ].map(({ tier, range, label }) => {
              const colors = getTierColors(tier as 'beginner' | 'intermediate' | 'advanced' | 'expert');
              const isCurrentTier = tier === newTier;
              return (
                <div
                  key={tier}
                  className={`flex items-center justify-between p-2 rounded ${isCurrentTier ? colors.bg + ' border ' + colors.border : ''}`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${colors.bg.replace('/20', '')}`} />
                    <span className={isCurrentTier ? colors.text + ' font-medium' : 'text-muted-foreground'}>
                      {label}
                    </span>
                  </div>
                  <span className={`text-sm ${isCurrentTier ? colors.text : 'text-muted-foreground'}`}>
                    Lv. {range}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 説明文 */}
        <div className="mb-6 text-sm text-muted-foreground">
          <p>
            レベルシステムがリバランスされました。新しいシステムでは、
            より長期的な成長を促進するために、レベル上昇に必要な経験値が調整されています。
          </p>
          {oldLevel !== null && oldLevel > newLevel && (
            <p className="mt-2">
              レベルは圧縮されましたが、これまでの努力は失われていません。
              新しいシステムでも引き続き成長を続けてください！
            </p>
          )}
        </div>

        {/* 閉じるボタン */}
        <button
          onClick={onClose}
          className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity focus-visible:outline-2 focus-visible:outline-primary"
        >
          確認しました
        </button>
      </div>
    </div>
  );
}
