"use client";

/**
 * Widget.InventoryProgress Component
 * 
 * Progress indicator for habit inventory assessment.
 * Shows "習慣評価中... (3/10 完了)" with estimated time remaining.
 * Allows cancellation (saves progress).
 * 
 * @module Widget.InventoryProgress
 * 
 * Validates: Requirements 3.7
 */

import React from 'react';

export interface InventoryProgressProps {
  /** Current progress (number of completed assessments) */
  current: number;
  /** Total number of habits to assess */
  total: number;
  /** Currently assessing habit name */
  currentHabitName?: string;
  /** Whether the inventory is running */
  isRunning: boolean;
  /** Callback when user cancels the inventory */
  onCancel: () => void;
  /** Number of habits pending data (firewall triggered) */
  pendingDataCount?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Format time remaining
 */
function formatTimeRemaining(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}秒`;
  }
  const minutes = Math.ceil(seconds / 60);
  return `約${minutes}分`;
}

/**
 * Widget.InventoryProgress component
 */
export default function InventoryProgress({
  current,
  total,
  currentHabitName,
  isRunning,
  onCancel,
  pendingDataCount = 0,
  className = '',
}: InventoryProgressProps) {
  // Calculate progress percentage
  const progressPercent = total > 0 ? Math.round((current / total) * 100) : 0;

  // Calculate estimated time remaining (2 seconds per habit)
  const remainingHabits = total - current;
  const estimatedSecondsRemaining = remainingHabits * 2;

  // Animation for the progress bar
  const [animatedPercent, setAnimatedPercent] = React.useState(0);
  
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedPercent(progressPercent);
    }, 100);
    return () => clearTimeout(timer);
  }, [progressPercent]);

  if (!isRunning && current === 0) {
    return null;
  }

  return (
    <div className={`bg-card border border-border rounded-lg p-4 shadow-md ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isRunning ? (
            <div className="w-5 h-5 relative">
              <svg className="w-5 h-5 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : (
            <svg className="w-5 h-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          <span className="font-medium">
            {isRunning ? '習慣評価中...' : '評価完了'}
          </span>
        </div>
        
        {isRunning && (
          <button
            onClick={onCancel}
            className="
              text-sm text-muted-foreground hover:text-foreground
              px-2 py-1 rounded
              hover:bg-muted/50
              transition-colors
            "
          >
            キャンセル
          </button>
        )}
      </div>

      {/* Progress Bar */}
      <div className="mb-3">
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${animatedPercent}%` }}
          />
        </div>
      </div>

      {/* Progress Stats */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          <span className="text-foreground font-medium">
            {current}/{total} 完了
          </span>
          {pendingDataCount > 0 && (
            <span className="text-warning">
              {pendingDataCount}件 データ不足
            </span>
          )}
        </div>
        
        {isRunning && remainingHabits > 0 && (
          <span className="text-muted-foreground">
            残り {formatTimeRemaining(estimatedSecondsRemaining)}
          </span>
        )}
      </div>

      {/* Current Habit */}
      {isRunning && currentHabitName && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">評価中:</span>
            <span className="font-medium truncate">{currentHabitName}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Compact version for inline display
 */
export function InventoryProgressCompact({
  current,
  total,
  isRunning,
  className = '',
}: Pick<InventoryProgressProps, 'current' | 'total' | 'isRunning' | 'className'>) {
  const progressPercent = total > 0 ? Math.round((current / total) * 100) : 0;

  if (!isRunning && current === 0) {
    return null;
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {isRunning && (
        <svg className="w-4 h-4 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      <span className="text-sm">
        習慣評価中... ({current}/{total} 完了)
      </span>
      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
}
