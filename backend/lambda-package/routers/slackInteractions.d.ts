/**
 * Slack Interactions Router
 *
 * Handles Slack interactive components (button clicks) from messages.
 *
 * Requirements:
 * - 6.1: Handle Done button click → mark habit complete, return confirmation
 * - 6.2: Handle Skip button click → record skip, return confirmation
 * - 6.3: Handle Remind Later button click → set remind_later_at, return confirmation
 * - 6.4: Include streak count in completion confirmation
 * - 6.5: Handle already completed habits
 * - 6.6: Log errors and return error messages on Slack API errors
 *
 * Python equivalent: backend/app/routers/slack_interactions.py
 */
import { Hono } from 'hono';
/**
 * Create the Slack interactions router with all endpoints.
 */
export declare function createSlackInteractionsRouter(): Hono;
export declare const slackInteractionsRouter: Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
//# sourceMappingURL=slackInteractions.d.ts.map