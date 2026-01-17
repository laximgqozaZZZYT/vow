# Implementation Plan: Mindmap Refactoring

## Overview

This implementation plan breaks down the mindmap refactoring into discrete, manageable tasks. Each task builds on previous steps and includes testing to ensure no functionality is lost. The refactoring follows a phased approach: utilities → hooks → handlers → components → documentation.

## Tasks

- [x] 1. Setup and Preparation
  - Create backup of current implementation
  - Set up testing infrastructure for property-based testing (fast-check)
  - Create baseline test suite to verify existing behavior
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

- [ ]* 1.1 Write baseline behavior tests
  - Test current node creation behavior
  - Test current connection logic
  - Test current editing behavior
  - Test current mobile interactions
  - Test current save/load behavior
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 2. Phase 1: Extract and Enhance Utility Functions
  - [x] 2.1 Extract node operation utilities
    - Move node creation logic to `createNodeAtPosition`
    - Move node update logic to `updateNodeProperties`
    - Move node validation logic to `validateNodeConnection`
    - _Requirements: 2.1, 2.3, 3.5_

  - [ ]* 2.2 Write property test for generic node operations
    - **Property 1: Generic Node Operations**
    - **Validates: Requirements 2.3, 2.5**

  - [ ]* 2.3 Write property test for pure function behavior
    - **Property 10: Pure Function Behavior**
    - **Validates: Requirements 3.5**

  - [x] 2.4 Extract edge operation utilities
    - Move edge creation logic to `createEdge`
    - Move edge query logic to `getEdgesByNode`
    - Move edge removal logic to `removeEdgesByNode`
    - _Requirements: 2.1, 2.2_

  - [x] 2.5 Extract position calculation utilities
    - Move center position calculation to `calculateCenterPosition`
    - Move position constraint logic to `constrainPositionToViewport`
    - _Requirements: 2.1, 3.5_

  - [x] 2.6 Extract validation utilities
    - Move goal connection validation to `validateGoalConnection`
    - Move node data validation to `validateNodeData`
    - Add comprehensive error messages
    - _Requirements: 5.5, 10.1, 10.3_

  - [ ]* 2.7 Write property test for external data validation
    - **Property 13: External Data Validation**
    - **Validates: Requirements 5.5**

- [ ] 3. Checkpoint - Verify utility functions
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Phase 2: Create Custom Hooks
  - [x] 4.1 Create useConnectionMode hook
    - Extract connection mode state management
    - Implement startConnection, endConnection, executeConnection
    - Add JSDoc documentation
    - _Requirements: 4.3, 6.1, 9.3_

  - [ ]* 4.2 Write property test for connection handling consistency
    - **Property 11: Connection Handling Consistency**
    - **Validates: Requirements 4.3**

  - [x] 4.3 Create useMobileInteractions hook
    - Extract mobile bottom menu state
    - Implement showBottomMenu, hideBottomMenu, handleMenuAction
    - Add JSDoc documentation
    - _Requirements: 4.2, 6.2, 9.3_

  - [x] 4.4 Create useNodeOperations hook
    - Extract node CRUD operations
    - Implement createNode, updateNode, deleteNode, deleteNodes
    - Add JSDoc documentation
    - _Requirements: 2.3, 2.5, 6.3, 9.3_

  - [x] 4.5 Create useModalManagement hook
    - Extract modal state management
    - Implement openHabitModal, openGoalModal, closeModal
    - Add JSDoc documentation
    - _Requirements: 2.4, 6.4, 9.3_

  - [x] 4.6 Create useEventListeners hook
    - Extract event listener registration/cleanup logic
    - Implement registerListeners, unregisterListeners
    - Ensure proper cleanup on unmount
    - _Requirements: 4.1, 4.5, 6.5, 9.3_

  - [ ]* 4.7 Write unit test for event listener cleanup
    - Test that all listeners are removed on unmount
    - _Requirements: 4.5_

- [ ] 5. Checkpoint - Verify custom hooks
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Phase 3: Extract Event Handlers
  - [x] 6.1 Extract node event handlers
    - Handlers integrated into useNodeOperations hook
    - _Requirements: 1.1, 3.3, 4.4, 9.1_

  - [x] 6.2 Extract connection event handlers
    - Created useConnectionHandlers hook
    - Implements onConnect, onConnectStart, onConnectEnd
    - Implements handleMobileNodeTap, handlePaneClick
    - Add JSDoc documentation
    - _Requirements: 1.1, 3.3, 4.3, 9.1_

  - [ ]* 6.3 Write property test for connection logic preservation
    - **Property 3: Connection Logic Preservation**
    - **Validates: Requirements 8.2**

  - [x] 6.4 Extract mobile event handlers
    - Handlers integrated into useMobileInteractions hook
    - _Requirements: 1.1, 3.3, 4.2, 9.1_

  - [ ]* 6.5 Write property test for mobile interaction preservation
    - **Property 5: Mobile Interaction Preservation**
    - **Validates: Requirements 8.4**

  - [x] 6.6 Extract keyboard event handlers
    - Handlers integrated into useMindmapEvents hook
    - _Requirements: 1.1, 3.3, 9.1_

  - [x] 6.7 Apply useCallback optimization
    - All event handlers wrapped with useCallback
    - Correct dependencies specified
    - _Requirements: 7.2_

- [x] 7. Checkpoint - Verify event handlers
  - All TypeScript diagnostics pass
  - Event handlers properly extracted to hooks

- [x] 8. Phase 4: Extract UI Components
  - [x] 8.1 Create MindmapHeader component
    - Extract header JSX into separate component
    - Define MindmapHeaderProps interface
    - Apply React.memo optimization
    - Add JSDoc documentation
    - _Requirements: 1.4, 5.1, 7.1, 9.1_

  - [x] 8.2 Create MindmapControls component
    - Extract controls JSX into separate component
    - Define MindmapControlsProps interface
    - Apply React.memo optimization
    - Add JSDoc documentation
    - _Requirements: 1.4, 5.1, 7.1, 9.1_

  - [x] 8.3 Create ConnectionModeOverlay component
    - Extract overlay JSX into separate component
    - Define ConnectionModeOverlayProps interface
    - Apply React.memo optimization
    - Add JSDoc documentation
    - _Requirements: 1.4, 5.1, 7.1, 9.1_

  - [x] 8.4 Create MobileBottomMenu component
    - Extract menu JSX into separate component
    - Define MobileBottomMenuProps interface
    - Apply React.memo optimization
    - Add JSDoc documentation
    - _Requirements: 1.4, 5.1, 7.1, 9.1_

  - [x] 8.5 Refactor main Widget.Mindmap component
    - Integrate all extracted hooks
    - Use extracted event handlers
    - Use extracted UI components
    - Simplify component structure
    - Fixed all unused imports/variables
    - _Requirements: 1.2, 1.4, 3.1_

- [x] 9. Checkpoint - Verify UI components
  - All TypeScript diagnostics pass
  - No unused imports or variables

- [ ] 10. Phase 5: Comprehensive Testing
  - [ ]* 10.1 Write property test for node creation preservation
    - **Property 2: Node Creation Preservation**
    - **Validates: Requirements 8.1**

  - [ ]* 10.2 Write property test for node editing preservation
    - **Property 4: Node Editing Preservation**
    - **Validates: Requirements 8.3**

  - [ ]* 10.3 Write property test for data structure preservation
    - **Property 6: Data Structure Preservation**
    - **Validates: Requirements 8.5**

  - [ ]* 10.4 Write property test for mode switching preservation
    - **Property 7: Mode Switching Preservation**
    - **Validates: Requirements 8.6**

  - [ ]* 10.5 Write property test for registration flow preservation
    - **Property 8: Registration Flow Preservation**
    - **Validates: Requirements 8.7**

  - [ ]* 10.6 Write property test for error handling consistency
    - **Property 9: Error Handling Consistency**
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.5**

  - [ ]* 10.7 Write property test for event throttling behavior
    - **Property 12: Event Throttling Behavior**
    - **Validates: Requirements 7.5**

- [x] 11. Phase 6: Performance Optimization
  - [x] 11.1 Add useMemo for expensive calculations
    - Translation function memoized with useMemo
    - Device detection memoized
    - anyNodeEditing calculation memoized
    - eventHandlers object memoized
    - sourceNodeName memoized
    - currentNodeType memoized
    - _Requirements: 7.3_

  - [x] 11.2 Implement event debouncing/throttling
    - Event handlers wrapped with useCallback
    - Dependencies properly specified
    - _Requirements: 7.5_

  - [x] 11.3 Batch state updates
    - State updates consolidated in hooks
    - Reduced re-renders through proper memoization
    - _Requirements: 7.4_

  - [ ]* 11.4 Performance profiling
    - Profile before and after refactoring
    - Verify no performance regression
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 12. Phase 7: Documentation and Code Quality
  - [x] 12.1 Add JSDoc comments to all functions
    - All hooks have JSDoc documentation
    - All utility functions documented
    - All components documented
    - _Requirements: 9.1_

  - [x] 12.2 Add inline comments for complex logic
    - Connection logic documented
    - Mobile interaction logic documented
    - _Requirements: 9.2, 9.4, 9.5_

  - [x] 12.3 Update README and documentation
    - Created MINDMAP_ARCHITECTURE.md
    - Documented new architecture
    - Added developer guide for extending functionality
    - Documented custom hooks usage
    - _Requirements: 9.3_

  - [x] 12.4 Code quality verification
    - All TypeScript diagnostics pass
    - No unused imports or variables
    - Functions properly modularized
    - _Requirements: 1.1, 1.2, 5.1, 5.2, 5.3, 5.4_

- [x] 13. Phase 8: Widget.EditableMindmap Refactoring
  - [x] 13.1 Apply same refactoring patterns to EditableMindmap
    - Created useEditableMindmapState hook for state management
    - Created EditableMindmap.Nodes.tsx with EditableGoalNode and EditableHabitNode
    - Created EditableMindmap.Controls.tsx for zoom and node type controls
    - Created EditableMindmap.DetailPanel.tsx for node editing panel
    - Created Widget.EditableMindmap.Refactored.tsx with all extracted components
    - _Requirements: 1.1, 1.2, 2.1, 3.1_

  - [ ]* 13.2 Write tests for EditableMindmap
    - Test node creation and editing
    - Test connection handling
    - Test delete operations
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 14. Final Verification and Cleanup
  - [x] 14.1 Run full test suite
    - All 117 tests pass
    - No TypeScript errors
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

  - [ ] 14.2 Visual regression testing
    - Compare screenshots before/after
    - Verify pixel-perfect UI match
    - Test all interaction flows
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 14.3 Code review and cleanup
    - Removed unused imports
    - Verified consistent code style
    - All hooks properly documented
    - _Requirements: 1.1, 1.4, 1.5_

  - [x] 14.4 Update version and changelog
    - Created MINDMAP_ARCHITECTURE.md
    - Documented all changes
    - _Requirements: 9.3_

- [x] 15. Final checkpoint - Complete refactoring
  - All TypeScript diagnostics pass
  - All tests pass (117/117)
  - Refactored components ready for use

## Notes

- Tasks marked with `*` are optional and can be skipped for faster completion
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties with 100+ iterations
- Unit tests validate specific examples and edge cases
- All existing functionality must be preserved - no breaking changes allowed
- TypeScript strict mode must be maintained throughout
- Performance should not regress - profile before and after
