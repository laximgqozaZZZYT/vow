# Requirements Document

## Introduction

This document defines the requirements for implementing Slack integration with the habit management dashboard. The feature enables users to connect their Slack workspace to the app, report habit completions via Slack interactions, receive automated follow-up messages for incomplete habits, and get weekly summary reports delivered directly to Slack. This integration extends the existing notification and reminder capabilities by leveraging Slack as an additional communication channel.

## Glossary

- **Slack_Integration_Service**: The core backend service responsible for managing Slack OAuth, sending messages, and processing incoming events
- **Slack_Bot**: A Slack application that sends messages to users and responds to commands on behalf of the habit management system
- **Slack_OAuth_Handler**: A component that manages the OAuth 2.0 flow for connecting user Slack accounts to the app
- **Slack_Webhook_Handler**: A component that receives and processes incoming events from Slack (slash commands, interactive components)
- **Habit_Completion_Reporter**: A service that processes habit completion reports received via Slack and updates the database
- **Follow_Up_Agent**: An automated agent that monitors incomplete habits and sends follow-up messages via Slack
- **Weekly_Report_Generator**: A service that compiles weekly habit statistics and sends formatted reports to users via Slack
- **Slack_User_Mapping**: A database record linking a user's app account to their Slack user ID and workspace
- **Slash_Command**: A Slack feature allowing users to trigger actions by typing commands starting with "/" (e.g., /habit-done)
- **Interactive_Message**: A Slack message containing buttons or menus that users can interact with
- **Block_Kit**: Slack's UI framework for building rich, interactive messages

## Requirements

### Requirement 1: Slack OAuth Integration

**User Story:** As a user, I want to connect my Slack account to the habit management app, so that I can interact with my habits through Slack.

#### Acceptance Criteria

1. WHEN a user clicks "Connect Slack" in the settings, THE Slack_OAuth_Handler SHALL redirect the user to Slack's OAuth authorization page
2. WHEN Slack authorization is successful, THE Slack_OAuth_Handler SHALL receive the authorization code and exchange it for access tokens
3. WHEN tokens are received, THE Slack_Integration_Service SHALL store the access_token, refresh_token, team_id, and slack_user_id securely in the database
4. WHEN a user has connected Slack, THE Settings_Page SHALL display the connected Slack workspace name and user info
5. WHEN a user clicks "Disconnect Slack", THE Slack_Integration_Service SHALL revoke the tokens and remove the Slack_User_Mapping
6. IF OAuth authorization fails, THEN THE Slack_OAuth_Handler SHALL display an error message and allow the user to retry
7. WHEN storing tokens, THE Slack_Integration_Service SHALL encrypt sensitive token data before persisting

### Requirement 2: Slack Bot Setup and Configuration

**User Story:** As a system administrator, I want to configure the Slack Bot with appropriate permissions, so that it can send messages and receive commands.

#### Acceptance Criteria

1. THE Slack_Bot SHALL be configured with bot token scopes: chat:write, commands, users:read, and im:write
2. THE Slack_Bot SHALL be configured with user token scopes: identity.basic for OAuth
3. WHEN the Slack_Bot is installed to a workspace, THE Slack_Integration_Service SHALL store the bot_access_token for that workspace
4. THE Slack_Bot SHALL register slash commands: /habit-done, /habit-status, and /habit-list
5. THE Slack_Bot SHALL be configured to receive events via Request URL for interactive components
6. WHEN the Slack_Bot receives an event, THE Slack_Webhook_Handler SHALL verify the request signature using the signing secret

### Requirement 3: Habit Completion via Slack

**User Story:** As a user, I want to report habit completions through Slack, so that I can track my habits without opening the app.

#### Acceptance Criteria

1. WHEN a user types "/habit-done [habit-name]", THE Slack_Webhook_Handler SHALL search for matching habits and mark the specified habit as completed for today
2. WHEN a user types "/habit-done" without arguments, THE Slack_Bot SHALL respond with an interactive message listing today's incomplete habits as buttons
3. WHEN a user clicks a habit button in the interactive message, THE Habit_Completion_Reporter SHALL mark that habit as completed for today
4. WHEN a habit is successfully marked complete, THE Slack_Bot SHALL respond with a confirmation message including the habit name and streak count
5. IF the specified habit is not found, THEN THE Slack_Bot SHALL respond with an error message and suggest similar habit names
6. IF the habit is already completed for today, THEN THE Slack_Bot SHALL respond with a message indicating the habit was already completed
7. WHEN a habit is completed via Slack, THE Habit_Completion_Reporter SHALL create an activity record with source="slack"

### Requirement 4: Habit Status and List Commands

**User Story:** As a user, I want to check my habit status through Slack, so that I can quickly see my progress.

#### Acceptance Criteria

1. WHEN a user types "/habit-status", THE Slack_Bot SHALL respond with today's habit completion summary (completed/total)
2. WHEN displaying habit status, THE Slack_Bot SHALL use Block_Kit to format the message with habit names, completion status, and streak counts
3. WHEN a user types "/habit-list", THE Slack_Bot SHALL respond with a list of all active habits and their current streaks
4. WHEN displaying habit list, THE Slack_Bot SHALL group habits by their associated goals
5. THE Slack_Bot SHALL respond to slash commands within 3 seconds to meet Slack's timeout requirements

### Requirement 5: Automated Follow-Up Messages

**User Story:** As a user, I want to receive follow-up messages for incomplete habits, so that I stay accountable and don't forget my habits.

#### Acceptance Criteria

1. WHEN a habit has a trigger_time set and reminder_enabled is true, THE Follow_Up_Agent SHALL send a Slack reminder at the trigger_time
2. WHEN a habit remains incomplete 2 hours after the trigger_time, THE Follow_Up_Agent SHALL send a follow-up message asking if the user completed the habit
3. WHEN sending a follow-up message, THE Slack_Bot SHALL include interactive buttons: "Done ✓", "Skip today", and "Remind me later"
4. WHEN a user clicks "Done ✓", THE Habit_Completion_Reporter SHALL mark the habit as completed
5. WHEN a user clicks "Skip today", THE Follow_Up_Agent SHALL record the skip and not send further reminders for that habit today
6. WHEN a user clicks "Remind me later", THE Follow_Up_Agent SHALL schedule another reminder in 1 hour
7. IF slack_notifications_enabled is false in user preferences, THEN THE Follow_Up_Agent SHALL not send Slack messages

### Requirement 6: Weekly Summary Reports via Slack

**User Story:** As a user, I want to receive weekly summary reports via Slack, so that I can review my progress without opening the app.

#### Acceptance Criteria

1. WHEN the weekly report schedule time arrives (configurable, default Sunday 9:00 AM), THE Weekly_Report_Generator SHALL send a summary to connected Slack users
2. WHEN generating the weekly report, THE Weekly_Report_Generator SHALL include: total habits completed, completion rate, best streak, and habits needing attention
3. WHEN formatting the weekly report, THE Slack_Bot SHALL use Block_Kit to create a visually appealing message with sections and dividers
4. THE weekly report SHALL include a "View Full Report" button that links to the Weekly Review Dashboard in the app
5. WHEN a user has no habit activity for the week, THE Weekly_Report_Generator SHALL send an encouraging message with a link to add habits
6. THE Weekly_Report_Generator SHALL allow users to configure the report day and time in their preferences
7. IF weekly_slack_report_enabled is false in user preferences, THEN THE Weekly_Report_Generator SHALL not send the Slack report

### Requirement 7: Database Schema for Slack Integration

**User Story:** As a developer, I want the database schema extended to support Slack integration, so that the system can persist Slack connections and preferences.

#### Acceptance Criteria

1. THE Database_Migration SHALL create a slack_connections table with id, owner_type, owner_id, slack_user_id, slack_team_id, access_token (encrypted), refresh_token (encrypted), bot_access_token (encrypted), connected_at, and updated_at fields
2. THE Database_Migration SHALL add slack_notifications_enabled (BOOLEAN DEFAULT FALSE) and weekly_slack_report_enabled (BOOLEAN DEFAULT FALSE) columns to the notification_preferences table or create if not exists
3. THE Database_Migration SHALL add weekly_report_day (INTEGER DEFAULT 0) and weekly_report_time (TIME DEFAULT '09:00') columns for report scheduling
4. THE Database_Migration SHALL create appropriate indexes for efficient querying by owner_id and slack_user_id
5. THE Database_Migration SHALL apply Row Level Security policies consistent with existing tables
6. THE Database_Migration SHALL create a UNIQUE constraint on (owner_type, owner_id) in slack_connections

### Requirement 8: Slack Webhook Security

**User Story:** As a developer, I want secure webhook handling, so that only legitimate Slack requests are processed.

#### Acceptance Criteria

1. WHEN receiving a webhook request, THE Slack_Webhook_Handler SHALL verify the X-Slack-Signature header using HMAC-SHA256
2. WHEN verifying the signature, THE Slack_Webhook_Handler SHALL use the X-Slack-Request-Timestamp to prevent replay attacks
3. IF the timestamp is older than 5 minutes, THEN THE Slack_Webhook_Handler SHALL reject the request
4. IF signature verification fails, THEN THE Slack_Webhook_Handler SHALL return a 401 Unauthorized response
5. THE Slack_Webhook_Handler SHALL respond to Slack's URL verification challenge during app setup
6. WHEN processing interactive component callbacks, THE Slack_Webhook_Handler SHALL validate the callback_id format

### Requirement 9: Error Handling and Resilience

**User Story:** As a user, I want reliable Slack integration, so that my habit tracking is not disrupted by temporary failures.

#### Acceptance Criteria

1. IF Slack API returns a rate limit error, THEN THE Slack_Integration_Service SHALL implement exponential backoff and retry
2. IF Slack API returns a token expiration error, THEN THE Slack_Integration_Service SHALL attempt to refresh the token using the refresh_token
3. IF token refresh fails, THEN THE Slack_Integration_Service SHALL mark the connection as invalid and notify the user to reconnect
4. WHEN a Slack message fails to send, THE Slack_Integration_Service SHALL log the error and queue the message for retry
5. THE Slack_Integration_Service SHALL implement a circuit breaker pattern to prevent cascading failures
6. IF the Slack connection is invalid, THEN THE Follow_Up_Agent SHALL fall back to in-app notifications

### Requirement 10: Settings UI for Slack Integration

**User Story:** As a user, I want to manage my Slack integration settings, so that I can control how the app interacts with my Slack.

#### Acceptance Criteria

1. WHEN a user opens the Settings page, THE Settings_Page SHALL display a "Slack Integration" section
2. WHEN Slack is not connected, THE Settings_Page SHALL display a "Connect Slack" button with explanation of benefits
3. WHEN Slack is connected, THE Settings_Page SHALL display the connected workspace name, Slack username, and connection date
4. THE Settings_Page SHALL provide toggles for: slack_notifications_enabled and weekly_slack_report_enabled
5. THE Settings_Page SHALL provide selectors for weekly_report_day (day of week) and weekly_report_time
6. WHEN a user changes Slack settings, THE Settings_Page SHALL persist changes immediately
7. THE Settings_Page SHALL provide a "Test Connection" button that sends a test message to the user's Slack DM
