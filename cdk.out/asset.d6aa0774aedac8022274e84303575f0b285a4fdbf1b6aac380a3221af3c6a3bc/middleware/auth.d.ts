/**
 * JWT Authentication Middleware for Hono
 *
 * Provides JWT token validation for protected endpoints.
 * Supports both Supabase JWT (ES256, HS256) and AWS Cognito JWT (RS256).
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9
 */
import type { Context, MiddlewareHandler } from 'hono';
/**
 * JWT payload interface for authenticated users.
 */
export interface JWTPayload {
    /** Subject (user ID) */
    sub: string;
    /** Email address */
    email?: string;
    /** Audience */
    aud?: string | string[];
    /** Issuer */
    iss?: string;
    /** Expiration time */
    exp?: number;
    /** Issued at */
    iat?: number;
    /** Token use (for Cognito) */
    token_use?: 'id' | 'access';
    /** Additional claims */
    [key: string]: unknown;
}
/**
 * Extended Hono context with user information.
 */
export interface AuthContext {
    user: JWTPayload;
}
/**
 * JWT Authentication Middleware for Hono.
 *
 * Validates JWT tokens from Authorization header and attaches
 * user information to context variables.
 *
 * Supports:
 * - Supabase JWT (ES256, HS256)
 * - AWS Cognito JWT (RS256)
 *
 * Handles API Gateway stage prefixes (e.g., /development, /production)
 * by stripping them before matching excluded paths.
 */
export declare function jwtAuthMiddleware(): MiddlewareHandler;
/**
 * Get current authenticated user from context.
 *
 * @throws AuthenticationError if user is not authenticated
 */
export declare function getCurrentUser(c: Context): JWTPayload;
/**
 * Get current user's ID from context.
 *
 * Works with both Supabase and Cognito tokens.
 *
 * @throws AuthenticationError if user is not authenticated or ID not found
 */
export declare function getUserId(c: Context): string;
/**
 * Get current user's email from context.
 *
 * Works with both Supabase and Cognito tokens.
 */
export declare function getUserEmail(c: Context): string | undefined;
/**
 * Clear JWKS cache (useful for testing).
 */
export declare function clearJWKSCache(): void;
/**
 * Add a path to the excluded paths list.
 * Useful for dynamically adding public endpoints.
 */
export declare function addExcludedPath(path: string): void;
/**
 * Remove a path from the excluded paths list.
 */
export declare function removeExcludedPath(path: string): void;
/**
 * Get the list of excluded paths.
 */
export declare function getExcludedPaths(): readonly string[];
//# sourceMappingURL=auth.d.ts.map