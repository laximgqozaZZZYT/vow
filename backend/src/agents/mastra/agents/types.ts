/**
 * Type definitions for Mastra Multi-Agent System
 *
 * @module agents/mastra/agents/types
 */

/**
 * Tool call information
 */
export interface ToolCallInfo {
  toolName: string;
  toolCallId: string;
  args: unknown;
  result: unknown;
}

/**
 * Single agent response
 */
export interface AgentResponse {
  agentId: string;
  agentName: string;
  content: string;
  toolCalls?: ToolCallInfo[];
  toolResults?: Array<{
    toolCallId: string;
    toolName: string;
    result: unknown;
  }>;
  timestamp: Date;
  durationMs: number;
}

/**
 * Aggregated response from multiple agents
 */
export interface MultiAgentResponse {
  query: string;
  responses: Array<{
    agentId: string;
    agentName: string;
    content: string;
    toolCalls: ToolCallInfo[];
    toolResults: Array<{
      toolCallId: string;
      toolName: string;
      result: unknown;
    }>;
    timestamp: Date;
    durationMs: number;
  }>;
  summary: string;
  timestamp: Date;
  totalDurationMs: number;
}

/**
 * Agent task assignment
 */
export interface AgentTask {
  agentId: string;
  taskType: 'analyze' | 'suggest' | 'track' | 'plan';
  input: unknown;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Manager orchestration context
 */
export interface OrchestrationContext {
  userId: string;
  sessionId: string;
  locale: 'ja' | 'en';
  userContext?: {
    goals?: unknown[];
    habits?: unknown[];
    preferences?: unknown;
  };
}
