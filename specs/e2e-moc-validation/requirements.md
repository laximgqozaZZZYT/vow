# E2E MOC Validation - Requirements

## Overview
- **Feature Name**: E2E テスト基盤強化・MOCチャット機能自動検証
- **Status**: Draft
- **Version**: 1.0.0
- **Created**: 2026-02-05
- **Author**: researcher
- **Location**: `/home/ubuntu/Downloads/vow/specs/e2e-moc-validation/`

## Background

現在のVOWプロジェクトには基本的なE2Eテスト基盤が存在するが、以下の課題がある：

### 現状分析

**既存テスト基盤:**
- `frontend/e2e/` - Playwright ベースのテスト
- `fixtures/chat.fixture.ts` - チャットテスト用フィクスチャ
- `page-objects/MOCSectionPage.ts` - チャットUI操作
- `utils/chat-logger.ts` - チャット会話ログ記録
- 既存シナリオ: 基本チャット、候補表示、クイックリプライ

**既存の制限:**
- 認証状態の自動管理が不完全（手動ログイン必須の場合がある）
- プリセット候補からの段階的フロー選択のテストが未実装
- 候補ラベル（Habit/Goal/Sticky'n/回答）の検証が基本的なみ
- アクションボタン（採用/却下/詳細）の一括テストが不完全
- 「もっと具体的に」「もっと一般的に」などの調整ボタンテストが未実装

**既存ファイルの問題点:**
- `auth.fixture.ts` - OAuth認証が手動または外部トークン頼み
- `MOCSectionPage.ts` - 複数選択、一括登録、調整アクションのメソッドが不十分
- テスト内で硬度がなく、動的ボタン検出に弱い

---

## Functional Requirements

### FR-001: 自動ログイン機能の確立
- **Priority**: Critical
- **Description**: テストの開始時にk6285620@gmail.comでのOAuth認証を自動化する
- **Acceptance Criteria**:
  - [AC-001-1] 認証状態ファイル（`.auth/user.json`）がない場合、テスト実行前にOAuth環境で初期ログインを促す手順書が自動生成される
  - [AC-001-2] 認証状態ファイルが存在する場合、そこから認証状態を復元できる
  - [AC-001-3] 復元した認証状態が無効（セッション切れ）の場合、それを検知できる
  - [AC-001-4] CI環境では環境変数から認証トークンを取得可能な構造
  - [AC-001-5] 認証再試行メカニズムが実装されている（最大3回）
- **Current Status**: 基本実装済み、改善が必要

### FR-002: MOCチャットセクションへの遷移と初期状態確認
- **Priority**: High
- **Description**: ログイン後、MOCセクションに正しく遷移し、チャット入力が利用可能な状態を確認する
- **Acceptance Criteria**:
  - [AC-002-1] `/dashboard` から MOC/Agents セクションへ遷移できる
  - [AC-002-2] チャット入力フィールドが表示される
  - [AC-002-3] 初期状態でチャット履歴が正しく表示される
  - [AC-002-4] 「情報種類」「カテゴリ」「サブカテゴリ」の選択フローが開始可能
- **Current Status**: 基本実装済み

### FR-003: プリセット候補による段階的フロー
- **Priority**: High
- **Description**: チャットで段階的に「情報種類 → カテゴリ → サブカテゴリ」を選択し、その過程での候補表示を検証する
- **Acceptance Criteria**:
  - [AC-003-1] 「情報種類を選択」のプロンプトで複数の選択肢（クイックリプライ）が表示される
  - [AC-003-2] 一つの情報種類を選択すると、該当カテゴリの選択肢が表示される
  - [AC-003-3] カテゴリを選択すると、サブカテゴリの選択肢が表示される
  - [AC-003-4] 最終的に習慣/目標/スティッキーノート の候補が表示される
  - [AC-003-5] 各ステップでの選択内容がログに記録される
- **Current Status**: 基本的なシナリオは存在、システマティックなテストが不足

### FR-004: 候補ラベル型の検証
- **Priority**: High
- **Description**: 表示される候補が正しい型（Habit/Goal/Sticky'n/回答）であり、各型に対応したバッジが表示されることを検証する
- **Acceptance Criteria**:
  - [AC-004-1] Habit型の候補に「Habit」バッジが青色で表示される
  - [AC-004-2] Goal型の候補に「Goal」バッジが紫色で表示される
  - [AC-004-3] Sticky'n型の候補に「Sticky'n」バッジが黄色で表示される
  - [AC-004-4] 回答型の候補に「回答」バッジが緑色で表示される
  - [AC-004-5] バッジの背景色が正しいCSSクラスで設定されている
  - [AC-004-6] バッジテキストが日本語/英語ロケールに対応している
- **Current Status**: 基本的なテストは存在、色の検証が弱い

### FR-005: アクションボタンの検証
- **Priority**: High
- **Description**: 各候補カードに表示されるアクションボタン（採用/却下/詳細）が正しく動作することを検証する
- **Acceptance Criteria**:
  - [AC-005-1] 「採用」ボタンが存在し、クリックでモーダルが開く
  - [AC-005-2] 「却下」ボタンが存在し、クリックで候補が非表示になる
  - [AC-005-3] 「詳細」ボタンまたはカード全体がクリック可能で詳細モーダルを開く
  - [AC-005-4] 複数選択時に、複数候補を一括登録できる「登録」ボタンが表示される
  - [AC-005-5] 「もっと具体的に」「もっと一般的に」などの調整ボタンが表示される
  - [AC-005-6] アクションボタンのラベルが日本語/英語ロケール対応
- **Current Status**: 基本ボタンは実装済み、複数選択系は実装予定

### FR-006: 会話ログの保存と検証
- **Priority**: High
- **Description**: テスト実行中の全会話内容、候補情報、ユーザー操作をJSON形式で保存し、テスト結果と共に保存する
- **Acceptance Criteria**:
  - [AC-006-1] 会話ログが `test-results/chat-logs/{testId}.json` に保存される
  - [AC-006-2] 各メッセージに以下を記録：タイムスタンプ、送信者（user/assistant/system）、テキスト内容、提示された候補、ユーザー選択
  - [AC-006-3] テスト終了時に総メッセージ数、テスト成功/失敗、実行時間を記録
  - [AC-006-4] ログから特定のシナリオ実行結果を追跡可能
  - [AC-006-5] テスト失敗時に、失敗前の会話内容がログに含まれる
- **Current Status**: `ChatLogger` 基本実装済み、候補複数選択と詳細情報の記録が不十分

### FR-007: 複数選択フロー
- **Priority**: Medium
- **Description**: MOCチャット機能で複数の候補を選択し、一括操作（登録/調整）できることを検証する
- **Acceptance Criteria**:
  - [AC-007-1] 各候補カードにチェックボックスが表示される
  - [AC-007-2] チェックボックスで複数候補を選択できる
  - [AC-007-3] 「すべて選択」トグルで全候補を一括選択可能
  - [AC-007-4] 選択状態が視覚的にハイライトされる
  - [AC-007-5] 選択した候補のみ「登録」ボタンで一括登録できる
- **Current Status**: UIコンポーネントは実装予定、E2Eテストは未実装

### FR-008: 候補調整フロー
- **Priority**: Medium
- **Description**: 「もっと具体的に」「もっと一般的に」などの調整ボタンをテストし、新しい候補生成を検証する
- **Acceptance Criteria**:
  - [AC-008-1] 候補を選択した状態で「もっと具体的に」ボタンをクリック可能
  - [AC-008-2] クリック後、新しい調整済み候補が生成される
  - [AC-008-3] 生成された候補は前回のメッセージの続きとして会話に追加される
  - [AC-008-4] 複数の調整パターンをテスト可能（具体的、一般的、難易度変更など）
- **Current Status**: UIコンポーネント実装予定、E2Eテストは未実装

---

## Non-Functional Requirements

### NFR-001: パフォーマンス
- E2E テストは1シナリオあたり5分以内に完了
- チャットレスポンス待機は最大30秒
- ログ保存はテスト実行に影響を与えない（非同期処理）

### NFR-002: 信頼性
- テスト成功率は95%以上（ネットワーク遅延等の外部要因を除く）
- 不確定的な要素（タイミング）に対するリトライ機構
- ネットワークエラー時の適切なスキップ/再試行

### NFR-003: スケーラビリティ
- テストケースを最小限のコードで追加できる構造
- シナリオテンプレート化により、新規シナリオは5分以内に追加可能
- ログ保存領域は月単位で管理可能（古いログの削除戦略）

### NFR-004: 保守性
- テストコードは JSDoc コメント付きで、目的が明確
- Page Object Pattern を徹底し、UIロジックと検証ロジックを分離
- テストデータ（シナリオ、期待値）は `test-data.ts` で一元管理

### NFR-005: 多言語対応
- テストは日本語（`ja`）でのロケール設定を前提
- 英語（`en`）での実行も可能な構造
- ラベル検証は言語別にテンプレート化

---

## Dependencies

### Internal Dependencies
- `frontend/e2e/fixtures/chat.fixture.ts` - チャットテスト用フィクスチャ
- `frontend/e2e/page-objects/MOCSectionPage.ts` - MOCセクション操作
- `frontend/e2e/utils/chat-logger.ts` - 会話ログ記録
- `frontend/e2e/utils/test-data.ts` - テストデータ定義
- `frontend/playwright.config.ts` - Playwright 設定

### External Dependencies
- Playwright 1.40+
- Node.js 18+
- Test fixture framework (Playwright built-in)

### Backend Dependencies
- MOC Chat API - メッセージ送受信
- Suggestion Generation API - 候補生成

---

## Page Object Extensions Needed

### MOCSectionPage 拡張メソッド

1. **複数選択関連:**
   - `toggleSuggestionCheckbox(index: number)` - 指定インデックスの候補をチェック
   - `selectAllSuggestions()` - 全候補を選択
   - `clearAllSelections()` - 全選択を解除
   - `getSelectedSuggestionCount()` - 選択した候補数を取得

2. **アクション関連:**
   - `clickRefineButton(actionType: 'specific'|'general'|'easy'|'hard'|'arrange'|'more')` - 調整ボタンをクリック
   - `clickBatchRegisterButton()` - 一括登録ボタンをクリック
   - `getAllActionButtons()` - 表示されているアクションボタン一覧を取得

3. **バッジ検証関連:**
   - `getTypeBadgeColor(index: number)` - 指定候補のバッジ色を取得
   - `verifyAllBadgeColors(expectedMapping: Record<number, string>)` - 複数候補のバッジ色を一括検証
   - `getBadgeLabel(index: number)` - バッジラベルテキストを取得

4. **会話ログ拡張:**
   - `logSuggestionCard(index: number, suggestion: SuggestionCardInfo)` - 候補情報をログ記録
   - `logUserAction(actionType: string, details: any)` - ユーザー操作をログ記録
   - `logActionButtonClick(buttonLabel: string)` - ボタンクリックをログ記録

---

## Out of Scope

- エラーハンドリング（5xx エラーの詳細検証）のテスト
- オフライン機能のテスト
- 外部API（Google など）のOAuth実装テスト
- パフォーマンス・負荷テスト（E2Eテストの範囲外）
- UIの視覚的回帰テスト（スクリーンショット比較）

---

## Success Metrics

1. **テスト信頼性**: E2Eテストスイート全体で成功率 95% 以上
2. **カバレッジ**: MOCチャット主要フロー（情報種類→カテゴリ→サブカテゴリ）を3シナリオ以上でテスト
3. **ログ完全性**: テスト実行時の会話が100%ログに記録される
4. **保守性**: 新規テストシナリオ追加に要する時間が2時間以内
5. **CI/CD 統合**: GitHub Actions で自動実行可能

---

## Constraints

- フロントエンド: localhost:3000 で実行
- テスト環境: Chrome/Chromium のみ（クロスブラウザ検証は後期に延期）
- 認証: OAuth自動化は環境変数経由で、本物のOAuthフローではなくトークン再利用が原則
- テスト実行時間: CI で 1スイート = 15分以内

---

## Agent Coordination Notes

このSPECは以下のロールが実装を担当できる：

1. **Tester / QA Engineer**: テストシナリオ設計・実装
2. **Frontend Developer**: Page Object メソッド追加
3. **Backend Support**: API mock/stub の整備（必要に応じて）

**並列作業可能:**
- Page Object 拡張と新テストシナリオは並列実装可能
- 複数選択テストと候補調整テストは独立

**Integration Points:**
- `Section.MOC.tsx` の新機能実装と同期が必要
- 複数選択チェックボックスUI実装完了後にテスト実装開始を推奨
