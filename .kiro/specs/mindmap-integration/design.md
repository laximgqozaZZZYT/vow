# Design Document: Mindmap Integration

## Overview

This design integrates mindmap functionality into the existing dashboard system, allowing users to create visual mindmaps and convert content between mindmaps and Goals/Habits. The implementation follows the established patterns in the codebase, including database schema conventions, API structure, and React component architecture.

## Architecture

### Database Schema

The mindmap feature extends the existing database with three new tables following the established `owner_type`/`owner_id` pattern:

```sql
-- Mindmap table
CREATE TABLE IF NOT EXISTS mindmaps (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    description TEXT,
    owner_type TEXT,
    owner_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- MindmapNode table
CREATE TABLE IF NOT EXISTS mindmap_nodes (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    mindmap_id TEXT NOT NULL REFERENCES mindmaps(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    x FLOAT NOT NULL,
    y FLOAT NOT NULL,
    width FLOAT DEFAULT 120,
    height FLOAT DEFAULT 60,
    color TEXT DEFAULT '#ffffff',
    goal_id TEXT REFERENCES goals(id) ON DELETE SET NULL,
    habit_id TEXT REFERENCES habits(id) ON DELETE SET NULL,
    owner_type TEXT,
    owner_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- MindmapConnection table
CREATE TABLE IF NOT EXISTS mindmap_connections (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    mindmap_id TEXT NOT NULL REFERENCES mindmaps(id) ON DELETE CASCADE,
    from_node_id TEXT NOT NULL REFERENCES mindmap_nodes(id) ON DELETE CASCADE,
    to_node_id TEXT NOT NULL REFERENCES mindmap_nodes(id) ON DELETE CASCADE,
    owner_type TEXT,
    owner_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### API Endpoints

Following the existing RESTful API pattern:

- `GET /mindmaps` - Get all mindmaps for the user
- `POST /mindmaps` - Create a new mindmap
- `PATCH /mindmaps/:id` - Update mindmap metadata
- `DELETE /mindmaps/:id` - Delete mindmap and all related nodes/connections
- `GET /mindmaps/:id/nodes` - Get all nodes for a mindmap
- `POST /mindmaps/:id/nodes` - Create a new node
- `PATCH /mindmap-nodes/:id` - Update node position/text/properties
- `DELETE /mindmap-nodes/:id` - Delete node and related connections
- `GET /mindmaps/:id/connections` - Get all connections for a mindmap
- `POST /mindmaps/:id/connections` - Create a new connection
- `DELETE /mindmap-connections/:id` - Delete connection

## Components and Interfaces

### Type Definitions

```typescript
// Extend existing types/index.ts
export interface Mindmap {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MindmapNode {
  id: string;
  mindmapId: string;
  text: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  color?: string;
  goalId?: string | null;
  habitId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MindmapConnection {
  id: string;
  mindmapId: string;
  fromNodeId: string;
  toNodeId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMindmapPayload {
  name: string;
  description?: string;
}

export interface CreateMindmapNodePayload {
  text: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  color?: string;
}

export interface CreateMindmapConnectionPayload {
  fromNodeId: string;
  toNodeId: string;
}
```

### Component Architecture

#### Modal.Mindmap.tsx
Modal component for creating and editing mindmap metadata, following the pattern of `Modal.Goal.tsx` and `Modal.Habit.tsx`.

```typescript
interface MindmapModalProps {
  open: boolean;
  onClose: () => void;
  mindmap: Mindmap | null;
  onUpdate?: (mindmap: Mindmap) => void;
  onDelete?: (id: string) => void;
  onCreate?: (payload: CreateMindmapPayload) => void;
}
```

#### MindmapEditor.tsx
Full-screen editor component for editing mindmap content with canvas-based interaction.

```typescript
interface MindmapEditorProps {
  mindmap: Mindmap;
  nodes: MindmapNode[];
  connections: MindmapConnection[];
  onNodeUpdate: (nodeId: string, updates: Partial<MindmapNode>) => void;
  onNodeCreate: (payload: CreateMindmapNodePayload) => void;
  onNodeDelete: (nodeId: string) => void;
  onConnectionCreate: (payload: CreateMindmapConnectionPayload) => void;
  onConnectionDelete: (connectionId: string) => void;
  onClose: () => void;
  goals: Goal[];
  habits: Habit[];
  onCreateGoal: (payload: CreateGoalPayload) => void;
  onCreateHabit: (payload: CreateHabitPayload) => void;
}
```

#### Widget.MindmapList.tsx
Sidebar widget for displaying and managing mindmaps, integrated into the existing sidebar.

```typescript
interface MindmapListProps {
  mindmaps: Mindmap[];
  onMindmapSelect: (mindmapId: string) => void;
  onMindmapEdit: (mindmapId: string) => void;
  onMindmapDelete: (mindmapId: string) => void;
}
```

### Hook Integration

#### useMindmapManager.ts
Custom hook for managing mindmap state and operations, following the pattern of `useGoalManager.ts`.

```typescript
export function useMindmapManager({
  mindmaps,
  setMindmaps,
  nodes,
  setNodes,
  connections,
  setConnections
}: {
  mindmaps: Mindmap[];
  setMindmaps: (mindmaps: Mindmap[]) => void;
  nodes: MindmapNode[];
  setNodes: (nodes: MindmapNode[]) => void;
  connections: MindmapConnection[];
  setConnections: (connections: MindmapConnection[]) => void;
}) {
  // Mindmap CRUD operations
  // Node management
  // Connection management
  // Goal/Habit integration
}
```

#### Extended useDataManager.ts
Add mindmap data management to the existing `useDataManager` hook:

```typescript
// Add to existing useDataManager
const [mindmaps, setMindmaps] = useState<Mindmap[]>([]);
const [mindmapNodes, setMindmapNodes] = useState<MindmapNode[]>([]);
const [mindmapConnections, setMindmapConnections] = useState<MindmapConnection[]>([]);

// Load mindmap data in loadData function
const mindmapsData = await api.getMindmaps();
setMindmaps(mindmapsData || []);
```

#### Extended useModalManager.ts
Add mindmap modal state management:

```typescript
// Add to existing useModalManager
const [openMindmapModal, setOpenMindmapModal] = useState(false);
const [openMindmapEditor, setOpenMindmapEditor] = useState(false);
const [editingMindmapId, setEditingMindmapId] = useState<string | null>(null);
```

## Data Models

### Mindmap Entity
- **id**: Unique identifier
- **name**: User-defined name for the mindmap
- **description**: Optional description
- **owner_type/owner_id**: User ownership following existing pattern
- **created_at/updated_at**: Timestamps

### MindmapNode Entity
- **id**: Unique identifier
- **mindmap_id**: Foreign key to parent mindmap
- **text**: Node content text
- **x, y**: Canvas coordinates for positioning
- **width, height**: Node dimensions (optional, defaults provided)
- **color**: Node background color (optional)
- **goal_id/habit_id**: Optional foreign keys for linked Goals/Habits
- **owner_type/owner_id**: User ownership
- **created_at/updated_at**: Timestamps

### MindmapConnection Entity
- **id**: Unique identifier
- **mindmap_id**: Foreign key to parent mindmap
- **from_node_id/to_node_id**: Foreign keys to connected nodes
- **owner_type/owner_id**: User ownership
- **created_at/updated_at**: Timestamps

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property-Based Testing Properties

Based on the requirements analysis, the following properties must hold for all valid system executions:

**Property 1: Modal Opening**
*For any* user interaction with the "New Map" button, the system should open the mindmap creation modal
**Validates: Requirements 1.1**

**Property 2: Mindmap Creation**
*For any* valid mindmap creation payload, the system should create a database record with unique id and proper ownership
**Validates: Requirements 1.2**

**Property 3: Data Loading**
*For any* existing mindmap with nodes and connections, opening the editor should load all related data correctly
**Validates: Requirements 1.4**

**Property 4: Ownership Consistency**
*For any* created mindmap, it should use the same owner_type and owner_id pattern as Goals and Habits
**Validates: Requirements 1.5**

**Property 5: Node Creation by Position**
*For any* double-click coordinates in the editor, a new node should be created at those exact coordinates
**Validates: Requirements 2.1**

**Property 6: Node Edit Mode**
*For any* existing node, double-clicking should enable text editing mode for that specific node
**Validates: Requirements 2.2**

**Property 7: Node Position Updates**
*For any* node drag operation, the node's x and y coordinates should be updated and connections redrawn
**Validates: Requirements 2.3**

**Property 8: Connection Creation**
*For any* two nodes, connecting them should create a MindmapConnection record with correct node references
**Validates: Requirements 2.4**

**Property 9: Zoom and Pan Functionality**
*For any* zoom or pan operation, the editor should maintain correct coordinate mapping and visual consistency
**Validates: Requirements 2.5**

**Property 10: Area Selection**
*For any* drag selection area, all nodes within the geometric bounds should be highlighted
**Validates: Requirements 3.1**

**Property 11: Context Menu Display**
*For any* right-click on selected nodes, the context menu should show "Create Goal" and "Create Habit" options
**Validates: Requirements 3.2**

**Property 12: Goal Modal Pre-filling**
*For any* selected nodes, choosing "Create Goal" should open Modal.Goal with concatenated node text as name
**Validates: Requirements 3.3**

**Property 13: Habit Modal Pre-filling**
*For any* selected nodes, choosing "Create Habit" should open Modal.Habit with concatenated node text as name
**Validates: Requirements 3.4**

**Property 14: Source Node References**
*For any* Goal or Habit created from mindmap nodes, the created entity should store references to source node ids
**Validates: Requirements 3.5**

**Property 15: Goal Export Context Menu**
*For any* Goal in the dashboard, right-clicking should show "Export to Mindmap" option
**Validates: Requirements 4.1**

**Property 16: Habit Export Context Menu**
*For any* Habit in the dashboard, right-clicking should show "Export to Mindmap" option
**Validates: Requirements 4.2**

**Property 17: Export Dialog Options**
*For any* export operation, the system should show existing mindmaps and new mindmap creation option
**Validates: Requirements 4.3**

**Property 18: Export Node Creation**
*For any* Goal or Habit export, a new MindmapNode should be created with the entity's name and details
**Validates: Requirements 4.4**

**Property 19: Bidirectional References**
*For any* exported Goal or Habit, both the entity and corresponding MindmapNode should reference each other
**Validates: Requirements 4.5**

**Property 20: Auto-save Functionality**
*For any* changes to mindmap, nodes, or connections, the system should automatically persist changes to database
**Validates: Requirements 6.1**

**Property 21: Link Persistence**
*For any* created link between MindmapNodes and Goals/Habits, the relationship should be stored using foreign keys
**Validates: Requirements 6.2**

**Property 22: Cascading Deletion Updates**
*For any* Goal or Habit deletion that is linked to mindmap nodes, the corresponding nodes should be updated
**Validates: Requirements 6.3**

**Property 23: Sync Updates**
*For any* Goal or Habit modification that is linked to mindmap nodes, the node text should optionally be updated
**Validates: Requirements 6.4**

**Property 24: Data Consistency**
*For any* mindmap and its related Goals/Habits, all entities should have consistent owner_type and owner_id values
**Validates: Requirements 6.5**

## Error Handling

### Client-Side Error Handling

1. **Network Failures**: Implement retry logic for API calls with exponential backoff
2. **Validation Errors**: Show user-friendly error messages for invalid inputs
3. **Canvas Errors**: Handle canvas rendering failures gracefully with fallback UI
4. **Touch/Mouse Event Errors**: Provide fallback interaction methods

### Server-Side Error Handling

1. **Database Constraint Violations**: Return appropriate HTTP status codes with error details
2. **Foreign Key Violations**: Handle cascading deletes and updates properly
3. **Ownership Validation**: Ensure users can only access their own mindmaps
4. **Concurrent Modifications**: Implement optimistic locking for mindmap updates

### Data Integrity

1. **Orphaned Nodes**: Automatically clean up nodes when mindmaps are deleted
2. **Broken Connections**: Remove connections when referenced nodes are deleted
3. **Invalid References**: Handle cases where linked Goals/Habits no longer exist
4. **Coordinate Validation**: Ensure node coordinates are within reasonable bounds

## Testing Strategy

### Dual Testing Approach

The testing strategy employs both unit tests and property-based tests to ensure comprehensive coverage:

**Unit Tests**:
- Specific examples of mindmap creation, node manipulation, and Goal/Habit integration
- Edge cases like empty mindmaps, single nodes, and complex connection patterns
- Error conditions such as invalid coordinates, missing references, and network failures
- Integration points between mindmap components and existing Goal/Habit systems

**Property-Based Tests**:
- Universal properties that hold across all mindmap operations (Properties 1-24)
- Comprehensive input coverage through randomized mindmap structures, node positions, and user interactions
- Each property test runs minimum 100 iterations to validate correctness across diverse scenarios
- Tests tagged with format: **Feature: mindmap-integration, Property {number}: {property_text}**

**Testing Framework**: Jest with @fast-check/jest for property-based testing, following the existing test setup in the codebase.

**Test Configuration**:
- Property tests run with minimum 100 iterations per property
- Unit tests focus on specific examples and integration scenarios
- Both test types are complementary and necessary for comprehensive validation
- Property tests validate universal correctness while unit tests catch concrete implementation bugs