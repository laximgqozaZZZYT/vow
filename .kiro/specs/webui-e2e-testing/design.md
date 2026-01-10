# Design Document

## Overview

WEBUIのE2Eテストシステムを構築し、GitHub Actionsでの自動デプロイ時に品質チェックを実行する。Playwrightを使用してブラウザ自動化を行い、実際のユーザー操作をシミュレートしてリグレッションを防止する。

## Architecture

### Test Framework Selection

**Playwright**を選択する理由：
- TypeScriptネイティブサポート
- 複数ブラウザ対応（Chromium、Firefox、Safari）
- 高速で安定したテスト実行
- 豊富なデバッグ機能
- GitHub Actionsとの優れた統合

### Directory Structure

```
frontend/
├── e2e/
│   ├── tests/
│   │   ├── auth/
│   │   │   ├── login.spec.ts
│   │   │   └── logout.spec.ts
│   │   ├── dashboard/
│   │   │   ├── dashboard-load.spec.ts
│   │   │   ├── activity-management.spec.ts
│   │   │   ├── goal-management.spec.ts
│   │   │   └── calendar-widget.spec.ts
│   │   ├── responsive/
│   │   │   ├── mobile.spec.ts
│   │   │   ├── tablet.spec.ts
│   │   │   └── desktop.spec.ts
│   │   └── error-handling/
│   │       ├── network-errors.spec.ts
│   │       └── data-errors.spec.ts
│   ├── fixtures/
│   │   ├── test-data.ts
│   │   └── mock-responses.ts
│   ├── page-objects/
│   │   ├── LoginPage.ts
│   │   ├── DashboardPage.ts
│   │   ├── ActivityPage.ts
│   │   └── GoalPage.ts
│   ├── utils/
│   │   ├── auth-helpers.ts
│   │   ├── data-helpers.ts
│   │   └── screenshot-helpers.ts
│   └── playwright.config.ts
├── package.json (updated with Playwright dependencies)
└── .github/
    └── workflows/
        └── deploy.yml (updated with E2E tests)
```

## 具体的なテスト操作

### 認証フロー
1. **ホームページアクセス**: `/` にアクセスして「Login」と「Continue as Guest」ボタンの表示確認
2. **ゲストアクセス**: 「Continue as Guest」クリックでダッシュボードへのリダイレクト確認
3. **ログインページ**: 「Login」クリックでログインページへのリダイレクト確認
4. **OAuth認証**: Google/GitHub OAuth ボタンのクリックと認証フロー確認
5. **認証状態保持**: ブラウザ再起動後の認証状態維持確認
6. **ゲストデータ移行**: ゲストユーザーがログイン時のデータ移行確認

### ダッシュボード操作
1. **レイアウト確認**: ヘッダー、サイドバートグル、メインコンテンツエリアの表示確認
2. **サイドバー操作**: ハンバーガーメニューでサイドバーの表示/非表示切り替え
3. **ゴール管理**: 
   - 「New Goal」ボタンでゴール作成モーダル表示
   - ゴール名入力、保存、サイドバーでの表示確認
   - ゴール編集、削除操作
4. **ハビット管理**:
   - 「New Habit」ボタンでハビット作成モーダル表示
   - ハビット名、時間、ゴール関連付け設定
   - ハビット編集、削除操作
5. **アクティビティ管理**:
   - ハビットの「Start」「Complete」「Pause」ボタン操作
   - アクティビティ履歴の表示確認
   - アクティビティ編集、削除操作

### カレンダーウィジェット操作
1. **表示切り替え**: Today/Tomorrow/Week/Month ボタンでビュー切り替え
2. **イベント表示**: ハビットがカレンダーイベントとして表示されることを確認
3. **デスクトップ操作**:
   - イベントクリックでハビット編集モーダル表示
   - イベントドラッグ&ドロップで時間変更
   - イベントリサイズで期間変更
4. **モバイル操作**:
   - イベントタップで選択状態表示
   - 再タップでコンテキストメニュー表示
   - 「移動」選択後のタッチ移動モード
   - ロングプレスでコンテキストメニュー直接表示

### レスポンシブデザイン
1. **ビューポート変更**: 320px（モバイル）、768px（タブレット）、1024px（デスクトップ）での表示確認
2. **タッチ操作**: モバイルでのタッチ専用インタラクション確認
3. **画面回転**: 縦横回転時のレイアウト適応確認

### データ永続化
1. **作成操作**: ゴール、ハビット、アクティビティの作成と即座の表示確認
2. **編集操作**: データ編集後の即座の反映確認
3. **削除操作**: データ削除後の即座の削除確認
4. **ページリロード**: リロード後のデータ保持確認
5. **認証切り替え**: ゲスト→ユーザー切り替え時のデータ移行確認

### エラーハンドリング
1. **ネットワークエラー**: オフライン状態でのエラーメッセージ表示確認
2. **OAuth失敗**: 認証失敗時のエラーメッセージ表示確認
3. **データエラー**: 不正なデータ入力時のバリデーションエラー確認
4. **JavaScript エラー**: コンソールエラー発生時のアプリケーション継続確認

## Components and Interfaces

### Page Object Models

**HomePage**
```typescript
interface HomePage {
  navigate(): Promise<void>;
  clickLogin(): Promise<void>;
  clickContinueAsGuest(): Promise<void>;
  isLoginButtonVisible(): Promise<boolean>;
  isGuestButtonVisible(): Promise<boolean>;
}
```

**LoginPage**
```typescript
interface LoginPage {
  navigate(): Promise<void>;
  clickGoogleOAuth(): Promise<void>;
  clickGitHubOAuth(): Promise<void>;
  clickLogout(): Promise<void>;
  getErrorMessage(): Promise<string>;
  isOAuthButtonsVisible(): Promise<boolean>;
}
```

**DashboardPage**
```typescript
interface DashboardPage {
  navigate(): Promise<void>;
  waitForLoad(): Promise<void>;
  toggleSidebar(): Promise<void>;
  isSidebarVisible(): Promise<boolean>;
  clickNewGoal(): Promise<void>;
  clickNewHabit(): Promise<void>;
  getGoalsList(): Promise<string[]>;
  getHabitsList(): Promise<string[]>;
  isCalendarVisible(): Promise<boolean>;
  isActivitySectionVisible(): Promise<boolean>;
}
```

**CalendarWidget**
```typescript
interface CalendarWidget {
  switchToTodayView(): Promise<void>;
  switchToWeekView(): Promise<void>;
  switchToMonthView(): Promise<void>;
  getVisibleEvents(): Promise<CalendarEvent[]>;
  clickEvent(eventId: string): Promise<void>;
  dragEvent(eventId: string, newTime: string): Promise<void>;
  tapEventMobile(eventId: string): Promise<void>;
  longPressEventMobile(eventId: string): Promise<void>;
  selectMoveMode(): Promise<void>;
  tapSlotToMove(slot: string): Promise<void>;
}
```

**GoalModal**
```typescript
interface GoalModal {
  isVisible(): Promise<boolean>;
  fillGoalName(name: string): Promise<void>;
  fillDescription(description: string): Promise<void>;
  selectParentGoal(parentId: string): Promise<void>;
  clickSave(): Promise<void>;
  clickCancel(): Promise<void>;
  clickDelete(): Promise<void>;
}
```

**HabitModal**
```typescript
interface HabitModal {
  isVisible(): Promise<boolean>;
  fillHabitName(name: string): Promise<void>;
  selectGoal(goalId: string): Promise<void>;
  setTime(time: string): Promise<void>;
  setEndTime(endTime: string): Promise<void>;
  selectRepeatPattern(pattern: string): Promise<void>;
  clickSave(): Promise<void>;
  clickCancel(): Promise<void>;
  clickDelete(): Promise<void>;
}
```

### Test Utilities

**AuthHelpers**
```typescript
interface AuthHelpers {
  navigateToHome(): Promise<void>;
  loginAsGuest(): Promise<void>;
  loginWithOAuth(provider: 'google' | 'github'): Promise<void>;
  logout(): Promise<void>;
  getAuthState(): Promise<'guest' | 'user' | 'unauthenticated'>;
  waitForAuthStateChange(): Promise<void>;
}
```

**DataHelpers**
```typescript
interface DataHelpers {
  createTestGoal(data?: Partial<GoalData>): Promise<Goal>;
  createTestHabit(data?: Partial<HabitData>): Promise<Habit>;
  createTestActivity(data?: Partial<ActivityData>): Promise<Activity>;
  cleanupTestData(): Promise<void>;
  seedTestData(): Promise<void>;
  waitForDataLoad(): Promise<void>;
}
```

**MobileHelpers**
```typescript
interface MobileHelpers {
  setMobileViewport(): Promise<void>;
  setTabletViewport(): Promise<void>;
  setDesktopViewport(): Promise<void>;
  simulateTouchTap(selector: string): Promise<void>;
  simulateLongPress(selector: string): Promise<void>;
  simulateSwipe(direction: 'left' | 'right' | 'up' | 'down'): Promise<void>;
  rotateScreen(orientation: 'portrait' | 'landscape'): Promise<void>;
}
```

## Data Models

### Test Data Structures

```typescript
interface TestUser {
  type: 'guest' | 'user';
  oauthProvider?: 'google' | 'github';
}

interface GoalData {
  name: string;
  description?: string;
  dueDate?: string;
  parentId?: string;
  isCompleted?: boolean;
}

interface HabitData {
  name: string;
  goalId?: string;
  time?: string;
  endTime?: string;
  dueDate?: string;
  repeat?: string;
  type?: 'do' | 'avoid';
  active?: boolean;
}

interface ActivityData {
  kind: 'start' | 'complete' | 'pause' | 'skip';
  habitId: string;
  habitName: string;
  timestamp: string;
  amount?: number;
  durationSeconds?: number;
}

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay: boolean;
  habitId: string;
}

interface ViewportSize {
  width: number;
  height: number;
  name: 'mobile' | 'tablet' | 'desktop';
}

interface TestConfig {
  baseURL: string;
  timeout: number;
  retries: number;
  browsers: string[];
  headless: boolean;
  slowMo?: number;
  video?: boolean;
  screenshot?: boolean;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, several properties can be consolidated to eliminate redundancy:

- Properties 1.1, 1.2, 1.3 can be combined into a comprehensive CI pipeline behavior property
- Properties 2.1, 2.2, 2.3 can be combined into a comprehensive login flow property  
- Properties 3.2, 3.3, 3.4 can be combined into a comprehensive dashboard interaction property
- Properties 4.1, 4.2, 4.3, 4.4 can be combined into a comprehensive data persistence property
- Properties 5.1, 5.2, 5.3, 5.4 can be combined into a comprehensive responsive design property
- Properties 7.2, 7.3 can be combined into a comprehensive failure documentation property
- Properties 8.1, 8.2, 8.3, 8.4 can be combined into a comprehensive error handling property

### Core Properties

**Property 1: CI Pipeline Test Execution**
*For any* CI pipeline run, all critical E2E tests should be discovered and executed, with failures preventing deployment and successes allowing deployment to proceed
**Validates: Requirements 1.1, 1.2, 1.3**

**Property 2: Test Performance Compliance**
*For any* complete test suite execution, the total runtime should not exceed 10 minutes
**Validates: Requirements 1.4**

**Property 3: CI Environment Configuration**
*For any* test execution in CI environment, the browser should run in headless mode
**Validates: Requirements 1.5**

**Property 4: Login Flow Behavior**
*For any* user authentication attempt, the system should redirect valid users to dashboard, show errors for invalid users, and handle already-authenticated users appropriately
**Validates: Requirements 2.1, 2.2, 2.3**

**Property 5: Authentication Persistence**
*For any* authenticated user session, the authentication state should persist across browser sessions
**Validates: Requirements 2.4**

**Property 6: Security Error Handling**
*For any* login failure, the system should not expose sensitive error details in user-facing messages
**Validates: Requirements 2.5**

**Property 7: Dashboard Widget Display**
*For any* user accessing the dashboard, all configured widgets should be displayed
**Validates: Requirements 3.1**

**Property 8: Dashboard Interaction Updates**
*For any* user interaction with dashboard components (activities, goals, calendar), the corresponding data should be updated in the interface
**Validates: Requirements 3.2, 3.3, 3.4**

**Property 9: Dashboard Performance**
*For any* dashboard load under standard network conditions, the page should load within 3 seconds
**Validates: Requirements 3.5**

**Property 10: Data Persistence Integrity**
*For any* user data operation (create, edit, delete), the changes should persist across page refreshes and authentication sessions
**Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**

**Property 11: Responsive Design Adaptation**
*For any* viewport size (mobile, tablet, desktop), the dashboard should display the appropriate optimized layout and maintain full functionality
**Validates: Requirements 5.1, 5.2, 5.3, 5.4**

**Property 12: Orientation Change Handling**
*For any* screen orientation change, the dashboard layout should adapt appropriately
**Validates: Requirements 5.5**

**Property 13: Test File Naming Consistency**
*For any* test file in the E2E test suite, the filename should follow the consistent naming convention pattern
**Validates: Requirements 6.5**

**Property 14: Test Report Generation**
*For any* test execution completion, detailed HTML reports should be generated with execution timing and performance metrics
**Validates: Requirements 7.1, 7.4**

**Property 15: Failure Documentation**
*For any* test failure, screenshots and browser console logs should be captured automatically
**Validates: Requirements 7.2, 7.3**

**Property 16: CI Report Formatting**
*For any* test execution in CI environment, results should be output in CI-compatible format
**Validates: Requirements 7.5**

**Property 17: Comprehensive Error Handling**
*For any* error condition (network failures, database unavailability, JavaScript errors), the dashboard should handle errors gracefully with user-friendly messages and detailed logging
**Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5**

<function_calls>
<invoke name="prework">
<parameter name="featureName">webui-e2e-testing

## Error Handling

### Test Failure Scenarios

**Network Simulation**
- Offline mode testing
- Slow network conditions
- Intermittent connectivity
- API timeout scenarios

**Database Error Simulation**
- Connection failures
- Query timeouts
- Data corruption scenarios
- Permission errors

**Browser Error Handling**
- JavaScript runtime errors
- Memory limitations
- Plugin/extension conflicts
- Cross-browser compatibility issues

### Recovery Mechanisms

**Automatic Retry Logic**
- Failed tests retry up to 3 times
- Exponential backoff for network-related failures
- Screenshot capture before each retry attempt

**Graceful Degradation**
- Continue test execution when non-critical tests fail
- Isolate test failures to prevent cascade effects
- Maintain test independence

## Testing Strategy

### Dual Testing Approach

**Unit Tests**: Verify specific examples, edge cases, and error conditions
- Component-level testing with React Testing Library
- Mock external dependencies
- Focus on isolated functionality
- Fast execution for rapid feedback

**Property-Based Tests**: Verify universal properties across all inputs
- E2E testing with Playwright
- Real browser automation
- Comprehensive user flow coverage
- Minimum 100 iterations per property test

Both approaches are complementary and necessary for comprehensive coverage. Unit tests catch concrete bugs in isolated components, while property tests verify general correctness across complete user workflows.

### Property-Based Testing Configuration

**Framework**: Playwright Test Runner
- Minimum 100 test iterations per property
- Each property test references its design document property
- Tag format: **Feature: webui-e2e-testing, Property {number}: {property_text}**
- Headless mode in CI, headed mode for local development

**Test Data Generation**
- Random user credentials for authentication testing
- Random activity and goal data for CRUD operations
- Random viewport sizes for responsive testing
- Random error conditions for error handling testing

### Test Execution Strategy

**Local Development**
```bash
# Run all E2E tests
npm run test:e2e

# Run specific test suite
npm run test:e2e -- --grep "login"

# Run with UI mode for debugging
npm run test:e2e:ui

# Run specific browser
npm run test:e2e -- --project=chromium
```

**CI/CD Integration**
```yaml
# GitHub Actions integration
- name: Run E2E Tests
  run: |
    cd frontend
    npm run test:e2e:ci
  env:
    CI: true
    PLAYWRIGHT_BROWSERS_PATH: 0
```

### Test Organization

**Test Categories**
1. **Critical Path Tests**: Login, dashboard load, core functionality
2. **Feature Tests**: Activity management, goal management, calendar
3. **Responsive Tests**: Mobile, tablet, desktop layouts
4. **Error Tests**: Network failures, data errors, edge cases
5. **Performance Tests**: Load times, responsiveness, resource usage

**Execution Priority**
1. Critical path tests run first (fail fast)
2. Feature tests run in parallel when possible
3. Responsive tests run on multiple viewports
4. Error tests run with simulated failure conditions
5. Performance tests run with timing assertions

### Reporting and Monitoring

**Test Reports**
- HTML reports with screenshots and videos
- JUnit XML for CI integration
- Performance metrics and timing data
- Coverage reports for E2E scenarios

**Failure Analysis**
- Automatic screenshot capture on failure
- Browser console log collection
- Network request/response logging
- Stack trace and error context

**Continuous Monitoring**
- Test execution time tracking
- Flaky test identification
- Success rate monitoring
- Performance regression detection