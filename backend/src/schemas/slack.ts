/**
 * Slack Integration Schemas
 *
 * Zod schemas for Slack OAuth, webhooks, and preferences.
 *
 * Requirements: 9.3
 */

import { z } from 'zod';

// ============================================================================
// Slack Connection Schemas
// ============================================================================

/**
 * Schema for creating a new Slack connection.
 */
export const slackConnectionCreateSchema = z.object({
  slack_user_id: z.string().describe('Slack user ID'),
  slack_team_id: z.string().describe('Slack workspace/team ID'),
  slack_team_name: z.string().optional().describe('Slack workspace name'),
  slack_user_name: z.string().optional().describe('Slack username'),
  access_token: z.string().describe('OAuth access token'),
  refresh_token: z.string().optional().describe('OAuth refresh token'),
  bot_access_token: z.string().optional().describe('Bot access token'),
  token_expires_at: z.string().datetime().optional().describe('Token expiration time'),
});

export type SlackConnectionCreate = z.infer<typeof slackConnectionCreateSchema>;

/**
 * Schema for Slack connection response (excludes sensitive tokens).
 */
export const slackConnectionResponseSchema = z.object({
  id: z.string(),
  owner_type: z.string(),
  owner_id: z.string(),
  slack_user_id: z.string(),
  slack_team_id: z.string(),
  slack_team_name: z.string().nullable(),
  slack_user_name: z.string().nullable(),
  connected_at: z.string().datetime(),
  is_valid: z.boolean(),
});

export type SlackConnectionResponse = z.infer<typeof slackConnectionResponseSchema>;

/**
 * Schema for checking Slack connection status.
 */
export const slackConnectionStatusSchema = z.object({
  connected: z.boolean(),
  connection: slackConnectionResponseSchema.nullable().optional(),
  preferences: z.lazy(() => slackPreferencesResponseSchema).nullable().optional(),
});

export type SlackConnectionStatus = z.infer<typeof slackConnectionStatusSchema>;

// ============================================================================
// Slack Preferences Schemas
// ============================================================================

/**
 * Schema for updating Slack notification preferences.
 */
export const slackPreferencesUpdateSchema = z.object({
  slack_notifications_enabled: z
    .boolean()
    .optional()
    .describe('Enable/disable Slack notifications for habits'),
  weekly_slack_report_enabled: z
    .boolean()
    .optional()
    .describe('Enable/disable weekly Slack reports'),
  weekly_report_day: z
    .number()
    .int()
    .min(0)
    .max(6)
    .optional()
    .describe('Day of week for weekly report (0=Sunday, 6=Saturday)'),
  weekly_report_time: z.string().optional().describe('Time of day for weekly report'),
});

export type SlackPreferencesUpdate = z.infer<typeof slackPreferencesUpdateSchema>;

/**
 * Schema for Slack preferences response.
 */
export const slackPreferencesResponseSchema = z.object({
  slack_notifications_enabled: z.boolean().default(false),
  weekly_slack_report_enabled: z.boolean().default(false),
  weekly_report_day: z.number().int().default(0),
  weekly_report_time: z.string().default('09:00'),
});

export type SlackPreferencesResponse = z.infer<typeof slackPreferencesResponseSchema>;

// ============================================================================
// Slack Webhook Schemas
// ============================================================================

/**
 * Schema for Slack slash command payload.
 */
export const slashCommandPayloadSchema = z.object({
  command: z.string().describe('The slash command (e.g., /habit-done)'),
  text: z.string().default('').describe('Text after the command'),
  user_id: z.string().describe('Slack user ID who triggered the command'),
  team_id: z.string().describe('Slack workspace ID'),
  channel_id: z.string().describe('Channel where command was triggered'),
  response_url: z.string().url().describe('URL to send delayed responses'),
  trigger_id: z.string().optional().describe('Trigger ID for modals'),
});

export type SlashCommandPayload = z.infer<typeof slashCommandPayloadSchema>;

/**
 * Schema for user info in interaction payload.
 */
export const interactionUserSchema = z.object({
  id: z.string(),
  username: z.string().optional(),
  name: z.string().optional(),
});

export type InteractionUser = z.infer<typeof interactionUserSchema>;

/**
 * Schema for team info in interaction payload.
 */
export const interactionTeamSchema = z.object({
  id: z.string(),
  domain: z.string().optional(),
});

export type InteractionTeam = z.infer<typeof interactionTeamSchema>;

/**
 * Schema for action in interaction payload.
 */
export const interactionActionSchema = z.object({
  action_id: z.string(),
  block_id: z.string().optional(),
  type: z.string(),
  value: z.string().optional(),
  selected_option: z.record(z.unknown()).optional(),
});

export type InteractionAction = z.infer<typeof interactionActionSchema>;

/**
 * Schema for Slack interactive component payload.
 */
export const interactionPayloadSchema = z.object({
  type: z.string().describe('Interaction type (e.g., block_actions)'),
  user: interactionUserSchema,
  team: interactionTeamSchema,
  actions: z.array(interactionActionSchema),
  response_url: z.string().url(),
  trigger_id: z.string(),
  container: z.record(z.unknown()).optional(),
  message: z.record(z.unknown()).optional(),
});

export type InteractionPayload = z.infer<typeof interactionPayloadSchema>;

/**
 * Schema for Slack Events API payload.
 */
export const slackEventPayloadSchema = z.object({
  type: z.string().describe('Event type'),
  challenge: z.string().optional().describe('URL verification challenge'),
  token: z.string().optional(),
  team_id: z.string().optional(),
  event: z.record(z.unknown()).optional(),
});

export type SlackEventPayload = z.infer<typeof slackEventPayloadSchema>;

// ============================================================================
// Slack Message Schemas
// ============================================================================

/**
 * Schema for sending a Slack message.
 */
export const slackMessageSchema = z.object({
  channel: z.string().describe('Channel ID or user ID for DM'),
  text: z.string().describe('Fallback text for notifications'),
  blocks: z.array(z.record(z.unknown())).optional().describe('Block Kit blocks for rich formatting'),
  thread_ts: z.string().optional().describe('Thread timestamp for replies'),
});

export type SlackMessage = z.infer<typeof slackMessageSchema>;

/**
 * Schema for Slack message send response.
 */
export const slackMessageResponseSchema = z.object({
  ok: z.boolean(),
  channel: z.string().optional(),
  ts: z.string().optional(),
  message: z.record(z.unknown()).optional(),
  error: z.string().optional(),
});

export type SlackMessageResponse = z.infer<typeof slackMessageResponseSchema>;

// ============================================================================
// Follow-Up Status Schemas
// ============================================================================

/**
 * Schema for creating follow-up status record.
 */
export const slackFollowUpStatusCreateSchema = z.object({
  habit_id: z.string(),
  date: z.string().optional(), // YYYY-MM-DD format
});

export type SlackFollowUpStatusCreate = z.infer<typeof slackFollowUpStatusCreateSchema>;

/**
 * Schema for follow-up status response.
 */
export const slackFollowUpStatusResponseSchema = z.object({
  id: z.string(),
  habit_id: z.string(),
  date: z.string(),
  reminder_sent_at: z.string().datetime().nullable().optional(),
  follow_up_sent_at: z.string().datetime().nullable().optional(),
  skipped: z.boolean().default(false),
  remind_later_at: z.string().datetime().nullable().optional(),
});

export type SlackFollowUpStatusResponse = z.infer<typeof slackFollowUpStatusResponseSchema>;

// ============================================================================
// OAuth Schemas
// ============================================================================

/**
 * Schema for OAuth state parameter.
 */
export const slackOAuthStateSchema = z.object({
  owner_type: z.string().default('user'),
  owner_id: z.string(),
  redirect_uri: z.string().url(),
  timestamp: z.number().int(),
});

export type SlackOAuthState = z.infer<typeof slackOAuthStateSchema>;

/**
 * Schema for Slack OAuth token exchange response.
 */
export const slackOAuthTokenResponseSchema = z.object({
  ok: z.boolean(),
  access_token: z.string().optional(),
  refresh_token: z.string().optional(),
  token_type: z.string().optional(),
  scope: z.string().optional(),
  bot_user_id: z.string().optional(),
  app_id: z.string().optional(),
  team: z.record(z.string()).optional(),
  authed_user: z.record(z.string()).optional(),
  error: z.string().optional(),
});

export type SlackOAuthTokenResponse = z.infer<typeof slackOAuthTokenResponseSchema>;
