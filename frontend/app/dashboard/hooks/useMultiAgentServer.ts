/**
 * useMultiAgentServer Hook
 *
 * Provides connection to the MCP Multi-Agent Task Server.
 * Features:
 * - REST API for agents, tasks, dashboard
 * - SSE connection for real-time updates
 * - Automatic reconnection
 * - Configuration persistence
 *
 * @module hooks/useMultiAgentServer
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  Agent,
  AgentTask,
  AgentActivity,
  AgentRole,
  SSEEventType,
  MultiAgentConfig,
  TrustedMachine,
} from '../types/agent.types';

// Default configuration
const DEFAULT_CONFIG: MultiAgentConfig = {
  enabled: false,
  serverUrl: 'http://192.168.2.126:3456',
  serverToken: '',
  autoConnect: true,
  showInDashboard: true,
  notifyOnTaskComplete: true,
  notifyOnAgentOffline: true,
};

// Storage key for config
const CONFIG_STORAGE_KEY = 'vow-multi-agent-config';

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
  recentTasks?: Array<{
    id: string;
    title: string;
    status: string;
    assignedTo: string | null;
  }>;
}

// SSE Event data
interface SSEEvent {
  type: SSEEventType;
  timestamp: string;
  data: unknown;
}

// Hook return type
export interface UseMultiAgentServerReturn {
  // Connection state
  connectionState: ConnectionState;
  error: string | null;

  // Config
  config: MultiAgentConfig;
  updateConfig: (updates: Partial<MultiAgentConfig>) => void;

  // Connection control
  connect: () => Promise<void>;
  disconnect: () => void;

  // Data
  agents: Agent[];
  tasks: AgentTask[];
  activities: AgentActivity[];
  stats: DashboardStats | null;
  machines: TrustedMachine[];

  // API methods
  refreshData: () => Promise<void>;
  createTask: (task: Partial<AgentTask>) => Promise<AgentTask | null>;
  assignTask: (taskId: string, agentId: string) => Promise<boolean>;
  registerAgent: (name: string, role: AgentRole, capabilities?: string[]) => Promise<string | null>;
  sendHeartbeat: (agentId: string, status?: 'idle' | 'busy' | 'offline') => Promise<boolean>;

  // Utilities
  getAgentById: (id: string) => Agent | undefined;
  getTaskById: (id: string) => AgentTask | undefined;
}

/**
 * Load config from localStorage
 */
function loadConfig(): MultiAgentConfig {
  if (typeof window === 'undefined') return DEFAULT_CONFIG;

  try {
    const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error('[useMultiAgentServer] Failed to load config:', e);
  }
  return DEFAULT_CONFIG;
}

/**
 * Save config to localStorage
 */
function saveConfig(config: MultiAgentConfig): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('[useMultiAgentServer] Failed to save config:', e);
  }
}

/**
 * Hook for connecting to the Multi-Agent Task Server
 */
export function useMultiAgentServer(): UseMultiAgentServerReturn {
  // State
  const [config, setConfig] = useState<MultiAgentConfig>(DEFAULT_CONFIG);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [activities, setActivities] = useState<AgentActivity[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [machines, setMachines] = useState<TrustedMachine[]>([]);

  // Refs
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isConnectingRef = useRef(false);

  // Load config on mount
  useEffect(() => {
    const loaded = loadConfig();
    setConfig(loaded);

    // Auto-connect if enabled
    if (loaded.enabled && loaded.autoConnect && loaded.serverToken) {
      // Delay to ensure component is mounted
      setTimeout(() => {
        connectToServer(loaded);
      }, 500);
    }

    return () => {
      // Cleanup on unmount
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Make authenticated API request
   */
  const apiRequest = useCallback(async (
    endpoint: string,
    options: RequestInit = {},
    currentConfig?: MultiAgentConfig
  ): Promise<any> => {
    const cfg = currentConfig || config;
    const url = `${cfg.serverUrl}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cfg.serverToken}`,
      ...(options.headers as Record<string, string> || {}),
    };

    try {
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
    } catch (e: any) {
      console.error(`[useMultiAgentServer] API error (${endpoint}):`, e);
      throw e;
    }
  }, [config]);

  /**
   * Connect to SSE event stream
   */
  const connectSSE = useCallback((cfg: MultiAgentConfig) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const url = `${cfg.serverUrl}/events`;

    // EventSource doesn't support custom headers, so we use a workaround
    // by appending token as query parameter (server should also accept this)
    const eventSource = new EventSource(`${url}?token=${encodeURIComponent(cfg.serverToken)}`);

    eventSource.onopen = () => {
      console.log('[useMultiAgentServer] SSE connected');
      setConnectionState('connected');
      setError(null);
    };

    eventSource.onmessage = (event) => {
      try {
        const sseEvent: SSEEvent = JSON.parse(event.data);

        // Handle different event types
        switch (sseEvent.type) {
          case 'agent_registered':
            setAgents(prev => {
              const agent = sseEvent.data as Agent;
              const existing = prev.find(a => a.id === agent.id);
              if (existing) {
                return prev.map(a => a.id === agent.id ? agent : a);
              }
              return [...prev, agent];
            });
            addActivity(sseEvent);
            break;

          case 'agent_status_changed':
            setAgents(prev => {
              const { agentId, newStatus } = sseEvent.data as { agentId: string; oldStatus: string; newStatus: string };
              return prev.map(a => a.id === agentId ? { ...a, status: newStatus as Agent['status'] } : a);
            });
            addActivity(sseEvent);
            break;

          case 'task_created':
            setTasks(prev => [...prev, sseEvent.data as AgentTask]);
            addActivity(sseEvent);
            break;

          case 'task_assigned':
          case 'task_started':
          case 'task_completed':
          case 'task_failed':
            // Refresh tasks to get updated data
            refreshTasks(cfg);
            addActivity(sseEvent);
            break;

          case 'heartbeat':
            // Ignore heartbeat events
            break;

          default:
            console.log('[useMultiAgentServer] Unknown SSE event:', sseEvent.type);
        }
      } catch (e) {
        console.error('[useMultiAgentServer] SSE parse error:', e);
      }
    };

    eventSource.onerror = (e) => {
      console.error('[useMultiAgentServer] SSE error:', e);
      setConnectionState('error');
      setError('Connection lost. Attempting to reconnect...');

      eventSource.close();
      eventSourceRef.current = null;

      // Attempt reconnection
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      reconnectTimeoutRef.current = setTimeout(() => {
        if (cfg.enabled && cfg.autoConnect) {
          connectToServer(cfg);
        }
      }, 5000);
    };

    eventSourceRef.current = eventSource;
  }, []);

  /**
   * Add activity from SSE event
   */
  const addActivity = useCallback((sseEvent: SSEEvent) => {
    const eventData = sseEvent.data as Record<string, unknown>;
    const activity: AgentActivity = {
      id: `activity-${Date.now()}`,
      eventType: sseEvent.type,
      agentId: (eventData.agentId || eventData.id || '') as string,
      agentName: (eventData.name || eventData.agentName || 'Unknown') as string,
      taskId: eventData.taskId as string | undefined,
      taskTitle: eventData.title as string | undefined,
      details: eventData as Record<string, unknown>,
      createdAt: sseEvent.timestamp,
    };
    setActivities(prev => [activity, ...prev.slice(0, 99)]);
  }, []);

  /**
   * Refresh tasks from server
   */
  const refreshTasks = useCallback(async (cfg: MultiAgentConfig) => {
    try {
      const data = await apiRequest('/tasks', {}, cfg);
      setTasks(data || []);
    } catch (e) {
      // Ignore refresh errors
    }
  }, [apiRequest]);

  /**
   * Connect to server
   */
  const connectToServer = useCallback(async (cfg: MultiAgentConfig) => {
    if (isConnectingRef.current) return;
    isConnectingRef.current = true;

    setConnectionState('connecting');
    setError(null);

    try {
      // Test connection with health check
      const health = await fetch(`${cfg.serverUrl}/health`);
      if (!health.ok) {
        throw new Error('Server health check failed');
      }

      // Fetch initial data
      const [agentsData, tasksData, statsData] = await Promise.all([
        apiRequest('/agents', {}, cfg).catch(() => []),
        apiRequest('/tasks', {}, cfg).catch(() => []),
        apiRequest('/dashboard', {}, cfg).catch(() => null),
      ]);

      setAgents(agentsData || []);
      setTasks(tasksData || []);
      setStats(statsData || null);

      // Connect SSE
      connectSSE(cfg);
    } catch (e: any) {
      console.error('[useMultiAgentServer] Connection failed:', e);
      setConnectionState('error');
      setError(e.message || 'Failed to connect to server');
    } finally {
      isConnectingRef.current = false;
    }
  }, [apiRequest, connectSSE]);

  /**
   * Public: Connect to server
   */
  const connect = useCallback(async () => {
    if (!config.serverUrl || !config.serverToken) {
      setError('Server URL and token are required');
      return;
    }
    await connectToServer(config);
  }, [config, connectToServer]);

  /**
   * Public: Disconnect from server
   */
  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    setConnectionState('disconnected');
    setError(null);
  }, []);

  /**
   * Public: Update config
   */
  const updateConfig = useCallback((updates: Partial<MultiAgentConfig>) => {
    setConfig(prev => {
      const newConfig = { ...prev, ...updates };
      saveConfig(newConfig);
      return newConfig;
    });
  }, []);

  /**
   * Public: Refresh all data
   */
  const refreshData = useCallback(async () => {
    if (connectionState !== 'connected') return;

    try {
      const [agentsData, tasksData, statsData] = await Promise.all([
        apiRequest('/agents').catch(() => agents),
        apiRequest('/tasks').catch(() => tasks),
        apiRequest('/dashboard').catch(() => stats),
      ]);

      setAgents(agentsData || []);
      setTasks(tasksData || []);
      setStats(statsData || null);
    } catch (e) {
      console.error('[useMultiAgentServer] Refresh failed:', e);
    }
  }, [connectionState, apiRequest, agents, tasks, stats]);

  /**
   * Public: Create task
   */
  const createTask = useCallback(async (task: Partial<AgentTask>): Promise<AgentTask | null> => {
    try {
      const result = await apiRequest('/tasks', {
        method: 'POST',
        body: JSON.stringify(task),
      });
      return result;
    } catch (e) {
      console.error('[useMultiAgentServer] Create task failed:', e);
      return null;
    }
  }, [apiRequest]);

  /**
   * Public: Assign task
   */
  const assignTask = useCallback(async (taskId: string, agentId: string): Promise<boolean> => {
    try {
      await apiRequest(`/tasks/${taskId}/assign`, {
        method: 'POST',
        body: JSON.stringify({ agentId }),
      });
      return true;
    } catch (e) {
      console.error('[useMultiAgentServer] Assign task failed:', e);
      return false;
    }
  }, [apiRequest]);

  /**
   * Public: Register agent
   */
  const registerAgent = useCallback(async (
    name: string,
    role: AgentRole,
    capabilities?: string[]
  ): Promise<string | null> => {
    try {
      const machineId = 'local-machine'; // Would get from server in real implementation
      const result = await apiRequest('/agents/register', {
        method: 'POST',
        body: JSON.stringify({ name, role, capabilities, machineId }),
      });
      return result.agentId;
    } catch (e) {
      console.error('[useMultiAgentServer] Register agent failed:', e);
      return null;
    }
  }, [apiRequest]);

  /**
   * Public: Send heartbeat
   */
  const sendHeartbeat = useCallback(async (
    agentId: string,
    status?: 'idle' | 'busy' | 'offline'
  ): Promise<boolean> => {
    try {
      await apiRequest(`/agents/${agentId}/heartbeat`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      });
      return true;
    } catch (e) {
      return false;
    }
  }, [apiRequest]);

  /**
   * Public: Get agent by ID
   */
  const getAgentById = useCallback((id: string): Agent | undefined => {
    return agents.find(a => a.id === id);
  }, [agents]);

  /**
   * Public: Get task by ID
   */
  const getTaskById = useCallback((id: string): AgentTask | undefined => {
    return tasks.find(t => t.id === id);
  }, [tasks]);

  return {
    // Connection state
    connectionState,
    error,

    // Config
    config,
    updateConfig,

    // Connection control
    connect,
    disconnect,

    // Data
    agents,
    tasks,
    activities,
    stats,
    machines,

    // API methods
    refreshData,
    createTask,
    assignTask,
    registerAgent,
    sendHeartbeat,

    // Utilities
    getAgentById,
    getTaskById,
  };
}

export default useMultiAgentServer;
