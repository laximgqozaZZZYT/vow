# Implementation Plan: Task Priority and Status Management

## Overview

This implementation plan breaks down the task priority and status management feature into discrete coding tasks. The implementation follows a bottom-up approach: database migration → types → API → UI components → integration.

## Tasks

- [ ] 1. Database Schema Migration
  - [ ] 1.1 Create migration file to add priority, status, and due_date columns
    - Add priority TEXT column with default 'none'
    - Add status TEXT column with default 'not_started'
    - Add due_date TIMESTAMP WITH TIME ZONE column
    - Add check constraints for valid values
    - Create indexes for filtering and sorting
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ] 2. Type System Updates
  - [ ] 2.1 Add Priority and Status type definitions
    - Create Priority type union in types/index.ts
    - Create StickyStatus type union
    - Create PRIORITY_CONFIG and STATUS_CONFIG constants
    - _Requirements: 7.1, 7.2, 7.5_
  
  - [ ] 2.2 Extend Sticky interface with new fields
    - Add priority, status, dueDate fields to Sticky interface
    - Update CreateStickyPayload interface
    - Add StickyFilters and StickySort types
    - _Requirements: 7.3, 7.4_

- [ ] 3. API Layer Updates
  - [ ] 3.1 Update API functions for new fields
    - Modify createSticky to accept priority, status, due_date
    - Modify updateSticky to accept priority, status, due_date
    - Modify getStickies to return new fields
    - _Requirements: 8.1, 8.2, 8.3_
  
  - [ ] 3.2 Add filtering and sorting support to API
    - Add filter parameters to getStickies function
    - Add sort parameters to getStickies function
    - Build Supabase query with filters and sorting
    - _Requirements: 8.4, 8.5, 8.6_
  
  - [ ]* 3.3 Write property test for sticky field round-trip
    - **Property 1: Sticky Field Round-Trip**
    - **Validates: Requirements 2.2, 2.4, 3.2, 4.2, 8.1, 8.2, 8.3**

- [ ] 4. Checkpoint - Verify API layer
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. UI Utility Functions
  - [ ] 5.1 Create sticky utility functions
    - Create getPriorityConfig helper function
    - Create getStatusConfig helper function
    - Create isOverdue and isUpcoming helper functions
    - Create formatDueDate helper function
    - _Requirements: 4.4, 4.5, 4.6, 5.1_
  
  - [ ]* 5.2 Write property tests for utility functions
    - **Property 6: Due Date Display Formatting**
    - **Property 7: Overdue Indicator Correctness**
    - **Property 8: Upcoming Indicator Correctness**
    - **Validates: Requirements 4.4, 4.5, 4.6**

- [ ] 6. Priority Selector Component
  - [ ] 6.1 Create PrioritySelector component
    - Render all 5 priority options with color indicators
    - Handle selection and call onChange callback
    - Display current value when editing
    - Use design system tokens (bg-destructive, bg-warning, etc.)
    - _Requirements: 2.1, 2.5_
  
  - [ ]* 6.2 Write unit tests for PrioritySelector
    - Test rendering of all options
    - Test selection handling
    - Test color mapping
    - _Requirements: 2.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 7. Status Selector Component
  - [ ] 7.1 Create StatusSelector component
    - Render all 4 status options with visual indicators
    - Handle selection and call onChange callback
    - Display current value when editing
    - _Requirements: 3.1, 3.6_
  
  - [ ]* 7.2 Write unit tests for StatusSelector
    - Test rendering of all options
    - Test selection handling
    - _Requirements: 3.1_

- [ ] 8. Due Date Picker Component
  - [ ] 8.1 Create DueDatePicker component
    - Render date input with clear button
    - Show overdue indicator for past dates
    - Show upcoming indicator for dates within 24 hours
    - Handle date selection and clearing
    - _Requirements: 4.1, 4.3, 4.5, 4.6_
  
  - [ ]* 8.2 Write unit tests for DueDatePicker
    - Test date selection
    - Test clearing date
    - Test overdue/upcoming indicators
    - _Requirements: 4.1, 4.3, 4.5, 4.6_

- [ ] 9. Checkpoint - Verify UI components
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Update Sticky Modal
  - [ ] 10.1 Integrate new components into Modal.Sticky.tsx
    - Add PrioritySelector to modal form
    - Add StatusSelector to modal form
    - Add DueDatePicker to modal form
    - Update state management for new fields
    - Update save handler to include new fields
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 4.1, 4.2_
  
  - [ ]* 10.2 Write integration tests for Modal.Sticky
    - Test default values on create
    - Test loading existing values on edit
    - Test save with new fields
    - _Requirements: 2.3, 3.3_

- [ ] 11. Update Stickies Section
  - [ ] 11.1 Add priority indicators to sticky cards
    - Display color-coded priority indicator on each card
    - Hide indicator when priority is 'none'
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_
  
  - [ ] 11.2 Add due date display to sticky cards
    - Show formatted due date on cards
    - Display overdue/upcoming indicators
    - _Requirements: 4.4, 4.5, 4.6_
  
  - [ ] 11.3 Sync checkbox with status field
    - Update status to 'completed' when checkbox checked
    - Update status to 'not_started' when checkbox unchecked
    - _Requirements: 3.4, 3.5_
  
  - [ ]* 11.4 Write property test for priority indicator display
    - **Property 9: Priority Indicator Display**
    - **Validates: Requirements 5.1**

- [ ] 12. Filter Panel Component
  - [ ] 12.1 Create FilterPanel component
    - Add priority filter dropdown/checkboxes
    - Add status filter dropdown/checkboxes
    - Add sort field selector
    - Add sort direction toggle
    - _Requirements: 6.1, 6.2_
  
  - [ ] 12.2 Integrate FilterPanel into Section.Stickies
    - Add filter state management
    - Connect filters to API calls
    - Persist filter preferences in session
    - _Requirements: 6.3, 6.8_
  
  - [ ]* 12.3 Write property tests for filtering
    - **Property 2: Priority Filter Correctness**
    - **Property 3: Status Filter Correctness**
    - **Property 4: Combined Filter AND Logic**
    - **Validates: Requirements 6.3, 6.7, 8.4, 8.5**
  
  - [ ]* 12.4 Write property test for sorting
    - **Property 5: Sort Correctness**
    - **Validates: Requirements 6.4, 6.5, 6.6, 8.6**

- [ ] 13. Final Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Follow design system tokens from design-system.md for all UI components
