'use client';

/**
 * GroupChatTimeline Widget
 *
 * Reusable chat timeline component for multi-agent group communication.
 * Extracted from Modal.ManagerChat for embedding in various contexts.
 *
 * Features:
 * - Message bubbles with agent identification
 * - Auto-scroll on new messages
 * - Date separators (optional)
 * - Agent-specific avatar/colors
 * - Message type styling
 *
 * @module Widget.GroupChatTimeline
 */

import React, { useRef, useEffect, useMemo, useCallback, memo } from 'react';
import type { AgentRole, ChatMessageType, ChatAction } from '../types/agent.types';
import { ROLE_CONFIG } from '../types/agent.types';

/**
 * Default maximum number of messages to display for performance
 */
const DEFAULT_MAX_MESSAGES = 100;

/**
 * Chat message structure for the timeline
 */
export interface TimelineChatMessage {
  id: string;
  agentId?: string;
  agentName?: string;
  agentRole?: AgentRole;
  content: string;
  type: 'user' | 'agent' | 'system';
  eventType?: ChatMessageType;
  taskId?: string;
  taskTitle?: string;
  timestamp: Date;
  actions?: ChatAction[];
}

/**
 * Props for GroupChatTimeline component
 */
export interface GroupChatTimelineProps {
  /** Messages to display in the timeline */
  messages: TimelineChatMessage[];
  /** Callback when a message is clicked */
  onMessageClick?: (message: TimelineChatMessage) => void;
  /** Callback when an action button is clicked */
  onActionClick?: (action: ChatAction, message: TimelineChatMessage) => void;
  /** Task ID to filter and highlight related messages */
  focusTaskId?: string;
  /** Title of the focused task (for display in banner) */
  focusTaskTitle?: string;
  /** Callback when focus is cleared (Show all button clicked) */
  onClearFocus?: () => void;
  /** Locale for date/time formatting */
  locale?: 'ja' | 'en';
  /** Maximum height of the timeline container */
  maxHeight?: string;
  /** Show date separators between days */
  showDateSeparators?: boolean;
  /** Show loading indicator */
  isLoading?: boolean;
  /** Loading agent info for typing indicator */
  loadingAgent?: { name: string; role?: AgentRole };
  /** Empty state message */
  emptyMessage?: string;
  /** Additional class name */
  className?: string;
  /** Maximum number of messages to display (default: 100) */
  maxMessages?: number;
}

/**
 * Get avatar configuration for message sender
 * Each role gets a unique color for easy identification in group chat
 */
function getAvatarConfig(
  type: 'user' | 'agent' | 'system',
  agentRole?: AgentRole
): { icon: string; bgColor: string; textColor: string; borderColor: string } {
  if (type === 'user') {
    return { icon: '👤', bgColor: 'bg-blue-500', textColor: 'text-white', borderColor: 'border-blue-500' };
  }
  if (type === 'system') {
    return { icon: '⚙️', bgColor: 'bg-gray-500', textColor: 'text-white', borderColor: 'border-gray-500' };
  }
  if (agentRole === 'manager') {
    return { icon: '👔', bgColor: 'bg-purple-500', textColor: 'text-white', borderColor: 'border-purple-500' };
  }
  // Assign colors based on agent role for group chat distinction
  if (agentRole) {
    const roleColors: Record<string, { bgColor: string; borderColor: string }> = {
      developer: { bgColor: 'bg-blue-400', borderColor: 'border-blue-400' },
      reviewer: { bgColor: 'bg-orange-400', borderColor: 'border-orange-400' },
      tester: { bgColor: 'bg-green-400', borderColor: 'border-green-400' },
      architect: { bgColor: 'bg-indigo-400', borderColor: 'border-indigo-400' },
      devops: { bgColor: 'bg-red-400', borderColor: 'border-red-400' },
      documenter: { bgColor: 'bg-yellow-400', borderColor: 'border-yellow-400' },
      analyst: { bgColor: 'bg-cyan-400', borderColor: 'border-cyan-400' },
      general: { bgColor: 'bg-gray-400', borderColor: 'border-gray-400' },
    };
    const config = ROLE_CONFIG[agentRole];
    const colors = roleColors[agentRole] || { bgColor: 'bg-gray-400', borderColor: 'border-gray-400' };
    return { icon: config?.icon || '🤖', bgColor: colors.bgColor, textColor: 'text-white', borderColor: colors.borderColor };
  }
  return { icon: '🤖', bgColor: 'bg-gray-400', textColor: 'text-white', borderColor: 'border-gray-400' };
}

/**
 * Message type badge component
 */
function MessageTypeBadge({ eventType, locale = 'ja' }: { eventType?: ChatMessageType; locale?: 'ja' | 'en' }) {
  if (!eventType || eventType === 'message') return null;

  const config: Record<string, { labelJa: string; labelEn: string; color: string }> = {
    task_assignment: { labelJa: '割当', labelEn: 'Assign', color: 'bg-blue-500/20 text-blue-500' },
    progress_report: { labelJa: '進捗', labelEn: 'Progress', color: 'bg-yellow-500/20 text-yellow-500' },
    completion_report: { labelJa: '完了', labelEn: 'Done', color: 'bg-green-500/20 text-green-500' },
    error_report: { labelJa: 'エラー', labelEn: 'Error', color: 'bg-red-500/20 text-red-500' },
    spec_draft: { labelJa: 'SPEC', labelEn: 'SPEC', color: 'bg-purple-500/20 text-purple-500' },
    instruction: { labelJa: '指示', labelEn: 'Instr', color: 'bg-cyan-500/20 text-cyan-500' },
  };

  const cfg = config[eventType];
  if (!cfg) return null;

  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded ${cfg.color}`}>
      {locale === 'ja' ? cfg.labelJa : cfg.labelEn}
    </span>
  );
}

/**
 * Date separator component
 */
function DateSeparator({ date, locale = 'ja' }: { date: Date; locale?: 'ja' | 'en' }) {
  const formattedDate = date.toLocaleDateString(locale === 'ja' ? 'ja-JP' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });

  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 h-px bg-border" />
      <span className="text-xs text-muted-foreground px-2">{formattedDate}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

/**
 * Props for TimelineMessageBubble component
 */
interface TimelineMessageBubbleProps {
  message: TimelineChatMessage;
  onAction?: (action: ChatAction) => void;
  onMessageClick?: (message: TimelineChatMessage) => void;
  isHighlighted?: boolean;
  locale?: 'ja' | 'en';
}

/**
 * Individual message bubble component
 */
export const TimelineMessageBubble = memo(function TimelineMessageBubble({
  message,
  onAction,
  onMessageClick,
  isHighlighted = false,
  locale = 'ja',
}: TimelineMessageBubbleProps) {
  const isUser = message.type === 'user';
  const isSystem = message.type === 'system';
  const isManager = message.agentRole === 'manager';
  const avatar = getAvatarConfig(message.type, message.agentRole);

  const getSenderName = () => {
    if (isUser) return locale === 'ja' ? 'あなた' : 'You';
    if (isSystem) return locale === 'ja' ? 'システム' : 'System';
    if (message.agentName) return message.agentName;
    if (isManager) return 'Manager';
    return 'Agent';
  };

  const getRoleLabel = () => {
    if (isUser) return null;
    if (isSystem) return null;
    if (isManager) return 'Manager';
    if (message.agentRole) {
      const config = ROLE_CONFIG[message.agentRole];
      return locale === 'ja' ? config?.labelJa : config?.label || message.agentRole;
    }
    return null;
  };

  // Get bubble background based on role for visual distinction
  const getBubbleStyle = () => {
    if (isUser) {
      return 'bg-blue-500/10 border-l-4 border-l-blue-500';
    }
    if (isSystem) {
      return 'bg-muted/30 border-l-4 border-l-gray-400 italic';
    }
    if (isManager) {
      return 'bg-purple-500/10 border-l-4 border-l-purple-500';
    }
    // Other agents get their role color
    return `bg-muted border-l-4 ${avatar.borderColor}`;
  };

  const handleClick = () => {
    onMessageClick?.(message);
  };

  return (
    <div
      className={`flex gap-3 mb-4 group rounded-lg transition-colors ${isHighlighted ? 'bg-primary/5 -mx-2 px-2 py-1 ring-1 ring-primary/20' : ''} ${onMessageClick ? 'cursor-pointer hover:bg-muted/50' : ''}`}
      onClick={handleClick}
    >
      {/* Avatar */}
      <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm shadow-sm ${avatar.bgColor} ${avatar.textColor}`}>
        {avatar.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Sender info bar */}
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-sm font-semibold ${isUser ? 'text-blue-600 dark:text-blue-400' : isManager ? 'text-purple-600 dark:text-purple-400' : 'text-foreground'}`}>
            {getSenderName()}
          </span>
          {getRoleLabel() && !isUser && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {getRoleLabel()}
            </span>
          )}
          <MessageTypeBadge eventType={message.eventType} locale={locale} />
          <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
            {message.timestamp.toLocaleTimeString(locale === 'ja' ? 'ja-JP' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* Message bubble */}
        <div className={`rounded-lg px-3 py-2 ${getBubbleStyle()}`}>
          {/* Task reference */}
          {message.taskTitle && (
            <div className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1 bg-background/50 rounded px-1.5 py-0.5 w-fit">
              <span>📋</span>
              <span className="truncate max-w-[200px]">{message.taskTitle}</span>
            </div>
          )}

          {/* Content */}
          <div className="text-sm whitespace-pre-wrap">{message.content}</div>

          {/* Actions */}
          {message.actions && message.actions.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-border/50">
              {message.actions.map((action) => (
                <button
                  key={action.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onAction?.(action);
                  }}
                  className={`
                    text-xs px-2.5 py-1 rounded-md
                    transition-colors
                    ${action.type === 'approve'
                      ? 'bg-green-500 hover:bg-green-600 text-white'
                      : action.type === 'reject'
                        ? 'bg-red-500 hover:bg-red-600 text-white'
                        : 'bg-primary/10 hover:bg-primary/20 text-primary'
                    }
                  `}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

/**
 * Memoized version of TimelineMessageBubble for performance optimization
 */
const MemoizedMessageBubble = TimelineMessageBubble;

/**
 * Typing indicator component
 */
function TypingIndicator({ agentName, agentRole }: { agentName: string; agentRole?: AgentRole }) {
  const avatar = getAvatarConfig('agent', agentRole);

  return (
    <div className="flex gap-3 mb-4">
      <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm shadow-sm ${avatar.bgColor} ${avatar.textColor}`}>
        {avatar.icon}
      </div>
      <div className="flex-1">
        <div className="text-sm font-semibold text-muted-foreground mb-1">
          {agentName} is typing...
        </div>
        <div className="bg-muted rounded-lg px-4 py-3 w-fit border-l-4 border-l-gray-300">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Empty state component
 */
function EmptyState({ message, locale = 'ja' }: { message?: string; locale?: 'ja' | 'en' }) {
  const defaultMessage = locale === 'ja'
    ? 'エージェントに指示を送信してください'
    : 'Send instructions to the agent';
  const subMessage = locale === 'ja'
    ? 'Managerが一次対応し、必要に応じて他のエージェントに割り当てます'
    : 'Manager will handle initially and delegate to other agents as needed';

  return (
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
      <div className="text-4xl mb-3">🤖</div>
      <p className="text-sm font-medium">{message || defaultMessage}</p>
      <p className="text-xs mt-1 text-center px-4">{subMessage}</p>
    </div>
  );
}

/**
 * Focus banner component - shows when filtering by a specific task
 */
function FocusBanner({
  taskTitle,
  messageCount,
  onClear,
  locale,
}: {
  taskTitle: string;
  messageCount: number;
  onClear: () => void;
  locale: 'ja' | 'en';
}) {
  return (
    <div className="bg-primary/10 border-b border-primary/20 px-3 py-2 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-primary">🎯</span>
        <span className="font-medium text-sm">{taskTitle}</span>
        <span className="text-muted-foreground text-xs">
          ({messageCount} {locale === 'ja' ? '件' : 'messages'})
        </span>
      </div>
      <button
        onClick={onClear}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {locale === 'ja' ? 'すべて表示' : 'Show all'}
      </button>
    </div>
  );
}

/**
 * Empty filter result component - shows when no messages match the filter
 */
function EmptyFilterResult({ taskTitle, locale = 'ja' }: { taskTitle?: string; locale?: 'ja' | 'en' }) {
  const message = locale === 'ja'
    ? `「${taskTitle || 'このタスク'}」に関連するメッセージはありません`
    : `No messages related to "${taskTitle || 'this task'}"`;

  return (
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
      <div className="text-4xl mb-3">🔍</div>
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
}

/**
 * GroupChatTimeline Component
 *
 * A reusable timeline component for displaying multi-agent chat messages.
 * Supports various features like auto-scroll, date separators, and message highlighting.
 */
export function GroupChatTimeline({
  messages,
  onMessageClick,
  onActionClick,
  focusTaskId,
  focusTaskTitle,
  onClearFocus,
  locale = 'ja',
  maxHeight = '100%',
  showDateSeparators = true,
  isLoading = false,
  loadingAgent,
  emptyMessage,
  className = '',
  maxMessages = DEFAULT_MAX_MESSAGES,
}: GroupChatTimelineProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const focusMessageRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevFocusTaskIdRef = useRef<string | undefined>(undefined);

  // Deduplicate messages by ID (handles SSE duplicate events)
  const deduplicatedMessages = useMemo(() => {
    const seen = new Set<string>();
    return messages.filter(m => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
  }, [messages]);

  // Limit messages to maxMessages (keep most recent)
  const limitedMessages = useMemo(() => {
    if (deduplicatedMessages.length <= maxMessages) return deduplicatedMessages;
    return deduplicatedMessages.slice(-maxMessages);
  }, [deduplicatedMessages, maxMessages]);

  // Filter messages by focusTaskId if provided
  const filteredMessages = useMemo(() => {
    if (!focusTaskId) return limitedMessages;
    return limitedMessages.filter(m => m.taskId === focusTaskId);
  }, [limitedMessages, focusTaskId]);

  // Sort messages chronologically
  const sortedMessages = useMemo(() => {
    return [...filteredMessages].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }, [filteredMessages]);

  // Group messages by date for separators
  const messagesWithSeparators = useMemo(() => {
    if (!showDateSeparators) return sortedMessages.map(m => ({ type: 'message' as const, data: m }));

    const result: Array<{ type: 'separator'; data: Date } | { type: 'message'; data: TimelineChatMessage }> = [];
    let lastDate: string | null = null;

    sortedMessages.forEach(message => {
      const messageDate = message.timestamp.toDateString();
      if (messageDate !== lastDate) {
        result.push({ type: 'separator', data: message.timestamp });
        lastDate = messageDate;
      }
      result.push({ type: 'message', data: message });
    });

    return result;
  }, [sortedMessages, showDateSeparators]);

  // Auto-scroll to bottom when new messages arrive (only when not focused)
  useEffect(() => {
    if (!focusTaskId) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [filteredMessages, focusTaskId]);

  // Scroll to first focused task message when focus changes
  useEffect(() => {
    if (focusTaskId && focusTaskId !== prevFocusTaskIdRef.current && focusMessageRef.current) {
      focusMessageRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    prevFocusTaskIdRef.current = focusTaskId;
  }, [focusTaskId]);

  // Memoized action handler
  const handleAction = useCallback((action: ChatAction, message: TimelineChatMessage) => {
    onActionClick?.(action, message);
  }, [onActionClick]);

  // Memoized message click handler
  const handleMessageClick = useCallback((message: TimelineChatMessage) => {
    onMessageClick?.(message);
  }, [onMessageClick]);

  // Find first message related to focused task (memoized)
  const firstFocusedMessageId = useMemo(() => {
    if (!focusTaskId) return null;
    const firstMatch = sortedMessages.find(m => m.taskId === focusTaskId);
    return firstMatch?.id || null;
  }, [focusTaskId, sortedMessages]);

  // Handle clear focus
  const handleClearFocus = useCallback(() => {
    onClearFocus?.();
  }, [onClearFocus]);

  // Show empty state when no messages at all
  if (messages.length === 0 && !isLoading) {
    return (
      <div className={`flex-1 overflow-y-auto ${className}`} style={{ maxHeight }}>
        <EmptyState message={emptyMessage} locale={locale} />
      </div>
    );
  }

  // Show empty filter result when focus is active but no matching messages
  if (focusTaskId && filteredMessages.length === 0) {
    return (
      <div className={`flex flex-col ${className}`} style={{ maxHeight }}>
        {onClearFocus && (
          <FocusBanner
            taskTitle={focusTaskTitle || focusTaskId}
            messageCount={0}
            onClear={handleClearFocus}
            locale={locale}
          />
        )}
        <div className="flex-1 overflow-y-auto">
          <EmptyFilterResult taskTitle={focusTaskTitle} locale={locale} />
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${className}`} style={{ maxHeight }}>
      {/* Focus banner - show when filtering by task */}
      {focusTaskId && onClearFocus && (
        <FocusBanner
          taskTitle={focusTaskTitle || focusTaskId}
          messageCount={filteredMessages.length}
          onClear={handleClearFocus}
          locale={locale}
        />
      )}

      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-4"
      >
        {messagesWithSeparators.map((item, index) => {
          if (item.type === 'separator') {
            return <DateSeparator key={`sep-${index}`} date={item.data} locale={locale} />;
          }

          const message = item.data;
          // When filtering, all messages are highlighted (focused)
          const isHighlighted = focusTaskId ? true : false;
          const isFirstFocused = message.id === firstFocusedMessageId;

          return (
            <div
              key={message.id}
              ref={isFirstFocused ? focusMessageRef : undefined}
            >
              <MemoizedMessageBubble
                message={message}
                onAction={(action) => handleAction(action, message)}
                onMessageClick={handleMessageClick}
                isHighlighted={isHighlighted}
                locale={locale}
              />
            </div>
          );
        })}

        {/* Loading/typing indicator */}
        {isLoading && loadingAgent && (
          <TypingIndicator agentName={loadingAgent.name} agentRole={loadingAgent.role} />
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}

/**
 * Utility function to convert ChatMessage from Modal.ManagerChat to TimelineChatMessage
 * This helps with migration from the original Modal.ManagerChat implementation
 */
export function convertToTimelineMessage(
  message: {
    id: string;
    role: 'user' | 'manager' | 'agent' | 'system';
    content: string;
    agentId?: string;
    agentName?: string;
    agentRole?: AgentRole;
    messageType?: ChatMessageType;
    taskId?: string;
    taskTitle?: string;
    createdAt: string;
    actions?: ChatAction[];
  }
): TimelineChatMessage {
  let type: 'user' | 'agent' | 'system';
  if (message.role === 'user') {
    type = 'user';
  } else if (message.role === 'system') {
    type = 'system';
  } else {
    type = 'agent';
  }

  return {
    id: message.id,
    agentId: message.agentId,
    agentName: message.agentName,
    agentRole: message.agentRole,
    content: message.content,
    type,
    eventType: message.messageType,
    taskId: message.taskId,
    taskTitle: message.taskTitle,
    timestamp: new Date(message.createdAt),
    actions: message.actions,
  };
}

export default GroupChatTimeline;
