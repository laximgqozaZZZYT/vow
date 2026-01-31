/**
 * Badge.AIAgent - AI Agent Badge Component
 *
 * Displays a badge indicating that an item was created by an AI agent.
 * Used on Stickies, Habits, and Goals that have the "AIエージェント" tag.
 */

'use client';

import type { Tag } from '../types/index';

/** The system tag name for AI-created items */
export const AI_AGENT_TAG_NAME = 'AIエージェント';

interface AIAgentBadgeProps {
  /** Optional size variant */
  size?: 'sm' | 'md';
  /** Optional custom class name */
  className?: string;
}

/**
 * Badge component showing AI agent indicator
 */
export function AIAgentBadge({ size = 'sm', className = '' }: AIAgentBadgeProps) {
  const sizeClasses = size === 'sm'
    ? 'px-1.5 py-0.5 text-xs gap-1'
    : 'px-2 py-1 text-sm gap-1.5';

  return (
    <span
      className={`
        inline-flex items-center ${sizeClasses}
        bg-purple-100 dark:bg-purple-900/30
        text-purple-600 dark:text-purple-400
        rounded font-medium
        ${className}
      `}
      title="AI エージェントが作成しました"
    >
      <span role="img" aria-label="robot">🤖</span>
      <span>AI</span>
    </span>
  );
}

/**
 * Check if the given tags array contains the AI Agent system tag
 *
 * @param tags - Array of tags to check
 * @returns true if the AIエージェント tag is present
 */
export function hasAIAgentTag(tags?: Tag[]): boolean {
  if (!tags || tags.length === 0) {
    return false;
  }
  return tags.some(tag => tag.name === AI_AGENT_TAG_NAME);
}

/**
 * Get the AI Agent tag from a tags array if it exists
 *
 * @param tags - Array of tags to search
 * @returns The AI Agent tag or undefined
 */
export function getAIAgentTag(tags?: Tag[]): Tag | undefined {
  if (!tags || tags.length === 0) {
    return undefined;
  }
  return tags.find(tag => tag.name === AI_AGENT_TAG_NAME);
}

export default AIAgentBadge;
