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
import { getSlackService } from './slackService';
import { SlackBlockBuilder } from './slackBlockBuilder';
import { decryptToken } from '../utils/encryption';
import { DataFetchError } from '../errors';
import { getLogger } from '../utils/logger';
const logger = getLogger('weeklyReportGenerator');
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
export class WeeklyReportGenerator {
    slackRepo;
    habitRepo;
    activityRepo;
    slackService;
    appUrl;
    /**
     * Initialize the WeeklyReportGenerator with injected repositories.
     *
     * @param slackRepo - Repository for Slack-related database operations.
     * @param habitRepo - Repository for habit database operations.
     * @param activityRepo - Repository for activity database operations.
     * @param slackService - Service for Slack API interactions (optional, uses singleton if not provided).
     * @param appUrl - Base URL for the application (default: "https://vow.app").
     */
    constructor(slackRepo, habitRepo, activityRepo, slackService, appUrl = 'https://vow.app') {
        this.slackRepo = slackRepo;
        this.habitRepo = habitRepo;
        this.activityRepo = activityRepo;
        this.slackService = slackService ?? getSlackService();
        this.appUrl = appUrl;
    }
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
    async generateReport(ownerId, ownerType = 'user', weekEnd) {
        try {
            const endDate = weekEnd ?? new Date();
            // Calculate week start (Monday)
            const weekStart = new Date(endDate);
            weekStart.setDate(endDate.getDate() - endDate.getDay() + (endDate.getDay() === 0 ? -6 : 1));
            weekStart.setHours(0, 0, 0, 0);
            // Get all habits for the user using repository
            const habits = await this.habitRepo.getByOwner(ownerType, ownerId, true);
            if (habits.length === 0) {
                return {
                    totalHabits: 0,
                    completedHabits: 0,
                    completionRate: 0,
                    bestStreak: 0,
                    bestStreakHabit: '',
                    habitsNeedingAttention: [],
                    weekStart,
                    weekEnd: endDate,
                };
            }
            // Get activities for the week using repository
            const activities = await this.getActivitiesForWeek(ownerType, ownerId, weekStart, endDate);
            // Calculate statistics
            const totalPossible = habits.length * 7; // 7 days
            // Activities are already filtered by kind='complete' in getActivitiesForWeek
            const completedCount = activities.length;
            const completionRate = totalPossible > 0 ? (completedCount / totalPossible) * 100 : 0;
            // Calculate streaks and find best
            let bestStreak = 0;
            let bestStreakHabit = '';
            const habitsNeedingAttention = [];
            for (const habit of habits) {
                const streak = await this.calculateStreak(habit.id, ownerType, ownerId);
                if (streak > bestStreak) {
                    bestStreak = streak;
                    bestStreakHabit = habit.name;
                }
                // Check if habit needs attention (completed less than 50% this week)
                // Activities are already filtered by kind='complete'
                const habitActivities = activities.filter((a) => a.habit_id === habit.id);
                if (habitActivities.length < 4) {
                    // Less than 4 out of 7 days
                    habitsNeedingAttention.push(habit.name);
                }
            }
            return {
                totalHabits: totalPossible,
                completedHabits: completedCount,
                completionRate,
                bestStreak,
                bestStreakHabit,
                habitsNeedingAttention: habitsNeedingAttention.slice(0, 5), // Limit to 5
                weekStart,
                weekEnd: endDate,
            };
        }
        catch (error) {
            throw new DataFetchError(`Failed to generate weekly report: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error : undefined);
        }
    }
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
    async sendWeeklyReport(ownerId, ownerType = 'user') {
        try {
            // Check user preferences using repository
            const prefs = await this.slackRepo.getPreferences(ownerType, ownerId);
            if (!prefs || !prefs.weekly_slack_report_enabled) {
                return false;
            }
            // Get Slack connection using repository
            const connection = await this.slackRepo.getConnectionWithTokens(ownerType, ownerId);
            if (!connection || !connection['is_valid']) {
                return false;
            }
            const encryptedToken = connection['access_token'];
            const slackUserId = connection['slack_user_id'];
            if (!encryptedToken || !slackUserId) {
                return false;
            }
            const token = await decryptToken(encryptedToken);
            // Get DM channel
            const channel = await this.slackService.getUserDmChannel(token, slackUserId);
            if (!channel) {
                return false;
            }
            // Generate report
            const report = await this.generateReport(ownerId, ownerType);
            // Build message
            const reportUrl = `${this.appUrl}/dashboard?view=weekly-review`;
            let blocks;
            let text;
            if (report.totalHabits === 0) {
                blocks = SlackBlockBuilder.weeklyReportNoActivity(`${this.appUrl}/dashboard`);
                text = 'Your weekly report is ready!';
            }
            else {
                blocks = SlackBlockBuilder.weeklyReport(report, reportUrl);
                text = `Weekly Report: ${Math.round(report.completionRate)}% completion rate`;
            }
            const message = {
                channel,
                text,
                blocks,
            };
            const response = await this.slackService.sendMessage(token, message);
            return response.ok;
        }
        catch (error) {
            logger.error(`Error sending weekly report for ${ownerId}`, error instanceof Error ? error : new Error(String(error)));
            return false;
        }
    }
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
    async sendAllWeeklyReports(supabaseClient) {
        let sentCount = 0;
        // Get all valid Slack connections with report preferences using repository
        const connections = await this.slackRepo.getValidConnectionsForReports(0, // Filtering done in service layer
        '00:00' // Filtering done in service layer
        );
        for (const connection of connections) {
            const ownerType = connection['owner_type'] ?? 'user';
            const ownerId = connection['owner_id'];
            if (!ownerId) {
                continue;
            }
            try {
                // Check preferences using repository
                const prefs = await this.slackRepo.getPreferences(ownerType, ownerId);
                if (!prefs) {
                    continue;
                }
                if (!prefs.weekly_slack_report_enabled) {
                    continue;
                }
                // Get user's timezone (Requirement 7.3)
                const userTz = await this.getUserTimezone(ownerId, supabaseClient);
                // Calculate current time in user's timezone
                const currentTimeUtc = new Date();
                const currentTimeLocal = this.getTimeInTimezone(currentTimeUtc, userTz);
                // Get current day in user's timezone
                // Convert JS weekday (0=Sunday) to our format (0=Sunday)
                const currentDay = currentTimeLocal.getDay();
                // Check if it's the right day
                if (prefs.weekly_report_day !== currentDay) {
                    continue;
                }
                // Check time (within 15 minute window)
                const reportTime = prefs.weekly_report_time;
                try {
                    const timeParts = reportTime.split(':');
                    if (timeParts.length < 2) {
                        continue;
                    }
                    const reportHourStr = timeParts[0] ?? '0';
                    const reportMinuteStr = timeParts[1] ?? '0';
                    const reportHour = parseInt(reportHourStr, 10);
                    const reportMinute = parseInt(reportMinuteStr, 10);
                    if (isNaN(reportHour) || isNaN(reportMinute)) {
                        continue;
                    }
                    const currentHour = currentTimeLocal.getHours();
                    const currentMinute = currentTimeLocal.getMinutes();
                    // Check if within 15 minute window
                    const reportMinutes = reportHour * 60 + reportMinute;
                    const currentMinutes = currentHour * 60 + currentMinute;
                    if (Math.abs(currentMinutes - reportMinutes) > 15) {
                        continue;
                    }
                }
                catch {
                    continue;
                }
                // Send report
                const success = await this.sendWeeklyReport(ownerId, ownerType);
                if (success) {
                    sentCount++;
                }
            }
            catch (error) {
                logger.error(`Error processing weekly report for ${ownerId}`, error instanceof Error ? error : new Error(String(error)));
                continue;
            }
        }
        return sentCount;
    }
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
    async getUserTimezone(userId, supabaseClient) {
        if (!supabaseClient) {
            return 'Asia/Tokyo';
        }
        try {
            const { data, error } = await supabaseClient
                .from('users')
                .select('timezone')
                .eq('id', userId)
                .single();
            if (error || !data) {
                return 'Asia/Tokyo';
            }
            const timezone = data['timezone'];
            return timezone ?? 'Asia/Tokyo';
        }
        catch (error) {
            logger.warning(`Failed to get timezone for user ${userId}`, {
                error: error instanceof Error ? error.message : String(error),
            });
            return 'Asia/Tokyo';
        }
    }
    /**
     * Get the current time in a specific timezone.
     *
     * @param date - The date to convert.
     * @param timezone - The timezone string (e.g., 'Asia/Tokyo').
     * @returns A Date object representing the time in the specified timezone.
     */
    getTimeInTimezone(date, timezone) {
        try {
            // Use Intl.DateTimeFormat to get the time in the specified timezone
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: timezone,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
            });
            const parts = formatter.formatToParts(date);
            const getPart = (type) => parts.find((p) => p.type === type)?.value ?? '0';
            const year = parseInt(getPart('year'), 10);
            const month = parseInt(getPart('month'), 10) - 1; // JS months are 0-indexed
            const day = parseInt(getPart('day'), 10);
            const hour = parseInt(getPart('hour'), 10);
            const minute = parseInt(getPart('minute'), 10);
            const second = parseInt(getPart('second'), 10);
            return new Date(year, month, day, hour, minute, second);
        }
        catch {
            // If timezone is invalid, return the original date
            return date;
        }
    }
    // ========================================================================
    // Private Helper Methods
    // ========================================================================
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
    async getActivitiesForWeek(ownerType, ownerId, weekStart, weekEnd) {
        try {
            // Set time boundaries
            const startDt = new Date(weekStart);
            startDt.setHours(0, 0, 0, 0);
            const endDt = new Date(weekEnd);
            endDt.setHours(23, 59, 59, 999);
            // Use activity repository to get activities in range
            const activities = await this.activityRepo.getActivitiesInRange(ownerType, ownerId, startDt, endDt, 'complete');
            return activities;
        }
        catch (error) {
            logger.warning(`Failed to get activities for week`, {
                error: error instanceof Error ? error.message : String(error),
            });
            return [];
        }
    }
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
    async calculateStreak(habitId, _ownerType, _ownerId) {
        try {
            // Use activity repository to get habit activities
            const activities = await this.activityRepo.getHabitActivities(habitId, 'complete', 365);
            if (activities.length === 0) {
                return 0;
            }
            let streak = 0;
            let expectedDate = new Date();
            expectedDate.setHours(0, 0, 0, 0);
            const seenDates = new Set();
            for (const activity of activities) {
                // Extract date from timestamp
                const timestampStr = activity.timestamp;
                if (!timestampStr) {
                    continue;
                }
                let activityDate;
                try {
                    activityDate = new Date(timestampStr);
                    activityDate.setHours(0, 0, 0, 0);
                }
                catch {
                    continue;
                }
                // Create date key for comparison
                const dateKey = activityDate.toISOString().slice(0, 10);
                // Skip if we've already counted this date
                if (seenDates.has(dateKey)) {
                    continue;
                }
                seenDates.add(dateKey);
                const expectedDateKey = expectedDate.toISOString().slice(0, 10);
                const yesterdayDate = new Date(expectedDate);
                yesterdayDate.setDate(yesterdayDate.getDate() - 1);
                const yesterdayKey = yesterdayDate.toISOString().slice(0, 10);
                if (streak === 0 && dateKey === expectedDateKey) {
                    streak = 1;
                    expectedDate.setDate(expectedDate.getDate() - 1);
                }
                else if (streak === 0 && dateKey === yesterdayKey) {
                    streak = 1;
                    expectedDate = new Date(activityDate);
                    expectedDate.setDate(expectedDate.getDate() - 1);
                }
                else if (dateKey === expectedDate.toISOString().slice(0, 10)) {
                    streak++;
                    expectedDate.setDate(expectedDate.getDate() - 1);
                }
                else {
                    break;
                }
            }
            return streak;
        }
        catch (error) {
            logger.warning(`Failed to calculate streak for habit ${habitId}`, {
                error: error instanceof Error ? error.message : String(error),
            });
            return 0;
        }
    }
}
//# sourceMappingURL=weeklyReportGenerator.js.map