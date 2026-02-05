# WEBUI E2E Chat Test Specification - Tasks Document

## Overview
- **Purpose**: E2Eテスト実装のタスクリストを定義する
- **Status**: Draft
- **Version**: 1.0.0
- **Last Updated**: 2026-02-05
- **Author**: vow-spec-architect

## Task Summary

| Phase | Tasks | Estimated Time | Status |
|-------|-------|----------------|--------|
| Phase 1: Setup | 5 | 4h | Not Started |
| Phase 2: Page Objects | 4 | 6h | Not Started |
| Phase 3: Test Implementation | 6 | 12h | Not Started |
| Phase 4: CI/CD Integration | 3 | 4h | Not Started |
| **Total** | **18** | **26h** | - |

---

## Phase 1: Test Environment Setup

### Task 1.1: Playwright Configuration
**Assignable to**: Frontend Developer, Tester
**Estimated Time**: 1h
**Prerequisites**: None

**Description**:
Playwrightの基本設定ファイルを作成する。

**Acceptance Criteria**:
- [ ] `frontend/e2e/playwright.config.ts` が作成されている
- [ ] Chromium, Firefox, WebKit の3ブラウザが設定されている
- [ ] 環境変数による設定オーバーライドが機能する
- [ ] レポート出力先が `test-results/` に設定されている

**Implementation Details**:
```bash
# Create directory structure
mkdir -p frontend/e2e/{fixtures,pages,tests,utils,data}
mkdir -p frontend/test-results/{reports,chat-logs,screenshots,videos}

# Install Playwright
cd frontend && npm install -D @playwright/test
npx playwright install
```

---

### Task 1.2: Environment Variables Setup
**Assignable to**: DevOps, Tester
**Estimated Time**: 0.5h
**Prerequisites**: Task 1.1

**Description**:
テスト用環境変数の設定ファイルを作成する。

**Acceptance Criteria**:
- [ ] `frontend/e2e/.env.example` が作成されている
- [ ] 必要な環境変数がすべて文書化されている
- [ ] ローカル開発用の `.env.local` テンプレートが用意されている

**環境変数一覧**:
| Variable | Description | Required |
|----------|-------------|----------|
| `TEST_BASE_URL` | テスト対象URL | Yes |
| `TEST_EMAIL` | テストユーザーEmail | Yes |
| `TEST_TIMEOUT_MS` | タイムアウト(ms) | No |
| `PWDEBUG` | デバッグモード | No |

---

### Task 1.3: Package.json Scripts Setup
**Assignable to**: Frontend Developer
**Estimated Time**: 0.5h
**Prerequisites**: Task 1.1

**Description**:
E2Eテスト実行用のnpmスクリプトを追加する。

**Acceptance Criteria**:
- [ ] `npm run test:e2e` - 全E2Eテスト実行
- [ ] `npm run test:e2e:ci` - CI用（headless、単一worker）
- [ ] `npm run test:e2e:debug` - デバッグモード
- [ ] `npm run test:e2e:report` - レポート表示

**Implementation**:
```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ci": "playwright test --config=e2e/playwright.config.ts --reporter=list,junit",
    "test:e2e:debug": "PWDEBUG=1 playwright test --headed",
    "test:e2e:report": "playwright show-report test-results/reports"
  }
}
```

---

### Task 1.4: Global Setup Script
**Assignable to**: Tester
**Estimated Time**: 1h
**Prerequisites**: Task 1.1, Task 1.2

**Description**:
テスト実行前のグローバルセットアップスクリプトを作成する。

**Acceptance Criteria**:
- [ ] `frontend/e2e/global-setup.ts` が作成されている
- [ ] テスト結果ディレクトリの初期化が行われる
- [ ] 認証状態の事前チェックが行われる
- [ ] 必要な環境変数の検証が行われる

---

### Task 1.5: Test Data Files
**Assignable to**: Tester, QA
**Estimated Time**: 1h
**Prerequisites**: None

**Description**:
テストシナリオとテストデータを定義するJSONファイルを作成する。

**Acceptance Criteria**:
- [ ] `frontend/e2e/data/test-scenarios.json` が作成されている
- [ ] 全6カテゴリのテストシナリオが定義されている
- [ ] 各シナリオに期待されるレスポンスパターンが含まれている

**テストシナリオ構造**:
```typescript
interface TestScenario {
  id: string;
  name: string;
  category: 'Health' | 'Learning' | 'Productivity';
  subCategory: string;
  initialQuestion: string;
  followUpQuestions: string[];
  expectedQuickReplies: string[];
  expectedSuggestionTypes: ('habit' | 'goal' | 'stickyn')[];
}
```

---

## Phase 2: Page Objects Implementation

### Task 2.1: Base Page Object
**Assignable to**: Frontend Developer
**Estimated Time**: 1h
**Prerequisites**: Task 1.1

**Description**:
全Page Objectの基底クラスを作成する。

**Acceptance Criteria**:
- [ ] `frontend/e2e/pages/base.page.ts` が作成されている
- [ ] `screenshot()` メソッドが実装されている
- [ ] `waitForSelector()` メソッドが実装されている
- [ ] エラーハンドリングが統一されている

---

### Task 2.2: Login Page Object
**Assignable to**: Frontend Developer
**Estimated Time**: 1.5h
**Prerequisites**: Task 2.1

**Description**:
ログインページのPage Objectを作成する。

**Acceptance Criteria**:
- [ ] `frontend/e2e/pages/login.page.ts` が作成されている
- [ ] Google OAuthボタンのクリックが実装されている
- [ ] ログアウト機能が実装されている
- [ ] エラーメッセージ取得が実装されている

---

### Task 2.3: Dashboard Page Object
**Assignable to**: Frontend Developer
**Estimated Time**: 1h
**Prerequisites**: Task 2.1

**Description**:
ダッシュボードページのPage Objectを作成する。

**Acceptance Criteria**:
- [ ] `frontend/e2e/pages/dashboard.page.ts` が作成されている
- [ ] セクション切り替えが実装されている
- [ ] ユーザー認証状態の確認が実装されている

---

### Task 2.4: MOC Section Page Object
**Assignable to**: Frontend Developer
**Estimated Time**: 2.5h
**Prerequisites**: Task 2.1

**Description**:
MOCセクション（チャット画面）のPage Objectを作成する。最も複雑なPage Object。

**Acceptance Criteria**:
- [ ] `frontend/e2e/pages/moc-section.page.ts` が作成されている
- [ ] `sendMessage()` - メッセージ送信
- [ ] `waitForResponse()` - AI応答待機
- [ ] `getSuggestionCards()` - 候補カード取得
- [ ] `getQuickReplies()` - クイック返信ボタン取得
- [ ] `clickQuickReply()` - クイック返信クリック
- [ ] `acceptSuggestion()` - 候補承認
- [ ] `snoozeSuggestion()` - 候補スヌーズ
- [ ] `dismissSuggestion()` - 候補却下
- [ ] `verifySuggestionTypeBadge()` - 型バッジ検証

---

## Phase 3: Test Implementation

### Task 3.1: Auth Fixture Implementation
**Assignable to**: Tester
**Estimated Time**: 2h
**Prerequisites**: Task 2.2

**Description**:
認証状態を管理するテストフィクスチャを作成する。

**Acceptance Criteria**:
- [ ] `frontend/e2e/fixtures/auth.fixture.ts` が作成されている
- [ ] 認証状態の永続化が実装されている
- [ ] 認証失敗時のリトライが実装されている
- [ ] セッション分離が機能する

**実装ノート**:
- OAuth認証はCI環境では困難なため、以下の代替手段を検討:
  1. 事前に取得したセッショントークンを使用
  2. テスト用APIキーによる認証
  3. モックサーバーによる認証シミュレーション

---

### Task 3.2: Chat Fixture Implementation
**Assignable to**: Tester
**Estimated Time**: 1h
**Prerequisites**: Task 3.1, Task 2.4

**Description**:
チャットテスト用のフィクスチャを作成する。

**Acceptance Criteria**:
- [ ] `frontend/e2e/fixtures/chat.fixture.ts` が作成されている
- [ ] MOCPageの自動初期化が実装されている
- [ ] ChatLoggerの自動保存が実装されている

---

### Task 3.3: Chat Logger Utility
**Assignable to**: Tester
**Estimated Time**: 1.5h
**Prerequisites**: Task 1.1

**Description**:
チャットログを記録・保存するユーティリティを作成する。

**Acceptance Criteria**:
- [ ] `frontend/e2e/utils/chat-logger.ts` が作成されている
- [ ] JSON形式でログ保存が実装されている
- [ ] テストID生成が実装されている
- [ ] エラー状態のマーキングが実装されている

---

### Task 3.4: Login Tests
**Assignable to**: Tester
**Estimated Time**: 1.5h
**Prerequisites**: Task 3.1

**Description**:
ログイン機能のテストを実装する。

**Acceptance Criteria**:
- [ ] `frontend/e2e/tests/auth/login.spec.ts` が作成されている
- [ ] ログインページ表示テスト
- [ ] OAuth認証フローテスト（または代替認証テスト）
- [ ] ログアウトテスト

---

### Task 3.5: Suggestion Button Type Tests
**Assignable to**: Tester
**Estimated Time**: 3h
**Prerequisites**: Task 3.2

**Description**:
候補ボタンの型チェックテストを実装する。

**Acceptance Criteria**:
- [ ] `frontend/e2e/tests/chat/suggestions.spec.ts` が作成されている
- [ ] Habit型バッジ検証テスト
- [ ] Goal型バッジ検証テスト
- [ ] Sticky'n型バッジ検証テスト
- [ ] Reply型バッジ検証テスト
- [ ] 状態遷移テスト（pending -> accepted/snoozed/dismissed）
- [ ] モーダル起動テスト

---

### Task 3.6: Scenario Tests
**Assignable to**: Tester
**Estimated Time**: 3h
**Prerequisites**: Task 3.2, Task 1.5

**Description**:
カテゴリ別のシナリオテストを実装する。

**Acceptance Criteria**:
- [ ] `frontend/e2e/tests/chat/scenarios/health.spec.ts` が作成されている
- [ ] `frontend/e2e/tests/chat/scenarios/learning.spec.ts` が作成されている
- [ ] `frontend/e2e/tests/chat/scenarios/productivity.spec.ts` が作成されている
- [ ] 各シナリオでクイック返信のテスト
- [ ] 各シナリオで候補提案のテスト
- [ ] チャットログの記録

---

## Phase 4: CI/CD Integration

### Task 4.1: GitHub Actions Workflow
**Assignable to**: DevOps
**Estimated Time**: 2h
**Prerequisites**: Phase 3 完了

**Description**:
GitHub ActionsでE2Eテストを自動実行するワークフローを作成する。

**Acceptance Criteria**:
- [ ] `.github/workflows/e2e-tests.yml` が作成されている
- [ ] PR作成時に自動実行される
- [ ] テスト結果がアーティファクトとして保存される
- [ ] 失敗時にPRコメントが投稿される

---

### Task 4.2: Test Report Generation
**Assignable to**: Tester
**Estimated Time**: 1h
**Prerequisites**: Task 4.1

**Description**:
テストレポートの生成と配信を設定する。

**Acceptance Criteria**:
- [ ] HTMLレポートが生成される
- [ ] JUnit XMLレポートが生成される
- [ ] サマリーレポートが生成される

---

### Task 4.3: Documentation Update
**Assignable to**: Any Agent
**Estimated Time**: 1h
**Prerequisites**: Phase 3 完了

**Description**:
READMEとドキュメントの更新。

**Acceptance Criteria**:
- [ ] `frontend/e2e/README.md` が作成されている
- [ ] テスト実行方法が文書化されている
- [ ] 環境設定方法が文書化されている
- [ ] トラブルシューティングガイドが含まれている

---

## Dependency Graph

```
Phase 1: Setup
┌───────────────────────────────────────────────────────────┐
│                                                           │
│  Task 1.1 ────────┬──────────────────┐                   │
│  (Playwright)     │                  │                   │
│       │           │                  │                   │
│       ▼           ▼                  ▼                   │
│  Task 1.2     Task 1.3           Task 1.5               │
│  (Env Vars)   (Scripts)          (Test Data)            │
│       │           │                                      │
│       └─────┬─────┘                                      │
│             ▼                                            │
│         Task 1.4                                         │
│         (Global Setup)                                   │
└───────────────────────────────────────────────────────────┘

Phase 2: Page Objects
┌───────────────────────────────────────────────────────────┐
│                                                           │
│         Task 2.1 (Base Page)                             │
│              │                                           │
│    ┌─────────┼─────────┐                                 │
│    ▼         ▼         ▼                                 │
│ Task 2.2  Task 2.3  Task 2.4                            │
│ (Login)   (Dashboard) (MOC)                              │
│                                                           │
└───────────────────────────────────────────────────────────┘

Phase 3: Tests
┌───────────────────────────────────────────────────────────┐
│                                                           │
│  Task 2.2 ────▶ Task 3.1 (Auth Fixture)                  │
│                     │                                    │
│  Task 2.4 ──┬──────┼──────▶ Task 3.2 (Chat Fixture)     │
│             │      │             │                       │
│             │      │      ┌──────┴──────┐               │
│             │      │      ▼             ▼               │
│             │      │  Task 3.4     Task 3.5            │
│             │      │  (Login)     (Suggestions)         │
│             │      │                    │               │
│             │      │                    ▼               │
│             │      │              Task 3.6              │
│             │      │              (Scenarios)           │
│             │      │                                    │
│  Task 1.5 ──┴──────┘                                    │
│                                                           │
│  Task 3.3 (Chat Logger) ◀─────────────────────────────── │
│                                                           │
└───────────────────────────────────────────────────────────┘

Phase 4: CI/CD
┌───────────────────────────────────────────────────────────┐
│                                                           │
│  Phase 3 ────▶ Task 4.1 (GitHub Actions)                 │
│                    │                                     │
│                    ▼                                     │
│               Task 4.2 (Reports)                         │
│                    │                                     │
│                    ▼                                     │
│               Task 4.3 (Documentation)                   │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

---

## Agent Coordination Notes

### Task Assignment Guidelines

1. **Frontend Developer**: Task 1.1, 1.3, 2.1, 2.2, 2.3, 2.4
2. **Tester**: Task 1.4, 1.5, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.2
3. **DevOps**: Task 1.2, 4.1
4. **QA**: Task 1.5 (レビュー), Task 4.3

### Parallel Execution Opportunities

以下のタスクは並列実行可能:
- Task 1.2, 1.3, 1.5 (Task 1.1 完了後)
- Task 2.2, 2.3, 2.4 (Task 2.1 完了後)
- Task 3.3 (独立して実行可能)
- Task 3.4, 3.5 (Task 3.2 完了後)

### Critical Path

最短完了パス:
1.1 -> 2.1 -> 2.4 -> 3.2 -> 3.5 -> 3.6 -> 4.1

**Critical Path Duration**: 約18時間

### Risk Mitigation

| Risk | Mitigation |
|------|------------|
| OAuth認証の自動化困難 | セッショントークン方式またはモック認証を検討 |
| AI応答の非決定性 | 期待パターンの柔軟なマッチング、リトライ戦略 |
| フレイキーテスト | 適切なwait戦略、リトライ設定 |
| CI環境の差異 | Docker化またはGitHub Actionsの`playwright install --with-deps` |
