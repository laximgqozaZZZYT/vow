# E2E MOC Validation - Technical Design

## Overview
- **Feature Name**: E2E テスト基盤強化・MOCチャット機能自動検証
- **Status**: Draft
- **Version**: 1.0.0
- **Created**: 2026-02-05
- **Author**: researcher

---

## Architecture Overview

### Test Layer Structure

```
┌─────────────────────────────────────────────────────────┐
│               Test Specifications (*.spec.ts)           │
│                                                          │
│  moc-chat-flow.spec.ts    moc-candidates.spec.ts        │
│  moc-actions.spec.ts      moc-multi-select.spec.ts      │
└────────────────┬──────────────────────────────────────┬─┘
                 │                                      │
┌────────────────▼─────────────────────────────────────▼─┐
│           Chat Fixture + Fixtures & Utilities           │
│                                                          │
│  chat.fixture.ts          test-data.ts                  │
│  (authContext)            (scenarios, labels)           │
└────────────────┬──────────────────────────────────────┬─┘
                 │                                      │
┌────────────────▼──────────────────────────────────────▼┐
│              Page Object Layer (MOC Page)              │
│                                                         │
│  MOCSectionPage.ts (Core)                              │
│  ├─ Navigation & Init                                  │
│  ├─ Chat Message Handling                              │
│  ├─ Suggestion Card Manipulation                       │
│  ├─ Multi-Select Operations                            │
│  ├─ Action Button Interactions                         │
│  └─ Logging & Assertion Helpers                        │
└────────────────┬──────────────────────────────────────┬─┘
                 │                                      │
┌────────────────▼──────────────────────────────────────▼┐
│        Playwright Browser Automation                    │
│  Selector-based element interactions                   │
└────────────────┬──────────────────────────────────────┬─┘
                 │                                      │
┌────────────────▼──────────────────────────────────────▼┐
│      Frontend Application (localhost:3000)             │
│  MOC Chat Section with suggestions                     │
└──────────────────────────────────────────────────────┘
```

### Authentication Flow

```
┌─────────────────────────────────────────┐
│  Test Execution Start                   │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│  Check .auth/user.json exists?          │
└────┬────────────────────────────┬───────┘
     │ YES                        │ NO
     ▼                            ▼
┌─────────────────────────────┐  ┌───────────────────┐
│ Load stored auth state      │  │ First-time setup  │
│ Verify session validity     │  │ Generate setup doc│
│ If valid: Use it            │  │ Wait for manual   │
│ If expired: Try refresh     │  │ OAuth completion  │
└────────┬────────────────────┘  │ Save auth state   │
         │                       └─────────┬─────────┘
         │                                 │
         └─────────────────┬───────────────┘
                           │
                           ▼
                 ┌─────────────────────────┐
                 │ Auth fixture ready      │
                 │ Provide authenticated   │
                 │ page context to tests   │
                 └─────────────────────────┘
```

---

## Data Models

### ChatTestContext Extension

```typescript
// File: frontend/e2e/fixtures/chat.fixture.ts

interface ChatTestContext {
  // Existing
  mocPage: MOCSectionPage;
  chatLogger: ChatLogger;

  // NEW: Auth management
  authenticatedPage: Page;
  authStatus: {
    isAuthenticated: boolean;
    userId?: string;
    sessionToken?: string;
    refreshToken?: string;
  };
}
```

### Enhanced ChatLogger

```typescript
// File: frontend/e2e/utils/chat-logger.ts

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  suggestions?: Array<{
    id: string;  // NEW
    type: string;
    name: string;
    status: string;
    badgeColor?: string;  // NEW
    badgeLabel?: string;  // NEW
    actionButtons?: string[];  // NEW
  }>;
  quickReplies?: Array<{
    label: string;
    selected: boolean;
    value?: string;  // NEW
  }>;
  userActions?: Array<{  // NEW
    timestamp: string;
    type: 'button_click' | 'checkbox_toggle' | 'selection_change';
    details: Record<string, any>;
  }>;
}

interface ChatLog {
  testId: string;
  timestamp: string;
  scenario: string;
  locale: 'ja' | 'en';  // NEW
  messages: ChatMessage[];
  duration: number;
  status: 'pass' | 'fail' | 'error';
  error?: string;

  // NEW: Scenario-specific metadata
  scenarioMetadata?: {
    initialQuestions: string[];
    selectedCategories: string[];
    selectedSubCategories: string[];
    selectedCandidates: Array<{ index: number; type: string; name: string }>;
    actionsTaken: Array<{ action: string; timestamp: string }>;
  };
}
```

### Test Scenario Model

```typescript
// File: frontend/e2e/utils/test-data.ts (Extended)

export interface TestScenario {
  id: string;
  name: string;
  category: string;
  subCategory: string;
  initialQuestion: string;
  expectedQuickReplies: string[];
  expectedSuggestionTypes: string[];

  // NEW
  expectedBadgeColors?: Record<string, string>;  // type -> color
  expectedActionButtons?: string[];  // ['采用', '却下', '詳細']
  multiSelectScenario?: boolean;  // Test multiple selections?
  refinementActions?: Array<{
    action: 'more_specific' | 'easier' | 'harder' | 'arrange' | 'more';
    expectedLabel?: { ja: string; en: string };
  }>;
}

export interface SuggestionCardInfo {
  type: SuggestionButtonType;
  name: string;
  description?: string;
  rationale?: string;
  status: SuggestionStatus;

  // NEW
  badgeElement?: {
    text: string;
    backgroundColor: string;
    textColor: string;
  };
  actionButtons?: Array<{
    label: string;
    enabled: boolean;
  }>;
  checkboxVisible?: boolean;
  isSelected?: boolean;
}
```

---

## Component Specifications

### 1. MOCSectionPage Extensions

#### Class: MOCSectionPage (Enhanced)

```typescript
// File: frontend/e2e/page-objects/MOCSectionPage.ts

export class MOCSectionPage extends BasePage {
  // === EXISTING METHODS ===
  // (all existing methods remain unchanged)

  // === NEW METHODS: Multi-Selection ===

  /**
   * Toggle checkbox for a specific suggestion card
   * @param index - Card index (0-based)
   */
  async toggleSuggestionCheckbox(index: number): Promise<void> {
    const cards = this.page.locator(this.suggestionCard);
    const card = cards.nth(index);
    const checkbox = card.locator('input[type="checkbox"]');

    if (await checkbox.isVisible()) {
      await checkbox.click();
      await this.page.waitForTimeout(300);  // Wait for state update
    }
  }

  /**
   * Click "Select All" toggle
   */
  async selectAllSuggestions(): Promise<void> {
    const selectAllCheckbox = this.page.locator('input[type="checkbox"]').first();
    await selectAllCheckbox.check();
    await this.page.waitForTimeout(300);
  }

  /**
   * Click "Deselect All" toggle
   */
  async clearAllSelections(): Promise<void> {
    const selectAllCheckbox = this.page.locator('input[type="checkbox"]').first();
    await selectAllCheckbox.uncheck();
    await this.page.waitForTimeout(300);
  }

  /**
   * Get count of currently selected suggestions
   */
  async getSelectedSuggestionCount(): Promise<number> {
    const selectedCards = this.page.locator('[class*="suggestion"][class*="ring-primary"]');
    return await selectedCards.count();
  }

  /**
   * Get all selected suggestion indices
   */
  async getSelectedSuggestionIndices(): Promise<number[]> {
    const cards = this.page.locator(this.suggestionCard);
    const count = await cards.count();
    const selected: number[] = [];

    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      const isSelected = await card.locator('input[type="checkbox"]:checked').isVisible().catch(() => false);
      if (isSelected) {
        selected.push(i);
      }
    }

    return selected;
  }

  // === NEW METHODS: Action Buttons ===

  /**
   * Click a refinement action button
   * @param actionType - Type of refinement action
   */
  async clickRefineButton(
    actionType: 'specific' | 'general' | 'easy' | 'hard' | 'arrange' | 'more'
  ): Promise<void> {
    const labelMap: Record<string, string> = {
      specific: 'もっと具体的に',
      general: 'もっと一般的に',
      easy: 'もっとかんたんに',
      hard: 'もっと難しく',
      arrange: 'もっとアレンジして',
      more: '他には',
    };

    const label = labelMap[actionType];
    const button = this.page.locator(`button:has-text("${label}")`);

    if (await button.isVisible()) {
      await button.click();
      await this.waitForResponse(30000);
    } else {
      throw new Error(`Refine button "${label}" not found or not visible`);
    }
  }

  /**
   * Click batch register button
   */
  async clickBatchRegisterButton(): Promise<void> {
    const registerButton = this.page.locator('button:has-text("選択した候補を登録")');

    if (await registerButton.isVisible()) {
      await registerButton.click();
      await this.waitForResponse(30000);
    } else {
      throw new Error('Batch register button not found');
    }
  }

  /**
   * Get all visible action buttons
   */
  async getAllActionButtons(): Promise<Array<{ label: string; enabled: boolean }>> {
    // Buttons below suggestion cards
    const buttons = this.page.locator('[class*="ActionButtonGroup"] button, [class*="suggestion"] ~ button');
    const count = await buttons.count();
    const result: Array<{ label: string; enabled: boolean }> = [];

    for (let i = 0; i < count; i++) {
      const btn = buttons.nth(i);
      const label = await btn.textContent() || '';
      const isEnabled = !(await btn.getAttribute('disabled'));

      if (label.trim()) {
        result.push({
          label: label.trim(),
          enabled: isEnabled,
        });
      }
    }

    return result;
  }

  // === NEW METHODS: Badge Verification ===

  /**
   * Get badge color and label for a suggestion card
   * @param index - Card index
   * @returns Badge info { text, bgColor, textColor }
   */
  async getSuggestionBadgeInfo(
    index: number
  ): Promise<{ text: string; backgroundColor: string; textColor: string } | null> {
    const cards = this.page.locator(this.suggestionCard);
    const card = cards.nth(index);
    const badge = card.locator('[class*="badge"], span[class*="px-1.5"][class*="py-0.5"]').first();

    if (await badge.isVisible()) {
      const text = await badge.textContent() || '';
      const classList = await badge.getAttribute('class') || '';

      // Extract color from class name
      const bgMatch = classList.match(/bg-(blue|purple|yellow|green|gray|red)-\d+/);
      const textMatch = classList.match(/text-(blue|purple|yellow|green|gray|red)-\d+/);

      return {
        text: text.trim(),
        backgroundColor: bgMatch?.[0] || 'unknown',
        textColor: textMatch?.[0] || 'unknown',
      };
    }

    return null;
  }

  /**
   * Verify badge colors for multiple suggestions
   * @param expectedMapping - Map of index -> expected color
   */
  async verifyBadgeColors(expectedMapping: Record<number, string>): Promise<boolean> {
    const cards = this.page.locator(this.suggestionCard);
    const count = await cards.count();

    for (let i = 0; i < count; i++) {
      if (!(i in expectedMapping)) continue;

      const expected = expectedMapping[i];
      const badgeInfo = await this.getSuggestionBadgeInfo(i);

      if (!badgeInfo || !badgeInfo.backgroundColor.includes(expected)) {
        console.error(`Badge color mismatch at index ${i}: expected ${expected}, got ${badgeInfo?.backgroundColor}`);
        return false;
      }
    }

    return true;
  }

  /**
   * Get badge label text for a suggestion
   * @param index - Card index
   */
  async getSuggestionBadgeLabel(index: number): Promise<string> {
    const badgeInfo = await this.getSuggestionBadgeInfo(index);
    return badgeInfo?.text || '';
  }

  // === NEW METHODS: Logging Helpers ===

  /**
   * Log a suggestion card state
   */
  async logSuggestionDetails(
    logger: ChatLogger,
    index: number,
    suggestion: SuggestionCardInfo
  ): Promise<void> {
    const badgeInfo = await this.getSuggestionBadgeInfo(index);

    logger.logSystemMessage(
      JSON.stringify({
        suggestionIndex: index,
        type: suggestion.type,
        name: suggestion.name,
        badgeLabel: badgeInfo?.text,
        badgeColor: badgeInfo?.backgroundColor,
        status: suggestion.status,
      }, null, 2)
    );
  }

  /**
   * Log user action (e.g., button click, selection change)
   */
  async logUserAction(
    logger: ChatLogger,
    actionType: string,
    details: Record<string, any>
  ): Promise<void> {
    logger.logSystemMessage(
      JSON.stringify({
        userAction: actionType,
        timestamp: new Date().toISOString(),
        ...details,
      }, null, 2)
    );
  }
}
```

### 2. Enhanced ChatLogger

```typescript
// File: frontend/e2e/utils/chat-logger.ts (Enhanced section)

export class ChatLogger {
  // ... existing code ...

  /**
   * Log suggestion with full details including badge and actions
   */
  logSuggestionWithDetails(
    suggestion: {
      type: string;
      name: string;
      badgeLabel?: string;
      badgeColor?: string;
      actionButtons?: string[];
    }
  ): void {
    // Add to last assistant message's suggestions
    if (this.log.messages.length > 0) {
      const lastMsg = this.log.messages[this.log.messages.length - 1];
      if (lastMsg.role === 'assistant' && lastMsg.suggestions) {
        lastMsg.suggestions.push({
          type: suggestion.type,
          name: suggestion.name,
          status: 'pending',
          badgeLabel: suggestion.badgeLabel,
          badgeColor: suggestion.badgeColor,
          actionButtons: suggestion.actionButtons,
        });
      }
    }
  }

  /**
   * Record user action (selection, button click, etc.)
   */
  logUserActionDetails(
    actionType: 'selection' | 'button_click' | 'checkbox_change',
    details: Record<string, any>
  ): void {
    if (this.log.messages.length === 0) {
      this.logSystemMessage('User action recorded');
    }

    const lastMsg = this.log.messages[this.log.messages.length - 1];
    if (!lastMsg.userActions) {
      lastMsg.userActions = [];
    }

    lastMsg.userActions.push({
      timestamp: new Date().toISOString(),
      type: actionType,
      details,
    });
  }

  /**
   * Store scenario-specific metadata
   */
  setScenarioMetadata(metadata: {
    initialQuestions?: string[];
    selectedCategories?: string[];
    selectedSubCategories?: string[];
    selectedCandidates?: Array<{ index: number; type: string; name: string }>;
    actionsTaken?: Array<{ action: string; timestamp: string }>;
  }): void {
    this.log.scenarioMetadata = metadata;
  }
}
```

---

## Test Implementation Pattern

### Test File Template

```typescript
// File: frontend/e2e/tests/chat/moc-chat-flow.spec.ts (Example)

import { test, expect } from '../../fixtures/chat.fixture';
import { TEST_SCENARIOS } from '../../utils/test-data';

/**
 * MOC Chat Flow Tests
 * Tests the guided flow: Information Type -> Category -> SubCategory
 */
test.describe('MOC Chat Flow', () => {
  test('should guide user through information type selection', async ({ mocPage, chatLogger }) => {
    // STEP 1: Initial question triggers information type selection
    const scenario = TEST_SCENARIOS[0];
    chatLogger.logUserMessage(scenario.initialQuestion);
    await mocPage.sendMessage(scenario.initialQuestion);

    // STEP 2: Wait for AI response with quick replies
    await mocPage.waitForResponse(30000);
    const response1 = await mocPage.getLastMessageContent();
    const quickReplies = await mocPage.getQuickReplies();

    chatLogger.logAssistantMessage(response1, undefined, quickReplies.map(qr => ({ label: qr.label, selected: false })));

    // STEP 3: Verify quick replies include information types
    expect(quickReplies.length).toBeGreaterThan(0);
    console.log(`✓ Information type quick replies: ${quickReplies.map(qr => qr.label).join(', ')}`);

    // STEP 4: Select first quick reply
    const selectedReply = quickReplies[0];
    chatLogger.logUserMessage(`[QuickReply] ${selectedReply.label}`);
    await mocPage.clickQuickReply(selectedReply.label);
    await mocPage.waitForResponse(30000);

    // STEP 5: Log scenario progress
    chatLogger.setScenarioMetadata({
      initialQuestions: [scenario.initialQuestion],
      selectedCategories: [selectedReply.label],
    });

    await mocPage.screenshot('flow-step1-category-selected');
  });

  test('should display correct suggestion types for health-exercise scenario', async ({ mocPage, chatLogger }) => {
    test.setTimeout(120000);

    const scenario = TEST_SCENARIOS.find(s => s.id === 'health-exercise')!;

    // Navigate through flow
    chatLogger.logUserMessage(scenario.initialQuestion);
    await mocPage.sendMessage(scenario.initialQuestion);
    await mocPage.waitForResponse(30000);

    // Select Health category via quick reply
    const quickReplies = await mocPage.getQuickReplies();
    if (quickReplies.length > 0) {
      await mocPage.clickQuickReply(quickReplies[0].label);
      await mocPage.waitForResponse(30000);
    }

    // Select Exercise subcategory
    const quickReplies2 = await mocPage.getQuickReplies();
    if (quickReplies2.length > 0) {
      await mocPage.clickQuickReply(quickReplies2[0].label);
      await mocPage.waitForResponse(30000);
    }

    // Verify suggestions
    const suggestions = await mocPage.getSuggestionCards();
    expect(suggestions.length).toBeGreaterThan(0);

    // Verify suggestion types
    const types = suggestions.map(s => s.type);
    console.log(`✓ Suggestion types received: ${types.join(', ')}`);

    // Verify at least one Habit type suggestion
    const habitSuggestions = suggestions.filter(s => s.type === 'habit');
    expect(habitSuggestions.length).toBeGreaterThan(0);

    chatLogger.logAssistantMessage(
      await mocPage.getLastMessageContent(),
      suggestions.map(s => ({ type: s.type, name: s.name, status: s.status }))
    );

    await mocPage.screenshot('flow-suggestions-displayed');
  });
});
```

---

## Selector Strategy

### Dynamic Element Detection

Given the variability of UI frameworks and styling, selectors should be:

1. **Semantic-first**: Use `role` attributes
   ```typescript
   'button[aria-label="Send"]'
   'input[role="textbox"]'
   ```

2. **Data-attribute fallback**: If semantic attributes unavailable
   ```typescript
   '[data-testid="suggestion-card"]'
   '[data-suggestion-type="habit"]'
   ```

3. **Class-pattern fallback**: For styled components
   ```typescript
   '[class*="suggestion"][class*="card"]'
   'div[class*="bg-blue-100"]'  // Type badges
   ```

4. **Text-based as last resort**
   ```typescript
   'button:has-text("もっと具体的に")'
   'span:has-text("Habit")'
   ```

---

## Error Handling & Recovery

### Network Resilience

```typescript
async waitForResponse(timeout = 30000): Promise<void> {
  // Retry logic with exponential backoff
  let retries = 3;
  let lastError;

  while (retries > 0) {
    try {
      await this.page.waitForSelector(this.loadingIndicator, { timeout: 5000 });
    } catch {
      // Loading might be too fast
    }

    try {
      await this.page.waitForSelector(this.loadingIndicator, {
        state: 'hidden',
        timeout: timeout / 3,
      });
      return;
    } catch (error) {
      lastError = error;
      retries--;
      if (retries > 0) {
        await this.page.waitForTimeout(1000 * (4 - retries));
      }
    }
  }

  throw lastError;
}
```

### Element Visibility Handling

```typescript
async clickRefineButton(actionType: string): Promise<void> {
  const button = this.page.locator(`button:has-text("${actionType}")`);

  try {
    // Scroll into view if needed
    await button.scrollIntoViewIfNeeded();
    await button.click();
  } catch (error) {
    // Try alternative selectors
    const altButton = this.page.locator(`[data-action="${actionType}"]`);
    if (await altButton.isVisible()) {
      await altButton.click();
    } else {
      throw error;
    }
  }
}
```

---

## CI/CD Integration

### GitHub Actions Configuration

```yaml
# File: .github/workflows/e2e-moc-validation.yml

name: E2E MOC Validation

on:
  push:
    branches: [develop, main]
    paths:
      - 'frontend/e2e/**'
      - 'frontend/app/dashboard/components/Section.MOC.tsx'
  pull_request:
    paths:
      - 'frontend/e2e/**'
      - 'frontend/app/dashboard/components/Section.MOC.tsx'

jobs:
  e2e-test:
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install dependencies
        run: cd frontend && npm ci

      - name: Start dev server
        run: cd frontend && npm run dev &
        env:
          PORT: 3000

      - name: Wait for dev server
        run: npx wait-on http://localhost:3000

      - name: Run E2E tests
        run: cd frontend && npm run test:e2e
        env:
          TEST_BASE_URL: 'http://localhost:3000'
          PLAYWRIGHT_WORKERS: '1'
          AUTH_TOKEN: ${{ secrets.TEST_AUTH_TOKEN }}

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: frontend/playwright-report/
          retention-days: 30

      - name: Upload chat logs
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: chat-logs
          path: frontend/test-results/chat-logs/
          retention-days: 30
```

---

## File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `e2e/page-objects/MOCSectionPage.ts` | MODIFY | Add multi-select, badge verification, and logging methods |
| `e2e/utils/chat-logger.ts` | MODIFY | Extend ChatMessage/ChatLog with action tracking and metadata |
| `e2e/utils/test-data.ts` | MODIFY | Add badge expectations and refinement action definitions |
| `e2e/tests/chat/moc-chat-flow.spec.ts` | CREATE | Guided flow scenario tests |
| `e2e/tests/chat/moc-candidates.spec.ts` | CREATE | Candidate type and badge verification tests |
| `e2e/tests/chat/moc-actions.spec.ts` | CREATE | Action button interaction tests |
| `e2e/tests/chat/moc-multi-select.spec.ts` | CREATE | Multiple selection and batch operation tests |
| `e2e/tests/chat/moc-refinement.spec.ts` | CREATE | Candidate refinement action tests |
| `e2e/fixtures/auth.fixture.ts` | MODIFY | Improve OAuth auto-detection and retry logic |
| `.github/workflows/e2e-moc-validation.yml` | CREATE | CI/CD workflow for E2E tests |

---

## Testing Strategy

### Unit Tests (Page Objects)
- Individual selector/locator functions
- State management (selection tracking)
- Error handling and recovery

### Integration Tests (Test Scenarios)
- Chat flow from start to suggestion display
- Multi-step interactions (selection -> action -> result)
- Badge verification in context

### E2E Tests (Complete User Flows)
- Full information gathering flow
- Multi-candidate scenarios
- Batch operations

### Regression Tests
- Existing functionality unchanged
- New features don't break chat input
- Selection state persists across interactions

---

## Performance Considerations

1. **Parallel Execution**: Can run multiple test scenarios in parallel if they don't share state
2. **Screenshot Capture**: Only on failure to reduce disk/time overhead
3. **Video Recording**: Retained only on failure
4. **Log Archival**: Auto-cleanup of logs older than 30 days

---

## Documentation & Maintenance

- **JSDoc Comments**: All Page Object methods documented with params/returns
- **Test Comments**: Each test has `test.describe()` and inline comments for flow steps
- **README**: `frontend/e2e/README.md` with setup, execution, and troubleshooting
- **Changelog**: Document breaking changes to selectors/locators

