/**
 * API Key Management Router
 *
 * REST endpoints for managing API keys used by embeddable dashboard widgets.
 * All routes require JWT authentication (user must be logged in).
 *
 * Endpoints:
 * - GET /api/api-keys - List user's API keys
 * - POST /api/api-keys - Create new API key
 * - DELETE /api/api-keys/:keyId - Revoke an API key
 *
 * Requirements: 1.1, 1.3, 1.4
 */
import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { jwtAuthMiddleware, getUserId } from '../middleware/auth.js';
import { getSettings } from '../config.js';
import { getLogger } from '../utils/logger.js';
import { ApiKeyRepository } from '../repositories/apiKeyRepository.js';
import { ApiKeyService, MaxKeysReachedError } from '../services/apiKeyService.js';
import { createApiKeyRequestSchema } from '../schemas/apiKey.js';
const logger = getLogger('routers.apiKeys');
/**
 * Get Supabase client instance.
 *
 * Creates a Supabase client using the anon key for server-side operations.
 *
 * @param settings - Application settings.
 * @returns Supabase client instance.
 * @throws Error if Supabase is not configured.
 */
function getSupabaseClient(settings) {
    if (!settings.supabaseUrl || !settings.supabaseAnonKey) {
        throw new Error('Supabase is not configured');
    }
    return createClient(settings.supabaseUrl, settings.supabaseAnonKey);
}
/**
 * Create an ApiKeyService instance with the repository.
 *
 * @param supabase - Supabase client instance.
 * @returns ApiKeyService instance.
 */
function createApiKeyService(supabase) {
    const apiKeyRepo = new ApiKeyRepository(supabase);
    return new ApiKeyService(apiKeyRepo);
}
/**
 * Create the API Key Management Router.
 *
 * This router provides endpoints for managing API keys used by embeddable
 * dashboard widgets. All routes require JWT authentication.
 *
 * @returns Configured Hono router instance
 */
export function createApiKeyRouter() {
    const router = new Hono();
    const settings = getSettings();
    const supabase = getSupabaseClient(settings);
    // ---------------------------------------------------------------------------
    // JWT Authentication Middleware
    // ---------------------------------------------------------------------------
    // All routes require user to be authenticated via JWT
    router.use('*', jwtAuthMiddleware());
    // ---------------------------------------------------------------------------
    // API Key Management Endpoints
    // ---------------------------------------------------------------------------
    /**
     * GET /
     *
     * List all active API keys for the authenticated user.
     *
     * Requirements: 1.3
     * - Return list of active keys with masked values and creation dates
     *
     * @returns Array of API key objects with masked key values
     */
    router.get('/', async (c) => {
        const userId = getUserId(c);
        logger.info('List API keys request', { userId });
        try {
            const apiKeyService = createApiKeyService(supabase);
            const keys = await apiKeyService.listKeys(userId);
            logger.info('List API keys request successful', {
                userId,
                keyCount: keys.length,
            });
            return c.json({ keys });
        }
        catch (error) {
            logger.error('List API keys request failed', error instanceof Error ? error : new Error(String(error)), { userId });
            return c.json({
                error: 'INTERNAL_ERROR',
                message: 'Failed to list API keys',
            }, 500);
        }
    });
    /**
     * POST /
     *
     * Create a new API key for the authenticated user.
     *
     * Requirements: 1.1
     * - Generate unique, cryptographically secure API key
     * - Return full key only once at creation time
     *
     * Request body:
     * - name: string (1-100 characters) - User-provided name for the key
     *
     * @returns Created API key object including the full key (only shown once)
     */
    router.post('/', async (c) => {
        const userId = getUserId(c);
        logger.info('Create API key request', { userId });
        try {
            // Parse and validate request body
            const body = await c.req.json().catch(() => ({}));
            const parseResult = createApiKeyRequestSchema.safeParse(body);
            if (!parseResult.success) {
                logger.warning('Invalid create API key request body', {
                    userId,
                    errors: parseResult.error.errors,
                });
                return c.json({
                    error: 'VALIDATION_ERROR',
                    message: 'Name is required and must be 1-100 characters',
                }, 400);
            }
            const { name } = parseResult.data;
            const apiKeyService = createApiKeyService(supabase);
            const createdKey = await apiKeyService.createKey(userId, name);
            logger.info('Create API key request successful', {
                userId,
                keyId: createdKey.id,
                keyPrefix: createdKey.keyPrefix,
            });
            return c.json(createdKey, 201);
        }
        catch (error) {
            // Handle max keys reached error
            if (error instanceof MaxKeysReachedError) {
                logger.warning('Max API keys reached', { userId });
                return c.json({
                    error: 'MAX_KEYS_REACHED',
                    message: error.message,
                }, 400);
            }
            logger.error('Create API key request failed', error instanceof Error ? error : new Error(String(error)), { userId });
            return c.json({
                error: 'INTERNAL_ERROR',
                message: 'Failed to create API key',
            }, 500);
        }
    });
    /**
     * DELETE /:keyId
     *
     * Revoke an API key for the authenticated user.
     *
     * Requirements: 1.4
     * - Mark key as inactive and reject future requests using it
     * - Only the owner can revoke their own keys
     *
     * @param keyId - UUID of the API key to revoke
     * @returns Success message or error
     */
    router.delete('/:keyId', async (c) => {
        const userId = getUserId(c);
        const keyId = c.req.param('keyId');
        logger.info('Revoke API key request', { userId, keyId });
        try {
            const apiKeyService = createApiKeyService(supabase);
            const revoked = await apiKeyService.revokeKey(userId, keyId);
            if (!revoked) {
                logger.warning('API key not found or not owned by user', {
                    userId,
                    keyId,
                });
                return c.json({
                    error: 'API_KEY_NOT_FOUND',
                    message: 'API key not found',
                }, 404);
            }
            logger.info('Revoke API key request successful', {
                userId,
                keyId,
            });
            return c.json({ message: 'API key revoked successfully' });
        }
        catch (error) {
            logger.error('Revoke API key request failed', error instanceof Error ? error : new Error(String(error)), { userId, keyId });
            return c.json({
                error: 'INTERNAL_ERROR',
                message: 'Failed to revoke API key',
            }, 500);
        }
    });
    logger.info('API Key router initialized');
    return router;
}
// Export default router instance
export const apiKeyRouter = createApiKeyRouter();
//# sourceMappingURL=apiKeys.js.map