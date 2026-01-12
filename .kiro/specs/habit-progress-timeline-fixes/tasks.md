# Implementation Plan: Habit Progress Timeline Fixes

## Overview

This implementation plan addresses the x-axis alignment issues and data visibility problems in the Habit Progress Timeline. The approach focuses on unifying time coordinate systems, standardizing progress calculations, and ensuring data visibility across all time ranges.

## Tasks

- [x] 1. Fix time coordinate system unification
  - Modify `computeDomainTs()` function to use consistent time calculation for both actual and planned data
  - Update `buildPlannedSeriesForHabit()` to align with actual data time coordinates
  - Ensure all time calculations use the same baseline and window logic
  - _Requirements: 1.1, 1.2, 1.4_

- [ ]* 1.1 Write property test for time coordinate consistency
  - **Property 1: Time Coordinate System Consistency**
  - **Validates: Requirements 1.1, 1.2, 1.4**

- [ ] 2. Implement time range alignment preservation
  - Update range switching logic to maintain coordinate alignment
  - Ensure domain calculations remain consistent across range changes
  - Fix any coordinate drift issues when switching between ranges
  - _Requirements: 1.3_

- [ ]* 2.1 Write property test for alignment preservation
  - **Property 2: Time Range Alignment Preservation**
  - **Validates: Requirements 1.3**

- [x] 3. Implement daily progress rate aggregation for extended ranges
  - Create daily aggregation logic for 7d/1mo/1y time ranges
  - Calculate daily progress rates for both actual and planned data
  - Ensure cumulative progress display up to each day
  - Handle days with no actual data (0% actual, maintain planned)
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [ ]* 3.1 Write property test for daily progress rate aggregation
  - **Property 3: Daily Progress Rate Aggregation**
  - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**

- [ ]* 3.2 Write property test for daily cumulative progress
  - **Property 4: Daily Cumulative Progress Display**
  - **Validates: Requirements 2.6**

- [ ]* 3.3 Write property test for empty day handling
  - **Property 5: Empty Day Handling**
  - **Validates: Requirements 2.5**

- [ ] 4. Standardize progress calculation methods
  - Ensure both actual and planned series use habit registration date as baseline
  - Unify denominator calculations for progress percentages
  - Fix inconsistencies in progress ratio calculations
  - _Requirements: 3.1, 3.3_

- [ ]* 4.1 Write property test for progress calculation consistency
  - **Property 6: Progress Calculation Consistency**
  - **Validates: Requirements 3.1, 3.3**

- [ ] 5. Implement perfect completion definition
  - Ensure 100% progress represents perfect habit completion from registration
  - Update calculation logic to properly handle expected vs actual completion
  - _Requirements: 3.2_

- [ ]* 5.1 Write property test for perfect completion
  - **Property 7: Perfect Completion Definition**
  - **Validates: Requirements 3.2**

- [ ] 6. Handle active period adjustments
  - Implement logic for habits active less time than selected range
  - Adjust progress calculations based on actual active periods
  - _Requirements: 3.4_

- [ ]* 6.1 Write property test for active period adjustment
  - **Property 8: Active Period Adjustment**
  - **Validates: Requirements 3.4**

- [ ] 7. Checkpoint - Ensure core functionality works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Fix visual rendering consistency
  - Ensure planned data renders as dashed lines with lower opacity
  - Ensure actual data renders as solid lines with higher opacity
  - Verify appropriate visual markers for data points
  - _Requirements: 4.1, 4.2, 4.3_

- [ ]* 8.1 Write property test for visual rendering
  - **Property 9: Visual Rendering Correctness**
  - **Validates: Requirements 4.1, 4.2, 4.3**

- [ ] 9. Implement interactive information display
  - Fix hover functionality to show both actual and planned values
  - Ensure detailed information displays correctly at hover coordinates
  - _Requirements: 4.4_

- [ ]* 9.1 Write property test for interactive display
  - **Property 10: Interactive Information Display**
  - **Validates: Requirements 4.4**

- [ ] 10. Integration testing and validation
  - Test complete timeline with various habit configurations
  - Verify time range switching maintains data integrity
  - Validate hover interactions across different data densities
  - _Requirements: All_

- [ ]* 10.1 Write integration tests
  - Test end-to-end timeline functionality
  - Test interaction between Statistics section and MultiEventChart
  - _Requirements: All_

- [ ] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Focus on TypeScript implementation in existing React components