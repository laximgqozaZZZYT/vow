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
import type { Context } from 'hono';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSettings, type Settings } from '../config.js';
import { getLogger } from '../utils/logger.js';
import { getSlackService, type SlackIntegrationService } from '../services/slackService.js';
import { SlackRepository } from '../repositories/slackRepository.js';
import { HabitRepository } from '../repositories/habitRepository.js';
import { ActivityRepository } from '../repositories/activityRepository.js';
import { GoalRepository } from '../repositories/goalRepository.js';
import { HabitCompletionReporter } from '../services/habitCompletionReporter.js';
import { SlackBlockBuilder, type SlackBlock } from '../services/slackBlockBuilder.js';
import { SlackAPIError, getUserFriendlyMessage } from '../errors/index.js';

const logger = getLogger('slackInteractions');

// =============================================================================
// Types
// =============================================================================

/**
 * Slack interaction payload structure.
 */
interface SlackInteractionPayload {
  type: string;
  user: {
    id: string;
    username?: string;
    name?: string;
  };
  team: {
    id: string;
    domain?: string;
  };
  actions: Array<{
    action_id: string;
    value: string;
    type: string;
  }>;
  response_url: string;
  trigger_id?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get Supabase client instance.
 */
function getSupabaseClient(settings: Settings): SupabaseClient {
  if (!settings.supabaseUrl || !settings.supabaseAnonKey) {
    throw new Error('Supabase is not configured');
  }
  return createClient(settings.supabaseUrl, settings.supabaseAnonKey);
}

/**
 * Parse URL-encoded form data from request body.
 */
function parseFormData(body: string): Record<string, string> {
  const params = new URLSearchParams(body);
  const result: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    result[key] = value;
  }
  return result;
}

/**
 * Send not connected response to user.
 *
 * Sends a message to the user indicating that their Slack account is not
 * connected to VOW and provides instructions for connecting.
 */
async function sendNotConnectedResponse(
  slackService: SlackIntegrationService,
  responseUrl: string
): Promise<void> {
  const blocks = SlackBlockBuilder.notConnected();
  await slackService.sendResponse(
    responseUrl,
    'VOWアカウントとの接続が見つかりません。',
    blocks,
    true
  );
}

// =============================================================================
// Action Handlers
// =============================================================================

/**
 * Handle Done button click.
 *
 * Marks the specified habit as complete and sends a confirmation message
 * to the user via Slack. Includes streak count in the confirmation.
 *
 * Requirements:
 * - 6.1: Mark habit as complete and return confirmation
 * - 6.4: Include streak count in confirmation
 * - 6.5: Handle already completed habits
 */
async function handleHabitDone(
  completionReporter: HabitCompletionReporter,
  slackService: SlackIntegrationService,
  responseUrl: string,
  ownerType: string,
  ownerId: string,
  habitId: string
): Promise<void> {
  const [success, _message, data] = await completionReporter.completeHabitById(
    ownerId,
    habitId,
    'slack',
    ownerType
  );

  let blocks: SlackBlock[];
  let responseText: string;

  if (success && data) {
    // Requirement 6.4: Include streak in confirmation
    const streak = data.streak ?? 0;
    const habitName = data.habit?.name ?? '';
    blocks = SlackBlockBuilder.habitCompletionConfirm(habitName, streak);
    responseText = `✅ ${habitName}を完了しました！`;
    if (streak > 1) {
      responseText += ` 🔥 ${streak}日連続！`;
    }
  } else if (data && data.already_completed) {
    // Requirement 6.5: Already completed message
    const habitName = data.habit?.name ?? '';
    blocks = SlackBlockBuilder.habitAlreadyCompleted(habitName);
    responseText = `ℹ️ ${habitName}は既に今日完了しています。`;
  } else {
    // Error case
    const errorMessage = _message || '習慣の完了に失敗しました。';
    blocks = SlackBlockBuilder.errorMessage(errorMessage);
    responseText = errorMessage;
  }

  await slackService.sendResponse(responseUrl, responseText, blocks, true);
}

/**
 * Handle Skip button click.
 *
 * Records that the user skipped the specified habit for today and sends
 * a confirmation message. Skipped habits will not receive follow-up messages.
 *
 * Requirement 6.2: Record skip and return confirmation
 */
async function handleHabitSkip(
  slackRepo: SlackRepository,
  habitRepo: HabitRepository,
  slackService: SlackIntegrationService,
  responseUrl: string,
  ownerType: string,
  ownerId: string,
  habitId: string
): Promise<void> {
  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().slice(0, 10);

  // Mark habit as skipped for today
  await slackRepo.markSkipped(ownerType, ownerId, habitId, today);

  // Get habit name for confirmation message
  const habit = await habitRepo.getById(habitId);
  const habitName = habit?.name ?? '';

  const blocks = SlackBlockBuilder.habitSkipped(habitName);
  const responseText = `⏭️ ${habitName}を今日はスキップしました。`;

  await slackService.sendResponse(responseUrl, responseText, blocks, true);
}

/**
 * Handle Remind Later button click.
 *
 * Schedules a reminder for the specified habit to be sent later (default: 60 minutes)
 * and sends a confirmation message to the user.
 *
 * Requirement 6.3: Set remind_later_at and return confirmation
 */
async function handleHabitLater(
  slackRepo: SlackRepository,
  habitRepo: HabitRepository,
  slackService: SlackIntegrationService,
  responseUrl: string,
  ownerType: string,
  ownerId: string,
  habitId: string
): Promise<void> {
  const delayMinutes = 60; // Default delay

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().slice(0, 10);

  // Calculate remind_later_at time
  const remindAt = new Date(Date.now() + delayMinutes * 60 * 1000);

  // Set remind later time
  await slackRepo.setRemindLater(ownerType, ownerId, habitId, today, remindAt);

  // Get habit name for confirmation message
  const habit = await habitRepo.getById(habitId);
  const habitName = habit?.name ?? '';

  const blocks = SlackBlockBuilder.habitRemindLater(habitName, delayMinutes);
  const responseText = `⏰ ${delayMinutes}分後に${habitName}をリマインドします。`;

  await slackService.sendResponse(responseUrl, responseText, blocks, true);
}

/**
 * Handle Increment button click from dashboard.
 *
 * Increments the habit progress by the workload_per_count amount and sends
 * a confirmation message. This is used for the [✓] or [+N unit] buttons
 * in the dashboard view.
 *
 * Requirements:
 * - 4.1: Include increment button for incomplete habits
 * - 4.2: Increment by workload_per_count when button is clicked
 * - 4.5: Display celebration message when reaching 100%
 */
async function handleHabitIncrement(
  completionReporter: HabitCompletionReporter,
  slackService: SlackIntegrationService,
  responseUrl: string,
  ownerType: string,
  ownerId: string,
  habitId: string
): Promise<void> {
  try {
    // Call increment_habit_progress
    const [success, message, resultData] = await completionReporter.incrementHabitProgress(
      ownerId,
      habitId,
      undefined, // Use default workload_per_count
      'slack',
      ownerType
    );

    if (!success) {
      // Habit not found or other error
      logger.warning('Increment failed for habit', {
        habit_id: habitId,
        owner_id: ownerId,
        message,
      });

      const errorBlocks = SlackBlockBuilder.dashboardError(
        message || 'この習慣は見つかりませんでした。'
      );
      await slackService.sendResponse(
        responseUrl,
        '習慣が見つかりません。',
        errorBlocks,
        false
      );
      return;
    }

    // Build confirmation message
    const habit = resultData?.habit;
    const habitName = habit?.name ?? '';
    const amount = resultData?.amount ?? 1;
    const workloadUnit = habit?.workload_unit ?? '';
    const streak = resultData?.streak ?? 0;

    // Check if habit just reached 100% (Requirement 4.5)
    // We consider it "just completed" if streak is 1 and this is a new completion
    const justCompleted = streak >= 1 && resultData?.activity;

    let blocks: SlackBlock[];
    let responseText: string;

    if (justCompleted && streak >= 1) {
      // Celebration message for completion
      blocks = SlackBlockBuilder.habitCompletionConfirm(habitName, streak);
      responseText = `🎉 ${habitName}を達成しました！ 🔥${streak}日連続！`;
    } else {
      // Normal confirmation message
      let confirmText: string;
      if (workloadUnit) {
        const amountStr = amount === Math.floor(amount) ? String(Math.floor(amount)) : String(amount);
        confirmText = `✅ *${habitName}* に +${amountStr} ${workloadUnit} を記録しました`;
      } else {
        confirmText = `✅ *${habitName}* を記録しました`;
      }

      blocks = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: confirmText,
          },
        },
      ];
      responseText = confirmText;
    }

    // Send confirmation (don't replace original dashboard)
    await slackService.sendResponse(responseUrl, responseText, blocks, false);

    logger.info('Increment successful for habit', {
      habit_id: habitId,
      owner_id: ownerId,
      amount,
    });
  } catch (error) {
    logger.error('Error handling increment for habit', error instanceof Error ? error : new Error(String(error)), {
      habit_id: habitId,
      owner_id: ownerId,
    });

    const errorBlocks = SlackBlockBuilder.dashboardError(
      '進捗の更新中にエラーが発生しました。再度お試しください。'
    );
    await slackService.sendResponse(
      responseUrl,
      'エラーが発生しました。',
      errorBlocks,
      false
    );
  }
}

/**
 * Process block actions (button clicks) from Slack.
 *
 * Handles:
 * - habit_done_* : Mark habit as complete (Req 6.1, 6.4, 6.5)
 * - habit_skip_* : Skip habit for today (Req 6.2)
 * - habit_later_* : Remind later (Req 6.3)
 * - habit_increment_* : Increment habit progress
 */
async function processBlockAction(
  payload: SlackInteractionPayload,
  settings: Settings
): Promise<void> {
  const supabase = getSupabaseClient(settings);
  const slackRepo = new SlackRepository(supabase);
  const habitRepo = new HabitRepository(supabase);
  const activityRepo = new ActivityRepository(supabase);
  const goalRepo = new GoalRepository(supabase);
  const completionReporter = new HabitCompletionReporter(habitRepo, activityRepo, goalRepo);
  const slackService = getSlackService();

  const slackUserId = payload.user.id;
  const slackTeamId = payload.team.id;
  const actions = payload.actions;
  const responseUrl = payload.response_url;

  if (!actions || actions.length === 0 || !responseUrl) {
    logger.warning('Missing actions or response_url in payload');
    return;
  }

  const action = actions[0]!;
  const actionId = action.action_id;
  const habitId = action.value;

  // Get VOW user from Slack user ID
  const connection = await slackRepo.getConnectionBySlackUser(slackUserId, slackTeamId);

  if (!connection) {
    logger.info('No VOW connection found for Slack user', { slack_user_id: slackUserId });
    await sendNotConnectedResponse(slackService, responseUrl);
    return;
  }

  const ownerType = connection.owner_type;
  const ownerId = connection.owner_id;

  try {
    // Route to appropriate handler based on action
    if (actionId.startsWith('habit_done_')) {
      await handleHabitDone(
        completionReporter,
        slackService,
        responseUrl,
        ownerType,
        ownerId,
        habitId
      );
    } else if (actionId.startsWith('habit_skip_')) {
      await handleHabitSkip(
        slackRepo,
        habitRepo,
        slackService,
        responseUrl,
        ownerType,
        ownerId,
        habitId
      );
    } else if (actionId.startsWith('habit_later_')) {
      await handleHabitLater(
        slackRepo,
        habitRepo,
        slackService,
        responseUrl,
        ownerType,
        ownerId,
        habitId
      );
    } else if (actionId.startsWith('habit_increment_')) {
      await handleHabitIncrement(
        completionReporter,
        slackService,
        responseUrl,
        ownerType,
        ownerId,
        habitId
      );
    } else {
      logger.warning('Unknown action_id', { action_id: actionId });
    }
  } catch (error) {
    // Requirement 6.6: Log Slack API errors
    if (error instanceof SlackAPIError) {
      logger.error('Slack API error processing block action', error as Error, {
        action_id: actionId,
        habit_id: habitId,
        owner_id: ownerId,
      });
    } else {
      logger.error('Error processing block action', error instanceof Error ? error : new Error(String(error)), {
        action_id: actionId,
        habit_id: habitId,
        owner_id: ownerId,
      });
    }

    // Send error response
    try {
      const errorMessage = getUserFriendlyMessage(error);
      await slackService.sendResponse(
        responseUrl,
        errorMessage,
        SlackBlockBuilder.errorMessage(errorMessage),
        true
      );
    } catch {
      // Ignore errors when sending error response
    }
  }
}

// =============================================================================
// Router Factory
// =============================================================================

/**
 * Create the Slack interactions router with all endpoints.
 */
export function createSlackInteractionsRouter(): Hono {
  const router = new Hono();

  /**
   * POST /api/slack/interactions
   *
   * Handle Slack interactive component payloads (button clicks).
   *
   * This endpoint receives POST requests from Slack when users interact
   * with buttons in messages. It must respond within 3 seconds, so actual
   * processing is done asynchronously.
   *
   * Note: In Lambda environment, we process synchronously because background
   * tasks don't work reliably when the Lambda function exits.
   *
   * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
   */
  router.post('/interactions', async (c: Context) => {
    const settings = getSettings();
    const slackService = getSlackService();

    // Check if running in Lambda environment
    const isLambda = Boolean(process.env['AWS_LAMBDA_FUNCTION_NAME']);

    // Get raw body for signature verification
    const rawBody = await c.req.text();

    // Get headers for signature verification
    const timestamp = c.req.header('X-Slack-Request-Timestamp') ?? '';
    const signature = c.req.header('X-Slack-Signature') ?? '';

    // Verify Slack signature to ensure request authenticity
    if (!(await slackService.verifySignature(timestamp, rawBody, signature))) {
      logger.warning('Invalid Slack signature received');
      return c.json({ error: 'Invalid signature' }, 401);
    }

    // Parse the payload from form data
    let payload: SlackInteractionPayload;
    try {
      const formData = parseFormData(rawBody);
      const payloadStr = formData['payload'] ?? '{}';
      payload = JSON.parse(payloadStr) as SlackInteractionPayload;
    } catch (error) {
      logger.error('Failed to parse Slack payload', error instanceof Error ? error : new Error(String(error)));
      return c.json({ error: 'Invalid payload format' }, 400);
    }

    const actionType = payload.type;

    if (actionType === 'block_actions') {
      if (isLambda) {
        // In Lambda, process synchronously to ensure completion
        await processBlockAction(payload, settings);
      } else {
        // In non-Lambda environments, process asynchronously
        // Note: We still await here for simplicity, but in production
        // you might want to use a proper background job queue
        processBlockAction(payload, settings).catch((error) => {
          logger.error('Background block action processing failed', error instanceof Error ? error : new Error(String(error)));
        });
      }

      // Return empty response immediately (Slack requirement)
      return c.json({});
    }

    logger.warning('Unknown Slack action type', { action_type: actionType });
    return c.json({ error: 'Unknown action type' });
  });

  return router;
}

// Export default router instance
export const slackInteractionsRouter = createSlackInteractionsRouter();
