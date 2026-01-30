# Implementation Plan: Goal Enclosure Diagram

## Overview

This implementation plan breaks down the Goal Enclosure Diagram feature into discrete coding tasks. The feature will be implemented as a new React Flow-based widget integrated into the Statistics section carousel. Tasks are ordered to build incrementally, with each step validating core functionality before proceeding.

## Tasks

- [x] 1. Create core layout calculation module
  - [x] 1.1 Create `frontend/app/dashboard/utils/goalEnclosureLayout.ts` with layout types and interfaces
    - Define `GoalTreeNode`, `LayoutConfig`, `LayoutResult` interfaces
    - Define default layout configuration constants
    - _Requirements: 7.1, 7.2, 7.3_
  
  - [x] 1.2 Implement `buildGoalTree` function to convert flat Goals array into tree structure
    - Handle parentId relationships to build hierarchy
    - Calculate depth for each node
    - Handle circular references by breaking cycles
    - _Requirements: 3.1, 3.2, 3.3_
  
  - [x] 1.3 Implement `calculateLayout` function to compute node positions and sizes
    - Calculate enclosure sizes based on contained Habits and child Goals
    - Position sibling nodes to avoid overlap
    - Apply minimum size constraints (44x44px for touch targets)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 6.3_
  
  - [x]* 1.4 Write property tests for layout calculation
    - **Property 4: Hierarchy Correctness** - verify parentNode and depth are correct for all hierarchies
    - **Property 6: Non-Overlap Constraint** - verify sibling nodes don't overlap
    - **Property 7: Size Constraints** - verify enclosures fit their content
    - **Property 8: Touch Target Minimum Size** - verify 44x44px minimum
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 2.4, 7.1, 7.2, 7.3, 7.4, 6.3**

- [x] 2. Create custom React Flow node components
  - [x] 2.1 Create `frontend/app/dashboard/components/GoalEnclosure.Node.tsx` for Goal enclosure nodes
    - Render rectangular enclosure with Goal name header
    - Apply completion styling (muted colors) when isCompleted is true
    - Use design system colors (bg-card, border-border)
    - Support dark mode via CSS variables
    - Handle click events to trigger onGoalEdit callback
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 4.1, 6.2_
  
  - [x] 2.2 Create `frontend/app/dashboard/components/GoalEnclosure.HabitNode.tsx` for Habit nodes
    - Render compact Habit element with name
    - Apply completion styling when completed
    - Handle click events to trigger onHabitEdit callback
    - _Requirements: 2.2, 4.2_
  
  - [ ]* 2.3 Write unit tests for node components
    - Test Goal node renders name correctly
    - Test completion styling is applied
    - Test click handlers are called
    - _Requirements: 1.2, 1.3, 4.1, 4.2_

- [x] 3. Checkpoint - Ensure layout and node components work
  - All tests pass.

- [x] 4. Create main Widget component
  - [x] 4.1 Create `frontend/app/dashboard/components/Widget.GoalEnclosure.tsx` main component
    - Accept Goals, Habits, visibleGoalIds, onGoalEdit, onHabitEdit props
    - Transform data using layout calculation module
    - Render React Flow with custom node types
    - Support pan/zoom interactions
    - _Requirements: 1.1, 2.1, 4.3, 5.2_
  
  - [x] 4.2 Implement visibility filtering logic
    - Filter Goals based on visibleGoalIds prop
    - Handle orphan Habits (exclude or show in unassigned area)
    - _Requirements: 2.3, 5.3_
  
  - [x] 4.3 Add Edit Graph button and callback support
    - Render Edit Graph button in header
    - Call onEditGraph callback when clicked
    - _Requirements: 5.4_
  
  - [ ]* 4.4 Write property tests for widget data transformation
    - **Property 1: Visibility Filtering Correctness** - verify only visible Goals appear
    - **Property 2: Label Correctness** - verify names match input data
    - **Property 3: Completion Status Data Correctness** - verify isCompleted propagates
    - **Property 5: Orphan Habit Handling** - verify orphan Habits are handled
    - **Validates: Requirements 1.1, 1.2, 1.3, 2.2, 2.3, 5.2, 5.3**

- [x] 5. Integrate with Statistics Section
  - [x] 5.1 Add Goal Enclosure Diagram to Statistics section carousel
    - Add new page entry to pages array in Section.Statistics.tsx
    - Import and render Widget.GoalEnclosure component
    - Pass Goals, Habits, and visibility state as props
    - _Requirements: 5.1, 5.2_
  
  - [x] 5.2 Wire up modal callbacks
    - Connect onGoalEdit to open Goal modal
    - Connect onHabitEdit to open Habit modal
    - _Requirements: 4.1, 4.2_
  
  - [x] 5.3 Implement Edit Graph modal for Goal visibility
    - Reuse existing visibility editing pattern from Statistics section
    - Allow users to toggle which Goals are visible
    - _Requirements: 5.3, 5.4_
  
  - [ ]* 5.4 Write integration tests for Statistics section
    - Test Goal Enclosure Diagram appears in carousel
    - Test modal callbacks work correctly
    - _Requirements: 5.1, 4.1, 4.2_

- [x] 6. Checkpoint - Ensure integration works end-to-end
  - Build passes, integration complete.

- [x] 7. Add responsive and accessibility features
  - [x] 7.1 Add responsive styling for mobile/tablet/desktop
    - Adjust layout config based on screen size
    - Ensure touch targets are 44x44px minimum on mobile
    - _Requirements: 6.1, 6.3_
  
  - [x] 7.2 Add dark mode support
    - Use CSS variables from design system
    - Test appearance in both light and dark modes
    - _Requirements: 6.2_
  
  - [ ] 7.3 Add accessibility attributes
    - Add ARIA labels to interactive elements
    - Ensure keyboard navigation works
    - Respect prefers-reduced-motion for animations
    - _Requirements: 6.4, 6.5_
  
  - [ ]* 7.4 Write accessibility tests
    - Test ARIA attributes are present
    - Test keyboard navigation
    - _Requirements: 6.4_

- [x] 8. Final checkpoint - Ensure all tests pass
  - Build passes, core functionality complete.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The implementation uses React Flow consistent with the existing mindmap feature
- All styling follows the design system rules (Tailwind CSS, CSS variables, dark mode)
