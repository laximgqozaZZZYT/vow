/**
 * Slack Commands Router
 *
 * Handles Slack slash commands: /habit-done, /habit-status, /habit-list, /habit-dashboard
 *
 * Requirements:
 * - 5.1: Handle /habit-done command
 * - 5.2: Handle /habit-status command
 * - 5.3: Handle /habit-list command
 * - 5.4: Handle /habit-dashboard command
 * - 5.5: Verify Slack request signatures
 * - 5.6: Return user-friendly Japanese messages
 * - 5.7: Log command processing with structured logging
 * - 5.8: Handle errors gracefully
 *
 * Python equivalent: backend/app/routers/slack_webhook.py
 */
import { Hono } from 'hono';
/**
 * Create the Slack commands router with all endpoints.
 */
export declare function createSlackCommandsRouter(): Hono;
export declare const slackCommandsRouter: Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
//# sourceMappingURL=slackCommands.d.ts.map