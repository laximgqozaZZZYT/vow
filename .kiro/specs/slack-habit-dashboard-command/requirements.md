# Requirements Document

## Introduction

This document defines the requirements for enhancing the Slack habit commands by integrating `/habit-list` and `/habit-status` into a unified dashboard command with workload-based progress tracking. The current implementation uses binary completion status (completed/not completed), but users need count-based progress tracking similar to the frontend Daily Progress section. This enhancement will display `currentCount/totalCount` with progress bars, workload units, and increment buttons for each habit.

## Glossary

- **Slack_Dashboard_Command**: A unified Slack slash command that displays habit progress with workload-based tracking
- **Workload_Progress**: The current progress of a habit measured in workload units (e.g., "3/5 回", "30/60 分")
- **Workload_Unit**: The unit of measurement for habit progress (e.g., "回", "分", "ページ")
- **Workload_Total**: The daily target count for a habit (e.g., 5 times, 60 minutes)
- **Workload_Per_Count**: The amount of workload added per single completion action (default: 1)
- **Progress_Rate**: The percentage of daily progress calculated as (currentCount / totalCount) * 100
- **Increment_Button**: An interactive button that adds one workload unit to the habit's daily progress
- **Daily_Progress_Calculator**: A service that calculates the current day's workload progress for each habit based on activities
- **Slack_Block_Builder**: The utility class for building Slack Block Kit messages with rich formatting

## Requirements

### Requirement 1: Unified Dashboard Command

**User Story:** As a user, I want a single command that shows both my habit list and progress status, so that I can see all relevant information at once without running multiple commands.

#### Acceptance Criteria

1. WHEN a user types `/habit-dashboard`, THE Slack_Dashboard_Command SHALL respond with a combined view of habit list and progress status
2. WHEN displaying the dashboard, THE Slack_Block_Builder SHALL show a header with today's date and overall completion summary
3. WHEN displaying the dashboard, THE Slack_Block_Builder SHALL group habits by their associated goals
4. THE Slack_Dashboard_Command SHALL respond within 3 seconds to meet Slack's timeout requirements
5. WHEN a user has no active habits, THE Slack_Dashboard_Command SHALL display a message encouraging them to add habits via the app

### Requirement 2: Workload-Based Progress Display

**User Story:** As a user, I want to see my habit progress as counts with units, so that I can track incremental progress throughout the day.

#### Acceptance Criteria

1. WHEN displaying each habit, THE Slack_Block_Builder SHALL show progress in the format `currentCount/totalCount unit (progressRate%)`
2. WHEN calculating currentCount, THE Daily_Progress_Calculator SHALL sum the amount field from today's activities (JST 0:00-23:59) for each habit
3. WHEN a habit has no workloadUnit defined, THE Slack_Block_Builder SHALL display progress as `currentCount/totalCount (progressRate%)`
4. WHEN calculating totalCount, THE Daily_Progress_Calculator SHALL use the habit's workloadTotal field, falling back to the must field if not set
5. WHEN progressRate reaches 100% or higher, THE Slack_Block_Builder SHALL display the habit with a completion indicator (✅)
6. WHEN progressRate is below 100%, THE Slack_Block_Builder SHALL display the habit with an incomplete indicator (⬜)

### Requirement 3: Visual Progress Bar

**User Story:** As a user, I want to see a visual progress bar for each habit, so that I can quickly understand my progress at a glance.

#### Acceptance Criteria

1. WHEN displaying each habit, THE Slack_Block_Builder SHALL include a text-based progress bar using block characters
2. WHEN progressRate is 100% or higher, THE Slack_Block_Builder SHALL display the progress bar in green (🟩)
3. WHEN progressRate is between 75% and 99%, THE Slack_Block_Builder SHALL display the progress bar in blue (🟦)
4. WHEN progressRate is between 50% and 74%, THE Slack_Block_Builder SHALL display the progress bar in yellow (🟨)
5. WHEN progressRate is below 50%, THE Slack_Block_Builder SHALL display the progress bar in red (🟥)
6. THE progress bar SHALL be 10 segments wide, with filled segments representing the progress percentage

### Requirement 4: Increment Button for Each Habit

**User Story:** As a user, I want to increment my habit progress with a single button click, so that I can quickly log progress without typing commands.

#### Acceptance Criteria

1. WHEN displaying an incomplete habit, THE Slack_Block_Builder SHALL include an increment button labeled "✓" or "+1"
2. WHEN a user clicks the increment button, THE Habit_Completion_Reporter SHALL create an activity record with amount equal to the habit's workloadPerCount (default: 1)
3. WHEN an activity is created via increment button, THE Habit_Completion_Reporter SHALL set the source field to "slack"
4. WHEN an increment is successful, THE Slack_Bot SHALL update the message to reflect the new progress
5. WHEN progressRate reaches 100% after an increment, THE Slack_Bot SHALL display a completion celebration message with streak count
6. WHEN a habit is already at 100% or higher, THE Slack_Block_Builder SHALL still display the increment button for additional progress tracking

### Requirement 5: Workload Per Count Display

**User Story:** As a user, I want to see how much workload each button click adds, so that I understand the increment amount before clicking.

#### Acceptance Criteria

1. WHEN a habit has workloadPerCount greater than 1, THE Slack_Block_Builder SHALL display the increment amount next to the button (e.g., "+5 分")
2. WHEN a habit has workloadPerCount of 1 and workloadUnit is set, THE Slack_Block_Builder SHALL display the unit (e.g., "+1 回")
3. WHEN a habit has no workloadUnit, THE Slack_Block_Builder SHALL display the button as "✓" without unit text
4. THE increment button label SHALL clearly indicate the amount being added per click

### Requirement 6: Daily Progress Calculation Service

**User Story:** As a developer, I want a service that calculates daily workload progress, so that the Slack dashboard displays accurate progress data.

#### Acceptance Criteria

1. THE Daily_Progress_Calculator SHALL calculate progress based on activities within JST 0:00-23:59 of the current day
2. WHEN calculating progress, THE Daily_Progress_Calculator SHALL sum the amount field from activities with kind="complete"
3. WHEN an activity has no amount field, THE Daily_Progress_Calculator SHALL use the habit's workloadPerCount as the default amount
4. THE Daily_Progress_Calculator SHALL return progress data including: habitId, habitName, currentCount, totalCount, progressRate, workloadUnit, workloadPerCount, and completed status
5. THE Daily_Progress_Calculator SHALL exclude inactive habits from the progress calculation
6. THE Daily_Progress_Calculator SHALL exclude habits with type="avoid" from the progress display

### Requirement 7: Backward Compatibility

**User Story:** As a user, I want the existing commands to continue working, so that my workflow is not disrupted.

#### Acceptance Criteria

1. THE existing `/habit-done [name]` command SHALL continue to function as before
2. THE existing `/habit-status` command SHALL redirect to the new dashboard view or display a deprecation notice
3. THE existing `/habit-list` command SHALL redirect to the new dashboard view or display a deprecation notice
4. WHEN `/habit-status` or `/habit-list` is used, THE Slack_Bot SHALL suggest using `/habit-dashboard` for the enhanced view
5. THE existing interactive buttons from reminders and follow-ups SHALL continue to work with the new progress system

### Requirement 8: Message Update on Interaction

**User Story:** As a user, I want the dashboard message to update when I click buttons, so that I see my progress change in real-time.

#### Acceptance Criteria

1. WHEN a user clicks an increment button, THE Slack_Bot SHALL update the original message with the new progress
2. WHEN updating the message, THE Slack_Bot SHALL use the response_url to replace the original message content
3. WHEN multiple users view the same dashboard, THE Slack_Bot SHALL only update the message for the user who clicked
4. IF message update fails, THEN THE Slack_Bot SHALL send a new message with the updated progress
5. THE message update SHALL complete within 3 seconds to provide responsive feedback

### Requirement 9: Error Handling

**User Story:** As a user, I want clear error messages when something goes wrong, so that I understand what happened and how to fix it.

#### Acceptance Criteria

1. IF the user's Slack account is not connected, THEN THE Slack_Dashboard_Command SHALL display a message with instructions to connect via the app settings
2. IF the database query fails, THEN THE Slack_Dashboard_Command SHALL display a friendly error message and suggest retrying
3. IF an increment action fails, THEN THE Slack_Bot SHALL display an error message without modifying the original dashboard
4. WHEN an error occurs, THE Slack_Dashboard_Command SHALL log the error details for debugging
5. IF a habit referenced in an interaction no longer exists, THEN THE Slack_Bot SHALL display a message indicating the habit was not found

### Requirement 10: Streak Display Integration

**User Story:** As a user, I want to see my streak count alongside progress, so that I stay motivated by my consistency.

#### Acceptance Criteria

1. WHEN displaying each habit, THE Slack_Block_Builder SHALL include the current streak count if greater than 0
2. WHEN streak is 7 days or more, THE Slack_Block_Builder SHALL display a fire emoji (🔥) with the streak count
3. WHEN streak is between 3 and 6 days, THE Slack_Block_Builder SHALL display a sparkle emoji (✨) with the streak count
4. WHEN streak is 1-2 days, THE Slack_Block_Builder SHALL display the streak count without special emoji
5. THE streak calculation SHALL use the existing get_habit_streak method from Habit_Completion_Reporter
