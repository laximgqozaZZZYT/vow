/**
 * Hono application entry point for the Vow habit tracking backend.
 *
 * This module configures and exports the main Hono application with:
 * - CORS middleware for cross-origin requests
 * - JWT authentication middleware for protected endpoints
 * - Route handlers for health, Slack OAuth, commands, and interactions
 * - Global error handling middleware
 *
 * Requirements: 9.2 - THE Backend_API SHALL use Hono as the web framework for Lambda compatibility
 */
import { Hono } from 'hono';
/**
 * Create and configure the Hono application.
 *
 * This factory function creates a new Hono app instance with all middleware
 * and routers configured. It's designed to be called once at startup.
 *
 * @returns Configured Hono application instance
 */
export declare function createApp(): Hono;
declare const app: Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
export { app };
//# sourceMappingURL=index.d.ts.map