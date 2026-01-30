'use client';

/**
 * Section.LevelProgress Component
 * 
 * 次のティアまでのプログレスバーと残りXP表示
 * 
 * Features:
 * - 現在のレベルとティア表示
 * - 次のティアまでのプログレスバー
 * - 残りXP表示
 * - ティア別カラー
 * 
 * @module Section.LevelProgress
 * 
 * Validates: Requirements 8.2, 8.3 (level-system-rebalancing)
 */

import React from 'react';
import { calculateTier, getTierColors, type LevelTier } from './LevelBadge';

export interface LevelProgressProps {
  /** 現在のレベル */
  level: number;
  /** 現在の経験値 */
  experiencePoints: number;
  /** 追加のCSSクラス */
  className?: string;
  /** コンパクト表示 */
  compact?: boolean;
}

/**
 * ティア境界（v2.0）
 */
const TIER_BOUNDARIES = {
  beginner: { min: 0, max: 49 },
  intermediate: { min: 50, max: 99 },
  advanced: { min: 100, max: 499 },
  expert: { min: 500, max: 9999 },
};

/**
 * レベルから必要なXPを計算（逆算）
 * 
 * 計算式: level = min(9999, floor(5 * log2(xp/1000 + 1)))
 * 逆算: xp = 1000 * (2^(level/5) - 1)
 */
function calculateXPForLevel(level: number): number {
  if (level <= 0) return 0;
  return Math.floor(1000 * (Math.pow(2, level / 5) - 1));
}

/**
 * 次のティアの最小レベルを取得
 */
function getNextTierMinLevel(currentTier: LevelTier): number | null {
  switch (currentTier) {
    case 'beginner':
      return TIER_BOUNDARIES.intermediate.min;
    case 'intermediate':
      return TIER_BOUNDARIES.advanced.min;
    case 'advanced':
      return TIER_BOUNDARIES.expert.min;
    case 'expert':
      return null; // 最高ティア
  }
}

/**
 * 次のティア名を取得
 */
function getNextTierName(currentTier: LevelTier): string | null {
  switch (currentTier) {
    case 'beginner':
      return '中級';
    case 'intermediate':
      return '上級';
    case 'advanced':
      return '達人';
    case 'expert':
      return null;
  }
}

/**
 * Section.LevelProgress コンポーネント
 */
export default function SectionLevelProgress({
  level,
  experiencePoints,
  className = '',
  compact = false,
}: LevelProgressProps) {
  const tier = calculateTier(level);
  const colors = getTierColors(tier);
  const nextTierMinLevel = getNextTierMinLevel(tier);
  const nextTierName = getNextTierName(tier);

  // 現在のティア内での進捗を計算
  const tierBoundary = TIER_BOUNDARIES[tier];
  const tierRange = tierBoundary.max - tierBoundary.min + 1;
  const levelInTier = level - tierBoundary.min;
  const tierProgress = Math.min(100, (levelInTier / tierRange) * 100);

  // 次のティアまでの残りXP
  const currentXP = experiencePoints;
  const nextTierXP = nextTierMinLevel ? calculateXPForLevel(nextTierMinLevel) : null;
  const remainingXP = nextTierXP ? Math.max(0, nextTierXP - currentXP) : 0;

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className={`text-sm font-medium ${colors.text}`}>
          Lv. {level.toLocaleString()}
        </div>
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full ${colors.bg.replace('/20', '')} transition-all duration-300`}
            style={{ width: `${tierProgress}%` }}
          />
        </div>
        {nextTierName && (
          <div className="text-xs text-muted-foreground">
            → {nextTierName}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`p-4 bg-card border border-border rounded-lg ${className}`}>
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`text-lg font-bold ${colors.text}`}>
            Lv. {level.toLocaleString()}
          </span>
          <span className={`px-2 py-0.5 text-xs rounded-full ${colors.bg} ${colors.text}`}>
            {colors.labelJa}
          </span>
        </div>
        {nextTierName && (
          <div className="text-sm text-muted-foreground">
            次: {nextTierName}
          </div>
        )}
      </div>

      {/* プログレスバー */}
      <div className="mb-2">
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r ${getGradientColors(tier)} transition-all duration-500 ease-out`}
            style={{ width: `${tierProgress}%` }}
          />
        </div>
      </div>

      {/* 詳細情報 */}
      <div className="flex items-center justify-between text-sm">
        <div className="text-muted-foreground">
          現在: {currentXP.toLocaleString()} XP
        </div>
        {nextTierXP && remainingXP > 0 ? (
          <div className="text-muted-foreground">
            あと <span className="font-medium text-foreground">{remainingXP.toLocaleString()}</span> XP
          </div>
        ) : tier === 'expert' ? (
          <div className={`font-medium ${colors.text}`}>
            最高ティア達成！
          </div>
        ) : null}
      </div>

      {/* ティアマイルストーン */}
      {!compact && (
        <div className="mt-4 pt-3 border-t border-border">
          <div className="text-xs text-muted-foreground mb-2">ティアマイルストーン</div>
          <div className="flex items-center gap-1">
            {Object.entries(TIER_BOUNDARIES).map(([tierKey, bounds]) => {
              const tierColors = getTierColors(tierKey as LevelTier);
              const isCurrentTier = tierKey === tier;
              const isPastTier = level > bounds.max;
              
              return (
                <div
                  key={tierKey}
                  className={`
                    flex-1 h-1.5 rounded-full
                    ${isPastTier || isCurrentTier ? tierColors.bg.replace('/20', '') : 'bg-muted'}
                    ${isCurrentTier ? 'ring-2 ring-offset-1 ring-offset-card ' + tierColors.border : ''}
                  `}
                  title={`${tierColors.labelJa}: Lv.${bounds.min}-${bounds.max}`}
                />
              );
            })}
          </div>
          <div className="flex justify-between mt-1 text-xs text-muted-foreground">
            <span>0</span>
            <span>50</span>
            <span>100</span>
            <span>500</span>
            <span>9999</span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * ティア別グラデーションカラーを取得
 */
function getGradientColors(tier: LevelTier): string {
  switch (tier) {
    case 'beginner':
      return 'from-green-400 to-green-600';
    case 'intermediate':
      return 'from-blue-400 to-blue-600';
    case 'advanced':
      return 'from-orange-400 to-orange-600';
    case 'expert':
      return 'from-red-400 to-red-600';
  }
}

/**
 * コンパクト版プログレスバー
 */
export function LevelProgressCompact({
  level,
  experiencePoints,
  className = '',
}: Omit<LevelProgressProps, 'compact'>) {
  return (
    <SectionLevelProgress
      level={level}
      experiencePoints={experiencePoints}
      className={className}
      compact
    />
  );
}
