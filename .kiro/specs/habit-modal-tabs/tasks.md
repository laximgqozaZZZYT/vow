# Implementation Plan: Habit Modal Tabs

## Overview

Habitモーダルを4タブ構成に再編成し、モバイルファーストのUXを実現します。既存のModal.Habit.tsxを段階的にリファクタリングし、タブナビゲーション、スワイプジェスチャー、アクセシビリティ対応を追加します。

## Tasks

- [x] 1. Create tab navigation infrastructure
  - [x] 1.1 Create useTabNavigation hook
    - Implement activeTab state management
    - Add localStorage persistence for last active tab
    - Export setActiveTab, goToNextTab, goToPreviousTab functions
    - _Requirements: 1.1, 1.2, 1.3, 10.5_
  
  - [x]* 1.2 Write property test for tab navigation
    - **Property 1: Tab click navigation**
    - **Validates: Requirements 1.3**
  
  - [x]* 1.3 Write property test for localStorage persistence
    - **Property 9: LocalStorage tab persistence**
    - **Validates: Requirements 10.5**

- [x] 2. Create TabNavigation component
  - [x] 2.1 Implement TabNavigation UI component
    - Create tab buttons with 44px minimum touch targets
    - Add active tab visual indicator using primary color
    - Implement ARIA roles (tablist, tab) and aria-selected
    - Support keyboard navigation (ArrowLeft, ArrowRight, Enter, Space)
    - _Requirements: 1.4, 6.1, 11.1, 11.2, 11.3, 11.4, 12.1, 12.2_
  
  - [x]* 2.2 Write property test for keyboard navigation
    - **Property 10: Keyboard navigation**
    - **Validates: Requirements 11.1, 11.3**
  
  - [x]* 2.3 Write property test for ARIA selected state
    - **Property 11: ARIA selected state**
    - **Validates: Requirements 11.4**

- [x] 3. Implement swipe gesture support
  - [x] 3.1 Create useSwipeGesture hook
    - Implement touch event handlers (onTouchStart, onTouchMove, onTouchEnd)
    - Add swipe threshold (50px minimum) to prevent accidental navigation
    - Calculate swipe direction and velocity
    - Handle boundary conditions (first/last tab)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.6_
  
  - [x]* 3.2 Write property test for swipe navigation
    - **Property 5: Swipe navigation**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4**
  
  - [x]* 3.3 Write property test for swipe threshold
    - **Property 6: Swipe threshold boundary**
    - **Validates: Requirements 7.6**

- [x] 4. Checkpoint - Ensure navigation infrastructure tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Create tab panel components
  - [x] 5.1 Create BasicTab component
    - Extract Name input, Type selection, Timings section, Description textarea
    - Include Level indicator for existing habits
    - Ensure 44px minimum input heights
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 6.2_
  
  - [x] 5.2 Create ExclusionTab component
    - Extract Outdates configuration section
    - Add empty state with guidance when no exclusions
    - Support Date, Daily, Weekly, Monthly exclusion types
    - Add explanatory text about exclusions
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  
  - [x]* 5.3 Write property test for exclusion addition
    - **Property 2: Exclusion period addition invariant**
    - **Validates: Requirements 3.2**
  
  - [x] 5.4 Create WorkloadTab component
    - Extract Level assessment controls (for existing habits)
    - Extract Workload Unit, Load per Count, Load Total (Day/End) inputs
    - Display estimated days calculation
    - Display Auto Load per Set based on Timings
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_
  
  - [x]* 5.5 Write property test for auto load calculation
    - **Property 3: Auto load calculation**
    - **Validates: Requirements 4.7**
  
  - [x] 5.6 Create DetailTab component
    - Extract Goal selector
    - Extract Tags selector (SmartSelector)
    - Support Main, Sub, Next relation types
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
    - Extract Related Habits section with add/remove functionality
  
  - [x]* 5.7 Write property test for relation add/remove
    - **Property 4: Relation add/remove consistency**
    - **Validates: Requirements 5.4**

- [x] 6. Checkpoint - Ensure tab panel tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Integrate tabs into HabitModal
  - [x] 7.1 Refactor Modal.Habit.tsx to use tab structure
    - Replace view mode toggle with TabNavigation
    - Remove CollapsibleSection components
    - Remove viewMode localStorage persistence
    - Add tab content container with swipe gesture handlers
    - Wire up all tab panels with shared form state
    - _Requirements: 10.1, 10.2, 10.3, 10.4_
  
  - [x]* 7.2 Write property test for form data round-trip
    - **Property 7: Form data round-trip preservation**
    - **Validates: Requirements 8.1, 8.2**
  
  - [x]* 7.3 Write property test for save payload completeness
    - **Property 8: Save payload completeness**
    - **Validates: Requirements 8.3**

- [x] 8. Add error indication across tabs
  - [x] 8.1 Implement tab error indicators
    - Add error dot/badge to tabs with validation errors
    - Show which tab contains errors when save fails
    - _Requirements: 8.4_

- [x] 9. Responsive and accessibility polish
  - [x] 9.1 Add responsive styles for mobile/desktop
    - Horizontally scrollable tabs on mobile (< 768px)
    - Full-width single-column layout on mobile
    - Multi-column layout on desktop where appropriate
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_
  
  - [x] 9.2 Add aria-labelledby associations
    - Connect tab panels to their tab buttons
    - Ensure proper focus management on tab switch
    - _Requirements: 11.5, 11.6_
  
  - [x] 9.3 Add smooth transitions with reduced-motion support
    - Tab switch animations
    - Swipe gesture visual feedback
    - Respect prefers-reduced-motion
    - _Requirements: 7.5, 12.4, 12.5_

- [x] 10. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The implementation builds incrementally: hooks → components → integration

