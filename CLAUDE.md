# VOW Project - Claude Agent Guide

This document provides context for Claude AI agents working on the VOW project.

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

## Getting Help

- Project overview: `.kiro/specs/project-overview/`
- Design system: `.kiro/steering/design-system.md`
- Deployment: `.kiro/steering/deployment.md`
- Agent workflow: `.kiro/specs/claude-agent-delegation-workflow/`
- Remote collaboration: `.kiro/specs/claude-agent-delegation-workflow/templates/remote-collaboration-guide.md`
