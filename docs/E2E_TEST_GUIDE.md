# VOW E2Eテストガイド

## 概要

VOW（習慣・目標トラッカー）アプリケーションのE2E（End-to-End）テストガイドです。本ドキュメントでは、Playwrightを使用したE2Eテストの実行方法とテストシナリオについて説明します。

### E2Eテストの目的

- ユーザー視点でのアプリケーション全体の動作検証
- ログイン機能（Google OAuth）の正常動作確認
- AIコーチとのチャット機能の品質保証
- 候補ラベル型（Habit/Goal/Sticky'n/Reply）の表示検証
- 回帰テストの自動化

### 使用技術

- **テストフレームワーク**: Playwright v1.58+
- **言語**: TypeScript
- **対応ブラウザ**: Chromium, Firefox, WebKit
- **レポート形式**: HTML, JSON

---

## セットアップ

### 前提条件

- Node.js 20以上
- npm または yarn
- テスト用Googleアカウント

### インストール

```bash
# 1. frontendディレクトリに移動
cd frontend

# 2. 依存パッケージをインストール（まだの場合）
npm install

# 3. Playwrightブラウザをインストール
npx playwright install
```

### 環境変数の設定

`frontend/.env.local` ファイルを作成し、以下の環境変数を設定します。

```env
# テスト対象URL
TEST_BASE_URL=https://main.do1k9oyyorn24.amplifyapp.com/

# テスト用Googleアカウント
TEST_EMAIL=k6285620@gmail.com

# タイムアウト設定（ミリ秒）
TEST_TIMEOUT_MS=60000
```

または `frontend/e2e/.env.example` をコピーして使用できます。

```bash
cp e2e/.env.example .env.local
```

---

## テストの実行

### 基本的なコマンド

```bash
# 全テスト実行
npm run test:e2e

# 特定のテストファイルを実行
npx playwright test e2e/tests/login.spec.ts
npx playwright test e2e/tests/chat/

# UIモードで実行（インタラクティブ）
npm run test:e2e:ui

# ブラウザを表示して実行（ヘッドモード）
npm run test:e2e:headed

# デバッグモード
npm run test:e2e:debug

# CI/CDモード（ヘッドレス、シングルワーカー）
npm run test:e2e:ci
```

### テスト結果の確認

```bash
# HTMLレポートを開く
npm run test:e2e:report

# JSONレポートの場所
# test-results/results.json
```

---

## テストシナリオ

### 優先度P1（必須）テスト

| テストID | テスト名 | 所要時間 | 説明 |
|---------|---------|---------|------|
| TS-001 | Google OAuth Login | 2分 | Google認証によるログイン機能 |
| TS-002 | Basic Chat Message Exchange | 3分 | 基本的なメッセージ送受信 |
| TS-003 | Exercise Habit Suggestion Flow | 5分 | 運動習慣の提案フロー |
| TS-005 | Reading Habit Suggestion Flow | 5分 | 読書習慣の提案フロー |
| TS-007 | Task Organization with Sticky'n | 5分 | タスク整理（Sticky'n型） |
| TS-008 | Accept Suggestion Card | 3分 | 候補カードの承認 |
| TS-011 | Quick Reply Button Click | 3分 | クイック返信ボタン |
| TS-013 | Chat Log Recording | 3分 | チャットログ記録 |
| TS-015 | Complete User Journey | 10分 | ログインから習慣作成まで |

**合計**: 約39分

### 優先度P2（重要）テスト

| テストID | テスト名 | 所要時間 | 説明 |
|---------|---------|---------|------|
| TS-004 | Sleep Improvement Habit Flow | 4分 | 睡眠改善習慣の提案 |
| TS-006 | Language Learning Goal Flow | 4分 | 語学学習ゴールの提案 |
| TS-009 | Snooze Suggestion Card | 2分 | 候補カードのスヌーズ |
| TS-010 | Dismiss Suggestion Card | 2分 | 候補カードの却下 |
| TS-012 | Reply Type Suggestion Verification | 4分 | 回答型候補の検証 |
| TS-014 | Network Timeout Handling | 3分 | ネットワークタイムアウト |

**合計**: 約19分

**全テストスイート実行時間**: 約58分

---

## 候補ラベル型の検証

### Habit型（習慣）

- **バッジ色**: 青色（`bg-blue-100 text-blue-700`）
- **ラベル**: "Habit"
- **モーダル**: HabitModal
- **例**: 運動習慣、読書習慣

### Goal型（目標）

- **バッジ色**: 紫色（`bg-purple-100 text-purple-700`）
- **ラベル**: "Goal"
- **モーダル**: GoalModal
- **例**: 語学学習、資格取得

### Sticky'n型（付箋）

- **バッジ色**: 黄色（`bg-yellow-100 text-yellow-700`）
- **ラベル**: "Sticky'n"
- **モーダル**: StickyModal
- **例**: タスク整理、メモ

### Reply型（回答）

- **バッジ色**: ティール色（`bg-teal-100 text-teal-700`）
- **ラベル**: "回答" / "Reply"
- **動作**: クリックで回答をチャットに送信
- **例**: 改善提案、アドバイス

---

## ディレクトリ構造

```
frontend/
├── e2e/                        # E2Eテストルートディレクトリ
│   ├── playwright.config.ts   # Playwright設定ファイル
│   ├── tests/                 # テストファイル
│   │   ├── login.spec.ts      # ログインテスト
│   │   └── chat/              # チャット機能テスト
│   │       ├── basic-chat.spec.ts
│   │       ├── suggestion-buttons.spec.ts
│   │       └── scenarios/     # カテゴリ別シナリオ
│   ├── page-objects/          # Page Objectパターン
│   │   ├── BasePage.ts        # 共通ベースページ
│   │   ├── LoginPage.ts       # ログインページ
│   │   └── MOCSectionPage.ts  # MOCセクションページ
│   ├── fixtures/              # テストフィクスチャ
│   │   ├── auth.fixture.ts    # 認証フィクスチャ
│   │   └── chat.fixture.ts    # チャットフィクスチャ
│   ├── utils/                 # ユーティリティ関数
│   │   ├── chat-logger.ts     # チャットログ記録
│   │   └── test-data.ts       # テストデータ
│   ├── data/                  # テストデータ（JSON）
│   ├── scripts/               # スクリプト
│   └── logs/                  # 実行ログ
│
├── test-results/              # テスト結果（.gitignore対象）
│   ├── reports/               # HTMLレポート
│   │   ├── index.html         # Playwright HTMLレポート
│   │   └── junit.xml          # CI/CD統合用
│   ├── chat-logs/             # チャットログ（JSON）
│   │   └── {testId}-{timestamp}.json
│   ├── screenshots/           # スクリーンショット
│   │   └── {testId}/
│   │       └── step-{number}-{description}.png
│   └── videos/                # ビデオ録画
│       └── {testId}.webm
│
└── .auth/                     # 認証状態（.gitignore対象）
    └── user.json              # セッション保存
```

---

## テスト結果の確認

### HTMLレポート

```bash
npm run test:e2e:report
```

ブラウザで `test-results/reports/index.html` が開き、以下の情報が確認できます。

- テストケース一覧と結果（Pass/Fail）
- 実行時間
- スクリーンショット
- エラーログ

### JSONレポート

`test-results/results.json` に以下の形式でレポートが保存されます。

```json
{
  "suites": [...],
  "tests": [...],
  "stats": {
    "duration": 58000,
    "passed": 15,
    "failed": 0
  }
}
```

### チャットログ

`test-results/chat-logs/` に各テストのチャットログがJSON形式で保存されます。

```json
{
  "testId": "TS-003-1738800000-abc123",
  "timestamp": "2026-02-05T12:00:00.000Z",
  "scenario": "Exercise Habit Suggestion Flow",
  "messages": [
    {
      "id": "msg-0",
      "role": "user",
      "content": "運動を始めたいと思っています",
      "timestamp": "2026-02-05T12:00:01.000Z"
    },
    {
      "id": "msg-1",
      "role": "assistant",
      "content": "素晴らしいですね！...",
      "timestamp": "2026-02-05T12:00:15.000Z",
      "quickReplies": ["ジョギング", "ウォーキング", "筋トレ"]
    }
  ],
  "duration": 30000,
  "status": "pass"
}
```

### スクリーンショット

`test-results/screenshots/{testId}/` にテストステップごとのスクリーンショットが保存されます。

- **命名規則**: `step-{番号}-{説明}.png`
- **例**: `step-001-login-page.png`, `step-005-habit-suggestion.png`

---

## CI/CD統合

### GitHub Actionsでの実行

`.github/workflows/e2e-tests.yml` を作成して、CI/CDパイプラインに統合できます。

```yaml
name: E2E Tests

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main, develop]

jobs:
  e2e-tests:
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
        working-directory: frontend
        run: npm ci

      - name: Install Playwright browsers
        working-directory: frontend
        run: npx playwright install --with-deps chromium

      - name: Run E2E tests
        working-directory: frontend
        env:
          TEST_BASE_URL: ${{ secrets.TEST_BASE_URL }}
          TEST_EMAIL: ${{ secrets.TEST_EMAIL }}
        run: npm run test:e2e:ci

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: frontend/test-results/
          retention-days: 30

      - name: Upload chat logs
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: chat-logs
          path: frontend/test-results/chat-logs/
          retention-days: 30
```

### 環境別設定

| 環境 | TEST_BASE_URL | 用途 |
|------|---------------|------|
| development | http://localhost:3000 | ローカル開発 |
| staging | https://staging.vow.example.com | ステージング環境 |
| production | https://main.do1k9oyyorn24.amplifyapp.com/ | 本番環境（読み取り専用） |

---

## トラブルシューティング

### 認証エラー

**現象**: ログインテストが失敗する

**対処法**:
```bash
# 認証状態をクリア
rm -rf frontend/.auth/

# テストを再実行
npm run test:e2e
```

初回実行時は手動でOAuthログインが必要です。

### タイムアウトエラー

**現象**: チャット応答の待機でタイムアウトする

**対処法**:
```typescript
// 個別テストでタイムアウトを延長
test('slow test', async ({ page }) => {
  test.setTimeout(120000); // 2分
  // ... テストコード
});
```

または `.env.local` で全体のタイムアウトを延長:
```env
TEST_TIMEOUT_MS=120000
```

### フレーキーテスト（不安定なテスト）

**対処法**:
1. 適切な待機戦略を使用（`waitForTimeout`を避ける）
2. `expect`のタイムアウトを延長
3. CI環境でリトライを有効化（設定済み: 2回）

```typescript
// 悪い例
await page.waitForTimeout(5000);

// 良い例
await page.waitForSelector('[data-testid="chat-message"]');
```

### スクリーンショットが保存されない

**対処法**:
```bash
# ディレクトリのパーミッションを確認
chmod -R 755 frontend/test-results/

# ディレクトリを手動作成
mkdir -p frontend/test-results/screenshots
```

---

## Page Objectパターン

テストコードの可読性と保守性を向上させるため、Page Objectパターンを使用しています。

### 基本的な使い方

```typescript
import { test, expect } from '@playwright/test';
import { LoginPage } from '../page-objects/LoginPage';
import { MOCSectionPage } from '../page-objects/MOCSectionPage';

test('chat test example', async ({ page }) => {
  // ログインページ
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.clickGoogleLogin();

  // MOCセクションページ
  const mocPage = new MOCSectionPage(page);
  await mocPage.goto();
  await mocPage.sendMessage('運動習慣を始めたい');
  await mocPage.waitForResponse();

  const lastMessage = await mocPage.getLastMessageContent();
  expect(lastMessage).toBeTruthy();
});
```

### Chat Fixtureの使用

認証済み状態からテストを開始する場合:

```typescript
import { test, expect } from '../../fixtures/chat.fixture';

test('authenticated chat test', async ({ mocPage, chatLogger }) => {
  // MOCページは既にロード済み
  chatLogger.logUserMessage('こんにちは');
  await mocPage.sendMessage('こんにちは');
  await mocPage.waitForResponse();

  const lastMessage = await mocPage.getLastMessageContent();
  chatLogger.logAssistantMessage(lastMessage);
  expect(lastMessage).toBeTruthy();
});
```

---

## テストデータ

事前定義されたテストシナリオは `e2e/utils/test-data.ts` に定義されています。

```typescript
export const TEST_SCENARIOS: TestScenario[] = [
  {
    id: 'health-exercise',
    name: '運動習慣の確立',
    category: 'Health',
    initialQuestion: '運動習慣を身につけたいのですが...',
    expectedQuickReplies: ['ジョギング', 'ウォーキング'],
    expectedSuggestionTypes: ['habit'],
  },
  {
    id: 'learning-reading',
    name: '読書習慣',
    category: 'Learning',
    initialQuestion: '読書習慣をつけたいです',
    expectedQuickReplies: ['ビジネス書', '小説', '専門書'],
    expectedSuggestionTypes: ['habit', 'goal'],
  },
  // ... 他のシナリオ
];
```

---

## 参照資料

### プロジェクト内ドキュメント

- **E2Eテスト仕様書**: `/home/ubuntu/Downloads/vow/specs/e2e-chat-test/requirements.md`
- **テストシナリオ詳細**: `/home/ubuntu/Downloads/vow/specs/e2e-chat-test/test-scenarios.md`
- **E2E README**: `/home/ubuntu/Downloads/vow/frontend/e2e/README.md`

### 外部リソース

- [Playwright公式ドキュメント](https://playwright.dev)
- [TypeScript公式ドキュメント](https://www.typescriptlang.org/docs/)
- [Testing Best Practices](https://playwright.dev/docs/best-practices)

---

## サポート

質問や問題がある場合は、以下を参照してください。

- **E2Eテスト仕様書**: `/home/ubuntu/Downloads/vow/specs/e2e-chat-test/`
- **トラブルシューティング**: `/home/ubuntu/Downloads/vow/docs/troubleshooting.md`
- **GitHub Issues**: プロジェクトのIssueトラッカー

---

## 更新履歴

| 日付 | バージョン | 変更内容 |
|------|-----------|---------|
| 2026-02-05 | 1.0.0 | 初版作成 |
