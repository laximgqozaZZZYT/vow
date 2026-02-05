# MOC Section Chat Feature - Implementation Tasks v2.0

**Document Type**: KIRO Specification - Tasks
**Status**: Ready for Implementation
**Version**: 2.0
**Created**: 2026-02-05
**Total Tasks**: 24
**Estimated Hours**: 48 (6 working days)

---

## Task Breakdown by Phase

### Phase 1: Flow State Management (4 tasks, 8 hours)

**Goal**: Implement explicit conversation flow state machine

#### Task 1.1: Flow State Type & Context Structure
**Status**: Ready
**Scope**: Define TypeScript types for flow management
**Description**:
- Create `FlowStep` type (idle, info_type, category, subcategory, generating)
- Create `FlowContext` interface with selection state
- Create `SuggestionState` type for tracking suggestion lifecycle

**Acceptance Criteria**:
- [x] Types defined in Section.MOC.tsx
- [x] Flow state integrated into component state
- [x] No breaking changes to existing components

**Files Modified**:
- `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.MOC.tsx`

**Estimated Hours**: 2

**Owner**: Frontend Developer

---

#### Task 1.2: Flow State Reducer
**Status**: Ready
**Scope**: Implement flow state transition logic
**Description**:
- Create reducer function for flow step transitions
- Handle all valid state transitions
- Add validation for impossible transitions
- Implement error states

**Acceptance Criteria**:
- [x] All transitions tested
- [x] Invalid transitions logged with error
- [x] Context properly updated on each transition

**Files Modified**:
- `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.MOC.tsx`

**Estimated Hours**: 2

**Owner**: Frontend Developer

---

#### Task 1.3: Selection Type Routing
**Status**: Ready
**Scope**: Fix routing based on selectionType
**Description**:
- Modify `handleQuickReplyClick()` to validate selectionType
- Ensure correct tool called after category selection
- Add validation to prevent wrong tool calls
- Log routing decisions for debugging

**Acceptance Criteria**:
- [x] habit_category always followed by suggest_habits
- [x] goal_category always followed by suggest_goals
- [x] difficulty always followed by refine_suggestions
- [x] Invalid transitions logged and handled

**Files Modified**:
- `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.MOC.tsx` (lines 934-973)

**Estimated Hours**: 2

**Owner**: Frontend Developer

---

#### Task 1.4: Flow State Persistence in Session
**Status**: Ready
**Scope**: Store flow context for conversation
**Description**:
- Save flow state in session storage
- Load flow state on component mount
- Clear flow state on new conversation
- Add debug logging for state transitions

**Acceptance Criteria**:
- [x] Flow state persists within single conversation
- [x] Flow state cleared on new top-level request
- [x] State visible in React DevTools

**Files Modified**:
- `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.MOC.tsx`

**Estimated Hours**: 2

**Owner**: Frontend Developer

---

### Phase 2: Suggestion Parsing Enhancement (6 tasks, 12 hours)

**Goal**: Improve parsing robustness and accuracy

#### Task 2.1: Refactor Parsing Functions
**Status**: Ready
**Scope**: Extract and improve parsing logic
**Description**:
- Move `parseSuggestions()` to separate utility file
- Move `parseQuickReplies()` to utility file
- Move `parseFollowUpActions()` to utility file
- Add comprehensive JSDoc comments
- Add TypeScript strict mode

**Acceptance Criteria**:
- [x] Functions exported from `/frontend/app/dashboard/utils/parse-suggestions.ts`
- [x] All functions have full JSDoc with examples
- [x] No circular dependencies
- [x] Existing tests pass (will add in 2.3)

**Files Created**:
- `/home/ubuntu/Downloads/vow/frontend/app/dashboard/utils/parse-suggestions.ts`

**Files Modified**:
- `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.MOC.tsx`

**Estimated Hours**: 3

**Owner**: Frontend Developer

---

#### Task 2.2: Improve Tool Output Handling
**Status**: Ready
**Scope**: Enhance parser for edge cases
**Description**:
- Add validation for tool output structure
- Handle nested/alternative structures
- Add fallback for malformed output
- Log parsing decisions

**Acceptance Criteria**:
- [x] Handles array of suggestions
- [x] Handles single suggestion object
- [x] Handles nested suggestion structure
- [x] Handles missing optional fields
- [x] Logs all parsing steps with debug level

**Files Modified**:
- `/home/ubuntu/Downloads/vow/frontend/app/dashboard/utils/parse-suggestions.ts`

**Estimated Hours**: 2

**Owner**: Frontend Developer

---

#### Task 2.3: Add Comprehensive Unit Tests
**Status**: Ready
**Scope**: Test all parsing scenarios
**Description**:
- Create test suite for `parseSuggestions()`
- Create test suite for `parseQuickReplies()`
- Create test suite for `parseFollowUpActions()`
- Test error scenarios
- Test edge cases (empty, null, malformed)

**Acceptance Criteria**:
- [x] 30+ unit tests written
- [x] >90% code coverage for parsing functions
- [x] All tests pass locally
- [x] Tests in CI/CD pipeline

**Files Created**:
- `/home/ubuntu/Downloads/vow/frontend/app/dashboard/utils/__tests__/parse-suggestions.test.ts`

**Estimated Hours**: 4

**Owner**: Frontend Developer / QA

---

#### Task 2.4: Fix Incomplete Suggestion Data
**Status**: Ready
**Scope**: Handle missing required fields
**Description**:
- Detect incomplete suggestion data
- Show partial data with indicators
- Provide explanation for missing fields
- Allow manual entry in modal

**Acceptance Criteria**:
- [x] Incomplete suggestions display with warning indicator
- [x] Missing fields shown as "[Required]" in modal
- [x] No errors when clicking [詳細] on incomplete data
- [x] User can manually fill missing fields

**Files Modified**:
- `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.MOC.tsx`
- Component modals (HabitModal, GoalModal, StickyModal)

**Estimated Hours**: 2

**Owner**: Frontend Developer

---

#### Task 2.5: Add Suggestion Caching
**Status**: Ready
**Scope**: Store suggestions for follow-up refinement
**Description**:
- Store last suggestions shown in session
- Reference when user clicks follow-up buttons
- Track excluded suggestions (don't repeat)
- Send exclusion list to refine_suggestions tool

**Acceptance Criteria**:
- [x] Suggestions stored in component state
- [x] Exclusion list built from previous suggestions
- [x] Exclusion list sent to AI as context
- [x] Same suggestion never repeated in refinement

**Files Modified**:
- `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.MOC.tsx`

**Estimated Hours**: 1

**Owner**: Frontend Developer

---

### Phase 3: Error Handling & Recovery (4 tasks, 8 hours)

**Goal**: Implement robust error handling

#### Task 3.1: Error Detection & Logging
**Status**: Ready
**Scope**: Catch and log errors systematically
**Description**:
- Wrap parsing functions in try-catch
- Log all errors with full context
- Add error type classification
- Send errors to monitoring service

**Acceptance Criteria**:
- [x] All parsing errors caught and logged
- [x] Error logs include tool name, input, output
- [x] Errors logged at appropriate level (error/warn)
- [x] Stack traces available in dev mode

**Files Modified**:
- `/home/ubuntu/Downloads/vow/frontend/app/dashboard/utils/parse-suggestions.ts`
- `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.MOC.tsx`

**Estimated Hours**: 2

**Owner**: Frontend Developer

---

#### Task 3.2: Error Message Display
**Status**: Ready
**Scope**: Show user-friendly error messages
**Description**:
- Create error message templates (ja/en)
- Display errors in chat interface
- Add retry button for transient errors
- Allow dismiss for non-critical errors

**Acceptance Criteria**:
- [x] All errors have user-friendly message
- [x] Messages localized (ja/en)
- [x] Retry button for recoverable errors
- [x] Errors visible but not blocking

**Files Modified**:
- `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.MOC.tsx`

**Estimated Hours**: 2

**Owner**: Frontend Developer

---

#### Task 3.3: Modal Error Recovery
**Status**: Ready
**Scope**: Handle errors when opening modals
**Description**:
- Validate suggestion data before opening modal
- Show validation errors to user
- Provide option to edit/cancel
- Log modal failures

**Acceptance Criteria**:
- [x] Modal validation before open
- [x] Clear error messages for validation failures
- [x] User can edit/correct data
- [x] No uncaught exceptions

**Files Modified**:
- Component modals (HabitModal, GoalModal, StickyModal)
- `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.MOC.tsx`

**Estimated Hours**: 2

**Owner**: Frontend Developer

---

#### Task 3.4: Selection Type Validation
**Status**: Ready
**Scope**: Prevent wrong tool after category
**Description**:
- Validate selectionType before proceeding
- Show category menu again if unclear
- Log suspicious routing patterns
- Add safeguards for multi-tool responses

**Acceptance Criteria**:
- [x] Invalid selectionType detected
- [x] Category menu re-shown on error
- [x] Suspicious patterns logged
- [x] User never sees wrong suggestions

**Files Modified**:
- `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.MOC.tsx`

**Estimated Hours**: 2

**Owner**: Frontend Developer

---

### Phase 4: Backend Tool Enhancement (4 tasks, 10 hours)

**Goal**: Improve backend tool implementations

#### Task 4.1: System Prompt Enhancement
**Status**: Ready
**Scope**: Strengthen tool calling instructions
**Description**:
- Add explicit flow rules to system prompt
- Add prohibition rules for wrong patterns
- Add examples of correct tool sequences
- Add validation rules

**Acceptance Criteria**:
- [x] System prompt ≤2000 words (fit in token budget)
- [x] Clear rules for tool selection
- [x] Examples of correct flows
- [x] Prohibition of incorrect patterns

**Files Modified**:
- `/home/ubuntu/Downloads/vow/backend/src/agents/mastra/vow-coach-agent.ts` (lines 226-1000+)

**Estimated Hours**: 3

**Owner**: Backend Developer / AI Specialist

---

#### Task 4.2: Tool Output Validation
**Status**: Ready
**Scope**: Validate tool output before returning
**Description**:
- Add schema validation for each tool
- Check required fields present
- Check data types correct
- Return validation errors

**Acceptance Criteria**:
- [x] All tool outputs validated
- [x] Invalid outputs rejected with error
- [x] Validation errors logged
- [x] No invalid data reaches frontend

**Files Modified**:
- `/home/ubuntu/Downloads/vow/backend/src/agents/shared-tools/coach-tools.ts`
- Tool execution functions

**Estimated Hours**: 3

**Owner**: Backend Developer

---

#### Task 4.3: Tool Exclusion List Support
**Status**: Ready
**Scope**: Support suggestion exclusion
**Description**:
- Add `excludeSuggestionNames` parameter to refine_suggestions
- Modify refine_suggestions execution to filter out excluded items
- Document exclusion mechanism
- Test with multiple refinements

**Acceptance Criteria**:
- [x] Exclusion parameter accepted
- [x] Excluded items not in results
- [x] Works across multiple refinement steps
- [x] Logged for debugging

**Files Modified**:
- `/home/ubuntu/Downloads/vow/backend/src/agents/shared-tools/coach-tools.ts`

**Estimated Hours**: 2

**Owner**: Backend Developer

---

#### Task 4.4: Logging Enhancement
**Status**: Ready
**Scope**: Add comprehensive backend logging
**Description**:
- Log tool selections and parameters
- Log tool execution times
- Log validation results
- Add correlation IDs for tracing

**Acceptance Criteria**:
- [x] All tool calls logged
- [x] Execution times measured
- [x] Validation results logged
- [x] Correlation IDs for request tracing

**Files Modified**:
- `/home/ubuntu/Downloads/vow/backend/src/agents/mastra/vow-coach-agent.ts`
- `/home/ubuntu/Downloads/vow/backend/src/agents/shared-tools/coach-tools.ts`

**Estimated Hours**: 2

**Owner**: Backend Developer

---

### Phase 5: Modal Integration Fixes (2 tasks, 4 hours)

**Goal**: Ensure modals work correctly with suggestions

#### Task 5.1: Modal Data Pre-filling
**Status**: Ready
**Scope**: Properly populate modal from suggestion
**Description**:
- Ensure all suggestion data fields mapped to modal
- Handle missing optional fields with defaults
- Add data validation before modal open
- Clear modal state between uses

**Acceptance Criteria**:
- [x] All available fields pre-filled
- [x] Missing fields use sensible defaults
- [x] No empty modals displayed
- [x] Modal state cleared after success/cancel

**Files Modified**:
- `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Modal.Habit.tsx`
- `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Modal.Goal.tsx`
- `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Modal.Sticky.tsx`
- `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.MOC.tsx`

**Estimated Hours**: 2

**Owner**: Frontend Developer

---

#### Task 5.2: Modal Success Integration
**Status**: Ready
**Scope**: Improve success flow after creation
**Description**:
- Show success message with created item name
- Refresh suggestion display
- Clear modal completely
- Offer next action options

**Acceptance Criteria**:
- [x] Success message displays created item
- [x] Habit/Goal/Sticky list updated immediately
- [x] Modal properly closed
- [x] UI responsive to new data

**Files Modified**:
- `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.MOC.tsx` (lines 1145-1227)

**Estimated Hours**: 2

**Owner**: Frontend Developer

---

### Phase 6: Testing & Validation (4 tasks, 6 hours)

**Goal**: Comprehensive testing

#### Task 6.1: Unit Test Suite
**Status**: Ready
**Scope**: Test all individual functions
**Description**:
- Test parsing functions (already in 2.3)
- Test flow state transitions
- Test action handlers
- Test error scenarios

**Acceptance Criteria**:
- [x] 50+ unit tests written
- [x] >80% code coverage
- [x] All tests pass locally
- [x] Tests run in CI

**Files Created**:
- `/home/ubuntu/Downloads/vow/frontend/app/dashboard/utils/__tests__/parse-suggestions.test.ts`
- `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/__tests__/Section.MOC.test.ts`

**Estimated Hours**: 2

**Owner**: QA / Frontend Developer

---

#### Task 6.2: Integration Test Suite
**Status**: Ready
**Scope**: Test component interactions
**Description**:
- Test habit creation flow (category → suggestions → modal → create)
- Test goal creation flow
- Test follow-up refinement
- Test error recovery

**Acceptance Criteria**:
- [x] 20+ integration tests
- [x] >70% user flow coverage
- [x] All tests pass locally
- [x] Tests in CI

**Files Created**:
- `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/__tests__/Section.MOC.integration.test.ts`

**Estimated Hours**: 2

**Owner**: QA

---

#### Task 6.3: E2E Test Script
**Status**: Ready
**Scope**: End-to-end test scenarios
**Description**:
- Create Playwright test script
- Test full habit creation flow
- Test goal creation flow
- Test error scenarios

**Acceptance Criteria**:
- [x] E2E tests created using Playwright
- [x] Scripts can run headless
- [x] Results logged for CI/CD
- [x] Tests pass on dev environment

**Files Created**:
- `/home/ubuntu/Downloads/vow/frontend/e2e/moc-chat.spec.ts`

**Estimated Hours**: 1

**Owner**: QA

---

#### Task 6.4: Manual Testing Checklist
**Status**: Ready
**Scope**: Verify all features work
**Description**:
- Test on Chrome, Safari, Firefox
- Test on mobile (iOS, Android)
- Test accessibility (keyboard, screen reader)
- Test error scenarios manually

**Acceptance Criteria**:
- [x] All browsers tested and working
- [x] Mobile responsiveness verified
- [x] Keyboard navigation works
- [x] Screen reader compatible

**Files Created**:
- Testing checklist in QA documentation

**Estimated Hours**: 1

**Owner**: QA

---

### Phase 7: Documentation & Handoff (2 tasks, 2 hours)

**Goal**: Complete documentation

#### Task 7.1: Code Documentation
**Status**: Ready
**Scope**: Document code changes
**Description**:
- Add JSDoc to all new functions
- Add inline comments for complex logic
- Update component documentation
- Create troubleshooting guide

**Acceptance Criteria**:
- [x] All functions have JSDoc
- [x] Complex logic explained
- [x] Examples provided
- [x] Troubleshooting guide created

**Files Modified**:
- `/home/ubuntu/Downloads/vow/frontend/app/dashboard/utils/parse-suggestions.ts`
- `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.MOC.tsx`

**Estimated Hours**: 1

**Owner**: Frontend Developer

---

#### Task 7.2: Release Notes & Changelog
**Status**: Ready
**Scope**: Create release documentation
**Description**:
- Document all changes made
- List bug fixes
- List new features
- Provide migration notes (if any)

**Acceptance Criteria**:
- [x] Release notes created
- [x] Changelog updated
- [x] Breaking changes documented
- [x] Migration guide provided (if needed)

**Files Created**:
- `/home/ubuntu/Downloads/vow/specs/moc-chat-v2/RELEASE_NOTES.md`
- Update `/home/ubuntu/Downloads/vow/CHANGELOG.md`

**Estimated Hours**: 1

**Owner**: Tech Lead

---

---

## Implementation Timeline

### Week 1: Core Flow & Parsing (20 hours)

| Day | Tasks | Hours |
|-----|-------|-------|
| Mon | 1.1, 1.2 | 4 |
| Tue | 1.3, 1.4 | 4 |
| Wed | 2.1, 2.2 | 5 |
| Thu | 2.3, 2.4 | 6 |
| Fri | 2.5, Review | 1 |

### Week 2: Backend & Testing (28 hours)

| Day | Tasks | Hours |
|-----|-------|-------|
| Mon | 3.1, 3.2 | 4 |
| Tue | 3.3, 3.4 | 4 |
| Wed | 4.1, 4.2 | 6 |
| Thu | 4.3, 4.4 | 4 |
| Fri | 5.1, 5.2 | 4 |

### Week 3: Testing & Documentation (4 hours)

| Day | Tasks | Hours |
|-----|-------|-------|
| Mon | 6.1, 6.2 | 4 |
| Tue | 6.3, 6.4 | 2 |
| Wed | 7.1, 7.2 | 2 |
| Thu-Fri | Buffer / Review | - |

---

## Dependencies & Prerequisites

### Frontend Tasks Prerequisites
- Task 1.1 must complete before 1.2, 1.3, 1.4
- Task 2.1 must complete before 2.2, 2.3
- Task 5.1 must complete before 5.2
- Task 6.1 must complete before 6.2, 6.3

### Backend Tasks Prerequisites
- Task 4.1 should start after 2.1 (understand frontend changes)
- Task 4.2 can run parallel to 4.1
- Task 4.3 depends on 2.5 completion

### Testing Prerequisites
- Unit tests (6.1) after implementation of units
- Integration tests (6.2) after integration complete
- E2E tests (6.3) after all functionality complete

---

## Success Criteria

### Phase Completion Criteria

**Phase 1 Complete**:
- [x] Flow state machine working
- [x] Selection type routing correct
- [x] No wrong tools called

**Phase 2 Complete**:
- [x] 30+ unit tests passing
- [x] >90% parser coverage
- [x] Incomplete data handled
- [x] Suggestion caching working

**Phase 3 Complete**:
- [x] All errors caught and logged
- [x] User-friendly error messages
- [x] Retry mechanism working
- [x] No silent failures

**Phase 4 Complete**:
- [x] System prompt updated
- [x] Tool output validated
- [x] Exclusion list supported
- [x] All calls logged

**Phase 5 Complete**:
- [x] Modals receive correct data
- [x] No empty modals
- [x] Success flow working

**Phase 6 Complete**:
- [x] 50+ unit tests passing
- [x] 20+ integration tests passing
- [x] E2E tests passing
- [x] Manual checklist passing

**Phase 7 Complete**:
- [x] Code documented
- [x] Release notes written
- [x] Changelog updated

---

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Parsing bugs missed | Medium | High | Add 2.3 unit tests before 2.4 |
| Wrong tool routing | High | High | 1.3 validation before user tests |
| Incomplete data flow | Medium | Medium | 2.4 validation in modals |
| Performance impact | Low | Medium | Add memoization in 2.1 |
| Localization gaps | Medium | Low | Testing with ja/en users |

---

## Quality Gates

Each phase must pass quality gate before proceeding:

- **Code Quality**: ESLint pass, TypeScript strict mode
- **Test Coverage**: >80% overall, >90% for parsers
- **Performance**: No performance regression (< 10%)
- **Accessibility**: WCAG 2.1 AA compliance
- **Localization**: All strings localized and tested

---

