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
import { createClient } from '@supabase/supabase-js';
import { getSettings } from '../config.js';
import { getLogger } from '../utils/logger.js';
import { getSlackService } from '../services/slackService.js';
import { SlackRepository } from '../repositories/slackRepository.js';
import { HabitRepository } from '../repositories/habitRepository.js';
import { ActivityRepository } from '../repositories/activityRepository.js';
import { GoalRepository } from '../repositories/goalRepository.js';
import { StickyRepository } from '../repositories/stickyRepository.js';
import { HabitCompletionReporter } from '../services/habitCompletionReporter.js';
import { DailyProgressCalculator } from '../services/dailyProgressCalculator.js';
import { DashboardDataService } from '../services/dashboardDataService.js';
import { SlackBlockBuilder } from '../services/slackBlockBuilder.js';
import { DataFetchError, getUserFriendlyMessage } from '../errors/index.js';
import { getConnectorService } from '../services/connectorService.js';
const logger = getLogger('slackCommands');
// =============================================================================
// Helper Functions
// =============================================================================
/**
 * Get Supabase client instance.
 */
function getSupabaseClient(settings) {
    if (!settings.supabaseUrl || !settings.supabaseAnonKey) {
        throw new Error('Supabase is not configured');
    }
    return createClient(settings.supabaseUrl, settings.supabaseAnonKey);
}
/**
 * Parse URL-encoded form data from request body.
 */
function parseFormData(body) {
    const params = new URLSearchParams(body);
    const result = {};
    for (const [key, value] of params.entries()) {
        result[key] = value;
    }
    return result;
}
/**
 * Handle errors and return user-friendly Slack response.
 */
function handleError(error, context) {
    const errorMessage = getUserFriendlyMessage(error);
    logger.error('Slack command error', error instanceof Error ? error : new Error(String(error)), {
        ...context,
        error_type: error instanceof Error ? error.constructor.name : 'Unknown',
    });
    return {
        response_type: 'ephemeral',
        blocks: SlackBlockBuilder.errorMessage(errorMessage),
    };
}
// =============================================================================
// Command Handlers
// =============================================================================
/**
 * Handle /habit-done command.
 *
 * If habit name is provided, completes that habit.
 * If no name is provided, shows list of incomplete habits with buttons.
 */
async function handleHabitDone(reporter, ownerId, ownerType, habitName) {
    if (!habitName) {
        // Show list of incomplete habits
        logger.info('Habit query: get_incomplete_habits_today', {
            owner_id: ownerId,
            owner_type: ownerType,
        });
        try {
            const habits = await reporter.getIncompleteHabitsToday(ownerId, ownerType);
            if (!habits || habits.length === 0) {
                return {
                    response_type: 'ephemeral',
                    text: '🎉 今日の習慣はすべて完了しています！',
                };
            }
            return {
                response_type: 'ephemeral',
                blocks: SlackBlockBuilder.habitList(habits.map((h) => ({
                    id: h.id,
                    name: h.name,
                    streak: h.streak,
                    completed: h.completed,
                    goal_name: h.goal_name ?? undefined,
                })), true),
            };
        }
        catch (error) {
            throw new DataFetchError(`Failed to fetch incomplete habits for owner ${ownerId}`, error instanceof Error ? error : undefined);
        }
    }
    // Complete specific habit by name
    logger.info('Habit query: complete_habit_by_name', {
        owner_id: ownerId,
        owner_type: ownerType,
        habit_name: habitName,
    });
    try {
        const [success, message, data] = await reporter.completeHabitByName(ownerId, habitName, 'slack', ownerType);
        if (success && data && 'habit' in data) {
            const habit = data.habit;
            const streak = data.streak ?? 0;
            return {
                response_type: 'in_channel',
                blocks: SlackBlockBuilder.habitCompletionConfirm(habit.name ?? habitName, streak),
            };
        }
        if (data && 'already_completed' in data && data.already_completed) {
            return {
                response_type: 'ephemeral',
                blocks: SlackBlockBuilder.habitAlreadyCompleted(habitName),
            };
        }
        if (data && 'suggestions' in data && data.suggestions) {
            return {
                response_type: 'ephemeral',
                blocks: SlackBlockBuilder.habitNotFound(habitName, data.suggestions),
            };
        }
        return {
            response_type: 'ephemeral',
            blocks: SlackBlockBuilder.errorMessage(message),
        };
    }
    catch (error) {
        throw new DataFetchError(`Failed to complete habit '${habitName}' for owner ${ownerId}`, error instanceof Error ? error : undefined);
    }
}
/**
 * Handle /habit-status command.
 *
 * Shows today's progress summary with deprecation notice.
 */
async function handleHabitStatus(reporter, ownerId, ownerType) {
    logger.info('Habit query: get_today_summary', {
        owner_id: ownerId,
        owner_type: ownerType,
    });
    try {
        const summary = await reporter.getTodaySummary(ownerId, ownerType);
        // Get the existing status blocks
        const blocks = SlackBlockBuilder.habitStatus(summary.completed, summary.total, summary.habits.map((h) => ({
            id: h.id,
            name: h.name,
            completed: h.completed,
        })));
        // Add deprecation notice (Requirements 7.2, 7.4)
        blocks.push({
            type: 'context',
            elements: [
                {
                    type: 'mrkdwn',
                    text: '💡 _このコマンドは非推奨です。より詳細な進捗表示には `/habit-dashboard` をお試しください。_',
                },
            ],
        });
        return {
            response_type: 'ephemeral',
            blocks,
        };
    }
    catch (error) {
        throw new DataFetchError(`Failed to fetch today's summary for owner ${ownerId}`, error instanceof Error ? error : undefined);
    }
}
/**
 * Handle /habit-list command.
 *
 * Shows all habits grouped by goal with deprecation notice.
 */
async function handleHabitList(reporter, ownerId, ownerType) {
    logger.info('Habit query: get_all_habits_with_status', {
        owner_id: ownerId,
        owner_type: ownerType,
    });
    try {
        const habits = await reporter.getAllHabitsWithStatus(ownerId, ownerType);
        // Get the existing list blocks
        const blocks = SlackBlockBuilder.habitList(habits.map((h) => ({
            id: h.id,
            name: h.name,
            streak: h.streak,
            completed: h.completed,
            goal_name: h.goal_name ?? undefined,
        })), true);
        // Add deprecation notice (Requirements 7.3, 7.4)
        blocks.push({
            type: 'context',
            elements: [
                {
                    type: 'mrkdwn',
                    text: '💡 _このコマンドは非推奨です。より詳細な進捗表示には `/habit-dashboard` をお試しください。_',
                },
            ],
        });
        return {
            response_type: 'ephemeral',
            blocks,
        };
    }
    catch (error) {
        throw new DataFetchError(`Failed to fetch habits list for owner ${ownerId}`, error instanceof Error ? error : undefined);
    }
}
/**
 * Handle /habit-dashboard command.
 *
 * Sends dashboard response via response_url (async response).
 * Returns empty response immediately to Slack.
 */
async function handleHabitDashboard(progressCalculator, slackService, ownerId, ownerType, responseUrl) {
    try {
        // Get daily progress
        const progressList = await progressCalculator.getDailyProgress(ownerId, ownerType);
        const summary = await progressCalculator.getDashboardSummary(ownerId, ownerType);
        let blocks;
        let text;
        if (progressList.length === 0) {
            blocks = SlackBlockBuilder.dashboardEmpty();
            text = '今日の進捗';
        }
        else {
            // Build dashboard blocks
            blocks = buildDashboardBlocks(progressList, summary);
            text = `今日の進捗: ${summary.completedHabits}/${summary.totalHabits} 習慣を完了`;
        }
        // Send response via response_url
        await slackService.sendResponse(responseUrl, text, blocks, false);
    }
    catch (error) {
        logger.error('Dashboard command error', error instanceof Error ? error : new Error(String(error)), {
            owner_id: ownerId,
            owner_type: ownerType,
        });
        // Send error response via response_url
        const errorMessage = getUserFriendlyMessage(error);
        await slackService.sendResponse(responseUrl, errorMessage, SlackBlockBuilder.dashboardError(errorMessage), false);
    }
}
/**
 * Build dashboard blocks from progress data.
 */
function buildDashboardBlocks(progressList, summary) {
    const blocks = [];
    // 1. Header with date
    blocks.push(SlackBlockBuilder.header(`📊 今日の進捗 - ${summary.dateDisplay}`));
    // 2. Summary section with completion count and overall progress bar
    const completionRateInt = Math.round(summary.completionRate);
    const overallProgressBar = SlackBlockBuilder.progressBar(summary.completionRate);
    const summaryText = `*${summary.completedHabits}/${summary.totalHabits}* 習慣を完了 (${completionRateInt}%)\n` +
        `\`${overallProgressBar}\``;
    blocks.push(SlackBlockBuilder.section(summaryText));
    // 3. Divider after summary
    blocks.push(SlackBlockBuilder.divider());
    // 4. Filter out completed habits (progressRate >= 100%)
    const incompleteHabits = progressList.filter((h) => !h.completed);
    // If all habits are completed, show a congratulations message
    if (incompleteHabits.length === 0) {
        blocks.push(SlackBlockBuilder.section('🎉 今日の習慣をすべて達成しました！素晴らしい！'));
        return blocks;
    }
    // 5. Group incomplete habits by goalName
    const goals = {};
    for (const habit of incompleteHabits) {
        const goalName = habit.goalName;
        if (!goals[goalName]) {
            goals[goalName] = [];
        }
        goals[goalName].push(habit);
    }
    // 6. For each goal group, add goal name section and habit progress sections
    for (const [goalName, goalHabits] of Object.entries(goals)) {
        // Goal name section in bold
        blocks.push(SlackBlockBuilder.section(`*${goalName}*`));
        // All habit progress sections for this goal
        for (const habit of goalHabits) {
            const habitSection = buildHabitProgressSection(habit);
            blocks.push(habitSection);
        }
        // Divider after each goal group
        blocks.push(SlackBlockBuilder.divider());
    }
    return blocks;
}
/**
 * Build a section block for a single habit with progress and button.
 */
function buildHabitProgressSection(habit) {
    // Determine completion indicator
    const completionIndicator = habit.completed ? '✅' : '⬜';
    // Get streak display
    const streakText = SlackBlockBuilder.streakDisplay(habit.streak);
    const streakSuffix = streakText ? ` ${streakText}` : '';
    // Build workload total display for title
    const totalStr = habit.totalCount === Math.floor(habit.totalCount)
        ? String(Math.floor(habit.totalCount))
        : String(habit.totalCount);
    const workloadDisplay = habit.workloadUnit
        ? `(${totalStr}${habit.workloadUnit}/日)`
        : `(${totalStr}/日)`;
    // Build first line: completion indicator, habit name (bold), workload total, streak
    const firstLine = `${completionIndicator} *${habit.habitName}* ${workloadDisplay}${streakSuffix}`;
    // Build progress text
    const currentStr = habit.currentCount === Math.floor(habit.currentCount)
        ? String(Math.floor(habit.currentCount))
        : String(habit.currentCount);
    const progressRateInt = Math.round(habit.progressRate);
    // Build progress text based on whether workloadUnit is defined
    const progressText = habit.workloadUnit
        ? `${currentStr}/${totalStr} ${habit.workloadUnit} (${progressRateInt}%)`
        : `${currentStr}/${totalStr} (${progressRateInt}%)`;
    // Get progress bar
    const progressBar = SlackBlockBuilder.progressBar(habit.progressRate);
    // Build full section text
    const sectionText = `${firstLine}\n${progressText}\n\`${progressBar}\``;
    // Build increment button
    const incrementButton = buildIncrementButton(habit.habitId, habit.workloadPerCount, habit.workloadUnit);
    // Return section block with accessory button
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
 */
function buildIncrementButton(habitId, workloadPerCount, workloadUnit) {
    // Format the amount: display as integer if it's a whole number
    const amountStr = workloadPerCount === Math.floor(workloadPerCount)
        ? String(Math.floor(workloadPerCount))
        : String(workloadPerCount);
    // Determine button label based on unit and amount
    let label;
    if (workloadUnit !== null) {
        // Has unit: always show "+{amount} {unit}"
        label = `+${amountStr} ${workloadUnit}`;
    }
    else if (workloadPerCount === 1) {
        // No unit and amount is 1: show "✓"
        label = '✓';
    }
    else {
        // No unit but amount > 1: show "+{amount}"
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
// =============================================================================
// New Dashboard Section Command Handlers
// =============================================================================
/**
 * Handle /progress and /habit-progress commands.
 *
 * Shows daily progress using DashboardDataService.
 * Requirements: 6.1, 6.6, 6.7, 6.8, 8.1, 8.2
 */
async function handleProgress(dashboardService, slackService, ownerId, ownerType, responseUrl) {
    try {
        const progressData = await dashboardService.getDailyProgress(ownerId, ownerType);
        const blocks = SlackBlockBuilder.progressDashboard(progressData);
        const text = `今日の進捗: ${progressData.completedHabits}/${progressData.totalHabits} 習慣を完了`;
        await slackService.sendResponse(responseUrl, text, blocks, false);
    }
    catch (error) {
        logger.error('Progress command error', error instanceof Error ? error : new Error(String(error)), {
            owner_id: ownerId,
            owner_type: ownerType,
        });
        const errorMessage = getUserFriendlyMessage(error);
        await slackService.sendResponse(responseUrl, errorMessage, SlackBlockBuilder.dashboardError(errorMessage), false);
    }
}
/**
 * Handle /stats and /habit-stats commands.
 *
 * Shows statistics summary using DashboardDataService.
 * Requirements: 6.2, 6.6, 6.7, 6.8
 */
async function handleStats(dashboardService, slackService, ownerId, ownerType, responseUrl) {
    try {
        const statsData = await dashboardService.getStatistics(ownerId, ownerType);
        const blocks = SlackBlockBuilder.statisticsSummary(statsData);
        const text = `統計サマリー: 今日の達成率 ${Math.round(statsData.todayAchievementRate)}%`;
        await slackService.sendResponse(responseUrl, text, blocks, false);
    }
    catch (error) {
        logger.error('Stats command error', error instanceof Error ? error : new Error(String(error)), {
            owner_id: ownerId,
            owner_type: ownerType,
        });
        const errorMessage = getUserFriendlyMessage(error);
        await slackService.sendResponse(responseUrl, errorMessage, SlackBlockBuilder.dashboardError(errorMessage), false);
    }
}
/**
 * Handle /next and /habit-next commands.
 *
 * Shows upcoming habits using DashboardDataService.
 * Requirements: 6.3, 6.6, 6.7, 6.8
 */
async function handleNext(dashboardService, slackService, ownerId, ownerType, responseUrl) {
    try {
        const nextData = await dashboardService.getNextHabits(ownerId, ownerType);
        const blocks = SlackBlockBuilder.nextHabitsList(nextData);
        const text = `次の習慣: ${nextData.count}件が予定されています`;
        await slackService.sendResponse(responseUrl, text, blocks, false);
    }
    catch (error) {
        logger.error('Next command error', error instanceof Error ? error : new Error(String(error)), {
            owner_id: ownerId,
            owner_type: ownerType,
        });
        const errorMessage = getUserFriendlyMessage(error);
        await slackService.sendResponse(responseUrl, errorMessage, SlackBlockBuilder.dashboardError(errorMessage), false);
    }
}
/**
 * Handle /stickies command.
 *
 * Shows stickies list using DashboardDataService.
 * Requirements: 6.4, 5.5, 6.6, 6.7, 6.8
 */
async function handleStickies(dashboardService, slackService, ownerId, ownerType, responseUrl) {
    try {
        const stickiesData = await dashboardService.getStickies(ownerId, ownerType);
        const blocks = SlackBlockBuilder.stickiesList(stickiesData);
        const text = `付箋メモ: 未完了 ${stickiesData.incompleteCount}件`;
        await slackService.sendResponse(responseUrl, text, blocks, false);
    }
    catch (error) {
        logger.error('Stickies command error', error instanceof Error ? error : new Error(String(error)), {
            owner_id: ownerId,
            owner_type: ownerType,
        });
        const errorMessage = getUserFriendlyMessage(error);
        await slackService.sendResponse(responseUrl, errorMessage, SlackBlockBuilder.dashboardError(errorMessage), false);
    }
}
// =============================================================================
// Natural Language Command Handler
// =============================================================================
/**
 * Handle /habit-nl and /nl commands.
 *
 * Processes natural language input for habit creation/editing.
 * Requirements: 6.1, 6.2, 6.3, 6.5, 6.6
 */
async function handleNLCommand(slackService, ownerId, ownerType, text, responseUrl, supabase) {
    try {
        if (!text.trim()) {
            // Show help if no text provided
            const helpBlocks = [
                {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: '*🤖 自然言語コマンドの使い方*',
                    },
                },
                {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: '*習慣を追加:*\n`/habit-nl 新しい習慣: 毎朝7時に30分ジョギング`\n`/nl 習慣登録: 毎日水を2L飲む`',
                    },
                },
                {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: '*習慣を編集:*\n`/habit-nl 習慣を編集: ジョギングを45分に変更`\n`/nl 習慣を変更: 読書の時間を夜9時に`',
                    },
                },
                {
                    type: 'context',
                    elements: [
                        {
                            type: 'mrkdwn',
                            text: '💎 _この機能はPremiumプランでのみ利用可能です_',
                        },
                    ],
                },
            ];
            await slackService.sendResponse(responseUrl, '自然言語コマンドの使い方', helpBlocks, false);
            return;
        }
        const connectorService = getConnectorService(supabase);
        const result = await connectorService.handleSlackNLCommand(ownerId, text, ownerType);
        await slackService.sendResponse(responseUrl, result.text, result.blocks, false);
        logger.info('NL command processed via slash command', {
            owner_id: ownerId,
            owner_type: ownerType,
            success: result.success,
            tokensUsed: result.tokensUsed,
        });
    }
    catch (error) {
        logger.error('NL command error', error instanceof Error ? error : new Error(String(error)), {
            owner_id: ownerId,
            owner_type: ownerType,
        });
        const errorMessage = getUserFriendlyMessage(error);
        await slackService.sendResponse(responseUrl, errorMessage, SlackBlockBuilder.dashboardError(errorMessage), false);
    }
}
// =============================================================================
// Router Factory
// =============================================================================
/**
 * Create the Slack commands router with all endpoints.
 */
export function createSlackCommandsRouter() {
    const router = new Hono();
    /**
     * POST /api/slack/commands
     *
     * Handle Slack slash commands.
     * Must respond within 3 seconds.
     */
    router.post('/commands', async (c) => {
        const startTime = Date.now();
        const settings = getSettings();
        const slackService = getSlackService();
        // Get raw body for signature verification
        const rawBody = await c.req.text();
        // Verify Slack signature
        const timestamp = c.req.header('X-Slack-Request-Timestamp') ?? '';
        const signature = c.req.header('X-Slack-Signature') ?? '';
        if (!(await slackService.verifySignature(timestamp, rawBody, signature))) {
            logger.warning('Invalid Slack signature', {
                timestamp,
                signature_prefix: signature.slice(0, 20),
            });
            return c.json({ error: 'Invalid signature' }, 401);
        }
        // Parse form data
        const formData = parseFormData(rawBody);
        const payload = {
            command: formData['command'] ?? '',
            text: (formData['text'] ?? '').trim(),
            user_id: formData['user_id'] ?? '',
            team_id: formData['team_id'] ?? '',
            channel_id: formData['channel_id'] ?? '',
            response_url: formData['response_url'] ?? '',
            trigger_id: formData['trigger_id'],
        };
        // Log command receipt
        logger.info('Slack command received', {
            command: payload.command,
            slack_user_id: payload.user_id,
            team_id: payload.team_id,
        });
        // Initialize repositories and services
        const supabase = getSupabaseClient(settings);
        const slackRepo = new SlackRepository(supabase);
        const habitRepo = new HabitRepository(supabase);
        const activityRepo = new ActivityRepository(supabase);
        const goalRepo = new GoalRepository(supabase);
        const stickyRepo = new StickyRepository(supabase);
        const habitReporter = new HabitCompletionReporter(habitRepo, activityRepo, goalRepo);
        const progressCalculator = new DailyProgressCalculator(habitRepo, activityRepo, goalRepo);
        const dashboardService = new DashboardDataService(habitRepo, activityRepo, goalRepo, stickyRepo);
        // Find user by Slack ID
        const connection = await slackRepo.getConnectionBySlackUser(payload.user_id, payload.team_id);
        if (!connection) {
            const processingTimeMs = Date.now() - startTime;
            logger.warning('Connection lookup failed - no connection found', {
                slack_user_id: payload.user_id,
                team_id: payload.team_id,
            });
            logger.info('Slack command completed', {
                command: payload.command,
                processing_time_ms: processingTimeMs,
                result_status: 'not_found',
                slack_user_id: payload.user_id,
                team_id: payload.team_id,
            });
            return c.json({
                response_type: 'ephemeral',
                blocks: SlackBlockBuilder.notConnected(),
            });
        }
        // Use owner_id directly from connection (VOW user UUID)
        const ownerType = connection.owner_type;
        const ownerId = connection.owner_id;
        logger.info('Slack command owner resolved', {
            slack_user_id: payload.user_id,
            owner_id: ownerId,
            owner_type: ownerType,
            command: payload.command,
        });
        let result;
        let resultStatus = 'success';
        try {
            switch (payload.command) {
                case '/habit-done':
                    result = await handleHabitDone(habitReporter, ownerId, ownerType, payload.text);
                    break;
                case '/habit-status':
                    result = await handleHabitStatus(habitReporter, ownerId, ownerType);
                    break;
                case '/habit-list':
                    result = await handleHabitList(habitReporter, ownerId, ownerType);
                    break;
                case '/habit-dashboard':
                    // Dashboard handler sends response via response_url
                    // Return empty response to Slack (no immediate message)
                    await handleHabitDashboard(progressCalculator, slackService, ownerId, ownerType, payload.response_url);
                    // Log command completion
                    {
                        const processingTimeMs = Date.now() - startTime;
                        logger.info('Slack command completed', {
                            command: payload.command,
                            processing_time_ms: processingTimeMs,
                            result_status: resultStatus,
                            slack_user_id: payload.user_id,
                            owner_id: ownerId,
                            owner_type: ownerType,
                        });
                    }
                    // Return empty response to avoid showing "{}" in Slack
                    return c.body(null, 200);
                // New dashboard section commands
                case '/progress':
                case '/habit-progress':
                    // Progress handler sends response via response_url
                    await handleProgress(dashboardService, slackService, ownerId, ownerType, payload.response_url);
                    {
                        const processingTime = Date.now() - startTime;
                        logger.info('Slack command completed', {
                            command: payload.command,
                            processing_time_ms: processingTime,
                            result_status: resultStatus,
                            slack_user_id: payload.user_id,
                            owner_id: ownerId,
                            owner_type: ownerType,
                        });
                    }
                    return c.body(null, 200);
                case '/stats':
                case '/habit-stats':
                    // Stats handler sends response via response_url
                    await handleStats(dashboardService, slackService, ownerId, ownerType, payload.response_url);
                    {
                        const processingTime = Date.now() - startTime;
                        logger.info('Slack command completed', {
                            command: payload.command,
                            processing_time_ms: processingTime,
                            result_status: resultStatus,
                            slack_user_id: payload.user_id,
                            owner_id: ownerId,
                            owner_type: ownerType,
                        });
                    }
                    return c.body(null, 200);
                case '/next':
                case '/nexts':
                case '/habit-next':
                    // Next handler sends response via response_url
                    await handleNext(dashboardService, slackService, ownerId, ownerType, payload.response_url);
                    {
                        const processingTime = Date.now() - startTime;
                        logger.info('Slack command completed', {
                            command: payload.command,
                            processing_time_ms: processingTime,
                            result_status: resultStatus,
                            slack_user_id: payload.user_id,
                            owner_id: ownerId,
                            owner_type: ownerType,
                        });
                    }
                    return c.body(null, 200);
                case '/stickies':
                    // Stickies handler sends response via response_url
                    await handleStickies(dashboardService, slackService, ownerId, ownerType, payload.response_url);
                    {
                        const processingTime = Date.now() - startTime;
                        logger.info('Slack command completed', {
                            command: payload.command,
                            processing_time_ms: processingTime,
                            result_status: resultStatus,
                            slack_user_id: payload.user_id,
                            owner_id: ownerId,
                            owner_type: ownerType,
                        });
                    }
                    return c.body(null, 200);
                case '/habit-nl':
                case '/nl':
                    // Natural language command handler
                    await handleNLCommand(slackService, ownerId, ownerType, payload.text, payload.response_url, supabase);
                    {
                        const processingTime = Date.now() - startTime;
                        logger.info('Slack command completed', {
                            command: payload.command,
                            processing_time_ms: processingTime,
                            result_status: resultStatus,
                            slack_user_id: payload.user_id,
                            owner_id: ownerId,
                            owner_type: ownerType,
                        });
                    }
                    return c.body(null, 200);
                default:
                    result = {
                        response_type: 'ephemeral',
                        blocks: SlackBlockBuilder.availableCommands(),
                    };
            }
            // Log command completion
            const processingTime = Date.now() - startTime;
            logger.info('Slack command completed', {
                command: payload.command,
                processing_time_ms: processingTime,
                result_status: resultStatus,
                slack_user_id: payload.user_id,
                owner_id: ownerId,
                owner_type: ownerType,
            });
            return c.json(result);
        }
        catch (error) {
            resultStatus = 'error';
            const processingTime = Date.now() - startTime;
            // Log command completion with error status
            logger.info('Slack command completed', {
                command: payload.command,
                processing_time_ms: processingTime,
                result_status: resultStatus,
                slack_user_id: payload.user_id,
                owner_id: ownerId,
                owner_type: ownerType,
            });
            // Return user-friendly error message
            result = handleError(error, {
                command: payload.command,
                slack_user_id: payload.user_id,
                owner_id: ownerId,
                owner_type: ownerType,
            });
            return c.json(result);
        }
    });
    /**
     * POST /api/slack/events
     *
     * Handle Slack Events API (URL verification, app mentions).
     */
    router.post('/events', async (c) => {
        const slackService = getSlackService();
        // Get raw body
        const rawBody = await c.req.text();
        // Parse JSON
        let payload;
        try {
            payload = JSON.parse(rawBody);
        }
        catch {
            return c.json({ error: 'Invalid JSON' }, 400);
        }
        // Handle URL verification challenge
        if (payload['type'] === 'url_verification') {
            return c.json({ challenge: payload['challenge'] });
        }
        // Verify signature for other events
        const timestamp = c.req.header('X-Slack-Request-Timestamp') ?? '';
        const signature = c.req.header('X-Slack-Signature') ?? '';
        if (!(await slackService.verifySignature(timestamp, rawBody, signature))) {
            return c.json({ error: 'Invalid signature' }, 401);
        }
        // Handle events
        const event = payload['event'];
        const eventType = event?.['type'];
        const eventSettings = getSettings();
        if (eventType === 'app_mention' || eventType === 'message') {
            // Handle app mentions and direct messages for NL commands
            const text = event?.['text'];
            const slackUserId = event?.['user'];
            const channel = event?.['channel'];
            const teamId = payload['team_id'];
            if (text && slackUserId && channel) {
                // Remove bot mention from text if present
                const cleanText = text.replace(/<@[A-Z0-9]+>/g, '').trim();
                // Check if this looks like a NL command
                const supabaseClient = getSupabaseClient(eventSettings);
                const connectorService = getConnectorService(supabaseClient);
                const detection = connectorService.detectNLCommand(cleanText);
                if (detection.isNLCommand) {
                    logger.info('NL command detected in event', {
                        eventType,
                        slackUserId,
                        commandType: detection.commandType,
                    });
                    // Get VOW user from Slack user ID
                    const slackRepo = new SlackRepository(supabaseClient);
                    const connection = await slackRepo.getConnectionBySlackUser(slackUserId, teamId || '');
                    if (connection) {
                        const ownerId = connection.owner_id;
                        const ownerType = connection.owner_type;
                        // Process NL command
                        const result = await connectorService.handleSlackNLCommand(ownerId, cleanText, ownerType);
                        // Send response via Slack API
                        const eventSlackService = getSlackService();
                        const botToken = process.env['SLACK_BOT_TOKEN'];
                        if (botToken) {
                            await eventSlackService.sendMessage(botToken, {
                                channel,
                                text: result.text,
                                blocks: result.blocks,
                            });
                        }
                        logger.info('NL command processed', {
                            slackUserId,
                            ownerId,
                            success: result.success,
                            tokensUsed: result.tokensUsed,
                        });
                    }
                    else {
                        // User not connected
                        logger.info('NL command from unconnected user', { slackUserId });
                    }
                }
            }
        }
        return c.json({ ok: true });
    });
    return router;
}
// Export default router instance
export const slackCommandsRouter = createSlackCommandsRouter();
//# sourceMappingURL=slackCommands.js.map