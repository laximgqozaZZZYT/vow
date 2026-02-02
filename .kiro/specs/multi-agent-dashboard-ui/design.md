# Design Document: Multi-Agent Dashboard UI

## Overview

VOWダッシュボードにマルチエージェント管理機能を統合します。既存のUIパターン（セクション、モーダル、ウィジェット）を踏襲しつつ、MCP Task Distributionサーバーとのリアルタイム連携を実現します。

## Architecture

### System Overview

```
+---------------------------------------------------------------------+
|                        VOW Frontend (Next.js)                        |
|  +-----------+  +-----------+  +-----------+  +----------+          |
|  |  Agents   |  |  Manager  |  |   Task    |  | Settings |          |
|  |  Section  |  |   Chat    |  |   Panel   |  |   Tab    |          |
|  +-----+-----+  +-----+-----+  +-----+-----+  +----+-----+          |
|        |              |              |              |                |
|  +-----+--------------+--------------+--------------+------+        |
|  |                    useAgentManager Hook                  |        |
|  |     (SSE Connection, State Management, API Calls)       |        |
|  +-----------------------------+----------------------------+        |
+--------------------------------|------------------------------------+
                                 |
                    +------------+------------+
                    |                         |
         +----------v----------+   +----------v--------+
         |   MCP Task Server   |   |     Supabase      |
         |  (localhost:3456)   |   |    (PostgreSQL)   |
         |                     |   |                   |
         |  - Agents API       |   |  - Chat History   |
         |  - Tasks API        |   |  - Settings       |
         |  - Trust API        |   |  - User Auth      |
         |  - SSE Events       |   |  - Stickies       |
         +---------------------+   +-------------------+
```

### Data Flow

```
+--------------------------------------------------------------------+
|                         Event Flow                                  |
|                                                                     |
|  MCP Server --SSE--> useAgentManager --State--> UI Components      |
|       ^                     |                        |              |
|       |                     v                        v              |
|       +----HTTP/REST--------+                   Supabase           |
|                                               (Persistence)         |
+--------------------------------------------------------------------+
```

---

## New Components (v2.0)

### 1. Panel Split View: View.AgentPanels.tsx

**Location:** `frontend/app/dashboard/components/View.AgentPanels.tsx`

```typescript
interface AgentPanelsProps {
  agents: Agent[];
  layout: PanelLayout;
  onLayoutChange: (layout: PanelLayout) => void;
  onAgentSelect: (agentId: string) => void;
}

interface PanelLayout {
  columns: number;
  rows: number;
  panes: PaneConfig[];
}

interface PaneConfig {
  agentId: string;
  position: { row: number; col: number };
  span: { rowSpan: number; colSpan: number };
  isMaximized: boolean;
}

// Component Structure
<View.AgentPanels>
  +-- <PanelToolbar>
  |   +-- <LayoutSelector />          // 2x2, 2x4, 3x3, etc.
  |   +-- <ViewModeToggle />          // panels/grid/list/kanban
  |   +-- <FullscreenButton />
  |
  +-- <PanelGrid layout={layout}>
  |   +-- {panes.map(pane => (
  |       <AgentPane key={pane.agentId}>
  |         +-- <PaneHeader>
  |         |   +-- <AgentBadge />    // role icon + name
  |         |   +-- <StatusDot />     // idle/busy/offline
  |         |   +-- <PaneControls />  // maximize, close
  |         |
  |         +-- <PaneContent>
  |         |   +-- <CurrentTaskInfo />
  |         |   +-- <ActivityLog />   // scrollable recent actions
  |         |
  |         +-- <PaneResizeHandle />
  |       </AgentPane>
  |     ))}
  |
  +-- <PanelActivityBar>              // Bottom activity stream
      +-- <ActivityStream />
</View.AgentPanels>
```

### 2. Agent Pane Component: Widget.AgentPane.tsx

**Location:** `frontend/app/dashboard/components/Widget.AgentPane.tsx`

```typescript
interface AgentPaneProps {
  agent: Agent;
  currentTask?: AgentTask;
  recentLogs: AgentLog[];
  isMaximized: boolean;
  onMaximize: () => void;
  onClose: () => void;
  showTooltip: boolean;
  onTooltipToggle: (show: boolean) => void;
}

interface AgentLog {
  id: string;
  timestamp: string;
  type: 'info' | 'action' | 'output' | 'error';
  message: string;
  details?: Record<string, unknown>;
}

// Visual Layout
+--------------------------------------------------+
| [icon] Agent-Name          [idle] [+] [x]        |  <- PaneHeader
+--------------------------------------------------+
| Current Task: Implement feature X                 |
| Status: In Progress (45%)                         |
| Started: 10:30 AM                                 |
+--------------------------------------------------+
| > 10:35 Reading file src/components/...          |  <- ActivityLog
| > 10:34 Analyzing requirements...                 |
| > 10:32 Task assigned by Manager                  |
| > 10:30 Agent started working                     |
+--------------------------------------------------+
```

### 3. Instruction Flow Diagram: Widget.InstructionFlow.tsx

**Location:** `frontend/app/dashboard/components/Widget.InstructionFlow.tsx`

```typescript
interface InstructionFlowProps {
  agents: Agent[];
  instructions: Instruction[];
  selectedAgentId?: string;
  onAgentSelect: (agentId: string) => void;
  layoutMode: 'tree' | 'radial' | 'force';
  onLayoutChange: (mode: 'tree' | 'radial' | 'force') => void;
}

interface Instruction {
  id: string;
  fromAgentId: string;    // Manager or parent agent
  toAgentId: string;      // Worker or child agent
  taskId?: string;
  status: 'pending' | 'active' | 'completed';
  createdAt: string;
}

// Layout Modes:
//
// Tree Layout:
//           [Manager]
//          /    |    \
//    [Dev-1] [Dev-2] [Tester]
//       |
//   [Reviewer]
//
// Radial Layout:
//              [Dev-1]
//            /
//   [Tester] -- [Manager] -- [Dev-2]
//            \
//              [Reviewer]
//
// Force-Directed Layout:
//   Interactive physics-based positioning

// Implementation using @xyflow/react (ReactFlow)
<Widget.InstructionFlow>
  +-- <FlowControls>
  |   +-- <LayoutToggle />          // tree/radial/force
  |   +-- <ZoomControls />
  |   +-- <FitViewButton />
  |   +-- <CollapseButton />
  |
  +-- <ReactFlow nodes={nodes} edges={edges}>
  |   +-- <Background />
  |   +-- <Controls />
  |   +-- <MiniMap />
  |
  +-- <FlowLegend>
      +-- [Active] [Pending] [Completed]
</Widget.InstructionFlow>
```

### 4. Agent Activity Panel: Widget.AgentActivityPanel.tsx

**Location:** `frontend/app/dashboard/components/Widget.AgentActivityPanel.tsx`

```typescript
interface AgentActivityPanelProps {
  activities: AgentInteraction[];
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  height: number;
  onHeightChange: (height: number) => void;
  filter: ActivityFilter;
  onFilterChange: (filter: ActivityFilter) => void;
}

interface AgentInteraction {
  id: string;
  timestamp: string;
  sourceAgentId: string;
  sourceAgentName: string;
  targetAgentId?: string;
  targetAgentName?: string;
  actionType: 'instruction' | 'report' | 'request' | 'response' | 'delegation';
  summary: string;
  fullMessage?: string;
  relatedTaskId?: string;
}

interface ActivityFilter {
  agents: string[];       // filter by agent IDs
  actionTypes: string[];  // filter by action type
  timeRange?: { start: string; end: string };
}

// Visual Layout
+==============================================================+
| Activities | [Filter v] | [Agent: All v] | [Auto-scroll: ON] |
+==============================================================+
| 10:45:23 | Manager -> Dev-1    | instruction | Implement...  |
| 10:44:15 | Dev-1 -> Manager    | report      | Completed...  |
| 10:43:02 | Manager -> Tester   | delegation  | Test the...   |
| 10:42:50 | Tester -> Manager   | request     | Need specs... |
| ... (virtualized list) ...                                    |
+--------------------------------------------------------------+
| [Resize Handle]                                               |
+--------------------------------------------------------------+
```

### 5. Agent Pane Tooltip: Widget.AgentTooltip.tsx

**Location:** `frontend/app/dashboard/components/Widget.AgentTooltip.tsx`

```typescript
interface AgentTooltipProps {
  agent: Agent;
  task?: AgentTask;
  recentLogs: AgentLog[];
  position: { x: number; y: number };
  onClose: () => void;
  onAction: (action: 'pause' | 'reassign' | 'cancel') => void;
}

// Visual Layout (positioned near cursor/tap)
+------------------------------------------+
| [icon] Agent-Name                   [x]  |
+------------------------------------------+
| Task: Implement Dashboard Feature        |
| Progress: ==========>     75%            |
| Started: 10:30 AM (15 min ago)           |
| Est. Completion: ~10 min                 |
+------------------------------------------+
| Recent Output:                           |
| > Reading component files...             |
| > Analyzing dependencies...              |
+------------------------------------------+
| [Pause] [Reassign] [Cancel]              |
+------------------------------------------+

// Positioning logic:
// - Detect viewport boundaries
// - Flip horizontally/vertically to stay in view
// - On mobile: center horizontally, position above/below tap
```

### 6. Nested Sticky'n: Updated Sticky Model and Components

**Database Migration:** `supabase/migrations/xxx_add_nested_stickies.sql`

```sql
-- Add parent_sticky_id for nesting support
ALTER TABLE stickies ADD COLUMN parent_sticky_id TEXT REFERENCES stickies(id) ON DELETE CASCADE;
ALTER TABLE stickies ADD COLUMN depth INTEGER DEFAULT 0;

-- Add agent task link
ALTER TABLE stickies ADD COLUMN agent_task_id TEXT;
ALTER TABLE stickies ADD COLUMN agent_id TEXT;

-- Index for efficient tree queries
CREATE INDEX idx_stickies_parent ON stickies(parent_sticky_id);
CREATE INDEX idx_stickies_agent_task ON stickies(agent_task_id);
```

**Updated Type:** `frontend/app/dashboard/types/index.ts`

```typescript
export interface Sticky {
  id: string;
  name: string;
  description?: string;
  completed: boolean;
  completedAt?: string;
  displayOrder: number;
  // NEW: Nesting support
  parentStickyId?: string | null;
  depth: number;  // 0, 1, 2, 3 (max 3 levels)
  childCount?: number;  // computed from children
  // NEW: Agent task integration
  agentTaskId?: string | null;
  agentId?: string | null;
  agentName?: string;
  taskStatus?: TaskStatus;
  // Existing relations
  tags?: Tag[];
  goals?: Goal[];
  habits?: Habit[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateStickyPayload {
  name: string;
  description?: string;
  displayOrder?: number;
  parentStickyId?: string;  // NEW
  agentTaskId?: string;     // NEW
  habitId?: string;         // NEW: Link to habit
}
```

**Component:** `Widget.NestedStickyItem.tsx`

```typescript
interface NestedStickyItemProps {
  sticky: Sticky;
  children?: Sticky[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onComplete: () => void;
  onDelete: () => void;
  onAddChild: () => void;
  onDragStart: (e: DragEvent) => void;
  onDrop: (e: DragEvent) => void;
  indent: number;  // 0, 1, 2, 3
}

// Visual Layout
<NestedStickyItem>
  +-- <div style={{ marginLeft: indent * 24 }}>
      +-- <ExpandToggle />            // if has children
      +-- <Checkbox />
      +-- <StickyContent>
      |   +-- <Title />
      |   +-- <AgentBadge />          // if linked to agent
      |   +-- <TaskStatus />          // if linked to agent task
      +-- <ChildCount />              // (3 subtasks)
      +-- <QuickActions />            // edit, add child, delete
  +-- {isExpanded && children.map(child => (
        <NestedStickyItem
          sticky={child}
          indent={indent + 1}
          ...
        />
      ))}
</NestedStickyItem>
```

---

## Existing Components (Retained from v1.0)

### 1. Section.Agents.tsx (Enhanced)

**Location:** `frontend/app/dashboard/components/Section.Agents.tsx`

```typescript
interface AgentsSectionProps {
  onAgentSelect: (agentId: string) => void;
  onOpenChat: () => void;
}

// Enhanced with new view modes
type AgentsViewMode = 'panels' | 'grid' | 'list' | 'kanban' | 'flow';

// Updated Layout
<Section.Agents>
  +-- <AgentsHeader>
  |   +-- <ConnectionStatus />
  |   +-- <AgentFilters />
  |   +-- <ViewModeToggle />        // NOW includes 'panels' and 'flow'
  |   +-- <ChatButton />
  |
  +-- <AgentsContent>
  |   +-- {viewMode === 'panels' && <View.AgentPanels />}    // NEW
  |   +-- {viewMode === 'grid' && <AgentGrid />}
  |   +-- {viewMode === 'list' && <AgentList />}
  |   +-- {viewMode === 'kanban' && <AgentKanban />}
  |   +-- {viewMode === 'flow' && <Widget.InstructionFlow />} // NEW
  |
  +-- <Widget.AgentActivityPanel />  // NEW: Bottom activity stream
</Section.Agents>
```

### 2. Widget.AgentCard.tsx (Enhanced)

Add tooltip trigger capability:

```typescript
interface AgentCardProps {
  agent: Agent;
  currentTask?: Task;
  variant?: 'default' | 'compact' | 'list' | 'pane';  // NEW: 'pane' variant
  onSelect: () => void;
  onAction: (action: AgentAction) => void;
  onHover?: (isHovering: boolean) => void;  // NEW: for tooltip
  onTap?: () => void;                        // NEW: for mobile tooltip
}
```

### 3. Modal.ManagerChat.tsx (Retained)

No structural changes, but add integration with new activity panel.

---

## Data Models

### New Supabase Tables

```sql
-- Agent Instructions (for flow diagram)
CREATE TABLE agent_instructions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  from_agent_id TEXT NOT NULL,
  to_agent_id TEXT NOT NULL,
  task_id TEXT,
  status TEXT CHECK (status IN ('pending', 'active', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Agent Interactions (for activity panel)
CREATE TABLE agent_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  source_agent_id TEXT NOT NULL,
  source_agent_name TEXT NOT NULL,
  target_agent_id TEXT,
  target_agent_name TEXT,
  action_type TEXT CHECK (action_type IN ('instruction', 'report', 'request', 'response', 'delegation')),
  summary TEXT NOT NULL,
  full_message TEXT,
  related_task_id TEXT
);

-- Agent Logs (for pane activity)
CREATE TABLE agent_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  agent_id TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  log_type TEXT CHECK (log_type IN ('info', 'action', 'output', 'error')),
  message TEXT NOT NULL,
  details JSONB DEFAULT '{}'
);

-- Panel Layout Preferences
CREATE TABLE agent_panel_layouts (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  columns INTEGER DEFAULT 2,
  rows INTEGER DEFAULT 2,
  panes JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE agent_instructions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_panel_layouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own their data" ON agent_instructions
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own their data" ON agent_interactions
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own their data" ON agent_logs
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own their data" ON agent_panel_layouts
  FOR ALL USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_agent_instructions_user ON agent_instructions(user_id);
CREATE INDEX idx_agent_interactions_user ON agent_interactions(user_id);
CREATE INDEX idx_agent_interactions_timestamp ON agent_interactions(timestamp DESC);
CREATE INDEX idx_agent_logs_agent ON agent_logs(agent_id);
CREATE INDEX idx_agent_logs_timestamp ON agent_logs(timestamp DESC);
```

### Updated Frontend Types

```typescript
// frontend/app/dashboard/types/agent.types.ts

// Existing types retained...

// NEW: Panel Layout
export interface PanelLayout {
  columns: number;
  rows: number;
  panes: PaneConfig[];
}

export interface PaneConfig {
  agentId: string;
  position: { row: number; col: number };
  span: { rowSpan: number; colSpan: number };
  isMaximized: boolean;
}

// NEW: Instruction for flow diagram
export interface Instruction {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  taskId?: string;
  status: 'pending' | 'active' | 'completed';
  createdAt: string;
  completedAt?: string;
}

// NEW: Agent Interaction for activity panel
export interface AgentInteraction {
  id: string;
  timestamp: string;
  sourceAgentId: string;
  sourceAgentName: string;
  targetAgentId?: string;
  targetAgentName?: string;
  actionType: 'instruction' | 'report' | 'request' | 'response' | 'delegation';
  summary: string;
  fullMessage?: string;
  relatedTaskId?: string;
}

// NEW: Agent Log for pane activity
export interface AgentLog {
  id: string;
  agentId: string;
  timestamp: string;
  type: 'info' | 'action' | 'output' | 'error';
  message: string;
  details?: Record<string, unknown>;
}
```

---

## Custom Hooks

### useAgentPanels Hook

**Location:** `frontend/app/dashboard/hooks/useAgentPanels.ts`

```typescript
interface UseAgentPanelsReturn {
  layout: PanelLayout;
  setLayout: (layout: PanelLayout) => void;
  saveLayout: () => Promise<void>;
  loadLayout: () => Promise<void>;

  maximizedPane: string | null;
  maximizePane: (agentId: string) => void;
  restorePane: () => void;

  addPane: (agentId: string) => void;
  removePane: (agentId: string) => void;
  swapPanes: (id1: string, id2: string) => void;
}

export function useAgentPanels(): UseAgentPanelsReturn;
```

### useAgentLogs Hook

**Location:** `frontend/app/dashboard/hooks/useAgentLogs.ts`

```typescript
interface UseAgentLogsReturn {
  logs: Record<string, AgentLog[]>;  // keyed by agentId
  isLoading: boolean;
  subscribe: (agentId: string) => () => void;
  getRecentLogs: (agentId: string, limit?: number) => AgentLog[];
}

export function useAgentLogs(): UseAgentLogsReturn;
```

### useInstructionFlow Hook

**Location:** `frontend/app/dashboard/hooks/useInstructionFlow.ts`

```typescript
interface UseInstructionFlowReturn {
  instructions: Instruction[];
  isLoading: boolean;

  // Graph representation for ReactFlow
  nodes: Node[];
  edges: Edge[];

  // Actions
  refresh: () => Promise<void>;
  getActiveInstructions: () => Instruction[];
}

export function useInstructionFlow(agents: Agent[]): UseInstructionFlowReturn;
```

### useAgentInteractions Hook

**Location:** `frontend/app/dashboard/hooks/useAgentInteractions.ts`

```typescript
interface UseAgentInteractionsReturn {
  interactions: AgentInteraction[];
  isLoading: boolean;
  hasMore: boolean;

  loadMore: () => Promise<void>;
  filter: (filter: ActivityFilter) => void;
  subscribe: () => () => void;  // SSE subscription
}

export function useAgentInteractions(): UseAgentInteractionsReturn;
```

### useNestedStickies Hook

**Location:** `frontend/app/dashboard/hooks/useNestedStickies.ts`

```typescript
interface UseNestedStickiesReturn {
  stickies: Sticky[];
  stickyTree: StickyTreeNode[];  // hierarchical structure
  isLoading: boolean;

  createSticky: (payload: CreateStickyPayload) => Promise<Sticky>;
  updateSticky: (id: string, updates: Partial<Sticky>) => Promise<void>;
  deleteSticky: (id: string) => Promise<void>;

  moveSticky: (id: string, newParentId: string | null, newOrder: number) => Promise<void>;
  linkToAgentTask: (stickyId: string, taskId: string, agentId: string) => Promise<void>;
  unlinkFromAgentTask: (stickyId: string) => Promise<void>;
}

interface StickyTreeNode {
  sticky: Sticky;
  children: StickyTreeNode[];
  isExpanded: boolean;
}

export function useNestedStickies(): UseNestedStickiesReturn;
```

---

## Visual Design

### Color Scheme (Extended)

```css
/* design-tokens.css additions */
:root {
  /* Existing agent colors */
  --agent-idle: var(--success);
  --agent-busy: var(--warning);
  --agent-offline: var(--neutral-400);

  /* NEW: Instruction status colors */
  --instruction-pending: var(--neutral-300);
  --instruction-active: var(--info);
  --instruction-completed: var(--success);

  /* NEW: Interaction type colors */
  --interaction-instruction: var(--purple-500);
  --interaction-report: var(--green-500);
  --interaction-request: var(--yellow-500);
  --interaction-response: var(--blue-500);
  --interaction-delegation: var(--orange-500);

  /* NEW: Pane styling */
  --pane-border: var(--border);
  --pane-header-bg: var(--muted);
  --pane-resize-handle: var(--primary);

  /* NEW: Nested sticky indent */
  --sticky-indent-width: 24px;
  --sticky-child-border: var(--primary-200);
}
```

### Interaction Type Icons

```typescript
const INTERACTION_ICONS: Record<AgentInteraction['actionType'], string> = {
  instruction: '->',  // or arrow icon
  report: '<-',       // or report icon
  request: '?',       // or question icon
  response: '!',      // or check icon
  delegation: '>>',   // or forward icon
};
```

---

## Mobile Considerations

### Panel View on Mobile

```
Desktop (2x3 grid):
+-------+-------+-------+
| Dev-1 | Dev-2 | Test  |
+-------+-------+-------+
| Rev   | DevOp | Arch  |
+-------+-------+-------+

Mobile (stacked with swipe):
+-------------------+
|      Dev-1        |  <- Swipe left/right
+-------------------+
| [1] [2] [3] [4] [5] [6] <- Pagination dots

- Full-width panes
- Horizontal swipe navigation
- Tap to maximize
- Bottom sheet for activity panel
```

### Tooltip on Mobile

```
- Tap pane to show tooltip
- Tooltip appears as bottom sheet on small screens
- Dismiss by tapping outside or X button
- Quick actions as large touch targets
```

---

## Testing Strategy

### Unit Tests

```typescript
// View.AgentPanels.test.tsx
describe('AgentPanels', () => {
  it('should render correct number of panes based on layout');
  it('should handle pane maximize/restore');
  it('should save layout changes');
  it('should resize panes via drag handle');
});

// Widget.InstructionFlow.test.tsx
describe('InstructionFlow', () => {
  it('should render manager-worker relationships');
  it('should highlight active instructions');
  it('should handle layout mode changes');
});

// Widget.AgentActivityPanel.test.tsx
describe('AgentActivityPanel', () => {
  it('should display interactions chronologically');
  it('should filter by agent');
  it('should expand to show full message');
  it('should virtualize long lists');
});

// useNestedStickies.test.ts
describe('useNestedStickies', () => {
  it('should build tree structure from flat list');
  it('should limit nesting to 3 levels');
  it('should handle parent-child completion independently');
});
```

### Integration Tests

```typescript
// agents-panels.integration.test.tsx
describe('Agent Panels Integration', () => {
  it('should update panes in real-time via SSE');
  it('should sync with instruction flow diagram');
  it('should link agent tasks to stickies');
});
```

---

## Dependencies

### New NPM Packages

```json
{
  "@xyflow/react": "^12.0.0",           // For instruction flow diagram
  "react-resizable-panels": "^2.0.0",   // For panel resizing
  "@tanstack/react-virtual": "^3.0.0"   // For virtualized activity list
}
```

---

## Migration Notes

1. **Supabase Migration**: Run new migration for nested stickies and agent tables
2. **SectionId Extension**: 'agents' already added
3. **View Mode Extension**: Add 'panels' and 'flow' to ViewMode type
4. **Sticky Type Update**: Add parentStickyId, depth, agentTaskId fields
5. **ReactFlow Integration**: Install and configure @xyflow/react
6. **Panel Resize**: Install react-resizable-panels for panel splitting
7. **Virtualization**: Install @tanstack/react-virtual for activity panel

---

## File Summary

### New Files

```
frontend/app/dashboard/components/
  - View.AgentPanels.tsx           # tmux-style panel layout
  - Widget.AgentPane.tsx           # Individual agent pane
  - Widget.InstructionFlow.tsx     # Flow diagram
  - Widget.AgentActivityPanel.tsx  # Bottom activity stream
  - Widget.AgentTooltip.tsx        # Hover/tap tooltip
  - Widget.NestedStickyItem.tsx    # Nested sticky display

frontend/app/dashboard/hooks/
  - useAgentPanels.ts              # Panel layout management
  - useAgentLogs.ts                # Agent log streaming
  - useInstructionFlow.ts          # Instruction graph data
  - useAgentInteractions.ts        # Activity panel data
  - useNestedStickies.ts           # Nested sticky operations

supabase/migrations/
  - xxx_add_agent_panels.sql       # Panel layout preferences
  - xxx_add_agent_instructions.sql # Instruction tracking
  - xxx_add_agent_interactions.sql # Activity logging
  - xxx_add_agent_logs.sql         # Pane activity logs
  - xxx_add_nested_stickies.sql    # Sticky nesting support
```

### Modified Files

```
frontend/app/dashboard/components/
  - Section.Agents.tsx             # Add 'panels' and 'flow' view modes
  - Widget.AgentCard.tsx           # Add 'pane' variant, tooltip triggers

frontend/app/dashboard/types/
  - agent.types.ts                 # Add new types
  - index.ts                       # Update Sticky interface

frontend/app/dashboard/mocks/
  - mockAgentData.ts               # Add mock data for new features
```
