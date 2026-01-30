# Requirements Document

## Introduction

ダッシュボードのタブナビゲーション化機能。現在の/dashboardページは複数のセクション（next, activity, calendar, statics, diary, stickies, mindmap, notices, coach）を縦に並べて表示しているが、これをタブで切り替えられるようにする。UIのごちゃつきを防止し、Mindmapなど大きく表示したいコンテンツをフル表示できるようにする。

## Glossary

- **Tab_Navigation**: ダッシュボード上部に配置されるタブ切り替えUI
- **Tab**: 各セクションに対応するクリック可能なナビゲーション要素
- **Section**: ダッシュボードの各機能領域（next, activity, calendar, statics, diary, stickies, mindmap, notices, coach）
- **Active_Tab**: 現在選択されているタブ
- **Tab_Content**: 選択されたタブに対応するセクションコンテンツ
- **Full_View_Mode**: Mindmapなど大きなコンテンツを画面全体に表示するモード

## Requirements

### Requirement 1: タブナビゲーションの表示

**User Story:** As a user, I want to see a tab navigation at the top of the dashboard, so that I can easily switch between different sections.

#### Acceptance Criteria

1. WHEN the dashboard page loads, THE Tab_Navigation SHALL display all available section tabs horizontally
2. WHEN a user views the Tab_Navigation, THE Tab_Navigation SHALL show the Active_Tab with visual distinction (background color, border, or other indicator)
3. THE Tab_Navigation SHALL be positioned below the header and above the main content area
4. WHEN the screen width is narrow (mobile), THE Tab_Navigation SHALL be horizontally scrollable to accommodate all tabs

### Requirement 2: タブ切り替え機能

**User Story:** As a user, I want to click on a tab to switch to that section, so that I can view only the content I'm interested in.

#### Acceptance Criteria

1. WHEN a user clicks on a Tab, THE Tab_Content SHALL display only the corresponding Section
2. WHEN a Tab is clicked, THE Active_Tab indicator SHALL move to the clicked Tab
3. WHEN a Tab is switched, THE Tab_Content SHALL transition smoothly without page reload
4. THE Tab_Navigation SHALL preserve the selected tab state during the session

### Requirement 3: セクションコンテンツの表示

**User Story:** As a user, I want each section to display its full content when selected, so that I can use all features of that section.

#### Acceptance Criteria

1. WHEN a Section is displayed as Tab_Content, THE Section SHALL maintain all its existing functionality
2. WHEN a Section is displayed, THE Section SHALL use the full available width of the content area
3. WHEN switching between Sections, THE Section state SHALL be preserved (e.g., calendar view, mindmap position)

### Requirement 4: フルビューモード

**User Story:** As a user, I want to expand certain sections like Mindmap to full screen, so that I can work with large content more effectively.

#### Acceptance Criteria

1. WHERE a Section supports Full_View_Mode (e.g., mindmap, calendar), THE Section SHALL display a fullscreen toggle button
2. WHEN the fullscreen toggle is clicked, THE Section SHALL expand to cover the entire viewport
3. WHEN in Full_View_Mode, THE Section SHALL display a close/minimize button to return to normal view
4. WHEN exiting Full_View_Mode, THE Tab_Navigation SHALL return to its normal state

### Requirement 5: レスポンシブデザイン

**User Story:** As a user, I want the tab navigation to work well on both desktop and mobile devices, so that I can use the dashboard on any device.

#### Acceptance Criteria

1. WHEN viewed on desktop (width >= 768px), THE Tab_Navigation SHALL display all tabs in a single row
2. WHEN viewed on mobile (width < 768px), THE Tab_Navigation SHALL be horizontally scrollable with touch support
3. THE Tab touch targets SHALL be at least 44x44 pixels for accessibility
4. WHEN the viewport is resized, THE Tab_Navigation SHALL adapt its layout accordingly

### Requirement 6: デザインシステム準拠

**User Story:** As a developer, I want the tab navigation to follow the existing design system, so that the UI remains consistent.

#### Acceptance Criteria

1. THE Tab_Navigation SHALL use CSS variables for colors (--color-background, --color-primary, --color-border)
2. THE Tab_Navigation SHALL use the 8px-based spacing scale (--spacing-2, --spacing-4)
3. THE Tab_Navigation SHALL use the defined border-radius values (--radius-md)
4. THE Tab_Navigation SHALL support dark mode through CSS variables
