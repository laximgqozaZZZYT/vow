/**
 * useMastraAgent Hook
 *
 * React hook for communicating with Mastra agents.
 * Features:
 * - Streaming response support via SSE
 * - Integration with existing authentication (useAuth)
 * - Message history management
 * - Error handling and retry logic
 *
 * @module hooks/useMastraAgent
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  getFrontendMastraConfig,
  type AgentMessage,
  type AgentResponse,
  type ToolCallResult,
} from '../../../lib/mastra/config';
import {
  validateUserInput,
  sanitizeInput,
  getViolationMessage,
  logViolation,
} from '../utils/chatGuardrails';

/**
 * Stream chunk from SSE
 */
interface StreamChunk {
  type: 'text' | 'tool_call' | 'done' | 'error' | 'start';
  content?: string;
  toolCall?: ToolCallResult;
  toolCalls?: ToolCallResult[]; // For complete event with multiple tool calls
  error?: string;
  sessionId?: string; // For start event with session ID
}

/**
 * Extended message with metadata
 */
export interface MastraMessage extends AgentMessage {
  id: string;
  status: 'pending' | 'streaming' | 'complete' | 'error';
  toolCalls?: ToolCallResult[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Hook options
 */
export interface UseMastraAgentOptions {
  /** Agent ID to use (optional, uses default if not specified) */
  agentId?: string;
  /** Auth token from Supabase session */
  authToken?: string | null;
  /** Enable streaming (default: true) */
  enableStreaming?: boolean;
  /** API endpoint override */
  apiEndpoint?: string;
  /** Initial system message */
  systemMessage?: string;
  /** Callback when a message is received */
  onMessage?: (message: MastraMessage) => void;
  /** Callback when an error occurs */
  onError?: (error: Error) => void;
}

/**
 * Hook return type
 */
export interface UseMastraAgentReturn {
  /** Send a message to the agent */
  sendMessage: (message: string) => Promise<void>;
  /** Conversation history */
  messages: MastraMessage[];
  /** Whether currently streaming a response */
  isStreaming: boolean;
  /** Current error state */
  error: Error | null;
  /** Clear the conversation history */
  clearMessages: () => void;
  /** Clear the error state */
  clearError: () => void;
  /** Retry the last failed message */
  retry: () => Promise<void>;
  /** Cancel the current streaming request */
  cancelStream: () => void;
  /** Connection state */
  connectionState: 'idle' | 'connecting' | 'streaming' | 'error';
}

/**
 * Generate a unique message ID
 */
function generateMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Hook for communicating with Mastra agents
 */
export function useMastraAgent(options?: UseMastraAgentOptions): UseMastraAgentReturn {
  const {
    agentId,
    authToken,
    enableStreaming = true,
    apiEndpoint,
    systemMessage,
    onMessage,
    onError,
  } = options ?? {};

  // Get frontend config
  const config = getFrontendMastraConfig();

  // Build full endpoint URL with backend API prefix
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || '';
  const configEndpoint = apiEndpoint ?? config.apiEndpoint;
  // If endpoint is a relative path, prepend backend URL
  const endpoint = configEndpoint.startsWith('http')
    ? configEndpoint
    : `${backendUrl}${configEndpoint}`;

  // State
  const [messages, setMessages] = useState<MastraMessage[]>(() => {
    // Initialize with system message if provided
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
  // Session ID for multi-turn conversations - persisted across messages
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastUserMessageRef = useRef<string | null>(null);
  const authTokenRef = useRef(authToken);

  // Update auth token ref
  useEffect(() => {
    authTokenRef.current = authToken;
  }, [authToken]);

  /**
   * Parse SSE event (supports standard SSE format with event: and data: lines)
   * Backend sends: event: start/token/complete/error, data: {...}
   */
  const parseSSEEvent = (eventType: string | null, data: string): StreamChunk | null => {
    if (!data) return null;

    const trimmedData = data.trim();
    if (trimmedData === '[DONE]') {
      return { type: 'done' };
    }

    try {
      const parsed = JSON.parse(trimmedData);

      // Handle backend SSE event types
      if (eventType === 'error' || parsed.error) {
        return { type: 'error', error: parsed.error || parsed.message || 'Unknown error' };
      }

      if (eventType === 'complete') {
        // Complete event contains the full message and optional tool calls
        // Extract toolCalls if present
        const toolCalls = parsed.toolCalls as ToolCallResult[] | undefined;
        console.log('[useMastraAgent] SSE complete event received:', {
          hasToolCalls: !!toolCalls,
          toolCallCount: toolCalls?.length ?? 0,
          toolNames: toolCalls?.map(tc => tc.toolName),
          // Debug: Log each toolCall's output details
          toolCallOutputs: toolCalls?.map(tc => ({
            toolName: tc.toolName,
            hasOutput: tc.output !== null && tc.output !== undefined,
            outputType: typeof tc.output,
            outputKeys: tc.output && typeof tc.output === 'object' ? Object.keys(tc.output as object) : [],
            hasSuggestions: tc.output && typeof tc.output === 'object' && 'suggestions' in (tc.output as object),
          })),
          parsedData: parsed,
        });
        return { type: 'done', toolCalls };
      }

      if (eventType === 'token') {
        // Token event contains a text chunk
        const token = parsed.token || parsed.text || parsed.content || '';
        if (token) {
          return { type: 'text', content: token };
        }
        return null;
      }

      if (eventType === 'start') {
        // Start event contains sessionId - return it for storage
        const receivedSessionId = parsed.sessionId as string | undefined;
        if (receivedSessionId) {
          return { type: 'start', sessionId: receivedSessionId };
        }
        return null;
      }

      // Fallback: Handle tool calls
      if (parsed.tool_call || parsed.toolCall) {
        return { type: 'tool_call', toolCall: parsed.tool_call || parsed.toolCall };
      }

      // Fallback: Text content (various possible formats)
      const content = parsed.content
        || parsed.text
        || parsed.token
        || parsed.delta?.content
        || parsed.choices?.[0]?.delta?.content
        || parsed.choices?.[0]?.message?.content;

      if (content) {
        return { type: 'text', content };
      }

      return null;
    } catch {
      // If not JSON, treat as raw text
      return { type: 'text', content: trimmedData };
    }
  };

  /**
   * Process streaming response
   * Handles standard SSE format: event: <type>\ndata: <json>\n\n
   */
  const processStream = async (
    response: Response,
    assistantMessageId: string,
    onSessionId: (id: string) => void
  ): Promise<void> => {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let fullContent = '';
    const toolCalls: ToolCallResult[] = [];
    let currentEventType: string | null = null;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete lines (SSE uses double newline as event separator)
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

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
            const chunk = parseSSEEvent(currentEventType, dataContent);
            currentEventType = null; // Reset for next event

            if (!chunk) continue;

            switch (chunk.type) {
              case 'start':
                // Store session ID from start event
                if (chunk.sessionId) {
                  onSessionId(chunk.sessionId);
                }
                break;

              case 'text':
                if (chunk.content) {
                  fullContent += chunk.content;

                  // Update message with new content
                  setMessages(prev => prev.map(msg =>
                    msg.id === assistantMessageId
                      ? { ...msg, content: fullContent, status: 'streaming' as const }
                      : msg
                  ));
                }
                break;

              case 'tool_call':
                if (chunk.toolCall) {
                  toolCalls.push(chunk.toolCall);
                }
                break;

              case 'error':
                throw new Error(chunk.error || 'Unknown streaming error');

              case 'done':
                // Final update - merge any toolCalls from the complete event
                const finalToolCalls = chunk.toolCalls && chunk.toolCalls.length > 0
                  ? chunk.toolCalls
                  : (toolCalls.length > 0 ? toolCalls : undefined);

                console.log('[useMastraAgent] Setting final message with toolCalls:', {
                  messageId: assistantMessageId,
                  chunkToolCalls: chunk.toolCalls,
                  accumulatedToolCalls: toolCalls,
                  finalToolCalls,
                  toolNames: finalToolCalls?.map(tc => tc.toolName),
                });

                setMessages(prev => prev.map(msg =>
                  msg.id === assistantMessageId
                    ? {
                        ...msg,
                        content: fullContent,
                        status: 'complete' as const,
                        toolCalls: finalToolCalls,
                      }
                    : msg
                ));
                return;
            }
          }
        }
      }

      // Handle end of stream without explicit complete event
      setMessages(prev => prev.map(msg =>
        msg.id === assistantMessageId
          ? {
              ...msg,
              content: fullContent,
              status: 'complete' as const,
              toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
            }
          : msg
      ));

    } finally {
      reader.releaseLock();
    }
  };

  /**
   * Backend chat response format
   */
  interface ChatApiResponse {
    message: string;
    sessionId?: string;
    toolCalls?: ToolCallResult[];
    quotaRemaining?: number;
    suggestions?: string[];
  }

  /**
   * Process non-streaming response
   * Backend returns: { message: string, sessionId, toolCalls?, quotaRemaining?, suggestions? }
   */
  const processResponse = async (
    response: Response,
    assistantMessageId: string,
    onSessionId: (id: string) => void
  ): Promise<void> => {
    const data: ChatApiResponse = await response.json();

    // Store sessionId from backend for subsequent messages
    if (data.sessionId) {
      onSessionId(data.sessionId);
    }

    setMessages(prev => prev.map(msg =>
      msg.id === assistantMessageId
        ? {
            ...msg,
            content: data.message, // Backend returns message as string, not object
            status: 'complete' as const,
            toolCalls: data.toolCalls,
          }
        : msg
    ));
  };

  /**
   * Send a message to the agent
   */
  const sendMessage = useCallback(async (message: string): Promise<void> => {
    if (!message.trim()) return;

    // Guardrail: Sanitize and validate user input
    const sanitizedMessage = sanitizeInput(message);
    const validationResult = validateUserInput(sanitizedMessage);

    if (!validationResult.allowed) {
      logViolation(validationResult, {
        agentType: 'Mastra',
        sessionId: sessionId ?? undefined,
      });
      const violationError = new Error(getViolationMessage(validationResult, 'ja'));
      setError(violationError);
      setConnectionState('error');
      if (onError) {
        onError(violationError);
      }
      return;
    }

    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

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
      // Build headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (authTokenRef.current) {
        headers['Authorization'] = `Bearer ${authTokenRef.current}`;
      }

      // Determine locale from browser or default to 'ja'
      const locale = typeof navigator !== 'undefined' && navigator.language?.startsWith('en') ? 'en' : 'ja';

      // Use stored sessionId for multi-turn conversations (persisted across messages)
      // If no sessionId yet, backend will generate one and return it in the response
      const requestSessionId = sessionId ?? undefined;

      // Make request - Backend expects single message, not array
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message,  // Single message string, not array
          sessionId: requestSessionId,
          locale,
          streaming: enableStreaming,  // 'streaming' not 'stream'
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Request failed (${response.status}): ${errorText}`);
      }

      setConnectionState('streaming');

      // Process response based on streaming mode
      // Callback to store sessionId from backend for subsequent messages
      const handleSessionId = (newSessionId: string) => {
        if (!sessionId) {
          setSessionId(newSessionId);
        }
      };

      if (enableStreaming) {
        await processStream(response, assistantMessageId, handleSessionId);
      } else {
        await processResponse(response, assistantMessageId, handleSessionId);
      }

      // Notify callback
      const updatedMessage = messages.find(m => m.id === assistantMessageId);
      if (updatedMessage && onMessage) {
        onMessage(updatedMessage);
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

      // Notify error callback
      if (onError) {
        onError(error);
      }

    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }, [messages, endpoint, enableStreaming, agentId, sessionId, onMessage, onError]);

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
    setSessionId(null); // Reset session for new conversation
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
      // Remove last two messages (user message and failed assistant response)
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

export default useMastraAgent;
