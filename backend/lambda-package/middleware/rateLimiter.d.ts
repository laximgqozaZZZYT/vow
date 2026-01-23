/**
 * Rate Limiter Service
 *
 * Implements sliding window rate limiting per API key.
 * Uses the rate_limits table to track request counts per time window.
 *
 * Requirements: 3.1, 3.2, 3.3
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { MiddlewareHandler } from 'hono';
/**
 * Configuration for rate limiting.
 */
export interface RateLimitConfig {
    /** Time window in milliseconds (e.g., 60000 for 1 minute) */
    windowMs: number;
    /** Maximum requests allowed per window */
    maxRequests: number;
}
/**
 * Result of a rate limit check.
 */
export interface RateLimitResult {
    /** Whether the request is allowed */
    allowed: boolean;
    /** Number of requests remaining in the current window */
    remaining: number;
    /** When the current window resets */
    resetAt: Date;
}
/**
 * Default rate limit configuration.
 * 100 requests per minute as specified in Requirements 3.1.
 */
export declare const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig;
/**
 * Rate Limiter Service
 *
 * Implements a sliding window rate limiting algorithm using the database
 * to track request counts per API key per time window.
 *
 * The sliding window algorithm works by:
 * 1. Calculating the current window start time (floored to window boundaries)
 * 2. Counting requests in the current window
 * 3. Allowing or denying based on the count vs max requests
 *
 * Requirements:
 * - 3.1: Limit each API key to 100 requests per minute
 * - 3.2: Return 429 with Retry-After when exceeded
 * - 3.3: Track request counts using sliding window algorithm
 */
export declare class RateLimiter {
    private readonly supabase;
    private readonly config;
    /**
     * Create a new RateLimiter instance.
     *
     * @param supabase - The Supabase client instance.
     * @param config - Rate limit configuration.
     */
    constructor(supabase: SupabaseClient, config?: RateLimitConfig);
    /**
     * Calculate the window start time for a given timestamp.
     *
     * Windows are aligned to fixed boundaries based on windowMs.
     * For example, with a 60-second window, windows start at :00, :01, :02, etc.
     *
     * @param timestamp - The timestamp to calculate the window for.
     * @returns The window start time as a Date.
     */
    private getWindowStart;
    /**
     * Calculate when the current window resets.
     *
     * @param windowStart - The start of the current window.
     * @returns The reset time as a Date.
     */
    private getResetTime;
    /**
     * Check if a request is allowed under the rate limit.
     *
     * This method checks the current request count for the API key
     * in the current time window and determines if another request
     * is allowed.
     *
     * Requirements:
     * - 3.1: Limit each API key to 100 requests per minute
     * - 3.3: Track request counts using sliding window algorithm
     *
     * @param keyId - The API key ID to check.
     * @returns Rate limit result with allowed status, remaining count, and reset time.
     */
    checkLimit(keyId: string): Promise<RateLimitResult>;
    /**
     * Record a request for rate limiting purposes.
     *
     * This method increments the request count for the API key
     * in the current time window. If no record exists for the
     * current window, it creates one.
     *
     * Uses a SELECT then UPDATE/INSERT pattern to handle concurrent
     * requests reliably with proper race condition handling.
     *
     * Requirements:
     * - 3.3: Track request counts using sliding window algorithm
     *
     * @param keyId - The API key ID to record the request for.
     */
    recordRequest(keyId: string): Promise<void>;
}
/**
 * Create a RateLimiter instance with default configuration.
 *
 * @param supabase - The Supabase client instance.
 * @returns A configured RateLimiter instance.
 */
export declare function createRateLimiter(supabase: SupabaseClient): RateLimiter;
/**
 * Create a RateLimiter instance with custom configuration.
 *
 * @param supabase - The Supabase client instance.
 * @param config - Custom rate limit configuration.
 * @returns A configured RateLimiter instance.
 */
export declare function createCustomRateLimiter(supabase: SupabaseClient, config: RateLimitConfig): RateLimiter;
/**
 * Rate Limit Middleware Factory
 *
 * Creates a Hono middleware that enforces rate limiting per API key.
 * This middleware should be used after the apiKeyAuth middleware,
 * which sets the apiKeyId in the context.
 *
 * The middleware:
 * 1. Gets the API key ID from context (set by apiKeyAuth middleware)
 * 2. Checks if the request is allowed under the rate limit
 * 3. Returns 429 with Retry-After header when exceeded
 * 4. Adds X-RateLimit-Remaining and X-RateLimit-Reset headers to responses
 * 5. Records the request for rate limiting purposes
 *
 * Requirements:
 * - 3.1: Limit each API key to 100 requests per minute
 * - 3.2: Return 429 with Retry-After header when exceeded
 *
 * @param supabase - The Supabase client instance.
 * @param config - Optional rate limit configuration (defaults to 100 requests per 60 seconds).
 * @returns A Hono middleware handler.
 */
export declare function createRateLimitMiddleware(supabase: SupabaseClient, config?: RateLimitConfig): MiddlewareHandler;
//# sourceMappingURL=rateLimiter.d.ts.map