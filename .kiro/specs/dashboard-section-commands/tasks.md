# Implementation Plan: Dashboard Section Commands

## Overview

This implementation plan creates a platform-independent `DashboardDataService` and integrates it with Slack commands. The approach follows existing codebase patterns and builds incrementally from schemas to repositories to services to command handlers.

## Tasks

- [x] 1. Create dashboard data schemas
  - [x] 1.1 Create `backend/src/schemas/dashboard.ts` with Zod schemas
    - Define `dailyProgressItemSchema` with all required fields
    - Define `dailyProgressDataSchema` for the full response
    - Define `statisticsDataSchema` with TOP3 habits
    - Define `nextHabitItemSchema` and `nextHabitsDataSchema`
    - Define `stickyItemSchema` and `stickiesDataSchema`
    - Export TypeScript types from schemas
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [ ]* 1.2 Write property test for schema round-trip
    - **Property 11: Schema Round-Trip**
    - **Validates: Requirements 7.1-7.6**

- [x] 2. Create StickyRepository
  - [x] 2.1 Create `backend/src/repositories/stickyRepository.ts`
    - Extend BaseRepository<Sticky>
    - Implement `getByOwner(ownerType, ownerId)` method
    - Implement `getIncomplete(ownerType, ownerId)` method
    - Follow existing repository patterns
    - _Requirements: 5.1_

  - [ ]* 2.2 Write unit tests for StickyRepository
    - Test getByOwner returns all stickies for owner
    - Test getIncomplete filters completed stickies
    - _Requirements: 5.1_

- [x] 3. Checkpoint - Ensure schemas and repository compile
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Create DashboardDataService
  - [x] 4.1 Create `backend/src/services/dashboardDataService.ts` with constructor
    - Accept HabitRepository, ActivityRepository, GoalRepository, StickyRepository via DI
    - Implement `getJstDayBoundaries()` method (reuse from DailyProgressCalculator)
    - Implement `formatJstDateDisplay()` method
    - _Requirements: 1.1, 1.2, 1.4, 1.5_

  - [ ]* 4.2 Write property test for JST day boundaries
    - **Property 1: JST Day Boundary Calculation**
    - **Validates: Requirements 1.4, 2.7, 3.6**

  - [x] 4.3 Implement `getDailyProgress()` method
    - Query active habits with type="do" using HabitRepository
    - Get today's activities within JST boundaries
    - Calculate progress for each habit
    - Sort by goal name
    - Return DailyProgressData conforming to schema
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [ ]* 4.4 Write property tests for daily progress
    - **Property 2: Daily Progress Filtering**
    - **Property 3: Daily Progress Schema Completeness**
    - **Property 4: Daily Progress Sorting**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**

  - [x] 4.5 Implement `getStatistics()` method
    - Calculate total active habits count
    - Calculate today's achievement rate
    - Calculate cumulative achievement rate
    - Get TOP3 habits by progress rate
    - Return StatisticsData conforming to schema
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ]* 4.6 Write property tests for statistics
    - **Property 5: Achievement Rate Calculation**
    - **Property 6: Statistics TOP3 Selection**
    - **Validates: Requirements 3.2, 3.3, 3.4, 3.5**

  - [x] 4.7 Implement `getNextHabits()` method
    - Query habits with scheduled times
    - Filter to next 24 hours window
    - Exclude completed, avoid-type, and cumulatively completed habits
    - Sort by start time, limit to 10
    - Return NextHabitsData conforming to schema
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [ ]* 4.8 Write property tests for next habits
    - **Property 7: Next Habits Time Window Filtering**
    - **Property 8: Next Habits Exclusion Rules**
    - **Property 9: Next Habits Sorting and Limit**
    - **Validates: Requirements 4.1, 4.4, 4.5, 4.6, 4.7**

  - [x] 4.9 Implement `getStickies()` method
    - Query stickies using StickyRepository
    - Sort by display order
    - Separate incomplete and completed counts
    - Return StickiesData conforming to schema
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ]* 4.10 Write property test for stickies
    - **Property 10: Stickies Schema and Ordering**
    - **Validates: Requirements 5.2, 5.3, 5.4, 5.5**

- [x] 5. Checkpoint - Ensure DashboardDataService tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Extend SlackBlockBuilder
  - [x] 6.1 Add `progressDashboard()` method to SlackBlockBuilder
    - Format daily progress with header, summary, and habit list
    - Use existing progress bar and streak display methods
    - Group habits by goal name
    - Include completion buttons for incomplete habits
    - _Requirements: 6.5_

  - [x] 6.2 Add `statisticsSummary()` method to SlackBlockBuilder
    - Format statistics with achievement rates
    - Display TOP3 habits with progress
    - Use Japanese labels
    - _Requirements: 6.5, 6.7_

  - [x] 6.3 Add `nextHabitsList()` method to SlackBlockBuilder
    - Format upcoming habits with times
    - Show workload targets
    - Include completion buttons
    - _Requirements: 6.5, 6.7_

  - [x] 6.4 Add `stickiesList()` method to SlackBlockBuilder
    - Format stickies with checkboxes
    - Show incomplete first, then completed
    - Include descriptions when available
    - _Requirements: 6.5, 6.7_

  - [ ]* 6.5 Write unit tests for new SlackBlockBuilder methods
    - Test block structure for each method
    - Test Japanese message formatting
    - _Requirements: 6.5, 6.7_

- [x] 7. Update Slack Commands Router
  - [x] 7.1 Add `handleProgress()` command handler
    - Handle `/progress` and `/habit-progress` commands
    - Initialize DashboardDataService with repositories
    - Call getDailyProgress() and format with SlackBlockBuilder
    - Handle errors with user-friendly messages
    - _Requirements: 6.1, 6.6, 6.7, 6.8, 8.1, 8.2_

  - [x] 7.2 Add `handleStats()` command handler
    - Handle `/stats` and `/habit-stats` commands
    - Call getStatistics() and format response
    - _Requirements: 6.2, 6.6, 6.7, 6.8_

  - [x] 7.3 Add `handleNext()` command handler
    - Handle `/next` and `/habit-next` commands
    - Call getNextHabits() and format response
    - _Requirements: 6.3, 6.6, 6.7, 6.8_

  - [x] 7.4 Add `handleStickies()` command handler
    - Handle `/stickies` command
    - Call getStickies() and format response
    - Show incomplete stickies first
    - _Requirements: 6.4, 5.5, 6.6, 6.7, 6.8_

  - [x] 7.5 Register new commands in router switch statement
    - Add cases for `/progress`, `/habit-progress`
    - Add cases for `/stats`, `/habit-stats`
    - Add cases for `/next`, `/habit-next`
    - Add cases for `/stickies`
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ]* 7.6 Write integration tests for new Slack commands
    - Test command routing
    - Test response formatting
    - Test error handling
    - _Requirements: 6.1-6.8, 8.1-8.4_

- [x] 8. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The implementation reuses existing patterns from DailyProgressCalculator and HabitCompletionReporter
