# MOCセクション チャット候補ボタン機能改善 - 要件定義書

## Overview

- **Purpose**: MOCセクションのチャット機能において、AIの応答に必ず候補ボタンを表示し、ユーザーが直感的に操作できるインタラクティブなチャットフローを実現する
- **Status**: Draft
- **Version**: 1.0.0
- **Last Updated**: 2026-02-05
- **Author**: vow-spec-architect
- **Spec ID**: MOC-CANDIDATE-BTN-001

## Background (背景)

### Current State (現状)

現在のMOCセクションチャット機能には以下の課題がある:

1. **候補ボタンの非表示問題**: AIの応答によってはテキストのみで候補ボタンが表示されない
2. **質問フローの不統一**: ユーザーの意図を確認するフローが一貫していない
3. **ボタンタイプの混乱**: Habit/Goal/Sticky'n/replyの区別が曖昧
4. **既存データ活用の不足**: 既存Habit/Goal/Sticky'nの見直しフローが弱い

### Expected Outcome (期待結果)

1. 全てのAI応答に候補ボタンが必須で表示される
2. ユーザーの意図を段階的に明確化する質問フロー
3. 4種類のボタンタイプ（Habit型、Goal型、Sticky'n(MEMO)型、回答型）の明確な区別
4. [採用][却下]ボタンと[詳細]ボタンによる直感的な操作

## Requirements (要件)

### Functional Requirements (機能要件)

#### FR-001: 候補ボタン必須表示

- 全てのAI応答において、通常のテキストに加えて候補ボタンを必ず表示する
- ボタンが0件の場合でも最低1つの「回答型」ボタンを表示する
- テキストのみの応答は許可しない

#### FR-002: 4種類のボタンタイプ

AIの応答には以下4種類のボタンタイプを使用:

| Type | 表示形式 | アクション |
|------|---------|-----------|
| `Habit` | 習慣候補カード | [採用][却下]ボタン、[詳細]でHabitModal |
| `Goal` | 目標候補カード | [採用][却下]ボタン、[詳細]でGoalModal |
| `Sticky'n(MEMO)` | メモ候補カード | [採用][却下]ボタン、[詳細]でStickyModal |
| `reply` | 選択肢ボタン | 押下でユーザー回答として送信 |

#### FR-003: 質問フロー（連続した質問のやり取り）

AIは以下の順序でユーザーの意図を確認する質問フローを実行:

**Step 1: 欲しい情報の確認**
以下の選択肢を「回答型」ボタンで提示:
- 既存Habitの見直し
- 既存Goalに関する新しいHabitの提案
- 新しいGoalの提案
- 新しいHabitの提案
- 既存の登録情報の確認
- その他アドバイス

**Step 2: 興味のあるカテゴリ確認**
以下のカテゴリを「回答型」ボタンで提示:
- 健康・運動
- キャリア・仕事
- 学習・スキルアップ
- 趣味・リラックス
- 人間関係
- お金・資産
- ライフスタイル
- その他

**Step 3: サブカテゴリ確認**
選択されたカテゴリに応じたサブカテゴリを「回答型」ボタンで提示

**禁止事項**:
- 「いつやるか」「どこでやるか」といった詳細なスケジュール質問はしない
- ユーザーが登録時に設定するため、AIは提案に集中する

#### FR-004: Habit/Goal/Sticky'n型ボタンの動作

候補カード（Habit/Goal/Sticky'n型）には以下のアクションボタンを表示:

| ボタン | 動作 |
|--------|------|
| [採用] | 候補を即座に登録（確認ダイアログなし） |
| [却下] | 候補を非表示にし、別の候補を要求 |
| [詳細] | 対応する編集モーダル（HabitModal/GoalModal/StickyModal）を開く |

#### FR-005: 回答型ボタンの動作

- 押下するとボタンラベルをユーザーからの回答として扱う
- チャット履歴にユーザーメッセージとして追加される
- AIは次の質問フローステップに進む

#### FR-006: 再提案機能

候補カード表示時に以下の再提案ボタンを表示:

| ボタン | 動作 |
|--------|------|
| [もっと具体的に] | より詳細な候補を再提案 |
| [もっと一般的に] | より抽象的な候補を再提案 |

#### FR-007: AIエージェントJSON応答形式

バックエンドAIエージェントは以下のJSON形式で応答を返す:

```json
{
  "message": "候補ラベル以外の文章",
  "userInfo": {
    "about_type": "None | Habit | Goal | Sticky'n(MEMO) | others",
    "about_operation": "None | 見直し | 新規提案 | 確認 | アドバイス | others",
    "about_category": ["category1", "category2"],
    "about_detail": []
  },
  "buttons": [
    {
      "type": "Habit | Goal | Sticky'n(MEMO) | reply",
      "label": "候補ラベル",
      "comment": "説明文",
      "detail": {
        "type": "Habit | Goal | Sticky'n(MEMO)",
        // 各スキーマに対応する詳細情報
      }
    }
  ]
}
```

#### FR-008: userInfo会話コンテキスト追跡

`userInfo`オブジェクトで会話の文脈を追跡:

| Field | Type | Description |
|-------|------|-------------|
| `about_type` | enum | 対話の対象: None, Habit, Goal, Sticky'n(MEMO), others |
| `about_operation` | enum | 意図する操作: None, 見直し, 新規提案, 確認, アドバイス, others |
| `about_category` | string[] | 選択されたカテゴリ（複数可） |
| `about_detail` | string[] | 選択されたサブカテゴリ（複数可） |

#### FR-009: 既存データ活用

- 「既存Habitの見直し」選択時: 登録済みHabitをボタンとして表示し選択させる
- 「既存Goalに関する新しいHabit提案」選択時: 登録済みGoalをボタンとして表示
- 「既存の登録情報の確認」選択時: Habit/Goal/Sticky'nの概要を表示

### Non-Functional Requirements (非機能要件)

#### NFR-001: パフォーマンス

- JSON応答のパース処理: 10ms以内
- ボタンクリックから次画面表示: 100ms以内
- モーダル表示: 200ms以内

#### NFR-002: 後方互換性

- 既存のtoolCall形式との互換性を維持
- 移行期間中は両形式をサポート
- 統一形式への段階的移行を可能にする

#### NFR-003: アクセシビリティ

- キーボードナビゲーション対応
- スクリーンリーダー対応（aria-label）
- 適切なフォーカス管理

#### NFR-004: 国際化

- 日本語/英語の両言語サポート
- ボタンラベルのローカライズ対応
- カテゴリ名のローカライズ対応

## Detail Object Schemas (詳細オブジェクトスキーマ)

### Habit Detail

```typescript
interface HabitDetail {
  type: "Habit";
  name: string;                       // 習慣名 (必須)
  habitType?: "do" | "avoid";         // 実行/回避
  must?: number;                      // 目標回数
  duration?: number;                  // 所要時間（分）
  repeat?: string;                    // 繰り返し設定
  time?: string;                      // 開始時刻 (HH:MM)
  endTime?: string;                   // 終了時刻 (HH:MM)
  notes?: string;                     // メモ
  workloadUnit?: string;              // 負荷の単位
  workloadPerCount?: number;          // 1回あたりの負荷
  timings?: Timing[];                 // スケジュール情報
  frequency?: string;                 // 頻度の説明
  reason?: string;                    // 推奨理由
  category?: string;                  // カテゴリ
  difficulty?: "easy" | "medium" | "hard";
}
```

### Goal Detail

```typescript
interface GoalDetail {
  type: "Goal";
  name: string;                       // 目標名 (必須)
  details?: string;                   // 詳細説明
  dueDate?: string;                   // 期限 (YYYY-MM-DD)
  parentId?: string | null;           // 親ゴールID
  category?: string;                  // カテゴリ
  difficulty?: "easy" | "medium" | "hard";
  suggestedHabits?: string[];         // 推奨される習慣名
  rationale?: string;                 // 目標設定の根拠
}
```

### Sticky'n(MEMO) Detail

```typescript
interface StickyNDetail {
  type: "Sticky'n(MEMO)";
  name: string;                       // メモ名 (必須)
  description?: string | null;        // 説明文
  parentStickyId?: string | null;     // 親Sticky'nのID
  isReusable?: boolean;               // 使いまわし設定
}
```

### Reply Detail

```typescript
interface ReplyDetail {
  action: string;                     // アクションID
  category?: string;                  // カテゴリ（カテゴリ選択時）
  subCategory?: string;               // サブカテゴリ（サブカテゴリ選択時）
  existingItemId?: string;            // 既存アイテムID（見直し選択時）
  icon?: string;                      // アイコン
}
```

## Acceptance Criteria (受け入れ基準)

- [AC-001] 全てのAI応答に最低1つのボタンが表示される
- [AC-002] Habit/Goal/Sticky'n型ボタンに[採用][却下][詳細]ボタンが表示される
- [AC-003] [詳細]ボタンで対応するモーダル（HabitModal/GoalModal/StickyModal）が開く
- [AC-004] 回答型ボタン押下でユーザーメッセージとしてチャットに追加される
- [AC-005] 質問フローが Step 1 -> Step 2 -> Step 3 の順序で進行する
- [AC-006] [もっと具体的に][もっと一般的に]で再提案が行われる
- [AC-007] userInfoが正しく追跡され、会話コンテキストが維持される
- [AC-008] OpenAI Mastra と MCP Claude の両方で同じ応答形式が使用される

## Dependencies (依存関係)

- **既存仕様**: `/home/ubuntu/Downloads/vow/specs/unified-chat-response-format/` (統一応答形式)
- **既存コンポーネント**: `Section.MOC.tsx`, `Modal.Habit.tsx`, `Modal.Goal.tsx`, `Modal.Sticky.tsx`
- **既存フック**: `useMastraAgent.ts`, `useMcpChat.ts`
- **バックエンド**: `vow-coach-agent.ts`, `manager-agent.ts`

## Agent Coordination Notes (エージェント調整メモ)

- フロントエンド改修とバックエンド改修は並列作業可能
- 共通の型定義ファイル（`types/candidate-button.types.ts`）を先に作成
- バックエンド側のプロンプト修正はOpenAI/Claude両方で検証必要
