# Unified Chat Response Format - Task List

## Overview

- **Purpose**: 実装タスクの詳細定義とエージェント割り当て
- **Status**: Draft
- **Version**: 1.0.0
- **Last Updated**: 2025-02-05
- **Author**: vow-spec-architect

## Task Summary

| Phase | Task Count | Estimated Hours |
|-------|------------|-----------------|
| Phase 1: Preparation | 4 | 4h |
| Phase 2: Backend | 5 | 6h |
| Phase 3: Frontend | 4 | 5h |
| Phase 4: Testing | 3 | 3h |
| Phase 5: Cleanup | 2 | 2h |
| **Total** | **18** | **20h** |

---

## Phase 1: Preparation (準備)

### TASK-001: Create Backend Type Definitions

- **Description**: バックエンド用の統一レスポンス型定義ファイルを作成
- **Assignable to**: Backend Developer / Implementer
- **Priority**: High
- **Estimated Time**: 1h
- **Prerequisites**: None
- **Dependencies**: None (他タスクのブロッカー)

**Deliverables:**
- `/home/ubuntu/Downloads/vow/backend/src/types/unified-response.ts`

**Acceptance Criteria:**
- [ ] UnifiedChatResponse 型が定義されている
- [ ] UnifiedButton 型が定義されている
- [ ] UnifiedUserInfo 型が定義されている
- [ ] Habit/Goal/Sticky/Reply の Detail 型が定義されている
- [ ] Zod スキーマが定義されている（バリデーション用）
- [ ] 型がエクスポートされている

---

### TASK-002: Create Frontend Type Definitions ✅

- **Description**: フロントエンド用の統一レスポンス型定義ファイルを作成
- **Assignable to**: Frontend Developer / Implementer
- **Priority**: High
- **Estimated Time**: 1h
- **Prerequisites**: None
- **Dependencies**: None (他タスクのブロッカー)
- **Status**: ✅ COMPLETED (2026-02-05)
- **Implemented by**: implementer

**Deliverables:**
- ✅ `/home/ubuntu/Downloads/vow/frontend/app/dashboard/types/unified-response.ts`
- ✅ `/home/ubuntu/Downloads/vow/frontend/app/dashboard/types/index.ts` (更新)

**Acceptance Criteria:**
- [x] バックエンドと同じ型定義が存在する
- [x] 既存の型ファイルからエクスポートされている
- [x] TypeScript コンパイルエラーがない

**Implementation Notes:**
- 全ての型定義 (UnifiedChatResponse, UnifiedButton, UnifiedUserInfo, 各Detailインターフェース) を実装
- 型ガード関数 (isUnifiedResponse, isHabitDetail, isGoalDetail, isStickyDetail, isReplyDetail) を実装
- ユーティリティ関数 (extractUnifiedResponseFromMarkdown, getTypedDetail) を実装
- index.ts に全ての型と関数をエクスポート追加
- 詳細なJSDocコメントで仕様と使用例を記載

---

### TASK-003: Create Response Transformer Module

- **Description**: ツール出力を統一形式に変換する関数群を作成
- **Assignable to**: Backend Developer / Implementer
- **Priority**: High
- **Estimated Time**: 2h
- **Prerequisites**: TASK-001
- **Dependencies**: coach-tools.ts の既存型

**Deliverables:**
- `/home/ubuntu/Downloads/vow/backend/src/agents/shared-tools/response-transformer.ts`

**Acceptance Criteria:**
- [ ] transformHabitSuggestions() が実装されている
- [ ] transformGoalSuggestions() が実装されている
- [ ] transformCategorySelection() が実装されている
- [ ] transformChoiceButtons() が実装されている
- [ ] transformAdvice() が実装されている
- [ ] transformToUnified() (自動検出) が実装されている
- [ ] 各関数のユニットテストが存在する

---

### TASK-004: Update shared-tools/index.ts Exports

- **Description**: 新規作成したモジュールをエクスポートに追加
- **Assignable to**: Backend Developer / Implementer
- **Priority**: Medium
- **Estimated Time**: 0.5h
- **Prerequisites**: TASK-001, TASK-003

**Deliverables:**
- `/home/ubuntu/Downloads/vow/backend/src/agents/shared-tools/index.ts` (更新)

**Acceptance Criteria:**
- [ ] response-transformer.ts の関数がエクスポートされている
- [ ] unified-response.ts の型がエクスポートされている
- [ ] import パスが正しい

---

## Phase 2: Backend Integration (バックエンド統合)

### TASK-005: Integrate Transformer in suggest_habits

- **Description**: suggest_habits ツールの出力に統一形式を追加
- **Assignable to**: Backend Developer / Implementer
- **Priority**: High
- **Estimated Time**: 1h
- **Prerequisites**: TASK-003

**Files to Modify:**
- `/home/ubuntu/Downloads/vow/backend/src/agents/shared-tools/coach-tools.ts`

**Implementation:**
```typescript
// suggestHabitsExecute の戻り値を拡張
export async function suggestHabitsExecute(
  input: SuggestHabitsInput,
  context: CoachToolContext
): Promise<HabitSuggestionResult & { _unified?: UnifiedChatResponse }> {
  const result = await generateHabitSuggestions(/* ... */);

  // 統一形式を追加
  const unified = transformHabitSuggestions(
    result,
    `${input.category || ''}カテゴリの習慣を${input.count}つ提案します。`,
    input.category
  );

  return {
    ...result,
    _unified: unified,
  };
}
```

**Acceptance Criteria:**
- [ ] suggest_habits の出力に `_unified` フィールドが含まれる
- [ ] 既存の出力形式との後方互換性が維持されている
- [ ] テストで両形式を検証

---

### TASK-006: Integrate Transformer in suggest_goals

- **Description**: suggest_goals ツールの出力に統一形式を追加
- **Assignable to**: Backend Developer / Implementer
- **Priority**: High
- **Estimated Time**: 1h
- **Prerequisites**: TASK-003

**Files to Modify:**
- `/home/ubuntu/Downloads/vow/backend/src/agents/shared-tools/coach-tools.ts`

**Acceptance Criteria:**
- [ ] suggest_goals の出力に `_unified` フィールドが含まれる
- [ ] 既存の出力形式との後方互換性が維持されている

---

### TASK-007: Integrate Transformer in show_category_selection

- **Description**: show_category_selection ツールの出力に統一形式を追加
- **Assignable to**: Backend Developer / Implementer
- **Priority**: High
- **Estimated Time**: 1h
- **Prerequisites**: TASK-003

**Files to Modify:**
- `/home/ubuntu/Downloads/vow/backend/src/agents/shared-tools/coach-tools.ts`

**Acceptance Criteria:**
- [ ] show_category_selection の出力に `_unified` フィールドが含まれる
- [ ] selectionType の情報が userInfo.about_type に正しくマッピング

---

### TASK-008: Integrate Transformer in show_choice_buttons

- **Description**: show_choice_buttons ツールの出力に統一形式を追加
- **Assignable to**: Backend Developer / Implementer
- **Priority**: High
- **Estimated Time**: 1h
- **Prerequisites**: TASK-003

**Files to Modify:**
- `/home/ubuntu/Downloads/vow/backend/src/agents/shared-tools/coach-tools.ts`

**Acceptance Criteria:**
- [ ] show_choice_buttons の出力に `_unified` フィールドが含まれる
- [ ] ボタンタイプ (habit/goal/stickyn/reply) が正しくマッピング

---

### TASK-009: Integrate Transformer in generate_advice

- **Description**: generate_advice ツールの出力に統一形式を追加
- **Assignable to**: Backend Developer / Implementer
- **Priority**: Medium
- **Estimated Time**: 1h
- **Prerequisites**: TASK-003

**Files to Modify:**
- `/home/ubuntu/Downloads/vow/backend/src/agents/shared-tools/coach-tools.ts`

**Acceptance Criteria:**
- [ ] generate_advice の出力に `_unified` フィールドが含まれる
- [ ] followUpActions が buttons に正しくマッピング

---

## Phase 3: Frontend Integration (フロントエンド統合)

### TASK-010: Create Unified Response Parser

- **Description**: 統一形式をパースする関数を作成
- **Assignable to**: Frontend Developer / Implementer
- **Priority**: High
- **Estimated Time**: 2h
- **Prerequisites**: TASK-002

**Files to Modify:**
- `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.MOC.tsx`

**Implementation:**
```typescript
// 新規追加
function parseUnifiedResponse(response: UnifiedChatResponse): ParsedResponse {
  // ... implementation
}

function isUnifiedResponse(obj: unknown): obj is UnifiedChatResponse {
  // ... type guard
}

// 既存の parseSuggestions, parseQuickReplies, parseFollowUpActions を更新
function parseResponse(msg: MastraMessage): ParsedResponse {
  // 1. Try unified format first
  for (const toolCall of msg.toolCalls || []) {
    const output = toolCall.output as Record<string, unknown>;
    if (output?._unified && isUnifiedResponse(output._unified)) {
      return parseUnifiedResponse(output._unified as UnifiedChatResponse);
    }
  }

  // 2. Fallback to legacy
  return {
    suggestions: parseSuggestions(msg),
    quickReplies: parseQuickReplies(msg)?.quickReplies,
    followUpActions: parseFollowUpActions(msg),
    selectionType: parseQuickReplies(msg)?.selectionType,
  };
}
```

**Acceptance Criteria:**
- [ ] parseUnifiedResponse() が実装されている
- [ ] isUnifiedResponse() 型ガードが実装されている
- [ ] 統一形式と旧形式の両方をパース可能
- [ ] 旧形式へのフォールバックが機能する

---

### TASK-011: Update Button Click Handlers

- **Description**: ボタンクリック時の処理を統一形式に対応
- **Assignable to**: Frontend Developer / Implementer
- **Priority**: High
- **Estimated Time**: 1.5h
- **Prerequisites**: TASK-010

**Files to Modify:**
- `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.MOC.tsx`

**Implementation Points:**
- handleSuggestionAction() の更新
- handleQuickReplyClick() の更新
- handleFollowUpActionClick() の更新
- 新規: handleUnifiedButtonClick()

**Acceptance Criteria:**
- [ ] Habit ボタンクリックで HabitModal が開く
- [ ] Goal ボタンクリックで GoalModal が開く
- [ ] Sticky'n(MEMO) ボタンクリックで StickyModal が開く
- [ ] reply ボタンクリックで適切なアクションが実行される
- [ ] detail の内容がモーダルに正しくプリフィル

---

### TASK-012: Update Message Display Component

- **Description**: メッセージ表示部分を統一形式に対応
- **Assignable to**: Frontend Developer / Implementer
- **Priority**: Medium
- **Estimated Time**: 1h
- **Prerequisites**: TASK-010

**Files to Modify:**
- `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.MOC.tsx`

**Implementation Points:**
- useEffect 内のメッセージ変換処理を更新
- GroupChatMessage に userInfo フィールドを追加（オプション）
- ボタン表示ロジックの統一

**Acceptance Criteria:**
- [ ] 統一形式のメッセージが正しく表示される
- [ ] ボタンが正しいスタイルで表示される
- [ ] 既存の表示との整合性が保たれている

---

### TASK-013: Add MCP Response Parsing

- **Description**: MCP経由のレスポンスから統一形式を抽出する処理を追加
- **Assignable to**: Frontend Developer / Implementer
- **Priority**: Medium
- **Estimated Time**: 1h
- **Prerequisites**: TASK-010

**Files to Modify:**
- `/home/ubuntu/Downloads/vow/frontend/app/dashboard/hooks/useMcpChat.ts` または
- `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.MOC.tsx`

**Implementation:**
```typescript
function parseMcpResponse(content: string): UnifiedChatResponse | null {
  // Extract JSON from markdown code block
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (isUnifiedResponse(parsed)) {
        return parsed;
      }
    } catch {
      // Invalid JSON
    }
  }
  return null;
}
```

**Acceptance Criteria:**
- [ ] MCP応答から JSON ブロックを抽出できる
- [ ] 統一形式の検証が行われる
- [ ] パース失敗時はフォールバック処理が動作する

---

## Phase 4: Testing (テスト)

### TASK-014: Backend Unit Tests

- **Description**: バックエンドの変換関数のユニットテストを作成
- **Assignable to**: Tester / Developer
- **Priority**: High
- **Estimated Time**: 1.5h
- **Prerequisites**: TASK-003, TASK-005 ~ TASK-009

**Deliverables:**
- `/home/ubuntu/Downloads/vow/backend/src/agents/shared-tools/__tests__/response-transformer.test.ts`

**Test Cases:**
- [ ] transformHabitSuggestions - 基本変換
- [ ] transformHabitSuggestions - followUpActions あり
- [ ] transformGoalSuggestions - 基本変換
- [ ] transformCategorySelection - habit_category
- [ ] transformCategorySelection - goal_category
- [ ] transformChoiceButtons - 各ボタンタイプ
- [ ] transformAdvice - 基本変換
- [ ] transformToUnified - 自動検出

---

### TASK-015: Frontend Unit Tests

- **Description**: フロントエンドのパーサー関数のユニットテストを作成
- **Assignable to**: Tester / Developer
- **Priority**: High
- **Estimated Time**: 1h
- **Prerequisites**: TASK-010, TASK-011

**Deliverables:**
- `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/__tests__/unified-parser.test.ts`

**Test Cases:**
- [ ] parseUnifiedResponse - Habit ボタン
- [ ] parseUnifiedResponse - Goal ボタン
- [ ] parseUnifiedResponse - Sticky'n(MEMO) ボタン
- [ ] parseUnifiedResponse - reply ボタン (category)
- [ ] parseUnifiedResponse - reply ボタン (followUp)
- [ ] isUnifiedResponse - 型ガード
- [ ] 旧形式へのフォールバック

---

### TASK-016: E2E Integration Test

- **Description**: エンドツーエンドの統合テストを作成
- **Assignable to**: Tester
- **Priority**: Medium
- **Estimated Time**: 1h
- **Prerequisites**: Phase 2, Phase 3 完了

**Test Scenarios:**
- [ ] 「健康の習慣を提案して」→ カテゴリ選択 → 提案表示 → ボタンクリック → モーダル表示
- [ ] 「目標を設定したい」→ カテゴリ選択 → 提案表示 → ボタンクリック → モーダル表示
- [ ] 「もっと簡単に」→ フォローアップアクション → 新しい提案

---

## Phase 5: Cleanup (クリーンアップ)

### TASK-017: Remove Legacy Code (Optional)

- **Description**: 旧形式のパーサーコードを削除（統一形式が安定したら）
- **Assignable to**: Backend/Frontend Developer
- **Priority**: Low
- **Estimated Time**: 1h
- **Prerequisites**: Phase 4 完了, 本番環境での検証完了

**Files to Modify:**
- Section.MOC.tsx から旧 parseSuggestions, parseQuickReplies 等を削除
- フィーチャーフラグの削除

**Note:** 本タスクは統一形式が十分に検証されるまで実行しない

---

### TASK-018: Documentation Update

- **Description**: 開発者向けドキュメントの更新
- **Assignable to**: Any Developer
- **Priority**: Medium
- **Estimated Time**: 1h
- **Prerequisites**: Phase 3 完了

**Deliverables:**
- この仕様書の Status を "Implemented" に更新
- COORDINATION.md の更新
- 必要に応じて README の更新

---

## Task Dependencies Graph

```
TASK-001 ─┬─→ TASK-003 ─┬─→ TASK-005
          │             ├─→ TASK-006
          │             ├─→ TASK-007
          │             ├─→ TASK-008
          │             └─→ TASK-009
          │
          └─→ TASK-004
                    │
                    └─→ TASK-014

TASK-002 ─→ TASK-010 ─┬─→ TASK-011
                      ├─→ TASK-012
                      ├─→ TASK-013
                      └─→ TASK-015

TASK-005 ~ TASK-009 ┬─→ TASK-014
                    └─→ TASK-016

TASK-010 ~ TASK-013 ┬─→ TASK-015
                    └─→ TASK-016

TASK-014 ~ TASK-016 ─→ TASK-017 ─→ TASK-018
```

## Agent Assignment Recommendations

| Task | Recommended Agent | Reason |
|------|-------------------|--------|
| TASK-001, 002 | Implementer | 型定義は明確な仕様に基づく実装 |
| TASK-003 | Implementer | 変換ロジックの実装 |
| TASK-004 | Implementer | 軽微な変更 |
| TASK-005 ~ 009 | Implementer | 既存コードへの統合 |
| TASK-010 ~ 013 | Implementer | フロントエンド統合 |
| TASK-014, 015 | Tester | ユニットテスト作成 |
| TASK-016 | Tester | E2Eテスト |
| TASK-017, 018 | Any | クリーンアップ・ドキュメント |

## Parallel Execution Opportunities

以下のタスクは並列実行可能:

1. **Parallel Group A** (準備):
   - TASK-001 (Backend Types) + TASK-002 (Frontend Types)

2. **Parallel Group B** (バックエンド統合):
   - TASK-005, 006, 007, 008, 009 (各ツール統合) - TASK-003 完了後

3. **Parallel Group C** (フロントエンド統合):
   - TASK-011, 012, 013 - TASK-010 完了後

4. **Parallel Group D** (テスト):
   - TASK-014 (Backend Tests) + TASK-015 (Frontend Tests)
