# Chat "No Response" Bug Fix Specification

## Overview
- Purpose: チャット機能で「(No response)」が返される問題の根本原因を特定し、修正する
- Status: Investigation Complete
- Version: 1.0.0
- Last Updated: 2026-02-04
- Author: vow-spec-architect

## Problem Statement

MOCセクションのチャット機能において、AIエージェントから「(No response)」のみが返ってくる問題が発生している。

### Symptoms
1. ユーザーがメッセージを送信すると、「(No response)」というテキストが表示される
2. 実際のAI応答がUI上に表示されない
3. 問題は主にMCPエージェントモード使用時に発生する

## Root Cause Analysis

### Investigation Results

**Primary Root Cause: SSE Event Parsing Mismatch**

フロントエンドの`useMcpChat.ts`とバックエンドの`server.ts`間でSSEイベント形式に不整合がある。

#### Backend (MCP Task Server) が送信する形式:
```
data: {"type":"session","sessionId":"..."}
data: {"type":"token","token":"..."}
data: {"type":"complete","content":"...","sessionId":"..."}
```

#### Frontend が期待する形式:
```
event: session
data: {"sessionId":"..."}

event: token
data: {"token":"..."}

event: complete
data: {"content":"...","sessionId":"..."}
```

**Key Issues Identified:**

1. **Issue 1: Event Type Detection**
   - Backend: `data: {"type":"token",...}` (type in JSON)
   - Frontend (lines 286-307): `event:` ラインを先に探すが、backendは送信していない
   - `currentEventType`が常に`null`になるが、`data.type`にフォールバックする設計になっている

2. **Issue 2: Token Accumulation Works**
   - Backend sends: `{"type":"token","token":"..."}`
   - Frontend checks (line 314): `data.token || data.text || data.content`
   - `effectiveType = currentEventType || data.type` で正しく `token` を判定している

3. **Issue 3: Complete Event Processing**
   - Backend sends: `{"type":"complete","content":"..."}` (line 320-325 in server.ts)
   - Frontend (line 342): `fullContent || data.content || data.message`
   - これも正しく動作するはず

4. **Issue 4: Claude CLI Output**
   - MCPタスクサーバーがClaude CLIをspawnしているが、Claude CLIが何も出力しない
   - 原因: Claude CLIのパスが正しくない、または認証の問題
   - `fullResponse`が空のまま完了イベントが送信される

### Most Likely Root Cause

**Claude CLI実行の失敗**

`/home/ubuntu/.mcp-multi-agent/mcp-task-distributor/src/server.ts`の282-290行目:
```typescript
const claudeProcess: ChildProcess = spawn(CLAUDE_CLI_PATH, ['--print'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  shell: true,
  env: {
    ...process.env,
    PATH: process.env.PATH || '/home/ubuntu/.nvm/versions/node/v22.18.0/bin:/usr/local/bin:/usr/bin:/bin',
  },
});
```

Claude CLIが:
1. パスが正しくない
2. 認証されていない
3. stderrにエラーを出力しているが、stdoutは空

結果として`fullResponse`が空になり、フロントエンドで「(No response)」が表示される。

## Requirements

### Functional Requirements

- [FR-001] MCPエージェントモードでのチャットメッセージ送信が正常に動作すること
- [FR-002] AIの応答がストリーミングでリアルタイムに表示されること
- [FR-003] 応答完了時に全文が正しく表示されること
- [FR-004] エラー発生時に適切なエラーメッセージが表示されること
- [FR-005] セッション履歴が正しく維持されること

### Non-Functional Requirements

- [NFR-001] 既存のMastraエージェント（OpenAI）モードの動作に影響を与えないこと
- [NFR-002] 修正は後方互換性を維持すること
- [NFR-003] デバッグログを適切に出力し、問題の追跡が可能であること

## Acceptance Criteria

- [AC-001] MCPエージェントモードでメッセージを送信すると、AI応答がストリーミングで表示される
- [AC-002] 「(No response)」が誤って表示されない
- [AC-003] 会話履歴が次のメッセージに引き継がれる
- [AC-004] Mastraエージェントモードが引き続き正常に動作する
- [AC-005] ブラウザのコンソールにSSEパースエラーが表示されない

## Affected Components

| Component | File Path | Impact |
|-----------|-----------|--------|
| useMcpChat Hook | `/frontend/app/dashboard/hooks/useMcpChat.ts` | Medium - Error handling |
| MCP Task Server | `/home/ubuntu/.mcp-multi-agent/mcp-task-distributor/src/server.ts` | High - CLI execution |
| MOC Section | `/frontend/app/dashboard/components/Section.MOC.tsx` | Low - Display logic |

## Agent Coordination Notes

- フロントエンドとバックエンドの両方を修正する必要がある
- 推奨アプローチ:
  1. まずサーバー側でClaude CLIの実行状況をデバッグ
  2. stderrの内容をエラーイベントとして返す
  3. フロントエンドで適切にエラーを表示
- テストは両モード（MCP/Mastra）で実施すること
