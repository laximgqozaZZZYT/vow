# WEBUI E2E Chat Test Specification - Test Scenarios Document

## Overview
- **Purpose**: E2Eテストの具体的なテストシナリオを定義する
- **Status**: Draft
- **Version**: 1.0.0
- **Last Updated**: 2026-02-05
- **Author**: vow-spec-architect

---

## Test Scenario Structure

各テストシナリオは以下の構造に従う:

```typescript
interface TestScenario {
  id: string;                    // ユニークID (例: "TS-001")
  name: string;                  // シナリオ名
  description: string;           // シナリオ説明
  category: string;              // テストカテゴリ
  priority: 'P1' | 'P2' | 'P3'; // 優先度 (P1: 必須, P2: 重要, P3: 任意)
  preconditions: string[];       // 事前条件
  steps: TestStep[];             // テストステップ
  expectedResults: string[];     // 期待結果
  postconditions: string[];      // 事後条件
}

interface TestStep {
  stepNumber: number;
  action: string;
  expectedResult: string;
  screenshot?: boolean;          // スクリーンショット取得
  logChat?: boolean;             // チャットログ記録
}
```

---

## TS-001: Login with Google OAuth

### Metadata
| Field | Value |
|-------|-------|
| **ID** | TS-001 |
| **Name** | Google OAuth Login |
| **Category** | Authentication |
| **Priority** | P1 |

### Description
Googleアカウント（k6285620@gmail.com）を使用したログイン機能の検証。

### Preconditions
1. テスト用Googleアカウントが有効である
2. VOWアプリケーションがアクセス可能である
3. ブラウザのCookieがクリアされている

### Test Steps

| Step | Action | Expected Result | Screenshot |
|------|--------|-----------------|------------|
| 1 | `/login` ページにアクセス | ログインページが表示される | Yes |
| 2 | "Continue with Google" ボタンをクリック | Google OAuth画面に遷移する | Yes |
| 3 | テストアカウントでログイン | 認証が完了する | No |
| 4 | リダイレクト完了を待機 | `/dashboard` に遷移する | Yes |
| 5 | ユーザーメニューを確認 | ユーザー名またはメールが表示される | Yes |

### Expected Results
- ログインページが正しく表示される
- OAuth認証フローが正常に完了する
- ダッシュボードにリダイレクトされる
- 認証状態が維持される

### Postconditions
- 認証状態がブラウザに保存される
- 後続テストで認証状態を再利用可能

---

## TS-002: Basic Chat Interaction

### Metadata
| Field | Value |
|-------|-------|
| **ID** | TS-002 |
| **Name** | Basic Chat Message Exchange |
| **Category** | Chat |
| **Priority** | P1 |

### Description
MOCセクションでの基本的なチャットメッセージのやり取りを検証する。

### Preconditions
1. ユーザーがログイン済み
2. ダッシュボードにアクセス可能

### Test Steps

| Step | Action | Expected Result | Screenshot | Log Chat |
|------|--------|-----------------|------------|----------|
| 1 | MOCセクションに移動 | チャットインターフェースが表示される | Yes | No |
| 2 | 入力フィールドを確認 | 入力可能な状態である | No | No |
| 3 | "こんにちは" と入力して送信 | ユーザーメッセージが表示される | Yes | Yes |
| 4 | AI応答を待機（最大30秒） | ローディング表示後、応答が表示される | Yes | Yes |
| 5 | 応答内容を確認 | 挨拶に対する適切な応答がある | Yes | Yes |

### Expected Results
- チャット入力フィールドが機能する
- ユーザーメッセージが正しく表示される
- AI応答が適切な時間内に返される
- 応答にタイムスタンプが表示される

### Chat Log Format
```json
{
  "testId": "TS-002-{timestamp}",
  "scenario": "Basic Chat Interaction",
  "messages": [
    {
      "role": "user",
      "content": "こんにちは",
      "timestamp": "..."
    },
    {
      "role": "assistant",
      "content": "...",
      "timestamp": "..."
    }
  ]
}
```

---

## TS-003: Health Category - Exercise Habit

### Metadata
| Field | Value |
|-------|-------|
| **ID** | TS-003 |
| **Name** | Exercise Habit Suggestion Flow |
| **Category** | Chat Scenario - Health |
| **Priority** | P1 |

### Description
運動習慣に関する質問から習慣提案までのフローを検証する。まとめて質問せず、段階的に会話を進める。

### Preconditions
1. ユーザーがログイン済み
2. MOCセクションが表示されている

### Test Steps

| Step | Action | Expected Result | Screenshot | Log Chat |
|------|--------|-----------------|------------|----------|
| 1 | "運動を始めたいと思っています" を送信 | ユーザーメッセージ表示、AI応答待機 | Yes | Yes |
| 2 | AI応答を確認 | カテゴリ選択のQuickReplyまたは詳細質問 | Yes | Yes |
| 3 | QuickReplyがあれば選択、なければ "ジョギングに興味があります" を送信 | 次の質問または提案が表示される | Yes | Yes |
| 4 | 頻度について聞かれたら "週3回くらい" と回答 | 具体的な習慣提案が表示される | Yes | Yes |
| 5 | 候補ボタンを確認 | Habit型のSuggestionCardが表示される | Yes | Yes |
| 6 | SuggestionCardのバッジを検証 | "Habit" ラベル、青色バッジ | Yes | No |

### Expected Results
- 会話が段階的に進行する
- QuickReplyボタンが適切に表示される
- Habit型の候補が提案される
- 候補カードに正しい型バッジが表示される

### Validation Points
- [ ] QuickReplyボタンが表示される（少なくとも2つ以上）
- [ ] Habit型SuggestionCardが表示される
- [ ] バッジの色が青（`blue-*`クラス）
- [ ] バッジのラベルが "Habit"

---

## TS-004: Health Category - Sleep Improvement

### Metadata
| Field | Value |
|-------|-------|
| **ID** | TS-004 |
| **Name** | Sleep Improvement Habit Flow |
| **Category** | Chat Scenario - Health |
| **Priority** | P2 |

### Description
睡眠改善に関する質問から習慣提案までのフローを検証する。

### Preconditions
1. ユーザーがログイン済み
2. MOCセクションが表示されている

### Test Steps

| Step | Action | Expected Result | Screenshot | Log Chat |
|------|--------|-----------------|------------|----------|
| 1 | "最近睡眠の質が悪いです" を送信 | AI応答待機 | Yes | Yes |
| 2 | AI応答を確認 | 睡眠に関する質問または選択肢 | Yes | Yes |
| 3 | 提示された選択肢を選択、または "入眠に時間がかかります" を送信 | 具体的なアドバイスまたは提案 | Yes | Yes |
| 4 | 候補が表示されたら内容を確認 | 睡眠関連の習慣提案 | Yes | Yes |

### Expected Results
- 睡眠に関する適切な対話が行われる
- 具体的な習慣提案が表示される

---

## TS-005: Learning Category - Reading Habit

### Metadata
| Field | Value |
|-------|-------|
| **ID** | TS-005 |
| **Name** | Reading Habit Suggestion Flow |
| **Category** | Chat Scenario - Learning |
| **Priority** | P1 |

### Description
読書習慣に関する質問から習慣/ゴール提案までのフローを検証する。

### Preconditions
1. ユーザーがログイン済み
2. MOCセクションが表示されている

### Test Steps

| Step | Action | Expected Result | Screenshot | Log Chat |
|------|--------|-----------------|------------|----------|
| 1 | "読書習慣をつけたいです" を送信 | AI応答待機 | Yes | Yes |
| 2 | AI応答を確認 | 読書ジャンルに関する質問 | Yes | Yes |
| 3 | "ビジネス書を読みたい" を送信 | 具体的な質問または提案 | Yes | Yes |
| 4 | 候補表示を確認 | Habit型またはGoal型の提案 | Yes | Yes |
| 5 | Goal型候補があれば検証 | "Goal" ラベル、紫色バッジ | Yes | No |

### Expected Results
- 読書習慣に関する適切な対話
- Habit型またはGoal型の提案が表示される
- Goal型バッジが紫色で表示される

### Validation Points
- [ ] Goal型SuggestionCardが表示される（可能性あり）
- [ ] バッジの色が紫（`purple-*`クラス）
- [ ] バッジのラベルが "Goal"

---

## TS-006: Learning Category - Language Learning

### Metadata
| Field | Value |
|-------|-------|
| **ID** | TS-006 |
| **Name** | Language Learning Goal Flow |
| **Category** | Chat Scenario - Learning |
| **Priority** | P2 |

### Description
語学学習に関する質問から習慣/ゴール提案までのフローを検証する。

### Preconditions
1. ユーザーがログイン済み
2. MOCセクションが表示されている

### Test Steps

| Step | Action | Expected Result | Screenshot | Log Chat |
|------|--------|-----------------|------------|----------|
| 1 | "英語を勉強したいです" を送信 | AI応答待機 | Yes | Yes |
| 2 | AI応答を確認 | 学習目的に関する質問 | Yes | Yes |
| 3 | "ビジネス英語を身につけたい" を送信 | 具体的な質問または提案 | Yes | Yes |
| 4 | 候補表示を確認 | Goal型の長期目標提案 | Yes | Yes |

### Expected Results
- 語学学習に関する適切な対話
- 長期目標としてGoal型提案が表示される可能性が高い

---

## TS-007: Productivity Category - Task Organization

### Metadata
| Field | Value |
|-------|-------|
| **ID** | TS-007 |
| **Name** | Task Organization with Sticky'n |
| **Category** | Chat Scenario - Productivity |
| **Priority** | P1 |

### Description
タスク整理に関する質問からSticky'n提案までのフローを検証する。

### Preconditions
1. ユーザーがログイン済み
2. MOCセクションが表示されている

### Test Steps

| Step | Action | Expected Result | Screenshot | Log Chat |
|------|--------|-----------------|------------|----------|
| 1 | "タスクが溜まって困っています" を送信 | AI応答待機 | Yes | Yes |
| 2 | AI応答を確認 | タスク管理に関する質問 | Yes | Yes |
| 3 | "今日やることを整理したい" を送信 | 具体的な提案 | Yes | Yes |
| 4 | 候補表示を確認 | Sticky'n型の提案 | Yes | Yes |
| 5 | Sticky'n型バッジを検証 | "Sticky'n" ラベル、黄色バッジ | Yes | No |

### Expected Results
- タスク整理に関する適切な対話
- Sticky'n型の提案が表示される
- バッジが黄色で表示される

### Validation Points
- [ ] Sticky'n型SuggestionCardが表示される
- [ ] バッジの色が黄色（`yellow-*`クラス）
- [ ] バッジのラベルが "Sticky'n"

---

## TS-008: Suggestion Card Accept Flow

### Metadata
| Field | Value |
|-------|-------|
| **ID** | TS-008 |
| **Name** | Accept Suggestion Card |
| **Category** | Suggestion Actions |
| **Priority** | P1 |

### Description
候補カードの承認フローを検証する。

### Preconditions
1. ユーザーがログイン済み
2. SuggestionCardが表示されている

### Test Steps

| Step | Action | Expected Result | Screenshot | Log Chat |
|------|--------|-----------------|------------|----------|
| 1 | 習慣提案を表示させる質問を送信 | Habit型SuggestionCard表示 | Yes | Yes |
| 2 | SuggestionCardをクリック | モーダルが開く | Yes | No |
| 3 | モーダル内容を確認 | HabitModalが表示される | Yes | No |
| 4 | "追加" または "作成" ボタンをクリック | モーダルが閉じる | Yes | No |
| 5 | カードの状態を確認 | "採用済み" 状態になる | Yes | No |

### Expected Results
- カードクリックでモーダルが開く
- モーダルはHabitModalである
- 追加後、カードが "採用済み" 状態に変わる

### Validation Points
- [ ] モーダルが開く（`[role="dialog"]`が表示）
- [ ] 習慣作成フォームが表示される
- [ ] 保存後、緑色のチェックマークバッジが表示される

---

## TS-009: Suggestion Card Snooze Flow

### Metadata
| Field | Value |
|-------|-------|
| **ID** | TS-009 |
| **Name** | Snooze Suggestion Card |
| **Category** | Suggestion Actions |
| **Priority** | P2 |

### Description
候補カードのスヌーズ（後で確認）フローを検証する。

### Preconditions
1. ユーザーがログイン済み
2. SuggestionCardが表示されている

### Test Steps

| Step | Action | Expected Result | Screenshot | Log Chat |
|------|--------|-----------------|------------|----------|
| 1 | SuggestionCardの "後で" ボタンをクリック | カード状態が変化 | Yes | No |
| 2 | カードの状態を確認 | "後で確認" 状態になる | Yes | No |

### Expected Results
- "後で" ボタンが機能する
- カードが黄色のスヌーズ状態に変わる

---

## TS-010: Suggestion Card Dismiss Flow

### Metadata
| Field | Value |
|-------|-------|
| **ID** | TS-010 |
| **Name** | Dismiss Suggestion Card |
| **Category** | Suggestion Actions |
| **Priority** | P2 |

### Description
候補カードの却下フローを検証する。

### Preconditions
1. ユーザーがログイン済み
2. SuggestionCardが表示されている

### Test Steps

| Step | Action | Expected Result | Screenshot | Log Chat |
|------|--------|-----------------|------------|----------|
| 1 | SuggestionCardの "不要" ボタンをクリック | カード状態が変化 | Yes | No |
| 2 | カードの状態を確認 | "不要" 状態になる | Yes | No |

### Expected Results
- "不要" ボタンが機能する
- カードがグレーアウトされた却下状態に変わる

---

## TS-011: Quick Reply Button Interaction

### Metadata
| Field | Value |
|-------|-------|
| **ID** | TS-011 |
| **Name** | Quick Reply Button Click |
| **Category** | Chat - Quick Reply |
| **Priority** | P1 |

### Description
QuickReplyボタンのクリック操作を検証する。

### Preconditions
1. ユーザーがログイン済み
2. QuickReplyボタンが表示されている

### Test Steps

| Step | Action | Expected Result | Screenshot | Log Chat |
|------|--------|-----------------|------------|----------|
| 1 | QuickReplyを表示させる質問を送信 | QuickReplyボタンが表示される | Yes | Yes |
| 2 | QuickReplyボタンをクリック | ボタンの値がメッセージとして送信される | Yes | Yes |
| 3 | AI応答を待機 | 選択に基づいた応答が表示される | Yes | Yes |

### Expected Results
- QuickReplyボタンがクリック可能
- クリック後、選択値がチャットに送信される
- AIが選択に基づいた応答を返す

---

## TS-012: Reply Type Suggestion

### Metadata
| Field | Value |
|-------|-------|
| **ID** | TS-012 |
| **Name** | Reply Type Suggestion Verification |
| **Category** | Suggestion Types |
| **Priority** | P2 |

### Description
Reply型（回答型）候補ボタンの表示と動作を検証する。

### Preconditions
1. ユーザーがログイン済み
2. MOCセクションが表示されている

### Test Steps

| Step | Action | Expected Result | Screenshot | Log Chat |
|------|--------|-----------------|------------|----------|
| 1 | 改善提案を引き出す質問を送信（例: "この習慣をもっと簡単にできますか"） | AI応答待機 | Yes | Yes |
| 2 | Reply型候補が表示されるか確認 | Reply型SuggestionCardが表示される | Yes | Yes |
| 3 | Reply型バッジを検証 | "回答" ラベル、ティール色バッジ | Yes | No |
| 4 | Reply型カードをクリック | 回答がチャットに送信される | Yes | Yes |

### Expected Results
- Reply型候補が適切な状況で表示される
- バッジがティール色で "回答" ラベル
- クリックで回答が送信される

### Validation Points
- [ ] Reply型SuggestionCardが表示される
- [ ] バッジの色がティール（`teal-*`クラス）
- [ ] バッジのラベルが "回答" または "Reply"

---

## TS-013: Chat Log Recording Verification

### Metadata
| Field | Value |
|-------|-------|
| **ID** | TS-013 |
| **Name** | Chat Log Recording |
| **Category** | Test Infrastructure |
| **Priority** | P1 |

### Description
チャットログが正しく記録・保存されることを検証する。

### Preconditions
1. ユーザーがログイン済み
2. テスト実行環境が整っている

### Test Steps

| Step | Action | Expected Result | Screenshot | Log Chat |
|------|--------|-----------------|------------|----------|
| 1 | 3往復の会話を実行 | 全メッセージが表示される | No | Yes |
| 2 | テスト完了後、ログファイルを確認 | JSONファイルが生成されている | No | No |
| 3 | ログ内容を検証 | 全メッセージが記録されている | No | No |

### Expected Results
- `test-results/chat-logs/` にJSONファイルが生成される
- ログに全てのユーザーメッセージが含まれる
- ログに全てのAI応答が含まれる
- タイムスタンプが記録されている

### Log Verification Checklist
- [ ] ファイルが存在する
- [ ] JSON形式が正しい
- [ ] `testId` が含まれる
- [ ] `messages` 配列に6件のメッセージがある
- [ ] 各メッセージに `role`, `content`, `timestamp` がある

---

## TS-014: Error Handling - Network Timeout

### Metadata
| Field | Value |
|-------|-------|
| **ID** | TS-014 |
| **Name** | Network Timeout Handling |
| **Category** | Error Handling |
| **Priority** | P2 |

### Description
ネットワークタイムアウト時のエラーハンドリングを検証する。

### Preconditions
1. ユーザーがログイン済み
2. ネットワーク遅延をシミュレート可能

### Test Steps

| Step | Action | Expected Result | Screenshot | Log Chat |
|------|--------|-----------------|------------|----------|
| 1 | ネットワーク遅延をシミュレート | - | No | No |
| 2 | メッセージを送信 | ローディング表示 | Yes | Yes |
| 3 | タイムアウトを待機 | エラーメッセージが表示される | Yes | Yes |
| 4 | エラーメッセージを確認 | ユーザーフレンドリーなメッセージ | Yes | No |

### Expected Results
- タイムアウト時にエラーメッセージが表示される
- エラーメッセージが日本語で適切
- リトライ可能な状態が維持される

---

## TS-015: Full E2E Flow

### Metadata
| Field | Value |
|-------|-------|
| **ID** | TS-015 |
| **Name** | Complete User Journey |
| **Category** | Integration |
| **Priority** | P1 |

### Description
ログインから習慣作成までの完全なユーザージャーニーを検証する。

### Preconditions
1. テストアカウントが有効
2. 初期状態からのテスト

### Test Steps

| Step | Action | Expected Result | Screenshot | Log Chat |
|------|--------|-----------------|------------|----------|
| 1 | ログインページにアクセス | ログインページ表示 | Yes | No |
| 2 | Googleでログイン | ダッシュボードに遷移 | Yes | No |
| 3 | MOCセクションに移動 | チャット画面表示 | Yes | No |
| 4 | "毎朝ストレッチをしたい" を送信 | AI応答 | Yes | Yes |
| 5 | 提示された選択肢に回答 | 具体的な提案 | Yes | Yes |
| 6 | Habit型候補を承認 | モーダル表示 | Yes | Yes |
| 7 | 習慣を作成 | 習慣が追加される | Yes | No |
| 8 | ダッシュボードで習慣を確認 | 新習慣が表示される | Yes | No |

### Expected Results
- ログインから習慣作成までスムーズに完了
- 作成した習慣がダッシュボードに表示される
- 全てのステップでエラーが発生しない

---

## Test Execution Matrix

### Priority P1 Tests (必須)

| Test ID | Name | Estimated Time |
|---------|------|----------------|
| TS-001 | Google OAuth Login | 2m |
| TS-002 | Basic Chat Message Exchange | 3m |
| TS-003 | Exercise Habit Suggestion Flow | 5m |
| TS-005 | Reading Habit Suggestion Flow | 5m |
| TS-007 | Task Organization with Sticky'n | 5m |
| TS-008 | Accept Suggestion Card | 3m |
| TS-011 | Quick Reply Button Click | 3m |
| TS-013 | Chat Log Recording | 3m |
| TS-015 | Complete User Journey | 10m |

**Total P1 Execution Time**: ~39m

### Priority P2 Tests (重要)

| Test ID | Name | Estimated Time |
|---------|------|----------------|
| TS-004 | Sleep Improvement Habit Flow | 4m |
| TS-006 | Language Learning Goal Flow | 4m |
| TS-009 | Snooze Suggestion Card | 2m |
| TS-010 | Dismiss Suggestion Card | 2m |
| TS-012 | Reply Type Suggestion Verification | 4m |
| TS-014 | Network Timeout Handling | 3m |

**Total P2 Execution Time**: ~19m

### Full Suite Execution Time: ~58m

---

## Appendix: Expected Type Badge Specifications

### Visual Specification

| Type | Icon | Label (JA) | Label (EN) | Color Class |
|------|------|------------|------------|-------------|
| habit | `icon` | Habit | Habit | `bg-blue-100 text-blue-700` |
| goal | `icon` | Goal | Goal | `bg-purple-100 text-purple-700` |
| stickyn | `icon` | Sticky'n | Sticky'n | `bg-yellow-100 text-yellow-700` |
| category | `icon` | Category | Category | `bg-green-100 text-green-700` |
| text | `icon` | Text | Text | `bg-gray-100 text-gray-700` |
| reply | `icon` | 回答 | Reply | `bg-teal-100 text-teal-700` |

### State Badge Specifications

| State | Icon | Label (JA) | Color Class |
|-------|------|------------|-------------|
| pending | - | - | Default card style |
| accepted | Check | 採用済み | `bg-green-50 border-green-200` |
| snoozed | Clock | 後で確認 | `bg-yellow-50 border-yellow-200` |
| dismissed | X | 不要 | `bg-gray-50 border-gray-200 opacity-60` |
| loading | Spinner | 処理中... | `text-primary` |
