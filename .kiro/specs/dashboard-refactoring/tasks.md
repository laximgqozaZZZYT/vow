# Implementation Plan: Dashboard Refactoring

## Overview

This implementation plan breaks down the monolithic dashboard component into focused, maintainable components and custom hooks. The refactoring will be done incrementally to preserve functionality while improving code organization.

## Tasks

- [x] 1. Set up project structure and type definitions
  - Create directory structure for components and hooks
  - Define shared TypeScript interfaces and types
  - Set up testing framework for property-based testing
  - _Requirements: 3.1, 3.2, 7.2_

- [ ] 2. Extract authentication logic
  - [ ] 2.1 Create useAuth custom hook
    - Extract authentication state management from main component
    - Implement login, logout, and session management
    - _Requirements: 2.2, 5.3_

  - [ ]* 2.2 Write property test for authentication flow
    - **Property 3: Authentication Flow Preservation**
    - **Validates: Requirements 5.3**

  - [ ] 2.3 Create AuthenticationProvider component
    - Implement context provider for authentication state
    - Wrap dashboard with authentication context
    - _Requirements: 1.2, 4.2_

- [ ] 3. Extract data loading logic
  - [ ] 3.1 Create useDataLoader custom hook
    - Extract initial data loading logic
    - Handle loading states and error conditions
    - _Requirements: 2.1_

  - [ ]* 3.2 Write unit tests for data loading
    - Test loading states and error handling
    - Test API integration patterns
    - _Requirements: 2.1_

- [ ] 4. Extract goal management logic
  - [ ] 4.1 Create useGoals custom hook
    - Extract all goal-related state and operations
    - Implement goal hierarchy helpers and operations
    - _Requirements: 2.3, 5.4_

  - [ ]* 4.2 Write property test for goal management
    - **Property 4: Goal Management Preservation**
    - **Validates: Requirements 5.4**

  - [ ] 4.3 Create Widget.GoalTree component
    - Extract recursive goal rendering logic
    - Implement goal selection and editing interactions
    - _Requirements: 1.3, 3.3_

- [ ] 5. Extract habit management logic
  - [ ] 5.1 Create useHabits custom hook
    - Extract habit state management and operations
    - Implement habit action handlers (start, complete, pause)
    - _Requirements: 2.4, 5.5_

  - [ ]* 5.2 Write property test for habit management
    - **Property 5: Habit Management Preservation**
    - **Validates: Requirements 5.5**

  - [ ] 5.3 Implement habit event change handling
    - Extract calendar event update logic
    - Handle recurring vs non-recurring habit updates
    - _Requirements: 5.5, 5.7_

- [ ] 6. Extract activity management logic
  - [ ] 6.1 Create useActivities custom hook
    - Extract activity state and operations
    - Implement activity propagation logic
    - _Requirements: 2.5, 5.6_

  - [ ]* 6.2 Write property test for activity tracking
    - **Property 6: Activity Tracking Preservation**
    - **Validates: Requirements 5.6**

  - [ ] 6.3 Create Section.Activity component
    - Extract activity feed rendering
    - Implement edit and delete interactions
    - _Requirements: 1.5, 3.3_

- [ ] 7. Checkpoint - Core logic extraction complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Extract layout management logic
  - [ ] 8.1 Create useLayout custom hook
    - Extract page section management
    - Handle localStorage persistence
    - _Requirements: 2.1, 5.8_

  - [ ]* 8.2 Write property test for layout management
    - **Property 8: Layout Management Preservation**
    - **Validates: Requirements 5.8**

- [ ] 9. Extract modal management logic
  - [ ] 9.1 Create useModals custom hook
    - Extract all modal state management
    - Centralize modal open/close operations
    - _Requirements: 2.1, 4.4_

  - [ ]* 9.2 Write unit tests for modal state
    - Test modal state transitions
    - Test modal data initialization
    - _Requirements: 2.1_

- [ ] 10. Create header component
  - [ ] 10.1 Create Layout.Header component
    - Extract fixed header with navigation controls
    - Implement sidebar toggle and layout editor
    - _Requirements: 1.1, 3.3_

  - [ ]* 10.2 Write unit tests for header component
    - Test navigation interactions
    - Test authentication display
    - _Requirements: 1.1_

- [ ] 11. Create sidebar component
  - [ ] 11.1 Create Layout.Sidebar component
    - Extract left navigation pane
    - Integrate Widget.GoalTree and action buttons
    - _Requirements: 1.1, 3.3_

  - [ ]* 11.2 Write unit tests for sidebar component
    - Test goal tree integration
    - Test action button interactions
    - _Requirements: 1.1_

- [ ] 12. Create section components
  - [ ] 12.1 Create Section.Next component
    - Extract "Next" section with upcoming habits
    - Implement habit action buttons
    - _Requirements: 1.1, 3.3_

  - [ ] 12.2 Create Section.Calendar component
    - Extract calendar wrapper with FullCalendar
    - Implement event handling and navigation
    - _Requirements: 1.6, 3.3_

  - [ ]* 12.3 Write property test for calendar functionality
    - **Property 7: Calendar Functionality Preservation**
    - **Validates: Requirements 5.7**

- [ ] 13. Create modal container
  - [ ] 13.1 Create ModalContainer component
    - Extract all modal components into container
    - Integrate with useModals hook
    - _Requirements: 1.1, 3.3_

  - [ ]* 13.2 Write integration tests for modals
    - Test modal interactions with data hooks
    - Test modal state persistence
    - _Requirements: 1.1, 4.3_

- [ ] 14. Refactor main dashboard component
  - [ ] 14.1 Update DashboardPage to use extracted components
    - Replace inline logic with component composition
    - Wire up all custom hooks and components
    - _Requirements: 1.1, 3.5_

  - [ ]* 14.2 Write property test for state synchronization
    - **Property 1: State Synchronization Consistency**
    - **Validates: Requirements 4.3**

  - [ ]* 14.3 Write property test for functional preservation
    - **Property 2: Functional Preservation - User Interactions**
    - **Validates: Requirements 5.1, 5.2**

- [ ] 15. Final integration and cleanup
  - [ ] 15.1 Remove unused code and imports
    - Clean up original monolithic component
    - Ensure all functionality is preserved
    - _Requirements: 5.1, 5.2_

  - [ ]* 15.2 Write comprehensive integration tests
    - Test end-to-end user workflows
    - Test cross-component state synchronization
    - _Requirements: 4.3, 5.1_

  - [ ] 15.3 Update file organization
    - Organize components in proper directory structure
    - Ensure consistent naming conventions
    - _Requirements: 3.1, 3.2, 3.6_

- [ ] 16. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The refactoring preserves all existing functionality while improving maintainability