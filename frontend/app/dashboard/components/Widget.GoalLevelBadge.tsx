"use client";

/**
 * Widget.GoalLevelBadge Component
 * 
 * Displays aggregated level badge for goals based on child habit levels.
 * Calculates MAX(child_habit_levels) and displays with "Goal Level" label.
 * 
 * @module Widget.GoalLevelBadge
 * 
 * Validates: Requirements 8.4
 */

import React, { useMemo } from 'react';
import LevelBadge, { calculateTier, getTierColors, type LevelTier } from './LevelBadge';

export interface HabitWithLevel {
  id: string;
  name: string;
  level: number | null | undefined;
  goalId?: string;
}

export interface GoalLevelBadgeProps {
  /** Goal ID */
  goalId: string;
  /** Child habits with their levels */
  childHabits: HabitWithLevel[];
  /** Click handler for opening details */
  onClick?: () => void;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Show habit count */
  showHabitCount?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Calculate aggregated level from child habits
 * Returns MAX(child_habit_levels) or null if no habits have levels
 */
export function calculateGoalLevel(childHabits: HabitWithLevel[]): number | null {
  const levelsWithValues = childHabits
    .map(h => h.level)
    .filter((level): level is number => level !== null && level !== undefined);
  
  if (levelsWithValues.length === 0) {
    return null;
  }
  
  return Math.max(...levelsWithValues);
}

/**
 * Get level statistics for child habits
 */
export function getHabitLevelStats(childHabits: HabitWithLevel[]): {
  total: number;
  assessed: number;
  unassessed: number;
  maxLevel: number | null;
  avgLevel: number | null;
  tierDistribution: Record<LevelTier, number>;
} {
  const assessed = childHabits.filter(h => h.level !== null && h.level !== undefined);
  const levels = assessed.map(h => h.level as number);
  
  const tierDistribution: Record<LevelTier, number> = {
    beginner: 0,
    intermediate: 0,
    advanced: 0,
    expert: 0,
  };
  
  levels.forEach(level => {
    const tier = calculateTier(level);
    tierDistribution[tier]++;
  });
  
  return {
    total: childHabits.length,
    assessed: assessed.length,
    unassessed: childHabits.length - assessed.length,
    maxLevel: levels.length > 0 ? Math.max(...levels) : null,
    avgLevel: levels.length > 0 ? Math.round(levels.reduce((a, b) => a + b, 0) / levels.length) : null,
    tierDistribution,
  };
}

/**
 * Widget.GoalLevelBadge component
 */
export default function GoalLevelBadge({
  goalId,
  childHabits,
  onClick,
  size = 'md',
  showHabitCount = false,
  className = '',
}: GoalLevelBadgeProps) {
  // Calculate aggregated level
  const aggregatedLevel = useMemo(() => calculateGoalLevel(childHabits), [childHabits]);
  const stats = useMemo(() => getHabitLevelStats(childHabits), [childHabits]);
  
  // If no habits, show nothing
  if (childHabits.length === 0) {
    return null;
  }

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <LevelBadge
        level={aggregatedLevel}
        onClick={onClick}
        size={size}
        isGoal
      />
      
      {/* Habit count indicator */}
      {showHabitCount && (
        <span className="text-xs text-muted-foreground">
          ({stats.assessed}/{stats.total} 習慣)
        </span>
      )}
    </div>
  );
}

/**
 * Positioned goal level badge for goal cards
 */
export function GoalLevelBadgePositioned({
  goalId,
  childHabits,
  onClick,
}: Pick<GoalLevelBadgeProps, 'goalId' | 'childHabits' | 'onClick'>) {
  const aggregatedLevel = useMemo(() => calculateGoalLevel(childHabits), [childHabits]);
  const stats = useMemo(() => getHabitLevelStats(childHabits), [childHabits]);
  
  // If no habits or no assessed habits, show minimal indicator
  if (childHabits.length === 0) {
    return null;
  }

  return (
    <div className="absolute top-2 right-2 z-10">
      <button
        onClick={onClick}
        className={`
          inline-flex items-center gap-1
          px-2 py-1
          rounded-md
          text-xs
          shadow-sm
          transition-opacity
          ${aggregatedLevel !== null 
            ? `${getTierColors(calculateTier(aggregatedLevel)).bg} ${getTierColors(calculateTier(aggregatedLevel)).text} border ${getTierColors(calculateTier(aggregatedLevel)).border}`
            : 'bg-muted text-muted-foreground border border-border'
          }
          ${onClick ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}
        `}
        disabled={!onClick}
      >
        {aggregatedLevel !== null ? (
          <>
            <span className="font-semibold">Lv.{aggregatedLevel}</span>
            <span className="opacity-60 hidden sm:inline">目標</span>
          </>
        ) : (
          <span>未評価</span>
        )}
      </button>
    </div>
  );
}

/**
 * Goal level summary card for detailed view
 */
export function GoalLevelSummary({
  goalId,
  goalName,
  childHabits,
  onViewDetails,
}: {
  goalId: string;
  goalName: string;
  childHabits: HabitWithLevel[];
  onViewDetails?: () => void;
}) {
  const stats = useMemo(() => getHabitLevelStats(childHabits), [childHabits]);
  const aggregatedLevel = stats.maxLevel;
  const tier = aggregatedLevel !== null ? calculateTier(aggregatedLevel) : null;
  const tierColors = tier ? getTierColors(tier) : null;

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium">{goalName}</h4>
        {aggregatedLevel !== null && tier && (
          <LevelBadge level={aggregatedLevel} tier={tier} size="md" isGoal />
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
        <div className="bg-muted/50 rounded p-2">
          <div className="text-xs text-muted-foreground">評価済み習慣</div>
          <div className="font-medium">{stats.assessed}/{stats.total}</div>
        </div>
        <div className="bg-muted/50 rounded p-2">
          <div className="text-xs text-muted-foreground">平均レベル</div>
          <div className="font-medium">{stats.avgLevel ?? '—'}</div>
        </div>
      </div>

      {/* Tier distribution */}
      {stats.assessed > 0 && (
        <div className="mb-3">
          <div className="text-xs text-muted-foreground mb-2">レベル分布</div>
          <div className="flex gap-1">
            {(['beginner', 'intermediate', 'advanced', 'expert'] as LevelTier[]).map(t => {
              const count = stats.tierDistribution[t];
              const colors = getTierColors(t);
              return (
                <div
                  key={t}
                  className={`flex-1 h-2 rounded ${count > 0 ? colors.bg : 'bg-muted'}`}
                  title={`${colors.labelJa}: ${count}件`}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>初級</span>
            <span>達人</span>
          </div>
        </div>
      )}

      {/* Unassessed habits warning */}
      {stats.unassessed > 0 && (
        <div className="text-xs text-muted-foreground bg-yellow-500/10 border border-yellow-500/20 rounded p-2 mb-3">
          {stats.unassessed}件の習慣がまだ評価されていません
        </div>
      )}

      {/* View details button */}
      {onViewDetails && (
        <button
          onClick={onViewDetails}
          className="w-full text-sm text-primary hover:underline text-center py-2"
        >
          詳細を見る →
        </button>
      )}
    </div>
  );
}
