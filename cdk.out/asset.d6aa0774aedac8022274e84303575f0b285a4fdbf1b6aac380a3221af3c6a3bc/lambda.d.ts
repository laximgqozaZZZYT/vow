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
import { type LambdaEvent, type APIGatewayProxyResult } from 'hono/aws-lambda';
import type { Context } from 'aws-lambda';
/**
 * EventBridge scheduled event payload.
 */
interface EventBridgeEvent {
    source: string;
    'detail-type': string;
    detail?: Record<string, unknown>;
    time?: string;
    region?: string;
    account?: string;
    resources?: string[];
}
/**
 * Lambda handler response for EventBridge events.
 */
interface EventBridgeResponse {
    statusCode: number;
    body: ReminderCheckResult | FollowUpCheckResult | WeeklyReportResult | ErrorResult;
}
/**
 * Error result for EventBridge handlers.
 */
interface ErrorResult {
    error: string;
    execution_time_ms?: number;
    valid_types?: string[];
}
/**
 * Result from reminder check handler.
 */
interface ReminderCheckResult {
    reminders_sent: number;
    errors: number;
    execution_time_ms: number;
}
/**
 * Result from follow-up check handler.
 */
interface FollowUpCheckResult {
    follow_ups_sent: number;
    remind_laters_sent: number;
    errors: number;
    execution_time_ms: number;
}
/**
 * Result from weekly report handler.
 */
interface WeeklyReportResult {
    reports_sent: number;
    errors: number;
    execution_time_ms: number;
}
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
export declare function handler(event: EventBridgeEvent | LambdaEvent, context: Context): Promise<EventBridgeResponse | APIGatewayProxyResult>;
export default handler;
//# sourceMappingURL=lambda.d.ts.map