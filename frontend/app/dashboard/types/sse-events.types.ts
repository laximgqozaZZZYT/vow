/**
 * Unified SSE Event Types for VOW Application
 *
 * This module provides unified type definitions for Server-Sent Events (SSE)
 * across different implementations:
 * - MCP Chat (useMcpChat) - streaming chat responses
 * - Multi-Agent Server (useMultiAgentServer) - real-time agent/task updates
 * - Coach (Section.Coach) - coaching responses
 *
 * Consolidates different SSE protocols into a single unified format.
 *
 * @module types/sse-events.types
 */

// =============================================================================
// Core Event Types
// =============================================================================

/**
 * Unified SSE event types that cover all use cases.
 *
 * Categories:
 * - Message events: For chat/conversation streaming
 * - Agent events: For multi-agent coordination
 * - Task events: For task management
 * - System events: For connection/error handling
 */
export type UnifiedSSEEventType =
  // Message streaming events (Mastra/Coach)
  | 'message'              // Text content chunk
  | 'message_start'        // Start of message stream
  | 'message_end'          // End of message stream
  | 'message_delta'        // Incremental text update

  // Tool/function call events
  | 'tool_call'            // Tool invocation
  | 'tool_call_start'      // Tool execution started
  | 'tool_call_result'     // Tool execution completed
  | 'tool_call_error'      // Tool execution failed

  // Workflow/progress events
  | 'workflow_progress'    // Workflow step progress
  | 'workflow_start'       // Workflow started
  | 'workflow_complete'    // Workflow completed
  | 'workflow_error'       // Workflow failed

  // Agent status events (Multi-Agent)
  | 'agent_status'         // Agent status changed
  | 'agent_registered'     // New agent registered
  | 'agent_status_changed' // Agent status update
  | 'agent_offline'        // Agent went offline
  | 'agent_heartbeat'      // Agent heartbeat

  // Task events (Multi-Agent)
  | 'task_update'          // Task state changed
  | 'task_created'         // New task created
  | 'task_assigned'        // Task assigned to agent
  | 'task_started'         // Task execution started
  | 'task_completed'       // Task completed successfully
  | 'task_failed'          // Task failed

  // System events
  | 'error'                // Error occurred
  | 'connected'            // SSE connection established
  | 'disconnected'         // SSE connection lost
  | 'heartbeat'            // Keep-alive ping
  | 'reconnecting'         // Attempting reconnection
  | 'done';                // Stream complete (Mastra [DONE])

/**
 * Event type category mapping for filtering.
 */
export const SSE_EVENT_CATEGORIES = {
  message: ['message', 'message_start', 'message_end', 'message_delta'] as const,
  toolCall: ['tool_call', 'tool_call_start', 'tool_call_result', 'tool_call_error'] as const,
  workflow: ['workflow_progress', 'workflow_start', 'workflow_complete', 'workflow_error'] as const,
  agent: ['agent_status', 'agent_registered', 'agent_status_changed', 'agent_offline', 'agent_heartbeat'] as const,
  task: ['task_update', 'task_created', 'task_assigned', 'task_started', 'task_completed', 'task_failed'] as const,
  system: ['error', 'connected', 'disconnected', 'heartbeat', 'reconnecting', 'done'] as const,
} as const;

// =============================================================================
// Event Data Types
// =============================================================================

/**
 * Message event data for streaming text content.
 */
export interface SSEMessageData {
  /** Text content (full or delta) */
  content: string;
  /** Whether this is a delta (incremental) update */
  isDelta?: boolean;
  /** Message ID for correlation */
  messageId?: string;
  /** Role of the message sender */
  role?: 'user' | 'assistant' | 'system' | 'agent' | 'manager';
}

/**
 * Tool call event data.
 */
export interface SSEToolCallData {
  /** Tool call ID */
  id?: string;
  /** Name of the tool being called */
  toolName: string;
  /** Input parameters for the tool */
  input: Record<string, unknown>;
  /** Output from the tool (for result events) */
  output?: unknown;
  /** Whether the tool call succeeded */
  success?: boolean;
  /** Error message if failed */
  error?: string;
  /** Tool execution status */
  status?: 'pending' | 'running' | 'completed' | 'failed';
  /** Execution duration in milliseconds */
  durationMs?: number;
}

/**
 * Workflow progress event data.
 */
export interface SSEWorkflowProgressData {
  /** Workflow ID */
  workflowId: string;
  /** Workflow name */
  workflowName?: string;
  /** Current step index */
  currentStep: number;
  /** Total steps */
  totalSteps: number;
  /** Progress percentage (0-100) */
  progress: number;
  /** Current step name */
  stepName?: string;
  /** Current step status */
  stepStatus?: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  /** Step output */
  stepOutput?: unknown;
  /** Error message if step failed */
  error?: string;
}

/**
 * Agent status event data.
 */
export interface SSEAgentStatusData {
  /** Agent ID */
  agentId: string;
  /** Agent name */
  agentName?: string;
  /** Agent role */
  agentRole?: string;
  /** Agent type */
  agentType?: 'mastra' | 'strands' | 'claude' | 'custom';
  /** Previous status */
  previousStatus?: 'idle' | 'busy' | 'offline';
  /** New/current status */
  status: 'idle' | 'busy' | 'offline';
  /** Current task ID (if busy) */
  currentTaskId?: string | null;
  /** Current task title */
  currentTaskTitle?: string;
  /** Machine ID */
  machineId?: string;
  /** Machine name */
  machineName?: string;
  /** Agent capabilities */
  capabilities?: string[];
  /** Last heartbeat timestamp */
  lastHeartbeat?: string;
}

/**
 * Task update event data.
 */
export interface SSETaskUpdateData {
  /** Task ID */
  taskId: string;
  /** Task title */
  title?: string;
  /** Task description */
  description?: string;
  /** Previous status */
  previousStatus?: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed';
  /** New/current status */
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed';
  /** Assigned agent ID */
  assignedTo?: string | null;
  /** Assigned agent name */
  assignedAgentName?: string;
  /** Task priority */
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  /** Task result (for completed tasks) */
  result?: string | null;
  /** Error message (for failed tasks) */
  error?: string;
  /** Task tags */
  tags?: string[];
  /** Progress percentage */
  progress?: number;
}

/**
 * Error event data.
 */
export interface SSEErrorData {
  /** Error code */
  code?: string;
  /** Error message */
  message: string;
  /** Whether the error is recoverable */
  recoverable?: boolean;
  /** Suggested retry delay in milliseconds */
  retryAfter?: number;
  /** Additional error details */
  details?: unknown;
}

/**
 * System event data (connected, heartbeat, etc.).
 */
export interface SSESystemData {
  /** Server timestamp */
  serverTime?: string;
  /** Connection ID */
  connectionId?: string;
  /** Server version */
  serverVersion?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Unified Event Interface
// =============================================================================

/**
 * Union type of all possible event data types.
 */
export type UnifiedSSEEventData =
  | SSEMessageData
  | SSEToolCallData
  | SSEWorkflowProgressData
  | SSEAgentStatusData
  | SSETaskUpdateData
  | SSEErrorData
  | SSESystemData
  | Record<string, unknown>
  | unknown;

/**
 * Unified SSE event interface.
 *
 * This is the canonical event format used throughout the application.
 * Adapters convert source-specific formats to/from this unified format.
 */
export interface UnifiedSSEEvent<T extends UnifiedSSEEventData = UnifiedSSEEventData> {
  /** Event type */
  type: UnifiedSSEEventType;

  /** Event data payload */
  data: T;

  /** Event timestamp (ISO 8601) */
  timestamp: string;

  /** Session/conversation ID */
  sessionId?: string;

  /** Agent ID (for multi-agent context) */
  agentId?: string;

  /** Server ID (for multi-server context) */
  serverId?: string;

  /** Unique event ID for deduplication */
  eventId?: string;

  /** Sequence number for ordering */
  sequence?: number;

  /** Raw source data before normalization */
  rawSource?: unknown;
}

// =============================================================================
// Type-Specific Event Interfaces
// =============================================================================

/**
 * Message streaming event.
 */
export interface SSEMessageEvent extends UnifiedSSEEvent<SSEMessageData> {
  type: 'message' | 'message_start' | 'message_end' | 'message_delta';
}

/**
 * Tool call event.
 */
export interface SSEToolCallEvent extends UnifiedSSEEvent<SSEToolCallData> {
  type: 'tool_call' | 'tool_call_start' | 'tool_call_result' | 'tool_call_error';
}

/**
 * Workflow progress event.
 */
export interface SSEWorkflowEvent extends UnifiedSSEEvent<SSEWorkflowProgressData> {
  type: 'workflow_progress' | 'workflow_start' | 'workflow_complete' | 'workflow_error';
}

/**
 * Agent status event.
 */
export interface SSEAgentEvent extends UnifiedSSEEvent<SSEAgentStatusData> {
  type: 'agent_status' | 'agent_registered' | 'agent_status_changed' | 'agent_offline' | 'agent_heartbeat';
}

/**
 * Task update event.
 */
export interface SSETaskEvent extends UnifiedSSEEvent<SSETaskUpdateData> {
  type: 'task_update' | 'task_created' | 'task_assigned' | 'task_started' | 'task_completed' | 'task_failed';
}

/**
 * Error event.
 */
export interface SSEErrorEvent extends UnifiedSSEEvent<SSEErrorData> {
  type: 'error';
}

/**
 * System event.
 */
export interface SSESystemEvent extends UnifiedSSEEvent<SSESystemData> {
  type: 'connected' | 'disconnected' | 'heartbeat' | 'reconnecting' | 'done';
}

// =============================================================================
// Callback Types
// =============================================================================

/**
 * Event handler callback type.
 */
export type SSEEventHandler<T extends UnifiedSSEEvent = UnifiedSSEEvent> = (event: T) => void;

/**
 * Event handlers map for useUnifiedSSE hook.
 */
export interface SSEEventHandlers {
  // Message events
  onMessage?: SSEEventHandler<SSEMessageEvent>;
  onMessageStart?: SSEEventHandler<SSEMessageEvent>;
  onMessageEnd?: SSEEventHandler<SSEMessageEvent>;
  onMessageDelta?: SSEEventHandler<SSEMessageEvent>;

  // Tool call events
  onToolCall?: SSEEventHandler<SSEToolCallEvent>;
  onToolCallStart?: SSEEventHandler<SSEToolCallEvent>;
  onToolCallResult?: SSEEventHandler<SSEToolCallEvent>;
  onToolCallError?: SSEEventHandler<SSEToolCallEvent>;

  // Workflow events
  onWorkflowProgress?: SSEEventHandler<SSEWorkflowEvent>;
  onWorkflowStart?: SSEEventHandler<SSEWorkflowEvent>;
  onWorkflowComplete?: SSEEventHandler<SSEWorkflowEvent>;
  onWorkflowError?: SSEEventHandler<SSEWorkflowEvent>;

  // Agent events
  onAgentStatus?: SSEEventHandler<SSEAgentEvent>;
  onAgentRegistered?: SSEEventHandler<SSEAgentEvent>;
  onAgentStatusChanged?: SSEEventHandler<SSEAgentEvent>;
  onAgentOffline?: SSEEventHandler<SSEAgentEvent>;
  onAgentHeartbeat?: SSEEventHandler<SSEAgentEvent>;

  // Task events
  onTaskUpdate?: SSEEventHandler<SSETaskEvent>;
  onTaskCreated?: SSEEventHandler<SSETaskEvent>;
  onTaskAssigned?: SSEEventHandler<SSETaskEvent>;
  onTaskStarted?: SSEEventHandler<SSETaskEvent>;
  onTaskCompleted?: SSEEventHandler<SSETaskEvent>;
  onTaskFailed?: SSEEventHandler<SSETaskEvent>;

  // System events
  onError?: SSEEventHandler<SSEErrorEvent>;
  onConnected?: SSEEventHandler<SSESystemEvent>;
  onDisconnected?: SSEEventHandler<SSESystemEvent>;
  onHeartbeat?: SSEEventHandler<SSESystemEvent>;
  onReconnecting?: SSEEventHandler<SSESystemEvent>;
  onDone?: SSEEventHandler<SSESystemEvent>;

  // Catch-all handler
  onAnyEvent?: SSEEventHandler<UnifiedSSEEvent>;
}

// =============================================================================
// Connection State Types
// =============================================================================

/**
 * SSE connection state.
 */
export type SSEConnectionState =
  | 'idle'         // Not connected, no attempt made
  | 'connecting'   // Connection in progress
  | 'connected'    // Successfully connected
  | 'streaming'    // Actively receiving data
  | 'reconnecting' // Lost connection, attempting reconnect
  | 'error'        // Connection failed
  | 'closed';      // Intentionally closed

/**
 * Connection state info with metadata.
 */
export interface SSEConnectionInfo {
  /** Current connection state */
  state: SSEConnectionState;
  /** Error message if in error state */
  error?: string;
  /** Number of reconnection attempts */
  reconnectAttempts: number;
  /** Maximum reconnection attempts */
  maxReconnectAttempts: number;
  /** Last successful connection timestamp */
  lastConnectedAt?: string;
  /** Last event received timestamp */
  lastEventAt?: string;
  /** Current URL being connected to */
  url?: string;
  /** Events received count */
  eventsReceived: number;
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if event is a message event.
 */
export function isMessageEvent(event: UnifiedSSEEvent): event is SSEMessageEvent {
  return SSE_EVENT_CATEGORIES.message.includes(event.type as never);
}

/**
 * Check if event is a tool call event.
 */
export function isToolCallEvent(event: UnifiedSSEEvent): event is SSEToolCallEvent {
  return SSE_EVENT_CATEGORIES.toolCall.includes(event.type as never);
}

/**
 * Check if event is a workflow event.
 */
export function isWorkflowEvent(event: UnifiedSSEEvent): event is SSEWorkflowEvent {
  return SSE_EVENT_CATEGORIES.workflow.includes(event.type as never);
}

/**
 * Check if event is an agent event.
 */
export function isAgentEvent(event: UnifiedSSEEvent): event is SSEAgentEvent {
  return SSE_EVENT_CATEGORIES.agent.includes(event.type as never);
}

/**
 * Check if event is a task event.
 */
export function isTaskEvent(event: UnifiedSSEEvent): event is SSETaskEvent {
  return SSE_EVENT_CATEGORIES.task.includes(event.type as never);
}

/**
 * Check if event is an error event.
 */
export function isErrorEvent(event: UnifiedSSEEvent): event is SSEErrorEvent {
  return event.type === 'error';
}

/**
 * Check if event is a system event.
 */
export function isSystemEvent(event: UnifiedSSEEvent): event is SSESystemEvent {
  return SSE_EVENT_CATEGORIES.system.includes(event.type as never);
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Generate a unique event ID.
 */
export function generateEventId(prefix = 'evt'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Create a unified SSE event from raw data.
 */
export function createUnifiedSSEEvent<T extends UnifiedSSEEventData>(
  type: UnifiedSSEEventType,
  data: T,
  options?: Partial<Omit<UnifiedSSEEvent<T>, 'type' | 'data'>>
): UnifiedSSEEvent<T> {
  return {
    type,
    data,
    timestamp: options?.timestamp ?? new Date().toISOString(),
    eventId: options?.eventId ?? generateEventId(),
    ...options,
  };
}

/**
 * Normalize various SSE data formats to unified format.
 * Handles both Mastra-style and Multi-Agent-style events.
 */
export function normalizeSSEEvent(raw: unknown): UnifiedSSEEvent | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const rawObj = raw as Record<string, unknown>;

  // Handle Mastra-style streaming chunks
  if ('content' in rawObj || 'text' in rawObj || 'delta' in rawObj) {
    const content =
      (rawObj.content as string) ||
      (rawObj.text as string) ||
      ((rawObj.delta as Record<string, unknown>)?.content as string) ||
      '';

    return createUnifiedSSEEvent('message', {
      content,
      isDelta: true,
      messageId: rawObj.id as string | undefined,
    });
  }

  // Handle Mastra-style tool calls
  if ('tool_call' in rawObj || 'toolCall' in rawObj) {
    const toolCall = (rawObj.tool_call || rawObj.toolCall) as Record<string, unknown>;
    return createUnifiedSSEEvent('tool_call', {
      id: toolCall.id as string | undefined,
      toolName: (toolCall.toolName || toolCall.name) as string,
      input: (toolCall.input || toolCall.arguments || {}) as Record<string, unknown>,
      output: toolCall.output,
      success: toolCall.success as boolean | undefined,
      error: toolCall.error as string | undefined,
    });
  }

  // Handle Multi-Agent-style events
  if ('type' in rawObj && 'timestamp' in rawObj) {
    const eventType = rawObj.type as string;
    const data = rawObj.data ?? {};

    // Map Multi-Agent event types to unified types
    const typeMapping: Record<string, UnifiedSSEEventType> = {
      agent_registered: 'agent_registered',
      agent_status_changed: 'agent_status_changed',
      task_created: 'task_created',
      task_assigned: 'task_assigned',
      task_started: 'task_started',
      task_completed: 'task_completed',
      task_failed: 'task_failed',
      heartbeat: 'heartbeat',
      connected: 'connected',
    };

    const unifiedType = typeMapping[eventType] || (eventType as UnifiedSSEEventType);

    return createUnifiedSSEEvent(unifiedType, data as UnifiedSSEEventData, {
      timestamp: rawObj.timestamp as string,
      rawSource: raw,
    });
  }

  // Handle error events
  if ('error' in rawObj) {
    return createUnifiedSSEEvent('error', {
      message: (rawObj.error as string) || 'Unknown error',
      details: rawObj,
    });
  }

  // Unknown format - wrap as-is with unknown type
  return createUnifiedSSEEvent('message', rawObj as Record<string, unknown>, {
    rawSource: raw,
  });
}

/**
 * Parse SSE data line (handles "data: " prefix and JSON parsing).
 */
export function parseSSEDataLine(line: string): UnifiedSSEEvent | null {
  // Remove "data: " prefix if present
  const data = line.startsWith('data: ') ? line.slice(6).trim() : line.trim();

  // Handle special [DONE] marker
  if (data === '[DONE]') {
    return createUnifiedSSEEvent('done', {});
  }

  // Empty line - skip
  if (!data) {
    return null;
  }

  // Try to parse as JSON
  try {
    const parsed = JSON.parse(data);
    return normalizeSSEEvent(parsed);
  } catch {
    // If not JSON, treat as raw text message
    return createUnifiedSSEEvent('message', {
      content: data,
      isDelta: true,
    });
  }
}
