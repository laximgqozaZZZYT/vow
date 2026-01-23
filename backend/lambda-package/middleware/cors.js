/**
 * CORS Middleware for Hono
 *
 * Configures Cross-Origin Resource Sharing (CORS) for the API.
 * Supports the same configuration as the Python backend.
 *
 * Requirements: 10.5
 */
import { cors as honoCors } from 'hono/cors';
import { getSettings } from '../config.js';
import { getLogger } from '../utils/logger.js';
const logger = getLogger('middleware.cors');
/**
 * Default CORS configuration matching the Python backend.
 */
const DEFAULT_CORS_OPTIONS = {
    allowMethods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    exposeHeaders: [],
    maxAge: 86400, // 24 hours
    credentials: true,
};
/**
 * Validate origin against allowed origins list.
 *
 * @param origin - The origin to validate
 * @param allowedOrigins - List of allowed origins
 * @returns true if origin is allowed
 */
function isOriginAllowed(origin, allowedOrigins) {
    // Check for wildcard
    if (allowedOrigins.includes('*')) {
        return true;
    }
    // Check for exact match
    if (allowedOrigins.includes(origin)) {
        return true;
    }
    // Check for pattern match (e.g., *.example.com)
    for (const allowed of allowedOrigins) {
        if (allowed.startsWith('*.')) {
            const domain = allowed.slice(2);
            if (origin.endsWith(domain) || origin.endsWith(`.${domain}`)) {
                return true;
            }
        }
    }
    return false;
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
export function corsMiddleware(options = {}) {
    const settings = getSettings();
    // Merge options with defaults
    const config = {
        ...DEFAULT_CORS_OPTIONS,
        ...options,
    };
    // Determine allowed origins
    const allowedOrigins = options.origins
        ? Array.isArray(options.origins)
            ? options.origins
            : typeof options.origins === 'string'
                ? [options.origins]
                : null // function case handled separately
        : settings.corsOrigins;
    logger.info('CORS middleware initialized', {
        origins: allowedOrigins || 'dynamic',
        credentials: config.credentials,
        methods: config.allowMethods,
    });
    // Use Hono's built-in CORS middleware with our configuration
    return honoCors({
        origin: (origin, c) => {
            // Handle function-based origin validation
            if (typeof options.origins === 'function') {
                return options.origins(origin, c) ? origin : '';
            }
            // Handle array/string origins
            const origins = allowedOrigins || settings.corsOrigins;
            // If no origin header (same-origin request), allow
            if (!origin) {
                return '*';
            }
            // Check if origin is allowed
            if (isOriginAllowed(origin, origins)) {
                logger.info('CORS origin allowed', { origin });
                return origin;
            }
            logger.warning('CORS origin rejected', { origin, allowed: origins });
            return '';
        },
        allowMethods: config.allowMethods,
        allowHeaders: config.allowHeaders,
        exposeHeaders: config.exposeHeaders,
        maxAge: config.maxAge,
        credentials: config.credentials,
    });
}
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
export function createCorsMiddleware() {
    return corsMiddleware();
}
/**
 * Simple CORS middleware for development.
 *
 * Allows all origins with credentials. NOT recommended for production.
 *
 * @returns Hono middleware handler
 */
export function devCorsMiddleware() {
    logger.warning('Using development CORS middleware - allows all origins');
    return honoCors({
        origin: '*',
        allowMethods: DEFAULT_CORS_OPTIONS.allowMethods,
        allowHeaders: DEFAULT_CORS_OPTIONS.allowHeaders,
        exposeHeaders: DEFAULT_CORS_OPTIONS.exposeHeaders,
        maxAge: DEFAULT_CORS_OPTIONS.maxAge,
        credentials: false, // Cannot use credentials with wildcard origin
    });
}
/**
 * Strict CORS middleware for production.
 *
 * Only allows explicitly configured origins with full credentials support.
 *
 * @param allowedOrigins - List of allowed origins
 * @returns Hono middleware handler
 */
export function strictCorsMiddleware(allowedOrigins) {
    if (allowedOrigins.length === 0) {
        logger.warning('Strict CORS middleware initialized with no allowed origins');
    }
    return corsMiddleware({
        origins: allowedOrigins,
        credentials: true,
    });
}
/**
 * Manual CORS headers handler for custom scenarios.
 *
 * Use this when you need fine-grained control over CORS headers
 * in specific routes.
 *
 * @param c - Hono context
 * @param origin - Origin to allow (or null for request origin)
 */
export function setCorsHeaders(c, origin) {
    const settings = getSettings();
    const requestOrigin = c.req.header('Origin') || '';
    const allowedOrigin = origin || requestOrigin;
    // Only set headers if origin is allowed
    if (isOriginAllowed(allowedOrigin, settings.corsOrigins)) {
        c.header('Access-Control-Allow-Origin', allowedOrigin);
        c.header('Access-Control-Allow-Credentials', 'true');
        c.header('Access-Control-Allow-Methods', DEFAULT_CORS_OPTIONS.allowMethods.join(', '));
        c.header('Access-Control-Allow-Headers', DEFAULT_CORS_OPTIONS.allowHeaders.join(', '));
        c.header('Access-Control-Max-Age', String(DEFAULT_CORS_OPTIONS.maxAge));
    }
}
/**
 * Handle CORS preflight request manually.
 *
 * Use this for custom preflight handling in specific routes.
 *
 * @param c - Hono context
 * @returns Response with CORS headers
 */
export function handlePreflight(c) {
    setCorsHeaders(c);
    return c.body(null, 204);
}
//# sourceMappingURL=cors.js.map