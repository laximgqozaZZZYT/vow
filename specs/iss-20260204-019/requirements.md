# ISS-20260204-019: Goal Planner Existing Goals Reference

## Overview
- **Purpose**: Goal Plannerエージェントが既存のGoalを参照せずに新しい目標を提案しているバグを修正する
- **Status**: In Progress
- **Version**: 1.0.0
- **Last Updated**: 2026-02-04
- **Author**: vow-spec-architect
- **Issue ID**: ISS-20260204-019
- **Priority**: Critical
- **Category**: Bug Fix

## Problem Statement

ユーザーが既に登録している目標（Goal）を考慮せずに新しい目標が提案されている。
これにより以下の問題が発生:
1. 既存Goal重複した提案がされる
2. ユーザーの現状に合わない提案がされる
3. パーソナライズされた体験が提供できていない

### 会話例（Issueより）
```
User: 🎯 ゴール達成状況
AI: まだゴールが設定されていない習慣があるようです。
    → 実際には既存Goalが存在するにも関わらず、参照されていない
```

## Root Cause Analysis

### 原因1: goal-planner-agent.ts のsuggestGoalsTool
**場所**: `/backend/src/agents/mastra/agents/goal-planner-agent.ts` (行135-188)

```typescript
const suggestGoalsTool = createTool({
  id: 'suggest_goals',
  // ...
  execute: async (inputData) => {
    // ハードコードされた提案のみを返す
    // 既存GoalをDBから取得していない
    const suggestions = [
      { name: '毎日30分の運動習慣', ... },
      { name: '月4冊の読書', ... },
      { name: '緊急資金の構築', ... },
    ];
    return { suggestions: suggestions.filter(...) };
  },
});
```

### 原因2: CoachExecutionContext に userContext が設定されていない
**場所**: `/backend/src/routers/agents.ts` (行276-281, 1361-1366)

```typescript
const executionContext: CoachExecutionContext = {
  userId,
  sessionId: body.sessionId ?? `session_${userId}_${Date.now()}`,
  supabase,
  locale: body.locale,
  // userContext が設定されていない！
};
```

`userContext`が未設定のため、`coach-tools.ts`の`generateGoalSuggestionsWithAI`で:
```typescript
const existingGoals = userContext?.existingGoalNames ?? []; // 常に空配列
```

## Requirements

### Functional Requirements

- [FR-001] Goal Planner Agent の `suggestGoalsTool` は、提案前にDBから既存Goalを取得すること
- [FR-002] 既存Goalと重複する提案を除外すること
- [FR-003] `CoachExecutionContext` 作成時に `userContext` を設定すること
- [FR-004] `userContext` には `existingGoalNames` と `existingHabitNames` を含めること

### Non-Functional Requirements

- [NFR-001] 既存Goal取得のDB呼び出しはエージェント初期化時に1回のみとし、パフォーマンスを維持
- [NFR-002] エラー時は空配列として扱い、サービス中断を防ぐ

## Technical Design

### Solution 1: goal-planner-agent.ts の修正

`suggestGoalsTool` を以下のように修正:
1. `execute`関数でSupabaseクライアントを取得
2. `goals`テーブルから既存Goalを取得
3. 取得したGoal名と類似する提案を除外

```typescript
execute: async (inputData, { container }) => {
  const supabase = container?.get('supabase');

  // 既存Goalを取得
  const { data: existingGoals } = await supabase
    .from('goals')
    .select('id, name')
    .eq('owner_id', inputData.userId)
    .eq('status', 'active');

  const existingGoalNames = (existingGoals || []).map(g => g.name.toLowerCase());

  // 既存と重複しない提案のみ返す
  const filteredSuggestions = suggestions.filter(s =>
    !existingGoalNames.some(existing =>
      existing.includes(s.name.toLowerCase()) ||
      s.name.toLowerCase().includes(existing)
    )
  );

  return { suggestions: filteredSuggestions };
};
```

### Solution 2: agents.ts の修正

`CoachExecutionContext` 作成時に `PersonalizationEngine` を使用:

```typescript
import { PersonalizationEngine } from '../services/personalizationEngine.js';

// APIハンドラー内
const personalizationEngine = new PersonalizationEngine(supabase);
const userContext = await personalizationEngine.analyzeUserContext(userId);

const executionContext: CoachExecutionContext = {
  userId,
  sessionId,
  supabase,
  locale,
  userContext, // 追加
};
```

## Implementation Tasks

- [x] Task 1: goal-planner-agent.ts の `suggestGoalsTool` を修正し、既存Goal取得ロジックを追加
- [x] Task 2: agents.ts の `/chat` エンドポイントで `userContext` を設定
- [x] Task 3: agents.ts の `/coach/legacy` エンドポイントで `userContext` を設定
- [ ] Task 4: 動作テスト（既存Goalがある状態で目標提案をリクエスト）

## Acceptance Criteria

- [AC-001] 既存Goalがある場合、重複するGoal提案がされないこと
- [AC-002] `suggest_goals` ツール実行時にDBから既存Goalが取得されること
- [AC-003] 既存GoalがAIプロンプトに正しく渡されること
- [AC-004] エラー発生時もサービスが中断せず、フォールバック動作すること

## Agent Coordination Notes

このIssueは以下のファイルを修正します:
- `/backend/src/agents/mastra/agents/goal-planner-agent.ts`
- `/backend/src/routers/agents.ts`
- `/backend/src/agents/shared-tools/coach-tools.ts` (変更不要、userContext経由で解決)

他のエージェントが同時に上記ファイルを編集する場合は調整が必要です。

## References

- Issue: ISS-20260204-019
- Related files:
  - `/backend/src/services/personalizationEngine.ts` (既存のuserContext生成ロジック)
  - `/backend/src/types/personalization.ts` (UserContext型定義)
