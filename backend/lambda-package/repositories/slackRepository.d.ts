/**
 * Slack Repository
 *
 * Database operations for Slack connections, notification preferences, and follow-up status.
 *
 * Requirements: 3.1, 3.2, 3.3
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SlackConnectionCreate, SlackConnectionResponse, SlackPreferencesResponse, SlackPreferencesUpdate, SlackFollowUpStatusResponse } from '../schemas/slack.js';
/**
 * Type aliases for entities.
 */
export type SlackConnection = Record<string, unknown>;
export type SlackPreferences = Record<string, unknown>;
export type SlackFollowUpStatus = Record<string, unknown>;
/**
 * Repository for Slack-related database operations.
 */
export declare class SlackRepository {
    private readonly supabase;
    constructor(supabase: SupabaseClient);
    /**
     * Create a new Slack connection or update existing one.
     */
    createConnection(ownerType: string, ownerId: string, connectionData: SlackConnectionCreate): Promise<SlackConnectionResponse>;
    /**
     * Get Slack connection for an owner.
     */
    getConnection(ownerType: string, ownerId: string): Promise<SlackConnectionResponse | null>;
    /**
     * Get Slack connection by Slack user and team ID.
     */
    getConnectionBySlackUser(slackUserId: string, slackTeamId: string): Promise<SlackConnectionResponse | null>;
    /**
     * Get Slack connection by Slack user ID only.
     */
    getConnectionBySlackUserId(slackUserId: string): Promise<SlackConnection | null>;
    /**
     * Get Slack connection including encrypted tokens.
     */
    getConnectionWithTokens(ownerType: string, ownerId: string): Promise<SlackConnection | null>;
    /**
     * Update a Slack connection.
     */
    updateConnection(ownerType: string, ownerId: string, updates: Record<string, unknown>): Promise<SlackConnectionResponse | null>;
    /**
     * Delete a Slack connection.
     */
    deleteConnection(ownerType: string, ownerId: string): Promise<boolean>;
    /**
     * Mark a Slack connection as invalid.
     */
    markConnectionInvalid(ownerType: string, ownerId: string): Promise<boolean>;
    /**
     * Get all valid connections with weekly reports enabled for given day/time.
     */
    getValidConnectionsForReports(_reportDay: number, _reportTime: string): Promise<SlackConnection[]>;
    /**
     * Get Slack notification preferences.
     * Note: notification_preferences table uses user_id column (not owner_type/owner_id)
     */
    getPreferences(_ownerType: string, ownerId: string): Promise<SlackPreferencesResponse | null>;
    /**
     * Update Slack notification preferences.
     * Note: notification_preferences table uses user_id column (not owner_type/owner_id)
     */
    updatePreferences(_ownerType: string, ownerId: string, preferences: SlackPreferencesUpdate): Promise<SlackPreferencesResponse>;
    /**
     * Get follow-up status for a habit on a specific date.
     */
    getFollowUpStatus(ownerType: string, ownerId: string, habitId: string, statusDate: string): Promise<SlackFollowUpStatusResponse | null>;
    /**
     * Create or update follow-up status.
     */
    createOrUpdateFollowUpStatus(ownerType: string, ownerId: string, habitId: string, statusDate: string, updates: Record<string, unknown>): Promise<SlackFollowUpStatusResponse>;
    /**
     * Mark that a reminder was sent.
     */
    markReminderSent(ownerType: string, ownerId: string, habitId: string, statusDate: string): Promise<SlackFollowUpStatusResponse>;
    /**
     * Mark that a follow-up was sent.
     */
    markFollowUpSent(ownerType: string, ownerId: string, habitId: string, statusDate: string): Promise<SlackFollowUpStatusResponse>;
    /**
     * Mark that user skipped this habit today.
     */
    markSkipped(ownerType: string, ownerId: string, habitId: string, statusDate: string): Promise<SlackFollowUpStatusResponse>;
    /**
     * Set remind later time.
     */
    setRemindLater(ownerType: string, ownerId: string, habitId: string, statusDate: string, remindAt: Date): Promise<SlackFollowUpStatusResponse>;
    /**
     * Get habits that need follow-up messages.
     */
    getHabitsNeedingFollowUp(statusDate: string): Promise<SlackFollowUpStatus[]>;
    /**
     * Get habits where remind_later_at has passed.
     */
    getHabitsNeedingRemindLater(currentTime: Date): Promise<SlackFollowUpStatus[]>;
}
//# sourceMappingURL=slackRepository.d.ts.map