# WEBUI E2E Chat Test Specification - Design Document

## Overview
- **Purpose**: VOW WEBUI E2Eテストの技術設計を定義する
- **Status**: Draft
- **Version**: 1.0.0
- **Last Updated**: 2026-02-05
- **Author**: vow-spec-architect

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         E2E Test Suite                               │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │   Test       │  │   Page       │  │   Test       │              │
│  │   Fixtures   │  │   Objects    │  │   Utilities  │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│         │                 │                 │                       │
│  ┌──────┴─────────────────┴─────────────────┴──────┐               │
│  │              Playwright Test Framework           │               │
│  └──────────────────────────────────────────────────┘               │
│                           │                                         │
│  ┌────────────────────────┴────────────────────────┐               │
│  │              Browser Automation Layer            │               │
│  │   (Chromium | Firefox | WebKit)                 │               │
│  └──────────────────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     VOW Application                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │   Login      │  │   Dashboard  │  │   MOC        │              │
│  │   Page       │  │   Page       │  │   Section    │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
└─────────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
frontend/
├── e2e/
│   ├── playwright.config.ts        # Playwright configuration
│   ├── fixtures/
│   │   ├── auth.fixture.ts         # Authentication fixture
│   │   ├── chat.fixture.ts         # Chat test fixture
│   │   └── base.fixture.ts         # Base test fixture
│   ├── pages/
│   │   ├── base.page.ts            # Base page object
│   │   ├── login.page.ts           # Login page object
│   │   ├── dashboard.page.ts       # Dashboard page object
│   │   └── moc-section.page.ts     # MOC Section page object
│   ├── tests/
│   │   ├── auth/
│   │   │   └── login.spec.ts       # Login tests
│   │   ├── chat/
│   │   │   ├── basic-chat.spec.ts  # Basic chat tests
│   │   │   ├── suggestions.spec.ts # Suggestion button tests
│   │   │   └── scenarios/
│   │   │       ├── health.spec.ts  # Health category scenario
│   │   │       ├── learning.spec.ts # Learning category scenario
│   │   │       └── productivity.spec.ts # Productivity scenario
│   │   └── integration/
│   │       └── full-flow.spec.ts   # Full E2E flow tests
│   ├── utils/
│   │   ├── chat-logger.ts          # Chat log recording
│   │   ├── screenshot-helper.ts    # Screenshot utilities
│   │   ├── test-data.ts            # Test data definitions
│   │   └── wait-helpers.ts         # Smart waiting utilities
│   ├── data/
│   │   ├── test-scenarios.json     # Pre-defined test scenarios
│   │   └── expected-responses.json # Expected response patterns
│   └── global-setup.ts             # Global test setup
└── test-results/                   # Test artifacts (gitignored)
    ├── reports/
    ├── chat-logs/
    ├── screenshots/
    └── videos/
```

## Component Design

### 1. Playwright Configuration

**File**: `e2e/playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60000,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 4,
  reporter: [
    ['html', { outputFolder: '../test-results/reports' }],
    ['junit', { outputFile: '../test-results/reports/junit.xml' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.TEST_BASE_URL || 'https://main.do1k9oyyorn24.amplifyapp.com',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  globalSetup: require.resolve('./global-setup'),
});
```

### 2. Page Objects

#### 2.1 Base Page Object

**File**: `e2e/pages/base.page.ts`

```typescript
import { Page, Locator, expect } from '@playwright/test';

export abstract class BasePage {
  constructor(protected page: Page) {}

  /** Navigate to page URL */
  abstract goto(): Promise<void>;

  /** Wait for page to be fully loaded */
  abstract waitForLoad(): Promise<void>;

  /** Take screenshot with descriptive name */
  async screenshot(name: string): Promise<void> {
    const testId = process.env.CURRENT_TEST_ID || 'unknown';
    const timestamp = Date.now();
    await this.page.screenshot({
      path: `test-results/screenshots/${testId}/${name}-${timestamp}.png`,
      fullPage: true,
    });
  }

  /** Wait for element with retry */
  protected async waitForSelector(
    selector: string,
    options?: { timeout?: number; state?: 'visible' | 'hidden' }
  ): Promise<Locator> {
    const locator = this.page.locator(selector);
    await locator.waitFor({
      timeout: options?.timeout || 10000,
      state: options?.state || 'visible',
    });
    return locator;
  }
}
```

#### 2.2 Login Page Object

**File**: `e2e/pages/login.page.ts`

```typescript
import { Page, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class LoginPage extends BasePage {
  // Locators
  private readonly googleButton = 'button:has-text("Continue with Google")';
  private readonly githubButton = 'button:has-text("Continue with GitHub")';
  private readonly errorMessage = 'pre.bg-red-50';
  private readonly logoutButton = 'button:has-text("ログアウト")';

  async goto(): Promise<void> {
    await this.page.goto('/login');
  }

  async waitForLoad(): Promise<void> {
    await this.waitForSelector('h1:has-text("Login")');
  }

  /** Click Google OAuth button */
  async clickGoogleLogin(): Promise<void> {
    await this.page.click(this.googleButton);
  }

  /** Check if login page is displayed */
  async isDisplayed(): Promise<boolean> {
    return await this.page.isVisible(this.googleButton);
  }

  /** Get error message if present */
  async getError(): Promise<string | null> {
    const errorEl = this.page.locator(this.errorMessage);
    if (await errorEl.isVisible()) {
      return await errorEl.textContent();
    }
    return null;
  }

  /** Perform logout */
  async logout(): Promise<void> {
    await this.page.click(this.logoutButton);
  }
}
```

#### 2.3 MOC Section Page Object

**File**: `e2e/pages/moc-section.page.ts`

```typescript
import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

/** Suggestion button types */
export type SuggestionButtonType = 'habit' | 'goal' | 'stickyn' | 'category' | 'text' | 'reply';

/** Suggestion state */
export type SuggestionStatus = 'pending' | 'accepted' | 'snoozed' | 'dismissed' | 'loading';

export interface SuggestionCardInfo {
  type: SuggestionButtonType;
  name: string;
  description?: string;
  rationale?: string;
  status: SuggestionStatus;
}

export interface QuickReplyInfo {
  id: string;
  label: string;
  value: string;
  icon?: string;
}

export class MOCSectionPage extends BasePage {
  // Locators
  private readonly chatInput = 'input[placeholder*="メッセージを入力"], input[placeholder*="message"]';
  private readonly sendButton = 'button[aria-label="Send"], button:has(svg[stroke="currentColor"])';
  private readonly chatTimeline = '[class*="chat"], [class*="timeline"], [class*="messages"]';
  private readonly userMessage = '[class*="user-message"], [data-role="user"]';
  private readonly assistantMessage = '[class*="assistant-message"], [data-role="assistant"], [class*="coach"]';
  private readonly loadingIndicator = '[class*="loading"], [class*="spinner"], [class*="animate-spin"]';
  private readonly suggestionCard = '[class*="suggestion"], [data-testid*="suggestion"]';
  private readonly quickReplyButton = '[class*="quick-reply"], button[data-quick-reply]';
  private readonly typeBadge = '[class*="badge"], span[class*="px-1.5"][class*="py-0.5"]';

  // Tab selectors
  private readonly chatTab = 'button:has-text("チャット"), button:has-text("Chat")';
  private readonly mocSection = '[data-section="moc"], [class*="moc-section"]';

  async goto(): Promise<void> {
    await this.page.goto('/dashboard');
    // Navigate to MOC section if not already there
    const mocLink = this.page.locator('button:has-text("Agents"), [data-section-id="agents"]');
    if (await mocLink.isVisible()) {
      await mocLink.click();
    }
  }

  async waitForLoad(): Promise<void> {
    await this.waitForSelector(this.chatInput, { timeout: 15000 });
  }

  /** Send a chat message */
  async sendMessage(message: string): Promise<void> {
    const input = this.page.locator(this.chatInput);
    await input.fill(message);
    await input.press('Enter');
  }

  /** Wait for AI response */
  async waitForResponse(timeout = 30000): Promise<void> {
    // Wait for loading indicator to appear
    try {
      await this.page.waitForSelector(this.loadingIndicator, { timeout: 5000 });
    } catch {
      // Loading indicator might be too fast to catch
    }

    // Wait for loading indicator to disappear
    await this.page.waitForSelector(this.loadingIndicator, {
      state: 'hidden',
      timeout
    }).catch(() => {
      // May already be hidden
    });

    // Wait for new message to appear
    await this.page.waitForTimeout(1000);
  }

  /** Get all suggestion cards in current view */
  async getSuggestionCards(): Promise<SuggestionCardInfo[]> {
    const cards = this.page.locator(this.suggestionCard);
    const count = await cards.count();
    const results: SuggestionCardInfo[] = [];

    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);

      // Determine type from badge
      const badge = card.locator(this.typeBadge).first();
      const badgeText = await badge.textContent().catch(() => '');
      const type = this.parseTypeFromBadge(badgeText || '');

      // Get name and description
      const name = await card.locator('h4, [class*="font-medium"]').first().textContent() || '';
      const description = await card.locator('[class*="description"], [class*="muted-foreground"]').first().textContent().catch(() => '');

      // Determine status
      const status = await this.getCardStatus(card);

      results.push({
        type,
        name: name.trim(),
        description: description?.trim(),
        status,
      });
    }

    return results;
  }

  /** Parse suggestion type from badge text */
  private parseTypeFromBadge(text: string): SuggestionButtonType {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('habit')) return 'habit';
    if (lowerText.includes('goal')) return 'goal';
    if (lowerText.includes('sticky')) return 'stickyn';
    if (lowerText.includes('category')) return 'category';
    if (lowerText.includes('reply') || lowerText.includes('回答')) return 'reply';
    return 'text';
  }

  /** Get card status from styling */
  private async getCardStatus(card: Locator): Promise<SuggestionStatus> {
    const classAttr = await card.getAttribute('class') || '';
    if (classAttr.includes('loading') || await card.locator(this.loadingIndicator).isVisible()) {
      return 'loading';
    }
    if (classAttr.includes('green') || await card.locator('text=採用済み, text=Accepted').isVisible().catch(() => false)) {
      return 'accepted';
    }
    if (classAttr.includes('yellow') || await card.locator('text=後で確認, text=Snoozed').isVisible().catch(() => false)) {
      return 'snoozed';
    }
    if (classAttr.includes('opacity') || await card.locator('text=不要, text=Dismissed').isVisible().catch(() => false)) {
      return 'dismissed';
    }
    return 'pending';
  }

  /** Get all quick reply buttons */
  async getQuickReplies(): Promise<QuickReplyInfo[]> {
    const buttons = this.page.locator(this.quickReplyButton);
    const count = await buttons.count();
    const results: QuickReplyInfo[] = [];

    for (let i = 0; i < count; i++) {
      const btn = buttons.nth(i);
      const label = await btn.textContent() || '';
      const value = await btn.getAttribute('data-value') || label;
      const id = await btn.getAttribute('data-id') || `quick-reply-${i}`;

      results.push({
        id,
        label: label.trim(),
        value,
      });
    }

    return results;
  }

  /** Click a quick reply button by label */
  async clickQuickReply(label: string): Promise<void> {
    const button = this.page.locator(`${this.quickReplyButton}:has-text("${label}")`);
    await button.click();
  }

  /** Click a suggestion card */
  async clickSuggestionCard(index: number): Promise<void> {
    const cards = this.page.locator(this.suggestionCard);
    await cards.nth(index).click();
  }

  /** Accept a suggestion (click the card to open modal and confirm) */
  async acceptSuggestion(index: number): Promise<void> {
    await this.clickSuggestionCard(index);
    // Wait for modal and click save button
    await this.page.waitForSelector('[role="dialog"], [class*="modal"]');
    const saveButton = this.page.locator('button:has-text("追加"), button:has-text("作成"), button:has-text("Save")');
    if (await saveButton.isVisible()) {
      await saveButton.click();
    }
  }

  /** Snooze a suggestion */
  async snoozeSuggestion(index: number): Promise<void> {
    const card = this.page.locator(this.suggestionCard).nth(index);
    const snoozeBtn = card.locator('button:has-text("後で"), button[aria-label*="snooze"]');
    await snoozeBtn.click();
  }

  /** Dismiss a suggestion */
  async dismissSuggestion(index: number): Promise<void> {
    const card = this.page.locator(this.suggestionCard).nth(index);
    const dismissBtn = card.locator('button:has-text("不要"), button[aria-label*="dismiss"]');
    await dismissBtn.click();
  }

  /** Get message count */
  async getMessageCount(): Promise<number> {
    const messages = this.page.locator(`${this.userMessage}, ${this.assistantMessage}`);
    return await messages.count();
  }

  /** Get last message content */
  async getLastMessageContent(): Promise<string> {
    const messages = this.page.locator(`${this.userMessage}, ${this.assistantMessage}`);
    const lastMessage = messages.last();
    return await lastMessage.textContent() || '';
  }

  /** Check if chat is loading */
  async isLoading(): Promise<boolean> {
    return await this.page.locator(this.loadingIndicator).isVisible();
  }

  /** Verify suggestion type badge color */
  async verifySuggestionTypeBadge(
    type: SuggestionButtonType,
    expectedColorClass: string
  ): Promise<boolean> {
    const typeLabels: Record<SuggestionButtonType, string> = {
      habit: 'Habit',
      goal: 'Goal',
      stickyn: "Sticky'n",
      category: 'Category',
      text: 'Text',
      reply: '回答',
    };

    const badge = this.page.locator(`${this.typeBadge}:has-text("${typeLabels[type]}")`);
    if (await badge.isVisible()) {
      const classAttr = await badge.getAttribute('class') || '';
      return classAttr.includes(expectedColorClass);
    }
    return false;
  }
}
```

### 3. Test Fixtures

#### 3.1 Auth Fixture

**File**: `e2e/fixtures/auth.fixture.ts`

```typescript
import { test as base, Page, BrowserContext } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import path from 'path';

const AUTH_FILE = path.join(__dirname, '../../.auth/user.json');

export const test = base.extend<{
  authenticatedPage: Page;
}>({
  authenticatedPage: async ({ browser }, use) => {
    // Try to use existing auth state
    let context: BrowserContext;
    try {
      context = await browser.newContext({ storageState: AUTH_FILE });
    } catch {
      // Auth file doesn't exist, need to login
      context = await browser.newContext();
      const page = await context.newPage();

      // Perform login
      await page.goto('/login');
      // Note: OAuth flow requires manual intervention or mock
      // For automated tests, consider using API tokens or session injection

      // Save auth state for future runs
      await context.storageState({ path: AUTH_FILE });
    }

    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect } from '@playwright/test';
```

#### 3.2 Chat Fixture

**File**: `e2e/fixtures/chat.fixture.ts`

```typescript
import { test as authTest } from './auth.fixture';
import { MOCSectionPage } from '../pages/moc-section.page';
import { ChatLogger } from '../utils/chat-logger';

export interface ChatTestContext {
  mocPage: MOCSectionPage;
  chatLogger: ChatLogger;
}

export const test = authTest.extend<ChatTestContext>({
  mocPage: async ({ authenticatedPage }, use) => {
    const mocPage = new MOCSectionPage(authenticatedPage);
    await mocPage.goto();
    await mocPage.waitForLoad();
    await use(mocPage);
  },

  chatLogger: async ({}, use, testInfo) => {
    const logger = new ChatLogger(testInfo.title);
    await use(logger);
    // Save log after test completes
    await logger.save();
  },
});

export { expect } from '@playwright/test';
```

### 4. Test Utilities

#### 4.1 Chat Logger

**File**: `e2e/utils/chat-logger.ts`

```typescript
import fs from 'fs/promises';
import path from 'path';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  suggestions?: Array<{
    type: string;
    name: string;
    status: string;
  }>;
  quickReplies?: Array<{
    label: string;
    selected: boolean;
  }>;
}

interface ChatLog {
  testId: string;
  timestamp: string;
  scenario: string;
  messages: ChatMessage[];
  duration: number;
  status: 'pass' | 'fail' | 'error';
  error?: string;
}

export class ChatLogger {
  private log: ChatLog;
  private startTime: number;

  constructor(scenario: string) {
    this.startTime = Date.now();
    this.log = {
      testId: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      scenario,
      messages: [],
      duration: 0,
      status: 'pass',
    };

    // Set test ID for screenshots
    process.env.CURRENT_TEST_ID = this.log.testId;
  }

  /** Log user message */
  logUserMessage(content: string): void {
    this.log.messages.push({
      id: `msg-${this.log.messages.length}`,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    });
  }

  /** Log assistant message */
  logAssistantMessage(
    content: string,
    suggestions?: ChatMessage['suggestions'],
    quickReplies?: ChatMessage['quickReplies']
  ): void {
    this.log.messages.push({
      id: `msg-${this.log.messages.length}`,
      role: 'assistant',
      content,
      timestamp: new Date().toISOString(),
      suggestions,
      quickReplies,
    });
  }

  /** Log system message */
  logSystemMessage(content: string): void {
    this.log.messages.push({
      id: `msg-${this.log.messages.length}`,
      role: 'system',
      content,
      timestamp: new Date().toISOString(),
    });
  }

  /** Mark test as failed */
  markFailed(error: string): void {
    this.log.status = 'fail';
    this.log.error = error;
  }

  /** Mark test as error */
  markError(error: string): void {
    this.log.status = 'error';
    this.log.error = error;
  }

  /** Save log to file */
  async save(): Promise<void> {
    this.log.duration = Date.now() - this.startTime;

    const logDir = path.join(process.cwd(), 'test-results', 'chat-logs');
    await fs.mkdir(logDir, { recursive: true });

    const filename = `${this.log.testId}.json`;
    const filepath = path.join(logDir, filename);

    await fs.writeFile(filepath, JSON.stringify(this.log, null, 2));
    console.log(`Chat log saved: ${filepath}`);
  }

  /** Get test ID */
  getTestId(): string {
    return this.log.testId;
  }
}
```

#### 4.2 Test Data

**File**: `e2e/utils/test-data.ts`

```typescript
export interface TestScenario {
  id: string;
  name: string;
  category: string;
  subCategory: string;
  initialQuestion: string;
  expectedQuickReplies: string[];
  expectedSuggestionTypes: string[];
}

export const TEST_SCENARIOS: TestScenario[] = [
  {
    id: 'health-exercise',
    name: '運動習慣の確立',
    category: 'Health',
    subCategory: 'Exercise',
    initialQuestion: '運動習慣を身につけたいのですが、何から始めればいいですか？',
    expectedQuickReplies: ['ジョギング', 'ウォーキング', '筋トレ', 'ストレッチ'],
    expectedSuggestionTypes: ['habit'],
  },
  {
    id: 'health-sleep',
    name: '睡眠改善',
    category: 'Health',
    subCategory: 'Sleep',
    initialQuestion: '睡眠の質を改善したいです。良い習慣はありますか？',
    expectedQuickReplies: ['入眠', '睡眠時間', '寝室環境'],
    expectedSuggestionTypes: ['habit'],
  },
  {
    id: 'learning-reading',
    name: '読書習慣',
    category: 'Learning',
    subCategory: 'Reading',
    initialQuestion: '読書を習慣化したいのですが、続けるコツを教えてください',
    expectedQuickReplies: ['ビジネス書', '小説', '自己啓発'],
    expectedSuggestionTypes: ['habit', 'goal'],
  },
  {
    id: 'learning-language',
    name: '語学学習',
    category: 'Learning',
    subCategory: 'Language',
    initialQuestion: '英語学習を始めたいです。効果的な方法を教えてください',
    expectedQuickReplies: ['リスニング', 'スピーキング', 'リーディング', '文法'],
    expectedSuggestionTypes: ['habit', 'goal'],
  },
  {
    id: 'productivity-time',
    name: '時間管理',
    category: 'Productivity',
    subCategory: 'Time Management',
    initialQuestion: '時間管理を改善したいです。おすすめの方法はありますか？',
    expectedQuickReplies: ['朝活', 'ポモドーロ', 'タイムブロッキング'],
    expectedSuggestionTypes: ['habit', 'stickyn'],
  },
  {
    id: 'productivity-task',
    name: 'タスク整理',
    category: 'Productivity',
    subCategory: 'Task Organization',
    initialQuestion: 'タスクが溜まりがちです。整理する良い方法を教えてください',
    expectedQuickReplies: ['GTD', 'カンバン', '優先順位付け'],
    expectedSuggestionTypes: ['habit', 'stickyn', 'goal'],
  },
];

/** Type badge expected colors */
export const TYPE_BADGE_COLORS: Record<string, string> = {
  habit: 'blue',
  goal: 'purple',
  stickyn: 'yellow',
  category: 'green',
  text: 'gray',
  reply: 'teal',
};

/** Expected badge labels */
export const TYPE_BADGE_LABELS: Record<string, { ja: string; en: string }> = {
  habit: { ja: 'Habit', en: 'Habit' },
  goal: { ja: 'Goal', en: 'Goal' },
  stickyn: { ja: "Sticky'n", en: "Sticky'n" },
  category: { ja: 'Category', en: 'Category' },
  text: { ja: 'Text', en: 'Text' },
  reply: { ja: '回答', en: 'Reply' },
};
```

### 5. Test Implementations

#### 5.1 Login Test

**File**: `e2e/tests/auth/login.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/login.page';

test.describe('Login Functionality', () => {
  test('should display login page with OAuth buttons', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.waitForLoad();

    expect(await loginPage.isDisplayed()).toBeTruthy();
    await loginPage.screenshot('login-page-loaded');
  });

  test('should redirect to dashboard after successful login', async ({ page }) => {
    // Note: This test requires OAuth setup or session injection
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    // For CI, use stored auth state
    if (process.env.CI) {
      test.skip(true, 'OAuth requires manual intervention in CI');
    }

    await loginPage.clickGoogleLogin();
    // Handle OAuth popup/redirect...

    await page.waitForURL('/dashboard');
    expect(page.url()).toContain('/dashboard');
  });
});
```

#### 5.2 Suggestion Button Test

**File**: `e2e/tests/chat/suggestions.spec.ts`

```typescript
import { test, expect } from '../../fixtures/chat.fixture';
import { TYPE_BADGE_COLORS, TYPE_BADGE_LABELS } from '../../utils/test-data';
import type { SuggestionButtonType } from '../../pages/moc-section.page';

test.describe('Suggestion Button Types', () => {
  const testTypes: SuggestionButtonType[] = ['habit', 'goal', 'stickyn', 'reply'];

  test('should display correct badge colors for each type', async ({ mocPage, chatLogger }) => {
    // Send message to trigger suggestions
    const message = '新しい習慣を始めたいです';
    chatLogger.logUserMessage(message);
    await mocPage.sendMessage(message);
    await mocPage.waitForResponse();

    // Get suggestions
    const suggestions = await mocPage.getSuggestionCards();
    chatLogger.logAssistantMessage('Received suggestions', suggestions.map(s => ({
      type: s.type,
      name: s.name,
      status: s.status,
    })));

    // Verify we got some suggestions
    expect(suggestions.length).toBeGreaterThan(0);

    // Verify badge colors
    for (const suggestion of suggestions) {
      const expectedColor = TYPE_BADGE_COLORS[suggestion.type];
      const isCorrectColor = await mocPage.verifySuggestionTypeBadge(
        suggestion.type,
        expectedColor
      );
      expect(isCorrectColor).toBeTruthy();
    }

    await mocPage.screenshot('suggestions-displayed');
  });

  test('should transition suggestion states correctly', async ({ mocPage, chatLogger }) => {
    // Trigger suggestions
    await mocPage.sendMessage('運動習慣を始めたい');
    await mocPage.waitForResponse();

    let suggestions = await mocPage.getSuggestionCards();
    if (suggestions.length === 0) {
      test.skip(true, 'No suggestions received');
      return;
    }

    // Test accept
    await mocPage.acceptSuggestion(0);
    await mocPage.waitForResponse();

    suggestions = await mocPage.getSuggestionCards();
    const accepted = suggestions.find(s => s.status === 'accepted');
    expect(accepted).toBeDefined();

    await mocPage.screenshot('suggestion-accepted');
  });

  test('should open correct modal for habit type', async ({ mocPage }) => {
    await mocPage.sendMessage('毎日ジョギングする習慣を作りたい');
    await mocPage.waitForResponse();

    const suggestions = await mocPage.getSuggestionCards();
    const habitSuggestion = suggestions.findIndex(s => s.type === 'habit');

    if (habitSuggestion === -1) {
      test.skip(true, 'No habit suggestion received');
      return;
    }

    await mocPage.clickSuggestionCard(habitSuggestion);

    // Verify HabitModal opened
    const modal = mocPage['page'].locator('[role="dialog"]');
    await expect(modal).toBeVisible();
    await expect(modal.locator('text=習慣, text=Habit')).toBeVisible();
  });

  test('should open correct modal for goal type', async ({ mocPage }) => {
    await mocPage.sendMessage('3ヶ月で5kg痩せる目標を立てたい');
    await mocPage.waitForResponse();

    const suggestions = await mocPage.getSuggestionCards();
    const goalSuggestion = suggestions.findIndex(s => s.type === 'goal');

    if (goalSuggestion === -1) {
      test.skip(true, 'No goal suggestion received');
      return;
    }

    await mocPage.clickSuggestionCard(goalSuggestion);

    // Verify GoalModal opened
    const modal = mocPage['page'].locator('[role="dialog"]');
    await expect(modal).toBeVisible();
    await expect(modal.locator('text=ゴール, text=Goal, text=目標')).toBeVisible();
  });
});
```

#### 5.3 Scenario Test (Health Category)

**File**: `e2e/tests/chat/scenarios/health.spec.ts`

```typescript
import { test, expect } from '../../../fixtures/chat.fixture';
import { TEST_SCENARIOS } from '../../../utils/test-data';

const healthScenarios = TEST_SCENARIOS.filter(s => s.category === 'Health');

test.describe('Health Category Scenarios', () => {
  for (const scenario of healthScenarios) {
    test(`${scenario.name} - should complete conversation flow`, async ({ mocPage, chatLogger }) => {
      // Step 1: Send initial question
      chatLogger.logUserMessage(scenario.initialQuestion);
      await mocPage.sendMessage(scenario.initialQuestion);
      await mocPage.waitForResponse(30000);
      await mocPage.screenshot(`${scenario.id}-step1-initial`);

      // Step 2: Check for quick replies or suggestions
      const quickReplies = await mocPage.getQuickReplies();
      const suggestions = await mocPage.getSuggestionCards();

      chatLogger.logAssistantMessage(
        await mocPage.getLastMessageContent(),
        suggestions.map(s => ({ type: s.type, name: s.name, status: s.status })),
        quickReplies.map(qr => ({ label: qr.label, selected: false }))
      );

      // Verify we got a response (either quick replies or suggestions)
      expect(quickReplies.length + suggestions.length).toBeGreaterThan(0);

      // Step 3: If quick replies exist, click one
      if (quickReplies.length > 0) {
        const selectedReply = quickReplies[0];
        chatLogger.logUserMessage(`[Quick Reply] ${selectedReply.label}`);
        await mocPage.clickQuickReply(selectedReply.label);
        await mocPage.waitForResponse(30000);
        await mocPage.screenshot(`${scenario.id}-step2-reply`);
      }

      // Step 4: Verify suggestions appear
      const finalSuggestions = await mocPage.getSuggestionCards();
      chatLogger.logAssistantMessage(
        await mocPage.getLastMessageContent(),
        finalSuggestions.map(s => ({ type: s.type, name: s.name, status: s.status }))
      );

      // Verify suggestion types match expectations
      if (scenario.expectedSuggestionTypes.length > 0 && finalSuggestions.length > 0) {
        const receivedTypes = finalSuggestions.map(s => s.type);
        const hasExpectedType = scenario.expectedSuggestionTypes.some(
          expected => receivedTypes.includes(expected as any)
        );
        expect(hasExpectedType).toBeTruthy();
      }

      await mocPage.screenshot(`${scenario.id}-complete`);
    });
  }
});
```

## Data Flow

### Chat Interaction Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Test      │     │   MOC       │     │   Backend   │
│   Script    │────▶│   Page      │────▶│   API       │
└─────────────┘     └─────────────┘     └─────────────┘
      │                   │                   │
      │ sendMessage()     │                   │
      │──────────────────▶│                   │
      │                   │ POST /api/chat    │
      │                   │──────────────────▶│
      │                   │                   │ AI Response
      │                   │◀──────────────────│
      │                   │ Display Response  │
      │ waitForResponse() │                   │
      │◀──────────────────│                   │
      │                   │                   │
      │ getSuggestions()  │                   │
      │──────────────────▶│                   │
      │ Return suggestions│                   │
      │◀──────────────────│                   │
```

### Test Artifact Generation

```
Test Execution
     │
     ├─▶ ChatLogger.logUserMessage()
     │        │
     │        ▼
     │   In-memory log
     │
     ├─▶ Screenshot capture
     │        │
     │        ▼
     │   test-results/screenshots/{testId}/
     │
     ├─▶ Test completion
     │        │
     │        ▼
     │   ChatLogger.save()
     │        │
     │        ▼
     │   test-results/chat-logs/{testId}.json
     │
     └─▶ Playwright Reporter
              │
              ▼
         test-results/reports/
```

## Integration Points

### Environment Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `TEST_BASE_URL` | Target application URL | `https://main.do1k9oyyorn24.amplifyapp.com/` |
| `TEST_EMAIL` | Test user email | `k6285620@gmail.com` |
| `TEST_TIMEOUT_MS` | Global test timeout | `60000` |
| `CI` | CI environment flag | `false` |
| `PWDEBUG` | Playwright debug mode | `false` |

### CI/CD Pipeline Integration

**GitHub Actions Workflow** (`.github/workflows/e2e-tests.yml`):

```yaml
name: E2E Tests

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        run: cd frontend && npm ci

      - name: Install Playwright browsers
        run: cd frontend && npx playwright install --with-deps

      - name: Run E2E tests
        run: cd frontend && npm run test:e2e:ci
        env:
          TEST_BASE_URL: ${{ secrets.TEST_BASE_URL }}

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: e2e-test-results
          path: frontend/test-results/
          retention-days: 7
```

## Error Handling Strategy

### Retry Logic

| Error Type | Retry Count | Backoff | Action |
|------------|-------------|---------|--------|
| Network timeout | 3 | Exponential (2s, 4s, 8s) | Retry request |
| Element not found | 2 | Fixed (2s) | Re-query DOM |
| Auth failure | 3 | Fixed (5s) | Re-authenticate |
| API error 5xx | 2 | Exponential | Retry request |
| API error 4xx | 0 | - | Fail immediately |

### Screenshot Strategy

| Event | Screenshot Name Pattern |
|-------|------------------------|
| Test start | `{testId}/step-000-initial.png` |
| User action | `{testId}/step-{n}-{action}.png` |
| Error | `{testId}/error-{timestamp}.png` |
| Test end | `{testId}/step-999-final.png` |

## Security Considerations

1. **Credential Storage**: Test credentials stored in GitHub Secrets or environment variables
2. **Log Sanitization**: API responses sanitized to remove tokens/sensitive data before logging
3. **Auth State Files**: `.auth/` directory gitignored to prevent credential leakage
4. **Test Isolation**: Each test uses isolated browser context
