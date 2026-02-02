# Requirements Document: Multi-Agent Dashboard UI

## Introduction

VOWダッシュボード上でマルチエージェント開発環境を閲覧・操作できるようにします。tmuxベースの管理をWeb UIに置き換え、マネージャーエージェントとのチャット、各エージェントのモニタリング、タスク管理、既存機能（Board/Activities）との連携を実現します。

## Glossary

- **Agent**: MCP Task Distributionサーバーに登録されたClaude AIエージェント
- **Manager**: 管理権限を持つエージェント（role=manager）
- **Worker**: 開発作業を行うエージェント（developer, tester等）
- **Task**: エージェントに割り当てられる作業単位
- **Session**: マネージャーとのチャットセッション
- **Trust**: リモートマシンの信頼関係
- **MCP_Server**: タスク分散サーバー（localhost:3456）
- **Pane**: tmux風のパネル分割ビュー内の各エージェント表示領域
- **Instruction Flow**: エージェント間の指示・依存関係を視覚化した図
- **Nested Sticky'n**: 親子関係を持つSticky'n（メモ/タスク）

## Requirements

### Requirement 1: Agent Dashboard Section

**User Story:** As a user, I want to view and manage all agents from the VOW dashboard, so that I can monitor multi-agent development without using tmux.

#### Acceptance Criteria

1. THE Dashboard SHALL display a new "Agents" section in the section navigation
2. THE Agents section SHALL show all registered agents with their status (idle/busy/offline)
3. THE Agents section SHALL display agent details: name, role, machine, current task
4. THE Agents section SHALL support real-time updates via SSE from MCP server
5. THE Agents section SHALL allow filtering by role, status, and machine
6. THE Agents section SHALL display agent count and capacity usage

### Requirement 2: Manager Chat Interface

**User Story:** As a user, I want to chat with the Manager agent, so that I can issue commands and receive reports without opening Claude Code.

#### Acceptance Criteria

1. THE Chat interface SHALL be accessible from the Agents section header
2. THE Chat interface SHALL support bi-directional messaging with Manager agent
3. THE Chat interface SHALL display message history with timestamps
4. THE Chat interface SHALL support Manager's structured responses (task lists, status reports)
5. THE Chat interface SHALL allow creating new chat sessions
6. THE Chat interface SHALL persist chat history in Supabase
7. WHEN Manager responds, THE interface SHALL render actionable buttons (approve/reject tasks)

### Requirement 3: Agent Activity Stream

**User Story:** As a user, I want to see what each agent is doing, so that I can track development progress.

#### Acceptance Criteria

1. THE Activity Stream SHALL display real-time events from all agents
2. THE Activity Stream SHALL show: task claims, submissions, status changes
3. THE Activity Stream SHALL support filtering by agent or task
4. THE Activity Stream SHALL integrate with existing Activities section format
5. THE Activity Stream SHALL display git commits and file changes when available
6. THE Activity Stream SHALL be clickable to view task details

### Requirement 4: Task Management Panel

**User Story:** As a user, I want to view and manage tasks assigned to agents, so that I can track work progress.

#### Acceptance Criteria

1. THE Task Panel SHALL display all tasks with status (pending/assigned/in_progress/completed/failed)
2. THE Task Panel SHALL allow creating new tasks via the Manager
3. THE Task Panel SHALL support drag-and-drop assignment to agents
4. THE Task Panel SHALL show task dependencies and blockers
5. THE Task Panel SHALL integrate with Board section's Kanban layout
6. THE Task Panel SHALL display task results and outputs

### Requirement 5: Settings Configuration

**User Story:** As a user, I want to configure multi-agent settings, so that I can customize the environment.

#### Acceptance Criteria

1. THE Settings SHALL include a new "Multi-Agent" tab in the Settings page
2. THE Settings SHALL allow configuring MCP server connection (URL, token)
3. THE Settings SHALL display and manage trusted machines list
4. THE Settings SHALL allow configuring notification preferences for agent events
5. THE Settings SHALL support enabling/disabling the Agents section
6. THE Settings SHALL allow configuring LDAP integration parameters

### Requirement 6: Trust Management UI

**User Story:** As a user (Manager), I want to manage machine trust from the UI, so that I can control remote agent access.

#### Acceptance Criteria

1. THE Trust UI SHALL display all trusted machines with their trust levels
2. THE Trust UI SHALL allow adding new machines with trust configuration
3. THE Trust UI SHALL allow modifying trust levels and max agents
4. THE Trust UI SHALL allow removing machines (with confirmation)
5. THE Trust UI SHALL show machine status (online/offline) in real-time
6. THE Trust UI SHALL display agents per machine count

### Requirement 7: Board Section Integration

**User Story:** As a user, I want agent tasks to appear in the Board section, so that I can manage them alongside habits.

#### Acceptance Criteria

1. THE Board section SHALL include an "Agent Tasks" view toggle
2. THE Agent Tasks view SHALL display tasks in Kanban format (pending/in_progress/completed)
3. THE Agent Tasks view SHALL show assigned agent for each task
4. THE Agent Tasks view SHALL support filtering by project or spec
5. WHEN a task is completed, THE Board SHALL update in real-time
6. THE Agent Tasks view SHALL allow task creation via Board's add button

### Requirement 8: Activities Section Integration

**User Story:** As a user, I want to see agent activities in the Activities section, so that I have a unified activity view.

#### Acceptance Criteria

1. THE Activities section SHALL include agent events when enabled
2. THE Agent activities SHALL be visually distinguished (icon/color)
3. THE Activities section SHALL support filtering agent events on/off
4. THE Agent activities SHALL include: task started, task completed, agent registered
5. WHEN clicking an agent activity, THE UI SHALL navigate to agent details
6. THE Activities section SHALL aggregate agent events with habit activities

### Requirement 9: Real-time Communication

**User Story:** As a user, I want real-time updates without manual refresh, so that I can monitor live development.

#### Acceptance Criteria

1. THE System SHALL connect to MCP server's SSE endpoint for events
2. THE System SHALL handle connection drops and auto-reconnect
3. THE System SHALL display connection status indicator
4. THE System SHALL queue updates during offline periods
5. THE System SHALL support WebSocket fallback if SSE fails
6. THE System SHALL batch updates to avoid UI flickering

### Requirement 10: Mobile Responsiveness

**User Story:** As a user, I want to monitor agents from mobile, so that I can check progress on the go.

#### Acceptance Criteria

1. THE Agents section SHALL be fully responsive on mobile devices
2. THE Chat interface SHALL work on mobile with appropriate keyboard handling
3. THE Agent cards SHALL collapse to essential info on small screens
4. THE Settings SHALL be accessible and usable on mobile
5. THE Touch targets SHALL be at least 44x44px per design system
6. THE Mobile view SHALL support pull-to-refresh for manual updates

---

## New Requirements (v2.0)

### Requirement 11: tmux-Style Panel Split View

**User Story:** As a user, I want to see all agents in a tmux-style panel layout, so that I can monitor what each agent is doing simultaneously.

#### Acceptance Criteria

1. THE Panel View SHALL display agents in a configurable grid layout (e.g., 2x4, 3x3)
2. EACH Pane SHALL show the agent's name, role, status, and current activity
3. THE Pane content SHALL update in real-time as agents work
4. THE Pane SHALL display a scrollable log of recent agent actions
5. THE User SHALL be able to resize panes via drag handles
6. THE User SHALL be able to maximize a single pane to full view
7. THE Panel layout SHALL be saved to user preferences
8. ON Mobile, THE Panes SHALL stack vertically with swipe navigation

### Requirement 12: Instruction Flow Diagram

**User Story:** As a user, I want to see a visual diagram of which agents report to which, so that I understand the command hierarchy.

#### Acceptance Criteria

1. THE Flow Diagram SHALL display Manager -> Worker relationships
2. THE Diagram SHALL show directional arrows indicating instruction flow
3. THE Diagram SHALL highlight the currently active instruction paths
4. THE Diagram SHALL be interactive - clicking a node selects that agent
5. THE Diagram SHALL update in real-time when relationships change
6. THE Diagram SHALL support different layout modes (tree, radial, force-directed)
7. THE Diagram SHALL be collapsible to save screen space

### Requirement 13: AI Agent Activity Panel

**User Story:** As a user, I want to see a chronological activity feed of all agent interactions at the bottom of the screen.

#### Acceptance Criteria

1. THE Activity Panel SHALL be displayed at the bottom of the Agents section
2. THE Panel SHALL show timestamped entries for agent communications
3. EACH Entry SHALL display: timestamp, source agent, target agent, action type
4. THE Panel SHALL support filtering by agent or action type
5. THE Panel SHALL support expanding entries to see full message details
6. THE Panel SHALL auto-scroll to show new entries (with toggle)
7. THE Panel SHALL be resizable (height adjustable)
8. THE Panel SHALL be collapsible to hide when not needed

### Requirement 14: Agent Pane Tooltip

**User Story:** As a user, I want to see detailed task information when I hover over (or tap on mobile) an agent pane.

#### Acceptance Criteria

1. ON Desktop, THE Tooltip SHALL appear on mouse hover over an agent pane
2. ON Mobile, THE Tooltip SHALL appear on tap and dismiss on outside tap
3. THE Tooltip SHALL display current task title and description
4. THE Tooltip SHALL display task progress percentage (if available)
5. THE Tooltip SHALL display task start time and estimated completion
6. THE Tooltip SHALL display recent output/logs from the agent
7. THE Tooltip SHALL provide quick action buttons (pause, reassign, cancel)
8. THE Tooltip SHALL not overflow the viewport boundaries

### Requirement 15: Agent Task and Sticky'n Integration

**User Story:** As a user, I want agent tasks to appear as Sticky'n items under user-defined Habits, so that I can manage AI work alongside my personal tasks.

#### Acceptance Criteria

1. THE System SHALL allow linking agent tasks to existing Habits
2. WHEN linked, THE Agent task SHALL appear as a Sticky'n under that Habit
3. THE Sticky'n SHALL display agent name and task status
4. THE Sticky'n completion SHALL sync with agent task completion
5. THE User SHALL be able to unlink a task from a Habit
6. THE Board section SHALL show linked agent tasks within Habit cards
7. THE Stickies section SHALL display agent-linked stickies with special icon

### Requirement 16: Nested Sticky'n Support

**User Story:** As a user, I want to create Sticky'n items that contain other Sticky'n items, so that I can organize complex tasks hierarchically.

#### Acceptance Criteria

1. THE Sticky model SHALL support a parent_sticky_id field
2. THE UI SHALL allow creating child stickies under a parent sticky
3. THE Parent sticky SHALL display a count of child stickies
4. THE Parent sticky completion SHALL NOT auto-complete children
5. THE Child stickies SHALL be collapsible/expandable
6. THE Drag-drop SHALL support reordering and reparenting stickies
7. THE Nesting depth SHALL be limited to 3 levels for UX clarity
8. THE Indent visual SHALL clearly show hierarchy depth

---

## Non-Functional Requirements

### NFR-1: Performance
- Agent list should render within 100ms for up to 50 agents
- SSE events should be processed within 50ms
- Chat messages should appear within 200ms of sending
- Panel view should maintain 60fps during updates
- Tooltip should appear within 100ms of hover

### NFR-2: Security
- MCP server token should be stored securely (not in localStorage plain text)
- Trust operations should require confirmation
- LDAP credentials should never be exposed to frontend

### NFR-3: Accessibility
- All interactive elements should be keyboard navigable
- Screen reader support for agent status changes
- Color is not the only indicator for status
- Tooltips should be accessible via keyboard focus

### NFR-4: Reliability
- Graceful degradation when MCP server is unavailable
- Offline indicator with clear messaging
- Retry logic for failed API calls

### NFR-5: Scalability
- Panel view should handle up to 20 simultaneous panes
- Activity feed should handle 1000+ entries with virtualization
- Nested stickies should perform well up to 100 items per parent
