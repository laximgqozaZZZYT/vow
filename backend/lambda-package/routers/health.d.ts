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
/**
 * Health response schema for basic health check.
 */
export declare const healthResponseSchema: z.ZodObject<{
    status: z.ZodString;
    version: z.ZodString;
    service: z.ZodString;
    timestamp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: string;
    version: string;
    service: string;
    timestamp: string;
}, {
    status: string;
    version: string;
    service: string;
    timestamp: string;
}>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
/**
 * Detailed health response schema with additional configuration info.
 */
export declare const detailedHealthResponseSchema: z.ZodObject<{
    status: z.ZodString;
    version: z.ZodString;
    service: z.ZodString;
    timestamp: z.ZodString;
} & {
    debug: z.ZodBoolean;
    database_configured: z.ZodBoolean;
    slack_enabled: z.ZodBoolean;
    openai_enabled: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    status: string;
    version: string;
    service: string;
    timestamp: string;
    debug: boolean;
    database_configured: boolean;
    slack_enabled: boolean;
    openai_enabled: boolean;
}, {
    status: string;
    version: string;
    service: string;
    timestamp: string;
    debug: boolean;
    database_configured: boolean;
    slack_enabled: boolean;
    openai_enabled: boolean;
}>;
export type DetailedHealthResponse = z.infer<typeof detailedHealthResponseSchema>;
/**
 * Supabase health status schema.
 */
export declare const supabaseHealthStatusSchema: z.ZodObject<{
    status: z.ZodEnum<["healthy", "unhealthy"]>;
    supabase_connected: z.ZodBoolean;
    latency_ms: z.ZodNullable<z.ZodNumber>;
    error: z.ZodNullable<z.ZodString>;
    timestamp: z.ZodString;
    instance_id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "healthy" | "unhealthy";
    instance_id: string;
    timestamp: string;
    supabase_connected: boolean;
    latency_ms: number | null;
    error: string | null;
}, {
    status: "healthy" | "unhealthy";
    instance_id: string;
    timestamp: string;
    supabase_connected: boolean;
    latency_ms: number | null;
    error: string | null;
}>;
export type SupabaseHealthStatus = z.infer<typeof supabaseHealthStatusSchema>;
/**
 * Create the health router with all health check endpoints.
 */
export declare function createHealthRouter(): Hono;
export declare const healthRouter: Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
//# sourceMappingURL=health.d.ts.map