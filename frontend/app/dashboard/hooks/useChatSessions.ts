/**
 * useChatSessions Hook
 *
 * Manages multiple chat sessions with persistence to localStorage.
 * Each session can have a different agent role and maintains its own conversation history.
 *
 * @module hooks/useChatSessions
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import type { AgentRole } from '../constants/role-prompts';
import { getRoleConfig } from '../constants/role-prompts';
import {
  type ChatSession,
  type StoredSession,
  generateSessionId,
  getDefaultSessionName,
  getRandomSessionColor,
} from '../types/chat-session.types';

/**
 * Storage key for sessions in localStorage
 */
const SESSIONS_STORAGE_KEY = 'vow_chat_sessions';
const ACTIVE_SESSION_KEY = 'vow_active_session';

/**
 * Maximum number of sessions allowed
 */
const MAX_SESSIONS = 10;

/**
 * Hook options
 */
export interface UseChatSessionsOptions {
  /** User ID for user-specific session storage */
  userId?: string;
  /** Default locale */
  locale?: 'ja' | 'en';
  /** Callback when session changes */
  onSessionChange?: (session: ChatSession | null) => void;
}

/**
 * Hook return type
 */
export interface UseChatSessionsReturn {
  /** All sessions */
  sessions: ChatSession[];

  /** Currently active session */
  activeSession: ChatSession | null;

  /** Create a new session */
  createSession: (role: AgentRole, name?: string, agentId?: string) => ChatSession;

  /** Switch to a session */
  switchSession: (sessionId: string) => void;

  /** Delete a session */
  deleteSession: (sessionId: string) => void;

  /** Rename a session */
  renameSession: (sessionId: string, newName: string) => void;

  /** Update session after message sent */
  updateSessionActivity: (sessionId: string, messageCount?: number) => void;

  /** Clear all sessions */
  clearAllSessions: () => void;

  /** Check if can create more sessions */
  canCreateSession: boolean;

  /** Get MCP session ID for a session */
  getMcpSessionId: (sessionId: string) => string;
}

/**
 * Hook for managing multiple chat sessions
 */
export function useChatSessions(options: UseChatSessionsOptions = {}): UseChatSessionsReturn {
  const { userId, locale = 'ja', onSessionChange } = options;

  // Generate storage keys based on userId
  const getStorageKey = useCallback((key: string) => {
    return userId ? `${key}_${userId}` : key;
  }, [userId]);

  // State
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Load sessions from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const storedSessions = localStorage.getItem(getStorageKey(SESSIONS_STORAGE_KEY));
      const storedActiveId = localStorage.getItem(getStorageKey(ACTIVE_SESSION_KEY));

      if (storedSessions) {
        const parsed: StoredSession[] = JSON.parse(storedSessions);
        const loadedSessions: ChatSession[] = parsed.map(s => ({
          ...s,
          createdAt: new Date(s.createdAt),
          updatedAt: new Date(s.updatedAt),
          isActive: s.id === storedActiveId,
          icon: getRoleConfig(s.role).icon,
        }));

        setSessions(loadedSessions);
        console.log('[useChatSessions] Loaded sessions:', loadedSessions.length);
      }

      if (storedActiveId) {
        setActiveSessionId(storedActiveId);
      }
    } catch (err) {
      console.error('[useChatSessions] Failed to load sessions:', err);
    }
  }, [getStorageKey]);

  // Save sessions to localStorage whenever they change
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (sessions.length === 0) return;

    try {
      const toStore: StoredSession[] = sessions.map(s => ({
        id: s.id,
        name: s.name,
        role: s.role,
        agentId: s.agentId,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
        messageCount: s.messageCount,
      }));

      localStorage.setItem(getStorageKey(SESSIONS_STORAGE_KEY), JSON.stringify(toStore));
      console.log('[useChatSessions] Saved sessions:', sessions.length);
    } catch (err) {
      console.error('[useChatSessions] Failed to save sessions:', err);
    }
  }, [sessions, getStorageKey]);

  // Save active session ID
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (activeSessionId) {
      localStorage.setItem(getStorageKey(ACTIVE_SESSION_KEY), activeSessionId);
    } else {
      localStorage.removeItem(getStorageKey(ACTIVE_SESSION_KEY));
    }
  }, [activeSessionId, getStorageKey]);

  // Get active session
  const activeSession = useMemo(() => {
    return sessions.find(s => s.id === activeSessionId) || null;
  }, [sessions, activeSessionId]);

  // Notify on session change
  useEffect(() => {
    if (onSessionChange) {
      onSessionChange(activeSession);
    }
  }, [activeSession, onSessionChange]);

  // Create a new session
  const createSession = useCallback((
    role: AgentRole,
    name?: string,
    agentId?: string
  ): ChatSession => {
    const roleConfig = getRoleConfig(role);
    const sessionId = generateSessionId();

    const newSession: ChatSession = {
      id: sessionId,
      name: name || getDefaultSessionName(role, locale),
      role,
      agentId,
      createdAt: new Date(),
      updatedAt: new Date(),
      messageCount: 0,
      isActive: true,
      icon: roleConfig.icon,
      color: getRandomSessionColor(),
    };

    setSessions(prev => {
      // Deactivate all other sessions
      const updated = prev.map(s => ({ ...s, isActive: false }));

      // Limit to MAX_SESSIONS
      if (updated.length >= MAX_SESSIONS) {
        // Remove oldest session
        updated.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        updated.pop();
      }

      return [...updated, newSession];
    });

    setActiveSessionId(sessionId);
    console.log('[useChatSessions] Created session:', { id: sessionId, role, name: newSession.name });

    return newSession;
  }, [locale]);

  // Switch to a session
  const switchSession = useCallback((sessionId: string) => {
    setSessions(prev => prev.map(s => ({
      ...s,
      isActive: s.id === sessionId,
    })));
    setActiveSessionId(sessionId);
    console.log('[useChatSessions] Switched to session:', sessionId);
  }, []);

  // Delete a session
  const deleteSession = useCallback((sessionId: string) => {
    setSessions(prev => {
      const filtered = prev.filter(s => s.id !== sessionId);

      // If deleting active session, switch to most recent
      if (sessionId === activeSessionId && filtered.length > 0) {
        const mostRecent = filtered.sort((a, b) =>
          b.updatedAt.getTime() - a.updatedAt.getTime()
        )[0];
        setActiveSessionId(mostRecent.id);
        return filtered.map(s => ({
          ...s,
          isActive: s.id === mostRecent.id,
        }));
      }

      return filtered;
    });

    // Clear MCP session from localStorage
    if (typeof window !== 'undefined') {
      const mcpSessionKey = `vow_mcp_session_${sessionId}`;
      localStorage.removeItem(mcpSessionKey);
    }

    console.log('[useChatSessions] Deleted session:', sessionId);
  }, [activeSessionId]);

  // Rename a session
  const renameSession = useCallback((sessionId: string, newName: string) => {
    setSessions(prev => prev.map(s =>
      s.id === sessionId
        ? { ...s, name: newName, updatedAt: new Date() }
        : s
    ));
    console.log('[useChatSessions] Renamed session:', { id: sessionId, newName });
  }, []);

  // Update session activity (called after sending a message)
  const updateSessionActivity = useCallback((sessionId: string, messageCount?: number) => {
    setSessions(prev => prev.map(s =>
      s.id === sessionId
        ? {
            ...s,
            updatedAt: new Date(),
            messageCount: messageCount ?? (s.messageCount + 1),
          }
        : s
    ));
  }, []);

  // Clear all sessions
  const clearAllSessions = useCallback(() => {
    setSessions([]);
    setActiveSessionId(null);

    if (typeof window !== 'undefined') {
      localStorage.removeItem(getStorageKey(SESSIONS_STORAGE_KEY));
      localStorage.removeItem(getStorageKey(ACTIVE_SESSION_KEY));
    }

    console.log('[useChatSessions] Cleared all sessions');
  }, [getStorageKey]);

  // Check if can create more sessions
  const canCreateSession = sessions.length < MAX_SESSIONS;

  // Get MCP session ID for a session
  // This maps our session ID to the MCP server's session format
  const getMcpSessionId = useCallback((sessionId: string): string => {
    return `mcp-${sessionId}`;
  }, []);

  return {
    sessions,
    activeSession,
    createSession,
    switchSession,
    deleteSession,
    renameSession,
    updateSessionActivity,
    clearAllSessions,
    canCreateSession,
    getMcpSessionId,
  };
}

export default useChatSessions;
