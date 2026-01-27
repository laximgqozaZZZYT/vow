"use client";

/**
 * Modal.InventorySummary Component
 * 
 * Summary report modal for completed habit inventory.
 * Shows level distribution histogram, average level, and habits pending data.
 * 
 * @module Modal.InventorySummary
 * 
 * Validates: Requirements 3.4
 */

import React from 'react';

export interface LevelDistribution {
  beginner: number;
  intermediate: number;
  advanced: number;
  expert: number;
}

export interface AssessedHabit {
  id: string;
  name: string;
  level: number | null;
  levelTier: string | null;
}

export interface PendingDataHabit {
  id: string;
  name: string;
}

export interface InventorySummaryData {
  totalAssessed: number;
  pendingData: number;
  distribution: LevelDistribution;
  averageLevel: number;
  assessedHabits: AssessedHabit[];
  pendingDataHabits: PendingDataHabit[];
}

export interface InventorySummaryModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Summary data */
  summary: InventorySummaryData | null;
  /** Loading state */
  loading?: boolean;
}

/**
 * Get tier color class
 */
function getTierColor(tier: string): string {
  switch (tier) {
    case 'beginner':
      return 'bg-success';
    case 'intermediate':
      return 'bg-primary';
    case 'advanced':
      return 'bg-warning';
    case 'expert':
      return 'bg-destructive';
    default:
      return 'bg-muted';
  }
}

/**
 * Get tier label in Japanese
 */
function getTierLabel(tier: string): string {
  switch (tier) {
    case 'beginner':
      return '初級';
    case 'intermediate':
      return '中級';
    case 'advanced':
      return '上級';
    case 'expert':
      return 'エキスパート';
    default:
      return tier;
  }
}

/**
 * Modal.InventorySummary component
 */
export default function InventorySummaryModal({
  isOpen,
  onClose,
  summary,
  loading = false,
}: InventorySummaryModalProps) {
  if (!isOpen) return null;

  // Calculate max for histogram scaling
  const maxCount = summary ? Math.max(
    summary.distribution.beginner,
    summary.distribution.intermediate,
    summary.distribution.advanced,
    summary.distribution.expert,
    1
  ) : 1;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto p-6 bg-card rounded-xl shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold">評価完了</h2>
              <p className="text-sm text-muted-foreground">
                習慣インベントリの結果
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted/50 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <svg className="w-8 h-8 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        ) : summary ? (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="p-3 bg-muted/50 rounded-lg text-center">
                <div className="text-2xl font-bold text-primary">{summary.totalAssessed}</div>
                <div className="text-xs text-muted-foreground">評価完了</div>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg text-center">
                <div className="text-2xl font-bold">Lv.{summary.averageLevel}</div>
                <div className="text-xs text-muted-foreground">平均レベル</div>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg text-center">
                <div className={`text-2xl font-bold ${summary.pendingData > 0 ? 'text-warning' : 'text-success'}`}>
                  {summary.pendingData}
                </div>
                <div className="text-xs text-muted-foreground">データ不足</div>
              </div>
            </div>

            {/* Level Distribution Histogram */}
            <div className="mb-6">
              <h3 className="text-sm font-medium mb-3">レベル分布</h3>
              <div className="space-y-2">
                {(['beginner', 'intermediate', 'advanced', 'expert'] as const).map((tier) => {
                  const count = summary.distribution[tier];
                  const percentage = (count / maxCount) * 100;
                  
                  return (
                    <div key={tier} className="flex items-center gap-3">
                      <div className="w-20 text-xs text-muted-foreground">
                        {getTierLabel(tier)}
                      </div>
                      <div className="flex-1 h-6 bg-muted/30 rounded overflow-hidden">
                        <div
                          className={`h-full ${getTierColor(tier)} transition-all duration-500`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <div className="w-8 text-sm font-medium text-right">
                        {count}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Assessed Habits List */}
            {summary.assessedHabits.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium mb-3">評価された習慣</h3>
                <div className="max-h-40 overflow-y-auto border border-border rounded-lg">
                  {summary.assessedHabits.map((habit) => (
                    <div
                      key={habit.id}
                      className="flex items-center justify-between p-3 border-b border-border last:border-b-0"
                    >
                      <span className="text-sm truncate flex-1 mr-2">{habit.name}</span>
                      {habit.level !== null && habit.levelTier && (
                        <span className={`
                          text-xs px-2 py-0.5 rounded-full
                          ${habit.levelTier === 'beginner' ? 'bg-success/10 text-success' : ''}
                          ${habit.levelTier === 'intermediate' ? 'bg-primary/10 text-primary' : ''}
                          ${habit.levelTier === 'advanced' ? 'bg-warning/10 text-warning' : ''}
                          ${habit.levelTier === 'expert' ? 'bg-destructive/10 text-destructive' : ''}
                        `}>
                          Lv.{habit.level}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pending Data Habits */}
            {summary.pendingDataHabits.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  データ不足の習慣
                </h3>
                <p className="text-xs text-muted-foreground mb-2">
                  これらの習慣は詳細な評価が必要です。個別に評価してください。
                </p>
                <div className="max-h-32 overflow-y-auto border border-warning/20 bg-warning/5 rounded-lg">
                  {summary.pendingDataHabits.map((habit) => (
                    <div
                      key={habit.id}
                      className="flex items-center gap-2 p-3 border-b border-warning/10 last:border-b-0"
                    >
                      <svg className="w-4 h-4 text-warning flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm truncate">{habit.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            データがありません
          </div>
        )}

        {/* Close Button */}
        <button
          onClick={onClose}
          className="
            w-full px-4 py-2.5
            bg-primary text-primary-foreground
            rounded-lg shadow-sm
            hover:opacity-90
            focus-visible:outline-2 focus-visible:outline-primary
            transition-opacity
          "
        >
          閉じる
        </button>
      </div>
    </div>
  );
}
