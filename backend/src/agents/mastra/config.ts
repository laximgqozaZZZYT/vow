/**
 * Mastra Configuration for VOW Backend
 *
 * This file configures the Mastra instance using the unified LLM configuration.
 * Environment variables are managed centrally in config/llm-config.ts.
 *
 * @module agents/mastra/config
 */

import { Mastra } from '@mastra/core';
import {
  getLLMConfig,
  getApiKey,
  isProviderAvailable,
} from '../../config/llm-config.js';

/**
 * Legacy environment variable keys for backward compatibility
 * @deprecated Use unified LLM_* environment variables instead
 */
export const MASTRA_ENV_KEYS = {
  OPENAI_API_KEY: 'MASTRA_OPENAI_API_KEY',
  ANTHROPIC_API_KEY: 'MASTRA_ANTHROPIC_API_KEY',
  DEFAULT_MODEL: 'MASTRA_DEFAULT_MODEL',
} as const;

/**
 * Default model to use when not configured
 */
export const DEFAULT_MASTRA_MODEL = 'gpt-4o';

/**
 * Mastra configuration interface
 */
export interface MastraConfig {
  providers: {
    openai?: {
      apiKey: string | undefined;
    };
    anthropic?: {
      apiKey: string | undefined;
    };
  };
  defaultModel: string;
}

/**
 * Get Mastra configuration from unified LLM config
 * Falls back to legacy MASTRA_* environment variables for backward compatibility
 */
export function getMastraConfig(): MastraConfig {
  const unifiedConfig = getLLMConfig();

  // Get API keys from unified config, with legacy fallback
  const openaiApiKey = getApiKey('openai') || process.env[MASTRA_ENV_KEYS.OPENAI_API_KEY];
  const anthropicApiKey = getApiKey('anthropic') || process.env[MASTRA_ENV_KEYS.ANTHROPIC_API_KEY];

  // Determine default model based on unified config
  const legacyModel = process.env[MASTRA_ENV_KEYS.DEFAULT_MODEL];
  let defaultModel: string;
  if (legacyModel) {
    // Legacy override takes precedence
    defaultModel = legacyModel;
  } else if (unifiedConfig.primary.provider === 'openai' || unifiedConfig.primary.provider === 'anthropic') {
    // Use unified config model for supported providers
    defaultModel = unifiedConfig.primary.defaultModel;
  } else {
    defaultModel = DEFAULT_MASTRA_MODEL;
  }

  // Build providers object conditionally to satisfy exactOptionalPropertyTypes
  const providers: MastraConfig['providers'] = {};
  if (openaiApiKey) {
    providers.openai = { apiKey: openaiApiKey };
  }
  if (anthropicApiKey) {
    providers.anthropic = { apiKey: anthropicApiKey };
  }

  return {
    providers,
    defaultModel,
  };
}

/**
 * Validate that required environment variables are set
 */
export function validateMastraConfig(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  const openaiKey = getApiKey('openai') || process.env[MASTRA_ENV_KEYS.OPENAI_API_KEY];
  const anthropicKey = getApiKey('anthropic') || process.env[MASTRA_ENV_KEYS.ANTHROPIC_API_KEY];

  // At least one provider key must be set
  if (!openaiKey && !anthropicKey) {
    errors.push(
      'At least one of OPENAI_API_KEY, ANTHROPIC_API_KEY, MASTRA_OPENAI_API_KEY, or MASTRA_ANTHROPIC_API_KEY must be set'
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Create and configure Mastra instance
 *
 * @throws Error if configuration is invalid
 */
export function createMastraInstance(): Mastra {
  const validation = validateMastraConfig();
  if (!validation.isValid) {
    throw new Error(`Mastra configuration invalid: ${validation.errors.join(', ')}`);
  }

  const config = getMastraConfig();

  // Type assertion needed as Mastra's type definitions don't match runtime behavior
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Mastra({
    providers: config.providers,
    defaultModel: config.defaultModel,
  } as any);
}

/**
 * Get the provider to use based on unified config
 */
export function getMastraProvider(): 'openai' | 'anthropic' | null {
  const unifiedConfig = getLLMConfig();

  // Check unified config primary provider
  if (unifiedConfig.primary.provider === 'openai' && isProviderAvailable('openai')) {
    return 'openai';
  }
  if (unifiedConfig.primary.provider === 'anthropic' && isProviderAvailable('anthropic')) {
    return 'anthropic';
  }

  // Fallback: try any available provider
  if (isProviderAvailable('openai')) return 'openai';
  if (isProviderAvailable('anthropic')) return 'anthropic';

  return null;
}

/**
 * Get unified config values for Mastra
 */
export function getMastraLLMSettings(): {
  temperature: number;
  maxTokens: number;
  streaming: boolean;
} {
  const config = getLLMConfig();
  return {
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    streaming: config.streaming,
  };
}

/**
 * Singleton Mastra instance (lazy initialization)
 */
let mastraInstance: Mastra | null = null;

/**
 * Get the singleton Mastra instance
 * Creates the instance on first call
 */
export function getMastra(): Mastra {
  if (!mastraInstance) {
    mastraInstance = createMastraInstance();
  }
  return mastraInstance;
}

/**
 * Reset the Mastra instance (useful for testing)
 */
export function resetMastra(): void {
  mastraInstance = null;
}
