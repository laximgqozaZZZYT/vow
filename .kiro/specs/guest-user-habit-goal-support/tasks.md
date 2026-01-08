# Implementation Plan: Guest User Habit/Goal Support

## Overview

ゲストユーザーがHabit/Goal登録を行えるようにする最小限の実装です。useAuth.tsの1行のみを修正して、ゲストユーザーを認証済みとして扱います。

## Tasks

- [x] 1. Update authentication logic for guest users
  - Modify `frontend/app/dashboard/hooks/useAuth.ts` to set `isAuthed: true` for guest users
  - Ensure backward compatibility with existing authenticated user flows
  - _Requirements: 1.1, 1.4_

- [x] 1.1 Write property test for guest user authentication state
  - **Property 1: Guest user authentication state**
  - **Validates: Requirements 1.1**

- [x] 1.2 Write property test for backward compatibility
  - **Property 2: Backward compatibility preservation**
  - **Validates: Requirements 1.4**

- [x] 2. Verify guest user goal functionality
  - Test that guest users can create, view, update, and delete goals
  - Ensure data persists in localStorage as expected
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 2.1 Write property test for guest goal operations
  - **Property 3: Guest goal creation**
  - **Validates: Requirements 2.1, 2.2**

- [x] 3. Verify guest user habit functionality
  - Test that guest users can create, view, update, and delete habits
  - Ensure habit completion creates activity records
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3.1 Write property test for guest habit operations
  - **Property 4: Guest habit creation**
  - **Validates: Requirements 3.1, 3.2**

- [x] 4. Integration testing and validation
  - Verify that existing authenticated user functionality remains unchanged
  - Test guest user experience end-to-end
  - Ensure proper error handling for localStorage operations
  - _Requirements: 1.4, 5.3_

- [x] 5. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks are now required for comprehensive implementation
- The main implementation requires only a single line change in useAuth.ts
- Existing data layer (supabase-direct.ts) already supports guest users
- UI components already work without authentication restrictions
- Focus on maintaining backward compatibility with existing users