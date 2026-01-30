# Requirements Document

## Introduction

This document specifies requirements for a Goal Priority and Importance System that enables hierarchical priority and importance management for Goals and Habits. The system implements a cascading calculation model where root Goals have absolute values, and child Goals/Habits have relative values that multiply through the hierarchy to produce effective (final) values.

The system distinguishes between Priority (urgency/time-sensitivity) and Importance (significance/impact), following the Eisenhower Matrix concept. This allows users to make informed decisions about which Goals and Habits to focus on based on both dimensions.

## Glossary

- **Priority**: A measure of how urgent or time-sensitive a Goal or Habit is (0.0 to 1.0 scale)
- **Importance**: A measure of how significant or impactful a Goal or Habit is (0.0 to 1.0 scale)
- **Absolute_Priority**: The priority value set directly on a root Goal (no parent)
- **Absolute_Importance**: The importance value set directly on a root Goal (no parent)
- **Relative_Priority**: The priority value of a child Goal/Habit relative to its parent (multiplier)
- **Relative_Importance**: The importance value of a child Goal/Habit relative to its parent (multiplier)
- **Effective_Priority**: The calculated final priority (parent's effective priority × child's relative priority)
- **Effective_Importance**: The calculated final importance (parent's effective importance × child's relative importance)
- **Root_Goal**: A Goal with no parent (parent_id IS NULL)
- **Child_Goal**: A Goal with a parent Goal (parent_id IS NOT NULL)
- **Priority_Calculator**: The service that computes effective values through the hierarchy
- **Priority_Badge**: UI component displaying priority/importance values with visual indicators

## Requirements

### Requirement 1: Database Schema Extension for Priority and Importance

**User Story:** As a developer, I want to extend the database schema to support priority and importance fields, so that the system can store and calculate hierarchical values.

#### Acceptance Criteria

1. THE Database_Migration SHALL add 'priority' column of type DECIMAL(3,2) with default value 0.5 to the goals table
2. THE Database_Migration SHALL add 'importance' column of type DECIMAL(3,2) with default value 0.5 to the goals table
3. THE Database_Migration SHALL add 'priority' column of type DECIMAL(3,2) with default value 1.0 to the habits table
4. THE Database_Migration SHALL add 'importance' column of type DECIMAL(3,2) with default value 1.0 to the habits table
5. THE Database_Migration SHALL create indexes on priority and importance columns for query performance
6. THE Database_Migration SHALL preserve existing data and RLS policies
7. WHEN a value is stored, THE System SHALL validate it is between 0.0 and 1.0 inclusive

### Requirement 2: Root Goal Priority and Importance Setting

**User Story:** As a user, I want to set absolute priority and importance values on my root Goals, so that I can establish the baseline for my goal hierarchy.

#### Acceptance Criteria

1. WHEN a user opens a root Goal's edit modal, THE System SHALL display Priority and Importance sliders with values from 0.0 to 1.0
2. WHEN a user adjusts the Priority slider, THE System SHALL update the goal's priority field
3. WHEN a user adjusts the Importance slider, THE System SHALL update the goal's importance field
4. WHEN creating a new root Goal, THE System SHALL default priority to 0.5 and importance to 0.5
5. THE System SHALL display labels for priority levels: Low (0.0-0.3), Medium (0.3-0.7), High (0.7-1.0)
6. THE System SHALL display labels for importance levels: Low (0.0-0.3), Medium (0.3-0.7), High (0.7-1.0)

### Requirement 3: Child Goal Relative Priority and Importance Setting

**User Story:** As a user, I want to set relative priority and importance values on child Goals, so that I can define how they compare to their parent Goal.

#### Acceptance Criteria

1. WHEN a user opens a child Goal's edit modal, THE System SHALL display Relative Priority and Relative Importance sliders
2. WHEN displaying sliders for child Goals, THE System SHALL show values from 0.0 to 1.0 with 1.0 meaning "same as parent"
3. WHEN a user sets relative priority to 0.5, THE System SHALL interpret this as "half as urgent as parent"
4. WHEN creating a new child Goal, THE System SHALL default relative priority to 1.0 and relative importance to 1.0
5. THE System SHALL display the calculated effective values alongside the relative values
6. WHEN the parent Goal's values change, THE System SHALL recalculate and display updated effective values for all descendants

### Requirement 4: Habit Relative Priority and Importance Setting

**User Story:** As a user, I want to set relative priority and importance values on Habits, so that I can define how they compare to their parent Goal.

#### Acceptance Criteria

1. WHEN a user opens a Habit's edit modal, THE System SHALL display Relative Priority and Relative Importance sliders
2. WHEN displaying sliders for Habits, THE System SHALL show values from 0.0 to 1.0 with 1.0 meaning "same as parent Goal"
3. WHEN a user sets relative importance to 0.5, THE System SHALL interpret this as "half as important as parent Goal"
4. WHEN creating a new Habit, THE System SHALL default relative priority to 1.0 and relative importance to 1.0
5. THE System SHALL display the calculated effective values alongside the relative values
6. WHEN the parent Goal's effective values change, THE System SHALL recalculate and display updated effective values for the Habit

### Requirement 5: Effective Value Calculation

**User Story:** As a user, I want the system to automatically calculate effective priority and importance values, so that I can see the true priority of nested items.

#### Acceptance Criteria

1. WHEN calculating effective priority for a root Goal, THE Priority_Calculator SHALL return the goal's absolute priority value
2. WHEN calculating effective priority for a child Goal, THE Priority_Calculator SHALL multiply the parent's effective priority by the child's relative priority
3. WHEN calculating effective priority for a Habit, THE Priority_Calculator SHALL multiply the parent Goal's effective priority by the Habit's relative priority
4. WHEN calculating effective importance, THE Priority_Calculator SHALL apply the same multiplication logic as priority
5. WHEN a parent's values change, THE System SHALL trigger recalculation for all descendants
6. THE System SHALL cache effective values to avoid repeated calculations during rendering

### Requirement 6: Visual Priority and Importance Indicators

**User Story:** As a user, I want to see priority and importance values visually in the dashboard, so that I can quickly identify what to focus on.

#### Acceptance Criteria

1. WHEN displaying a Goal card, THE System SHALL show a Priority_Badge with the effective priority value
2. WHEN displaying a Habit card, THE System SHALL show a Priority_Badge with the effective priority value
3. THE Priority_Badge SHALL use color coding: High (bg-destructive), Medium (bg-warning), Low (bg-muted)
4. THE System SHALL display both priority and importance as separate indicators or a combined matrix view
5. WHEN effective priority is above 0.7 AND effective importance is above 0.7, THE System SHALL highlight the item as "Critical"
6. THE Priority_Badge SHALL be responsive: compact on mobile, full on desktop

### Requirement 7: Sorting and Filtering by Priority/Importance

**User Story:** As a user, I want to sort and filter Goals and Habits by priority and importance, so that I can focus on what matters most.

#### Acceptance Criteria

1. WHEN viewing Goals, THE System SHALL support sorting by effective priority (highest first)
2. WHEN viewing Goals, THE System SHALL support sorting by effective importance (highest first)
3. WHEN viewing Habits, THE System SHALL support sorting by effective priority (highest first)
4. WHEN viewing Habits, THE System SHALL support sorting by effective importance (highest first)
5. THE System SHALL support filtering by priority level (High, Medium, Low)
6. THE System SHALL support filtering by importance level (High, Medium, Low)
7. THE System SHALL support combined sorting by priority × importance (Eisenhower score)

### Requirement 8: API Endpoints for Priority Management

**User Story:** As a developer, I want RESTful API endpoints for priority and importance management, so that I can integrate the feature into the UI.

#### Acceptance Criteria

1. WHEN updating a Goal, THE API SHALL accept priority and importance fields in PATCH /api/goals/:id
2. WHEN updating a Habit, THE API SHALL accept priority and importance fields in PATCH /api/habits/:id
3. THE API SHALL provide GET /api/goals/:id/effective-values endpoint returning {effective_priority, effective_importance}
4. THE API SHALL provide GET /api/habits/:id/effective-values endpoint returning {effective_priority, effective_importance}
5. WHEN fetching Goals, THE API SHALL support sort query parameter with values: priority, importance, eisenhower
6. WHEN fetching Habits, THE API SHALL support sort query parameter with values: priority, importance, eisenhower
7. ALL endpoints SHALL validate that priority and importance values are between 0.0 and 1.0

### Requirement 9: Type System Updates

**User Story:** As a developer, I want TypeScript types to reflect the new fields, so that the codebase maintains type safety.

#### Acceptance Criteria

1. THE Goal interface SHALL include priority field with type number (0.0 to 1.0)
2. THE Goal interface SHALL include importance field with type number (0.0 to 1.0)
3. THE Habit interface SHALL include priority field with type number (0.0 to 1.0)
4. THE Habit interface SHALL include importance field with type number (0.0 to 1.0)
5. THE System SHALL export PriorityLevel and ImportanceLevel type definitions
6. THE System SHALL export EffectiveValues interface with effective_priority and effective_importance fields

### Requirement 10: UI Components for Priority/Importance Input

**User Story:** As a user, I want intuitive UI components to set priority and importance values, so that I can easily manage my goal hierarchy.

#### Acceptance Criteria

1. THE Priority_Slider component SHALL display a horizontal slider with value from 0.0 to 1.0
2. THE Priority_Slider component SHALL show tick marks at 0.0, 0.3, 0.5, 0.7, and 1.0
3. THE Priority_Slider component SHALL display the current value and level label (Low/Medium/High)
4. THE Importance_Slider component SHALL have the same behavior as Priority_Slider
5. WHEN displaying sliders for child items, THE System SHALL show "Relative to parent" label
6. WHEN displaying sliders for child items, THE System SHALL show the calculated effective value below the slider
7. THE sliders SHALL use Tailwind CSS with design tokens: bg-primary for track, bg-primary-foreground for thumb
