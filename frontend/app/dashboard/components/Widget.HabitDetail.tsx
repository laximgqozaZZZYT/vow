'use client';

import React from 'react';

/**
 * 習慣詳細の型定義
 */
export interface HabitDetail {
  /** 習慣ID */
  id: string;
  /** 習慣名 */
  name: string;
  /** 習慣タイプ */
  type: 'do' | 'avoid';
  /** 頻度 */
  frequency: 'daily' | 'weekly' | 'monthly';
  /** 目標回数 */
  targetCount?: number;
  /** 単位 */
  workloadUnit?: string;
  /** トリガー時刻 */
  triggerTime?: string;
  /** アクティブかどうか */
  isActive: boolean;
  /** 達成率 */
  completionRate?: number;
  /** トレンド */
  trend?: 'improving' | 'stable' | 'declining';
  /** 関連ゴール名 */
  goalName?: string;
}

/**
 * HabitDetailCardコンポーネントのProps
 */
export interface HabitDetailCardProps {
  /** 習慣詳細データ */
  habit: HabitDetail;
  /** 編集ボタンクリック時のコールバック */
  onEdit?: () => void;
  /** 削除ボタンクリック時のコールバック */
  onDelete?: () => void;
  /** 追加のクラス名 */
  className?: string;
}

/**
 * 頻度の日本語表示を取得
 */
function getFrequencyLabel(frequency: 'daily' | 'weekly' | 'monthly'): string {
  switch (frequency) {
    case 'daily':
      return '毎日';
    case 'weekly':
      return '毎週';
    case 'monthly':
      return '毎月';
  }
}

/**
 * トレンドアイコンを取得
 */
function getTrendDisplay(trend?: 'improving' | 'stable' | 'declining'): { icon: string; color: string } {
  switch (trend) {
    case 'improving':
      return { icon: '↑ 改善中', color: 'text-green-500' };
    case 'declining':
      return { icon: '↓ 要注意', color: 'text-red-500' };
    default:
      return { icon: '→ 安定', color: 'text-yellow-500' };
  }
}

/**
 * HabitDetailCardコンポーネント
 *
 * 習慣の詳細情報を表示するカード。
 * 編集・削除ボタンを含む。
 *
 * Requirements:
 * - 9.3: Display habit details with edit and delete options
 */
export function HabitDetailCard({
  habit,
  onEdit,
  onDelete,
  className = '',
}: HabitDetailCardProps) {
  const trendDisplay = getTrendDisplay(habit.trend);
  const completionPercent = habit.completionRate
    ? Math.round(habit.completionRate * 100)
    : null;

  return (
    <div
      className={`
        p-4 bg-card border border-border rounded-lg shadow-sm
        ${className}
      `}
    >
      {/* ヘッダー */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-medium text-foreground">{habit.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`
                px-2 py-0.5 text-xs rounded-full
                ${habit.type === 'do' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}
              `}
            >
              {habit.type === 'do' ? '実行' : '回避'}
            </span>
            <span className="text-xs text-muted-foreground">
              {getFrequencyLabel(habit.frequency)}
            </span>
            {!habit.isActive && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-muted text-muted-foreground">
                停止中
              </span>
            )}
          </div>
        </div>

        {/* アクションボタン */}
        <div className="flex gap-1">
          {onEdit && (
            <button
              onClick={onEdit}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
              aria-label="編集"
            >
              ✏️
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="p-2 text-muted-foreground hover:text-destructive hover:bg-muted rounded-md transition-colors"
              aria-label="削除"
            >
              🗑️
            </button>
          )}
        </div>
      </div>

      {/* 詳細情報 */}
      <div className="space-y-2 text-sm">
        {/* 目標 */}
        {habit.targetCount && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">目標</span>
            <span className="text-foreground">
              {habit.targetCount}
              {habit.workloadUnit && ` ${habit.workloadUnit}`}
            </span>
          </div>
        )}

        {/* 時刻 */}
        {habit.triggerTime && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">時刻</span>
            <span className="text-foreground">{habit.triggerTime}</span>
          </div>
        )}

        {/* 達成率 */}
        {completionPercent !== null && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">達成率</span>
            <span
              className={`font-medium ${
                completionPercent >= 80
                  ? 'text-green-500'
                  : completionPercent >= 50
                  ? 'text-yellow-500'
                  : 'text-red-500'
              }`}
            >
              {completionPercent}%
            </span>
          </div>
        )}

        {/* トレンド */}
        {habit.trend && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">傾向</span>
            <span className={trendDisplay.color}>{trendDisplay.icon}</span>
          </div>
        )}

        {/* 関連ゴール */}
        {habit.goalName && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">ゴール</span>
            <span className="text-foreground truncate max-w-[60%]">{habit.goalName}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default HabitDetailCard;
