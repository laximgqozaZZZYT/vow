/**
 * Type definitions for Mastra Multi-Agent System
 *
 * @module agents/mastra/agents/types
 */

/**
 * Single agent response
 */
export interface AgentResponse {
  agentId: string;
  agentName: string;
  content: string;
  toolCalls?: Array<{
    toolName: string;
    input: unknown;
    output: unknown;
  }>;
  timestamp: Date;
  durationMs: number;
}

/**
 * Aggregated response from multiple agents
 */
export interface MultiAgentResponse {
  query: string;
  responses: AgentResponse[];
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
