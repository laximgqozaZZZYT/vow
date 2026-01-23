/**
 * Rate Limiter Service
 *
 * Implements sliding window rate limiting per API key.
 * Uses the rate_limits table to track request counts per time window.
 *
 * Requirements: 3.1, 3.2, 3.3
 */
import { getLogger } from '../utils/logger.js';
const logger = getLogger('middleware.rateLimiter');
/**
 * Default rate limit configuration.
 * 100 requests per minute as specified in Requirements 3.1.
 */
export const DEFAULT_RATE_LIMIT_CONFIG = {
    windowMs: 60000, // 1 minute
    maxRequests: 100,
};
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
export class RateLimiter {
    supabase;
    config;
    /**
     * Create a new RateLimiter instance.
     *
     * @param supabase - The Supabase client instance.
     * @param config - Rate limit configuration.
     */
    constructor(supabase, config = DEFAULT_RATE_LIMIT_CONFIG) {
        this.supabase = supabase;
        this.config = config;
    }
    /**
     * Calculate the window start time for a given timestamp.
     *
     * Windows are aligned to fixed boundaries based on windowMs.
     * For example, with a 60-second window, windows start at :00, :01, :02, etc.
     *
     * @param timestamp - The timestamp to calculate the window for.
     * @returns The window start time as a Date.
     */
    getWindowStart(timestamp = new Date()) {
        const windowMs = this.config.windowMs;
        const windowStartMs = Math.floor(timestamp.getTime() / windowMs) * windowMs;
        return new Date(windowStartMs);
    }
    /**
     * Calculate when the current window resets.
     *
     * @param windowStart - The start of the current window.
     * @returns The reset time as a Date.
     */
    getResetTime(windowStart) {
        return new Date(windowStart.getTime() + this.config.windowMs);
    }
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
    async checkLimit(keyId) {
        const now = new Date();
        const windowStart = this.getWindowStart(now);
        const resetAt = this.getResetTime(windowStart);
        try {
            // Get current request count for this key in the current window
            const { data, error } = await this.supabase
                .from('rate_limits')
                .select('request_count')
                .eq('key_id', keyId)
                .eq('window_start', windowStart.toISOString())
                .single();
            if (error && error.code !== 'PGRST116') {
                // PGRST116 is "no rows returned" which is expected for new windows
                logger.error('Error checking rate limit', new Error(error.message), { keyId });
                // On error, allow the request but log it
                return {
                    allowed: true,
                    remaining: this.config.maxRequests,
                    resetAt,
                };
            }
            const currentCount = data?.request_count ?? 0;
            const remaining = Math.max(0, this.config.maxRequests - currentCount);
            const allowed = currentCount < this.config.maxRequests;
            logger.debug('Rate limit check', {
                keyId,
                currentCount,
                maxRequests: this.config.maxRequests,
                allowed,
                remaining,
                windowStart: windowStart.toISOString(),
                resetAt: resetAt.toISOString(),
            });
            return {
                allowed,
                remaining,
                resetAt,
            };
        }
        catch (error) {
            logger.error('Unexpected error in checkLimit', error instanceof Error ? error : new Error(String(error)), { keyId });
            // On unexpected error, allow the request
            return {
                allowed: true,
                remaining: this.config.maxRequests,
                resetAt,
            };
        }
    }
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
    async recordRequest(keyId) {
        const now = new Date();
        const windowStart = this.getWindowStart(now);
        const windowStartIso = windowStart.toISOString();
        try {
            // First, try to get existing record
            const { data: existing, error: selectError } = await this.supabase
                .from('rate_limits')
                .select('id, request_count')
                .eq('key_id', keyId)
                .eq('window_start', windowStartIso)
                .single();
            if (selectError && selectError.code !== 'PGRST116') {
                // PGRST116 is "no rows returned" which is expected for new windows
                logger.error('Error selecting rate limit record', new Error(selectError.message), { keyId });
                return;
            }
            if (existing) {
                // Update existing record - increment count
                const { error: updateError } = await this.supabase
                    .from('rate_limits')
                    .update({ request_count: existing.request_count + 1 })
                    .eq('id', existing.id);
                if (updateError) {
                    logger.error('Error updating rate limit record', new Error(updateError.message), { keyId });
                }
                else {
                    logger.debug('Rate limit incremented', {
                        keyId,
                        newCount: existing.request_count + 1,
                        windowStart: windowStartIso,
                    });
                }
            }
            else {
                // Insert new record
                const { error: insertError } = await this.supabase
                    .from('rate_limits')
                    .insert({
                    key_id: keyId,
                    window_start: windowStartIso,
                    request_count: 1,
                });
                if (insertError) {
                    // Handle race condition - another request might have inserted
                    if (insertError.code === '23505') {
                        // Unique constraint violation - try to increment instead
                        const { data: retryData } = await this.supabase
                            .from('rate_limits')
                            .select('id, request_count')
                            .eq('key_id', keyId)
                            .eq('window_start', windowStartIso)
                            .single();
                        if (retryData) {
                            await this.supabase
                                .from('rate_limits')
                                .update({ request_count: retryData.request_count + 1 })
                                .eq('id', retryData.id);
                        }
                    }
                    else {
                        logger.error('Error inserting rate limit record', new Error(insertError.message), { keyId });
                    }
                }
                else {
                    logger.debug('New rate limit window created', {
                        keyId,
                        windowStart: windowStartIso,
                    });
                }
            }
        }
        catch (error) {
            logger.error('Unexpected error in recordRequest', error instanceof Error ? error : new Error(String(error)), { keyId });
        }
    }
}
/**
 * Create a RateLimiter instance with default configuration.
 *
 * @param supabase - The Supabase client instance.
 * @returns A configured RateLimiter instance.
 */
export function createRateLimiter(supabase) {
    return new RateLimiter(supabase, DEFAULT_RATE_LIMIT_CONFIG);
}
/**
 * Create a RateLimiter instance with custom configuration.
 *
 * @param supabase - The Supabase client instance.
 * @param config - Custom rate limit configuration.
 * @returns A configured RateLimiter instance.
 */
export function createCustomRateLimiter(supabase, config) {
    return new RateLimiter(supabase, config);
}
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
export function createRateLimitMiddleware(supabase, config = DEFAULT_RATE_LIMIT_CONFIG) {
    const rateLimiter = new RateLimiter(supabase, config);
    return async (c, next) => {
        // Get the API key ID from context (set by apiKeyAuth middleware)
        const apiKeyId = c.get('apiKeyId');
        if (!apiKeyId) {
            logger.warning('Rate limit middleware called without apiKeyId in context');
            // If no API key ID, skip rate limiting (authentication should have failed)
            return next();
        }
        // Check if the request is allowed under the rate limit
        const result = await rateLimiter.checkLimit(apiKeyId);
        // Calculate seconds until reset for Retry-After header
        const now = new Date();
        const retryAfterSeconds = Math.ceil((result.resetAt.getTime() - now.getTime()) / 1000);
        if (!result.allowed) {
            logger.info('Rate limit exceeded', {
                apiKeyId,
                remaining: result.remaining,
                resetAt: result.resetAt.toISOString(),
                retryAfterSeconds,
            });
            // Return 429 Too Many Requests with Retry-After header
            return c.json({
                error: 'RATE_LIMIT_EXCEEDED',
                message: `Rate limit exceeded. Retry after ${retryAfterSeconds} seconds`,
                retryAfter: retryAfterSeconds,
            }, 429, {
                'Retry-After': String(retryAfterSeconds),
                'X-RateLimit-Remaining': '0',
                'X-RateLimit-Reset': result.resetAt.toISOString(),
            });
        }
        // Record the request for rate limiting purposes
        await rateLimiter.recordRequest(apiKeyId);
        // Add rate limit headers to the response
        // We need to use c.header() before calling next() to ensure headers are set
        c.header('X-RateLimit-Remaining', String(result.remaining - 1));
        c.header('X-RateLimit-Reset', result.resetAt.toISOString());
        return next();
    };
}
//# sourceMappingURL=rateLimiter.js.map