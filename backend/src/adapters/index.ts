/**
 * Adapters Module
 *
 * Provides conversion utilities between different tool formats.
 *
 * @module adapters
 */

// OpenAI Tool Adapter
export {
  // Conversion Functions
  zodSchemaToOpenAIParams,
  convertSharedToolToOpenAI,
  convertCoachToolToOpenAI,
  convertSharedToolsToOpenAI,
  convertCoachToolsToOpenAI,
  // Registry
  OpenAIToolRegistry,
  getDefaultToolRegistry,
  resetDefaultToolRegistry,
  createToolRegistry,
} from './openai-tool-adapter.js';

export type {
  SharedAgentTool,
  CoachToolDefinition,
  ConvertedTool,
  ToolAdapterConfig,
} from './openai-tool-adapter.js';
