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
} from '../types/agent.types';

// Default configuration
const DEFAULT_CONFIG: MultiAgentConfig = {
  servers: [],
  showInDashboard: true,
  notifyOnTaskComplete: true,
  notifyOnAgentOffline: true,
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
  createTask: (serverId: string, task: Partial<AgentTask> & { assignTo?: string }) => Promise<AgentTask | null>;
  assignTask: (serverId: string, taskId: string, agentId: string) => Promise<boolean>;

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
        return migrateLegacyConfig(parsed);
      }
      return { ...DEFAULT_CONFIG, ...parsed };
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
 */
async function loadConfigFromBackend(authToken: string | null): Promise<MultiAgentConfig> {
  if (!authToken || !BACKEND_API_URL) {
    return loadConfigFromLocalStorage();
  }

  try {
    const response = await fetch(`${BACKEND_API_URL}/api/mcp-connections`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });

    if (response.ok) {
      const result = await response.json();
      if (result.success && result.data) {
        const apiConfig = result.data;

        // Handle migration flag from server
        if (result.migrated) {
          console.log('[useMultiAgentServer] Config migrated from legacy format');
        }

        // Merge tokens from localStorage (since API returns masked tokens)
        const localConfig = loadConfigFromLocalStorage();
        const localServerById = new Map(localConfig.servers.map(s => [s.id, s]));
        const localServerByUrl = new Map(localConfig.servers.map(s => [s.serverUrl, s]));

        // Restore tokens where API returned masked values
        const serversWithTokens = apiConfig.servers.map((server: McpServer & { hasToken?: boolean }) => {
          if (server.hasToken && server.serverToken === '********') {
            // Try to find matching server by ID first, then by URL (for migration cases)
            const localServer = localServerById.get(server.id) || localServerByUrl.get(server.serverUrl);
            if (localServer?.serverToken && localServer.serverToken !== '********') {
              return { ...server, serverToken: localServer.serverToken };
            }
          }
          return server;
        });

        return {
          ...DEFAULT_CONFIG,
          ...apiConfig,
          servers: serversWithTokens,
        };
      }
    }
  } catch (e) {
    console.error('[useMultiAgentServer] Failed to load config from backend:', e);
  }

  return loadConfigFromLocalStorage();
}

/**
 * Save config to backend API (DynamoDB)
 */
async function saveConfigToBackend(config: MultiAgentConfig, authToken: string | null): Promise<void> {
  // Always save to localStorage as fallback
  saveConfigToLocalStorage(config);

  if (!authToken || !BACKEND_API_URL) {
    return;
  }

  try {
    await fetch(`${BACKEND_API_URL}/api/mcp-connections`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify(config),
    });
  } catch (e) {
    console.error('[useMultiAgentServer] Failed to save config to backend:', e);
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

  // Update authToken ref
  useEffect(() => {
    authTokenRef.current = authToken;
  }, [authToken]);

  // Load config on mount or when authToken changes
  useEffect(() => {
    const loadAndSetConfig = async () => {
      const loaded = await loadConfigFromBackend(authToken);
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
          setTimeout(() => {
            connectToServer(server);
          }, 500);
        }
      }
    };

    loadAndSetConfig();

    return () => {
      // Cleanup on unmount
      eventSourcesRef.current.forEach((es) => es.close());
      reconnectTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
    };
  }, [authToken]);

  /**
   * Make authenticated API request to a server
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

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Unknown error');
    }

    return data.data;
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

    const url = `${server.serverUrl}/events?token=${encodeURIComponent(server.serverToken)}`;
    const eventSource = new EventSource(url);

    eventSource.onopen = () => {
      console.log(`[useMultiAgentServer] SSE connected to ${server.name}`);
      updateConnectionState(server.id, {
        connectionState: 'connected',
        error: null,
      });
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
        console.error(`[useMultiAgentServer] SSE parse error for ${server.name}:`, e);
      }
    };

    eventSource.onerror = () => {
      console.error(`[useMultiAgentServer] SSE error for ${server.name}`);
      updateConnectionState(server.id, {
        connectionState: 'error',
        error: 'Connection lost. Attempting to reconnect...',
      });

      eventSource.close();
      eventSourcesRef.current.delete(server.id);

      // Attempt reconnection
      const existingTimeout = reconnectTimeoutsRef.current.get(server.id);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      const timeout = setTimeout(() => {
        const currentServer = config.servers.find(s => s.id === server.id);
        if (currentServer?.enabled && currentServer.autoConnect) {
          connectToServer(currentServer);
        }
      }, 5000);

      reconnectTimeoutsRef.current.set(server.id, timeout);
    };

    eventSourcesRef.current.set(server.id, eventSource);
  }, [apiRequest, config.servers, updateConnectionState]);

  /**
   * Connect to a specific server
   */
  const connectToServer = useCallback(async (server: McpServer) => {
    updateConnectionState(server.id, {
      connectionState: 'connecting',
      error: null,
    });

    try {
      // Test connection with health check
      const health = await fetch(`${server.serverUrl}/health`);
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

      // Connect SSE
      connectSSE(server);
    } catch (e: unknown) {
      console.error(`[useMultiAgentServer] Connection failed for ${server.name}:`, e);
      updateConnectionState(server.id, {
        connectionState: 'error',
        error: e instanceof Error ? e.message : 'Failed to connect to server',
      });
    }
  }, [apiRequest, connectSSE, updateConnectionState]);

  /**
   * Public: Connect to a specific server by ID
   */
  const connectServer = useCallback(async (serverId: string) => {
    const server = config.servers.find(s => s.id === serverId);
    if (!server) {
      console.error(`[useMultiAgentServer] Server not found: ${serverId}`);
      return;
    }

    if (!server.serverUrl || !server.serverToken) {
      updateConnectionState(serverId, {
        connectionState: 'error',
        error: 'Server URL and token are required',
      });
      return;
    }

    await connectToServer(server);
  }, [config.servers, connectToServer, updateConnectionState]);

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
    await Promise.all(enabledServers.map(s => connectToServer(s)));
  }, [config.servers, connectToServer]);

  /**
   * Public: Disconnect all servers
   */
  const disconnectAll = useCallback(() => {
    config.servers.forEach(s => disconnectServer(s.id));
  }, [config.servers, disconnectServer]);

  /**
   * Public: Add a new server
   */
  const addServer = useCallback((serverData: Omit<McpServer, 'id'>): string => {
    const newServer: McpServer = {
      ...serverData,
      id: crypto.randomUUID(),
    };

    setConfig(prev => {
      const newConfig = {
        ...prev,
        servers: [...prev.servers, newServer],
      };
      saveConfigToBackend(newConfig, authTokenRef.current);
      return newConfig;
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
    setConfig(prev => {
      const newConfig = {
        ...prev,
        servers: prev.servers.map(s =>
          s.id === serverId ? { ...s, ...updates } : s
        ),
      };
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

    // Aggregate stats
    return {
      timestamp: new Date().toISOString(),
      tasks: {
        total: connectedStats.reduce((sum, s) => sum + s.tasks.total, 0),
        pending: connectedStats.reduce((sum, s) => sum + s.tasks.pending, 0),
        assigned: connectedStats.reduce((sum, s) => sum + s.tasks.assigned, 0),
        in_progress: connectedStats.reduce((sum, s) => sum + s.tasks.in_progress, 0),
        completed: connectedStats.reduce((sum, s) => sum + s.tasks.completed, 0),
        failed: connectedStats.reduce((sum, s) => sum + s.tasks.failed, 0),
      },
      agents: {
        total: connectedStats.reduce((sum, s) => sum + s.agents.total, 0),
        idle: connectedStats.reduce((sum, s) => sum + s.agents.idle, 0),
        busy: connectedStats.reduce((sum, s) => sum + s.agents.busy, 0),
        offline: connectedStats.reduce((sum, s) => sum + s.agents.offline, 0),
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

  return {
    // Config
    config,
    updateConfig,

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
    createTask,
    assignTask,

    // Deprecated compatibility
    connect,
    disconnect,
  };
}

export default useMultiAgentServer;
