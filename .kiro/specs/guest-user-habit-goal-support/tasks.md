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

- [ ] 6. Improve guest data migration service
  - Update `frontend/lib/guest-data-migration.ts` to handle ID mapping correctly
  - Implement goal ID mapping between guest IDs and Supabase UUIDs
  - Update habit goalId references during migration
  - Improve error handling and partial failure recovery
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.6, 7.7, 7.8_

- [ ]* 6.1 Write property test for ID mapping migration
  - **Property 5: Data migration with ID mapping**
  - **Validates: Requirements 7.3, 7.4**

- [ ]* 6.2 Write property test for migration cleanup
  - **Property 6: Data migration cleanup**
  - **Validates: Requirements 7.5**

- [ ]* 6.3 Write property test for error preservation
  - **Property 7: Migration error preservation**
  - **Validates: Requirements 7.7**

- [ ]* 6.4 Write property test for duplicate handling
  - **Property 8: Duplicate data handling**
  - **Validates: Requirements 7.8**

- [ ] 7. Integrate migration service with authentication flow
  - Modify `useAuth.ts` to trigger data migration when guest becomes authenticated
  - Add migration status tracking and user notifications
  - Ensure migration doesn't block the authentication process
  - _Requirements: 7.1, 8.1, 8.2, 8.4_

- [ ] 8. Add migration user interface components
  - Create migration progress indicator
  - Add success/error notification messages
  - Provide migration summary display
  - _Requirements: 8.1, 8.2, 8.3, 8.5_

- [ ] 9. Final integration testing
  - Test complete guest-to-authenticated user flow
  - Verify data integrity after migration
  - Test error scenarios and recovery
  - _Requirements: 7.6, 7.7, 8.3_

- [ ] 10. Final checkpoint - Complete migration feature
  - Ensure all migration tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The main implementation requires only a single line change in useAuth.ts
- Existing data layer (supabase-direct.ts) already supports guest users
- UI components already work without authentication restrictions
- Focus on maintaining backward compatibility with existing users
- Data migration feature ensures seamless transition from guest to authenticated user
- Migration service handles referential integrity and error recovery