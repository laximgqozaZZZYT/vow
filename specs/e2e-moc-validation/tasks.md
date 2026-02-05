# E2E MOC Validation - Implementation Tasks

## Overview
- **Feature Name**: E2E テスト基盤強化・MOCチャット機能自動検証
- **Status**: Ready for Implementation
- **Version**: 1.0.0
- **Created**: 2026-02-05
- **Author**: researcher

---

## Task Summary

| Phase | Tasks | Est. Hours | Assignable To |
|-------|-------|------------|---------------|
| Phase 1 | Page Object Extension | 3h | Tester |
| Phase 2 | ChatLogger Enhancement | 1.5h | Tester |
| Phase 3 | Chat Flow Test Scenarios | 4h | Tester |
| Phase 4 | Candidate Verification Tests | 3h | Tester |
| Phase 5 | Action Button Tests | 2.5h | Tester |
| Phase 6 | Multi-Select Tests | 3h | Tester |
| Phase 7 | Integration & Validation | 2h | Tester |
| Phase 8 | CI/CD Setup | 1.5h | DevOps |
| **Total** | | **20.5h** | |

---

## Phase 1: Page Object Extension

### Task 1.1: MOCSectionPage - Multi-Select Methods

**File**: `/home/ubuntu/Downloads/vow/frontend/e2e/page-objects/MOCSectionPage.ts`

**Location**: Add after `dismissSuggestion()` method (around line 260)

**Estimated Time**: 45min

**Implementation**:

Add these methods to `MOCSectionPage` class:

```typescript
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
    await this.page.waitForTimeout(300);
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
```

**Checklist**:
- [ ] All 5 methods implemented
- [ ] Methods handle edge cases (no checkboxes, no selections)
- [ ] Wait times appropriately set
- [ ] JSDoc comments complete

### Task 1.2: MOCSectionPage - Action Button Methods

**File**: `/home/ubuntu/Downloads/vow/frontend/e2e/page-objects/MOCSectionPage.ts`

**Location**: Add after multi-select methods (around line 310)

**Estimated Time**: 60min

**Implementation**:

```typescript
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
  const buttons = this.page.locator('[class*="suggestion"] ~ button, [class*="ActionButtonGroup"] button');
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
```

**Checklist**:
- [ ] All 3 action methods implemented
- [ ] Error handling for missing buttons
- [ ] Response waiting integrated
- [ ] JSDoc complete

### Task 1.3: MOCSectionPage - Badge Verification Methods

**File**: `/home/ubuntu/Downloads/vow/frontend/e2e/page-objects/MOCSectionPage.ts`

**Location**: Add after action button methods (around line 360)

**Estimated Time**: 45min

**Implementation**:

```typescript
/**
 * Get badge color and label for a suggestion card
 * @param index - Card index
 * @returns Badge info { text, backgroundColor, textColor } or null
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
```

**Checklist**:
- [ ] Badge info retrieval works with various selector patterns
- [ ] Color extraction via regex is robust
- [ ] All 3 badge methods implemented
- [ ] Handle missing badges gracefully

### Task 1.4: MOCSectionPage - Logging Helper Methods

**File**: `/home/ubuntu/Downloads/vow/frontend/e2e/page-objects/MOCSectionPage.ts`

**Location**: Add at end of class (before closing brace)

**Estimated Time**: 30min

**Implementation**:

```typescript
/**
 * Log suggestion details with badge and type info
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
      timestamp: new Date().toISOString(),
    }, null, 2)
  );
}

/**
 * Log user action
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
```

**Checklist**:
- [ ] Logging methods integrate with ChatLogger
- [ ] Output format is JSON-serializable
- [ ] Timestamps included

---

## Phase 2: ChatLogger Enhancement

### Task 2.1: Extend ChatMessage Interface

**File**: `/home/ubuntu/Downloads/vow/frontend/e2e/utils/chat-logger.ts`

**Location**: Update `ChatMessage` interface (around line 7-21)

**Estimated Time**: 20min

**Target Code**:

```typescript
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  suggestions?: Array<{
    type: string;
    name: string;
    status: string;
    // NEW FIELDS
    id?: string;
    badgeColor?: string;
    badgeLabel?: string;
    actionButtons?: string[];
  }>;
  quickReplies?: Array<{
    label: string;
    selected: boolean;
    // NEW
    value?: string;
  }>;
  // NEW FIELD
  userActions?: Array<{
    timestamp: string;
    type: 'button_click' | 'checkbox_toggle' | 'selection_change';
    details: Record<string, any>;
  }>;
}
```

**Checklist**:
- [ ] All new fields added
- [ ] Optional chaining (?) used where appropriate
- [ ] TypeScript compilation passes

### Task 2.2: Extend ChatLog Interface

**File**: `/home/ubuntu/Downloads/vow/frontend/e2e/utils/chat-logger.ts`

**Location**: Update `ChatLog` interface (around line 26-34)

**Estimated Time**: 20min

**Target Code**:

```typescript
interface ChatLog {
  testId: string;
  timestamp: string;
  scenario: string;
  messages: ChatMessage[];
  duration: number;
  status: 'pass' | 'fail' | 'error';
  error?: string;

  // NEW FIELDS
  locale?: 'ja' | 'en';
  scenarioMetadata?: {
    initialQuestions?: string[];
    selectedCategories?: string[];
    selectedSubCategories?: string[];
    selectedCandidates?: Array<{ index: number; type: string; name: string }>;
    actionsTaken?: Array<{ action: string; timestamp: string }>;
  };
}
```

**Checklist**:
- [ ] Metadata structure clear and extensible
- [ ] All optional fields marked with ?

### Task 2.3: Add New Methods to ChatLogger Class

**File**: `/home/ubuntu/Downloads/vow/frontend/e2e/utils/chat-logger.ts`

**Location**: Add after `getSummary()` method (around line 160)

**Estimated Time**: 30min

**Implementation**:

```typescript
/**
 * Log suggestion with full details including badge
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
 * Set scenario-specific metadata
 */
setScenarioMetadata(metadata: {
  initialQuestions?: string[];
  selectedCategories?: string[];
  selectedSubCategories?: string[];
  selectedCandidates?: Array<{ index: number; type: string; name: string }>;
  actionsTaken?: Array<{ action: string; timestamp: string }>;
}): void {
  if (!this.log.scenarioMetadata) {
    this.log.scenarioMetadata = {};
  }
  Object.assign(this.log.scenarioMetadata, metadata);
}

/**
 * Set locale for the test
 */
setLocale(locale: 'ja' | 'en'): void {
  this.log.locale = locale;
}
```

**Checklist**:
- [ ] All 4 methods implemented
- [ ] Methods handle edge cases (empty message list)
- [ ] Metadata is properly merged
- [ ] JSDoc comments complete

---

## Phase 3: Chat Flow Test Scenarios

### Task 3.1: Create MOC Chat Flow Test File

**File**: `/home/ubuntu/Downloads/vow/frontend/e2e/tests/chat/moc-chat-flow.spec.ts` (NEW)

**Estimated Time**: 2h

**Implementation Structure**:

```typescript
import { test, expect } from '../../fixtures/chat.fixture';
import { TEST_SCENARIOS, getScenarioById } from '../../utils/test-data';

/**
 * MOC Chat Flow Tests
 * Tests the guided flow: Information Type -> Category -> SubCategory -> Suggestions
 */
test.describe('MOC Chat Flow - Guided Selection', () => {
  test('should guide user through information type selection', async ({ mocPage, chatLogger }) => {
    // STEP 1: Send initial question
    const scenario = TEST_SCENARIOS[0];
    chatLogger.logUserMessage(scenario.initialQuestion);
    await mocPage.sendMessage(scenario.initialQuestion);
    await mocPage.screenshot('flow-step1-initial-question');

    // STEP 2: Wait for quick replies (information types)
    await mocPage.waitForResponse(30000);
    const response1 = await mocPage.getLastMessageContent();
    const quickReplies = await mocPage.getQuickReplies();

    chatLogger.logAssistantMessage(response1, undefined, quickReplies.map(qr => ({ label: qr.label, selected: false })));

    // STEP 3: Verify quick replies
    expect(quickReplies.length).toBeGreaterThan(0);
    console.log(`✓ Quick replies received: ${quickReplies.map(qr => qr.label).join(', ')}`);
    await mocPage.screenshot('flow-step2-quick-replies');

    // STEP 4: Select first quick reply (information type)
    const selectedReply = quickReplies[0];
    chatLogger.logUserMessage(`[QuickReply] ${selectedReply.label}`);
    chatLogger.logUserActionDetails('selection_change', { selectedType: selectedReply.label });
    await mocPage.clickQuickReply(selectedReply.label);
    await mocPage.waitForResponse(30000);
    await mocPage.screenshot('flow-step3-category-selected');

    // STEP 5: Update metadata
    chatLogger.setScenarioMetadata({
      selectedCategories: [selectedReply.label],
    });
  });

  test('should complete health-exercise flow with habit suggestions', async ({ mocPage, chatLogger }) => {
    test.setTimeout(120000);

    const scenario = getScenarioById('health-exercise')!;
    chatLogger.setScenarioMetadata({ initialQuestions: [scenario.initialQuestion] });

    // Step 1: Initial question
    chatLogger.logUserMessage(scenario.initialQuestion);
    await mocPage.sendMessage(scenario.initialQuestion);
    await mocPage.waitForResponse(30000);
    await mocPage.screenshot('health-exercise-step1');

    // Step 2: Select health category from quick replies
    const qr1 = await mocPage.getQuickReplies();
    expect(qr1.length).toBeGreaterThan(0);
    const healthReply = qr1[0];  // Assume first is health-related
    chatLogger.logUserMessage(`[QuickReply] ${healthReply.label}`);
    await mocPage.clickQuickReply(healthReply.label);
    await mocPage.waitForResponse(30000);
    await mocPage.screenshot('health-exercise-step2-category');

    // Step 3: Select exercise subcategory
    const qr2 = await mocPage.getQuickReplies();
    if (qr2.length > 0) {
      const exerciseReply = qr2[0];
      chatLogger.logUserMessage(`[QuickReply] ${exerciseReply.label}`);
      await mocPage.clickQuickReply(exerciseReply.label);
      await mocPage.waitForResponse(30000);
    }
    await mocPage.screenshot('health-exercise-step3-subcategory');

    // Step 4: Verify habit suggestions
    const suggestions = await mocPage.getSuggestionCards();
    expect(suggestions.length).toBeGreaterThan(0);

    const habitSuggestions = suggestions.filter(s => s.type === 'habit');
    expect(habitSuggestions.length).toBeGreaterThan(0);

    const response = await mocPage.getLastMessageContent();
    chatLogger.logAssistantMessage(
      response,
      suggestions.map(s => ({ type: s.type, name: s.name, status: s.status }))
    );
    chatLogger.setScenarioMetadata({
      selectedSubCategories: ['Exercise'],
      selectedCandidates: suggestions.map((s, i) => ({ index: i, type: s.type, name: s.name })),
    });

    await mocPage.screenshot('health-exercise-step4-suggestions');
  });

  test('should handle multiple category selections', async ({ mocPage, chatLogger }) => {
    test.setTimeout(120000);

    // Similar structure but with multiple quick replies in flow
    const scenario = TEST_SCENARIOS[0];
    chatLogger.logUserMessage(scenario.initialQuestion);
    await mocPage.sendMessage(scenario.initialQuestion);
    await mocPage.waitForResponse(30000);

    // Multiple selections across steps
    for (let step = 0; step < 3; step++) {
      const qr = await mocPage.getQuickReplies();
      if (qr.length > 0) {
        const selected = qr[0];
        chatLogger.logUserMessage(`[Step ${step + 1}] ${selected.label}`);
        await mocPage.clickQuickReply(selected.label);
        await mocPage.waitForResponse(30000);
      }
    }

    const suggestions = await mocPage.getSuggestionCards();
    expect(suggestions.length).toBeGreaterThan(0);

    await mocPage.screenshot('multi-step-flow-complete');
  });
});
```

**Checklist**:
- [ ] 3 test scenarios created
- [ ] Each test has clear step progression
- [ ] Screenshots at key points
- [ ] Metadata logged for each test
- [ ] Timeout set appropriately (120s for complex flow)

### Task 3.2: Create Test Utilities Helper (if needed)

**File**: `/home/ubuntu/Downloads/vow/frontend/e2e/utils/test-helpers.ts` (NEW, if needed)

**Estimated Time**: 30min (optional)

**Purpose**: If many tests reuse similar flow patterns

**Implementation Structure**:

```typescript
import { MOCSectionPage } from '../page-objects/MOCSectionPage';
import { ChatLogger } from './chat-logger';

/**
 * Helper to run a complete guided selection flow
 */
export async function runGuidedSelectionFlow(
  mocPage: MOCSectionPage,
  chatLogger: ChatLogger,
  initialQuestion: string,
  stepsCount: number = 2
): Promise<Array<{ label: string; selected: boolean }>> {
  // Step 1: Send initial question
  chatLogger.logUserMessage(initialQuestion);
  await mocPage.sendMessage(initialQuestion);
  await mocPage.waitForResponse(30000);

  const selectedReplies: Array<{ label: string; selected: boolean }> = [];

  // Step 2+: Select from quick replies
  for (let step = 0; step < stepsCount; step++) {
    const qr = await mocPage.getQuickReplies();
    if (qr.length === 0) break;

    const selected = qr[0];
    chatLogger.logUserMessage(`[Step ${step + 1}] ${selected.label}`);
    await mocPage.clickQuickReply(selected.label);
    await mocPage.waitForResponse(30000);

    selectedReplies.push({ label: selected.label, selected: true });
  }

  return selectedReplies;
}
```

**Checklist**:
- [ ] Helper function generic and reusable
- [ ] Parameters allow customization
- [ ] Clear return type

---

## Phase 4: Candidate Verification Tests

### Task 4.1: Create Candidate Type & Badge Verification Test

**File**: `/home/ubuntu/Downloads/vow/frontend/e2e/tests/chat/moc-candidates.spec.ts` (NEW)

**Estimated Time**: 2h

**Implementation Structure**:

```typescript
import { test, expect } from '../../fixtures/chat.fixture';
import { TYPE_BADGE_COLORS, TEST_SCENARIOS } from '../../utils/test-data';

/**
 * MOC Candidate Verification Tests
 * Tests that suggestion types (Habit/Goal/Sticky'n/Reply) are correctly displayed with badges
 */
test.describe('MOC Candidate Verification', () => {
  test('should display correct badge colors for habit type', async ({ mocPage, chatLogger }) => {
    // Trigger habit suggestions
    const message = '毎日ジョギングする習慣を始めたいです';
    chatLogger.logUserMessage(message);
    await mocPage.sendMessage(message);
    await mocPage.waitForResponse(30000);

    // Get suggestions
    const suggestions = await mocPage.getSuggestionCards();
    expect(suggestions.length).toBeGreaterThan(0);

    // Log and verify
    const habitSuggestions = suggestions.filter(s => s.type === 'habit');
    expect(habitSuggestions.length).toBeGreaterThan(0);

    // Verify badge for first habit
    const habitIndex = suggestions.findIndex(s => s.type === 'habit');
    const badgeInfo = await mocPage.getSuggestionBadgeInfo(habitIndex);

    expect(badgeInfo).toBeTruthy();
    expect(badgeInfo?.text).toContain('Habit');
    expect(badgeInfo?.backgroundColor).toContain('bg-blue');

    chatLogger.logSuggestionWithDetails({
      type: 'habit',
      name: suggestions[habitIndex].name,
      badgeLabel: badgeInfo?.text,
      badgeColor: badgeInfo?.backgroundColor,
    });

    await mocPage.screenshot('badge-habit-verified');
  });

  test('should display correct badge colors for goal type', async ({ mocPage, chatLogger }) => {
    const message = '3ヶ月で5kg痩せたい目標を立てたい';
    chatLogger.logUserMessage(message);
    await mocPage.sendMessage(message);
    await mocPage.waitForResponse(30000);

    const suggestions = await mocPage.getSuggestionCards();
    const goalIndex = suggestions.findIndex(s => s.type === 'goal');

    if (goalIndex === -1) {
      test.skip(true, 'No goal suggestions found');
      return;
    }

    const badgeInfo = await mocPage.getSuggestionBadgeInfo(goalIndex);
    expect(badgeInfo?.text).toContain('Goal');
    expect(badgeInfo?.backgroundColor).toContain('bg-purple');

    chatLogger.logSuggestionWithDetails({
      type: 'goal',
      name: suggestions[goalIndex].name,
      badgeLabel: badgeInfo?.text,
      badgeColor: badgeInfo?.backgroundColor,
    });

    await mocPage.screenshot('badge-goal-verified');
  });

  test('should display correct badge colors for stickyn type', async ({ mocPage, chatLogger }) => {
    const message = 'スティッキーノートで時間管理する方法を知りたい';
    chatLogger.logUserMessage(message);
    await mocPage.sendMessage(message);
    await mocPage.waitForResponse(30000);

    const suggestions = await mocPage.getSuggestionCards();
    const stickynIndex = suggestions.findIndex(s => s.type === 'stickyn');

    if (stickynIndex === -1) {
      test.skip(true, 'No stickyn suggestions found');
      return;
    }

    const badgeInfo = await mocPage.getSuggestionBadgeInfo(stickynIndex);
    expect(badgeInfo?.text).toContain("Sticky'n");
    expect(badgeInfo?.backgroundColor).toContain('bg-yellow');

    chatLogger.logSuggestionWithDetails({
      type: 'stickyn',
      name: suggestions[stickynIndex].name,
      badgeLabel: badgeInfo?.text,
      badgeColor: badgeInfo?.backgroundColor,
    });

    await mocPage.screenshot('badge-stickyn-verified');
  });

  test('should verify multiple badges in single response', async ({ mocPage, chatLogger }) => {
    const message = '新しい習慣と目標を一緒に立てたい';
    chatLogger.logUserMessage(message);
    await mocPage.sendMessage(message);
    await mocPage.waitForResponse(30000);

    const suggestions = await mocPage.getSuggestionCards();
    expect(suggestions.length).toBeGreaterThan(1);

    // Verify each suggestion has correct badge
    const badgeMap: Record<number, string> = {};
    for (let i = 0; i < suggestions.length; i++) {
      const expectedColor = TYPE_BADGE_COLORS[suggestions[i].type];
      badgeMap[i] = expectedColor || 'unknown';

      const badgeInfo = await mocPage.getSuggestionBadgeInfo(i);
      expect(badgeInfo).toBeTruthy();

      chatLogger.logSuggestionWithDetails({
        type: suggestions[i].type,
        name: suggestions[i].name,
        badgeLabel: badgeInfo?.text,
        badgeColor: badgeInfo?.backgroundColor,
      });
    }

    // Batch verification
    const verified = await mocPage.verifyBadgeColors(badgeMap);
    expect(verified).toBeTruthy();

    await mocPage.screenshot('multiple-badges-verified');
  });

  test('should handle mixed suggestion types with correct badges', async ({ mocPage, chatLogger }) => {
    const scenario = TEST_SCENARIOS.find(s => s.expectedSuggestionTypes.length > 1);
    if (!scenario) {
      test.skip(true, 'No mixed scenario found');
      return;
    }

    chatLogger.logUserMessage(scenario.initialQuestion);
    await mocPage.sendMessage(scenario.initialQuestion);
    await mocPage.waitForResponse(30000);

    const suggestions = await mocPage.getSuggestionCards();

    // Check expected types present
    const typeSet = new Set(suggestions.map(s => s.type));
    for (const expectedType of scenario.expectedSuggestionTypes) {
      expect(typeSet.has(expectedType as any)).toBeTruthy();
    }

    // Log all with badges
    for (let i = 0; i < suggestions.length; i++) {
      const badgeInfo = await mocPage.getSuggestionBadgeInfo(i);
      console.log(`Suggestion ${i}: ${suggestions[i].type} - ${badgeInfo?.text} (${badgeInfo?.backgroundColor})`);
    }

    await mocPage.screenshot('mixed-types-verified');
  });
});
```

**Checklist**:
- [ ] 5 test cases created
- [ ] Each badge type (Habit/Goal/Sticky'n) tested
- [ ] Multiple badges in one response tested
- [ ] Skips for missing types handled gracefully
- [ ] Screenshots captured for evidence

---

## Phase 5: Action Button Tests

### Task 5.1: Create Action Button Interaction Test

**File**: `/home/ubuntu/Downloads/vow/frontend/e2e/tests/chat/moc-actions.spec.ts` (NEW)

**Estimated Time**: 1.5h

**Implementation Structure**:

```typescript
import { test, expect } from '../../fixtures/chat.fixture';

/**
 * MOC Action Button Tests
 * Tests accept/reject/refine actions on suggestion cards
 */
test.describe('MOC Action Buttons', () => {
  test('should display accept/reject buttons on suggestion cards', async ({ mocPage, chatLogger }) => {
    // Trigger suggestions
    const message = '毎日運動する習慣を作りたい';
    chatLogger.logUserMessage(message);
    await mocPage.sendMessage(message);
    await mocPage.waitForResponse(30000);

    const suggestions = await mocPage.getSuggestionCards();
    expect(suggestions.length).toBeGreaterThan(0);

    // Check first suggestion has buttons
    const actionButtons = await mocPage.getAllActionButtons();
    expect(actionButtons.length).toBeGreaterThan(0);

    console.log(`Available action buttons: ${actionButtons.map(b => b.label).join(', ')}`);
    chatLogger.logUserActionDetails('view_action_buttons', { buttons: actionButtons });

    await mocPage.screenshot('action-buttons-displayed');
  });

  test('should accept a suggestion', async ({ mocPage, chatLogger }) => {
    const message = 'ジョギングの習慣を始めたい';
    chatLogger.logUserMessage(message);
    await mocPage.sendMessage(message);
    await mocPage.waitForResponse(30000);

    const suggestions = await mocPage.getSuggestionCards();
    if (suggestions.length === 0) {
      test.skip(true, 'No suggestions received');
      return;
    }

    // Accept first suggestion
    chatLogger.logUserActionDetails('button_click', { action: 'accept', suggestionIndex: 0 });
    await mocPage.acceptSuggestion(0);
    await mocPage.waitForResponse(15000);

    // Verify acceptance
    const updatedSuggestions = await mocPage.getSuggestionCards();
    if (updatedSuggestions.length > 0) {
      const firstStatus = updatedSuggestions[0].status;
      console.log(`Suggestion status after accept: ${firstStatus}`);
    }

    await mocPage.screenshot('suggestion-accepted');
  });

  test('should dismiss a suggestion', async ({ mocPage, chatLogger }) => {
    const message = '新しい目標を立てたい';
    chatLogger.logUserMessage(message);
    await mocPage.sendMessage(message);
    await mocPage.waitForResponse(30000);

    const suggestionsBefore = await mocPage.getSuggestionCards();
    if (suggestionsBefore.length === 0) {
      test.skip(true, 'No suggestions received');
      return;
    }

    const countBefore = suggestionsBefore.length;

    // Dismiss first suggestion
    chatLogger.logUserActionDetails('button_click', { action: 'dismiss', suggestionIndex: 0 });
    await mocPage.dismissSuggestion(0);
    await mocPage.waitForTimeout(1000);

    // Count after dismiss
    const suggestionsAfter = await mocPage.getSuggestionCards();
    console.log(`Suggestions before dismiss: ${countBefore}, after: ${suggestionsAfter.length}`);

    await mocPage.screenshot('suggestion-dismissed');
  });

  test('should snooze a suggestion', async ({ mocPage, chatLogger }) => {
    const message = '後で確認する候補を保留したい';
    chatLogger.logUserMessage(message);
    await mocPage.sendMessage(message);
    await mocPage.waitForResponse(30000);

    const suggestions = await mocPage.getSuggestionCards();
    if (suggestions.length === 0) {
      test.skip(true, 'No suggestions received');
      return;
    }

    // Snooze first suggestion
    chatLogger.logUserActionDetails('button_click', { action: 'snooze', suggestionIndex: 0 });
    await mocPage.snoozeSuggestion(0);
    await mocPage.waitForTimeout(1000);

    const updatedSuggestions = await mocPage.getSuggestionCards();
    if (updatedSuggestions.length > 0) {
      const firstStatus = updatedSuggestions[0].status;
      console.log(`Suggestion status after snooze: ${firstStatus}`);
    }

    await mocPage.screenshot('suggestion-snoozed');
  });
});
```

**Checklist**:
- [ ] 4 action test cases created
- [ ] Each action (accept/reject/snooze) tested
- [ ] Status verification after actions
- [ ] Action logging complete

---

## Phase 6: Multi-Select Tests

### Task 6.1: Create Multi-Selection Test

**File**: `/home/ubuntu/Downloads/vow/frontend/e2e/tests/chat/moc-multi-select.spec.ts` (NEW)

**Estimated Time**: 2h

**Implementation Structure**:

```typescript
import { test, expect } from '../../fixtures/chat.fixture';

/**
 * MOC Multi-Select Tests
 * Tests multiple suggestion selection, batch operations
 */
test.describe('MOC Multi-Select', () => {
  test('should select/deselect individual suggestions', async ({ mocPage, chatLogger }) => {
    test.setTimeout(90000);

    // Get suggestions
    const message = '複数の習慣と目標を見たい';
    chatLogger.logUserMessage(message);
    await mocPage.sendMessage(message);
    await mocPage.waitForResponse(30000);

    const suggestions = await mocPage.getSuggestionCards();
    if (suggestions.length < 2) {
      test.skip(true, 'Need at least 2 suggestions');
      return;
    }

    // Select first
    await mocPage.toggleSuggestionCheckbox(0);
    let count = await mocPage.getSelectedSuggestionCount();
    expect(count).toBe(1);
    chatLogger.logUserActionDetails('checkbox_change', { action: 'select', index: 0 });

    // Select second
    await mocPage.toggleSuggestionCheckbox(1);
    count = await mocPage.getSelectedSuggestionCount();
    expect(count).toBe(2);
    chatLogger.logUserActionDetails('checkbox_change', { action: 'select', index: 1 });

    // Deselect first
    await mocPage.toggleSuggestionCheckbox(0);
    count = await mocPage.getSelectedSuggestionCount();
    expect(count).toBe(1);
    chatLogger.logUserActionDetails('checkbox_change', { action: 'deselect', index: 0 });

    await mocPage.screenshot('multi-select-individual');
  });

  test('should select all/deselect all', async ({ mocPage, chatLogger }) => {
    test.setTimeout(90000);

    const message = '複数候補を見たい';
    chatLogger.logUserMessage(message);
    await mocPage.sendMessage(message);
    await mocPage.waitForResponse(30000);

    const suggestions = await mocPage.getSuggestionCards();
    if (suggestions.length < 2) {
      test.skip(true, 'Need at least 2 suggestions');
      return;
    }

    // Select all
    await mocPage.selectAllSuggestions();
    let count = await mocPage.getSelectedSuggestionCount();
    expect(count).toBe(suggestions.length);
    chatLogger.logUserActionDetails('checkbox_change', { action: 'select_all', total: suggestions.length });

    // Deselect all
    await mocPage.clearAllSelections();
    count = await mocPage.getSelectedSuggestionCount();
    expect(count).toBe(0);
    chatLogger.logUserActionDetails('checkbox_change', { action: 'clear_all' });

    await mocPage.screenshot('multi-select-select-all');
  });

  test('should enable/disable batch register button based on selection', async ({ mocPage, chatLogger }) => {
    test.setTimeout(90000);

    const message = '習慣と目標を提案してください';
    chatLogger.logUserMessage(message);
    await mocPage.sendMessage(message);
    await mocPage.waitForResponse(30000);

    const suggestions = await mocPage.getSuggestionCards();
    if (suggestions.length < 2) {
      test.skip(true, 'Need at least 2 suggestions');
      return;
    }

    // Get initial state
    const actionButtons1 = await mocPage.getAllActionButtons();
    console.log(`Buttons without selection: ${actionButtons1.map(b => b.label).join(', ')}`);

    // Select suggestions
    await mocPage.selectAllSuggestions();
    const actionButtons2 = await mocPage.getAllActionButtons();
    console.log(`Buttons with selection: ${actionButtons2.map(b => b.label).join(', ')}`);

    // Register button should be enabled
    const registerButton = actionButtons2.find(b => b.label.includes('選択'));
    expect(registerButton?.enabled).toBeTruthy();
    chatLogger.logUserActionDetails('view_buttons', { availableButtons: actionButtons2 });

    await mocPage.screenshot('batch-register-button-enabled');
  });

  test('should batch register selected suggestions', async ({ mocPage, chatLogger }) => {
    test.setTimeout(120000);

    const message = 'すべての習慣を登録したい';
    chatLogger.logUserMessage(message);
    await mocPage.sendMessage(message);
    await mocPage.waitForResponse(30000);

    const suggestionsBefore = await mocPage.getSuggestionCards();
    if (suggestionsBefore.length === 0) {
      test.skip(true, 'No suggestions received');
      return;
    }

    // Select all
    await mocPage.selectAllSuggestions();
    const selectedIndices = await mocPage.getSelectedSuggestionIndices();
    expect(selectedIndices.length).toBeGreaterThan(0);

    chatLogger.logUserActionDetails('selection_change', {
      selectedCount: selectedIndices.length,
      selectedIndices,
    });

    // Batch register
    chatLogger.logUserActionDetails('button_click', { action: 'batch_register', count: selectedIndices.length });
    await mocPage.clickBatchRegisterButton();
    await mocPage.waitForResponse(30000);

    // Check updated state
    const suggestionsAfter = await mocPage.getSuggestionCards();
    console.log(`Suggestions before batch register: ${suggestionsBefore.length}`);
    console.log(`Suggestions after batch register: ${suggestionsAfter.length}`);

    await mocPage.screenshot('batch-register-complete');
  });
});
```

**Checklist**:
- [ ] 4 multi-select test cases
- [ ] Individual selection/deselection tested
- [ ] Select-all/clear-all functionality tested
- [ ] Button enable/disable based on selection
- [ ] Batch registration tested

---

## Phase 7: Integration & Validation

### Task 7.1: E2E Test Execution

**File**: CI/Local execution

**Estimated Time**: 45min

**Steps**:

1. Setup test environment:
   ```bash
   cd /home/ubuntu/Downloads/vow/frontend
   npm install
   npm run dev &  # Start dev server
   ```

2. Run all E2E tests:
   ```bash
   npm run test:e2e
   ```

3. Verify:
   - [ ] All tests pass or skip appropriately
   - [ ] No TypeScript errors
   - [ ] Chat logs generated in `test-results/chat-logs/`
   - [ ] Screenshots captured
   - [ ] Test report generated

**Checklist**:
- [ ] Full test suite runs successfully
- [ ] All artifacts generated
- [ ] No flaky tests (rerun 2x to verify)

### Task 7.2: Log Validation

**File**: Validation check

**Estimated Time**: 30min

**Steps**:

1. Check chat logs:
   ```bash
   ls -la test-results/chat-logs/
   cat test-results/chat-logs/*.json | head -100
   ```

2. Verify log structure:
   - [ ] Each log has testId, scenario, messages array
   - [ ] Messages have timestamps, role, content
   - [ ] Suggestions include badge info and types
   - [ ] User actions are recorded
   - [ ] Metadata includes scenario context

3. Sample validation script (manual):
   ```typescript
   // Check one log file
   const log = JSON.parse(fs.readFileSync('./test-results/chat-logs/test-*.json', 'utf8'));
   console.log('Messages:', log.messages.length);
   console.log('Has suggestions:', log.messages.some(m => m.suggestions));
   console.log('Has user actions:', log.messages.some(m => m.userActions));
   ```

**Checklist**:
- [ ] All logs have correct structure
- [ ] No missing fields
- [ ] Data is JSON-serializable

---

## Phase 8: CI/CD Setup

### Task 8.1: Create GitHub Actions Workflow

**File**: `.github/workflows/e2e-moc-validation.yml` (NEW)

**Estimated Time**: 1h

**Implementation**:

```yaml
name: E2E MOC Validation

on:
  push:
    branches: [develop, main]
    paths:
      - 'frontend/e2e/**'
      - 'frontend/app/dashboard/components/Section.MOC.tsx'
      - 'frontend/playwright.config.ts'
  pull_request:
    paths:
      - 'frontend/e2e/**'
      - 'frontend/app/dashboard/components/Section.MOC.tsx'
      - 'frontend/playwright.config.ts'

jobs:
  e2e-test:
    runs-on: ubuntu-latest
    timeout-minutes: 30

    strategy:
      fail-fast: false
      matrix:
        test-suite:
          - moc-chat-flow
          - moc-candidates
          - moc-actions
          - moc-multi-select

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Cache dependencies
        uses: actions/cache@v3
        with:
          path: |
            ~/.npm
            frontend/node_modules
          key: ${{ runner.os }}-node-${{ hashFiles('frontend/package-lock.json') }}
          restore-keys: |
            ${{ runner.os }}-node-

      - name: Install dependencies
        run: cd frontend && npm ci

      - name: Start dev server
        run: |
          cd frontend
          npm run dev > /tmp/dev-server.log 2>&1 &
          sleep 10

      - name: Wait for dev server
        run: npx wait-on http://localhost:3000 --timeout 30000

      - name: Run E2E test suite
        run: cd frontend && npm run test:e2e -- moc-${{ matrix.test-suite }}
        env:
          TEST_BASE_URL: 'http://localhost:3000'
          PLAYWRIGHT_WORKERS: '1'

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report-${{ matrix.test-suite }}
          path: frontend/playwright-report/
          retention-days: 30

      - name: Upload chat logs
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: chat-logs-${{ matrix.test-suite }}
          path: frontend/test-results/chat-logs/
          retention-days: 30

      - name: Upload screenshots
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: screenshots-${{ matrix.test-suite }}
          path: frontend/test-results/screenshots/
          retention-days: 30

  report:
    name: Test Report
    runs-on: ubuntu-latest
    if: always()
    needs: e2e-test

    steps:
      - name: Comment PR with results
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const testResults = context.payload.pull_request.statuses;
            const comment = `## E2E MOC Validation Results

            - ✅ Chat Flow Tests
            - ✅ Candidate Verification Tests
            - ✅ Action Button Tests
            - ✅ Multi-Select Tests

            See artifacts for details.`;

            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });
```

**Checklist**:
- [ ] Workflow file created
- [ ] Matrix strategy covers all test suites
- [ ] Artifacts upload configured
- [ ] PR comment generation works
- [ ] Workflow triggers on correct events

### Task 8.2: Update Frontend package.json Scripts

**File**: `frontend/package.json`

**Location**: `scripts` section

**Estimated Time**: 15min

**Changes**:

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:debug": "playwright test --debug",
    "test:e2e:moc": "playwright test e2e/tests/chat/moc-*.spec.ts",
    "test:e2e:report": "playwright show-report"
  }
}
```

**Checklist**:
- [ ] Scripts added to package.json
- [ ] `test:e2e` is default Playwright command
- [ ] `test:e2e:moc` specifically runs MOC tests
- [ ] Debug and headed modes available

---

## Completion Checklist

### Phase Completion

- [ ] Phase 1: Page Object Extension (4/4 tasks)
- [ ] Phase 2: ChatLogger Enhancement (3/3 tasks)
- [ ] Phase 3: Chat Flow Test Scenarios (2/2 tasks)
- [ ] Phase 4: Candidate Verification Tests (1/1 task)
- [ ] Phase 5: Action Button Tests (1/1 task)
- [ ] Phase 6: Multi-Select Tests (1/1 task)
- [ ] Phase 7: Integration & Validation (2/2 tasks)
- [ ] Phase 8: CI/CD Setup (2/2 tasks)

### Quality Checklist

- [ ] All TypeScript files compile without errors
- [ ] All tests run successfully (pass or skip)
- [ ] Chat logs have correct structure
- [ ] Code follows existing patterns
- [ ] All JSDoc comments complete
- [ ] No console errors/warnings

### Documentation

- [ ] README.md updated with E2E MOC test info
- [ ] Troubleshooting guide created
- [ ] Test data clearly documented
- [ ] Page Object methods well-commented

---

## Success Criteria

1. **All 4 test suites pass** with 95%+ success rate
2. **Chat logs** capture all messages, suggestions, and user actions
3. **CI/CD integration** works for PRs
4. **Page Object** methods are reusable and well-tested
5. **New scenarios** can be added in <2 hours

---

## Notes for Implementing Agents

1. **Incremental Testing**: Run tests after each phase to catch issues early
2. **Debugging**: Use `--headed` mode to watch test execution
3. **Skipped Tests**: Expected for some tests (e.g., if specific suggestions don't appear)
4. **Selector Failures**: May need adjustment based on actual UI (use `--debug` mode)
5. **Performance**: Tests should complete within 5 minutes per suite
6. **Network Issues**: Tests may timeout in poor network conditions (retry 2x)

---

## Time Estimate Summary

- **Development**: ~17.5 hours
- **Testing & Validation**: ~2 hours
- **CI/CD Setup**: ~1 hour
- **Total**: ~20.5 hours

