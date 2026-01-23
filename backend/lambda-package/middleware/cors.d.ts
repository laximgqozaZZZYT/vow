/**
 * CORS Middleware for Hono
 *
 * Configures Cross-Origin Resource Sharing (CORS) for the API.
 * Supports the same configuration as the Python backend.
 *
 * Requirements: 10.5
 */
import type { MiddlewareHandler, Context } from 'hono';
/**
 * CORS configuration options.
 */
export interface CorsOptions {
    /**
     * Allowed origins. Can be:
     * - A string (single origin)
     * - An array of strings (multiple origins)
     * - A function that returns true/false for dynamic origin validation
     * - '*' for all origins (not recommended for production with credentials)
     */
    origins?: string | string[] | ((origin: string, c: Context) => boolean);
    /**
     * Allowed HTTP methods.
     * Default: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE']
     */
    allowMethods?: string[];
    /**
     * Allowed request headers.
     * Default: ['Content-Type', 'Authorization', 'X-Requested-With']
     */
    allowHeaders?: string[];
    /**
     * Headers exposed to the browser.
     * Default: []
     */
    exposeHeaders?: string[];
    /**
     * Max age for preflight cache in seconds.
     * Default: 86400 (24 hours)
     */
    maxAge?: number;
    /**
     * Allow credentials (cookies, authorization headers).
     * Default: true
     */
    credentials?: boolean;
}
/**
 * Create CORS middleware with custom options.
 *
 * This middleware handles CORS preflight requests and adds appropriate
 * headers to responses. It supports:
 * - Configurable allowed origins (from environment or explicit list)
 * - Credentials support for cookies and auth headers
 * - All HTTP methods by default
 * - All headers by default
 *
 * @param options - CORS configuration options
 * @returns Hono middleware handler
 */
export declare function corsMiddleware(options?: CorsOptions): MiddlewareHandler;
/**
 * Create CORS middleware using settings from environment.
 *
 * This is the default CORS middleware that reads configuration
 * from environment variables, matching the Python backend behavior.
 *
 * Configuration:
 * - CORS_ORIGINS: Comma-separated list or JSON array of allowed origins
 * - Credentials: Always enabled
 * - Methods: All methods allowed
 * - Headers: All headers allowed
 *
 * @returns Hono middleware handler
 */
export declare function createCorsMiddleware(): MiddlewareHandler;
/**
 * Simple CORS middleware for development.
 *
 * Allows all origins with credentials. NOT recommended for production.
 *
 * @returns Hono middleware handler
 */
export declare function devCorsMiddleware(): MiddlewareHandler;
/**
 * Strict CORS middleware for production.
 *
 * Only allows explicitly configured origins with full credentials support.
 *
 * @param allowedOrigins - List of allowed origins
 * @returns Hono middleware handler
 */
export declare function strictCorsMiddleware(allowedOrigins: string[]): MiddlewareHandler;
/**
 * Manual CORS headers handler for custom scenarios.
 *
 * Use this when you need fine-grained control over CORS headers
 * in specific routes.
 *
 * @param c - Hono context
 * @param origin - Origin to allow (or null for request origin)
 */
export declare function setCorsHeaders(c: Context, origin?: string): void;
/**
 * Handle CORS preflight request manually.
 *
 * Use this for custom preflight handling in specific routes.
 *
 * @param c - Hono context
 * @returns Response with CORS headers
 */
export declare function handlePreflight(c: Context): Response;
export type { Context, MiddlewareHandler };
//# sourceMappingURL=cors.d.ts.map