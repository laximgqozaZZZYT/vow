# Requirements Document

## Introduction

This document defines the requirements for enhancing the existing Goal functionality with SMART framework, OKR (Objectives and Key Results) structure, milestones, and KPI tracking capabilities. The feature extends the habit management dashboard to support comprehensive goal management best practices, enabling users to set measurable objectives, track progress through key results, and break down goals into achievable milestones.

## Glossary

- **Goal_System**: The existing goal management module that stores and manages user goals with hierarchical parent-child relationships
- **SMART_Framework**: A goal-setting methodology ensuring goals are Specific, Measurable, Achievable, Relevant, and Time-bound
- **Objective**: A high-level goal representing what the user wants to achieve (maps to existing Goal entity)
- **Key_Result**: A measurable outcome that indicates progress toward an Objective, with quantifiable target and current values
- **Milestone**: An intermediate checkpoint within a goal timeline, representing a significant achievement point
- **KPI**: Key Performance Indicator - a metric used to track progress toward a goal's target value
- **Progress_Calculator**: A component that computes goal completion percentage based on key results and milestones
- **Goal_Modal**: The existing modal dialog component for creating and editing goals
- **Difficulty_Rating**: A classification of goal achievability (easy, medium, hard, stretch)

## Requirements

### Requirement 1: SMART Goal Fields Extension

**User Story:** As a user, I want to define SMART-compliant goals, so that I can set clear, measurable, and time-bound objectives.

#### Acceptance Criteria

1. WHEN a user creates or edits a goal, THE Goal_Modal SHALL display fields for target_value, current_value, and unit
2. WHEN a user sets a target_value, THE Goal_System SHALL store the numeric target for progress tracking
3. WHEN a user specifies a unit, THE Goal_System SHALL associate the unit label (e.g., 'books', 'km', '%') with the goal
4. WHEN a user creates or edits a goal, THE Goal_Modal SHALL display start_date and deadline date pickers
5. WHEN a user selects a difficulty rating, THE Goal_System SHALL store the difficulty level (easy, medium, hard, stretch)
6. WHEN displaying a goal, THE Goal_System SHALL show the current progress as a percentage of target_value
7. IF target_value is zero or null, THEN THE Progress_Calculator SHALL treat the goal as non-quantifiable and skip percentage calculation

### Requirement 2: Key Results Management

**User Story:** As a user, I want to create key results linked to my goals, so that I can track measurable outcomes that indicate goal progress.

#### Acceptance Criteria

1. WHEN a user views a goal in detail mode, THE Goal_Modal SHALL display a Key Results section
2. WHEN a user adds a key result, THE Goal_System SHALL create a new key_result record linked to the goal
3. WHEN a user defines a key result, THE Goal_System SHALL require name and target_value fields
4. WHEN a user updates a key result's current_value, THE Goal_System SHALL recalculate the key result's progress percentage
5. WHEN key results are updated, THE Progress_Calculator SHALL recalculate the parent goal's overall progress
6. WHEN a user deletes a key result, THE Goal_System SHALL remove the record and recalculate goal progress
7. THE Goal_System SHALL support multiple key results per goal
8. WHEN displaying key results, THE Goal_Modal SHALL show progress bars for each key result

### Requirement 3: Milestone Tracking

**User Story:** As a user, I want to break my goals into milestones, so that I can track intermediate progress and stay motivated.

#### Acceptance Criteria

1. WHEN a user views a goal in detail mode, THE Goal_Modal SHALL display a Milestones section
2. WHEN a user adds a milestone, THE Goal_System SHALL create a new milestone record linked to the goal
3. WHEN a user defines a milestone, THE Goal_System SHALL require a name field
4. WHEN a user sets a milestone due_date, THE Goal_System SHALL store the target completion date
5. WHEN a user marks a milestone as completed, THE Goal_System SHALL set completed to true and record completed_at timestamp
6. WHEN displaying milestones, THE Goal_Modal SHALL show milestones in display_order sequence
7. WHEN a user reorders milestones, THE Goal_System SHALL update the display_order values
8. THE Goal_System SHALL support multiple milestones per goal

### Requirement 4: Progress Visualization

**User Story:** As a user, I want to see visual progress indicators for my goals, so that I can quickly understand my advancement toward objectives.

#### Acceptance Criteria

1. WHEN displaying a goal with target_value, THE Goal_System SHALL render a progress bar or ring showing completion percentage
2. WHEN a goal has key results, THE Progress_Calculator SHALL compute overall progress as the average of key result progress values
3. WHEN a goal has milestones, THE Goal_Modal SHALL display a timeline or checklist view of milestones
4. WHEN displaying the goal tree or diagram, THE Widget SHALL show progress indicators on goal nodes
5. WHEN a goal's progress reaches 100%, THE Goal_System SHALL visually indicate completion status

### Requirement 5: Habit-Key Result Integration

**User Story:** As a user, I want to link habits to key results, so that completing habits automatically updates my goal progress.

#### Acceptance Criteria

1. WHEN a user creates or edits a key result, THE Goal_Modal SHALL allow linking to existing habits
2. WHEN a linked habit is completed, THE Goal_System SHALL update the associated key result's current_value
3. WHEN a habit completion updates a key result, THE Progress_Calculator SHALL recalculate goal progress
4. WHEN displaying a key result, THE Goal_Modal SHALL show linked habits
5. IF a linked habit is deleted, THEN THE Goal_System SHALL remove the link but preserve the key result

### Requirement 6: Database Schema Extension

**User Story:** As a developer, I want the database schema extended to support SMART goals, key results, and milestones, so that the system can persist all goal management data.

#### Acceptance Criteria

1. THE Goal_System SHALL extend the goals table with target_value, current_value, unit, start_date, deadline, and difficulty columns
2. THE Goal_System SHALL create a key_results table with id, goal_id, name, target_value, current_value, unit, progress, and ownership columns
3. THE Goal_System SHALL create a milestones table with id, goal_id, name, due_date, completed, completed_at, display_order, and ownership columns
4. THE Goal_System SHALL create appropriate foreign key constraints with CASCADE delete behavior
5. THE Goal_System SHALL create indexes for efficient querying by goal_id
6. THE Goal_System SHALL apply Row Level Security policies consistent with existing tables

### Requirement 7: Goal Detail View Mode

**User Story:** As a user, I want an expanded detail view for goals, so that I can manage key results and milestones without cluttering the basic view.

#### Acceptance Criteria

1. WHEN a user opens a goal modal, THE Goal_Modal SHALL default to basic view showing existing fields
2. WHEN a user switches to detail view, THE Goal_Modal SHALL expand to show SMART fields, key results, and milestones
3. WHEN in detail view, THE Goal_Modal SHALL organize content into logical sections (SMART, Key Results, Milestones)
4. WHEN switching between views, THE Goal_Modal SHALL preserve unsaved changes
5. THE Goal_Modal SHALL remember the user's preferred view mode

