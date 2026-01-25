'use client';

import React from 'react';

/**
 * クイックアクションの型定義
 */
export interface QuickAction {
  /** アクションID */
  id: string;
  /** 表示ラベル */
  label: string;
  /** アイコン（絵文字またはSVG） */
  icon?: string;
  /** 説明 */
  description?: string;
  /** 無効状態 */
  disabled?: boolean;
  /** カラーバリエーション */
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
}

/**
 * QuickActionButtonsコンポーネントのProps
 */
export interface QuickActionButtonsProps {
  /** アクションリスト */
  actions: QuickAction[];
  /** クリック時のコールバック */
  onAction: (actionId: string) => void;
  /** レイアウト */
  layout?: 'horizontal' | 'grid';
  /** グリッドの列数 */
  columns?: 2 | 3 | 4;
  /** サイズ */
  size?: 'sm' | 'md' | 'lg';
  /** 追加のクラス名 */
  className?: string;
}

/**
 * バリアントに応じたスタイルを取得
 */
function getVariantClasses(variant: QuickAction['variant'] = 'default'): string {
  switch (variant) {
    case 'primary':
      return 'bg-primary text-primary-foreground hover:bg-primary/90';
    case 'success':
      return 'bg-green-500 text-white hover:bg-green-600';
    case 'warning':
      return 'bg-yellow-500 text-white hover:bg-yellow-600';
    case 'danger':
      return 'bg-red-500 text-white hover:bg-red-600';
    default:
      return 'bg-muted text-foreground hover:bg-muted/80';
  }
}

/**
 * サイズに応じたスタイルを取得
 */
function getSizeClasses(size: 'sm' | 'md' | 'lg'): {
  button: string;
  icon: string;
  label: string;
} {
  switch (size) {
    case 'sm':
      return {
        button: 'p-2 min-w-[44px] min-h-[44px]',
        icon: 'text-lg',
        label: 'text-xs',
      };
    case 'md':
      return {
        button: 'p-3 min-w-[56px] min-h-[56px]',
        icon: 'text-xl',
        label: 'text-sm',
      };
    case 'lg':
      return {
        button: 'p-4 min-w-[72px] min-h-[72px]',
        icon: 'text-2xl',
        label: 'text-base',
      };
  }
}

/**
 * グリッド列数に応じたクラスを取得
 */
function getGridColumns(columns: 2 | 3 | 4): string {
  switch (columns) {
    case 2:
      return 'grid-cols-2';
    case 3:
      return 'grid-cols-3';
    case 4:
      return 'grid-cols-4';
  }
}


/**
 * 個別のアクションボタン
 */
function ActionButton({
  action,
  onClick,
  sizeClasses,
  layout,
}: {
  action: QuickAction;
  onClick: () => void;
  sizeClasses: ReturnType<typeof getSizeClasses>;
  layout: 'horizontal' | 'grid';
}) {
  const variantClasses = getVariantClasses(action.variant);

  return (
    <button
      onClick={onClick}
      disabled={action.disabled}
      className={`
        ${sizeClasses.button}
        ${variantClasses}
        rounded-lg
        flex flex-col items-center justify-center gap-1
        transition-all duration-200
        focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2
        disabled:opacity-50 disabled:cursor-not-allowed
        ${layout === 'horizontal' ? 'flex-shrink-0' : ''}
      `}
      title={action.description}
    >
      {action.icon && (
        <span className={sizeClasses.icon} role="img" aria-hidden="true">
          {action.icon}
        </span>
      )}
      <span className={`${sizeClasses.label} font-medium text-center leading-tight`}>
        {action.label}
      </span>
    </button>
  );
}

/**
 * QuickActionButtonsコンポーネント
 *
 * よく使うアクションをアイコンボタンで表示。
 * 水平・グリッドレイアウトをサポート。
 *
 * Requirements:
 * - 9.2: Display quick action buttons for common operations
 */
export function QuickActionButtons({
  actions,
  onAction,
  layout = 'horizontal',
  columns = 3,
  size = 'md',
  className = '',
}: QuickActionButtonsProps) {
  const sizeClasses = getSizeClasses(size);

  if (actions.length === 0) {
    return null;
  }

  const containerClasses =
    layout === 'horizontal'
      ? 'flex flex-wrap gap-2'
      : `grid ${getGridColumns(columns)} gap-2`;

  return (
    <div className={`${containerClasses} ${className}`}>
      {actions.map((action) => (
        <ActionButton
          key={action.id}
          action={action}
          onClick={() => onAction(action.id)}
          sizeClasses={sizeClasses}
          layout={layout}
        />
      ))}
    </div>
  );
}

export default QuickActionButtons;
