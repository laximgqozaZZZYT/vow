"""
Follow-Up Handler

Lambda handler for processing habit follow-ups and remind-later notifications
triggered by EventBridge. Executes every 15 minutes to:
1. Send follow-up messages for habits 2+ hours past trigger_time
2. Send remind-later notifications when remind_later_at time arrives

Requirements:
- 2.1: Send follow-up messages when trigger_time + 2 hours has passed and habit is incomplete
- 6.2: Execute follow-up check Lambda every 15 minutes
- 6.3: Execute remind-later check every 15 minutes
- 6.5: Log processing results (sent count, error count) to CloudWatch
"""

import time
import asyncio
from typing import Any, Dict

from ..config import get_supabase_client
from ..utils.structured_logger import get_logger

# Configure structured logger for CloudWatch
logger = get_logger(__name__)


def handle_follow_up_check(event: dict, context: Any) -> dict:
    """
    Lambda handler for follow-up check triggered by EventBridge.
    
    This handler is invoked every 15 minutes by EventBridge Scheduler.
    It performs two checks:
    1. Sends follow-up messages for habits that are 2+ hours past their
       trigger_time and still incomplete
    2. Sends remind-later notifications for habits where remind_later_at
       time has arrived
    
    Args:
        event: EventBridge event payload containing:
            - source: "aws.scheduler"
            - detail-type: "follow-up-check"
        context: Lambda context object
        
    Returns:
        dict: Response containing:
            - statusCode: HTTP status code (200 for success, 500 for error)
            - body: Result details including:
                - follow_ups_sent: Number of follow-up messages sent
                - remind_laters_sent: Number of remind-later notifications sent
                - errors: Number of errors encountered
                - execution_time_ms: Total execution time in milliseconds
    """
    start_time = time.time()
    
    logger.info(
        "Starting follow-up check",
        extra={
            "event_source": event.get("source"),
            "detail_type": event.get("detail-type"),
        }
    )
    
    try:
        # Get Supabase client
        supabase = get_supabase_client()
        
        # Import FollowUpAgent here to avoid circular imports
        # and to allow for lazy loading
        from ..services.follow_up_agent import FollowUpAgent
        
        agent = FollowUpAgent(supabase)
        
        # Run the async checks
        # Use asyncio.new_event_loop() for Lambda environment compatibility
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        errors = 0
        
        try:
            # Check and send follow-ups for habits 2+ hours past trigger_time
            # (Requirement 2.1)
            follow_up_count = loop.run_until_complete(
                agent.check_and_send_follow_ups()
            )
            
            # Check and send remind-later notifications
            # (Requirement 6.3)
            remind_later_count = loop.run_until_complete(
                agent.check_remind_later()
            )
        except Exception as e:
            logger.warning(
                f"Partial error during follow-up processing: {e}",
                exc_info=True,
            )
            errors += 1
            # Set defaults if we failed partway through
            follow_up_count = getattr(locals(), 'follow_up_count', 0)
            remind_later_count = getattr(locals(), 'remind_later_count', 0)
        finally:
            loop.close()
        
        execution_time = int((time.time() - start_time) * 1000)
        
        # Log results for CloudWatch monitoring (Requirement 6.5)
        logger.info(
            "Follow-up check completed",
            extra={
                "follow_ups_sent": follow_up_count,
                "remind_laters_sent": remind_later_count,
                "errors": errors,
                "execution_time_ms": execution_time,
            }
        )
        
        return {
            "statusCode": 200,
            "body": {
                "follow_ups_sent": follow_up_count,
                "remind_laters_sent": remind_later_count,
                "errors": errors,
                "execution_time_ms": execution_time,
            }
        }
        
    except Exception as e:
        execution_time = int((time.time() - start_time) * 1000)
        
        # Log error for CloudWatch monitoring (Requirement 6.5)
        logger.error(
            f"Error in follow-up check: {e}",
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
