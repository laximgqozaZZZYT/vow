'use client';

/**
 * UserLevelBadge Component
 * 
 * ユーザーの総合レベルを表示するバッジコンポーネント
 * 
 * Features:
 * - ティア別カラー表示
 * - small/medium/large サイズ対応
 * - ローディング状態表示
 * 
 * @module Widget.UserLevelBadge
 * 
 * Validates: Requirements 9.4
 */

import React from 'react';
import { type UserLevelTier, getUserLevelTierColors } from '../../hooks/useUserLevel';

export interface UserLevelBadgeProps {
  /** ユーザーレベル (0-100) */
  level: number;
  /** ティア */
  tier: UserLevelTier;
  /** サイズ */
  size?: 'sm' | 'md' | 'lg';
  /** クリックハンドラ */
  onClick?: () => void;
  /** 追加のCSSクラス */
  className?: string;
  /** ローディング状態 */
  isLoading?: boolean;
  /** コンパクト表示 */
  compact?: boolean;
}

/**
 * ユーザーレベルバッジコンポーネント
 */
export default function UserLevelBadge({
  level,
  tier,
  size = 'md',
  onClick,
  className = '',
  isLoading = false,
  compact = false,
}: UserLevelBadgeProps) {
  const colors = getUserLevelTierColors(tier);

  // サイズ別のクラス
  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-xs gap-1',
    md: 'px-2 py-1 text-sm gap-1.5',
    lg: 'px-3 py-1.5 text-base gap-2',
  };

  if (isLoading) {
    return (
      <div
        className={`
          inline-flex items-center
          ${sizeClasses[size]}
          bg-muted
          border border-border
          rounded-md
          ${className}
        `}
      >
        <div className="w-3 h-3 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
        <span className="text-muted-foreground">Loading...</span>
      </div>
    );
  }

  const BadgeContent = (
    <>
      {/* レベルアイコン */}
      <svg
        className={`${size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'}`}
        fill="currentColor"
        viewBox="0 0 24 24"
      >
        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
      </svg>
      
      {/* レベル数値 */}
      <span className={`font-semibold ${size === 'lg' ? 'text-lg' : ''}`}>
        Lv. {level}
      </span>

      {/* ティアラベル (コンパクトでない場合) */}
      {!compact && (
        <span className="hidden sm:inline text-xs opacity-80">
          {colors.labelJa}
        </span>
      )}
    </>
  );

  if (onClick) {
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
          cursor-pointer hover:opacity-80 transition-opacity
          focus-visible:outline-2 focus-visible:outline-primary
          ${className}
        `}
        aria-label={`User Level ${level} (${colors.label})`}
      >
        {BadgeContent}
      </button>
    );
  }

  return (
    <div
      className={`
        inline-flex items-center
        ${sizeClasses[size]}
        ${colors.bg}
        ${colors.text}
        border ${colors.border}
        rounded-md
        font-medium
        ${className}
      `}
      aria-label={`User Level ${level} (${colors.label})`}
    >
      {BadgeContent}
    </div>
  );
}

/**
 * コンパクト版ユーザーレベルバッジ
 */
export function UserLevelBadgeCompact({
  level,
  tier,
  onClick,
  className = '',
  isLoading = false,
}: Omit<UserLevelBadgeProps, 'size' | 'compact'>) {
  return (
    <UserLevelBadge
      level={level}
      tier={tier}
      size="sm"
      compact
      onClick={onClick}
      className={className}
      isLoading={isLoading}
    />
  );
}
