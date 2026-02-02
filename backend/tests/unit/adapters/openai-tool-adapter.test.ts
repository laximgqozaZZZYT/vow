/**
 * Tests for OpenAI Tool Adapter
 *
 * Tests conversion of tools from various formats to OpenAI Function Calling format.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import {
  zodSchemaToOpenAIParams,
  convertSharedToolToOpenAI,
  convertCoachToolToOpenAI,
  OpenAIToolRegistry,
  createToolRegistry,
  type SharedAgentTool,
  type CoachToolDefinition,
} from '../../../src/adapters/openai-tool-adapter.js';

describe('OpenAI Tool Adapter', () => {
  describe('zodSchemaToOpenAIParams', () => {
    it('should convert simple object schema', () => {
      const schema = z.object({
        name: z.string().describe('The name'),
        count: z.number().describe('A count'),
      });

      const result = zodSchemaToOpenAIParams(schema, 'test_tool');

      expect(result.type).toBe('object');
      expect(result.properties).toHaveProperty('name');
      expect(result.properties).toHaveProperty('count');
    });

    it('should handle required fields', () => {
      const schema = z.object({
        required: z.string(),
        optional: z.string().optional(),
      });

      const result = zodSchemaToOpenAIParams(schema, 'test_tool');

      expect(result.required).toContain('required');
      // Optional fields may or may not be in required array depending on Zod version
    });

    it('should handle enum types', () => {
      const schema = z.object({
        type: z.enum(['do', 'avoid']).describe('Habit type'),
      });

      const result = zodSchemaToOpenAIParams(schema, 'test_tool');
      const typeProperty = result.properties['type'] as Record<string, unknown>;

      expect(typeProperty['enum']).toEqual(['do', 'avoid']);
    });

    it('should handle array types', () => {
      const schema = z.object({
        items: z.array(z.string()).describe('List of items'),
      });

      const result = zodSchemaToOpenAIParams(schema, 'test_tool');
      const itemsProperty = result.properties['items'] as Record<string, unknown>;

      expect(itemsProperty['type']).toBe('array');
      expect(itemsProperty['items']).toBeDefined();
    });

    it('should handle nested objects', () => {
      const schema = z.object({
        nested: z.object({
          inner: z.string(),
        }),
      });

      const result = zodSchemaToOpenAIParams(schema, 'test_tool');
      const nestedProperty = result.properties['nested'] as Record<string, unknown>;

      expect(nestedProperty['type']).toBe('object');
      expect(nestedProperty['properties']).toBeDefined();
    });
  });

  describe('convertSharedToolToOpenAI', () => {
    it('should convert a shared tool to OpenAI format', () => {
      const mockTool: SharedAgentTool<{ name: string }, { success: boolean }> = {
        name: 'test_tool',
        description: 'A test tool',
        inputSchema: z.object({
          name: z.string().describe('Name input'),
        }),
        execute: async (input) => ({ success: true, input }),
      };

      const result = convertSharedToolToOpenAI(mockTool);

      expect(result.openaiTool.type).toBe('function');
      expect(result.openaiTool.function.name).toBe('test_tool');
      expect(result.openaiTool.function.description).toBe('A test tool');
      expect(result.execute).toBeDefined();
    });

    it('should apply tool name prefix', () => {
      const mockTool: SharedAgentTool = {
        name: 'test_tool',
        description: 'A test tool',
        inputSchema: z.object({}),
        execute: async () => ({}),
      };

      const result = convertSharedToolToOpenAI(mockTool, {
        toolNamePrefix: 'prefix_',
      });

      expect(result.openaiTool.function.name).toBe('prefix_test_tool');
    });

    it('should execute the tool with parsed input', async () => {
      const executedInputs: unknown[] = [];
      const mockTool: SharedAgentTool<{ name: string }, string> = {
        name: 'test_tool',
        description: 'A test tool',
        inputSchema: z.object({
          name: z.string(),
        }),
        execute: async (input) => {
          executedInputs.push(input);
          return `Hello, ${input.name}`;
        },
      };

      const result = convertSharedToolToOpenAI(mockTool);
      const output = await result.execute({ name: 'World' }, {});

      expect(output).toBe('Hello, World');
      expect(executedInputs).toHaveLength(1);
      expect(executedInputs[0]).toEqual({ name: 'World' });
    });
  });

  describe('convertCoachToolToOpenAI', () => {
    it('should convert a coach tool to OpenAI format', () => {
      const mockTool: CoachToolDefinition = {
        name: 'analyze_habits',
        description: 'Analyze user habits',
        descriptionJa: '習慣を分析する',
        inputSchema: z.object({
          period: z.enum(['week', 'month']),
        }),
        execute: async () => ({ analysis: [] }),
      };

      const result = convertCoachToolToOpenAI(mockTool);

      expect(result.openaiTool.function.name).toBe('analyze_habits');
      expect(result.openaiTool.function.description).toBe('Analyze user habits');
    });

    it('should use Japanese description when configured', () => {
      const mockTool: CoachToolDefinition = {
        name: 'analyze_habits',
        description: 'Analyze user habits',
        descriptionJa: '習慣を分析する',
        inputSchema: z.object({}),
        execute: async () => ({}),
      };

      const result = convertCoachToolToOpenAI(mockTool, {
        useJapaneseDescriptions: true,
      });

      expect(result.openaiTool.function.description).toBe('習慣を分析する');
    });
  });

  describe('OpenAIToolRegistry', () => {
    let registry: OpenAIToolRegistry;

    beforeEach(() => {
      registry = createToolRegistry();
    });

    it('should register and retrieve tools', () => {
      const mockTool: SharedAgentTool = {
        name: 'test_tool',
        description: 'A test tool',
        inputSchema: z.object({}),
        execute: async () => ({}),
      };

      registry.registerSharedTools([mockTool]);

      expect(registry.size).toBe(1);
      expect(registry.hasTool('test_tool')).toBe(true);
      expect(registry.getToolNames()).toContain('test_tool');
    });

    it('should get all OpenAI tools', () => {
      const mockTool1: SharedAgentTool = {
        name: 'tool1',
        description: 'Tool 1',
        inputSchema: z.object({}),
        execute: async () => ({}),
      };
      const mockTool2: SharedAgentTool = {
        name: 'tool2',
        description: 'Tool 2',
        inputSchema: z.object({}),
        execute: async () => ({}),
      };

      registry.registerSharedTools([mockTool1, mockTool2]);

      const openaiTools = registry.getOpenAITools();
      expect(openaiTools).toHaveLength(2);
    });

    it('should execute tools by name', async () => {
      const mockTool: SharedAgentTool<{ value: number }, number> = {
        name: 'double_tool',
        description: 'Doubles a number',
        inputSchema: z.object({
          value: z.number(),
        }),
        execute: async (input) => input.value * 2,
      };

      registry.registerSharedTools([mockTool]);

      const result = await registry.executeTool('double_tool', { value: 5 }, {});
      expect(result).toBe(10);
    });

    it('should throw error for unknown tool', async () => {
      await expect(
        registry.executeTool('unknown_tool', {}, {})
      ).rejects.toThrow('Tool not found: unknown_tool');
    });

    it('should clear all tools', () => {
      const mockTool: SharedAgentTool = {
        name: 'test_tool',
        description: 'A test tool',
        inputSchema: z.object({}),
        execute: async () => ({}),
      };

      registry.registerSharedTools([mockTool]);
      expect(registry.size).toBe(1);

      registry.clear();
      expect(registry.size).toBe(0);
    });

    it('should exclude tools by name', () => {
      const mockTool1: SharedAgentTool = {
        name: 'include_me',
        description: 'Included',
        inputSchema: z.object({}),
        execute: async () => ({}),
      };
      const mockTool2: SharedAgentTool = {
        name: 'exclude_me',
        description: 'Excluded',
        inputSchema: z.object({}),
        execute: async () => ({}),
      };

      const customRegistry = createToolRegistry({
        excludeTools: ['exclude_me'],
      });
      customRegistry.registerSharedTools([mockTool1, mockTool2]);

      expect(customRegistry.size).toBe(1);
      expect(customRegistry.hasTool('include_me')).toBe(true);
      expect(customRegistry.hasTool('exclude_me')).toBe(false);
    });
  });
});
