# Implementation Plan: Habit Timing Preservation Fix

## Overview

This implementation plan addresses the critical bug where Habit timing data gets reset during save operations and calendar drag-and-drop actions. The fix involves enhancing the backend `updateHabit` function to properly handle `timingIndex` parameters for selective timing entry updates.

## Tasks

- [x] 1. Enhance backend updateHabit function with timingIndex support
  - Modify the `updateHabit` function in `frontend/lib/supabase-direct.ts`
  - Add logic to handle `timingIndex` parameter for selective timing entry updates
  - Implement timing entry merging logic that preserves existing data
  - Add validation for timingIndex bounds checking
  - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4_

- [ ]* 1.1 Write property test for selective timing entry updates
  - **Property 3: Selective Timing Entry Updates**
  - **Validates: Requirements 2.1, 2.2, 2.3**

- [ ]* 1.2 Write property test for timing entry data merging
  - **Property 4: Timing Entry Data Merging**
  - **Validates: Requirements 3.2, 3.4**

- [ ]* 1.3 Write property test for invalid timingIndex handling
  - **Property 7: Invalid TimingIndex Handling**
  - **Validates: Requirements 3.3**

- [x] 2. Implement timing data validation and error handling
  - Add comprehensive validation for timing entry updates
  - Implement date format consistency checks
  - Add time validation (start before end time)
  - Create proper error response structures
  - _Requirements: 4.1, 4.2, 4.3, 5.2, 5.5_

- [ ]* 2.1 Write property test for date format consistency
  - **Property 8: Date Format Consistency**
  - **Validates: Requirements 4.2**

- [ ]* 2.2 Write property test for time validation
  - **Property 9: Time Validation**
  - **Validates: Requirements 4.3**

- [ ]* 2.3 Write unit tests for error handling
  - Test invalid timing data rejection
  - Test error message formats
  - Test boundary conditions
  - _Requirements: 4.1, 5.2, 5.5_

- [x] 3. Ensure backward compatibility and data preservation
  - Verify that habits without timing arrays continue to work
  - Ensure legacy time field updates work when no timingIndex is provided
  - Implement timing entry structure preservation
  - Add timing entry ID preservation logic
  - _Requirements: 2.4, 2.5, 3.5, 4.4, 4.5_

- [ ]* 3.1 Write property test for backward compatibility
  - **Property 5: Backward Compatibility Preservation**
  - **Validates: Requirements 2.4, 3.5, 4.5**

- [ ]* 3.2 Write property test for timing entry structure preservation
  - **Property 6: Timing Entry Structure Preservation**
  - **Validates: Requirements 2.5, 4.4**

- [x] 4. Fix habit modal save behavior
  - Ensure habit modal save operations preserve all timing data
  - Verify that only modified fields are updated during save
  - Test timing entry order preservation
  - Prevent timing field reset to default values
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ]* 4.1 Write property test for timing entry preservation during non-timing updates
  - **Property 1: Timing Entry Preservation During Non-Timing Updates**
  - **Validates: Requirements 1.1, 1.3**

- [ ]* 4.2 Write property test for partial timing field updates
  - **Property 2: Partial Timing Field Updates**
  - **Validates: Requirements 1.2, 1.4**

- [ ]* 4.3 Write unit tests for habit modal save behavior
  - Test modal save with various timing configurations
  - Test field modification scenarios
  - Test timing array order preservation
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Integration testing and validation
  - Test calendar drag-and-drop functionality with the enhanced backend
  - Verify habit modal save operations work correctly
  - Test edge cases with various timing configurations
  - Validate error handling in real-world scenarios
  - _Requirements: All requirements_

- [ ]* 6.1 Write integration tests for calendar drag-and-drop
  - Test drag-and-drop with multiple timing entries
  - Test drag-and-drop with various timing types
  - Test error scenarios during drag-and-drop
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ]* 6.2 Write integration tests for habit modal operations
  - Test complete save workflows
  - Test various habit configurations
  - Test error recovery scenarios
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 7. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The implementation focuses on the backend API enhancement as the root cause of the issue
- Frontend components already correctly pass timingIndex parameters