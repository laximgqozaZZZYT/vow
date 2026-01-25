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
import { serve } from '@hono/node-server';
// Middleware imports
import { createCorsMiddleware } from './middleware/cors.js';
import { jwtAuthMiddleware, addExcludedPath } from './middleware/auth.js';
// Router imports
import { createHealthRouter } from './routers/health.js';
import { createSlackOAuthRouter } from './routers/slackOAuth.js';
import { createSlackCommandsRouter } from './routers/slackCommands.js';
import { createSlackInteractionsRouter } from './routers/slackInteractions.js';
import { widgetRouter } from './routers/widgets.js';
import { apiKeyRouter } from './routers/apiKeys.js';
import { subscriptionRouter } from './routers/subscription.js';
import { aiRouter } from './routers/ai.js';
import { coachingRouter } from './routers/coaching.js';
import { noticesRouter } from './routers/notices.js';
import { notificationsRouter } from './routers/notifications.js';
// Error handling imports
import { AppError, getUserFriendlyMessage } from './errors/index.js';
import { getLogger } from './utils/logger.js';
import { getSettings } from './config.js';
const logger = getLogger('app');
// =============================================================================
// Application Factory
// =============================================================================
/**
 * Create and configure the Hono application.
 *
 * This factory function creates a new Hono app instance with all middleware
 * and routers configured. It's designed to be called once at startup.
 *
 * @returns Configured Hono application instance
 */
export function createApp() {
    const app = new Hono();
    const settings = getSettings();
    // ---------------------------------------------------------------------------
    // Exclude Widget API from JWT Authentication
    // ---------------------------------------------------------------------------
    // Widget endpoints use API key authentication instead of JWT
    // This must be done before the JWT middleware is applied
    addExcludedPath('/api/widgets');
    // Stripe webhook endpoint uses signature verification instead of JWT
    addExcludedPath('/api/subscription/webhooks/stripe');
    // ---------------------------------------------------------------------------
    // Global Middleware
    // ---------------------------------------------------------------------------
    // 1. CORS Middleware - Must be first to handle preflight requests
    app.use('*', createCorsMiddleware());
    // 2. Request logging middleware
    app.use('*', async (c, next) => {
        const startTime = Date.now();
        const method = c.req.method;
        const path = c.req.path;
        logger.info('Request received', {
            method,
            path,
            user_agent: c.req.header('User-Agent'),
        });
        await next();
        const duration = Date.now() - startTime;
        logger.info('Request completed', {
            method,
            path,
            status: c.res.status,
            duration_ms: duration,
        });
    });
    // 3. JWT Authentication Middleware
    // Note: This middleware skips authentication for excluded paths
    // (health checks, Slack webhooks, OAuth callbacks, etc.)
    app.use('*', jwtAuthMiddleware());
    // ---------------------------------------------------------------------------
    // Global Error Handler
    // ---------------------------------------------------------------------------
    app.onError((err, c) => {
        // Log the error with full details
        logger.error('Unhandled error', err, {
            path: c.req.path,
            method: c.req.method,
        });
        // Handle AppError instances with proper status codes
        if (err instanceof AppError) {
            return c.json({
                error: err.code ?? 'ERROR',
                message: err.message,
            }, err.statusCode);
        }
        // For unknown errors, return a generic error response
        // Use user-friendly message for production, detailed message for development
        const message = settings.debug
            ? err.message
            : getUserFriendlyMessage(err);
        return c.json({
            error: 'INTERNAL_ERROR',
            message,
        }, 500);
    });
    // ---------------------------------------------------------------------------
    // Not Found Handler
    // ---------------------------------------------------------------------------
    app.notFound((c) => {
        logger.warning('Route not found', {
            path: c.req.path,
            method: c.req.method,
        });
        return c.json({
            error: 'NOT_FOUND',
            message: `Route ${c.req.method} ${c.req.path} not found`,
        }, 404);
    });
    // ---------------------------------------------------------------------------
    // Root Endpoint
    // ---------------------------------------------------------------------------
    app.get('/', (c) => {
        return c.json({
            message: 'Vow Backend API (TypeScript)',
            version: settings.appVersion,
            service: settings.appName,
        });
    });
    // ---------------------------------------------------------------------------
    // Mount Routers
    // ---------------------------------------------------------------------------
    // Health check router - mounted at root level
    // Endpoints: /health, /health/detailed, /health/supabase
    const healthRouter = createHealthRouter();
    app.route('/', healthRouter);
    // Slack OAuth router - mounted at /api/slack
    // Endpoints: /api/slack/connect, /api/slack/callback, /api/slack/disconnect,
    //            /api/slack/status, /api/slack/preferences, /api/slack/test
    const slackOAuthRouter = createSlackOAuthRouter();
    app.route('/api/slack', slackOAuthRouter);
    // Slack commands router - mounted at /api/slack
    // Endpoints: /api/slack/commands, /api/slack/events
    const slackCommandsRouter = createSlackCommandsRouter();
    app.route('/api/slack', slackCommandsRouter);
    // Slack interactions router - mounted at /api/slack
    // Endpoints: /api/slack/interactions
    const slackInteractionsRouter = createSlackInteractionsRouter();
    app.route('/api/slack', slackInteractionsRouter);
    // Widget router - mounted at /api/widgets
    // Endpoints: /api/widgets/progress, /api/widgets/stats, /api/widgets/next,
    //            /api/widgets/stickies, /api/widgets/habits/:habitId/complete,
    //            /api/widgets/stickies/:stickyId/toggle
    // Note: Uses API key authentication (not JWT) and has its own CORS configuration
    // Requirements: 7.1, 7.2
    app.route('/api/widgets', widgetRouter);
    // API key management router - mounted at /api/api-keys
    // Endpoints: /api/api-keys (GET, POST), /api/api-keys/:keyId (DELETE)
    // Note: Uses JWT authentication for user management
    // Requirements: 1.1, 1.3, 1.4
    app.route('/api/api-keys', apiKeyRouter);
    // Subscription router - mounted at /api/subscription
    // Endpoints: /api/subscription/checkout, /api/subscription/status,
    //            /api/subscription/portal, /api/subscription/cancel,
    //            /api/subscription/webhooks/stripe
    // Requirements: 1.4, 2.1, 2.2, 2.3, 2.4, 2.5, 2.8, 2.9, 2.10
    app.route('/api/subscription', subscriptionRouter);
    // AI router - mounted at /api/ai
    // Endpoints: /api/ai/parse-habit, /api/ai/edit-habit
    // Note: Requires Premium subscription
    // Requirements: 3.1, 3.6, 4.1
    app.route('/api/ai', aiRouter);
    // Coaching router - mounted at /api/coaching
    // Endpoints: /api/coaching/proposals, /api/coaching/apply/:id,
    //            /api/coaching/dismiss/:id, /api/coaching/snooze/:id,
    //            /api/coaching/recovery/:habitId
    // Note: Workload coaching is available for all users (rule-based, not AI)
    // Requirements: 10.3, 10.4
    app.route('/api/coaching', coachingRouter);
    // Notices router - mounted at /api/notices
    // Endpoints: /api/notices, /api/notices/unread-count, /api/notices/:id/read,
    //            /api/notices/read-all, /api/notices/:id
    // Note: In-app notification management
    // Requirements: 12.1, 12.2
    app.route('/api/notices', noticesRouter);
    // Notifications router - mounted at /api/notifications
    // Endpoints: /api/notifications/preferences, /api/notifications/push-subscription,
    //            /api/notifications/push-subscriptions
    // Note: Notification preferences and Web Push subscription management
    // Requirements: 12.4
    app.route('/api/notifications', notificationsRouter);
    logger.info('Application initialized', {
        version: settings.appVersion,
        debug: settings.debug,
        slack_enabled: settings.slackEnabled,
    });
    return app;
}
// =============================================================================
// Application Instance
// =============================================================================
// Create the application instance
const app = createApp();
// Export app for Lambda handler
export { app };
// =============================================================================
// Local Development Server
// =============================================================================
/**
 * Start the local development server.
 *
 * This function is only called when running locally (not in Lambda).
 * It starts an HTTP server using @hono/node-server.
 */
function startDevServer() {
    const port = parseInt(process.env['PORT'] ?? '3001', 10);
    logger.info(`🚀 Starting development server on http://localhost:${port}`);
    serve({
        fetch: app.fetch,
        port,
    });
    logger.info(`✅ Server is running on http://localhost:${port}`);
}
// Start server for local development (not in Lambda or production)
if (process.env['NODE_ENV'] !== 'production' && !process.env['AWS_LAMBDA_FUNCTION_NAME']) {
    startDevServer();
}
//# sourceMappingURL=index.js.map