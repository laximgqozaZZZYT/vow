# Suggestion Buttons Fix - Tasks

## Overview
- **Purpose**: 候補ボタン表示問題の修正タスク一覧
- **Status**: In Progress
- **Version**: 1.0.0
- **Last Updated**: 2026-02-04
- **Author**: vow-spec-architect

## Task List

### Phase 1: Investigation & Debugging (Assignable: any agent)

- [x] Task 1.1: コードベースの調査
  - Section.MOC.tsx の候補ボタン関連コードを特定
  - useMastraAgent.ts のSSE処理を確認
  - useMcpChat.ts のSSE処理を確認
  - バックエンド agents.ts のレスポンス形式を確認
  - **Status**: Complete

- [x] Task 1.2: 根本原因の特定
  - データフロー分析
  - toolCalls が空になる原因を特定
  - **Finding**: msg.toolCalls が undefined または空のためsuggestionsがパースされない
  - **Status**: Complete

### Phase 2: Frontend Fix (Assignable: frontend-agent)

- [x] Task 2.1: useMastraAgent.ts の修正
  - **File**: `frontend/app/dashboard/hooks/useMastraAgent.ts`
  - **Description**: SSE complete イベントから toolCalls を確実に取得し、メッセージ状態に反映する
  - **Changes**:
    1. Line 321-344: finalToolCalls の計算ロジックを修正
    2. chunk.toolCalls が空でも accumulated toolCalls を使用する
    3. デバッグログを追加して問題追跡を容易にする (Line 184-198, 327-333)
  - **Status**: Complete - デバッグログ追加済み、ロジックは既に正しく実装されていた
  - **Prerequisite**: None

- [x] Task 2.2: useMcpChat.ts の修正
  - **File**: `frontend/app/dashboard/hooks/useMcpChat.ts`
  - **Description**: MCP完了イベントから toolCalls を確実に取得する
  - **Changes**:
    1. Line 362-385: toolCalls の取得とメッセージ状態への反映を確認 - 正しく動作している
    2. デバッグログを強化（toolCallOutputs, suggestionsCount, contentLength追加）
    3. MCPサーバーがtoolCallsを返さない場合は Section.MOC.tsx のテキストフォールバックが処理
  - **Status**: Complete
  - **Prerequisite**: None

- [x] Task 2.3: Section.MOC.tsx のデバッグログ強化
  - **File**: `frontend/app/dashboard/components/Section.MOC.tsx`
  - **Description**: parseSuggestions の入力データを詳細にログ出力
  - **Changes**:
    1. Line 588-609: msg.toolCalls の詳細をログ出力（toolCallsRaw, toolCallsDetail追加）
    2. parseSuggestions 関数内の各ステップでログ出力
  - **Status**: Complete
  - **Prerequisite**: None

- [x] Task 2.4: フォールバック提案パースの実装
  - **File**: `frontend/app/dashboard/components/Section.MOC.tsx`
  - **Description**: toolCalls が無い場合、テキストコンテンツから提案をパースする
  - **Changes**:
    1. parseSuggestionsFromText 関数を新規追加 (Line 2237-2302)
    2. parseSuggestions 関数にテキストフォールバック追加 (Line 1958-1961, 2218-2221)
    3. **重要修正**: Line 611 の条件変更 - `isComplete && msg.toolCalls?.length` から `isComplete` に変更
       - これにより toolCalls が空でも parseSuggestions が呼び出され、テキストフォールバックが動作する
  - **Status**: Complete
  - **Prerequisite**: Task 2.3

### Phase 3: Backend Verification (Assignable: backend-agent)

- [x] Task 3.1: agents.ts の SSE レスポンス確認
  - **File**: `backend/src/routers/agents.ts`
  - **Description**: complete イベントで toolCalls が正しく送信されていることを確認
  - **Changes**:
    1. Line 319-327: toolCalls のシリアライズを確認 - 正しく送信されている
    2. Line 303-318: toolCalls.output の内容を詳細ログ出力追加済み
  - **Status**: Complete - バックエンドは正しく toolCalls を送信している
  - **Prerequisite**: None

- [x] Task 3.2: vow-coach-agent.ts の toolCalls 生成確認
  - **File**: `backend/src/agents/mastra/vow-coach-agent.ts`
  - **Description**: suggest_habits/suggest_goals ツール呼び出し時に toolCalls が正しく生成されることを確認
  - **Changes**:
    1. Line 1919-1925: ツール実行後の toolCallRecords 生成を確認 - 正しく動作
    2. Line 1967-1971: output フィールドに suggestions 配列が含まれることを確認
    3. Line 1910-1917: デバッグログ追加済み
  - **Status**: Complete
  - **Prerequisite**: None

- [x] Task 3.3: coach-tools.ts の出力形式確認
  - **File**: `backend/src/agents/shared-tools/coach-tools.ts`
  - **Description**: suggestHabitsExecute/suggestGoalsExecute の戻り値形式を確認
  - **Changes**:
    1. Line 2524: { suggestions: [...], followUpActions: [...] } 形式が返されることを確認
    2. suggestions 配列内の各アイテムに suggestionType が含まれることを確認
  - **Status**: Complete - 出力形式は正しい
  - **Prerequisite**: None

### Phase 4: Integration Testing (Assignable: tester-agent)

- [ ] Task 4.1: OpenAI モードのE2Eテスト
  - **Description**: OpenAI経由で習慣/目標提案がボタン表示されることを確認
  - **Test Cases**:
    1. 「健康の習慣を提案して」→ 3つの SuggestionCard が表示される
    2. 「キャリアの目標を提案して」→ 3つの SuggestionCard が表示される
    3. SuggestionCard クリックで HabitModal/GoalModal が開く
  - **Prerequisite**: Task 2.1, 2.2, 2.3
  - **Estimated Time**: 30 min

- [ ] Task 4.2: MCP モードのE2Eテスト
  - **Description**: MCP経由で習慣/目標提案がボタン表示されることを確認
  - **Test Cases**:
    1. MCP サーバー接続状態で同様のテスト
  - **Prerequisite**: Task 4.1
  - **Estimated Time**: 30 min

### Phase 5: Cleanup (Assignable: any agent)

- [ ] Task 5.1: デバッグログの整理
  - **Description**: 本番環境で不要なログを削除または条件付きに変更
  - **Files**:
    - frontend/app/dashboard/components/Section.MOC.tsx
    - frontend/app/dashboard/hooks/useMastraAgent.ts
    - frontend/app/dashboard/hooks/useMcpChat.ts
  - **Prerequisite**: Task 4.1, 4.2
  - **Estimated Time**: 15 min

- [ ] Task 5.2: 仕様書の更新
  - **Description**: 完了した修正内容を仕様書に反映
  - **Files**:
    - specs/suggestion-buttons-fix/requirements.md (Status: Implemented)
  - **Prerequisite**: Task 5.1
  - **Estimated Time**: 10 min

## Task Dependencies Graph

```
Task 1.1 ──► Task 1.2 ──┬──► Task 2.1 ──┬──► Task 4.1 ──► Task 4.2 ──► Task 5.1 ──► Task 5.2
                       │               │
                       ├──► Task 2.2 ──┤
                       │               │
                       ├──► Task 2.3 ──┼──► Task 2.4
                       │               │
                       ├──► Task 3.1 ──┤
                       │               │
                       ├──► Task 3.2 ──┤
                       │               │
                       └──► Task 3.3 ──┘
```

## Parallel Execution Opportunities

以下のタスクは並行実行可能:
- Task 2.1, 2.2, 2.3 (フロントエンドの異なるファイル)
- Task 3.1, 3.2, 3.3 (バックエンドの異なるファイル)
- Frontend Tasks (2.x) と Backend Tasks (3.x)

## Agent Assignment Suggestions

| Task | Suggested Agent | Reason |
|------|-----------------|--------|
| 1.x | vow-spec-architect | 調査・仕様策定 |
| 2.x | implementer | フロントエンド実装 |
| 3.x | implementer | バックエンド確認 |
| 4.x | tester | テスト実行 |
| 5.x | code-reviewer | 品質チェック |

## Current Progress

- Phase 1: **Complete** (2/2 tasks)
- Phase 2: **Complete** (4/4 tasks)
- Phase 3: **Complete** (3/3 tasks)
- Phase 4: **Not Started** (0/2 tasks)
- Phase 5: **Not Started** (0/2 tasks)

**Overall Progress**: 9/13 tasks (69%)

## Key Fix Summary

**Root Cause**: Line 611 in Section.MOC.tsx had condition `isComplete && msg.toolCalls?.length` which prevented `parseSuggestions` from being called when `toolCalls` was empty/undefined.

**Solution**:
1. Changed condition to just `isComplete` so `parseSuggestions` is always called for complete messages
2. `parseSuggestions` has internal fallback to `parseSuggestionsFromText` when toolCalls are not available
3. This enables suggestion parsing from both toolCalls (preferred) and text content (fallback)
