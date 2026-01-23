/**
 * API Key Authentication Middleware for Hono
 *
 * Provides API key validation for widget endpoints.
 * Extracts the X-API-Key header and validates it using the ApiKeyService.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */

import type { Context, Next, MiddlewareHandler } from 'hono';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ApiKeyService } from '../services/apiKeyService.js';
import { ApiKeyRepository } from '../repositories/apiKeyRepository.js';
import { getSettings, type Settings } from '../config.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('middleware.apiKeyAuth');

/**
 * Header name for API key authentication.
 */
const API_KEY_HEADER = 'X-API-Key';

/**
 * Error codes for API key authentication failures.
 */
export const ApiKeyAuthErrorCodes = {
  MISSING_API_KEY: 'MISSING_API_KEY',
  INVALID_API_KEY: 'INVALID_API_KEY',
  API_KEY_NOT_FOUND: 'API_KEY_NOT_FOUND',
} as const;

/**
 * Error messages for API key authentication failures.
 */
export const ApiKeyAuthErrorMessages = {
  MISSING_API_KEY: 'API key is required',
  INVALID_API_KEY: 'Invalid API key format',
  API_KEY_NOT_FOUND: 'API key not found',
} as const;

/**
 * Context variables set by the API key auth middleware.
 */
export interface ApiKeyAuthContext {
  /** User ID associated with the API key */
  apiKeyUserId: string;
  /** Unique identifier of the API key */
  apiKeyId: string;
}

/**
 * Get Supabase client instance.
 *
 * Creates a Supabase client using the service role key for server-side operations.
 *
 * @param settings - Application settings.
 * @returns Supabase client instance.
 * @throws Error if Supabase is not configured.
 */
function getSupabaseClient(settings: Settings): SupabaseClient {
  if (!settings.supabaseUrl || !settings.supabaseAnonKey) {
    throw new Error('Supabase is not configured');
  }
  return createClient(settings.supabaseUrl, settings.supabaseAnonKey);
}

/**
 * Minimum length for a valid API key.
 * API keys are 64 hex characters (32 bytes).
 */
const MIN_API_KEY_LENGTH = 64;

/**
 * Validate API key format.
 *
 * API keys should be 64 hex characters (32 bytes).
 *
 * @param key - The API key to validate.
 * @returns True if the key format is valid, false otherwise.
 */
function isValidApiKeyFormat(key: string): boolean {
  // API keys are 64 hex characters
  if (key.length !== MIN_API_KEY_LENGTH) {
    return false;
  }
  // Check if it's a valid hex string
  return /^[a-f0-9]+$/i.test(key);
}

/**
 * API Key Authentication Middleware for Hono.
 *
 * Validates API keys from the X-API-Key header and attaches
 * user information to context variables.
 *
 * This middleware:
 * 1. Extracts the API key from the X-API-Key header
 * 2. Validates the key format
 * 3. Validates the key against the database using ApiKeyService
 * 4. Sets apiKeyUserId and apiKeyId in the context
 * 5. Updates the last used timestamp for the key
 *
 * Requirements:
 * - 2.1: Authenticate request and associate with key's owner
 * - 2.2: Return 401 for invalid or revoked API key
 * - 2.3: Return 401 for missing API key
 * - 2.4: Validate by comparing hash of provided key against stored hashes
 */
export function apiKeyAuthMiddleware(): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    // Skip authentication for OPTIONS requests (CORS preflight)
    if (c.req.method === 'OPTIONS') {
      logger.debug('Skipping API key auth for OPTIONS preflight request');
      return next();
    }

    // Extract API key from header
    const apiKey = c.req.header(API_KEY_HEADER);

    // Check if API key is present
    // Requirements: 2.3 - Return 401 for missing API key
    if (!apiKey) {
      logger.info('Missing API key header');
      return c.json(
        {
          error: ApiKeyAuthErrorCodes.MISSING_API_KEY,
          message: ApiKeyAuthErrorMessages.MISSING_API_KEY,
        },
        401
      );
    }

    // Validate API key format
    // Requirements: 2.2 - Return 401 for invalid API key
    if (!isValidApiKeyFormat(apiKey)) {
      logger.info('Invalid API key format', { keyLength: apiKey.length });
      return c.json(
        {
          error: ApiKeyAuthErrorCodes.INVALID_API_KEY,
          message: ApiKeyAuthErrorMessages.INVALID_API_KEY,
        },
        401
      );
    }

    // Create service instances
    const settings = getSettings();
    const supabase = getSupabaseClient(settings);
    const apiKeyRepo = new ApiKeyRepository(supabase);
    const apiKeyService = new ApiKeyService(apiKeyRepo);

    try {
      // Validate the API key
      // Requirements: 2.1, 2.4 - Validate by comparing hash
      const result = await apiKeyService.validateKey(apiKey);

      if (!result) {
        // Key not found or revoked
        // Requirements: 2.2 - Return 401 for invalid or revoked API key
        logger.info('API key not found or revoked');
        return c.json(
          {
            error: ApiKeyAuthErrorCodes.API_KEY_NOT_FOUND,
            message: ApiKeyAuthErrorMessages.API_KEY_NOT_FOUND,
          },
          401
        );
      }

      // Set context variables for downstream handlers
      c.set('apiKeyUserId', result.userId);
      c.set('apiKeyId', result.keyId);

      logger.debug('API key authenticated successfully', {
        userId: result.userId,
        keyId: result.keyId,
      });

      // Update last used timestamp (fire and forget)
      apiKeyService.updateLastUsed(result.keyId).catch((error) => {
        logger.error('Failed to update API key last used timestamp', error as Error, {
          keyId: result.keyId,
        });
      });

      return next();
    } catch (error) {
      logger.error('Error validating API key', error as Error);
      return c.json(
        {
          error: ApiKeyAuthErrorCodes.INVALID_API_KEY,
          message: ApiKeyAuthErrorMessages.INVALID_API_KEY,
        },
        401
      );
    }
  };
}

/**
 * Get the authenticated user ID from API key context.
 *
 * This helper function retrieves the user ID that was set by the
 * apiKeyAuthMiddleware. It should only be called in routes that
 * are protected by the middleware.
 *
 * @param c - The Hono context.
 * @returns The user ID associated with the API key.
 * @throws Error if the user ID is not found in context.
 */
export function getApiKeyUserId(c: Context): string {
  const userId = c.get('apiKeyUserId') as string | undefined;
  if (!userId) {
    throw new Error('API key user ID not found in context. Ensure apiKeyAuthMiddleware is applied.');
  }
  return userId;
}

/**
 * Get the API key ID from context.
 *
 * This helper function retrieves the API key ID that was set by the
 * apiKeyAuthMiddleware. It should only be called in routes that
 * are protected by the middleware.
 *
 * @param c - The Hono context.
 * @returns The API key ID.
 * @throws Error if the API key ID is not found in context.
 */
export function getApiKeyId(c: Context): string {
  const keyId = c.get('apiKeyId') as string | undefined;
  if (!keyId) {
    throw new Error('API key ID not found in context. Ensure apiKeyAuthMiddleware is applied.');
  }
  return keyId;
}
