"use client";

/**
 * Widget.AssessLevelButton Component
 * 
 * Button component for initiating THLI-24 level assessment.
 * Shows quota status and opens AI coach chat with pre-filled message.
 * 
 * @module Widget.AssessLevelButton
 * 
 * Validates: Requirements 4.1
 */

import React from 'react';
import { QuotaIndicator, type QuotaStatus } from './Widget.QuotaStatus';

export interface AssessLevelButtonProps {
  /** Habit name for the assessment */
  habitName?: string;
  /** Habit ID (if assessing existing habit) */
  habitId?: string;
  /** Quota status */
  quota: QuotaStatus | null;
  /** Loading state for quota */
  quotaLoading?: boolean;
  /** Callback when button is clicked */
  onClick: () => void;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Button variant */
  variant?: 'primary' | 'secondary' | 'outline';
  /** Button size */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
  /** Show full quota info or just indicator */
  showFullQuota?: boolean;
}

/**
 * Get pre-filled message for AI coach
 */
export function getAssessmentMessage(habitName?: string): string {
  if (habitName) {
    return `「${habitName}」という習慣のレベルを測定してください。`;
  }
  return 'この習慣のレベルを測定してください。';
}

/**
 * Widget.AssessLevelButton component
 */
export default function AssessLevelButton({
  habitName,
  habitId,
  quota,
  quotaLoading = false,
  onClick,
  disabled = false,
  variant = 'primary',
  size = 'md',
  className = '',
  showFullQuota = false,
}: AssessLevelButtonProps) {
  // Check if quota is exhausted
  const isQuotaExhausted = quota && !quota.isUnlimited && quota.remaining <= 0;
  const isDisabled = disabled || !!isQuotaExhausted;

  // Variant styles
  const variantStyles = {
    primary: 'bg-primary text-primary-foreground hover:opacity-90',
    secondary: 'bg-muted text-foreground hover:bg-muted/80',
    outline: 'bg-transparent border border-primary text-primary hover:bg-primary/10',
  };

  // Size styles
  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs min-h-[36px]',
    md: 'px-4 py-2 text-sm min-h-[44px]',
    lg: 'px-6 py-3 text-base min-h-[52px]',
  };

  return (
    <div className={`inline-flex flex-col items-start gap-1 ${className}`}>
      <button
        onClick={onClick}
        disabled={isDisabled}
        className={`
          inline-flex items-center gap-2
          rounded-md
          font-medium
          transition-all
          focus-visible:outline-2 focus-visible:outline-primary
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        title={isQuotaExhausted ? '今月の評価回数を使い切りました' : undefined}
      >
        {/* Icon */}
        <svg 
          className={`${size === 'sm' ? 'w-3.5 h-3.5' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" 
          />
        </svg>
        
        {/* Label */}
        <span>レベルを測定</span>
        
        {/* Inline quota indicator */}
        {!showFullQuota && (
          <QuotaIndicator quota={quota} loading={quotaLoading} />
        )}
      </button>

      {/* Full quota info below button */}
      {showFullQuota && quota && (
        <div className="text-xs text-muted-foreground">
          {quota.isUnlimited ? (
            <span className="text-primary">無制限プラン</span>
          ) : (
            <span>
              今月の残り評価回数: 
              <span className={quota.remaining <= 2 ? 'text-red-500 font-medium' : ''}>
                {' '}{quota.remaining}/{quota.quotaLimit} 回
              </span>
            </span>
          )}
        </div>
      )}

      {/* Quota exhausted message */}
      {isQuotaExhausted && (
        <div className="text-xs text-red-500">
          今月の評価回数を使い切りました。
          <a href="/settings/subscription" className="underline ml-1">
            プランをアップグレード
          </a>
        </div>
      )}
    </div>
  );
}

/**
 * Compact assess level button for inline use
 */
export function AssessLevelButtonCompact({
  onClick,
  disabled = false,
  className = '',
}: Pick<AssessLevelButtonProps, 'onClick' | 'disabled' | 'className'>) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        inline-flex items-center gap-1
        px-2 py-1
        text-xs
        text-primary
        hover:bg-primary/10
        rounded
        transition-colors
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
    >
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" 
        />
      </svg>
      <span>測定</span>
    </button>
  );
}

/**
 * Assess level prompt component for habit creation flow
 */
export function AssessLevelPrompt({
  habitName,
  quota,
  quotaLoading = false,
  onAssess,
  onSkip,
}: {
  habitName: string;
  quota: QuotaStatus | null;
  quotaLoading?: boolean;
  onAssess: () => void;
  onSkip: () => void;
}) {
  const isQuotaExhausted = quota && !quota.isUnlimited && quota.remaining <= 0;

  return (
    <div className="bg-muted/50 border border-border rounded-lg p-4">
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
          <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" 
            />
          </svg>
        </div>

        {/* Content */}
        <div className="flex-1">
          <h4 className="font-medium mb-1">この習慣のレベルを測定しますか？</h4>
          <p className="text-sm text-muted-foreground mb-3">
            THLI-24フレームワークを使って、「{habitName}」の難易度を評価します。
            適切なワークロードの設定に役立ちます。
          </p>

          {/* Quota status */}
          <div className="text-xs text-muted-foreground mb-3">
            {quotaLoading ? (
              <span>読込中...</span>
            ) : quota?.isUnlimited ? (
              <span className="text-primary">✓ 無制限プラン</span>
            ) : quota ? (
              <span>
                今月の残り評価回数: 
                <span className={quota.remaining <= 2 ? 'text-red-500 font-medium' : ''}>
                  {' '}{quota.remaining}/{quota.quotaLimit} 回
                </span>
              </span>
            ) : null}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={onAssess}
              disabled={!!isQuotaExhausted}
              className={`
                px-4 py-2 text-sm rounded-md font-medium transition-all min-h-[44px]
                ${isQuotaExhausted 
                  ? 'bg-muted text-muted-foreground cursor-not-allowed' 
                  : 'bg-primary text-primary-foreground hover:opacity-90'
                }
              `}
            >
              測定する
            </button>
            <button
              onClick={onSkip}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors min-h-[44px]"
            >
              後で測定
            </button>
          </div>

          {/* Skip reminder */}
          {!isQuotaExhausted && (
            <p className="text-xs text-muted-foreground mt-2">
              後で「レベル測定」ボタンから評価できます
            </p>
          )}

          {/* Quota exhausted message */}
          {isQuotaExhausted && (
            <p className="text-xs text-red-500 mt-2">
              今月の評価回数を使い切りました。
              <a href="/settings/subscription" className="underline ml-1">
                プランをアップグレード
              </a>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
