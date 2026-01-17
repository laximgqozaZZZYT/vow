# Mindmap Architecture

This document describes the refactored architecture of the Mindmap components.

## Overview

The mindmap functionality has been refactored to improve:
- **Readability**: Clear separation of concerns
- **Maintainability**: DRY principle, modular hooks
- **Type Safety**: Comprehensive TypeScript types
- **Performance**: Memoization and optimized re-renders

## Component Structure

```
Widget.Mindmap.Refactored.tsx
├── Hooks
│   ├── useMindmapState        - Core state management
│   ├── useConnectionMode      - Connection mode state
│   ├── useConnectionHandlers  - Connection event handlers
│   ├── useMobileInteractions  - Mobile-specific interactions
│   ├── useNodeOperations      - Node CRUD operations
│   ├── useMindmapModals       - Modal state management
│   ├── useModalHandlers       - Modal submission handlers
│   ├── useMindmapEvents       - Event listener management
│   └── useMindmapPersistence  - Save/close operations
│
├── UI Components
│   ├── MindmapHeader          - Header with name editing
│   ├── MindmapControls        - Action buttons
│   ├── EdgeLegend             - Edge color legend
│   ├── ConnectionModeOverlay  - Mobile connection overlay
│   ├── MobileBottomMenu       - Mobile action menu
│   ├── SaveDialog             - Save confirmation dialog
│   └── CoachMark              - First-time user tooltip
│
└── Utilities (lib/mindmap/)
    ├── node-operations.ts     - Node CRUD utilities
    ├── edge-operations.ts     - Edge utilities
    ├── position-utils.ts      - Position calculations
    └── validation.ts          - Data validation
```

## Hooks

### useMindmapState
Core state management hook that provides:
- Node and edge state with React Flow integration
- Selection state
- UI state (dialogs, coach mark, language)
- Edit mode state

### useConnectionMode
Manages connection mode for creating edges:
- `startConnection(nodeId, handleId)` - Start a new connection
- `endConnection()` - Cancel/end connection mode
- `executeConnection(targetNodeId)` - Complete connection to target
- `isConnectionActive` - Whether connection mode is active

### useConnectionHandlers
Event handlers for connection operations:
- `onConnect` - Handle connection between existing nodes
- `onConnectStart` - Handle connection start
- `onConnectEnd` - Handle connection end (creates new node if dropped on pane)
- `handleMobileNodeTap` - Handle mobile node tap during connection
- `handlePaneClick` - Handle pane click for mobile connection

### useNodeOperations
Node CRUD operations:
- `createNode(params)` - Create a new node
- `deleteSelectedNodes(nodes)` - Delete selected nodes
- `setNodeType(nodeId, type, entityId)` - Set node type (habit/goal)
- `setNodeEditing(nodeId)` - Set node to editing mode
- `clearEditing()` - Clear all editing states

### useMobileInteractions
Mobile-specific interactions:
- `showBottomMenu(nodeId, nodeName)` - Show mobile action menu
- `hideBottomMenu()` - Hide mobile action menu
- `handleMenuAction(action)` - Handle menu action selection

### useMindmapModals
Modal state management:
- `openHabitModal(nodeId, nodeName, options)` - Open habit creation modal
- `openGoalModal(nodeId, nodeName, options)` - Open goal creation modal
- `closeModal()` - Close any open modal

### useModalHandlers
Modal submission handlers:
- `handleHabitCreate(payload)` - Handle habit creation
- `handleGoalCreate(payload)` - Handle goal creation

### useMindmapEvents
Event listener management:
- Keyboard shortcuts (Delete, Escape)
- Custom events (nodeChanged, longPress, etc.)
- Proper cleanup on unmount

### useMindmapPersistence
Save and close operations:
- `handleSave()` - Save mindmap data
- `handleClose()` - Close with unsaved changes check
- `handleSaveAndClose()` - Save and close
- `handleCloseWithoutSaving()` - Close without saving
- `handleCancelClose()` - Cancel close dialog

## Utilities

### node-operations.ts
- `createNodeAtPosition(params)` - Create node at position
- `updateNodeProperties(node, updates)` - Update node properties
- `findNodeById(nodes, id)` - Find node by ID
- `isAnyNodeEditing(nodes)` - Check if any node is editing
- `filterNodesByType(nodes, type)` - Filter nodes by type

### edge-operations.ts
- `createEdge(params)` - Create edge with proper styling
- `getEdgesByNode(edges, nodeId)` - Get edges connected to node
- `removeEdgesByNodes(edges, nodeIds)` - Remove edges by node IDs
- `updateEdgeStylesBySource(edges, sourceId, style)` - Update edge styles

### position-utils.ts
- `calculateCenterPosition(viewport)` - Calculate center of viewport
- `constrainPositionToViewport(position, viewport, margin)` - Constrain position
- `clientToFlowPosition(client, bounds, project)` - Convert client to flow position

### validation.ts
- `validateGoalConnection(targetId, edges, nodes)` - Validate goal connection
- `validateNodeData(data)` - Validate node data
- `validateMindmapData(data)` - Validate mindmap data

## Performance Optimizations

1. **useMemo** for expensive calculations:
   - Translation function
   - Device detection
   - Node editing state
   - Event handlers object
   - Source node name
   - Current node type

2. **useCallback** for all event handlers:
   - Prevents unnecessary re-renders
   - Proper dependency arrays

3. **React.memo** for UI components:
   - MindmapHeader
   - MindmapControls
   - EdgeLegend
   - ConnectionModeOverlay
   - MobileBottomMenu
   - SaveDialog
   - CoachMark

## Usage

```tsx
import WidgetMindmapRefactored from './Widget.Mindmap.Refactored';

<WidgetMindmapRefactored
  mindmap={mindmap}
  goals={goals}
  habits={habits}
  onClose={handleClose}
  onSave={handleSave}
  onRegisterAsHabit={handleRegisterHabit}
  onRegisterAsGoal={handleRegisterGoal}
/>
```

## Migration Guide

To migrate from the original Widget.Mindmap to the refactored version:

1. Update imports:
   ```tsx
   // Before
   import WidgetMindmap from './Widget.Mindmap';
   
   // After
   import WidgetMindmapRefactored from './Widget.Mindmap.Refactored';
   ```

2. Props remain the same - no changes needed to parent components.

3. The refactored version maintains 100% feature parity with the original.
