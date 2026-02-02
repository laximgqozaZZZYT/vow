/**
 * Strands Agents Module for VOW Backend
 *
 * Exports Strands Agents configuration, types, and utilities.
 *
 * @module agents/strands
 */

// Types
export type {
  StrandsModelProvider,
  StrandsAgentConfig,
  StrandsTool,
  ToolExecutionContext,
  AgentExecutionResult,
  ToolCallRecord,
  TokenUsage,
  StrandsMessage,
  AgentSession,
  AgentRegistrationOptions,
  StreamingEventType,
  StreamingEvent,
  TokenStreamEvent,
  ToolCallStreamEvent,
} from './types.js';

// Configuration
export {
  getStrandsConfig,
  validateStrandsConfig,
  createProviderConfig,
  agentRegistry,
  strandsConfig,
  STRANDS_ENV_KEYS,
  STRANDS_DEFAULTS,
  MODEL_CONFIGS,
  type StrandsGlobalConfig,
} from './config.js';

// Task Orchestrator Agent
export {
  TaskOrchestratorAgent,
  getTaskOrchestratorAgent,
  resetTaskOrchestratorAgent,
  McpTaskServerClient,
  TaskLoadBalancer,
  OrchestrationLogger,
  CreateTaskSchema,
  AssignTaskSchema,
  MonitorProgressSchema,
  ReassignTaskSchema,
  type TaskOrchestratorConfig,
  type McpTask,
  type McpAgent,
  type TaskPriority,
  type TaskStatus,
  type AgentStatus,
  type DashboardStats,
  type TaskServerEvent,
  type LoadBalancingStrategy,
  type AssignmentResult,
  type StalledTaskResult,
  type OrchestrationDecision,
  type CreateTaskInput,
  type AssignTaskInput,
  type MonitorProgressInput,
  type ReassignTaskInput,
} from './task-orchestrator.js';

// Worker Agents
export {
  // Base Worker
  BaseWorkerAgent,
  getWorkerConfig,
  createTaskContext,
  parseTaskMetadata,
  WORKER_ENV_KEYS,
  type WorkerConfig,
  type WorkerStatus,
  type WorkerRegistration,
  type TaskClaimResult,
  type TaskResult,
  type WorkerEventHandlers,
  type TaskProcessor,
  // Frontend Worker
  FrontendWorkerAgent,
  getFrontendWorkerAgent,
  resetFrontendWorkerAgent,
  createFrontendWorkerAgent,
  // Backend Worker
  BackendWorkerAgent,
  getBackendWorkerAgent,
  resetBackendWorkerAgent,
  createBackendWorkerAgent,
  // Worker Pool
  WorkerPool,
  getWorkerPool,
  resetWorkerPool,
  startWorkerPool,
  stopWorkerPool,
  DEFAULT_WORKER_POOL_CONFIG,
  type WorkerPoolConfig,
} from './workers/index.js';
