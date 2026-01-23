/**
 * Widget Router
 *
 * REST endpoints for widget data and operations.
 * Provides API access for embeddable dashboard widgets.
 *
 * All routes require API key authentication and are rate limited.
 *
 * Endpoints:
 * - GET /progress - Daily progress data
 * - GET /stats - Statistics data
 * - GET /next - Next habits data
 * - GET /stickies - Stickies data
 * - POST /habits/:habitId/complete - Complete a habit
 * - POST /stickies/:stickyId/toggle - Toggle sticky completion
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 7.1, 7.2
 */
import { Hono } from 'hono';
/**
 * Create the Widget Router with all widget endpoints.
 *
 * This router provides API access for embeddable dashboard widgets.
 * All routes require API key authentication and are rate limited.
 *
 * CORS Configuration (Requirements 7.1, 7.2):
 * - Allows requests from any origin for widget endpoints
 * - Allows X-API-Key header in CORS preflight responses
 *
 * @returns Configured Hono router instance
 */
export declare function createWidgetRouter(): Hono;
export declare const widgetRouter: Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
//# sourceMappingURL=widgets.d.ts.map