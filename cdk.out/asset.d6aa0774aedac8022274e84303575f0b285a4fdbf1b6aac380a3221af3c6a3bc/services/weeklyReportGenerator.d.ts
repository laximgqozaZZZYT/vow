/**
 * Weekly Report Generator
 *
 * Compiles and sends weekly summary reports via Slack.
 * Supports timezone-aware report scheduling.
 *
 * This service handles report generation and scheduling logic,
 * delegating all database operations to injected repositories.
 *
 * Requirements:
 * - 9.1: THE Weekly_Report_Generator SHALL handle only report generation and scheduling
 * - 9.2: WHEN services need database access, THE Backend_API SHALL inject repositories as dependencies
 * - 9.3: Send weekly report when user's weekly_report_day and weekly_report_time arrive
 * - 9.4: Include completion rate, completed/total count, best streak, habits needing attention
 * - 9.5: Do not send report if weekly_slack_report_enabled is false
 * - 9.6: Include link button to detailed report in app
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SlackRepository } from '../repositories/slackRepository';
import type { HabitRepository } from '../repositories/habitRepository';
import type { ActivityRepository } from '../repositories/activityRepository';
import type { SlackIntegrationService } from './slackService';
import { type WeeklyReportData } from './slackBlockBuilder';
/**
 * Service for generating and sending weekly habit reports.
 *
 * This service is responsible for:
 * - Generating weekly statistics for habits
 * - Sending weekly reports via Slack
 * - Scheduling reports based on user timezone and preferences
 *
 * All database operations are delegated to injected repositories,
 * following the dependency injection pattern for testability.
 *
 * Requirements:
 * - 9.1: THE Weekly_Report_Generator SHALL handle only report generation and scheduling
 */
export declare class WeeklyReportGenerator {
    private readonly slackRepo;
    private readonly habitRepo;
    private readonly activityRepo;
    private readonly slackService;
    private readonly appUrl;
    /**
     * Initialize the WeeklyReportGenerator with injected repositories.
     *
     * @param slackRepo - Repository for Slack-related database operations.
     * @param habitRepo - Repository for habit database operations.
     * @param activityRepo - Repository for activity database operations.
     * @param slackService - Service for Slack API interactions (optional, uses singleton if not provided).
     * @param appUrl - Base URL for the application (default: "https://vow.app").
     */
    constructor(slackRepo: SlackRepository, habitRepo: HabitRepository, activityRepo: ActivityRepository, slackService?: SlackIntegrationService, appUrl?: string);
    /**
     * Generate weekly statistics for a user.
     *
     * Calculates completion rate, best streak, and identifies habits needing
     * attention for the specified week. Uses injected repositories for all
     * database operations.
     *
     * @param ownerId - User ID.
     * @param ownerType - Type of owner (default: "user").
     * @param weekEnd - End date of the week (default: today).
     * @returns WeeklyReportData with statistics including completion rate,
     *          best streak, and habits needing attention.
     * @throws DataFetchError if database operations fail.
     */
    generateReport(ownerId: string, ownerType?: string, weekEnd?: Date): Promise<WeeklyReportData>;
    /**
     * Generate and send weekly report to a user via Slack.
     *
     * Checks user preferences, retrieves Slack connection, generates the report,
     * and sends it via Slack DM. Uses injected repositories for all database
     * operations.
     *
     * Requirements:
     * - 9.5: Do not send report if weekly_slack_report_enabled is false
     * - 9.6: Include link button to detailed report in app
     *
     * @param ownerId - User ID.
     * @param ownerType - Type of owner (default: "user").
     * @returns True if sent successfully, False otherwise.
     */
    sendWeeklyReport(ownerId: string, ownerType?: string): Promise<boolean>;
    /**
     * Send weekly reports to all users with enabled preference.
     *
     * This method checks each user's timezone and sends reports
     * when the user's local time matches their configured weekly_report_day
     * and weekly_report_time.
     *
     * Requirements:
     * - 9.3: Send weekly report when user's weekly_report_day and weekly_report_time arrive
     *
     * @param supabaseClient - Optional Supabase client for user timezone lookup.
     *                         If not provided, uses default timezone.
     * @returns Count of reports sent.
     */
    sendAllWeeklyReports(supabaseClient?: SupabaseClient): Promise<number>;
    /**
     * Get user's timezone setting.
     *
     * Note: This method requires a Supabase client for user table access.
     * The user table is not managed by the repositories in this service,
     * so we accept an optional client parameter for this lookup.
     *
     * Uses Asia/Tokyo as default timezone if not set.
     *
     * @param userId - User ID to look up.
     * @param supabaseClient - Optional Supabase client for user lookup.
     * @returns Timezone string (defaults to 'Asia/Tokyo' if not set or client not provided).
     */
    private getUserTimezone;
    /**
     * Get the current time in a specific timezone.
     *
     * @param date - The date to convert.
     * @param timezone - The timezone string (e.g., 'Asia/Tokyo').
     * @returns A Date object representing the time in the specified timezone.
     */
    private getTimeInTimezone;
    /**
     * Get all activities for a week using the activity repository.
     *
     * Converts date boundaries to datetime for the repository query.
     *
     * @param ownerType - Type of owner (e.g., "user").
     * @param ownerId - User ID.
     * @param weekStart - Start date of the week (Monday).
     * @param weekEnd - End date of the week.
     * @returns List of activity objects for the week.
     */
    private getActivitiesForWeek;
    /**
     * Calculate current streak for a habit using the activity repository.
     *
     * Counts consecutive days with at least one completion activity,
     * ending today or yesterday.
     *
     * @param habitId - ID of the habit.
     * @param ownerType - Type of owner.
     * @param ownerId - User ID.
     * @returns Current streak count (0 if no completions).
     */
    private calculateStreak;
}
//# sourceMappingURL=weeklyReportGenerator.d.ts.map