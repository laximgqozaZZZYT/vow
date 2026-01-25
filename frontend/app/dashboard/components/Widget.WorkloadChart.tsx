'use client';

import React from 'react';

/**
 * ワークロードデータの型定義
 */
export interface WorkloadData {
  /** 合計習慣数 */
  totalHabits: number;
  /** アクティブな習慣数 */
  activeHabits: number;
  /** 1日あたりの分数 */
  dailyMinutes: number;
  /** 1週間あたりの分数 */
  weeklyMinutes: number;
  /** ステータス */
  status: 'light' | 'moderate' | 'heavy' | 'overloaded';
  /** 習慣ごとの内訳 */
  breakdown?: Array<{
    name: string;
    minutes: number;
    color?: string;
  }>;
}

/**
 * WorkloadChartコンポーネントのProps
 */
export interface WorkloadChartProps {
  /** ワークロードデータ */
  data: WorkloadData;
  /** 表示タイプ */
  type?: 'bar' | 'donut';
  /** 追加のクラス名 */
  className?: string;
}

/**
 * ステータスに応じた色を取得
 */
function getStatusColor(status: 'light' | 'moderate' | 'heavy' | 'overloaded'): string {
  switch (status) {
    case 'light':
      return 'text-green-500';
    case 'moderate':
      return 'text-blue-500';
    case 'heavy':
      return 'text-yellow-500';
    case 'overloaded':
      return 'text-red-500';
  }
}

/**
 * ステータスの日本語表示を取得
 */
function getStatusLabel(status: 'light' | 'moderate' | 'heavy' | 'overloaded'): string {
  switch (status) {
    case 'light':
      return '余裕あり';
    case 'moderate':
      return 'バランス良好';
    case 'heavy':
      return '負荷高め';
    case 'overloaded':
      return '過負荷';
  }
}


/**
 * 分を時間と分に変換
 */
function formatMinutes(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}分`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}時間${mins}分` : `${hours}時間`;
}

/**
 * デフォルトの色パレット
 */
const DEFAULT_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // yellow
  '#EF4444', // red
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
];

/**
 * 棒グラフコンポーネント
 */
function BarChart({ breakdown, total }: { breakdown: Array<{ name: string; minutes: number; color: string }>; total: number }) {
  return (
    <div className="space-y-2">
      {breakdown.map((item, index) => {
        const percentage = total > 0 ? (item.minutes / total) * 100 : 0;
        return (
          <div key={index} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-foreground truncate max-w-[60%]">{item.name}</span>
              <span className="text-muted-foreground">{formatMinutes(item.minutes)}</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${percentage}%`, backgroundColor: item.color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * ドーナツチャートコンポーネント
 */
function DonutChart({ breakdown, total }: { breakdown: Array<{ name: string; minutes: number; color: string }>; total: number }) {
  const size = 120;
  const strokeWidth = 20;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  
  let currentOffset = 0;
  const segments = breakdown.map((item) => {
    const percentage = total > 0 ? item.minutes / total : 0;
    const dashLength = circumference * percentage;
    const segment = {
      ...item,
      dashArray: `${dashLength} ${circumference - dashLength}`,
      dashOffset: -currentOffset,
    };
    currentOffset += dashLength;
    return segment;
  });

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted"
        />
        {segments.map((segment, index) => (
          <circle
            key={index}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={segment.color}
            strokeWidth={strokeWidth}
            strokeDasharray={segment.dashArray}
            strokeDashoffset={segment.dashOffset}
            className="transition-all duration-300"
          />
        ))}
      </svg>
      <div className="flex-1 space-y-1">
        {breakdown.map((item, index) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-foreground truncate">{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}


/**
 * WorkloadChartコンポーネント
 *
 * 日/週のワークロードを視覚的に表示する。
 * 習慣ごとの内訳を棒グラフまたはドーナツチャートで表示。
 *
 * Requirements:
 * - 9.6: Display workload chart with daily/weekly breakdown
 */
export function WorkloadChart({
  data,
  type = 'bar',
  className = '',
}: WorkloadChartProps) {
  const statusColor = getStatusColor(data.status);
  const statusLabel = getStatusLabel(data.status);

  // 内訳データに色を割り当て
  const breakdownWithColors = data.breakdown?.map((item, index) => ({
    ...item,
    color: item.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length],
  })) || [];

  // 合計分数（内訳がある場合）
  const totalBreakdownMinutes = breakdownWithColors.reduce(
    (sum, item) => sum + item.minutes,
    0
  ) || data.dailyMinutes;

  return (
    <div className={`p-4 bg-card border border-border rounded-lg shadow-sm ${className}`}>
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-foreground">ワークロード</h3>
        <span className={`text-sm font-medium ${statusColor}`}>{statusLabel}</span>
      </div>

      {/* サマリー */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="text-center p-3 bg-muted rounded-md">
          <div className="text-2xl font-bold text-foreground">{formatMinutes(data.dailyMinutes)}</div>
          <div className="text-xs text-muted-foreground">1日あたり</div>
        </div>
        <div className="text-center p-3 bg-muted rounded-md">
          <div className="text-2xl font-bold text-foreground">{formatMinutes(data.weeklyMinutes)}</div>
          <div className="text-xs text-muted-foreground">1週間あたり</div>
        </div>
      </div>

      {/* 習慣数 */}
      <div className="flex justify-between text-sm mb-4 px-1">
        <span className="text-muted-foreground">アクティブな習慣</span>
        <span className="text-foreground font-medium">{data.activeHabits} / {data.totalHabits}</span>
      </div>

      {/* 内訳チャート */}
      {breakdownWithColors.length > 0 && (
        <div className="pt-4 border-t border-border">
          <h4 className="text-sm font-medium text-foreground mb-3">内訳</h4>
          {type === 'bar' ? (
            <BarChart breakdown={breakdownWithColors} total={totalBreakdownMinutes} />
          ) : (
            <DonutChart breakdown={breakdownWithColors} total={totalBreakdownMinutes} />
          )}
        </div>
      )}
    </div>
  );
}

export default WorkloadChart;
