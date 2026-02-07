/**
 * Chat Session Types
 *
 * Types for managing multiple chat sessions with different agents.
 *
 * @module types/chat-session.types
 */

import type { AgentRole } from '../constants/role-prompts';
import type { GroupChatMessage } from '../hooks/useMOCChat';

/**
 * Chat session configuration
 */
export interface ChatSession {
  /** Unique session ID */
  id: string;

  /** Display name for the session */
  name: string;

  /** Agent role for this session */
  role: AgentRole;

  /** Optional agent ID (for MCP agents) */
  agentId?: string;

  /** Session creation time */
  createdAt: Date;

  /** Last activity time */
  updatedAt: Date;

  /** Number of messages in this session */
  messageCount: number;

  /** Whether this session is currently active */
  isActive: boolean;

  /** Session icon (derived from role or custom) */
  icon?: string;

  /** Session color for visual distinction */
  color?: string;
}

/**
 * Chat session with messages (for full session data)
 */
export interface ChatSessionWithMessages extends ChatSession {
  /** Messages in this session */
  messages: GroupChatMessage[];
}

/**
 * Session storage format for localStorage
 */
export interface StoredSession {
  id: string;
  name: string;
  role: AgentRole;
  agentId?: string;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  messageCount: number;
}

/**
 * Session manager state
 */
export interface SessionManagerState {
  /** All available sessions */
  sessions: ChatSession[];

  /** Currently active session ID */
  activeSessionId: string | null;

  /** Loading state */
  isLoading: boolean;

  /** Error state */
  error: Error | null;
}

/**
 * Session manager actions
 */
export interface SessionManagerActions {
  /** Create a new session */
  createSession: (name: string, role: AgentRole, agentId?: string) => ChatSession;

  /** Switch to a different session */
  switchSession: (sessionId: string) => void;

  /** Delete a session */
  deleteSession: (sessionId: string) => void;

  /** Rename a session */
  renameSession: (sessionId: string, newName: string) => void;

  /** Update session message count */
  updateMessageCount: (sessionId: string, count: number) => void;

  /** Clear all sessions */
  clearAllSessions: () => void;

  /** Get session by ID */
  getSession: (sessionId: string) => ChatSession | undefined;

  /** Get active session */
  getActiveSession: () => ChatSession | undefined;
}

/**
 * Default session names by role (Japanese)
 */
export const DEFAULT_SESSION_NAMES_JA: Record<AgentRole, string> = {
  AICoach: 'AIコーチ',
  coach: 'AIコーチ',
  manager: 'マネージャー',
  developer: '開発者',
  reviewer: 'レビュアー',
  tester: 'テスター',
  analyst: 'アナリスト',
  architect: 'アーキテクト',
  default: 'アシスタント',
};

/**
 * Default session names by role (English)
 */
export const DEFAULT_SESSION_NAMES_EN: Record<AgentRole, string> = {
  AICoach: 'AI Coach',
  coach: 'AI Coach',
  manager: 'Manager',
  developer: 'Developer',
  reviewer: 'Reviewer',
  tester: 'Tester',
  analyst: 'Analyst',
  architect: 'Architect',
  default: 'Assistant',
};

/**
 * Session colors for visual distinction
 */
export const SESSION_COLORS: string[] = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#84CC16', // lime
];

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Get default session name for a role
 */
export function getDefaultSessionName(role: AgentRole, locale: 'ja' | 'en' = 'ja'): string {
  const names = locale === 'ja' ? DEFAULT_SESSION_NAMES_JA : DEFAULT_SESSION_NAMES_EN;
  return names[role] || names.default;
}

/**
 * Get a random session color
 */
export function getRandomSessionColor(): string {
  return SESSION_COLORS[Math.floor(Math.random() * SESSION_COLORS.length)];
}
