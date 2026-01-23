/**
 * Slack Block Kit Message Builder
 *
 * Utility for building rich Slack messages using Block Kit.
 * Ported from Python implementation.
 */
/**
 * Data structure for weekly report.
 */
export interface WeeklyReportData {
    totalHabits: number;
    completedHabits: number;
    completionRate: number;
    bestStreak: number;
    bestStreakHabit: string;
    habitsNeedingAttention: string[];
    weekStart: Date;
    weekEnd: Date;
}
/**
 * Block Kit block type.
 */
export type SlackBlock = Record<string, unknown>;
/**
 * Utility class for building Slack Block Kit messages.
 */
export declare class SlackBlockBuilder {
    /**
     * Generate a text-based progress bar with color coding.
     *
     * @param progressRate - Progress percentage (0-100+)
     * @returns String with colored block characters (10 segments)
     *
     * Color coding:
     * - >= 100%: 🟩 (green)
     * - 75-99%: 🟦 (blue)
     * - 50-74%: 🟨 (yellow)
     * - < 50%: 🟥 (red)
     *
     * Empty segments use ⬜
     */
    static progressBar(progressRate: number): string;
    /**
     * Generate streak display string with appropriate emoji.
     *
     * @param streak - Current streak count (number of consecutive days)
     * @returns Formatted string with streak count and emoji
     */
    static streakDisplay(streak: number): string;
    /**
     * Create a section block.
     */
    static section(text: string, accessory?: SlackBlock): SlackBlock;
    /**
     * Create a divider block.
     */
    static divider(): SlackBlock;
    /**
     * Create a header block.
     */
    static header(text: string): SlackBlock;
    /**
     * Create an actions block.
     */
    static actions(elements: SlackBlock[]): SlackBlock;
    /**
     * Create a button element.
     */
    static button(text: string, actionId: string, value: string, style?: 'primary' | 'danger', url?: string): SlackBlock;
    /**
     * Create a context block.
     */
    static context(elements: string[]): SlackBlock;
    /**
     * Build formatted weekly report with View Full Report button.
     *
     * @param report - Weekly report data
     * @param appUrl - URL to the full report in the app
     * @returns List of Block Kit blocks
     */
    static weeklyReport(report: WeeklyReportData, appUrl: string): SlackBlock[];
    /**
     * Build message for users with no activity.
     *
     * @param appUrl - URL to the app
     * @returns List of Block Kit blocks
     */
    static weeklyReportNoActivity(appUrl: string): SlackBlock[];
    /**
     * Build message for user not connected to Slack.
     */
    static notConnected(): SlackBlock[];
    /**
     * Build error message with optional suggestions.
     */
    static errorMessage(message: string, suggestions?: string[]): SlackBlock[];
    /**
     * Build confirmation message after habit completion.
     *
     * @param habitName - Name of the completed habit
     * @param streak - Current streak count
     * @returns List of Block Kit blocks
     */
    static habitCompletionConfirm(habitName: string, streak: number): SlackBlock[];
    /**
     * Build message for already completed habit.
     */
    static habitAlreadyCompleted(habitName: string): SlackBlock[];
    /**
     * Build message for habit not found.
     */
    static habitNotFound(habitName: string, similarHabits?: string[]): SlackBlock[];
    /**
     * Build message for skipped habit.
     */
    static habitSkipped(habitName: string): SlackBlock[];
    /**
     * Build message for remind later.
     */
    static habitRemindLater(habitName: string, minutes?: number): SlackBlock[];
    /**
     * Build interactive list of habits with completion buttons.
     *
     * @param habits - List of habit objects with id, name, streak, completed, goal_name
     * @param showButtons - Whether to show completion buttons
     * @returns List of Block Kit blocks
     */
    static habitList(habits: Array<{
        id: string;
        name: string;
        streak?: number | undefined;
        completed?: boolean | undefined;
        goal_name?: string | undefined;
    }>, showButtons?: boolean): SlackBlock[];
    /**
     * Build status summary with habit details.
     *
     * @param completed - Number of completed habits
     * @param total - Total number of habits
     * @param habits - List of habit objects
     * @returns List of Block Kit blocks
     */
    static habitStatus(completed: number, total: number, habits: Array<{
        id: string;
        name: string;
        completed?: boolean;
    }>): SlackBlock[];
    /**
     * Build help message with available commands.
     */
    static availableCommands(): SlackBlock[];
    /**
     * Build dashboard message for users with no active habits.
     */
    static dashboardEmpty(): SlackBlock[];
    /**
     * Build error message for dashboard errors.
     */
    static dashboardError(message: string): SlackBlock[];
}
//# sourceMappingURL=slackBlockBuilder.d.ts.map