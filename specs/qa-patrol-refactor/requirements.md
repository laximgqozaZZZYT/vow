# QA Patrol Agent Refactor - Requirements

## Overview
- **Purpose**: QA巡回エージェントをOpenAI API不使用・静的質問データ方式にリファクタリング
- **Status**: Draft
- **Version**: 1.0.0
- **Last Updated**: 2026-02-04
- **Author**: vow-spec-architect

## Problem Statement

現在のQA巡回エージェント（`qa-patrol.spec.ts`）には以下の問題があります:

1. **質問が詳細すぎる**:
   - 例: 「新しい運動習慣を始めたいです。毎日30分くらいのウォーキングから始めようと思っています」
   - これではAIが掘り下げる余地がなく、実際のユーザー入力パターンと乖離

2. **柔軟性の欠如**:
   - テスト質問がペルソナ定義内にハードコードされている
   - 質問の追加・修正が困難

3. **型定義の分散**:
   - インターフェースがテストファイル内に散在
   - 再利用性が低い

## Functional Requirements

### FR-001: 事前定義質問データの作成
- **Description**: シンプルな質問文を持つ静的な質問データを作成する
- **Acceptance Criteria**:
  - 質問データは別ファイル（`qa-patrol-questions.ts`）に分離される
  - 各質問は `TestQuestion` インターフェースに準拠する
  - 最低10個の質問が定義される

### FR-002: シンプルな質問文
- **Description**: 質問文は情報粒度を低く、シンプルにする
- **Acceptance Criteria**:
  - 質問文は1文、15文字以内を目安とする
  - 詳細情報は `followUpResponses` に含める
  - 例: 「運動の習慣を始めたい」「Goalを設定したい」

### FR-003: 目的と回答型の明示
- **Description**: 各質問に期待する目的と回答の型を明示する
- **Acceptance Criteria**:
  - `desiredPurpose`: habit_suggestion / goal_setting / level_setting / advice
  - `desiredResponseType`: habit_cards / goal_cards / text_advice / category_buttons
  - `expectedGenre`: 期待するジャンル（any / existing / 具体的なジャンル名）

### FR-004: フォローアップ回答の定義
- **Description**: AIからの掘り下げ質問に対する回答パターンを定義
- **Acceptance Criteria**:
  - `followUpResponses` にキーワード:回答のマップを定義
  - 少なくとも5パターンのフォローアップ回答を各質問に用意

### FR-005: OpenAI API依存の除去
- **Description**: OpenAI APIへの依存を完全に除去
- **Acceptance Criteria**:
  - OpenAI関連のimportが存在しない
  - 環境変数 `OPENAI_API_KEY` への依存がない
  - 全ての質問生成が静的データから行われる

## Non-Functional Requirements

### NFR-001: 型安全性
- **Description**: TypeScriptの型システムを活用した安全な実装
- **Acceptance Criteria**:
  - 全てのインターフェースが明示的に定義される
  - 型エラーなしでビルドが通る

### NFR-002: メンテナンス性
- **Description**: 質問の追加・修正が容易な構造
- **Acceptance Criteria**:
  - 質問データファイルの修正のみで新規質問を追加可能
  - テストロジックの変更なしで質問バリエーションを増やせる

### NFR-003: テスト実行時間
- **Description**: テスト実行時間の最適化
- **Acceptance Criteria**:
  - 1質問あたりの平均実行時間: 30秒以内
  - 全質問実行時間: 10分以内

## Data Model

### TestQuestion Interface

```typescript
interface TestQuestion {
  /** 質問の一意識別子 */
  id: string;

  /** シンプルな質問文（情報粒度を低く） */
  question: string;

  /** 最終的に欲しい目的 */
  desiredPurpose: 'habit_suggestion' | 'goal_setting' | 'level_setting' | 'advice';

  /** 最終的に欲しい回答の型 */
  desiredResponseType: 'habit_cards' | 'goal_cards' | 'text_advice' | 'category_buttons';

  /** 期待するジャンル */
  expectedGenre: string;

  /** フォローアップ質問（掘り下げ対応用）キー: AIの質問パターン、値: ユーザーの回答 */
  followUpResponses: Record<string, string>;

  /** 成功判定キーワード（オプション） */
  successKeywords?: string[];

  /** 最大やり取り回数（オプション、デフォルト: 5） */
  maxExchanges?: number;
}
```

## Sample Test Questions

### カテゴリ: 習慣追加

```typescript
{
  id: 'simple-habit-1',
  question: '習慣を追加したい',
  desiredPurpose: 'habit_suggestion',
  desiredResponseType: 'category_buttons',
  expectedGenre: 'any',
  followUpResponses: {
    'どのジャンル|カテゴリ|分野': '健康',
    'どんな習慣|具体的': '運動',
    '時間帯|いつ': '朝',
  }
}
```

### カテゴリ: 目標設定

```typescript
{
  id: 'simple-goal-1',
  question: 'Goalを設定したい',
  desiredPurpose: 'goal_setting',
  desiredResponseType: 'category_buttons',
  expectedGenre: 'any',
  followUpResponses: {
    'どのジャンル|カテゴリ': '健康',
    'どんな目標|具体的': '体重を減らしたい',
    'いつまで|期間': '3ヶ月後',
  }
}
```

### カテゴリ: レベル設定

```typescript
{
  id: 'simple-level-1',
  question: 'レベルを設定したい',
  desiredPurpose: 'level_setting',
  desiredResponseType: 'habit_cards',
  expectedGenre: 'existing',
  followUpResponses: {}
}
```

## Out of Scope

- OpenAI APIを使用した動的質問生成
- LLMによる回答評価
- 画像認識を伴うUIテスト
- 多言語対応（日本語のみ）

## Dependencies

- Playwright Test Framework
- VOW Backend API (CLI Chat Endpoint)
- TypeScript 5.x

## References

- 既存ファイル: `/home/ubuntu/Downloads/vow/frontend/e2e/qa-patrol.spec.ts`
- ドキュメント: `/home/ubuntu/Downloads/vow/docs/QA_PATROL_AGENT.md`
