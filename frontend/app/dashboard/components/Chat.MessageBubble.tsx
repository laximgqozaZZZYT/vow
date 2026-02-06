/**
 * Chat.MessageBubble - Chat Message Bubble Component
 *
 * Displays individual chat message bubbles with support for:
 * - Different sender types (user, agent, coach, system)
 *
 * @module Chat.MessageBubble
 */

'use client';

import React from 'react';
import type { GroupChatMessage } from '../types/moc.types';

export interface ChatMessageBubbleProps {
  message: GroupChatMessage;
  locale: 'ja' | 'en';
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
  /** Optional content to display instead of message.content (used for AI candidate responses) */
  displayContent?: string;
}

// Helper function to format time
function formatTime(date: Date): string {
  return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
}

// Sender type specific styling with gradients
const senderStyles = {
  user: {
    avatar: 'bg-gradient-to-br from-blue-500 to-blue-600',
    bubble: 'bg-gradient-to-br from-blue-500 to-blue-600 text-white',
    name: 'text-blue-600 dark:text-blue-400',
  },
  coach: {
    avatar: 'bg-gradient-to-br from-purple-500 to-indigo-600',
    bubble: 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm border border-gray-100 dark:border-gray-700',
    name: 'text-purple-600 dark:text-purple-400',
  },
  agent: {
    avatar: 'bg-gradient-to-br from-amber-500 to-orange-500',
    bubble: 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm border border-gray-100 dark:border-gray-700',
    name: 'text-amber-600 dark:text-amber-400',
  },
  system: {
    avatar: 'bg-gray-400',
    bubble: 'bg-gray-100 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400 text-center italic',
    name: 'text-gray-500 dark:text-gray-400',
  },
};

// Role badge colors with better contrast
const roleBadgeColors: Record<string, string> = {
  manager: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  developer: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  reviewer: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  tester: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  architect: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  devops: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  analyst: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  coach: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
};

export function ChatMessageBubble({
  message,
  locale,
  isFirstInGroup = true,
  isLastInGroup = true,
  displayContent,
}: ChatMessageBubbleProps) {
  const isUser = message.senderType === 'user';
  // Use displayContent if provided, otherwise use message.content
  const contentToDisplay = displayContent ?? message.content;

  const styles = senderStyles[message.senderType] || senderStyles.agent;

  // System messages are displayed differently
  if (message.senderType === 'system') {
    return (
      <div className="flex justify-center my-2" data-role="system" data-testid={`message-${message.id}`}>
        <div className={`px-4 py-2 rounded-full ${styles.bubble} text-xs`}>
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''} ${!isLastInGroup ? 'mb-1' : ''}`}
      data-role={isUser ? 'user' : message.senderType}
      data-testid={`message-${message.id}`}
    >
      {/* Avatar - only show for first message in group */}
      {isFirstInGroup ? (
        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg text-white shadow-md ${styles.avatar}`}>
          {message.senderIcon || (isUser ? '👤' : '🤖')}
        </div>
      ) : (
        <div className="w-10 flex-shrink-0" /> /* Spacer */
      )}

      {/* Message Content */}
      <div className={`flex flex-col max-w-[70%] ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Sender Info - only show for first message in group */}
        {isFirstInGroup && (
          <div className={`flex items-center gap-2 mb-1 ${isUser ? 'flex-row-reverse' : ''}`}>
            <span className={`text-xs font-semibold ${styles.name}`}>
              {message.senderName}
            </span>
            {message.senderRole && message.senderType !== 'user' && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${roleBadgeColors[message.senderRole.toLowerCase()] || 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
                {message.senderRole}
              </span>
            )}
          </div>
        )}

        {/* Message Bubble */}
        <div className={`px-4 py-2.5 ${styles.bubble} ${
          isUser
            ? `rounded-2xl ${isFirstInGroup ? 'rounded-tr-md' : ''} ${isLastInGroup ? '' : 'rounded-br-md'}`
            : `rounded-2xl ${isFirstInGroup ? 'rounded-tl-md' : ''} ${isLastInGroup ? '' : 'rounded-bl-md'}`
        }`}>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{contentToDisplay}</p>
        </div>

        {/* Task reference */}
        {message.taskId && isLastInGroup && (
          <div className="flex items-center gap-1 mt-1 text-[10px] text-gray-400 dark:text-gray-500">
            <span>📋</span>
            <span>{message.taskTitle || message.taskId}</span>
          </div>
        )}

        {/* Timestamp - only show for last message in group */}
        {isLastInGroup && (
          <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
            {formatTime(message.timestamp)}
          </span>
        )}
      </div>
    </div>
  );
}

export default ChatMessageBubble;
