/**
 * Message Adapter for Unified Message Types
 *
 * Provides type-safe conversion functions between different message formats
 * used across the VOW application:
 *
 * - MastraMessage (useMastraAgent hook)
 * - ChatMessage (multi-agent system)
 * - CoachMessage/Message (Section.Coach)
 * - AgentMessage (base Mastra type)
 *
 * @module agent-tools/message-adapter
 */

import type {
  UnifiedMessage,
  UnifiedToolCall,
  UnifiedMessageRole,
  UnifiedMessageStatus,
  UnifiedAgentType,
  UnifiedMessageType,
  UnifiedUIComponent,
  UnifiedMessageAction,
  MessageSourceType,
} from '../../app/dashboard/types/unified-message.types';

import {
  generateMessageId,
  createUnifiedMessage,
} from '../../app/dashboard/types/unified-message.types';

// =============================================================================
// Source Type Definitions (External Types)
// =============================================================================

/**
 * MastraMessage type from useMastraAgent hook.
 */
export interface MastraMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  status: 'pending' | 'streaming' | 'complete' | 'error';
  timestamp?: Date;
  toolCalls?: MastraToolCall[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  metadata?: Record<string, unknown>;
}

/**
 * Mastra tool call result type.
 */
export interface MastraToolCall {
  toolName: string;
  input: Record<string, unknown>;
  output: unknown;
  success: boolean;
  error?: string;
}

/**
 * ChatMessage type from agent.types.ts (multi-agent system).
 */
export interface MultiAgentChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'manager' | 'agent' | 'system';
  content: string;
  agentId?: string;
  agentName?: string;
  agentRole?: string;
  messageType?: 'message' | 'task_assignment' | 'progress_report' | 'completion_report' | 'error_report' | 'spec_draft' | 'instruction';
  taskId?: string;
  taskTitle?: string;
  metadata?: Record<string, unknown>;
  actions?: Array<{
    id: string;
    label: string;
    type: 'approve' | 'reject' | 'execute' | 'navigate';
    payload: unknown;
  }>;
  createdAt: string;
}

/**
 * Coach Message type from Section.Coach (local coach interface).
 */
export interface CoachMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  intent?: string;
  data?: unknown;
  uiComponents?: Array<{
    type: 'ui_component';
    component: 'habit_stats' | 'choice_buttons' | 'workload_chart' | 'progress_indicator' | 'quick_actions';
    data: Record<string, unknown>;
  }>;
}

/**
 * Base AgentMessage type from mastra/config.ts.
 */
export interface BaseAgentMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Union type for all source message types
// =============================================================================

export type SourceMessage =
  | MastraMessage
  | MultiAgentChatMessage
  | CoachMessage
  | BaseAgentMessage;

// =============================================================================
// Conversion: Source -> Unified
// =============================================================================

/**
 * Convert a MastraMessage to UnifiedMessage.
 */
export function fromMastraMessage(source: MastraMessage): UnifiedMessage {
  return createUnifiedMessage({
    id: source.id,
    role: mapMastraRole(source.role),
    content: source.content,
    timestamp: source.timestamp ?? new Date(),
    status: mapMastraStatus(source.status),
    agentType: 'mastra',
    toolCalls: source.toolCalls?.map(convertMastraToolCall),
    usage: source.usage,
    metadata: source.metadata,
    rawSource: source,
  });
}

/**
 * Convert a MultiAgentChatMessage to UnifiedMessage.
 */
export function fromMultiAgentMessage(source: MultiAgentChatMessage): UnifiedMessage {
  return createUnifiedMessage({
    id: source.id,
    role: mapMultiAgentRole(source.role),
    content: source.content,
    timestamp: new Date(source.createdAt),
    status: 'complete',
    agentType: 'multi-agent',
    agentId: source.agentId,
    agentName: source.agentName,
    agentRole: source.agentRole,
    sessionId: source.sessionId,
    messageType: mapMultiAgentMessageType(source.messageType),
    taskId: source.taskId,
    taskTitle: source.taskTitle,
    actions: source.actions?.map(convertAction),
    metadata: source.metadata,
    rawSource: source,
  });
}

/**
 * Convert a CoachMessage to UnifiedMessage.
 */
export function fromCoachMessage(source: CoachMessage): UnifiedMessage {
  return createUnifiedMessage({
    id: source.id,
    role: mapCoachRole(source.role),
    content: source.content,
    timestamp: source.timestamp,
    status: 'complete',
    agentType: 'legacy',
    intent: source.intent,
    uiComponents: source.uiComponents?.map(convertCoachUIComponent),
    metadata: source.data ? { originalData: source.data } : undefined,
    rawSource: source,
  });
}

/**
 * Convert a BaseAgentMessage to UnifiedMessage.
 */
export function fromBaseAgentMessage(source: BaseAgentMessage, id?: string): UnifiedMessage {
  return createUnifiedMessage({
    id: id ?? generateMessageId('base'),
    role: mapBaseRole(source.role),
    content: source.content,
    timestamp: source.timestamp ?? new Date(),
    status: 'complete',
    metadata: source.metadata,
    rawSource: source,
  });
}

/**
 * Universal converter that auto-detects source type.
 *
 * @param source - Source message in any supported format
 * @param sourceType - Optional explicit source type (auto-detected if not provided)
 * @returns UnifiedMessage
 */
export function toUnifiedMessage(
  source: SourceMessage | UnifiedMessage,
  sourceType?: MessageSourceType
): UnifiedMessage {
  // Already unified
  if (isUnifiedMessage(source)) {
    return source;
  }

  // Explicit source type
  if (sourceType) {
    switch (sourceType) {
      case 'mastra':
        return fromMastraMessage(source as MastraMessage);
      case 'multi-agent':
        return fromMultiAgentMessage(source as MultiAgentChatMessage);
      case 'coach':
        return fromCoachMessage(source as CoachMessage);
      case 'base':
        return fromBaseAgentMessage(source as BaseAgentMessage);
      case 'unified':
        return source as UnifiedMessage;
    }
  }

  // Auto-detect based on structure
  const detected = detectSourceType(source);
  return toUnifiedMessage(source, detected);
}

/**
 * Convert an array of messages to unified format.
 */
export function toUnifiedMessages(
  sources: Array<SourceMessage | UnifiedMessage>,
  sourceType?: MessageSourceType
): UnifiedMessage[] {
  return sources.map(source => toUnifiedMessage(source, sourceType));
}

// =============================================================================
// Conversion: Unified -> Target
// =============================================================================

/**
 * Convert a UnifiedMessage back to MastraMessage format.
 */
export function toMastraMessage(unified: UnifiedMessage): MastraMessage {
  return {
    id: unified.id,
    role: reverseMapToMastraRole(unified.role),
    content: unified.content,
    status: reverseMapToMastraStatus(unified.status),
    timestamp: unified.timestamp,
    toolCalls: unified.toolCalls?.map(reverseMastraToolCall),
    usage: unified.usage,
    metadata: unified.metadata,
  };
}

/**
 * Convert a UnifiedMessage back to MultiAgentChatMessage format.
 */
export function toMultiAgentMessage(
  unified: UnifiedMessage,
  sessionId: string
): MultiAgentChatMessage {
  return {
    id: unified.id,
    sessionId: sessionId,
    role: reverseMapToMultiAgentRole(unified.role),
    content: unified.content,
    agentId: unified.agentId,
    agentName: unified.agentName,
    agentRole: unified.agentRole,
    messageType: reverseMapToMultiAgentMessageType(unified.messageType),
    taskId: unified.taskId,
    taskTitle: unified.taskTitle,
    metadata: unified.metadata,
    actions: unified.actions?.map(reverseAction),
    createdAt: unified.timestamp.toISOString(),
  };
}

/**
 * Convert a UnifiedMessage back to CoachMessage format.
 */
export function toCoachMessage(unified: UnifiedMessage): CoachMessage {
  // Filter out invalid UI components (those not supported by CoachMessage)
  const validUIComponents = unified.uiComponents
    ?.map(reverseCoachUIComponent)
    .filter((comp): comp is NonNullable<typeof comp> => comp !== null);

  return {
    id: unified.id,
    role: reverseMapToCoachRole(unified.role),
    content: unified.content,
    timestamp: unified.timestamp,
    intent: unified.intent,
    data: unified.metadata?.originalData,
    uiComponents: validUIComponents && validUIComponents.length > 0 ? validUIComponents : undefined,
  };
}

/**
 * Convert a UnifiedMessage back to BaseAgentMessage format.
 */
export function toBaseAgentMessage(unified: UnifiedMessage): BaseAgentMessage {
  return {
    role: reverseMapToBaseRole(unified.role),
    content: unified.content,
    timestamp: unified.timestamp,
    metadata: unified.metadata,
  };
}

/**
 * Universal converter from unified to target format.
 *
 * @param unified - UnifiedMessage to convert
 * @param targetType - Target format type
 * @param options - Additional options (e.g., sessionId for multi-agent)
 * @returns Message in target format
 */
export function fromUnifiedMessage<T extends MessageSourceType>(
  unified: UnifiedMessage,
  targetType: T,
  options?: { sessionId?: string }
): T extends 'mastra' ? MastraMessage
  : T extends 'multi-agent' ? MultiAgentChatMessage
  : T extends 'coach' ? CoachMessage
  : T extends 'base' ? BaseAgentMessage
  : UnifiedMessage {
  switch (targetType) {
    case 'mastra':
      return toMastraMessage(unified) as any;
    case 'multi-agent':
      return toMultiAgentMessage(unified, options?.sessionId ?? unified.sessionId ?? '') as any;
    case 'coach':
      return toCoachMessage(unified) as any;
    case 'base':
      return toBaseAgentMessage(unified) as any;
    case 'unified':
    default:
      return unified as any;
  }
}

// =============================================================================
// Type Detection
// =============================================================================

/**
 * Check if a message is already in UnifiedMessage format.
 */
export function isUnifiedMessage(message: unknown): message is UnifiedMessage {
  if (!message || typeof message !== 'object') return false;
  const m = message as Record<string, unknown>;

  // UnifiedMessage has specific structure
  return (
    typeof m.id === 'string' &&
    typeof m.role === 'string' &&
    typeof m.content === 'string' &&
    m.timestamp instanceof Date &&
    // Check for unified-specific optional fields
    (m.agentType === undefined || ['mastra', 'strands', 'legacy', 'multi-agent', 'custom'].includes(m.agentType as string))
  );
}

/**
 * Detect the source type of a message based on its structure.
 */
export function detectSourceType(message: unknown): MessageSourceType {
  if (!message || typeof message !== 'object') {
    return 'base';
  }

  const m = message as Record<string, unknown>;

  // MastraMessage: has 'status' field with specific values
  if (
    typeof m.status === 'string' &&
    ['pending', 'streaming', 'complete', 'error'].includes(m.status)
  ) {
    return 'mastra';
  }

  // MultiAgentChatMessage: has 'sessionId' and 'createdAt'
  if (typeof m.sessionId === 'string' && typeof m.createdAt === 'string') {
    return 'multi-agent';
  }

  // CoachMessage: has 'uiComponents' or 'intent'
  if (m.uiComponents !== undefined || m.intent !== undefined) {
    return 'coach';
  }

  // UnifiedMessage: has 'agentType'
  if (m.agentType !== undefined) {
    return 'unified';
  }

  // Default to base
  return 'base';
}

// =============================================================================
// Role Mapping Helpers
// =============================================================================

function mapMastraRole(role: 'user' | 'assistant' | 'system'): UnifiedMessageRole {
  return role;
}

function mapMultiAgentRole(role: 'user' | 'manager' | 'agent' | 'system'): UnifiedMessageRole {
  return role;
}

function mapCoachRole(role: 'user' | 'assistant'): UnifiedMessageRole {
  return role;
}

function mapBaseRole(role: 'user' | 'assistant' | 'system'): UnifiedMessageRole {
  return role;
}

function reverseMapToMastraRole(role: UnifiedMessageRole): 'user' | 'assistant' | 'system' {
  switch (role) {
    case 'user':
      return 'user';
    case 'assistant':
    case 'agent':
    case 'manager':
      return 'assistant';
    case 'system':
      return 'system';
    default:
      return 'assistant';
  }
}

function reverseMapToMultiAgentRole(role: UnifiedMessageRole): 'user' | 'manager' | 'agent' | 'system' {
  switch (role) {
    case 'user':
      return 'user';
    case 'manager':
      return 'manager';
    case 'assistant':
    case 'agent':
      return 'agent';
    case 'system':
      return 'system';
    default:
      return 'agent';
  }
}

function reverseMapToCoachRole(role: UnifiedMessageRole): 'user' | 'assistant' {
  return role === 'user' ? 'user' : 'assistant';
}

function reverseMapToBaseRole(role: UnifiedMessageRole): 'user' | 'assistant' | 'system' {
  switch (role) {
    case 'user':
      return 'user';
    case 'system':
      return 'system';
    default:
      return 'assistant';
  }
}

// =============================================================================
// Status Mapping Helpers
// =============================================================================

function mapMastraStatus(status: 'pending' | 'streaming' | 'complete' | 'error'): UnifiedMessageStatus {
  return status;
}

function reverseMapToMastraStatus(status?: UnifiedMessageStatus): 'pending' | 'streaming' | 'complete' | 'error' {
  return status ?? 'complete';
}

// =============================================================================
// Message Type Mapping Helpers
// =============================================================================

function mapMultiAgentMessageType(
  type?: 'message' | 'task_assignment' | 'progress_report' | 'completion_report' | 'error_report' | 'spec_draft' | 'instruction'
): UnifiedMessageType | undefined {
  if (!type) return undefined;
  return type as UnifiedMessageType;
}

function reverseMapToMultiAgentMessageType(
  type?: UnifiedMessageType
): 'message' | 'task_assignment' | 'progress_report' | 'completion_report' | 'error_report' | 'spec_draft' | 'instruction' | undefined {
  if (!type) return undefined;
  switch (type) {
    case 'message':
    case 'task_assignment':
    case 'progress_report':
    case 'completion_report':
    case 'error_report':
    case 'spec_draft':
    case 'instruction':
      return type;
    case 'tool_result':
      return 'message';
    default:
      return 'message';
  }
}

// =============================================================================
// Tool Call Conversion Helpers
// =============================================================================

function convertMastraToolCall(call: MastraToolCall): UnifiedToolCall {
  return {
    toolName: call.toolName,
    input: call.input,
    output: call.output,
    success: call.success,
    error: call.error,
    status: call.success ? 'completed' : 'failed',
  };
}

function reverseMastraToolCall(call: UnifiedToolCall): MastraToolCall {
  return {
    toolName: call.toolName,
    input: call.input,
    output: call.output,
    success: call.success,
    error: call.error,
  };
}

// =============================================================================
// Action Conversion Helpers
// =============================================================================

function convertAction(action: { id: string; label: string; type: 'approve' | 'reject' | 'execute' | 'navigate'; payload: unknown }): UnifiedMessageAction {
  return {
    id: action.id,
    label: action.label,
    type: action.type,
    payload: action.payload,
  };
}

function reverseAction(action: UnifiedMessageAction): { id: string; label: string; type: 'approve' | 'reject' | 'execute' | 'navigate'; payload: unknown } {
  return {
    id: action.id,
    label: action.label,
    type: action.type === 'custom' ? 'execute' : action.type,
    payload: action.payload,
  };
}

// =============================================================================
// UI Component Conversion Helpers
// =============================================================================

function convertCoachUIComponent(
  comp: { type: 'ui_component'; component: string; data: Record<string, unknown> }
): UnifiedUIComponent {
  return {
    type: comp.component as UnifiedUIComponent['type'],
    data: comp.data,
  };
}

/**
 * Valid coach UI component types.
 */
type CoachUIComponentType = 'habit_stats' | 'choice_buttons' | 'workload_chart' | 'progress_indicator' | 'quick_actions';

/**
 * Check if a UI component type is valid for CoachMessage.
 */
function isValidCoachUIComponentType(type: string): type is CoachUIComponentType {
  return ['habit_stats', 'choice_buttons', 'workload_chart', 'progress_indicator', 'quick_actions'].includes(type);
}

function reverseCoachUIComponent(
  comp: UnifiedUIComponent
): { type: 'ui_component'; component: CoachUIComponentType; data: Record<string, unknown> } | null {
  // Only return valid CoachMessage UI component types
  if (!isValidCoachUIComponentType(comp.type)) {
    return null;
  }
  return {
    type: 'ui_component',
    component: comp.type,
    data: comp.data,
  };
}

// =============================================================================
// Batch Conversion Utilities
// =============================================================================

/**
 * Convert messages and preserve order.
 */
export function convertMessagesWithOrder<TSource extends SourceMessage, TTarget>(
  sources: TSource[],
  converter: (source: TSource, index: number) => TTarget
): TTarget[] {
  return sources.map((source, index) => converter(source, index));
}

/**
 * Merge messages from multiple sources into a unified, sorted array.
 */
export function mergeAndSortMessages(
  ...messageSets: Array<{ messages: SourceMessage[]; sourceType: MessageSourceType }>
): UnifiedMessage[] {
  const allMessages: UnifiedMessage[] = [];

  for (const { messages, sourceType } of messageSets) {
    const unified = messages.map(m => toUnifiedMessage(m, sourceType));
    allMessages.push(...unified);
  }

  // Sort by timestamp
  return allMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

/**
 * Filter messages by agent type.
 */
export function filterByAgentType(
  messages: UnifiedMessage[],
  agentType: UnifiedAgentType
): UnifiedMessage[] {
  return messages.filter(m => m.agentType === agentType);
}

/**
 * Filter messages by role.
 */
export function filterByRole(
  messages: UnifiedMessage[],
  role: UnifiedMessageRole
): UnifiedMessage[] {
  return messages.filter(m => m.role === role);
}

/**
 * Group messages by session ID.
 */
export function groupBySession(
  messages: UnifiedMessage[]
): Map<string, UnifiedMessage[]> {
  const groups = new Map<string, UnifiedMessage[]>();

  for (const message of messages) {
    const sessionId = message.sessionId ?? 'default';
    const existing = groups.get(sessionId) ?? [];
    existing.push(message);
    groups.set(sessionId, existing);
  }

  return groups;
}

/**
 * Get the most recent message of each type from a message array.
 */
export function getLatestByRole(
  messages: UnifiedMessage[]
): Map<UnifiedMessageRole, UnifiedMessage> {
  const latest = new Map<UnifiedMessageRole, UnifiedMessage>();

  for (const message of messages) {
    const existing = latest.get(message.role);
    if (!existing || message.timestamp > existing.timestamp) {
      latest.set(message.role, message);
    }
  }

  return latest;
}
