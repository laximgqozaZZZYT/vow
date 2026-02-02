/**
 * Strands Agents Configuration for VOW Backend
 *
 * This file configures Strands Agents SDK using the unified LLM configuration.
 * Supports AWS Bedrock, OpenAI, and Anthropic providers.
 *
 * @module agents/strands/config
 */

import type { StrandsModelProvider, AgentRegistrationOptions } from './types.js';
import {
  getLLMConfig,
  getApiKey,
  isProviderAvailable,
  MODEL_CATALOG,
  LLM_ENV_KEYS,
  LLM_DEFAULTS,
  type LLMProvider,
} from '../../config/llm-config.js';

/**
 * Legacy environment variable keys for backward compatibility
 * @deprecated Use unified LLM_* environment variables instead
 */
export const STRANDS_ENV_KEYS = {
  MODEL_PROVIDER: 'STRANDS_MODEL_PROVIDER',
  AWS_REGION: 'AWS_REGION',
  DEFAULT_MODEL: 'STRANDS_DEFAULT_MODEL',
  OPENAI_API_KEY: 'STRANDS_OPENAI_API_KEY',
  ANTHROPIC_API_KEY: 'STRANDS_ANTHROPIC_API_KEY',
} as const;

/**
 * Default values for Strands configuration
 * Uses unified config defaults with Strands-specific fallbacks
 */
export const STRANDS_DEFAULTS = {
  MODEL_PROVIDER: 'bedrock' as StrandsModelProvider,
  AWS_REGION: LLM_DEFAULTS.AWS_REGION,
  DEFAULT_MODEL: MODEL_CATALOG.bedrock.defaultModel,
  TEMPERATURE: LLM_DEFAULTS.TEMPERATURE,
  MAX_TOKENS: LLM_DEFAULTS.MAX_TOKENS,
} as const;

/**
 * Model configurations for different providers
 * Derived from unified MODEL_CATALOG
 */
export const MODEL_CONFIGS: Record<StrandsModelProvider, { models: string[]; defaultModel: string }> = {
  bedrock: {
    models: MODEL_CATALOG.bedrock.models,
    defaultModel: MODEL_CATALOG.bedrock.defaultModel,
  },
  openai: {
    models: MODEL_CATALOG.openai.models,
    defaultModel: MODEL_CATALOG.openai.defaultModel,
  },
  anthropic: {
    models: MODEL_CATALOG.anthropic.models,
    defaultModel: MODEL_CATALOG.anthropic.defaultModel,
  },
};

/**
 * Strands global configuration interface
 */
export interface StrandsGlobalConfig {
  /** Model provider (bedrock, openai, anthropic) */
  modelProvider: StrandsModelProvider;
  /** AWS region for Bedrock */
  region: string;
  /** Default model to use */
  defaultModel: string;
  /** Default temperature for model responses */
  defaultTemperature: number;
  /** Default max tokens */
  defaultMaxTokens: number;
}

/**
 * Map LLMProvider to StrandsModelProvider
 */
function mapToStrandsProvider(provider: LLMProvider): StrandsModelProvider {
  // All LLM providers are also valid Strands providers
  return provider as StrandsModelProvider;
}

/**
 * Get Strands global configuration from unified LLM config
 * Falls back to legacy STRANDS_* environment variables for backward compatibility
 */
export function getStrandsConfig(): StrandsGlobalConfig {
  const unifiedConfig = getLLMConfig();

  // Check for legacy STRANDS_MODEL_PROVIDER override
  const legacyProvider = process.env[STRANDS_ENV_KEYS.MODEL_PROVIDER] as StrandsModelProvider | undefined;
  const modelProvider = legacyProvider || mapToStrandsProvider(unifiedConfig.primary.provider);

  const providerConfig = MODEL_CONFIGS[modelProvider];

  // Check for legacy model override
  const legacyModel = process.env[STRANDS_ENV_KEYS.DEFAULT_MODEL];
  const defaultModel = legacyModel || (legacyProvider ? providerConfig.defaultModel : unifiedConfig.primary.defaultModel);

  return {
    modelProvider,
    region: process.env[LLM_ENV_KEYS.AWS_REGION] || LLM_DEFAULTS.AWS_REGION,
    defaultModel,
    defaultTemperature: unifiedConfig.temperature,
    defaultMaxTokens: unifiedConfig.maxTokens,
  };
}

/**
 * Validate Strands configuration
 */
export function validateStrandsConfig(): { isValid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const config = getStrandsConfig();

  // Validate model provider
  if (!['bedrock', 'openai', 'anthropic'].includes(config.modelProvider)) {
    errors.push(`Invalid model provider: ${config.modelProvider}`);
  }

  // Provider-specific validation using unified API keys
  switch (config.modelProvider) {
    case 'bedrock':
      // AWS credentials are handled by SDK/IAM role
      if (!config.region) {
        warnings.push(`AWS_REGION not set, using default: ${LLM_DEFAULTS.AWS_REGION}`);
      }
      break;

    case 'openai': {
      const openaiKey = getApiKey('openai') || process.env[STRANDS_ENV_KEYS.OPENAI_API_KEY];
      if (!openaiKey) {
        errors.push('OPENAI_API_KEY or STRANDS_OPENAI_API_KEY is required when using OpenAI provider');
      }
      break;
    }

    case 'anthropic': {
      const anthropicKey = getApiKey('anthropic') || process.env[STRANDS_ENV_KEYS.ANTHROPIC_API_KEY];
      if (!anthropicKey) {
        errors.push('ANTHROPIC_API_KEY or STRANDS_ANTHROPIC_API_KEY is required when using Anthropic provider');
      }
      break;
    }
  }

  // Validate model is supported
  const providerConfig = MODEL_CONFIGS[config.modelProvider];
  if (providerConfig && !providerConfig.models.includes(config.defaultModel)) {
    warnings.push(
      `Model ${config.defaultModel} may not be supported by ${config.modelProvider}. ` +
        `Supported models: ${providerConfig.models.join(', ')}`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Create provider-specific configuration
 * Uses unified API keys with legacy fallback
 */
export function createProviderConfig(provider: StrandsModelProvider): Record<string, unknown> {
  switch (provider) {
    case 'bedrock':
      return {
        region: process.env[LLM_ENV_KEYS.AWS_REGION] || LLM_DEFAULTS.AWS_REGION,
        // AWS credentials are handled by SDK/IAM role
      };

    case 'openai':
      return {
        apiKey: getApiKey('openai') || process.env[STRANDS_ENV_KEYS.OPENAI_API_KEY],
      };

    case 'anthropic':
      return {
        apiKey: getApiKey('anthropic') || process.env[STRANDS_ENV_KEYS.ANTHROPIC_API_KEY],
      };

    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

/**
 * Get the best available provider for Strands
 */
export function getStrandsProvider(): StrandsModelProvider | null {
  const config = getStrandsConfig();

  // Check if configured provider is available
  switch (config.modelProvider) {
    case 'openai':
      if (getApiKey('openai') || process.env[STRANDS_ENV_KEYS.OPENAI_API_KEY]) {
        return 'openai';
      }
      break;
    case 'anthropic':
      if (getApiKey('anthropic') || process.env[STRANDS_ENV_KEYS.ANTHROPIC_API_KEY]) {
        return 'anthropic';
      }
      break;
    case 'bedrock':
      return 'bedrock'; // Always available via IAM
  }

  // Fallback: try any available provider
  if (isProviderAvailable('bedrock')) return 'bedrock';
  if (isProviderAvailable('openai')) return 'openai';
  if (isProviderAvailable('anthropic')) return 'anthropic';

  return null;
}

/**
 * Get unified LLM settings for Strands agents
 */
export function getStrandsLLMSettings(): {
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
 * Agent registry for managing multiple agents
 */
class AgentRegistry {
  private agents: Map<string, AgentRegistrationOptions> = new Map();

  /**
   * Register a new agent
   */
  register(options: AgentRegistrationOptions): void {
    if (this.agents.has(options.id)) {
      throw new Error(`Agent with id '${options.id}' is already registered`);
    }
    this.agents.set(options.id, options);
  }

  /**
   * Get an agent by ID
   */
  get(id: string): AgentRegistrationOptions | undefined {
    return this.agents.get(id);
  }

  /**
   * Get all registered agents
   */
  getAll(): AgentRegistrationOptions[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get enabled agents sorted by priority
   */
  getEnabled(): AgentRegistrationOptions[] {
    return this.getAll()
      .filter((agent) => agent.enabled !== false)
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }

  /**
   * Unregister an agent
   */
  unregister(id: string): boolean {
    return this.agents.delete(id);
  }

  /**
   * Clear all registered agents
   */
  clear(): void {
    this.agents.clear();
  }
}

/**
 * Singleton agent registry instance
 */
export const agentRegistry = new AgentRegistry();

/**
 * Export the Strands configuration as a simple object for convenience
 */
export const strandsConfig = getStrandsConfig();
