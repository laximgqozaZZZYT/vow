"use client";

/**
 * LevelBadge Component
 * 
 * Displays a habit or goal's THLI-24 level with tier-specific colors.
 * 
 * Level Tiers:
 * - Beginner (0-49): Green (bg-success)
 * - Intermediate (50-99): Blue (bg-primary)
 * - Advanced (100-149): Orange (bg-warning)
 * - Expert (150-199): Red (bg-destructive)
 * 
 * Features:
 * - Responsive design (compact on mobile, full on desktop)
 * - "Not Assessed" state for NULL levels
 * - Delta indicator for recent level changes
 * - Click handler support for opening details modal
 * 
 * @module LevelBadge
 * 
 * Validates: Requirements 8.1, 8.2, 8.5, 8.6, 14.1, 14.2, 14.5, 14.6
 */

import React from 'react';

export type LevelTier = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export interface LevelBadgeProps {
  /** The level value (0-199), or null/undefined for unassessed */
  level: number | null | undefined;
  /** Optional tier override (calculated from level if not provided) */
  tier?: LevelTier;
  /** Optional delta to show recent change (e.g., +5 or -10) */
  delta?: number;
  /** Whether to show compact version (mobile) */
  compact?: boolean;
  /** Click handler for opening details modal */
  onClick?: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Whether this is for a goal (shows "Goal Level" label) */
  isGoal?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Calculate the tier from a level value
 */
export function calculateTier(level: number): LevelTier {
  if (level < 50) return 'beginner';
  if (level < 100) return 'intermediate';
  if (level < 150) return 'advanced';
  return 'expert';
}

/**
 * Get tier-specific colors for Tailwind CSS
 */
export function getTierColors(tier: LevelTier): {
  bg: string;
  text: string;
  border: string;
  label: string;
  labelJa: string;
} {
  switch (tier) {
    case 'beginner':
      return {
        bg: 'bg-green-500/20',
        text: 'text-green-700 dark:text-green-400',
        border: 'border-green-500/30',
        label: 'Beginner',
        labelJa: '初級',
      };
    case 'intermediate':
      return {
        bg: 'bg-blue-500/20',
        text: 'text-blue-700 dark:text-blue-400',
        border: 'border-blue-500/30',
        label: 'Intermediate',
        labelJa: '中級',
      };
    case 'advanced':
      return {
        bg: 'bg-orange-500/20',
        text: 'text-orange-700 dark:text-orange-400',
        border: 'border-orange-500/30',
        label: 'Advanced',
        labelJa: '上級',
      };
    case 'expert':
      return {
        bg: 'bg-red-500/20',
        text: 'text-red-700 dark:text-red-400',
        border: 'border-red-500/30',
        label: 'Expert',
        labelJa: '達人',
      };
  }
}

/**
 * LevelBadge component for displaying habit/goal levels
 */
export default function LevelBadge({
  level,
  tier: tierOverride,
  delta,
  compact = false,
  onClick,
  className = '',
  isGoal = false,
  size = 'md',
}: LevelBadgeProps) {
  // Handle unassessed state
  if (level === null || level === undefined) {
    return (
      <button
        onClick={onClick}
        className={`
          inline-flex items-center gap-1.5
          px-2 py-1
          bg-muted
          border border-border
          rounded-md
          text-muted-foreground
          ${size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-base' : 'text-sm'}
          ${onClick ? 'cursor-pointer hover:bg-muted/80 transition-colors' : 'cursor-default'}
          ${className}
        `}
        disabled={!onClick}
        aria-label="Level not assessed"
      >
        <span className="font-semibold">Lv. ???</span>
      </button>
    );
  }

  // Calculate tier from level if not provided
  const tier = tierOverride ?? calculateTier(level);
  const colors = getTierColors(tier);

  // Size-specific classes
  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-xs gap-1',
    md: 'px-2 py-1 text-sm gap-1.5',
    lg: 'px-3 py-1.5 text-base gap-2',
  };

  return (
    <button
      onClick={onClick}
      className={`
        inline-flex items-center
        ${sizeClasses[size]}
        ${colors.bg}
        ${colors.text}
        border ${colors.border}
        rounded-md
        font-medium
        ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : 'cursor-default'}
        focus-visible:outline-2 focus-visible:outline-primary
        ${className}
      `}
      disabled={!onClick}
      aria-label={`Level ${level} (${colors.label})`}
    >
      {/* Level number */}
      <span className={`font-semibold ${size === 'lg' ? 'text-lg' : ''}`}>
        Lv. {level}
      </span>

      {/* Tier label (hidden on compact/mobile) */}
      {!compact && (
        <span className="hidden sm:inline text-xs opacity-80">
          {colors.labelJa}
        </span>
      )}

      {/* Goal indicator */}
      {isGoal && !compact && (
        <span className="hidden md:inline text-xs opacity-60">
          (習慣から)
        </span>
      )}

      {/* Delta indicator for recent changes */}
      {delta !== undefined && delta !== 0 && (
        <span
          className={`
            text-xs font-medium
            ${delta > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}
            animate-pulse
          `}
        >
          {delta > 0 ? `+${delta}` : delta}
        </span>
      )}
    </button>
  );
}

/**
 * Compact version of LevelBadge for use in tight spaces
 */
export function LevelBadgeCompact({
  level,
  onClick,
  className = '',
}: Pick<LevelBadgeProps, 'level' | 'onClick' | 'className'>) {
  return (
    <LevelBadge
      level={level}
      compact
      size="sm"
      onClick={onClick}
      className={className}
    />
  );
}

/**
 * LevelBadge positioned for habit/goal cards (top-right corner)
 */
export function LevelBadgePositioned({
  level,
  delta,
  onClick,
  isGoal = false,
}: Pick<LevelBadgeProps, 'level' | 'delta' | 'onClick' | 'isGoal'>) {
  return (
    <div className="absolute top-2 right-2 z-10">
      <LevelBadge
        level={level}
        delta={delta}
        onClick={onClick}
        isGoal={isGoal}
        size="sm"
        compact
        className="shadow-sm"
      />
    </div>
  );
}
