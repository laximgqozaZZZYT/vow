# Design Document

## Overview

This design outlines the refactoring of the monolithic dashboard page component into a modular, maintainable architecture. The current 1581-line component will be broken down into focused components and custom hooks, following React best practices for separation of concerns.

## Architecture

The refactored architecture follows a hierarchical component structure with custom hooks managing state and business logic:

```
DashboardPage (Main orchestrator)
├── AuthenticationProvider (Context provider)
├── Layout.Header (Fixed header with auth controls)
├── Layout.Sidebar (Left navigation pane)
│   ├── Widget.GoalTree (Recursive goal navigation)
│   └── ActionButtons (New goal/habit buttons)
├── DashboardMain (Main content area)
│   ├── Section.Next (Upcoming habits)
│   ├── Section.Activity (Activity feed)
│   ├── Section.Calendar (Calendar wrapper)
│   ├── Section.Statistics (Statistics - existing)
│   └── Section.Diary (Diary - existing)
└── ModalContainer (All modal components)
    ├── Modal.Goal
    ├── Modal.Habit
    ├── Modal.Activity
    └── Modal.LayoutEditor
```

## Components and Interfaces

### Core Components

#### DashboardPage
- **Purpose**: Main orchestrator component that manages layout and data flow
- **Responsibilities**: 
  - Coordinate between all child components
  - Manage page-level state (layout sections, client hydration)
  - Handle routing and navigation
- **Props**: None (root component)
- **State**: Layout configuration, client hydration status

#### AuthenticationProvider
- **Purpose**: Context provider for authentication state
- **Responsibilities**:
  - Manage authentication state and operations
  - Provide auth context to child components
- **Context Interface**:
  ```typescript
  interface AuthContext {
    isAuthed: boolean | null;
    actorLabel: string;
    authError: string | null;
    handleLogout: () => Promise<void>;
  }
  ```

#### Layout.Header
- **Purpose**: Fixed header with navigation and auth controls
- **Props**:
  ```typescript
  interface LayoutHeaderProps {
    onToggleSidebar: () => void;
    showSidebar: boolean;
    onEditLayout: () => void;
  }
  ```

#### Layout.Sidebar
- **Purpose**: Left navigation pane with goal tree and actions
- **Props**:
  ```typescript
  interface LayoutSidebarProps {
    isVisible: boolean;
    onClose: () => void;
    onNewGoal: () => void;
    onNewHabit: (initial?: HabitInitial) => void;
  }
  ```

#### Widget.GoalTree
- **Purpose**: Recursive goal navigation component
- **Props**:
  ```typescript
  interface WidgetGoalTreeProps {
    goals: Goal[];
    selectedGoal: string | null;
    onGoalSelect: (goalId: string) => void;
    onGoalEdit: (goalId: string) => void;
    onHabitAction: (habitId: string, action: HabitAction) => void;
  }
  ```

#### Section.Next
- **Purpose**: Display upcoming habits in next 24 hours
- **Props**:
  ```typescript
  interface SectionNextProps {
    habits: Habit[];
    onHabitAction: (habitId: string, action: HabitAction) => void;
  }
  ```

#### Section.Activity
- **Purpose**: Display activity feed with edit/delete actions
- **Props**:
  ```typescript
  interface SectionActivityProps {
    activities: Activity[];
    onEditActivity: (activityId: string) => void;
    onDeleteActivity: (activityId: string) => void;
  }
  ```

#### Section.Calendar
- **Purpose**: Wrapper for FullCalendar with habit events
- **Props**:
  ```typescript
  interface SectionCalendarProps {
    habits: Habit[];
    goals: Goal[];
    onEventClick: (habitId: string) => void;
    onSlotSelect: (date: string, time?: string, endTime?: string) => void;
    onEventChange: (habitId: string, changes: EventChanges) => void;
    onRecurringAttempt: (habitId: string, changes: EventChanges) => void;
  }
  ```

### Custom Hooks

#### useAuth
- **Purpose**: Manage authentication state and operations
- **Returns**:
  ```typescript
  interface UseAuthReturn {
    isAuthed: boolean | null;
    actorLabel: string;
    authError: string | null;
    handleLogout: () => Promise<void>;
  }
  ```

#### useDataLoader
- **Purpose**: Handle initial data loading from APIs
- **Returns**:
  ```typescript
  interface UseDataLoaderReturn {
    isLoading: boolean;
    error: string | null;
    loadData: () => Promise<void>;
  }
  ```

#### useGoals
- **Purpose**: Manage goal state and operations
- **Returns**:
  ```typescript
  interface UseGoalsReturn {
    goals: Goal[];
    selectedGoal: string | null;
    openGoals: Record<string, boolean>;
    onlyHabit: Record<string, boolean>;
    goalsById: Record<string, Goal>;
    rootGoals: Goal[];
    createGoal: (payload: CreateGoalPayload) => Promise<void>;
    updateGoal: (updated: Partial<Goal> & { id: string }) => void;
    deleteGoal: (id: string) => void;
    toggleGoal: (id: string) => void;
    setSelectedGoal: (id: string | null) => void;
    setOnlyHabitFor: (goalId: string, value: boolean) => void;
    completeGoalCascade: (goalId: string) => Promise<void>;
    childrenOf: (id: string) => Goal[];
    effectiveOnlyHabit: (goalId: string) => boolean;
    effectiveGoalCompleted: (goalId: string) => boolean;
    isDescendantOf: (childId: string, ancestorId: string) => boolean;
  }
  ```

#### useHabits
- **Purpose**: Manage habit state and operations
- **Returns**:
  ```typescript
  interface UseHabitsReturn {
    habits: Habit[];
    selectedHabitId: string | null;
    selectedHabit: Habit | null;
    starts: Record<string, { ts: string; timeoutId?: number }>;
    pausedLoads: Record<string, number>;
    createHabit: (payload: CreateHabitPayload) => Promise<void>;
    updateHabit: (id: string, updates: Partial<Habit>) => Promise<void>;
    deleteHabit: (id: string) => Promise<void>;
    setSelectedHabitId: (id: string | null) => void;
    handleStart: (habitId: string) => void;
    handleComplete: (habitId: string) => void;
    handlePause: (habitId: string) => void;
    handleEventChange: (habitId: string, changes: EventChanges) => Promise<void>;
  }
  ```

#### useActivities
- **Purpose**: Manage activity state and operations
- **Returns**:
  ```typescript
  interface UseActivitiesReturn {
    activities: Activity[];
    editingActivityId: string | null;
    setEditingActivityId: (id: string | null) => void;
    propagateActivityChanges: (updated: Activity) => void;
    handleDeleteActivity: (activityId: string) => void;
    openEditActivity: (activityId: string) => void;
  }
  ```

#### useLayout
- **Purpose**: Manage page section layout configuration
- **Returns**:
  ```typescript
  interface UseLayoutReturn {
    pageSections: SectionId[];
    setPageSections: (sections: SectionId[]) => void;
    isClient: boolean;
  }
  ```

#### useModals
- **Purpose**: Manage modal state for all modals
- **Returns**:
  ```typescript
  interface UseModalsReturn {
    openNewGoal: boolean;
    openModalGoal: boolean;
    openNewHabit: boolean;
    openModalHabit: boolean;
    openModalActivity: boolean;
    editLayoutOpen: boolean;
    editingGoalId: string | null;
    newHabitInitial: HabitInitial | null;
    newHabitInitialType: "do" | "avoid" | undefined;
    recurringRequest: RecurringRequest | null;
    setOpenNewGoal: (open: boolean) => void;
    setOpenModalGoal: (open: boolean) => void;
    setOpenNewHabit: (open: boolean) => void;
    setOpenModalHabit: (open: boolean) => void;
    setOpenModalActivity: (open: boolean) => void;
    setEditLayoutOpen: (open: boolean) => void;
    setEditingGoalId: (id: string | null) => void;
    setNewHabitInitial: (initial: HabitInitial | null) => void;
    setNewHabitInitialType: (type: "do" | "avoid" | undefined) => void;
    setRecurringRequest: (request: RecurringRequest | null) => void;
  }
  ```

## Data Models

### Type Definitions
```typescript
type SectionId = 'next' | 'activity' | 'calendar' | 'statics' | 'diary';
type ActivityKind = 'start' | 'complete' | 'skip' | 'pause';
type HabitAction = 'start' | 'complete' | 'pause';

interface Goal {
  id: string;
  name: string;
  details?: string;
  dueDate?: string | Date | null;
  parentId?: string | null;
  isCompleted?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Habit {
  id: string;
  goalId: string;
  name: string;
  active: boolean;
  type: "do" | "avoid";
  count: number;
  must?: number;
  completed?: boolean;
  lastCompletedAt?: string;
  duration?: number;
  reminders?: ({ kind: 'absolute'; time: string; weekdays: string[] } | { kind: 'relative'; minutesBefore: number })[];
  dueDate?: string;
  time?: string;
  endTime?: string;
  repeat?: string;
  allDay?: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface Activity {
  id: string;
  kind: ActivityKind;
  habitId: string;
  habitName: string;
  timestamp: string;
  amount?: number;
  prevCount?: number;
  newCount?: number;
  durationSeconds?: number;
}

interface HabitInitial {
  date?: string;
  time?: string;
  endTime?: string;
  type?: "do" | "avoid";
}

interface EventChanges {
  start?: string;
  end?: string;
  timingIndex?: number;
}

interface RecurringRequest {
  habitId: string;
  start?: string;
  end?: string;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Based on the prework analysis, most requirements are architectural concerns rather than functional behaviors. However, we can define properties for the critical functional preservation requirements:

### Property 1: State Synchronization Consistency
*For any* state change in the refactored system, all components that depend on that state should reflect the change consistently across the component tree.
**Validates: Requirements 4.3**

### Property 2: Functional Preservation - User Interactions
*For any* user interaction available in the original dashboard, the same interaction should be available and produce equivalent results in the refactored dashboard.
**Validates: Requirements 5.1, 5.2**

### Property 3: Authentication Flow Preservation
*For any* authentication operation (login, logout, session check), the refactored system should produce the same authentication state and behavior as the original system.
**Validates: Requirements 5.3**

### Property 4: Goal Management Preservation
*For any* goal management operation (create, update, delete, complete, toggle), the refactored system should produce the same goal state and side effects as the original system.
**Validates: Requirements 5.4**

### Property 5: Habit Management Preservation
*For any* habit management operation (create, update, delete, start, complete, pause), the refactored system should produce the same habit state and activity records as the original system.
**Validates: Requirements 5.5**

### Property 6: Activity Tracking Preservation
*For any* activity tracking operation (create, update, delete, propagate changes), the refactored system should maintain the same activity history and count calculations as the original system.
**Validates: Requirements 5.6**

### Property 7: Calendar Functionality Preservation
*For any* calendar operation (event display, drag/drop, resize, slot selection), the refactored system should produce the same calendar state and habit scheduling as the original system.
**Validates: Requirements 5.7**

### Property 8: Layout Management Preservation
*For any* layout management operation (section reordering, show/hide sections, persist layout), the refactored system should maintain the same layout configuration as the original system.
**Validates: Requirements 5.8**

## Error Handling

The refactored components will maintain the same error handling patterns as the original implementation:

- **API Failures**: Graceful degradation with console logging and fallback to local state
- **Authentication Errors**: Clear error messages and fallback to guest mode
- **Optimistic Updates**: Revert to previous state on persistence failures
- **Calendar Events**: Revert drag/drop operations for recurring events
- **Modal State**: Reset modal state on close to prevent stale data

## Testing Strategy

### Dual Testing Approach
The refactoring will use both unit tests and property-based tests to ensure comprehensive coverage:

- **Unit Tests**: Verify specific component behaviors, edge cases, and integration points
- **Property Tests**: Verify universal properties across all inputs and state combinations

### Property-Based Testing Configuration
- **Library**: @fast-check/jest for TypeScript/React components
- **Iterations**: Minimum 100 iterations per property test
- **Test Tags**: Each property test will reference its design document property
- **Tag Format**: `Feature: dashboard-refactoring, Property {number}: {property_text}`

### Unit Testing Focus
- Component rendering with various prop combinations
- Hook state transitions and side effects
- Error boundary behavior
- Modal state management
- Authentication flow edge cases
- Calendar event handling edge cases

### Integration Testing
- End-to-end user workflows (create goal → create habit → track activity)
- Cross-component state synchronization
- API integration with optimistic updates
- Layout persistence across browser sessions

### Refactoring Validation Strategy
1. **Baseline Capture**: Record original component behavior with comprehensive test suite
2. **Incremental Migration**: Refactor one component at a time while maintaining test coverage
3. **Behavioral Comparison**: Ensure refactored components pass all original tests
4. **Property Validation**: Run property tests to verify functional equivalence
5. **Performance Benchmarking**: Measure render performance before and after refactoring

<function_calls>
<invoke name="prework">
<parameter name="featureName">dashboard-refactoring