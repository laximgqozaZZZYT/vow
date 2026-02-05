# MCP Remote Connection Fix - Requirements

## Overview
- **Purpose**: MCPリモートサーバ接続問題の修正
- **Status**: In Progress
- **Version**: 1.0.0
- **Last Updated**: 2026-02-04
- **Author**: vow-spec-architect

## Problem Statement

### 症状
VOWフロントエンドからMCPリモートサーバに接続できない場合がある。

### 調査結果

#### サーバー側の状態 (正常)
- MCPサーバーはポート3456で稼働中
- Health check正常応答
- 認証トークン: `mcp-dca3c407f66c5b62840b06c3d624c857`

#### 設定の不整合 (問題発見)
1. **server.env**: `TASK_SERVER_URL=http://192.168.2.200:3456`
2. **mcp-config.json**: `TASK_SERVER_URL=http://localhost:3456`

## Requirements

### Functional Requirements

- **[FR-001]** トークン設定の一貫性を保つ
- **[FR-002]** サーバーURL設定の一貫性を保つ
- **[FR-003]** CORS設定を適切に行う
- **[FR-004]** 接続診断機能を提供する

### Non-Functional Requirements

- **[NFR-001]** 後方互換性を維持
- **[NFR-002]** セキュリティ（トークンのマスキング）
- **[NFR-003]** デバッグ容易性

## Acceptance Criteria

- **[AC-001]** localhost:3456への接続が成功すること
- **[AC-002]** 設定UIが正しく動作すること
- **[AC-003]** エラー時に明確なメッセージが表示されること

## References

- MCPサーバー設定: `/home/ubuntu/.mcp-multi-agent/`
- フロントエンドフック: `useMcpChat.ts`, `useMultiAgentServer.ts`
