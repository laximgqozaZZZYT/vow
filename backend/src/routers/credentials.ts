/**
 * Credentials Router
 *
 * API endpoints for managing user API credentials (OpenAI, etc.)
 * All credentials are encrypted at rest using AES-256-GCM.
 *
 * Endpoints:
 * - GET /api/credentials/:type - Check if credential exists
 * - POST /api/credentials/:type - Save/update credential
 * - DELETE /api/credentials/:type - Delete credential
 *
 * @module routers/credentials
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { AuthContext } from '../middleware/auth.js';
import { getLogger } from '../utils/logger.js';
import {
  getCredentialsStore,
  type CredentialType,
} from '../services/credentials-store.js';

const logger = getLogger('credentialsRouter');

// =============================================================================
// Request Schemas
// =============================================================================

/** Valid credential types for URL parameter validation */
const VALID_CREDENTIAL_TYPES = ['openai', 'anthropic', 'gemini', 'codex', 'custom'] as const;

/**
 * Save credential request body
 */
const SaveCredentialSchema = z.object({
  apiKey: z.string().min(1).max(500)
    .describe('API key (will be encrypted)'),
  model: z.string().max(100).optional()
    .describe('Model name (e.g., gpt-4o)'),
  endpoint: z.string().url().optional()
    .describe('Custom API endpoint'),
});

// =============================================================================
// Router
// =============================================================================

const credentialsRouter = new Hono<{ Variables: AuthContext }>();

/**
 * GET /api/credentials/:type
 *
 * Check if a credential exists for the user.
 * Returns metadata only, never returns the actual API key.
 */
credentialsRouter.get(
  '/:type',
  async (c: Context<{ Variables: AuthContext }>) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const type = c.req.param('type') as CredentialType;
    const validTypes: readonly string[] = VALID_CREDENTIAL_TYPES;

    if (!validTypes.includes(type)) {
      return c.json({ error: 'Invalid credential type' }, 400);
    }

    const userId = user.sub;

    logger.info('Credential check request', { userId, type });

    try {
      const store = getCredentialsStore();
      const credential = await store.getCredential(userId, type);

      if (!credential) {
        return c.json({
          exists: false,
          type,
        });
      }

      // Return metadata only, not the actual API key
      return c.json({
        exists: true,
        type,
        model: credential.model,
        endpoint: credential.endpoint,
        updatedAt: credential.updatedAt,
        // Show masked API key for confirmation
        maskedKey: `${credential.apiKey.slice(0, 7)}...${credential.apiKey.slice(-4)}`,
      });
    } catch (error) {
      logger.error('Failed to check credential', error as Error, { userId, type });
      return c.json(
        { error: 'Failed to check credential' },
        500
      );
    }
  }
);

/**
 * POST /api/credentials/:type
 *
 * Save or update a credential.
 * The API key is encrypted before storage.
 */
credentialsRouter.post(
  '/:type',
  zValidator('json', SaveCredentialSchema),
  async (c: Context<{ Variables: AuthContext }>) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const type = c.req.param('type') as CredentialType;
    const validTypes: readonly string[] = VALID_CREDENTIAL_TYPES;

    if (!validTypes.includes(type)) {
      return c.json({ error: 'Invalid credential type' }, 400);
    }

    const body = c.req.valid('json' as never) as z.infer<typeof SaveCredentialSchema>;
    const userId = user.sub;

    logger.info('Credential save request', { userId, type });

    try {
      const store = getCredentialsStore();

      // Build input object with only defined properties
      const input: { apiKey: string; model?: string; endpoint?: string } = {
        apiKey: body.apiKey,
      };
      if (body.model !== undefined) input.model = body.model;
      if (body.endpoint !== undefined) input.endpoint = body.endpoint;

      await store.saveCredential(userId, type, input);

      logger.info('Credential saved successfully', { userId, type });

      return c.json({
        success: true,
        type,
        message: 'Credential saved (encrypted)',
        maskedKey: `${body.apiKey.slice(0, 7)}...${body.apiKey.slice(-4)}`,
      });
    } catch (error) {
      logger.error('Failed to save credential', error as Error, { userId, type });
      return c.json(
        { error: 'Failed to save credential' },
        500
      );
    }
  }
);

/**
 * DELETE /api/credentials/:type
 *
 * Delete a credential.
 */
credentialsRouter.delete(
  '/:type',
  async (c: Context<{ Variables: AuthContext }>) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const type = c.req.param('type') as CredentialType;
    const validTypes: readonly string[] = VALID_CREDENTIAL_TYPES;

    if (!validTypes.includes(type)) {
      return c.json({ error: 'Invalid credential type' }, 400);
    }

    const userId = user.sub;

    logger.info('Credential delete request', { userId, type });

    try {
      const store = getCredentialsStore();
      await store.deleteCredential(userId, type);

      logger.info('Credential deleted successfully', { userId, type });

      return c.json({
        success: true,
        type,
        message: 'Credential deleted',
      });
    } catch (error) {
      logger.error('Failed to delete credential', error as Error, { userId, type });
      return c.json(
        { error: 'Failed to delete credential' },
        500
      );
    }
  }
);

// =============================================================================
// Factory
// =============================================================================

/**
 * Create the credentials router
 */
export function createCredentialsRouter(): Hono<{ Variables: AuthContext }> {
  return credentialsRouter;
}

export { credentialsRouter };
