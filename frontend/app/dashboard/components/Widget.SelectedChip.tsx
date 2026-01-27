'use client';

import React from 'react';

/**
 * SelectedChip - 選択済みアイテムを表示するChipコンポーネント
 * 
 * アクセントカラー適用、削除ボタン、ホバー時のフィードバック。
 * ダークモード対応。
 * 
 * @validates Requirements 3.1, 3.2, 3.3, 3.4
 */

export interface SelectedChipProps {
  /** 表示ラベル */
  label: string;
  /** 背景色（オプション） */
  color?: string;
  /** 削除時のコールバック */
  onRemove: () => void;
  /** アクセシビリティ用の削除ボタンラベル */
  removeAriaLabel?: string;
  /** バリアント（do/avoid区別など） */
  variant?: 'default' | 'do' | 'avoid';
  /** サイズ */
  size?: 'sm' | 'md';
  /** 無効化 */
  disabled?: boolean;
}

export function SelectedChip({
  label,
  color,
  onRemove,
  removeAriaLabel,
  variant = 'default',
  size = 'md',
  disabled = false,
}: SelectedChipProps) {
  // バリアントに応じたボーダースタイル
  const getVariantBorder = () => {
    switch (variant) {
      case 'do':
        return 'border-l-2 border-l-green-500';
      case 'avoid':
        return 'border-l-2 border-l-red-500';
      default:
        return '';
    }
  };

  // サイズに応じたスタイル
  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return 'px-2 py-0.5 text-xs gap-1';
      case 'md':
      default:
        return 'px-3 py-1 text-sm gap-1.5';
    }
  };

  // デフォルトの背景色
  const backgroundColor = color || 'var(--color-primary)';

  return (
    <div
      className={`
        inline-flex items-center rounded text-white
        transition-all duration-150
        group
        ${getSizeStyles()}
        ${getVariantBorder()}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
      style={{ backgroundColor }}
    >
      <span className="truncate max-w-[150px]">{label}</span>
      
      {/* バリアントインジケーター */}
      {variant !== 'default' && (
        <span 
          className={`
            text-[10px] px-1 py-0.5 rounded
            ${variant === 'do' ? 'bg-green-500/30' : ''}
            ${variant === 'avoid' ? 'bg-red-500/30' : ''}
          `}
        >
          {variant}
        </span>
      )}
      
      {/* 削除ボタン */}
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        className={`
          flex items-center justify-center
          rounded transition-colors
          hover:bg-white/20
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50
          ${size === 'sm' ? 'w-4 h-4 text-xs' : 'w-5 h-5 text-sm'}
          ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
          opacity-70 group-hover:opacity-100
        `}
        aria-label={removeAriaLabel || `Remove ${label}`}
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          viewBox="0 0 20 20" 
          fill="currentColor"
          className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'}
        >
          <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
        </svg>
      </button>
    </div>
  );
}

export default SelectedChip;
