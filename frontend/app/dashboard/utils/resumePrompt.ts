/**
 * Resume Prompt Builder
 *
 * Loads the resume prompt template from a Markdown file and fills in
 * the conversation history context.
 *
 * @module utils/resumePrompt
 */

import type { GroupChatMessage } from '../types/moc.types';
import templateMd from '../prompts/resume-conversation.md';

/**
 * Extract human-readable content from a message that may contain raw JSON
 * (AI candidate responses embed JSON in the message content).
 */
function extractReadableContent(content: string): string {
  if (!content) return '';

  const trimmed = content.trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed.message === 'string' && parsed.message.length > 0) {
        return parsed.message;
      }
    } catch {
      // Not valid JSON, fall through
    }
  }

  // If content has JSON embedded after readable text
  const jsonStart = content.indexOf('{');
  if (jsonStart > 20) {
    const beforeJson = content.substring(0, jsonStart).trim();
    if (beforeJson.length > 10) {
      return beforeJson;
    }
  }

  // Truncate very long messages
  if (content.length > 500) {
    return content.substring(0, 500) + '...';
  }

  return content;
}

/**
 * Build a resume prompt from conversation history context.
 *
 * @param contextMessages - Array of past messages (up to ~10) ending at the resume point
 * @returns The formatted resume prompt string to send as a user message
 */
export function buildResumePrompt(contextMessages: GroupChatMessage[]): string {
  if (contextMessages.length === 0) {
    return '前回の会話を続けたいです。';
  }

  const formattedHistory = contextMessages
    .map((msg) => {
      const role = msg.senderType === 'user' ? 'ユーザー'
        : msg.senderType === 'coach' ? 'AIコーチ'
        : msg.senderName;

      const content = extractReadableContent(msg.content);
      return `[${role}]: ${content}`;
    })
    .join('\n\n');

  return templateMd.replace('{{CONVERSATION_HISTORY}}', formattedHistory);
}

export default buildResumePrompt;
