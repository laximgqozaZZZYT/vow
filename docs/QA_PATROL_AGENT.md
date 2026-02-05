# QA巡回エージェント (QA Patrol Agent)

## 概要

QA巡回エージェントは、VOWアプリケーションのAIコーチ機能の品質を自動的にテストするPlaywrightベースのE2Eテストシステムです。ペルソナベースのシナリオを使用して、AIコーチが適切に応答しているかを検証し、問題があればIssueとして自動報告します。

## ファイル構成

| ファイル | 説明 |
|---------|------|
| `frontend/e2e/qa-patrol.spec.ts` | メインのテストスクリプト |
| `frontend/playwright.config.ts` | Playwright設定 |

## 機能

### 1. ペルソナベースのテスト

以下のペルソナがシナリオとして定義されています：

| ペルソナID | 名前 | 説明 |
|-----------|------|------|
| `health-conscious` | Health-Conscious User | 運動・ダイエット目標を持つユーザー |
| `learner` | Learner | プログラミング・資格学習を目指すユーザー |
| `business-professional` | Business Professional | 生産性・キャリア向上を目指すユーザー |
| `stressed-user` | Stressed User | ストレス解消・リラックスを求めるユーザー |

### 2. 連続チャット機能（Multi-Turn Conversation）

- `desiredOutcome`による目標情報の定義
- 最大5回のやり取りで目標達成を検証
- `userResponses`パターンマッチングで自動応答

### 3. 検証項目

- **キーワード検証**: 期待するキーワードが回答に含まれるか
- **エラー検証**: エラーメッセージが表示されないか
- **アクションボタン検証**: フォローアップボタンが表示されるか
- **会話品質スコア**: 共感表現、具体性などを数値化

### 4. Issue自動報告

テスト結果に基づいて、以下の情報を含むIssueを自動作成：
- テスト結果（合格/不合格）
- 会話品質スコア（0-100）
- ペルソナ・シナリオ情報
- 会話ログ
- 検証失敗の詳細

## 実行方法

### 環境変数

```bash
# CLI APIモードで実行する場合
export VOW_API_KEY="your_api_key"
export VOW_API_URL="http://localhost:4000"
export QA_PATROL_USE_CLI_API=true
export QA_PATROL_ALWAYS_REPORT=true

# ペルソナを指定する場合（0-3）
export PERSONA_INDEX=0
```

### テスト実行コマンド

```bash
cd /home/ubuntu/Downloads/vow/frontend

# 全テスト実行
npx playwright test qa-patrol.spec.ts

# 特定のブラウザで実行
npx playwright test qa-patrol.spec.ts --project=chromium

# レポーター指定
npx playwright test qa-patrol.spec.ts --reporter=line

# デバッグモード
npx playwright test qa-patrol.spec.ts --debug
```

### 定期実行（cron設定例）

```bash
# 毎時0分に実行
0 * * * * cd /home/ubuntu/Downloads/vow/frontend && npx playwright test qa-patrol.spec.ts >> /var/log/qa-patrol.log 2>&1
```

## テスト結果の確認

### コンソール出力

```
[QA Patrol] Testing Persona: Health-Conscious User, Scenario: start-exercise (Mode: CLI API)
[QA Patrol CLI] Sending: 新しい運動習慣を始めたいです
[QA Patrol] Validation PASSED for start-exercise
[QA Patrol] Issue created: ISS-20260203-087
```

### Issueテーブル

テスト結果はSupabaseの`issues`テーブルに保存されます：

| カラム | 説明 |
|--------|------|
| `issue_id` | Issue ID（例: ISS-20260203-087）|
| `title` | タイトル（✅/❌ペルソナ名 - シナリオID）|
| `priority` | 優先度（low/medium/high/critical）|
| `category` | カテゴリ（feedback/bug）|
| `conversation_data` | 会話ログ（JSON）|

## シナリオの追加方法

`qa-patrol.spec.ts`内の`Persona`オブジェクトにシナリオを追加：

```typescript
const newScenario: Scenario = {
  id: 'new-scenario',
  initialMessage: 'ユーザーの質問',
  followUpMessages: [],
  expectedBehaviors: [
    { type: 'no_error', description: 'No error' },
    { type: 'keyword', value: '期待キーワード', description: '説明' },
  ],
  expectedResponseType: 'confirmation',
  expectedResponseContent: '期待される回答の説明',
  isAmbiguous: false,
  desiredOutcome: {
    genre: 'ジャンル',
    specificityLevel: 'moderate',
    difficultyLevel: 'beginner',
    type: 'habit',
    successKeywords: ['成功', 'キーワード'],
    maxExchanges: 5,
  },
  userResponses: {
    '質問パターン': '自動回答',
  },
};
```

## トラブルシューティング

### よくある問題

1. **API Key認証エラー**
   - `VOW_API_KEY`環境変数が正しく設定されているか確認
   - APIキーが有効か確認

2. **タイムアウトエラー**
   - `playwright.config.ts`でタイムアウト値を増加
   - ネットワーク接続を確認

3. **共感不足エラー**
   - AIコーチのシステムプロンプトを確認
   - 共感表現のキーワードパターンを確認

## 関連ドキュメント

- [Issue巡回エージェント](./ISSUE_PATROL_AGENT.md)
- [AIコーチ設定](../backend/src/agents/mastra/README.md)
