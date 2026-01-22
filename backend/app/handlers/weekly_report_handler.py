"""
Weekly Report Handler

Lambda handler for processing weekly habit reports triggered by EventBridge.
Executes every 15 minutes to check and send weekly reports to users
whose configured weekly_report_day and weekly_report_time have arrived.

Requirements:
- 4.1: Send weekly reports when user's configured weekly_report_day and weekly_report_time arrive
- 6.4: Execute weekly report check Lambda every 15 minutes
- 6.5: Log processing results (sent count, error count) to CloudWatch
"""

import time
import asyncio
from typing import Any, Dict

from ..config import get_supabase_client
from ..utils.structured_logger import get_logger

# Configure structured logger for CloudWatch
logger = get_logger(__name__)


def handle_weekly_report(event: dict, context: Any) -> dict:
    """
    Lambda handler for weekly report check triggered by EventBridge.
    
    This handler is invoked every 15 minutes by EventBridge Scheduler.
    It checks all users with weekly_slack_report_enabled and sends
    weekly reports to those whose configured day and time have arrived.
    
    Args:
        event: EventBridge event payload containing:
            - source: "aws.scheduler"
            - detail-type: "weekly-report"
        context: Lambda context object
        
    Returns:
        dict: Response containing:
            - statusCode: HTTP status code (200 for success, 500 for error)
            - body: Result details including:
                - reports_sent: Number of weekly reports successfully sent
                - errors: Number of errors encountered
                - execution_time_ms: Total execution time in milliseconds
    """
    start_time = time.time()
    
    logger.info(
        "Starting weekly report check",
        extra={
            "event_source": event.get("source"),
            "detail_type": event.get("detail-type"),
        }
    )
    
    try:
        # Get Supabase client
        supabase = get_supabase_client()
        
        # Import WeeklyReportGenerator here to avoid circular imports
        # and to allow for lazy loading
        from ..services.weekly_report_generator import WeeklyReportGenerator
        
        generator = WeeklyReportGenerator(supabase)
        
        # Run the async weekly report check
        # Use asyncio.new_event_loop() for Lambda environment compatibility
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            reports_sent = loop.run_until_complete(
                generator.send_all_weekly_reports()
            )
        finally:
            loop.close()
        
        execution_time = int((time.time() - start_time) * 1000)
        
        # Log results for CloudWatch monitoring (Requirement 6.5)
        logger.info(
            "Weekly report check completed",
            extra={
                "reports_sent": reports_sent,
                "errors": 0,
                "execution_time_ms": execution_time,
            }
        )
        
        return {
            "statusCode": 200,
            "body": {
                "reports_sent": reports_sent,
                "errors": 0,
                "execution_time_ms": execution_time,
            }
        }
        
    except Exception as e:
        execution_time = int((time.time() - start_time) * 1000)
        
        # Log error for CloudWatch monitoring (Requirement 6.5)
        logger.error(
            f"Error in weekly report check: {e}",
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
