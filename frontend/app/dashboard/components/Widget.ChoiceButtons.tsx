'use client';

import React from 'react';

/**
 * 選択肢の型定義
 */
export interface Choice {
  /** 選択肢のID */
  id: string;
  /** 表示ラベル */
  label: string;
  /** 説明文（オプション） */
  description?: string;
  /** アイコン（絵文字またはReactNode） */
  icon?: string | React.ReactNode;
  /** 緊急度（オプション） */
  urgency?: 'low' | 'medium' | 'high';
  /** 無効化フラグ */
  disabled?: boolean;
}

/**
 * ChoiceButtonsコンポーネントのProps
 */
export interface ChoiceButtonsProps {
  /** 選択肢のリスト（最大5つ） */
  choices: Choice[];
  /** 選択時のコールバック */
  onSelect: (choice: Choice) => void;
  /** レイアウト方向 */
  layout?: 'vertical' | 'horizontal' | 'grid';
  /** サイズ */
  size?: 'sm' | 'md' | 'lg';
  /** 追加のクラス名 */
  className?: string;
}

/**
 * 緊急度に応じたスタイルを取得
 */
function getUrgencyStyles(urgency?: 'low' | 'medium' | 'high'): string {
  switch (urgency) {
    case 'high':
      return 'border-l-4 border-l-red-500';
    case 'medium':
      return 'border-l-4 border-l-yellow-500';
    case 'low':
      return 'border-l-4 border-l-green-500';
    default:
      return '';
  }
}

/**
 * サイズに応じたスタイルを取得
 */
function getSizeStyles(size: 'sm' | 'md' | 'lg'): string {
  switch (size) {
    case 'sm':
      return 'px-3 py-2 text-sm';
    case 'lg':
      return 'px-5 py-4 text-lg';
    default:
      return 'px-4 py-3 text-base';
  }
}

/**
 * レイアウトに応じたコンテナスタイルを取得
 */
function getLayoutStyles(layout: 'vertical' | 'horizontal' | 'grid'): string {
  switch (layout) {
    case 'horizontal':
      return 'flex flex-row flex-wrap gap-2';
    case 'grid':
      return 'grid grid-cols-2 gap-2';
    default:
      return 'flex flex-col gap-2';
  }
}

/**
 * ChoiceButtonsコンポーネント
 *
 * AIコーチが提示する選択肢をボタンとして表示する。
 * 最大5つの選択肢をサポートし、アイコン、説明、緊急度インジケーターを表示できる。
 *
 * Requirements:
 * - 10.1: WHEN presenting options, display as clickable buttons
 * - 10.2: WHEN a choice button is clicked, send the action as a user message
 * - 10.3: Choice buttons SHALL support icons and descriptions
 * - 10.4: Choice buttons SHALL indicate urgency levels visually
 * - 10.5: Choice buttons SHALL be limited to 5 options maximum
 */
export function ChoiceButtons({
  choices,
  onSelect,
  layout = 'vertical',
  size = 'md',
  className = '',
}: ChoiceButtonsProps) {
  // 最大5つの選択肢に制限
  const limitedChoices = choices.slice(0, 5);

  return (
    <div className={`${getLayoutStyles(layout)} ${className}`}>
      {limitedChoices.map((choice) => (
        <button
          key={choice.id}
          onClick={() => onSelect(choice)}
          disabled={choice.disabled}
          className={`
            ${getSizeStyles(size)}
            ${getUrgencyStyles(choice.urgency)}
            flex items-start gap-3
            bg-card hover:bg-muted
            border border-border rounded-lg
            text-left
            transition-colors duration-200
            disabled:opacity-50 disabled:cursor-not-allowed
            focus-visible:outline-2 focus-visible:outline-primary
          `}
        >
          {/* アイコン */}
          {choice.icon && (
            <span className="flex-shrink-0 text-xl">
              {typeof choice.icon === 'string' ? choice.icon : choice.icon}
            </span>
          )}

          {/* ラベルと説明 */}
          <div className="flex flex-col gap-0.5">
            <span className="font-medium text-foreground">{choice.label}</span>
            {choice.description && (
              <span className="text-sm text-muted-foreground">
                {choice.description}
              </span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

export default ChoiceButtons;
