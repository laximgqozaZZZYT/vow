# Goal候補ボタン表示修正 - 技術設計

## Overview
- **Purpose**: Goal関連リクエストで正しいカテゴリ・候補が表示されるよう修正
- **Status**: In Progress
- **Version**: 1.0.0
- **Last Updated**: 2026-02-04
- **Author**: vow-spec-architect

## 技術分析

### 現在のフロー

```
User: "Goalを設定したい"
    |
    v
vow-coach-agent (システムプロンプト解釈)
    |
    v
show_category_selection() 呼び出し
    |
    +-- selectionType がデフォルト "habit_category" に設定される (問題箇所)
    |
    v
Frontend: habit_categoryとしてカテゴリボタン表示
    |
    v
User: カテゴリ選択
    |
    v
handleQuickReplyClick: "habit_category" なので suggest_habits を要求
    |
    v
Habit候補が表示される (期待: Goal候補)
```

### 修正後のフロー

```
User: "Goalを設定したい"
    |
    v
vow-coach-agent (強化されたプロンプト解釈)
    |
    v
show_category_selection(selectionType: "goal_category") 呼び出し
    |
    v
Frontend: goal_categoryとしてGoal用カテゴリボタン表示
    |
    v
User: カテゴリ選択
    |
    v
handleQuickReplyClick: "goal_category" なので suggest_goals を要求
    |
    v
Goal候補が表示される (期待通り)
```

## 修正方針

### 方針1: システムプロンプトの強化 (推奨)

LLMに対する指示を明確化し、Goal関連リクエストで必ず`selectionType: "goal_category"`を指定させる。

**メリット:**
- コードの変更が最小限
- 既存の動作を壊しにくい
- 他のツール呼び出しパターンにも適用可能

**デメリット:**
- LLMの挙動に依存（100%の保証なし）

### 方針2: ツールのデフォルト値削除

`ShowCategorySelectionSchema`からデフォルト値を削除し、必須パラメータにする。

**メリット:**
- LLMが必ず`selectionType`を指定する必要がある
- 意図の不明確さがなくなる

**デメリット:**
- 既存のツール呼び出しが失敗する可能性
- 破壊的変更となる

### 採用方針: 方針1 + 補助的修正

システムプロンプトを強化しつつ、Goal関連キーワード検出時に警告ログを出力して監視可能にする。

## 修正内容

### 1. システムプロンプトの強化

ファイル: `/home/ubuntu/Downloads/vow/backend/src/agents/mastra/vow-coach-agent.ts`

**現在の記述:**
```
| 「ゴールを設定したい」「目標を立てたい」 | **goal_category** | 目標カテゴリー選択 |
```

**強化案:**
- Goal関連リクエストの例をより多く追加
- `selectionType`パラメータの必須性を強調
- 間違ったパターン（Goal要求にhabit_category使用）を明示的に禁止

### 2. 意図判定の改善

ファイル: `/home/ubuntu/Downloads/vow/backend/src/agents/mastra/agents/manager-agent.ts`

**現在のgoalKeywords:**
```javascript
const goalKeywords = ['目標', 'goal', '達成', 'achieve', 'マイルストーン', 'milestone', 'ゴール', '計画', 'plan', '設定したい', 'を決める', 'planner'];
```

**追加するキーワード:**
```javascript
'立てたい', '作りたい', '決めたい', 'ターゲット', 'target', 'objective'
```

### 3. show_category_selection呼び出しの検証

`show_category_selection`が呼び出される際に、会話コンテキストからGoal/Habitの意図を推定し、
`selectionType`が意図と一致しない場合に警告ログを出力する。

## インターフェース定義

### ShowCategorySelectionSchema (変更なし)

```typescript
export const ShowCategorySelectionSchema = z.object({
  selectionType: z.enum(['habit_category', 'goal_category', 'difficulty']).default('habit_category')
    .describe('Type of selection to show. Use goal_category for goal-related requests.'),
  message: z.string()
    .describe('Message to show with the category buttons'),
});
```

### CategorySelectionResult (変更なし)

```typescript
export interface CategorySelectionResult {
  message: string;
  selectionType: 'habit_category' | 'goal_category' | 'difficulty';
  quickReplies: Array<{
    id: string;
    label: string;
    value: string;
    icon: string;
  }>;
}
```

## テスト計画

### 単体テスト

1. システムプロンプト変更後、Goal関連キーワードが正しく抽出されるか
2. `show_category_selection`が正しい`selectionType`で呼び出されるか

### 結合テスト

1. E2Eで「Goalを設定したい」→ Goal候補表示を確認
2. E2Eで「習慣を始めたい」→ Habit候補表示を確認（回帰テスト）

### 手動テスト

1. MOCセクションで以下を入力し、期待通りの動作を確認:
   - 「Goalを設定したい」
   - 「目標を立てたい」
   - 「ゴールを作りたい」
   - 「新しい目標が欲しい」

## ロールバック計画

プロンプト変更のみのため、問題発生時は以下でロールバック可能:
1. Git revertでプロンプト変更を戻す
2. デプロイ

## 依存関係

- なし（フロントエンドの変更不要）

## リスク

- LLMが新しいプロンプトを正しく解釈しない可能性（低）
- 他の言語（英語）での動作に影響（テストで確認）
