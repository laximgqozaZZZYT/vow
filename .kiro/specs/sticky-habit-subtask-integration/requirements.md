# Requirements Document

## Introduction

この機能は、Sticky'nとHabitの親子関係を強化し、BoardセクションのカンバンビューでHabitに属するサブタスク（Sticky'n）を展開表示できるようにします。また、サブタスクの完了状態に基づいてHabitに警告マークを表示する機能を追加します。

## Glossary

- **Sticky_n**: タスク管理機能で、単発のタスクを表すエンティティ。Related Habitsを通じてHabitと関連付けることができる
- **Habit**: 習慣を表すエンティティ。日次完了や累積完了の概念を持つ
- **Subtask**: Sticky'nがHabitのRelated Habitsとして選択された場合、そのSticky'nはHabitのサブタスクとして扱われる
- **Board_Section**: カンバンビューを含むダッシュボードセクション
- **Kanban_Board**: 予定、進行中、完了(日次)、完了の4カラムで構成されるカンバンボード
- **Habit_Card**: カンバンボード上でHabitを表示するカードコンポーネント
- **Expand_Button**: Habitカードの右下に配置される[▼]ボタン。押下でサブタスクを展開/折りたたむ
- **Warning_Indicator**: すべてのサブタスクが未チェックの場合にHabitに表示される警告マーク
- **Daily_Completion**: Habitの日次完了状態
- **Cumulative_Completion**: Habitの累積完了状態

## Requirements

### Requirement 1: Sticky'nとHabitの親子関係

**User Story:** As a user, I want Sticky'n items with Related Habits to be treated as subtasks of those Habits, so that I can organize my tasks hierarchically.

#### Acceptance Criteria

1. WHEN a Sticky_n has one or more Related Habits selected, THE System SHALL treat that Sticky_n as a subtask of each related Habit
2. WHEN a Sticky_n is associated with a Habit, THE System SHALL maintain the existing Sticky_n data structure without modification
3. THE System SHALL use the existing sticky-habit relationship API to determine parent-child relationships

### Requirement 2: Habitカードへの展開ボタン追加

**User Story:** As a user, I want to see an expand button on Habit cards in the Kanban board, so that I can view subtasks associated with each Habit.

#### Acceptance Criteria

1. WHEN a Habit has one or more associated Sticky_n items, THE Habit_Card SHALL display an Expand_Button in the bottom-right corner
2. WHEN a Habit has no associated Sticky_n items, THE Habit_Card SHALL NOT display an Expand_Button
3. THE Expand_Button SHALL display [▼] when collapsed and [▲] when expanded
4. THE Expand_Button SHALL have a minimum touch target of 44x44 pixels for accessibility

### Requirement 3: サブタスク展開表示

**User Story:** As a user, I want to expand a Habit card to see its subtasks, so that I can manage related tasks together.

#### Acceptance Criteria

1. WHEN a user clicks the Expand_Button, THE System SHALL toggle the visibility of the subtask list
2. WHEN the subtask list is expanded, THE System SHALL display all Sticky_n items associated with that Habit
3. WHEN displaying subtasks, THE System SHALL use the same visual format as standalone Sticky_n items in the Kanban board
4. WHEN the subtask list is expanded, THE System SHALL display subtasks directly below the parent Habit_Card
5. WHEN a subtask is completed or uncompleted, THE System SHALL update the display immediately without collapsing the list

### Requirement 4: Habit完了時のサブタスク挙動

**User Story:** As a user, I want my subtask completion states to remain unchanged when the parent Habit is completed, so that I can track subtask progress independently.

#### Acceptance Criteria

1. WHEN a Habit reaches Daily_Completion status, THE System SHALL NOT modify the completion state of its subtasks
2. WHEN a Habit reaches Cumulative_Completion status, THE System SHALL NOT modify the completion state of its subtasks
3. WHEN a Habit is manually marked as complete, THE System SHALL NOT modify the completion state of its subtasks
4. THE System SHALL allow subtasks to be completed or uncompleted independently of the parent Habit's status

### Requirement 5: 警告マーク表示

**User Story:** As a user, I want to see a warning indicator on Habits with uncompleted subtasks, so that I can quickly identify Habits that need attention.

#### Acceptance Criteria

1. WHEN a Habit has one or more associated subtasks AND all subtasks are uncompleted, THE Habit_Card SHALL display a Warning_Indicator
2. WHEN a Habit has one or more associated subtasks AND at least one subtask is completed, THE Habit_Card SHALL NOT display a Warning_Indicator
3. WHEN a Habit has no associated subtasks, THE Habit_Card SHALL NOT display a Warning_Indicator
4. THE Warning_Indicator SHALL be visually distinct (e.g., ⚠️ icon or yellow/orange color)
5. WHEN a subtask completion state changes, THE System SHALL update the Warning_Indicator immediately

### Requirement 6: サブタスク操作

**User Story:** As a user, I want to interact with subtasks in the expanded view, so that I can complete or edit them without leaving the Kanban board.

#### Acceptance Criteria

1. WHEN a user clicks the checkbox of a subtask, THE System SHALL toggle the completion state of that Sticky_n
2. WHEN a user clicks on a subtask name, THE System SHALL open the Sticky_n edit modal
3. THE System SHALL support the same swipe-to-complete gesture for subtasks as standalone Sticky_n items

### Requirement 7: 展開状態の永続化

**User Story:** As a user, I want the expand/collapse state of Habit cards to be remembered, so that I don't have to re-expand them after page refresh.

#### Acceptance Criteria

1. WHEN a user expands or collapses a Habit's subtask list, THE System SHALL persist the state to local storage
2. WHEN the page is reloaded, THE System SHALL restore the expand/collapse state from local storage
3. THE System SHALL use a reasonable default (collapsed) for Habits without stored state
