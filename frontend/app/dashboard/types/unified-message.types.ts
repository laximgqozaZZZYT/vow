/**
 * Unified Message Types for VOW Application
 *
 * This module provides unified type definitions for messages across different
 * agent implementations (Mastra, Multi-Agent Chat, Coach).
 *
 * Consolidates:
 * - MastraMessage (useMastraAgent)
 * - ChatMessage (agent.types - multi-agent chat)
 * - Message (Section.Coach - local coach interface)
 * - AgentMessage (mastra/config - base message type)
 *
 * @module types/unified-message.types
 */

// =============================================================================
// Core Message Types
// =============================================================================

/**
 * Unified message role across all agent implementations.
 * - 'user': Human user input
 * - 'assistant': AI agent response (primary responder)
 * - 'system': System-generated messages (notifications, errors)
 * - 'agent': Multi-agent worker responses (non-primary agent)
 * - 'manager': Multi-agent manager responses
 */
export type UnifiedMessageRole = 'user' | 'assistant' | 'system' | 'agent' | 'manager';

/**
 * Message status indicating the current state of message delivery/generation.
 */
export type UnifiedMessageStatus =
  | 'pending'   // Message queued, not yet processed
  | 'streaming' // Currently receiving streamed response
  | 'complete'  // Message fully delivered
  | 'error';    // Message delivery/generation failed

/**
 * Agent type identifier for tracking which system generated the message.
 */
export type UnifiedAgentType = 'mastra' | 'strands' | 'legacy' | 'multi-agent' | 'custom';

/**
 * Message type for categorizing message purpose (multi-agent context).
 */
export type UnifiedMessageType =
  | 'message'           // Standard conversational message
  | 'task_assignment'   // Task delegation notification
  | 'progress_report'   // Work-in-progress update
  | 'completion_report' // Task completion notification
  | 'error_report'      // Error or failure notification
  | 'spec_draft'        // SPEC document creation
  | 'instruction'       // Directive to agent
  | 'tool_result';      // Tool execution result

// =============================================================================
// Tool Call Types
// =============================================================================

/**
 * Unified tool call representation.
 * Compatible with both Mastra ToolCallResult and other agent tool formats.
 */
export interface UnifiedToolCall {
  /** Unique identifier for the tool call */
  id?: string;

  /** Name of the tool being invoked */
  toolName: string;

  /** Input parameters passed to the tool */
  input: Record<string, unknown>;

  /** Output/result from the tool execution */
  output?: unknown;

  /** Whether the tool execution succeeded */
  success: boolean;

  /** Error message if execution failed */
  error?: string;

  /** Tool execution status */
  status?: 'pending' | 'running' | 'completed' | 'failed';

  /** Execution start timestamp */
  startedAt?: Date;

  /** Execution completion timestamp */
  completedAt?: Date;

  /** Execution duration in milliseconds */
  durationMs?: number;
}

// =============================================================================
// UI Component Types (for Coach integration)
// =============================================================================

/**
 * UI component types that can be embedded in messages.
 */
export type UnifiedUIComponentType =
  | 'habit_stats'
  | 'choice_buttons'
  | 'workload_chart'
  | 'progress_indicator'
  | 'quick_actions'
  | 'level_assessment'
  | 'habit_suggestion'
  | 'goal_suggestion';

/**
 * UI component data that can be rendered within a message.
 */
export interface UnifiedUIComponent {
  /** Type of UI component to render */
  type: UnifiedUIComponentType;

  /** Component-specific data */
  data: Record<string, unknown>;

  /** Optional component ID for targeting */
  id?: string;
}

// =============================================================================
// Action Types
// =============================================================================

/**
 * Action that can be attached to a message for user interaction.
 */
export interface UnifiedMessageAction {
  /** Unique action identifier */
  id: string;

  /** Display label for the action button */
  label: string;

  /** Action type for styling and behavior */
  type: 'approve' | 'reject' | 'execute' | 'navigate' | 'custom';

  /** Action payload data */
  payload?: unknown;

  /** Optional icon identifier */
  icon?: string;

  /** Whether the action is disabled */
  disabled?: boolean;
}

// =============================================================================
// Main Unified Message Interface
// =============================================================================

/**
 * Unified message interface that can represent messages from any agent type.
 *
 * This is the canonical message format used throughout the application.
 * Adapters convert source-specific formats to/from this unified format.
 */
export interface UnifiedMessage {
  // === Core Identity ===
  /** Unique message identifier */
  id: string;

  /** Message sender role */
  role: UnifiedMessageRole;

  /** Message text content */
  content: string;

  /** Message creation/received timestamp */
  timestamp: Date;

  // === Status ===
  /** Current message status */
  status?: UnifiedMessageStatus;

  // === Agent Identification ===
  /** Source agent type */
  agentType?: UnifiedAgentType;

  /** Agent ID (for multi-agent systems) */
  agentId?: string;

  /** Display name of the agent */
  agentName?: string;

  /** Agent's role in multi-agent system */
  agentRole?: string;

  // === Session Context ===
  /** Session/conversation ID */
  sessionId?: string;

  /** Thread/sub-conversation ID */
  threadId?: string;

  // === Tool Calls ===
  /** Tool calls made during message generation */
  toolCalls?: UnifiedToolCall[];

  // === Multi-Agent Context ===
  /** Message type/category */
  messageType?: UnifiedMessageType;

  /** Related task ID */
  taskId?: string;

  /** Related task title */
  taskTitle?: string;

  // === UI Components ===
  /** Embedded UI components */
  uiComponents?: UnifiedUIComponent[];

  // === Actions ===
  /** Available user actions */
  actions?: UnifiedMessageAction[];

  // === Token Usage ===
  /** Token usage statistics */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };

  // === Metadata ===
  /** Arbitrary metadata storage */
  metadata?: Record<string, unknown>;

  // === Detected Intent (Coach) ===
  /** Detected user intent (from coach analysis) */
  intent?: string;

  // === Raw Source Data ===
  /** Original message data before conversion */
  rawSource?: unknown;
}

// =============================================================================
// Session Types
// =============================================================================

/**
 * Unified session/conversation container.
 */
export interface UnifiedSession {
  /** Unique session identifier */
  id: string;

  /** User who owns this session */
  userId: string;

  /** Session display title */
  title: string;

  /** Session creation timestamp */
  createdAt: Date;

  /** Last activity timestamp */
  updatedAt: Date;

  /** Agent type used in this session */
  agentType?: UnifiedAgentType;

  /** Messages in this session */
  messages?: UnifiedMessage[];

  /** Session metadata */
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Source Type Identifiers (for adapter)
// =============================================================================

/**
 * Source format identifier for message conversion.
 */
export type MessageSourceType =
  | 'mastra'      // MastraMessage from useMastraAgent
  | 'multi-agent' // ChatMessage from agent.types.ts
  | 'coach'       // Message from Section.Coach
  | 'base'        // AgentMessage from mastra/config
  | 'unified';    // Already unified

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if a message has tool calls.
 */
export function hasToolCalls(message: UnifiedMessage): boolean {
  return Array.isArray(message.toolCalls) && message.toolCalls.length > 0;
}

/**
 * Check if a message has UI components.
 */
export function hasUIComponents(message: UnifiedMessage): boolean {
  return Array.isArray(message.uiComponents) && message.uiComponents.length > 0;
}

/**
 * Check if a message has actions.
 */
export function hasActions(message: UnifiedMessage): boolean {
  return Array.isArray(message.actions) && message.actions.length > 0;
}

/**
 * Check if a message is from a user.
 */
export function isUserMessage(message: UnifiedMessage): boolean {
  return message.role === 'user';
}

/**
 * Check if a message is from an assistant/agent.
 */
export function isAgentMessage(message: UnifiedMessage): boolean {
  return message.role === 'assistant' || message.role === 'agent' || message.role === 'manager';
}

/**
 * Check if a message is a system message.
 */
export function isSystemMessage(message: UnifiedMessage): boolean {
  return message.role === 'system';
}

/**
 * Check if a message is currently streaming.
 */
export function isStreaming(message: UnifiedMessage): boolean {
  return message.status === 'streaming';
}

/**
 * Check if a message completed successfully.
 */
export function isComplete(message: UnifiedMessage): boolean {
  return message.status === 'complete';
}

/**
 * Check if a message has an error.
 */
export function hasError(message: UnifiedMessage): boolean {
  return message.status === 'error';
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Generate a unique message ID.
 */
export function generateMessageId(prefix = 'msg'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Create a new unified message with defaults.
 */
export function createUnifiedMessage(
  partial: Partial<UnifiedMessage> & Pick<UnifiedMessage, 'role' | 'content'>
): UnifiedMessage {
  const { role, content, id, timestamp, status, ...rest } = partial;
  return {
    ...rest,
    id: id ?? generateMessageId(),
    role,
    content,
    timestamp: timestamp ?? new Date(),
    status: status ?? 'complete',
  };
}

/**
 * Create a user message.
 */
export function createUserMessage(content: string, options?: Partial<UnifiedMessage>): UnifiedMessage {
  return createUnifiedMessage({
    role: 'user',
    content,
    ...options,
  });
}

/**
 * Create an assistant message.
 */
export function createAssistantMessage(content: string, options?: Partial<UnifiedMessage>): UnifiedMessage {
  return createUnifiedMessage({
    role: 'assistant',
    content,
    ...options,
  });
}

/**
 * Create a system message.
 */
export function createSystemMessage(content: string, options?: Partial<UnifiedMessage>): UnifiedMessage {
  return createUnifiedMessage({
    role: 'system',
    content,
    ...options,
  });
}

/**
 * Create an error message.
 */
export function createErrorMessage(error: string | Error, options?: Partial<UnifiedMessage>): UnifiedMessage {
  const errorContent = error instanceof Error ? error.message : error;
  return createUnifiedMessage({
    role: 'system',
    content: errorContent,
    status: 'error',
    messageType: 'error_report',
    ...options,
  });
}

/**
 * Create a streaming placeholder message.
 */
export function createStreamingMessage(
  agentType?: UnifiedAgentType,
  options?: Partial<UnifiedMessage>
): UnifiedMessage {
  return createUnifiedMessage({
    role: 'assistant',
    content: '',
    status: 'streaming',
    agentType,
    ...options,
  });
}
