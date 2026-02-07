/**
 * useProviderChat Hook
 *
 * React hook for communicating with API provider chat (OpenAI, Anthropic, etc.)
 * via the backend's `/api/ai/provider-chat` SSE endpoint.
 *
 * Returns the exact same UseMastraAgentReturn interface as useMcpChat so it
 * can be used as a drop-in replacement.
 *
 * Features:
 * - Standard chat agent interface (MastraMessage, UseMastraAgentReturn)
 * - Streaming response support via SSE
 * - Message history management
 * - Conversation history sent with each request
 *
 * @module hooks/useProviderChat
 */

import { useState, useCallback, useRef } from 'react';
import type { MastraMessage, UseMastraAgentReturn } from './useMcpChat';

// =============================================================================
// Types
// =============================================================================

export interface UseProviderChatOptions {
  /** Auth token for backend API */
  authToken: string | null;
  /** Provider identifier: 'openai', 'anthropic', etc. */
  provider: string;
  /** Model identifier (optional, backend will use default if omitted) */
  model?: string;
  /** System prompt to send with each request */
  systemMessage?: string;
  /** User ID for session isolation */
  userId?: string;
  /** Callback when a message is received */
  onMessage?: (message: MastraMessage) => void;
  /** Callback when an error occurs */
  onError?: (error: Error) => void;
}

// =============================================================================
// Helpers
// =============================================================================

/** Generate a unique message ID */
function generateMessageId(): string {
  return `provider-msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const BACKEND_API_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL || '';

// =============================================================================
// Hook
// =============================================================================

/**
 * Hook for communicating with API providers via the backend provider-chat endpoint.
 * Returns the standard chat agent interface (UseMastraAgentReturn).
 */
export function useProviderChat(options: UseProviderChatOptions): UseMastraAgentReturn {
  const {
    authToken,
    provider,
    model,
    systemMessage,
    userId,
    onMessage,
    onError,
  } = options;

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const [messages, setMessages] = useState<MastraMessage[]>(() => {
    if (systemMessage) {
      return [{
        id: generateMessageId(),
        role: 'system' as const,
        content: systemMessage,
        status: 'complete' as const,
        timestamp: new Date(),
      }];
    }
    return [];
  });
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [connectionState, setConnectionState] = useState<
    'idle' | 'connecting' | 'streaming' | 'error'
  >('idle');

  // ---------------------------------------------------------------------------
  // Refs
  // ---------------------------------------------------------------------------
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastUserMessageRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  // ---------------------------------------------------------------------------
  // sendMessage
  // ---------------------------------------------------------------------------
  const sendMessage = useCallback(
    async (message: string): Promise<void> => {
      if (!message.trim()) return;
      if (!authToken) {
        const err = new Error('Not authenticated');
        setError(err);
        setConnectionState('error');
        onError?.(err);
        return;
      }

      // Cancel any ongoing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      // Store for retry
      lastUserMessageRef.current = message;

      // Clear previous error
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

      setMessages(prev => [...prev, userMessage, assistantMessage]);
      setIsStreaming(true);

      // Build conversation history from existing messages (before adding new ones)
      // We read from the current closure's messages state (pre-update)
      const conversationHistory = messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      let fullContent = '';
      let lastServerError: string | null = null;

      try {
        setConnectionState('streaming');

        const requestBody = {
          message: message,
          systemPrompt: systemMessage,
          provider: provider,
          model: model,
          sessionId: sessionIdRef.current,
          conversationHistory,
          userId: userId,
        };

        console.log('[useProviderChat] Sending request:', {
          provider,
          model,
          hasSystemPrompt: !!systemMessage,
          systemPromptLength: systemMessage?.length ?? 0,
          historyLength: conversationHistory.length,
          sessionId: sessionIdRef.current,
        });

        const response = await fetch(`${BACKEND_API_URL}/api/ai/provider-chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream',
            'Authorization': `Bearer ${authToken}`,
          },
          body: JSON.stringify(requestBody),
          signal: abortControllerRef.current?.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({
            message: `HTTP ${response.status} ${response.statusText}`,
          }));
          throw new Error(
            errorData.message || errorData.error || `HTTP ${response.status}`,
          );
        }

        // ------------------------------------------------------------------
        // SSE streaming parser (same pattern as useMcpChat.ts)
        // ------------------------------------------------------------------
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }

        const decoder = new TextDecoder();
        let buffer = '';
        let currentEventType: string | null = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            const trimmedLine = line.trim();

            // Parse SSE event type line (e.g., "event: token")
            if (trimmedLine.startsWith('event:')) {
              currentEventType = trimmedLine.slice(6).trim();
              continue;
            }

            // Parse SSE data line (e.g., "data: {...}")
            if (trimmedLine.startsWith('data:')) {
              const jsonStr = trimmedLine.slice(5).trim();

              // Handle [DONE] marker
              if (jsonStr === '[DONE]') {
                currentEventType = null;
                continue;
              }

              try {
                const data = JSON.parse(jsonStr);

                // Determine effective event type:
                // prefer SSE event: line, fallback to data.type
                const effectiveType = currentEventType || data.type;

                if (
                  (effectiveType === 'session' || effectiveType === 'start') &&
                  data.sessionId
                ) {
                  // Save sessionId for conversation continuity
                  console.log(
                    '[useProviderChat] Received sessionId:',
                    data.sessionId,
                  );
                  sessionIdRef.current = data.sessionId;
                } else if (
                  effectiveType === 'token' ||
                  effectiveType === 'text'
                ) {
                  const token =
                    data.token || data.text || data.content || '';
                  if (token) {
                    fullContent += token;
                    setMessages(prev =>
                      prev.map(msg =>
                        msg.id === assistantMessageId
                          ? {
                              ...msg,
                              content: fullContent,
                              status: 'streaming' as const,
                            }
                          : msg,
                      ),
                    );
                  }
                } else if (
                  effectiveType === 'complete' ||
                  effectiveType === 'done'
                ) {
                  // Update sessionId if provided in complete event
                  if (data.sessionId) {
                    sessionIdRef.current = data.sessionId;
                  }

                  setMessages(prev =>
                    prev.map(msg =>
                      msg.id === assistantMessageId
                        ? {
                            ...msg,
                            content:
                              fullContent ||
                              data.content ||
                              data.message ||
                              '',
                            status: 'complete' as const,
                          }
                        : msg,
                    ),
                  );
                } else if (effectiveType === 'error') {
                  lastServerError =
                    data.error ||
                    data.message ||
                    'Unknown error from provider';
                  console.error(
                    '[useProviderChat] Server error:',
                    lastServerError,
                  );
                  setMessages(prev =>
                    prev.map(msg =>
                      msg.id === assistantMessageId
                        ? {
                            ...msg,
                            content: lastServerError || 'Error',
                            status: 'error' as const,
                          }
                        : msg,
                    ),
                  );
                } else {
                  // Fallback: try to extract content from various field names
                  const content =
                    data.token ||
                    data.text ||
                    data.content ||
                    data.delta?.content ||
                    data.choices?.[0]?.delta?.content ||
                    data.choices?.[0]?.message?.content;

                  if (content) {
                    fullContent += content;
                    setMessages(prev =>
                      prev.map(msg =>
                        msg.id === assistantMessageId
                          ? {
                              ...msg,
                              content: fullContent,
                              status: 'streaming' as const,
                            }
                          : msg,
                      ),
                    );
                  }
                }
              } catch {
                // Not JSON, might be raw text
                if (jsonStr && jsonStr !== '[DONE]') {
                  fullContent += jsonStr;
                  setMessages(prev =>
                    prev.map(msg =>
                      msg.id === assistantMessageId
                        ? {
                            ...msg,
                            content: fullContent,
                            status: 'streaming' as const,
                          }
                        : msg,
                    ),
                  );
                }
              }

              // Reset event type after processing data
              currentEventType = null;
            }
          }
        }

        // Stream complete
        setIsStreaming(false);
        setConnectionState('idle');

        // If no content received, show appropriate message
        if (!fullContent && !lastServerError) {
          const noResponseMessage =
            'No response received from the AI provider. Please try again.';
          setMessages(prev =>
            prev.map(msg =>
              msg.id === assistantMessageId
                ? {
                    ...msg,
                    content: noResponseMessage,
                    status: 'error' as const,
                  }
                : msg,
            ),
          );
        } else if (fullContent) {
          // Ensure message is marked as complete
          setMessages(prev =>
            prev.map(msg =>
              msg.id === assistantMessageId && msg.status !== 'complete'
                ? {
                    ...msg,
                    content: fullContent,
                    status: 'complete' as const,
                  }
                : msg,
            ),
          );
        }

        // Notify callback
        const updatedMessage = messages.find(m => m.id === assistantMessageId);
        if (updatedMessage && onMessage) {
          onMessage(updatedMessage);
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : String(err);
        const isAbortError =
          errorMessage.includes('aborted') ||
          errorMessage.includes('AbortError');

        if (isAbortError) {
          // Abort: if we have content, mark as complete; otherwise show cancelled
          if (fullContent) {
            setMessages(prev =>
              prev.map(msg =>
                msg.id === assistantMessageId
                  ? {
                      ...msg,
                      content: fullContent,
                      status: 'complete' as const,
                    }
                  : msg,
              ),
            );
          } else {
            setMessages(prev =>
              prev.map(msg =>
                msg.id === assistantMessageId
                  ? {
                      ...msg,
                      status: 'complete' as const,
                      content: msg.content || '(Cancelled)',
                    }
                  : msg,
              ),
            );
          }
          setConnectionState('idle');
          setIsStreaming(false);
          return;
        }

        const error =
          err instanceof Error ? err : new Error(String(err));
        setError(error);
        setConnectionState('error');
        setIsStreaming(false);

        // Update assistant message with error status
        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  status: 'error' as const,
                  content: `Error: ${error.message}`,
                }
              : msg,
          ),
        );

        onError?.(error);
      }
    },
    [authToken, provider, model, systemMessage, userId, messages, onMessage, onError],
  );

  // ---------------------------------------------------------------------------
  // clearMessages
  // ---------------------------------------------------------------------------
  const clearMessages = useCallback(() => {
    setMessages(
      systemMessage
        ? [
            {
              id: generateMessageId(),
              role: 'system',
              content: systemMessage,
              status: 'complete',
              timestamp: new Date(),
            },
          ]
        : [],
    );
    setError(null);
    setConnectionState('idle');
    lastUserMessageRef.current = null;
    sessionIdRef.current = null;
  }, [systemMessage]);

  // ---------------------------------------------------------------------------
  // clearError
  // ---------------------------------------------------------------------------
  const clearError = useCallback(() => {
    setError(null);
    if (connectionState === 'error') {
      setConnectionState('idle');
    }
  }, [connectionState]);

  // ---------------------------------------------------------------------------
  // retry
  // ---------------------------------------------------------------------------
  const retry = useCallback(async () => {
    if (!lastUserMessageRef.current) return;

    // Remove the last failed exchange
    setMessages(prev => {
      const newMessages = [...prev];
      if (newMessages.length >= 2) {
        const lastAssistant = newMessages[newMessages.length - 1];
        const lastUser = newMessages[newMessages.length - 2];
        if (
          lastAssistant.role === 'assistant' &&
          lastAssistant.status === 'error' &&
          lastUser.role === 'user'
        ) {
          newMessages.pop();
          newMessages.pop();
        }
      }
      return newMessages;
    });

    // Retry with the last message
    await sendMessage(lastUserMessageRef.current);
  }, [sendMessage]);

  // ---------------------------------------------------------------------------
  // cancelStream
  // ---------------------------------------------------------------------------
  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setConnectionState('idle');
  }, []);

  // ---------------------------------------------------------------------------
  // Return UseMastraAgentReturn-compatible object
  // ---------------------------------------------------------------------------
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
