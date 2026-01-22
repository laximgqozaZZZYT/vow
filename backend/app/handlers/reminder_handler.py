"""
Reminder Handler

Lambda handler for processing habit reminders triggered by EventBridge.
Executes every 5 minutes to check and send reminders for habits
whose trigger_time has arrived.

Requirements:
- 1.1: Send Slack DM reminders when habit trigger_time arrives
- 6.1: Execute reminder check Lambda every 5 minutes
- 6.5: Log processing results (sent count, error count) to CloudWatch
"""

import time
import asyncio
from typing import Any, Dict

from ..config import get_supabase_client
from ..utils.structured_logger import get_logger

# Configure structured logger for CloudWatch
logger = get_logger(__name__)


def handle_reminder_check(event: dict, context: Any) -> dict:
    """
    Lambda handler for reminder check triggered by EventBridge.
    
    This handler is invoked every 5 minutes by EventBridge Scheduler.
    It checks all habits with trigger_time set and sends reminders
    to users via Slack DM.
    
    Args:
        event: EventBridge event payload containing:
            - source: "aws.scheduler"
            - detail-type: "reminder-check"
        context: Lambda context object
        
    Returns:
        dict: Response containing:
            - statusCode: HTTP status code (200 for success, 500 for error)
            - body: Result details including:
                - reminders_sent: Number of reminders successfully sent
                - errors: Number of errors encountered
                - execution_time_ms: Total execution time in milliseconds
    """
    start_time = time.time()
    
    logger.info(
        "Starting reminder check",
        extra={
            "event_source": event.get("source"),
            "detail_type": event.get("detail-type"),
        }
    )
    
    try:
        # Get Supabase client
        supabase = get_supabase_client()
        
        # Import ReminderService here to avoid circular imports
        # and to allow for lazy loading
        from ..services.reminder_service import ReminderService
        
        service = ReminderService(supabase)
        
        # Run the async reminder check
        # Use asyncio.new_event_loop() for Lambda environment compatibility
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            result = loop.run_until_complete(
                service.check_and_send_reminders()
            )
        finally:
            loop.close()
        
        execution_time = int((time.time() - start_time) * 1000)
        
        # Log results for CloudWatch monitoring (Requirement 6.5)
        logger.info(
            "Reminder check completed",
            extra={
                "reminders_sent": result["reminders_sent"],
                "errors": result["errors"],
                "execution_time_ms": execution_time,
            }
        )
        
        return {
            "statusCode": 200,
            "body": {
                "reminders_sent": result["reminders_sent"],
                "errors": result["errors"],
                "execution_time_ms": execution_time,
            }
        }
        
    except Exception as e:
        execution_time = int((time.time() - start_time) * 1000)
        
        # Log error for CloudWatch monitoring (Requirement 6.5)
        logger.error(
            f"Error in reminder check: {e}",
            extra={
                "error": str(e),
                "execution_time_ms": execution_time,
            },
            exc_info=True,
        )
        
        return {
            "statusCode": 500,
            "body": {
                "error": str(e),
                "execution_time_ms": execution_time,
            }
        }
