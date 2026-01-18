# Requirements Document

## Introduction

本ドキュメントは、既存の習慣管理ダッシュボードアプリを拡張し、タスク管理・習慣管理・工程管理（プロジェクト管理）・目標管理のベストプラクティスを統合した「統合生産性システム」の要件を定義します。

既存のテーブル構造（Goals, Habits, Activities, Tags, Stickies, Mindmaps）を壊さず、段階的に機能を追加していく方針で設計します。

## Glossary

- **System**: 統合生産性システム全体
- **Task**: 一回性の実行可能な作業単位（既存のStickiesを拡張）
- **Habit**: 繰り返し実行する習慣（既存機能）
- **Goal**: 達成したい目標（既存機能、OKR対応に拡張）
- **Project**: 複数のタスクやマイルストーンを含む工程管理単位
- **Milestone**: プロジェクト内の重要な中間目標
- **KPI**: Key Performance Indicator、目標達成度を測る指標
- **OKR**: Objectives and Key Results、目標と主要な成果
- **Eisenhower_Matrix**: 緊急度×重要度の4象限マトリクス
- **Habit_Stack**: 既存の習慣に新しい習慣を連鎖させる手法
- **Trigger**: 習慣を開始するきっかけ（if-then形式）
- **Dashboard**: 統合ビューを提供するメイン画面

## Requirements

### Requirement 1: タスク管理の強化

**User Story:** As a user, I want to manage one-time tasks with priority and categorization, so that I can organize and execute my work efficiently.

#### Acceptance Criteria

1. WHEN a user creates a task, THE System SHALL allow setting priority level (urgent-important, urgent-not-important, not-urgent-important, not-urgent-not-important based on Eisenhower Matrix)
2. WHEN a user views tasks, THE System SHALL display tasks grouped by priority quadrant
3. WHEN a user sets a due date for a task, THE System SHALL calculate and display days remaining
4. WHEN a task is overdue, THE System SHALL visually indicate the overdue status
5. WHEN a user completes a task, THE System SHALL record completion timestamp and update statistics
6. THE System SHALL allow tasks to be linked to Goals and Projects
7. WHEN a user creates a subtask, THE System SHALL maintain parent-child relationship with the parent task

### Requirement 2: 習慣管理の強化

**User Story:** As a user, I want to build and track habits using proven techniques, so that I can develop consistent positive behaviors.

#### Acceptance Criteria

1. WHEN a user creates a habit, THE System SHALL allow setting a trigger in if-then format (e.g., "IF I finish breakfast, THEN I will meditate")
2. WHEN a user views habits, THE System SHALL display current streak count and longest streak
3. WHEN a user completes a habit, THE System SHALL provide visual feedback (animation, sound option)
4. THE System SHALL allow habits to be stacked (linked to execute after another habit)
5. WHEN displaying habit stacks, THE System SHALL show the chain of habits in sequence order
6. WHEN a habit streak is broken, THE System SHALL notify the user and offer recovery options
7. THE System SHALL calculate and display habit completion rate over configurable time periods (daily, weekly, monthly)

### Requirement 3: 工程管理（プロジェクト管理）

**User Story:** As a user, I want to manage projects with milestones and dependencies, so that I can track complex work with multiple phases.

#### Acceptance Criteria

1. WHEN a user creates a project, THE System SHALL allow defining clear objectives and expected deliverables
2. WHEN a user adds milestones to a project, THE System SHALL allow setting target dates and success criteria
3. THE System SHALL allow tasks to be assigned to specific milestones
4. WHEN displaying project progress, THE System SHALL show percentage completion based on completed tasks and milestones
5. WHEN a milestone is completed, THE System SHALL update project progress and notify the user
6. THE System SHALL allow setting dependencies between tasks (task B cannot start until task A is complete)
7. WHEN a dependency is violated, THE System SHALL warn the user before allowing the action
8. THE System SHALL provide Gantt chart visualization for project timeline

### Requirement 4: 目標管理（OKR/KPI対応）

**User Story:** As a user, I want to set and track goals using OKR framework, so that I can align my daily activities with long-term objectives.

#### Acceptance Criteria

1. WHEN a user creates a goal, THE System SHALL allow defining it as an Objective with measurable Key Results
2. WHEN a user defines a Key Result, THE System SHALL require a target value and current value for progress tracking
3. THE System SHALL calculate and display OKR progress as percentage (current/target × 100)
4. WHEN a user views goals, THE System SHALL show alignment between daily habits/tasks and objectives
5. THE System SHALL allow setting KPIs that aggregate data from habits and tasks
6. WHEN displaying KPIs, THE System SHALL show trend over time with visual charts
7. THE System SHALL support SMART goal validation (Specific, Measurable, Achievable, Relevant, Time-bound)
8. WHEN a goal lacks SMART criteria, THE System SHALL suggest improvements

### Requirement 5: 統合ダッシュボードとビュー

**User Story:** As a user, I want a unified dashboard that shows all my productivity data, so that I can get a holistic view of my progress.

#### Acceptance Criteria

1. THE System SHALL provide a daily view showing today's tasks, habits, and deadlines
2. THE System SHALL provide a weekly view showing week's progress and upcoming items
3. THE System SHALL provide a monthly view showing trends and goal progress
4. WHEN displaying the dashboard, THE System SHALL show key metrics (completion rate, streak count, project progress)
5. THE System SHALL allow filtering views by tags, projects, or goals
6. THE System SHALL provide a focus mode that shows only the most important items for the current time
7. WHEN user preferences change, THE System SHALL persist view settings

### Requirement 6: 通知とリマインダー

**User Story:** As a user, I want timely notifications and reminders, so that I don't miss important tasks and habits.

#### Acceptance Criteria

1. WHEN a task due date approaches, THE System SHALL send a reminder notification (configurable timing)
2. WHEN a habit's scheduled time arrives, THE System SHALL send a reminder notification
3. WHEN a streak is at risk, THE System SHALL send a warning notification
4. THE System SHALL allow users to configure notification preferences (channels, timing, frequency)
5. WHEN a milestone deadline approaches, THE System SHALL notify relevant stakeholders
6. THE System SHALL support quiet hours during which notifications are suppressed

### Requirement 7: データ分析とレポート

**User Story:** As a user, I want to analyze my productivity data, so that I can identify patterns and improve my performance.

#### Acceptance Criteria

1. THE System SHALL calculate and display task completion rate over time
2. THE System SHALL calculate and display habit consistency score
3. THE System SHALL identify and highlight productivity patterns (best performing days, times)
4. WHEN generating reports, THE System SHALL allow selecting date range and metrics
5. THE System SHALL provide weekly review summary with key achievements and areas for improvement
6. THE System SHALL export data in common formats (CSV, JSON)

### Requirement 8: 既存データとの互換性

**User Story:** As a user, I want my existing data to work seamlessly with new features, so that I don't lose my progress.

#### Acceptance Criteria

1. THE System SHALL preserve all existing Goals, Habits, Activities, Tags, and Stickies data
2. WHEN migrating Stickies to Tasks, THE System SHALL maintain all existing properties and relationships
3. THE System SHALL provide backward compatibility for existing API endpoints
4. WHEN new fields are added to existing tables, THE System SHALL use nullable columns or default values
5. THE System SHALL support gradual feature adoption without requiring full migration

### Requirement 9: パフォーマンスとスケーラビリティ

**User Story:** As a user, I want the system to remain responsive as my data grows, so that I can use it long-term.

#### Acceptance Criteria

1. WHEN loading dashboard data, THE System SHALL respond within 2 seconds for up to 10,000 items
2. THE System SHALL implement pagination for large data sets
3. THE System SHALL use efficient database queries with proper indexing
4. WHEN calculating statistics, THE System SHALL use incremental updates where possible
5. THE System SHALL cache frequently accessed data appropriately
