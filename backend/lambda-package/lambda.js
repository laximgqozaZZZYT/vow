/**
 * Lambda Handler for Hono Application
 *
 * This module provides the AWS Lambda entry point that handles both:
 * 1. EventBridge scheduled events (reminder-check, follow-up-check, weekly-report)
 * 2. API Gateway HTTP requests via Hono's AWS Lambda adapter
 *
 * Requirements:
 * - 2.1: THE Lambda_Handler SHALL route EventBridge and API Gateway events
 * - 2.2: Support scheduled events for weekly reports
 * - 2.3: Support scheduled events for reminders
 * - 2.4: Support scheduled events for follow-ups
 * - 2.5: Handle API Gateway HTTP requests
 * - 2.6: Register cleanup handlers for graceful shutdown
 */
import { handle } from 'hono/aws-lambda';
import { app } from './index.js';
import { getLogger } from './utils/logger.js';
import { getSettings } from './config.js';
// Configure logger for Lambda
const logger = getLogger('lambda');
// =============================================================================
// Cleanup Handlers
// =============================================================================
/**
 * Clean up resources on Lambda termination.
 *
 * Requirement 2.6: Register cleanup handlers for graceful shutdown
 *
 * This function is called:
 * - When the Lambda container is being terminated (via SIGTERM)
 * - When the process exits (via process.on('exit'))
 *
 * Note: Lambda doesn't guarantee shutdown hooks will complete,
 * but this provides best-effort cleanup for graceful termination.
 */
function cleanupConnections() {
    try {
        logger.info('Cleaning up connections on Lambda termination');
        // Add any cleanup logic here (e.g., closing database connections)
        // Currently, Supabase JS client handles connection pooling internally
        logger.info('Connections cleaned up successfully');
    }
    catch (error) {
        // Log but don't throw - cleanup failures shouldn't cause issues
        logger.warning('Error during connection cleanup (non-fatal)', {
            error: error instanceof Error ? error.message : String(error),
        });
    }
}
/**
 * Handle SIGTERM signal for graceful shutdown.
 *
 * Lambda sends SIGTERM before terminating the execution environment.
 * This handler ensures connections are properly closed.
 */
function sigTermHandler() {
    logger.info('Received SIGTERM, initiating graceful shutdown');
    cleanupConnections();
}
// Register cleanup handlers for Lambda termination
// Requirement 2.6: Register cleanup handlers
// Register process exit handler
process.on('exit', () => {
    cleanupConnections();
});
// Register SIGTERM handler for Lambda container termination
// Lambda sends SIGTERM before terminating the execution environment
process.on('SIGTERM', sigTermHandler);
// Register uncaught exception handler
process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', error);
    cleanupConnections();
    process.exit(1);
});
// Register unhandled rejection handler
process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', reason instanceof Error ? reason : new Error(String(reason)));
});
// =============================================================================
// EventBridge Event Handlers
// =============================================================================
/**
 * Handle reminder check triggered by EventBridge.
 *
 * This handler is invoked every 5 minutes by EventBridge Scheduler.
 * It checks all habits with trigger_time set and sends reminders
 * to users via Slack DM.
 *
 * Requirement 2.3: Support scheduled events for reminders
 *
 * @param event - EventBridge event payload
 * @param _context - Lambda context object (unused but required by Lambda signature)
 * @returns Response with reminder check results
 */
async function handleReminderCheck(event, _context) {
    const startTime = Date.now();
    logger.info('Starting reminder check', {
        event_source: event.source,
        detail_type: event['detail-type'],
    });
    try {
        // Import ReminderService dynamically to avoid circular imports
        // and to allow for lazy loading
        // Note: ReminderService needs to be implemented in TypeScript
        // For now, we'll return a placeholder response
        // TODO: Implement ReminderService in TypeScript
        // const { ReminderService } = await import('./services/reminderService');
        // const service = new ReminderService();
        // const result = await service.checkAndSendReminders();
        const executionTime = Date.now() - startTime;
        // Placeholder response until ReminderService is implemented
        const result = {
            reminders_sent: 0,
            errors: 0,
            execution_time_ms: executionTime,
        };
        logger.info('Reminder check completed', {
            reminders_sent: result.reminders_sent,
            errors: result.errors,
            execution_time_ms: result.execution_time_ms,
        });
        return {
            statusCode: 200,
            body: result,
        };
    }
    catch (error) {
        const executionTime = Date.now() - startTime;
        logger.error('Error in reminder check', error instanceof Error ? error : new Error(String(error)), { execution_time_ms: executionTime });
        return {
            statusCode: 500,
            body: {
                error: error instanceof Error ? error.message : String(error),
                execution_time_ms: executionTime,
            },
        };
    }
}
/**
 * Handle follow-up check triggered by EventBridge.
 *
 * This handler is invoked every 15 minutes by EventBridge Scheduler.
 * It performs two checks:
 * 1. Sends follow-up messages for habits that are 2+ hours past their
 *    trigger_time and still incomplete
 * 2. Sends remind-later notifications for habits where remind_later_at
 *    time has arrived
 *
 * Requirement 2.4: Support scheduled events for follow-ups
 *
 * @param event - EventBridge event payload
 * @param _context - Lambda context object (unused but required by Lambda signature)
 * @returns Response with follow-up check results
 */
async function handleFollowUpCheck(event, _context) {
    const startTime = Date.now();
    logger.info('Starting follow-up check', {
        event_source: event.source,
        detail_type: event['detail-type'],
    });
    try {
        // Import FollowUpAgent dynamically to avoid circular imports
        // Note: FollowUpAgent needs to be implemented in TypeScript
        // For now, we'll return a placeholder response
        // TODO: Implement FollowUpAgent in TypeScript
        // const { FollowUpAgent } = await import('./services/followUpAgent');
        // const agent = new FollowUpAgent();
        // const followUpCount = await agent.checkAndSendFollowUps();
        // const remindLaterCount = await agent.checkRemindLater();
        const executionTime = Date.now() - startTime;
        // Placeholder response until FollowUpAgent is implemented
        const result = {
            follow_ups_sent: 0,
            remind_laters_sent: 0,
            errors: 0,
            execution_time_ms: executionTime,
        };
        logger.info('Follow-up check completed', {
            follow_ups_sent: result.follow_ups_sent,
            remind_laters_sent: result.remind_laters_sent,
            errors: result.errors,
            execution_time_ms: result.execution_time_ms,
        });
        return {
            statusCode: 200,
            body: result,
        };
    }
    catch (error) {
        const executionTime = Date.now() - startTime;
        logger.error('Error in follow-up check', error instanceof Error ? error : new Error(String(error)), { execution_time_ms: executionTime });
        return {
            statusCode: 500,
            body: {
                error: error instanceof Error ? error.message : String(error),
                execution_time_ms: executionTime,
            },
        };
    }
}
/**
 * Handle weekly report check triggered by EventBridge.
 *
 * This handler is invoked every 15 minutes by EventBridge Scheduler.
 * It checks all users with weekly_slack_report_enabled and sends
 * weekly reports to those whose configured day and time have arrived.
 *
 * Requirement 2.2: Support scheduled events for weekly reports
 *
 * @param event - EventBridge event payload
 * @param _context - Lambda context object (unused but required by Lambda signature)
 * @returns Response with weekly report results
 */
async function handleWeeklyReport(event, _context) {
    const startTime = Date.now();
    logger.info('Starting weekly report check', {
        event_source: event.source,
        detail_type: event['detail-type'],
    });
    try {
        // Import WeeklyReportGenerator and repositories
        const { WeeklyReportGenerator } = await import('./services/weeklyReportGenerator.js');
        const { SlackRepository } = await import('./repositories/slackRepository.js');
        const { HabitRepository } = await import('./repositories/habitRepository.js');
        const { ActivityRepository } = await import('./repositories/activityRepository.js');
        const { createClient } = await import('@supabase/supabase-js');
        const settings = getSettings();
        // Create Supabase client
        if (!settings.supabaseUrl || !settings.supabaseServiceRoleKey) {
            throw new Error('Supabase configuration is missing');
        }
        const supabase = createClient(settings.supabaseUrl, settings.supabaseServiceRoleKey);
        // Create repositories
        const slackRepo = new SlackRepository(supabase);
        const habitRepo = new HabitRepository(supabase);
        const activityRepo = new ActivityRepository(supabase);
        // Create generator and send reports
        const generator = new WeeklyReportGenerator(slackRepo, habitRepo, activityRepo);
        const reportsSent = await generator.sendAllWeeklyReports(supabase);
        const executionTime = Date.now() - startTime;
        const result = {
            reports_sent: reportsSent,
            errors: 0,
            execution_time_ms: executionTime,
        };
        logger.info('Weekly report check completed', {
            reports_sent: result.reports_sent,
            errors: result.errors,
            execution_time_ms: result.execution_time_ms,
        });
        return {
            statusCode: 200,
            body: result,
        };
    }
    catch (error) {
        const executionTime = Date.now() - startTime;
        logger.error('Error in weekly report check', error instanceof Error ? error : new Error(String(error)), { execution_time_ms: executionTime });
        return {
            statusCode: 500,
            body: {
                error: error instanceof Error ? error.message : String(error),
                execution_time_ms: executionTime,
            },
        };
    }
}
// =============================================================================
// Main Lambda Handler
// =============================================================================
/**
 * Create the Hono AWS Lambda handler.
 *
 * This wraps the Hono app with the AWS Lambda adapter for handling
 * API Gateway events.
 */
const apiHandler = handle(app);
/**
 * Unified Lambda handler supporting both EventBridge and API Gateway.
 *
 * This handler routes requests based on the event source:
 * - EventBridge Scheduler events are routed to specific handlers based on detail-type
 * - API Gateway events are handled by Hono via the AWS Lambda adapter
 *
 * Requirements:
 * - 2.1: THE Lambda_Handler SHALL route EventBridge and API Gateway events
 * - 2.5: Handle API Gateway HTTP requests
 *
 * EventBridge Event Format:
 * ```json
 * {
 *   "source": "aws.scheduler",
 *   "detail-type": "reminder-check" | "follow-up-check" | "weekly-report",
 *   ...
 * }
 * ```
 *
 * @param event - Lambda event payload (EventBridge or API Gateway format)
 * @param context - Lambda context object
 * @returns Response from the appropriate handler
 */
export async function handler(event, context) {
    // Set Lambda context for structured logging
    const lambdaContext = {
        awsRequestId: context.awsRequestId,
        functionName: context.functionName,
        functionVersion: context.functionVersion,
        memoryLimitInMB: parseInt(String(context.memoryLimitInMB), 10),
        invokedFunctionArn: context.invokedFunctionArn,
        getRemainingTimeInMillis: () => context.getRemainingTimeInMillis(),
    };
    logger.setLambdaContext(lambdaContext);
    // Check if this is an EventBridge Scheduler event
    // EventBridge events have "source" field set to "aws.scheduler"
    if ('source' in event && event.source === 'aws.scheduler') {
        const eventBridgeEvent = event;
        const scheduleType = eventBridgeEvent['detail-type'] ?? '';
        logger.info('Received EventBridge event', {
            source: eventBridgeEvent.source,
            detail_type: scheduleType,
        });
        // Route to appropriate handler based on schedule type
        switch (scheduleType) {
            // Requirement 2.3: Reminder check (5-minute interval)
            case 'reminder-check':
                return handleReminderCheck(eventBridgeEvent, context);
            // Requirement 2.4: Follow-up and remind-later check (15-minute interval)
            case 'follow-up-check':
                return handleFollowUpCheck(eventBridgeEvent, context);
            // Requirement 2.2: Weekly report check (15-minute interval)
            case 'weekly-report':
                return handleWeeklyReport(eventBridgeEvent, context);
            default:
                logger.warning(`Unknown EventBridge schedule type: ${scheduleType}`, {
                    detail_type: scheduleType,
                });
                return {
                    statusCode: 400,
                    body: {
                        error: `Unknown schedule type: ${scheduleType}`,
                        valid_types: ['reminder-check', 'follow-up-check', 'weekly-report'],
                    },
                };
        }
    }
    // Handle API Gateway requests via Hono
    // This includes all HTTP requests to the Hono application
    // Requirement 2.5: Handle API Gateway HTTP requests
    return apiHandler(event, context);
}
// Export the handler as default for Lambda
export default handler;
//# sourceMappingURL=lambda.js.map