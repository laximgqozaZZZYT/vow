# Implementation Plan: Goal OKR Milestones

## Overview

This implementation plan breaks down the goal-okr-milestones feature into discrete coding tasks. The approach follows a bottom-up strategy: database schema first, then data access layer, followed by state management, and finally UI components.

## Tasks

- [ ] 1. Database Schema Migration
  - [ ] 1.1 Create migration file for goals table SMART fields extension
    - Add columns: target_value, current_value, unit, start_date, deadline, difficulty
    - Add CHECK constraint for difficulty enum values
    - _Requirements: 6.1_
  
  - [ ] 1.2 Create migration file for key_results table
    - Create table with all columns and constraints
    - Add foreign key to goals with CASCADE delete
    - Add foreign key to habits with SET NULL on delete
    - Create indexes for goal_id and owner
    - _Requirements: 6.2, 6.4, 6.5_
  
  - [ ] 1.3 Create migration file for milestones table
    - Create table with all columns and constraints
    - Add foreign key to goals with CASCADE delete
    - Create indexes for goal_id and owner
    - _Requirements: 6.3, 6.4, 6.5_
  
  - [ ] 1.4 Create RLS policies for new tables
    - Add RLS policies for key_results table
    - Add RLS policies for milestones table
    - Follow existing pattern from goals table
    - _Requirements: 6.6_

- [ ] 2. TypeScript Type Definitions
  - [ ] 2.1 Extend Goal interface with SMART fields
    - Add targetValue, currentValue, unit, startDate, deadline, difficulty
    - Add optional keyResults and milestones arrays
    - Update CreateGoalPayload type
    - _Requirements: 1.2, 1.3, 1.5_
  
  - [ ] 2.2 Create KeyResult and Milestone interfaces
    - Define KeyResult interface with all fields
    - Define Milestone interface with all fields
    - Create CreateKeyResultPayload and CreateMilestonePayload types
    - _Requirements: 2.2, 3.2_

- [ ] 3. Checkpoint - Verify schema and types
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Data Access Layer - Supabase Client Extensions
  - [ ] 4.1 Implement Key Results CRUD operations
    - Add getKeyResults(goalId) method
    - Add createKeyResult(payload) method
    - Add updateKeyResult(id, updates) method
    - Add deleteKeyResult(id) method
    - _Requirements: 2.2, 2.4, 2.6_
  
  - [ ] 4.2 Implement Milestones CRUD operations
    - Add getMilestones(goalId) method
    - Add createMilestone(payload) method
    - Add updateMilestone(id, updates) method
    - Add deleteMilestone(id) method
    - Add reorderMilestones(goalId, orderedIds) method
    - _Requirements: 3.2, 3.5, 3.7_
  
  - [ ] 4.3 Implement Goal SMART fields operations
    - Add updateGoalSmart(id, smartFields) method
    - Update existing getGoals to include new fields
    - Add getGoalWithRelations(goalId) for fetching with key results and milestones
    - _Requirements: 1.2, 1.3, 1.5_
  
  - [ ]* 4.4 Write property tests for Key Results CRUD
    - **Property 3: Key Result Creation and Linking**
    - **Property 4: Key Result Validation**
    - **Validates: Requirements 2.2, 2.3**
  
  - [ ]* 4.5 Write property tests for Milestones CRUD
    - **Property 8: Milestone Creation Round-Trip**
    - **Property 9: Milestone Validation**
    - **Validates: Requirements 3.2, 3.3, 3.4**

- [ ] 5. Progress Calculation Utilities
  - [ ] 5.1 Implement calculateGoalProgress function
    - Handle target_value/current_value calculation
    - Handle key results average calculation
    - Handle milestones completion percentage
    - Handle edge cases (null, zero, empty arrays)
    - _Requirements: 1.6, 1.7, 2.5_
  
  - [ ] 5.2 Implement calculateKeyResultProgress function
    - Calculate progress from current_value/target_value
    - Handle edge cases
    - _Requirements: 2.4_
  
  - [ ]* 5.3 Write property tests for progress calculation
    - **Property 2: Progress Calculation from Target/Current Values**
    - **Property 5: Key Result Progress Calculation**
    - **Property 6: Goal Progress from Key Results Average**
    - **Validates: Requirements 1.6, 2.4, 2.5**

- [ ] 6. Checkpoint - Verify data layer
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. UI Components - Progress Visualization
  - [ ] 7.1 Create Widget.ProgressRing.tsx component
    - Implement circular progress indicator with SVG
    - Support size variants (sm, md, lg)
    - Support custom colors using design tokens
    - Show percentage label option
    - _Requirements: 4.1_
  
  - [ ] 7.2 Create Widget.ProgressBar.tsx component
    - Implement horizontal progress bar
    - Support size variants
    - Use design system colors
    - _Requirements: 2.8, 4.1_

- [ ] 8. UI Components - Key Results Form
  - [ ] 8.1 Create Form.KeyResults.tsx component
    - Implement key results list display with progress bars
    - Add inline form for creating new key results
    - Add edit/delete actions for each key result
    - Implement habit linking dropdown
    - _Requirements: 2.1, 2.2, 2.8, 5.1, 5.4_
  
  - [ ]* 8.2 Write unit tests for Form.KeyResults
    - Test rendering with empty list
    - Test rendering with multiple key results
    - Test validation errors
    - _Requirements: 2.3, 2.7_

- [ ] 9. UI Components - Milestones Form
  - [ ] 9.1 Create Form.Milestones.tsx component
    - Implement milestones checklist display
    - Add inline form for creating new milestones
    - Add date picker for due_date
    - Implement drag-and-drop reordering
    - Add completion toggle
    - _Requirements: 3.1, 3.2, 3.6, 4.3_
  
  - [ ]* 9.2 Write unit tests for Form.Milestones
    - Test rendering with empty list
    - Test rendering with multiple milestones
    - Test completion toggle
    - Test reordering
    - _Requirements: 3.5, 3.7, 3.8_

- [ ] 10. UI Components - Enhanced Goal Modal
  - [ ] 10.1 Add view mode toggle to Modal.Goal.tsx
    - Add basic/detail view mode state
    - Implement toggle button UI
    - Persist view mode preference
    - _Requirements: 7.1, 7.2, 7.5_
  
  - [ ] 10.2 Add SMART fields section to detail view
    - Add target_value, current_value, unit inputs
    - Add start_date and deadline date pickers
    - Add difficulty dropdown
    - Show progress ring when target_value is set
    - _Requirements: 1.1, 1.4, 1.6_
  
  - [ ] 10.3 Integrate Key Results section in detail view
    - Import and render Form.KeyResults component
    - Wire up CRUD callbacks to context
    - _Requirements: 2.1_
  
  - [ ] 10.4 Integrate Milestones section in detail view
    - Import and render Form.Milestones component
    - Wire up CRUD callbacks to context
    - _Requirements: 3.1_
  
  - [ ]* 10.5 Write property tests for view mode
    - **Property 16: View Mode State Preservation**
    - **Property 17: View Mode Preference Persistence**
    - **Validates: Requirements 7.4, 7.5**

- [ ] 11. Checkpoint - Verify UI components
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. State Management - Dashboard Context Updates
  - [ ] 12.1 Add key results state and actions to context
    - Add keyResultsByGoalId state
    - Add loadKeyResults, createKeyResult, updateKeyResult, deleteKeyResult actions
    - _Requirements: 2.2, 2.4, 2.6_
  
  - [ ] 12.2 Add milestones state and actions to context
    - Add milestonesByGoalId state
    - Add loadMilestones, createMilestone, updateMilestone, deleteMilestone, reorderMilestones actions
    - _Requirements: 3.2, 3.5, 3.7_
  
  - [ ] 12.3 Implement habit completion integration
    - Update habit completion handler to check for linked key results
    - Auto-update key result current_value on habit completion
    - Trigger goal progress recalculation
    - _Requirements: 5.2, 5.3_
  
  - [ ]* 12.4 Write property tests for habit-keyresult integration
    - **Property 12: Habit-KeyResult Integration**
    - **Validates: Requirements 5.2**

- [ ] 13. Widget Updates - Goal Tree and Diagram
  - [ ] 13.1 Update Widget.GoalTree.tsx with progress indicators
    - Add progress ring/bar to goal nodes
    - Show progress percentage
    - _Requirements: 4.4_
  
  - [ ] 13.2 Update Widget.GoalDiagram.tsx with progress indicators
    - Add progress visualization to diagram nodes
    - Update node styling for completed goals
    - _Requirements: 4.4, 4.5_

- [ ] 14. Integration Tests
  - [ ]* 14.1 Write cascade delete integration test
    - **Property 14: Cascade Delete Behavior**
    - **Validates: Requirements 6.4**
  
  - [ ]* 14.2 Write RLS policy integration test
    - **Property 15: Row Level Security**
    - **Validates: Requirements 6.6**
  
  - [ ]* 14.3 Write habit deletion integration test
    - **Property 13: Habit Deletion Preserves Key Result**
    - **Validates: Requirements 5.5**

- [ ] 15. Final Checkpoint
  - Ensure all tests pass, ask the user if questions arise.
  - Verify all requirements are covered
  - Test end-to-end flow: create goal → add SMART fields → add key results → add milestones → complete habit → verify progress

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Follow existing design system tokens for all UI components
- Use existing Modal.Goal.tsx patterns for consistency
