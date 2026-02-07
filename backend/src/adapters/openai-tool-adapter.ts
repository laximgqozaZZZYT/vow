// NOTE: Currently not imported by any module - candidate for removal or consolidation
/**
 * OpenAI Tool Adapter
 *
 * Converts common agent tools from the shared library (frontend/lib/agent-tools)
 * into OpenAI Function Calling format for use with the AI Coach Service.
 *
 * This adapter enables:
 * - Type-safe tool conversion from Zod schemas to JSON Schema
 * - Unified tool interface for AICoachService
 *
 * @module adapters/openai-tool-adapter
 */

import type { ChatCompletionTool } from 'openai/resources/chat/completions';
import type { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('openai-tool-adapter');

// =============================================================================
// Types
// =============================================================================

/**
 * Generic tool definition from the shared library
 */
export interface SharedAgentTool<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  inputSchema: z.ZodSchema<TInput>;
  execute: (input: TInput, context: unknown) => Promise<TOutput>;
}

/**
 * Coach tool definition from VowCoachAgent
 */
export interface CoachToolDefinition {
  name: string;
  description: string;
  descriptionJa: string;
  inputSchema: z.ZodSchema;
  execute: (input: unknown, context: unknown) => Promise<unknown>;
}

/**
 * Tool conversion result
 */
export interface ConvertedTool {
  openaiTool: ChatCompletionTool;
  execute: (args: Record<string, unknown>, context: unknown) => Promise<unknown>;
}

/**
 * Tool adapter configuration
 */
export interface ToolAdapterConfig {
  /** Use Japanese descriptions when available */
  useJapaneseDescriptions?: boolean;
  /** Add custom prefix to tool names */
  toolNamePrefix?: string;
  /** Filter tools by category */
  includeCategories?: string[];
  /** Exclude specific tools by name */
  excludeTools?: string[];
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Safely extract tool name from ChatCompletionTool
 * Handles both the function type and potential custom types
 */
function getToolName(tool: ChatCompletionTool): string {
  if (tool.type === 'function' && 'function' in tool) {
    return (tool as { function: { name: string } }).function.name;
  }
  // Fallback for unknown types
  return (tool as { function?: { name?: string } }).function?.name || 'unknown';
}

// =============================================================================
// Zod to JSON Schema Conversion
// =============================================================================

/**
 * Convert a Zod schema to OpenAI-compatible JSON Schema format
 */
export function zodSchemaToOpenAIParams(
  schema: z.ZodSchema,
  toolName: string
): { type: 'object'; properties: Record<string, unknown>; required: string[] } {
  try {
    // Use zod-to-json-schema for conversion
    const jsonSchema = zodToJsonSchema(schema, {
      $refStrategy: 'none',
      target: 'openApi3',
    });

    // Extract properties and required fields
    const schemaObj = jsonSchema as Record<string, unknown>;

    if (schemaObj['type'] !== 'object') {
      // Wrap non-object schemas
      return {
        type: 'object',
        properties: {
          input: schemaObj,
        },
        required: [],
      };
    }

    const properties = (schemaObj['properties'] as Record<string, unknown>) || {};
    const required = (schemaObj['required'] as string[]) || [];

    // Clean up properties for OpenAI compatibility
    const cleanedProperties: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(properties)) {
      cleanedProperties[key] = cleanPropertyForOpenAI(value as Record<string, unknown>);
    }

    return {
      type: 'object',
      properties: cleanedProperties,
      required,
    };
  } catch (error) {
    logger.warning('Failed to convert Zod schema to JSON Schema', {
      toolName,
      error: error instanceof Error ? error.message : String(error),
    });

    // Return empty params on error
    return {
      type: 'object',
      properties: {},
      required: [],
    };
  }
}

/**
 * Clean up a property definition for OpenAI compatibility
 */
function cleanPropertyForOpenAI(prop: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};

  // Copy allowed fields
  const allowedFields = [
    'type',
    'description',
    'enum',
    'items',
    'properties',
    'required',
    'minimum',
    'maximum',
    'minLength',
    'maxLength',
    'pattern',
    'default',
  ];

  for (const field of allowedFields) {
    if (prop[field] !== undefined) {
      cleaned[field] = prop[field];
    }
  }

  // Handle nested objects
  if (cleaned['properties']) {
    const nestedProps = cleaned['properties'] as Record<string, Record<string, unknown>>;
    const cleanedNestedProps: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(nestedProps)) {
      cleanedNestedProps[key] = cleanPropertyForOpenAI(value);
    }
    cleaned['properties'] = cleanedNestedProps;
  }

  // Handle array items
  if (cleaned['items']) {
    cleaned['items'] = cleanPropertyForOpenAI(cleaned['items'] as Record<string, unknown>);
  }

  return cleaned;
}

// =============================================================================
// Tool Conversion Functions
// =============================================================================

/**
 * Convert a shared agent tool to OpenAI ChatCompletionTool format
 */
export function convertSharedToolToOpenAI<TInput, TOutput>(
  tool: SharedAgentTool<TInput, TOutput>,
  config: ToolAdapterConfig = {}
): ConvertedTool {
  const toolName = config.toolNamePrefix
    ? `${config.toolNamePrefix}${tool.name}`
    : tool.name;

  const parameters = zodSchemaToOpenAIParams(tool.inputSchema, toolName);

  const openaiTool: ChatCompletionTool = {
    type: 'function',
    function: {
      name: toolName,
      description: tool.description,
      parameters,
    },
  };

  return {
    openaiTool,
    execute: async (args: Record<string, unknown>, context: unknown) => {
      // Parse and validate input
      const parsed = tool.inputSchema.parse(args) as TInput;
      return tool.execute(parsed, context);
    },
  };
}

/**
 * Convert a VowCoachAgent tool to OpenAI ChatCompletionTool format
 */
export function convertCoachToolToOpenAI(
  tool: CoachToolDefinition,
  config: ToolAdapterConfig = {}
): ConvertedTool {
  const toolName = config.toolNamePrefix
    ? `${config.toolNamePrefix}${tool.name}`
    : tool.name;

  const description = config.useJapaneseDescriptions && tool.descriptionJa
    ? tool.descriptionJa
    : tool.description;

  const parameters = zodSchemaToOpenAIParams(tool.inputSchema, toolName);

  const openaiTool: ChatCompletionTool = {
    type: 'function',
    function: {
      name: toolName,
      description,
      parameters,
    },
  };

  return {
    openaiTool,
    execute: async (args: Record<string, unknown>, context: unknown) => {
      // Parse and validate input
      const parsed = tool.inputSchema.parse(args);
      return tool.execute(parsed, context);
    },
  };
}

/**
 * Convert multiple shared agent tools to OpenAI format
 */
export function convertSharedToolsToOpenAI(
  tools: SharedAgentTool[],
  config: ToolAdapterConfig = {}
): Map<string, ConvertedTool> {
  const result = new Map<string, ConvertedTool>();

  for (const tool of tools) {
    // Check exclusion list
    if (config.excludeTools?.includes(tool.name)) {
      continue;
    }

    const converted = convertSharedToolToOpenAI(tool, config);
    const toolName = getToolName(converted.openaiTool);
    result.set(toolName, converted);
  }

  logger.info('Converted shared tools to OpenAI format', {
    inputCount: tools.length,
    outputCount: result.size,
    excludedCount: tools.length - result.size,
  });

  return result;
}

/**
 * Convert multiple coach tools to OpenAI format
 */
export function convertCoachToolsToOpenAI(
  tools: CoachToolDefinition[],
  config: ToolAdapterConfig = {}
): Map<string, ConvertedTool> {
  const result = new Map<string, ConvertedTool>();

  for (const tool of tools) {
    // Check exclusion list
    if (config.excludeTools?.includes(tool.name)) {
      continue;
    }

    const converted = convertCoachToolToOpenAI(tool, config);
    const toolName = getToolName(converted.openaiTool);
    result.set(toolName, converted);
  }

  logger.info('Converted coach tools to OpenAI format', {
    inputCount: tools.length,
    outputCount: result.size,
    excludedCount: tools.length - result.size,
  });

  return result;
}

// =============================================================================
// Tool Registry
// =============================================================================

/**
 * Registry for managing converted tools
 */
export class OpenAIToolRegistry {
  private tools: Map<string, ConvertedTool> = new Map();
  private config: ToolAdapterConfig;

  constructor(config: ToolAdapterConfig = {}) {
    this.config = config;
  }

  /**
   * Register shared agent tools
   */
  registerSharedTools(tools: SharedAgentTool[]): void {
    const converted = convertSharedToolsToOpenAI(tools, this.config);
    for (const [name, tool] of converted) {
      this.tools.set(name, tool);
    }
  }

  /**
   * Register coach tools from VowCoachAgent
   */
  registerCoachTools(tools: CoachToolDefinition[]): void {
    const converted = convertCoachToolsToOpenAI(tools, this.config);
    for (const [name, tool] of converted) {
      this.tools.set(name, tool);
    }
  }

  /**
   * Register a single custom OpenAI tool
   */
  registerCustomTool(tool: ChatCompletionTool, execute: ConvertedTool['execute']): void {
    const toolName = getToolName(tool);
    this.tools.set(toolName, {
      openaiTool: tool,
      execute,
    });
  }

  /**
   * Get all tools in OpenAI format
   */
  getOpenAITools(): ChatCompletionTool[] {
    return Array.from(this.tools.values()).map(t => t.openaiTool);
  }

  /**
   * Get a specific tool by name
   */
  getTool(name: string): ConvertedTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Execute a tool by name
   */
  async executeTool(
    name: string,
    args: Record<string, unknown>,
    context: unknown
  ): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }
    return tool.execute(args, context);
  }

  /**
   * Check if a tool exists
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get tool count
   */
  get size(): number {
    return this.tools.size;
  }

  /**
   * Get all tool names
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Clear all tools
   */
  clear(): void {
    this.tools.clear();
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

let defaultRegistry: OpenAIToolRegistry | null = null;

/**
 * Get or create the default tool registry
 */
export function getDefaultToolRegistry(config?: ToolAdapterConfig): OpenAIToolRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new OpenAIToolRegistry(config);
  }
  return defaultRegistry;
}

/**
 * Reset the default tool registry (useful for testing)
 */
export function resetDefaultToolRegistry(): void {
  defaultRegistry = null;
}

/**
 * Create a new tool registry with specific configuration
 */
export function createToolRegistry(config: ToolAdapterConfig = {}): OpenAIToolRegistry {
  return new OpenAIToolRegistry(config);
}
