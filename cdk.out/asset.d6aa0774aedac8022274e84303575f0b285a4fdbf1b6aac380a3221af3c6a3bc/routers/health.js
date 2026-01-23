/**
 * Health Check Router
 *
 * Provides health check endpoints for monitoring and load balancer health checks.
 *
 * Requirements:
 * - 10.1: THE Backend_API SHALL maintain the same endpoint paths as the Python backend
 *
 * Python equivalent: backend/app/routers/health.py
 */
import { Hono } from 'hono';
import { z } from 'zod';
import { getSettings } from '../config';
import { getLogger } from '../utils/logger';
const logger = getLogger('health');
// Health check timeout in seconds
const HEALTH_CHECK_TIMEOUT_MS = 3000;
/**
 * Health response schema for basic health check.
 */
export const healthResponseSchema = z.object({
    status: z.string(),
    version: z.string(),
    service: z.string(),
    timestamp: z.string(),
});
/**
 * Detailed health response schema with additional configuration info.
 */
export const detailedHealthResponseSchema = healthResponseSchema.extend({
    debug: z.boolean(),
    database_configured: z.boolean(),
    slack_enabled: z.boolean(),
    openai_enabled: z.boolean(),
});
/**
 * Supabase health status schema.
 */
export const supabaseHealthStatusSchema = z.object({
    status: z.enum(['healthy', 'unhealthy']),
    supabase_connected: z.boolean(),
    latency_ms: z.number().nullable(),
    error: z.string().nullable(),
    timestamp: z.string(),
    instance_id: z.string(),
});
/**
 * Create the health router with all health check endpoints.
 */
export function createHealthRouter() {
    const router = new Hono();
    /**
     * GET /health
     *
     * Basic health check endpoint.
     * Returns 200 OK with service status information.
     * Used by load balancers and monitoring systems.
     */
    router.get('/health', (c) => {
        const settings = getSettings();
        const response = {
            status: 'healthy',
            version: settings.appVersion,
            service: settings.appName,
            timestamp: new Date().toISOString(),
        };
        return c.json(response);
    });
    /**
     * GET /health/detailed
     *
     * Detailed health check endpoint.
     * Returns additional configuration status for debugging.
     * Should be protected in production environments.
     */
    router.get('/health/detailed', (c) => {
        const settings = getSettings();
        const response = {
            status: 'healthy',
            version: settings.appVersion,
            service: settings.appName,
            timestamp: new Date().toISOString(),
            debug: settings.debug,
            database_configured: Boolean(settings.supabaseUrl),
            slack_enabled: settings.slackEnabled,
            openai_enabled: settings.openaiEnabled,
        };
        return c.json(response);
    });
    /**
     * GET /health/supabase
     *
     * Supabase connection health check endpoint.
     *
     * Requirements:
     * - 6.1: Execute connection test to Supabase when health check endpoint is called
     * - 6.2: Return status "healthy" and latency when connection test succeeds
     * - 6.3: Return status "unhealthy" and error details when connection test fails
     * - 6.4: Set connection test timeout to 3 seconds
     */
    router.get('/health/supabase', async (c) => {
        const settings = getSettings();
        const timestamp = new Date().toISOString();
        let instanceId = 'unknown';
        // Check if Supabase is configured
        if (!settings.supabaseUrl || !settings.supabaseAnonKey) {
            logger.warning('Supabase health check failed: not configured', {
                supabase_url_set: Boolean(settings.supabaseUrl),
                supabase_key_set: Boolean(settings.supabaseAnonKey),
            });
            const response = {
                status: 'unhealthy',
                supabase_connected: false,
                latency_ms: null,
                error: 'Supabase is not configured (SUPABASE_URL or SUPABASE_ANON_KEY missing)',
                timestamp,
                instance_id: instanceId,
            };
            return c.json(response);
        }
        try {
            // Dynamic import to avoid loading Supabase client if not needed
            const { createClient } = await import('@supabase/supabase-js');
            const startTime = Date.now();
            // Create a promise that rejects after timeout
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    reject(new Error(`Connection test timed out after ${HEALTH_CHECK_TIMEOUT_MS / 1000} seconds`));
                }, HEALTH_CHECK_TIMEOUT_MS);
            });
            // Create connection test promise
            const connectionTestPromise = (async () => {
                const client = createClient(settings.supabaseUrl, settings.supabaseAnonKey);
                // Execute a lightweight query to verify the connection is working
                const { error } = await client.from('habits').select('id').limit(1);
                if (error) {
                    throw new Error(`Supabase query error: ${error.message}`);
                }
                return Date.now() - startTime;
            })();
            // Race between connection test and timeout
            const latencyMs = await Promise.race([connectionTestPromise, timeoutPromise]);
            // Connection successful
            logger.info('Supabase health check successful', {
                instance_id: instanceId,
                latency_ms: latencyMs,
            });
            const response = {
                status: 'healthy',
                supabase_connected: true,
                latency_ms: latencyMs,
                error: null,
                timestamp,
                instance_id: instanceId,
            };
            return c.json(response);
        }
        catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            const errorObj = err instanceof Error ? err : new Error(errorMessage);
            logger.error('Supabase health check failed', errorObj, {
                instance_id: instanceId,
            });
            const response = {
                status: 'unhealthy',
                supabase_connected: false,
                latency_ms: null,
                error: errorMessage,
                timestamp,
                instance_id: instanceId,
            };
            return c.json(response);
        }
    });
    return router;
}
// Export default router instance
export const healthRouter = createHealthRouter();
//# sourceMappingURL=health.js.map