/**
 * useUnifiedSSE Hook
 *
 * Unified SSE (Server-Sent Events) hook that provides a consistent interface
 * for handling real-time events across different implementations:
 * - Mastra Agent streaming responses
 * - Multi-Agent Server real-time updates
 * - Coach streaming responses
 *
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Event type-specific callbacks
 * - Connection state management
 * - Error handling and recovery
 * - Event normalization from different source formats
 *
 * @module hooks/useUnifiedSSE
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  UnifiedSSEEvent,
  UnifiedSSEEventType,
  UnifiedSSEEventData,
  SSEEventHandlers,
  SSEConnectionState,
  SSEConnectionInfo,
  SSEMessageEvent,
  SSEToolCallEvent,
  SSEWorkflowEvent,
  SSEAgentEvent,
  SSETaskEvent,
  SSEErrorEvent,
  SSESystemEvent,
} from '../types/sse-events.types';
import {
  parseSSEDataLine,
  createUnifiedSSEEvent,
  isMessageEvent,
  isToolCallEvent,
  isWorkflowEvent,
  isAgentEvent,
  isTaskEvent,
  isErrorEvent,
  isSystemEvent,
} from '../types/sse-events.types';

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * Hook configuration options.
 */
export interface UseUnifiedSSEOptions {
  /** SSE endpoint URL (for EventSource mode) */
  url?: string;

  /** Authorization token (added to URL as query param for EventSource) */
  authToken?: string;

  /** Auto-connect on mount (default: false) */
  autoConnect?: boolean;

  /** Enable auto-reconnection (default: true) */
  autoReconnect?: boolean;

  /** Maximum reconnection attempts (default: 10) */
  maxReconnectAttempts?: number;

  /** Initial reconnect delay in ms (default: 1000) */
  initialReconnectDelay?: number;

  /** Maximum reconnect delay in ms (default: 30000) */
  maxReconnectDelay?: number;

  /** Heartbeat timeout in ms - disconnect if no events received (default: 60000) */
  heartbeatTimeout?: number;

  /** Event handlers */
  handlers?: SSEEventHandlers;

  /** Session ID for correlation */
  sessionId?: string;

  /** Agent ID for multi-agent context */
  agentId?: string;

  /** Server ID for multi-server context */
  serverId?: string;

  /** Custom event normalization function */
  normalizeEvent?: (raw: unknown) => UnifiedSSEEvent | null;
}

/**
 * Hook return type.
 */
export interface UseUnifiedSSEReturn {
  // Connection control
  /** Connect to SSE endpoint */
  connect: (url?: string) => void;
  /** Disconnect from SSE endpoint */
  disconnect: () => void;
  /** Reconnect (disconnect + connect) */
  reconnect: () => void;

  // Fetch-based streaming (for POST requests)
  /** Start streaming from a fetch response */
  startFetchStream: (response: Response) => Promise<void>;
  /** Cancel current fetch stream */
  cancelFetchStream: () => void;

  // State
  /** Current connection state */
  connectionState: SSEConnectionState;
  /** Detailed connection info */
  connectionInfo: SSEConnectionInfo;
  /** Current error (if any) */
  error: string | null;
  /** Whether currently connected or streaming */
  isActive: boolean;

  // Event history (optional buffer)
  /** Recent events buffer */
  recentEvents: UnifiedSSEEvent[];
  /** Clear event buffer */
  clearEvents: () => void;

  // Manual event dispatch (for testing or external events)
  /** Dispatch an event manually */
  dispatchEvent: (event: UnifiedSSEEvent) => void;

  // Update handlers dynamically
  /** Update event handlers */
  setHandlers: (handlers: SSEEventHandlers) => void;
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_OPTIONS: Required<Omit<UseUnifiedSSEOptions, 'url' | 'authToken' | 'handlers' | 'sessionId' | 'agentId' | 'serverId' | 'normalizeEvent'>> = {
  autoConnect: false,
  autoReconnect: true,
  maxReconnectAttempts: 10,
  initialReconnectDelay: 1000,
  maxReconnectDelay: 30000,
  heartbeatTimeout: 60000,
};

const MAX_EVENT_BUFFER_SIZE = 100;

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Unified SSE hook for handling real-time events.
 */
export function useUnifiedSSE(options?: UseUnifiedSSEOptions): UseUnifiedSSEReturn {
  const {
    url: initialUrl,
    authToken,
    autoConnect = DEFAULT_OPTIONS.autoConnect,
    autoReconnect = DEFAULT_OPTIONS.autoReconnect,
    maxReconnectAttempts = DEFAULT_OPTIONS.maxReconnectAttempts,
    initialReconnectDelay = DEFAULT_OPTIONS.initialReconnectDelay,
    maxReconnectDelay = DEFAULT_OPTIONS.maxReconnectDelay,
    heartbeatTimeout = DEFAULT_OPTIONS.heartbeatTimeout,
    handlers: initialHandlers,
    sessionId,
    agentId,
    serverId,
    normalizeEvent: customNormalizeEvent,
  } = options ?? {};

  // State
  const [connectionState, setConnectionState] = useState<SSEConnectionState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [recentEvents, setRecentEvents] = useState<UnifiedSSEEvent[]>([]);
  const [connectionInfo, setConnectionInfo] = useState<SSEConnectionInfo>({
    state: 'idle',
    reconnectAttempts: 0,
    maxReconnectAttempts,
    eventsReceived: 0,
  });

  // Refs
  const eventSourceRef = useRef<EventSource | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const handlersRef = useRef<SSEEventHandlers>(initialHandlers ?? {});
  const reconnectAttemptsRef = useRef(0);
  const currentUrlRef = useRef<string | undefined>(initialUrl);
  const eventsReceivedRef = useRef(0);

  // Update handlers ref when changed
  useEffect(() => {
    if (initialHandlers) {
      handlersRef.current = initialHandlers;
    }
  }, [initialHandlers]);

  /**
   * Update connection info state.
   */
  const updateConnectionInfo = useCallback((updates: Partial<SSEConnectionInfo>) => {
    setConnectionInfo(prev => ({ ...prev, ...updates }));
  }, []);

  /**
   * Reset heartbeat timeout.
   */
  const resetHeartbeatTimeout = useCallback(() => {
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
    }

    if (heartbeatTimeout > 0) {
      heartbeatTimeoutRef.current = setTimeout(() => {
        console.warn('[useUnifiedSSE] Heartbeat timeout - no events received');
        // Trigger reconnection
        if (autoReconnect && eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
          scheduleReconnect();
        }
      }, heartbeatTimeout);
    }
  }, [heartbeatTimeout, autoReconnect]);

  /**
   * Dispatch an event to handlers.
   */
  const dispatchEvent = useCallback((event: UnifiedSSEEvent) => {
    const handlers = handlersRef.current;

    // Update event count
    eventsReceivedRef.current++;
    updateConnectionInfo({
      eventsReceived: eventsReceivedRef.current,
      lastEventAt: event.timestamp,
    });

    // Reset heartbeat timeout
    resetHeartbeatTimeout();

    // Add to recent events buffer
    setRecentEvents(prev => {
      const newEvents = [event, ...prev].slice(0, MAX_EVENT_BUFFER_SIZE);
      return newEvents;
    });

    // Call catch-all handler
    if (handlers.onAnyEvent) {
      handlers.onAnyEvent(event);
    }

    // Call type-specific handlers
    if (isMessageEvent(event)) {
      const msgEvent = event as SSEMessageEvent;
      handlers.onMessage?.(msgEvent);

      switch (event.type) {
        case 'message_start':
          handlers.onMessageStart?.(msgEvent);
          break;
        case 'message_end':
          handlers.onMessageEnd?.(msgEvent);
          break;
        case 'message_delta':
          handlers.onMessageDelta?.(msgEvent);
          break;
      }
    } else if (isToolCallEvent(event)) {
      const toolEvent = event as SSEToolCallEvent;
      handlers.onToolCall?.(toolEvent);

      switch (event.type) {
        case 'tool_call_start':
          handlers.onToolCallStart?.(toolEvent);
          break;
        case 'tool_call_result':
          handlers.onToolCallResult?.(toolEvent);
          break;
        case 'tool_call_error':
          handlers.onToolCallError?.(toolEvent);
          break;
      }
    } else if (isWorkflowEvent(event)) {
      const wfEvent = event as SSEWorkflowEvent;
      handlers.onWorkflowProgress?.(wfEvent);

      switch (event.type) {
        case 'workflow_start':
          handlers.onWorkflowStart?.(wfEvent);
          break;
        case 'workflow_complete':
          handlers.onWorkflowComplete?.(wfEvent);
          break;
        case 'workflow_error':
          handlers.onWorkflowError?.(wfEvent);
          break;
      }
    } else if (isAgentEvent(event)) {
      const agentEvent = event as SSEAgentEvent;
      handlers.onAgentStatus?.(agentEvent);

      switch (event.type) {
        case 'agent_registered':
          handlers.onAgentRegistered?.(agentEvent);
          break;
        case 'agent_status_changed':
          handlers.onAgentStatusChanged?.(agentEvent);
          break;
        case 'agent_offline':
          handlers.onAgentOffline?.(agentEvent);
          break;
        case 'agent_heartbeat':
          handlers.onAgentHeartbeat?.(agentEvent);
          break;
      }
    } else if (isTaskEvent(event)) {
      const taskEvent = event as SSETaskEvent;
      handlers.onTaskUpdate?.(taskEvent);

      switch (event.type) {
        case 'task_created':
          handlers.onTaskCreated?.(taskEvent);
          break;
        case 'task_assigned':
          handlers.onTaskAssigned?.(taskEvent);
          break;
        case 'task_started':
          handlers.onTaskStarted?.(taskEvent);
          break;
        case 'task_completed':
          handlers.onTaskCompleted?.(taskEvent);
          break;
        case 'task_failed':
          handlers.onTaskFailed?.(taskEvent);
          break;
      }
    } else if (isErrorEvent(event)) {
      handlers.onError?.(event as SSEErrorEvent);
    } else if (isSystemEvent(event)) {
      const sysEvent = event as SSESystemEvent;

      switch (event.type) {
        case 'connected':
          handlers.onConnected?.(sysEvent);
          break;
        case 'disconnected':
          handlers.onDisconnected?.(sysEvent);
          break;
        case 'heartbeat':
          handlers.onHeartbeat?.(sysEvent);
          break;
        case 'reconnecting':
          handlers.onReconnecting?.(sysEvent);
          break;
        case 'done':
          handlers.onDone?.(sysEvent);
          break;
      }
    }
  }, [updateConnectionInfo, resetHeartbeatTimeout]);

  /**
   * Schedule reconnection with exponential backoff.
   */
  const scheduleReconnect = useCallback(() => {
    if (!autoReconnect) {
      setConnectionState('error');
      updateConnectionInfo({ state: 'error' });
      return;
    }

    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      console.error('[useUnifiedSSE] Max reconnection attempts reached');
      setConnectionState('error');
      setError('Max reconnection attempts reached');
      updateConnectionInfo({ state: 'error', error: 'Max reconnection attempts reached' });
      return;
    }

    reconnectAttemptsRef.current++;
    const delay = Math.min(
      initialReconnectDelay * Math.pow(2, reconnectAttemptsRef.current - 1),
      maxReconnectDelay
    );

    console.log(`[useUnifiedSSE] Scheduling reconnect attempt ${reconnectAttemptsRef.current} in ${delay}ms`);

    setConnectionState('reconnecting');
    updateConnectionInfo({
      state: 'reconnecting',
      reconnectAttempts: reconnectAttemptsRef.current,
    });

    // Dispatch reconnecting event
    dispatchEvent(createUnifiedSSEEvent('reconnecting', {
      metadata: {
        attempt: reconnectAttemptsRef.current,
        maxAttempts: maxReconnectAttempts,
        delayMs: delay,
      },
    }));

    reconnectTimeoutRef.current = setTimeout(() => {
      if (currentUrlRef.current) {
        connectEventSource(currentUrlRef.current);
      }
    }, delay);
  }, [autoReconnect, maxReconnectAttempts, initialReconnectDelay, maxReconnectDelay, updateConnectionInfo, dispatchEvent]);

  /**
   * Connect using EventSource (for GET requests).
   */
  const connectEventSource = useCallback((url: string) => {
    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    // Clear reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    currentUrlRef.current = url;
    setConnectionState('connecting');
    setError(null);
    updateConnectionInfo({ state: 'connecting', url, error: undefined });

    // Build URL with auth token if provided
    let finalUrl = url;
    if (authToken) {
      const urlObj = new URL(url, window.location.origin);

      // Validate that SSE endpoint is same-origin or a trusted backend
      // to prevent sending auth tokens to untrusted domains
      const isSameOrigin = urlObj.origin === window.location.origin;
      let isTrustedBackend = false;
      const trustedBackendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || process.env.NEXT_PUBLIC_SLACK_API_URL || '';
      if (trustedBackendUrl) {
        try {
          const trustedHostname = new URL(trustedBackendUrl).hostname;
          isTrustedBackend = urlObj.hostname === trustedHostname;
        } catch {
          // Invalid trusted URL configuration; skip trust check
        }
      }
      const isLocalhost = urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1';

      if (!isSameOrigin && !isTrustedBackend && !isLocalhost) {
        console.error('[useUnifiedSSE] Refusing to send auth token to untrusted SSE endpoint:', urlObj.hostname);
        setError('Untrusted SSE endpoint');
        setConnectionState('error');
        updateConnectionInfo({ state: 'error', error: 'Untrusted SSE endpoint' });
        return;
      }

      urlObj.searchParams.set('token', authToken);
      finalUrl = urlObj.toString();
    }

    const eventSource = new EventSource(finalUrl);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('[useUnifiedSSE] EventSource connected');
      reconnectAttemptsRef.current = 0;
      setConnectionState('connected');
      setError(null);
      updateConnectionInfo({
        state: 'connected',
        reconnectAttempts: 0,
        lastConnectedAt: new Date().toISOString(),
        error: undefined,
      });

      // Dispatch connected event
      dispatchEvent(createUnifiedSSEEvent('connected', {
        connectionId: `es-${Date.now()}`,
        serverTime: new Date().toISOString(),
      }, { sessionId, agentId, serverId }));

      // Start heartbeat timeout
      resetHeartbeatTimeout();
    };

    eventSource.onmessage = (messageEvent) => {
      setConnectionState('streaming');
      updateConnectionInfo({ state: 'streaming' });

      // Parse and normalize the event
      const parsed = customNormalizeEvent
        ? customNormalizeEvent(messageEvent.data)
        : parseSSEDataLine(messageEvent.data);

      if (parsed) {
        // Add context
        parsed.sessionId = parsed.sessionId ?? sessionId;
        parsed.agentId = parsed.agentId ?? agentId;
        parsed.serverId = parsed.serverId ?? serverId;

        dispatchEvent(parsed);

        // Handle done event
        if (parsed.type === 'done') {
          setConnectionState('connected');
          updateConnectionInfo({ state: 'connected' });
        }
      }
    };

    eventSource.onerror = (errorEvent) => {
      console.error('[useUnifiedSSE] EventSource error', errorEvent);

      // Close the connection
      eventSource.close();
      eventSourceRef.current = null;

      // Clear heartbeat timeout
      if (heartbeatTimeoutRef.current) {
        clearTimeout(heartbeatTimeoutRef.current);
        heartbeatTimeoutRef.current = null;
      }

      // Dispatch error event
      dispatchEvent(createUnifiedSSEEvent('error', {
        message: 'Connection lost',
        recoverable: autoReconnect,
      }, { sessionId, agentId, serverId }));

      // Dispatch disconnected event
      dispatchEvent(createUnifiedSSEEvent('disconnected', {
        serverTime: new Date().toISOString(),
      }, { sessionId, agentId, serverId }));

      // Schedule reconnection
      scheduleReconnect();
    };
  }, [authToken, customNormalizeEvent, sessionId, agentId, serverId, updateConnectionInfo, dispatchEvent, resetHeartbeatTimeout, scheduleReconnect, autoReconnect]);

  /**
   * Public connect function.
   */
  const connect = useCallback((url?: string) => {
    const targetUrl = url ?? initialUrl;
    if (!targetUrl) {
      console.error('[useUnifiedSSE] No URL provided');
      setError('No URL provided');
      return;
    }
    connectEventSource(targetUrl);
  }, [initialUrl, connectEventSource]);

  /**
   * Disconnect from SSE endpoint.
   */
  const disconnect = useCallback(() => {
    // Close EventSource
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    // Cancel fetch stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Clear timeouts
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = null;
    }

    // Reset state
    reconnectAttemptsRef.current = 0;
    setConnectionState('closed');
    setError(null);
    updateConnectionInfo({
      state: 'closed',
      reconnectAttempts: 0,
      error: undefined,
    });

    console.log('[useUnifiedSSE] Disconnected');
  }, [updateConnectionInfo]);

  /**
   * Reconnect (disconnect + connect).
   */
  const reconnect = useCallback(() => {
    disconnect();
    setTimeout(() => {
      if (currentUrlRef.current) {
        connect(currentUrlRef.current);
      }
    }, 100);
  }, [disconnect, connect]);

  /**
   * Start streaming from a fetch Response (for POST-based streaming).
   */
  const startFetchStream = useCallback(async (response: Response) => {
    // Cancel any existing fetch stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    const reader = response.body?.getReader();

    if (!reader) {
      const errorMsg = 'Response body is not readable';
      setError(errorMsg);
      setConnectionState('error');
      updateConnectionInfo({ state: 'error', error: errorMsg });
      dispatchEvent(createUnifiedSSEEvent('error', {
        message: errorMsg,
        recoverable: false,
      }));
      return;
    }

    setConnectionState('streaming');
    updateConnectionInfo({ state: 'streaming' });

    // Dispatch connected event
    dispatchEvent(createUnifiedSSEEvent('connected', {
      connectionId: `fetch-${Date.now()}`,
      serverTime: new Date().toISOString(),
    }, { sessionId, agentId, serverId }));

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        // Check for abort
        if (abortControllerRef.current?.signal.aborted) {
          break;
        }

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue;

          // Parse the line
          const parsed = customNormalizeEvent
            ? customNormalizeEvent(line)
            : parseSSEDataLine(line);

          if (parsed) {
            // Add context
            parsed.sessionId = parsed.sessionId ?? sessionId;
            parsed.agentId = parsed.agentId ?? agentId;
            parsed.serverId = parsed.serverId ?? serverId;

            dispatchEvent(parsed);

            // Handle done event
            if (parsed.type === 'done') {
              setConnectionState('closed');
              updateConnectionInfo({ state: 'closed' });
              return;
            }
          }
        }
      }

      // Process any remaining data in buffer
      if (buffer.trim()) {
        const parsed = customNormalizeEvent
          ? customNormalizeEvent(buffer)
          : parseSSEDataLine(buffer);

        if (parsed) {
          parsed.sessionId = parsed.sessionId ?? sessionId;
          parsed.agentId = parsed.agentId ?? agentId;
          parsed.serverId = parsed.serverId ?? serverId;
          dispatchEvent(parsed);
        }
      }

      // Stream completed
      setConnectionState('closed');
      updateConnectionInfo({ state: 'closed' });

      // Dispatch done event
      dispatchEvent(createUnifiedSSEEvent('done', {
        serverTime: new Date().toISOString(),
      }, { sessionId, agentId, serverId }));

    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Intentional cancellation
        setConnectionState('closed');
        updateConnectionInfo({ state: 'closed' });
        return;
      }

      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[useUnifiedSSE] Fetch stream error:', err);
      setError(errorMsg);
      setConnectionState('error');
      updateConnectionInfo({ state: 'error', error: errorMsg });

      dispatchEvent(createUnifiedSSEEvent('error', {
        message: errorMsg,
        recoverable: false,
        details: err,
      }, { sessionId, agentId, serverId }));

    } finally {
      reader.releaseLock();
      abortControllerRef.current = null;
    }
  }, [customNormalizeEvent, sessionId, agentId, serverId, updateConnectionInfo, dispatchEvent]);

  /**
   * Cancel current fetch stream.
   */
  const cancelFetchStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setConnectionState('closed');
      updateConnectionInfo({ state: 'closed' });
    }
  }, [updateConnectionInfo]);

  /**
   * Clear recent events buffer.
   */
  const clearEvents = useCallback(() => {
    setRecentEvents([]);
    eventsReceivedRef.current = 0;
    updateConnectionInfo({ eventsReceived: 0 });
  }, [updateConnectionInfo]);

  /**
   * Update event handlers dynamically.
   */
  const setHandlers = useCallback((handlers: SSEEventHandlers) => {
    handlersRef.current = handlers;
  }, []);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect && initialUrl) {
      connect(initialUrl);
    }

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Computed state
  const isActive = connectionState === 'connected' || connectionState === 'streaming';

  return {
    // Connection control
    connect,
    disconnect,
    reconnect,

    // Fetch-based streaming
    startFetchStream,
    cancelFetchStream,

    // State
    connectionState,
    connectionInfo,
    error,
    isActive,

    // Event history
    recentEvents,
    clearEvents,

    // Manual dispatch
    dispatchEvent,

    // Handler management
    setHandlers,
  };
}

export default useUnifiedSSE;

// =============================================================================
// Utility Hooks
// =============================================================================

/**
 * Simplified hook for Mastra-style streaming responses.
 * Wraps useUnifiedSSE with defaults for POST-based streaming.
 */
export function useMastraSSE(options?: {
  onMessage?: (content: string) => void;
  onToolCall?: (toolCall: unknown) => void;
  onDone?: () => void;
  onError?: (error: string) => void;
}) {
  const { onMessage, onToolCall, onDone, onError } = options ?? {};

  return useUnifiedSSE({
    handlers: {
      onMessage: (event) => {
        if (event.data.content && onMessage) {
          onMessage(event.data.content);
        }
      },
      onToolCall: (event) => {
        if (onToolCall) {
          onToolCall(event.data);
        }
      },
      onDone: () => {
        if (onDone) {
          onDone();
        }
      },
      onError: (event) => {
        if (onError) {
          onError(event.data.message);
        }
      },
    },
  });
}

/**
 * Simplified hook for Multi-Agent Server SSE events.
 * Wraps useUnifiedSSE with defaults for EventSource-based connections.
 */
export function useMultiAgentSSE(options?: {
  url?: string;
  authToken?: string;
  autoConnect?: boolean;
  onAgentUpdate?: (data: unknown) => void;
  onTaskUpdate?: (data: unknown) => void;
  onError?: (error: string) => void;
}) {
  const { url, authToken, autoConnect, onAgentUpdate, onTaskUpdate, onError } = options ?? {};

  return useUnifiedSSE({
    url,
    authToken,
    autoConnect,
    handlers: {
      onAgentStatus: (event) => {
        if (onAgentUpdate) {
          onAgentUpdate(event.data);
        }
      },
      onAgentRegistered: (event) => {
        if (onAgentUpdate) {
          onAgentUpdate(event.data);
        }
      },
      onAgentStatusChanged: (event) => {
        if (onAgentUpdate) {
          onAgentUpdate(event.data);
        }
      },
      onTaskUpdate: (event) => {
        if (onTaskUpdate) {
          onTaskUpdate(event.data);
        }
      },
      onTaskCreated: (event) => {
        if (onTaskUpdate) {
          onTaskUpdate(event.data);
        }
      },
      onTaskCompleted: (event) => {
        if (onTaskUpdate) {
          onTaskUpdate(event.data);
        }
      },
      onError: (event) => {
        if (onError) {
          onError(event.data.message);
        }
      },
    },
  });
}
