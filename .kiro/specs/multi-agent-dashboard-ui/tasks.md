# Implementation Plan: Multi-Agent Dashboard UI

## Overview

VOWダッシュボードにマルチエージェント管理UI機能を実装します。フェーズごとに進め、各フェーズ終了時にユーザー確認を行います。

**バージョン:** 2.0 (新機能追加)
**最終更新:** 2026-01-31

---

## Phase 1: Foundation (基盤) - COMPLETED

### Database & Types

- [x] 1.1 Create Supabase migrations
  - [x] 1.1.1 Create `multi_agent_config` table
  - [x] 1.1.2 Create `agent_chat_sessions` table
  - [x] 1.1.3 Create `agent_chat_messages` table
  - [x] 1.1.4 Create `agent_activities` table
  - [x] 1.1.5 Add RLS policies

- [x] 1.2 Create TypeScript types
  - [x] 1.2.1 Create agent types (Agent, AgentRole, AgentStatus)
  - [x] 1.2.2 Create task types (Task, TaskStatus, TaskPriority)
  - [x] 1.2.3 Create trust types (TrustedMachine, TrustLevel, AuthMethod)
  - [x] 1.2.4 Create chat types (ChatSession, ChatMessage, ChatAction)
  - [x] 1.2.5 Create SSE event types (SSEEvent, SSEEventType)

- [x] 1.3 Create MCP API client
  - [x] 1.3.1 Create base client class
  - [x] 1.3.2 Add agents API methods
  - [x] 1.3.3 Add tasks API methods
  - [x] 1.3.4 Add trust API methods
  - [x] 1.3.5 Add SSE connection method

---

## Phase 2-10: Original Tasks (参照用)

> 既存タスク (Phase 2-10) は省略。詳細は git history を参照。
> 以下は v2.0 で追加された新タスクです。

---

## Phase 11: Panel Split View (tmux風パネル)

**Assignable to:** Frontend Agent A
**Prerequisites:** Phase 1, 4 completed

### 11.1 Core Panel Infrastructure

- [ ] 11.1.1 Install react-resizable-panels
  - Command: `npm install react-resizable-panels`
  - File: `frontend/package.json`
  - _Requirements: 11.1_

- [ ] 11.1.2 Create PanelLayout types
  - File: `frontend/app/dashboard/types/agent.types.ts`
  - Types: PanelLayout, PaneConfig
  - _Requirements: 11.1, 11.7_

- [ ] 11.1.3 Create useAgentPanels hook
  - File: `frontend/app/dashboard/hooks/useAgentPanels.ts`
  - Functions: layout state, save/load, maximize/restore
  - _Requirements: 11.5, 11.6, 11.7_

- [ ] 11.1.4 Create Supabase migration for panel layouts
  - File: `supabase/migrations/xxx_add_agent_panel_layouts.sql`
  - Table: agent_panel_layouts (user preferences)
  - _Requirements: 11.7_

### 11.2 Panel View Component

- [ ] 11.2.1 Create View.AgentPanels component
  - File: `frontend/app/dashboard/components/View.AgentPanels.tsx`
  - Grid layout with configurable columns/rows
  - _Requirements: 11.1, 11.2_

- [ ] 11.2.2 Create PanelToolbar component
  - Layout selector (2x2, 2x4, 3x3, etc.)
  - Fullscreen button
  - _Requirements: 11.1_

- [ ] 11.2.3 Create PanelGrid component
  - CSS Grid based layout
  - Resize handles between panes
  - _Requirements: 11.1, 11.5_

### 11.3 Agent Pane Component

- [ ] 11.3.1 Create Widget.AgentPane component
  - File: `frontend/app/dashboard/components/Widget.AgentPane.tsx`
  - Header with agent info, status, controls
  - _Requirements: 11.2_

- [ ] 11.3.2 Create PaneContent component
  - Current task info display
  - Scrollable activity log
  - _Requirements: 11.3, 11.4_

- [ ] 11.3.3 Create PaneControls component
  - Maximize/minimize buttons
  - Close button
  - _Requirements: 11.6_

- [ ] 11.3.4 Implement pane resize via drag
  - Drag handle component
  - Resize logic with limits
  - _Requirements: 11.5_

### 11.4 Mobile Panel Support

- [ ] 11.4.1 Create mobile swipe navigation
  - Horizontal swipe between panes
  - Pagination dots indicator
  - _Requirements: 11.8_

- [ ] 11.4.2 Create mobile panel layout
  - Stack vertically
  - Full-width panes
  - _Requirements: 11.8_

### 11.5 Checkpoint - Panel View Review

- [ ] Test panel layout rendering
- [ ] Test resize functionality
- [ ] Test maximize/restore
- [ ] Test mobile swipe
- [ ] Test layout persistence

---

## Phase 12: Instruction Flow Diagram (指示フロー図)

**Assignable to:** Frontend Agent B
**Prerequisites:** Phase 1, 4 completed

### 12.1 ReactFlow Setup

- [ ] 12.1.1 Install @xyflow/react
  - Command: `npm install @xyflow/react`
  - File: `frontend/package.json`
  - _Requirements: 12.1_

- [ ] 12.1.2 Create Instruction types
  - File: `frontend/app/dashboard/types/agent.types.ts`
  - Type: Instruction (fromAgentId, toAgentId, status)
  - _Requirements: 12.1, 12.2_

- [ ] 12.1.3 Create Supabase migration for instructions
  - File: `supabase/migrations/xxx_add_agent_instructions.sql`
  - Table: agent_instructions
  - _Requirements: 12.5_

### 12.2 Flow Hook

- [ ] 12.2.1 Create useInstructionFlow hook
  - File: `frontend/app/dashboard/hooks/useInstructionFlow.ts`
  - Convert agents/instructions to ReactFlow nodes/edges
  - _Requirements: 12.1, 12.5_

- [ ] 12.2.2 Implement tree layout algorithm
  - Manager at top, workers below
  - _Requirements: 12.6_

- [ ] 12.2.3 Implement radial layout algorithm
  - Manager at center, workers around
  - _Requirements: 12.6_

- [ ] 12.2.4 Implement force-directed layout
  - Physics-based auto-positioning
  - _Requirements: 12.6_

### 12.3 Flow Component

- [ ] 12.3.1 Create Widget.InstructionFlow component
  - File: `frontend/app/dashboard/components/Widget.InstructionFlow.tsx`
  - ReactFlow integration
  - _Requirements: 12.1, 12.2_

- [ ] 12.3.2 Create custom AgentNode component
  - Role icon, name, status indicator
  - Click to select agent
  - _Requirements: 12.4_

- [ ] 12.3.3 Create custom InstructionEdge component
  - Directional arrow
  - Active/pending/completed styling
  - _Requirements: 12.2, 12.3_

- [ ] 12.3.4 Create FlowControls component
  - Layout mode toggle
  - Zoom controls
  - Fit view button
  - _Requirements: 12.6_

- [ ] 12.3.5 Create FlowLegend component
  - Status color legend
  - _Requirements: 12.3_

- [ ] 12.3.6 Add collapse/expand functionality
  - Save screen space when not needed
  - _Requirements: 12.7_

### 12.4 Checkpoint - Flow Diagram Review

- [ ] Test manager-worker relationship display
- [ ] Test layout mode switching
- [ ] Test active instruction highlighting
- [ ] Test node click selection

---

## Phase 13: AI Agent Activity Panel (アクティビティパネル)

**Assignable to:** Frontend Agent C
**Prerequisites:** Phase 1, 4 completed

### 13.1 Activity Data Infrastructure

- [ ] 13.1.1 Create AgentInteraction types
  - File: `frontend/app/dashboard/types/agent.types.ts`
  - Type: AgentInteraction, ActivityFilter
  - _Requirements: 13.2, 13.3_

- [ ] 13.1.2 Create Supabase migration for interactions
  - File: `supabase/migrations/xxx_add_agent_interactions.sql`
  - Table: agent_interactions
  - _Requirements: 13.2_

- [ ] 13.1.3 Create useAgentInteractions hook
  - File: `frontend/app/dashboard/hooks/useAgentInteractions.ts`
  - Pagination, filtering, SSE subscription
  - _Requirements: 13.4, 13.6_

### 13.2 Activity Panel Component

- [ ] 13.2.1 Install @tanstack/react-virtual
  - Command: `npm install @tanstack/react-virtual`
  - For virtualized list performance
  - _Requirements: NFR-5_

- [ ] 13.2.2 Create Widget.AgentActivityPanel component
  - File: `frontend/app/dashboard/components/Widget.AgentActivityPanel.tsx`
  - Bottom panel layout
  - _Requirements: 13.1_

- [ ] 13.2.3 Create ActivityEntry component
  - Timestamp, source, target, action display
  - Expandable details
  - _Requirements: 13.2, 13.3, 13.5_

- [ ] 13.2.4 Create ActivityFilter component
  - Agent filter dropdown
  - Action type filter
  - _Requirements: 13.4_

- [ ] 13.2.5 Implement auto-scroll toggle
  - Auto-scroll to new entries
  - Toggle button
  - _Requirements: 13.6_

- [ ] 13.2.6 Implement resize handle
  - Adjustable panel height
  - _Requirements: 13.7_

- [ ] 13.2.7 Implement collapse toggle
  - Hide panel when not needed
  - _Requirements: 13.8_

- [ ] 13.2.8 Implement virtualized list
  - Handle 1000+ entries efficiently
  - _Requirements: NFR-5_

### 13.3 Checkpoint - Activity Panel Review

- [ ] Test chronological display
- [ ] Test filtering
- [ ] Test expand/collapse entries
- [ ] Test virtualization performance
- [ ] Test resize and collapse

---

## Phase 14: Agent Pane Tooltip (ツールチップ)

**Assignable to:** Frontend Agent A (after Phase 11)
**Prerequisites:** Phase 11 completed

### 14.1 Tooltip Component

- [ ] 14.1.1 Create Widget.AgentTooltip component
  - File: `frontend/app/dashboard/components/Widget.AgentTooltip.tsx`
  - Positioned popover
  - _Requirements: 14.1, 14.2_

- [ ] 14.1.2 Create TooltipContent component
  - Task title, description, progress
  - Start time, estimated completion
  - _Requirements: 14.3, 14.4, 14.5_

- [ ] 14.1.3 Create TooltipLogs component
  - Recent output/logs display
  - _Requirements: 14.6_

- [ ] 14.1.4 Create TooltipActions component
  - Pause, Reassign, Cancel buttons
  - _Requirements: 14.7_

### 14.2 Tooltip Positioning

- [ ] 14.2.1 Implement viewport boundary detection
  - Flip horizontally/vertically as needed
  - _Requirements: 14.8_

- [ ] 14.2.2 Implement mobile bottom sheet mode
  - Full-width bottom sheet on small screens
  - _Requirements: 14.2_

### 14.3 Integration

- [ ] 14.3.1 Add hover trigger to Widget.AgentPane
  - Mouse enter/leave handlers
  - _Requirements: 14.1_

- [ ] 14.3.2 Add tap trigger for mobile
  - Touch event handling
  - Dismiss on outside tap
  - _Requirements: 14.2_

### 14.4 Checkpoint - Tooltip Review

- [ ] Test hover on desktop
- [ ] Test tap on mobile
- [ ] Test positioning near edges
- [ ] Test action buttons

---

## Phase 15: Agent Task and Sticky'n Integration (タスク連携)

**Assignable to:** Frontend Agent D
**Prerequisites:** Phase 1, 4, existing Stickies feature

### 15.1 Sticky Model Extension

- [ ] 15.1.1 Create Supabase migration for agent-sticky link
  - File: `supabase/migrations/xxx_add_sticky_agent_link.sql`
  - Columns: agent_task_id, agent_id on stickies table
  - _Requirements: 15.1_

- [ ] 15.1.2 Update Sticky type
  - File: `frontend/app/dashboard/types/index.ts`
  - Add: agentTaskId, agentId, agentName, taskStatus
  - _Requirements: 15.2, 15.3_

### 15.2 Linking Logic

- [ ] 15.2.1 Create linkToAgentTask API
  - Backend route for linking task to sticky
  - _Requirements: 15.1, 15.2_

- [ ] 15.2.2 Create unlinkFromAgentTask API
  - Backend route for unlinking
  - _Requirements: 15.5_

- [ ] 15.2.3 Implement sync logic
  - When agent task completes, update sticky
  - _Requirements: 15.4_

### 15.3 UI Updates

- [ ] 15.3.1 Add agent badge to Sticky component
  - Display agent name on linked stickies
  - _Requirements: 15.3_

- [ ] 15.3.2 Add link/unlink action to sticky menu
  - Dropdown menu option
  - _Requirements: 15.1, 15.5_

- [ ] 15.3.3 Update Board section
  - Show agent stickies in Habit cards
  - _Requirements: 15.6_

- [ ] 15.3.4 Update Stickies section
  - Special icon for agent-linked stickies
  - _Requirements: 15.7_

### 15.4 Checkpoint - Sticky Integration Review

- [ ] Test linking task to habit
- [ ] Test sticky appearance
- [ ] Test completion sync
- [ ] Test unlinking

---

## Phase 16: Nested Sticky'n Support (ネストSticky'n)

**Assignable to:** Frontend Agent E
**Prerequisites:** Phase 15 completed

### 16.1 Database Changes

- [ ] 16.1.1 Create Supabase migration for nested stickies
  - File: `supabase/migrations/xxx_add_nested_stickies.sql`
  - Columns: parent_sticky_id, depth
  - Index: idx_stickies_parent
  - _Requirements: 16.1_

### 16.2 Nested Stickies Hook

- [ ] 16.2.1 Create useNestedStickies hook
  - File: `frontend/app/dashboard/hooks/useNestedStickies.ts`
  - Build tree structure from flat list
  - _Requirements: 16.1, 16.2_

- [ ] 16.2.2 Implement depth limit validation
  - Max 3 levels of nesting
  - _Requirements: 16.7_

- [ ] 16.2.3 Implement move/reparent logic
  - Update parent_sticky_id and depth
  - _Requirements: 16.6_

### 16.3 Nested Sticky Component

- [ ] 16.3.1 Create Widget.NestedStickyItem component
  - File: `frontend/app/dashboard/components/Widget.NestedStickyItem.tsx`
  - Recursive rendering with indent
  - _Requirements: 16.2, 16.8_

- [ ] 16.3.2 Create expand/collapse toggle
  - Show/hide children
  - _Requirements: 16.5_

- [ ] 16.3.3 Display child count badge
  - "(3 subtasks)" indicator
  - _Requirements: 16.3_

- [ ] 16.3.4 Implement add child action
  - Quick add button
  - _Requirements: 16.2_

### 16.4 Drag and Drop

- [ ] 16.4.1 Implement drag-drop for reordering
  - Within same level
  - _Requirements: 16.6_

- [ ] 16.4.2 Implement drag-drop for reparenting
  - Move to different parent
  - Validate depth limit
  - _Requirements: 16.6, 16.7_

### 16.5 Completion Logic

- [ ] 16.5.1 Implement independent completion
  - Parent completion does NOT auto-complete children
  - _Requirements: 16.4_

### 16.6 Checkpoint - Nested Stickies Review

- [ ] Test create child sticky
- [ ] Test expand/collapse
- [ ] Test drag reorder
- [ ] Test drag reparent
- [ ] Test depth limit (3 levels)
- [ ] Test completion independence

---

## Phase 17: Section Integration (セクション統合)

**Assignable to:** Frontend Agent A, B, or C
**Prerequisites:** Phases 11-16 completed

### 17.1 Update Section.Agents

- [ ] 17.1.1 Add 'panels' view mode
  - Integrate View.AgentPanels
  - _Requirements: 11.1_

- [ ] 17.1.2 Add 'flow' view mode
  - Integrate Widget.InstructionFlow
  - _Requirements: 12.1_

- [ ] 17.1.3 Add activity panel to bottom
  - Integrate Widget.AgentActivityPanel
  - _Requirements: 13.1_

- [ ] 17.1.4 Update ViewModeToggle
  - Add panels and flow icons
  - _Requirements: 11.1, 12.1_

### 17.2 Mock Data Updates

- [ ] 17.2.1 Add mock data for instructions
  - File: `frontend/app/dashboard/mocks/mockAgentData.ts`
  - MOCK_INSTRUCTIONS constant
  - _Requirements: 12.1_

- [ ] 17.2.2 Add mock data for interactions
  - MOCK_INTERACTIONS constant
  - _Requirements: 13.2_

- [ ] 17.2.3 Add mock data for agent logs
  - MOCK_AGENT_LOGS constant
  - _Requirements: 11.4_

### 17.3 Checkpoint - Integration Review

- [ ] Test view mode switching
- [ ] Test all views render correctly
- [ ] Test activity panel integration

---

## Phase 18: Mobile Optimization (モバイル最適化)

**Assignable to:** Frontend Agent F
**Prerequisites:** Phases 11-17 completed

### 18.1 Panel View Mobile

- [ ] 18.1.1 Implement swipe navigation
  - _Requirements: 11.8_

- [ ] 18.1.2 Test touch gestures
  - _Requirements: 10.5_

### 18.2 Tooltip Mobile

- [ ] 18.2.1 Implement bottom sheet mode
  - _Requirements: 14.2_

- [ ] 18.2.2 Test tap-to-show behavior
  - _Requirements: 14.2_

### 18.3 Activity Panel Mobile

- [ ] 18.3.1 Implement collapsible bottom sheet
  - _Requirements: 13.8_

- [ ] 18.3.2 Test scroll performance
  - _Requirements: NFR-5_

### 18.4 Checkpoint - Mobile Review

- [ ] Test all features on mobile viewport
- [ ] Test touch targets (44x44px minimum)
- [ ] Test swipe gestures
- [ ] Test bottom sheet behavior

---

## Phase 19: Testing (テスト)

**Assignable to:** Testing Agent
**Prerequisites:** All implementation phases completed

### 19.1 Unit Tests

- [ ] 19.1.1 View.AgentPanels.test.tsx
- [ ] 19.1.2 Widget.AgentPane.test.tsx
- [ ] 19.1.3 Widget.InstructionFlow.test.tsx
- [ ] 19.1.4 Widget.AgentActivityPanel.test.tsx
- [ ] 19.1.5 Widget.AgentTooltip.test.tsx
- [ ] 19.1.6 Widget.NestedStickyItem.test.tsx
- [ ] 19.1.7 useAgentPanels.test.ts
- [ ] 19.1.8 useInstructionFlow.test.ts
- [ ] 19.1.9 useAgentInteractions.test.ts
- [ ] 19.1.10 useNestedStickies.test.ts

### 19.2 Integration Tests

- [ ] 19.2.1 agents-panels.integration.test.tsx
- [ ] 19.2.2 instruction-flow.integration.test.tsx
- [ ] 19.2.3 nested-stickies.integration.test.tsx

### 19.3 Checkpoint - Testing Review

- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] Coverage meets minimum threshold

---

## Phase 20: Documentation (ドキュメント)

**Assignable to:** Documentation Agent
**Prerequisites:** All implementation and testing complete

- [ ] 20.1 Update CLAUDE.md
  - Add Panel View section
  - Add Flow Diagram section
  - Add Activity Panel section
  - Add Nested Stickies section

- [ ] 20.2 Update component JSDoc
  - All new components documented

- [ ] 20.3 Update type definitions
  - All new types documented

---

## Task Dependencies Graph

```
Phase 1 (Foundation) - COMPLETED
    |
    +-- Phase 4 (Agents Section) - COMPLETED
    |       |
    |       +-- Phase 11 (Panel Split View)
    |       |       |
    |       |       +-- Phase 14 (Tooltip)
    |       |
    |       +-- Phase 12 (Instruction Flow)
    |       |
    |       +-- Phase 13 (Activity Panel)
    |
    +-- Phase 15 (Sticky Integration)
            |
            +-- Phase 16 (Nested Stickies)

Phase 11, 12, 13, 14, 15, 16 --> Phase 17 (Section Integration)
                                     |
                                     +-- Phase 18 (Mobile)
                                     |
                                     +-- Phase 19 (Testing)
                                     |
                                     +-- Phase 20 (Documentation)
```

---

## Parallel Work Assignment

以下のタスクは並列で作業可能です：

| Agent | Phase | Description |
|-------|-------|-------------|
| Frontend A | 11 | Panel Split View |
| Frontend B | 12 | Instruction Flow |
| Frontend C | 13 | Activity Panel |
| Frontend D | 15 | Sticky Integration |
| Frontend E | 16* | Nested Stickies (*after 15) |
| Frontend A | 14* | Tooltip (*after 11) |
| Frontend F | 18* | Mobile (*after 17) |
| Testing | 19* | Testing (*after all impl) |
| Documentation | 20* | Docs (*after 19) |

---

## File Creation Summary

### New Frontend Components

```
frontend/app/dashboard/components/
  - View.AgentPanels.tsx              # Phase 11
  - Widget.AgentPane.tsx              # Phase 11
  - Widget.InstructionFlow.tsx        # Phase 12
  - Widget.AgentActivityPanel.tsx     # Phase 13
  - Widget.AgentTooltip.tsx           # Phase 14
  - Widget.NestedStickyItem.tsx       # Phase 16
```

### New Frontend Hooks

```
frontend/app/dashboard/hooks/
  - useAgentPanels.ts                 # Phase 11
  - useAgentLogs.ts                   # Phase 11
  - useInstructionFlow.ts             # Phase 12
  - useAgentInteractions.ts           # Phase 13
  - useNestedStickies.ts              # Phase 16
```

### New Supabase Migrations

```
supabase/migrations/
  - YYYYMMDD_add_agent_panel_layouts.sql    # Phase 11
  - YYYYMMDD_add_agent_instructions.sql     # Phase 12
  - YYYYMMDD_add_agent_interactions.sql     # Phase 13
  - YYYYMMDD_add_agent_logs.sql             # Phase 11
  - YYYYMMDD_add_sticky_agent_link.sql      # Phase 15
  - YYYYMMDD_add_nested_stickies.sql        # Phase 16
```

### Modified Files

```
frontend/app/dashboard/components/
  - Section.Agents.tsx                # Phase 17

frontend/app/dashboard/types/
  - agent.types.ts                    # Phases 11, 12, 13
  - index.ts                          # Phases 15, 16

frontend/app/dashboard/mocks/
  - mockAgentData.ts                  # Phase 17
```

---

## Notes

- 各 Phase の Checkpoint で必ずユーザー確認を行う
- 既存の VOW デザインパターン（components, hooks, styles）を踏襲する
- デザインシステムのトークン（`.kiro/steering/design-system.md`）を使用する
- 新機能は MOC (Mock Object) モードでの動作を最初に確認する
