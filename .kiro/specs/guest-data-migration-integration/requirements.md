# Guest Data Migration Integration - Requirements

## Problem Statement
ゲスト時代に保存したデータを、ログイン先に統合できていない。現在の実装では、ユーザーがゲストから認証ユーザーに移行する際に、ゲストデータが単純にクリアされるだけで、認証ユーザーのアカウントにマイグレーションされていない。

## Current State Analysis
1. **Migration Class Exists**: `frontend/lib/guest-data-migration.ts` に完全な移行機能が実装済み
2. **Not Called**: `GuestDataMigration.migrateGuestDataToSupabase()` がどこからも呼び出されていない
3. **Data Loss**: `useAuth.ts` でゲストから認証ユーザーへの移行時にデータが単純にクリアされている
4. **UI Promise**: ログインページに「ログイン後、現在のゲストデータがアカウントにマージされます」と記載されているが実装されていない

## User Stories

### US-1: Automatic Guest Data Migration on Login
**As a** guest user with saved data  
**When I** log in with OAuth (Google/GitHub)  
**Then** my guest data (goals, habits, activities) should be automatically migrated to my authenticated account  
**And** the migration should happen seamlessly without user intervention  
**And** I should see a success message confirming the migration  

**Acceptance Criteria:**
- Guest data migration is triggered automatically when authentication state changes from guest to user
- Migration includes goals, habits, and activities from localStorage
- Migration preserves data relationships (habits linked to correct goals)
- Migration handles duplicate data gracefully (skip existing items)
- Migration shows progress/result to user
- Guest data is only cleared after successful migration

### US-2: Migration Error Handling
**As a** user experiencing migration issues  
**When** guest data migration fails partially or completely  
**Then** I should see clear error messages  
**And** guest data should be preserved if migration fails  
**And** I should have the option to retry migration  

**Acceptance Criteria:**
- Clear error messages for migration failures
- Guest data preserved on migration failure
- Retry mechanism available
- Detailed logging for debugging

### US-3: Migration Status Feedback
**As a** user during login  
**When** guest data migration is in progress  
**Then** I should see appropriate loading/progress indicators  
**And** I should receive confirmation when migration completes  

**Acceptance Criteria:**
- Loading indicator during migration
- Success message with migration statistics
- Clear indication when no guest data exists to migrate

## Technical Requirements

### TR-1: Integration Point
- Integrate migration into `useAuth` hook's authentication state change handler
- Trigger migration when `isGuest` changes from `true` to `false` and `isAuthed` becomes `true`
- Replace current data clearing logic with migration + clearing logic

### TR-2: User ID Extraction
- Extract authenticated user ID from Supabase session
- Pass user ID to `GuestDataMigration.migrateGuestDataToSupabase()`

### TR-3: Migration Flow
1. Check if guest data exists using `GuestDataMigration.hasGuestData()`
2. If guest data exists, show loading indicator
3. Call `GuestDataMigration.migrateGuestDataToSupabase(userId)`
4. Handle migration result (success/failure)
5. Show appropriate user feedback
6. Only clear guest data on successful migration

### TR-4: Error Handling
- Graceful handling of migration failures
- Preserve guest data on failure
- Clear error messaging
- Retry mechanism

### TR-5: User Experience
- Non-blocking migration (user can continue using app)
- Clear feedback on migration status
- Success/failure notifications

## Out of Scope
- Manual migration triggers (automatic only)
- Migration of other data types beyond goals/habits/activities
- Migration rollback functionality
- Cross-device migration

## Success Metrics
- Guest data successfully migrated on login
- Zero data loss during migration
- Clear user feedback on migration status
- Seamless user experience during authentication flow