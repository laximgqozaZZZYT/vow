# Implementation Plan: Habit-Sticky Commit Integration

## Overview

This implementation plan breaks down the Commit feature into discrete coding tasks. The approach is incremental: first establishing the service layer, then enhancing existing components, and finally adding new UI elements. Each task builds on previous work to ensure no orphaned code.

## Tasks

- [ ] 1. Create CommitService and TypeScript types
  - [ ] 1.1 Create Commit and CommitStats TypeScript types in `frontend/app/dashboard/types/index.ts`
    - Add `Commit` interface with id, name, description, completed, completedAt, habitId, createdAt
    - Add `CommitStats` interface with total, completed, pending
    - _Requirements: 2.1, 2.4_
  
  - [ ] 1.2 Create CommitService module in `frontend/lib/commitService.ts`
    - Implement `getCommitsForHabit(habitId: string): Promise<Commit[]>`
    - Implement `getCommitStats(habitId: string): Promise<CommitStats>`
    - Implement `getCommitStatsForHabits(habitIds: string[]): Promise<Map<string, CommitStats>>`
    - Use existing `api.getStickyHabits` and join with stickies data
    - _Requirements: 2.1, 2.2, 2.3_
  
  - [ ] 1.3 Write property test for Commit count calculation
    - **Property 3: Commit Count Calculation Consistency**
    - Generate habit with random linked stickies, verify count equals completed count
    - **Validates: Requirements 2.1, 2.2, 2.3**

- [ ] 2. Implement commit sorting utility
  - [ ] 2.1 Create `sortCommits` function in `frontend/lib/commitService.ts`
    - Sort incomplete commits first
    - Sort completed commits by completedAt descending
    - _Requirements: 3.5_
  
  - [ ] 2.2 Write property test for commit sorting
    - **Property 5: Commit Sorting Order**
    - Generate random commits, verify sorting invariant
    - **Validates: Requirements 3.5**

- [ ] 3. Checkpoint - Ensure service layer tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Create CommitBadge widget component
  - [ ] 4.1 Create `Widget.CommitBadge.tsx` in `frontend/app/dashboard/components/`
    - Accept `completed`, `total`, and optional `size` props
    - Render "{completed}/{total} commits" format
    - Apply success styling (green) when completed === total
    - Return null when total === 0
    - Use design system tokens: `bg-muted`, `text-muted-foreground`, `bg-success`
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  
  - [ ] 4.2 Write property test for CommitBadge rendering
    - **Property 6: Commit Badge Rendering**
    - Generate random CommitStats, verify format and styling
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4**

- [ ] 5. Add Commits section to Habit Modal
  - [ ] 5.1 Create `CommitsSection` component within `Modal.Habit.tsx`
    - Display list of commits with name, checkbox, completion date
    - Show "No commits yet" when empty
    - Add "Add Commit" button
    - Sort commits using `sortCommits` utility
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.1_
  
  - [ ] 5.2 Integrate CommitsSection into HabitModal
    - Load commits using CommitService when modal opens
    - Pass commits data to CommitsSection
    - Handle loading and error states
    - _Requirements: 3.1_
  
  - [ ] 5.3 Write property test for commit display
    - **Property 4: Commit Display Contains Required Fields**
    - Generate random commits, verify rendered output contains required fields
    - **Validates: Requirements 3.2**

- [ ] 6. Enhance Sticky Modal for "Add Commit" flow
  - [ ] 6.1 Add `preSelectedHabitId` prop to StickyModal
    - Accept optional `preSelectedHabitId` prop
    - Pre-select the habit in Related Habits when provided
    - _Requirements: 4.2, 4.3_
  
  - [ ] 6.2 Wire "Add Commit" button to open StickyModal
    - Pass current habitId as preSelectedHabitId
    - Handle modal close/save callbacks
    - Refresh commits list after save
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 7. Checkpoint - Ensure modal integration works
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Add CommitBadge to Next Section habit cards
  - [ ] 8.1 Integrate CommitBadge into habit cards in `Section.Next.tsx`
    - Fetch commit stats for displayed habits using batch API
    - Render CommitBadge below habit name when stats.total > 0
    - _Requirements: 5.1, 5.5_
  
  - [ ] 8.2 Add commit stats to habit data loading
    - Extend habit loading to include commit stats
    - Use `getCommitStatsForHabits` for efficient batch loading
    - _Requirements: 5.5_

- [ ] 9. Enhance Habit Relation Map with commit nodes
  - [ ] 9.1 Add commit toggle control to `Widget.HabitRelationMap.tsx`
    - Add "Show Commits" toggle button
    - Store toggle state in component
    - _Requirements: 6.2_
  
  - [ ] 9.2 Implement commit node rendering
    - Create commit node type with distinct styling (yellow/amber, smaller)
    - Connect commit nodes to parent habit nodes with dashed lines
    - Show checkmark/muted style for completed commits
    - _Requirements: 6.1, 6.3, 6.4_
  
  - [ ] 9.3 Add click handler for commit nodes
    - Open StickyModal when commit node clicked
    - _Requirements: 6.5_
  
  - [ ] 9.4 Write property test for completed commit visual indicator
    - **Property 7: Completed Commit Visual Indicator**
    - Generate random commits, verify completed ones have visual indicator
    - **Validates: Requirements 6.4**

- [ ] 10. Checkpoint - Ensure relation map works
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Verify cascade delete behavior
  - [ ] 11.1 Write property test for habit deletion cascade
    - **Property 8: Habit Deletion Cascade**
    - Verify junction records removed but stickies preserved
    - **Validates: Requirements 7.3**
  
  - [ ] 11.2 Write property test for sticky deletion cascade
    - **Property 9: Sticky Deletion Cascade**
    - Verify all junction records removed when sticky deleted
    - **Validates: Requirements 7.4**

- [ ] 12. Write integration tests
  - [ ] 12.1 Write link/unlink round-trip property test
    - **Property 1: Link/Unlink Round-Trip**
    - Generate random sticky/habit pairs, verify linking and unlinking
    - **Validates: Requirements 1.2, 1.5**
  
  - [ ] 12.2 Write many-to-many linking property test
    - **Property 2: Many-to-Many Linking Consistency**
    - Generate sticky with multiple habits, verify all relationships
    - **Validates: Requirements 1.4**

- [ ] 13. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks are required including property-based tests
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The implementation uses the existing `sticky_habits` junction table - no database migrations required
