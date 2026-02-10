# VOW Project - Claude Agent Guide

This document provides context for Claude AI agents working on the VOW project.

## Single Entry Point Architecture（推奨）

**ユーザーは1つの親エージェントのみと対話します。**

```bash
# 親エージェントの起動
cd ~/Downloads/vow
claude --model opus
```

親エージェントが:
1. ユーザーリクエストを分析
2. 調査エージェント (researcher) に調査を委譲
3. 調査結果を元に実装エージェント (implementer) に修正を委譲
4. 結果を統合してユーザーに報告

詳細: `specs/AGENT_WORKFLOW.md`

## Project Overview

VOW (習慣・目標トラッカー) is a habit and goal tracking web application built with:
- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS 4
- **Backend**: TypeScript Lambda, Express
- **Database**: Supabase (PostgreSQL)
- **Infrastructure**: AWS (Amplify, Lambda, API Gateway)

**Production URL**: https://main.do1k9oyyorn24.amplifyapp.com/

## Quick Start for Agents

### 1. Understand the Task
```bash
# View project overview
cat .kiro/specs/project-overview/requirements.md

# View specific spec
cat .kiro/specs/{spec-name}/requirements.md
cat .kiro/specs/{spec-name}/tasks.md
```

### 2. Check Current Status
```bash
# Run agent status script
./scripts/agents/agent-status.sh

# Check git status
git status
git branch --show-current
```

### 3. Start Working
```bash
# Create feature branch
git checkout develop
git pull origin develop
git checkout -b feat/{spec-name}-{component}

# Make changes...

# Run tests
cd frontend && npm test
cd backend && npm test
```

## Directory Structure

```
vow/
├── frontend/                 # Next.js application
│   ├── app/
│   │   ├── dashboard/       # Main dashboard (components, hooks, types)
│   │   ├── demo/            # Demo mode
│   │   ├── embed/           # Embeddable widgets
│   │   └── login/           # Authentication
│   └── lib/                 # Shared utilities
├── backend/                 # Lambda backend
│   └── src/
│       ├── routers/         # API routes
│       ├── services/        # Business logic
│       └── repositories/    # Data access
├── infra/                   # Infrastructure (Terraform, CDK)
├── supabase/               # Database migrations
├── .kiro/                  # KIRO specifications
│   ├── specs/              # Feature specifications
│   └── steering/           # Project guidelines
└── .claude/                # Claude Code settings & skills
    └── skills/             # Custom agent skills
```

## Available Skills

Use these slash commands in Claude Code:

- `/spec list` - List all specifications and status
- `/spec {name}` - View specific spec details
- `/agents setup` - Initialize tmux environment
- `/agents list` - List active agent sessions
- `/delegate {spec} to {role}` - Delegate tasks to agent
- `/sync status` - Check all agent work status
- `/deploy dev` - Deploy to development
- `/deploy health` - Check deployment health

## Coding Conventions

### Frontend Components
- Naming: `Modal.*.tsx`, `Section.*.tsx`, `Widget.*.tsx`, `Form.*.tsx`
- Location: `frontend/app/dashboard/components/`
- Use design tokens (see `.kiro/steering/design-system.md`)

### Backend Services
- Naming: `{name}Service.ts`
- Location: `backend/src/services/`
- Use Zod for validation

### Tests
- Framework: Jest, fast-check
- Location: `__tests__/` directories
- Naming: `*.test.ts`, `*.test.tsx`

## Key Specifications

### High Priority (In Progress)
1. **habit-goal-level-system** (82%) - THLI-24 level assessment
2. **user-level-system** (52%) - XP and user levels
3. **board-kanban-section** (36%) - Kanban board view

### Recently Completed
- gamification-xp-balance
- level-system-rebalancing
- slack-integration

See `.kiro/specs/project-overview/tasks.md` for full status.

## Git Workflow

1. Always branch from `develop`
2. Branch naming: `feat/{spec-name}-{scope}`
3. Commit format: `feat({scope}): {description}`
4. Run tests before pushing
5. Never push directly to `main`

## Deployment

```bash
# Development (automatic on push to develop)
git push origin develop

# Check health
curl https://lyry9riumg.execute-api.ap-northeast-1.amazonaws.com/development/health
```

See `.kiro/steering/deployment.md` for full procedures.

## Multi-Agent Coordination

When working with other agents:

1. **Check for conflicts**: `./scripts/agents/agent-status.sh`
2. **Claim files**: Document which files you're modifying
3. **Use feature branches**: One branch per agent/task
4. **Sync regularly**: Merge develop into your branch
5. **Communicate**: Leave notes in delegation context files

## Remote Agent Collaboration (Multi-Machine)

For agents running on different machines, use GitHub as the coordination hub.

### Quick Start (New Machine)

```bash
# Clone and setup
git clone https://github.com/{owner}/vow.git
cd vow
cat CLAUDE.md  # Read this guide

# Check available tasks
gh issue list --label "agent-task"

# Claim a task
gh issue edit {number} --add-assignee @me
```

### Coordination via GitHub

- **Issues**: Task assignment and tracking (use `agent-task` label)
- **Branches**: One feature branch per agent/task
- **PRs**: All changes go through Pull Requests
- **Actions**: CI validates all changes automatically

### GitHub Actions Commands

In issue comments:
- `/agent-status` - Trigger status report
- `/list-tasks` - List all open tasks

Manual workflow dispatch:
- `agent-sync.yml` - Generate status reports and contexts
- `agent-ci.yml` - Runs automatically on PRs

### Remote Workflow

```bash
# 1. Claim task via GitHub Issue
gh issue edit {number} --add-assignee @me

# 2. Create branch and work
git checkout -b feat/{spec}-{role}
# ... make changes ...

# 3. Push and create PR
git push -u origin feat/{spec}-{role}
gh pr create --title "feat: ..." --body "Closes #{issue}"

# 4. Wait for CI and merge
gh pr checks
gh pr merge --auto --squash
```

See `.kiro/specs/claude-agent-delegation-workflow/templates/remote-collaboration-guide.md` for full details.

## MCP Multi-Agent Scale System (10-20 Agents)

For large-scale parallel development with 10-20 Claude agents, use the MCP Task Distribution System.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              Central Task Server (port 3456)                 │
│            http://192.168.2.126:3456                        │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │  Tasks  │  │ Agents  │  │  Auth   │  │   SSE   │        │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘        │
└─────────────────────────────────────────────────────────────┘
        ▲                           ▲
        │ HTTP                      │ HTTP
        │                           │
┌───────┴───────┐           ┌───────┴───────┐
│   Machine A   │           │   Machine B   │
│  (This Host)  │           │   (Remote)    │
│  10 agents    │           │  10 agents    │
└───────────────┘           └───────────────┘
```

### Quick Start (Local Machine)

```bash
# Start environment with 10 agents
./scripts/agents/multi-agent-launcher.sh start 10

# Check status
./scripts/agents/multi-agent-launcher.sh status

# Connect to tmux session
./scripts/agents/multi-agent-launcher.sh connect

# In each tmux pane, Claude starts automatically configured with MCP
# Or start manually:
claude --mcp-config /home/ubuntu/.mcp-multi-agent/mcp-config.json
```

### Agent Roles for VOW

| Pane | Role | Working Directory | Focus |
|------|------|-------------------|-------|
| 0 | Manager | vow/ | Task coordination |
| 1-3 | Frontend | vow/frontend/ | React components |
| 4-5 | Backend | vow/backend/ | Lambda services |
| 6-7 | Tester | vow/ | Jest, property tests |
| 8 | Spec | vow/.kiro/specs/ | KIRO specifications |
| 9 | DevOps | vow/infra/ | Deployment, AWS |
| 10 | Architect | vow/ | System design |
| 11 | Reviewer | vow/ | Code review |
| 12+ | General | vow/ | Flexible |

### Remote Machine Setup

```bash
# 1. Get connection info from host
./scripts/agents/multi-agent-launcher.sh remote-info

# 2. On remote machine, set environment
export TASK_SERVER_URL=http://192.168.2.126:3456
export TASK_SERVER_TOKEN=mcp-2583b09967362d705553582c115c81b4
export AGENT_NAME="Remote-Agent-1"
export AGENT_ROLE="developer"
export MACHINE_ID="remote-machine"

# 3. Test connection
curl -H "Authorization: Bearer $TASK_SERVER_TOKEN" $TASK_SERVER_URL/health

# 4. Copy MCP config and start Claude
scp host:/home/ubuntu/.mcp-multi-agent/mcp-config.json ./
claude --mcp-config mcp-config.json
```

### MCP Tools Available

**Manager Tools:**
- `register_agent` - Register with server
- `list_agents` - View all agents
- `create_task` - Create new task
- `assign_task` - Assign task to agent
- `dashboard` - View statistics

**Worker Tools:**
- `get_my_tasks` - View assigned tasks
- `claim_task` - Start working on task
- `submit_result` - Report completion
- `heartbeat` - Update status

### Server Management

```bash
# Server commands (from MCP directory)
cd /home/ubuntu/.mcp-multi-agent

./setup_multi_agent.sh start-server    # Start server
./setup_multi_agent.sh server-status   # Check status
./setup_multi_agent.sh stop-server     # Stop server
./setup_multi_agent.sh show-config     # View configuration
./setup_multi_agent.sh generate-token  # New auth token
```

### Manager Agent Commands

Managerロールのエージェントは以下のMCPツールで管理操作を実行できます：

**信頼関係管理:**
```
list_trusted_machines        # 信頼済みマシン一覧
add_trusted_machine          # マシンを信頼リストに追加
update_machine_trust         # 信頼設定を更新
remove_trusted_machine       # マシンを削除
```

**エージェント管理:**
```
invite_agent                 # リモートマシンにエージェント招待
remove_agent                 # エージェントを削除
```

**LDAP設定:**
```
configure_ldap               # OpenLDAP連携を設定
get_ldap_config              # 現在のLDAP設定を確認
```

**拡張ダッシュボード:**
```
manager_dashboard            # マシン・信頼情報を含む詳細統計
```

### Trust Levels (信頼レベル)

| レベル | 最大エージェント数 | 説明 |
|--------|------------------|------|
| none | 0 | アクセス不可 |
| basic | 5 | 基本ロールのみ |
| elevated | 10 | 全ロール（manager除く） |
| full | 20 | 完全アクセス |

## Document Map (ドキュメント一覧)

**Last Updated**: 2026-02-04

> **重要**: MCPサーバーのパスは `/home/ubuntu/.mcp-multi-agent/` です（ドット付き）。
> `/home/ubuntu/mcp-multi-agent/`（ドットなし）は間違いです。

エージェントが参照すべきドキュメントの優先順位:

### 1. 作業開始時に必読 (必須)
| 優先度 | ドキュメント | 場所 | 説明 |
|--------|--------------|------|------|
| 1 | このファイル | `/CLAUDE.md` | プロジェクト全体ガイド・エントリポイント |
| 2 | 調整ボード | `/.claude/coordination/BOARD.md` | 現在のタスク割り当て・エージェント状態 |

### 2. スプリント・タスク確認 (作業に応じて)
| ドキュメント | 場所 | 説明 | 更新頻度 |
|--------------|------|------|----------|
| AI統合スプリント | `/.kiro/specs/COORDINATION.md` | AI Agents統合関連（Coach Mode/Manager Mode） | 高 |
| MCP統合スプリント | `/specs/COORDINATION.md` | MCP Remote統合関連（MOCセクション） | 高 |

### 3. 機能仕様書 (担当機能のみ)
| ディレクトリ | 説明 | 件数 |
|--------------|------|------|
| `/.kiro/specs/{feature}/` | 各機能の仕様書（requirements.md, design.md, tasks.md） | 約60件 |
| `/specs/{feature}/` | 新規仕様書 | 増加中 |

### 4. 運用・設定ガイド (参照用)
| ドキュメント | 場所 | 説明 |
|--------------|------|------|
| エージェント運用 | `/docs/agent-operations.md` | QA/Issue巡回エージェント起動手順 |
| MCPサーバー | `/home/ubuntu/.mcp-multi-agent/README.md` | MCPサーバー管理・起動方法 |
| デプロイ | `/docs/DEPLOYMENT_GUIDE.md` | 本番デプロイ手順 |
| セットアップ | `/docs/SETUP.md` | 開発環境構築 |

### ドキュメント間の関係図

```
CLAUDE.md (このファイル)
    │
    ├── /.claude/coordination/BOARD.md ... タスク割り当て
    │
    ├── /.kiro/specs/COORDINATION.md ... AI Agents統合スプリント
    │   └── /.kiro/specs/ai-agents-integration/ ... 詳細仕様
    │
    ├── /specs/COORDINATION.md ... MCP Remote統合スプリント
    │   └── /specs/moc-mcp-remote-integration/ ... 詳細仕様
    │
    └── /docs/agent-operations.md ... 運用ガイド
```

### 正しいパス一覧

| 用途 | 正しいパス |
|------|-----------|
| VOWプロジェクト | `/home/ubuntu/Downloads/vow/` |
| MCPサーバー | `/home/ubuntu/.mcp-multi-agent/` |
| MCP設定ファイル | `/home/ubuntu/.mcp-multi-agent/mcp-config.json` |
| セットアップスクリプト | `/home/ubuntu/.mcp-multi-agent/setup_multi_agent.sh` |

## Infrastructure Status & Known Issues

**Last Updated**: 2026-02-10

### Security Audit Summary (2026-02-10)

セキュリティ監査により以下のコミットが作成済み:
- `5aff3e98` — フロントエンド・バックエンドの脆弱性修正（10件）
- `8942019c` — インフラセキュリティ基盤（WAF, Secrets Manager, RLS, S3 Backend）
- `5d1f7ab2` — セキュリティ運用手順書

運用手順書: `scripts/security/SECURITY-OPS-RUNBOOK.md`

### IaC管理の現状

| 環境 | 管理ツール | 状態 |
|------|-----------|------|
| Production (Lambda, API GW, Cognito, VPC) | Terraform | ステート管理中 |
| Production (Amplify) | 手動/Terraform定義あり | ステートに未反映 |
| Development (全リソース) | CloudFormation/CDK/手動 | Terraform管理外 |
| CDK残骸 (VowBackendTsStack) | CDK | 使用状況要確認 |

### 未適用のTerraformリソース
- WAF (`waf.tf`) — `terraform apply` が必要
- Secrets Manager (`secrets.tf`) — `terraform apply` が必要
- Supabase RLSマイグレーション — `supabase db push` が必要
- S3バックエンド移行 — `terraform init -migrate-state` が必要

### コスト最適化
- NAT Gateway x2 が稼働中 (~$65/月) — Aurora未使用のため削除検討
- CDK残骸のS3バケット (9個) — 削除検討

### 関連ドキュメント
- セキュリティ運用手順書: `scripts/security/SECURITY-OPS-RUNBOOK.md`
- シークレットローテーション: `scripts/security/secrets-rotation-runbook.sh`
- Terraform定義: `infra/terraform/` (15ファイル, ~3,570行)

## Getting Help

- Project overview: `.kiro/specs/project-overview/`
- Design system: `.kiro/steering/design-system.md`
- Deployment: `.kiro/steering/deployment.md`
- Agent workflow: `.kiro/specs/claude-agent-delegation-workflow/`
- Remote collaboration: `.kiro/specs/claude-agent-delegation-workflow/templates/remote-collaboration-guide.md`
