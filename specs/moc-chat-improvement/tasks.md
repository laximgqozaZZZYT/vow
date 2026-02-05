# MOC Section Chat Improvement - Implementation Tasks

## Overview
- **Feature**: MOC Section Chat Improvement
- **Status**: Ready for Implementation
- **Estimated Effort**: 5-7 days
- **Primary File**: `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.MOC.tsx`

---

## Task Breakdown

### Phase 1: Foundation (Day 1-2)

#### Task 1.1: Type Definitions Update
- **Priority**: P0 (Blocker)
- **Estimated**: 1 hour
- **Assignable**: Any agent
- **File**: `Section.MOC.tsx` (Lines 57-117)

**Changes:**
```typescript
// Add to RefineActionType
export type RefineActionType =
  | 'more_specific'
  | 'easier'
  | 'harder'
  | 'different'
  | 'more_suggestions'
  | 'different_habit'
  | 'more_general';  // NEW

// Add new types for conversation flow
export type InfoTypeSelection =
  | 'review_habits'
  | 'habits_for_goal'
  | 'new_goal'
  | 'new_habit'
  | 'check_registered'
  | 'other_advice';

export type FlowStep =
  | 'idle'
  | 'info_type'
  | 'category'
  | 'subcategory'
  | 'generating';
```

**Acceptance Criteria:**
- [ ] New types compile without errors
- [ ] Existing functionality unaffected

---

#### Task 1.2: Conversation Memory Hook
- **Priority**: P0 (Blocker)
- **Estimated**: 3 hours
- **Assignable**: Any agent
- **File**: New file `useConversationMemory.ts`

**Create new hook:**
```typescript
// frontend/app/dashboard/hooks/useConversationMemory.ts
export function useConversationMemory() {
  // Implementation as per design.md
}
```

**Acceptance Criteria:**
- [ ] Hook manages conversation context state
- [ ] State transitions work correctly
- [ ] Previous suggestions are tracked (max 20)
- [ ] Reset function clears all state

---

#### Task 1.3: Question Flow Configuration
- **Priority**: P1
- **Estimated**: 2 hours
- **Assignable**: Any agent
- **File**: New file or constant in `Section.MOC.tsx`

**Create configuration:**
```typescript
const QUESTION_FLOW_CONFIG: QuestionFlowConfig = {
  infoTypeOptions: [
    { id: 'review_habits', label: { ja: '既存Habitの見直し', en: 'Review existing Habits' }, icon: '📋', nextStep: 'show_habits' },
    // ... other options
  ],
  // ... categories and sub-categories
};
```

**Acceptance Criteria:**
- [ ] All 6 info type options defined
- [ ] All 8 categories defined
- [ ] Sub-categories defined for each category
- [ ] Localization for ja/en

---

### Phase 2: UI Components (Day 2-3)

#### Task 2.1: SuggestionCard Button Layout Update
- **Priority**: P1
- **Estimated**: 3 hours
- **Assignable**: Frontend developer
- **File**: `Section.MOC.tsx` (Lines 3370-3600)

**Changes:**
1. Add [採用] button (explicit, replaces card click)
2. Add [却下] button (rename from dismiss)
3. Add [詳細] indicator with arrow
4. Update button styling per design

**Acceptance Criteria:**
- [ ] [採用] button visible and clickable
- [ ] [却下] button visible and clickable
- [ ] [詳細] opens same modal as [採用]
- [ ] Reply type cards have no action buttons
- [ ] Styling matches design mockup

---

#### Task 2.2: FollowUpActionButtons Update
- **Priority**: P1
- **Estimated**: 2 hours
- **Assignable**: Frontend developer
- **File**: `Section.MOC.tsx` (Lines 3351-3365)

**Changes:**
1. Add [もっと一般的に] button
2. Reorder buttons per design
3. Update button styling

**Acceptance Criteria:**
- [ ] [もっと具体的に] button present
- [ ] [もっと一般的に] button present
- [ ] All buttons send correct action to AI
- [ ] Buttons disabled when no suggestions shown

---

#### Task 2.3: Info Type Selection UI
- **Priority**: P1
- **Estimated**: 2 hours
- **Assignable**: Frontend developer
- **File**: `Section.MOC.tsx` or new component

**Create QuickReply buttons for Step 1:**
```typescript
const InfoTypeButtons = ({ onSelect, locale }) => (
  <div className="grid grid-cols-2 gap-2">
    {QUESTION_FLOW_CONFIG.infoTypeOptions.map(option => (
      <button
        key={option.id}
        onClick={() => onSelect(option.id)}
        className="..."
      >
        {option.icon} {option.label[locale]}
      </button>
    ))}
  </div>
);
```

**Acceptance Criteria:**
- [ ] 6 buttons displayed in 2-column grid
- [ ] Each button has icon and label
- [ ] Click triggers appropriate next step
- [ ] Accessible with keyboard

---

### Phase 3: Logic Integration (Day 3-4)

#### Task 3.1: handleSuggestionAction Update
- **Priority**: P1
- **Estimated**: 2 hours
- **Assignable**: Any agent
- **File**: `Section.MOC.tsx` (Lines 820-1012)

**Changes:**
1. Ensure all 4 button types handled correctly
2. Add explicit 'adopt' action handling
3. Update 'dismiss' to 'reject' terminology

**Acceptance Criteria:**
- [ ] habit -> HabitModal
- [ ] goal -> GoalModal
- [ ] stickyn -> StickyModal
- [ ] reply -> sendMessage
- [ ] Reject marks as dismissed

---

#### Task 3.2: handleFollowUpActionClick Update
- **Priority**: P1
- **Estimated**: 2 hours
- **Assignable**: Any agent
- **File**: `Section.MOC.tsx` (Lines 1093-1180)

**Changes:**
1. Add 'more_general' action handling
2. Include conversation context in AI request
3. Use conversation memory hook

**Acceptance Criteria:**
- [ ] 'more_general' action sends correct prompt
- [ ] Context from conversation memory included
- [ ] Previous suggestions excluded from new results

---

#### Task 3.3: Question Flow Integration
- **Priority**: P1
- **Estimated**: 4 hours
- **Assignable**: Any agent
- **File**: `Section.MOC.tsx`

**Changes:**
1. Detect initial conversation state
2. Show Step 1 buttons when starting
3. Progress through flow based on selections
4. Integrate with AI agent for suggestions

**Acceptance Criteria:**
- [ ] New conversation shows Step 1 options
- [ ] Selection progresses to next step
- [ ] Final step generates appropriate suggestions
- [ ] Flow can be reset

---

### Phase 4: Polish & Testing (Day 4-5)

#### Task 4.1: Localization Review
- **Priority**: P2
- **Estimated**: 1 hour
- **Assignable**: Any agent

**Changes:**
1. Verify all new strings have ja/en
2. Check button labels
3. Check system messages

**Acceptance Criteria:**
- [ ] All new UI text supports ja/en
- [ ] No hardcoded Japanese strings
- [ ] Locale switch works correctly

---

#### Task 4.2: Accessibility Audit
- **Priority**: P2
- **Estimated**: 2 hours
- **Assignable**: Any agent

**Changes:**
1. Add aria-labels to new buttons
2. Verify keyboard navigation
3. Check focus states

**Acceptance Criteria:**
- [ ] All buttons have aria-label
- [ ] Tab navigation works
- [ ] Focus visible on all interactive elements

---

#### Task 4.3: Unit Tests
- **Priority**: P2
- **Estimated**: 3 hours
- **Assignable**: Tester agent

**Tests to create:**
1. useConversationMemory hook tests
2. SuggestionCard component tests
3. Question flow state tests

**Acceptance Criteria:**
- [ ] Hook tests pass
- [ ] Component tests pass
- [ ] Coverage > 80%

---

#### Task 4.4: Integration Testing
- **Priority**: P2
- **Estimated**: 2 hours
- **Assignable**: Tester agent

**Tests to perform:**
1. Full question flow
2. Modal transitions
3. AI response handling

**Acceptance Criteria:**
- [ ] Flow tests pass
- [ ] No console errors
- [ ] Performance acceptable

---

## Task Dependencies

```
Task 1.1 (Types)
    ↓
Task 1.2 (Hook) ──────────────────────┐
    ↓                                  │
Task 1.3 (Config)                      │
    ↓                                  │
Task 2.1 (SuggestionCard) ─────────────┤
Task 2.2 (FollowUpActions)             │
Task 2.3 (InfoType UI)                 │
    ↓                                  │
Task 3.1 (handleSuggestionAction)      │
Task 3.2 (handleFollowUpAction) ←──────┘
Task 3.3 (Question Flow)
    ↓
Task 4.1 (Localization)
Task 4.2 (Accessibility)
Task 4.3 (Unit Tests)
Task 4.4 (Integration Tests)
```

---

## Estimated Timeline

| Day | Tasks | Hours |
|-----|-------|-------|
| 1 | 1.1, 1.2 | 4 |
| 2 | 1.3, 2.1 | 5 |
| 3 | 2.2, 2.3, 3.1 | 6 |
| 4 | 3.2, 3.3 | 6 |
| 5 | 4.1, 4.2, 4.3, 4.4 | 8 |

**Total Estimated Hours**: 29 hours (5 working days)

---

## File Lock Schedule

| Time Slot | File | Owner |
|-----------|------|-------|
| Day 1-2 | Types/Hooks | Agent A |
| Day 2-3 | Section.MOC.tsx UI | Agent B |
| Day 3-4 | Section.MOC.tsx Logic | Agent A or B (exclusive) |
| Day 4-5 | Tests | Agent C |

---

## Completion Checklist

### Phase 1
- [ ] Task 1.1: Type definitions updated
- [ ] Task 1.2: useConversationMemory hook created
- [ ] Task 1.3: Question flow config defined

### Phase 2
- [ ] Task 2.1: SuggestionCard buttons updated
- [ ] Task 2.2: FollowUpActionButtons updated
- [ ] Task 2.3: Info type selection UI created

### Phase 3
- [ ] Task 3.1: handleSuggestionAction updated
- [ ] Task 3.2: handleFollowUpActionClick updated
- [ ] Task 3.3: Question flow integrated

### Phase 4
- [ ] Task 4.1: Localization complete
- [ ] Task 4.2: Accessibility verified
- [ ] Task 4.3: Unit tests passing
- [ ] Task 4.4: Integration tests passing

---

## Definition of Done

1. All acceptance criteria met
2. No TypeScript errors
3. No ESLint warnings
4. Tests passing (> 80% coverage)
5. Code reviewed by another agent
6. Documentation updated
7. COORDINATION.md updated
