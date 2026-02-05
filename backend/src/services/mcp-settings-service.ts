/**
 * MCP Settings Service
 *
 * Service for retrieving MCP connection settings from DynamoDB.
 * Used by CLI endpoint and other services that need MCP configuration.
 *
 * @module services/mcp-settings-service
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
} from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('services.mcp-settings');

// DynamoDB table name (environment-specific)
const TABLE_NAME = process.env['MCP_CONNECTIONS_TABLE'] || 'vow-mcp-connections-dev';

// DynamoDB client
const dynamoClient = new DynamoDBClient({
  region: process.env['AWS_REGION'] || 'ap-northeast-1',
});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// MCP server schema
const mcpServerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  serverUrl: z.string().url().optional().or(z.literal('')),
  serverToken: z.string().optional().or(z.literal('')),
  enabled: z.boolean().default(false),
  autoConnect: z.boolean().default(true),
  priority: z.number().int().min(1).max(10).default(5),
});

// Chat agent settings schema
const chatAgentSettingsSchema = z.object({
  useMcpAgent: z.boolean().default(false),
  mcpServerId: z.string().optional(),
  mcpAgentId: z.string().optional(),
  fallbackToApi: z.boolean().default(true),
  selectionMode: z.enum(['manual', 'priority', 'failover']).default('manual'),
});

// MCP connection config schema
const mcpConnectionSchema = z.object({
  servers: z.array(mcpServerSchema).default([]),
  showInDashboard: z.boolean().default(true),
  notifyOnTaskComplete: z.boolean().default(true),
  notifyOnAgentOffline: z.boolean().default(true),
  chatAgentSettings: chatAgentSettingsSchema.optional(),
});

export type McpServer = z.infer<typeof mcpServerSchema>;
export type ChatAgentSettings = z.infer<typeof chatAgentSettingsSchema>;
export type McpConnectionSettings = z.infer<typeof mcpConnectionSchema>;

/**
 * Default config when no settings exist
 */
const DEFAULT_CONFIG: McpConnectionSettings = {
  servers: [],
  showInDashboard: true,
  notifyOnTaskComplete: true,
  notifyOnAgentOffline: true,
};

/**
 * Migrate legacy single-server config to new multi-server format
 */
function migrateLegacyConfig(legacy: Record<string, unknown>): McpConnectionSettings {
  const servers: McpServer[] = [];

  // If legacy config has a server URL, create a server entry
  if (legacy['serverUrl'] && typeof legacy['serverUrl'] === 'string') {
    servers.push({
      id: crypto.randomUUID(),
      name: 'Default Server',
      serverUrl: legacy['serverUrl'],
      serverToken: (legacy['serverToken'] as string) || '',
      enabled: (legacy['enabled'] as boolean) ?? false,
      autoConnect: (legacy['autoConnect'] as boolean) ?? true,
      priority: 5,
    });
  }

  return {
    servers,
    showInDashboard: true,
    notifyOnTaskComplete: (legacy['notifyOnTaskComplete'] as boolean) ?? true,
    notifyOnAgentOffline: (legacy['notifyOnAgentOffline'] as boolean) ?? true,
  };
}

/**
 * Check if stored data is legacy format
 */
function isLegacyFormat(data: Record<string, unknown>): boolean {
  return 'serverUrl' in data && !('servers' in data);
}

/**
 * Get MCP connection settings for a user
 */
export async function getMcpSettings(userId: string): Promise<McpConnectionSettings> {
  try {
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { userId },
    }));

    if (!result.Item) {
      logger.debug('No MCP settings found for user', { userId });
      return DEFAULT_CONFIG;
    }

    // Remove userId from the stored data before parsing
    const { userId: _uid, ...storedData } = result.Item;

    // Check for legacy format and migrate
    if (isLegacyFormat(storedData)) {
      logger.info('Migrating legacy MCP config', { userId });
      return migrateLegacyConfig(storedData);
    }

    // Parse as new format
    const parsed = mcpConnectionSchema.safeParse(storedData);
    if (!parsed.success) {
      logger.error('Failed to parse MCP config', new Error('Parse error'), {
        userId,
        errors: parsed.error.errors,
      });
      return DEFAULT_CONFIG;
    }

    return parsed.data;
  } catch (error) {
    logger.error('Failed to get MCP settings', error as Error, { userId });
    return DEFAULT_CONFIG;
  }
}

/**
 * Get the active MCP server for chat (based on settings)
 */
export async function getActiveMcpServer(userId: string): Promise<{
  server: McpServer | null;
  agentId: string | null;
  settings: ChatAgentSettings | null;
}> {
  const config = await getMcpSettings(userId);

  // Check if MCP agent is enabled
  if (!config.chatAgentSettings?.useMcpAgent) {
    logger.debug('MCP agent not enabled', { userId });
    return { server: null, agentId: null, settings: null };
  }

  const settings = config.chatAgentSettings;

  // Find the target server
  let server: McpServer | null = null;

  if (settings.mcpServerId) {
    // Use explicitly selected server
    server = config.servers.find(s => s.id === settings.mcpServerId && s.enabled) || null;
  }

  if (!server && settings.selectionMode === 'priority') {
    // Use highest priority enabled server
    const enabledServers = config.servers
      .filter(s => s.enabled && s.serverUrl)
      .sort((a, b) => a.priority - b.priority);
    server = enabledServers[0] || null;
  }

  if (!server) {
    // Fallback: use any enabled server
    server = config.servers.find(s => s.enabled && s.serverUrl) || null;
  }

  if (!server) {
    logger.debug('No enabled MCP server found', { userId });
    return { server: null, agentId: null, settings };
  }

  const agentId = settings.mcpAgentId || 'default';

  logger.debug('Active MCP server found', {
    userId,
    serverId: server.id,
    serverName: server.name,
    agentId,
  });

  return { server, agentId, settings };
}

/**
 * Call MCP server to get chat response
 */
export async function callMcpChat(
  server: McpServer,
  agentId: string,
  message: string,
  sessionId: string,
  systemPrompt?: string
): Promise<{
  success: boolean;
  message?: string;
  toolCalls?: Array<{
    toolName: string;
    input: unknown;
    output: unknown;
    success: boolean;
    durationMs: number;
  }>;
  error?: string;
}> {
  // Normalize server URL: replace localhost with 127.0.0.1 to avoid IPv6 issues
  const normalizedUrl = server.serverUrl?.replace('://localhost:', '://127.0.0.1:') || '';

  if (!normalizedUrl) {
    return { success: false, error: 'No server URL configured' };
  }

  const endpoint = `${normalizedUrl}/agents/${agentId}/chat`;

  logger.info('Calling MCP server', {
    endpoint,
    sessionId,
    messageLength: message.length,
  });

  try {
    // Create abort controller with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json', // Request non-streaming response
        'Authorization': `Bearer ${server.serverToken}`,
      },
      body: JSON.stringify({
        message,
        sessionId,
        systemPrompt,
        streaming: false, // Request non-streaming response
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      logger.error('MCP server error', new Error(`HTTP ${response.status}: ${errorText}`), {
        endpoint,
        status: response.status,
      });
      return {
        success: false,
        error: `MCP server error: ${response.status} ${response.statusText}`,
      };
    }

    // Check content type
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('text/event-stream')) {
      // SSE response - read and parse
      const text = await response.text();
      let fullMessage = '';
      let toolCalls: Array<{
        toolName: string;
        input: unknown;
        output: unknown;
        success: boolean;
        durationMs: number;
      }> = [];

      // Parse SSE events
      const lines = text.split('\n');
      let currentEventType: string | null = null;

      for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed.startsWith('event:')) {
          currentEventType = trimmed.slice(6).trim();
          continue;
        }

        if (trimmed.startsWith('data:')) {
          const jsonStr = trimmed.slice(5).trim();
          if (jsonStr === '[DONE]') continue;

          try {
            const data = JSON.parse(jsonStr);
            const effectiveType = currentEventType || data.type;

            if (effectiveType === 'token' || effectiveType === 'text') {
              fullMessage += data.token || data.text || data.content || '';
            } else if (effectiveType === 'complete' || effectiveType === 'done') {
              if (data.message) fullMessage = data.message;
              if (data.toolCalls) toolCalls = data.toolCalls;
            }
          } catch {
            // Not JSON, append as text
            if (jsonStr) fullMessage += jsonStr;
          }

          currentEventType = null;
        }
      }

      const sseResult: {
        success: boolean;
        message?: string;
        toolCalls?: Array<{
          toolName: string;
          input: unknown;
          output: unknown;
          success: boolean;
          durationMs: number;
        }>;
        error?: string;
      } = {
        success: true,
        message: fullMessage,
      };
      if (toolCalls.length > 0) {
        sseResult.toolCalls = toolCalls;
      }
      return sseResult;
    }

    // JSON response
    const data = await response.json() as {
      message?: string;
      response?: string;
      content?: string;
      toolCalls?: Array<{
        toolName: string;
        input: unknown;
        output: unknown;
        success: boolean;
        durationMs: number;
      }>;
    };

    const jsonResult: {
      success: boolean;
      message?: string;
      toolCalls?: Array<{
        toolName: string;
        input: unknown;
        output: unknown;
        success: boolean;
        durationMs: number;
      }>;
      error?: string;
    } = {
      success: true,
      message: data.message || data.response || data.content || '',
    };
    if (data.toolCalls && data.toolCalls.length > 0) {
      jsonResult.toolCalls = data.toolCalls;
    }
    return jsonResult;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('MCP call failed', error as Error, { endpoint });

    if (errorMessage.includes('aborted')) {
      return { success: false, error: 'MCP request timeout' };
    }

    return { success: false, error: errorMessage };
  }
}
