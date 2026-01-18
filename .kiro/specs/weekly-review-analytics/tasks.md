# Implementation Plan: Weekly Review Analytics

## Overview

This implementation plan covers the Weekly Review Analytics feature, which provides users with comprehensive weekly summaries of their productivity including task completion rates, habit analytics, goal progress, and trend visualizations.

The implementation follows a bottom-up approach: utilities → services → components → integration.

## Tasks

- [ ] 1. Set up analytics utilities and types
  - [ ] 1.1 Create type definitions for analytics data structures
    - Add DateRange, WeeklySummary, HabitAnalytics, GoalAnalytics, TaskAnalytics, TrendData types
    - Add KPIWidget, GuidedReviewStep, ReviewSession types
    - _Requirements: 1.1, 1.2, 2.1, 3.1, 4.1, 9.1_
  
  - [ ] 1.2 Create date range utility functions
    - Implement getDefaultDateRange (current Monday-Sunday)
    - Implement getLastWeekRange, getCustomRange
    - Implement getDaysInRange, getWeekNumber utilities
    - _Requirements: 6.1, 6.2_
  
  - [ ]* 1.3 Write property tests for date range utilities
    - **Property 15: Default Date Range Calculation**
    - **Validates: Requirements 6.1**

- [ ] 2. Implement progress calculation utilities
  - [ ] 2.1 Create task completion rate calculator
    - Implement calculateTaskCompletionRate function
    - Handle edge cases (empty arrays, all completed, none completed)
    - _Requirements: 1.1, 1.2_
  
  - [ ]* 2.2 Write property tests for task completion rate
    - **Property 1: Task Completion Rate Calculation**
    - **Validates: Requirements 1.1, 1.2**
  
  - [ ] 2.3 Create habit completion rate calculator
    - Implement calculateHabitCompletionRate function
    - Handle repeat schedule parsing for expected completions
    - _Requirements: 1.3, 2.1_
  
  - [ ]* 2.4 Write property tests for habit completion rate
    - **Property 2: Habit Completion Rate Calculation**
    - **Validates: Requirements 1.3, 2.1**
  
  - [ ] 2.5 Create habit streak calculator
    - Implement calculateHabitStreak function
    - Count consecutive completion days from today backward
    - _Requirements: 2.2_
  
  - [ ]* 2.6 Write property tests for habit streak calculation
    - **Property 4: Habit Streak Calculation**
    - **Validates: Requirements 2.2**

- [ ] 3. Checkpoint - Ensure all utility tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implement analytics service
  - [ ] 4.1 Create analyticsService.ts with core functions
    - Implement getWeeklySummary function
    - Implement getHabitAnalytics function
    - Implement getGoalAnalytics function
    - Implement getTaskAnalytics function
    - _Requirements: 1.1-1.6, 2.1-2.6, 3.1-3.5, 4.1-4.5_
  
  - [ ] 4.2 Implement trend data aggregation
    - Implement getTrendData function for 4-week history
    - Calculate weekly metrics for each week
    - _Requirements: 5.1, 5.2, 5.3_
  
  - [ ]* 4.3 Write property tests for trend data aggregation
    - **Property 14: Trend Data Aggregation**
    - **Validates: Requirements 5.1, 5.2, 5.3**
  
  - [ ] 4.4 Implement task grouping functions
    - Implement groupTasksByPriority function
    - Implement groupTasksByStatus function
    - _Requirements: 4.1, 4.2_
  
  - [ ]* 4.5 Write property tests for task grouping
    - **Property 10: Task Grouping Correctness**
    - **Validates: Requirements 4.1, 4.2**
  
  - [ ] 4.6 Implement overdue and on-time calculations
    - Implement identifyOverdueTasks function
    - Implement calculateOnTimeCompletionRate function
    - Implement calculateAverageCompletionTime function
    - _Requirements: 4.3, 4.4, 4.5_
  
  - [ ]* 4.7 Write property tests for overdue and on-time calculations
    - **Property 11: Overdue Task Identification**
    - **Property 12: On-Time Completion Rate Calculation**
    - **Property 13: Average Completion Time Calculation**
    - **Validates: Requirements 4.3, 4.4, 4.5**

- [ ] 5. Implement carry-over functionality
  - [ ] 5.1 Create carry-over service functions
    - Implement getIncompleteTasks function
    - Implement carryOverTasks function (update due dates)
    - _Requirements: 8.1, 8.3_
  
  - [ ]* 5.2 Write property tests for carry-over
    - **Property 18: Incomplete Task Filtering**
    - **Property 19: Task Carry-Over Date Update**
    - **Validates: Requirements 8.1, 8.3**

- [ ] 6. Checkpoint - Ensure all service tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Implement KPI widgets
  - [ ] 7.1 Create Widget.KPICard.tsx component
    - Display value, label, unit, and trend indicator
    - Support percent and number formats
    - Apply design system colors for trends (success/destructive)
    - _Requirements: 9.1, 9.2, 9.3_
  
  - [ ]* 7.2 Write property tests for KPI delta calculation
    - **Property 20: KPI Delta Calculation**
    - **Validates: Requirements 9.3**
  
  - [ ] 7.3 Create KPI preferences persistence
    - Implement useKPIPreferences hook with local storage
    - _Requirements: 9.4, 9.5_
  
  - [ ]* 7.4 Write property tests for KPI preferences
    - **Property 21: KPI Preferences Round-Trip**
    - **Validates: Requirements 9.5**

- [ ] 8. Implement trend chart component
  - [ ] 8.1 Create Widget.TrendChart.tsx component
    - SVG-based line chart for 4 weeks of data
    - Support multiple metrics (task, habit, goal)
    - Implement hover tooltip with exact values
    - Mobile-responsive sizing
    - _Requirements: 5.1, 5.2, 5.3, 5.5_

- [ ] 9. Implement analytics section components
  - [ ] 9.1 Create Section.HabitAnalytics.tsx
    - Display habit list sorted by completion rate (lowest first)
    - Show streak count and trend indicators
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
  
  - [ ]* 9.2 Write property tests for habit sorting
    - **Property 6: Habit Sorting by Completion Rate**
    - **Validates: Requirements 2.6**
  
  - [ ] 9.3 Create Section.GoalAnalytics.tsx
    - Display goal progress with key results and milestones
    - Highlight completed goals
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  
  - [ ]* 9.4 Write property tests for goal analytics
    - **Property 7: Goal Progress Calculation**
    - **Property 8: Goal Component Counts**
    - **Property 9: Goal Completion Highlighting**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
  
  - [ ] 9.5 Create Section.TaskAnalytics.tsx
    - Display task breakdown by priority and status
    - Show overdue count and on-time rate
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 10. Implement guided review workflow
  - [ ] 10.1 Create Section.GuidedReview.tsx
    - Step-by-step review workflow UI
    - Steps: wins, reflection, carry-over, priorities
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  
  - [ ] 10.2 Implement review completion tracking
    - Save review completion timestamp
    - Track completed steps
    - _Requirements: 7.6_
  
  - [ ]* 10.3 Write property tests for review completion
    - **Property 17: Review Completion Timestamp**
    - **Validates: Requirements 7.6**
  
  - [ ] 10.4 Create carry-over panel within guided review
    - Display incomplete tasks with selection
    - Actions: carry over, mark on_hold, delete
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 11. Checkpoint - Ensure all component tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Implement main Weekly Review modal
  - [ ] 12.1 Create Modal.WeeklyReview.tsx
    - Tab navigation: Summary, Habits, Goals, Tasks, Trends, Review
    - Date range picker with quick selections
    - KPI widgets row at top
    - _Requirements: 1.1-1.6, 6.1, 6.2, 6.3, 6.4, 10.2_
  
  - [ ] 12.2 Implement date range state management
    - Session persistence for selected range
    - Recalculate on range change
    - _Requirements: 6.4, 6.5_
  
  - [ ]* 12.3 Write property tests for date range persistence
    - **Property 16: Date Range Session Persistence**
    - **Validates: Requirements 6.5**
  
  - [ ] 12.4 Implement loading and error states
    - Skeleton loaders for each section
    - Error boundaries with retry
    - Empty states with guidance
    - _Requirements: 1.6_

- [ ] 13. Integrate with dashboard
  - [ ] 13.1 Add navigation entry point
    - Add Weekly Review button to sidebar or header
    - _Requirements: 10.1_
  
  - [ ] 13.2 Implement weekly review prompt
    - Show prompt on Sunday evenings if review not completed
    - _Requirements: 10.3_
  
  - [ ]* 13.3 Write property tests for prompt trigger
    - **Property 22: Weekly Review Prompt Trigger**
    - **Validates: Requirements 10.3**
  
  - [ ] 13.4 Ensure mobile-responsive layout
    - Test on various screen sizes
    - Adjust chart sizes for mobile
    - _Requirements: 10.4_

- [ ] 14. Final checkpoint - Full integration testing
  - Ensure all tests pass, ask the user if questions arise.
  - Verify all requirements are covered
  - Test complete user flows

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- No new database tables required - all data computed from existing tables
- Use existing design system tokens (bg-card, text-foreground, etc.)
- SVG-based charts consistent with existing MultiEventChart patterns
