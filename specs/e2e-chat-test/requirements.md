# WEBUI E2E Chat Test Specification - Requirements Document

## Overview
- **Purpose**: VOWアプリケーションのWEBUI E2Eテスト仕様を定義し、チャット機能・候補ラベル表示・ログイン機能の品質保証を実現する
- **Status**: Draft
- **Version**: 1.0.0
- **Last Updated**: 2026-02-05
- **Author**: vow-spec-architect

## Introduction

本ドキュメントは、VOW（習慣・目標トラッカー）アプリケーションのWEBUI E2Eテスト要件を定義する。Playwrightを使用し、TypeScriptで実装されるテストスイートは、以下の主要機能を検証する：

1. ログイン機能（Google OAuth）
2. AIコーチとのチャット機能（MOCセクション）
3. 候補ラベルの型チェック（Habit/Goal/Sticky'n/Reply型）
4. チャットログの記録と保存

## Glossary

- **MOC (Multi-agent Orchestration Center)**: AIエージェントとのチャットを行うダッシュボードセクション
- **SuggestionButtonType**: 候補ボタンの型 (`habit` | `goal` | `stickyn` | `category` | `text` | `reply`)
- **QuickReply**: カテゴリ選択などの素早い返信ボタン
- **SuggestionCard**: 習慣/ゴール提案を表示するカードコンポーネント
- **E2E (End-to-End)**: ユーザー視点でのアプリケーション全体テスト
- **Playwright**: Microsoft製のブラウザ自動化テストフレームワーク

## Requirements

### Requirement 1: Test Environment Setup

**User Story:** テスト実行者として、再現性のあるテスト環境を構築したい。

#### Acceptance Criteria

1. THE Test Suite SHALL use Playwright v1.40+ with TypeScript configuration
2. THE Test Suite SHALL support Chromium, Firefox, and WebKit browsers
3. THE Test Suite SHALL be configurable via environment variables:
   - `TEST_BASE_URL`: テスト対象URL (default: `https://main.do1k9oyyorn24.amplifyapp.com/`)
   - `TEST_EMAIL`: テスト用Googleアカウント (default: `k6285620@gmail.com`)
   - `TEST_TIMEOUT_MS`: グローバルタイムアウト (default: `60000`)
4. THE Test Suite SHALL generate HTML reports in `test-results/` directory
5. THE Test Suite SHALL support parallel execution with isolated browser contexts
6. THE Test Suite SHALL integrate with CI/CD pipelines via standard exit codes

### Requirement 2: Login Functionality Test

**User Story:** テスト実行者として、Googleアカウントでのログイン機能を検証したい。

#### Acceptance Criteria

1. WHEN navigating to `/login`, THE System SHALL display the login page with Google OAuth button
2. WHEN clicking "Continue with Google", THE System SHALL initiate OAuth flow with Supabase
3. AFTER successful authentication, THE System SHALL redirect to `/dashboard`
4. THE Test Suite SHALL verify the user is authenticated by checking:
   - Dashboard page loads successfully
   - User menu displays email or username
   - Protected API calls return 200 status
5. THE Test Suite SHALL support authentication state persistence across test files using Playwright's `storageState`
6. WHEN login fails, THE Test Suite SHALL capture error screenshots and log details

### Requirement 3: Chat Functionality Test

**User Story:** テスト実行者として、AIコーチとのチャット機能が正しく動作することを検証したい。

#### Acceptance Criteria

1. WHEN accessing the MOC section, THE System SHALL display the chat interface
2. THE Test Suite SHALL verify the chat input field is visible and editable
3. WHEN sending a message, THE System SHALL:
   - Display the user message in the chat timeline
   - Show a loading indicator during AI response
   - Display the AI response within configured timeout
4. THE Test Suite SHALL NOT send batch/complex questions (requirement: one topic at a time)
5. THE Test Suite SHALL verify response contains expected UI elements:
   - Message bubble with sender information
   - Timestamp display
   - Suggestion buttons (when applicable)
6. WHEN an error occurs during chat, THE System SHALL display an error message to the user

### Requirement 4: Pre-defined Test Scenarios for Chat

**User Story:** テスト実行者として、事前定義されたシナリオでチャット機能を検証したい。

#### Acceptance Criteria

1. THE Test Suite SHALL implement test scenarios with pre-defined categories and sub-categories:
   - Category: Health (健康・運動)
     - Sub-category: Exercise (運動習慣)
     - Sub-category: Sleep (睡眠改善)
   - Category: Learning (学習・スキル)
     - Sub-category: Reading (読書習慣)
     - Sub-category: Language (語学学習)
   - Category: Productivity (生産性)
     - Sub-category: Time Management (時間管理)
     - Sub-category: Task Organization (タスク整理)
2. WHEN starting a test scenario, THE Test Suite SHALL send an initial question related to the category
3. THE Test Suite SHALL wait for and interact with QuickReply buttons when presented
4. THE Test Suite SHALL verify the conversation flows through expected stages:
   - Initial question
   - Category/Sub-category selection
   - Specific details gathering
   - Suggestion presentation
5. THE Test Suite SHALL log all conversation turns for post-test analysis

### Requirement 5: Suggestion Button Type Verification

**User Story:** テスト実行者として、候補ボタンの型が正しく表示されることを検証したい。

#### Acceptance Criteria

1. THE Test Suite SHALL verify each SuggestionButtonType renders correctly:
   - `habit`: Blue badge with icon, "Habit" label
   - `goal`: Purple badge with icon, "Goal" label
   - `stickyn`: Yellow badge with icon, "Sticky'n" label
   - `reply`: Teal badge with icon, "Reply" label
   - `category`: Green badge with icon, "Category" label
   - `text`: Gray badge with icon, "Text" label
2. WHEN a suggestion card is displayed, THE Test Suite SHALL verify:
   - Type badge is visible with correct color and label
   - Card content (name, description, rationale) is displayed
   - Action buttons (accept, snooze, dismiss) are functional
3. WHEN clicking a suggestion card, THE System SHALL open the appropriate modal:
   - `habit` type: HabitModal
   - `goal` type: GoalModal
   - `stickyn` type: StickyModal
   - `reply` type: Send as chat reply
4. THE Test Suite SHALL verify suggestion button state transitions:
   - `pending` -> `accepted`: Shows green checkmark badge
   - `pending` -> `snoozed`: Shows yellow postpone badge
   - `pending` -> `dismissed`: Shows gray X badge

### Requirement 6: Quick Reply Button Verification

**User Story:** テスト実行者として、クイック返信ボタンが正しく動作することを検証したい。

#### Acceptance Criteria

1. WHEN QuickReply buttons are displayed, THE Test Suite SHALL verify:
   - All button options are visible and clickable
   - Buttons have appropriate labels and icons
   - Buttons are properly styled (border, padding, hover state)
2. WHEN clicking a QuickReply button, THE System SHALL:
   - Send the selected value as a user message
   - Display the selection in the chat timeline
   - Trigger the next stage of conversation
3. THE Test Suite SHALL verify QuickReply button states:
   - Enabled state: Normal styling, clickable
   - Disabled state: Grayed out, not clickable (during loading)
4. THE Test Suite SHALL verify selection types:
   - `habit_category`: Habit category selection
   - `goal_category`: Goal category selection
   - `difficulty`: Difficulty level selection
   - `drilldown_*`: Deep-dive question types

### Requirement 7: Chat Log Recording

**User Story:** テスト実行者として、チャットログを記録し分析に活用したい。

#### Acceptance Criteria

1. THE Test Suite SHALL record all chat interactions in structured JSON format:
   ```json
   {
     "testId": "string",
     "timestamp": "ISO8601",
     "scenario": "string",
     "messages": [
       {
         "id": "string",
         "role": "user|assistant|system",
         "content": "string",
         "timestamp": "ISO8601",
         "suggestions": [...],
         "quickReplies": [...]
       }
     ],
     "duration": "number",
     "status": "pass|fail|error"
   }
   ```
2. THE Test Suite SHALL save chat logs to `test-results/chat-logs/` directory
3. THE Test Suite SHALL capture screenshots at key conversation points:
   - Initial chat state
   - Each AI response with suggestions
   - Each user interaction (button click, message send)
   - Final conversation state
4. THE Test Suite SHALL include network request/response data for debugging:
   - API endpoint called
   - Request payload
   - Response status and body (sanitized)
5. THE Test Suite SHALL generate a summary report with:
   - Total test scenarios executed
   - Pass/fail counts
   - Average response times
   - Common error patterns

### Requirement 8: Test Result Storage

**User Story:** テスト実行者として、テスト結果を永続化し履歴を追跡したい。

#### Acceptance Criteria

1. THE Test Suite SHALL save test results in the following structure:
   ```
   test-results/
   ├── reports/
   │   ├── index.html           # Playwright HTML report
   │   └── junit.xml            # CI/CD integration
   ├── chat-logs/
   │   ├── {testId}-{timestamp}.json
   │   └── ...
   ├── screenshots/
   │   ├── {testId}/
   │   │   ├── step-001-{description}.png
   │   │   └── ...
   │   └── ...
   └── videos/
       └── {testId}.webm        # Optional video recording
   ```
2. THE Test Suite SHALL support configurable retention policy for test artifacts
3. THE Test Suite SHALL generate unique test IDs for traceability
4. THE Test Suite SHALL support exporting test results to external services (optional):
   - AWS S3 bucket
   - Test management tools (e.g., TestRail)
5. THE Test Suite SHALL maintain test execution history for trend analysis

### Requirement 9: CI/CD Integration

**User Story:** DevOpsエンジニアとして、CI/CDパイプラインでE2Eテストを自動実行したい。

#### Acceptance Criteria

1. THE Test Suite SHALL provide npm scripts for CI/CD execution:
   - `npm run test:e2e`: Run all E2E tests
   - `npm run test:e2e:ci`: Run in CI mode (headless, single worker)
   - `npm run test:e2e:report`: Generate and open HTML report
2. THE Test Suite SHALL exit with appropriate codes:
   - `0`: All tests passed
   - `1`: One or more tests failed
   - `2`: Test infrastructure error
3. THE Test Suite SHALL support GitHub Actions workflow integration:
   - Trigger on PR to `main` or `develop` branches
   - Upload test artifacts as workflow artifacts
   - Post test summary as PR comment
4. THE Test Suite SHALL support environment-specific configurations:
   - `development`: Local development server
   - `staging`: Staging environment
   - `production`: Production environment (read-only tests)
5. THE Test Suite SHALL handle flaky test detection and retry logic

### Requirement 10: Error Handling and Recovery

**User Story:** テスト実行者として、テスト失敗時に適切な診断情報を取得したい。

#### Acceptance Criteria

1. WHEN a test fails, THE Test Suite SHALL capture:
   - Full-page screenshot at failure point
   - Browser console logs
   - Network request/response history
   - Page DOM snapshot
2. WHEN a timeout occurs, THE Test Suite SHALL:
   - Log the operation that timed out
   - Capture current page state
   - Attempt graceful cleanup
3. WHEN authentication fails, THE Test Suite SHALL:
   - Retry authentication up to 3 times
   - Log detailed auth error information
   - Skip dependent tests with clear messaging
4. THE Test Suite SHALL implement retry logic for transient failures:
   - Network errors: Retry 3 times with exponential backoff
   - Element not found: Retry with extended timeout
   - API errors: Log and continue or fail based on severity
5. THE Test Suite SHALL provide clear, actionable error messages in Japanese

## Non-Functional Requirements

### NFR-001: Performance
- Test suite execution time SHALL NOT exceed 10 minutes for full run
- Individual test cases SHALL complete within 60 seconds
- Parallel execution SHALL support up to 4 concurrent workers

### NFR-002: Reliability
- Test suite SHALL have > 95% pass rate when system is functioning correctly
- Flaky test rate SHALL be < 5%
- Test results SHALL be reproducible across environments

### NFR-003: Maintainability
- Test code SHALL follow TypeScript best practices
- Page Objects pattern SHALL be used for UI interactions
- Test data SHALL be externalized from test logic

### NFR-004: Security
- Test credentials SHALL be stored securely (environment variables or secrets manager)
- Sensitive data SHALL NOT be logged or captured in artifacts
- Test user accounts SHALL have minimal required permissions

## Agent Coordination Notes

### For Implementation Agents

1. **Authentication Handling**: OAuth flow requires special handling - consider using Playwright's `page.context().storageState()` to persist auth state
2. **Chat Response Timing**: AI responses may take 5-30 seconds; implement smart waiting strategies
3. **Suggestion Type Detection**: Use `data-testid` attributes for reliable element selection
4. **Screenshot Naming**: Use descriptive names that indicate test scenario and step number

### For QA Agents

1. **Test Data Preparation**: Ensure test account has clean state before test runs
2. **Environment Verification**: Confirm target environment is accessible before test execution
3. **Regression Analysis**: Compare test results across runs for regression detection

### Dependencies

- Playwright v1.40+
- TypeScript 5.0+
- Node.js 20+
- VOW Frontend (deployed or local)
- Google OAuth credentials (test account)
