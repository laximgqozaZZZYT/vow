/**
 * useChatSessions Hook
 *
 * Manages multiple chat sessions with persistence to localStorage.
 * Each session can have a different agent role and maintains its own conversation history.
 *
 * @module hooks/useChatSessions
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { AgentRole } from '../constants/role-prompts';
import { getRoleConfig } from '../constants/role-prompts';
import {
  type ChatSession,
  type StoredSession,
  generateSessionId,
  getDefaultSessionName,
  getRandomSessionColor,
} from '../types/chat-session.types';
import { saveConversation, listConversations } from '../../../lib/api';

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
  /** Enable backend sync for conversation persistence */
  enableBackendSync?: boolean;
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

  /** Sync a session's messages to backend */
  syncToBackend: (sessionId: string, messages: Array<{ role: string; content: string; timestamp?: string }>) => void;

  /** Fetch sessions from backend */
  fetchFromBackend: () => Promise<void>;
}

/**
 * Hook for managing multiple chat sessions
 */
export function useChatSessions(options: UseChatSessionsOptions = {}): UseChatSessionsReturn {
  const { userId, locale = 'ja', onSessionChange, enableBackendSync = false } = options;
  const syncInFlightRef = useRef<Set<string>>(new Set());

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

  // Sync messages to backend (fire-and-forget)
  const syncToBackend = useCallback((
    sessionId: string,
    messages: Array<{ role: string; content: string; timestamp?: string }>
  ) => {
    if (!enableBackendSync || !userId) return;
    if (syncInFlightRef.current.has(sessionId)) return;

    syncInFlightRef.current.add(sessionId);
    saveConversation(sessionId, messages, { source: 'frontend' })
      .catch(err => console.error('[useChatSessions] Backend sync failed:', err))
      .finally(() => syncInFlightRef.current.delete(sessionId));
  }, [enableBackendSync, userId]);

  // Fetch sessions from backend and merge with local
  const fetchFromBackend = useCallback(async () => {
    if (!enableBackendSync || !userId) return;

    try {
      const data = await listConversations(MAX_SESSIONS);
      if (!data?.conversations?.length) return;

      setSessions(prev => {
        const localIds = new Set(prev.map(s => s.id));
        const newSessions: ChatSession[] = [];

        for (const conv of data.conversations) {
          if (!localIds.has(conv.id)) {
            newSessions.push({
              id: conv.id,
              name: `Session ${conv.id.slice(0, 6)}`,
              role: 'AICoach' as AgentRole,
              createdAt: new Date(conv.createdAt),
              updatedAt: new Date(conv.lastActivityAt),
              messageCount: conv.messageCount,
              isActive: false,
              icon: getRoleConfig('AICoach').icon,
            });
          }
        }

        return newSessions.length > 0 ? [...prev, ...newSessions] : prev;
      });
    } catch (err) {
      console.error('[useChatSessions] Backend fetch failed:', err);
    }
  }, [enableBackendSync, userId]);

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
    syncToBackend,
    fetchFromBackend,
  };
}

export default useChatSessions;
