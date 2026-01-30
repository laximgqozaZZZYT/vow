# Requirements Document

## Introduction

「Next」セクションを「Board」セクションに変換し、Trello風のカンバンボードレイアウトを実装する機能。ユーザーは「予定」「進行中」「完了(日次)」の3つのカラム間で習慣を自由に移動できる。既存のシンプルレイアウトは「簡易レイアウト」として保持し、新しいカンバンレイアウトを「詳細レイアウト」としてデフォルト表示する。

## Glossary

- **Board_Section**: 「Next」セクションを置き換える新しいセクションコンポーネント
- **Kanban_Board**: 3つのカラムを持つTrello風のボードレイアウト
- **Column**: カンバンボード内の縦方向のコンテナ（予定、進行中、完了(日次)）
- **Habit_Card**: カンバンボード内で習慣を表示するカードコンポーネント
- **Layout_Mode**: 簡易レイアウトと詳細レイアウトを切り替えるモード
- **Simple_Layout**: 既存のNextセクションと同等のリスト表示レイアウト
- **Detailed_Layout**: カンバンボード形式の詳細レイアウト（デフォルト）
- **Habit_Status**: 習慣の状態（planned: 予定、in_progress: 進行中、completed_daily: 日次完了）

## Requirements

### Requirement 1: レイアウトモード切り替え

**User Story:** As a user, I want to switch between simple and detailed layouts, so that I can choose the view that best suits my workflow.

#### Acceptance Criteria

1. WHEN the Board_Section loads, THE Board_Section SHALL display the Detailed_Layout (Kanban_Board) by default
2. THE Board_Section SHALL provide a toggle button to switch between Simple_Layout and Detailed_Layout
3. WHEN a user clicks the layout toggle, THE Board_Section SHALL switch to the other Layout_Mode without page reload
4. THE Board_Section SHALL persist the user's Layout_Mode preference in local storage
5. WHEN the Board_Section loads with a saved preference, THE Board_Section SHALL display the saved Layout_Mode

### Requirement 2: カンバンボードの表示

**User Story:** As a user, I want to see my habits organized in a Kanban board with three columns, so that I can visualize my daily progress at a glance.

#### Acceptance Criteria

1. WHEN Detailed_Layout is active, THE Kanban_Board SHALL display three columns horizontally: 「予定」(Planned), 「進行中」(In Progress), 「完了(日次)」(Completed Daily)
2. THE Kanban_Board SHALL display each Column with a distinct header showing the column name and habit count
3. WHEN habits exist for today, THE Kanban_Board SHALL distribute habits into appropriate columns based on their Habit_Status
4. THE Kanban_Board SHALL display habits with no activity today in the 「予定」column
5. WHEN a habit has a 'start' activity today without 'complete', THE Kanban_Board SHALL display it in the 「進行中」column
6. WHEN a habit has a 'complete' activity today, THE Kanban_Board SHALL display it in the 「完了(日次)」column

### Requirement 3: 習慣カードの表示

**User Story:** As a user, I want to see relevant information on each habit card, so that I can quickly understand the habit's details and progress.

#### Acceptance Criteria

1. THE Habit_Card SHALL display the habit name prominently
2. THE Habit_Card SHALL display the scheduled time if available
3. THE Habit_Card SHALL display progress information (count/must) for habits with targets
4. THE Habit_Card SHALL display workload information (workloadPerCount, workloadUnit) if configured
5. WHEN a habit is in the 「進行中」column, THE Habit_Card SHALL display elapsed time since start
6. THE Habit_Card SHALL provide a button to complete the habit with amount input
7. WHEN a user clicks the habit name, THE Board_Section SHALL open the habit edit modal

### Requirement 4: ドラッグ&ドロップによる習慣移動

**User Story:** As a user, I want to drag and drop habits between columns, so that I can easily update their status.

#### Acceptance Criteria

1. WHEN a user drags a Habit_Card, THE Kanban_Board SHALL show visual feedback indicating the card is being dragged
2. WHEN a Habit_Card is dragged over a Column, THE Column SHALL show visual feedback indicating it is a valid drop target
3. WHEN a user drops a Habit_Card in the 「進行中」column, THE Board_Section SHALL trigger a 'start' action for that habit
4. WHEN a user drops a Habit_Card in the 「完了(日次)」column, THE Board_Section SHALL trigger a 'complete' action for that habit
5. WHEN a user drops a Habit_Card in the 「予定」column from 「進行中」, THE Board_Section SHALL trigger a 'pause' action for that habit
6. IF a drag operation fails, THEN THE Board_Section SHALL return the Habit_Card to its original position

### Requirement 5: モバイル対応

**User Story:** As a mobile user, I want to navigate and manage habits on the Kanban board using touch gestures, so that I can use the feature on my phone.

#### Acceptance Criteria

1. WHEN viewing on mobile devices (width < 768px), THE Kanban_Board SHALL display columns in a horizontally scrollable container
2. THE Kanban_Board SHALL support horizontal swipe navigation between columns on mobile
3. THE Kanban_Board SHALL display column indicators (dots or tabs) showing current position
4. WHEN a user long-presses a Habit_Card on mobile, THE Kanban_Board SHALL initiate drag mode with haptic feedback
5. THE Habit_Card SHALL have a minimum touch target size of 44x44 pixels
6. THE Kanban_Board SHALL respect prefers-reduced-motion for animations

### Requirement 6: 簡易レイアウトの保持

**User Story:** As a user who prefers the simple view, I want to access the original list layout, so that I can continue using the familiar interface.

#### Acceptance Criteria

1. WHEN Simple_Layout is active, THE Board_Section SHALL display habits in a vertical list format identical to the original NextSection
2. THE Simple_Layout SHALL maintain all existing functionality (complete button, amount input, habit name click)
3. THE Simple_Layout SHALL display the same habits that would appear in the Kanban_Board

### Requirement 7: タブ設定の更新

**User Story:** As a user, I want the tab navigation to reflect the new "Board" section name, so that the UI is consistent.

#### Acceptance Criteria

1. THE Tab_Navigation SHALL display "Board" instead of "Next" for the section tab
2. THE Tab_Navigation SHALL display "ボード" as the Japanese label for the section tab
3. WHEN the tab configuration references 'next', THE system SHALL treat it as equivalent to 'board' for backward compatibility
