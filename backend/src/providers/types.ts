/**
 * Provider Abstraction Layer - Type Definitions
 *
 * Defines interfaces for a unified AI provider abstraction.
 * Allows the backend to communicate with different AI providers
 * (OpenAI, Anthropic, Gemini, etc.) through a single interface.
 *
 * @module providers/types
 */

/**
 * Streaming chat chunk - compatible with MCP server SSE format.
 *
 * Each chunk represents one SSE event in the streaming response.
 * The lifecycle is: session -> token* -> complete (or error at any point).
 */
export interface ChatChunk {
  type: 'token' | 'complete' | 'error' | 'session';
  token?: string;
  content?: string;
  error?: string;
  sessionId?: string;
}

/**
 * A single message in a chat conversation.
 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Options for a chat request.
 */
export interface ChatOptions {
  model?: string | undefined;
  temperature?: number | undefined;
  maxTokens?: number | undefined;
  sessionId?: string | undefined;
  userId?: string | undefined;
}

/**
 * Information about an AI provider and its availability.
 */
export interface ProviderInfo {
  id: string;
  name: string;
  nameJa: string;
  isAvailable: boolean;
  currentModel: string;
  supportedModels: string[];
}

/**
 * Unified AI chat provider interface.
 *
 * Implementations must provide provider info, availability checks,
 * and an async generator-based streaming chat method.
 */
export interface AIChatProvider {
  getProviderInfo(): ProviderInfo;
  isAvailable(): Promise<boolean>;
  chat(
    messages: ChatMessage[],
    systemPrompt: string,
    options?: ChatOptions,
  ): AsyncGenerator<ChatChunk, void, unknown>;
}
