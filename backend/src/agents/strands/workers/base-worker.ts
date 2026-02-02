/**
 * Base Worker Agent for VOW Backend
 *
 * Provides common functionality for all worker agents:
 * - MCP Task Server registration
 * - Task claiming by role/capability
 * - Heartbeat every 30 seconds
 * - Result submission and status updates
 *
 * Requirements:
 * - B-009: Strands Worker Agent Pool
 * - 7.1-7.8: Worker agent implementation requirements
 *
 * @module agents/strands/workers/base-worker
 */

import { getLogger } from '../../../utils/logger.js';
import { withRetry } from '../../../utils/retry.js';
import {
  getStrandsConfig,
} from '../config.js';
import type {
  StrandsAgentConfig,
  StrandsTool,
  ToolExecutionContext,
} from '../types.js';
import type {
  McpTask,
  TaskStatus,
} from '../task-orchestrator.js';

// =============================================================================
// Constants
// =============================================================================

/** Default MCP Task Server URL */
const DEFAULT_TASK_SERVER_URL = 'http://192.168.2.126:3456';

/** Heartbeat interval in milliseconds (30 seconds) */
const HEARTBEAT_INTERVAL_MS = 30 * 1000;

/** Task poll interval in milliseconds (5 seconds) */
const TASK_POLL_INTERVAL_MS = 5 * 1000;

/** Maximum reconnection attempts */
const MAX_RECONNECT_ATTEMPTS = 10;

/** Base delay for exponential backoff in milliseconds */
const BASE_RECONNECT_DELAY_MS = 1000;

/** Maximum delay for exponential backoff in milliseconds */
const MAX_RECONNECT_DELAY_MS = 30000;

// =============================================================================
// Environment Variables
// =============================================================================

/**
 * Environment variable keys for worker configuration
 */
export const WORKER_ENV_KEYS = {
  TASK_SERVER_URL: 'TASK_SERVER_URL',
  TASK_SERVER_TOKEN: 'TASK_SERVER_TOKEN',
  AGENT_NAME: 'AGENT_NAME',
  AGENT_ROLE: 'AGENT_ROLE',
  MACHINE_ID: 'MACHINE_ID',
  HEARTBEAT_INTERVAL_MS: 'HEARTBEAT_INTERVAL_MS',
  TASK_POLL_INTERVAL_MS: 'TASK_POLL_INTERVAL_MS',
} as const;

/**
 * Get worker configuration from environment variables
 */
export function getWorkerConfig(): WorkerConfig {
  return {
    serverUrl: process.env[WORKER_ENV_KEYS.TASK_SERVER_URL] || DEFAULT_TASK_SERVER_URL,
    serverToken: process.env[WORKER_ENV_KEYS.TASK_SERVER_TOKEN] || '',
    agentName: process.env[WORKER_ENV_KEYS.AGENT_NAME] || `worker-${Date.now()}`,
    agentRole: process.env[WORKER_ENV_KEYS.AGENT_ROLE] || 'general',
    machineId: process.env[WORKER_ENV_KEYS.MACHINE_ID] || 'local',
    heartbeatIntervalMs: parseInt(process.env[WORKER_ENV_KEYS.HEARTBEAT_INTERVAL_MS] || '', 10) || HEARTBEAT_INTERVAL_MS,
    taskPollIntervalMs: parseInt(process.env[WORKER_ENV_KEYS.TASK_POLL_INTERVAL_MS] || '', 10) || TASK_POLL_INTERVAL_MS,
  };
}

// =============================================================================
// Types
// =============================================================================

/**
 * Worker agent configuration
 */
export interface WorkerConfig {
  /** MCP Task Server URL */
  serverUrl: string;
  /** Authentication token */
  serverToken: string;
  /** Agent name */
  agentName: string;
  /** Agent role (e.g., 'frontend', 'backend', 'tester') */
  agentRole: string;
  /** Machine ID for multi-machine setups */
  machineId: string;
  /** Heartbeat interval in milliseconds */
  heartbeatIntervalMs: number;
  /** Task poll interval in milliseconds */
  taskPollIntervalMs: number;
}

/**
 * Worker agent status
 */
export type WorkerStatus = 'idle' | 'busy' | 'offline' | 'error';

/**
 * Worker registration result from MCP Task Server
 */
export interface WorkerRegistration {
  id: string;
  name: string;
  role: string;
  status: WorkerStatus;
  machineId: string;
  capabilities: string[];
  registeredAt: string;
}

/**
 * Task claim result
 */
export interface TaskClaimResult {
  success: boolean;
  task?: McpTask;
  reason?: string;
}

/**
 * Task result submission
 */
export interface TaskResult {
  taskId: string;
  status: 'completed' | 'failed';
  result?: unknown;
  error?: string;
  executionTimeMs: number;
}

/**
 * Worker event handlers
 */
export interface WorkerEventHandlers {
  onRegistered?: (registration: WorkerRegistration) => void;
  onTaskClaimed?: (task: McpTask) => void;
  onTaskCompleted?: (result: TaskResult) => void;
  onTaskFailed?: (taskId: string, error: Error) => void;
  onHeartbeat?: () => void;
  onError?: (error: Error) => void;
  onDisconnect?: () => void;
  onReconnect?: () => void;
}

/**
 * Task processor function type
 */
export type TaskProcessor = (
  task: McpTask,
  context: ToolExecutionContext
) => Promise<unknown>;

// =============================================================================
// Base Worker Agent
// =============================================================================

/**
 * Base Worker Agent class
 *
 * Provides common functionality for worker agents:
 * - Registration with MCP Task Server
 * - Task claiming by role/capability
 * - Heartbeat maintenance
 * - Result submission
 */
export abstract class BaseWorkerAgent {
  protected readonly config: WorkerConfig;
  protected readonly logger;
  protected readonly tools: Map<string, StrandsTool> = new Map();
  protected readonly capabilities: string[] = [];

  private workerId: string | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private taskPollInterval: NodeJS.Timeout | null = null;
  private currentTask: McpTask | null = null;
  private status: WorkerStatus = 'offline';
  private isRunning = false;
  private reconnectAttempts = 0;
  private eventHandlers: WorkerEventHandlers = {};

  constructor(config?: Partial<WorkerConfig>) {
    const defaultConfig = getWorkerConfig();
    this.config = { ...defaultConfig, ...config };
    this.logger = getLogger(`worker-${this.config.agentRole}`);

    this.logger.info('Worker agent initialized', {
      agentName: this.config.agentName,
      role: this.config.agentRole,
      machineId: this.config.machineId,
      serverUrl: this.config.serverUrl,
    });
  }

  // ===========================================================================
  // Abstract Methods (must be implemented by subclasses)
  // ===========================================================================

  /**
   * Get the worker's role name
   */
  abstract getRole(): string;

  /**
   * Get the worker's capabilities
   */
  abstract getCapabilities(): string[];

  /**
   * Process a task
   */
  abstract processTask(task: McpTask, context: ToolExecutionContext): Promise<unknown>;

  /**
   * Check if this worker can handle a specific task
   */
  abstract canHandleTask(task: McpTask): boolean;

  // ===========================================================================
  // Public API
  // ===========================================================================

  /**
   * Set event handlers
   */
  setEventHandlers(handlers: WorkerEventHandlers): void {
    this.eventHandlers = { ...this.eventHandlers, ...handlers };
  }

  /**
   * Start the worker agent
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warning('Worker already running');
      return;
    }

    this.logger.info('Starting worker agent');
    this.isRunning = true;

    try {
      // Register with MCP Task Server
      await this.register();

      // Start heartbeat
      this.startHeartbeat();

      // Start task polling
      this.startTaskPolling();

      this.status = 'idle';
      this.logger.info('Worker agent started successfully', {
        workerId: this.workerId,
        role: this.getRole(),
        capabilities: this.getCapabilities(),
      });
    } catch (error) {
      this.status = 'error';
      this.logger.error('Failed to start worker agent', error as Error);
      this.eventHandlers.onError?.(error as Error);
      throw error;
    }
  }

  /**
   * Stop the worker agent
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.logger.info('Stopping worker agent');
    this.isRunning = false;

    // Stop heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Stop task polling
    if (this.taskPollInterval) {
      clearInterval(this.taskPollInterval);
      this.taskPollInterval = null;
    }

    // Unregister from server
    try {
      await this.unregister();
    } catch (error) {
      this.logger.warning('Failed to unregister from server', {
        error: (error as Error).message,
      });
    }

    this.status = 'offline';
    this.workerId = null;
    this.currentTask = null;

    this.logger.info('Worker agent stopped');
  }

  /**
   * Get current worker status
   */
  getStatus(): WorkerStatus {
    return this.status;
  }

  /**
   * Get current task
   */
  getCurrentTask(): McpTask | null {
    return this.currentTask;
  }

  /**
   * Get worker ID
   */
  getWorkerId(): string | null {
    return this.workerId;
  }

  /**
   * Check if worker is running
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get Strands agent configuration
   */
  getAgentConfig(): StrandsAgentConfig {
    return {
      name: this.config.agentName,
      role: `${this.getRole()} Worker - ${this.getSystemPrompt().slice(0, 100)}...`,
      tools: Array.from(this.tools.values()),
      systemPrompt: this.getSystemPrompt(),
      model: getStrandsConfig().defaultModel,
      temperature: getStrandsConfig().defaultTemperature,
      maxTokens: getStrandsConfig().defaultMaxTokens,
    };
  }

  // ===========================================================================
  // Protected Methods
  // ===========================================================================

  /**
   * Get system prompt for the worker
   */
  protected getSystemPrompt(): string {
    return `You are a ${this.getRole()} Worker Agent for the VOW project.

## Your Role

You are responsible for processing ${this.getRole()} tasks assigned to you by the Task Orchestrator.

## Your Capabilities

${this.getCapabilities().map((cap) => `- ${cap}`).join('\n')}

## Guidelines

1. Focus on your specialized domain
2. Report progress regularly
3. Submit results promptly when complete
4. Report failures with detailed error information
5. Stay within your capability boundaries

## Current Configuration

- Worker ID: ${this.workerId || 'Not registered'}
- Machine: ${this.config.machineId}
- Server: ${this.config.serverUrl}`;
  }

  /**
   * Register a tool for the worker
   */
  protected registerTool<TInput, TOutput>(tool: StrandsTool<TInput, TOutput>): void {
    this.tools.set(tool.name, tool as StrandsTool<unknown, unknown>);
  }

  /**
   * Make authenticated HTTP request to the MCP Task Server
   */
  protected async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.config.serverUrl.replace(/\/$/, '')}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(this.config.serverToken ? { 'Authorization': `Bearer ${this.config.serverToken}` } : {}),
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

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Register with MCP Task Server
   */
  private async register(): Promise<void> {
    this.logger.info('Registering with MCP Task Server');

    try {
      const registration = await this.request<WorkerRegistration>('/agents/register', {
        method: 'POST',
        body: JSON.stringify({
          name: this.config.agentName,
          role: this.getRole(),
          machineId: this.config.machineId,
          capabilities: this.getCapabilities(),
          metadata: {
            version: '1.0.0',
            startedAt: new Date().toISOString(),
          },
        }),
      });

      this.workerId = registration.id;
      this.reconnectAttempts = 0;

      this.logger.info('Registered with MCP Task Server', {
        workerId: this.workerId,
        role: registration.role,
        capabilities: registration.capabilities,
      });

      this.eventHandlers.onRegistered?.(registration);
    } catch (error) {
      this.logger.error('Failed to register with MCP Task Server', error as Error);
      throw error;
    }
  }

  /**
   * Unregister from MCP Task Server
   */
  private async unregister(): Promise<void> {
    if (!this.workerId) {
      return;
    }

    this.logger.info('Unregistering from MCP Task Server');

    try {
      await this.request(`/agents/${this.workerId}/unregister`, {
        method: 'POST',
      });

      this.logger.info('Unregistered from MCP Task Server');
    } catch (error) {
      this.logger.warning('Failed to unregister', {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Start heartbeat interval
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(async () => {
      await this.sendHeartbeat();
    }, this.config.heartbeatIntervalMs);

    this.logger.debug('Heartbeat started', {
      intervalMs: this.config.heartbeatIntervalMs,
    });
  }

  /**
   * Send heartbeat to MCP Task Server
   */
  private async sendHeartbeat(): Promise<void> {
    if (!this.workerId || !this.isRunning) {
      return;
    }

    try {
      await this.request(`/agents/${this.workerId}/heartbeat`, {
        method: 'POST',
        body: JSON.stringify({
          status: this.status,
          currentTaskId: this.currentTask?.id,
          timestamp: new Date().toISOString(),
        }),
      });

      this.logger.debug('Heartbeat sent', {
        status: this.status,
        currentTaskId: this.currentTask?.id,
      });

      this.eventHandlers.onHeartbeat?.();
    } catch (error) {
      this.logger.warning('Failed to send heartbeat', {
        error: (error as Error).message,
      });
      await this.handleDisconnect();
    }
  }

  /**
   * Start task polling interval
   */
  private startTaskPolling(): void {
    if (this.taskPollInterval) {
      clearInterval(this.taskPollInterval);
    }

    this.taskPollInterval = setInterval(async () => {
      await this.pollForTasks();
    }, this.config.taskPollIntervalMs);

    this.logger.debug('Task polling started', {
      intervalMs: this.config.taskPollIntervalMs,
    });
  }

  /**
   * Poll for available tasks
   */
  private async pollForTasks(): Promise<void> {
    if (!this.workerId || !this.isRunning || this.status === 'busy') {
      return;
    }

    try {
      // Get available tasks for this worker's role
      const tasks = await this.request<McpTask[]>('/tasks', {
        method: 'GET',
      });

      // Filter tasks that this worker can handle
      const availableTasks = tasks.filter(
        (task) =>
          task.status === 'pending' &&
          this.canHandleTask(task)
      );

      if (availableTasks.length > 0) {
        // Claim the first available task
        const firstTask = availableTasks[0];
        if (firstTask) {
          await this.claimTask(firstTask.id);
        }
      }
    } catch (error) {
      this.logger.warning('Failed to poll for tasks', {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Claim a specific task
   */
  private async claimTask(taskId: string): Promise<TaskClaimResult> {
    if (!this.workerId) {
      return { success: false, reason: 'Worker not registered' };
    }

    if (this.status === 'busy') {
      return { success: false, reason: 'Worker is busy' };
    }

    this.logger.info('Claiming task', { taskId });

    try {
      const task = await this.request<McpTask>(`/tasks/${taskId}/claim`, {
        method: 'POST',
        body: JSON.stringify({
          agentId: this.workerId,
        }),
      });

      this.currentTask = task;
      this.status = 'busy';

      this.logger.info('Task claimed', {
        taskId: task.id,
        title: task.title,
        priority: task.priority,
      });

      this.eventHandlers.onTaskClaimed?.(task);

      // Process the task
      await this.executeTask(task);

      return { success: true, task };
    } catch (error) {
      this.logger.warning('Failed to claim task', {
        taskId,
        error: (error as Error).message,
      });
      return { success: false, reason: (error as Error).message };
    }
  }

  /**
   * Execute a claimed task
   */
  private async executeTask(task: McpTask): Promise<void> {
    const startTime = Date.now();

    this.logger.info('Executing task', {
      taskId: task.id,
      title: task.title,
    });

    try {
      // Update task status to in_progress
      await this.updateTaskStatus(task.id, 'in_progress');

      // Create execution context
      const context: ToolExecutionContext = {
        userId: task.createdBy,
        sessionId: task.id,
        metadata: {
          workerId: this.workerId,
          workerRole: this.getRole(),
          machineId: this.config.machineId,
        },
      };

      // Process the task (implemented by subclass)
      const result = await this.processTask(task, context);

      const executionTimeMs = Date.now() - startTime;

      // Submit result
      await this.submitResult({
        taskId: task.id,
        status: 'completed',
        result,
        executionTimeMs,
      });

      this.logger.info('Task completed', {
        taskId: task.id,
        executionTimeMs,
      });

      this.eventHandlers.onTaskCompleted?.({
        taskId: task.id,
        status: 'completed',
        result,
        executionTimeMs,
      });
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const err = error as Error;

      this.logger.error('Task failed', err, {
        taskId: task.id,
        executionTimeMs,
      });

      // Submit failure
      await this.submitResult({
        taskId: task.id,
        status: 'failed',
        error: err.message,
        executionTimeMs,
      });

      this.eventHandlers.onTaskFailed?.(task.id, err);
    } finally {
      this.currentTask = null;
      this.status = 'idle';
    }
  }

  /**
   * Update task status on MCP Task Server
   */
  private async updateTaskStatus(taskId: string, status: TaskStatus): Promise<void> {
    try {
      await this.request(`/tasks/${taskId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });

      this.logger.debug('Task status updated', { taskId, status });
    } catch (error) {
      this.logger.warning('Failed to update task status', {
        taskId,
        status,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Submit task result to MCP Task Server
   */
  private async submitResult(result: TaskResult): Promise<void> {
    this.logger.info('Submitting task result', {
      taskId: result.taskId,
      status: result.status,
    });

    try {
      await this.request(`/tasks/${result.taskId}/result`, {
        method: 'POST',
        body: JSON.stringify({
          status: result.status,
          result: result.result,
          error: result.error,
          executionTimeMs: result.executionTimeMs,
          agentId: this.workerId,
        }),
      });

      this.logger.info('Task result submitted', {
        taskId: result.taskId,
      });
    } catch (error) {
      this.logger.error('Failed to submit task result', error as Error, {
        taskId: result.taskId,
      });
    }
  }

  /**
   * Handle disconnection from MCP Task Server
   */
  private async handleDisconnect(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.eventHandlers.onDisconnect?.();

    // Attempt to reconnect with exponential backoff
    while (this.isRunning && this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      this.reconnectAttempts++;
      const delay = Math.min(
        BASE_RECONNECT_DELAY_MS * Math.pow(2, this.reconnectAttempts - 1),
        MAX_RECONNECT_DELAY_MS
      );

      this.logger.info('Attempting to reconnect', {
        attempt: this.reconnectAttempts,
        maxAttempts: MAX_RECONNECT_ATTEMPTS,
        delayMs: delay,
      });

      await new Promise((resolve) => setTimeout(resolve, delay));

      try {
        await this.register();
        this.status = 'idle';
        this.eventHandlers.onReconnect?.();
        return;
      } catch (error) {
        this.logger.warning('Reconnection attempt failed', {
          attempt: this.reconnectAttempts,
          error: (error as Error).message,
        });
      }
    }

    this.logger.error(
      'Max reconnection attempts reached',
      new Error('Failed to reconnect to MCP Task Server')
    );
    this.status = 'error';
    this.eventHandlers.onError?.(new Error('Failed to reconnect to MCP Task Server'));
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Create a base task processor context
 */
export function createTaskContext(
  task: McpTask,
  workerId: string,
  workerRole: string,
  machineId: string
): ToolExecutionContext {
  return {
    userId: task.createdBy,
    sessionId: task.id,
    metadata: {
      workerId,
      workerRole,
      machineId,
      taskId: task.id,
      taskPriority: task.priority,
    },
  };
}

/**
 * Parse task metadata to extract role-specific information
 */
export function parseTaskMetadata(task: McpTask): {
  targetRole?: string;
  requiredCapabilities?: string[];
  workingDirectory?: string;
  files?: string[];
  context?: Record<string, unknown>;
} {
  const metadata = task.metadata || {};
  const result: {
    targetRole?: string;
    requiredCapabilities?: string[];
    workingDirectory?: string;
    files?: string[];
    context?: Record<string, unknown>;
  } = {};

  const targetRole = metadata['targetRole'] as string | undefined;
  if (targetRole !== undefined) {
    result.targetRole = targetRole;
  }

  const requiredCapabilities = metadata['requiredCapabilities'] as string[] | undefined;
  if (requiredCapabilities !== undefined) {
    result.requiredCapabilities = requiredCapabilities;
  }

  const workingDirectory = metadata['workingDirectory'] as string | undefined;
  if (workingDirectory !== undefined) {
    result.workingDirectory = workingDirectory;
  }

  const files = metadata['files'] as string[] | undefined;
  if (files !== undefined) {
    result.files = files;
  }

  const context = metadata['context'] as Record<string, unknown> | undefined;
  if (context !== undefined) {
    result.context = context;
  }

  return result;
}
