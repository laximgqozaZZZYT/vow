# Habit Candidate Display Bug Fix - Requirements

## Overview
- **Purpose**: AIコーチの会話フローにおいて、カテゴリ選択後の具体的な習慣候補がボタンとして適切に表示されない問題を修正する
- **Status**: Implementation Complete
- **Version**: 1.0.0
- **Last Updated**: 2026-02-04
- **Author**: vow-spec-architect
- **Issue ID**: ISS-20260204-016

## Problem Statement

### 報告された症状
ユーザーが「新しい習慣を追加したい」とAIコーチに伝え、カテゴリ（例: 趣味・クリエイティブ）を選択した後、具体的な習慣候補（例: 「毎日5分、スケッチや落書きをする」）がボタンとして表示されない。

### 会話データ分析
```
User: 新しい習慣を追加したい
AI: カテゴリ選択ボタン（6つ）を表示 --> 正常動作
User: 趣味・クリエイティブを選択
AI: 具体的な習慣候補ボタン（6つ）を表示 --> 問題発生箇所
User: 寝る前に3行日記を書くを選択
AI: ゴール期間設定ボタン（5つ）を表示
```

### 想定される原因

1. **ボタン形式の違い**:
   - AIは `{"buttons": [...]}` 形式でJSONをテキストに含めてボタンを表示
   - これは `quickReplies`（選択肢ボタン）として表示される
   - しかし、ユーザーが期待しているのは `SuggestionCard`（習慣追加カード）かもしれない

2. **表示タイミングの問題**:
   - ストリーミング中はボタンが表示されない設計になっている
   - `shouldParseFully = isComplete || msg.status === 'error'` の条件が正しく評価されていない可能性

3. **parseButtonsFromContent の解析失敗**:
   - コードブロック形式 (```json...```) のパースが失敗している可能性
   - インライン形式 (`{"buttons":...}`) のパースでJSONが途中で切れている可能性

## Root Cause Analysis

### コード調査結果

**Section.MOC.tsx の処理フロー**:
```
1. activeAgent.messages の変更を検出 (useEffect)
2. msg.status === 'complete' のとき shouldParseFully = true
3. parseButtonsFromContent(msg.content) を呼び出し
4. {"buttons": [...]} を検出し quickReplies として返す
5. GroupChatMessage に quickReplies を設定
6. UI で QuickReplyButtons として表示
```

**問題の可能性**:
1. MCP モードでは `complete` イベントで `toolCalls` が送られてこない
2. OpenAI モードでも `toolCalls` の output が null/undefined になっている
3. テキスト内の JSON パースで特殊文字（絵文字、日本語）が問題を起こしている

## Requirements

### Functional Requirements

- [FR-001] カテゴリ選択後、AIコーチが提案する具体的な習慣候補がボタンとして表示されること
- [FR-002] 習慣候補ボタンをタップすると、その内容がユーザーメッセージとして送信されること
- [FR-003] MCPサーバーモードとOpenAI（Mastra）モードの両方で正常に動作すること
- [FR-004] ストリーミング完了後、ボタンが即座に表示されること（500ms以内）

### Non-Functional Requirements

- [NFR-001] 既存の quickReplies 表示ロジックに影響を与えないこと
- [NFR-002] 絵文字を含む日本語テキストのパースが正常に動作すること
- [NFR-003] デバッグログが本番環境で過剰に出力されないこと

## Acceptance Criteria

- [AC-001] 「新しい習慣を追加したい」→カテゴリ選択→具体的な習慣候補が6つボタンとして表示される
- [AC-002] 習慣候補ボタン（例: 「毎日5分、スケッチ」）をタップすると、その内容が会話に送信される
- [AC-003] コンソールログで `[parseButtonsFromContent] Found buttons in code block/inline: [...]` が出力される
- [AC-004] MCPサーバー経由でも上記AC-001〜AC-003が同様に動作する

## Affected Files

- `frontend/app/dashboard/components/Section.MOC.tsx`
  - parseButtonsFromContent 関数
  - parseButtonsFromText 関数
  - useEffect 内のメッセージ処理
- `frontend/app/dashboard/hooks/useMcpChat.ts`
  - complete イベントハンドラ
- `frontend/app/dashboard/hooks/useMastraAgent.ts`
  - parseSSEEvent 関数

## Agent Coordination Notes

この仕様は単一エージェントで実装可能:
- Frontend の Section.MOC.tsx のパースロジックを修正
- 必要に応じて useMcpChat.ts のイベント処理を修正
