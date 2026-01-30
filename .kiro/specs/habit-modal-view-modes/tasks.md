# Implementation Plan: Habit Modal View Modes

## Overview

This implementation plan breaks down the view mode toggle feature into discrete coding tasks. Each task builds on previous work, starting with core state management, then UI components, and finally testing and polish.

## Tasks

- [x] 1. Set up view mode state management
  - Add viewMode state using useLocalStorage hook
  - Add expandedSections state for Normal View
  - Implement view mode toggle logic
  - _Requirements: 1.1, 1.2, 5.1, 5.2, 5.3_

- [ ]* 1.1 Write property test for view mode state management
  - **Property 1: View Mode Persistence**
  - **Validates: Requirements 5.1, 5.2**

- [ ]* 1.2 Write property test for default view mode
  - **Property 6: Default View Mode**
  - **Validates: Requirements 1.1, 5.3**

- [x] 2. Create ViewToggle component
  - Implement toggle button UI
  - Add click handler to switch between modes
  - Add tooltip with view mode explanation
  - Style button for both desktop and mobile
  - _Requirements: 1.2, 1.4, 6.4, 7.3_

- [ ]* 2.1 Write property test for toggle button visibility
  - **Property 7: Toggle Button Visibility**
  - **Validates: Requirements 1.4**

- [ ]* 2.2 Write property test for toggle functionality
  - **Property 2: Data Preservation Across View Switches** (partial - toggle behavior)
  - **Validates: Requirements 1.2, 1.3**

- [x] 3. Implement conditional section rendering
  - Update HabitModal to conditionally render sections based on viewMode
  - Ensure Name, Timings, Tags, Description always visible
  - Hide Workload, Outdates, Type, Goal, Related Habits in Normal View
  - Show all sections in Detail View
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [ ]* 3.1 Write property test for section visibility in Normal View
  - **Property 3: Section Visibility in Normal View**
  - **Validates: Requirements 2.6, 2.7, 2.8, 2.9, 2.10**

- [ ]* 3.2 Write property test for section visibility in Detail View
  - **Property 4: Section Visibility in Detail View**
  - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

- [x] 4. Create CollapsibleSection component
  - Implement expand/collapse UI for individual sections
  - Add expand button with icon (▶/▼)
  - Handle expand/collapse state for each section
  - Ensure expanded sections show all fields
  - _Requirements: 4.1, 4.2, 4.3, 4.5_

- [ ]* 4.1 Write property test for expand/collapse functionality
  - **Property 5: Expand/Collapse State Independence**
  - **Validates: Requirements 4.4**

- [ ] 5. Integrate CollapsibleSection into HabitModal
  - Wrap hidden sections with CollapsibleSection component
  - Connect expandedSections state to each section
  - Ensure sections can be expanded in Normal View
  - Test that expanded sections remain functional
  - _Requirements: 4.2, 4.3, 4.4_

- [x] 6. Add CSS transitions and animations
  - Implement smooth transitions for view switching
  - Add expand/collapse animations for sections
  - Ensure animations work on mobile devices
  - Optimize animation performance
  - _Requirements: 7.1_

- [x] 7. Implement responsive behavior
  - Test view toggle on mobile viewports
  - Ensure touch targets are adequate (min 44x44px)
  - Verify scrolling works with expanded sections
  - Test on various screen sizes
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ]* 7.1 Write property test for responsive toggle functionality
  - **Property 8: Responsive Toggle Functionality**
  - **Validates: Requirements 6.1**

- [x] 8. Add accessibility features
  - Add ARIA labels to toggle button
  - Ensure keyboard navigation works
  - Add screen reader announcements for view changes
  - Test with accessibility tools
  - _Requirements: 1.4, 1.5, 7.2_

- [ ]* 8.1 Write unit tests for accessibility
  - Test ARIA labels are present
  - Test keyboard navigation
  - Test screen reader announcements

- [x] 9. Handle edge cases and error scenarios
  - Handle localStorage unavailable scenario
  - Handle invalid stored view mode values
  - Prevent issues with rapid toggle clicks
  - Test with browser extensions that block localStorage
  - _Requirements: 5.3_

- [ ]* 9.1 Write unit tests for edge cases
  - Test localStorage unavailable fallback
  - Test invalid stored value handling
  - Test rapid toggle clicks

- [x] 10. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Integration testing
  - Test full workflow: open modal → switch views → fill fields → save → reopen
  - Test expand in Normal View workflow
  - Test mobile interaction flow
  - Verify cross-browser localStorage behavior
  - _Requirements: All_

- [ ]* 11.1 Write integration tests
  - Test full modal workflow with view switching
  - Test expand/collapse workflow in Normal View
  - Test mobile viewport interactions

- [x] 12. Final polish and optimization
  - Optimize re-renders with React.memo
  - Implement lazy rendering for collapsed sections
  - Debounce localStorage writes if needed
  - Final visual polish and styling adjustments
  - _Requirements: All_

- [x] 13. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end workflows
