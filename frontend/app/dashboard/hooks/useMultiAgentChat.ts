/**
 * useMultiAgentChat Hook
 *
 * React hook for communicating with Mastra Multi-Agent System.
 * Features:
 * - Query multiple agents simultaneously
 * - Manager agent aggregates responses
 * - Streaming support via SSE
 * - Individual agent response tracking
 *
 * @module hooks/useMultiAgentChat
 */

import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Individual agent response
 */
export interface AgentChatResponse {
  agentId: string;
  agentName: string;
  content: string;
  timestamp: Date;
  durationMs: number;
  status: 'pending' | 'streaming' | 'complete' | 'error';
}

/**
 * Multi-agent aggregated response
 */
export interface MultiAgentChatResponse {
  id: string;
  query: string;
  responses: AgentChatResponse[];
  summary: string;
  timestamp: Date;
  totalDurationMs: number;
  status: 'collecting' | 'summarizing' | 'complete' | 'error';
}

/**
 * Chat message in the conversation
 */
export interface MultiAgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  isAggregated?: boolean;
  agentResponses?: AgentChatResponse[];
  summary?: string;
  status: 'pending' | 'streaming' | 'complete' | 'error';
}

/**
 * Hook options
 */
export interface UseMultiAgentChatOptions {
  /** Auth token from Supabase session */
  authToken?: string | null;
  /** Enable streaming (default: true) */
  enableStreaming?: boolean;
  /** Specific agents to include (default: all) */
  includeAgents?: ('habit-coach' | 'goal-planner' | 'progress-tracker')[];
  /** Locale for responses */
  locale?: 'ja' | 'en';
  /** Callback when agents respond */
  onAgentResponse?: (response: AgentChatResponse) => void;
  /** Callback when summary is ready */
  onSummary?: (summary: string) => void;
  /** Callback when an error occurs */
  onError?: (error: Error) => void;
}

/**
 * Hook return type
 */
export interface UseMultiAgentChatReturn {
  /** Send a message to the multi-agent system */
  sendMessage: (message: string) => Promise<void>;
  /** Conversation history */
  messages: MultiAgentMessage[];
  /** Current aggregation session */
  currentSession: MultiAgentChatResponse | null;
  /** Whether currently processing */
  isProcessing: boolean;
  /** Current error state */
  error: Error | null;
  /** Clear the conversation history */
  clearMessages: () => void;
  /** Clear the error state */
  clearError: () => void;
  /** Cancel the current request */
  cancel: () => void;
  /** Connection state */
  connectionState: 'idle' | 'connecting' | 'collecting' | 'summarizing' | 'error';
}

/**
 * Generate a unique message ID
 */
function generateMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Hook for communicating with Mastra Multi-Agent System
 */
export function useMultiAgentChat(options?: UseMultiAgentChatOptions): UseMultiAgentChatReturn {
  const {
    authToken,
    enableStreaming = true,
    includeAgents,
    locale = 'ja',
    onAgentResponse,
    onSummary,
    onError,
  } = options ?? {};

  // Build endpoint URL
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || '';
  const endpoint = `${backendUrl}/api/agents/multi-chat`;

  // State
  const [messages, setMessages] = useState<MultiAgentMessage[]>([]);
  const [currentSession, setCurrentSession] = useState<MultiAgentChatResponse | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [connectionState, setConnectionState] = useState<'idle' | 'connecting' | 'collecting' | 'summarizing' | 'error'>('idle');

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const authTokenRef = useRef(authToken);

  // Update auth token ref
  useEffect(() => {
    authTokenRef.current = authToken;
  }, [authToken]);

  /**
   * Process streaming response
   */
  const processStream = async (
    response: Response,
    sessionId: string,
    assistantMessageId: string
  ): Promise<void> => {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    const agentResponses: AgentChatResponse[] = [];
    let summary = '';
    let currentEventType: string | null = null;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete lines (SSE uses double newline as event separator)
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();

          // Parse event type
          if (trimmedLine.startsWith('event:')) {
            currentEventType = trimmedLine.slice(6).trim();
            continue;
          }

          // Parse data line
          if (trimmedLine.startsWith('data:')) {
            const dataContent = trimmedLine.slice(5).trim();
            if (!dataContent) continue;

            try {
              const parsed = JSON.parse(dataContent);

              switch (currentEventType) {
                case 'start':
                  setConnectionState('collecting');
                  break;

                case 'agent_start':
                  // An agent started processing
                  const pendingResponse: AgentChatResponse = {
                    agentId: parsed.agentId,
                    agentName: parsed.agentId,
                    content: '',
                    timestamp: new Date(),
                    durationMs: 0,
                    status: 'pending',
                  };
                  agentResponses.push(pendingResponse);
                  setCurrentSession(prev => prev ? {
                    ...prev,
                    responses: [...agentResponses],
                  } : null);
                  break;

                case 'agent_response':
                  // An agent completed its response
                  const agentResponse: AgentChatResponse = {
                    agentId: parsed.agentId,
                    agentName: parsed.agentName,
                    content: parsed.content,
                    timestamp: new Date(),
                    durationMs: parsed.durationMs || 0,
                    status: 'complete',
                  };

                  // Update or add response
                  const existingIdx = agentResponses.findIndex(r => r.agentId === parsed.agentId);
                  if (existingIdx >= 0) {
                    agentResponses[existingIdx] = agentResponse;
                  } else {
                    agentResponses.push(agentResponse);
                  }

                  setCurrentSession(prev => prev ? {
                    ...prev,
                    responses: [...agentResponses],
                  } : null);

                  // Notify callback
                  if (onAgentResponse) {
                    onAgentResponse(agentResponse);
                  }
                  break;

                case 'summary':
                  setConnectionState('summarizing');
                  summary = parsed.summary || '';

                  setCurrentSession(prev => prev ? {
                    ...prev,
                    summary,
                    totalDurationMs: parsed.totalDurationMs || 0,
                  } : null);

                  // Notify callback
                  if (onSummary) {
                    onSummary(summary);
                  }
                  break;

                case 'complete':
                  // Update the assistant message with final content
                  setMessages(prev => prev.map(msg =>
                    msg.id === assistantMessageId
                      ? {
                          ...msg,
                          content: summary,
                          isAggregated: true,
                          agentResponses: [...agentResponses],
                          summary,
                          status: 'complete' as const,
                        }
                      : msg
                  ));

                  setCurrentSession(prev => prev ? {
                    ...prev,
                    status: 'complete',
                  } : null);

                  setConnectionState('idle');
                  return;

                case 'error':
                  throw new Error(parsed.message || 'Unknown error');
              }

              currentEventType = null;
            } catch (parseError) {
              // Ignore JSON parse errors for non-JSON data
            }
          }
        }
      }

      // Handle end of stream without explicit complete event
      setMessages(prev => prev.map(msg =>
        msg.id === assistantMessageId
          ? {
              ...msg,
              content: summary || agentResponses.map(r => `${r.agentName}: ${r.content}`).join('\n\n'),
              isAggregated: true,
              agentResponses: [...agentResponses],
              summary,
              status: 'complete' as const,
            }
          : msg
      ));

      setConnectionState('idle');

    } finally {
      reader.releaseLock();
    }
  };

  /**
   * Process non-streaming response
   */
  const processResponse = async (
    response: Response,
    sessionId: string,
    assistantMessageId: string
  ): Promise<void> => {
    const data = await response.json();

    const agentResponses: AgentChatResponse[] = data.responses?.map((r: {
      agentId: string;
      agentName: string;
      content: string;
      timestamp: string;
      durationMs: number;
    }) => ({
      agentId: r.agentId,
      agentName: r.agentName,
      content: r.content,
      timestamp: new Date(r.timestamp),
      durationMs: r.durationMs,
      status: 'complete' as const,
    })) || [];

    setMessages(prev => prev.map(msg =>
      msg.id === assistantMessageId
        ? {
            ...msg,
            content: data.summary,
            isAggregated: true,
            agentResponses,
            summary: data.summary,
            status: 'complete' as const,
          }
        : msg
    ));

    setCurrentSession({
      id: sessionId,
      query: data.query,
      responses: agentResponses,
      summary: data.summary,
      timestamp: new Date(data.timestamp),
      totalDurationMs: data.totalDurationMs,
      status: 'complete',
    });

    // Notify callbacks
    agentResponses.forEach(r => {
      if (onAgentResponse) {
        onAgentResponse(r);
      }
    });

    if (onSummary && data.summary) {
      onSummary(data.summary);
    }
  };

  /**
   * Send a message to the multi-agent system
   */
  const sendMessage = useCallback(async (message: string): Promise<void> => {
    if (!message.trim()) return;

    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    // Clear previous error
    setError(null);
    setConnectionState('connecting');
    setIsProcessing(true);

    // Generate IDs
    const sessionId = `session-${Date.now()}`;
    const userMessageId = generateMessageId();
    const assistantMessageId = generateMessageId();

    // Add user message
    const userMessage: MultiAgentMessage = {
      id: userMessageId,
      role: 'user',
      content: message,
      timestamp: new Date(),
      status: 'complete',
    };

    // Add placeholder for assistant response
    const assistantMessage: MultiAgentMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isAggregated: true,
      agentResponses: [],
      status: 'pending',
    };

    setMessages(prev => [...prev, userMessage, assistantMessage]);

    // Initialize session
    setCurrentSession({
      id: sessionId,
      query: message,
      responses: [],
      summary: '',
      timestamp: new Date(),
      totalDurationMs: 0,
      status: 'collecting',
    });

    try {
      // Build headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (authTokenRef.current) {
        headers['Authorization'] = `Bearer ${authTokenRef.current}`;
      }

      // Build request body
      const body: Record<string, unknown> = {
        message,
        sessionId,
        locale,
        streaming: enableStreaming,
      };

      if (includeAgents && includeAgents.length > 0) {
        body.includeAgents = includeAgents;
      }

      // Make request
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Request failed (${response.status}): ${errorText}`);
      }

      // Process response based on streaming mode
      if (enableStreaming) {
        await processStream(response, sessionId, assistantMessageId);
      } else {
        await processResponse(response, sessionId, assistantMessageId);
      }

      setConnectionState('idle');

    } catch (err) {
      // Handle abort
      if (err instanceof Error && err.name === 'AbortError') {
        setMessages(prev => prev.map(msg =>
          msg.id === assistantMessageId
            ? { ...msg, status: 'complete' as const, content: msg.content || '(Cancelled)' }
            : msg
        ));
        setConnectionState('idle');
        return;
      }

      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setConnectionState('error');

      // Update assistant message with error status
      setMessages(prev => prev.map(msg =>
        msg.id === assistantMessageId
          ? { ...msg, status: 'error' as const, content: `Error: ${error.message}` }
          : msg
      ));

      setCurrentSession(prev => prev ? { ...prev, status: 'error' } : null);

      // Notify error callback
      if (onError) {
        onError(error);
      }

    } finally {
      setIsProcessing(false);
      abortControllerRef.current = null;
    }
  }, [endpoint, enableStreaming, includeAgents, locale, onAgentResponse, onSummary, onError]);

  /**
   * Clear conversation history
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
    setCurrentSession(null);
    setError(null);
    setConnectionState('idle');
  }, []);

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
   * Cancel the current request
   */
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsProcessing(false);
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
    currentSession,
    isProcessing,
    error,
    clearMessages,
    clearError,
    cancel,
    connectionState,
  };
}

export default useMultiAgentChat;
