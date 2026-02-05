/**
 * CLI Token Management Router
 *
 * REST endpoints for managing CLI JWT tokens.
 * Token creation/listing/revocation require JWT authentication (user must be logged in via web UI).
 * Token refresh endpoint uses the refresh token itself for authentication.
 *
 * Endpoints:
 * - GET /api/cli-tokens - List user's CLI tokens
 * - POST /api/cli-tokens - Create new CLI token
 * - DELETE /api/cli-tokens/:tokenId - Revoke a CLI token
 * - POST /api/cli-tokens/refresh - Refresh access token (no auth required, uses refresh token)
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { jwtAuthMiddleware, getUserId } from '../middleware/auth.js';
import { getSettings, type Settings } from '../config.js';
import { getLogger } from '../utils/logger.js';
import { CliTokenService } from '../services/cliTokenService.js';
import {
  createCliTokenRequestSchema,
  refreshTokenRequestSchema,
  extendCliTokenRequestSchema,
} from '../schemas/cliToken.js';

const logger = getLogger('routers.cliTokens');

/**
 * Get Supabase client instance with anon key (for public endpoints).
 */
function getSupabaseClientAnon(settings: Settings): SupabaseClient {
  if (!settings.supabaseUrl || !settings.supabaseAnonKey) {
    throw new Error('Supabase is not configured');
  }
  return createClient(settings.supabaseUrl, settings.supabaseAnonKey);
}

/**
 * Get Supabase client instance with service role key (bypasses RLS).
 */
function getSupabaseClientServiceRole(settings: Settings): SupabaseClient {
  if (!settings.supabaseUrl || !settings.supabaseServiceRoleKey) {
    throw new Error('Supabase service role is not configured');
  }
  return createClient(settings.supabaseUrl, settings.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Get Supabase client from context (service role) or create new one.
 */
function getSupabaseClientFromContext(c: Context, settings: Settings): SupabaseClient {
  // Try to get service role client from auth middleware context
  const contextSupabase = c.get('supabase') as SupabaseClient | undefined;
  if (contextSupabase) {
    return contextSupabase;
  }
  // Fallback to service role client
  return getSupabaseClientServiceRole(settings);
}

/**
 * Create a CliTokenService instance.
 */
function createCliTokenService(supabase: SupabaseClient): CliTokenService {
  return new CliTokenService(supabase);
}

/**
 * Create the CLI Token Management Router.
 *
 * This router provides endpoints for managing CLI JWT tokens.
 * Most routes require JWT authentication (logged in via web UI).
 *
 * @returns Configured Hono router instance
 */
export function createCliTokenRouter(): Hono {
  const router = new Hono();
  const settings = getSettings();
  // Use anon key client for public /refresh endpoint
  const supabaseAnon = getSupabaseClientAnon(settings);

  // ---------------------------------------------------------------------------
  // Public Endpoint (uses refresh token for auth)
  // ---------------------------------------------------------------------------

  /**
   * POST /refresh
   *
   * Refresh an access token using a refresh token.
   * This endpoint does not require JWT authentication - the refresh token
   * itself serves as authentication.
   *
   * Request body:
   * - refreshToken: string - The refresh token
   *
   * @returns New access token and expiration
   */
  router.post('/refresh', async (c: Context) => {
    logger.info('Refresh CLI token request');

    try {
      const body = await c.req.json().catch(() => ({}));
      const parseResult = refreshTokenRequestSchema.safeParse(body);

      if (!parseResult.success) {
        logger.warning('Invalid refresh token request body', {
          errors: parseResult.error.errors,
        });
        return c.json(
          {
            error: 'VALIDATION_ERROR',
            message: 'refreshToken is required',
          },
          400
        );
      }

      const { refreshToken } = parseResult.data;
      const cliTokenService = createCliTokenService(supabaseAnon);
      const result = await cliTokenService.refreshAccessToken(refreshToken);

      logger.info('CLI token refreshed successfully');

      return c.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      if (message.includes('Invalid') || message.includes('expired')) {
        logger.warning('Invalid or expired refresh token');
        return c.json(
          {
            error: 'INVALID_REFRESH_TOKEN',
            message: 'Invalid or expired refresh token',
          },
          401
        );
      }

      logger.error(
        'Refresh CLI token request failed',
        error instanceof Error ? error : new Error(String(error))
      );

      return c.json(
        {
          error: 'INTERNAL_ERROR',
          message: 'Failed to refresh token',
        },
        500
      );
    }
  });

  // ---------------------------------------------------------------------------
  // JWT Authentication Middleware for remaining routes
  // ---------------------------------------------------------------------------
  // All routes below require user to be authenticated via JWT (web UI login)
  router.use('*', jwtAuthMiddleware());

  // ---------------------------------------------------------------------------
  // CLI Token Management Endpoints
  // ---------------------------------------------------------------------------

  /**
   * GET /
   *
   * List all CLI tokens for the authenticated user.
   *
   * @returns Array of token objects (without sensitive data)
   */
  router.get('/', async (c: Context) => {
    const userId = getUserId(c);
    logger.info('List CLI tokens request', { userId });

    try {
      // Use service role client to bypass RLS
      const supabaseClient = getSupabaseClientFromContext(c, settings);
      const cliTokenService = createCliTokenService(supabaseClient);
      const tokens = await cliTokenService.listTokens(userId);

      logger.info('List CLI tokens request successful', {
        userId,
        tokenCount: tokens.length,
      });

      return c.json({ tokens });
    } catch (error) {
      logger.error(
        'List CLI tokens request failed',
        error instanceof Error ? error : new Error(String(error)),
        { userId }
      );

      return c.json(
        {
          error: 'INTERNAL_ERROR',
          message: 'Failed to list CLI tokens',
        },
        500
      );
    }
  });

  /**
   * POST /
   *
   * Create a new CLI token for the authenticated user.
   *
   * Request body:
   * - name: string (1-255 characters) - User-provided name for the token
   * - scopes: string[] (optional) - Allowed scopes (default: ['cli:read', 'cli:write'])
   *
   * @returns Created token including access token and refresh token (shown only once)
   */
  router.post('/', async (c: Context) => {
    const userId = getUserId(c);
    logger.info('Create CLI token request', { userId });

    try {
      const body = await c.req.json().catch(() => ({}));
      const parseResult = createCliTokenRequestSchema.safeParse(body);

      if (!parseResult.success) {
        logger.warning('Invalid create CLI token request body', {
          userId,
          errors: parseResult.error.errors,
        });
        return c.json(
          {
            error: 'VALIDATION_ERROR',
            message: 'Name is required and must be 1-255 characters',
          },
          400
        );
      }

      const { name, scopes, expirationDays } = parseResult.data;

      // Use service role client to bypass RLS
      const supabaseClient = getSupabaseClientFromContext(c, settings);
      const cliTokenService = createCliTokenService(supabaseClient);
      const createdToken = await cliTokenService.createToken(userId, name, scopes, expirationDays);

      logger.info('Create CLI token request successful', {
        userId,
        tokenId: createdToken.id,
        name,
        scopes,
      });

      return c.json(createdToken, 201);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      // Handle max tokens reached
      if (message.includes('Maximum number')) {
        logger.warning('Max CLI tokens reached', { userId });
        return c.json(
          {
            error: 'MAX_TOKENS_REACHED',
            message,
          },
          400
        );
      }

      logger.error(
        'Create CLI token request failed',
        error instanceof Error ? error : new Error(String(error)),
        { userId }
      );

      return c.json(
        {
          error: 'INTERNAL_ERROR',
          message: 'Failed to create CLI token',
        },
        500
      );
    }
  });

  /**
   * PATCH /:tokenId/extend
   *
   * Extend the expiration of a CLI token for the authenticated user.
   *
   * Request body:
   * - extensionDays: string (7, 30, 90, 180, or 365) - Extension period in days from now
   *
   * @param tokenId - UUID of the CLI token to extend
   * @returns Updated CLI token object
   */
  router.patch('/:tokenId/extend', async (c: Context) => {
    const userId = getUserId(c);
    const tokenId = c.req.param('tokenId');
    logger.info('Extend CLI token expiration request', { userId, tokenId });

    try {
      // Parse and validate request body
      const body = await c.req.json().catch(() => ({}));
      const parseResult = extendCliTokenRequestSchema.safeParse(body);

      if (!parseResult.success) {
        logger.warning('Invalid extend CLI token request body', {
          userId,
          tokenId,
          errors: parseResult.error.errors,
        });
        return c.json(
          {
            error: 'VALIDATION_ERROR',
            message: 'extensionDays is required (7, 30, 90, 180, or 365)',
          },
          400
        );
      }

      const { extensionDays } = parseResult.data;

      // Use service role client to bypass RLS
      const supabaseClient = getSupabaseClientFromContext(c, settings);
      const cliTokenService = createCliTokenService(supabaseClient);
      const updatedToken = await cliTokenService.extendExpiration(userId, tokenId, extensionDays);

      if (!updatedToken) {
        logger.warning('CLI token not found or not owned by user', {
          userId,
          tokenId,
        });
        return c.json(
          {
            error: 'TOKEN_NOT_FOUND',
            message: 'CLI token not found',
          },
          404
        );
      }

      logger.info('Extend CLI token expiration request successful', {
        userId,
        tokenId,
        extensionDays,
        newExpiresAt: updatedToken.expiresAt,
      });

      return c.json({ token: updatedToken });
    } catch (error) {
      logger.error(
        'Extend CLI token expiration request failed',
        error instanceof Error ? error : new Error(String(error)),
        { userId, tokenId }
      );

      return c.json(
        {
          error: 'INTERNAL_ERROR',
          message: 'Failed to extend CLI token expiration',
        },
        500
      );
    }
  });

  /**
   * DELETE /:tokenId
   *
   * Revoke a CLI token for the authenticated user.
   *
   * @param tokenId - UUID of the CLI token to revoke
   * @returns Success message or error
   */
  router.delete('/:tokenId', async (c: Context) => {
    const userId = getUserId(c);
    const tokenId = c.req.param('tokenId');
    logger.info('Revoke CLI token request', { userId, tokenId });

    try {
      // Use service role client to bypass RLS
      const supabaseClient = getSupabaseClientFromContext(c, settings);
      const cliTokenService = createCliTokenService(supabaseClient);
      const revoked = await cliTokenService.revokeToken(userId, tokenId);

      if (!revoked) {
        logger.warning('CLI token not found or not owned by user', {
          userId,
          tokenId,
        });
        return c.json(
          {
            error: 'TOKEN_NOT_FOUND',
            message: 'CLI token not found',
          },
          404
        );
      }

      logger.info('Revoke CLI token request successful', {
        userId,
        tokenId,
      });

      return c.json({ message: 'CLI token revoked successfully' });
    } catch (error) {
      logger.error(
        'Revoke CLI token request failed',
        error instanceof Error ? error : new Error(String(error)),
        { userId, tokenId }
      );

      return c.json(
        {
          error: 'INTERNAL_ERROR',
          message: 'Failed to revoke CLI token',
        },
        500
      );
    }
  });

  logger.info('CLI Token router initialized');

  return router;
}

// Export default router instance
export const cliTokenRouter = createCliTokenRouter();
