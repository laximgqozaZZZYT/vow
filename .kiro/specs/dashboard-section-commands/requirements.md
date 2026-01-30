# Requirements Document

## Introduction

This feature enables dashboard sections from the frontend to be displayed via Slack commands (`/progress`, `/next`, `/stats`, `/stickies`). The core logic resides in a platform-independent service layer (`DashboardDataService`) that can be reused by future integrations (LINE, Discord, etc.). All date calculations use JST timezone to match frontend behavior.

## Glossary

- **DashboardDataService**: A platform-independent service that fetches and calculates dashboard data for habits, statistics, upcoming habits, and stickies.
- **Slack_Command_Handler**: The router component that handles Slack slash commands and formats responses using Block Kit.
- **Daily_Progress**: The habit completion progress for the current JST day (0:00-23:59).
- **Statistics**: Achievement rates, TOP3 habits, and cumulative stats for habits.
- **Next_Habits**: Habits scheduled to start within the next 24 hours.
- **Stickies**: Quick task notes that can be marked as complete.
- **JST**: Japan Standard Time (UTC+9), used for all date calculations.
- **Block_Kit**: Slack's UI framework for building rich message layouts.

## Requirements

### Requirement 1: Platform-Independent Dashboard Data Service

**User Story:** As a developer, I want a platform-independent service layer for dashboard data, so that I can integrate with multiple platforms (Slack, LINE, Discord) without duplicating business logic.

#### Acceptance Criteria

1. THE DashboardDataService SHALL be created in `backend/src/services/dashboardDataService.ts`
2. THE DashboardDataService SHALL use dependency injection for repositories (HabitRepository, ActivityRepository, GoalRepository)
3. THE DashboardDataService SHALL return data in platform-agnostic JSON format
4. THE DashboardDataService SHALL use JST timezone for all date calculations
5. THE DashboardDataService SHALL reuse existing repository patterns from the codebase

### Requirement 2: Daily Progress Data

**User Story:** As a user, I want to check my daily habit progress via Slack, so that I can stay on track without opening the web app.

#### Acceptance Criteria

1. WHEN the `/progress` command is invoked, THE DashboardDataService SHALL return daily progress for all active habits with type="do"
2. THE Daily_Progress data SHALL include habit name, current count, total count, progress percentage, and completion status
3. THE Daily_Progress data SHALL include workload unit and workload per count for each habit
4. THE Daily_Progress data SHALL include the current streak count for each habit
5. THE Daily_Progress data SHALL exclude inactive habits and habits with type="avoid"
6. THE Daily_Progress data SHALL be sorted by goal name
7. WHEN calculating daily progress, THE DashboardDataService SHALL only include activities within JST 0:00:00 to JST 23:59:59 of the current day

### Requirement 3: Statistics Data

**User Story:** As a user, I want to see my statistics summary via Slack, so that I can understand my overall performance.

#### Acceptance Criteria

1. WHEN the `/stats` command is invoked, THE DashboardDataService SHALL return statistics summary
2. THE Statistics data SHALL include total active habits count
3. THE Statistics data SHALL include today's achievement rate (percentage of habits completed today)
4. THE Statistics data SHALL include cumulative achievement rate for the selected time range
5. THE Statistics data SHALL include TOP3 habits by progress rate
6. THE Statistics data SHALL be calculated using JST timezone boundaries

### Requirement 4: Next Habits Data

**User Story:** As a user, I want to see upcoming habits via Slack, so that I can plan my day.

#### Acceptance Criteria

1. WHEN the `/next` command is invoked, THE DashboardDataService SHALL return habits starting in the next 24 hours
2. THE Next_Habits data SHALL include habit name and scheduled start time
3. THE Next_Habits data SHALL include workload unit and target amount
4. THE Next_Habits data SHALL exclude completed habits and habits with type="avoid"
5. THE Next_Habits data SHALL exclude cumulatively completed habits (workloadTotalEnd reached)
6. THE Next_Habits data SHALL be sorted by start time ascending
7. THE Next_Habits data SHALL be limited to 10 items maximum

### Requirement 5: Stickies Data

**User Story:** As a user, I want to see my stickies via Slack, so that I can remember quick tasks.

#### Acceptance Criteria

1. WHEN the `/stickies` command is invoked, THE DashboardDataService SHALL return sticky notes
2. THE Stickies data SHALL include sticky name and completion status
3. THE Stickies data SHALL include description if available
4. THE Stickies data SHALL be sorted by display order
5. WHEN displaying stickies, THE Slack_Command_Handler SHALL show incomplete stickies first, then completed stickies

### Requirement 6: Slack Command Integration

**User Story:** As a user, I want to use Slack slash commands to view dashboard data, so that I can access my habit information without leaving Slack.

#### Acceptance Criteria

1. THE Slack_Command_Handler SHALL support `/progress` or `/habit-progress` command for daily progress
2. THE Slack_Command_Handler SHALL support `/stats` or `/habit-stats` command for statistics
3. THE Slack_Command_Handler SHALL support `/next` or `/habit-next` command for upcoming habits
4. THE Slack_Command_Handler SHALL support `/stickies` command for sticky notes
5. THE Slack_Command_Handler SHALL format responses using Slack Block Kit for rich display
6. THE Slack_Command_Handler SHALL verify Slack request signatures before processing
7. THE Slack_Command_Handler SHALL return user-friendly Japanese messages
8. WHEN a user is not connected to Slack, THE Slack_Command_Handler SHALL return a connection prompt message

### Requirement 7: Data Schema Validation

**User Story:** As a developer, I want validated data schemas, so that I can ensure type safety and data integrity.

#### Acceptance Criteria

1. THE Dashboard_Schemas SHALL be created in `backend/src/schemas/dashboard.ts`
2. THE Dashboard_Schemas SHALL use Zod for schema validation
3. THE Dashboard_Schemas SHALL define DailyProgressData schema with all required fields
4. THE Dashboard_Schemas SHALL define StatisticsData schema with all required fields
5. THE Dashboard_Schemas SHALL define NextHabitsData schema with all required fields
6. THE Dashboard_Schemas SHALL define StickiesData schema with all required fields

### Requirement 8: Error Handling

**User Story:** As a user, I want clear error messages when something goes wrong, so that I can understand and resolve issues.

#### Acceptance Criteria

1. IF the DashboardDataService fails to fetch data, THEN THE Slack_Command_Handler SHALL return a user-friendly error message in Japanese
2. IF the user is not authenticated, THEN THE Slack_Command_Handler SHALL return a connection prompt
3. THE DashboardDataService SHALL log errors with structured logging for debugging
4. THE Slack_Command_Handler SHALL handle timeouts gracefully (Slack 3-second limit)
