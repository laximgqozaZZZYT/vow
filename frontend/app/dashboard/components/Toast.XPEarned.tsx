"use client";

/**
 * Toast.XPEarned Component
 * 
 * Displays XP earned notification with multiplier information.
 * Shows completion rate, applied multiplier, and behavioral science rationale.
 * Color-coded based on multiplier tier.
 * 
 * @module Toast.XPEarned
 * 
 * Validates: Requirements 6.1, 6.2, 6.3
 */

import React, { useEffect, useState } from 'react';

export type XPMultiplierTier = 
  | 'minimal'      // 0-49%: 0.3x
  | 'partial'      // 50-79%: 0.6x
  | 'near'         // 80-99%: 0.8x
  | 'optimal'      // 100-120%: 1.0x
  | 'mild_over'    // 121-150%: 0.9x
  | 'over';        // 151%+: 0.7x

export interface XPEarnedToastProps {
  /** Base XP before multiplier */
  baseXP: number;
  /** Final XP after multiplier */
  finalXP: number;
  /** Applied multiplier (0.3-1.0) */
  multiplier: number;
  /** Multiplier tier */
  tier: XPMultiplierTier;
  /** Completion rate percentage */
  completionRate: number;
  /** Habit name */
  habitName: string;
  /** Auto-dismiss duration in ms (0 = no auto-dismiss) */
  duration?: number;
  /** Callback when toast is dismissed */
  onDismiss?: () => void;
}

/**
 * Get tier-specific colors for the toast
 */
function getTierColors(tier: XPMultiplierTier): {
  bg: string;
  border: string;
  text: string;
  accent: string;
  icon: string;
} {
  switch (tier) {
    case 'optimal':
      return {
        bg: 'bg-green-500/10',
        border: 'border-green-500/30',
        text: 'text-green-700 dark:text-green-400',
        accent: 'text-green-600 dark:text-green-300',
        icon: '🎯',
      };
    case 'near':
      return {
        bg: 'bg-blue-500/10',
        border: 'border-blue-500/30',
        text: 'text-blue-700 dark:text-blue-400',
        accent: 'text-blue-600 dark:text-blue-300',
        icon: '👍',
      };
    case 'mild_over':
      return {
        bg: 'bg-yellow-500/10',
        border: 'border-yellow-500/30',
        text: 'text-yellow-700 dark:text-yellow-400',
        accent: 'text-yellow-600 dark:text-yellow-300',
        icon: '⚡',
      };
    case 'partial':
      return {
        bg: 'bg-orange-500/10',
        border: 'border-orange-500/30',
        text: 'text-orange-700 dark:text-orange-400',
        accent: 'text-orange-600 dark:text-orange-300',
        icon: '💪',
      };
    case 'over':
      return {
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/30',
        text: 'text-amber-700 dark:text-amber-400',
        accent: 'text-amber-600 dark:text-amber-300',
        icon: '🔥',
      };
    case 'minimal':
    default:
      return {
        bg: 'bg-gray-500/10',
        border: 'border-gray-500/30',
        text: 'text-gray-700 dark:text-gray-400',
        accent: 'text-gray-600 dark:text-gray-300',
        icon: '🌱',
      };
  }
}

/**
 * Get localized rationale message
 */
function getRationale(tier: XPMultiplierTier): string {
  switch (tier) {
    case 'optimal':
      return '計画通りの達成！最大XPを獲得';
    case 'near':
      return 'もう少しで達成！継続が大切';
    case 'mild_over':
      return '頑張りすぎ注意。持続可能なペースで';
    case 'partial':
      return '部分的な達成も価値がある';
    case 'over':
      return '燃え尽き防止のため、計画を見直そう';
    case 'minimal':
    default:
      return '小さな一歩も前進。続けることが大切';
  }
}

/**
 * XP Earned Toast Component
 */
export default function XPEarnedToast({
  baseXP,
  finalXP,
  multiplier,
  tier,
  completionRate,
  habitName,
  duration = 4000,
  onDismiss,
}: XPEarnedToastProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);
  const colors = getTierColors(tier);
  const rationale = getRationale(tier);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      onDismiss?.();
    }, 300);
  };

  if (!isVisible) return null;

  return (
    <div
      className={`
        fixed bottom-4 right-4 z-50
        w-80 max-w-[calc(100vw-2rem)]
        rounded-xl border shadow-lg
        ${colors.bg} ${colors.border}
        transition-all duration-300 ease-out
        ${isExiting ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}
      `}
      role="alert"
      aria-live="polite"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border/30">
        <div className="flex items-center gap-2">
          <span className="text-xl">{colors.icon}</span>
          <span className={`font-semibold ${colors.text}`}>XP獲得!</span>
        </div>
        <button
          onClick={handleDismiss}
          className="text-muted-foreground hover:text-foreground p-1 min-w-[32px] min-h-[32px] flex items-center justify-center transition-colors"
          aria-label="閉じる"
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div className="p-3 space-y-2">
        {/* Habit name */}
        <div className="text-sm text-muted-foreground truncate">
          {habitName}
        </div>

        {/* XP display */}
        <div className="flex items-baseline gap-2">
          <span className={`text-2xl font-bold ${colors.accent}`}>
            +{finalXP} XP
          </span>
          {multiplier !== 1.0 && (
            <span className="text-sm text-muted-foreground">
              ({baseXP} × {multiplier.toFixed(1)})
            </span>
          )}
        </div>

        {/* Completion rate bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">達成率</span>
            <span className={colors.text}>{completionRate.toFixed(0)}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                tier === 'optimal' ? 'bg-green-500' :
                tier === 'near' ? 'bg-blue-500' :
                tier === 'mild_over' ? 'bg-yellow-500' :
                tier === 'partial' ? 'bg-orange-500' :
                tier === 'over' ? 'bg-amber-500' :
                'bg-gray-500'
              }`}
              style={{ width: `${Math.min(completionRate, 150)}%` }}
            />
          </div>
        </div>

        {/* Rationale */}
        <div className={`text-xs ${colors.text} pt-1`}>
          {rationale}
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to show XP earned toast
 */
export function useXPEarnedToast() {
  const [toastProps, setToastProps] = useState<XPEarnedToastProps | null>(null);

  const showXPToast = (props: Omit<XPEarnedToastProps, 'onDismiss'>) => {
    setToastProps({
      ...props,
      onDismiss: () => setToastProps(null),
    });
  };

  const XPToast = toastProps ? <XPEarnedToast {...toastProps} /> : null;

  return { showXPToast, XPToast };
}
