# Requirements Document

## Introduction

This document specifies the requirements for fixing Slack commands (`/habit-list`, `/habit-status`, `/habit-done`) that are not returning habit data. The root cause is that the Lambda is querying habits with the Slack User ID instead of the correct VOW owner_id from the slack_connections table.

## Glossary

- **VOW**: The habit management application (Value of Work)
- **Slack_Connection**: A database record linking a Slack user to a VOW user account
- **Owner_ID**: The unique identifier for a VOW user (UUID format)
- **Slack_User_ID**: The unique identifier for a Slack user (format: U0A9L0TME1Y)
- **Lambda**: AWS Lambda function running the VOW backend API
- **Slash_Command**: A Slack command starting with `/` (e.g., `/habit-list`)

## Requirements

### Requirement 1: Slack Connection Lookup

**User Story:** As a Slack user, I want my Slack commands to correctly identify my VOW account, so that I can see and manage my habits.

#### Acceptance Criteria

1. WHEN a Slack slash command is received, THE Slack_Repository SHALL query the slack_connections table using slack_user_id and slack_team_id
2. WHEN a connection is found, THE Slack_Repository SHALL return a SlackConnectionResponse containing owner_type and owner_id fields
3. WHEN the connection response is used, THE System SHALL extract the owner_id (VOW user UUID) for habit queries
4. IF no connection is found for the Slack user, THEN THE System SHALL return a "not connected" message prompting the user to connect their account

### Requirement 2: Habit List Command

**User Story:** As a connected Slack user, I want to use `/habit-list` to see all my habits, so that I can track my progress.

#### Acceptance Criteria

1. WHEN a user executes `/habit-list`, THE System SHALL query habits using the VOW owner_id from the slack_connection
2. WHEN habits are found, THE System SHALL display them grouped by goal with completion status
3. WHEN no habits are found, THE System SHALL display a message indicating no habits exist
4. THE System SHALL NOT query habits using the Slack_User_ID

### Requirement 3: Habit Status Command

**User Story:** As a connected Slack user, I want to use `/habit-status` to see today's progress, so that I can know how many habits I've completed.

#### Acceptance Criteria

1. WHEN a user executes `/habit-status`, THE System SHALL query today's habit completions using the VOW owner_id
2. WHEN the query completes, THE System SHALL display completed count, total count, and individual habit statuses
3. THE System SHALL NOT query activities using the Slack_User_ID

### Requirement 4: Habit Done Command

**User Story:** As a connected Slack user, I want to use `/habit-done` to mark habits as complete, so that I can track my daily progress.

#### Acceptance Criteria

1. WHEN a user executes `/habit-done [name]`, THE System SHALL find and complete the habit using the VOW owner_id
2. WHEN a user executes `/habit-done` without a name, THE System SHALL show incomplete habits for today using the VOW owner_id
3. WHEN a habit is completed, THE System SHALL create an activity record with the correct owner_type and owner_id
4. THE System SHALL NOT create activities with Slack_User_ID as the owner_id

### Requirement 5: Data Flow Integrity

**User Story:** As a system administrator, I want the data flow to correctly map Slack users to VOW users, so that all habit operations use the correct user context.

#### Acceptance Criteria

1. THE SlackConnectionResponse schema SHALL include owner_type and owner_id fields
2. WHEN parsing database results, THE System SHALL correctly deserialize owner_type and owner_id from the slack_connections table
3. THE System SHALL pass owner_type and owner_id to all habit-related service methods
4. THE System SHALL log the owner_id being used for debugging purposes

### Requirement 6: Backward Compatibility

**User Story:** As a developer, I want the fix to maintain backward compatibility, so that existing Slack OAuth connections continue to work.

#### Acceptance Criteria

1. THE System SHALL NOT modify the Slack OAuth flow
2. THE System SHALL NOT modify the slack_connections table schema
3. THE System SHALL NOT break existing connected users' ability to use Slack commands
