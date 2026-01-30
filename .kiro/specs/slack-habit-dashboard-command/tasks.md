# Implementation Plan: Slack Habit Dashboard Command

## Overview

This implementation plan covers the enhancement of Slack habit commands by creating a unified `/habit-dashboard` command with workload-based progress tracking. The implementation extends existing services and adds new components for daily progress calculation and dashboard message building.

## Tasks

- [ ] 1. Create Daily Progress Calculator Service
  - [x] 1.1 Create `daily_progress_calculator.py` with `HabitProgress` and `DashboardSummary` dataclasses
    - Define dataclasses with all required fields (habit_id, habit_name, goal_name, current_count, total_count, progress_rate, workload_unit, workload_per_count, streak, completed)
    - _Requirements: 6.4_
  
  - [x] 1.2 Implement `DailyProgressCalculator` class with JST timezone handling
    - Initialize with Supabase client and JST timezone
    - Implement `_get_jst_day_boundaries()` method for JST 0:00-23:59 calculation
    - _Requirements: 6.1_
  
  - [x] 1.3 Implement `_get_today_activities()` method
    - Query activities table with JST day boundaries
    - Filter by owner_type, owner_id, and kind="complete"
    - _Requirements: 6.1, 6.2_
  
  - [x] 1.4 Implement `_calculate_workload()` method
    - Sum amount fields from activities for a specific habit
    - Handle missing amount field by using workloadPerCount default
    - _Requirements: 2.2, 6.2, 6.3_
  
  - [x] 1.5 Implement `get_daily_progress()` method
    - Query active habits with type="do"
    - Calculate progress for each habit
    - Get streak counts using existing `get_habit_streak()` method
    - Sort results by goal_name
    - _Requirements: 6.4, 6.5, 6.6_
  
  - [ ]* 1.6 Write property tests for Daily Progress Calculator
    - **Property 4: Current Count Calculation from JST Activities**
    - **Property 5: Total Count Fallback Logic**
    - **Property 13: Default Amount Handling**
    - **Property 14: Active 'Do' Habit Filtering**
    - **Validates: Requirements 2.2, 2.4, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6**

- [ ] 2. Enhance Slack Block Builder with Dashboard Methods
  - [x] 2.1 Implement `_progress_bar()` static method
    - Generate 10-segment progress bar
    - Apply color coding: 🟩 (>=100%), 🟦 (75-99%), 🟨 (50-74%), 🟥 (<50%)
    - Use ⬜ for empty segments
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_
  
  - [x] 2.2 Implement `_streak_display()` static method
    - Return 🔥 emoji for streak >= 7
    - Return ✨ emoji for streak 3-6
    - Return plain number for streak 1-2
    - Return empty string for streak 0
    - _Requirements: 10.1, 10.2, 10.3, 10.4_
  
  - [x] 2.3 Implement `_increment_button()` static method
    - Format label as "+{amount} {unit}" when unit exists
    - Format label as "+{amount}" when amount > 1 and no unit
    - Format label as "✓" when amount = 1 and no unit
    - Set action_id as "habit_increment_{habit_id}"
    - _Requirements: 5.1, 5.2, 5.3_
  
  - [x] 2.4 Implement `_habit_progress_section()` static method
    - Build section with completion indicator (✅/⬜)
    - Include progress text: currentCount/totalCount unit (progressRate%)
    - Include streak display
    - Include progress bar
    - Add increment button as accessory
    - _Requirements: 2.1, 2.3, 2.5, 2.6, 4.1, 4.6_
  
  - [x] 2.5 Implement `habit_dashboard()` static method
    - Build header with date and overall summary
    - Group habits by goal_name with dividers
    - Include all habit progress sections
    - _Requirements: 1.1, 1.2, 1.3_
  
  - [x] 2.6 Implement `dashboard_empty()` static method for empty habit list
    - Display encouraging message to add habits
    - _Requirements: 1.5_
  
  - [x] 2.7 Implement `dashboard_error()` static method for error responses
    - Display error message with ❌ prefix
    - _Requirements: 9.1, 9.2, 9.3, 9.5_
  
  - [x] 2.8 Implement `habit_increment_success()` static method
    - Display celebration message when reaching 100%
    - Include streak count in celebration
    - _Requirements: 4.5_
  
  - [ ]* 2.9 Write property tests for Slack Block Builder
    - **Property 3: Progress Format with Unit Handling**
    - **Property 6: Completion Indicator Based on Progress**
    - **Property 7: Progress Bar Color Coding**
    - **Property 8: Progress Bar Segment Count**
    - **Property 12: Increment Button Label Formatting**
    - **Property 15: Streak Display with Emoji**
    - **Validates: Requirements 2.1, 2.3, 2.5, 2.6, 3.1-3.6, 5.1-5.3, 10.1-10.4**

- [x] 3. Checkpoint - Verify core services
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Extend Habit Completion Reporter
  - [x] 4.1 Add `increment_habit_progress()` method to `HabitCompletionReporter`
    - Get habit by ID and retrieve workloadPerCount
    - Create activity record with amount and source="slack"
    - Calculate new progress after increment
    - Return success status, message, and result data including streak
    - _Requirements: 4.2, 4.3_
  
  - [ ]* 4.2 Write property test for increment functionality
    - **Property 10: Activity Creation on Increment**
    - **Validates: Requirements 4.2, 4.3**

- [ ] 5. Create Dashboard Command Handler
  - [x] 5.1 Create `dashboard_command_handler.py` with `DashboardCommandHandler` class
    - Initialize with Supabase client and SlackIntegrationService
    - Create instances of DailyProgressCalculator and HabitCompletionReporter
    - _Requirements: 1.1_
  
  - [x] 5.2 Implement `_get_owner_id_from_slack()` helper method
    - Query slack_connections table by slack_user_id
    - Return owner_id or None if not connected
    - _Requirements: 9.1_
  
  - [x] 5.3 Implement `handle_command()` method
    - Look up owner_id from slack_user_id
    - Return error if not connected
    - Get daily progress from calculator
    - Build dashboard message using SlackBlockBuilder
    - Send response via response_url
    - _Requirements: 1.1, 1.2, 1.3, 9.1_
  
  - [x] 5.4 Implement `handle_increment()` method
    - Parse habit_id from action_id
    - Call increment_habit_progress on HabitCompletionReporter
    - Build updated dashboard or celebration message
    - Update original message via response_url
    - Handle errors gracefully
    - _Requirements: 4.2, 4.3, 4.5, 8.1, 9.3, 9.5_
  
  - [ ]* 5.5 Write property tests for Dashboard Command Handler
    - **Property 1: Dashboard Response Structure**
    - **Property 2: Habit Grouping by Goal**
    - **Property 9: Increment Button Presence**
    - **Property 11: Completion Celebration on Reaching 100%**
    - **Validates: Requirements 1.1, 1.2, 1.3, 4.1, 4.5, 4.6**

- [ ] 6. Integrate with Slack Webhook Handler
  - [x] 6.1 Register `/habit-dashboard` slash command in Slack app configuration
    - Add command to Slack app manifest
    - Configure request URL to point to webhook handler
    - _Requirements: 1.1_
  
  - [x] 6.2 Add route for `/habit-dashboard` command in webhook handler
    - Parse command payload (user_id, response_url)
    - Call DashboardCommandHandler.handle_command()
    - Return immediate acknowledgment
    - _Requirements: 1.1, 1.4_
  
  - [x] 6.3 Add handler for `habit_increment_*` interactive actions
    - Parse action_id to extract habit_id
    - Call DashboardCommandHandler.handle_increment()
    - _Requirements: 4.2, 8.1_
  
  - [x] 6.4 Update existing `/habit-status` command to show deprecation notice
    - Add message suggesting `/habit-dashboard`
    - Continue to show basic status for backward compatibility
    - _Requirements: 7.2, 7.4_
  
  - [x] 6.5 Update existing `/habit-list` command to show deprecation notice
    - Add message suggesting `/habit-dashboard`
    - Continue to show basic list for backward compatibility
    - _Requirements: 7.3, 7.4_

- [x] 7. Checkpoint - Integration verification
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Add Unit Tests for Edge Cases
  - [ ]* 8.1 Write unit tests for empty habit list scenario
    - Test dashboard_empty() message content
    - _Requirements: 1.5_
  
  - [ ]* 8.2 Write unit tests for user not connected error
    - Test error message and instructions
    - _Requirements: 9.1_
  
  - [ ]* 8.3 Write unit tests for database query failure
    - Test error handling and retry suggestion
    - _Requirements: 9.2_
  
  - [ ]* 8.4 Write unit tests for deleted habit on increment
    - Test habit not found error message
    - _Requirements: 9.5_
  
  - [ ]* 8.5 Write unit tests for backward compatibility
    - Verify `/habit-done` command unchanged
    - Verify deprecation notices for `/habit-status` and `/habit-list`
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 9. Final checkpoint - Complete verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The implementation uses Python with FastAPI and Hypothesis for property-based testing
