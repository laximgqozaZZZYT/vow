# Requirements Document

## Introduction

Habitモーダルの入力項目が増加し、現行の「通常/詳細」ビューモードでは操作性に限界が生じています。本機能では、モーダルを4つのタブ構成に再編成し、特にスマートフォンユーザーでも快適に操作できるUIを実現します。既存のビューモード切り替え機能は廃止し、タブベースのナビゲーションに統合します。

## Glossary

- **Habit_Modal**: Habitの作成・編集を行うモーダルダイアログ
- **Tab_Navigation**: タブ間を移動するためのナビゲーションUI
- **Basic_Tab**: 名前、Type、Timings、Descriptionを含む基本タブ
- **Exclusion_Tab**: Outdates（除外日時）設定を含むタブ
- **Workload_Tab**: Level、Workload設定を含む負荷管理タブ
- **Detail_Tab**: Goal、Tags、Related Habitsを含む詳細タブ
- **Touch_Target**: タッチ操作可能なUI要素の領域
- **Swipe_Navigation**: スワイプジェスチャーによるタブ切り替え
- **User**: アプリケーションを使用するエンドユーザー

## Requirements

### Requirement 1: Tab Navigation Structure

**User Story:** As a user, I want to navigate between different sections of the habit modal using tabs, so that I can quickly access the fields I need without scrolling through all options.

#### Acceptance Criteria

1. WHEN the Habit_Modal opens, THE Tab_Navigation SHALL display 4 tabs: 基本, 除外日時, 負荷, 詳細
2. WHEN the Habit_Modal opens, THE System SHALL display the Basic_Tab as the default active tab
3. WHEN a User taps a tab, THE System SHALL switch to that tab's content immediately
4. THE Tab_Navigation SHALL clearly indicate the currently active tab with visual distinction
5. THE Tab_Navigation SHALL remain visible and accessible while scrolling within tab content

### Requirement 2: Basic Tab Content

**User Story:** As a user, I want the basic tab to contain the most frequently used fields, so that I can quickly create or edit habits for daily use.

#### Acceptance Criteria

1. WHEN viewing the Basic_Tab, THE System SHALL display the Name input field
2. WHEN viewing the Basic_Tab, THE System SHALL display the Type selection (Good/Bad)
3. WHEN viewing the Basic_Tab, THE System SHALL display the Timings section with repeat settings
4. WHEN viewing the Basic_Tab, THE System SHALL display the Description textarea
5. WHEN viewing the Basic_Tab, THE System SHALL display the Level indicator for existing habits
6. THE Basic_Tab SHALL organize fields in a logical top-to-bottom flow

### Requirement 3: Exclusion Tab Content

**User Story:** As a user, I want a dedicated tab for exclusion settings, so that I can easily configure holidays and specific periods when the habit should not apply.

#### Acceptance Criteria

1. WHEN viewing the Exclusion_Tab, THE System SHALL display the Outdates configuration section
2. WHEN viewing the Exclusion_Tab, THE System SHALL allow adding multiple exclusion periods
3. WHEN viewing the Exclusion_Tab, THE System SHALL support Date, Daily, Weekly, and Monthly exclusion types
4. WHEN viewing the Exclusion_Tab, THE System SHALL display a clear explanation of what exclusions do
5. IF no exclusions are configured, THEN THE System SHALL display an empty state with guidance

### Requirement 4: Workload Tab Content

**User Story:** As a user, I want a dedicated tab for workload and progress settings, so that I can manage the effort and tracking parameters for my habits.

#### Acceptance Criteria

1. WHEN viewing the Workload_Tab, THE System SHALL display the Level assessment controls for existing habits
2. WHEN viewing the Workload_Tab, THE System SHALL display the Workload Unit input
3. WHEN viewing the Workload_Tab, THE System SHALL display the Load per Count input
4. WHEN viewing the Workload_Tab, THE System SHALL display the Load Total (Day) input
5. WHEN viewing the Workload_Tab, THE System SHALL display the Load Total (End) input
6. WHEN viewing the Workload_Tab, THE System SHALL display the estimated days calculation
7. THE Workload_Tab SHALL display Auto Load per Set calculations based on Timings

### Requirement 5: Detail Tab Content

**User Story:** As a user, I want a dedicated tab for organizational settings, so that I can categorize and relate my habits to goals and other habits.

#### Acceptance Criteria

1. WHEN viewing the Detail_Tab, THE System SHALL display the Goal selector
2. WHEN viewing the Detail_Tab, THE System SHALL display the Tags selector using SmartSelector
3. WHEN viewing the Detail_Tab, THE System SHALL display the Related Habits section
4. WHEN viewing the Detail_Tab, THE System SHALL allow adding and removing habit relations
5. THE Detail_Tab SHALL support Main, Sub, and Next relation types

### Requirement 6: Mobile-Friendly Touch Targets

**User Story:** As a mobile user, I want all interactive elements to be easily tappable, so that I can use the modal comfortably on my smartphone.

#### Acceptance Criteria

1. THE Tab_Navigation buttons SHALL have a minimum Touch_Target size of 44x44 pixels
2. THE form input fields SHALL have a minimum height of 44 pixels
3. THE action buttons (Save, Cancel, Delete) SHALL have a minimum Touch_Target size of 44x44 pixels
4. THE dropdown and popover triggers SHALL have a minimum Touch_Target size of 44x44 pixels
5. WHEN displaying timing rows, THE add/remove buttons SHALL have a minimum Touch_Target size of 44x44 pixels

### Requirement 7: Swipe Navigation

**User Story:** As a mobile user, I want to swipe between tabs, so that I can navigate the modal naturally using touch gestures.

#### Acceptance Criteria

1. WHEN a User swipes left on tab content, THE System SHALL navigate to the next tab
2. WHEN a User swipes right on tab content, THE System SHALL navigate to the previous tab
3. WHEN on the first tab and swiping right, THE System SHALL not navigate (boundary behavior)
4. WHEN on the last tab and swiping left, THE System SHALL not navigate (boundary behavior)
5. THE Swipe_Navigation SHALL provide visual feedback during the swipe gesture
6. THE Swipe_Navigation SHALL have a minimum swipe threshold to prevent accidental navigation

### Requirement 8: Data Persistence Across Tabs

**User Story:** As a user, I want my entered data to be preserved when switching between tabs, so that I don't lose my work while configuring different aspects of a habit.

#### Acceptance Criteria

1. WHEN switching between tabs, THE System SHALL preserve all entered form data
2. WHEN returning to a previously visited tab, THE System SHALL display the previously entered values
3. WHEN saving the habit, THE System SHALL include data from all tabs in the save operation
4. IF validation errors exist in another tab, THEN THE System SHALL indicate which tab contains errors

### Requirement 9: Responsive Layout

**User Story:** As a user on various devices, I want the tab layout to adapt to my screen size, so that I have an optimal experience on both mobile and desktop.

#### Acceptance Criteria

1. WHEN viewing on mobile (width < 768px), THE Tab_Navigation SHALL display horizontally scrollable tabs
2. WHEN viewing on mobile, THE tab content SHALL use full-width single-column layout
3. WHEN viewing on desktop, THE Tab_Navigation SHALL display all tabs without scrolling
4. WHEN viewing on desktop, THE tab content MAY use multi-column layout where appropriate
5. THE modal height SHALL adapt to screen size with appropriate max-height constraints

### Requirement 10: Deprecation of View Modes

**User Story:** As a user, I want a unified tab-based interface, so that I don't need to switch between normal and detail view modes.

#### Acceptance Criteria

1. THE System SHALL remove the Normal_View and Detail_View toggle functionality
2. THE System SHALL remove the CollapsibleSection components from the modal
3. THE System SHALL migrate all fields from both view modes into the appropriate tabs
4. THE System SHALL remove the viewMode localStorage persistence
5. THE System SHALL preserve the last active tab in localStorage for user convenience

### Requirement 11: Accessibility

**User Story:** As a user with accessibility needs, I want the tab interface to be fully accessible, so that I can use the modal with assistive technologies.

#### Acceptance Criteria

1. THE Tab_Navigation SHALL support keyboard navigation using arrow keys
2. THE Tab_Navigation SHALL use proper ARIA roles (tablist, tab, tabpanel)
3. WHEN a tab is focused, THE System SHALL allow activation with Enter or Space key
4. THE active tab SHALL have aria-selected="true" attribute
5. THE tab panels SHALL have proper aria-labelledby associations
6. THE System SHALL maintain focus management when switching tabs

### Requirement 12: Visual Design Consistency

**User Story:** As a user, I want the tab interface to match the application's design system, so that the modal feels cohesive with the rest of the application.

#### Acceptance Criteria

1. THE Tab_Navigation SHALL use the design system's color tokens (bg-card, text-foreground, etc.)
2. THE active tab indicator SHALL use the primary color token
3. THE tab content areas SHALL use consistent spacing based on 8px grid
4. THE tab transitions SHALL use smooth animations respecting prefers-reduced-motion
5. THE Tab_Navigation SHALL support dark mode through CSS variables

