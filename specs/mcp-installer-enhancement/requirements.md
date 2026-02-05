# MCP Installer Enhancement Specification - Requirements

## Overview
- Purpose: MCPサーバインストーラの機能強化、リモートMCPサーバ対応の統合仕様
- Status: Draft
- Version: 1.0.0
- Last Updated: 2026-02-05
- Author: vow-spec-architect

---

## Background

### Current State Analysis

#### 1. Existing MCP Server (`/home/ubuntu/.mcp-multi-agent/`)

**Configuration:**
```
TASK_SERVER_HOST=0.0.0.0
TASK_SERVER_PORT=3456
TASK_SERVER_TOKEN=mcp-dca3c407f66c5b62840b06c3d624c857
TASK_SERVER_URL=http://192.168.2.200:3456
```

**Verified Capabilities:**
- Agent registration and management
- Task creation, assignment, and submission
- SSE event broadcasting for real-time updates
- Chat endpoint with Claude Code CLI integration
- Session memory for multi-turn conversations
- CORS enabled (all origins allowed)
- Bearer Token authentication
- 0.0.0.0 binding (LAN-accessible)

**Current Status:**
- Server running: YES (port 3456)
- Health check: `{"success":true,"data":{"status":"running"}}`
- Remote access ready: YES (0.0.0.0 binding)

#### 2. Existing Installers

| Installer | Location | Version | Purpose |
|-----------|----------|---------|---------|
| Server Installer | `/home/ubuntu/Downloads/vow/infra/mcp-installer/install.sh` | 1.1.0 | Local MCP server setup |
| Remote Installer | `/home/ubuntu/Downloads/vow/infra/mcp-remote-installer/install.sh` | 1.0.0 | Remote agent client setup |

**Server Installer Features:**
- Node.js/npm prerequisite check (Node.js 16+)
- Directory structure creation
- Embedded TypeScript source files (no external repo dependency)
- npm install and TypeScript build
- Configuration file generation (server.env, mcp-config.json)
- Management script (`setup_multi_agent.sh`)

**Remote Installer Features:**
- Command-line argument parsing (--server-url, --token, --name, --role)
- Server connectivity and authentication test before install
- MCP client (mcp-bridge) installation
- Claude Code MCP config generation (`~/.claude/mcp.json`)
- Convenience scripts (start-agent.sh, check-status.sh)

---

## Problem Statement

### P-001: No Unified Installer for Dual-Mode Deployment
現在、サーバ用とクライアント用のインストーラが分離しており、同一マシンがサーバにもクライアントにもなれる統合インストーラが存在しない。

### P-002: Missing TLS/SSL Support
LAN内であっても、セキュリティを考慮するとTLS対応が望ましい。現状は平文HTTP通信のみ。

### P-003: Configuration Sharing Challenge
リモートマシンへのURL/Token共有が手動コピーのみで、設定ミスが発生しやすい。

### P-004: No Service Registration
systemdなどへのサービス登録がなく、手動起動が必要。

### P-005: Upgrade Path Not Defined
既存インストールのアップグレード手順が明確でない。

---

## Functional Requirements

### FR-001: Unified Installer Script
単一のインストーラで、サーバモード・クライアントモード・両方を選択できる。

**Acceptance Criteria:**
- [ ] `--mode server` でサーバのみインストール
- [ ] `--mode client` でクライアントのみインストール
- [ ] `--mode both` でサーバ+クライアントをインストール
- [ ] デフォルトは `--mode server`（既存動作互換）
- [ ] 既存の個別インストーラも維持（後方互換性）

### FR-002: Remote Server Configuration Export
サーバインストール後、リモート接続情報を簡単に共有できる。

**Acceptance Criteria:**
- [ ] `setup_multi_agent.sh export-config` で接続情報をファイル出力
- [ ] 出力形式: JSON (`remote-config.json`)
- [ ] 出力内容: serverUrl, token, serverName, localIp, port
- [ ] 標準出力にも表示（コピー&ペースト用）

### FR-003: Remote Installer One-Liner Support
リモートマシンから1行コマンドでインストール可能。

**Acceptance Criteria:**
- [ ] `curl ... | bash -s -- --server-url URL --token TOKEN` 形式をサポート
- [ ] GitHub raw URL または Lambda経由でのスクリプト配信
- [ ] インストール前の接続テスト自動実行

### FR-004: Connection Verification
インストール後の接続確認を自動化。

**Acceptance Criteria:**
- [ ] サーバモード: 起動後のヘルスチェック自動実行
- [ ] クライアントモード: サーバ接続・認証テスト実行
- [ ] 失敗時の詳細エラーメッセージと対処法表示
- [ ] `--verify-only` フラグで検証のみ実行

### FR-005: Systemd Service Registration (Optional)
サーバをsystemdサービスとして登録。

**Acceptance Criteria:**
- [ ] `--systemd` フラグでサービスファイル生成
- [ ] `systemctl enable/start mcp-task-server` で自動起動設定
- [ ] ユーザーサービスとしてインストール（root不要）
- [ ] `setup_multi_agent.sh install-service` コマンド追加

### FR-006: Upgrade Support
既存インストールのアップグレードをサポート。

**Acceptance Criteria:**
- [ ] 既存インストールの検出
- [ ] 設定ファイルのバックアップ
- [ ] ソースコードのみ更新（設定保持）
- [ ] `--upgrade` フラグで明示的にアップグレードモード
- [ ] トークンは既存のものを維持

### FR-007: Multi-Network Interface Support
複数NICを持つマシンでの適切なIPアドレス選択。

**Acceptance Criteria:**
- [ ] `--bind-address` オプションで明示的指定
- [ ] 自動検出時はデフォルトルートのIPを使用
- [ ] 利用可能なIPアドレス一覧の表示オプション

---

## Non-Functional Requirements

### NFR-001: Installation Time
- サーバモード: 5分以内（npm install含む）
- クライアントモード: 3分以内
- 検証のみ: 10秒以内

### NFR-002: Platform Compatibility
- Node.js 16+ (推奨 18+, 20+)
- Ubuntu 20.04+, Debian 11+
- macOS 12+ (Intel/Apple Silicon)
- Bash 4.0+

### NFR-003: Idempotency
- 同一オプションでの再実行で同じ結果
- 既存インストールの検出と適切なスキップ/更新処理

### NFR-004: Security
- トークンは生成時のみ表示
- 設定ファイルのパーミッション: 600
- `.env` ファイルは `.gitignore` に含める

### NFR-005: Error Handling
- 各ステップでの明確なエラーメッセージ
- ネットワークエラー時のリトライ（3回）
- Exit code: 0=成功, 1=エラー, 2=設定エラー

### NFR-006: Documentation
- `--help` での詳細ヘルプ表示
- インストール完了時のクイックスタートガイド表示
- READMEファイルの自動生成/更新

---

## Technical Constraints

### TC-001: Existing Infrastructure Compatibility
- 既存の `/home/ubuntu/.mcp-multi-agent/` ディレクトリ構造を維持
- `setup_multi_agent.sh` のコマンド互換性を維持
- 既存のMCP設定ファイル形式を維持

### TC-002: Network Requirements
- TCP port 3456 (configurable via `--port`)
- 0.0.0.0 binding for LAN access
- CORS headers for browser access (VOW frontend)

### TC-003: Claude Code Integration
- `claude --mcp-config` コマンドとの互換性
- 環境変数: `TASK_SERVER_URL`, `TASK_SERVER_TOKEN`
- MCP SDK v1.25.3+ 互換

---

## Dependencies

| Component | Version | Purpose | Required |
|-----------|---------|---------|----------|
| Node.js | >= 16.0 | Runtime | Yes |
| npm | >= 8.0 | Package manager | Yes |
| openssl | any | Token generation | Yes |
| curl | any | Connectivity test | Yes |
| git | any | Source clone (optional) | No |
| systemd | any | Service registration | No |

---

## Out of Scope (v1.0)

- TLS/SSL support (future v1.1)
- mDNS/Avahi auto-discovery (future v1.2)
- Docker/Kubernetes deployment
- Windows native support (WSL is supported)
- Graphical installer
- Package manager integration (apt, brew)
- Auto-update mechanism
- Load balancing across multiple servers

---

## Related Specifications

| Spec | Relation |
|------|----------|
| `/specs/moc-mcp-remote-integration/` | MCP integration with VOW frontend |
| `/specs/mcp-remote-connection-fix/` | Connection issue fixes |
| `/specs/cli-mcp-integration/` | CLI tools integration |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Installation success rate (first try) | >= 95% |
| Remote connection success (after install) | >= 95% |
| Documentation completeness | 100% |
| Backward compatibility with v1.0 | 100% |
| Installation time (server mode) | < 5 min |
