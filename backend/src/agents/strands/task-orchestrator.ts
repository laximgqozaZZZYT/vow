/**
 * Strands Task Orchestrator Agent for VOW Backend
 *
 * Provides task orchestration capabilities using Strands Agents SDK.
 * Coordinates task distribution, load balancing, and progress monitoring
 * across multiple worker agents connected to the MCP Task Server.
 *
 * Features:
 * - create_task: Create new tasks on MCP Task Server
 * - assign_task: Intelligent task assignment with load balancing
 * - monitor_progress: Detect stalled tasks (5+ minutes without progress)
 * - reassign_task: Reassign failed or stalled tasks to available workers
 *
 * Requirements:
 * - B-008: Strands Task Orchestrator Agent
 * - MCP Task Server connection (HTTP REST + SSE)
 * - Load balancing across worker agents
 * - Orchestration decision logging
 *
 * @module agents/strands/task-orchestrator
 */

import { z } from 'zod';
import { getLogger } from '../../utils/logger.js';
import { withRetry } from '../../utils/retry.js';
import {
  getStrandsConfig,
  agentRegistry,
} from './config.js';
import type {
  StrandsAgentConfig,
  StrandsTool,
  ToolExecutionContext,
} from './types.js';

const logger = getLogger('task-orchestrator');

// =============================================================================
// Constants
// =============================================================================

/** Default MCP Task Server URL */
const DEFAULT_TASK_SERVER_URL = 'http://192.168.2.126:3456';

/** Stall threshold in milliseconds (5 minutes) */
const STALL_THRESHOLD_MS = 5 * 60 * 1000;

/** Maximum reconnection attempts for SSE */
const MAX_RECONNECT_ATTEMPTS = 5;

/** Base delay for exponential backoff in milliseconds */
const BASE_RECONNECT_DELAY_MS = 1000;

/** Maximum delay for exponential backoff in milliseconds */
const MAX_RECONNECT_DELAY_MS = 30000;

/** Heartbeat interval for monitoring in milliseconds */
const HEARTBEAT_INTERVAL_MS = 30000;

// =============================================================================
// Environment Variables
// =============================================================================

/**
 * Get MCP Task Server configuration from environment
 */
function getTaskServerConfig(): { url: string; token: string } {
  const url = process.env['TASK_SERVER_URL'] || DEFAULT_TASK_SERVER_URL;
  const token = process.env['TASK_SERVER_TOKEN'] || '';

  if (!token) {
    logger.warning('TASK_SERVER_TOKEN not set, authentication may fail');
  }

  return { url: url.replace(/\/$/, ''), token };
}

// =============================================================================
// Types
// =============================================================================

/**
 * Task priority levels
 */
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

/**
 * Task status values
 */
export type TaskStatus = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed';

/**
 * Agent status values
 */
export type AgentStatus = 'idle' | 'busy' | 'offline';

/**
 * MCP Task definition
 */
export interface McpTask {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  assignedTo?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  metadata?: Record<string, unknown>;
  result?: unknown;
  error?: string;
}

/**
 * MCP Agent definition
 */
export interface McpAgent {
  id: string;
  name: string;
  role: string;
  status: AgentStatus;
  machineId: string;
  capabilities?: string[];
  currentTaskId?: string;
  lastHeartbeat?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Dashboard statistics from MCP Task Server
 */
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
}

/**
 * SSE Event from MCP Task Server
 */
export interface TaskServerEvent {
  type: string;
  timestamp: string;
  data: unknown;
}

/**
 * Load balancing strategy
 */
export type LoadBalancingStrategy = 'round_robin' | 'least_busy' | 'priority_based' | 'capability_match';

/**
 * Task assignment result
 */
export interface AssignmentResult {
  success: boolean;
  taskId: string;
  assignedTo?: string;
  reason: string;
  strategy: LoadBalancingStrategy;
}

/**
 * Stalled task detection result
 */
export interface StalledTaskResult {
  task: McpTask;
  stalledDurationMs: number;
  lastActivity: string;
  assignedAgent?: McpAgent;
}

/**
 * Orchestration decision log entry
 */
export interface OrchestrationDecision {
  id: string;
  timestamp: string;
  action: 'create' | 'assign' | 'reassign' | 'monitor' | 'alert';
  taskId?: string;
  agentId?: string;
  reason: string;
  details?: Record<string, unknown>;
  outcome: 'success' | 'failure' | 'pending';
}

// =============================================================================
// Tool Schemas
// =============================================================================

/**
 * Schema for create_task tool
 */
export const CreateTaskSchema = z.object({
  title: z.string().min(1).max(200)
    .describe('Task title'),
  description: z.string().max(2000).optional()
    .describe('Detailed task description'),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium')
    .describe('Task priority level'),
  metadata: z.record(z.unknown()).optional()
    .describe('Additional task metadata'),
  assignTo: z.string().optional()
    .describe('Agent ID to immediately assign the task to'),
});

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;

/**
 * Schema for assign_task tool
 */
export const AssignTaskSchema = z.object({
  taskId: z.string().uuid()
    .describe('Task ID to assign'),
  agentId: z.string().uuid().optional()
    .describe('Specific agent ID to assign to (uses load balancing if not specified)'),
  strategy: z.enum(['round_robin', 'least_busy', 'priority_based', 'capability_match']).default('least_busy')
    .describe('Load balancing strategy to use'),
  requiredCapabilities: z.array(z.string()).optional()
    .describe('Required agent capabilities for capability_match strategy'),
});

export type AssignTaskInput = z.infer<typeof AssignTaskSchema>;

/**
 * Schema for monitor_progress tool
 */
export const MonitorProgressSchema = z.object({
  stallThresholdMs: z.number().int().min(60000).default(STALL_THRESHOLD_MS)
    .describe('Time in milliseconds after which a task is considered stalled'),
  includeAssigned: z.boolean().default(true)
    .describe('Include assigned (not yet started) tasks in monitoring'),
  taskIds: z.array(z.string().uuid()).optional()
    .describe('Specific task IDs to monitor (all in-progress if not specified)'),
});

export type MonitorProgressInput = z.infer<typeof MonitorProgressSchema>;

/**
 * Schema for reassign_task tool
 */
export const ReassignTaskSchema = z.object({
  taskId: z.string().uuid()
    .describe('Task ID to reassign'),
  reason: z.string().max(500)
    .describe('Reason for reassignment'),
  excludeAgents: z.array(z.string().uuid()).optional()
    .describe('Agent IDs to exclude from reassignment'),
  resetProgress: z.boolean().default(false)
    .describe('Whether to reset task progress on reassignment'),
});

export type ReassignTaskInput = z.infer<typeof ReassignTaskSchema>;

// =============================================================================
// MCP Task Server Client
// =============================================================================

/**
 * Client for communicating with MCP Task Server
 */
export class McpTaskServerClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private eventSource: EventSource | null = null;
  private reconnectAttempts = 0;
  private isConnected = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(serverUrl?: string, authToken?: string) {
    const config = getTaskServerConfig();
    this.baseUrl = serverUrl || config.url;
    this.token = authToken || config.token;

    logger.info('MCP Task Server Client initialized', {
      baseUrl: this.baseUrl,
      hasToken: !!this.token,
    });
  }

  /**
   * Make authenticated HTTP request to the server
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(this.token ? { 'Authorization': `Bearer ${this.token}` } : {}),
      ...(options.headers as Record<string, string> || {}),
    };

    return withRetry(async () => {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json() as { success?: boolean; error?: string; data?: T };

      if (data.success === false) {
        throw new Error(data.error || 'Request failed');
      }

      return (data.data ?? data) as T;
    });
  }

  /**
   * Connect to SSE for real-time updates
   */
  connectSSE(handlers: {
    onAgent?: (agent: McpAgent, eventType: string) => void;
    onTask?: (task: McpTask, eventType: string) => void;
    onStats?: (stats: DashboardStats) => void;
    onError?: (error: Error) => void;
    onConnect?: () => void;
    onDisconnect?: () => void;
  }): void {
    if (this.eventSource) {
      this.eventSource.close();
    }

    const url = `${this.baseUrl}/events${this.token ? `?token=${encodeURIComponent(this.token)}` : ''}`;

    logger.info('Connecting to SSE', { url: this.baseUrl });

    // Note: In Node.js, we need to use a polyfill or different approach for EventSource
    // For now, we'll use polling as a fallback
    if (typeof EventSource === 'undefined') {
      logger.warning('EventSource not available, using polling fallback');
      this.startPolling(handlers);
      return;
    }

    this.eventSource = new EventSource(url);

    this.eventSource.onopen = () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      logger.info('SSE connection established');
      handlers.onConnect?.();
    };

    this.eventSource.onmessage = (event) => {
      try {
        const sseEvent = JSON.parse(event.data) as TaskServerEvent;
        this.handleSSEEvent(sseEvent, handlers);
      } catch (e) {
        logger.error('Failed to parse SSE event', e as Error, {
          data: event.data,
        });
      }
    };

    this.eventSource.onerror = () => {
      this.isConnected = false;
      logger.error('SSE connection error', new Error('SSE connection lost'));
      handlers.onDisconnect?.();
      this.reconnect(handlers);
    };
  }

  /**
   * Handle incoming SSE event
   */
  private handleSSEEvent(
    event: TaskServerEvent,
    handlers: Parameters<typeof this.connectSSE>[0]
  ): void {
    const { type, data } = event;

    switch (type) {
      case 'agent_registered':
      case 'agent_status_changed':
      case 'agent_removed':
        handlers.onAgent?.(data as McpAgent, type);
        break;

      case 'task_created':
      case 'task_assigned':
      case 'task_started':
      case 'task_completed':
      case 'task_failed':
        handlers.onTask?.(data as McpTask, type);
        break;

      case 'dashboard_update':
        handlers.onStats?.(data as DashboardStats);
        break;

      case 'heartbeat':
        // Heartbeat received, connection is alive
        break;

      case 'connected':
        logger.info('SSE connected confirmation received');
        break;

      default:
        logger.debug('Unknown SSE event type', { type });
    }
  }

  /**
   * Reconnect to SSE with exponential backoff
   */
  private reconnect(handlers: Parameters<typeof this.connectSSE>[0]): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      const error = new Error('Max SSE reconnection attempts reached');
      logger.error('SSE reconnection failed', error);
      handlers.onError?.(error);
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      BASE_RECONNECT_DELAY_MS * Math.pow(2, this.reconnectAttempts - 1),
      MAX_RECONNECT_DELAY_MS
    );

    logger.info('Attempting SSE reconnection', {
      attempt: this.reconnectAttempts,
      maxAttempts: MAX_RECONNECT_ATTEMPTS,
      delayMs: delay,
    });

    setTimeout(() => {
      this.connectSSE(handlers);
    }, delay);
  }

  /**
   * Start polling as a fallback when SSE is not available
   */
  private startPolling(handlers: Parameters<typeof this.connectSSE>[0]): void {
    this.heartbeatInterval = setInterval(async () => {
      try {
        const stats = await this.getDashboard();
        handlers.onStats?.(stats);
      } catch (e) {
        logger.error('Polling failed', e as Error);
      }
    }, HEARTBEAT_INTERVAL_MS);

    // Initial fetch
    this.getDashboard()
      .then(stats => {
        this.isConnected = true;
        handlers.onConnect?.();
        handlers.onStats?.(stats);
      })
      .catch(error => {
        handlers.onError?.(error);
      });
  }

  /**
   * Disconnect from SSE
   */
  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    this.isConnected = false;
    this.reconnectAttempts = 0;

    logger.info('Disconnected from MCP Task Server');
  }

  /**
   * Check if connected to the server
   */
  get connected(): boolean {
    return this.isConnected;
  }

  /**
   * Check server health
   */
  async checkHealth(): Promise<{ healthy: boolean; version?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      const data = await response.json() as { status?: string; version?: string };
      const result: { healthy: boolean; version?: string } = {
        healthy: response.ok && data.status === 'ok',
      };
      if (data.version !== undefined) {
        result.version = data.version;
      }
      return result;
    } catch {
      return { healthy: false };
    }
  }

  /**
   * Get dashboard statistics
   */
  async getDashboard(): Promise<DashboardStats> {
    return this.request<DashboardStats>('/dashboard');
  }

  /**
   * List all agents
   */
  async listAgents(): Promise<McpAgent[]> {
    return this.request<McpAgent[]>('/agents');
  }

  /**
   * List all tasks
   */
  async listTasks(filters?: {
    status?: TaskStatus;
    assignedTo?: string;
    priority?: TaskPriority;
  }): Promise<McpTask[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.assignedTo) params.set('assignedTo', filters.assignedTo);
    if (filters?.priority) params.set('priority', filters.priority);

    const queryString = params.toString();
    const endpoint = queryString ? `/tasks?${queryString}` : '/tasks';

    return this.request<McpTask[]>(endpoint);
  }

  /**
   * Get a specific task
   */
  async getTask(taskId: string): Promise<McpTask> {
    return this.request<McpTask>(`/tasks/${taskId}`);
  }

  /**
   * Create a new task
   */
  async createTask(task: {
    title: string;
    description?: string;
    priority?: TaskPriority;
    metadata?: Record<string, unknown>;
    createdBy: string;
  }): Promise<McpTask> {
    return this.request<McpTask>('/tasks', {
      method: 'POST',
      body: JSON.stringify(task),
    });
  }

  /**
   * Assign a task to an agent
   */
  async assignTask(taskId: string, agentId: string): Promise<McpTask> {
    return this.request<McpTask>(`/tasks/${taskId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ agentId }),
    });
  }

  /**
   * Update task status
   */
  async updateTaskStatus(
    taskId: string,
    status: TaskStatus,
    result?: unknown,
    error?: string
  ): Promise<McpTask> {
    return this.request<McpTask>(`/tasks/${taskId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, result, error }),
    });
  }

  /**
   * Get a specific agent
   */
  async getAgent(agentId: string): Promise<McpAgent> {
    return this.request<McpAgent>(`/agents/${agentId}`);
  }
}

// =============================================================================
// Load Balancer
// =============================================================================

/**
 * Load balancer for distributing tasks across agents
 */
export class TaskLoadBalancer {
  private roundRobinIndex = 0;

  /**
   * Select an agent based on the specified strategy
   */
  async selectAgent(
    agents: McpAgent[],
    task: McpTask,
    strategy: LoadBalancingStrategy,
    options?: {
      requiredCapabilities?: string[];
      excludeAgents?: string[];
    }
  ): Promise<{ agent: McpAgent | null; reason: string }> {
    // Filter available agents
    let availableAgents = agents.filter(a => {
      // Must be idle
      if (a.status !== 'idle') return false;

      // Exclude specified agents
      if (options?.excludeAgents?.includes(a.id)) return false;

      // Check capabilities for capability_match strategy
      if (strategy === 'capability_match' && options?.requiredCapabilities) {
        const agentCapabilities = a.capabilities || [];
        const hasAllCapabilities = options.requiredCapabilities.every(
          cap => agentCapabilities.includes(cap)
        );
        if (!hasAllCapabilities) return false;
      }

      return true;
    });

    if (availableAgents.length === 0) {
      return {
        agent: null,
        reason: 'No available agents matching criteria',
      };
    }

    let selectedAgent: McpAgent;
    let reason: string;

    switch (strategy) {
      case 'round_robin': {
        this.roundRobinIndex = (this.roundRobinIndex + 1) % availableAgents.length;
        const agent = availableAgents[this.roundRobinIndex];
        if (agent) {
          selectedAgent = agent;
          reason = `Round-robin selection (index: ${this.roundRobinIndex})`;
        } else {
          return { agent: null, reason: 'No agent at round-robin index' };
        }
        break;
      }

      case 'least_busy': {
        // For now, all idle agents are equally "not busy"
        // In production, this could consider recent task count, avg completion time, etc.
        const leastBusyAgent = availableAgents[0];
        if (leastBusyAgent) {
          selectedAgent = leastBusyAgent;
          reason = 'Least busy agent (first available)';
        } else {
          return { agent: null, reason: 'No least busy agent available' };
        }
        break;
      }

      case 'priority_based': {
        // For critical/high priority tasks, prefer agents with fewer recent failures
        // For simplicity, we'll just select the first available
        if (task.priority === 'critical' || task.priority === 'high') {
          // Could implement more sophisticated logic here
          const priorityAgent = availableAgents[0];
          if (priorityAgent) {
            selectedAgent = priorityAgent;
            reason = `Priority-based selection for ${task.priority} priority task`;
          } else {
            return { agent: null, reason: 'No agent for priority task' };
          }
        } else {
          // Use round-robin for lower priority
          this.roundRobinIndex = (this.roundRobinIndex + 1) % availableAgents.length;
          const rrAgent = availableAgents[this.roundRobinIndex];
          if (rrAgent) {
            selectedAgent = rrAgent;
            reason = `Priority-based selection (round-robin for ${task.priority} priority)`;
          } else {
            return { agent: null, reason: 'No agent at round-robin index' };
          }
        }
        break;
      }

      case 'capability_match': {
        // Already filtered by capabilities above
        const capAgent = availableAgents[0];
        if (capAgent) {
          selectedAgent = capAgent;
          reason = `Capability-matched agent with required capabilities`;
        } else {
          return { agent: null, reason: 'No capability-matched agent' };
        }
        break;
      }

      default: {
        const defaultAgent = availableAgents[0];
        if (defaultAgent) {
          selectedAgent = defaultAgent;
          reason = 'Default selection (first available)';
        } else {
          return { agent: null, reason: 'No agent available' };
        }
      }
    }

    logger.info('Agent selected for task', {
      strategy,
      agentId: selectedAgent.id,
      agentName: selectedAgent.name,
      taskId: task.id,
      reason,
    });

    return { agent: selectedAgent, reason };
  }
}

// =============================================================================
// Orchestration Decision Logger
// =============================================================================

/**
 * Logger for orchestration decisions
 */
export class OrchestrationLogger {
  private decisions: OrchestrationDecision[] = [];
  private maxDecisions = 1000;

  /**
   * Log an orchestration decision
   */
  log(
    action: OrchestrationDecision['action'],
    params: {
      taskId?: string;
      agentId?: string;
      reason: string;
      details?: Record<string, unknown>;
      outcome: OrchestrationDecision['outcome'];
    }
  ): OrchestrationDecision {
    const decision: OrchestrationDecision = {
      id: `decision-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      action,
      ...params,
    };

    this.decisions.unshift(decision);

    // Trim old decisions
    if (this.decisions.length > this.maxDecisions) {
      this.decisions = this.decisions.slice(0, this.maxDecisions);
    }

    // Also log to structured logger
    logger.info('Orchestration decision', {
      decisionId: decision.id,
      action,
      taskId: params.taskId,
      agentId: params.agentId,
      reason: params.reason,
      outcome: params.outcome,
    });

    return decision;
  }

  /**
   * Get recent decisions
   */
  getRecent(count = 50): OrchestrationDecision[] {
    return this.decisions.slice(0, count);
  }

  /**
   * Get decisions for a specific task
   */
  getForTask(taskId: string): OrchestrationDecision[] {
    return this.decisions.filter(d => d.taskId === taskId);
  }

  /**
   * Clear all decisions
   */
  clear(): void {
    this.decisions = [];
  }
}

// =============================================================================
// Tool Implementations
// =============================================================================

/**
 * Create a new task on the MCP Task Server
 */
async function executeCreateTask(
  input: CreateTaskInput,
  context: ToolExecutionContext,
  client: McpTaskServerClient,
  orchestrationLogger: OrchestrationLogger
): Promise<McpTask> {
  const startTime = Date.now();

  logger.info('Creating task', {
    title: input.title,
    priority: input.priority,
    userId: context.userId,
  });

  try {
    const createTaskParams: {
      title: string;
      description?: string;
      priority?: TaskPriority;
      metadata?: Record<string, unknown>;
      createdBy: string;
    } = {
      title: input.title,
      priority: input.priority,
      createdBy: context.userId,
    };
    if (input.description !== undefined) {
      createTaskParams.description = input.description;
    }
    if (input.metadata !== undefined) {
      createTaskParams.metadata = input.metadata;
    }
    const task = await client.createTask(createTaskParams);

    orchestrationLogger.log('create', {
      taskId: task.id,
      reason: `Task created: ${input.title}`,
      details: { priority: input.priority },
      outcome: 'success',
    });

    // If assignTo is specified, assign the task immediately
    if (input.assignTo) {
      try {
        await client.assignTask(task.id, input.assignTo);
        orchestrationLogger.log('assign', {
          taskId: task.id,
          agentId: input.assignTo,
          reason: 'Immediate assignment on creation',
          outcome: 'success',
        });
      } catch (assignError) {
        logger.warning('Failed to assign task on creation', {
          taskId: task.id,
          assignTo: input.assignTo,
          error: (assignError as Error).message,
        });
      }
    }

    logger.info('Task created successfully', {
      taskId: task.id,
      durationMs: Date.now() - startTime,
    });

    return task;
  } catch (error) {
    orchestrationLogger.log('create', {
      reason: `Failed to create task: ${(error as Error).message}`,
      details: { title: input.title },
      outcome: 'failure',
    });
    throw error;
  }
}

/**
 * Assign a task to an agent with load balancing
 */
async function executeAssignTask(
  input: AssignTaskInput,
  _context: ToolExecutionContext,
  client: McpTaskServerClient,
  loadBalancer: TaskLoadBalancer,
  orchestrationLogger: OrchestrationLogger
): Promise<AssignmentResult> {
  const startTime = Date.now();

  logger.info('Assigning task', {
    taskId: input.taskId,
    agentId: input.agentId,
    strategy: input.strategy,
  });

  try {
    // Get the task
    const task = await client.getTask(input.taskId);

    if (task.status !== 'pending' && task.status !== 'failed') {
      const reason = `Task is not assignable (status: ${task.status})`;
      orchestrationLogger.log('assign', {
        taskId: input.taskId,
        reason,
        outcome: 'failure',
      });
      return {
        success: false,
        taskId: input.taskId,
        reason,
        strategy: input.strategy,
      };
    }

    let agentId = input.agentId;
    let selectionReason = 'Directly specified agent';

    // If no agent specified, use load balancing
    if (!agentId) {
      const agents = await client.listAgents();
      const selectOptions: { requiredCapabilities?: string[]; excludeAgents?: string[] } = {};
      if (input.requiredCapabilities !== undefined) {
        selectOptions.requiredCapabilities = input.requiredCapabilities;
      }
      const { agent, reason } = await loadBalancer.selectAgent(
        agents,
        task,
        input.strategy,
        selectOptions
      );

      if (!agent) {
        orchestrationLogger.log('assign', {
          taskId: input.taskId,
          reason,
          details: { strategy: input.strategy },
          outcome: 'failure',
        });
        return {
          success: false,
          taskId: input.taskId,
          reason,
          strategy: input.strategy,
        };
      }

      agentId = agent.id;
      selectionReason = reason;
    }

    // Assign the task
    await client.assignTask(input.taskId, agentId);

    orchestrationLogger.log('assign', {
      taskId: input.taskId,
      agentId,
      reason: selectionReason,
      details: { strategy: input.strategy },
      outcome: 'success',
    });

    logger.info('Task assigned successfully', {
      taskId: input.taskId,
      agentId,
      strategy: input.strategy,
      durationMs: Date.now() - startTime,
    });

    return {
      success: true,
      taskId: input.taskId,
      assignedTo: agentId,
      reason: selectionReason,
      strategy: input.strategy,
    };
  } catch (error) {
    const reason = `Assignment failed: ${(error as Error).message}`;
    orchestrationLogger.log('assign', {
      taskId: input.taskId,
      reason,
      outcome: 'failure',
    });
    throw error;
  }
}

/**
 * Monitor task progress and detect stalled tasks
 */
async function executeMonitorProgress(
  input: MonitorProgressInput,
  _context: ToolExecutionContext,
  client: McpTaskServerClient,
  orchestrationLogger: OrchestrationLogger
): Promise<{
  stalledTasks: StalledTaskResult[];
  summary: {
    monitored: number;
    stalled: number;
    healthy: number;
  };
}> {
  const startTime = Date.now();
  const now = Date.now();

  logger.info('Monitoring task progress', {
    stallThresholdMs: input.stallThresholdMs,
    includeAssigned: input.includeAssigned,
    taskIds: input.taskIds,
  });

  try {
    // Get tasks to monitor
    let tasks: McpTask[];

    if (input.taskIds && input.taskIds.length > 0) {
      tasks = await Promise.all(
        input.taskIds.map(id => client.getTask(id))
      );
    } else {
      const allTasks = await client.listTasks();
      tasks = allTasks.filter(t => {
        if (t.status === 'in_progress') return true;
        if (input.includeAssigned && t.status === 'assigned') return true;
        return false;
      });
    }

    // Get agents for reference
    const agents = await client.listAgents();
    const agentById = new Map(agents.map(a => [a.id, a]));

    // Check for stalled tasks
    const stalledTasks: StalledTaskResult[] = [];

    for (const task of tasks) {
      // Determine last activity time
      const lastActivityTime = task.startedAt
        ? new Date(task.startedAt).getTime()
        : new Date(task.updatedAt).getTime();

      const stalledDuration = now - lastActivityTime;

      if (stalledDuration >= input.stallThresholdMs) {
        const stalledResult: StalledTaskResult = {
          task,
          stalledDurationMs: stalledDuration,
          lastActivity: task.startedAt || task.updatedAt,
        };
        if (task.assignedTo) {
          const agent = agentById.get(task.assignedTo);
          if (agent) {
            stalledResult.assignedAgent = agent;
          }
        }
        stalledTasks.push(stalledResult);
      }
    }

    // Log monitoring results
    orchestrationLogger.log('monitor', {
      reason: `Monitored ${tasks.length} tasks, found ${stalledTasks.length} stalled`,
      details: {
        monitoredCount: tasks.length,
        stalledCount: stalledTasks.length,
        stallThresholdMs: input.stallThresholdMs,
      },
      outcome: 'success',
    });

    // Log alerts for stalled tasks
    for (const stalled of stalledTasks) {
      const alertParams: {
        taskId?: string;
        agentId?: string;
        reason: string;
        details?: Record<string, unknown>;
        outcome: 'success' | 'failure' | 'pending';
      } = {
        taskId: stalled.task.id,
        reason: `Task stalled for ${Math.round(stalled.stalledDurationMs / 1000 / 60)} minutes`,
        details: {
          lastActivity: stalled.lastActivity,
          stalledDurationMs: stalled.stalledDurationMs,
        },
        outcome: 'pending',
      };
      if (stalled.assignedAgent?.id) {
        alertParams.agentId = stalled.assignedAgent.id;
      }
      orchestrationLogger.log('alert', alertParams);
    }

    logger.info('Progress monitoring completed', {
      monitored: tasks.length,
      stalled: stalledTasks.length,
      durationMs: Date.now() - startTime,
    });

    return {
      stalledTasks,
      summary: {
        monitored: tasks.length,
        stalled: stalledTasks.length,
        healthy: tasks.length - stalledTasks.length,
      },
    };
  } catch (error) {
    orchestrationLogger.log('monitor', {
      reason: `Monitoring failed: ${(error as Error).message}`,
      outcome: 'failure',
    });
    throw error;
  }
}

/**
 * Reassign a failed or stalled task
 */
async function executeReassignTask(
  input: ReassignTaskInput,
  _context: ToolExecutionContext,
  client: McpTaskServerClient,
  loadBalancer: TaskLoadBalancer,
  orchestrationLogger: OrchestrationLogger
): Promise<AssignmentResult> {
  const startTime = Date.now();

  logger.info('Reassigning task', {
    taskId: input.taskId,
    reason: input.reason,
    excludeAgents: input.excludeAgents,
  });

  try {
    // Get the task
    const task = await client.getTask(input.taskId);

    // Build exclude list (include previously assigned agent)
    const excludeAgents = [...(input.excludeAgents || [])];
    if (task.assignedTo && !excludeAgents.includes(task.assignedTo)) {
      excludeAgents.push(task.assignedTo);
    }

    // Reset task status if requested
    if (input.resetProgress) {
      await client.updateTaskStatus(input.taskId, 'pending');
    } else if (task.status === 'in_progress' || task.status === 'failed') {
      await client.updateTaskStatus(input.taskId, 'pending');
    }

    // Select a new agent
    const agents = await client.listAgents();
    const { agent, reason: selectionReason } = await loadBalancer.selectAgent(
      agents,
      { ...task, status: 'pending' },
      'least_busy',
      { excludeAgents }
    );

    if (!agent) {
      orchestrationLogger.log('reassign', {
        taskId: input.taskId,
        reason: `Reassignment failed: ${selectionReason}`,
        details: { originalReason: input.reason },
        outcome: 'failure',
      });
      return {
        success: false,
        taskId: input.taskId,
        reason: selectionReason,
        strategy: 'least_busy',
      };
    }

    // Assign to new agent
    await client.assignTask(input.taskId, agent.id);

    orchestrationLogger.log('reassign', {
      taskId: input.taskId,
      agentId: agent.id,
      reason: `Reassigned: ${input.reason}. ${selectionReason}`,
      details: {
        previousAgent: task.assignedTo,
        excludedAgents: excludeAgents,
      },
      outcome: 'success',
    });

    logger.info('Task reassigned successfully', {
      taskId: input.taskId,
      newAgentId: agent.id,
      previousAgentId: task.assignedTo,
      durationMs: Date.now() - startTime,
    });

    return {
      success: true,
      taskId: input.taskId,
      assignedTo: agent.id,
      reason: `Reassigned: ${input.reason}`,
      strategy: 'least_busy',
    };
  } catch (error) {
    orchestrationLogger.log('reassign', {
      taskId: input.taskId,
      reason: `Reassignment failed: ${(error as Error).message}`,
      details: { originalReason: input.reason },
      outcome: 'failure',
    });
    throw error;
  }
}

// =============================================================================
// Task Orchestrator Agent
// =============================================================================

/**
 * Configuration for the Task Orchestrator Agent
 */
export interface TaskOrchestratorConfig {
  /** MCP Task Server URL */
  serverUrl?: string;
  /** Authentication token */
  serverToken?: string;
  /** Model to use */
  model?: string;
  /** Temperature for responses */
  temperature?: number;
  /** Maximum tokens */
  maxTokens?: number;
  /** Enable automatic SSE connection */
  autoConnectSSE?: boolean;
}

/**
 * Task Orchestrator Agent using Strands SDK patterns
 */
export class TaskOrchestratorAgent {
  private readonly config: Required<TaskOrchestratorConfig>;
  private readonly client: McpTaskServerClient;
  private readonly loadBalancer: TaskLoadBalancer;
  private readonly orchestrationLogger: OrchestrationLogger;
  private readonly tools: Map<string, StrandsTool>;

  constructor(config: TaskOrchestratorConfig = {}) {
    const strandsConfig = getStrandsConfig();
    const serverConfig = getTaskServerConfig();

    this.config = {
      serverUrl: config.serverUrl || serverConfig.url,
      serverToken: config.serverToken || serverConfig.token,
      model: config.model || strandsConfig.defaultModel,
      temperature: config.temperature ?? strandsConfig.defaultTemperature,
      maxTokens: config.maxTokens ?? strandsConfig.defaultMaxTokens,
      autoConnectSSE: config.autoConnectSSE ?? false,
    };

    this.client = new McpTaskServerClient(this.config.serverUrl, this.config.serverToken);
    this.loadBalancer = new TaskLoadBalancer();
    this.orchestrationLogger = new OrchestrationLogger();
    this.tools = new Map();

    // Register tools
    this.registerTools();

    logger.info('Task Orchestrator Agent initialized', {
      serverUrl: this.config.serverUrl,
      model: this.config.model,
      toolCount: this.tools.size,
    });

    // Auto-connect SSE if configured
    if (this.config.autoConnectSSE) {
      this.connectSSE();
    }
  }

  /**
   * Register agent tools
   */
  private registerTools(): void {
    const createTaskTool: StrandsTool<CreateTaskInput, McpTask> = {
      name: 'create_task',
      description: 'Create a new task on the MCP Task Server for worker agents to execute',
      inputSchema: CreateTaskSchema as z.ZodSchema<CreateTaskInput>,
      execute: async (input, context) => {
        return executeCreateTask(input, context, this.client, this.orchestrationLogger);
      },
    };

    const assignTaskTool: StrandsTool<AssignTaskInput, AssignmentResult> = {
      name: 'assign_task',
      description: 'Assign a task to a worker agent using load balancing strategies',
      inputSchema: AssignTaskSchema as z.ZodSchema<AssignTaskInput>,
      execute: async (input, context) => {
        return executeAssignTask(input, context, this.client, this.loadBalancer, this.orchestrationLogger);
      },
    };

    const monitorProgressTool: StrandsTool<MonitorProgressInput, {
      stalledTasks: StalledTaskResult[];
      summary: { monitored: number; stalled: number; healthy: number };
    }> = {
      name: 'monitor_progress',
      description: 'Monitor task progress and detect stalled tasks (5+ minutes without progress)',
      inputSchema: MonitorProgressSchema as z.ZodSchema<MonitorProgressInput>,
      execute: async (input, context) => {
        return executeMonitorProgress(input, context, this.client, this.orchestrationLogger);
      },
    };

    const reassignTaskTool: StrandsTool<ReassignTaskInput, AssignmentResult> = {
      name: 'reassign_task',
      description: 'Reassign a failed or stalled task to a different worker agent',
      inputSchema: ReassignTaskSchema as z.ZodSchema<ReassignTaskInput>,
      execute: async (input, context) => {
        return executeReassignTask(input, context, this.client, this.loadBalancer, this.orchestrationLogger);
      },
    };

    this.tools.set('create_task', createTaskTool as StrandsTool<unknown, unknown>);
    this.tools.set('assign_task', assignTaskTool as StrandsTool<unknown, unknown>);
    this.tools.set('monitor_progress', monitorProgressTool as StrandsTool<unknown, unknown>);
    this.tools.set('reassign_task', reassignTaskTool as StrandsTool<unknown, unknown>);
  }

  /**
   * Get Strands agent configuration
   */
  getAgentConfig(): StrandsAgentConfig {
    return {
      name: 'task-orchestrator',
      role: 'Task Orchestrator - Coordinates task distribution and monitors worker agents',
      tools: Array.from(this.tools.values()),
      systemPrompt: this.getSystemPrompt(),
      model: this.config.model,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
    };
  }

  /**
   * Get system prompt for the agent
   */
  getSystemPrompt(): string {
    return `You are a Task Orchestrator Agent responsible for coordinating tasks across multiple worker agents.

## Your Responsibilities

1. **Task Creation**: Create new tasks on the MCP Task Server for worker agents
2. **Task Assignment**: Intelligently assign tasks using load balancing strategies
3. **Progress Monitoring**: Detect stalled tasks (5+ minutes without progress)
4. **Task Reassignment**: Reassign failed or stalled tasks to available workers

## Load Balancing Strategies

- **round_robin**: Distribute tasks evenly across available agents
- **least_busy**: Assign to the least busy agent (first available)
- **priority_based**: High/critical tasks get priority agent selection
- **capability_match**: Match tasks to agents with required capabilities

## Guidelines

1. Always check agent availability before assignment
2. Monitor critical and high-priority tasks more frequently
3. When reassigning, exclude the previously assigned agent
4. Log all orchestration decisions for auditing
5. Consider agent capabilities when using capability_match strategy

## Current Configuration

- MCP Task Server: ${this.config.serverUrl}
- Stall Threshold: ${STALL_THRESHOLD_MS / 1000 / 60} minutes`;
  }

  /**
   * Get available tools
   */
  getTools(): StrandsTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get a tool by name
   */
  getTool(name: string): StrandsTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Execute a tool
   */
  async executeTool<TInput, TOutput>(
    toolName: string,
    input: TInput,
    context: ToolExecutionContext
  ): Promise<TOutput> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    const startTime = Date.now();

    try {
      // Validate input
      const validatedInput = tool.inputSchema.parse(input);

      // Execute tool
      const result = await tool.execute(validatedInput, context) as TOutput;

      logger.info('Tool executed successfully', {
        toolName,
        userId: context.userId,
        durationMs: Date.now() - startTime,
      });

      return result;
    } catch (error) {
      logger.error('Tool execution failed', error as Error, {
        toolName,
        userId: context.userId,
      });
      throw error;
    }
  }

  /**
   * Connect to MCP Task Server SSE
   */
  connectSSE(handlers?: {
    onAgent?: (agent: McpAgent, eventType: string) => void;
    onTask?: (task: McpTask, eventType: string) => void;
    onStats?: (stats: DashboardStats) => void;
    onError?: (error: Error) => void;
  }): void {
    this.client.connectSSE({
      onAgent: (agent, eventType) => {
        logger.debug('Agent event received', { agentId: agent.id, eventType });
        handlers?.onAgent?.(agent, eventType);
      },
      onTask: (task, eventType) => {
        logger.debug('Task event received', { taskId: task.id, eventType });
        handlers?.onTask?.(task, eventType);
      },
      onStats: (stats) => {
        handlers?.onStats?.(stats);
      },
      onError: (error) => {
        logger.error('SSE error', error);
        handlers?.onError?.(error);
      },
      onConnect: () => {
        logger.info('Connected to MCP Task Server SSE');
      },
      onDisconnect: () => {
        logger.warning('Disconnected from MCP Task Server SSE');
      },
    });
  }

  /**
   * Disconnect from SSE
   */
  disconnectSSE(): void {
    this.client.disconnect();
  }

  /**
   * Check if connected to the server
   */
  get isConnected(): boolean {
    return this.client.connected;
  }

  /**
   * Get MCP Task Server client for direct access
   */
  getClient(): McpTaskServerClient {
    return this.client;
  }

  /**
   * Get load balancer for direct access
   */
  getLoadBalancer(): TaskLoadBalancer {
    return this.loadBalancer;
  }

  /**
   * Get orchestration decision log
   */
  getOrchestrationLog(): OrchestrationLogger {
    return this.orchestrationLogger;
  }

  /**
   * Get recent orchestration decisions
   */
  getRecentDecisions(count = 50): OrchestrationDecision[] {
    return this.orchestrationLogger.getRecent(count);
  }

  /**
   * Run a monitoring cycle
   */
  async runMonitoringCycle(context: ToolExecutionContext): Promise<{
    monitored: number;
    stalled: number;
    reassigned: number;
  }> {
    logger.info('Running monitoring cycle');

    // Monitor for stalled tasks
    const monitorResult = await this.executeTool<MonitorProgressInput, {
      stalledTasks: StalledTaskResult[];
      summary: { monitored: number; stalled: number; healthy: number };
    }>('monitor_progress', { stallThresholdMs: STALL_THRESHOLD_MS, includeAssigned: true }, context);

    let reassigned = 0;

    // Attempt to reassign stalled tasks
    for (const stalled of monitorResult.stalledTasks) {
      try {
        const result = await this.executeTool<ReassignTaskInput, AssignmentResult>(
          'reassign_task',
          {
            taskId: stalled.task.id,
            reason: `Task stalled for ${Math.round(stalled.stalledDurationMs / 1000 / 60)} minutes`,
            resetProgress: false,
          },
          context
        );

        if (result.success) {
          reassigned++;
        }
      } catch (error) {
        logger.error('Failed to reassign stalled task', error as Error, {
          taskId: stalled.task.id,
        });
      }
    }

    logger.info('Monitoring cycle completed', {
      monitored: monitorResult.summary.monitored,
      stalled: monitorResult.summary.stalled,
      reassigned,
    });

    return {
      monitored: monitorResult.summary.monitored,
      stalled: monitorResult.summary.stalled,
      reassigned,
    };
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

let taskOrchestratorInstance: TaskOrchestratorAgent | null = null;

/**
 * Get or create the Task Orchestrator Agent singleton
 */
export function getTaskOrchestratorAgent(config?: TaskOrchestratorConfig): TaskOrchestratorAgent {
  if (!taskOrchestratorInstance) {
    taskOrchestratorInstance = new TaskOrchestratorAgent(config);

    // Register with agent registry
    agentRegistry.register({
      id: 'task-orchestrator',
      config: taskOrchestratorInstance.getAgentConfig(),
      enabled: true,
      priority: 100, // High priority for orchestration
    });
  }
  return taskOrchestratorInstance;
}

/**
 * Reset the Task Orchestrator Agent instance (useful for testing)
 */
export function resetTaskOrchestratorAgent(): void {
  if (taskOrchestratorInstance) {
    taskOrchestratorInstance.disconnectSSE();
  }
  taskOrchestratorInstance = null;
  agentRegistry.unregister('task-orchestrator');
}

