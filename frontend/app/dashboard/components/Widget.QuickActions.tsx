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
  /** AIに送信するプロンプト */
  prompt?: string;
  /** 無効状態 */
  disabled?: boolean;
  /** カラーバリエーション */
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
}

/**
 * デフォルトのクイックアクション
 * AIコーチでよく使われる4つのアクションを定義
 */
export const DEFAULT_QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'add-habit',
    label: '習慣を追加',
    icon: '➕',
    prompt: '新しい習慣を追加したい',
    description: '新しい習慣を作成します',
  },
  {
    id: 'set-goal',
    label: 'ゴールを設定',
    icon: '🎯',
    prompt: 'ゴールを設定したい',
    description: '目標を設定します',
  },
  {
    id: 'check-progress',
    label: '進捗を確認',
    icon: '📊',
    prompt: '習慣の進捗を確認したい',
    description: '習慣の達成状況を確認します',
  },
  {
    id: 'get-advice',
    label: 'アドバイス',
    icon: '💡',
    prompt: '習慣を続けるコツを教えて',
    description: '習慣継続のアドバイスを受けます',
  },
];

/**
 * QuickActionButtonsコンポーネントのProps
 */
export interface QuickActionButtonsProps {
  /** アクションリスト（省略時はデフォルトアクションを使用） */
  actions?: QuickAction[];
  /** クリック時のコールバック（アクションIDを受け取る） */
  onAction?: (actionId: string) => void;
  /** クリック時のコールバック（アクション全体を受け取る） */
  onActionSelect?: (action: QuickAction) => void;
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
 * 最小高さは48px以上を保証（アクセシビリティ要件）
 */
function getSizeClasses(size: 'sm' | 'md' | 'lg'): {
  button: string;
  icon: string;
  label: string;
} {
  switch (size) {
    case 'sm':
      return {
        button: 'px-3 py-2 min-h-[44px]',
        icon: 'text-lg',
        label: 'text-sm',
      };
    case 'md':
      return {
        button: 'px-4 py-3 min-h-[48px]',
        icon: 'text-xl',
        label: 'text-base',
      };
    case 'lg':
      return {
        button: 'px-5 py-4 min-h-[56px]',
        icon: 'text-2xl',
        label: 'text-lg',
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
 * ChoiceButtonsと同じスタイル（横長、アイコンとラベルが横並び）
 */
function ActionButton({
  action,
  onClick,
  sizeClasses,
}: {
  action: QuickAction;
  onClick: () => void;
  sizeClasses: ReturnType<typeof getSizeClasses>;
  layout: 'horizontal' | 'grid';
}) {
  return (
    <button
      onClick={onClick}
      disabled={action.disabled}
      className={`
        ${sizeClasses.button}
        bg-card hover:bg-muted
        border border-border rounded-lg
        flex items-center gap-3
        text-left
        transition-colors duration-200
        focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2
        disabled:opacity-50 disabled:cursor-not-allowed
      `}
      title={action.description}
    >
      {action.icon && (
        <span className={`${sizeClasses.icon} flex-shrink-0`} role="img" aria-hidden="true">
          {action.icon}
        </span>
      )}
      <span className={`${sizeClasses.label} font-medium text-foreground`}>
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
 * デフォルトで4つのアクション（習慣追加、ゴール設定、進捗確認、アドバイス）を提供。
 *
 * Requirements:
 * - 7.1: Display 4 default quick actions
 * - 7.2: Use grid layout for quick actions
 * - 7.4: Button height SHALL be at least 48px
 */
export function QuickActionButtons({
  actions,
  onAction,
  onActionSelect,
  layout = 'grid',
  columns = 2,
  size = 'md',
  className = '',
}: QuickActionButtonsProps) {
  const sizeClasses = getSizeClasses(size);
  
  // デフォルトアクションを使用（actionsが指定されていない場合）
  const displayActions = actions || DEFAULT_QUICK_ACTIONS;

  if (displayActions.length === 0) {
    return null;
  }

  const handleClick = (action: QuickAction) => {
    if (onActionSelect) {
      onActionSelect(action);
    } else if (onAction) {
      onAction(action.id);
    }
  };

  const containerClasses =
    layout === 'horizontal'
      ? 'flex flex-wrap gap-2'
      : `flex flex-col gap-2`;

  return (
    <div className={`${containerClasses} ${className}`}>
      {displayActions.map((action) => (
        <ActionButton
          key={action.id}
          action={action}
          onClick={() => handleClick(action)}
          sizeClasses={sizeClasses}
          layout={layout}
        />
      ))}
    </div>
  );
}

export default QuickActionButtons;
