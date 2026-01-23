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
/**
 * Create the API Key Management Router.
 *
 * This router provides endpoints for managing API keys used by embeddable
 * dashboard widgets. All routes require JWT authentication.
 *
 * @returns Configured Hono router instance
 */
export declare function createApiKeyRouter(): Hono;
export declare const apiKeyRouter: Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
//# sourceMappingURL=apiKeys.d.ts.map