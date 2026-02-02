/**
 * Unified LLM Configuration
 *
 * Centralizes all LLM provider settings across the application.
 * Used by Mastra agents, Strands agents, and AI Coach service.
 *
 * @module config/llm-config
 */

import { z } from 'zod';

/**
 * Supported LLM providers
 */
export type LLMProvider = 'openai' | 'anthropic' | 'bedrock';

/**
 * Provider configuration schema
 */
const llmProviderConfigSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'bedrock']),
  apiKey: z.string().optional(),
  region: z.string().optional(),
  defaultModel: z.string(),
  fallbackModel: z.string().optional(),
});

/**
 * Provider configuration interface
 */
export interface LLMProviderConfig {
  /** LLM provider type */
  provider: LLMProvider;
  /** API key (required for openai, anthropic) */
  apiKey?: string;
  /** AWS region (required for bedrock) */
  region?: string;
  /** Default model to use */
  defaultModel: string;
  /** Fallback model when primary fails */
  fallbackModel?: string;
}

// Note: Schema definitions kept for reference but not actively used
// Runtime validation happens in validateLLMConfig() function instead
void llmProviderConfigSchema; // Suppress unused warning

/**
 * Unified LLM configuration interface
 */
export interface UnifiedLLMConfig {
  /** Primary LLM provider configuration */
  primary: LLMProviderConfig;
  /** Fallback provider when primary fails */
  fallback?: LLMProviderConfig;
  /** Enable streaming responses */
  streaming: boolean;
  /** Maximum tokens in response */
  maxTokens: number;
  /** Temperature for response randomness (0-2) */
  temperature: number;
}

/**
 * Environment variable keys for LLM configuration
 */
export const LLM_ENV_KEYS = {
  // Provider selection
  PRIMARY_PROVIDER: 'LLM_PRIMARY_PROVIDER',
  PRIMARY_MODEL: 'LLM_PRIMARY_MODEL',
  FALLBACK_PROVIDER: 'LLM_FALLBACK_PROVIDER',
  FALLBACK_MODEL: 'LLM_FALLBACK_MODEL',

  // API keys (unified)
  OPENAI_API_KEY: 'OPENAI_API_KEY',
  ANTHROPIC_API_KEY: 'ANTHROPIC_API_KEY',

  // AWS Bedrock
  AWS_REGION: 'AWS_REGION',

  // Generation parameters
  MAX_TOKENS: 'LLM_MAX_TOKENS',
  TEMPERATURE: 'LLM_TEMPERATURE',
  STREAMING: 'LLM_STREAMING',
} as const;

/**
 * Default values for LLM configuration
 */
export const LLM_DEFAULTS = {
  PRIMARY_PROVIDER: 'openai' as LLMProvider,
  FALLBACK_PROVIDER: 'bedrock' as LLMProvider,
  AWS_REGION: 'ap-northeast-1',
  MAX_TOKENS: 4096,
  TEMPERATURE: 0.7,
  STREAMING: true,
} as const;

/**
 * Model configurations for each provider
 */
export const MODEL_CATALOG: Record<
  LLMProvider,
  { models: string[]; defaultModel: string; fallbackModel: string }
> = {
  openai: {
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'],
    defaultModel: 'gpt-4o',
    fallbackModel: 'gpt-4o-mini',
  },
  anthropic: {
    models: [
      'claude-opus-4-5-20251101',
      'claude-sonnet-4-20250514',
      'claude-3-5-sonnet-20241022',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
    ],
    defaultModel: 'claude-sonnet-4-20250514',
    fallbackModel: 'claude-3-haiku-20240307',
  },
  bedrock: {
    models: [
      'anthropic.claude-3-5-sonnet-20241022-v2:0',
      'anthropic.claude-3-sonnet-20240229-v1:0',
      'anthropic.claude-3-haiku-20240307-v1:0',
      'amazon.titan-text-premier-v1:0',
    ],
    defaultModel: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    fallbackModel: 'anthropic.claude-3-haiku-20240307-v1:0',
  },
};

/**
 * Get provider configuration from environment
 */
function getProviderConfig(
  provider: LLMProvider,
  modelEnvKey: string,
  fallbackModelEnvKey?: string
): LLMProviderConfig {
  const catalog = MODEL_CATALOG[provider];

  const config: LLMProviderConfig = {
    provider,
    defaultModel: process.env[modelEnvKey] || catalog.defaultModel,
  };

  // Set API key based on provider
  if (provider === 'openai') {
    const apiKey = process.env[LLM_ENV_KEYS.OPENAI_API_KEY];
    if (apiKey) {
      config.apiKey = apiKey;
    }
  } else if (provider === 'anthropic') {
    const apiKey = process.env[LLM_ENV_KEYS.ANTHROPIC_API_KEY];
    if (apiKey) {
      config.apiKey = apiKey;
    }
  }

  // Set region for bedrock
  if (provider === 'bedrock') {
    config.region = process.env[LLM_ENV_KEYS.AWS_REGION] || LLM_DEFAULTS.AWS_REGION;
  }

  // Set fallback model if specified
  if (fallbackModelEnvKey) {
    const fallbackModel = process.env[fallbackModelEnvKey] || catalog.fallbackModel;
    if (fallbackModel) {
      config.fallbackModel = fallbackModel;
    }
  }

  return config;
}

/**
 * Get unified LLM configuration from environment variables
 *
 * Reads from:
 * - LLM_PRIMARY_PROVIDER (default: openai)
 * - LLM_PRIMARY_MODEL (default: provider-specific)
 * - LLM_FALLBACK_PROVIDER (optional)
 * - LLM_FALLBACK_MODEL (optional)
 * - OPENAI_API_KEY, ANTHROPIC_API_KEY
 * - AWS_REGION (for bedrock)
 * - LLM_MAX_TOKENS (default: 4096)
 * - LLM_TEMPERATURE (default: 0.7)
 * - LLM_STREAMING (default: true)
 */
export function getUnifiedLLMConfig(): UnifiedLLMConfig {
  const primaryProvider = (process.env[LLM_ENV_KEYS.PRIMARY_PROVIDER] as LLMProvider) || LLM_DEFAULTS.PRIMARY_PROVIDER;

  const primary = getProviderConfig(primaryProvider, LLM_ENV_KEYS.PRIMARY_MODEL);

  // Build config object
  const config: UnifiedLLMConfig = {
    primary,
    streaming: process.env[LLM_ENV_KEYS.STREAMING] !== 'false',
    maxTokens: parseInt(process.env[LLM_ENV_KEYS.MAX_TOKENS] || String(LLM_DEFAULTS.MAX_TOKENS), 10),
    temperature: parseFloat(process.env[LLM_ENV_KEYS.TEMPERATURE] || String(LLM_DEFAULTS.TEMPERATURE)),
  };

  // Configure fallback if specified
  const fallbackProviderEnv = process.env[LLM_ENV_KEYS.FALLBACK_PROVIDER] as LLMProvider | undefined;
  if (fallbackProviderEnv) {
    config.fallback = getProviderConfig(fallbackProviderEnv, LLM_ENV_KEYS.FALLBACK_MODEL || LLM_ENV_KEYS.PRIMARY_MODEL);
  }

  return config;
}

/**
 * Validate LLM configuration
 */
export function validateLLMConfig(): { isValid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const config = getUnifiedLLMConfig();

  // Validate primary provider
  const validProviders: LLMProvider[] = ['openai', 'anthropic', 'bedrock'];
  if (!validProviders.includes(config.primary.provider)) {
    errors.push(`Invalid primary provider: ${config.primary.provider}. Must be one of: ${validProviders.join(', ')}`);
  }

  // Provider-specific validation
  switch (config.primary.provider) {
    case 'openai':
      if (!config.primary.apiKey) {
        errors.push('OPENAI_API_KEY is required when using OpenAI as primary provider');
      }
      break;

    case 'anthropic':
      if (!config.primary.apiKey) {
        errors.push('ANTHROPIC_API_KEY is required when using Anthropic as primary provider');
      }
      break;

    case 'bedrock':
      // AWS credentials are handled by SDK/IAM role
      if (!config.primary.region) {
        warnings.push(`AWS_REGION not set, using default: ${LLM_DEFAULTS.AWS_REGION}`);
      }
      break;
  }

  // Validate model is in catalog
  const primaryCatalog = MODEL_CATALOG[config.primary.provider];
  if (primaryCatalog && !primaryCatalog.models.includes(config.primary.defaultModel)) {
    warnings.push(
      `Model ${config.primary.defaultModel} may not be supported by ${config.primary.provider}. ` +
        `Supported models: ${primaryCatalog.models.join(', ')}`
    );
  }

  // Validate fallback if configured
  if (config.fallback) {
    if (!validProviders.includes(config.fallback.provider)) {
      errors.push(
        `Invalid fallback provider: ${config.fallback.provider}. Must be one of: ${validProviders.join(', ')}`
      );
    }

    switch (config.fallback.provider) {
      case 'openai':
        if (!config.fallback.apiKey) {
          warnings.push('OPENAI_API_KEY not set for fallback provider');
        }
        break;

      case 'anthropic':
        if (!config.fallback.apiKey) {
          warnings.push('ANTHROPIC_API_KEY not set for fallback provider');
        }
        break;
    }
  }

  // Validate generation parameters
  if (config.maxTokens < 1 || config.maxTokens > 128000) {
    errors.push('LLM_MAX_TOKENS must be between 1 and 128000');
  }

  if (config.temperature < 0 || config.temperature > 2) {
    errors.push('LLM_TEMPERATURE must be between 0 and 2');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Check if a provider is available (has required credentials)
 */
export function isProviderAvailable(provider: LLMProvider): boolean {
  switch (provider) {
    case 'openai':
      return !!process.env[LLM_ENV_KEYS.OPENAI_API_KEY];
    case 'anthropic':
      return !!process.env[LLM_ENV_KEYS.ANTHROPIC_API_KEY];
    case 'bedrock':
      // Bedrock uses IAM roles, always potentially available
      return true;
    default:
      return false;
  }
}

/**
 * Get API key for a provider
 */
export function getApiKey(provider: LLMProvider): string | undefined {
  switch (provider) {
    case 'openai':
      return process.env[LLM_ENV_KEYS.OPENAI_API_KEY];
    case 'anthropic':
      return process.env[LLM_ENV_KEYS.ANTHROPIC_API_KEY];
    default:
      return undefined;
  }
}

/**
 * Get the best available provider based on configuration and credentials
 */
export function getBestAvailableProvider(): LLMProviderConfig | null {
  const config = getUnifiedLLMConfig();

  // Check primary
  if (isProviderAvailable(config.primary.provider)) {
    return config.primary;
  }

  // Check fallback
  if (config.fallback && isProviderAvailable(config.fallback.provider)) {
    return config.fallback;
  }

  // Try all providers
  for (const provider of ['openai', 'anthropic', 'bedrock'] as LLMProvider[]) {
    if (isProviderAvailable(provider)) {
      return getProviderConfig(provider, LLM_ENV_KEYS.PRIMARY_MODEL);
    }
  }

  return null;
}

// Singleton instance (lazy loaded)
let _config: UnifiedLLMConfig | null = null;

/**
 * Get the unified LLM configuration singleton
 */
export function getLLMConfig(): UnifiedLLMConfig {
  if (_config === null) {
    _config = getUnifiedLLMConfig();
  }
  return _config;
}

/**
 * Reset the configuration (useful for testing)
 */
export function resetLLMConfig(): void {
  _config = null;
}

/**
 * Export for convenience
 */
export const llmConfig = getLLMConfig();
