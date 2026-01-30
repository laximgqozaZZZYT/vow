# Implementation Plan: Notification Reminders

## Overview

This implementation plan breaks down the notification and reminder system into discrete coding tasks. The approach starts with database schema and types, then builds core services, followed by UI components, and finally integration and testing.

## Tasks

- [ ] 1. Database schema and migrations
  - [ ] 1.1 Create migration to extend habits table with trigger fields
    - Add trigger_time (TIME), trigger_message (TEXT), reminder_enabled (BOOLEAN DEFAULT FALSE) columns
    - Create index on reminder_enabled for efficient querying
    - _Requirements: 2.1_
  
  - [ ] 1.2 Create migration for notification_preferences table
    - Create table with id, owner_type, owner_id, preference fields, timestamps
    - Add UNIQUE constraint on (owner_type, owner_id)
    - Create indexes for owner lookup
    - Apply RLS policies for users and guests
    - _Requirements: 2.2, 2.5, 2.6_
  
  - [ ] 1.3 Create migration for notifications table
    - Create table with id, owner_type, owner_id, type, title, message, entity_type, entity_id, read, created_at
    - Create indexes on (owner_type, owner_id), created_at, and (owner_type, owner_id, read)
    - Apply RLS policies for users and guests
    - _Requirements: 2.3, 2.4, 2.5_

- [ ] 2. TypeScript types and API layer
  - [ ] 2.1 Define notification types and interfaces
    - Create NotificationType union type
    - Create EntityType union type
    - Create Notification interface
    - Create CreateNotificationPayload interface
    - Create NotificationPreferences interface
    - Create UpdatePreferencesPayload interface
    - Add to frontend/app/dashboard/types/
    - _Requirements: 10.1, 10.2_
  
  - [ ] 2.2 Extend Habit type with trigger fields
    - Add triggerTime, triggerMessage, reminderEnabled to Habit interface
    - Update CreateHabitPayload and UpdateHabitPayload
    - _Requirements: 1.1_
  
  - [ ] 2.3 Add notification API methods to supabase-direct client
    - Add createNotification, getNotifications, updateNotification, deleteNotification
    - Add getNotificationPreferences, updateNotificationPreferences
    - Add markNotificationAsRead, markAllNotificationsAsRead
    - Add filtering support (type, read, date range)
    - _Requirements: 10.3, 10.4, 10.5, 10.6_

- [ ] 3. Checkpoint - Verify database and types
  - Ensure migrations run successfully
  - Ensure TypeScript types compile without errors
  - Ask the user if questions arise

- [ ] 4. Core notification services
  - [ ] 4.1 Create useNotificationPreferences hook
    - Fetch preferences on mount
    - Create default preferences if none exist
    - Provide updatePreferences function
    - Handle optimistic updates with rollback
    - _Requirements: 3.1, 3.5, 3.6_
  
  - [ ] 4.2 Create useNotifications hook
    - Fetch notifications with pagination
    - Provide unread count
    - Provide markAsRead and markAllAsRead functions
    - Support filtering by type and read status
    - _Requirements: 4.4, 8.1, 8.3, 8.4, 8.5_
  
  - [ ] 4.3 Create useNotificationService hook
    - Implement createNotification with quiet hours check
    - Implement isQuietHours helper
    - Implement navigateToEntity for different entity types
    - Integrate with ToastManager for display
    - _Requirements: 3.2, 4.1, 4.3_
  
  - [ ]* 4.4 Write property test for quiet hours suppression
    - **Property 6: Quiet Hours Suppression**
    - Generate random quiet hours ranges and notification times
    - Assert notifications within range are suppressed
    - **Validates: Requirements 3.2, 7.6**
  
  - [ ]* 4.5 Write property test for unread badge accuracy
    - **Property 11: Unread Badge Accuracy**
    - Generate random sets of notifications with varying read states
    - Assert badge count equals count of read=false
    - **Validates: Requirements 4.4**

- [ ] 5. Reminder service implementation
  - [ ] 5.1 Create useReminderService hook
    - Initialize on app load
    - Set up 15-minute interval for checking due dates
    - Implement cleanup on unmount
    - _Requirements: 9.1, 9.3_
  
  - [ ] 5.2 Implement habit reminder checking
    - Check habits with reminder_enabled=true
    - Match trigger_time with current time (1-minute tolerance)
    - Create habit_reminder notification with trigger_message or default
    - Prevent duplicates within 24 hours
    - _Requirements: 1.3, 1.4, 1.5, 9.2, 9.6_
  
  - [ ] 5.3 Implement task due date checking
    - Check tasks with due_date set
    - Calculate time difference and select notification type
    - Create task_due_tomorrow, task_due_today, or task_overdue notification
    - Include task name and due date in message
    - Respect task_due_reminders_enabled preference
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  
  - [ ] 5.4 Implement goal deadline checking
    - Check goals with deadline set
    - Create goal_deadline_week (7 days) or goal_deadline_tomorrow (1 day) notification
    - Include goal name, deadline, and progress in message
    - Respect goal_deadline_reminders_enabled preference
    - _Requirements: 6.1, 6.2, 6.4, 6.5_
  
  - [ ] 5.5 Implement milestone due date checking
    - Check milestones with due_date set
    - Create milestone_due_tomorrow notification
    - Respect goal_deadline_reminders_enabled preference
    - _Requirements: 6.3, 6.5_
  
  - [ ]* 5.6 Write property test for task due notification type selection
    - **Property 13: Task Due Notification Type Selection**
    - Generate random due dates relative to current time
    - Assert correct notification type is selected
    - **Validates: Requirements 5.1, 5.2, 5.3**
  
  - [ ]* 5.7 Write property test for duplicate prevention
    - **Property 22: Duplicate Prevention (Idempotence)**
    - Generate random events
    - Call creation multiple times
    - Assert only one notification exists
    - **Validates: Requirements 9.6**

- [ ] 6. Checkpoint - Verify core services
  - Ensure all hooks compile and basic functionality works
  - Run property tests if implemented
  - Ask the user if questions arise

- [ ] 7. Push notification service
  - [ ] 7.1 Create service worker for push notifications
    - Create public/sw-push.js
    - Handle push event to display notification
    - Handle notificationclick event to focus app and navigate
    - _Requirements: 7.2, 7.4_
  
  - [ ] 7.2 Create usePushService hook
    - Check browser support for notifications
    - Implement requestPermission function
    - Register service worker on permission grant
    - Implement sendPush function
    - Handle permission denied state
    - _Requirements: 7.1, 7.2, 7.3, 7.5_
  
  - [ ] 7.3 Integrate push service with notification service
    - Call sendPush when push_enabled and permission granted
    - Skip push during quiet hours
    - _Requirements: 7.3, 7.6_

- [ ] 8. UI Components - Notification Center
  - [ ] 8.1 Create Widget.NotificationCenter.tsx
    - Display notification list with pagination/infinite scroll
    - Group notifications by date
    - Show unread notifications with visual distinction (bg-muted for unread)
    - Handle click to mark as read and navigate
    - Include "Mark all as read" button
    - Follow design system tokens (bg-card, border-border, rounded-lg)
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
  
  - [ ] 8.2 Add notification badge to Layout.Header.tsx
    - Display badge with unread count when > 0
    - Use bg-destructive for badge background
    - Handle click to open Notification Center
    - _Requirements: 4.4, 4.5_
  
  - [ ]* 8.3 Write property test for date grouping correctness
    - **Property 12: Date Grouping Correctness**
    - Generate random notification sets with various dates
    - Assert notifications are grouped by date and ordered descending
    - **Validates: Requirements 4.6**

- [ ] 9. UI Components - Notification Preferences
  - [ ] 9.1 Create Modal.NotificationPreferences.tsx
    - Display toggles for habit_reminders_enabled, task_due_reminders_enabled, goal_deadline_reminders_enabled
    - Display time pickers for quiet_hours_start and quiet_hours_end
    - Display toggle for push_enabled with permission request
    - Auto-save on change
    - Follow design system tokens
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  
  - [ ] 9.2 Add notification settings access to Layout.Sidebar.tsx or settings menu
    - Add menu item or button to open preferences modal
    - _Requirements: 3.1_

- [ ] 10. UI Components - Habit Trigger Settings
  - [ ] 10.1 Extend Form.Habit.tsx with trigger fields
    - Add trigger_time time picker
    - Add trigger_message text input with placeholder "When [time], I will [habit name]"
    - Add reminder_enabled toggle
    - Auto-save on blur
    - _Requirements: 1.1, 1.2, 1.4, 1.6, 1.7_
  
  - [ ]* 10.2 Write property test for trigger time persistence
    - **Property 1: Trigger Time Persistence Round-Trip**
    - Generate random valid TIME values
    - Set as trigger_time, save, retrieve
    - Assert retrieved value equals original
    - **Validates: Requirements 1.2**

- [ ] 11. Checkpoint - Verify UI components
  - Ensure all components render correctly
  - Test basic interactions
  - Ask the user if questions arise

- [ ] 12. Integration and wiring
  - [ ] 12.1 Initialize services in Dashboard.Shell.tsx
    - Initialize useReminderService
    - Initialize useNotificationService
    - Initialize usePushService
    - Provide notification context to children
    - _Requirements: 9.1_
  
  - [ ] 12.2 Wire toast notifications
    - Integrate notification service with existing ToastManager
    - Display toast on notification creation (when not in quiet hours)
    - Handle toast click for navigation
    - _Requirements: 4.1, 4.2, 4.3_
  
  - [ ] 12.3 Handle missed notifications on app load
    - Check for notifications that should have been sent while app was closed
    - Create catch-up notifications for missed reminders
    - _Requirements: 9.5_

- [ ] 13. Final testing and polish
  - [ ]* 13.1 Write property test for API filter correctness
    - **Property 23: API Filter Correctness**
    - Generate random notification sets and filter criteria
    - Assert all returned notifications match criteria
    - **Validates: Requirements 10.6**
  
  - [ ]* 13.2 Write unit tests for edge cases
    - Empty trigger_message default generation
    - Quiet hours crossing midnight
    - Timezone handling
    - Permission denied flow
    - _Requirements: 1.5, 3.2, 7.5, 9.4_
  
  - [ ] 13.3 Add error handling and loading states
    - Add loading indicators for async operations
    - Add error toasts for failures
    - Implement retry logic for transient failures

- [ ] 14. Final checkpoint
  - Ensure all tests pass
  - Verify end-to-end notification flow
  - Ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests use fast-check library with minimum 100 iterations
- Follow existing design system tokens (bg-card, border-border, text-foreground, etc.)
- Maintain consistency with existing Modal, Form, and Widget component patterns
