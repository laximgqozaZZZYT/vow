'use client';

import React from 'react';

/**
 * 習慣統計の型定義
 */
export interface HabitStats {
  /** 習慣ID */
  habitId: string;
  /** 習慣名 */
  habitName: string;
  /** 達成率（0-1） */
  completionRate: number;
  /** トレンド */
  trend: 'improving' | 'stable' | 'declining';
  /** ストリーク日数 */
  streakDays: number;
  /** 直近の履歴（日付と達成状況） */
  recentHistory?: Array<{
    date: string;
    completed: boolean;
  }>;
}

/**
 * HabitStatsCardコンポーネントのProps
 */
export interface HabitStatsCardProps {
  /** 習慣統計データ */
  stats: HabitStats;
  /** クリック時のコールバック */
  onClick?: () => void;
  /** 追加のクラス名 */
  className?: string;
}

/**
 * トレンドアイコンを取得
 */
function getTrendIcon(trend: 'improving' | 'stable' | 'declining'): string {
  switch (trend) {
    case 'improving':
      return '↑';
    case 'declining':
      return '↓';
    default:
      return '→';
  }
}

/**
 * トレンドの色を取得
 */
function getTrendColor(trend: 'improving' | 'stable' | 'declining'): string {
  switch (trend) {
    case 'improving':
      return 'text-green-500';
    case 'declining':
      return 'text-red-500';
    default:
      return 'text-yellow-500';
  }
}

/**
 * 達成率に応じた色を取得
 */
function getCompletionColor(rate: number): string {
  if (rate >= 0.8) return 'text-green-500';
  if (rate >= 0.5) return 'text-yellow-500';
  return 'text-red-500';
}

/**
 * HabitStatsCardコンポーネント
 *
 * 習慣の統計情報をカード形式で表示する。
 * 達成率、トレンド、ストリーク日数、直近の履歴を表示。
 *
 * Requirements:
 * - 9.1: Display habit statistics with completion rate, trend, and streak
 */
export function HabitStatsCard({
  stats,
  onClick,
  className = '',
}: HabitStatsCardProps) {
  const completionPercent = Math.round(stats.completionRate * 100);

  return (
    <div
      className={`
        p-4 bg-card border border-border rounded-lg shadow-sm
        ${onClick ? 'cursor-pointer hover:bg-muted transition-colors' : ''}
        ${className}
      `}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-foreground truncate">{stats.habitName}</h3>
        <span className={`text-sm font-medium ${getTrendColor(stats.trend)}`}>
          {getTrendIcon(stats.trend)}
        </span>
      </div>

      {/* 統計情報 */}
      <div className="grid grid-cols-2 gap-4 mb-3">
        {/* 達成率 */}
        <div>
          <div className="text-xs text-muted-foreground mb-1">達成率</div>
          <div className={`text-2xl font-bold ${getCompletionColor(stats.completionRate)}`}>
            {completionPercent}%
          </div>
        </div>

        {/* ストリーク */}
        <div>
          <div className="text-xs text-muted-foreground mb-1">連続</div>
          <div className="text-2xl font-bold text-foreground">
            {stats.streakDays}
            <span className="text-sm font-normal text-muted-foreground ml-1">日</span>
          </div>
        </div>
      </div>

      {/* 進捗バー */}
      <div className="w-full h-2 bg-muted rounded-full overflow-hidden mb-3">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            completionPercent >= 80
              ? 'bg-green-500'
              : completionPercent >= 50
              ? 'bg-yellow-500'
              : 'bg-red-500'
          }`}
          style={{ width: `${completionPercent}%` }}
        />
      </div>

      {/* ミニカレンダー（直近7日） */}
      {stats.recentHistory && stats.recentHistory.length > 0 && (
        <div className="flex gap-1 justify-center">
          {stats.recentHistory.slice(-7).map((day, index) => (
            <div
              key={index}
              className={`
                w-6 h-6 rounded-sm flex items-center justify-center text-xs
                ${day.completed ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'}
              `}
              title={day.date}
            >
              {day.completed ? '✓' : '·'}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default HabitStatsCard;
