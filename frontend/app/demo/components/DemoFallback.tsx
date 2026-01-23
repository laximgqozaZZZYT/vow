'use client';

/**
 * DemoFallback - Static Fallback Display for Demo Section
 *
 * This component displays a static fallback when the demo section fails to load.
 * It provides a screenshot-like placeholder with a message explaining the situation
 * and an optional retry button.
 *
 * Requirements: 5.6
 * - IF the demo fails to load, THEN THE Landing_Page SHALL display a static fallback image or placeholder
 */

import React from 'react';

// ============================================================================
// Types
// ============================================================================

interface DemoFallbackProps {
  /** Optional additional CSS classes */
  className?: string;
  /** Error message to display (optional) */
  error?: Error | null;
  /** Callback to retry loading the demo */
  onRetry?: () => void;
  /** Whether to show the retry button */
  showRetry?: boolean;
}

// ============================================================================
// Static Dashboard Preview Component
// ============================================================================

/**
 * StaticDashboardPreview
 *
 * A simplified, static representation of the dashboard layout.
 * This serves as a visual placeholder when the actual demo cannot be loaded.
 */
function StaticDashboardPreview() {
  return (
    <div className="p-6 pt-16 space-y-6 opacity-60">
      {/* Next Section Preview */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-5 h-5 rounded bg-primary/20" />
          <span className="text-sm font-medium text-foreground">Next</span>
        </div>
        <div className="space-y-3">
          {['朝の運動', '読書', '瞑想'].map((habit, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-3 bg-muted rounded-md"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20" />
                <span className="text-sm text-foreground">{habit}</span>
              </div>
              <div className="w-16 h-8 rounded bg-primary/20" />
            </div>
          ))}
        </div>
      </div>

      {/* Stickies Section Preview */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-5 h-5 rounded bg-warning/20" />
          <span className="text-sm font-medium text-foreground">Sticky&apos;n</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {['買い物リスト', 'ミーティング準備'].map((sticky, i) => (
            <div
              key={i}
              className="p-3 bg-warning/10 border border-warning/20 rounded-md"
            >
              <span className="text-sm text-foreground">{sticky}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Calendar Section Preview */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-5 h-5 rounded bg-success/20" />
          <span className="text-sm font-medium text-foreground">Calendar</span>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {['日', '月', '火', '水', '木', '金', '土'].map((day, i) => (
            <div
              key={i}
              className="text-center text-xs text-muted-foreground py-1"
            >
              {day}
            </div>
          ))}
          {Array.from({ length: 28 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square flex items-center justify-center text-xs text-muted-foreground bg-muted/50 rounded"
            >
              {i + 1}
            </div>
          ))}
        </div>
      </div>

      {/* Statistics Section Preview */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-5 h-5 rounded bg-primary/20" />
          <span className="text-sm font-medium text-foreground">Statistics</span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: '完了率', value: '85%' },
            { label: '連続日数', value: '7日' },
            { label: '今週の達成', value: '12/15' },
          ].map((stat, i) => (
            <div
              key={i}
              className="text-center p-3 bg-muted rounded-md"
            >
              <div className="text-lg font-semibold text-foreground">
                {stat.value}
              </div>
              <div className="text-xs text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main DemoFallback Component
// ============================================================================

/**
 * DemoFallback
 *
 * Displays a static fallback when the demo section fails to load.
 * Includes:
 * - A static preview of the dashboard layout
 * - An error message overlay
 * - An optional retry button
 *
 * Requirements: 5.6
 */
export default function DemoFallback({
  className = '',
  error,
  onRetry,
  showRetry = true,
}: DemoFallbackProps) {
  return (
    <section
      className={`w-full py-12 px-4 sm:px-6 lg:px-8 ${className}`}
      aria-label="ダッシュボードプレビュー（フォールバック）"
      data-testid="demo-fallback"
    >
      {/* Section Title */}
      <div className="text-center mb-8">
        <h2 className="text-h2 font-semibold text-foreground">
          ダッシュボードプレビュー
        </h2>
        <p className="mt-2 text-body text-muted-foreground">
          実際のダッシュボードをプレビューできます
        </p>
      </div>

      {/* Demo Frame Container */}
      <div
        className="
          mx-auto
          rounded-xl
          border-2 border-border
          bg-card
          shadow-lg
          overflow-hidden
          relative
          w-full
        "
      >
        {/* Fallback Label Badge */}
        <div className="absolute top-4 left-4 z-10">
          <span className="
            inline-flex items-center
            px-3 py-1
            rounded-full
            text-caption font-medium
            bg-muted text-muted-foreground
            shadow-sm
          ">
            プレビュー
          </span>
        </div>

        {/* Static Dashboard Preview */}
        <StaticDashboardPreview />

        {/* Error Overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 p-6 max-w-sm text-center">
            {/* Error Icon */}
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-destructive"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            {/* Error Message */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-1">
                デモを読み込めませんでした
              </h3>
              <p className="text-sm text-muted-foreground">
                {error?.message || 'インタラクティブデモの読み込み中にエラーが発生しました。'}
              </p>
            </div>

            {/* Retry Button */}
            {showRetry && onRetry && (
              <button
                onClick={onRetry}
                className="
                  px-4 py-2
                  bg-primary text-primary-foreground
                  rounded-md shadow-sm
                  hover:opacity-90
                  focus-visible:outline-2 focus-visible:outline-primary
                  transition-opacity
                  min-w-[44px] min-h-[44px]
                "
                aria-label="デモを再読み込み"
              >
                再試行
              </button>
            )}

            {/* Alternative Action */}
            <p className="text-xs text-muted-foreground">
              または、
              <a
                href="/auth/login"
                className="text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
              >
                ログイン
              </a>
              して実際のダッシュボードをお試しください
            </p>
          </div>
        </div>
      </div>

      {/* Fallback Hint */}
      <div className="text-center mt-4">
        <p className="text-caption text-muted-foreground">
          静的なプレビューを表示しています
        </p>
      </div>

      {/* Call to Action */}
      <div className="text-center mt-4">
        <p className="text-small text-muted-foreground">
          今すぐ始めて、あなたの習慣を管理しましょう
        </p>
      </div>
    </section>
  );
}

// ============================================================================
// Named Exports
// ============================================================================

export { DemoFallback, StaticDashboardPreview };
export type { DemoFallbackProps };
