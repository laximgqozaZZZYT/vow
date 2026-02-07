/**
 * useProviderChat Hook
 *
 * React hook for streaming AI chat via the backend provider-chat SSE endpoint.
 * Supports OpenAI, Anthropic, Gemini, Codex providers.
 * Returns the same UseMastraAgentReturn interface as useMcpChat for seamless switching.
 *
 * @module hooks/useProviderChat
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { MastraMessage, UseMastraAgentReturn } from './useMcpChat';
import {
  validateUserInput,
  sanitizeInput,
  getViolationMessage,
  logViolation,
} from '../utils/chatGuardrails';

// =============================================================================
// Types
// =============================================================================

export interface UseProviderChatOptions {
  /** Provider identifier: 'openai' | 'anthropic' | 'gemini' | 'codex' */
  provider: string;
  /** Optional model override */
  model?: string;
  /** System prompt for the AI */
  systemPrompt: string;
  /** Auth token for backend API */
  authToken: string | null;
}

// =============================================================================
// Constants
// =============================================================================

const BACKEND_API_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL || '';

// =============================================================================
// Helpers
// =============================================================================

function generateMessageId(): string {
  return `provider-msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Safely extract a human-readable error message from an unknown error payload.
 * Prevents the [object Object] bug by always returning a string.
 */
function extractErrorMessage(data: unknown): string {
  if (typeof data === 'string') return data;
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (typeof obj.message === 'string') return obj.message;
    if (typeof obj.error === 'string') return obj.error;
    try {
      return JSON.stringify(data);
    } catch {
      return 'Unknown error';
    }
  }
  return String(data);
}

// =============================================================================
// Hook
// =============================================================================

export function useProviderChat(options: UseProviderChatOptions): UseMastraAgentReturn {
  const { provider, model, systemPrompt, authToken } = options;

  // State
  const [messages, setMessages] = useState<MastraMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [connectionState, setConnectionState] = useState<'idle' | 'connecting' | 'streaming' | 'error'>('idle');

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastUserMessageRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  /**
   * Build conversation history from current messages (excluding system messages).
   */
  const buildConversationHistory = useCallback((): Array<{ role: 'user' | 'assistant'; content: string }> => {
    return messages
      .filter((m) => m.role !== 'system' && m.status === 'complete' && m.content)
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));
  }, [messages]);

  /**
   * Send a message to the provider chat endpoint.
   */
  const sendMessage = useCallback(async (message: string): Promise<void> => {
    if (!message.trim()) return;

    // Guardrail: sanitize and validate
    const sanitized = sanitizeInput(message);
    const validation = validateUserInput(sanitized);

    if (!validation.allowed) {
      logViolation(validation, { agentType: 'Provider', sessionId: provider });
      const violationError = new Error(getViolationMessage(validation, 'ja'));
      setError(violationError);
      setConnectionState('error');
      return;
    }

    if (!authToken) {
      setError(new Error('認証トークンがありません。ログインしてください。'));
      setConnectionState('error');
      return;
    }

    if (!BACKEND_API_URL) {
      setError(new Error('バックエンドAPIのURLが設定されていません。'));
      setConnectionState('error');
      return;
    }

    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    lastUserMessageRef.current = message;
    setError(null);
    setConnectionState('connecting');

    // Add user message
    const userMessage: MastraMessage = {
      id: generateMessageId(),
      role: 'user',
      content: message,
      status: 'complete',
      timestamp: new Date(),
    };

    // Add placeholder for assistant response
    const assistantMessageId = generateMessageId();
    const assistantMessage: MastraMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      status: 'pending',
      timestamp: new Date(),
    };

    // Build history before adding the new messages
    const history = buildConversationHistory();

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setIsStreaming(true);

    let fullContent = '';

    try {
      const response = await fetch(`${BACKEND_API_URL}/api/provider-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          message: sanitized,
          systemPrompt,
          provider,
          ...(model && { model }),
          ...(sessionIdRef.current && { sessionId: sessionIdRef.current }),
          ...(history.length > 0 && { conversationHistory: history }),
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        let errMsg: string;
        try {
          const errData = await response.json();
          errMsg = extractErrorMessage(errData);
        } catch {
          errMsg = `API error: ${response.status} ${response.statusText}`;
        }
        throw new Error(errMsg);
      }

      const contentType = response.headers.get('Content-Type') || '';

      if (contentType.includes('text/event-stream')) {
        // SSE streaming response (local development / non-Lambda environments)
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }

        setConnectionState('streaming');

        const decoder = new TextDecoder();
        let buffer = '';
        let currentEventType: string | null = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();

            // Parse SSE event type
            if (trimmed.startsWith('event:')) {
              currentEventType = trimmed.slice(6).trim();
              continue;
            }

            // Parse SSE data
            if (trimmed.startsWith('data:')) {
              const jsonStr = trimmed.slice(5).trim();

              // Handle [DONE] marker
              if (jsonStr === '[DONE]') {
                currentEventType = null;
                continue;
              }

              try {
                const data = JSON.parse(jsonStr);
                const eventType = currentEventType || data.type;

                if (eventType === 'session') {
                  if (data.sessionId) {
                    sessionIdRef.current = data.sessionId;
                  }
                } else if (eventType === 'token' || eventType === 'text') {
                  const token = data.token || data.text || data.content || '';
                  if (token) {
                    fullContent += token;
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === assistantMessageId
                          ? { ...msg, content: fullContent, status: 'streaming' as const }
                          : msg
                      )
                    );
                  }
                } else if (eventType === 'complete' || eventType === 'done') {
                  if (data.sessionId) {
                    sessionIdRef.current = data.sessionId;
                  }
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId
                        ? {
                            ...msg,
                            content: fullContent || data.content || '',
                            status: 'complete' as const,
                          }
                        : msg
                    )
                  );
                } else if (eventType === 'error') {
                  const errMsg = extractErrorMessage(data);
                  fullContent = errMsg;
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId
                        ? { ...msg, content: errMsg, status: 'error' as const }
                        : msg
                    )
                  );
                }
              } catch {
                // Non-JSON data — treat as raw text token
                if (jsonStr) {
                  fullContent += jsonStr;
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId
                        ? { ...msg, content: fullContent, status: 'streaming' as const }
                        : msg
                    )
                  );
                }
              }

              currentEventType = null;
            }
          }
        }
      } else {
        // JSON bulk response (Lambda environment fallback)
        setConnectionState('streaming');
        const data = await response.json();

        if (data.error) {
          throw new Error(extractErrorMessage(data));
        }

        if (data.sessionId) {
          sessionIdRef.current = data.sessionId;
        }

        fullContent = data.content || '';
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: fullContent, status: 'complete' as const }
              : msg
          )
        );
      }

      // Stream finished — ensure message is complete
      setIsStreaming(false);
      setConnectionState('idle');

      if (!fullContent) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: '応答がありませんでした。', status: 'error' as const }
              : msg
          )
        );
      } else {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId && msg.status !== 'complete'
              ? { ...msg, content: fullContent, status: 'complete' as const }
              : msg
          )
        );
      }
    } catch (err) {
      setIsStreaming(false);

      // Handle abort
      if (err instanceof Error && err.name === 'AbortError') {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, status: 'complete' as const, content: fullContent || '(通信が中断されました)' }
              : msg
          )
        );
        setConnectionState('idle');
        return;
      }

      // Recover partial content on stream error
      if (fullContent) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: fullContent, status: 'complete' as const }
              : msg
          )
        );
        setConnectionState('idle');
        return;
      }

      const errorObj = err instanceof Error ? err : new Error(extractErrorMessage(err));
      setError(errorObj);
      setConnectionState('error');
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? { ...msg, content: `Error: ${errorObj.message}`, status: 'error' as const }
            : msg
        )
      );
    }
  }, [provider, model, systemPrompt, authToken, buildConversationHistory]);

  /**
   * Clear all messages and reset session.
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
    setConnectionState('idle');
    lastUserMessageRef.current = null;
    sessionIdRef.current = null;
  }, []);

  /**
   * Clear error state.
   */
  const clearError = useCallback(() => {
    setError(null);
    if (connectionState === 'error') {
      setConnectionState('idle');
    }
  }, [connectionState]);

  /**
   * Retry the last failed message.
   */
  const retry = useCallback(async () => {
    if (!lastUserMessageRef.current) return;

    // Remove the last failed exchange
    setMessages((prev) => {
      const newMessages = [...prev];
      if (newMessages.length >= 2) {
        const lastMsg = newMessages[newMessages.length - 1];
        const secondLast = newMessages[newMessages.length - 2];
        if (lastMsg.role === 'assistant' && lastMsg.status === 'error' && secondLast.role === 'user') {
          newMessages.pop();
          newMessages.pop();
        }
      }
      return newMessages;
    });

    await sendMessage(lastUserMessageRef.current);
  }, [sendMessage]);

  /**
   * Cancel the current streaming request.
   */
  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setConnectionState('idle');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    sendMessage,
    messages,
    isStreaming,
    error,
    clearMessages,
    clearError,
    retry,
    cancelStream,
    connectionState,
  };
}

export default useProviderChat;
