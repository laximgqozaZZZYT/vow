# Design Document: Habit Modal View Modes

## Overview

This feature adds a view mode toggle to the Habit editing modal, allowing users to switch between a simplified "Normal View" and a comprehensive "Detail View". The Normal View displays only the most frequently used fields (name, timings, time/date, tags, description), while the Detail View shows all available fields. This improves usability by reducing cognitive load for common editing tasks while maintaining full access to advanced features.

## Architecture

The implementation follows a component-based architecture using React hooks for state management:

1. **View Mode State**: A React state variable (`viewMode`) tracks the current view ('normal' | 'detail')
2. **Local Storage Integration**: The `useLocalStorage` hook persists the user's view preference
3. **Conditional Rendering**: Sections are conditionally rendered based on the current view mode
4. **Expandable Sections**: Individual sections can be expanded in Normal View using local state

### Component Structure

```
HabitModal
├── Header (with View Toggle)
├── Scrollable Content Area
│   ├── Always Visible Fields
│   │   ├── Name
│   │   ├── Timings
│   │   ├── Tags
│   │   └── Description
│   └── Conditionally Visible Sections
│       ├── Workload (Detail View or Expanded)
│       ├── Outdates (Detail View or Expanded)
│       ├── Type (Detail View or Expanded)
│       ├── Goal (Detail View or Expanded)
│       └── Related Habits (Detail View or Expanded)
└── Footer (Save/Cancel/Delete buttons)
```

## Components and Interfaces

### State Management

```typescript
// View mode type
type ViewMode = 'normal' | 'detail'

// Expanded sections state (for Normal View)
type ExpandedSections = {
  workload: boolean
  outdates: boolean
  type: boolean
  goal: boolean
  relatedHabits: boolean
}

// Hook for view mode with persistence
const [viewMode, setViewMode] = useLocalStorage<ViewMode>('habitModalViewMode', 'normal')

// Hook for expanded sections (session-only, not persisted)
const [expandedSections, setExpandedSections] = useState<ExpandedSections>({
  workload: false,
  outdates: false,
  type: false,
  goal: false,
  relatedHabits: false
})
```

### View Toggle Component

```typescript
interface ViewToggleProps {
  viewMode: ViewMode
  onToggle: (mode: ViewMode) => void
}

function ViewToggle({ viewMode, onToggle }: ViewToggleProps) {
  return (
    <button
      onClick={() => onToggle(viewMode === 'normal' ? 'detail' : 'normal')}
      className="view-toggle-button"
      title={viewMode === 'normal' ? 'Switch to Detail View' : 'Switch to Normal View'}
    >
      {viewMode === 'normal' ? '詳細表示' : '通常表示'}
    </button>
  )
}
```

### Section Wrapper Component

```typescript
interface CollapsibleSectionProps {
  title: string
  isVisible: boolean
  isExpanded: boolean
  onToggleExpand: () => void
  children: React.ReactNode
}

function CollapsibleSection({
  title,
  isVisible,
  isExpanded,
  onToggleExpand,
  children
}: CollapsibleSectionProps) {
  if (isVisible) {
    return <div className="section">{children}</div>
  }
  
  return (
    <div className="collapsible-section">
      <button onClick={onToggleExpand} className="expand-button">
        {isExpanded ? '▼' : '▶'} {title}
      </button>
      {isExpanded && <div className="section-content">{children}</div>}
    </div>
  )
}
```

## Data Models

### View Mode Preference

Stored in localStorage:

```typescript
{
  key: 'habitModalViewMode',
  value: 'normal' | 'detail'
}
```

### Expanded Sections State

Session-only state (not persisted):

```typescript
{
  workload: boolean,
  outdates: boolean,
  type: boolean,
  goal: boolean,
  relatedHabits: boolean
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: View Mode Persistence

*For any* user session, if the user switches to Detail View and then closes and reopens the modal, the modal should open in Detail View.

**Validates: Requirements 5.1, 5.2**

### Property 2: Data Preservation Across View Switches

*For any* form field with user input, switching between Normal View and Detail View should preserve the field's value.

**Validates: Requirements 1.3**

### Property 3: Section Visibility in Normal View

*For any* section marked as hidden in Normal View (Workload, Outdates, Type, Goal, Related Habits), that section should not be visible in the DOM when viewMode is 'normal' and the section is not expanded.

**Validates: Requirements 2.6, 2.7, 2.8, 2.9, 2.10**

### Property 4: Section Visibility in Detail View

*For any* section in the modal, that section should be visible when viewMode is 'detail'.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

### Property 5: Expand/Collapse State Independence

*For any* expanded section in Normal View, collapsing and re-expanding that section should preserve the data entered in its fields.

**Validates: Requirements 4.4**

### Property 6: Default View Mode

*For any* new user or cleared localStorage, opening the Habit Modal should display Normal View by default.

**Validates: Requirements 1.1, 5.3**

### Property 7: Toggle Button Visibility

*For any* view mode, the View Toggle button should be visible and clickable in the modal header.

**Validates: Requirements 1.4**

### Property 8: Responsive Toggle Functionality

*For any* device viewport size, clicking the View Toggle should successfully switch between view modes.

**Validates: Requirements 6.1**

## Error Handling

### localStorage Unavailable

- **Scenario**: User's browser has localStorage disabled or unavailable
- **Handling**: Fall back to session-only state management, default to Normal View
- **User Impact**: View preference won't persist across sessions, but functionality remains intact

### Invalid Stored View Mode

- **Scenario**: localStorage contains an invalid value for 'habitModalViewMode'
- **Handling**: Reset to default 'normal' view and overwrite invalid value
- **User Impact**: Minimal - user sees Normal View and can switch as needed

### Rapid Toggle Clicks

- **Scenario**: User rapidly clicks the view toggle button
- **Handling**: Debounce or use React's state batching to prevent race conditions
- **User Impact**: Smooth transitions without flickering

## Testing Strategy

### Unit Tests

1. **View Toggle Rendering**: Verify toggle button renders with correct label based on current view mode
2. **View Mode State Changes**: Test that clicking toggle updates viewMode state correctly
3. **localStorage Integration**: Mock localStorage and verify read/write operations
4. **Section Visibility Logic**: Test conditional rendering logic for each section
5. **Expand/Collapse Functionality**: Verify individual section expand/collapse state management

### Property-Based Tests

Each property test should run a minimum of 100 iterations to ensure comprehensive coverage.

1. **Property 1 Test**: Generate random view mode selections, simulate modal close/reopen, verify persistence
   - **Tag**: Feature: habit-modal-view-modes, Property 1: View Mode Persistence

2. **Property 2 Test**: Generate random form data, switch views multiple times, verify all fields retain values
   - **Tag**: Feature: habit-modal-view-modes, Property 2: Data Preservation Across View Switches

3. **Property 3 Test**: For each hidden section, verify it's not in DOM when in Normal View and not expanded
   - **Tag**: Feature: habit-modal-view-modes, Property 3: Section Visibility in Normal View

4. **Property 4 Test**: Verify all sections are visible when viewMode is 'detail'
   - **Tag**: Feature: habit-modal-view-modes, Property 4: Section Visibility in Detail View

5. **Property 5 Test**: Generate random field values, expand section, enter data, collapse, re-expand, verify data
   - **Tag**: Feature: habit-modal-view-modes, Property 5: Expand/Collapse State Independence

6. **Property 6 Test**: Clear localStorage, open modal, verify Normal View is displayed
   - **Tag**: Feature: habit-modal-view-modes, Property 6: Default View Mode

7. **Property 7 Test**: For any view mode, verify toggle button exists and is clickable
   - **Tag**: Feature: habit-modal-view-modes, Property 7: Toggle Button Visibility

8. **Property 8 Test**: Generate random viewport sizes, verify toggle functionality works
   - **Tag**: Feature: habit-modal-view-modes, Property 8: Responsive Toggle Functionality

### Integration Tests

1. **Full Modal Workflow**: Open modal → switch to Detail View → fill all fields → save → reopen → verify Detail View and data
2. **Expand in Normal View**: Open in Normal View → expand Workload section → enter data → save → verify data persisted
3. **Mobile Interaction**: Test on mobile viewport → verify touch interactions work → verify scrolling behavior
4. **Cross-Browser localStorage**: Test localStorage persistence across different browsers

### Testing Framework

- **Unit Tests**: Jest + React Testing Library
- **Property-Based Tests**: fast-check (JavaScript property-based testing library)
- **Integration Tests**: Playwright for end-to-end testing
- **Minimum Iterations**: 100 per property test

## Implementation Notes

### CSS Transitions

Use CSS transitions for smooth view switching:

```css
.section {
  transition: opacity 0.2s ease-in-out, max-height 0.3s ease-in-out;
}

.section-entering {
  opacity: 0;
  max-height: 0;
}

.section-entered {
  opacity: 1;
  max-height: 1000px;
}
```

### Accessibility

- Ensure View Toggle button has proper ARIA labels
- Use semantic HTML for expand/collapse controls
- Maintain keyboard navigation support
- Announce view mode changes to screen readers

### Performance Considerations

- Use React.memo for section components to prevent unnecessary re-renders
- Lazy render collapsed sections (don't mount until expanded)
- Debounce localStorage writes if user rapidly toggles views

### Mobile Optimization

- Increase touch target size for toggle button (min 44x44px)
- Ensure expand/collapse buttons are easily tappable
- Test scrolling behavior with expanded sections on small screens
- Consider using a slide-in animation for expanded sections on mobile
