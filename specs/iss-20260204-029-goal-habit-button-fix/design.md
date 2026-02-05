# Goal/Habit型候補ボタン表示不具合修正 - 設計書

## Overview
- **Issue ID**: ISS-20260204-029
- **Status**: In Progress
- **Version**: 1.0.0
- **Created**: 2026-02-04
- **Author**: vow-spec-architect

---

## Root Cause Analysis

### 調査結果

1. **バックエンド (coach-tools.ts)**: suggestionTypeは正しく設定されている
   - `suggestGoalsExecute`: `suggestionType: 'goal' as const` を設定
   - `suggestHabitsExecute`: `suggestionType: 'habit' as const` を設定
   - AI生成時も同様に正しく設定

2. **フロントエンド (Section.MOC.tsx)**: parseSuggestionsロジックに問題の可能性
   - Line 2256-2258: ツール出力からsuggestionTypeを抽出
   - Line 2414-2416: テキストフォールバック時のsuggestionType処理

### 根本原因の特定

問題は以下の箇所にある可能性が高い:

1. **parseSuggestionsFromText関数 (Line 2414-2448)**
   - テキストからJSONをパースする際、`suggestionType`のデフォルト判定ロジックが不十分
   - `s.suggestionType === 'goal'`のチェックのみで、他のケースは`'habit'`にフォールバック

2. **toolCallのoutput処理 (Line 2256-2268)**
   - ツール出力のsuggestionTypeは正しく取得されているが、isGoalの判定がツール名ベースで行われている
   - suggest_goalsが呼び出されても、出力のsuggestionTypeが上書きされる可能性

---

## Technical Design

### 修正箇所1: parseSuggestions関数の改善

```typescript
// Line 2256-2268 の修正
// suggestionTypeを優先的に使用し、フォールバックロジックを改善
const suggestionType = (suggestion.suggestionType as SuggestionButtonType)
  || (isGoal ? 'goal' : 'habit');
```

現在の実装は正しいように見えるが、`isGoal`の判定がツール名ベースになっているため、
実際のsuggestion.suggestionTypeが存在する場合はそちらを優先すべき。

### 修正箇所2: parseSuggestionsFromText関数の改善

```typescript
// Line 2414-2416, 2446-2448 の修正
// suggestionTypeの判定ロジックを改善
type: (s.suggestionType === 'goal' ? 'goal' : 'habit') as 'habit' | 'goal',
suggestionType: (s.suggestionType as SuggestionButtonType)
  || (s.type === 'goal' ? 'goal' : 'habit'),
```

問題: `s.suggestionType`が存在しない場合、常に`'habit'`になる
修正: `s.type`も考慮したフォールバック

### 修正箇所3: suggestion.suggestionTypeの確実な伝達

バックエンドからのレスポンスでsuggestionTypeが含まれていることを確認し、
フロントエンドでそれを正しく利用する。

---

## Data Flow

```
Backend (coach-tools.ts)
  ├── suggestGoalsExecute()
  │     └── suggestions[].suggestionType = 'goal'
  └── suggestHabitsExecute()
        └── suggestions[].suggestionType = 'habit'
           │
           ▼
Frontend (Section.MOC.tsx)
  ├── parseSuggestions() - toolCalls処理
  │     └── suggestion.suggestionType を抽出 (優先)
  │     └── isGoal判定によるフォールバック
  │           │
  └── parseSuggestionsFromText() - テキスト処理
        └── s.suggestionType を抽出 (優先)
        └── s.type によるフォールバック
              │
              ▼
SuggestionCard Component
  └── suggestionType に基づいてバッジ色を決定
```

---

## Verification Strategy

1. コンソールログで各段階のsuggestionType値を確認
2. suggest_goals呼び出し時のtoolCall.outputをログ出力
3. parseSuggestions結果のsuggestionTypeをログ出力
4. SuggestionCardに渡されるsuggestionTypeを確認
