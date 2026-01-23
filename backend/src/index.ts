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
import type { Context, Next } from 'hono';

// Middleware imports
import { createCorsMiddleware } from './middleware/cors.js';
import { jwtAuthMiddleware } from './middleware/auth.js';

// Router imports
import { createHealthRouter } from './routers/health.js';
import { createSlackOAuthRouter } from './routers/slackOAuth.js';
import { createSlackCommandsRouter } from './routers/slackCommands.js';
import { createSlackInteractionsRouter } from './routers/slackInteractions.js';

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
export function createApp(): Hono {
  const app = new Hono();
  const settings = getSettings();

  // ---------------------------------------------------------------------------
  // Global Middleware
  // ---------------------------------------------------------------------------

  // 1. CORS Middleware - Must be first to handle preflight requests
  app.use('*', createCorsMiddleware());

  // 2. Request logging middleware
  app.use('*', async (c: Context, next: Next) => {
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

  app.onError((err: Error, c: Context) => {
    // Log the error with full details
    logger.error('Unhandled error', err, {
      path: c.req.path,
      method: c.req.method,
    });

    // Handle AppError instances with proper status codes
    if (err instanceof AppError) {
      return c.json(
        {
          error: err.code ?? 'ERROR',
          message: err.message,
        },
        err.statusCode as 400 | 401 | 403 | 404 | 500 | 502 | 503
      );
    }

    // For unknown errors, return a generic error response
    // Use user-friendly message for production, detailed message for development
    const message = settings.debug
      ? err.message
      : getUserFriendlyMessage(err);

    return c.json(
      {
        error: 'INTERNAL_ERROR',
        message,
      },
      500
    );
  });

  // ---------------------------------------------------------------------------
  // Not Found Handler
  // ---------------------------------------------------------------------------

  app.notFound((c: Context) => {
    logger.warning('Route not found', {
      path: c.req.path,
      method: c.req.method,
    });

    return c.json(
      {
        error: 'NOT_FOUND',
        message: `Route ${c.req.method} ${c.req.path} not found`,
      },
      404
    );
  });

  // ---------------------------------------------------------------------------
  // Root Endpoint
  // ---------------------------------------------------------------------------

  app.get('/', (c: Context) => {
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
function startDevServer(): void {
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
