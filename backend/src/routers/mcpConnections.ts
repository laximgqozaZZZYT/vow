/**
 * MCP Connections Router
 *
 * REST endpoints for managing MCP (Multi-Agent) server connection settings.
 * Settings are stored per-user in DynamoDB for secure, persistent storage.
 * Supports multiple MCP servers per user.
 *
 * Endpoints:
 * - GET /api/mcp-connections - Get user's MCP connection settings
 * - PUT /api/mcp-connections - Save/update MCP connection settings
 * - DELETE /api/mcp-connections - Delete MCP connection settings
 */

import { Hono } from 'hono';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { jwtAuthMiddleware, getUserId } from '../middleware/auth.js';
import { getLogger } from '../utils/logger.js';
import { z } from 'zod';

const logger = getLogger('routers.mcpConnections');

// DynamoDB table name (environment-specific)
const TABLE_NAME = process.env['MCP_CONNECTIONS_TABLE'] || 'vow-mcp-connections-dev';

// DynamoDB client
const dynamoClient = new DynamoDBClient({
  region: process.env['AWS_REGION'] || 'ap-northeast-1',
});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Individual MCP server schema
const mcpServerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  serverUrl: z.string().url().optional().or(z.literal('')),
  serverToken: z.string().optional().or(z.literal('')),
  enabled: z.boolean().default(false),
  autoConnect: z.boolean().default(true),
});

// New multi-server config schema
const mcpConnectionSchema = z.object({
  servers: z.array(mcpServerSchema).default([]),
  showInDashboard: z.boolean().default(true),
  notifyOnTaskComplete: z.boolean().default(true),
  notifyOnAgentOffline: z.boolean().default(true),
});

// Legacy single-server schema (for migration)
const legacyMcpConnectionSchema = z.object({
  enabled: z.boolean().default(false),
  serverUrl: z.string().url().optional().or(z.literal('')),
  serverToken: z.string().optional().or(z.literal('')),
  connectionMode: z.enum(['direct', 'tunnel']).default('tunnel'),
  tunnelProvider: z.enum(['tailscale', 'ngrok', 'cloudflare', 'other']).optional(),
  autoConnect: z.boolean().default(true),
  notifyOnTaskComplete: z.boolean().default(true),
  notifyOnAgentOffline: z.boolean().default(true),
});

type McpServer = z.infer<typeof mcpServerSchema>;
type McpConnectionSettings = z.infer<typeof mcpConnectionSchema>;

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
function migrateLegacyConfig(legacy: z.infer<typeof legacyMcpConnectionSchema>): McpConnectionSettings {
  const servers: McpServer[] = [];

  // If legacy config has a server URL, create a server entry
  if (legacy.serverUrl) {
    servers.push({
      id: crypto.randomUUID(),
      name: 'Default Server',
      serverUrl: legacy.serverUrl,
      serverToken: legacy.serverToken || '',
      enabled: legacy.enabled,
      autoConnect: legacy.autoConnect,
    });
  }

  return {
    servers,
    showInDashboard: true,
    notifyOnTaskComplete: legacy.notifyOnTaskComplete,
    notifyOnAgentOffline: legacy.notifyOnAgentOffline,
  };
}

/**
 * Check if stored data is legacy format
 */
function isLegacyFormat(data: Record<string, unknown>): boolean {
  // Legacy format has serverUrl at top level, new format has servers array
  return 'serverUrl' in data && !('servers' in data);
}

/**
 * Mask server tokens for security (replace with ********)
 */
function maskServerTokens(config: McpConnectionSettings): McpConnectionSettings & { servers: (McpServer & { hasToken: boolean })[] } {
  return {
    ...config,
    servers: config.servers.map(server => ({
      ...server,
      serverToken: server.serverToken ? '********' : '',
      hasToken: !!server.serverToken,
    })),
  };
}

/**
 * Create the MCP Connections Router.
 */
export function createMcpConnectionsRouter(): Hono {
  const router = new Hono();

  // All routes require JWT authentication
  router.use('*', jwtAuthMiddleware());

  /**
   * GET /
   * Get user's MCP connection settings.
   * Automatically migrates legacy format to new format.
   */
  router.get('/', async (c) => {
    const userId = getUserId(c);
    if (!userId) {
      return c.json({ error: 'User ID not found' }, 401);
    }

    try {
      const result = await docClient.send(
        new GetCommand({
          TableName: TABLE_NAME,
          Key: { userId },
        })
      );

      if (!result.Item) {
        // Return default settings if none exist
        return c.json({
          success: true,
          data: DEFAULT_CONFIG,
        });
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { userId: _, updatedAt, ...storedData } = result.Item as Record<string, unknown>;

      // Check if we need to migrate from legacy format
      if (isLegacyFormat(storedData)) {
        const legacyParsed = legacyMcpConnectionSchema.safeParse(storedData);
        if (legacyParsed.success) {
          const migratedConfig = migrateLegacyConfig(legacyParsed.data);
          // Return migrated config (tokens masked)
          return c.json({
            success: true,
            data: maskServerTokens(migratedConfig),
            migrated: true, // Indicate that client should save this new format
          });
        }
      }

      // Parse as new format
      const parsed = mcpConnectionSchema.safeParse(storedData);
      if (!parsed.success) {
        logger.error('Failed to parse stored MCP config', new Error('Parse error'), { userId, errors: parsed.error.errors });
        return c.json({
          success: true,
          data: DEFAULT_CONFIG,
        });
      }

      return c.json({
        success: true,
        data: maskServerTokens(parsed.data),
      });
    } catch (error) {
      logger.error(
        'Failed to get MCP connection settings',
        error instanceof Error ? error : new Error(String(error)),
        { userId }
      );
      return c.json({ error: 'Failed to get settings' }, 500);
    }
  });

  /**
   * PUT /
   * Save/update MCP connection settings.
   * Handles token preservation when masked tokens are sent back.
   */
  router.put('/', async (c) => {
    const userId = getUserId(c);
    if (!userId) {
      return c.json({ error: 'User ID not found' }, 401);
    }

    try {
      const body = await c.req.json();
      const parsed = mcpConnectionSchema.safeParse(body);

      if (!parsed.success) {
        return c.json({ error: 'Invalid settings', details: parsed.error.errors }, 400);
      }

      const settings = parsed.data;

      // Handle masked tokens - preserve existing tokens where needed
      const existing = await docClient.send(
        new GetCommand({
          TableName: TABLE_NAME,
          Key: { userId },
        })
      );

      let existingServers: McpServer[] = [];
      if (existing.Item) {
        // Check if existing is legacy format
        if (isLegacyFormat(existing.Item as Record<string, unknown>)) {
          const legacyParsed = legacyMcpConnectionSchema.safeParse(existing.Item);
          if (legacyParsed.success) {
            const migrated = migrateLegacyConfig(legacyParsed.data);
            existingServers = migrated.servers;
          }
        } else {
          const existingParsed = mcpConnectionSchema.safeParse(existing.Item);
          if (existingParsed.success) {
            existingServers = existingParsed.data.servers;
          }
        }
      }

      // Create a map of existing servers by ID for quick lookup
      const existingServerMap = new Map(existingServers.map(s => [s.id, s]));

      // Process servers - preserve tokens when masked
      const processedServers = settings.servers.map(server => {
        if (server.serverToken === '********') {
          // Keep existing token
          const existingServer = existingServerMap.get(server.id);
          return {
            ...server,
            serverToken: existingServer?.serverToken || '',
          };
        }
        return server;
      });

      const item = {
        userId,
        servers: processedServers,
        showInDashboard: settings.showInDashboard,
        notifyOnTaskComplete: settings.notifyOnTaskComplete,
        notifyOnAgentOffline: settings.notifyOnAgentOffline,
        updatedAt: new Date().toISOString(),
      };

      await docClient.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: item,
        })
      );

      logger.info('MCP connection settings saved', { userId, serverCount: processedServers.length });

      return c.json({
        success: true,
        message: 'Settings saved successfully',
      });
    } catch (error) {
      logger.error(
        'Failed to save MCP connection settings',
        error instanceof Error ? error : new Error(String(error)),
        { userId }
      );
      return c.json({ error: 'Failed to save settings' }, 500);
    }
  });

  /**
   * DELETE /
   * Delete MCP connection settings.
   */
  router.delete('/', async (c) => {
    const userId = getUserId(c);
    if (!userId) {
      return c.json({ error: 'User ID not found' }, 401);
    }

    try {
      await docClient.send(
        new DeleteCommand({
          TableName: TABLE_NAME,
          Key: { userId },
        })
      );

      logger.info('MCP connection settings deleted', { userId });

      return c.json({
        success: true,
        message: 'Settings deleted successfully',
      });
    } catch (error) {
      logger.error(
        'Failed to delete MCP connection settings',
        error instanceof Error ? error : new Error(String(error)),
        { userId }
      );
      return c.json({ error: 'Failed to delete settings' }, 500);
    }
  });

  return router;
}
