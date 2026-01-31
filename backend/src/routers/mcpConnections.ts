/**
 * MCP Connections Router
 *
 * REST endpoints for managing MCP (Multi-Agent) server connection settings.
 * Settings are stored per-user in DynamoDB for secure, persistent storage.
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

// Validation schema for MCP connection settings
const mcpConnectionSchema = z.object({
  enabled: z.boolean().default(false),
  serverUrl: z.string().url().optional().or(z.literal('')),
  serverToken: z.string().optional().or(z.literal('')),
  connectionMode: z.enum(['direct', 'tunnel']).default('tunnel'),
  tunnelProvider: z.enum(['tailscale', 'ngrok', 'cloudflare', 'other']).optional(),
  autoConnect: z.boolean().default(true),
  notifyOnTaskComplete: z.boolean().default(true),
  notifyOnAgentOffline: z.boolean().default(true),
});

type McpConnectionSettings = z.infer<typeof mcpConnectionSchema>;

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
          data: {
            enabled: false,
            serverUrl: '',
            serverToken: '',
            connectionMode: 'tunnel',
            tunnelProvider: 'tailscale',
            autoConnect: true,
            notifyOnTaskComplete: true,
            notifyOnAgentOffline: true,
          },
        });
      }

      // Don't return the full token for security
      const settings = result.Item as McpConnectionSettings & { userId: string };
      const { userId: _, serverToken, ...safeSettings } = settings;

      return c.json({
        success: true,
        data: {
          ...safeSettings,
          serverToken: serverToken ? '********' : '',
          hasToken: !!serverToken,
        },
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

      // If token is masked (********), keep the existing token
      let finalToken = settings.serverToken;
      if (settings.serverToken === '********') {
        const existing = await docClient.send(
          new GetCommand({
            TableName: TABLE_NAME,
            Key: { userId },
          })
        );
        finalToken = (existing.Item?.['serverToken'] as string) || '';
      }

      const item = {
        userId,
        ...settings,
        serverToken: finalToken,
        updatedAt: new Date().toISOString(),
      };

      await docClient.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: item,
        })
      );

      logger.info('MCP connection settings saved', { userId });

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
