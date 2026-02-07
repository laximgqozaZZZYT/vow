/**
 * Provider Abstraction Layer - Public API
 *
 * Re-exports all provider types, implementations, and the factory function.
 *
 * @module providers
 */

export type {
  AIChatProvider,
  ChatChunk,
  ChatMessage,
  ChatOptions,
  ProviderInfo,
} from './types.js';

export { OpenAIChatProvider } from './openai-provider.js';

export { createProvider } from './provider-factory.js';
export type { ProviderType } from './provider-factory.js';
