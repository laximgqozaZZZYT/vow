/**
 * API Key Authentication Middleware for Hono
 *
 * Provides API key validation for widget endpoints.
 * Extracts the X-API-Key header and validates it using the ApiKeyService.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */
import type { Context, MiddlewareHandler } from 'hono';
/**
 * Error codes for API key authentication failures.
 */
export declare const ApiKeyAuthErrorCodes: {
    readonly MISSING_API_KEY: "MISSING_API_KEY";
    readonly INVALID_API_KEY: "INVALID_API_KEY";
    readonly API_KEY_NOT_FOUND: "API_KEY_NOT_FOUND";
};
/**
 * Error messages for API key authentication failures.
 */
export declare const ApiKeyAuthErrorMessages: {
    readonly MISSING_API_KEY: "API key is required";
    readonly INVALID_API_KEY: "Invalid API key format";
    readonly API_KEY_NOT_FOUND: "API key not found";
};
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
export declare function apiKeyAuthMiddleware(): MiddlewareHandler;
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
export declare function getApiKeyUserId(c: Context): string;
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
export declare function getApiKeyId(c: Context): string;
//# sourceMappingURL=apiKeyAuth.d.ts.map