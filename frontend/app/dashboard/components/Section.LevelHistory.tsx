"use client";

/**
 * Section.LevelHistory Component
 * 
 * Displays a vertical timeline of level changes for a habit or goal.
 * Features:
 * - Date, old→new level, delta, reason
 * - Expandable workload changes
 * - Filter controls (date range, change type)
 * - Export to CSV button
 * - Empty state message
 * 
 * @module Section.LevelHistory
 * 
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 14.7
 */

import React, { useState, useMemo } from 'react';
import LevelBadge, { calculateTier, getTierColors } from './LevelBadge';

// Workload changes interface
export interface WorkloadChanges {
  workloadPerCount?: { old: number; new: number; changePercent: number };
  frequency?: { old: string; new: string };
  duration?: { old: number; new: number };
  targetCount?: { old: number; new: number };
  complexity?: { old: string; new: string };
}

// Level change entry interface
export interface LevelChange {
  id: string;
  entityType: 'habit' | 'goal';
  entityId: string;
  oldLevel: number | null;
  newLevel: number;
  reason: string;
  workloadDelta?: WorkloadChanges;
  assessedAt: string;
  createdAt: string;
}

// Filter options
export type DateRangeFilter = 'all' | '7days' | '30days' | '90days';
export type ChangeTypeFilter = 'all' | 'level_up' | 'level_down' | 're_assessment' | 'initial_assessment';

export interface LevelHistoryProps {
  /** Array of level changes */
  changes: LevelChange[];
  /** Entity name (habit or goal name) */
  entityName?: string;
  /** Loading state */
  loading?: boolean;
  /** Callback when export is requested */
  onExport?: () => void;
}

// Reason labels (Japanese)
const reasonLabels: Record<string, string> = {
  initial_assessment: '初回評価',
  re_assessment: '再評価',
  level_up_progression: 'レベルアップ',
  level_down_baby_step_lv50: 'ベビーステップ (Lv.50)',
  level_down_baby_step_lv10: 'ベビーステップ (Lv.10)',
  manual_adjustment: '手動調整',
};

// Reason icons
const reasonIcons: Record<string, string> = {
  initial_assessment: '🎯',
  re_assessment: '🔄',
  level_up_progression: '⬆️',
  level_down_baby_step_lv50: '👶',
  level_down_baby_step_lv10: '🍼',
  manual_adjustment: '✏️',
};

/**
 * Format date for display
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Format time for display
 */
function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Calculate delta between levels
 */
function calculateDelta(oldLevel: number | null, newLevel: number): number {
  if (oldLevel === null) return newLevel;
  return newLevel - oldLevel;
}

/**
 * Get change type from reason
 */
function getChangeType(reason: string): ChangeTypeFilter {
  if (reason === 'initial_assessment') return 'initial_assessment';
  if (reason === 're_assessment') return 're_assessment';
  if (reason.includes('level_up')) return 'level_up';
  if (reason.includes('level_down') || reason.includes('baby_step')) return 'level_down';
  return 'all';
}

/**
 * Filter changes by date range
 */
function filterByDateRange(changes: LevelChange[], range: DateRangeFilter): LevelChange[] {
  if (range === 'all') return changes;
  
  const now = new Date();
  const days = range === '7days' ? 7 : range === '30days' ? 30 : 90;
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  
  return changes.filter(c => new Date(c.assessedAt) >= cutoff);
}

/**
 * Filter changes by type
 */
function filterByType(changes: LevelChange[], type: ChangeTypeFilter): LevelChange[] {
  if (type === 'all') return changes;
  return changes.filter(c => getChangeType(c.reason) === type);
}

/**
 * Workload changes display component
 */
function WorkloadChangesDisplay({ changes }: { changes: WorkloadChanges }) {
  const entries = Object.entries(changes).filter(([_, v]) => v !== undefined);
  
  if (entries.length === 0) return null;

  return (
    <div className="mt-2 space-y-1 text-xs">
      {changes.frequency && (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">頻度:</span>
          <span className="line-through text-muted-foreground">{changes.frequency.old}</span>
          <span>→</span>
          <span className="font-medium">{changes.frequency.new}</span>
        </div>
      )}
      {changes.duration && (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">時間:</span>
          <span className="line-through text-muted-foreground">{changes.duration.old}分</span>
          <span>→</span>
          <span className="font-medium">{changes.duration.new}分</span>
        </div>
      )}
      {changes.workloadPerCount && (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">1回あたり:</span>
          <span className="line-through text-muted-foreground">{changes.workloadPerCount.old}</span>
          <span>→</span>
          <span className="font-medium">{changes.workloadPerCount.new}</span>
          <span className={`${changes.workloadPerCount.changePercent > 0 ? 'text-green-600' : 'text-red-600'}`}>
            ({changes.workloadPerCount.changePercent > 0 ? '+' : ''}{changes.workloadPerCount.changePercent}%)
          </span>
        </div>
      )}
      {changes.targetCount && (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">目標回数:</span>
          <span className="line-through text-muted-foreground">{changes.targetCount.old}</span>
          <span>→</span>
          <span className="font-medium">{changes.targetCount.new}</span>
        </div>
      )}
      {changes.complexity && (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">複雑さ:</span>
          <span className="line-through text-muted-foreground">{changes.complexity.old}</span>
          <span>→</span>
          <span className="font-medium">{changes.complexity.new}</span>
        </div>
      )}
    </div>
  );
}

/**
 * Timeline entry component
 */
function TimelineEntry({ 
  change, 
  isFirst,
  isLast,
}: { 
  change: LevelChange;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const delta = calculateDelta(change.oldLevel, change.newLevel);
  const hasWorkloadChanges = change.workloadDelta && Object.keys(change.workloadDelta).length > 0;
  const newTier = calculateTier(change.newLevel);
  const tierColors = getTierColors(newTier);
  
  return (
    <div className="relative flex gap-4">
      {/* Timeline line */}
      <div className="flex flex-col items-center">
        {/* Dot */}
        <div className={`w-3 h-3 rounded-full ${tierColors.bg} border-2 ${tierColors.border} z-10`} />
        {/* Line */}
        {!isLast && (
          <div className="w-0.5 flex-1 bg-border" />
        )}
      </div>

      {/* Content */}
      <div className={`flex-1 pb-6 ${isLast ? 'pb-0' : ''}`}>
        {/* Card */}
        <div className="bg-card border border-border rounded-lg p-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <div className="text-sm font-medium">
                {reasonIcons[change.reason] || '📊'} {reasonLabels[change.reason] || change.reason}
              </div>
              <div className="text-xs text-muted-foreground">
                {formatDate(change.assessedAt)} {formatTime(change.assessedAt)}
              </div>
            </div>
            
            {/* Delta badge */}
            <div className={`
              px-2 py-1 rounded text-sm font-medium
              ${delta > 0 
                ? 'bg-green-500/20 text-green-700 dark:text-green-400' 
                : delta < 0 
                  ? 'bg-red-500/20 text-red-700 dark:text-red-400'
                  : 'bg-muted text-muted-foreground'
              }
            `}>
              {delta > 0 ? `+${delta}` : delta === 0 ? '±0' : delta}
            </div>
          </div>

          {/* Level change */}
          <div className="flex items-center gap-2 text-sm">
            {change.oldLevel !== null ? (
              <>
                <LevelBadge level={change.oldLevel} size="sm" compact />
                <span className="text-muted-foreground">→</span>
              </>
            ) : (
              <span className="text-muted-foreground text-xs mr-2">新規</span>
            )}
            <LevelBadge level={change.newLevel} size="sm" />
          </div>

          {/* Expandable workload changes */}
          {hasWorkloadChanges && (
            <>
              <button
                onClick={() => setExpanded(!expanded)}
                className="mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                <span>{expanded ? '▼' : '▶'}</span>
                <span>ワークロード変更を{expanded ? '隠す' : '表示'}</span>
              </button>
              {expanded && change.workloadDelta && (
                <WorkloadChangesDisplay changes={change.workloadDelta} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Export to CSV function
 */
function exportToCSV(changes: LevelChange[], entityName?: string): void {
  const headers = ['date', 'old_level', 'new_level', 'delta', 'reason', 'workload_changes_json'];
  const rows = changes.map(c => {
    const delta = calculateDelta(c.oldLevel, c.newLevel);
    return [
      new Date(c.assessedAt).toISOString(),
      c.oldLevel?.toString() ?? '',
      c.newLevel.toString(),
      delta.toString(),
      c.reason,
      c.workloadDelta ? JSON.stringify(c.workloadDelta) : '',
    ];
  });

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `level_history_${entityName || 'export'}_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Section.LevelHistory component
 */
export default function LevelHistory({
  changes,
  entityName,
  loading = false,
  onExport,
}: LevelHistoryProps) {
  const [dateRange, setDateRange] = useState<DateRangeFilter>('all');
  const [changeType, setChangeType] = useState<ChangeTypeFilter>('all');

  // Filter and sort changes
  const filteredChanges = useMemo(() => {
    let result = [...changes];
    result = filterByDateRange(result, dateRange);
    result = filterByType(result, changeType);
    // Sort by assessedAt DESC (most recent first)
    result.sort((a, b) => new Date(b.assessedAt).getTime() - new Date(a.assessedAt).getTime());
    return result;
  }, [changes, dateRange, changeType]);

  const handleExport = () => {
    if (onExport) {
      onExport();
    } else {
      exportToCSV(filteredChanges, entityName);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-muted rounded animate-pulse" />
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-4">
              <div className="w-3 h-3 bg-muted rounded-full" />
              <div className="flex-1 h-24 bg-muted rounded-lg animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h3 className="text-lg font-semibold">レベル履歴</h3>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* Date range filter */}
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as DateRangeFilter)}
            className="text-sm bg-input border border-border rounded-md px-3 py-2 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">全期間</option>
            <option value="7days">過去7日</option>
            <option value="30days">過去30日</option>
            <option value="90days">過去90日</option>
          </select>

          {/* Change type filter */}
          <select
            value={changeType}
            onChange={(e) => setChangeType(e.target.value as ChangeTypeFilter)}
            className="text-sm bg-input border border-border rounded-md px-3 py-2 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">すべての変更</option>
            <option value="initial_assessment">初回評価</option>
            <option value="re_assessment">再評価</option>
            <option value="level_up">レベルアップ</option>
            <option value="level_down">レベルダウン</option>
          </select>

          {/* Export button */}
          <button
            onClick={handleExport}
            className="text-sm bg-muted hover:bg-muted/80 border border-border rounded-md px-3 py-2 min-h-[44px] transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span className="hidden sm:inline">CSV出力</span>
          </button>
        </div>
      </div>

      {/* Empty state */}
      {filteredChanges.length === 0 && (
        <div className="bg-muted/50 rounded-lg p-8 text-center">
          <div className="text-4xl mb-4">📊</div>
          <div className="text-muted-foreground">
            {changes.length === 0 
              ? 'まだレベル変更の履歴がありません'
              : 'フィルター条件に一致する履歴がありません'
            }
          </div>
          {changes.length > 0 && filteredChanges.length === 0 && (
            <button
              onClick={() => {
                setDateRange('all');
                setChangeType('all');
              }}
              className="mt-4 text-sm text-primary hover:underline"
            >
              フィルターをリセット
            </button>
          )}
        </div>
      )}

      {/* Timeline */}
      {filteredChanges.length > 0 && (
        <div className="pl-1">
          {filteredChanges.map((change, index) => (
            <TimelineEntry
              key={change.id}
              change={change}
              isFirst={index === 0}
              isLast={index === filteredChanges.length - 1}
            />
          ))}
        </div>
      )}

      {/* Summary */}
      {filteredChanges.length > 0 && (
        <div className="text-xs text-muted-foreground text-center pt-2 border-t border-border">
          {filteredChanges.length}件の履歴を表示中
          {filteredChanges.length !== changes.length && ` (全${changes.length}件中)`}
        </div>
      )}
    </div>
  );
}
