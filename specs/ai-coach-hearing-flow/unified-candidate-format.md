# AI Coach Unified Candidate Format Specification

## Overview

- **Purpose**: AIコーチの候補表示機能のための統一JSONフォーマットを定義
- **Status**: Draft
- **Version**: 1.0.0
- **Last Updated**: 2026-02-06

### 設計原則

1. **必須の候補表示**: AIは必ずいずれかの候補表示タイプを使用
2. **統一共通部**: すべてのレスポンスは同じ共通構造を持つ
3. **組み合わせ可能**: 複数の候補タイプを同時に表示可能
4. **固定UserReply**: エンティティ候補表示時は必ず調整オプションを提示

---

## JSON Format Specification

### 1. 完全レスポンス構造

```typescript
/**
 * AIコーチ統一レスポンスフォーマット v2
 * すべての応答はこの形式に準拠する
 */
interface AICandidateResponse {
  // ========================================
  // 共通部 (Common Part)
  // ========================================

  /** AI応答メッセージ（候補以外の文章部分） */
  message: string;

  /** 会話コンテキスト */
  context: {
    /** 対象エンティティタイプ */
    aboutType: 'Habit' | 'Goal' | "Sticky'n" | 'others' | null;
    /** 意図された操作 */
    aboutOperation: '見直し' | '新規提案' | '確認' | 'アドバイス' | 'others' | null;
    /** 関連カテゴリ */
    categories: string[];
  };

  /** 収集済みユーザー要件（ヒアリング進捗） */
  gatheredRequirements: {
    /** 明示的に収集した情報 */
    explicit: Record<string, unknown>;
    /** 推論した情報 */
    inferred: Record<string, unknown>;
    /** 収集完了率 (0.0 - 1.0) */
    completeness: number;
  };

  /** 表示する候補タイプのフラグ */
  candidateTypes: {
    showGoals: boolean;
    showHabits: boolean;
    showStickies: boolean;
    showReplies: boolean;  // true の場合、必ず表示
  };

  // ========================================
  // 候補部 (Candidates Part)
  // ========================================

  /** Goal候補リスト */
  goals?: GoalCandidate[];

  /** Habit候補リスト */
  habits?: HabitCandidate[];

  /** Sticky'n候補リスト */
  stickies?: StickyCandidate[];

  /** UserReply候補リスト（常に含む） */
  replies: ReplyCandidate[];
}
```

### 2. 共通候補構造

```typescript
/**
 * 候補共通ベースインターフェース
 */
interface CandidateBase {
  /** 表示ラベル（ボタンに表示） */
  label: string;
  /** 補足コメント（オプション） */
  comment?: string;
  /** 既存エンティティへの参照（見直し時） */
  existingId?: string;
  /** 信頼度 (0.0 - 1.0) */
  confidence?: number;
}
```

### 3. Goal候補フォーマット

```typescript
/**
 * Goal候補
 * - label: "TOEIC 800点を取得する" など目標名
 * - detail: GoalModal入力フィールドに対応
 */
interface GoalCandidate extends CandidateBase {
  type: 'Goal';
  detail: {
    // === 必須 ===
    name: string;

    // === 任意（AI提案時に入力） ===
    details?: string;           // 詳細説明
    dueDate?: string;           // 期限 (YYYY-MM-DD)
    parentId?: string | null;   // 親Goal ID

    // === AI提案専用 ===
    category?: string;          // カテゴリ
    difficulty?: 'easy' | 'medium' | 'hard';
    rationale?: string;         // 提案根拠
    suggestedHabits?: string[]; // 紐づけ推奨Habit名
    milestones?: Array<{
      name: string;
      description?: string;
      targetDate?: string;
    }>;
  };
}
```

### 4. Habit候補フォーマット

```typescript
/**
 * Habit候補
 * - label: "毎朝10分のストレッチ" など習慣名
 * - detail: HabitModal入力フィールドに対応
 */
interface HabitCandidate extends CandidateBase {
  type: 'Habit';
  detail: {
    // === 必須 ===
    name: string;

    // === 基本設定 ===
    habitType?: 'do' | 'avoid';    // 習慣タイプ
    must?: number;                  // 目標回数
    duration?: number;              // 所要時間（分）
    repeat?: string;                // 繰り返し (daily, weekly, etc.)

    // === タイミング ===
    time?: string;                  // 開始時刻 (HH:MM)
    endTime?: string;               // 終了時刻 (HH:MM)
    dueDate?: string;               // 期限 (YYYY-MM-DD)
    allDay?: boolean;               // 終日フラグ

    // === 負荷設定 ===
    workloadUnit?: string;          // 単位 ("分", "回", "ページ")
    workloadTotal?: number;         // 総量
    workloadPerCount?: number;      // 1回あたり

    // === AI提案専用 ===
    category?: string;
    difficulty?: 'easy' | 'medium' | 'hard';
    frequency?: string;             // 頻度の説明
    reason?: string;                // 推奨理由
    triggerTime?: string;           // トリガー時刻説明
    anchorHabit?: string;           // アンカー習慣

    // === 関連付け ===
    goalId?: string;                // 紐づけGoal ID
    notes?: string;                 // メモ
  };
}
```

### 5. Sticky'n候補フォーマット

```typescript
/**
 * Sticky'n (MEMO) 候補
 * - label: "買い物リスト" などメモ名
 * - detail: StickyModal入力フィールドに対応
 */
interface StickyCandidate extends CandidateBase {
  type: "Sticky'n";
  detail: {
    // === 必須 ===
    name: string;

    // === 任意 ===
    description?: string | null;    // 説明文
    completed?: boolean;            // 完了状態
    displayOrder?: number;          // 表示順
    parentStickyId?: string | null; // 親Sticky ID
    depth?: number;                 // ネスト深さ (0-2)
    isReusable?: boolean;           // 使いまわしフラグ
  };
}
```

### 6. UserReply候補フォーマット

```typescript
/**
 * UserReply候補
 * - label: ユーザーが選択できる返答オプション
 * - エンティティ候補表示時は必ず調整オプションを含む
 */
interface ReplyCandidate extends CandidateBase {
  type: 'reply';
  detail: {
    /** アクション識別子 */
    action:
      | 'adjust_harder'      // もっと難しく
      | 'adjust_easier'      // もっとやさしく
      | 'more_specific'      // もっと具体的に
      | 'show_alternatives'  // 他には
      | 'confirm'            // これでOK
      | 'cancel'             // やめる
      | 'custom';            // カスタム

    /** カテゴリ指定（特定のカテゴリを選択時） */
    category?: string;

    /** アイコン */
    icon?: string;

    /** 追加データ（拡張用） */
    [key: string]: unknown;
  };
}
```

---

## 固定UserReplyオプション

エンティティ候補（Goal/Habit/Sticky'n）を表示する際、以下のUserReply候補を**必ず**含める:

```typescript
const FIXED_ADJUSTMENT_REPLIES: ReplyCandidate[] = [
  {
    type: 'reply',
    label: 'もっと難しく',
    comment: '目標をより挑戦的に',
    detail: { action: 'adjust_harder', icon: '💪' }
  },
  {
    type: 'reply',
    label: 'もっとやさしく',
    comment: '負担を軽減',
    detail: { action: 'adjust_easier', icon: '🌱' }
  },
  {
    type: 'reply',
    label: 'もっと具体的に',
    comment: '詳細を追加',
    detail: { action: 'more_specific', icon: '🎯' }
  },
  {
    type: 'reply',
    label: '他には',
    comment: '別の候補を表示',
    detail: { action: 'show_alternatives', icon: '🔄' }
  }
];
```

---

## デバッグモード

**トリガー**: ユーザーが「候補表示テスト」と入力

**レスポンス**: すべての候補タイプを同時に表示

```json
{
  "message": "デバッグモード: すべての候補タイプを表示します。",
  "context": {
    "aboutType": "others",
    "aboutOperation": "確認",
    "categories": ["debug", "test"]
  },
  "gatheredRequirements": {
    "explicit": { "debugMode": true },
    "inferred": {},
    "completeness": 1.0
  },
  "candidateTypes": {
    "showGoals": true,
    "showHabits": true,
    "showStickies": true,
    "showReplies": true
  },
  "goals": [
    {
      "type": "Goal",
      "label": "テスト目標: 健康的な生活を送る",
      "comment": "デバッグ用サンプル",
      "confidence": 0.9,
      "detail": {
        "name": "健康的な生活を送る",
        "details": "運動と食事改善で健康を維持",
        "dueDate": "2026-06-30",
        "category": "健康",
        "difficulty": "medium",
        "rationale": "デバッグ表示テスト用",
        "suggestedHabits": ["毎朝のストレッチ", "野菜を多く食べる"]
      }
    }
  ],
  "habits": [
    {
      "type": "Habit",
      "label": "テスト習慣: 毎朝10分ストレッチ",
      "comment": "デバッグ用サンプル",
      "confidence": 0.85,
      "detail": {
        "name": "毎朝10分ストレッチ",
        "habitType": "do",
        "must": 1,
        "duration": 10,
        "repeat": "daily",
        "time": "07:00",
        "category": "運動",
        "difficulty": "easy",
        "frequency": "毎日",
        "reason": "柔軟性向上と目覚めの改善"
      }
    }
  ],
  "stickies": [
    {
      "type": "Sticky'n",
      "label": "テストメモ: 買い物リスト",
      "comment": "デバッグ用サンプル",
      "detail": {
        "name": "買い物リスト",
        "description": "野菜、果物、プロテイン",
        "completed": false,
        "isReusable": true
      }
    }
  ],
  "replies": [
    {
      "type": "reply",
      "label": "もっと難しく",
      "comment": "目標をより挑戦的に",
      "detail": { "action": "adjust_harder", "icon": "💪" }
    },
    {
      "type": "reply",
      "label": "もっとやさしく",
      "comment": "負担を軽減",
      "detail": { "action": "adjust_easier", "icon": "🌱" }
    },
    {
      "type": "reply",
      "label": "もっと具体的に",
      "comment": "詳細を追加",
      "detail": { "action": "more_specific", "icon": "🎯" }
    },
    {
      "type": "reply",
      "label": "他には",
      "comment": "別の候補を表示",
      "detail": { "action": "show_alternatives", "icon": "🔄" }
    }
  ]
}
```

---

## 組み合わせパターン例

### パターン1: Habit候補 + UserReply（最も一般的）

```json
{
  "message": "運動習慣を始めたいとのことですね。以下の候補はいかがでしょうか？",
  "context": {
    "aboutType": "Habit",
    "aboutOperation": "新規提案",
    "categories": ["運動", "健康"]
  },
  "gatheredRequirements": {
    "explicit": { "category": "運動", "intent": "習慣を始めたい" },
    "inferred": { "experienceLevel": "beginner" },
    "completeness": 0.4
  },
  "candidateTypes": {
    "showGoals": false,
    "showHabits": true,
    "showStickies": false,
    "showReplies": true
  },
  "habits": [
    {
      "type": "Habit",
      "label": "毎朝5分のストレッチ",
      "comment": "初心者向け・負担が軽い",
      "confidence": 0.9,
      "detail": {
        "name": "毎朝5分のストレッチ",
        "habitType": "do",
        "must": 1,
        "duration": 5,
        "repeat": "daily",
        "time": "07:00",
        "category": "運動",
        "difficulty": "easy",
        "reason": "継続しやすい短時間から開始"
      }
    },
    {
      "type": "Habit",
      "label": "週3回の20分ウォーキング",
      "comment": "適度な運動量",
      "confidence": 0.75,
      "detail": {
        "name": "週3回の20分ウォーキング",
        "habitType": "do",
        "must": 1,
        "duration": 20,
        "repeat": "weekly",
        "category": "運動",
        "difficulty": "medium",
        "frequency": "週3回",
        "reason": "有酸素運動で基礎体力向上"
      }
    }
  ],
  "replies": [
    { "type": "reply", "label": "もっと難しく", "detail": { "action": "adjust_harder", "icon": "💪" } },
    { "type": "reply", "label": "もっとやさしく", "detail": { "action": "adjust_easier", "icon": "🌱" } },
    { "type": "reply", "label": "もっと具体的に", "detail": { "action": "more_specific", "icon": "🎯" } },
    { "type": "reply", "label": "他には", "detail": { "action": "show_alternatives", "icon": "🔄" } }
  ]
}
```

### パターン2: Goal + Habit候補（目標と習慣同時提案）

```json
{
  "message": "TOEIC 800点を目指すとのことですね。目標と、それを達成するための習慣を提案します。",
  "context": {
    "aboutType": "Goal",
    "aboutOperation": "新規提案",
    "categories": ["学習", "英語"]
  },
  "gatheredRequirements": {
    "explicit": { "targetScore": 800, "currentScore": 600 },
    "inferred": { "timeline": "6ヶ月" },
    "completeness": 0.7
  },
  "candidateTypes": {
    "showGoals": true,
    "showHabits": true,
    "showStickies": false,
    "showReplies": true
  },
  "goals": [
    {
      "type": "Goal",
      "label": "TOEIC 800点達成",
      "confidence": 0.95,
      "detail": {
        "name": "TOEIC 800点達成",
        "details": "現在600点から200点アップを目指す",
        "dueDate": "2026-08-06",
        "category": "学習",
        "difficulty": "medium",
        "rationale": "6ヶ月で200点アップは現実的な目標",
        "milestones": [
          { "name": "700点到達", "targetDate": "2026-05-06" },
          { "name": "リスニング400点", "targetDate": "2026-06-06" }
        ]
      }
    }
  ],
  "habits": [
    {
      "type": "Habit",
      "label": "毎日30分の英単語学習",
      "comment": "目標達成に必須",
      "detail": {
        "name": "毎日30分の英単語学習",
        "habitType": "do",
        "duration": 30,
        "repeat": "daily",
        "category": "学習",
        "reason": "語彙力強化がスコアアップの基盤"
      }
    },
    {
      "type": "Habit",
      "label": "週末2時間の模試演習",
      "comment": "実践力向上",
      "detail": {
        "name": "週末2時間の模試演習",
        "habitType": "do",
        "duration": 120,
        "repeat": "weekly",
        "category": "学習",
        "reason": "本番形式に慣れる"
      }
    }
  ],
  "replies": [
    { "type": "reply", "label": "もっと難しく", "detail": { "action": "adjust_harder", "icon": "💪" } },
    { "type": "reply", "label": "もっとやさしく", "detail": { "action": "adjust_easier", "icon": "🌱" } },
    { "type": "reply", "label": "もっと具体的に", "detail": { "action": "more_specific", "icon": "🎯" } },
    { "type": "reply", "label": "他には", "detail": { "action": "show_alternatives", "icon": "🔄" } }
  ]
}
```

### パターン3: 既存Habit見直し

```json
{
  "message": "「毎朝のジョギング」を調整したいとのことですね。現在の設定と調整案を表示します。",
  "context": {
    "aboutType": "Habit",
    "aboutOperation": "見直し",
    "categories": ["運動"]
  },
  "gatheredRequirements": {
    "explicit": { "habitId": "habit-123", "issue": "続かない" },
    "inferred": { "cause": "負荷が高すぎる" },
    "completeness": 0.6
  },
  "candidateTypes": {
    "showGoals": false,
    "showHabits": true,
    "showStickies": false,
    "showReplies": true
  },
  "habits": [
    {
      "type": "Habit",
      "label": "Lv.50プラン: 15分のジョギング",
      "comment": "現在の半分の負荷",
      "existingId": "habit-123",
      "confidence": 0.85,
      "detail": {
        "name": "毎朝15分のジョギング",
        "habitType": "do",
        "duration": 15,
        "repeat": "daily",
        "time": "06:30",
        "reason": "負荷を半分にして継続性を重視"
      }
    },
    {
      "type": "Habit",
      "label": "Lv.10プラン: 靴を履いて外に出る",
      "comment": "最小限のアクション",
      "existingId": "habit-123",
      "confidence": 0.7,
      "detail": {
        "name": "毎朝靴を履いて外に出る",
        "habitType": "do",
        "duration": 2,
        "repeat": "daily",
        "time": "06:30",
        "reason": "まず外に出ることを習慣化"
      }
    }
  ],
  "replies": [
    { "type": "reply", "label": "もっと難しく", "detail": { "action": "adjust_harder", "icon": "💪" } },
    { "type": "reply", "label": "もっとやさしく", "detail": { "action": "adjust_easier", "icon": "🌱" } },
    { "type": "reply", "label": "もっと具体的に", "detail": { "action": "more_specific", "icon": "🎯" } },
    { "type": "reply", "label": "他には", "detail": { "action": "show_alternatives", "icon": "🔄" } }
  ]
}
```

### パターン4: UserReplyのみ（質問/確認時）

```json
{
  "message": "どのような習慣を始めたいですか？カテゴリを選んでください。",
  "context": {
    "aboutType": null,
    "aboutOperation": "新規提案",
    "categories": []
  },
  "gatheredRequirements": {
    "explicit": {},
    "inferred": {},
    "completeness": 0.1
  },
  "candidateTypes": {
    "showGoals": false,
    "showHabits": false,
    "showStickies": false,
    "showReplies": true
  },
  "replies": [
    { "type": "reply", "label": "運動・健康", "detail": { "action": "custom", "category": "運動", "icon": "🏃" } },
    { "type": "reply", "label": "学習・勉強", "detail": { "action": "custom", "category": "学習", "icon": "📚" } },
    { "type": "reply", "label": "生活習慣", "detail": { "action": "custom", "category": "生活", "icon": "🏠" } },
    { "type": "reply", "label": "その他", "detail": { "action": "custom", "category": "その他", "icon": "✨" } }
  ]
}
```

---

## TypeScript型定義ファイル

完全な型定義は以下に実装:

```
frontend/app/dashboard/types/ai-candidate-response.ts
```

---

## UI表示ルール

### 候補カード表示

1. **Goal/Habit/Sticky'n候補カード**
   - 右下に [採用] / [不採用] トグルスイッチ
   - トグルクリック時: 対応するEditモーダルを開く
   - カード全体クリック時: 詳細表示（モーダル）

2. **UserReply候補**
   - エンティティ候補の下に横並びで表示
   - ボタン形式
   - クリック時: 対応アクションを実行

### 表示順序

```
1. AIメッセージ (message)
2. Goal候補カード群 (goals)
3. Habit候補カード群 (habits)
4. Sticky'n候補カード群 (stickies)
5. UserReply候補ボタン群 (replies) ← 常に最下部
```

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-02-06 | Claude Code | Initial specification |
