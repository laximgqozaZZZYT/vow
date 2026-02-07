/**
 * Provider Factory
 *
 * Creates AIChatProvider instances for a given provider type.
 * Currently supports OpenAI; additional providers (Anthropic, Gemini, Codex)
 * can be added here as they are implemented.
 *
 * @module providers/provider-factory
 */

import type { AIChatProvider } from './types.js';
import { OpenAIChatProvider } from './openai-provider.js';

/**
 * Supported provider identifiers.
 */
export type ProviderType = 'openai' | 'anthropic' | 'gemini' | 'codex';

/**
 * Create an AIChatProvider for the specified provider type.
 *
 * @param userId - The authenticated user's ID (used to retrieve API keys)
 * @param providerType - Which AI provider to use
 * @param model - Optional model override
 * @returns An AIChatProvider instance
 * @throws Error if the provider type is not yet supported
 */
export function createProvider(
  userId: string,
  providerType: ProviderType,
  model?: string,
): AIChatProvider {
  switch (providerType) {
    case 'openai':
      return new OpenAIChatProvider(userId, model);
    default:
      throw new Error(`Unsupported provider: ${providerType}`);
  }
}
