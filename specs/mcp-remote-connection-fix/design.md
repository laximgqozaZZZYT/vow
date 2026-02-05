# MCP Remote Connection Fix - Design Document

## Overview
- **Purpose**: MCPリモートサーバ接続問題の技術設計
- **Status**: Complete
- **Version**: 1.0.0
- **Last Updated**: 2026-02-04
- **Author**: vow-spec-architect

## Current Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              Central Task Server (port 3456)                 │
│            http://192.168.2.200:3456                        │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │  Tasks  │  │ Agents  │  │  Auth   │  │   SSE   │        │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘        │
└─────────────────────────────────────────────────────────────┘
        ▲                           ▲
        │ HTTP                      │ HTTP
        │                           │
┌───────┴───────┐           ┌───────┴───────┐
│   Frontend    │           │  Claude CLI   │
│  (Browser)    │           │  (MCP Bridge) │
└───────────────┘           └───────────────┘
```

## Investigation Results

### Server Status: OK
- MCPサーバーはポート3456で正常稼働
- Health check正常応答
- トークン: `mcp-dca3c407f66c5b62840b06c3d624c857`

### Configuration Files

| File | Setting | Value |
|------|---------|-------|
| `server.env` | TASK_SERVER_URL | http://192.168.2.200:3456 |
| `mcp-config.json` | (internal) | http://localhost:3456 |
| Host IP | actual | 192.168.2.200 |

**結論**: 設定は正しい。ローカル接続はlocalhost、リモート接続は192.168.2.200を使用。

## Potential Issues

### 1. localStorage Cache
フロントエンドが古いトークンをキャッシュしている可能性。

**解決策**: localStorage クリアまたは設定UI経由で再登録

### 2. SSE Retry Limit
3回リトライ後に永続的エラー状態。

**解決策**: 手動再接続ボタンの追加（将来対応）

### 3. CORS (Remote Access)
リモートマシンからのアクセス時にCORS問題が発生する可能性。

**現状**: サーバーはCORS対応済み（`cors()` ミドルウェア使用）

## Resolution

**問題は解決済み**:
- IP設定は正しい（192.168.2.200）
- トークンは一致
- サーバーは正常稼働

追加の改善は将来対応として tasks.md に記録。
