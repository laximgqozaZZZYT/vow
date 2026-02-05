# ISS-20260204-021: 設計書

## Overview
- **Purpose**: AIコーチのシステムプロンプトを修正し、「レベル設定」リクエストに対して適切にツールを呼び出すようにする
- **Status**: In Progress
- **Version**: 1.0.0
- **Last Updated**: 2026-02-04
- **Author**: vow-spec-architect

## Technical Design

### Architecture

変更対象は単一ファイル:
```
/home/ubuntu/Downloads/vow/backend/src/agents/mastra/vow-coach-agent.ts
  └── generateSystemPrompt() 関数
        ├── 日本語プロンプト (basePromptJa)
        └── 英語プロンプト (basePromptEn)
```

### 変更内容

#### 1. 日本語プロンプトへの追加（約Line 271付近）

現在の「習慣/目標の選択が必要なケース」セクションに以下のパターンを追加:

```markdown
| ユーザーの発言 | 必ず呼び出すツール |
|--------------|------------------|
...
| 「習慣のレベル設定」「レベルを変更」「レベルを設定」 | **show_habit_selection** |
| 「既存の習慣の設定」「習慣の設定変更」 | **show_habit_selection** |
...
```

#### 2. パターン認識テーブルへの追加（約Line 401付近）

```markdown
| ユーザーメッセージ | 呼び出すツール |
|------------------|---------------|
...
| 「習慣のレベル設定をして」 | show_habit_selection(message: "どの習慣のレベルを設定しますか？") |
| 「習慣のレベルを変更したい」 | show_habit_selection(message: "どの習慣のレベルを変更しますか？") |
...
```

#### 3. 英語プロンプトへの対応追加（約Line 650付近）

```markdown
| User Message | Required Tool |
|-------------|---------------|
...
| "Set habit level", "Change habit level" | **show_habit_selection** |
| "Configure existing habits" | **show_habit_selection** |
...
```

### Interfaces

変更はシステムプロンプトのテキストのみであり、インターフェースの変更は不要。

既存の`show_habit_selection`ツールは以下のスキーマを持つ:

```typescript
ShowHabitSelectionSchema = z.object({
  message: z.string().describe('Message to show with the habit selection buttons'),
  includeAll: z.boolean().default(true).describe('Include "全ての習慣" option'),
  maxItems: z.number().int().min(1).max(20).default(10).describe('Maximum number of habits to show'),
});
```

### Dependencies

- 既存のshow_habit_selectionツールをそのまま使用
- 追加の依存関係なし

## Implementation Strategy

1. `generateSystemPrompt`関数内の日本語プロンプトを更新
2. `generateSystemPrompt`関数内の英語プロンプトを更新
3. バックエンドのビルド確認
4. 動作確認（手動テスト推奨）

## Risk Assessment

- **Low Risk**: テキストのみの変更であり、ロジックの変更なし
- **Impact**: AIの応答パターンが改善される
- **Rollback**: git revertで即座に元に戻せる

## Testing Strategy

### 手動テスト項目

1. 日本語: 「既存の習慣のレベル設定をして下さい」
   - 期待: show_habit_selectionツールが呼び出される

2. 日本語: 「習慣のレベルを変更したい」
   - 期待: show_habit_selectionツールが呼び出される

3. 英語: "Set my habit levels"
   - 期待: show_habit_selectionツールが呼び出される

4. 既存機能の回帰テスト:
   - 「習慣の進捗を確認したい」が引き続き動作すること
   - 「新しい習慣を提案して」が引き続き動作すること
