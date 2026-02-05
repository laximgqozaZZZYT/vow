# Suggestion Buttons Fix - Requirements

## Overview
- **Purpose**: MCPサーバー・OpenAIいずれを使用しても、AIコーチからの提案（習慣・目標）がボタンとして表示されない問題を修正する
- **Status**: Implementation Complete
- **Version**: 1.1.0
- **Last Updated**: 2026-02-04
- **Author**: vow-spec-architect

## Problem Statement

MOCセクション（Section.MOC.tsx）のAIコーチ機能において、習慣や目標の提案がボタン（SuggestionCard）として表示されない。

### 症状
- ユーザーが「健康の習慣を提案して」と入力すると、AIは提案テキストを返すが、ボタンは表示されない
- MCPサーバー使用時もOpenAI使用時も同じ症状
- コンソールログで `parsedSuggestions: undefined` が出力される

### 影響範囲
- **Frontend**: `frontend/app/dashboard/components/Section.MOC.tsx`
- **Frontend**: `frontend/app/dashboard/hooks/useMastraAgent.ts`
- **Frontend**: `frontend/app/dashboard/hooks/useMcpChat.ts`
- **Backend**: `backend/src/routers/agents.ts`
- **Backend**: `backend/src/agents/mastra/vow-coach-agent.ts`

## Root Cause Analysis

### 根本原因
1. **MCP側**: `useMcpChat.ts`の`complete`イベントハンドラーがMCPサーバーから`toolCalls`を受け取るが、MCPサーバー自体が`toolCalls`を返していない
2. **共通側**: ストリーミング完了時のメッセージ状態更新タイミングで、`toolCalls`がメッセージオブジェクトに正しく付与されていない可能性

### データフロー分析

```
[User Input]
    |
    v
[Frontend: Section.MOC.tsx]
    |
    +-- useMastraAgent (OpenAI mode)
    |       |
    |       v
    |   [Backend: /api/agents/chat]
    |       |
    |       v
    |   [VowCoachAgent.processMessage()]
    |       |
    |       v
    |   [Tool Execution: suggest_habits]
    |       |
    |       v
    |   [Response: { message, toolCalls }]  <-- toolCalls contains { output: { suggestions: [...] } }
    |
    +-- useMcpChat (MCP mode)
            |
            v
        [MCP Server: /agents/{agentId}/chat]
            |
            v
        [SSE Stream: token, complete events]
            |
            v
        [complete event: { content, toolCalls? }]  <-- toolCalls is missing or empty
```

## Requirements

### Functional Requirements

- [FR-001] OpenAI（Mastra）モード使用時、AIコーチの提案（習慣・目標）がSuggestionCardとして表示されること
- [FR-002] MCPサーバーモード使用時、AIコーチの提案がSuggestionCardとして表示されること
- [FR-003] SuggestionCardをクリックすると対応するモーダル（HabitModal/GoalModal）が開くこと
- [FR-004] フォローアップアクションボタン（もっと具体的に、もっとやさしく等）が表示されること
- [FR-005] 提案ボタンの状態（pending, accepted, snoozed, dismissed）が正しく管理されること

### Non-Functional Requirements

- [NFR-001] ストリーミング完了から提案ボタン表示まで500ms以内
- [NFR-002] 既存のチャット機能に影響を与えないこと
- [NFR-003] デバッグログが本番環境で過剰に出力されないこと

## Acceptance Criteria

- [AC-001] 「健康の習慣を提案して」と入力すると、3つの習慣提案がSuggestionCardとして表示される
- [AC-002] 「キャリアの目標を提案して」と入力すると、3つの目標提案がSuggestionCardとして表示される
- [AC-003] MCPサーバー経由でも上記AC-001, AC-002が同様に動作する
- [AC-004] 提案カードをクリックすると適切なモーダルが開き、データがプリフィルされる
- [AC-005] コンソールログで`[parseSuggestions] Final result: { count: 3, suggestions: [...] }`が出力される

## Agent Coordination Notes

この仕様は以下のエージェントが並行して作業可能:

1. **Frontend Agent**: Section.MOC.tsx, useMastraAgent.ts, useMcpChat.tsの修正
2. **Backend Agent**: agents.tsのSSEイベント送信部分の修正
3. **MCP Agent**: MCPサーバーのチャットエンドポイント修正（必要な場合）
