/**
 * Slack OAuth Router
 *
 * Handles OAuth 2.0 flow for connecting Slack workspaces.
 *
 * Requirements:
 * - 10.1: THE Backend_API SHALL maintain the same endpoint paths as the Python backend
 * - 10.2: THE Backend_API SHALL maintain the same request/response schemas as the Python backend
 *
 * Python equivalent: backend/app/routers/slack_oauth.py
 */
import { Hono } from 'hono';
/**
 * Create the Slack OAuth router with all endpoints.
 */
export declare function createSlackOAuthRouter(): Hono;
export declare const slackOAuthRouter: Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
//# sourceMappingURL=slackOAuth.d.ts.map