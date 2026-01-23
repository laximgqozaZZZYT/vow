/**
 * Slack Integration Schemas
 *
 * Zod schemas for Slack OAuth, webhooks, and preferences.
 *
 * Requirements: 9.3
 */
import { z } from 'zod';
/**
 * Schema for creating a new Slack connection.
 */
export declare const slackConnectionCreateSchema: z.ZodObject<{
    slack_user_id: z.ZodString;
    slack_team_id: z.ZodString;
    slack_team_name: z.ZodOptional<z.ZodString>;
    slack_user_name: z.ZodOptional<z.ZodString>;
    access_token: z.ZodString;
    refresh_token: z.ZodOptional<z.ZodString>;
    bot_access_token: z.ZodOptional<z.ZodString>;
    token_expires_at: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    slack_user_id: string;
    slack_team_id: string;
    access_token: string;
    slack_team_name?: string | undefined;
    slack_user_name?: string | undefined;
    refresh_token?: string | undefined;
    bot_access_token?: string | undefined;
    token_expires_at?: string | undefined;
}, {
    slack_user_id: string;
    slack_team_id: string;
    access_token: string;
    slack_team_name?: string | undefined;
    slack_user_name?: string | undefined;
    refresh_token?: string | undefined;
    bot_access_token?: string | undefined;
    token_expires_at?: string | undefined;
}>;
export type SlackConnectionCreate = z.infer<typeof slackConnectionCreateSchema>;
/**
 * Schema for Slack connection response (excludes sensitive tokens).
 */
export declare const slackConnectionResponseSchema: z.ZodObject<{
    id: z.ZodString;
    owner_type: z.ZodString;
    owner_id: z.ZodString;
    slack_user_id: z.ZodString;
    slack_team_id: z.ZodString;
    slack_team_name: z.ZodNullable<z.ZodString>;
    slack_user_name: z.ZodNullable<z.ZodString>;
    connected_at: z.ZodString;
    is_valid: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    id: string;
    slack_user_id: string;
    slack_team_id: string;
    slack_team_name: string | null;
    slack_user_name: string | null;
    owner_type: string;
    owner_id: string;
    connected_at: string;
    is_valid: boolean;
}, {
    id: string;
    slack_user_id: string;
    slack_team_id: string;
    slack_team_name: string | null;
    slack_user_name: string | null;
    owner_type: string;
    owner_id: string;
    connected_at: string;
    is_valid: boolean;
}>;
export type SlackConnectionResponse = z.infer<typeof slackConnectionResponseSchema>;
/**
 * Schema for checking Slack connection status.
 */
export declare const slackConnectionStatusSchema: z.ZodObject<{
    connected: z.ZodBoolean;
    connection: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        owner_type: z.ZodString;
        owner_id: z.ZodString;
        slack_user_id: z.ZodString;
        slack_team_id: z.ZodString;
        slack_team_name: z.ZodNullable<z.ZodString>;
        slack_user_name: z.ZodNullable<z.ZodString>;
        connected_at: z.ZodString;
        is_valid: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        id: string;
        slack_user_id: string;
        slack_team_id: string;
        slack_team_name: string | null;
        slack_user_name: string | null;
        owner_type: string;
        owner_id: string;
        connected_at: string;
        is_valid: boolean;
    }, {
        id: string;
        slack_user_id: string;
        slack_team_id: string;
        slack_team_name: string | null;
        slack_user_name: string | null;
        owner_type: string;
        owner_id: string;
        connected_at: string;
        is_valid: boolean;
    }>>>;
    preferences: z.ZodOptional<z.ZodNullable<z.ZodLazy<z.ZodObject<{
        slack_notifications_enabled: z.ZodDefault<z.ZodBoolean>;
        weekly_slack_report_enabled: z.ZodDefault<z.ZodBoolean>;
        weekly_report_day: z.ZodDefault<z.ZodNumber>;
        weekly_report_time: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        slack_notifications_enabled: boolean;
        weekly_slack_report_enabled: boolean;
        weekly_report_day: number;
        weekly_report_time: string;
    }, {
        slack_notifications_enabled?: boolean | undefined;
        weekly_slack_report_enabled?: boolean | undefined;
        weekly_report_day?: number | undefined;
        weekly_report_time?: string | undefined;
    }>>>>;
}, "strip", z.ZodTypeAny, {
    connected: boolean;
    connection?: {
        id: string;
        slack_user_id: string;
        slack_team_id: string;
        slack_team_name: string | null;
        slack_user_name: string | null;
        owner_type: string;
        owner_id: string;
        connected_at: string;
        is_valid: boolean;
    } | null | undefined;
    preferences?: {
        slack_notifications_enabled: boolean;
        weekly_slack_report_enabled: boolean;
        weekly_report_day: number;
        weekly_report_time: string;
    } | null | undefined;
}, {
    connected: boolean;
    connection?: {
        id: string;
        slack_user_id: string;
        slack_team_id: string;
        slack_team_name: string | null;
        slack_user_name: string | null;
        owner_type: string;
        owner_id: string;
        connected_at: string;
        is_valid: boolean;
    } | null | undefined;
    preferences?: {
        slack_notifications_enabled?: boolean | undefined;
        weekly_slack_report_enabled?: boolean | undefined;
        weekly_report_day?: number | undefined;
        weekly_report_time?: string | undefined;
    } | null | undefined;
}>;
export type SlackConnectionStatus = z.infer<typeof slackConnectionStatusSchema>;
/**
 * Schema for updating Slack notification preferences.
 */
export declare const slackPreferencesUpdateSchema: z.ZodObject<{
    slack_notifications_enabled: z.ZodOptional<z.ZodBoolean>;
    weekly_slack_report_enabled: z.ZodOptional<z.ZodBoolean>;
    weekly_report_day: z.ZodOptional<z.ZodNumber>;
    weekly_report_time: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    slack_notifications_enabled?: boolean | undefined;
    weekly_slack_report_enabled?: boolean | undefined;
    weekly_report_day?: number | undefined;
    weekly_report_time?: string | undefined;
}, {
    slack_notifications_enabled?: boolean | undefined;
    weekly_slack_report_enabled?: boolean | undefined;
    weekly_report_day?: number | undefined;
    weekly_report_time?: string | undefined;
}>;
export type SlackPreferencesUpdate = z.infer<typeof slackPreferencesUpdateSchema>;
/**
 * Schema for Slack preferences response.
 */
export declare const slackPreferencesResponseSchema: z.ZodObject<{
    slack_notifications_enabled: z.ZodDefault<z.ZodBoolean>;
    weekly_slack_report_enabled: z.ZodDefault<z.ZodBoolean>;
    weekly_report_day: z.ZodDefault<z.ZodNumber>;
    weekly_report_time: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    slack_notifications_enabled: boolean;
    weekly_slack_report_enabled: boolean;
    weekly_report_day: number;
    weekly_report_time: string;
}, {
    slack_notifications_enabled?: boolean | undefined;
    weekly_slack_report_enabled?: boolean | undefined;
    weekly_report_day?: number | undefined;
    weekly_report_time?: string | undefined;
}>;
export type SlackPreferencesResponse = z.infer<typeof slackPreferencesResponseSchema>;
/**
 * Schema for Slack slash command payload.
 */
export declare const slashCommandPayloadSchema: z.ZodObject<{
    command: z.ZodString;
    text: z.ZodDefault<z.ZodString>;
    user_id: z.ZodString;
    team_id: z.ZodString;
    channel_id: z.ZodString;
    response_url: z.ZodString;
    trigger_id: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    command: string;
    text: string;
    user_id: string;
    team_id: string;
    channel_id: string;
    response_url: string;
    trigger_id?: string | undefined;
}, {
    command: string;
    user_id: string;
    team_id: string;
    channel_id: string;
    response_url: string;
    text?: string | undefined;
    trigger_id?: string | undefined;
}>;
export type SlashCommandPayload = z.infer<typeof slashCommandPayloadSchema>;
/**
 * Schema for user info in interaction payload.
 */
export declare const interactionUserSchema: z.ZodObject<{
    id: z.ZodString;
    username: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    name?: string | undefined;
    username?: string | undefined;
}, {
    id: string;
    name?: string | undefined;
    username?: string | undefined;
}>;
export type InteractionUser = z.infer<typeof interactionUserSchema>;
/**
 * Schema for team info in interaction payload.
 */
export declare const interactionTeamSchema: z.ZodObject<{
    id: z.ZodString;
    domain: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    domain?: string | undefined;
}, {
    id: string;
    domain?: string | undefined;
}>;
export type InteractionTeam = z.infer<typeof interactionTeamSchema>;
/**
 * Schema for action in interaction payload.
 */
export declare const interactionActionSchema: z.ZodObject<{
    action_id: z.ZodString;
    block_id: z.ZodOptional<z.ZodString>;
    type: z.ZodString;
    value: z.ZodOptional<z.ZodString>;
    selected_option: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    type: string;
    action_id: string;
    value?: string | undefined;
    block_id?: string | undefined;
    selected_option?: Record<string, unknown> | undefined;
}, {
    type: string;
    action_id: string;
    value?: string | undefined;
    block_id?: string | undefined;
    selected_option?: Record<string, unknown> | undefined;
}>;
export type InteractionAction = z.infer<typeof interactionActionSchema>;
/**
 * Schema for Slack interactive component payload.
 */
export declare const interactionPayloadSchema: z.ZodObject<{
    type: z.ZodString;
    user: z.ZodObject<{
        id: z.ZodString;
        username: z.ZodOptional<z.ZodString>;
        name: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name?: string | undefined;
        username?: string | undefined;
    }, {
        id: string;
        name?: string | undefined;
        username?: string | undefined;
    }>;
    team: z.ZodObject<{
        id: z.ZodString;
        domain: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        domain?: string | undefined;
    }, {
        id: string;
        domain?: string | undefined;
    }>;
    actions: z.ZodArray<z.ZodObject<{
        action_id: z.ZodString;
        block_id: z.ZodOptional<z.ZodString>;
        type: z.ZodString;
        value: z.ZodOptional<z.ZodString>;
        selected_option: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        type: string;
        action_id: string;
        value?: string | undefined;
        block_id?: string | undefined;
        selected_option?: Record<string, unknown> | undefined;
    }, {
        type: string;
        action_id: string;
        value?: string | undefined;
        block_id?: string | undefined;
        selected_option?: Record<string, unknown> | undefined;
    }>, "many">;
    response_url: z.ZodString;
    trigger_id: z.ZodString;
    container: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    message: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    type: string;
    user: {
        id: string;
        name?: string | undefined;
        username?: string | undefined;
    };
    response_url: string;
    trigger_id: string;
    team: {
        id: string;
        domain?: string | undefined;
    };
    actions: {
        type: string;
        action_id: string;
        value?: string | undefined;
        block_id?: string | undefined;
        selected_option?: Record<string, unknown> | undefined;
    }[];
    message?: Record<string, unknown> | undefined;
    container?: Record<string, unknown> | undefined;
}, {
    type: string;
    user: {
        id: string;
        name?: string | undefined;
        username?: string | undefined;
    };
    response_url: string;
    trigger_id: string;
    team: {
        id: string;
        domain?: string | undefined;
    };
    actions: {
        type: string;
        action_id: string;
        value?: string | undefined;
        block_id?: string | undefined;
        selected_option?: Record<string, unknown> | undefined;
    }[];
    message?: Record<string, unknown> | undefined;
    container?: Record<string, unknown> | undefined;
}>;
export type InteractionPayload = z.infer<typeof interactionPayloadSchema>;
/**
 * Schema for Slack Events API payload.
 */
export declare const slackEventPayloadSchema: z.ZodObject<{
    type: z.ZodString;
    challenge: z.ZodOptional<z.ZodString>;
    token: z.ZodOptional<z.ZodString>;
    team_id: z.ZodOptional<z.ZodString>;
    event: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    type: string;
    team_id?: string | undefined;
    challenge?: string | undefined;
    token?: string | undefined;
    event?: Record<string, unknown> | undefined;
}, {
    type: string;
    team_id?: string | undefined;
    challenge?: string | undefined;
    token?: string | undefined;
    event?: Record<string, unknown> | undefined;
}>;
export type SlackEventPayload = z.infer<typeof slackEventPayloadSchema>;
/**
 * Schema for sending a Slack message.
 */
export declare const slackMessageSchema: z.ZodObject<{
    channel: z.ZodString;
    text: z.ZodString;
    blocks: z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>, "many">>;
    thread_ts: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    text: string;
    channel: string;
    blocks?: Record<string, unknown>[] | undefined;
    thread_ts?: string | undefined;
}, {
    text: string;
    channel: string;
    blocks?: Record<string, unknown>[] | undefined;
    thread_ts?: string | undefined;
}>;
export type SlackMessage = z.infer<typeof slackMessageSchema>;
/**
 * Schema for Slack message send response.
 */
export declare const slackMessageResponseSchema: z.ZodObject<{
    ok: z.ZodBoolean;
    channel: z.ZodOptional<z.ZodString>;
    ts: z.ZodOptional<z.ZodString>;
    message: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    error: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    ok: boolean;
    message?: Record<string, unknown> | undefined;
    error?: string | undefined;
    channel?: string | undefined;
    ts?: string | undefined;
}, {
    ok: boolean;
    message?: Record<string, unknown> | undefined;
    error?: string | undefined;
    channel?: string | undefined;
    ts?: string | undefined;
}>;
export type SlackMessageResponse = z.infer<typeof slackMessageResponseSchema>;
/**
 * Schema for creating follow-up status record.
 */
export declare const slackFollowUpStatusCreateSchema: z.ZodObject<{
    habit_id: z.ZodString;
    date: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    habit_id: string;
    date?: string | undefined;
}, {
    habit_id: string;
    date?: string | undefined;
}>;
export type SlackFollowUpStatusCreate = z.infer<typeof slackFollowUpStatusCreateSchema>;
/**
 * Schema for follow-up status response.
 */
export declare const slackFollowUpStatusResponseSchema: z.ZodObject<{
    id: z.ZodString;
    habit_id: z.ZodString;
    date: z.ZodString;
    reminder_sent_at: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    follow_up_sent_at: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    skipped: z.ZodDefault<z.ZodBoolean>;
    remind_later_at: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    date: string;
    habit_id: string;
    skipped: boolean;
    reminder_sent_at?: string | null | undefined;
    follow_up_sent_at?: string | null | undefined;
    remind_later_at?: string | null | undefined;
}, {
    id: string;
    date: string;
    habit_id: string;
    reminder_sent_at?: string | null | undefined;
    follow_up_sent_at?: string | null | undefined;
    skipped?: boolean | undefined;
    remind_later_at?: string | null | undefined;
}>;
export type SlackFollowUpStatusResponse = z.infer<typeof slackFollowUpStatusResponseSchema>;
/**
 * Schema for OAuth state parameter.
 */
export declare const slackOAuthStateSchema: z.ZodObject<{
    owner_type: z.ZodDefault<z.ZodString>;
    owner_id: z.ZodString;
    redirect_uri: z.ZodString;
    timestamp: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    timestamp: number;
    owner_type: string;
    owner_id: string;
    redirect_uri: string;
}, {
    timestamp: number;
    owner_id: string;
    redirect_uri: string;
    owner_type?: string | undefined;
}>;
export type SlackOAuthState = z.infer<typeof slackOAuthStateSchema>;
/**
 * Schema for Slack OAuth token exchange response.
 */
export declare const slackOAuthTokenResponseSchema: z.ZodObject<{
    ok: z.ZodBoolean;
    access_token: z.ZodOptional<z.ZodString>;
    refresh_token: z.ZodOptional<z.ZodString>;
    token_type: z.ZodOptional<z.ZodString>;
    scope: z.ZodOptional<z.ZodString>;
    bot_user_id: z.ZodOptional<z.ZodString>;
    app_id: z.ZodOptional<z.ZodString>;
    team: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    authed_user: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    error: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    ok: boolean;
    error?: string | undefined;
    access_token?: string | undefined;
    refresh_token?: string | undefined;
    team?: Record<string, string> | undefined;
    token_type?: string | undefined;
    scope?: string | undefined;
    bot_user_id?: string | undefined;
    app_id?: string | undefined;
    authed_user?: Record<string, string> | undefined;
}, {
    ok: boolean;
    error?: string | undefined;
    access_token?: string | undefined;
    refresh_token?: string | undefined;
    team?: Record<string, string> | undefined;
    token_type?: string | undefined;
    scope?: string | undefined;
    bot_user_id?: string | undefined;
    app_id?: string | undefined;
    authed_user?: Record<string, string> | undefined;
}>;
export type SlackOAuthTokenResponse = z.infer<typeof slackOAuthTokenResponseSchema>;
//# sourceMappingURL=slack.d.ts.map