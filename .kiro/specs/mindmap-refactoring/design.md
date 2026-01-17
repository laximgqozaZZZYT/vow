# Design Document: Mindmap Refactoring

## Overview

This document outlines the design for refactoring the Mindmap components (Widget.Mindmap.tsx and Widget.EditableMindmap.tsx) to improve code quality while maintaining all existing functionality. The refactoring focuses on improving readability, maintainability, type safety, and performance without changing any user-facing behavior.

## Architecture

### Current Architecture

The current implementation consists of:
- **Widget.Mindmap.tsx**: Main mindmap component with view/edit modes (~1420 lines)
- **Widget.EditableMindmap.tsx**: Dedicated edit mode component (~864 lines)
- **Section.Mindmap.tsx**: Section wrapper component
- **useMindmapState.ts**: Custom hook for state management
- **mindmap.utils.ts**: Utility functions
- **mindmap.i18n.ts**: Internationalization

### Target Architecture

The refactored architecture will maintain the same component structure but with improved organization:

```
Widget.Mindmap.tsx (Main Component)
├── Custom Hooks
│   ├── useMindmapState (existing)
│   ├── useConnectionMode (new)
│   ├── useMobileInteractions (new)
│   ├── useNodeOperations (new)
│   ├── useModalManagement (new)
│   └── useEventListeners (new)
├── Event Handlers (extracted)
│   ├── Node handlers
│   ├── Connection handlers
│   ├── Mobile handlers
│   └── Keyboard handlers
├── UI Components (extracted)
│   ├── MindmapHeader
│   ├── MindmapControls
│   ├── ConnectionModeOverlay
│   └── MobileBottomMenu
└── Utility Functions (enhanced)
    ├── Node operations
    ├── Edge operations
    └── Validation functions
```

## Components and Interfaces

### 1. Custom Hooks

#### useConnectionMode
Manages connection mode state and operations.

```typescript
interface ConnectionModeState {
  isActive: boolean;
  sourceNodeId: string | null;
  sourceHandleId: string | null;
}

interface UseConnectionModeReturn {
  connectionMode: ConnectionModeState;
  startConnection: (nodeId: string, handleId?: string) => void;
  endConnection: () => void;
  executeConnection: (targetNodeId: string) => void;
}

function useConnectionMode(
  nodes: Node[],
  edges: Edge[],
  setEdges: (edges: Edge[]) => void,
  goals: Goal[]
): UseConnectionModeReturn
```

#### useMobileInteractions
Handles mobile-specific interactions and gestures.

```typescript
interface MobileBottomMenuState {
  nodeId: string;
  nodeName: string;
  isVisible: boolean;
}

interface UseMobileInteractionsReturn {
  mobileBottomMenu: MobileBottomMenuState;
  showBottomMenu: (nodeId: string, nodeName: string) => void;
  hideBottomMenu: () => void;
  handleMenuAction: (action: string) => void;
}

function useMobileInteractions(
  nodes: Node[],
  setNodes: (nodes: Node[]) => void,
  setEdges: (edges: Edge[]) => void,
  connectionMode: ConnectionModeState,
  setConnectionMode: (mode: ConnectionModeState) => void
): UseMobileInteractionsReturn
```

#### useNodeOperations
Manages node creation, update, and deletion operations.

```typescript
interface UseNodeOperationsReturn {
  createNode: (position: { x: number; y: number }, label?: string, nodeType?: NodeType) => Node;
  updateNode: (nodeId: string, updates: Partial<NodeData>) => void;
  deleteNode: (nodeId: string) => void;
  deleteNodes: (nodeIds: string[]) => void;
}

function useNodeOperations(
  nodes: Node[],
  setNodes: (nodes: Node[]) => void,
  edges: Edge[],
  setEdges: (edges: Edge[]) => void
): UseNodeOperationsReturn
```

#### useModalManagement
Manages modal state for habit and goal registration.

```typescript
interface ModalState {
  habitModal: boolean;
  goalModal: boolean;
  selectedNodeName: string;
  selectedNodeId: string;
}

interface UseModalManagementReturn {
  modalState: ModalState;
  openHabitModal: (nodeId: string, nodeName: string) => void;
  openGoalModal: (nodeId: string, nodeName: string) => void;
  closeModal: () => void;
}

function useModalManagement(): UseModalManagementReturn
```

#### useEventListeners
Manages event listener registration and cleanup.

```typescript
interface UseEventListenersReturn {
  registerListeners: () => void;
  unregisterListeners: () => void;
}

function useEventListeners(
  handlers: Record<string, EventListener>,
  dependencies: any[]
): UseEventListenersReturn
```

### 2. Event Handler Functions

All event handlers will be extracted into separate, well-named functions:

```typescript
// Node event handlers
function handleNodeClick(event: React.MouseEvent, node: Node): void
function handleNodeDoubleClick(event: React.MouseEvent, node: Node): void
function handleNodeDragStart(event: React.MouseEvent, node: Node): void
function handleNodeDragEnd(event: React.MouseEvent, node: Node): void

// Connection event handlers
function handleConnectionStart(event: React.MouseEvent | React.TouchEvent, params: ConnectionParams): void
function handleConnectionEnd(event: MouseEvent | TouchEvent): void
function handleConnection(params: Connection): void

// Mobile event handlers
function handleMobileNodeTap(nodeId: string): void
function handleMobileLongPress(nodeId: string): void
function handleTouchEndOnPane(event: CustomEvent): void

// Keyboard event handlers
function handleKeyDown(event: KeyboardEvent): void
function handleEscapeKey(): void
function handleDeleteKey(): void
```

### 3. UI Component Extraction

Extract complex UI sections into separate components:

#### MindmapHeader
```typescript
interface MindmapHeaderProps {
  mindmapName: string;
  hasUnsavedChanges: boolean;
  isEditMode: boolean;
  lang: Language;
  onNameChange: (name: string) => void;
  onSave: () => void;
  onClose: () => void;
  onLanguageToggle: () => void;
}

function MindmapHeader(props: MindmapHeaderProps): JSX.Element
```

#### MindmapControls
```typescript
interface MindmapControlsProps {
  isEditMode: boolean;
  selectedNodesCount: number;
  onAddNode: () => void;
  onClearConnections: () => void;
  onDeleteSelected: () => void;
}

function MindmapControls(props: MindmapControlsProps): JSX.Element
```

#### ConnectionModeOverlay
```typescript
interface ConnectionModeOverlayProps {
  isActive: boolean;
  sourceNodeName: string;
  lang: Language;
  onCancel: () => void;
}

function ConnectionModeOverlay(props: ConnectionModeOverlayProps): JSX.Element
```

#### MobileBottomMenu
```typescript
interface MobileBottomMenuProps {
  isVisible: boolean;
  nodeId: string;
  nodeName: string;
  nodeType: NodeType;
  lang: Language;
  onAction: (action: string) => void;
  onClose: () => void;
}

function MobileBottomMenu(props: MobileBottomMenuProps): JSX.Element
```

### 4. Utility Functions

Enhanced utility functions with clear responsibilities:

```typescript
// Node operations
function createNodeAtPosition(position: { x: number; y: number }, label: string, nodeType: NodeType): Node
function updateNodeProperties(node: Node, updates: Partial<NodeData>): Node
function validateNodeConnection(sourceNode: Node, targetNode: Node, edges: Edge[]): boolean

// Edge operations
function createEdge(sourceId: string, targetId: string, sourceNodeType: NodeType): Edge
function getEdgesByNode(nodeId: string, edges: Edge[]): Edge[]
function removeEdgesByNode(nodeId: string, edges: Edge[]): Edge[]

// Position calculations
function calculateCenterPosition(viewport: Viewport, isMobile: boolean): { x: number; y: number }
function constrainPositionToViewport(position: { x: number; y: number }, viewport: Viewport): { x: number; y: number }

// Validation
function validateGoalConnection(targetNode: Node, edges: Edge[], nodes: Node[]): { valid: boolean; message?: string }
function validateNodeData(data: any): NodeData | null
```

## Data Models

### Node Data Structure
```typescript
interface CustomNodeData {
  label: string;
  isEditing: boolean;
  nodeType: 'default' | 'habit' | 'goal';
  habitId?: string;
  goalId?: string;
}

interface Node {
  id: string;
  position: { x: number; y: number };
  data: CustomNodeData;
  type: string;
}
```

### Edge Data Structure
```typescript
interface EdgeData {
  sourceNodeType: 'default' | 'habit' | 'goal';
}

interface Edge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  style: CSSProperties;
  data: EdgeData;
}
```

### State Management
```typescript
interface MindmapState {
  nodes: Node[];
  edges: Edge[];
  selectedNodes: Node[];
  connectionMode: ConnectionModeState;
  mobileBottomMenu: MobileBottomMenuState;
  modalState: ModalState;
  hasUnsavedChanges: boolean;
  isEditMode: boolean;
  mindmapName: string;
  lang: Language;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all testable acceptance criteria, the following properties have been identified. Some criteria that initially appeared as separate properties have been consolidated:

- Properties 2.3 and 2.5 both test generic functions handling different inputs - consolidated into Property 1
- Properties 8.1-8.7 all test behavioral preservation - consolidated into Properties 2-8 by functional area
- Properties 10.1-10.3 all test error handling - consolidated into Property 9

This ensures each property provides unique validation value without redundancy.

### Property 1: Generic Node Operations
*For any* node type (default, habit, goal) and any valid node operation (create, update, delete), the generic operation functions should handle the operation correctly and produce the expected result.
**Validates: Requirements 2.3, 2.5**

### Property 2: Node Creation Preservation
*For any* valid node creation parameters (position, label, nodeType), the refactored code should create nodes with the same properties and behavior as the original implementation.
**Validates: Requirements 8.1**

### Property 3: Connection Logic Preservation
*For any* valid connection attempt between two nodes, the refactored code should apply the same validation rules and create connections with the same properties as the original implementation.
**Validates: Requirements 8.2**

### Property 4: Node Editing Preservation
*For any* node and any valid edit operation, the refactored code should maintain the same editing behavior and state transitions as the original implementation.
**Validates: Requirements 8.3**

### Property 5: Mobile Interaction Preservation
*For any* mobile gesture or interaction (tap, long-press, drag), the refactored code should produce the same behavior and state changes as the original implementation.
**Validates: Requirements 8.4**

### Property 6: Data Structure Preservation
*For any* mindmap state, the saved data structure should match the original format exactly, ensuring backward compatibility with existing saved mindmaps.
**Validates: Requirements 8.5**

### Property 7: Mode Switching Preservation
*For any* mode switch between edit and view modes, the refactored code should maintain the same state transitions and UI behavior as the original implementation.
**Validates: Requirements 8.6**

### Property 8: Registration Flow Preservation
*For any* node registration as habit or goal, the refactored code should follow the same flow and produce the same result as the original implementation.
**Validates: Requirements 8.7**

### Property 9: Error Handling Consistency
*For any* operation that can fail (async operations, validation, unexpected states), the system should provide descriptive error messages and maintain application stability.
**Validates: Requirements 10.1, 10.2, 10.3, 10.5**

### Property 10: Pure Function Behavior
*For any* calculation function, calling it multiple times with the same input should always return the same output without side effects.
**Validates: Requirements 3.5**

### Property 11: Connection Handling Consistency
*For any* valid connection attempt, the unified connection handling system should process it correctly regardless of whether it originates from desktop or mobile interactions.
**Validates: Requirements 4.3**

### Property 12: Event Throttling Behavior
*For any* high-frequency event stream, the debounced/throttled handler should execute at most once per specified time interval.
**Validates: Requirements 7.5**

### Property 13: External Data Validation
*For any* external data input (loaded mindmap, API response), the system should either validate it successfully and type-cast appropriately, or reject it with a clear error message.
**Validates: Requirements 5.5**

## Error Handling

### Error Categories

1. **Validation Errors**: Invalid node connections, invalid data structures
2. **State Errors**: Unexpected state transitions, missing required data
3. **Async Errors**: Failed save operations, network errors
4. **User Input Errors**: Invalid node names, invalid positions

### Error Handling Strategy

```typescript
// Validation errors
function validateAndConnect(source: Node, target: Node): Result<Edge, ValidationError> {
  const validation = validateGoalConnection(target, edges, nodes);
  if (!validation.valid) {
    return Err(new ValidationError(validation.message));
  }
  return Ok(createEdge(source.id, target.id, source.data.nodeType));
}

// Async errors
async function handleSave(): Promise<Result<void, SaveError>> {
  try {
    await onSave(mindmapData);
    return Ok(undefined);
  } catch (error) {
    console.error('[Mindmap] Save failed:', error);
    return Err(new SaveError(error.message));
  }
}

// State errors
function getNodeById(nodeId: string): Result<Node, StateError> {
  const node = nodes.find(n => n.id === nodeId);
  if (!node) {
    console.error(`[Mindmap] Node not found: ${nodeId}`);
    return Err(new StateError(`Node ${nodeId} not found`));
  }
  return Ok(node);
}
```

## Testing Strategy

### Unit Testing

Unit tests will focus on:
- Individual utility functions (pure functions)
- Custom hooks (using React Testing Library)
- Event handler functions (isolated testing)
- Validation functions
- Data transformation functions

Example unit tests:
```typescript
describe('validateGoalConnection', () => {
  it('should reject connection when target already has a goal connection', () => {
    const result = validateGoalConnection(targetNode, existingEdges, nodes);
    expect(result.valid).toBe(false);
    expect(result.message).toContain('already has a Goal connection');
  });

  it('should allow connection when target has no goal connection', () => {
    const result = validateGoalConnection(targetNode, [], nodes);
    expect(result.valid).toBe(true);
  });
});
```

### Property-Based Testing

Property-based tests will verify universal properties across all inputs. Each test will run a minimum of 100 iterations with randomly generated inputs.

#### Test Configuration
- Framework: fast-check (for TypeScript/JavaScript)
- Iterations per test: 100 minimum
- Each test references its design document property

#### Property Test Examples

```typescript
// Property 1: Generic Node Operations
describe('Feature: mindmap-refactoring, Property 1: Generic Node Operations', () => {
  it('should handle any node type correctly', () => {
    fc.assert(
      fc.property(
        fc.record({
          nodeType: fc.constantFrom('default', 'habit', 'goal'),
          label: fc.string({ minLength: 1, maxLength: 100 }),
          position: fc.record({ x: fc.integer(), y: fc.integer() })
        }),
        (nodeData) => {
          const node = createNode(nodeData.position, nodeData.label, nodeData.nodeType);
          expect(node.data.nodeType).toBe(nodeData.nodeType);
          expect(node.data.label).toBe(nodeData.label);
          expect(node.position).toEqual(nodeData.position);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Property 6: Data Structure Preservation
describe('Feature: mindmap-refactoring, Property 6: Data Structure Preservation', () => {
  it('should preserve data structure for any mindmap state', () => {
    fc.assert(
      fc.property(
        generateRandomMindmapState(),
        (mindmapState) => {
          const saved = serializeMindmap(mindmapState);
          const loaded = deserializeMindmap(saved);
          expect(loaded).toEqual(mindmapState);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Property 10: Pure Function Behavior
describe('Feature: mindmap-refactoring, Property 10: Pure Function Behavior', () => {
  it('should return same output for same input', () => {
    fc.assert(
      fc.property(
        fc.record({ x: fc.integer(), y: fc.integer() }),
        fc.boolean(),
        (viewport, isMobile) => {
          const result1 = calculateCenterPosition(viewport, isMobile);
          const result2 = calculateCenterPosition(viewport, isMobile);
          expect(result1).toEqual(result2);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Integration Testing

Integration tests will verify:
- Component interactions
- Hook compositions
- Event flow through the system
- State synchronization

### Regression Testing

Before and after refactoring:
- Capture screenshots of all UI states
- Record user interaction flows
- Compare behavior pixel-by-pixel
- Verify data structures match exactly

## Implementation Notes

### Refactoring Approach

1. **Phase 1: Extract Utility Functions**
   - Move pure functions to utility files
   - Add comprehensive tests
   - Verify no behavior changes

2. **Phase 2: Create Custom Hooks**
   - Extract state management logic
   - Test hooks in isolation
   - Integrate into main component

3. **Phase 3: Extract Event Handlers**
   - Move event handlers to separate functions
   - Maintain all existing behavior
   - Add handler tests

4. **Phase 4: Extract UI Components**
   - Split large component into smaller pieces
   - Maintain visual consistency
   - Test component rendering

5. **Phase 5: Add Documentation**
   - Add JSDoc comments
   - Document complex logic
   - Update README

### Code Quality Metrics

Target metrics after refactoring:
- Average function length: < 30 lines
- Maximum function length: < 50 lines
- Cyclomatic complexity: < 10 per function
- Test coverage: > 80%
- TypeScript strict mode: enabled
- No `any` types except for external libraries

### Performance Considerations

- Use `React.memo` for expensive components
- Use `useCallback` for event handlers passed as props
- Use `useMemo` for expensive calculations
- Batch state updates where possible
- Debounce high-frequency events (e.g., drag, scroll)

### Backward Compatibility

- Maintain exact same data structure for saved mindmaps
- Preserve all existing props interfaces
- Keep all existing event handlers
- Maintain same CSS classes for styling
- Ensure no breaking changes to parent components

## Migration Path

### For Developers

1. Review this design document
2. Run existing tests to establish baseline
3. Implement refactoring in phases
4. Run tests after each phase
5. Compare behavior with original implementation
6. Update documentation

### For Users

No migration required - all changes are internal. Users will experience:
- Same functionality
- Same UI
- Same data format
- Potentially improved performance

## Future Improvements

After successful refactoring, consider:
- Adding undo/redo functionality
- Implementing collaborative editing
- Adding more node types
- Improving mobile gesture support
- Adding keyboard shortcuts
- Implementing auto-save
- Adding export/import features
