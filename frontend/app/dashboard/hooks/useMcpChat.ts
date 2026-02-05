/**
 * useMcpChat Hook
 *
 * React hook for communicating with MCP server agents.
 * Features:
 * - Similar interface to useMastraAgent for easy switching
 * - Streaming response support via SSE
 * - Message history management
 * - Fallback to default API when MCP fails
 *
 * @module hooks/useMcpChat
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { McpServer, ChatAgentSettings } from '../types/agent.types';
import type { MastraMessage, UseMastraAgentReturn } from './useMastraAgent';
import {
  validateUserInput,
  validateAIResponse,
  sanitizeInput,
  getViolationMessage,
  logViolation,
} from '../utils/chatGuardrails';

/**
 * Hook options
 */
export interface UseMcpChatOptions {
  /** MCP Server configuration */
  server: McpServer | null;
  /** Target agent ID on the MCP server */
  agentId?: string;
  /** Chat agent settings */
  settings?: ChatAgentSettings;
  /** Enable streaming (default: true) */
  enableStreaming?: boolean;
  /** Initial system message */
  systemMessage?: string;
  /** User ID for user-specific session isolation */
  userId?: string;
  /** Callback when a message is received */
  onMessage?: (message: MastraMessage) => void;
  /** Callback when an error occurs */
  onError?: (error: Error) => void;
  /** Callback when fallback to default API is needed */
  onFallback?: () => void;
}

/**
 * Generate a unique message ID
 */
function generateMessageId(): string {
  return `mcp-msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Hook for communicating with MCP server agents
 * Returns the same interface as useMastraAgent for seamless switching
 */
export function useMcpChat(options: UseMcpChatOptions): UseMastraAgentReturn {
  const {
    server,
    agentId,
    settings,
    enableStreaming = true,
    systemMessage,
    userId,
    onMessage,
    onError,
    onFallback,
  } = options;

  // State
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
  const [connectionState, setConnectionState] = useState<'idle' | 'connecting' | 'streaming' | 'error'>('idle');

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastUserMessageRef = useRef<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Persist sessionId across messages AND page reloads for conversation memory
  // Uses localStorage to maintain the same session across browser refreshes
  // User-specific: session key includes userId for isolation between users
  const getSessionStorageKey = (): string => {
    if (userId) {
      return `vow_mcp_session_${userId}`;
    }
    return 'vow_mcp_session_anonymous';
  };

  const getOrCreateSessionId = (): string => {
    // Server-side rendering check
    if (typeof window === 'undefined') {
      return `mcp-session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }

    const storageKey = getSessionStorageKey();

    // Try to get existing sessionId from localStorage
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      console.log('[useMcpChat] Restored sessionId from localStorage:', { key: storageKey, sessionId: stored });
      return stored;
    }

    // Create new sessionId and persist it
    const newId = `mcp-session-${userId || 'anon'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(storageKey, newId);
    console.log('[useMcpChat] Created new sessionId:', { key: storageKey, sessionId: newId, userId });
    return newId;
  };

  const sessionIdRef = useRef<string>(getOrCreateSessionId());

  // Update sessionId when userId changes (e.g., user logs in)
  useEffect(() => {
    const newSessionId = getOrCreateSessionId();
    if (sessionIdRef.current !== newSessionId) {
      console.log('[useMcpChat] userId changed, updating sessionId:', { oldId: sessionIdRef.current, newId: newSessionId, userId });
      sessionIdRef.current = newSessionId;
    }
  }, [userId]);

  /**
   * Clean up SSE connection
   */
  const cleanupSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  /**
   * Send a message to the MCP agent
   */
  const sendMessage = useCallback(async (message: string): Promise<void> => {
    if (!message.trim()) return;

    // Guardrail: Sanitize and validate user input
    const sanitizedMessage = sanitizeInput(message);
    const validationResult = validateUserInput(sanitizedMessage);

    if (!validationResult.allowed) {
      logViolation(validationResult, {
        agentType: 'MCP',
        sessionId: server?.id,
      });
      const violationError = new Error(getViolationMessage(validationResult, 'ja'));
      setError(violationError);
      setConnectionState('error');
      if (onError) {
        onError(violationError);
      }
      return;
    }

    // Check if server is configured
    if (!server || !server.serverUrl || !server.serverToken) {
      console.warn('[useMcpChat] Server not configured:', { server });
      const err = new Error('MCP server not configured');
      setError(err);
      setConnectionState('error');
      if (settings?.fallbackToApi && onFallback) {
        onFallback();
      }
      if (onError) {
        onError(err);
      }
      return;
    }

    // Normalize server URL: replace localhost with 127.0.0.1 to avoid IPv6 issues
    // Some MCP servers only listen on IPv4, and localhost might resolve to IPv6 first
    const normalizedServerUrl = server.serverUrl.replace('://localhost:', '://127.0.0.1:');

    // Use the token from server configuration
    const effectiveToken = server.serverToken;

    // Log full server config for debugging
    console.log('[useMcpChat] Using server:', {
      id: server.id,
      name: server.name,
      serverUrl: normalizedServerUrl,
      tokenPreview: effectiveToken?.substring(0, 20) + '...',
    });

    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    cleanupSSE();

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    // Store message for retry
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

    try {
      const targetAgentId = agentId || 'default';
      const endpoint = `${normalizedServerUrl}/agents/${targetAgentId}/chat`;

      // Debug logging - show token info for debugging 401 issues
      console.log('[useMcpChat] Server config:', {
        serverId: server.id,
        serverName: server.name,
        serverUrl: normalizedServerUrl,
        token: effectiveToken ? `${effectiveToken.slice(0, 8)}...` : 'none',
        targetAgentId,
      });

      // Quick health check before attempting SSE
      // Use AbortController with setTimeout for better mobile browser compatibility
      // (AbortSignal.timeout is not supported in Safari < 16.4)
      try {
        const healthController = new AbortController();
        const healthTimeout = setTimeout(() => healthController.abort(), 5000);

        const healthResponse = await fetch(`${normalizedServerUrl}/health`, {
          method: 'GET',
          signal: healthController.signal,
        });

        clearTimeout(healthTimeout);

        if (!healthResponse.ok) {
          throw new Error(`Server health check failed: ${healthResponse.status}`);
        }
        console.log('[useMcpChat] Health check passed');
      } catch (healthErr) {
        console.error('[useMcpChat] Health check failed:', healthErr);
        throw new Error(`Cannot reach MCP server at ${normalizedServerUrl}`);
      }

      if (enableStreaming) {
        // Use fetch with POST for SSE to support long systemPrompt in body
        // (GET with URL params truncates Japanese systemPrompt due to URL length limits)
        console.log('[useMcpChat] POST request:', {
          endpoint,
          sessionId: sessionIdRef.current,
          systemPromptLength: systemMessage?.length ?? 0,
          messagePreview: message.substring(0, 50),
        });

        let fullContent = '';
        let lastServerError: string | null = null; // Track error messages from server
        setConnectionState('streaming');

        try {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'text/event-stream',
              'Authorization': `Bearer ${effectiveToken}`,
            },
            body: JSON.stringify({
              message: message,
              sessionId: sessionIdRef.current,
              systemPrompt: systemMessage,
              userId: userId,
            }),
            signal: abortControllerRef.current?.signal,
          });

          if (!response.ok) {
            throw new Error(`SSE request failed: ${response.status} ${response.statusText}`);
          }

          const reader = response.body?.getReader();
          if (!reader) {
            throw new Error('No response body');
          }

          const decoder = new TextDecoder();
          let buffer = '';
          // Track current event type from SSE "event:" line
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
                console.log('[useMcpChat] Received:', { eventType: currentEventType, data: jsonStr.substring(0, 100) });

                // Handle [DONE] marker
                if (jsonStr === '[DONE]') {
                  currentEventType = null;
                  continue;
                }

                try {
                  const data = JSON.parse(jsonStr);

                  // Determine effective event type: prefer SSE event: line, fallback to data.type
                  const effectiveType = currentEventType || data.type;

                  // Save sessionId from server for conversation memory persistence
                  if ((effectiveType === 'session' || effectiveType === 'start') && data.sessionId) {
                    console.log('[useMcpChat] Received sessionId from server:', data.sessionId);
                    sessionIdRef.current = data.sessionId;
                    // Also persist to localStorage for page reload recovery (user-specific key)
                    if (typeof window !== 'undefined') {
                      localStorage.setItem(getSessionStorageKey(), data.sessionId);
                    }
                  } else if (effectiveType === 'token' || effectiveType === 'text') {
                    const token = data.token || data.text || data.content || '';
                    if (token) {
                      fullContent += token;

                      setMessages(prev => prev.map(msg =>
                        msg.id === assistantMessageId
                          ? { ...msg, content: fullContent, status: 'streaming' as const }
                          : msg
                      ));
                    }
                  } else if (effectiveType === 'complete' || effectiveType === 'done') {
                    // Update sessionId if provided in complete event
                    if (data.sessionId) {
                      sessionIdRef.current = data.sessionId;
                      // Also persist to localStorage for page reload recovery (user-specific key)
                      if (typeof window !== 'undefined') {
                        localStorage.setItem(getSessionStorageKey(), data.sessionId);
                      }
                    }
                    // Extract toolCalls from the complete event for button display
                    const toolCalls = data.toolCalls as MastraMessage['toolCalls'];
                    console.log('[useMcpChat] Complete event:', {
                      sessionId: data.sessionId,
                      hasToolCalls: !!toolCalls,
                      toolCallCount: toolCalls?.length ?? 0,
                      toolNames: toolCalls?.map((tc: { toolName: string }) => tc.toolName),
                      // Enhanced debug: Show toolCalls output details
                      toolCallOutputs: toolCalls?.map((tc: { toolName: string; output?: unknown }) => ({
                        toolName: tc.toolName,
                        hasOutput: tc.output !== null && tc.output !== undefined,
                        outputType: typeof tc.output,
                        outputKeys: tc.output && typeof tc.output === 'object' ? Object.keys(tc.output as object) : [],
                        hasSuggestions: tc.output && typeof tc.output === 'object' && 'suggestions' in (tc.output as object),
                        suggestionsCount: tc.output && typeof tc.output === 'object' && Array.isArray((tc.output as Record<string, unknown>).suggestions)
                          ? ((tc.output as Record<string, unknown>).suggestions as unknown[]).length : 0,
                      })),
                      // Debug: Show full content length for text fallback
                      contentLength: fullContent?.length ?? 0,
                    });

                    setMessages(prev => prev.map(msg =>
                      msg.id === assistantMessageId
                        ? {
                            ...msg,
                            content: fullContent || data.content || data.message || '',
                            status: 'complete' as const,
                            toolCalls,
                          }
                        : msg
                    ));
                  } else if (effectiveType === 'error') {
                    // Store the error message for later display instead of throwing
                    lastServerError = data.error || data.message || 'Unknown error from MCP agent';
                    console.error('[useMcpChat] Server error:', lastServerError);
                    // Update message with error status
                    setMessages(prev => prev.map(msg =>
                      msg.id === assistantMessageId
                        ? { ...msg, content: lastServerError || 'エラーが発生しました', status: 'error' as const }
                        : msg
                    ));
                  } else {
                    // Fallback: No explicit type - try to extract content from various field names
                    // This handles cases where MCP server sends data without type field
                    const content = data.token
                      || data.text
                      || data.content
                      || data.delta?.content
                      || data.choices?.[0]?.delta?.content
                      || data.choices?.[0]?.message?.content;

                    if (content) {
                      fullContent += content;
                      setMessages(prev => prev.map(msg =>
                        msg.id === assistantMessageId
                          ? { ...msg, content: fullContent, status: 'streaming' as const }
                          : msg
                      ));
                    }
                  }
                } catch (parseErr) {
                  // Not JSON, might be raw text
                  if (jsonStr && jsonStr !== '[DONE]') {
                    fullContent += jsonStr;
                    setMessages(prev => prev.map(msg =>
                      msg.id === assistantMessageId
                        ? { ...msg, content: fullContent, status: 'streaming' as const }
                        : msg
                    ));
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

          // If no content received, show appropriate message based on whether there was a server error
          if (!fullContent && !lastServerError) {
            // No error but also no content - likely a silent failure
            const noResponseMessage = '応答がありませんでした。MCPサーバーの状態を確認してください。Claude CLIが正しく認証されているか確認してください。';
            setMessages(prev => prev.map(msg =>
              msg.id === assistantMessageId
                ? { ...msg, content: noResponseMessage, status: 'error' as const }
                : msg
            ));
          } else if (fullContent) {
            // Stream ended with content - ensure message is marked as complete
            // This handles cases where MCP server doesn't send explicit 'complete' event
            console.log('[useMcpChat] Stream ended with content, marking as complete');
            setMessages(prev => prev.map(msg =>
              msg.id === assistantMessageId && msg.status !== 'complete'
                ? { ...msg, content: fullContent, status: 'complete' as const }
                : msg
            ));
          }
          // If there was a server error, it was already handled in the error event processing above
        } catch (streamErr) {
          const errorMessage = streamErr instanceof Error ? streamErr.message : String(streamErr);
          const isAbortError = errorMessage.includes('aborted') || errorMessage.includes('AbortError');

          console.error('[useMcpChat] Stream error:', {
            error: errorMessage,
            isAbortError,
            hasContent: !!fullContent,
            contentLength: fullContent?.length ?? 0,
          });

          // If we have content, consider it complete even if stream was aborted
          // This handles the "BodyStreamBuffer was aborted" error gracefully
          if (fullContent) {
            console.log('[useMcpChat] Recovering from stream error with partial content');
            setMessages(prev => prev.map(msg =>
              msg.id === assistantMessageId
                ? { ...msg, content: fullContent, status: 'complete' as const }
                : msg
            ));
            setIsStreaming(false);
            setConnectionState('idle');
          } else if (isAbortError) {
            // Abort error with no content - show cancelled message
            console.log('[useMcpChat] Stream aborted with no content');
            setMessages(prev => prev.map(msg =>
              msg.id === assistantMessageId
                ? { ...msg, status: 'complete' as const, content: msg.content || '(通信が中断されました)' }
                : msg
            ));
            setIsStreaming(false);
            setConnectionState('idle');
          } else {
            const err = streamErr instanceof Error ? streamErr : new Error('MCP agent connection failed');
            setError(err);
            setConnectionState('error');
            setIsStreaming(false);

            setMessages(prev => prev.map(msg =>
              msg.id === assistantMessageId
                ? { ...msg, status: 'error' as const, content: `Error: ${err.message}` }
                : msg
            ));

            if (settings?.fallbackToApi && onFallback) {
              onFallback();
            }
            if (onError) {
              onError(err);
            }
          }
        }
      } else {
        // Non-streaming request
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${effectiveToken}`,
          },
          body: JSON.stringify({ message }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`MCP request failed (${response.status})`);
        }

        const data = await response.json();
        const content = data.response || data.message || data.content || '';

        setMessages(prev => prev.map(msg =>
          msg.id === assistantMessageId
            ? { ...msg, content, status: 'complete' as const }
            : msg
        ));

        setConnectionState('idle');
      }

      // Notify callback
      const updatedMessage = messages.find(m => m.id === assistantMessageId);
      if (updatedMessage && onMessage) {
        onMessage(updatedMessage);
      }

    } catch (err) {
      // Handle abort
      if (err instanceof Error && err.name === 'AbortError') {
        setMessages(prev => prev.map(msg =>
          msg.id === assistantMessageId
            ? { ...msg, status: 'complete' as const, content: msg.content || '(Cancelled)' }
            : msg
        ));
        setConnectionState('idle');
        setIsStreaming(false);
        return;
      }

      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setConnectionState('error');
      setIsStreaming(false);

      // Update assistant message with error status
      setMessages(prev => prev.map(msg =>
        msg.id === assistantMessageId
          ? { ...msg, status: 'error' as const, content: `Error: ${error.message}` }
          : msg
      ));

      // Try fallback if configured
      if (settings?.fallbackToApi && onFallback) {
        onFallback();
      }

      // Notify error callback
      if (onError) {
        onError(error);
      }
    }
  }, [server, agentId, enableStreaming, settings, systemMessage, onMessage, onError, onFallback, cleanupSSE, messages]);

  /**
   * Clear conversation history and start a new session
   */
  const clearMessages = useCallback(() => {
    setMessages(systemMessage ? [{
      id: generateMessageId(),
      role: 'system',
      content: systemMessage,
      status: 'complete',
      timestamp: new Date(),
    }] : []);
    setError(null);
    setConnectionState('idle');
    lastUserMessageRef.current = null;

    // Reset sessionId to start a fresh conversation on the server (user-specific)
    const newSessionId = `mcp-session-${userId || 'anon'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    sessionIdRef.current = newSessionId;

    // Update localStorage with new sessionId (user-specific key)
    if (typeof window !== 'undefined') {
      localStorage.setItem(getSessionStorageKey(), newSessionId);
      console.log('[useMcpChat] Session cleared, new sessionId:', { sessionId: newSessionId, userId });
    }
  }, [systemMessage, userId]);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
    if (connectionState === 'error') {
      setConnectionState('idle');
    }
  }, [connectionState]);

  /**
   * Retry the last failed message
   */
  const retry = useCallback(async () => {
    if (!lastUserMessageRef.current) return;

    // Remove the last failed exchange
    setMessages(prev => {
      const newMessages = [...prev];
      if (newMessages.length >= 2) {
        const lastAssistant = newMessages[newMessages.length - 1];
        const lastUser = newMessages[newMessages.length - 2];
        if (lastAssistant.role === 'assistant' && lastAssistant.status === 'error' &&
            lastUser.role === 'user') {
          newMessages.pop();
          newMessages.pop();
        }
      }
      return newMessages;
    });

    // Retry with the last message
    await sendMessage(lastUserMessageRef.current);
  }, [sendMessage]);

  /**
   * Cancel the current streaming request
   */
  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    cleanupSSE();
    setIsStreaming(false);
    setConnectionState('idle');
  }, [cleanupSSE]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      cleanupSSE();
    };
  }, [cleanupSSE]);

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

export default useMcpChat;
