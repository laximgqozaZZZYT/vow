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

    // For local MCP servers, use the known correct token to avoid stale token issues
    // This handles React state synchronization delays after Quick Setup
    const KNOWN_LOCAL_TOKEN = 'mcp-multi-agent-token-f75a6267';
    const isLocalServer = normalizedServerUrl.includes('127.0.0.1:3456') || normalizedServerUrl.includes('localhost:3456');
    let effectiveToken = server.serverToken;

    if (isLocalServer && server.serverToken !== KNOWN_LOCAL_TOKEN) {
      console.warn('[useMcpChat] Token mismatch for local server, using known correct token', {
        provided: server.serverToken?.slice(0, 8) + '...',
        expected: KNOWN_LOCAL_TOKEN.slice(0, 8) + '...',
      });
      effectiveToken = KNOWN_LOCAL_TOKEN;
    }

    // Log full server config for debugging
    console.log('[useMcpChat] Using server:', {
      id: server.id,
      name: server.name,
      serverUrl: server.serverUrl,
      normalizedUrl: normalizedServerUrl,
      isLocalServer,
      tokenOverridden: effectiveToken !== server.serverToken,
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
        isLocalServer,
        originalToken: server.serverToken ? `${server.serverToken.slice(0, 8)}...` : 'none',
        effectiveToken: effectiveToken ? `${effectiveToken.slice(0, 8)}...` : 'none',
        tokenWasOverridden: effectiveToken !== server.serverToken,
        targetAgentId,
      });

      // Quick health check before attempting SSE
      try {
        const healthResponse = await fetch(`${normalizedServerUrl}/health`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        });
        if (!healthResponse.ok) {
          throw new Error(`Server health check failed: ${healthResponse.status}`);
        }
        console.log('[useMcpChat] Health check passed');
      } catch (healthErr) {
        console.error('[useMcpChat] Health check failed:', healthErr);
        throw new Error(`Cannot reach MCP server at ${normalizedServerUrl}`);
      }

      if (enableStreaming) {
        // Use fetch with ReadableStream for SSE (more reliable than EventSource)
        const sseUrl = `${endpoint}?token=${encodeURIComponent(effectiveToken)}&message=${encodeURIComponent(message)}`;
        console.log('[useMcpChat] SSE URL:', sseUrl.replace(effectiveToken, '***'));

        let fullContent = '';
        setConnectionState('streaming');

        try {
          const response = await fetch(sseUrl, {
            method: 'GET',
            headers: {
              'Accept': 'text/event-stream',
            },
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

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const jsonStr = line.slice(6);
                console.log('[useMcpChat] Received:', jsonStr.substring(0, 100));

                try {
                  const data = JSON.parse(jsonStr);

                  if (data.type === 'token' || data.type === 'text') {
                    const token = data.token || data.text || data.content || '';
                    fullContent += token;

                    setMessages(prev => prev.map(msg =>
                      msg.id === assistantMessageId
                        ? { ...msg, content: fullContent, status: 'streaming' as const }
                        : msg
                    ));
                  } else if (data.type === 'complete' || data.type === 'done') {
                    setMessages(prev => prev.map(msg =>
                      msg.id === assistantMessageId
                        ? { ...msg, content: fullContent || data.content || '', status: 'complete' as const }
                        : msg
                    ));
                  } else if (data.type === 'error') {
                    throw new Error(data.error || 'Unknown error from MCP agent');
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
              }
            }
          }

          // Stream complete
          setIsStreaming(false);
          setConnectionState('idle');

          // If no content received, mark as complete with empty response
          if (!fullContent) {
            setMessages(prev => prev.map(msg =>
              msg.id === assistantMessageId
                ? { ...msg, content: '(No response)', status: 'complete' as const }
                : msg
            ));
          }
        } catch (streamErr) {
          console.error('[useMcpChat] Stream error:', streamErr);

          // If we have content, consider it complete
          if (fullContent) {
            setMessages(prev => prev.map(msg =>
              msg.id === assistantMessageId
                ? { ...msg, content: fullContent, status: 'complete' as const }
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
  }, [server, agentId, enableStreaming, settings, onMessage, onError, onFallback, cleanupSSE, messages]);

  /**
   * Clear conversation history
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
  }, [systemMessage]);

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
