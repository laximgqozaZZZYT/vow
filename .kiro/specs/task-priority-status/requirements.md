# Requirements Document

## Introduction

This document defines the requirements for implementing task priority and status management for Stickies (tasks) in the habit management dashboard. The feature introduces Eisenhower Matrix-based priority classification, status tracking, due date management, and visual indicators to help users organize and prioritize their tasks effectively.

## Glossary

- **Sticky**: A one-time task item in the system (also called Sticky'n)
- **Priority_Selector**: UI component for selecting task priority based on Eisenhower Matrix
- **Status_Selector**: UI component for selecting task status
- **Due_Date_Picker**: UI component for selecting task due dates
- **Filter_Panel**: UI component for filtering and sorting tasks
- **Eisenhower_Matrix**: A prioritization framework with four quadrants based on urgency and importance
- **Priority_Level**: One of five values: 'urgent-important', 'not-urgent-important', 'urgent-not-important', 'not-urgent-not-important', 'none'
- **Status_Value**: One of four values: 'not_started', 'in_progress', 'completed', 'on_hold'

## Requirements

### Requirement 1: Database Schema Extension

**User Story:** As a developer, I want to extend the stickies table with priority, status, and due date fields, so that the system can persist task management data.

#### Acceptance Criteria

1. THE Database_Migration SHALL add a 'priority' column of type TEXT with default value 'none' to the stickies table
2. THE Database_Migration SHALL add a 'status' column of type TEXT with default value 'not_started' to the stickies table
3. THE Database_Migration SHALL add a 'due_date' column of type TIMESTAMP WITH TIME ZONE to the stickies table
4. THE Database_Migration SHALL create indexes on priority, status, and due_date columns for query performance
5. THE Database_Migration SHALL preserve existing data and RLS policies

### Requirement 2: Priority Selection

**User Story:** As a user, I want to assign priority levels to my tasks using the Eisenhower Matrix, so that I can focus on what matters most.

#### Acceptance Criteria

1. WHEN a user opens the Sticky Modal, THE Priority_Selector SHALL display five priority options: Urgent+Important, Not Urgent+Important, Urgent+Not Important, Not Urgent+Not Important, and None
2. WHEN a user selects a priority level, THE System SHALL update the sticky's priority field
3. WHEN creating a new sticky, THE System SHALL default the priority to 'none'
4. WHEN editing an existing sticky, THE Priority_Selector SHALL display the current priority value
5. THE Priority_Selector SHALL use visual indicators (colors/icons) to distinguish priority levels

### Requirement 3: Status Management

**User Story:** As a user, I want to track the status of my tasks, so that I can monitor progress and manage my workflow.

#### Acceptance Criteria

1. WHEN a user opens the Sticky Modal, THE Status_Selector SHALL display four status options: Not Started (未着手), In Progress (進行中), Completed (完了), On Hold (保留)
2. WHEN a user selects a status, THE System SHALL update the sticky's status field
3. WHEN creating a new sticky, THE System SHALL default the status to 'not_started'
4. WHEN a user marks a sticky as completed via checkbox, THE System SHALL set status to 'completed'
5. WHEN a user unchecks a completed sticky, THE System SHALL set status to 'not_started'
6. THE Status_Selector SHALL use visual indicators to distinguish status values

### Requirement 4: Due Date Management

**User Story:** As a user, I want to set due dates for my tasks, so that I can manage deadlines effectively.

#### Acceptance Criteria

1. WHEN a user opens the Sticky Modal, THE Due_Date_Picker SHALL allow selecting a due date and optional time
2. WHEN a user sets a due date, THE System SHALL persist the due_date value
3. WHEN a user clears the due date, THE System SHALL set due_date to null
4. WHEN displaying a sticky with a due date, THE System SHALL show the formatted date
5. WHEN a sticky's due date has passed, THE System SHALL display an overdue indicator
6. WHEN a sticky's due date is within 24 hours, THE System SHALL display an upcoming indicator

### Requirement 5: Visual Priority Indicators

**User Story:** As a user, I want to see priority levels at a glance in the task list, so that I can quickly identify important tasks.

#### Acceptance Criteria

1. WHEN displaying a sticky in the list, THE System SHALL show a color-coded priority indicator
2. THE System SHALL use bg-destructive color for 'urgent-important' priority
3. THE System SHALL use bg-warning color for 'not-urgent-important' priority
4. THE System SHALL use a muted color for 'urgent-not-important' priority
5. THE System SHALL use a subtle indicator for 'not-urgent-not-important' priority
6. WHEN priority is 'none', THE System SHALL not display a priority indicator

### Requirement 6: Filtering and Sorting

**User Story:** As a user, I want to filter and sort my tasks by priority, status, and due date, so that I can view tasks in a meaningful order.

#### Acceptance Criteria

1. WHEN viewing the Stickies section, THE Filter_Panel SHALL provide priority filter options
2. WHEN viewing the Stickies section, THE Filter_Panel SHALL provide status filter options
3. WHEN a user selects a filter, THE System SHALL display only matching stickies
4. THE System SHALL support sorting by priority (highest first)
5. THE System SHALL support sorting by due date (earliest first)
6. THE System SHALL support sorting by status
7. WHEN multiple filters are selected, THE System SHALL apply all filters (AND logic)
8. THE System SHALL persist filter/sort preferences during the session

### Requirement 7: Type System Updates

**User Story:** As a developer, I want TypeScript types to reflect the new fields, so that the codebase maintains type safety.

#### Acceptance Criteria

1. THE Sticky interface SHALL include priority field with type union of valid priority values
2. THE Sticky interface SHALL include status field with type union of valid status values
3. THE Sticky interface SHALL include dueDate field with optional Date or string type
4. THE CreateStickyPayload interface SHALL include optional priority, status, and dueDate fields
5. THE System SHALL export Priority and Status type definitions for reuse

### Requirement 8: API Integration

**User Story:** As a developer, I want the API layer to support the new fields, so that data flows correctly between frontend and backend.

#### Acceptance Criteria

1. WHEN creating a sticky, THE API SHALL accept priority, status, and due_date fields
2. WHEN updating a sticky, THE API SHALL accept priority, status, and due_date fields
3. WHEN fetching stickies, THE API SHALL return priority, status, and due_date fields
4. THE API SHALL support filtering stickies by priority
5. THE API SHALL support filtering stickies by status
6. THE API SHALL support sorting stickies by priority, status, or due_date
