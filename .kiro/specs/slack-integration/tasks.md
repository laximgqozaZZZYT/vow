# Implementation Plan: Slack Integration

## Overview

This implementation plan breaks down the Slack integration feature into discrete coding tasks. The implementation follows a bottom-up approach: database schema first, then core services, followed by API endpoints, and finally the frontend UI. Property-based tests are placed close to their related implementations to catch errors early.

## Tasks

- [x] 1. Database schema and migrations
  - [x] 1.1 Create Supabase migration for slack_connections table
    - Create table with id, owner_type, owner_id, slack_user_id, slack_team_id, slack_team_name, slack_user_name, access_token, refresh_token, bot_access_token, token_expires_at, connected_at, updated_at, is_valid
    - Add indexes on (owner_type, owner_id) and slack_user_id
    - Enable RLS with policy for user access
    - Add UNIQUE constraint on (owner_type, owner_id)
    - _Requirements: 7.1, 7.4, 7.5, 7.6_

  - [x] 1.2 Create migration for notification_preferences Slack columns
    - Add slack_notifications_enabled (BOOLEAN DEFAULT FALSE)
    - Add weekly_slack_report_enabled (BOOLEAN DEFAULT FALSE)
    - Add weekly_report_day (INTEGER DEFAULT 0)
    - Add weekly_report_time (TIME DEFAULT '09:00')
    - _Requirements: 7.2, 7.3_

  - [x] 1.3 Create migration for slack_follow_up_status table
    - Create table with id, owner_type, owner_id, habit_id, date, reminder_sent_at, follow_up_sent_at, skipped, remind_later_at
    - Add indexes and RLS policies
    - _Requirements: 7.1, 7.4, 7.5_

- [x] 2. Backend Pydantic schemas and models
  - [x] 2.1 Create Slack schemas in backend/app/schemas/slack.py
    - SlackConnectionCreate, SlackConnectionResponse
    - SlackPreferencesUpdate
    - SlashCommandPayload, InteractionPayload
    - _Requirements: 10.1, 10.2_

  - [x] 2.2 Create Slack repository in backend/app/repositories/slack.py
    - CRUD operations for slack_connections
    - CRUD operations for slack_follow_up_status
    - Query methods for finding connections by owner_id and slack_user_id
    - _Requirements: 7.1, 7.6_

- [x] 3. Checkpoint - Database and schemas
  - Ensure migrations apply successfully
  - Verify RLS policies work correctly
  - Ensure all tests pass, ask the user if questions arise

- [x] 4. Core Slack services
  - [x] 4.1 Implement token encryption utility
    - Create encrypt_token and decrypt_token functions using Fernet
    - Store encryption key in environment variables
    - _Requirements: 1.7_

  - [ ]* 4.2 Write property test for token encryption
    - **Property 1: Token Storage Security and Completeness**
    - **Validates: Requirements 1.3, 1.7**

  - [x] 4.3 Implement SlackIntegrationService in backend/app/services/slack_service.py
    - send_message method for sending Slack messages
    - verify_signature method for webhook security
    - refresh_token method for token refresh
    - Rate limiting and circuit breaker logic
    - _Requirements: 8.1, 8.2, 9.1, 9.2, 9.5_

  - [ ]* 4.4 Write property test for webhook signature verification
    - **Property 13: Webhook Signature Verification**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4**

  - [x] 4.5 Implement SlackBlockBuilder in backend/app/services/slack_block_builder.py
    - habit_reminder method for reminder messages
    - habit_completion_confirm method for confirmation messages
    - habit_list method for interactive habit list
    - habit_status method for status summary
    - weekly_report method for weekly reports
    - error_message method for error responses
    - _Requirements: 3.4, 4.2, 5.3, 6.3_

  - [ ]* 4.6 Write property test for follow-up message format
    - **Property 8: Follow-Up Message Format**
    - **Validates: Requirements 5.3**

- [x] 5. Habit completion and status services
  - [x] 5.1 Implement HabitCompletionReporter in backend/app/services/habit_completion_reporter.py
    - complete_habit_by_name method
    - complete_habit_by_id method
    - get_incomplete_habits_today method
    - get_habit_streak method
    - _Requirements: 3.1, 3.3, 3.7_

  - [ ]* 5.2 Write property test for habit completion source tracking
    - **Property 2: Habit Completion Source Tracking**
    - **Validates: Requirements 3.7**

  - [ ]* 5.3 Write property test for completion confirmation content
    - **Property 3: Completion Confirmation Content**
    - **Validates: Requirements 3.4**

  - [ ]* 5.4 Write property test for status command accuracy
    - **Property 4: Status Command Accuracy**
    - **Validates: Requirements 4.1, 4.2**

  - [ ]* 5.5 Write property test for list command completeness
    - **Property 5: List Command Completeness**
    - **Validates: Requirements 4.3, 4.4**

- [x] 6. Checkpoint - Core services
  - Ensure all service methods work correctly
  - Verify encryption/decryption round-trip
  - Ensure all tests pass, ask the user if questions arise

- [x] 7. Follow-Up Agent implementation
  - [x] 7.1 Implement FollowUpAgent in backend/app/services/follow_up_agent.py
    - check_and_send_reminders method
    - check_and_send_follow_ups method
    - schedule_reminder_later method
    - skip_habit_today method
    - Fallback to in-app notifications when Slack invalid
    - _Requirements: 5.1, 5.2, 5.4, 5.5, 5.6, 5.7, 9.6_

  - [ ]* 7.2 Write property test for reminder trigger condition
    - **Property 6: Reminder Trigger Condition**
    - **Validates: Requirements 5.1**

  - [ ]* 7.3 Write property test for follow-up timing
    - **Property 7: Follow-Up Timing**
    - **Validates: Requirements 5.2**

  - [ ]* 7.4 Write property test for skip prevents further reminders
    - **Property 9: Skip Prevents Further Reminders**
    - **Validates: Requirements 5.5**

  - [ ]* 7.5 Write property test for notification preference respect
    - **Property 10: Notification Preference Respect**
    - **Validates: Requirements 5.7**

  - [ ]* 7.6 Write property test for invalid connection fallback
    - **Property 14: Invalid Connection Fallback**
    - **Validates: Requirements 9.6**

- [x] 8. Weekly Report Generator implementation
  - [x] 8.1 Implement WeeklyReportGenerator in backend/app/services/weekly_report_generator.py
    - generate_report method for computing statistics
    - send_all_weekly_reports method for batch sending
    - format_report_blocks method for Block Kit formatting
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [ ]* 8.2 Write property test for weekly report preference respect
    - **Property 11: Weekly Report Preference Respect**
    - **Validates: Requirements 6.7**

  - [ ]* 8.3 Write property test for weekly report content completeness
    - **Property 12: Weekly Report Content Completeness**
    - **Validates: Requirements 6.2, 6.3, 6.4**

- [x] 9. Checkpoint - Agents and generators
  - Ensure Follow-Up Agent logic is correct
  - Verify Weekly Report Generator produces valid reports
  - Ensure all tests pass, ask the user if questions arise

- [x] 10. API endpoints - OAuth
  - [x] 10.1 Implement OAuth router in backend/app/routers/slack_oauth.py
    - GET /api/slack/connect - initiate OAuth flow
    - GET /api/slack/callback - handle OAuth callback
    - POST /api/slack/disconnect - disconnect Slack
    - GET /api/slack/status - get connection status
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6_

  - [ ]* 10.2 Write unit tests for OAuth flow
    - Test successful OAuth callback
    - Test invalid state token rejection
    - Test disconnect flow
    - _Requirements: 1.1, 1.2, 1.5, 1.6_

- [x] 11. API endpoints - Webhooks
  - [x] 11.1 Implement Webhook router in backend/app/routers/slack_webhook.py
    - POST /api/slack/commands - handle slash commands
    - POST /api/slack/interactions - handle button clicks
    - POST /api/slack/events - handle Slack events
    - Signature verification middleware
    - _Requirements: 2.4, 3.1, 3.2, 3.3, 4.1, 4.3, 8.1, 8.5, 8.6_

  - [ ]* 11.2 Write unit tests for webhook handlers
    - Test /habit-done with various inputs
    - Test /habit-status and /habit-list
    - Test button interaction handling
    - Test signature verification
    - _Requirements: 3.1, 3.2, 3.5, 3.6, 8.1, 8.4_

- [x] 12. API endpoints - Preferences
  - [x] 12.1 Implement Slack preferences endpoints
    - GET /api/slack/preferences - get Slack preferences
    - PUT /api/slack/preferences - update Slack preferences
    - POST /api/slack/test - send test message
    - _Requirements: 10.4, 10.5, 10.6, 10.7_

- [x] 13. Register routers in main.py
  - Add slack_oauth router to FastAPI app
  - Add slack_webhook router to FastAPI app
  - _Requirements: 2.5_

- [x] 14. Checkpoint - Backend API complete
  - Test all API endpoints manually or with integration tests
  - Verify OAuth flow works end-to-end
  - Ensure all tests pass, ask the user if questions arise

- [x] 15. Frontend TypeScript types
  - [x] 15.1 Create Slack types in frontend/lib/types/slack.ts
    - SlackConnection interface
    - SlackPreferences interface
    - SlackConnectionStatus interface
    - _Requirements: 10.1, 10.2_

- [x] 16. Frontend API hooks
  - [x] 16.1 Create useSlackIntegration hook in frontend/hooks/useSlackIntegration.ts
    - connectSlack function
    - disconnectSlack function
    - getConnectionStatus function
    - updatePreferences function
    - testConnection function
    - _Requirements: 1.1, 1.5, 10.6, 10.7_

- [x] 17. Frontend Settings Page and Slack UI
  - [x] 17.1 Create Settings page at frontend/app/settings/page.tsx
    - Create settings page layout with sidebar navigation
    - Add sections for: Profile, Notifications, Integrations (Slack)
    - Use design system tokens (bg-card, border-border, rounded-lg)
    - Implement responsive layout for mobile
    - _Requirements: 10.1_

  - [x] 17.2 Create SlackIntegrationSection component in frontend/app/settings/components/Section.SlackIntegration.tsx
    - Display connection status (connected/not connected)
    - Connect Slack button with OAuth redirect
    - Disconnect button with confirmation modal
    - Connected workspace and user info display
    - Use design system: bg-card, text-foreground, rounded-md
    - _Requirements: 10.1, 10.2, 10.3_

  - [x] 17.3 Create SlackPreferencesForm component in frontend/app/settings/components/Form.SlackPreferences.tsx
    - Toggle for slack_notifications_enabled
    - Toggle for weekly_slack_report_enabled
    - Day selector for weekly_report_day (dropdown)
    - Time picker for weekly_report_time
    - Test Connection button with loading state
    - Auto-save on change with toast notification
    - _Requirements: 10.4, 10.5, 10.6, 10.7_

  - [x] 17.4 Create Settings navigation component
    - Sidebar with settings categories
    - Active state highlighting
    - Mobile-friendly collapsible menu
    - _Requirements: 10.1_

  - [x] 17.5 Add Settings link to dashboard header/navigation
    - Add settings icon/link to main navigation
    - Ensure consistent navigation across app
    - _Requirements: 10.1_

- [x] 18. OAuth callback page
  - [x] 18.1 Create OAuth callback page in frontend/app/settings/slack/callback/page.tsx
    - Handle OAuth callback redirect
    - Exchange code via backend API
    - Show success/error state
    - Redirect to settings on completion
    - _Requirements: 1.2, 1.6_

- [x] 19. Checkpoint - Frontend complete
  - Test Slack connection flow in browser
  - Verify preferences save correctly
  - Ensure all tests pass, ask the user if questions arise

- [x] 20. Scheduled job configuration
  - [x] 20.1 Configure scheduled jobs for Follow-Up Agent
    - Set up cron job or Lambda scheduled event for every 15 minutes
    - Call check_and_send_reminders and check_and_send_follow_ups
    - _Requirements: 5.1, 5.2_

  - [x] 20.2 Configure scheduled job for Weekly Report Generator
    - Set up cron job or Lambda scheduled event
    - Query users by their preferred report day/time
    - Call send_all_weekly_reports
    - _Requirements: 6.1, 6.6_

- [x] 21. Environment configuration
  - [x] 21.1 Add Slack configuration to environment files
    - SLACK_CLIENT_ID
    - SLACK_CLIENT_SECRET
    - SLACK_SIGNING_SECRET
    - SLACK_BOT_TOKEN (for app-level operations)
    - TOKEN_ENCRYPTION_KEY
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 21.2 Update .env.example files
    - Add Slack environment variables to backend/.env.example
    - Add Slack OAuth redirect URL to frontend/.env.example
    - _Requirements: 2.1_

- [x] 22. Final checkpoint
  - Run full test suite
  - Verify end-to-end OAuth flow
  - Test slash commands in Slack
  - Verify follow-up messages are sent
  - Verify weekly reports are generated
  - Ensure all tests pass, ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The Slack App must be created in Slack's API dashboard before testing OAuth
