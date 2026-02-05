# Intent Misdetection Fix - Requirements

## Overview
- **Purpose**: ユーザーが「達成ゴール」などのゴールタイプを選択した際に、「達成」という単語がprogressインテントとして誤検出され、全く関係ない「進捗を確認しましょう」という応答が返される問題を修正する
- **Status**: Implementation Complete
- **Version**: 1.0.0
- **Issue ID**: ISS-20260204-020
- **Last Updated**: 2026-02-04
- **Resolved At**: 2026-02-04T21:10:00Z
- **Author**: vow-spec-architect

## Problem Statement

MOCセクションのAIコーチ機能において、ユーザーが「ゴールを設定したい」と入力した後に「達成ゴール」を選択すると、全く関係ない「進捗を確認しましょう」という応答が返される。

### 再現手順
1. ユーザーが「ゴールを設定したい」と入力
2. AIが「どのタイプのゴールを設定しますか？」とボタンを表示
3. ユーザーが「達成ゴール（ドキュメント読破など）」ボタンをクリック
4. **期待**: ゴール設定のフローが継続される
5. **実際**: 「進捗を確認しましょう！現在12個の習慣を追跡中です。どの期間の進捗を見たいですか？」という無関係な応答

### 会話データ（Issueより）
```json
{
  "messages": [
    { "role": "user", "content": "ゴールを設定したい" },
    { "role": "assistant", "content": "どのタイプのゴールを設定しますか？" },
    { "role": "user", "content": "📚 達成ゴール（ドキュメント読破など）" },
    { "role": "assistant", "content": "進捗を確認しましょう！現在12個の習慣を追跡中です。どの期間の進捗を見たいですか？" }
  ]
}
```

### 影響範囲
- **Backend**: `backend/src/agents/mastra/vow-coach-agent.ts` - detectIntent関数
- **Frontend**: `frontend/app/dashboard/components/Section.MOC.tsx` - handleQuickReplyClick関数
- **Backend**: `backend/src/agents/shared-tools/coach-tools.ts` - show_choice_buttonsツール

## Root Cause Analysis

### 根本原因
1. **フロントエンド**: `handleQuickReplyClick`関数は`selectionType`が`goal_category`の場合、「${label}の目標を提案して」というメッセージを送信する。しかし、ゴールタイプ選択（達成ゴール、習慣ゴールなど）は`goal_category`ではないため、デフォルトで習慣提案メッセージ「${label}の習慣を提案して」が送信される可能性がある

2. **バックエンド**: `detectIntent`関数（vow-coach-agent.ts Line 2180-2219）で、「達成」という単語を含むメッセージは`progress`インテントとして判定される（Line 2194）
   ```typescript
   if (lowerMsg.includes('進捗') || lowerMsg.includes('状況') ||
       lowerMsg.includes('どのくらい') || lowerMsg.includes('達成')) {
     return 'progress';
   }
   ```

3. **フロー問題**: ゴールタイプ選択というユースケースが現在のシステムでサポートされていない。show_choice_buttonsツールで表示されたボタンがクリックされても、適切なselectionTypeが設定されず、handleQuickReplyClickが正しいコンテキストを持たずにメッセージを送信している

### データフロー分析

```
[User clicks "達成ゴール（ドキュメント読破など）" button]
    |
    v
[Frontend: handleQuickReplyClick]
    |
    +-- selectionType is NOT "goal_category" (undefined or other)
    |
    +-- Sends: "📚 達成ゴール（ドキュメント読破など）の習慣を提案して"
    |   OR just: "📚 達成ゴール（ドキュメント読破など）"
    |
    v
[Backend: VowCoachAgent.getFallbackResponse]
    |
    +-- detectIntent("達成ゴール...")
    |   → returns 'progress' (because contains "達成")
    |
    v
[Backend: switch(intent) case 'progress']
    |
    v
[Response: "進捗を確認しましょう！..."]
```

## Requirements

### Functional Requirements

- [FR-001] ユーザーがshow_choice_buttonsで表示されたゴールタイプボタンをクリックした場合、適切なゴール設定フローが継続されること
- [FR-002] 「達成ゴール」「習慣ゴール」などのゴールタイプ選択が進捗確認と誤判定されないこと
- [FR-003] show_choice_buttonsツールで表示されたボタンのクリック時、会話の文脈が正しく維持されること
- [FR-004] detectIntent関数が会話の文脈を考慮してインテントを判定すること

### Non-Functional Requirements

- [NFR-001] 既存のインテント判定ロジックに影響を与えないこと
- [NFR-002] フォールバック応答の品質を維持すること
- [NFR-003] 他のボタンクリックフローに影響を与えないこと

## Acceptance Criteria

- [AC-001] 「ゴールを設定したい」→「達成ゴール」と選択した場合、ゴール設定の会話が継続される
- [AC-002] 「達成率を教えて」「達成状況は？」などの進捗確認リクエストは従来通り`progress`として処理される
- [AC-003] show_choice_buttonsで表示されたボタンをクリックした場合、前の会話の文脈が保持される
- [AC-004] デバッグログで正しいインテント判定が確認できる

## Agent Coordination Notes

この仕様は以下のエージェントが並行して作業可能:

1. **Backend Agent**: vow-coach-agent.tsのdetectIntent関数の修正、会話コンテキスト判定の追加
2. **Frontend Agent**: Section.MOC.tsxのhandleQuickReplyClickの修正、selectionTypeの拡張
3. **Shared-Tools Agent**: coach-tools.tsのshow_choice_buttonsの出力にselectionType追加（必要な場合）
