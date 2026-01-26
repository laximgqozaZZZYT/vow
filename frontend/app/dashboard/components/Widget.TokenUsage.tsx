'use client';

import React from 'react';
import Link from 'next/link';
import type { TokenUsageInfo } from '@/hooks/useSubscription';

interface TokenUsageWidgetProps {
  usage: TokenUsageInfo | null;
  isPremium: boolean;
  loading?: boolean;
  onUpgradeClick?: () => void;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M`;
  }
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(0)}K`;
  }
  return tokens.toString();
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ja-JP', {
    month: 'short',
    day: 'numeric',
  });
}

export default function TokenUsageWidget({
  usage,
  isPremium,
  loading = false,
  onUpgradeClick,
}: TokenUsageWidgetProps) {
  // Non-premium users see upgrade prompt (disabled in production)
  if (!isPremium) {
    return (
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <svg
            className="w-5 h-5 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
          <h3 className="font-medium text-muted-foreground">AI機能</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          AI機能は準備中です。
        </p>
        <span className="inline-flex items-center gap-1 text-sm text-muted-foreground cursor-not-allowed">
          Coming Soon
        </span>
      </div>
    );
  }

  // Loading state
  if (loading || !usage) {
    return (
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-5 h-5 bg-muted rounded animate-pulse" />
          <div className="h-5 w-24 bg-muted rounded animate-pulse" />
        </div>
        <div className="space-y-2">
          <div className="h-2 bg-muted rounded-full" />
          <div className="h-4 w-32 bg-muted rounded animate-pulse" />
        </div>
      </div>
    );
  }

  // Determine status color
  const getStatusColor = () => {
    if (usage.percentageUsed >= 90) return 'text-red-500';
    if (usage.percentageUsed >= 70) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getProgressColor = () => {
    if (usage.percentageUsed >= 90) return 'bg-red-500';
    if (usage.percentageUsed >= 70) return 'bg-yellow-500';
    return 'bg-primary';
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-primary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
          <h3 className="font-medium">トークン使用量</h3>
        </div>
        <span className={`text-sm font-medium ${getStatusColor()}`}>
          {usage.percentageUsed.toFixed(0)}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${getProgressColor()}`}
            style={{ width: `${Math.min(usage.percentageUsed, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>{formatTokens(usage.usedQuota)} 使用</span>
          <span>{formatTokens(usage.monthlyQuota)} 上限</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="bg-muted/50 rounded p-2">
          <div className="text-muted-foreground text-xs">残り操作</div>
          <div className="font-medium">約 {usage.estimatedOperations} 回</div>
        </div>
        <div className="bg-muted/50 rounded p-2">
          <div className="text-muted-foreground text-xs">リセット日</div>
          <div className="font-medium">{formatDate(usage.resetAt)}</div>
        </div>
      </div>

      {/* Warning message */}
      {usage.percentageUsed >= 90 && (
        <div className="mt-3 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-700 dark:text-red-300">
          トークン残量が少なくなっています。
          <Link href="/settings/subscription" className="underline ml-1">
            プランをアップグレード
          </Link>
        </div>
      )}
      {usage.percentageUsed >= 70 && usage.percentageUsed < 90 && (
        <div className="mt-3 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-xs text-yellow-700 dark:text-yellow-300">
          トークン使用量が70%を超えました。
        </div>
      )}

      {/* Link to subscription page */}
      <div className="mt-3 pt-3 border-t border-border">
        <Link
          href="/settings/subscription"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          プラン詳細を見る →
        </Link>
      </div>
    </div>
  );
}
