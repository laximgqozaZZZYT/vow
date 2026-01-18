# Requirements Document

## Introduction

This document defines the requirements for implementing a comprehensive notification and reminder system for the habit management dashboard. The feature enables users to set habit trigger reminders following implementation intentions best practices ("When [trigger], I will [habit]"), receive due date notifications for tasks and goals, manage notification preferences, and view notification history. The system supports in-app notifications (toast/badge) and optional browser push notifications.

## Glossary

- **Notification_System**: The core module responsible for creating, scheduling, and displaying notifications to users
- **Reminder_Service**: A service that monitors habit trigger times and entity due dates to generate timely notifications
- **Notification_Preferences**: User-configurable settings that control notification behavior, channels, and quiet hours
- **Notification_Center**: A UI component displaying notification history and allowing users to manage notifications
- **Toast_Notification**: A temporary, non-blocking notification displayed at the corner of the screen
- **Badge_Indicator**: A visual indicator (typically a number) showing unread notification count
- **Push_Notification**: A browser-level notification that appears even when the app is not in focus
- **Trigger_Time**: The specific time of day when a habit reminder should be sent
- **Trigger_Message**: A customizable message following the "When [trigger], I will [habit]" format
- **Quiet_Hours**: A time period during which notifications are suppressed
- **Implementation_Intention**: A psychological strategy linking a specific cue (time/location) to a planned behavior

## Requirements

### Requirement 1: Habit Trigger Settings

**User Story:** As a user, I want to set specific trigger times and messages for my habits, so that I receive reminders that help me build consistent habits using implementation intentions.

#### Acceptance Criteria

1. WHEN a user opens the Habit Modal, THE Habit_Form SHALL display fields for trigger_time, trigger_message, and reminder_enabled
2. WHEN a user sets a trigger_time, THE Notification_System SHALL store the time value for scheduling reminders
3. WHEN a user enables reminders, THE Notification_System SHALL schedule notifications at the specified trigger_time
4. WHEN a user sets a trigger_message, THE Notification_System SHALL use this message in the reminder notification
5. IF trigger_message is empty, THEN THE Notification_System SHALL generate a default message using the habit name
6. WHEN displaying the trigger_message field, THE Habit_Form SHALL show a placeholder with the "When [trigger], I will [habit]" format
7. WHEN a user disables reminders, THE Notification_System SHALL stop sending notifications for that habit

### Requirement 2: Database Schema for Notifications

**User Story:** As a developer, I want the database schema extended to support notification preferences and history, so that the system can persist notification settings and records.

#### Acceptance Criteria

1. THE Database_Migration SHALL add trigger_time (TIME), trigger_message (TEXT), and reminder_enabled (BOOLEAN DEFAULT FALSE) columns to the habits table
2. THE Database_Migration SHALL create a notification_preferences table with id, owner_type, owner_id, and preference fields
3. THE Database_Migration SHALL create a notifications table with id, owner_type, owner_id, type, title, message, entity_type, entity_id, read, and created_at fields
4. THE Database_Migration SHALL create appropriate indexes for efficient querying by owner_id and created_at
5. THE Database_Migration SHALL apply Row Level Security policies consistent with existing tables
6. THE Database_Migration SHALL create a UNIQUE constraint on (owner_type, owner_id) in notification_preferences

### Requirement 3: Notification Preferences Management

**User Story:** As a user, I want to configure my notification preferences, so that I can control when and how I receive notifications.

#### Acceptance Criteria

1. WHEN a user opens notification settings, THE Preferences_Panel SHALL display toggles for habit_reminders_enabled, task_due_reminders_enabled, and goal_deadline_reminders_enabled
2. WHEN a user sets quiet hours, THE Notification_System SHALL suppress all notifications between quiet_hours_start and quiet_hours_end
3. WHEN a user enables push notifications, THE Notification_System SHALL request browser permission and store the push_enabled preference
4. WHEN a user disables a notification type, THE Notification_System SHALL stop sending notifications of that type
5. WHEN notification preferences are updated, THE Notification_System SHALL persist changes immediately
6. IF no preferences exist for a user, THEN THE Notification_System SHALL create default preferences with all notifications enabled

### Requirement 4: In-App Notification Display

**User Story:** As a user, I want to see notifications within the app, so that I can stay informed about reminders and due dates without leaving the dashboard.

#### Acceptance Criteria

1. WHEN a notification is triggered, THE Notification_System SHALL display a toast notification with title and message
2. WHEN displaying a toast, THE Toast_Notification SHALL auto-dismiss after 5 seconds unless the user interacts with it
3. WHEN a user clicks a toast notification, THE Notification_System SHALL navigate to the related entity (habit, task, or goal)
4. WHEN unread notifications exist, THE Header SHALL display a badge indicator with the unread count
5. WHEN a user clicks the notification badge, THE Notification_Center SHALL open showing notification history
6. WHEN displaying notifications in the center, THE Notification_Center SHALL show notifications grouped by date

### Requirement 5: Task Due Date Reminders

**User Story:** As a user, I want to receive reminders about upcoming task due dates, so that I can complete tasks on time.

#### Acceptance Criteria

1. WHEN a task's due date is 24 hours away, THE Reminder_Service SHALL create a "due tomorrow" notification
2. WHEN a task's due date is today, THE Reminder_Service SHALL create a "due today" notification
3. WHEN a task becomes overdue, THE Reminder_Service SHALL create an "overdue" notification
4. WHEN displaying a task reminder, THE Notification_System SHALL include the task name and due date in the message
5. IF task_due_reminders_enabled is false, THEN THE Reminder_Service SHALL not create task due notifications

### Requirement 6: Goal Deadline Reminders

**User Story:** As a user, I want to receive reminders about goal deadlines and milestone due dates, so that I can track my progress toward objectives.

#### Acceptance Criteria

1. WHEN a goal's deadline is 7 days away, THE Reminder_Service SHALL create a "deadline approaching" notification
2. WHEN a goal's deadline is 1 day away, THE Reminder_Service SHALL create a "deadline tomorrow" notification
3. WHEN a milestone's due date is 1 day away, THE Reminder_Service SHALL create a "milestone due tomorrow" notification
4. WHEN displaying a goal reminder, THE Notification_System SHALL include the goal name, deadline, and current progress
5. IF goal_deadline_reminders_enabled is false, THEN THE Reminder_Service SHALL not create goal deadline notifications

### Requirement 7: Browser Push Notifications

**User Story:** As a user, I want to receive browser push notifications, so that I can be reminded even when the app is not in focus.

#### Acceptance Criteria

1. WHEN a user enables push notifications, THE Notification_System SHALL request browser notification permission
2. IF browser permission is granted, THEN THE Notification_System SHALL register a service worker for push notifications
3. WHEN a notification is triggered and push_enabled is true, THE Notification_System SHALL send a browser push notification
4. WHEN a user clicks a push notification, THE Browser SHALL focus the app and navigate to the related entity
5. IF browser permission is denied, THEN THE Notification_System SHALL display an in-app message explaining how to enable permissions
6. WHILE quiet hours are active, THE Notification_System SHALL not send push notifications

### Requirement 8: Notification Center and History

**User Story:** As a user, I want to view my notification history, so that I can review past reminders and catch up on missed notifications.

#### Acceptance Criteria

1. WHEN a user opens the Notification Center, THE Notification_Center SHALL display a list of recent notifications
2. WHEN displaying notifications, THE Notification_Center SHALL show unread notifications with visual distinction
3. WHEN a user clicks a notification in the center, THE Notification_System SHALL mark it as read and navigate to the entity
4. WHEN a user clicks "Mark all as read", THE Notification_System SHALL update all notifications to read status
5. THE Notification_Center SHALL support pagination or infinite scroll for notification history
6. WHEN a notification is older than 30 days, THE Notification_System MAY archive or delete it

### Requirement 9: Notification Scheduling and Timing

**User Story:** As a developer, I want a reliable notification scheduling mechanism, so that notifications are delivered at the correct times.

#### Acceptance Criteria

1. WHEN the app loads, THE Reminder_Service SHALL check for pending notifications and schedule them
2. WHEN a habit's trigger_time matches the current time, THE Reminder_Service SHALL create a habit reminder notification
3. WHEN checking due dates, THE Reminder_Service SHALL run at regular intervals (every 15 minutes minimum)
4. WHEN the user's timezone changes, THE Notification_System SHALL adjust scheduled notifications accordingly
5. IF the app was closed during a scheduled notification time, THEN THE Reminder_Service SHALL create the notification on next app load
6. THE Reminder_Service SHALL prevent duplicate notifications for the same event within a 24-hour period

### Requirement 10: Type System and API Integration

**User Story:** As a developer, I want TypeScript types and API endpoints for notifications, so that the codebase maintains type safety and data flows correctly.

#### Acceptance Criteria

1. THE Notification interface SHALL include id, type, title, message, entityType, entityId, read, and createdAt fields
2. THE NotificationPreferences interface SHALL include all preference fields with appropriate types
3. THE API SHALL support creating, reading, updating, and deleting notifications
4. THE API SHALL support fetching and updating notification preferences
5. THE API SHALL support marking notifications as read (single and bulk)
6. THE API SHALL support filtering notifications by type, read status, and date range
