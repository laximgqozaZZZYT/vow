/**
 * useMOCChatPersistence Hook
 *
 * Manages chat history persistence for the MOC section so that
 * messages survive page reloads. Uses the backend conversations API
 * (DynamoDB session store) for storage.
 *
 * Features:
 * - Stores conversationId in localStorage
 * - Loads previous messages on mount
 * - Saves user+assistant message pairs after each completion
 * - Creates new conversations or appends to existing ones
 * - Converts between MastraMessage and CoachMessage formats
 * - Handles errors gracefully (never blocks chat)
 *
 * @module hooks/useMOCChatPersistence
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { MastraMessage } from './useMcpChat';

// =============================================================================
// Constants
// =============================================================================

const BACKEND_API_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL || '';
const CONVERSATION_ID_KEY = 'vow_moc_conversation_id';

// =============================================================================
// Types
// =============================================================================

/** Message format returned by the backend conversations API */
interface BackendMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  toolCalls?: Array<{
    toolName: string;
    input: Record<string, unknown>;
    output: unknown;
    success: boolean;
    durationMs?: number;
    error?: string;
  }>;
}

/** Return type for the persistence hook */
export interface UseMOCChatPersistenceReturn {
  /** Current conversation ID (null if no conversation started) */
  conversationId: string | null;
  /** Messages loaded from the backend on mount */
  loadedMessages: MastraMessage[];
  /** Whether messages are currently being loaded from the backend */
  isLoading: boolean;
  /** Save a user+assistant message pair to the backend */
  saveMessage: (userMsg: MastraMessage, assistantMsg: MastraMessage) => Promise<void>;
  /** Clear the current conversation and start fresh */
  startNewConversation: () => void;
}

// =============================================================================
// Helpers
// =============================================================================

/** Generate a unique session/conversation ID */
function generateConversationId(userId?: string): string {
  const userPart = userId || 'anon';
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `moc-conv-${userPart}-${timestamp}-${random}`;
}

/** Convert a MastraMessage to the backend CoachMessage format */
function toBackendMessage(msg: MastraMessage): BackendMessage {
  return {
    role: msg.role,
    content: msg.content,
    timestamp: msg.timestamp instanceof Date
      ? msg.timestamp.toISOString()
      : new Date().toISOString(),
    toolCalls: msg.toolCalls,
  };
}

/** Convert a backend message to MastraMessage format */
function toMastraMessage(msg: BackendMessage, index: number): MastraMessage {
  return {
    id: `loaded-${index}-${Date.now()}`,
    role: msg.role,
    content: msg.content,
    status: 'complete' as const,
    timestamp: new Date(msg.timestamp),
    toolCalls: msg.toolCalls,
  };
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Hook for persisting MOC chat history to the backend conversations API.
 *
 * @param authToken - Bearer token for backend API authentication
 * @param userId - User ID for conversation isolation
 */
export function useMOCChatPersistence(
  authToken: string | null | undefined,
  userId?: string,
): UseMOCChatPersistenceReturn {
  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------
  const [conversationId, setConversationId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(CONVERSATION_ID_KEY);
  });
  const [loadedMessages, setLoadedMessages] = useState<MastraMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Track whether initial load has been attempted (to avoid repeated fetches)
  const hasLoadedRef = useRef(false);
  // Track in-flight save to avoid double-saves
  const isSavingRef = useRef(false);

  // -------------------------------------------------------------------------
  // loadMessages - Fetch existing messages from backend on mount
  // -------------------------------------------------------------------------
  useEffect(() => {
    // Only load once, and only if we have a conversationId and auth token
    if (hasLoadedRef.current) return;
    if (!conversationId || !authToken || !BACKEND_API_URL) return;

    hasLoadedRef.current = true;
    setIsLoading(true);

    const fetchMessages = async () => {
      try {
        const response = await fetch(
          `${BACKEND_API_URL}/api/conversations/${encodeURIComponent(conversationId)}/messages?limit=100`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json',
            },
          },
        );

        if (!response.ok) {
          // If 404, the conversation no longer exists; clear local reference
          if (response.status === 404) {
            console.warn('[useMOCChatPersistence] Conversation not found, clearing local ID');
            localStorage.removeItem(CONVERSATION_ID_KEY);
            setConversationId(null);
            return;
          }
          // If 402 (premium required), silently skip loading
          if (response.status === 402) {
            console.info('[useMOCChatPersistence] Premium required for history, skipping load');
            return;
          }
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const messages: BackendMessage[] = data.messages || [];

        if (messages.length > 0) {
          const converted = messages.map(toMastraMessage);
          setLoadedMessages(converted);
          console.log('[useMOCChatPersistence] Loaded messages from backend:', {
            conversationId,
            count: converted.length,
          });
        }
      } catch (err) {
        // Don't block the chat if loading fails
        console.error('[useMOCChatPersistence] Failed to load messages:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMessages();
  }, [conversationId, authToken]);

  // -------------------------------------------------------------------------
  // saveMessage - Persist a user+assistant pair to the backend
  // -------------------------------------------------------------------------
  const saveMessage = useCallback(
    async (userMsg: MastraMessage, assistantMsg: MastraMessage): Promise<void> => {
      if (!authToken || !BACKEND_API_URL) return;
      if (isSavingRef.current) return;

      isSavingRef.current = true;

      try {
        const messagesToSave = [
          toBackendMessage(userMsg),
          toBackendMessage(assistantMsg),
        ];

        if (conversationId) {
          // Append to existing conversation
          const response = await fetch(
            `${BACKEND_API_URL}/api/conversations/${encodeURIComponent(conversationId)}/messages`,
            {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ messages: messagesToSave }),
            },
          );

          if (!response.ok) {
            // If 404, the conversation was deleted; create a new one
            if (response.status === 404) {
              console.warn('[useMOCChatPersistence] Conversation gone, creating new one');
              await createNewConversation(messagesToSave);
              return;
            }
            throw new Error(`PUT failed: HTTP ${response.status}`);
          }

          console.log('[useMOCChatPersistence] Appended messages to conversation:', {
            conversationId,
            count: messagesToSave.length,
          });
        } else {
          // Create new conversation
          await createNewConversation(messagesToSave);
        }
      } catch (err) {
        // Don't block the chat if save fails
        console.error('[useMOCChatPersistence] Failed to save messages:', err);
      } finally {
        isSavingRef.current = false;
      }
    },
    [authToken, conversationId, userId],
  );

  // -------------------------------------------------------------------------
  // createNewConversation - POST to create a new conversation
  // -------------------------------------------------------------------------
  const createNewConversation = useCallback(
    async (messages: BackendMessage[]): Promise<void> => {
      if (!authToken || !BACKEND_API_URL) return;

      const newId = generateConversationId(userId);

      try {
        const response = await fetch(`${BACKEND_API_URL}/api/conversations`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId: newId,
            messages,
            metadata: {
              source: 'moc-chat',
              agentType: 'coach',
            },
          }),
        });

        if (!response.ok) {
          throw new Error(`POST failed: HTTP ${response.status}`);
        }

        // Persist the new conversation ID
        localStorage.setItem(CONVERSATION_ID_KEY, newId);
        setConversationId(newId);

        console.log('[useMOCChatPersistence] Created new conversation:', {
          conversationId: newId,
          messageCount: messages.length,
        });
      } catch (err) {
        console.error('[useMOCChatPersistence] Failed to create conversation:', err);
      }
    },
    [authToken, userId],
  );

  // -------------------------------------------------------------------------
  // startNewConversation - Clear current and start fresh
  // -------------------------------------------------------------------------
  const startNewConversation = useCallback(() => {
    localStorage.removeItem(CONVERSATION_ID_KEY);
    setConversationId(null);
    setLoadedMessages([]);
    hasLoadedRef.current = false;
    console.log('[useMOCChatPersistence] Started new conversation');
  }, []);

  // -------------------------------------------------------------------------
  // Return
  // -------------------------------------------------------------------------
  return {
    conversationId,
    loadedMessages,
    isLoading,
    saveMessage,
    startNewConversation,
  };
}

export default useMOCChatPersistence;
