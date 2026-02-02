/**
 * Agent Tools - Type Definitions
 *
 * Common types and interfaces for AI agent tools.
 */

import { z } from 'zod';

/**
 * Context passed to tool execution functions.
 * Contains user authentication and database access.
 */
export interface ToolContext {
  /** Current user's ID */
  userId: string;

  /** Supabase client instance for database operations */
  supabaseClient: unknown; // Type narrowed in implementation

  /** Optional request metadata */
  metadata?: {
    /** Request trace ID for logging */
    traceId?: string;
    /** User's locale for i18n */
    locale?: string;
    /** Client timezone */
    timezone?: string;
  };
}

/**
 * Base interface for all agent tools.
 * TInput is the parsed output type from Zod (after defaults are applied).
 * TOutput is the tool's return type.
 */
export interface AgentTool<TInput = unknown, TOutput = unknown> {
  /** Unique tool name (snake_case) */
  name: string;

  /** Human-readable description for the AI model */
  description: string;

  /** Zod schema for input validation */
  inputSchema: z.ZodType<TInput, z.ZodTypeDef, unknown>;

  /** Tool execution function */
  execute: (input: TInput, context: ToolContext) => Promise<TOutput>;
}

/**
 * Result wrapper for tool execution.
 */
export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Tool execution status for tracking.
 */
export type ToolExecutionStatus = 'pending' | 'running' | 'completed' | 'failed';

/**
 * Tool execution record for logging/analytics.
 */
export interface ToolExecutionRecord {
  toolName: string;
  status: ToolExecutionStatus;
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
  input: unknown;
  output?: unknown;
  error?: string;
  traceId?: string;
}

/**
 * Configuration for tool registration.
 */
export interface ToolRegistration {
  /** Tool category for organization */
  category: 'habit' | 'goal' | 'analytics' | 'user' | 'system';

  /** Required permission level */
  requiredRole?: 'free' | 'premium' | 'admin';

  /** Rate limit per minute (0 = unlimited) */
  rateLimit?: number;

  /** Whether tool is enabled */
  enabled: boolean;
}

/**
 * Helper type to extract input type from an AgentTool.
 */
export type ToolInput<T extends AgentTool> = T extends AgentTool<infer I, unknown>
  ? I
  : never;

/**
 * Helper type to extract output type from an AgentTool.
 */
export type ToolOutput<T extends AgentTool> = T extends AgentTool<unknown, infer O>
  ? O
  : never;
