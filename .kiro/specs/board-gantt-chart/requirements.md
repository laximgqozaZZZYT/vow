# Requirements Document

## Introduction

Board セクションに新しいガントチャートテンプレートを追加する機能。既存のカンバン/リストビューに加えて、Goals と Habits の時間軸ベースの可視化を提供する。ガントチャートは親子関係（Goal → Habit、Habit → sub-Habit）、先行/後続関係、予定スケジュール、実績進捗、および稲妻線（計画対実績の進捗ライン）を表示する。

## Glossary

- **Gantt_Chart**: 時間軸に沿ってタスクやスケジュールを横棒で表示するチャート形式
- **Board_Section**: カンバン、リスト、ガントチャートの各ビューを切り替え可能なセクション
- **Goal**: ユーザーが定義した目標。親Goalを持つことができ、複数のHabitを含む
- **Habit**: Goalに属する習慣タスク。先行/後続関係を持つことができる
- **Parent_Child_Relationship**: Goal → Habit、または Habit → sub-Habit の階層関係
- **Successor_Predecessor_Relationship**: Habit間の先行/後続の依存関係（HabitRelation）
- **Schedule_Bar**: ガントチャート上で予定期間を示す横棒
- **Progress_Bar**: Schedule_Bar内で実際の進捗を示す塗りつぶし部分
- **Lightning_Line**: 稲妻線。計画進捗と実績進捗の差異を視覚化するジグザグライン
- **Timeline**: ガントチャートの時間軸（日/週/月単位で表示）
- **Row**: ガントチャートの各行。Goal または Habit を表示
- **View_Mode**: ガントチャートの表示モード（日/週/月）

## Requirements

### Requirement 1: ガントチャートビューの追加

**User Story:** As a user, I want to access a Gantt chart view in the Board section, so that I can visualize my Goals and Habits on a timeline.

#### Acceptance Criteria

1. THE Board_Section SHALL provide a view toggle that includes Gantt chart option alongside Kanban and List views
2. WHEN a user selects the Gantt chart view, THE Board_Section SHALL display the Gantt_Chart component
3. THE Board_Section SHALL persist the user's view preference (Kanban/List/Gantt) in local storage
4. WHEN the Board_Section loads with a saved Gantt preference, THE Board_Section SHALL display the Gantt_Chart view

### Requirement 2: Goals と Habits の行表示

**User Story:** As a user, I want to see my Goals and Habits as rows in the Gantt chart, so that I can understand the structure of my tasks.

#### Acceptance Criteria

1. THE Gantt_Chart SHALL display each visible Goal as a row with its name in the left column
2. THE Gantt_Chart SHALL display each Habit belonging to a visible Goal as an indented row beneath its parent Goal
3. WHEN a Goal has child Goals, THE Gantt_Chart SHALL display child Goals as indented rows beneath the parent Goal
4. THE Gantt_Chart SHALL support collapsing/expanding Goal rows to show/hide their child Habits and Goals
5. WHEN a row is collapsed, THE Gantt_Chart SHALL hide all descendant rows and show a collapse indicator
6. THE Gantt_Chart SHALL display row names with appropriate indentation based on hierarchy depth

### Requirement 3: スケジュールバーの表示

**User Story:** As a user, I want to see schedule bars for my Goals and Habits, so that I can understand when tasks are planned.

#### Acceptance Criteria

1. WHEN a Goal has a dueDate, THE Gantt_Chart SHALL display a Schedule_Bar from the Goal's creation date to its dueDate
2. WHEN a Habit has dueDate and time/timings, THE Gantt_Chart SHALL display a Schedule_Bar representing the planned period
3. THE Schedule_Bar SHALL use the design system's primary color for planned periods
4. WHEN a Goal or Habit has no date information, THE Gantt_Chart SHALL display the row without a Schedule_Bar
5. THE Schedule_Bar SHALL be positioned horizontally according to the Timeline scale

### Requirement 4: 進捗表示

**User Story:** As a user, I want to see actual progress on the Gantt chart, so that I can compare planned vs actual completion.

#### Acceptance Criteria

1. WHEN a Habit has workloadTotal and activities, THE Gantt_Chart SHALL display a Progress_Bar inside the Schedule_Bar
2. THE Progress_Bar SHALL fill proportionally based on (completed workload / workloadTotal)
3. WHEN a Habit is marked as completed, THE Progress_Bar SHALL fill 100% of the Schedule_Bar
4. THE Progress_Bar SHALL use a distinct color (success color) to differentiate from the planned Schedule_Bar
5. WHEN a Goal has child Habits, THE Gantt_Chart SHALL calculate and display aggregate progress for the Goal row

### Requirement 5: 親子関係の可視化

**User Story:** As a user, I want to see parent-child relationships between Goals and Habits, so that I can understand the hierarchy.

#### Acceptance Criteria

1. THE Gantt_Chart SHALL display visual hierarchy through row indentation (Goal → Habit → sub-Habit)
2. THE Gantt_Chart SHALL display tree lines or connectors showing parent-child relationships in the row name column
3. WHEN a Goal contains multiple Habits, THE Gantt_Chart SHALL group them visually under the Goal row
4. THE Gantt_Chart SHALL support at least 3 levels of hierarchy (Goal → Habit → sub-Habit)

### Requirement 6: 先行/後続関係の可視化

**User Story:** As a user, I want to see successor/predecessor relationships between Habits, so that I can understand task dependencies.

#### Acceptance Criteria

1. WHEN Habits have HabitRelation with relation type 'next', THE Gantt_Chart SHALL display dependency arrows between the related Schedule_Bars
2. THE dependency arrow SHALL point from the predecessor Habit's bar end to the successor Habit's bar start
3. THE Gantt_Chart SHALL use a distinct visual style (dashed line or arrow) for dependency connections
4. WHEN a user hovers over a dependency arrow, THE Gantt_Chart SHALL highlight both connected Habits

### Requirement 7: 稲妻線（Lightning Line）の表示

**User Story:** As a user, I want to see a lightning line showing planned vs actual progress, so that I can quickly identify schedule deviations.

#### Acceptance Criteria

1. THE Gantt_Chart SHALL display a vertical Lightning_Line at the current date position
2. THE Lightning_Line SHALL zigzag horizontally at each row based on the difference between planned and actual progress
3. WHEN actual progress is ahead of planned, THE Lightning_Line SHALL shift right (ahead of the current date line)
4. WHEN actual progress is behind planned, THE Lightning_Line SHALL shift left (behind the current date line)
5. THE Lightning_Line SHALL use a distinct color (warning or accent color) to stand out from other elements
6. THE Gantt_Chart SHALL provide a toggle to show/hide the Lightning_Line

### Requirement 8: タイムライン操作

**User Story:** As a user, I want to navigate and zoom the timeline, so that I can view different time periods.

#### Acceptance Criteria

1. THE Gantt_Chart SHALL display a Timeline header showing date/week/month labels
2. THE Gantt_Chart SHALL support View_Mode switching between day, week, and month views
3. WHEN in day view, THE Timeline SHALL show individual days with date labels
4. WHEN in week view, THE Timeline SHALL show week numbers or date ranges
5. WHEN in month view, THE Timeline SHALL show month names
6. THE Gantt_Chart SHALL support horizontal scrolling to navigate through time
7. THE Gantt_Chart SHALL display a "Today" indicator line on the Timeline

### Requirement 9: インタラクティブ機能

**User Story:** As a user, I want to interact with the Gantt chart elements, so that I can view details and make changes.

#### Acceptance Criteria

1. WHEN a user clicks on a Goal row, THE Gantt_Chart SHALL trigger a callback to open the Goal edit modal
2. WHEN a user clicks on a Habit row, THE Gantt_Chart SHALL trigger a callback to open the Habit edit modal
3. WHEN a user hovers over a Schedule_Bar, THE Gantt_Chart SHALL display a tooltip with details (name, dates, progress)
4. THE Gantt_Chart SHALL support keyboard navigation for accessibility (arrow keys to move between rows)

### Requirement 10: レスポンシブ・アクセシブルデザイン

**User Story:** As a user, I want the Gantt chart to work on different devices and be accessible, so that I can use it regardless of my device or abilities.

#### Acceptance Criteria

1. THE Gantt_Chart SHALL be responsive and adapt to different screen sizes
2. WHEN viewing on mobile (width < 768px), THE Gantt_Chart SHALL support horizontal scrolling for the timeline
3. THE Gantt_Chart SHALL support dark mode using the design system's CSS variables
4. THE Gantt_Chart SHALL use semantic HTML and ARIA attributes for accessibility
5. THE Gantt_Chart SHALL provide minimum touch targets of 44x44px for interactive elements
6. THE Gantt_Chart SHALL respect the user's prefers-reduced-motion setting for animations
