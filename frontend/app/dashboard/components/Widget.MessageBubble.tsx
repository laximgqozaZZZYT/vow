'use client';

import React from 'react';
import { ChoiceButtons, type Choice } from './Widget.ChoiceButtons';

/**
 * UIコンポーネントデータの型定義
 */
export interface UIComponentData {
  type: 'ui_component';
  component: 'habit_stats' | 'choice_buttons' | 'workload_chart' | 'progress_indicator' | 'quick_actions';
  data: Record<string, unknown>;
}

/**
 * メッセージの型定義
 */
export interface Message {
  /** メッセージID */
  id: string;
  /** 送信者の役割 */
  role: 'user' | 'assistant';
  /** メッセージ内容 */
  content: string;
  /** タイムスタンプ */
  timestamp: Date;
  /** UIコンポーネント（アシスタントメッセージのみ） */
  uiComponents?: UIComponentData[];
}

/**
 * MessageBubbleコンポーネントのProps
 */
export interface MessageBubbleProps {
  /** メッセージデータ */
  message: Message;
  /** 選択肢クリック時のコールバック */
  onChoiceSelect?: (choice: Choice) => void;
  /** 最大幅（デフォルト: 85%） */
  maxWidth?: string;
  /** 追加のクラス名 */
  className?: string;
}

/**
 * 選択肢ボタンデータの型定義
 */
interface ChoiceButtonsData {
  title?: string;
  choices: Choice[];
  layout?: 'vertical' | 'horizontal' | 'grid';
  size?: 'sm' | 'md' | 'lg';
}

/**
 * MessageBubbleコンポーネント
 *
 * ユーザーとアシスタントのメッセージを表示するバブルコンポーネント。
 * アシスタントメッセージにはUIコンポーネント（選択肢ボタンなど）を含めることができる。
 *
 * Requirements:
 * - 3.1: Message bubbles SHALL have minimum 16px font size
 * - 3.2: Message bubbles SHALL have minimum 16px padding
 * - 3.3: User messages SHALL be right-aligned with primary background
 * - 3.4: Assistant messages SHALL be left-aligned with card background
 * - 3.5: Message bubbles SHALL have max-width of 85% on desktop, 95% on mobile
 */
export function MessageBubble({
  message,
  onChoiceSelect,
  maxWidth,
  className = '',
}: MessageBubbleProps) {
  const isUser = message.role === 'user';

  // レスポンシブな最大幅（デスクトップ85%、モバイル95%）
  const bubbleMaxWidth = maxWidth || 'max-w-[85%] sm:max-w-[85%]';

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {/* メッセージバブル */}
      <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
        <div
          className={`
            ${bubbleMaxWidth}
            px-4 py-3
            rounded-xl
            text-base
            whitespace-pre-wrap
            break-words
            ${isUser
              ? 'bg-primary text-primary-foreground rounded-br-sm'
              : 'bg-card border border-border rounded-bl-sm'
            }
          `}
        >
          {message.content}
        </div>
      </div>

      {/* UIコンポーネント（アシスタントメッセージのみ） */}
      {!isUser && message.uiComponents && message.uiComponents.length > 0 && (
        <div className="flex flex-col gap-2 ml-2">
          {message.uiComponents.map((comp, idx) => (
            <UIComponentRenderer
              key={`${message.id}-ui-${idx}`}
              component={comp}
              onChoiceSelect={onChoiceSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * UIコンポーネントレンダラー
 */
function UIComponentRenderer({
  component,
  onChoiceSelect,
}: {
  component: UIComponentData;
  onChoiceSelect?: (choice: Choice) => void;
}) {
  if (component.type !== 'ui_component') {
    return null;
  }

  switch (component.component) {
    case 'choice_buttons': {
      const data = component.data as unknown as ChoiceButtonsData;
      if (!data.choices || data.choices.length === 0) {
        return null;
      }
      return (
        <div className="space-y-2">
          {data.title && (
            <p className="text-sm font-medium text-muted-foreground">
              {data.title}
            </p>
          )}
          <ChoiceButtons
            choices={data.choices}
            onSelect={onChoiceSelect || (() => {})}
            layout={data.layout || 'vertical'}
            size={data.size || 'md'}
          />
        </div>
      );
    }

    // 他のUIコンポーネントは将来的に追加
    case 'habit_stats':
    case 'workload_chart':
    case 'progress_indicator':
    case 'quick_actions':
      // これらは既存のウィジェットで処理される
      return null;

    default:
      return null;
  }
}

/**
 * メッセージリストコンポーネント
 *
 * 複数のメッセージを表示するコンテナ。
 * 自動スクロール機能を含む。
 */
export interface MessageListProps {
  /** メッセージリスト */
  messages: Message[];
  /** 選択肢クリック時のコールバック */
  onChoiceSelect?: (choice: Choice) => void;
  /** 追加のクラス名 */
  className?: string;
}

export function MessageList({
  messages,
  onChoiceSelect,
  className = '',
}: MessageListProps) {
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  // 新しいメッセージが追加されたら自動スクロール
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {messages.map((msg) => (
        <MessageBubble
          key={msg.id}
          message={msg}
          onChoiceSelect={onChoiceSelect}
        />
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}

export default MessageBubble;
