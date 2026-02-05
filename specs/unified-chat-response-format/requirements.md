# Unified Chat Response Format Specification

## Overview

- **Purpose**: MOCチャット機能において、AIエージェント（OpenAI Mastra / MCP Claude）の出力形式を統一し、フロントエンドでの一貫したUI表示を実現する
- **Status**: Draft
- **Version**: 1.0.0
- **Last Updated**: 2025-02-05
- **Author**: vow-spec-architect

## Background

### Current State (現状)

現在、MOCセクションのAIエージェント応答は以下の複数の形式が混在:

1. **Tool Call Results** (ツール呼び出し結果)
   - `suggest_goals` / `suggest_habits` → `GoalSuggestionResult` / `HabitSuggestionResult`
   - `show_category_selection` → `CategorySelectionResult`
   - `show_choice_buttons` → `ChoiceButtonsResult`
   - `generate_advice` → `AdviceResult`
   - etc.

2. **Message Properties** (メッセージプロパティ)
   - `suggestions[]` - 提案の配列
   - `quickReplies[]` - クイック返信ボタン
   - `followUpActions[]` - フォローアップアクション
   - `selectionType` - 選択タイプ

3. **Parser Functions** (フロントエンドパーサー)
   - `parseSuggestions()` - toolCallsから提案を抽出
   - `parseQuickReplies()` - toolCallsからクイック返信を抽出
   - `parseFollowUpActions()` - toolCallsからフォローアップを抽出

### Problems (課題)

1. **形式の不統一**: ツールごとに異なる出力形式
2. **パース処理の複雑化**: フロントエンドで多数のパーサー関数が必要
3. **MCP/Mastra間の差異**: 異なるAIプロバイダーで出力が異なる可能性
4. **ボタンタイプの混乱**: `suggestionType`, `type`, `buttonType` など複数の命名

## Requirements

### Functional Requirements

#### FR-001: Unified JSON Response Format

すべてのAIエージェント応答は以下の統一JSON形式に準拠すること:

```json
{
  "message": "候補ラベル以外の文章はここに入ります。",
  "userInfo": {
    "about_type": null | "Habit" | "Goal" | "Sticky'n(MEMO)" | "others",
    "about_operation": null | "見直し" | "新規提案" | "確認" | "アドバイス" | "others",
    "about_category": ["category1", "category2"]
  },
  "buttons": [
    {
      "type": "Habit" | "Goal" | "Sticky'n(MEMO)" | "reply",
      "label": "ここに候補ラベルが入ります。",
      "comment": "説明として表示される文章があればここに入ります。",
      "detail": {
        "type": "Habit" | "Goal" | "Sticky'n(MEMO)",
        // Timings, deadline等の詳細情報
      }
    }
  ]
}
```

#### FR-002: Field Definitions (フィールド定義)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | string | Yes | AI応答の本文テキスト |
| `userInfo` | object | Yes | 会話コンテキストメタデータ |
| `userInfo.about_type` | enum/null | Yes | 対象エンティティタイプ |
| `userInfo.about_operation` | enum/null | Yes | ユーザーの意図する操作 |
| `userInfo.about_category` | string[] | Yes | 関連カテゴリ (空配列可) |
| `buttons` | array | Yes | アクションボタン配列 (空配列可) |

#### FR-003: Button Object Definition

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | enum | Yes | ボタンタイプ: `"Habit"`, `"Goal"`, `"Sticky'n(MEMO)"`, `"reply"` |
| `label` | string | Yes | ボタンラベル (ユーザーに表示) |
| `comment` | string | No | 補足説明 |
| `detail` | object | No | エンティティ詳細情報 |

#### FR-004: Detail Object Definitions

**重要**: detailフィールドは実際のDBスキーマ(Supabase)およびフロントエンドの型定義に合わせること。

**参照先:**
- Habit: `frontend/app/dashboard/types/index.ts` (Habit interface)
- Goal: `frontend/app/dashboard/types/index.ts` (Goal interface)
- Sticky'n: `frontend/app/dashboard/types/index.ts` (Sticky interface)

**Habit Detail:**
```typescript
// @see Habit interface in frontend/app/dashboard/types/index.ts
interface HabitDetail {
  type: "Habit";
  name: string;                       // 習慣名 (必須)
  // === DB Schema Fields ===
  habitType?: "do" | "avoid";         // Habit.type ("do"=実行, "avoid"=回避)
  must?: number;                      // 目標回数 (Habit.must)
  duration?: number;                  // 所要時間（分）
  repeat?: string;                    // 繰り返し設定 (daily/weekly/monthly等)
  time?: string;                      // 開始時刻 (HH:MM)
  endTime?: string;                   // 終了時刻 (HH:MM)
  dueDate?: string;                   // 期限 (YYYY-MM-DD)
  allDay?: boolean;                   // 終日フラグ
  notes?: string;                     // メモ/ノート
  workloadUnit?: string;              // 負荷の単位 (分/回/ページ等)
  workloadTotal?: number;             // 負荷の総量
  workloadPerCount?: number;          // 1回あたりの負荷
  timings?: Timing[];                 // スケジュール情報 (Timing型)
  // === Suggestion-specific Fields (AI提案用) ===
  frequency?: string;                 // 頻度の説明 ("毎日", "週3回"等)
  reason?: string;                    // 推奨理由
  category?: string;                  // カテゴリ
  difficulty?: "easy" | "medium" | "hard";
  triggerTime?: string;               // トリガー時刻の説明
  anchorHabit?: string;               // アンカーとなる習慣
}
```

**Goal Detail:**
```typescript
// @see Goal interface in frontend/app/dashboard/types/index.ts
interface GoalDetail {
  type: "Goal";
  name: string;                       // 目標名 (必須)
  // === DB Schema Fields ===
  details?: string;                   // 詳細説明 (NOTE: "description"ではない)
  dueDate?: string;                   // 期限 (NOTE: "deadline"ではない)
  parentId?: string | null;           // 親ゴールID
  isCompleted?: boolean;              // 完了フラグ
  // === Suggestion-specific Fields (AI提案用) ===
  category?: string;                  // カテゴリ
  difficulty?: "easy" | "medium" | "hard";
  suggestedHabits?: string[];         // 推奨される習慣
  rationale?: string;                 // 目標設定の根拠
  milestones?: Array<{                // マイルストーン
    name: string;
    description?: string;
    targetDate?: string;
  }>;
}
```

**Sticky'n Detail:**
```typescript
// @see Sticky interface in frontend/app/dashboard/types/index.ts
interface StickyNDetail {
  type: "Sticky'n(MEMO)";
  name: string;                       // メモ名 (必須)
  // === DB Schema Fields ===
  description?: string | null;        // 説明文
  completed?: boolean;                // 完了状態
  displayOrder?: number;              // 表示順序 (NOTE: camelCase)
  parentStickyId?: string | null;     // 親Sticky'nのID
  depth?: number;                     // ネストの深さ (0-2)
  isReusable?: boolean;               // 使いまわし設定
}
```

#### FR-005: Reply Button for Navigation

`type: "reply"` のボタンは以下の用途:

- カテゴリ選択 (健康、学習、etc.)
- 難易度選択 (初心者、中級者、上級者)
- フォローアップアクション (もっと具体的に、他の提案、etc.)
- 一般的な返信オプション

```json
{
  "type": "reply",
  "label": "健康・運動",
  "comment": "運動、睡眠、食事など健康に関する習慣",
  "detail": {
    "action": "select_category",
    "category": "health",
    "icon": "💪"
  }
}
```

#### FR-006: UserInfo Context Tracking

`userInfo` オブジェクトは会話コンテキストを追跡:

| about_type | Description |
|------------|-------------|
| `null` | 対象未定 |
| `"Habit"` | 習慣に関する会話 |
| `"Goal"` | 目標に関する会話 |
| `"Sticky'n(MEMO)"` | メモに関する会話 |
| `"others"` | その他 |

| about_operation | Description |
|-----------------|-------------|
| `null` | 操作未定 |
| `"見直し"` | 既存データのレビュー/改善 |
| `"新規提案"` | 新しい提案の要求 |
| `"確認"` | 情報確認/進捗チェック |
| `"アドバイス"` | 一般的なアドバイス |
| `"others"` | その他 |

### Non-Functional Requirements

#### NFR-001: Backward Compatibility

- 既存のツール出力形式からの段階的移行をサポート
- フロントエンドで両形式をパース可能にする移行期間を設ける

#### NFR-002: Validation

- Zod スキーマによるランタイム検証を実装
- 不正な形式は明確なエラーメッセージを出力

#### NFR-003: Performance

- JSON形式の追加によるレスポンスサイズ増加は最小限に抑える
- パース処理は 10ms 以内に完了

## Current vs New Format Mapping

### show_category_selection → Unified Format

**現状:**
```json
{
  "message": "どのカテゴリーの習慣を追加しますか？",
  "selectionType": "habit_category",
  "quickReplies": [
    { "id": "health", "label": "健康・運動", "value": "health", "icon": "💪" }
  ]
}
```

**新形式:**
```json
{
  "message": "どのカテゴリーの習慣を追加しますか？",
  "userInfo": {
    "about_type": "Habit",
    "about_operation": "新規提案",
    "about_category": []
  },
  "buttons": [
    {
      "type": "reply",
      "label": "健康・運動",
      "comment": null,
      "detail": { "action": "select_category", "category": "health", "icon": "💪" }
    }
  ]
}
```

### suggest_habits → Unified Format

**現状:**
```json
{
  "suggestions": [
    {
      "name": "朝の5分ストレッチ",
      "description": "体を目覚めさせる簡単なストレッチ",
      "category": "health",
      "difficulty": "beginner",
      "frequency": "daily",
      "estimatedTime": "5分",
      "rationale": "初心者向け...",
      "suggestionType": "habit"
    }
  ],
  "followUpActions": [
    { "id": "easier", "label": "もっと簡単に", "action": "easier", "category": "health" }
  ]
}
```

**新形式:**
```json
{
  "message": "健康カテゴリの習慣を3つ提案します。",
  "userInfo": {
    "about_type": "Habit",
    "about_operation": "新規提案",
    "about_category": ["health"]
  },
  "buttons": [
    {
      "type": "Habit",
      "label": "朝の5分ストレッチ",
      "comment": "体を目覚めさせる簡単なストレッチ",
      "detail": {
        "type": "Habit",
        "name": "朝の5分ストレッチ",
        "habitType": "daily",
        "description": "体を目覚めさせる簡単なストレッチ",
        "category": "health",
        "difficulty": "beginner",
        "timings": [{ "time": "07:00" }],
        "workloadUnit": "分",
        "loadPerCount": 5
      }
    },
    {
      "type": "reply",
      "label": "もっと簡単に",
      "comment": null,
      "detail": { "action": "easier", "category": "health" }
    }
  ]
}
```

### suggest_goals → Unified Format

**現状:**
```json
{
  "suggestions": [
    {
      "name": "毎日ウォーキング",
      "description": "健康維持のための軽い運動習慣",
      "category": "health",
      "difficulty": "beginner",
      "suggestedHabits": ["朝食後10分歩く"],
      "rationale": "初心者向け...",
      "estimatedDuration": "1-2ヶ月",
      "suggestionType": "goal"
    }
  ],
  "followUpActions": [...]
}
```

**新形式:**
```json
{
  "message": "健康目標を3つ提案します。",
  "userInfo": {
    "about_type": "Goal",
    "about_operation": "新規提案",
    "about_category": ["health"]
  },
  "buttons": [
    {
      "type": "Goal",
      "label": "毎日ウォーキング",
      "comment": "健康維持のための軽い運動習慣",
      "detail": {
        "type": "Goal",
        "name": "毎日ウォーキング",
        "details": "健康維持のための軽い運動習慣",
        "category": "health",
        "difficulty": "beginner",
        "estimatedDuration": "1-2ヶ月",
        "suggestedHabits": ["朝食後10分歩く"]
      }
    },
    {
      "type": "reply",
      "label": "もっと具体的に",
      "detail": { "action": "more_specific", "category": "health" }
    }
  ]
}
```

### show_choice_buttons → Unified Format

**現状:**
```json
{
  "type": "ui_component",
  "component": "choice_buttons",
  "data": {
    "title": "どんな運動に興味がありますか？",
    "choices": [
      { "id": "walking", "label": "散歩", "type": "reply", "icon": "🚶" }
    ],
    "layout": "horizontal",
    "size": "md"
  }
}
```

**新形式:**
```json
{
  "message": "どんな運動に興味がありますか？",
  "userInfo": {
    "about_type": "Habit",
    "about_operation": "新規提案",
    "about_category": ["health", "fitness"]
  },
  "buttons": [
    {
      "type": "reply",
      "label": "散歩",
      "comment": null,
      "detail": { "action": "select_choice", "choiceId": "walking", "icon": "🚶" }
    }
  ]
}
```

## Acceptance Criteria

- [AC-001] バックエンドの全ツール出力が統一形式に変換可能
- [AC-002] フロントエンドで統一形式を正しくパース・表示可能
- [AC-003] 既存のtoolCall形式との後方互換性を維持
- [AC-004] OpenAI Mastra と MCP Claude の両方で同じ出力形式
- [AC-005] ボタンクリック時に適切なモーダル（HabitModal/GoalModal/StickyModal）が開く
- [AC-006] userInfo が正しくトラッキングされ、会話コンテキストが維持される

## Agent Coordination Notes

- バックエンド修正とフロントエンド修正は並列作業可能
- 共通の型定義ファイル（`types/unified-response.ts`）を先に作成
- 移行期間中は両形式をサポートするアダプター層を設ける
