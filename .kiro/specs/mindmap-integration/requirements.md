# Requirements Document

## Introduction

マインドマップ機能をダッシュボードに統合し、Goal/Habitと連携できるシステムを構築する。ユーザーはマインドマップを作成・編集し、その内容からGoal/Habitを生成したり、既存のGoal/Habitをマインドマップに書き出すことができる。

## Glossary

- **Mindmap**: マインドマップデータ（id, name, nodes, connectionsを持つ）
- **MindmapNode**: マインドマップ内の個別ノード（id, text, x, y, mindmapIdを持つ）
- **MindmapConnection**: ノード間の接続（id, fromNodeId, toNodeId, mindmapIdを持つ）
- **MindmapEditor**: マインドマップ編集コンポーネント
- **Modal.Mindmap**: マインドマップ作成・編集モーダル
- **DashboardSidebar**: 既存の左ペインサイドバー

## Requirements

### Requirement 1

**User Story:** As a user, I want to create and manage mindmaps in the dashboard, so that I can visually organize my thoughts and ideas.

#### Acceptance Criteria

1. WHEN a user clicks the "New Map" button in the DashboardSidebar, THE system SHALL open Modal.Mindmap for creating a new mindmap
2. WHEN a user saves a new mindmap, THE system SHALL create a Mindmap record in the database with unique id and name
3. THE DashboardSidebar SHALL display a "New Map" button alongside existing "New Goal" and "New Habit" buttons
4. WHEN a user selects an existing mindmap, THE system SHALL open the MindmapEditor with all MindmapNodes and MindmapConnections loaded
5. THE system SHALL persist mindmaps using the same owner_type and owner_id pattern as existing Goal and Habit records

### Requirement 2

**User Story:** As a user, I want to edit mindmaps with an intuitive interface, so that I can easily create and modify my visual thoughts.

#### Acceptance Criteria

1. WHEN a user double-clicks on empty space in the MindmapEditor, THE MindmapEditor SHALL create a new MindmapNode at that position
2. WHEN a user double-clicks on an existing MindmapNode, THE MindmapEditor SHALL enable text editing for that node
3. WHEN a user drags a MindmapNode, THE MindmapEditor SHALL update the node's x and y coordinates and redraw MindmapConnections
4. WHEN a user connects two MindmapNodes, THE MindmapEditor SHALL create a MindmapConnection record between them
5. THE MindmapEditor SHALL provide zoom and pan functionality for large mindmaps
6. THE MindmapEditor SHALL work responsively on mobile devices with touch gestures

### Requirement 3

**User Story:** As a user, I want to convert mindmap content to Goals and Habits, so that I can turn my ideas into actionable items.

#### Acceptance Criteria

1. WHEN a user drags to select an area in the MindmapEditor, THE MindmapEditor SHALL highlight all MindmapNodes within the selected region
2. WHEN a user right-clicks on selected MindmapNodes, THE system SHALL show context menu with "Create Goal" and "Create Habit" options
3. WHEN "Create Goal" is selected, THE system SHALL open Modal.Goal with selected node text as the name field
4. WHEN "Create Habit" is selected, THE system SHALL open Modal.Habit with selected node text as the name field
5. WHEN a Goal or Habit is created from mindmap content, THE system SHALL store the source MindmapNode ids in the Goal or Habit record

### Requirement 4

**User Story:** As a user, I want to export existing Goals and Habits to mindmaps, so that I can visualize my current objectives and routines.

#### Acceptance Criteria

1. WHEN a user right-clicks on a Goal in the dashboard, THE system SHALL show context menu with "Export to Mindmap" option
2. WHEN a user right-clicks on a Habit in the dashboard, THE system SHALL show context menu with "Export to Mindmap" option
3. WHEN "Export to Mindmap" is selected, THE system SHALL show a list of existing mindmaps or option to create new mindmap
4. WHEN a Goal or Habit is exported to a mindmap, THE system SHALL create a new MindmapNode with the Goal/Habit name and details
5. THE system SHALL store bidirectional references between exported Goals/Habits and their corresponding MindmapNodes

### Requirement 5

**User Story:** As a user, I want to access mindmap functionality on mobile devices, so that I can work with my visual thoughts anywhere.

#### Acceptance Criteria

1. WHEN a user accesses the dashboard on a mobile device, THE DashboardSidebar SHALL display the "New Map" button in mobile-optimized layout
2. WHEN a user opens the MindmapEditor on mobile, THE MindmapEditor SHALL adapt touch interactions for creating and editing MindmapNodes
3. WHEN a user performs touch gestures on mobile, THE MindmapEditor SHALL support pinch-to-zoom, tap-to-select, and drag-to-move operations
4. WHEN a user selects MindmapNodes on mobile, THE system SHALL use touch-friendly selection methods with larger touch targets
5. THE MindmapEditor SHALL maintain full functionality on mobile devices while optimizing for smaller screen sizes

### Requirement 6

**User Story:** As a user, I want mindmaps to persist and sync with my other data, so that my visual work is preserved and integrated with my goals and habits.

#### Acceptance Criteria

1. WHEN a user makes changes to a mindmap, THE system SHALL automatically save Mindmap, MindmapNode, and MindmapConnection changes to the database
2. WHEN a user creates links between MindmapNodes and Goals/Habits, THE system SHALL persist these relationships using foreign key references
3. WHEN a user deletes a Goal or Habit that is linked to a mindmap, THE system SHALL update the corresponding MindmapNode to reflect the change
4. WHEN a user modifies a Goal or Habit that is linked to a mindmap, THE system SHALL optionally update the corresponding MindmapNode text
5. THE system SHALL ensure data consistency between mindmaps and related Goals/Habits using the same owner_type and owner_id pattern