# MCP Conversation Memory Specification

## Overview
- **Purpose**: MCPサーバー側で会話履歴が正しく記憶・永続化されるようにする
- **Status**: Draft
- **Version**: 1.0.0
- **Last Updated**: 2026-02-04
- **Author**: vow-spec-architect

## Problem Statement

### Current Behavior
MCPサーバーとの会話において、以下の問題が発生している:

1. **会話が記憶されない**: 同一セッション内でも過去の会話コンテキストが失われることがある
2. **ページリロード後に履歴消失**: ブラウザをリロードすると会話履歴が完全にリセットされる
3. **サーバー再起動で全履歴消失**: MCPサーバーを再起動すると全てのセッションが消える

### Root Cause Analysis

| 問題箇所 | ファイル | 行番号 | 詳細 |
|---------|---------|--------|------|
| sessionIdの新規生成 | `useMcpChat.ts` | 92 | コンポーネントマウント時に毎回新しいsessionIdが生成される |
| インメモリストレージ | `server.ts` | 213 | `chatHistories`がMap（インメモリ）で永続化されない |
| sessionIdの非永続化 | `useMcpChat.ts` | - | sessionIdがlocalStorageに保存されていない |

## Requirements

### Functional Requirements

- [FR-001] フロントエンドは同一ユーザーの会話セッションを跨いで同じsessionIdを維持すること
- [FR-002] sessionIdはブラウザのlocalStorageに永続化されること
- [FR-003] MCPサーバーは会話履歴をファイルまたはデータベースに永続化すること
- [FR-004] サーバー再起動後も会話履歴が復元されること
- [FR-005] 新規会話開始時に明示的に新しいセッションを作成できること
- [FR-006] 会話履歴には適切なTTL（有効期限）を設定すること（デフォルト: 24時間）
- [FR-007] セッションごとに最大メッセージ数を制限すること（デフォルト: 100件）

### Non-Functional Requirements

- [NFR-001] セッション永続化のレイテンシは10ms以下であること
- [NFR-002] サーバー再起動時の履歴復元は5秒以内に完了すること
- [NFR-003] 履歴ファイルのサイズは1セッションあたり1MB以下に制限すること
- [NFR-004] 同時接続セッション数は1000以上をサポートすること

## Scope

### In Scope
- フロントエンド（useMcpChat.ts）のsessionId永続化
- MCPサーバー（server.ts）の会話履歴永続化
- セッション管理API（一覧、削除、エクスポート）

### Out of Scope
- ユーザー認証との連携（将来対応）
- マルチデバイス間の同期（将来対応）
- 会話履歴の暗号化（将来対応）

## Success Criteria

1. ページリロード後も直前の会話コンテキストが維持される
2. サーバー再起動後も会話履歴が復元される
3. 会話の文脈を理解した応答が継続的に得られる

## Related Documents

- `/home/ubuntu/Downloads/vow/frontend/app/dashboard/hooks/useMcpChat.ts`
- `/home/ubuntu/.mcp-multi-agent/mcp-task-distributor/src/server.ts`
- `/home/ubuntu/Downloads/vow/specs/COORDINATION.md`
