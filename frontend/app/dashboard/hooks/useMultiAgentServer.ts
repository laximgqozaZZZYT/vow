/**
 * useMultiAgentServer Hook
 *
 * Provides connection to multiple MCP Multi-Agent Task Servers.
 * Features:
 * - Multiple server configurations
 * - Simultaneous connections to multiple servers
 * - Aggregated data from all connected servers
 * - REST API for agents, tasks, dashboard
 * - SSE connection for real-time updates
 * - Automatic reconnection
 * - Configuration persistence (DynamoDB + localStorage)
 *
 * @module hooks/useMultiAgentServer
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type {
  Agent,
  AgentTask,
  AgentActivity,
  AgentRole,
  McpServer,
  MultiAgentConfig,
  LegacyMultiAgentConfig,
  ChatAgentSettings,
} from '../types/agent.types';

// Default chat agent settings
const DEFAULT_CHAT_AGENT_SETTINGS: ChatAgentSettings = {
  useMcpAgent: false,
  mcpServerId: undefined,
  mcpAgentId: undefined,
  fallbackToApi: true,
  selectionMode: 'manual',
};

// Default configuration
const DEFAULT_CONFIG: MultiAgentConfig = {
  servers: [],
  showInDashboard: true,
  notifyOnTaskComplete: true,
  notifyOnAgentOffline: true,
  chatAgentSettings: DEFAULT_CHAT_AGENT_SETTINGS,
};

// Storage key for config (localStorage fallback)
const CONFIG_STORAGE_KEY = 'vow-multi-agent-config';

// Backend API URL for MCP connection settings (stored in DynamoDB)
const BACKEND_API_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL || '';

// Connection states
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

// Dashboard stats from server
export interface DashboardStats {
  timestamp: string;
  tasks: {
    total: number;
    pending: number;
    assigned: number;
    in_progress: number;
    completed: number;
    failed: number;
  };
  agents: {
    total: number;
    idle: number;
    busy: number;
    offline: number;
    byRole: Record<string, number>;
    byMachine: Record<string, { name: string; count: number }>;
  };
  machines?: {
    total: number;
    online: number;
    byTrustLevel: Record<string, number>;
    totalCapacity: number;
    usedCapacity: number;
  };
}

// Per-server connection state
export interface ServerConnection {
  serverId: string;
  serverName: string;
  connectionState: ConnectionState;
  error: string | null;
  agents: Agent[];
  tasks: AgentTask[];
  activities: AgentActivity[];
  stats: DashboardStats | null;
}

// SSE Event data
interface SSEEvent {
  type: string;
  timestamp: string;
  data: unknown;
}

// Hook return type
export interface UseMultiAgentServerReturn {
  // Config
  config: MultiAgentConfig;
  updateConfig: (updates: Partial<MultiAgentConfig>) => void;

  // Chat agent settings
  chatAgentSettings: ChatAgentSettings;
  updateChatAgentSettings: (updates: Partial<ChatAgentSettings>) => void;

  // Server management
  addServer: (server: Omit<McpServer, 'id'>) => string;
  updateServer: (serverId: string, updates: Partial<McpServer>) => void;
  removeServer: (serverId: string) => void;

  // Connection control
  connectServer: (serverId: string) => Promise<void>;
  disconnectServer: (serverId: string) => void;
  connectAllEnabled: () => Promise<void>;
  disconnectAll: () => void;

  // Aggregated data (from all connected servers)
  agents: (Agent & { serverId: string; serverName: string })[];
  tasks: (AgentTask & { serverId: string; serverName: string })[];
  activities: (AgentActivity & { serverId: string; serverName: string })[];
  stats: DashboardStats | null;

  // Per-server state
  connections: Map<string, ServerConnection>;
  getServerState: (serverId: string) => ServerConnection | undefined;

  // Overall connection state (connected if any server is connected)
  connectionState: ConnectionState;
  error: string | null;

  // Utilities
  refreshData: () => Promise<void>;
  refreshConfig: () => Promise<void>;
  createTask: (serverId: string, task: Partial<AgentTask> & { assignTo?: string }) => Promise<AgentTask | null>;
  assignTask: (serverId: string, taskId: string, agentId: string) => Promise<boolean>;
  sendMessageToMcpAgent: (serverId: string, agentId: string, message: string) => Promise<string | null>;

  // Priority-based server selection
  getServersByPriority: () => McpServer[];
  getSelectedServerForChat: () => McpServer | null;

  // Deprecated compatibility (for existing code that expects single server)
  /** @deprecated Use connectServer instead */
  connect: () => Promise<void>;
  /** @deprecated Use disconnectAll instead */
  disconnect: () => void;
}

/**
 * Hook options
 */
interface UseMultiAgentServerOptions {
  /** Auth token for backend API (from Supabase session) */
  authToken?: string | null;
}

/**
 * Check if config is legacy format
 */
function isLegacyConfig(config: unknown): config is LegacyMultiAgentConfig {
  return typeof config === 'object' && config !== null && 'serverUrl' in config && !('servers' in config);
}

/**
 * Migrate legacy config to new format
 */
function migrateLegacyConfig(legacy: LegacyMultiAgentConfig): MultiAgentConfig {
  const servers: McpServer[] = [];

  if (legacy.serverUrl) {
    servers.push({
      id: crypto.randomUUID(),
      name: 'Default Server',
      serverUrl: legacy.serverUrl,
      serverToken: legacy.serverToken || '',
      enabled: legacy.enabled,
      autoConnect: legacy.autoConnect,
    });
  }

  return {
    servers,
    showInDashboard: legacy.showInDashboard ?? true,
    notifyOnTaskComplete: legacy.notifyOnTaskComplete ?? true,
    notifyOnAgentOffline: legacy.notifyOnAgentOffline ?? true,
  };
}

/**
 * Load config from localStorage (fallback)
 */
function loadConfigFromLocalStorage(): MultiAgentConfig {
  if (typeof window === 'undefined') return DEFAULT_CONFIG;

  try {
    const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Check for legacy format
      if (isLegacyConfig(parsed)) {
        const migrated = migrateLegacyConfig(parsed);
        console.log('[useMultiAgentServer] Migrated legacy config, servers:', migrated.servers.map(s => ({
          id: s.id,
          name: s.name,
          url: s.serverUrl,
          tokenMatch: s.serverToken === 'mcp-multi-agent-token-f75a6267',
        })));
        return migrated;
      }
      const config = { ...DEFAULT_CONFIG, ...parsed };
      // Debug: log what tokens are loaded from localStorage
      console.log('[useMultiAgentServer] Loaded config from localStorage, servers:', config.servers.map((s: McpServer) => ({
        id: s.id,
        name: s.name,
        url: s.serverUrl,
        tokenMatch: s.serverToken === 'mcp-multi-agent-token-f75a6267',
        tokenPreview: s.serverToken ? `${s.serverToken.slice(0, 8)}...${s.serverToken.slice(-8)}` : 'none',
      })));
      return config;
    }
  } catch (e) {
    console.error('[useMultiAgentServer] Failed to load config from localStorage:', e);
  }
  return DEFAULT_CONFIG;
}

/**
 * Save config to localStorage
 */
function saveConfigToLocalStorage(config: MultiAgentConfig): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('[useMultiAgentServer] Failed to save config to localStorage:', e);
  }
}

/**
 * Load config from backend API (DynamoDB)
 * Falls back to localStorage if backend is unavailable
 */
async function loadConfigFromBackend(authToken: string | null): Promise<MultiAgentConfig> {
  // If no auth token or backend URL, fall back to localStorage silently
  if (!authToken || !BACKEND_API_URL) {
    if (process.env.NODE_ENV === 'development' && !BACKEND_API_URL) {
      console.debug('[useMultiAgentServer] BACKEND_API_URL not configured, using localStorage');
    }
    return loadConfigFromLocalStorage();
  }

  // Create an AbortController for timeout handling
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

  try {
    const response = await fetch(`${BACKEND_API_URL}/api/mcp-connections`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const result = await response.json();
      if (result.success && result.data) {
        const apiConfig = result.data;

        // Handle migration flag from server
        if (result.migrated) {
          console.log('[useMultiAgentServer] Config migrated from legacy format');
        }

        // Backend now returns decrypted real tokens (encrypted at rest in DynamoDB).
        // No need to merge from localStorage — cross-device access works out of the box.
        const mergedConfig = {
          ...DEFAULT_CONFIG,
          ...apiConfig,
          servers: apiConfig.servers,
        };

        // Persist to localStorage so fallback (authToken not yet available) has real tokens
        saveConfigToLocalStorage(mergedConfig);

        return mergedConfig;
      }
    } else if (response.status === 401) {
      // Authentication error - token might be expired, fall back silently
      console.debug('[useMultiAgentServer] Auth token expired or invalid, using localStorage');
    } else {
      // Other HTTP errors - log only in development
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[useMultiAgentServer] Backend returned ${response.status}, using localStorage fallback`);
      }
    }
  } catch (e) {
    clearTimeout(timeoutId);

    // Handle different error types gracefully
    if (e instanceof Error) {
      if (e.name === 'AbortError') {
        // Timeout - backend is slow or unreachable
        console.debug('[useMultiAgentServer] Backend request timed out, using localStorage');
      } else if (e.message === 'Failed to fetch' || e.name === 'TypeError') {
        // Network error - backend is unreachable (CORS, network down, etc.)
        // Only log in development to avoid console spam in production
        if (process.env.NODE_ENV === 'development') {
          console.debug('[useMultiAgentServer] Backend unreachable, using localStorage fallback');
        }
      } else {
        // Other errors - log for debugging
        console.warn('[useMultiAgentServer] Failed to load config from backend:', e.message);
      }
    }
  }

  return loadConfigFromLocalStorage();
}

/**
 * Save config to backend API (DynamoDB)
 * Always saves to localStorage as primary fallback
 */
async function saveConfigToBackend(config: MultiAgentConfig, authToken: string | null): Promise<void> {
  // Always save to localStorage as fallback (this is the primary storage for tokens)
  saveConfigToLocalStorage(config);

  // Skip backend save if no auth token or backend URL
  if (!authToken || !BACKEND_API_URL) {
    return;
  }

  // Create an AbortController for timeout handling
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

  try {
    const response = await fetch(`${BACKEND_API_URL}/api/mcp-connections`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify(config),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok && process.env.NODE_ENV === 'development') {
      console.warn(`[useMultiAgentServer] Failed to save config to backend: ${response.status}`);
    }
  } catch (e) {
    clearTimeout(timeoutId);

    // Handle errors gracefully - localStorage save already succeeded
    if (e instanceof Error) {
      if (e.name === 'AbortError') {
        console.debug('[useMultiAgentServer] Backend save timed out, config saved to localStorage only');
      } else if (e.message === 'Failed to fetch' || e.name === 'TypeError') {
        // Network error - only log in development
        if (process.env.NODE_ENV === 'development') {
          console.debug('[useMultiAgentServer] Backend unreachable, config saved to localStorage only');
        }
      } else {
        console.warn('[useMultiAgentServer] Failed to save config to backend:', e.message);
      }
    }
  }
}

/**
 * Hook for connecting to multiple MCP Task Servers
 */
export function useMultiAgentServer(options?: UseMultiAgentServerOptions): UseMultiAgentServerReturn {
  const authToken = options?.authToken ?? null;

  // State
  const [config, setConfig] = useState<MultiAgentConfig>(DEFAULT_CONFIG);
  const [connections, setConnections] = useState<Map<string, ServerConnection>>(new Map());
  const [configLoaded, setConfigLoaded] = useState(false);

  // Refs
  const eventSourcesRef = useRef<Map<string, EventSource>>(new Map());
  const reconnectTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const authTokenRef = useRef(authToken);
  const configRef = useRef(config);
  // Track pending connection promises for waitForConnection
  const connectionPromisesRef = useRef<Map<string, { resolve: () => void; reject: (err: Error) => void }>>(new Map());
  // Track servers that have successfully connected (to avoid stale closure in onerror)
  const connectedServersRef = useRef<Set<string>>(new Set());

  // Update authToken ref
  useEffect(() => {
    authTokenRef.current = authToken;
  }, [authToken]);

  // Keep configRef in sync with config state
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  // Load config on mount or when authToken changes
  useEffect(() => {
    let cancelled = false;
    const autoConnectTimers: ReturnType<typeof setTimeout>[] = [];

    const loadAndSetConfig = async () => {
      const loaded = await loadConfigFromBackend(authToken);

      // If effect was cleaned up while loading, don't update state
      if (cancelled) return;

      setConfig(loaded);
      setConfigLoaded(true);

      // Initialize connection states for all servers
      const initialConnections = new Map<string, ServerConnection>();
      for (const server of loaded.servers) {
        initialConnections.set(server.id, {
          serverId: server.id,
          serverName: server.name,
          connectionState: 'disconnected',
          error: null,
          agents: [],
          tasks: [],
          activities: [],
          stats: null,
        });
      }
      setConnections(initialConnections);

      // Auto-connect enabled servers
      for (const server of loaded.servers) {
        if (server.enabled && server.autoConnect && server.serverUrl && server.serverToken) {
          // Reset retry counter for fresh connections
          const retryKey = `retry_${server.id}`;
          (window as unknown as Record<string, number>)[retryKey] = 0;

          const timer = setTimeout(() => {
            if (cancelled) return;
            connectToServer(server).catch(err => {
              console.warn(`[useMultiAgentServer] Auto-connect failed for ${server.name}:`, err.message);
            });
          }, 500);
          autoConnectTimers.push(timer);
        }
      }
    };

    loadAndSetConfig();

    return () => {
      // Cleanup on unmount or authToken change
      cancelled = true;
      autoConnectTimers.forEach(t => clearTimeout(t));
      eventSourcesRef.current.forEach((es) => es.close());
      reconnectTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
    };
  }, [authToken]);

  /**
   * Make authenticated API request to a server
   * Includes timeout handling for mobile browser compatibility
   */
  const apiRequest = useCallback(async (
    server: McpServer,
    endpoint: string,
    options: RequestInit = {}
  ): Promise<unknown> => {
    const url = `${server.serverUrl}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${server.serverToken}`,
      ...(options.headers as Record<string, string> || {}),
    };

    // Add timeout handling for mobile browser compatibility
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Unknown error');
      }

      return data.data;
    } catch (e) {
      clearTimeout(timeoutId);
      throw e;
    }
  }, []);

  /**
   * Update connection state for a server
   */
  const updateConnectionState = useCallback((
    serverId: string,
    updates: Partial<ServerConnection>
  ) => {
    setConnections(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(serverId);
      if (existing) {
        newMap.set(serverId, { ...existing, ...updates });
      }
      return newMap;
    });
  }, []);

  /**
   * Connect SSE for a server
   */
  const connectSSE = useCallback((server: McpServer) => {
    const existingES = eventSourcesRef.current.get(server.id);
    if (existingES) {
      existingES.close();
    }

    // Debug logging
    console.log('[useMultiAgentServer] Connecting SSE:', {
      serverId: server.id,
      serverName: server.name,
      serverUrl: server.serverUrl,
      hasToken: !!server.serverToken,
      tokenLength: server.serverToken?.length,
    });

    const url = `${server.serverUrl}/events?token=${encodeURIComponent(server.serverToken)}`;
    console.log('[useMultiAgentServer] SSE URL:', url);
    const eventSource = new EventSource(url);

    eventSource.onopen = () => {
      console.log(`[useMultiAgentServer] SSE connected to ${server.name}`);
      // Track this server as successfully connected (for onerror handler)
      connectedServersRef.current.add(server.id);
      updateConnectionState(server.id, {
        connectionState: 'connected',
        error: null,
      });
      // Resolve any pending connection promise
      const pending = connectionPromisesRef.current.get(server.id);
      if (pending) {
        pending.resolve();
        connectionPromisesRef.current.delete(server.id);
      }
    };

    eventSource.onmessage = (event) => {
      try {
        const sseEvent: SSEEvent = JSON.parse(event.data);

        setConnections(prev => {
          const newMap = new Map(prev);
          const existing = newMap.get(server.id);
          if (!existing) return prev;

          let updated = { ...existing };
          const eventData = (sseEvent.data || {}) as Record<string, unknown>;

          switch (sseEvent.type) {
            case 'connected': {
              // Server acknowledged connection - this is expected, just log it
              console.log(`[useMultiAgentServer] SSE acknowledged by ${server.name}`);
              break;
            }

            case 'agent_registered': {
              const agent = sseEvent.data as Agent;
              const existingIdx = updated.agents.findIndex(a => a.id === agent.id);
              if (existingIdx >= 0) {
                updated.agents = [...updated.agents];
                updated.agents[existingIdx] = agent;
              } else {
                updated.agents = [...updated.agents, agent];
              }
              break;
            }

            case 'agent_status_changed': {
              const { agentId, newStatus } = sseEvent.data as { agentId: string; newStatus: string };
              updated.agents = updated.agents.map(a =>
                a.id === agentId ? { ...a, status: newStatus as Agent['status'] } : a
              );
              break;
            }

            case 'task_created': {
              const newTask = sseEvent.data as AgentTask;
              updated.tasks = [...updated.tasks, newTask];
              break;
            }

            case 'task_assigned':
            case 'task_started':
            case 'task_completed':
            case 'task_failed': {
              // Refresh tasks from server
              apiRequest(server, '/tasks')
                .then(data => {
                  updateConnectionState(server.id, { tasks: data as AgentTask[] });
                })
                .catch(() => {});
              break;
            }
          }

          // Add activity for all events except heartbeat and connected
          if (sseEvent.type !== 'heartbeat' && sseEvent.type !== 'connected') {
            // Try to get agent info from current agents list
            const agentIdFromEvent = (eventData?.agentId || eventData?.id || eventData?.assignedTo || '') as string;
            const agentFromEvent = eventData?.name as string | undefined;
            const existingAgent = updated.agents.find(a => a.id === agentIdFromEvent);

            // For task events, get task info
            const taskIdFromEvent = (eventData?.taskId || eventData?.id) as string | undefined;
            const taskTitleFromEvent = (eventData?.title) as string | undefined;
            const existingTask = taskIdFromEvent ? updated.tasks.find(t => t.id === taskIdFromEvent) : undefined;

            const activity: AgentActivity = {
              id: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              eventType: sseEvent.type as AgentActivity['eventType'],
              agentId: agentIdFromEvent,
              agentName: agentFromEvent || existingAgent?.name || agentIdFromEvent || 'System',
              taskId: taskIdFromEvent,
              taskTitle: taskTitleFromEvent || existingTask?.title,
              details: eventData,
              createdAt: sseEvent.timestamp,
            };
            updated.activities = [activity, ...updated.activities.slice(0, 99)];
          }

          newMap.set(server.id, updated);
          return newMap;
        });
      } catch (e) {
        console.warn(`[useMultiAgentServer] SSE parse error for ${server.name}:`, e);
      }
    };

    eventSource.onerror = () => {
      // Check if we've ever successfully connected (using ref to avoid stale closure)
      const wasConnected = connectedServersRef.current.has(server.id);

      // Only log if we weren't already connected (avoid noise for reconnection attempts)
      if (!wasConnected) {
        console.debug(`[useMultiAgentServer] SSE connection issue for ${server.name}`);
      }

      eventSource.close();
      eventSourcesRef.current.delete(server.id);

      // Reject any pending connection promise (only on initial connection)
      const pending = connectionPromisesRef.current.get(server.id);
      if (pending) {
        pending.reject(new Error('SSE connection failed'));
        connectionPromisesRef.current.delete(server.id);
      }

      // Track retry count to avoid infinite retries
      const retryKey = `retry_${server.id}`;
      const retryCount = (window as unknown as Record<string, number>)[retryKey] || 0;
      const maxRetries = 3;

      if (retryCount >= maxRetries) {
        // Only show error state after max retries
        updateConnectionState(server.id, {
          connectionState: 'error',
          error: 'Server unavailable. Click to retry.',
        });
        return;
      }

      // If we were connected, keep showing as connected while reconnecting silently
      // If we weren't connected, show connecting state
      if (!wasConnected) {
        updateConnectionState(server.id, {
          connectionState: 'connecting',
          error: null,
        });
      }

      (window as unknown as Record<string, number>)[retryKey] = retryCount + 1;

      // Attempt reconnection with exponential backoff
      const existingTimeout = reconnectTimeoutsRef.current.get(server.id);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      const backoffTime = Math.min(3000 * Math.pow(1.5, retryCount), 15000);
      const timeout = setTimeout(() => {
        // Use configRef to get the latest config
        const currentServer = configRef.current.servers.find(s => s.id === server.id);
        if (currentServer?.enabled && currentServer.autoConnect) {
          connectToServer(currentServer).catch(() => {
            // Silently handle reconnection failures
          });
        }
      }, backoffTime);

      reconnectTimeoutsRef.current.set(server.id, timeout);
    };

    eventSourcesRef.current.set(server.id, eventSource);
  }, [apiRequest, updateConnectionState]);

  /**
   * Connect to a specific server
   * Returns a promise that resolves when the SSE connection is established
   */
  const connectToServer = useCallback(async (server: McpServer): Promise<void> => {
    updateConnectionState(server.id, {
      connectionState: 'connecting',
      error: null,
    });

    try {
      // Test connection with health check
      // Use AbortController with setTimeout for mobile browser compatibility
      const healthController = new AbortController();
      const healthTimeout = setTimeout(() => healthController.abort(), 5000);

      const health = await fetch(`${server.serverUrl}/health`, {
        signal: healthController.signal,
      });

      clearTimeout(healthTimeout);

      if (!health.ok) {
        throw new Error('Server health check failed');
      }

      // Fetch initial data
      const [agentsData, tasksData, statsData] = await Promise.all([
        apiRequest(server, '/agents').catch(() => []),
        apiRequest(server, '/tasks').catch(() => []),
        apiRequest(server, '/dashboard').catch(() => null),
      ]);

      updateConnectionState(server.id, {
        agents: (agentsData as Agent[]) || [],
        tasks: (tasksData as AgentTask[]) || [],
        stats: (statsData as DashboardStats) || null,
      });

      // Create a promise that resolves when SSE connection is established
      const connectionPromise = new Promise<void>((resolve, reject) => {
        // Set a timeout to avoid hanging forever
        const timeout = setTimeout(() => {
          connectionPromisesRef.current.delete(server.id);
          reject(new Error('SSE connection timeout'));
        }, 10000);

        connectionPromisesRef.current.set(server.id, {
          resolve: () => {
            clearTimeout(timeout);
            resolve();
          },
          reject: (err) => {
            clearTimeout(timeout);
            reject(err);
          },
        });
      });

      // Connect SSE
      connectSSE(server);

      // Wait for the SSE connection to be established (or fail)
      await connectionPromise;
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to connect to server';

      // Only warn in development, not error (since server might not be running)
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[useMultiAgentServer] Connection failed for ${server.name}:`, errorMessage);
      }

      updateConnectionState(server.id, {
        connectionState: 'error',
        error: errorMessage,
      });

      // Re-throw only for non-SSE errors (health check failed, network errors, etc.)
      // SSE connection failures are handled by the retry mechanism and shouldn't propagate
      if (errorMessage !== 'SSE connection failed' && errorMessage !== 'SSE connection timeout') {
        throw e;
      }
    }
  }, [apiRequest, connectSSE, updateConnectionState]);

  /**
   * Public: Connect to a specific server by ID
   * Uses configRef to always access the latest config (avoids stale closure issue)
   */
  const connectServer = useCallback(async (serverId: string): Promise<void> => {
    // Use configRef to get the latest config (handles async state updates after addServer)
    const server = configRef.current.servers.find(s => s.id === serverId);
    if (!server) {
      console.error(`[useMultiAgentServer] Server not found: ${serverId}. Available servers:`, configRef.current.servers.map(s => s.id));
      throw new Error(`Server not found: ${serverId}`);
    }

    if (!server.serverUrl || !server.serverToken) {
      updateConnectionState(serverId, {
        connectionState: 'error',
        error: 'Server URL and token are required',
      });
      throw new Error('Server URL and token are required');
    }

    // Reset retry counter for manual connection attempts
    const retryKey = `retry_${serverId}`;
    (window as unknown as Record<string, number>)[retryKey] = 0;

    await connectToServer(server);
  }, [connectToServer, updateConnectionState]);

  /**
   * Public: Disconnect from a specific server
   */
  const disconnectServer = useCallback((serverId: string) => {
    const es = eventSourcesRef.current.get(serverId);
    if (es) {
      es.close();
      eventSourcesRef.current.delete(serverId);
    }

    const timeout = reconnectTimeoutsRef.current.get(serverId);
    if (timeout) {
      clearTimeout(timeout);
      reconnectTimeoutsRef.current.delete(serverId);
    }

    updateConnectionState(serverId, {
      connectionState: 'disconnected',
      error: null,
    });
  }, [updateConnectionState]);

  /**
   * Public: Connect all enabled servers
   */
  const connectAllEnabled = useCallback(async () => {
    const enabledServers = config.servers.filter(s => s.enabled && s.serverUrl && s.serverToken);
    const results = await Promise.allSettled(enabledServers.map(s => connectToServer(s)));
    // Log any failures
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.warn(`[useMultiAgentServer] Failed to connect to ${enabledServers[index].name}:`, result.reason?.message);
      }
    });
  }, [config.servers, connectToServer]);

  /**
   * Public: Disconnect all servers
   */
  const disconnectAll = useCallback(() => {
    config.servers.forEach(s => disconnectServer(s.id));
  }, [config.servers, disconnectServer]);

  /**
   * Public: Add a new server
   * Note: Also updates configRef synchronously so connectServer can find it immediately
   */
  const addServer = useCallback((serverData: Omit<McpServer, 'id'>): string => {
    const newServer: McpServer = {
      ...serverData,
      id: crypto.randomUUID(),
    };

    // Update configRef synchronously so connectServer can find the server immediately
    // This solves the async state update timing issue
    const newConfig = {
      ...configRef.current,
      servers: [...configRef.current.servers, newServer],
    };
    configRef.current = newConfig;

    setConfig(prev => {
      const updatedConfig = {
        ...prev,
        servers: [...prev.servers, newServer],
      };
      saveConfigToBackend(updatedConfig, authTokenRef.current);
      return updatedConfig;
    });

    // Initialize connection state
    setConnections(prev => {
      const newMap = new Map(prev);
      newMap.set(newServer.id, {
        serverId: newServer.id,
        serverName: newServer.name,
        connectionState: 'disconnected',
        error: null,
        agents: [],
        tasks: [],
        activities: [],
        stats: null,
      });
      return newMap;
    });

    return newServer.id;
  }, []);

  /**
   * Public: Update an existing server
   */
  const updateServer = useCallback((serverId: string, updates: Partial<McpServer>) => {
    console.log('[useMultiAgentServer] updateServer called:', {
      serverId,
      updates: {
        ...updates,
        // Mask token for logging but show if it matches expected
        serverToken: updates.serverToken
          ? `${updates.serverToken.slice(0, 8)}... (matches expected: ${updates.serverToken === 'mcp-multi-agent-token-f75a6267'})`
          : undefined,
      },
    });

    setConfig(prev => {
      const newConfig = {
        ...prev,
        servers: prev.servers.map(s =>
          s.id === serverId ? { ...s, ...updates } : s
        ),
      };

      // Synchronize configRef immediately for any code that needs current value
      configRef.current = newConfig;

      saveConfigToBackend(newConfig, authTokenRef.current);

      // Update connection state name if changed
      if (updates.name) {
        setConnections(prevConn => {
          const newMap = new Map(prevConn);
          const existing = newMap.get(serverId);
          if (existing) {
            newMap.set(serverId, { ...existing, serverName: updates.name! });
          }
          return newMap;
        });
      }

      return newConfig;
    });
  }, []);

  /**
   * Public: Remove a server
   */
  const removeServer = useCallback((serverId: string) => {
    // Disconnect first
    disconnectServer(serverId);

    setConfig(prev => {
      const newConfig = {
        ...prev,
        servers: prev.servers.filter(s => s.id !== serverId),
      };
      saveConfigToBackend(newConfig, authTokenRef.current);
      return newConfig;
    });

    // Remove connection state
    setConnections(prev => {
      const newMap = new Map(prev);
      newMap.delete(serverId);
      return newMap;
    });
  }, [disconnectServer]);

  /**
   * Public: Update global config
   */
  const updateConfig = useCallback((updates: Partial<MultiAgentConfig>) => {
    setConfig(prev => {
      const newConfig = { ...prev, ...updates };
      saveConfigToBackend(newConfig, authTokenRef.current);
      return newConfig;
    });
  }, []);

  /**
   * Public: Refresh all data
   */
  const refreshData = useCallback(async () => {
    const connectedServers = config.servers.filter(s => {
      const conn = connections.get(s.id);
      return conn?.connectionState === 'connected';
    });

    await Promise.all(connectedServers.map(async (server) => {
      try {
        const [agentsData, tasksData, statsData] = await Promise.all([
          apiRequest(server, '/agents').catch(() => null),
          apiRequest(server, '/tasks').catch(() => null),
          apiRequest(server, '/dashboard').catch(() => null),
        ]);

        const updates: Partial<ServerConnection> = {};
        if (agentsData) updates.agents = agentsData as Agent[];
        if (tasksData) updates.tasks = tasksData as AgentTask[];
        if (statsData) updates.stats = statsData as DashboardStats;

        if (Object.keys(updates).length > 0) {
          updateConnectionState(server.id, updates);
        }
      } catch (e) {
        console.error(`[useMultiAgentServer] Refresh failed for ${server.name}:`, e);
      }
    }));
  }, [config.servers, connections, apiRequest, updateConnectionState]);

  /**
   * Public: Refresh config from backend
   * Useful when config may have been changed by another component/page
   */
  const refreshConfig = useCallback(async () => {
    const loaded = await loadConfigFromBackend(authTokenRef.current);
    setConfig(loaded);
    configRef.current = loaded;

    // Initialize connection states for any new servers
    setConnections(prev => {
      const newMap = new Map(prev);
      for (const server of loaded.servers) {
        if (!newMap.has(server.id)) {
          newMap.set(server.id, {
            serverId: server.id,
            serverName: server.name,
            connectionState: 'disconnected',
            error: null,
            agents: [],
            tasks: [],
            activities: [],
            stats: null,
          });
        }
      }
      // Remove connections for servers that no longer exist
      for (const serverId of newMap.keys()) {
        if (!loaded.servers.find(s => s.id === serverId)) {
          newMap.delete(serverId);
        }
      }
      return newMap;
    });
  }, []);

  /**
   * Public: Create task on a specific server
   */
  const createTask = useCallback(async (
    serverId: string,
    task: Partial<AgentTask> & { assignTo?: string }
  ): Promise<AgentTask | null> => {
    const server = config.servers.find(s => s.id === serverId);
    if (!server) {
      console.error(`[useMultiAgentServer] Server not found: ${serverId}`);
      return null;
    }

    try {
      const result = await apiRequest(server, '/tasks', {
        method: 'POST',
        body: JSON.stringify(task),
      });
      return result as AgentTask;
    } catch (e) {
      console.error(`[useMultiAgentServer] Create task failed for ${server.name}:`, e);
      return null;
    }
  }, [config.servers, apiRequest]);

  /**
   * Public: Assign task to agent on a specific server
   */
  const assignTask = useCallback(async (
    serverId: string,
    taskId: string,
    agentId: string
  ): Promise<boolean> => {
    const server = config.servers.find(s => s.id === serverId);
    if (!server) {
      console.error(`[useMultiAgentServer] Server not found: ${serverId}`);
      return false;
    }

    try {
      await apiRequest(server, `/tasks/${taskId}/assign`, {
        method: 'POST',
        body: JSON.stringify({ agentId }),
      });
      return true;
    } catch (e) {
      console.error(`[useMultiAgentServer] Assign task failed for ${server.name}:`, e);
      return false;
    }
  }, [config.servers, apiRequest]);

  /**
   * Public: Update chat agent settings
   */
  const updateChatAgentSettings = useCallback((updates: Partial<ChatAgentSettings>) => {
    setConfig(prev => {
      const newSettings = {
        ...DEFAULT_CHAT_AGENT_SETTINGS,
        ...prev.chatAgentSettings,
        ...updates,
      };
      const newConfig = { ...prev, chatAgentSettings: newSettings };
      saveConfigToBackend(newConfig, authTokenRef.current);
      return newConfig;
    });
  }, []);

  /**
   * Public: Send message to MCP agent and get response
   * This is a simplified chat endpoint for MCP agents
   */
  const sendMessageToMcpAgent = useCallback(async (
    serverId: string,
    agentId: string,
    message: string
  ): Promise<string | null> => {
    const server = config.servers.find(s => s.id === serverId);
    if (!server) {
      console.error(`[useMultiAgentServer] Server not found: ${serverId}`);
      return null;
    }

    try {
      // Try to send chat message to MCP agent
      // MCP server should have a /agents/:agentId/chat endpoint
      const result = await apiRequest(server, `/agents/${agentId}/chat`, {
        method: 'POST',
        body: JSON.stringify({ message }),
      });
      return (result as { response?: string })?.response || null;
    } catch (e) {
      console.error(`[useMultiAgentServer] Send message to MCP agent failed:`, e);
      return null;
    }
  }, [config.servers, apiRequest]);

  /**
   * Public: Get server state by ID
   */
  const getServerState = useCallback((serverId: string): ServerConnection | undefined => {
    return connections.get(serverId);
  }, [connections]);

  // Aggregated data from all connected servers
  const aggregatedAgents = useMemo(() => {
    const result: (Agent & { serverId: string; serverName: string })[] = [];
    connections.forEach((conn) => {
      if (conn.connectionState === 'connected') {
        conn.agents.forEach(agent => {
          result.push({ ...agent, serverId: conn.serverId, serverName: conn.serverName });
        });
      }
    });
    return result;
  }, [connections]);

  const aggregatedTasks = useMemo(() => {
    const result: (AgentTask & { serverId: string; serverName: string })[] = [];
    connections.forEach((conn) => {
      if (conn.connectionState === 'connected') {
        conn.tasks.forEach(task => {
          result.push({ ...task, serverId: conn.serverId, serverName: conn.serverName });
        });
      }
    });
    return result;
  }, [connections]);

  const aggregatedActivities = useMemo(() => {
    const result: (AgentActivity & { serverId: string; serverName: string })[] = [];
    connections.forEach((conn) => {
      conn.activities.forEach(activity => {
        result.push({ ...activity, serverId: conn.serverId, serverName: conn.serverName });
      });
    });
    // Sort by createdAt descending
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [connections]);

  const aggregatedStats = useMemo((): DashboardStats | null => {
    const connectedStats: DashboardStats[] = [];
    connections.forEach((conn) => {
      if (conn.connectionState === 'connected' && conn.stats) {
        connectedStats.push(conn.stats);
      }
    });

    if (connectedStats.length === 0) return null;

    // Aggregate stats with null safety
    return {
      timestamp: new Date().toISOString(),
      tasks: {
        total: connectedStats.reduce((sum, s) => sum + (s.tasks?.total ?? 0), 0),
        pending: connectedStats.reduce((sum, s) => sum + (s.tasks?.pending ?? 0), 0),
        assigned: connectedStats.reduce((sum, s) => sum + (s.tasks?.assigned ?? 0), 0),
        in_progress: connectedStats.reduce((sum, s) => sum + (s.tasks?.in_progress ?? 0), 0),
        completed: connectedStats.reduce((sum, s) => sum + (s.tasks?.completed ?? 0), 0),
        failed: connectedStats.reduce((sum, s) => sum + (s.tasks?.failed ?? 0), 0),
      },
      agents: {
        total: connectedStats.reduce((sum, s) => sum + (s.agents?.total ?? 0), 0),
        idle: connectedStats.reduce((sum, s) => sum + (s.agents?.idle ?? 0), 0),
        busy: connectedStats.reduce((sum, s) => sum + (s.agents?.busy ?? 0), 0),
        offline: connectedStats.reduce((sum, s) => sum + (s.agents?.offline ?? 0), 0),
        byRole: {},
        byMachine: {},
      },
    };
  }, [connections]);

  // Overall connection state
  const overallConnectionState = useMemo((): ConnectionState => {
    const states = Array.from(connections.values()).map(c => c.connectionState);
    if (states.some(s => s === 'connected')) return 'connected';
    if (states.some(s => s === 'connecting')) return 'connecting';
    if (states.some(s => s === 'error')) return 'error';
    return 'disconnected';
  }, [connections]);

  const overallError = useMemo((): string | null => {
    const errors = Array.from(connections.values())
      .filter(c => c.error)
      .map(c => `${c.serverName}: ${c.error}`);
    return errors.length > 0 ? errors.join('; ') : null;
  }, [connections]);

  // Deprecated compatibility methods
  const connect = useCallback(async () => {
    await connectAllEnabled();
  }, [connectAllEnabled]);

  const disconnect = useCallback(() => {
    disconnectAll();
  }, [disconnectAll]);

  // Chat agent settings derived from config
  const chatAgentSettings = useMemo((): ChatAgentSettings => {
    return config.chatAgentSettings || DEFAULT_CHAT_AGENT_SETTINGS;
  }, [config.chatAgentSettings]);

  /**
   * Get servers sorted by priority (lowest number = highest priority)
   */
  const getServersByPriority = useCallback((): McpServer[] => {
    return [...config.servers]
      .filter(s => s.enabled)
      .sort((a, b) => (a.priority ?? 5) - (b.priority ?? 5));
  }, [config.servers]);

  /**
   * Get the selected server for chat based on selection mode
   * Returns the server to use for chat, or null if none available
   */
  const getSelectedServerForChat = useCallback((): McpServer | null => {
    const settings = config.chatAgentSettings || DEFAULT_CHAT_AGENT_SETTINGS;

    if (!settings.useMcpAgent) return null;

    const mode = settings.selectionMode || 'manual';

    if (mode === 'manual') {
      // Manual selection - use the explicitly selected server
      if (settings.mcpServerId) {
        return config.servers.find(s => s.id === settings.mcpServerId) || null;
      }
      return null;
    }

    if (mode === 'priority') {
      // Auto-select highest priority connected server
      const sorted = getServersByPriority();
      for (const server of sorted) {
        const conn = connections.get(server.id);
        if (conn?.connectionState === 'connected') {
          return server;
        }
      }
      return null;
    }

    if (mode === 'failover') {
      // Try servers in priority order until one is connected
      const sorted = getServersByPriority();
      for (const server of sorted) {
        const conn = connections.get(server.id);
        if (conn?.connectionState === 'connected') {
          return server;
        }
      }
      // If no connected server, return highest priority for connection attempt
      return sorted[0] || null;
    }

    return null;
  }, [config.servers, config.chatAgentSettings, connections, getServersByPriority]);

  return {
    // Config
    config,
    updateConfig,

    // Chat agent settings
    chatAgentSettings,
    updateChatAgentSettings,

    // Server management
    addServer,
    updateServer,
    removeServer,

    // Connection control
    connectServer,
    disconnectServer,
    connectAllEnabled,
    disconnectAll,

    // Aggregated data
    agents: aggregatedAgents,
    tasks: aggregatedTasks,
    activities: aggregatedActivities,
    stats: aggregatedStats,

    // Per-server state
    connections,
    getServerState,

    // Overall state
    connectionState: overallConnectionState,
    error: overallError,

    // Utilities
    refreshData,
    refreshConfig,
    createTask,
    assignTask,
    sendMessageToMcpAgent,

    // Priority-based server selection
    getServersByPriority,
    getSelectedServerForChat,

    // Deprecated compatibility
    connect,
    disconnect,
  };
}

export default useMultiAgentServer;
