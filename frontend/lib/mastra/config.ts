/**
 * Mastra Configuration for VOW Frontend
 *
 * Client-side Mastra configuration. Note that API keys should NOT be exposed
 * on the client side. This configuration is primarily for type definitions
 * and client-side agent interaction utilities.
 *
 * @module lib/mastra/config
 */

import { Mastra } from '@mastra/core';

/**
 * Frontend Mastra configuration (client-safe)
 * API calls are proxied through the backend API
 */
export interface FrontendMastraConfig {
  /** API endpoint for agent interactions */
  apiEndpoint: string;
  /** Default model identifier (for display purposes) */
  defaultModel: string;
  /** Enable streaming responses */
  enableStreaming: boolean;
}

/**
 * Default frontend configuration
 * Note: apiEndpoint is relative - it will be prefixed with NEXT_PUBLIC_BACKEND_API_URL
 */
export const DEFAULT_FRONTEND_CONFIG: FrontendMastraConfig = {
  apiEndpoint: '/api/agents/chat',
  defaultModel: 'gpt-4o',
  enableStreaming: true,
};

/**
 * Get frontend Mastra configuration
 */
export function getFrontendMastraConfig(): FrontendMastraConfig {
  return {
    apiEndpoint: process.env.NEXT_PUBLIC_MASTRA_API_ENDPOINT || DEFAULT_FRONTEND_CONFIG.apiEndpoint,
    defaultModel: process.env.NEXT_PUBLIC_MASTRA_DEFAULT_MODEL || DEFAULT_FRONTEND_CONFIG.defaultModel,
    enableStreaming: process.env.NEXT_PUBLIC_MASTRA_ENABLE_STREAMING !== 'false',
  };
}

/**
 * Agent message types for frontend communication
 */
export interface AgentMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Agent response type
 */
export interface AgentResponse {
  message: AgentMessage;
  toolCalls?: ToolCallResult[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Tool call result from agent
 */
export interface ToolCallResult {
  toolName: string;
  input: unknown;
  output: unknown;
  success: boolean;
  durationMs?: number;
  error?: string;
}

/**
 * Create a Mastra client for frontend use
 * This is a lightweight wrapper that communicates with the backend
 */
export class MastraClient {
  private config: FrontendMastraConfig;

  constructor(config?: Partial<FrontendMastraConfig>) {
    this.config = { ...getFrontendMastraConfig(), ...config };
  }

  /**
   * Send a message to the agent
   */
  async sendMessage(
    messages: AgentMessage[],
    options?: {
      stream?: boolean;
      agentId?: string;
    }
  ): Promise<AgentResponse> {
    const response = await fetch(this.config.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages,
        stream: options?.stream ?? this.config.enableStreaming,
        agentId: options?.agentId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Agent request failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Send a message and receive streaming response
   */
  async *sendMessageStream(
    messages: AgentMessage[],
    options?: { agentId?: string }
  ): AsyncGenerator<string, void, unknown> {
    const response = await fetch(this.config.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages,
        stream: true,
        agentId: options?.agentId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Agent request failed: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      yield decoder.decode(value, { stream: true });
    }
  }
}
