# E2E MOC Validation - Current Status Analysis

## Overview
- **Analysis Date**: 2026-02-05
- **Scope**: Existing E2E test infrastructure and MOCチャット機能
- **Purpose**: Identify gaps and design enhancement requirements

---

## Existing E2E Test Infrastructure

### File Structure

```
frontend/e2e/
├── fixtures/
│   ├── chat.fixture.ts           (1) Chat test context
│   ├── auth.fixture.ts           (2) Authentication fixture
│
├── page-objects/
│   ├── BasePage.ts               (3) Base class for page objects
│   ├── LoginPage.ts              (4) Login/OAuth handling
│   ├── MOCSectionPage.ts         (5) MOC chat operations
│
├── utils/
│   ├── chat-logger.ts            (6) Chat conversation logging
│   ├── test-data.ts              (7) Test scenarios and constants
│   ├── test-helpers.ts           (Optional) Reusable test patterns
│
├── tests/
│   ├── auth/
│   │   └── oauth-login.spec.ts   (8) OAuth login verification
│   │
│   ├── chat/
│   │   ├── basic-chat.spec.ts    (9) Basic message sending
│   │   ├── suggestion-buttons.spec.ts (10) Suggestion type verification
│   │   ├── suggestion-actions.spec.ts (11) Accept/reject/snooze
│   │   ├── quick-reply.spec.ts   (12) Quick reply interaction
│   │   ├── scenarios/
│   │   │   ├── health-exercise.spec.ts (13) Multi-step flow example
│   │   │   ├── learning-reading.spec.ts
│   │   │   └── productivity-tasks.spec.ts
│   │
│   └── chat/              <- MOC-specific new tests
│       ├── moc-chat-flow.spec.ts (NEW)
│       ├── moc-candidates.spec.ts (NEW)
│       ├── moc-actions.spec.ts (NEW)
│       ├── moc-multi-select.spec.ts (NEW)
│       └── moc-refinement.spec.ts (NEW)
│
├── global-setup.ts               (14) Global test setup
└── playwright.config.ts          (15) Playwright configuration
```

### Key Components Analysis

#### 1. Chat Fixture (`chat.fixture.ts`)

**Current Capabilities**:
- ✅ Extends auth fixture with authenticated page
- ✅ Creates MOCSectionPage instance
- ✅ Provides ChatLogger for each test

**Limitations**:
- ❌ No retry mechanism for MOCPage.goto()
- ❌ No error handling if chat doesn't load
- ❌ Missing test isolation (state carries between tests in some cases)

**Grade**: B (Functional, needs robustness)

#### 2. Authentication Fixture (`auth.fixture.ts`)

**Current Capabilities**:
- ✅ Loads stored auth state from `.auth/user.json`
- ✅ Tries to verify auth by accessing dashboard
- ✅ Falls back to unauthenticated context

**Limitations**:
- ❌ No automatic re-authentication if token expired
- ❌ Manual OAuth flow required for first-time setup
- ❌ No environment variable support for CI tokens
- ❌ Session validation is basic (only URL check)
- ❌ No retry mechanism for auth verification

**Grade**: C+ (Works for local dev, weak for CI/CD)

#### 3. MOCSectionPage (`MOCSectionPage.ts`)

**Current Capabilities**:
- ✅ Basic chat navigation and message sending
- ✅ AI response waiting with timeout
- ✅ Suggestion card detection and extraction
- ✅ Quick reply button detection
- ✅ Individual accept/snooze/dismiss actions
- ✅ Type badge detection
- ✅ Message counting and retrieval

**Limitations**:
- ❌ No multi-selection checkbox support
- ❌ No batch operation methods (register selected, refine selected)
- ❌ Badge color extraction is fragile (class-based)
- ❌ No refinement button methods ("もっと具体的に" etc.)
- ❌ No scenario flow helpers
- ❌ Selectors use flexible patterns (may match unintended elements)

**Grade**: B- (Good foundation, missing advanced features)

```
Existing Methods (15 public):
✅ goto()                      - Navigate to MOC section
✅ waitForLoad()               - Wait for chat input ready
✅ sendMessage()               - Send chat message
✅ waitForResponse()           - Wait for AI response
✅ getSuggestionCards()        - Get all suggestions with info
✅ getQuickReplies()           - Get quick reply buttons
✅ clickQuickReply()           - Click a quick reply
✅ clickSuggestionCard()       - Click suggestion
✅ acceptSuggestion()          - Accept suggestion (open modal)
✅ snoozeSuggestion()          - Snooze suggestion
✅ dismissSuggestion()         - Dismiss suggestion
✅ getMessageCount()           - Count messages
✅ getLastMessageContent()     - Get last message
✅ isLoading()                 - Check if loading
✅ verifySuggestionTypeBadge() - Verify badge color

Missing Methods (needed):
❌ toggleSuggestionCheckbox()
❌ selectAllSuggestions()
❌ clearAllSelections()
❌ getSelectedSuggestionCount()
❌ getSelectedSuggestionIndices()
❌ clickRefineButton()
❌ clickBatchRegisterButton()
❌ getAllActionButtons()
❌ getSuggestionBadgeInfo()
❌ verifyBadgeColors()
❌ getSuggestionBadgeLabel()
❌ Logging helper methods (2)
```

#### 4. ChatLogger (`chat-logger.ts`)

**Current Capabilities**:
- ✅ Records test ID, timestamp, scenario name
- ✅ Tracks messages (user/assistant/system)
- ✅ Logs suggestions with type and status
- ✅ Records quick replies with selection state
- ✅ Saves to JSON with summary
- ✅ Tracks test status and errors

**Limitations**:
- ❌ Suggestion card missing: badge info, action buttons, detailed type
- ❌ User action tracking minimal (no selection/click details)
- ❌ No scenario metadata (selected categories, flow path)
- ❌ Quick reply value not captured
- ❌ No locale tracking
- ❌ Badge color/label not logged

**Grade**: B (Good foundation, needs enhancement)

```
Current Fields in ChatMessage:
{
  id, role, content, timestamp,
  suggestions?: [{ type, name, status }],
  quickReplies?: [{ label, selected }]
}

Missing Fields:
❌ suggestions[].id
❌ suggestions[].badgeColor
❌ suggestions[].badgeLabel
❌ suggestions[].actionButtons[]
❌ quickReplies[].value
❌ userActions[] (selection, button clicks)
```

#### 5. Test Data (`test-data.ts`)

**Current Capabilities**:
- ✅ 6 test scenarios defined
- ✅ Badge colors mapped by type
- ✅ Badge labels for each type
- ✅ Helper functions (getScenariosByCategory, getScenarioById)

**Limitations**:
- ❌ Scenarios missing expected badge colors
- ❌ Scenarios missing action button expectations
- ❌ No refinement action definitions
- ❌ Multi-select scenario flag missing
- ❌ Expected locale variant labels missing

**Grade**: B- (Functional, incomplete for new requirements)

#### 6. Existing Tests

**Analysis of Test Coverage**:

| Test File | Purpose | Status | Grade | Notes |
|-----------|---------|--------|-------|-------|
| `oauth-login.spec.ts` | OAuth flow verification | Partial | C+ | Manual step required, skips in CI |
| `basic-chat.spec.ts` | Basic messaging | ✅ Complete | A- | Good patterns |
| `suggestion-buttons.spec.ts` | Type badge verification | ✅ Complete | B+ | Basic color check, no batch ops |
| `suggestion-actions.spec.ts` | Accept/reject/snooze | Skipped | C | Tests marked as skip |
| `quick-reply.spec.ts` | Quick reply interaction | ✅ Complete | A- | Good patterns |
| `health-exercise.spec.ts` | Multi-step flow | ✅ Complete | B+ | Good example, but brittle |

**Overall Test Strength**: B- (50-60% of MOC functionality covered)

---

## Gap Analysis

### Authentication Gaps

| Gap | Impact | Severity | Solution |
|-----|--------|----------|----------|
| No CI-compatible auto-auth | CI/CD pipeline blocked | **Critical** | Add env var support for test tokens |
| Session expiry not detected | Tests fail mysteriously | High | Add refresh token + retry logic |
| Manual OAuth required | Dev setup friction | Medium | Document setup flow + provide shortcuts |

### Page Object Gaps

| Gap | Impact | Severity | Solution |
|-----|--------|----------|----------|
| No multi-select methods | Cannot test batch operations | **Critical** | Add 5 new methods for checkbox ops |
| No refinement button methods | Cannot test adjustment features | High | Add clickRefineButton() + helpers |
| Fragile badge detection | Tests fail with UI changes | High | Add getSuggestionBadgeInfo() with multiple selectors |
| No action button enumeration | Cannot verify available actions | High | Add getAllActionButtons() |
| Limited error handling | Tests crash on missing elements | Medium | Add fallback selectors + better errors |

### Test Scenario Gaps

| Gap | Impact | Severity | Solution |
|-----|--------|----------|----------|
| Missing multi-select scenarios | Batch ops untested | High | Add moc-multi-select.spec.ts |
| Missing refinement scenarios | Adjustment features untested | High | Add moc-refinement.spec.ts |
| Weak flow guidance | Hard to add new scenarios | Medium | Add test helpers + templates |
| No scenario templating | New tests take hours | Medium | Create runGuidedSelectionFlow() helper |

### Logging Gaps

| Gap | Impact | Severity | Solution |
|-----|--------|----------|----------|
| No badge info logging | Hard to debug badge issues | Medium | Extend ChatMessage interface |
| No action tracking | Cannot trace user interactions | Medium | Add userActions array |
| No scenario metadata | Cannot analyze test flows | Medium | Add scenarioMetadata to ChatLog |
| No locale tracking | Multi-lang testing unclear | Low | Add locale field |

### CI/CD Gaps

| Gap | Impact | Severity | Solution |
|-----|--------|----------|----------|
| No workflow defined | Tests don't run in CI | **Critical** | Create GitHub Actions workflow |
| No auth token support | CI tests cannot authenticate | **Critical** | Add env var to auth.fixture.ts |
| No result reporting | PR visibility limited | High | Add GitHub comment step |
| No artifact retention | Logs not accessible after run | Medium | Configure artifact retention |

---

## Existing Test Patterns

### Pattern 1: Basic Flow (Most Common)

```typescript
// Pattern observed in basic-chat.spec.ts, health-exercise.spec.ts
test('scenario description', async ({ mocPage, chatLogger }) => {
  // 1. Send message
  chatLogger.logUserMessage(message);
  await mocPage.sendMessage(message);

  // 2. Wait for response
  await mocPage.waitForResponse(30000);

  // 3. Get and verify response
  const response = await mocPage.getLastMessageContent();
  const suggestions = await mocPage.getSuggestionCards();
  expect(suggestions.length).toBeGreaterThan(0);

  // 4. Log and screenshot
  chatLogger.logAssistantMessage(response, suggestions);
  await mocPage.screenshot('step-name');
});
```

**Strength**: Simple, clear flow
**Weakness**: Repetitive, no reusability

### Pattern 2: Multi-Step Flow

```typescript
// Pattern observed in health-exercise.spec.ts (lines 13-118)
// Multiple message exchanges with quick replies
for (let step = 0; step < steps; step++) {
  // Send message or click quick reply
  // Wait for response
  // Extract suggestions/quick replies
  // Log and continue
}
```

**Strength**: Shows realistic user flow
**Weakness**: Complex, hard to debug failures mid-flow

### Pattern 3: Assertion Pattern

```typescript
// Most tests use this for verification
const suggestions = await mocPage.getSuggestionCards();
expect(suggestions.length).toBeGreaterThan(0);

const habitSuggestions = suggestions.filter(s => s.type === 'habit');
expect(habitSuggestions.length).toBeGreaterThan(0);
```

**Strength**: Clear assertions
**Weakness**: No helper for common checks

---

## Frontend Component Status

### MOC Section Component (`Section.MOC.tsx`)

**Existing Features**:
- ✅ Chat message display
- ✅ Suggestion card rendering (4 types: Habit/Goal/Sticky'n/Reply)
- ✅ Type badge display with colors
- ✅ Individual action buttons (accept/snooze/dismiss)
- ✅ Quick reply button rendering
- ✅ Modal opening for detailed edit

**Upcoming Features** (per suggestion-button-enhancement spec):
- 🔄 SuggestionCard: Add selection checkbox
- 🔄 ActionButtonGroup: Add refinement buttons
- 🔄 RegisterButton: Batch operation button
- 🔄 SuggestionCardGroup: Grouping with multi-select

**Expected Changes Impact on Tests**:
- New checkbox selectors: `input[type="checkbox"]` in suggestion cards
- New button text: "もっと具体的に", "登録"
- New UI structure: flex layout for checkboxes
- State management: ring-primary class for selected cards

**Test Readiness**: 70% (core functionality exists, new UI will require selector updates)

---

## Recommended Implementation Order

### Phase Priority Matrix

```
╔════════════════════════════════════════════╗
║ MUST DO FIRST (Critical Path)              ║
║ ① Page Object Extensions (3-4 hours)       ║
║   └─ Needed by all new tests               ║
║ ② ChatLogger Enhancement (1.5 hours)       ║
║   └─ Needed for comprehensive logging      ║
║ ③ Basic Test Scenarios (2-3 hours)         ║
║   └─ Validate page objects work            ║
╚════════════════════════════════════════════╝

╔════════════════════════════════════════════╗
║ THEN DO (Important Features)                ║
║ ④ Advanced Test Scenarios (5-6 hours)      ║
║   ├─ Multi-select tests                    ║
║   ├─ Refinement tests                      ║
║   └─ Candidate verification tests          ║
║ ⑤ CI/CD Integration (1.5 hours)            ║
╚════════════════════════════════════════════╝
```

---

## Selector Analysis

### Current Selectors Used

| Element | Current Selector | Robustness | Recommendation |
|---------|------------------|-----------|-----------------|
| Chat Input | `input[placeholder*="メッセージを入力"]` | Medium | Add data-testid fallback |
| Send Button | `button:has(svg[stroke="currentColor"])` | Low | Fragile, needs class-based or data-* |
| Suggestion Card | `[class*="suggestion"][data-testid*="suggestion"]` | High | Good multi-selector |
| Type Badge | `span[class*="px-1.5"][class*="py-0.5"]` | Medium | Specific but may miss variants |
| Quick Reply | `[class*="quick-reply"]` | High | Good fallback pattern |
| Loading Indicator | `[class*="animate-spin"]` | High | Works well |

### Recommended Additions for New Features

```typescript
// Multi-select elements
'input[type="checkbox"]'                    // Generic checkbox
'input[type="checkbox"]:checked'            // Selected checkbox
'[class*="ring-primary"]'                   // Selected card highlight
'[class*="SelectAllToggle"]'                // Select all button

// Action elements
'button:has-text("もっと具体的に")'         // Refinement button
'button:has-text("選択した候補を登録")'     // Batch register
'[class*="ActionButtonGroup"]'              // Action button container

// If component adds data attributes (recommended)
'[data-suggestion-index]'                   // Suggestion index
'[data-suggestion-type]'                    // Type indicator
'[data-action="refine"]'                    // Refinement action
```

---

## Compatibility Checklist

### Frontend Changes Needed (from Section.MOC.tsx perspective)

- ✅ Existing selectors: No breaking changes expected
- 🔄 New selectors needed:
  - Checkbox inputs in suggestion cards
  - "Select All" toggle
  - Refinement action buttons
  - Batch register button
- ⚠️ Recommendation: Add `data-*` attributes for test stability

### Browser Support

- ✅ Chrome/Chromium: Fully supported
- ⚠️ Firefox/Safari: Not configured in playwright.config.ts (can add if needed)
- ℹ️ Current config: Desktop Chrome only

### Network & Performance

- ✅ 30-second timeout: Reasonable for chat API responses
- ✅ 60-second test timeout: Good for multi-step flows
- ⚠️ No request interception: All tests hit real backend

---

## Risk Assessment

### High Risk Areas

| Area | Risk | Mitigation |
|------|------|-----------|
| OAuth Token Expiry in CI | Token refresh fails, tests fail | Implement refresh logic with retries |
| Selector Brittleness | UI changes break selectors | Add data-testid attributes to components |
| Timing Issues in Multi-Select | Race conditions in batch ops | Add proper wait conditions |
| Backend Response Variability | Different suggestions each run | Use scenario-based assertions (count > 0, not exact match) |

### Medium Risk Areas

| Area | Risk | Mitigation |
|------|------|-----------|
| Test Parallelization | Shared state issues | Keep tests independent, use unique IDs |
| Log File Size | Disk usage grows | Implement log rotation (30-day retention) |
| Flaky Quick Reply Tests | Button labels vary | Use data attributes instead of text matching |

---

## Resource Requirements

### Development Tools
- Playwright 1.40+: ✅ Already in use
- Node.js 18+: ✅ Already in use
- TypeScript: ✅ Already configured
- Jest (for unit tests): Optional

### Infrastructure
- Local dev: 2GB RAM, 1GB disk (for logs/artifacts)
- CI runner: 4GB RAM, 2GB disk
- Storage: 100MB per test run (~30 runs = 3GB/month)

### Personnel
- **Tester**: 17-20 hours (main implementation)
- **DevOps**: 1-2 hours (CI/CD setup)
- **Frontend**: 0-2 hours (optional selector additions)

---

## Success Metrics

### Before Enhancement
- ✅ Tests: 11 total
- ⚠️ MOC coverage: 50-60%
- ⚠️ Multi-select: 0% (untested)
- ⚠️ Refinement: 0% (untested)
- ⚠️ CI/CD: Not integrated

### After Enhancement (Target)
- ✅ Tests: 15+ total
- ✅ MOC coverage: 85-90%
- ✅ Multi-select: 100% (5+ tests)
- ✅ Refinement: 100% (3+ tests)
- ✅ CI/CD: Fully integrated
- ✅ Success rate: 95%+

---

## Conclusion

**Current State**: Solid foundation with good basic test patterns, but missing advanced features for modern MOC functionality.

**Recommendation**: Proceed with proposed 8-phase enhancement plan. The existing infrastructure is well-structured and can be extended without major refactoring.

**Timeline**: 20-24 hours total (spread across 1-2 sprints depending on parallelization)

**Quick Wins** (achievable in first 4-6 hours):
1. Page Object method extensions (Task 1.1-1.4)
2. ChatLogger enhancements (Task 2.1-2.3)
3. Basic flow test (Task 3.1)
4. Candidate verification test (Task 4.1)

**Full Solution** achievable in 2-3 weeks with dedicated tester.

