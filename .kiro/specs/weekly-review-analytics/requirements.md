# Requirements Document

## Introduction

This document defines the requirements for implementing weekly review and analytics functionality in the habit management dashboard. The feature provides users with periodic summaries of their productivity, habit completion rates, goal progress, and actionable insights. It enables users to reflect on their week, identify patterns, and plan for the upcoming week through a guided review workflow.

The feature builds upon existing data from habits, stickies (tasks), goals, key results, and milestones to compute aggregated statistics and visualize trends over time.

## Glossary

- **Weekly_Review**: A structured process for reviewing the past week's productivity and planning the next week
- **Review_Dashboard**: The main UI component displaying weekly summary statistics and analytics
- **Completion_Rate**: The percentage of items completed out of total items (completed / total * 100)
- **Habit_Streak**: The number of consecutive days a habit has been completed
- **Commit_Count**: The number of completed Stickies linked to a Habit (from habit-sticky-commit-integration)
- **KPI**: Key Performance Indicator - a metric used to measure productivity and progress
- **Trend_Data**: Historical data points used to visualize changes over time (week-over-week)
- **Date_Range**: A selectable time period for analytics (this week, last week, custom range)
- **Carry_Over**: The action of moving incomplete tasks from the current week to the next week
- **Reflection_Prompt**: A guided question to help users reflect on their week
- **Progress_Calculator**: A component that computes completion percentages and progress metrics

## Requirements

### Requirement 1: Weekly Summary Statistics

**User Story:** As a user, I want to see a summary of my weekly productivity, so that I can understand my overall performance at a glance.

#### Acceptance Criteria

1. WHEN a user opens the Weekly Review Dashboard, THE Review_Dashboard SHALL display the total number of completed tasks versus planned tasks for the selected week
2. WHEN displaying task statistics, THE Review_Dashboard SHALL calculate and show the task Completion_Rate as a percentage
3. WHEN a user has habits, THE Review_Dashboard SHALL display the average habit completion rate across all active habits for the week
4. WHEN a user has goals with key results, THE Review_Dashboard SHALL display the number of key results updated during the week
5. WHEN a user has Commits (habit-linked stickies), THE Review_Dashboard SHALL display the total Commit_Count for the week
6. IF no data exists for the selected week, THEN THE Review_Dashboard SHALL display appropriate empty states with guidance

### Requirement 2: Habit Analytics

**User Story:** As a user, I want to see detailed habit analytics, so that I can understand my habit consistency and identify areas for improvement.

#### Acceptance Criteria

1. WHEN displaying habit analytics, THE Review_Dashboard SHALL show each active habit's completion rate for the selected week
2. WHEN a habit has a streak, THE Review_Dashboard SHALL display the current Habit_Streak count
3. WHEN displaying habit data, THE Review_Dashboard SHALL show the week-over-week change in completion rate (trend indicator)
4. WHEN a habit's completion rate has improved compared to the previous week, THE Review_Dashboard SHALL display a positive trend indicator
5. WHEN a habit's completion rate has declined compared to the previous week, THE Review_Dashboard SHALL display a negative trend indicator
6. THE Review_Dashboard SHALL sort habits by completion rate (lowest first) to highlight habits needing attention

### Requirement 3: Goal Progress Analytics

**User Story:** As a user, I want to see my goal progress for the week, so that I can track advancement toward my objectives.

#### Acceptance Criteria

1. WHEN displaying goal analytics, THE Review_Dashboard SHALL show each goal's progress percentage
2. WHEN a goal has key results, THE Review_Dashboard SHALL display the number of key results completed or updated during the week
3. WHEN a goal has milestones, THE Review_Dashboard SHALL display the number of milestones completed during the week
4. WHEN displaying goal data, THE Review_Dashboard SHALL show the progress change from the start of the week to the end
5. IF a goal reached 100% progress during the week, THEN THE Review_Dashboard SHALL highlight it as a completed goal

### Requirement 4: Task Completion Analytics

**User Story:** As a user, I want to see detailed task completion statistics, so that I can understand my task management effectiveness.

#### Acceptance Criteria

1. WHEN displaying task analytics, THE Review_Dashboard SHALL show tasks grouped by priority level (from task-priority-status)
2. WHEN displaying task analytics, THE Review_Dashboard SHALL show tasks grouped by status (not_started, in_progress, completed, on_hold)
3. WHEN a task has a due date, THE Review_Dashboard SHALL identify overdue tasks that were not completed
4. THE Review_Dashboard SHALL calculate and display the on-time completion rate (tasks completed before or on due date)
5. WHEN displaying task data, THE Review_Dashboard SHALL show the average time from task creation to completion

### Requirement 5: Trend Visualization

**User Story:** As a user, I want to see visual trends of my productivity over time, so that I can identify patterns and improvements.

#### Acceptance Criteria

1. WHEN displaying trends, THE Review_Dashboard SHALL render a line chart showing task completion rate over the past 4 weeks
2. WHEN displaying trends, THE Review_Dashboard SHALL render a chart showing habit completion rate over the past 4 weeks
3. WHEN displaying trends, THE Review_Dashboard SHALL render a chart showing goal progress over the past 4 weeks
4. THE Trend_Data SHALL be computed from historical records without requiring new database tables
5. WHEN hovering over a data point in the chart, THE Review_Dashboard SHALL display the exact value and date

### Requirement 6: Date Range Selection

**User Story:** As a user, I want to select different date ranges for my review, so that I can analyze specific time periods.

#### Acceptance Criteria

1. WHEN opening the Weekly Review Dashboard, THE Review_Dashboard SHALL default to the current week (Monday to Sunday)
2. THE Review_Dashboard SHALL provide quick selection options for "This Week", "Last Week", and "Custom Range"
3. WHEN a user selects "Custom Range", THE Review_Dashboard SHALL display a date picker for start and end dates
4. WHEN a user changes the date range, THE Review_Dashboard SHALL recalculate all statistics for the new range
5. THE Review_Dashboard SHALL persist the selected date range during the session

### Requirement 7: Guided Review Workflow

**User Story:** As a user, I want a guided review process, so that I can systematically reflect on my week and plan ahead.

#### Acceptance Criteria

1. WHEN a user starts the guided review, THE Review_Dashboard SHALL present a step-by-step review workflow
2. THE guided review SHALL include a step for reviewing completed tasks and celebrating wins
3. THE guided review SHALL include a step with Reflection_Prompts for self-assessment
4. THE guided review SHALL include a step for reviewing incomplete tasks and deciding on carry-over
5. THE guided review SHALL include a step for setting priorities for the next week
6. WHEN the user completes the guided review, THE Review_Dashboard SHALL save the review completion timestamp

### Requirement 8: Carry-Over Incomplete Tasks

**User Story:** As a user, I want to carry over incomplete tasks to the next week, so that I don't lose track of unfinished work.

#### Acceptance Criteria

1. WHEN displaying incomplete tasks, THE Review_Dashboard SHALL show a list of tasks not completed during the week
2. THE Review_Dashboard SHALL allow users to select multiple tasks for carry-over
3. WHEN a user carries over a task, THE System SHALL update the task's due date to the next week (if it had a due date)
4. WHEN a user decides not to carry over a task, THE System SHALL allow marking it as "on_hold" or deleting it
5. THE Review_Dashboard SHALL show the number of tasks carried over from the previous week

### Requirement 9: KPI Dashboard Widgets

**User Story:** As a user, I want customizable KPI widgets, so that I can focus on the metrics that matter most to me.

#### Acceptance Criteria

1. THE Review_Dashboard SHALL display KPI widgets showing key metrics at a glance
2. THE KPI widgets SHALL include: Task Completion Rate, Habit Streak Average, Goal Progress, and Commit Count
3. WHEN displaying a KPI widget, THE Review_Dashboard SHALL show the current value and the change from the previous period
4. THE Review_Dashboard SHALL allow users to customize which KPI widgets are displayed
5. THE Review_Dashboard SHALL persist KPI widget preferences in local storage

### Requirement 10: Review Access and Navigation

**User Story:** As a user, I want easy access to the weekly review, so that I can quickly check my progress.

#### Acceptance Criteria

1. THE Dashboard SHALL provide a navigation entry point to access the Weekly Review Dashboard
2. THE Review_Dashboard SHALL be accessible as a modal or dedicated section within the dashboard
3. WHEN the current week ends (Sunday), THE System SHALL optionally prompt the user to complete their weekly review
4. THE Review_Dashboard SHALL support mobile-responsive layout for review on any device
5. THE Review_Dashboard SHALL load within 2 seconds for typical data volumes

