# Guest Data Migration Integration - Implementation Tasks

## Task 1: Update AuthContext Type Definition
**File**: `frontend/app/dashboard/types.ts` (or create if not exists)
**Requirements**: TR-1, TR-4
**Description**: Extend AuthContext interface to include migration state

### Implementation:
```typescript
export interface AuthContext {
  user: any;
  signOut: () => Promise<void>;
  isAuthed: boolean | null;
  actorLabel: string;
  authError: string | null;
  handleLogout: () => Promise<void>;
  isGuest: boolean;
  // New migration properties
  migrationStatus: 'idle' | 'checking' | 'migrating' | 'success' | 'error';
  migrationResult: GuestDataMigrationResult | null;
  migrationError: string | null;
  retryMigration: () => Promise<void>;
}
```

### Acceptance Criteria:
- [ ] AuthContext interface includes all migration-related properties
- [ ] Import GuestDataMigrationResult type from guest-data-migration.ts
- [ ] Type definitions are properly exported

---

## Task 2: Implement Migration State Management in useAuth Hook
**File**: `frontend/app/dashboard/hooks/useAuth.ts`
**Requirements**: TR-1, TR-2, TR-3
**Description**: Add migration state variables and helper functions

### Implementation:
```typescript
// Add new state variables
const [migrationStatus, setMigrationStatus] = useState<'idle' | 'checking' | 'migrating' | 'success' | 'error'>('idle');
const [migrationResult, setMigrationResult] = useState<GuestDataMigrationResult | null>(null);
const [migrationError, setMigrationError] = useState<string | null>(null);

// Add helper function to extract user ID
const getUserIdFromSession = async (): Promise<string | null> => {
  try {
    const { supabase } = await import('../../../lib/supabaseClient');
    if (!supabase) return null;
    
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id || null;
  } catch (error) {
    console.error('[auth] Failed to get user ID:', error);
    return null;
  }
};
```

### Acceptance Criteria:
- [ ] Migration state variables added with correct types
- [ ] getUserIdFromSession function implemented and tested
- [ ] Proper error handling in getUserIdFromSession
- [ ] Import GuestDataMigration and related types

---

## Task 3: Implement Migration Execution Function
**File**: `frontend/app/dashboard/hooks/useAuth.ts`
**Requirements**: TR-3, TR-4, TR-5
**Description**: Create performMigration function to handle the migration process

### Implementation:
```typescript
const performMigration = async (userId: string) => {
  setMigrationStatus('migrating');
  setMigrationError(null);
  migrationInProgressRef.current = true;
  
  try {
    console.log('[auth] Starting guest data migration for user:', userId);
    
    const result = await GuestDataMigration.migrateGuestDataToSupabase(userId);
    
    if (result.success) {
      setMigrationStatus('success');
      setMigrationResult(result);
      const successMessage = `Successfully migrated ${result.migratedGoals} goals, ${result.migratedHabits} habits, and ${result.migratedActivities} activities`;
      setAuthError(successMessage);
      console.log('[auth] Migration completed successfully:', result);
    } else {
      setMigrationStatus('error');
      setMigrationError(result.errors.join(', '));
      setAuthError(`Migration completed with errors: ${result.errors.join(', ')}`);
      console.warn('[auth] Migration completed with errors:', result);
    }
  } catch (error) {
    setMigrationStatus('error');
    const errorMessage = (error as any)?.message || String(error);
    setMigrationError(errorMessage);
    setAuthError(`Migration failed: ${errorMessage}`);
    console.error('[auth] Migration failed:', error);
  } finally {
    migrationInProgressRef.current = false;
    
    // Clear success message after 5 seconds
    if (migrationStatus === 'success') {
      setTimeout(() => {
        setAuthError(null);
        setMigrationStatus('idle');
        setMigrationResult(null);
      }, 5000);
    }
  }
};
```

### Acceptance Criteria:
- [ ] performMigration function handles all migration scenarios
- [ ] Proper error handling and logging
- [ ] Success message auto-clears after 5 seconds
- [ ] Migration status updates correctly throughout process
- [ ] Guest data preserved on migration failure

---

## Task 4: Implement Retry Migration Function
**File**: `frontend/app/dashboard/hooks/useAuth.ts`
**Requirements**: TR-4
**Description**: Add retry mechanism for failed migrations

### Implementation:
```typescript
const retryMigration = async () => {
  if (migrationStatus === 'error' && isAuthed && !isGuest) {
    console.log('[auth] Retrying guest data migration');
    const userId = await getUserIdFromSession();
    if (userId) {
      await performMigration(userId);
    } else {
      setMigrationError('Unable to get user ID for retry');
    }
  }
};
```

### Acceptance Criteria:
- [ ] retryMigration function only works in error state
- [ ] Proper validation of auth state before retry
- [ ] Error handling for retry failures
- [ ] Logging for retry attempts

---

## Task 5: Replace Guest Data Clearing Logic with Migration Logic
**File**: `frontend/app/dashboard/hooks/useAuth.ts`
**Requirements**: TR-1, TR-3
**Description**: Modify handleGuestToUserTransition to trigger migration instead of just clearing data

### Implementation:
```typescript
const handleGuestToUserTransition = async () => {
  console.log('[auth] Transition check:', { 
    previousIsGuest: previousIsGuestRef.current, 
    currentIsGuest: isGuest, 
    isAuthed, 
    migrationInProgress: migrationInProgressRef.current,
    migrationStatus
  });
  
  // Trigger migration when transitioning from guest to authenticated user
  if (!isGuest && isAuthed && !migrationInProgressRef.current && migrationStatus === 'idle') {
    console.log('[auth] Authenticated user detected, checking for guest data migration');
    
    const userId = await getUserIdFromSession();
    if (!userId) {
      console.warn('[auth] No user ID available for migration');
      return;
    }
    
    // Check if guest data exists
    const { GuestDataMigration } = await import('../../../lib/guest-data-migration');
    if (GuestDataMigration.hasGuestData()) {
      console.log('[auth] Guest data found, starting migration');
      await performMigration(userId);
    } else {
      console.log('[auth] No guest data to migrate');
    }
  }
  
  // Update previous state
  previousIsGuestRef.current = isGuest;
};
```

### Acceptance Criteria:
- [ ] Migration triggered only on guest-to-user transition
- [ ] Guest data check before attempting migration
- [ ] Proper state management to prevent duplicate migrations
- [ ] Logging for debugging and monitoring
- [ ] Dynamic import of GuestDataMigration to avoid circular dependencies

---

## Task 6: Update useAuth Return Object
**File**: `frontend/app/dashboard/hooks/useAuth.ts`
**Requirements**: TR-1, TR-4
**Description**: Include migration state in the returned AuthContext

### Implementation:
```typescript
return {
  user: null, // TODO: implement user object
  signOut: handleLogout,
  isAuthed,
  actorLabel,
  authError,
  handleLogout,
  isGuest,
  // Migration state
  migrationStatus,
  migrationResult,
  migrationError,
  retryMigration
};
```

### Acceptance Criteria:
- [ ] All migration properties included in return object
- [ ] Return object matches AuthContext interface
- [ ] No breaking changes to existing properties

---

## Task 7: Add Migration Status Display to Header Component
**File**: `frontend/app/dashboard/components/Layout.Header.tsx`
**Requirements**: TR-5
**Description**: Show migration status and retry option in the header

### Implementation:
```typescript
// Import useAuth hook
import { useAuth } from '../hooks/useAuth';

// In component:
const { migrationStatus, migrationError, retryMigration } = useAuth();

// Add migration status display
{migrationStatus === 'migrating' && (
  <div className="flex items-center text-sm text-blue-600 bg-blue-50 px-3 py-1 rounded">
    <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full mr-2"></div>
    Migrating your data...
  </div>
)}

{migrationStatus === 'error' && migrationError && (
  <div className="flex items-center text-sm text-red-600 bg-red-50 px-3 py-1 rounded">
    <span className="mr-2">Migration failed.</span>
    <button 
      onClick={retryMigration}
      className="underline hover:no-underline"
    >
      Retry
    </button>
  </div>
)}
```

### Acceptance Criteria:
- [ ] Migration status visible in header when active
- [ ] Loading spinner during migration
- [ ] Error message with retry button on failure
- [ ] Proper styling consistent with existing design
- [ ] Responsive design for mobile devices

---

## Task 8: Add Migration Success Notification
**File**: `frontend/app/dashboard/components/Layout.Header.tsx`
**Requirements**: TR-5
**Description**: Show success notification with migration statistics

### Implementation:
```typescript
{migrationStatus === 'success' && migrationResult && (
  <div className="flex items-center text-sm text-green-600 bg-green-50 px-3 py-1 rounded">
    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
    Successfully migrated {migrationResult.migratedGoals} goals, {migrationResult.migratedHabits} habits, and {migrationResult.migratedActivities} activities
  </div>
)}
```

### Acceptance Criteria:
- [ ] Success message shows migration statistics
- [ ] Success icon displayed
- [ ] Message auto-dismisses after 5 seconds
- [ ] Proper styling with green color scheme

---

## Task 9: Update Guest Data Migration Import
**File**: `frontend/app/dashboard/hooks/useAuth.ts`
**Requirements**: TR-1
**Description**: Add proper imports for guest data migration functionality

### Implementation:
```typescript
// Add import at top of file
import { GuestDataMigration, type GuestDataMigrationResult } from '../../../lib/guest-data-migration';
```

### Acceptance Criteria:
- [ ] GuestDataMigration class imported correctly
- [ ] GuestDataMigrationResult type imported
- [ ] No circular dependency issues
- [ ] TypeScript compilation successful

---

## Task 10: Add Comprehensive Logging
**File**: `frontend/app/dashboard/hooks/useAuth.ts`
**Requirements**: TR-4
**Description**: Add detailed logging for debugging and monitoring

### Implementation:
```typescript
// Add logging throughout migration process
console.log('[auth] Migration status change:', { from: previousStatus, to: migrationStatus });
console.log('[auth] Guest data check result:', GuestDataMigration.hasGuestData());
console.log('[auth] Migration result:', migrationResult);
console.error('[auth] Migration error:', migrationError);
```

### Acceptance Criteria:
- [ ] Comprehensive logging at all key points
- [ ] Consistent log format with [auth] prefix
- [ ] Error logs include full error details
- [ ] Debug information for troubleshooting

---

## Task 11: Testing and Validation
**Requirements**: All requirements
**Description**: Test the complete migration flow

### Test Scenarios:
1. **Happy Path**: Guest with data → Login → Successful migration
2. **No Guest Data**: Guest without data → Login → No migration needed
3. **Partial Failure**: Some items fail to migrate → Error handling
4. **Complete Failure**: All items fail to migrate → Error handling
5. **Network Failure**: Migration fails due to network → Retry works
6. **Duplicate Data**: Guest data conflicts with existing user data → Deduplication

### Acceptance Criteria:
- [ ] All test scenarios pass
- [ ] No data loss in any scenario
- [ ] Proper error messages displayed
- [ ] Retry functionality works correctly
- [ ] UI feedback appropriate for each scenario
- [ ] Performance acceptable (< 5 seconds for typical datasets)

---

## Task 12: Documentation Update
**File**: Update relevant documentation
**Requirements**: All requirements
**Description**: Update documentation to reflect new migration functionality

### Updates Needed:
- Update login page text to be more specific about migration
- Add troubleshooting guide for migration issues
- Document migration behavior for developers

### Acceptance Criteria:
- [ ] Login page accurately describes migration behavior
- [ ] Developer documentation updated
- [ ] User-facing help text updated if needed

## Implementation Order

1. **Task 1**: Update type definitions (foundation)
2. **Task 9**: Add imports (dependencies)
3. **Task 2**: Add state management (core functionality)
4. **Task 3**: Implement migration execution (core functionality)
5. **Task 4**: Add retry mechanism (error handling)
6. **Task 5**: Replace clearing logic with migration (integration)
7. **Task 6**: Update return object (API completion)
8. **Task 7**: Add header status display (UI feedback)
9. **Task 8**: Add success notification (UI feedback)
10. **Task 10**: Add comprehensive logging (debugging)
11. **Task 11**: Testing and validation (quality assurance)
12. **Task 12**: Documentation update (completion)

## Risk Mitigation

- **Data Loss Risk**: Preserve guest data on migration failure
- **Performance Risk**: Non-blocking migration, timeout handling
- **User Experience Risk**: Clear feedback, retry mechanism
- **Authentication Risk**: Validate user session before migration