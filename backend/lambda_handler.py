"""
Lambda Handler for FastAPI Application

This module provides the AWS Lambda entry point that handles both:
1. EventBridge scheduled events (reminder-check, follow-up-check, weekly-report)
2. API Gateway HTTP requests via Mangum adapter

Requirements:
- 6.1: Execute reminder check Lambda every 5 minutes
- 6.2: Execute follow-up check Lambda every 15 minutes
- 6.3: Execute remind-later check every 15 minutes
- 6.4: Execute weekly report check Lambda every 15 minutes
"""
import os
import logging

# Set Lambda-specific environment variables before importing app
os.environ.setdefault("AWS_LAMBDA_FUNCTION_NAME", "vow-api")

from mangum import Mangum
from app.main import app
from app.handlers.reminder_handler import handle_reminder_check
from app.handlers.follow_up_handler import handle_follow_up_check
from app.handlers.weekly_report_handler import handle_weekly_report

# Configure logging for CloudWatch
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Mangum adapter configuration for API Gateway requests
# lifespan="off" is recommended for Lambda to avoid cold start issues
api_handler = Mangum(app, lifespan="off")


def handler(event, context):
    """
    Unified Lambda handler supporting both EventBridge and API Gateway.
    
    This handler routes requests based on the event source:
    - EventBridge Scheduler events are routed to specific handlers based on detail-type
    - API Gateway events are handled by Mangum/FastAPI
    
    EventBridge Event Format:
        {
            "source": "aws.scheduler",
            "detail-type": "reminder-check" | "follow-up-check" | "weekly-report",
            ...
        }
    
    Args:
        event: Lambda event payload (EventBridge or API Gateway format)
        context: Lambda context object
        
    Returns:
        dict: Response from the appropriate handler
            - For EventBridge: {"statusCode": int, "body": {...}}
            - For API Gateway: Mangum response format
    """
    # Check if this is an EventBridge Scheduler event
    # EventBridge events have "source" field set to "aws.scheduler"
    if event.get("source") == "aws.scheduler":
        schedule_type = event.get("detail-type", "")
        
        logger.info(
            f"Received EventBridge event",
            extra={
                "source": event.get("source"),
                "detail_type": schedule_type,
            }
        )
        
        # Route to appropriate handler based on schedule type
        # Requirement 6.1: Reminder check (5-minute interval)
        if schedule_type == "reminder-check":
            return handle_reminder_check(event, context)
        
        # Requirement 6.2, 6.3: Follow-up and remind-later check (15-minute interval)
        elif schedule_type == "follow-up-check":
            return handle_follow_up_check(event, context)
        
        # Requirement 6.4: Weekly report check (15-minute interval)
        elif schedule_type == "weekly-report":
            return handle_weekly_report(event, context)
        
        else:
            logger.warning(
                f"Unknown EventBridge schedule type: {schedule_type}",
                extra={"detail_type": schedule_type}
            )
            return {
                "statusCode": 400,
                "body": {
                    "error": f"Unknown schedule type: {schedule_type}",
                    "valid_types": ["reminder-check", "follow-up-check", "weekly-report"]
                }
            }
    
    # Handle API Gateway requests via Mangum
    # This includes all HTTP requests to the FastAPI application
    return api_handler(event, context)
