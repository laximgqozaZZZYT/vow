/**
 * Slack Block Kit Message Builder
 *
 * Utility for building rich Slack messages using Block Kit.
 * Ported from Python implementation.
 */
/**
 * Utility class for building Slack Block Kit messages.
 */
export class SlackBlockBuilder {
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
    static progressBar(progressRate) {
        // Calculate filled segments: min(10, max(0, floor(progressRate / 10)))
        const filledSegments = Math.min(10, Math.max(0, Math.floor(progressRate / 10)));
        const emptySegments = 10 - filledSegments;
        // Determine color based on progressRate
        let filledChar;
        if (progressRate >= 100) {
            filledChar = '🟩'; // Green
        }
        else if (progressRate >= 75) {
            filledChar = '🟦'; // Blue
        }
        else if (progressRate >= 50) {
            filledChar = '🟨'; // Yellow
        }
        else {
            filledChar = '🟥'; // Red
        }
        const emptyChar = '⬜';
        // Build progress bar string
        return filledChar.repeat(filledSegments) + emptyChar.repeat(emptySegments);
    }
    /**
     * Generate streak display string with appropriate emoji.
     *
     * @param streak - Current streak count (number of consecutive days)
     * @returns Formatted string with streak count and emoji
     */
    static streakDisplay(streak) {
        if (streak <= 0) {
            return '';
        }
        else if (streak >= 7) {
            return `🔥${streak}日`;
        }
        else if (streak >= 3) {
            return `✨${streak}日`;
        }
        else {
            return `${streak}日`;
        }
    }
    /**
     * Create a section block.
     */
    static section(text, accessory) {
        const block = {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text,
            },
        };
        if (accessory) {
            block['accessory'] = accessory;
        }
        return block;
    }
    /**
     * Create a divider block.
     */
    static divider() {
        return { type: 'divider' };
    }
    /**
     * Create a header block.
     */
    static header(text) {
        return {
            type: 'header',
            text: {
                type: 'plain_text',
                text,
                emoji: true,
            },
        };
    }
    /**
     * Create an actions block.
     */
    static actions(elements) {
        return {
            type: 'actions',
            elements,
        };
    }
    /**
     * Create a button element.
     */
    static button(text, actionId, value, style, url) {
        const button = {
            type: 'button',
            text: {
                type: 'plain_text',
                text,
                emoji: true,
            },
            action_id: actionId,
            value,
        };
        if (style) {
            button['style'] = style;
        }
        if (url) {
            button['url'] = url;
        }
        return button;
    }
    /**
     * Create a context block.
     */
    static context(elements) {
        return {
            type: 'context',
            elements: elements.map((text) => ({
                type: 'mrkdwn',
                text,
            })),
        };
    }
    // ========================================================================
    // Weekly Report Messages
    // ========================================================================
    /**
     * Build formatted weekly report with View Full Report button.
     *
     * @param report - Weekly report data
     * @param appUrl - URL to the full report in the app
     * @returns List of Block Kit blocks
     */
    static weeklyReport(report, appUrl) {
        // Determine emoji based on completion rate
        let emoji;
        let message;
        if (report.completionRate >= 80) {
            emoji = '🏆';
            message = '素晴らしい一週間でした！';
        }
        else if (report.completionRate >= 60) {
            emoji = '💪';
            message = '良い進捗です！';
        }
        else if (report.completionRate >= 40) {
            emoji = '📈';
            message = '勢いをつけていきましょう！';
        }
        else {
            emoji = '🌱';
            message = '一歩一歩が大切です！';
        }
        // Format dates
        const formatDate = (date) => {
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${month}/${day}`;
        };
        const blocks = [
            SlackBlockBuilder.header(`${emoji} 週次レポート`),
            SlackBlockBuilder.section(`*${formatDate(report.weekStart)} - ${formatDate(report.weekEnd)}*\n${message}`),
            SlackBlockBuilder.divider(),
            SlackBlockBuilder.section(`*📊 達成率:* ${Math.round(report.completionRate)}%\n` +
                `*✅ 完了した習慣:* ${report.completedHabits}/${report.totalHabits}\n` +
                `*🔥 最長ストリーク:* ${report.bestStreak}日 (${report.bestStreakHabit})`),
        ];
        if (report.habitsNeedingAttention.length > 0) {
            const attentionList = report.habitsNeedingAttention
                .slice(0, 3)
                .map((h) => `• ${h}`)
                .join('\n');
            blocks.push(SlackBlockBuilder.divider());
            blocks.push(SlackBlockBuilder.section(`*⚠️ 注意が必要な習慣:*\n${attentionList}`));
        }
        blocks.push(SlackBlockBuilder.divider());
        blocks.push(SlackBlockBuilder.actions([
            {
                type: 'button',
                text: {
                    type: 'plain_text',
                    text: '詳細レポートを見る',
                    emoji: true,
                },
                url: appUrl,
                action_id: 'view_full_report',
            },
        ]));
        return blocks;
    }
    /**
     * Build message for users with no activity.
     *
     * @param appUrl - URL to the app
     * @returns List of Block Kit blocks
     */
    static weeklyReportNoActivity(appUrl) {
        return [
            SlackBlockBuilder.header('📊 週次レポート'),
            SlackBlockBuilder.section('今週は習慣を記録していませんでした。' + '大丈夫です - 毎週が新しいスタートです！🌱'),
            SlackBlockBuilder.actions([
                {
                    type: 'button',
                    text: {
                        type: 'plain_text',
                        text: '習慣を追加',
                        emoji: true,
                    },
                    url: appUrl,
                    action_id: 'add_habits',
                    style: 'primary',
                },
            ]),
        ];
    }
    /**
     * Build message for user not connected to Slack.
     */
    static notConnected() {
        return [
            SlackBlockBuilder.section('🔗 SlackアカウントがまだVOWに接続されていません。\n' +
                '設定画面から接続して、Slackコマンドを使えるようにしましょう！'),
        ];
    }
    /**
     * Build error message with optional suggestions.
     */
    static errorMessage(message, suggestions) {
        const blocks = [SlackBlockBuilder.section(`❌ ${message}`)];
        if (suggestions && suggestions.length > 0) {
            const suggestionText = suggestions.map((s) => `• ${s}`).join('\n');
            blocks.push(SlackBlockBuilder.section(`*もしかして:*\n${suggestionText}`));
        }
        return blocks;
    }
    // ========================================================================
    // Habit Completion Messages
    // ========================================================================
    /**
     * Build confirmation message after habit completion.
     *
     * @param habitName - Name of the completed habit
     * @param streak - Current streak count
     * @returns List of Block Kit blocks
     */
    static habitCompletionConfirm(habitName, streak) {
        const streakEmoji = streak >= 7 ? '🔥' : streak >= 3 ? '✨' : '👍';
        const streakText = streak > 1 ? `${streakEmoji} ${streak}日連続達成！` : '';
        return [SlackBlockBuilder.section(`✅ *${habitName}* を完了しました！ ${streakText}`)];
    }
    /**
     * Build message for already completed habit.
     */
    static habitAlreadyCompleted(habitName) {
        return [
            SlackBlockBuilder.section(`ℹ️ *${habitName}* は今日すでに完了しています。その調子で頑張りましょう！`),
        ];
    }
    /**
     * Build message for habit not found.
     */
    static habitNotFound(habitName, similarHabits) {
        return SlackBlockBuilder.errorMessage(`*${habitName}* という名前の習慣が見つかりませんでした`, similarHabits);
    }
    /**
     * Build message for skipped habit.
     */
    static habitSkipped(habitName) {
        return [
            SlackBlockBuilder.section(`⏭️ *${habitName}* を今日はスキップしました。これ以上リマインドしません。`),
        ];
    }
    /**
     * Build message for remind later.
     */
    static habitRemindLater(habitName, minutes = 60) {
        return [
            SlackBlockBuilder.section(`⏰ 了解しました！${minutes}分後に *${habitName}* をリマインドします。`),
        ];
    }
    // ========================================================================
    // Habit List and Status Messages
    // ========================================================================
    /**
     * Build interactive list of habits with completion buttons.
     *
     * @param habits - List of habit objects with id, name, streak, completed, goal_name
     * @param showButtons - Whether to show completion buttons
     * @returns List of Block Kit blocks
     */
    static habitList(habits, showButtons = true) {
        if (!habits || habits.length === 0) {
            return [
                SlackBlockBuilder.section('📝 まだ習慣が登録されていません。アプリで習慣を追加して始めましょう！'),
            ];
        }
        const blocks = [SlackBlockBuilder.header('📋 あなたの習慣')];
        // Group by goal
        const goals = {};
        for (const habit of habits) {
            const goal = habit.goal_name ?? 'ゴールなし';
            if (!goals[goal]) {
                goals[goal] = [];
            }
            goals[goal].push(habit);
        }
        for (const [goalName, goalHabits] of Object.entries(goals)) {
            blocks.push(SlackBlockBuilder.section(`*${goalName}*`));
            for (const habit of goalHabits) {
                const status = habit.completed ? '✅' : '⬜';
                const streak = habit.streak ?? 0;
                const streakText = streak > 0 ? ` 🔥${streak}日` : '';
                const text = `${status} ${habit.name}${streakText}`;
                if (showButtons && !habit.completed) {
                    blocks.push({
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text,
                        },
                        accessory: SlackBlockBuilder.button('完了', `habit_done_${habit.id}`, habit.id, 'primary'),
                    });
                }
                else {
                    blocks.push(SlackBlockBuilder.section(text));
                }
            }
            blocks.push(SlackBlockBuilder.divider());
        }
        return blocks;
    }
    /**
     * Build status summary with habit details.
     *
     * @param completed - Number of completed habits
     * @param total - Total number of habits
     * @param habits - List of habit objects
     * @returns List of Block Kit blocks
     */
    static habitStatus(completed, total, habits) {
        const percentage = total > 0 ? (completed / total) * 100 : 0;
        // Progress bar
        const filled = Math.floor(percentage / 10);
        const progress = '█'.repeat(filled) + '░'.repeat(10 - filled);
        const blocks = [
            SlackBlockBuilder.header('📊 今日の進捗'),
            SlackBlockBuilder.section(`*${completed}/${total}* 習慣を完了 (${Math.round(percentage)}%)\n\`${progress}\``),
            SlackBlockBuilder.divider(),
        ];
        // List incomplete habits
        const incomplete = habits.filter((h) => !h.completed);
        if (incomplete.length > 0) {
            blocks.push(SlackBlockBuilder.section('*今日の残り:*'));
            for (const habit of incomplete.slice(0, 5)) {
                blocks.push({
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: `⬜ ${habit.name}`,
                    },
                    accessory: SlackBlockBuilder.button('完了', `habit_done_${habit.id}`, habit.id, 'primary'),
                });
            }
            if (incomplete.length > 5) {
                blocks.push(SlackBlockBuilder.context([`...他${incomplete.length - 5}件`]));
            }
        }
        return blocks;
    }
    /**
     * Build help message with available commands.
     */
    static availableCommands() {
        return [
            SlackBlockBuilder.header('📚 利用可能なコマンド'),
            SlackBlockBuilder.section('*`/habit-done [名前]`*\n' +
                '習慣を完了としてマークします。名前を省略すると、選択リストが表示されます。'),
            SlackBlockBuilder.section('*`/habit-status`*\n' + '今日の進捗と残りの習慣を確認します。'),
            SlackBlockBuilder.section('*`/habit-list`*\n' + 'ゴール別にグループ化された習慣一覧を表示します。'),
            SlackBlockBuilder.section('*`/habit-dashboard`*\n' + '今日の進捗ダッシュボードを表示します。'),
            SlackBlockBuilder.divider(),
            SlackBlockBuilder.section('*📊 ダッシュボードセクションコマンド*'),
            SlackBlockBuilder.section('*`/progress`* または *`/habit-progress`*\n' +
                '今日の進捗を詳細に表示します。'),
            SlackBlockBuilder.section('*`/stats`* または *`/habit-stats`*\n' +
                '統計サマリーとTOP3習慣を表示します。'),
            SlackBlockBuilder.section('*`/next`* または *`/nexts`* または *`/habit-next`*\n' +
                '24時間以内に予定されている習慣を表示します。'),
            SlackBlockBuilder.section('*`/stickies`*\n' +
                '付箋メモの一覧を表示します。'),
        ];
    }
    // ========================================================================
    // Dashboard Messages
    // ========================================================================
    /**
     * Build dashboard message for users with no active habits.
     */
    static dashboardEmpty() {
        return [
            SlackBlockBuilder.header('📊 今日の進捗'),
            SlackBlockBuilder.section('📝 まだ習慣が登録されていません。\nアプリで習慣を追加して始めましょう！'),
        ];
    }
    /**
     * Build error message for dashboard errors.
     */
    static dashboardError(message) {
        return [SlackBlockBuilder.section(`❌ ${message}`)];
    }
    // ========================================================================
    // Dashboard Section Command Messages
    // ========================================================================
    /**
     * Build progress dashboard message from DailyProgressData.
     *
     * Formats daily progress with header, summary, and habit list grouped by goal.
     * Includes completion buttons for incomplete habits.
     *
     * Requirements: 6.5 - Format dashboard data for Slack display
     *
     * @param data - DailyProgressData from DashboardDataService
     * @returns List of Block Kit blocks
     */
    static progressDashboard(data) {
        const blocks = [];
        // Header with date
        blocks.push(SlackBlockBuilder.header(`📊 今日の進捗 - ${data.dateDisplay}`));
        // Summary section
        const completionRateInt = Math.round(data.completionRate);
        const overallProgressBar = SlackBlockBuilder.progressBar(data.completionRate);
        const summaryText = `*${data.completedHabits}/${data.totalHabits}* 習慣を完了 (${completionRateInt}%)\n` +
            `\`${overallProgressBar}\``;
        blocks.push(SlackBlockBuilder.section(summaryText));
        blocks.push(SlackBlockBuilder.divider());
        // Filter incomplete habits
        const incompleteHabits = data.habits.filter((h) => !h.completed);
        // If all habits are completed
        if (incompleteHabits.length === 0) {
            blocks.push(SlackBlockBuilder.section('🎉 今日の習慣をすべて達成しました！素晴らしい！'));
            return blocks;
        }
        // Group by goal
        const goals = {};
        for (const habit of incompleteHabits) {
            const goalName = habit.goalName;
            if (!goals[goalName]) {
                goals[goalName] = [];
            }
            goals[goalName].push(habit);
        }
        // Build sections for each goal
        for (const [goalName, goalHabits] of Object.entries(goals)) {
            blocks.push(SlackBlockBuilder.section(`*${goalName}*`));
            for (const habit of goalHabits) {
                const habitSection = SlackBlockBuilder.habitProgressSection(habit);
                blocks.push(habitSection);
            }
            blocks.push(SlackBlockBuilder.divider());
        }
        return blocks;
    }
    /**
     * Build a section block for a single habit with progress and button.
     *
     * @param habit - Habit progress data
     * @returns Section block with accessory button
     */
    static habitProgressSection(habit) {
        const completionIndicator = habit.completed ? '✅' : '⬜';
        const streakText = SlackBlockBuilder.streakDisplay(habit.streak);
        const streakSuffix = streakText ? ` ${streakText}` : '';
        // Build workload display
        const totalStr = habit.totalCount === Math.floor(habit.totalCount)
            ? String(Math.floor(habit.totalCount))
            : String(habit.totalCount);
        const workloadDisplay = habit.workloadUnit
            ? `(${totalStr}${habit.workloadUnit}/日)`
            : `(${totalStr}/日)`;
        const firstLine = `${completionIndicator} *${habit.habitName}* ${workloadDisplay}${streakSuffix}`;
        // Build progress text
        const currentStr = habit.currentCount === Math.floor(habit.currentCount)
            ? String(Math.floor(habit.currentCount))
            : String(habit.currentCount);
        const progressRateInt = Math.round(habit.progressRate);
        const progressText = habit.workloadUnit
            ? `${currentStr}/${totalStr} ${habit.workloadUnit} (${progressRateInt}%)`
            : `${currentStr}/${totalStr} (${progressRateInt}%)`;
        const progressBar = SlackBlockBuilder.progressBar(habit.progressRate);
        const sectionText = `${firstLine}\n${progressText}\n\`${progressBar}\``;
        // Build increment button
        const incrementButton = SlackBlockBuilder.incrementButton(habit.habitId, habit.workloadPerCount, habit.workloadUnit);
        return {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: sectionText,
            },
            accessory: incrementButton,
        };
    }
    /**
     * Build an increment button with appropriate label.
     *
     * @param habitId - Habit ID for action value
     * @param workloadPerCount - Amount per increment
     * @param workloadUnit - Unit of measurement
     * @returns Button block
     */
    static incrementButton(habitId, workloadPerCount, workloadUnit) {
        const amountStr = workloadPerCount === Math.floor(workloadPerCount)
            ? String(Math.floor(workloadPerCount))
            : String(workloadPerCount);
        let label;
        if (workloadUnit !== null) {
            label = `+${amountStr} ${workloadUnit}`;
        }
        else if (workloadPerCount === 1) {
            label = '✓';
        }
        else {
            label = `+${amountStr}`;
        }
        return {
            type: 'button',
            text: {
                type: 'plain_text',
                text: label,
                emoji: true,
            },
            action_id: `habit_increment_${habitId}`,
            value: habitId,
        };
    }
    /**
     * Build statistics summary message from StatisticsData.
     *
     * Formats statistics with achievement rates and TOP3 habits.
     *
     * Requirements: 6.5, 6.7 - Format statistics for Slack display
     *
     * @param data - StatisticsData from DashboardDataService
     * @returns List of Block Kit blocks
     */
    static statisticsSummary(data) {
        const blocks = [];
        // Header
        blocks.push(SlackBlockBuilder.header(`📈 統計サマリー - ${data.dateDisplay}`));
        // Achievement rates
        const todayRateInt = Math.round(data.todayAchievementRate);
        const cumulativeRateInt = Math.round(data.cumulativeAchievementRate);
        const todayProgressBar = SlackBlockBuilder.progressBar(data.todayAchievementRate);
        const statsText = `*アクティブな習慣:* ${data.totalActiveHabits}件\n\n` +
            `*今日の達成率:* ${todayRateInt}% (${data.todayAchieved}/${data.todayTotal})\n` +
            `\`${todayProgressBar}\`\n\n` +
            `*累計達成率:* ${cumulativeRateInt}% (${data.cumulativeAchieved}/${data.cumulativeTotal})`;
        blocks.push(SlackBlockBuilder.section(statsText));
        blocks.push(SlackBlockBuilder.divider());
        // TOP3 habits
        if (data.top3Habits.length > 0) {
            blocks.push(SlackBlockBuilder.section('*🏆 TOP3 習慣*'));
            for (let i = 0; i < data.top3Habits.length; i++) {
                const habit = data.top3Habits[i];
                const rank = i + 1;
                const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉';
                const rateInt = Math.round(habit.progressRate);
                const progressBar = SlackBlockBuilder.progressBar(habit.progressRate);
                blocks.push(SlackBlockBuilder.section(`${medal} *${habit.habitName}*\n${rateInt}% \`${progressBar}\``));
            }
        }
        else {
            blocks.push(SlackBlockBuilder.section('まだ習慣データがありません。'));
        }
        return blocks;
    }
    /**
     * Build next habits list message from NextHabitsData.
     *
     * Formats upcoming habits with times and completion buttons.
     *
     * Requirements: 6.5, 6.7 - Format next habits for Slack display
     *
     * @param data - NextHabitsData from DashboardDataService
     * @returns List of Block Kit blocks
     */
    static nextHabitsList(data) {
        const blocks = [];
        // Header
        blocks.push(SlackBlockBuilder.header('⏰ 次の習慣'));
        if (data.habits.length === 0) {
            blocks.push(SlackBlockBuilder.section('24時間以内に予定されている習慣はありません。'));
            return blocks;
        }
        // Summary
        blocks.push(SlackBlockBuilder.section(`*${data.count}件* の習慣が予定されています`));
        blocks.push(SlackBlockBuilder.divider());
        // List habits
        for (const habit of data.habits) {
            const targetStr = habit.targetAmount === Math.floor(habit.targetAmount)
                ? String(Math.floor(habit.targetAmount))
                : String(habit.targetAmount);
            const targetDisplay = habit.workloadUnit
                ? `${targetStr}${habit.workloadUnit}`
                : `${targetStr}回`;
            const habitText = `🕐 *${habit.startTimeDisplay}* - ${habit.habitName} (${targetDisplay})`;
            // Add completion button
            const button = SlackBlockBuilder.incrementButton(habit.habitId, habit.targetAmount, habit.workloadUnit);
            blocks.push({
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: habitText,
                },
                accessory: button,
            });
        }
        return blocks;
    }
    /**
     * Build stickies list message from StickiesData.
     *
     * Formats stickies with checkboxes, showing incomplete first.
     *
     * Requirements: 6.5, 6.7 - Format stickies for Slack display
     *
     * @param data - StickiesData from DashboardDataService
     * @returns List of Block Kit blocks
     */
    static stickiesList(data) {
        const blocks = [];
        // Header
        blocks.push(SlackBlockBuilder.header('📌 付箋メモ'));
        if (data.stickies.length === 0) {
            blocks.push(SlackBlockBuilder.section('付箋メモはありません。'));
            return blocks;
        }
        // Summary
        const summaryText = `*未完了:* ${data.incompleteCount}件 / *完了:* ${data.completedCount}件`;
        blocks.push(SlackBlockBuilder.section(summaryText));
        blocks.push(SlackBlockBuilder.divider());
        // Separate incomplete and completed
        const incomplete = data.stickies.filter((s) => !s.completed);
        const completed = data.stickies.filter((s) => s.completed);
        // Show incomplete first
        if (incomplete.length > 0) {
            blocks.push(SlackBlockBuilder.section('*未完了*'));
            for (const sticky of incomplete) {
                const checkbox = '⬜';
                let stickyText = `${checkbox} ${sticky.name}`;
                if (sticky.description) {
                    stickyText += `\n_${sticky.description}_`;
                }
                blocks.push({
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: stickyText,
                    },
                    accessory: {
                        type: 'button',
                        text: {
                            type: 'plain_text',
                            text: '✓',
                            emoji: true,
                        },
                        action_id: `sticky_complete_${sticky.id}`,
                        value: sticky.id,
                    },
                });
            }
            blocks.push(SlackBlockBuilder.divider());
        }
        // Show completed (collapsed)
        if (completed.length > 0) {
            const completedNames = completed.slice(0, 3).map((s) => `✅ ${s.name}`).join('\n');
            const moreText = completed.length > 3 ? `\n...他${completed.length - 3}件` : '';
            blocks.push(SlackBlockBuilder.section(`*完了済み*\n${completedNames}${moreText}`));
        }
        return blocks;
    }
}
//# sourceMappingURL=slackBlockBuilder.js.map