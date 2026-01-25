/**
 * Slack Repository
 *
 * Database operations for Slack connections, notification preferences, and follow-up status.
 *
 * Requirements: 3.1, 3.2, 3.3
 */
/**
 * Repository for Slack-related database operations.
 */
export class SlackRepository {
    supabase;
    constructor(supabase) {
        this.supabase = supabase;
    }
    // ========================================================================
    // Slack Connections
    // ========================================================================
    /**
     * Create a new Slack connection or update existing one.
     */
    async createConnection(ownerType, ownerId, connectionData) {
        const data = {
            owner_type: ownerType,
            owner_id: ownerId,
            ...connectionData,
        };
        const { data: result, error } = await this.supabase
            .from('slack_connections')
            .upsert(data, { onConflict: 'owner_type,owner_id' })
            .select()
            .single();
        if (error || !result) {
            throw new Error(`Failed to create Slack connection: ${error?.message ?? 'Unknown error'}`);
        }
        return result;
    }
    /**
     * Get Slack connection for an owner.
     */
    async getConnection(ownerType, ownerId) {
        const { data, error } = await this.supabase
            .from('slack_connections')
            .select('*')
            .eq('owner_type', ownerType)
            .eq('owner_id', ownerId)
            .single();
        if (error || !data) {
            return null;
        }
        return data;
    }
    /**
     * Get Slack connection by Slack user and team ID.
     */
    async getConnectionBySlackUser(slackUserId, slackTeamId) {
        const { data, error } = await this.supabase
            .from('slack_connections')
            .select('*')
            .eq('slack_user_id', slackUserId)
            .eq('slack_team_id', slackTeamId)
            .single();
        if (error || !data) {
            return null;
        }
        return data;
    }
    /**
     * Get Slack connection by Slack user ID only.
     */
    async getConnectionBySlackUserId(slackUserId) {
        const { data, error } = await this.supabase
            .from('slack_connections')
            .select('*')
            .eq('slack_user_id', slackUserId)
            .eq('is_valid', true)
            .limit(1)
            .single();
        if (error || !data) {
            return null;
        }
        return data;
    }
    /**
     * Get Slack connection including encrypted tokens.
     */
    async getConnectionWithTokens(ownerType, ownerId) {
        const { data, error } = await this.supabase
            .from('slack_connections')
            .select('*')
            .eq('owner_type', ownerType)
            .eq('owner_id', ownerId)
            .single();
        if (error || !data) {
            return null;
        }
        return data;
    }
    /**
     * Update a Slack connection.
     */
    async updateConnection(ownerType, ownerId, updates) {
        const { data, error } = await this.supabase
            .from('slack_connections')
            .update(updates)
            .eq('owner_type', ownerType)
            .eq('owner_id', ownerId)
            .select()
            .single();
        if (error || !data) {
            return null;
        }
        return data;
    }
    /**
     * Delete a Slack connection.
     */
    async deleteConnection(ownerType, ownerId) {
        const { data, error } = await this.supabase
            .from('slack_connections')
            .delete()
            .eq('owner_type', ownerType)
            .eq('owner_id', ownerId)
            .select();
        if (error) {
            return false;
        }
        return Array.isArray(data) && data.length > 0;
    }
    /**
     * Mark a Slack connection as invalid.
     */
    async markConnectionInvalid(ownerType, ownerId) {
        const { data, error } = await this.supabase
            .from('slack_connections')
            .update({ is_valid: false })
            .eq('owner_type', ownerType)
            .eq('owner_id', ownerId)
            .select();
        if (error) {
            return false;
        }
        return Array.isArray(data) && data.length > 0;
    }
    /**
     * Get all valid connections with weekly reports enabled for given day/time.
     */
    async getValidConnectionsForReports(_reportDay, _reportTime) {
        const { data, error } = await this.supabase
            .from('slack_connections')
            .select('*')
            .eq('is_valid', true);
        if (error || !data) {
            return [];
        }
        return data;
    }
    // ========================================================================
    // Notification Preferences
    // ========================================================================
    /**
     * Get Slack notification preferences.
     * Note: notification_preferences table uses user_id column (not owner_type/owner_id)
     */
    async getPreferences(_ownerType, ownerId) {
        const { data, error } = await this.supabase
            .from('notification_preferences')
            .select('slack_enabled, slack_weekly_report, slack_notification_time')
            .eq('user_id', ownerId)
            .single();
        if (error || !data) {
            return null;
        }
        return {
            slack_notifications_enabled: data['slack_enabled'] ?? false,
            weekly_slack_report_enabled: data['slack_weekly_report'] ?? false,
            weekly_report_day: 0, // Not stored in new schema, default to Sunday
            weekly_report_time: String(data['slack_notification_time'] ?? '09:00'),
        };
    }
    /**
     * Update Slack notification preferences.
     * Note: notification_preferences table uses user_id column (not owner_type/owner_id)
     */
    async updatePreferences(_ownerType, ownerId, preferences) {
        const updates = {};
        if (preferences.slack_notifications_enabled !== undefined) {
            updates['slack_enabled'] = preferences.slack_notifications_enabled;
        }
        if (preferences.weekly_slack_report_enabled !== undefined) {
            updates['slack_weekly_report'] = preferences.weekly_slack_report_enabled;
        }
        if (preferences.weekly_report_time !== undefined) {
            updates['slack_notification_time'] = preferences.weekly_report_time;
        }
        const data = {
            user_id: ownerId,
            ...updates,
        };
        const { data: result, error } = await this.supabase
            .from('notification_preferences')
            .upsert(data, { onConflict: 'user_id' })
            .select()
            .single();
        if (error || !result) {
            throw new Error(`Failed to update preferences: ${error?.message ?? 'Unknown error'}`);
        }
        return {
            slack_notifications_enabled: result['slack_enabled'] ?? false,
            weekly_slack_report_enabled: result['slack_weekly_report'] ?? false,
            weekly_report_day: 0, // Not stored in new schema, default to Sunday
            weekly_report_time: String(result['slack_notification_time'] ?? '09:00'),
        };
    }
    // ========================================================================
    // Follow-Up Status
    // ========================================================================
    /**
     * Get follow-up status for a habit on a specific date.
     */
    async getFollowUpStatus(ownerType, ownerId, habitId, statusDate) {
        const { data, error } = await this.supabase
            .from('slack_follow_up_status')
            .select('*')
            .eq('owner_type', ownerType)
            .eq('owner_id', ownerId)
            .eq('habit_id', habitId)
            .eq('date', statusDate)
            .single();
        if (error || !data) {
            return null;
        }
        return data;
    }
    /**
     * Create or update follow-up status.
     */
    async createOrUpdateFollowUpStatus(ownerType, ownerId, habitId, statusDate, updates) {
        const data = {
            owner_type: ownerType,
            owner_id: ownerId,
            habit_id: habitId,
            date: statusDate,
            ...updates,
        };
        const { data: result, error } = await this.supabase
            .from('slack_follow_up_status')
            .upsert(data, { onConflict: 'owner_type,owner_id,habit_id,date' })
            .select()
            .single();
        if (error || !result) {
            throw new Error(`Failed to update follow-up status: ${error?.message ?? 'Unknown error'}`);
        }
        return result;
    }
    /**
     * Mark that a reminder was sent.
     */
    async markReminderSent(ownerType, ownerId, habitId, statusDate) {
        return this.createOrUpdateFollowUpStatus(ownerType, ownerId, habitId, statusDate, {
            reminder_sent_at: new Date().toISOString(),
        });
    }
    /**
     * Mark that a follow-up was sent.
     */
    async markFollowUpSent(ownerType, ownerId, habitId, statusDate) {
        return this.createOrUpdateFollowUpStatus(ownerType, ownerId, habitId, statusDate, {
            follow_up_sent_at: new Date().toISOString(),
        });
    }
    /**
     * Mark that user skipped this habit today.
     */
    async markSkipped(ownerType, ownerId, habitId, statusDate) {
        return this.createOrUpdateFollowUpStatus(ownerType, ownerId, habitId, statusDate, {
            skipped: true,
        });
    }
    /**
     * Set remind later time.
     */
    async setRemindLater(ownerType, ownerId, habitId, statusDate, remindAt) {
        return this.createOrUpdateFollowUpStatus(ownerType, ownerId, habitId, statusDate, {
            remind_later_at: remindAt.toISOString(),
        });
    }
    /**
     * Get habits that need follow-up messages.
     */
    async getHabitsNeedingFollowUp(statusDate) {
        const { data, error } = await this.supabase
            .from('slack_follow_up_status')
            .select('*')
            .eq('date', statusDate)
            .is('follow_up_sent_at', null)
            .eq('skipped', false);
        if (error || !data) {
            return [];
        }
        return data;
    }
    /**
     * Get habits where remind_later_at has passed.
     */
    async getHabitsNeedingRemindLater(currentTime) {
        const { data, error } = await this.supabase
            .from('slack_follow_up_status')
            .select('*')
            .lte('remind_later_at', currentTime.toISOString())
            .is('follow_up_sent_at', null)
            .eq('skipped', false);
        if (error || !data) {
            return [];
        }
        return data;
    }
}
//# sourceMappingURL=slackRepository.js.map