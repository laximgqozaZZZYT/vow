/**
 * CLI Authentication Middleware for Hono
 *
 * Provides hybrid authentication supporting both:
 * - API Key authentication (64-char hex via X-API-Key header)
 * - JWT authentication (via Authorization: Bearer header)
 *
 * This middleware maintains backward compatibility with existing API key
 * authentication while supporting the new JWT-based CLI tokens.
 */

import type { Context, Next, MiddlewareHandler } from 'hono';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ApiKeyService } from '../services/apiKeyService.js';
import { ApiKeyRepository } from '../repositories/apiKeyRepository.js';
import { CliTokenService } from '../services/cliTokenService.js';
import { getSettings, type Settings } from '../config.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('middleware.cliAuth');

/**
 * Header names for authentication.
 */
const API_KEY_HEADER = 'X-API-Key';
const AUTH_HEADER = 'Authorization';
const BEARER_PREFIX = 'Bearer ';

/**
 * Error codes for CLI authentication failures.
 */
export const CliAuthErrorCodes = {
  MISSING_AUTH: 'MISSING_AUTH',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_API_KEY: 'INVALID_API_KEY',
  API_KEY_NOT_FOUND: 'API_KEY_NOT_FOUND',
  INSUFFICIENT_SCOPE: 'INSUFFICIENT_SCOPE',
} as const;

/**
 * Error messages for CLI authentication failures.
 */
export const CliAuthErrorMessages = {
  MISSING_AUTH: 'Authentication required. Provide X-API-Key header or Authorization: Bearer token.',
  INVALID_TOKEN: 'Invalid CLI token',
  TOKEN_EXPIRED: 'CLI token has expired. Please refresh your token.',
  INVALID_API_KEY: 'Invalid API key format',
  API_KEY_NOT_FOUND: 'API key not found or revoked',
  INSUFFICIENT_SCOPE: 'Token does not have required scope',
} as const;

/**
 * Context variables set by the CLI auth middleware.
 */
export interface CliAuthContext {
  /** User ID associated with the authentication */
  cliUserId: string;
  /** Authentication method used */
  cliAuthMethod: 'api_key' | 'jwt';
  /** API key ID (only for api_key auth) */
  cliApiKeyId?: string;
  /** CLI token ID (only for jwt auth) */
  cliTokenId?: string;
  /** Scopes (only for jwt auth) */
  cliScopes?: string[];
}

/**
 * Get Supabase client instance.
 */
function getSupabaseClient(settings: Settings): SupabaseClient {
  if (!settings.supabaseUrl || !settings.supabaseAnonKey) {
    throw new Error('Supabase is not configured');
  }
  return createClient(settings.supabaseUrl, settings.supabaseAnonKey);
}

/**
 * Validate API key format (64 hex characters).
 */
function isValidApiKeyFormat(key: string): boolean {
  if (key.length !== 64) {
    return false;
  }
  return /^[a-f0-9]+$/i.test(key);
}

/**
 * Check if a token is a JWT (starts with base64url-encoded JSON header).
 */
function isJwtToken(token: string): boolean {
  // JWTs start with 'eyJ' (base64url encoded '{"')
  return token.startsWith('eyJ');
}

/**
 * CLI Authentication Middleware for Hono.
 *
 * Supports two authentication methods:
 * 1. API Key: X-API-Key header with 64-char hex string
 * 2. JWT: Authorization: Bearer <jwt> header with CLI access token
 *
 * The middleware sets `cliUserId` and other context variables for downstream handlers.
 *
 * @param options - Optional configuration
 * @param options.requiredScopes - Scopes required for JWT authentication
 */
export function cliAuthMiddleware(options?: {
  requiredScopes?: string[];
}): MiddlewareHandler {
  const requiredScopes = options?.requiredScopes ?? [];

  return async (c: Context, next: Next) => {
    // Skip authentication for OPTIONS requests (CORS preflight)
    if (c.req.method === 'OPTIONS') {
      logger.debug('Skipping CLI auth for OPTIONS preflight request');
      return next();
    }

    const settings = getSettings();
    const supabase = getSupabaseClient(settings);

    // Check for API Key first (X-API-Key header)
    const apiKey = c.req.header(API_KEY_HEADER);
    if (apiKey) {
      return handleApiKeyAuth(c, next, apiKey, supabase);
    }

    // Check for Bearer token (Authorization header)
    const authHeader = c.req.header(AUTH_HEADER);
    if (authHeader?.startsWith(BEARER_PREFIX)) {
      const token = authHeader.slice(BEARER_PREFIX.length);

      // Determine if it's a JWT or an API key passed via Bearer
      if (isJwtToken(token)) {
        return handleJwtAuth(c, next, token, supabase, requiredScopes);
      }

      // Some clients might pass API key via Bearer - support this too
      if (isValidApiKeyFormat(token)) {
        return handleApiKeyAuth(c, next, token, supabase);
      }
    }

    // No valid authentication found
    logger.info('No authentication provided');
    return c.json(
      {
        error: CliAuthErrorCodes.MISSING_AUTH,
        message: CliAuthErrorMessages.MISSING_AUTH,
      },
      401
    );
  };
}

/**
 * Handle API Key authentication.
 */
async function handleApiKeyAuth(
  c: Context,
  next: Next,
  apiKey: string,
  supabase: SupabaseClient
): Promise<Response | void> {
  // Validate format
  if (!isValidApiKeyFormat(apiKey)) {
    logger.info('Invalid API key format', { keyLength: apiKey.length });
    return c.json(
      {
        error: CliAuthErrorCodes.INVALID_API_KEY,
        message: CliAuthErrorMessages.INVALID_API_KEY,
      },
      401
    );
  }

  const apiKeyRepo = new ApiKeyRepository(supabase);
  const apiKeyService = new ApiKeyService(apiKeyRepo);

  try {
    const result = await apiKeyService.validateKey(apiKey);

    if (!result) {
      logger.info('API key not found or revoked');
      return c.json(
        {
          error: CliAuthErrorCodes.API_KEY_NOT_FOUND,
          message: CliAuthErrorMessages.API_KEY_NOT_FOUND,
        },
        401
      );
    }

    // Set context variables
    c.set('cliUserId', result.userId);
    c.set('cliAuthMethod', 'api_key');
    c.set('cliApiKeyId', result.keyId);
    // Also set userId for compatibility with existing code
    c.set('userId', result.userId);

    logger.debug('API key authenticated successfully', {
      userId: result.userId,
      keyId: result.keyId,
    });

    // Update last used timestamp (fire and forget)
    apiKeyService.updateLastUsed(result.keyId).catch((error) => {
      logger.warning('Failed to update API key last used timestamp', { error });
    });

    return next();
  } catch (error) {
    logger.error('Error validating API key', error as Error);
    return c.json(
      {
        error: CliAuthErrorCodes.INVALID_API_KEY,
        message: CliAuthErrorMessages.INVALID_API_KEY,
      },
      401
    );
  }
}

/**
 * Handle JWT authentication.
 */
async function handleJwtAuth(
  c: Context,
  next: Next,
  token: string,
  supabase: SupabaseClient,
  requiredScopes: string[]
): Promise<Response | void> {
  const cliTokenService = new CliTokenService(supabase);

  try {
    const payload = await cliTokenService.verifyAccessToken(token);

    // Check required scopes
    if (requiredScopes.length > 0) {
      const hasRequiredScopes = requiredScopes.every(
        (scope) => payload.scopes.includes(scope)
      );
      if (!hasRequiredScopes) {
        logger.info('Insufficient scopes', {
          required: requiredScopes,
          provided: payload.scopes,
        });
        return c.json(
          {
            error: CliAuthErrorCodes.INSUFFICIENT_SCOPE,
            message: CliAuthErrorMessages.INSUFFICIENT_SCOPE,
          },
          403
        );
      }
    }

    // Set context variables
    c.set('cliUserId', payload.sub);
    c.set('cliAuthMethod', 'jwt');
    c.set('cliTokenId', payload.tid);
    c.set('cliScopes', payload.scopes);
    // Also set userId for compatibility with existing code
    c.set('userId', payload.sub);

    logger.debug('JWT authenticated successfully', {
      userId: payload.sub,
      tokenId: payload.tid,
      scopes: payload.scopes,
    });

    return next();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Check for token expiration
    if (errorMessage.includes('expired')) {
      logger.info('CLI token expired');
      return c.json(
        {
          error: CliAuthErrorCodes.TOKEN_EXPIRED,
          message: CliAuthErrorMessages.TOKEN_EXPIRED,
        },
        401
      );
    }

    logger.info('Invalid CLI token', { error: errorMessage });
    return c.json(
      {
        error: CliAuthErrorCodes.INVALID_TOKEN,
        message: CliAuthErrorMessages.INVALID_TOKEN,
      },
      401
    );
  }
}

/**
 * Get the authenticated CLI user ID from context.
 *
 * @param c - The Hono context.
 * @returns The user ID.
 * @throws Error if user ID is not found.
 */
export function getCliUserId(c: Context): string {
  const userId = c.get('cliUserId') as string | undefined;
  if (!userId) {
    throw new Error('CLI user ID not found in context. Ensure cliAuthMiddleware is applied.');
  }
  return userId;
}

/**
 * Get the authentication method used.
 *
 * @param c - The Hono context.
 * @returns 'api_key' or 'jwt'.
 */
export function getCliAuthMethod(c: Context): 'api_key' | 'jwt' {
  return (c.get('cliAuthMethod') as 'api_key' | 'jwt') ?? 'api_key';
}

/**
 * Get the CLI token scopes (only available for JWT auth).
 *
 * @param c - The Hono context.
 * @returns Array of scopes or empty array.
 */
export function getCliScopes(c: Context): string[] {
  return (c.get('cliScopes') as string[]) ?? [];
}

/**
 * Check if the authenticated user has a specific scope.
 *
 * @param c - The Hono context.
 * @param scope - The scope to check.
 * @returns True if the user has the scope, false otherwise.
 */
export function hasCliScope(c: Context, scope: string): boolean {
  const authMethod = getCliAuthMethod(c);
  // API key auth has full access (no scope restrictions)
  if (authMethod === 'api_key') {
    return true;
  }
  const scopes = getCliScopes(c);
  return scopes.includes(scope);
}
