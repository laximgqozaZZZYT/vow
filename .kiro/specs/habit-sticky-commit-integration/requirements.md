# Requirements Document

## Introduction

This feature enhances the connection between Habits and Stickies (sticky notes/tasks) in the habit management dashboard. Stickies linked to a Habit are treated as "Commits" - concrete actions taken to support the habit. This aligns with habit management best practices like "Habit Stacking" and "Reward/Feedback loops", providing users with a way to track both daily habit completions and supporting tasks that contribute to habit success.

## Glossary

- **Habit**: A recurring behavior the user wants to track (e.g., "Read 30 minutes daily")
- **Sticky**: A one-time task or note (also called "Sticky'n" in the UI)
- **Commit**: A Sticky that is linked to a Habit, representing a concrete action supporting that habit
- **Commit_Count**: The number of completed Commits associated with a Habit
- **Daily_Completion**: The regular habit check-in/completion tracking (existing functionality)
- **Dashboard**: The main user interface showing habits, stickies, and statistics
- **Junction_Table**: Database table that links two entities (sticky_habits already exists)

## Requirements

### Requirement 1: Link Stickies to Habits as Commits

**User Story:** As a user, I want to create Stickies that are linked to specific Habits, so that I can track supporting tasks separately from daily habit completions.

#### Acceptance Criteria

1. WHEN a user creates or edits a Sticky, THE Sticky_Modal SHALL display a "Related Habits" selector allowing the user to link the Sticky to one or more Habits
2. WHEN a Sticky is linked to a Habit, THE System SHALL store this relationship in the sticky_habits junction table
3. WHEN a Sticky is linked to a Habit, THE System SHALL treat this Sticky as a "Commit" for that Habit
4. THE System SHALL allow a single Sticky to be linked to multiple Habits (many-to-many relationship)
5. WHEN a user removes a Habit link from a Sticky, THE System SHALL update the sticky_habits table and recalculate Commit counts

### Requirement 2: Track Commit Counts Separately from Daily Completions

**User Story:** As a user, I want to see how many Commits I've made for each Habit, so that I can understand my engagement beyond daily check-ins.

#### Acceptance Criteria

1. THE System SHALL calculate Commit_Count as the number of completed Stickies linked to a Habit
2. WHEN a linked Sticky is marked as completed, THE System SHALL increment the Commit_Count for the associated Habit
3. WHEN a linked Sticky is marked as incomplete (unchecked), THE System SHALL decrement the Commit_Count for the associated Habit
4. THE System SHALL store Commit_Count separately from the Habit's daily completion count
5. WHEN displaying Habit statistics, THE System SHALL show both Daily_Completion count and Commit_Count

### Requirement 3: Display Commits in Habit UI

**User Story:** As a user, I want to see Commits associated with a Habit when viewing that Habit, so that I can understand what supporting tasks exist.

#### Acceptance Criteria

1. WHEN viewing a Habit in the Habit_Modal, THE System SHALL display a "Commits" section showing all linked Stickies
2. THE Commits section SHALL display each Commit's name, completion status, and completion date (if completed)
3. WHEN a Habit has no linked Stickies, THE System SHALL display "No commits yet" in the Commits section
4. THE System SHALL allow users to click on a Commit to open the Sticky_Modal for editing
5. WHEN displaying Commits, THE System SHALL sort them with incomplete Commits first, then completed Commits by completion date (most recent first)

### Requirement 4: Quick Commit Creation from Habit

**User Story:** As a user, I want to quickly create a new Commit from within a Habit, so that I can easily add supporting tasks without navigating away.

#### Acceptance Criteria

1. WHEN viewing a Habit in the Habit_Modal, THE System SHALL display an "Add Commit" button in the Commits section
2. WHEN the user clicks "Add Commit", THE System SHALL open the Sticky_Modal with the current Habit pre-selected in the Related Habits field
3. WHEN the new Sticky is saved, THE System SHALL automatically link it to the originating Habit
4. IF the user cancels the Sticky creation, THE System SHALL return to the Habit_Modal without creating any data

### Requirement 5: Commit Statistics Visualization

**User Story:** As a user, I want to see Commit statistics alongside my Habit statistics, so that I can understand my overall engagement with each Habit.

#### Acceptance Criteria

1. WHEN displaying Habit cards in the Next section, THE System SHALL show the Commit_Count badge if the Habit has any Commits
2. THE Commit_Count badge SHALL display the format "{completed}/{total} commits" (e.g., "2/5 commits")
3. WHEN all Commits for a Habit are completed, THE System SHALL display the badge with a success indicator (green color)
4. WHEN a Habit has no Commits, THE System SHALL not display the Commit badge
5. THE System SHALL update the Commit badge in real-time when Commits are added, completed, or removed

### Requirement 6: Commits in Habit Relation Map

**User Story:** As a user, I want to see Commit relationships in the Habit Relation Map, so that I can visualize how my tasks support my habits.

#### Acceptance Criteria

1. WHEN displaying the Habit Relation Map, THE System SHALL optionally show Commits as nodes connected to their parent Habits
2. THE System SHALL provide a toggle to show/hide Commit nodes in the Relation Map
3. WHEN Commit nodes are shown, THE System SHALL display them with a distinct visual style (different color/shape from Habit nodes)
4. WHEN a Commit is completed, THE System SHALL display it with a completed visual indicator (e.g., checkmark, muted color)
5. WHEN the user clicks on a Commit node, THE System SHALL open the Sticky_Modal for that Commit

### Requirement 7: Data Integrity and Migration

**User Story:** As a system administrator, I want the Commit feature to maintain data integrity and not break existing functionality.

#### Acceptance Criteria

1. THE System SHALL use the existing sticky_habits junction table for storing Commit relationships
2. THE System SHALL not modify the structure of the existing habits or stickies tables
3. WHEN a Habit is deleted, THE System SHALL preserve the linked Stickies but remove the relationship (ON DELETE CASCADE on junction table)
4. WHEN a Sticky is deleted, THE System SHALL remove all relationships to Habits (ON DELETE CASCADE on junction table)
5. THE System SHALL handle existing sticky_habits relationships as Commits without requiring data migration
