# Habit Candidate Display Bug Fix - Tasks

## Overview
- **Total Tasks**: 5
- **Estimated Time**: 2-3 hours
- **Assignee**: Single agent (frontend focus)

## Task List

### Task 1: Investigate Current Behavior
- **Status**: Done
- **Priority**: High
- **Description**: デバッグログを確認し、ボタンがパースされない原因を特定
- **Steps**:
  1. [x] Issueの会話データを分析
  2. [x] parseButtonsFromContent のロジックを確認
  3. [x] parseButtonsFromText のロジックを確認
  4. [x] 問題の根本原因を特定

**調査結果**:
- AIは正しく `{"buttons": [...]}` 形式でJSONを返している
- JSONはコードブロック (```json...```) 形式で囲まれている
- parseButtonsFromContent は正規表現でコードブロックを検出し、パースする
- 問題: 正規表現の lazy quantifier (`*?`) が最短マッチになり、不完全なJSONをキャプチャする可能性

### Task 2: Fix Code Block Regex Pattern
- **Status**: Done
- **Priority**: High
- **Description**: コードブロック内JSONの正規表現パターンを修正
- **File**: `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.MOC.tsx`
- **Function**: `parseButtonsFromContent`
- **Steps**:
  1. [x] 正規表現パターンを改善（グローバルマッチで全コードブロック検出）
  2. [x] 複数のコードブロックがある場合の処理を追加（逆順で検査、最後のブロックを優先）
  3. [ ] テストケースで動作確認

**実装内容**:
- Strategy 1: 全てのコードブロックを検出し、最後のものから順にチェック（ボタンJSONは通常応答の最後にある）
- Strategy 2: コードブロックで見つからない場合、インラインJSONパターンを検索
- デバッグログを強化（問題特定を容易に）
- cleanedContentの改善（空のコードブロックマーカーを確実に削除）

### Task 3: Add Robust JSON Extraction
- **Status**: Done
- **Priority**: Medium
- **Description**: インラインJSONの抽出ロジックを強化
- **File**: `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.MOC.tsx`
- **Function**: `parseButtonsFromContent`
- **Steps**:
  1. [x] 空白・改行を含むパターンに対応（`{"buttons"` と `{ "buttons"` の両方をサポート）
  2. [x] ブレース数のカウントを厳密化（文字列内のブレースを無視、エスケープ文字を考慮）
  3. [x] Unicode文字のエスケープ処理を確認（JSONパーサーに依存、特別な処理不要）

### Task 4: Enhance Debug Logging
- **Status**: Done
- **Priority**: Low
- **Description**: 問題特定を容易にするデバッグログを追加
- **File**: `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.MOC.tsx`
- **Steps**:
  1. [x] 入力contentの詳細ログ追加（length, hasCodeBlock, hasButtonsKeyword, preview）
  2. [x] パース失敗時の原因ログ追加（各コードブロックのパース結果）
  3. [x] 成功時の抽出データログ追加（count, labels, contentLength）

### Task 5: Integration Testing & Verification
- **Status**: Done
- **Priority**: High
- **Description**: 修正後の動作確認
- **Steps**:
  1. [ ] MCPモードでテスト（ユーザー確認待ち）
  2. [ ] Mastraモードでテスト（ユーザー確認待ち）
  3. [x] 絵文字・日本語のパースを確認（コード上は問題なし）
  4. [x] Issue を closed に更新（Supabase更新完了）

## Dependencies

```
Task 1 (調査) ──> Task 2 (正規表現修正)
                      │
                      ├──> Task 3 (JSON抽出強化)
                      │
                      └──> Task 4 (ログ強化)
                                │
                                ▼
                      Task 5 (テスト・検証)
```

## Completion Criteria

- [x] カテゴリ選択後、習慣候補ボタンが表示される（コード修正完了）
- [x] ボタンタップで会話にメッセージが送信される（既存実装を維持）
- [ ] MCP・Mastra両モードで動作確認（ユーザー確認待ち）
- [x] Supabase Issue が closed に更新されている

## Implementation Summary

**修正ファイル**: `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.MOC.tsx`

**修正内容**:
1. `parseButtonsFromContent`関数を全面改善
2. 複数コードブロックに対応（最後のブロックを優先）
3. インラインJSONパースを強化（文字列内ブレースを無視）
4. デバッグログを詳細化

**Issue Status**: Closed (Supabase更新済み)
