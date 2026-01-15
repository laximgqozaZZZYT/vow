# Requirements Document

## Introduction

Habit編集モーダルが複雑になってきたため、ユーザーが必要な情報に素早くアクセスできるよう、詳細ビュー(現行)と通常ビューの2つの表示モードを切り替えられる機能を追加します。通常ビューでは、最も頻繁に使用されるフィールドのみを表示し、その他のフィールドは折りたたんで隠しておきます。

## Glossary

- **Habit_Modal**: Habitの作成・編集を行うモーダルダイアログ
- **Normal_View**: 基本的なフィールドのみを表示する簡易表示モード
- **Detail_View**: すべてのフィールドを表示する詳細表示モード
- **View_Toggle**: 表示モードを切り替えるUI要素
- **Collapsed_Section**: 通常ビューで折りたたまれているセクション
- **User**: アプリケーションを使用するエンドユーザー

## Requirements

### Requirement 1: View Mode Toggle

**User Story:** As a user, I want to switch between normal and detail views in the habit modal, so that I can focus on essential fields or access all options as needed.

#### Acceptance Criteria

1. WHEN the Habit_Modal opens, THE System SHALL display the modal in Normal_View by default
2. WHEN a User clicks the View_Toggle button, THE System SHALL switch between Normal_View and Detail_View
3. WHEN switching views, THE System SHALL preserve all entered data in form fields
4. THE View_Toggle SHALL be prominently displayed near the modal header
5. THE View_Toggle SHALL clearly indicate the current view mode

### Requirement 2: Normal View Display

**User Story:** As a user, I want the normal view to show only essential fields, so that I can quickly edit common habit properties without distraction.

#### Acceptance Criteria

1. WHEN in Normal_View, THE System SHALL display the Name field
2. WHEN in Normal_View, THE System SHALL display the Timings section with repeat settings
3. WHEN in Normal_View, THE System SHALL display the time and date fields
4. WHEN in Normal_View, THE System SHALL display the Tags selector
5. WHEN in Normal_View, THE System SHALL display the Description field
6. WHEN in Normal_View, THE System SHALL hide the Workload section
7. WHEN in Normal_View, THE System SHALL hide the Outdates section
8. WHEN in Normal_View, THE System SHALL hide the Type selection (Good/Bad)
9. WHEN in Normal_View, THE System SHALL hide the Goal selection
10. WHEN in Normal_View, THE System SHALL hide the Related Habits section

### Requirement 3: Detail View Display

**User Story:** As a user, I want the detail view to show all available fields, so that I can access advanced configuration options when needed.

#### Acceptance Criteria

1. WHEN in Detail_View, THE System SHALL display all fields from Normal_View
2. WHEN in Detail_View, THE System SHALL display the Workload section
3. WHEN in Detail_View, THE System SHALL display the Outdates section
4. WHEN in Detail_View, THE System SHALL display the Type selection
5. WHEN in Detail_View, THE System SHALL display the Goal selection
6. WHEN in Detail_View, THE System SHALL display the Related Habits section

### Requirement 4: Expandable Sections in Normal View

**User Story:** As a user, I want to expand hidden sections from the normal view, so that I can access advanced fields without switching to detail view.

#### Acceptance Criteria

1. WHEN in Normal_View, THE System SHALL display an expand button or link at the bottom of the modal
2. WHEN a User clicks the expand control, THE System SHALL reveal the Collapsed_Section inline
3. WHEN a Collapsed_Section is expanded, THE System SHALL allow the User to edit fields within that section
4. WHEN a User collapses an expanded section, THE System SHALL preserve the entered data
5. THE System SHALL provide individual expand/collapse controls for each major Collapsed_Section

### Requirement 5: View Mode Persistence

**User Story:** As a user, I want my view mode preference to be remembered, so that the modal opens in my preferred view on subsequent uses.

#### Acceptance Criteria

1. WHEN a User switches to Detail_View, THE System SHALL store this preference in local storage
2. WHEN the Habit_Modal opens again, THE System SHALL restore the User's last selected view mode
3. WHEN local storage is unavailable, THE System SHALL default to Normal_View
4. THE System SHALL persist the view mode preference across browser sessions

### Requirement 6: Responsive Behavior

**User Story:** As a user on mobile devices, I want the view modes to work properly on small screens, so that I can efficiently edit habits on any device.

#### Acceptance Criteria

1. WHEN viewing on mobile devices, THE System SHALL maintain the view mode toggle functionality
2. WHEN in Normal_View on mobile, THE System SHALL optimize the layout for small screens
3. WHEN in Detail_View on mobile, THE System SHALL ensure all fields remain accessible through scrolling
4. THE View_Toggle SHALL remain accessible and usable on touch devices

### Requirement 7: Visual Feedback

**User Story:** As a user, I want clear visual feedback when switching views, so that I understand which mode I'm currently using.

#### Acceptance Criteria

1. WHEN switching views, THE System SHALL provide a smooth transition animation
2. THE View_Toggle SHALL visually indicate the active view mode
3. WHEN hovering over the View_Toggle, THE System SHALL display a tooltip explaining the view modes
4. THE System SHALL use consistent visual styling for collapsed and expanded sections
