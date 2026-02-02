/**
 * Strands Agents Type Definitions for VOW Backend
 *
 * TypeScript interfaces and types for Strands Agents SDK integration.
 *
 * @module agents/strands/types
 */

import { z } from 'zod';

/**
 * Supported model providers for Strands Agents
 */
export type StrandsModelProvider = 'bedrock' | 'openai' | 'anthropic';

/**
 * Strands Agent configuration interface
 */
export interface StrandsAgentConfig {
  /** Unique name for the agent */
  name: string;
  /** Role description for the agent */
  role: string;
  /** List of tools available to the agent */
  tools: StrandsTool[];
  /** System prompt for the agent */
  systemPrompt: string;
  /** Optional model override */
  model?: string;
  /** Optional temperature setting */
  temperature?: number;
  /** Maximum tokens for response */
  maxTokens?: number;
}

/**
 * Strands Tool definition
 */
export interface StrandsTool<TInput = unknown, TOutput = unknown> {
  /** Unique name for the tool */
  name: string;
  /** Description of what the tool does */
  description: string;
  /** Zod schema for input validation */
  inputSchema: z.ZodSchema<TInput>;
  /** Execute function for the tool */
  execute: (input: TInput, context: ToolExecutionContext) => Promise<TOutput>;
}

/**
 * Context provided to tool execution
 */
export interface ToolExecutionContext {
  /** User ID making the request */
  userId: string;
  /** Session ID for the conversation */
  sessionId?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Abort signal for cancellation */
  abortSignal?: AbortSignal;
}

/**
 * Agent execution result
 */
export interface AgentExecutionResult {
  /** Final response message */
  response: string;
  /** Tool calls made during execution */
  toolCalls: ToolCallRecord[];
  /** Total tokens used */
  usage: TokenUsage;
  /** Execution time in milliseconds */
  executionTimeMs: number;
  /** Whether execution completed successfully */
  success: boolean;
  /** Error message if execution failed */
  error?: string;
}

/**
 * Record of a tool call
 */
export interface ToolCallRecord {
  /** Tool name */
  toolName: string;
  /** Input provided to the tool */
  input: unknown;
  /** Output from the tool */
  output: unknown;
  /** Whether the tool call succeeded */
  success: boolean;
  /** Error message if tool call failed */
  error?: string;
  /** Execution time in milliseconds */
  durationMs: number;
}

/**
 * Token usage statistics
 */
export interface TokenUsage {
  /** Tokens in the prompt */
  promptTokens: number;
  /** Tokens in the completion */
  completionTokens: number;
  /** Total tokens used */
  totalTokens: number;
}

/**
 * Strands conversation message
 */
export interface StrandsMessage {
  /** Role of the message sender */
  role: 'user' | 'assistant' | 'system' | 'tool';
  /** Content of the message */
  content: string;
  /** Tool call ID if this is a tool response */
  toolCallId?: string;
  /** Tool name if this is a tool call or response */
  toolName?: string;
  /** Timestamp of the message */
  timestamp?: Date;
}

/**
 * Agent session for multi-turn conversations
 */
export interface AgentSession {
  /** Unique session ID */
  id: string;
  /** Agent name */
  agentName: string;
  /** User ID */
  userId: string;
  /** Conversation history */
  messages: StrandsMessage[];
  /** Session creation time */
  createdAt: Date;
  /** Last activity time */
  lastActivityAt: Date;
  /** Session metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Strands Agent registration options
 */
export interface AgentRegistrationOptions {
  /** Unique identifier for the agent */
  id: string;
  /** Configuration for the agent */
  config: StrandsAgentConfig;
  /** Whether to enable this agent by default */
  enabled?: boolean;
  /** Priority for agent selection (higher = preferred) */
  priority?: number;
}

/**
 * Streaming event types
 */
export type StreamingEventType =
  | 'start'
  | 'token'
  | 'tool_call_start'
  | 'tool_call_end'
  | 'complete'
  | 'error';

/**
 * Streaming event data
 */
export interface StreamingEvent {
  /** Type of the streaming event */
  type: StreamingEventType;
  /** Event data */
  data: unknown;
  /** Timestamp of the event */
  timestamp: Date;
}

/**
 * Streaming token event
 */
export interface TokenStreamEvent extends StreamingEvent {
  type: 'token';
  data: {
    token: string;
    index: number;
  };
}

/**
 * Tool call streaming event
 */
export interface ToolCallStreamEvent extends StreamingEvent {
  type: 'tool_call_start' | 'tool_call_end';
  data: {
    toolName: string;
    input?: unknown;
    output?: unknown;
    success?: boolean;
    error?: string;
  };
}
