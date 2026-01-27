"use client";

/**
 * Widget.QuotaStatus Component
 * 
 * Displays remaining THLI-24 assessments for the user.
 * - Shows "X/10 remaining" for free users
 * - Shows "無制限" for premium users
 * - Link to upgrade page
 * 
 * @module Widget.QuotaStatus
 * 
 * Validates: Requirements 7.7
 */

import React from 'react';
import Link from 'next/link';

export interface QuotaStatus {
  /** Number of assessments used this period */
  quotaUsed: number;
  /** Quota limit (-1 for unlimited/premium) */
  quotaLimit: number;
  /** Remaining assessments */
  remaining: number;
  /** Period start date */
  periodStart: string;
  /** Period end date */
  periodEnd: string;
  /** Whether user has unlimited quota (premium) */
  isUnlimited: boolean;
}

export interface QuotaStatusWidgetProps {
  /** Quota status data */
  quota: QuotaStatus | null;
  /** Loading state */
  loading?: boolean;
  /** Compact display mode */
  compact?: boolean;
  /** Callback when upgrade is clicked */
  onUpgradeClick?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Format date for display
 */
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ja-JP', {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Get status color based on remaining quota
 */
function getStatusColor(remaining: number, limit: number): string {
  if (limit === -1) return 'text-primary'; // Unlimited
  const percentUsed = ((limit - remaining) / limit) * 100;
  if (percentUsed >= 90) return 'text-red-500';
  if (percentUsed >= 70) return 'text-yellow-500';
  return 'text-green-500';
}

/**
 * Get progress bar color
 */
function getProgressColor(remaining: number, limit: number): string {
  if (limit === -1) return 'bg-primary'; // Unlimited
  const percentUsed = ((limit - remaining) / limit) * 100;
  if (percentUsed >= 90) return 'bg-red-500';
  if (percentUsed >= 70) return 'bg-yellow-500';
  return 'bg-primary';
}

/**
 * Compact quota display (for inline use)
 */
export function QuotaStatusCompact({
  quota,
  loading = false,
  className = '',
}: Pick<QuotaStatusWidgetProps, 'quota' | 'loading' | 'className'>) {
  if (loading) {
    return (
      <span className={`inline-flex items-center gap-1 text-sm ${className}`}>
        <span className="w-16 h-4 bg-muted rounded animate-pulse" />
      </span>
    );
  }

  if (!quota) {
    return (
      <span className={`text-sm text-muted-foreground ${className}`}>
        —
      </span>
    );
  }

  if (quota.isUnlimited) {
    return (
      <span className={`inline-flex items-center gap-1 text-sm text-primary ${className}`}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
        <span>無制限</span>
      </span>
    );
  }

  const statusColor = getStatusColor(quota.remaining, quota.quotaLimit);

  return (
    <span className={`inline-flex items-center gap-1 text-sm ${statusColor} ${className}`}>
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
      <span>残り {quota.remaining}/{quota.quotaLimit} 回</span>
    </span>
  );
}

/**
 * Widget.QuotaStatus component
 */
export default function QuotaStatusWidget({
  quota,
  loading = false,
  compact = false,
  onUpgradeClick,
  className = '',
}: QuotaStatusWidgetProps) {
  // Compact mode
  if (compact) {
    return <QuotaStatusCompact quota={quota} loading={loading} className={className} />;
  }

  // Loading state
  if (loading) {
    return (
      <div className={`bg-card border border-border rounded-lg p-4 ${className}`}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-5 h-5 bg-muted rounded animate-pulse" />
          <div className="h-5 w-32 bg-muted rounded animate-pulse" />
        </div>
        <div className="space-y-2">
          <div className="h-2 bg-muted rounded-full" />
          <div className="h-4 w-24 bg-muted rounded animate-pulse" />
        </div>
      </div>
    );
  }

  // No quota data
  if (!quota) {
    return (
      <div className={`bg-card border border-border rounded-lg p-4 ${className}`}>
        <div className="flex items-center gap-2 mb-3">
          <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h3 className="font-medium">THLI-24 評価</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          データを読み込めませんでした
        </p>
      </div>
    );
  }

  // Premium/unlimited user
  if (quota.isUnlimited) {
    return (
      <div className={`bg-card border border-border rounded-lg p-4 ${className}`}>
        <div className="flex items-center gap-2 mb-3">
          <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
          <h3 className="font-medium">THLI-24 評価</h3>
        </div>
        
        <div className="flex items-center gap-2 text-primary">
          <span className="text-2xl font-bold">無制限</span>
          <span className="text-xs bg-primary/10 px-2 py-1 rounded">Premium</span>
        </div>
        
        <p className="text-sm text-muted-foreground mt-2">
          プレミアムプランでは無制限に習慣レベルを評価できます
        </p>
      </div>
    );
  }

  // Free user with quota
  const percentUsed = (quota.quotaUsed / quota.quotaLimit) * 100;
  const statusColor = getStatusColor(quota.remaining, quota.quotaLimit);
  const progressColor = getProgressColor(quota.remaining, quota.quotaLimit);

  return (
    <div className={`bg-card border border-border rounded-lg p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h3 className="font-medium">THLI-24 評価</h3>
        </div>
        <span className={`text-sm font-medium ${statusColor}`}>
          {Math.round(percentUsed)}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${progressColor}`}
            style={{ width: `${Math.min(percentUsed, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>{quota.quotaUsed} 使用</span>
          <span>{quota.quotaLimit} 上限</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
        <div className="bg-muted/50 rounded p-2">
          <div className="text-muted-foreground text-xs">残り回数</div>
          <div className={`font-medium ${statusColor}`}>{quota.remaining} 回</div>
        </div>
        <div className="bg-muted/50 rounded p-2">
          <div className="text-muted-foreground text-xs">リセット日</div>
          <div className="font-medium">{formatDate(quota.periodEnd)}</div>
        </div>
      </div>

      {/* Warning messages */}
      {percentUsed >= 90 && (
        <div className="mb-3 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-700 dark:text-red-300">
          評価回数が残りわずかです。
          <Link href="/settings/subscription" className="underline ml-1" onClick={onUpgradeClick}>
            プランをアップグレード
          </Link>
        </div>
      )}
      {percentUsed >= 70 && percentUsed < 90 && (
        <div className="mb-3 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-xs text-yellow-700 dark:text-yellow-300">
          評価回数の70%を使用しました。
        </div>
      )}

      {/* Upgrade link */}
      <div className="pt-3 border-t border-border">
        <Link
          href="/settings/subscription"
          onClick={onUpgradeClick}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
        >
          <span>無制限プランを見る</span>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  );
}

/**
 * Inline quota indicator for use in buttons/forms
 */
export function QuotaIndicator({
  quota,
  loading = false,
}: Pick<QuotaStatusWidgetProps, 'quota' | 'loading'>) {
  if (loading) {
    return <span className="text-xs text-muted-foreground">(読込中...)</span>;
  }

  if (!quota) {
    return null;
  }

  if (quota.isUnlimited) {
    return <span className="text-xs text-primary">(無制限)</span>;
  }

  const statusColor = getStatusColor(quota.remaining, quota.quotaLimit);

  return (
    <span className={`text-xs ${statusColor}`}>
      (残り {quota.remaining}/{quota.quotaLimit} 回)
    </span>
  );
}
