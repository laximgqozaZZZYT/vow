# QA Patrol Agent Refactor - Tasks

## Overview
- **Spec ID**: QA-PATROL-REFACTOR-001
- **Status**: In Progress
- **Last Updated**: 2026-02-04
- **Author**: vow-spec-architect

## Task Summary

| Task ID | Task Name | Status | Assignee |
|---------|-----------|--------|----------|
| 1.1 | Create qa-patrol-types.ts | Done | vow-spec-architect |
| 1.2 | Create qa-patrol-questions.ts | Done | vow-spec-architect |
| 2.1 | Modify qa-patrol.spec.ts | Done | vow-spec-architect |
| 3.1 | Build verification | Done | vow-spec-architect |
| 3.2 | Update documentation | Pending | vow-spec-architect |

## Tasks

### Task 1.1: Create qa-patrol-types.ts
- **Status**: Done
- **Priority**: High
- **Description**: 型定義ファイルを作成
- **Output File**: `/home/ubuntu/Downloads/vow/frontend/e2e/qa-patrol-types.ts`
- **Acceptance Criteria**:
  - [x] DesiredPurpose型が定義されている
  - [x] DesiredResponseType型が定義されている
  - [x] TestQuestion interfaceが定義されている
  - [x] TestResult interfaceが定義されている
  - [x] ConversationMessage interfaceが定義されている
  - [x] TypeScript compilation error なし

### Task 1.2: Create qa-patrol-questions.ts
- **Status**: Done
- **Priority**: High
- **Description**: 静的質問データファイルを作成
- **Output File**: `/home/ubuntu/Downloads/vow/frontend/e2e/qa-patrol-questions.ts`
- **Acceptance Criteria**:
  - [x] HABIT_QUESTIONS配列（3件以上）
  - [x] GOAL_QUESTIONS配列（3件以上）
  - [x] LEVEL_QUESTIONS配列（2件以上）
  - [x] ADVICE_QUESTIONS配列（2件以上）
  - [x] ALL_QUESTIONS export
  - [x] getQuestionById関数
  - [x] getQuestionsByPurpose関数
  - [x] getRandomQuestions関数
  - [x] 質問文が15文字以内（目安）でシンプル

### Task 2.1: Modify qa-patrol.spec.ts
- **Status**: Done
- **Priority**: High
- **Description**: メインテストファイルを修正
- **Target File**: `/home/ubuntu/Downloads/vow/frontend/e2e/qa-patrol.spec.ts`
- **Acceptance Criteria**:
  - [x] qa-patrol-types.tsからimport
  - [x] qa-patrol-questions.tsからimport
  - [x] TestQuestionベースのテストケース追加
  - [x] OpenAI API依存コードなし（確認済み: 元々なし）
  - [x] TypeScript compilation error なし

### Task 3.1: Build verification
- **Status**: Done
- **Priority**: High
- **Description**: ビルドと基本的な動作確認
- **Acceptance Criteria**:
  - [x] `cd frontend && npm run build` 成功
  - [ ] `npx playwright test qa-patrol.spec.ts --reporter=list` 実行可能
  - [x] 型エラーなし

### Task 3.2: Update documentation
- **Status**: Pending
- **Priority**: Medium
- **Description**: ドキュメント更新
- **Target File**: `/home/ubuntu/Downloads/vow/docs/QA_PATROL_AGENT.md`
- **Acceptance Criteria**:
  - [ ] 新しいファイル構造を記載
  - [ ] TestQuestion追加方法を記載
  - [ ] 実行方法を更新

## Implementation Notes

### 質問文のガイドライン

**良い例（シンプル）**:
- 「習慣を追加したい」
- 「Goalを設定したい」
- 「レベルを設定したい」
- 「アドバイスがほしい」
- 「運動したい」
- 「勉強したい」

**悪い例（詳細すぎる）**:
- 「新しい運動習慣を始めたいです。毎日30分くらいのウォーキングから始めようと思っています」
- 「プログラミングを学んで将来的にエンジニアとして転職したい」

### followUpResponsesのパターン例

```typescript
followUpResponses: {
  // ジャンル確認
  'どのジャンル|カテゴリ|分野': '健康',

  // 具体的な内容確認
  'どんな|具体的|何を': '運動',

  // 時間帯確認
  'いつ|時間帯|何時': '朝',

  // 目的確認
  'なぜ|目的|理由': '健康維持のため',

  // 経験確認
  '経験|これまで|やったこと': '初心者です',
}
```

## Dependencies

- Task 2.1 depends on Task 1.1, 1.2
- Task 3.1 depends on Task 2.1
- Task 3.2 depends on Task 3.1

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| 既存テストとの競合 | Medium | 新規テストを別describeブロックで追加 |
| followUpパターン不足 | Low | フォールバック回答を用意 |
| CLI API変更 | Medium | 既存のCLI API関数を再利用 |

## Completion Criteria

- [ ] 全タスク完了
- [ ] ビルド成功
- [ ] 少なくとも1つのテストケースが正常実行
- [ ] ドキュメント更新完了
