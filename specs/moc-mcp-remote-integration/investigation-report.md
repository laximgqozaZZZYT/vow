# MOC Section MCP Remote Integration - Investigation Report

## Overview
- Purpose: MOCセクションへのMCPリモート接続統合調査
- Status: Investigation Complete
- Version: 1.0.0
- Last Updated: 2026-02-03
- Author: vow-spec-architect

---

## 1. Current MCP Configuration Analysis

### 1.1 MCP Task Server Location
```
/home/ubuntu/.mcp-multi-agent/    # 注意: ドット(.)付き！
```

### 1.2 Server Configuration (`mcp-config.json`)
```json
{
  "mcpServers": {
    "task-distributor": {
      "command": "node",
      "args": ["/home/ubuntu/.mcp-multi-agent/mcp-task-distributor/build/mcp-bridge.js"],
      "env": {
        "TASK_SERVER_URL": "${TASK_SERVER_URL:-http://localhost:3456}",
        "TASK_SERVER_TOKEN": "${TASK_SERVER_TOKEN}",
        "AGENT_NAME": "${AGENT_NAME:-Unnamed}",
        "AGENT_ROLE": "${AGENT_ROLE:-general}",
        "MACHINE_ID": "${MACHINE_ID:-local}"
      }
    }
  }
}
```

### 1.3 Server Architecture
```
Central Task Server (HTTP + SSE on port 3456)
  |
  +-- Tasks Management
  +-- Agents Registry
  +-- Auth (Token-based)
  +-- SSE Event Stream
  +-- Trust Management (Manager-only)
  +-- LDAP Integration
```

### 1.4 Available REST API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check (no auth) |
| `/events` | GET | SSE event stream |
| `/dashboard` | GET | Statistics dashboard |
| `/agents/register` | POST | Register agent |
| `/agents` | GET | List all agents |
| `/agents/:id/heartbeat` | POST | Agent heartbeat |
| `/tasks` | POST | Create task |
| `/tasks` | GET | List tasks (with filters) |
| `/tasks/:id` | GET | Task details |
| `/tasks/:id/assign` | POST | Assign task |
| `/tasks/:id/claim` | POST | Claim task |
| `/tasks/:id/submit` | POST | Submit result |
| `/trust/machines` | GET/POST | Trust management |
| `/config/ldap` | GET/PUT | LDAP configuration |

---

## 2. Existing MOC Section Analysis

### 2.1 File Location
```
/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.MOC.tsx
```

### 2.2 Key Features
- Multi-agent Orchestration Center
- Tabs: Chat, Tasks, Agents, History
- Group chat with AI agents
- MCP server connection support
- Real-time SSE updates
- Task management UI

### 2.3 Related Hooks
- `useMultiAgentServer.ts`: Multiple MCP server connection management
- `useMcpChat.ts`: MCP-based chat communication

### 2.4 Current MCP Integration
MOCセクションは既に以下の機能を持っています:

1. **Multi-Server Support**: 複数のMCPサーバへの同時接続
2. **SSE Real-time Updates**: Server-Sent Eventsによるリアルタイム更新
3. **Agent Registry**: エージェント登録・監視
4. **Task Management**: タスク作成・割り当て・完了報告
5. **Fallback Mechanism**: MCP失敗時のMastra APIへのフォールバック

---

## 3. Claude Code Remote Execution Methods

### 3.1 Current Approach (MCP Bridge)
```
VOW Web UI --> MCP Task Server --> MCP Bridge --> Claude Code (Local)
```

現在のシステムでは、Claude Codeは各マシン上でローカルに実行され、MCP Bridgeを介してタスクサーバと通信しています。

### 3.2 Remote Execution Options

#### Option A: MCP HTTP Transport (Recommended)
Anthropic API の MCP connector を使用し、リモートMCPサーバに直接接続。

```
VOW Web UI --> Anthropic API (with MCP connector) --> Remote MCP Server
```

**Pros:**
- Anthropicが接続管理を自動処理
- クライアントコード不要
- ツール検出・エラー処理の自動化

**Cons:**
- Anthropic API依存
- レイテンシ追加

#### Option B: Claude Agent SDK Direct Integration
Claude Agent SDKをバックエンドサービスとして実行。

```
VOW Web UI --> VOW Backend --> Claude Agent SDK Server --> File System
```

**Pros:**
- 完全なエージェント制御
- カスタムツール統合可能
- Claude Codeと同等の機能

**Cons:**
- サーバーインフラが必要
- セキュリティ考慮が複雑

#### Option C: Enhanced MCP Task Server (Current + Extensions)
既存のMCP Task Serverを拡張し、Claude Code実行機能を追加。

```
VOW Web UI --> Enhanced MCP Task Server --> Claude Code Instances
                    |
                    +-- Task Queue
                    +-- Agent Execution Manager
                    +-- Result Collection
```

**Pros:**
- 既存インフラを活用
- 漸進的な拡張が可能
- 複数エージェントの並列実行

**Cons:**
- Claude Code CLIの自動化が必要

---

## 4. Current System Gaps

### 4.1 Missing Features for Remote vow Modification

| Feature | Current Status | Required |
|---------|---------------|----------|
| Task to Claude Code routing | Not implemented | Yes |
| File change tracking | Not implemented | Yes |
| Git integration for tasks | Not implemented | Yes |
| PR creation from results | Not implemented | Yes |
| Real-time code streaming | Partial (SSE exists) | Enhanced |

### 4.2 Security Considerations
- 現在のシステムはトークン認証のみ
- ファイルシステムアクセスは無制限
- コード実行のサンドボックスなし

---

## 5. Recommendations

### 5.1 Short-term (Phase 1): UI Integration
- MOCセクションに「Remote Task」タブを追加
- タスク入力フォームの強化
- コード差分表示機能

### 5.2 Medium-term (Phase 2): Backend Enhancement
- MCP Task Serverに Claude Code 実行機能を追加
- Git統合（ブランチ作成、コミット、PR）
- 結果の構造化保存

### 5.3 Long-term (Phase 3): Full Agent SDK Integration
- Claude Agent SDK ベースのサービス構築
- セキュアなサンドボックス実行環境
- マルチテナント対応

---

## 6. References

- [Claude Agent SDK MCP Documentation](https://platform.claude.com/docs/en/agent-sdk/mcp)
- [Claude Code MCP Integration](https://code.claude.com/docs/en/mcp)
- [Anthropic Agent Capabilities API](https://www.anthropic.com/news/agent-capabilities-api)
- [MCP in the SDK](https://docs.claude.com/en/docs/agent-sdk/mcp)
