                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      # Requirements Document

## Introduction

This document specifies the requirements for fixing two critical issues with Slack commands in the VOW habit tracking application:

1. **Owner ID Mapping Issue**: Slack commands (`/habit-list`, `/habit-status`, `/habit-done`) return "You don't have any habits yet" despite users having habits in the database. The bug is in `slack_webhook.py` where `owner_id = connection.slack_user_id` is used instead of `owner_id = connection.owner_id`. This causes habit queries to use the Slack User ID (e.g., `U0A9L0TME1Y`) instead of the VOW owner_id UUID (e.g., `2c7cfc4d-7dc2-4a36-b85a-b8c23a012f47`).

2. **Event Loop Closure Issue**: Lambda connections fail with "Failed to fetch" after ~10-15 minutes of operation, requiring Lambda redeployment. CloudWatch logs show "Event loop is closed" errors. The root cause is that FastAPI's `BackgroundTasks` in `slack_interactions.py` schedules async tasks that execute after the HTTP response is sent, but Lambda's event loop may close before these tasks complete.

3. **Duplicate Router Issue**: There are two routers handling Slack commands (`slack_webhook.py` and `slack_interactions.py`). The active one in Lambda needs to be identified and fixed.

## Glossary

- **VOW**: The habit management application (Value of Work)
- **Slack_Connection**: A database record linking a Slack user to a VOW user account
- **Owner_ID**: The unique identifier for a VOW user (UUID format, e.g., `2c7cfc4d-7dc2-4a36-b85a-b8c23a012f47`)
- **Slack_User_ID**: The unique identifier for a Slack user (format: `U0A9L0TME1Y`)
- **Lambda**: AWS Lambda function running the VOW backend API
- **Slash_Command**: A Slack command starting with `/` (e.g., `/habit-list`)
- **Event_Loop**: Python asyncio event loop managing asynchronous operations
- **Background_Task**: FastAPI background task executed after HTTP response is sent
- **Mangum**: ASGI adapter for running FastAPI on AWS Lambda

## Requirements

### Requirement 1: Fix Owner ID Resolution in slack_webhook.py

**User Story:** As a Slack user, I want my Slack commands to correctly identify my VOW account, so that I can see and manage my habits.

#### Acceptance Criteria

1. WHEN a Slack slash command is received at `/api/slack/commands`, THE slack_webhook.py router SHALL extract owner_id directly from `connection.owner_id`, NOT from `connection.slack_user_id`
2. WHEN a connection is found, THE code SHALL use `owner_id = connection.owner_id` instead of the current buggy `owner_id = connection.slack_user_id`
3. THE System SHALL remove the redundant `get_connection_with_tokens()` call that attempts to fix the wrong owner_id
4. WHEN habit queries are executed, THE System SHALL use the owner_id (VOW user UUID) from the connection, not the Slack_User_ID
5. IF no connection is found for the Slack user, THEN THE System SHALL return a "not connected" message prompting the user to connect their account
6. THE System SHALL log the owner_id being used for habit queries to enable debugging

### Requirement 2: Habit List Command Functionality

**User Story:** As a connected Slack user, I want to use `/habit-list` to see all my habits, so that I can track my progress.

#### Acceptance Criteria

1. WHEN a user executes `/habit-list`, THE System SHALL query habits using the VOW owner_id from the slack_connection
2. WHEN habits are found, THE System SHALL display them grouped by goal with completion status
3. WHEN no habits are found for the correct owner_id, THE System SHALL display a message indicating no habits exist
4. THE System SHALL NOT query habits using the Slack_User_ID as the owner_id parameter

### Requirement 3: Habit Status Command Functionality

**User Story:** As a connected Slack user, I want to use `/habit-status` to see today's progress, so that I can know how many habits I've completed.

#### Acceptance Criteria

1. WHEN a user executes `/habit-status`, THE System SHALL query today's habit completions using the VOW owner_id
2. WHEN the query completes, THE System SHALL display completed count, total count, and individual habit statuses
3. THE System SHALL NOT query activities using the Slack_User_ID as the owner_id parameter

### Requirement 4: Habit Done Command Functionality

**User Story:** As a connected Slack user, I want to use `/habit-done` to mark habits as complete, so that I can track my daily progress.

#### Acceptance Criteria

1. WHEN a user executes `/habit-done [name]`, THE System SHALL find and complete the habit using the VOW owner_id
2. WHEN a user executes `/habit-done` without a name, THE System SHALL show incomplete habits for today using the VOW owner_id
3. WHEN a habit is completed, THE System SHALL create an activity record with the correct owner_type and owner_id from the connection
4. THE System SHALL NOT create activities with Slack_User_ID as the owner_id

### Requirement 5: Lambda Event Loop Stability

**User Story:** As a system administrator, I want the Lambda function to handle async operations correctly, so that Slack commands work reliably without requiring redeployment.

#### Acceptance Criteria

1. WHEN a background task is scheduled in Lambda, THE System SHALL ensure the event loop remains open until the task completes
2. WHEN multiple requests are processed, THE System SHALL not share event loops between Lambda invocations
3. IF an event loop error occurs, THEN THE System SHALL handle it gracefully and log the error
4. THE System SHALL NOT use FastAPI BackgroundTasks for async operations in Lambda environment
5. WHEN processing Slack commands, THE System SHALL complete all async operations before returning the HTTP response

### Requirement 6: Synchronous Processing for Lambda

**User Story:** As a developer, I want Slack command processing to be synchronous in Lambda, so that event loop issues are avoided.

#### Acceptance Criteria

1. WHEN running in Lambda environment, THE System SHALL process Slack commands synchronously instead of using background tasks
2. WHEN running in non-Lambda environment, THE System MAY continue using background tasks for development convenience
3. THE System SHALL detect Lambda environment using AWS_LAMBDA_FUNCTION_NAME environment variable
4. WHEN processing synchronously, THE System SHALL still respond to Slack within the 3-second timeout by using response_url for delayed responses

### Requirement 7: Debugging and Observability

**User Story:** As a developer, I want comprehensive logging for Slack command processing, so that I can diagnose issues quickly.

#### Acceptance Criteria

1. WHEN a Slack command is received, THE System SHALL log the slack_user_id, team_id, and command
2. WHEN a connection lookup completes, THE System SHALL log whether a connection was found and the resolved owner_id
3. WHEN habit queries are executed, THE System SHALL log the owner_type and owner_id being used
4. IF an error occurs during processing, THEN THE System SHALL log the full error with stack trace
5. THE System SHALL include correlation IDs in logs to trace request flow

### Requirement 8: Backward Compatibility

**User Story:** As a developer, I want the fix to maintain backward compatibility, so that existing functionality continues to work.

#### Acceptance Criteria

1. THE System SHALL NOT modify the Slack OAuth flow
2. THE System SHALL NOT modify the slack_connections table schema
3. THE System SHALL NOT break existing connected users' ability to use Slack commands
4. THE System SHALL NOT break Slack interactive components (button clicks)
5. THE System SHALL NOT affect scheduled Lambda events (reminders, follow-ups, weekly reports)

### Requirement 9: Router Consolidation

**User Story:** As a developer, I want a single, well-maintained router for Slack commands, so that bugs are easier to fix and maintain.

#### Acceptance Criteria

1. THE System SHALL use `/api/slack/commands` endpoint (slack_webhook.py) as the primary Slack command handler
2. THE System SHALL fix the owner_id bug in slack_webhook.py rather than switching to slack_interactions.py
3. THE System MAY deprecate or remove the duplicate `/slack/commands` endpoint (slack_interactions.py) in a future release
4. THE System SHALL ensure both `/api/slack/interactions` and `/slack/interactions` endpoints work correctly for button clicks
