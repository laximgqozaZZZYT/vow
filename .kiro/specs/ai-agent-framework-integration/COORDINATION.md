# AI Agent Framework Integration - Coordination Document

## Overview

**Status**: Ready for Parallel Development
**Created**: 2026-02-01
**Author**: vow-spec-architect (Claude Opus 4.5)

本ドキュメントは、MastraおよびStrands Agentsフレームワーク統合の4つの並列ワークストリームを調整するためのものです。

---

## Current Sprint Goals

### Sprint 1: Core Foundation (Week 1-2)
- Stream B: Mastra/Strandsパッケージインストールと設定
- Stream B: 共通ツールライブラリ作成
- Stream C: RAG用pgvector拡張セットアップ準備

---

## Directory Structure Proposal (提案ディレクトリ構造)

```
vow/
├── frontend/
│   ├── app/
│   │   └── dashboard/
│   │       ├── components/
│   │       │   ├── Section.Coach.tsx          # 既存 - Mastra統合対象
│   │       │   ├── Section.Agents.tsx         # 既存 - 強化対象
│   │       │   ├── Widget.AgentStatus.tsx     # [NEW] Stream A
│   │       │   ├── Widget.WorkflowProgress.tsx # [NEW] Stream A
│   │       │   ├── Widget.ToolCallDisplay.tsx # [NEW] Stream A
│   │       │   ├── Widget.StreamingResponse.tsx # [NEW] Stream A
│   │       │   ├── Modal.AgentConfig.tsx      # [NEW] Stream A
│   │       │   └── Modal.TaskCreate.tsx       # [NEW] Stream A
│   │       ├── hooks/
│   │       │   ├── useMultiAgentServer.ts     # 既存
│   │       │   ├── useMastraAgent.ts          # [NEW] Stream A
│   │       │   └── useWorkflowProgress.ts     # [NEW] Stream A
│   │       └── types/
│   │           ├── agent.types.ts             # 既存
│   │           └── mastra.types.ts            # [NEW] Stream A
│   └── lib/
│       ├── mastra/                            # [NEW] Stream B
│       │   ├── index.ts                       # Mastra instance
│       │   ├── config.ts                      # Provider configuration
│       │   └── types.ts                       # Type definitions
│       └── agent-tools/                       # [NEW] Stream B - Shared tools
│           ├── index.ts                       # Tool exports
│           ├── habit-tools.ts                 # CRUD, analysis tools
│           ├── goal-tools.ts                  # Goal management tools
│           ├── activity-tools.ts              # Activity logging tools
│           ├── calendar-tools.ts              # Calendar/scheduling tools
│           ├── notification-tools.ts          # Notification tools
│           └── error-handler.ts               # Error handling utilities
│
├── backend/
│   └── src/
│       ├── agents/                            # [NEW] Agent implementations
│       │   ├── mastra/                        # [NEW] Stream B
│       │   │   ├── index.ts                   # Exports
│       │   │   ├── config.ts                  # Mastra configuration
│       │   │   ├── vow-coach-agent.ts         # VOW AI Coach Agent
│       │   │   ├── base-agent.ts              # Base agent class
│       │   │   └── workflows/                 # [NEW] Stream B
│       │   │       ├── habit-analysis.ts      # Habit Analysis Workflow
│       │   │       └── goal-achievement.ts    # Goal Achievement Workflow
│       │   └── strands/                       # [NEW] Stream B
│       │       ├── index.ts                   # Exports
│       │       ├── config.ts                  # Strands configuration
│       │       ├── mcp-client.ts              # MCP Task Server client
│       │       ├── task-orchestrator.ts       # Task Orchestrator Agent
│       │       ├── base-worker.ts             # Base Worker Agent
│       │       └── workers/                   # [NEW] Stream B
│       │           ├── frontend-worker.ts
│       │           ├── backend-worker.ts
│       │           ├── tester-worker.ts
│       │           └── spec-worker.ts
│       ├── services/
│       │   ├── personalizationEngine.ts       # 既存 - Agent統合
│       │   ├── aiCoachService.ts              # 既存 - Mastra移行対象
│       │   └── embedding-service.ts           # [NEW] Stream C - RAG
│       └── routers/
│           ├── ai.ts                          # 既存
│           └── rag.ts                         # [NEW] Stream C - RAG API
│
├── supabase/
│   └── migrations/
│       └── 20260202000000_add_pgvector_embeddings.sql  # [NEW] Stream C
│
└── __tests__/                                 # [NEW] Stream D
    ├── agent-tools/
    │   ├── habit-tools.test.ts
    │   ├── goal-tools.test.ts
    │   └── activity-tools.test.ts
    ├── agents/
    │   ├── mastra/
    │   │   ├── vow-coach-agent.test.ts
    │   │   └── workflows.test.ts
    │   └── strands/
    │       ├── task-orchestrator.test.ts
    │       └── workers.test.ts
    └── services/
        └── rag/
            └── embedding-service.test.ts
```

---

## Work Streams - Initial Tasks (各ストリームの初期タスク)

### Stream A: Frontend Agent (Priority: After B completes Phase 1)

**Initial Tasks:**
1. **A-001**: Create `useMastraAgent.ts` hook for Mastra agent communication
   - Streaming response handling
   - Tool call event handling
   - Error boundary integration
   - Status: `pending`
   - Blocked by: B-001, B-002

2. **A-002**: Create `Widget.StreamingResponse.tsx` component
   - Typewriter effect for streaming text
   - Markdown rendering support
   - Code syntax highlighting
   - Status: `pending`
   - Blocked by: A-001

3. **A-003**: Create `Widget.ToolCallDisplay.tsx` component
   - Tool call visualization with icons
   - Progress indicator during execution
   - Result display formatting
   - Status: `pending`
   - Blocked by: A-001

---

### Stream B: Backend Agent (Priority: Highest - Start First)

**Initial Tasks:**
1. **B-001**: Install Mastra packages and create base configuration
   - `npm install @mastra/core` in frontend and backend
   - Create `backend/src/agents/mastra/config.ts`
   - Create `frontend/lib/mastra/config.ts`
   - Add environment variables to `.env.local`
   - Status: `pending`
   - Blocked by: None

2. **B-002**: Install Strands Agents SDK and create configuration
   - `npm install @strands-agents/sdk` in backend
   - Create `backend/src/agents/strands/config.ts`
   - Create TypeScript interfaces
   - Status: `pending`
   - Blocked by: None

3. **B-003**: Create shared tool library foundation
   - Create `lib/agent-tools/index.ts`
   - Create `lib/agent-tools/habit-tools.ts` with CRUD operations
   - Add Zod validation schemas
   - Status: `pending`
   - Blocked by: None

4. **B-004**: Create error handling infrastructure
   - Create `lib/agent-tools/error-handler.ts`
   - Implement retry logic with exponential backoff
   - Implement circuit breaker pattern
   - Status: `pending`
   - Blocked by: None

---

### Stream C: Integration Agent (Priority: After B completes Phase 1)

**Initial Tasks:**
1. **C-001**: Create pgvector migration for Supabase
   - Enable pgvector extension
   - Create embeddings table with RLS policies
   - Create vector similarity search index
   - Status: `pending`
   - Blocked by: None (can start in parallel)

2. **C-002**: Create embedding service foundation
   - Create `backend/src/services/embedding-service.ts`
   - Implement OpenAI embedding generation
   - Implement batch embedding updates
   - Status: `pending`
   - Blocked by: C-001

3. **C-003**: Connect Strands agents to MCP Task Server
   - Create `backend/src/agents/strands/mcp-client.ts`
   - Implement SSE event handling
   - Add reconnection logic
   - Status: `pending`
   - Blocked by: B-002

---

### Stream D: Testing Agent (Priority: After A, B, C complete)

**Initial Tasks:**
1. **D-001**: Create test infrastructure for agent tools
   - Setup Jest configuration for agent tests
   - Create mock Supabase client
   - Create test utilities for agent responses
   - Status: `pending`
   - Blocked by: B-003

2. **D-002**: Create unit tests for habit-tools
   - Test CRUD operations
   - Test validation schemas
   - Property-based tests with fast-check
   - Status: `pending`
   - Blocked by: B-003, D-001

3. **D-003**: Create integration tests for workflows
   - Test Habit Analysis Workflow
   - Test Goal Achievement Workflow
   - Test error recovery
   - Status: `pending`
   - Blocked by: B-005 (workflows)

---

## Task Assignment Matrix

| Task ID | Stream | Assignee | Status | Dependencies |
|---------|--------|----------|--------|--------------|
| B-001   | B      | -        | pending | None |
| B-002   | B      | -        | pending | None |
| B-003   | B      | -        | pending | None |
| B-004   | B      | -        | pending | None |
| C-001   | C      | -        | pending | None |
| A-001   | A      | -        | pending | B-001, B-002 |
| A-002   | A      | -        | pending | A-001 |
| A-003   | A      | -        | pending | A-001 |
| C-002   | C      | -        | pending | C-001 |
| C-003   | C      | -        | pending | B-002 |
| D-001   | D      | -        | pending | B-003 |
| D-002   | D      | -        | pending | B-003, D-001 |
| D-003   | D      | -        | pending | B-005 |

---

## Integration Points

### Mastra <-> VOW Backend
- `personalizationEngine.ts` provides user context to Mastra agents
- `aiCoachService.ts` will be gradually migrated to Mastra agent

### Strands <-> MCP Task Server
- Connect via existing MCP Task Server at configurable URL
- Use existing authentication tokens
- Map Strands task events to VOW activity format

### RAG <-> Supabase
- Use pgvector for embedding storage
- Integrate with existing RLS policies
- Query only user's own data

---

## Environment Variables Required

```bash
# Mastra Configuration
MASTRA_OPENAI_API_KEY=sk-...
MASTRA_ANTHROPIC_API_KEY=sk-ant-...
MASTRA_DEFAULT_MODEL=gpt-4o

# Strands Agents Configuration
AWS_REGION=ap-northeast-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
STRANDS_DEFAULT_MODEL=claude-3-5-sonnet

# RAG Configuration
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536
```

---

## Communication Protocol

1. **Task Updates**: Update this COORDINATION.md when task status changes
2. **Blocking Issues**: Document in "Blocking Issues" section below
3. **Integration Questions**: Create GitHub Issue with `agent-task` label
4. **Code Conflicts**: Coordinate via feature branches, merge to develop daily

---

## Blocking Issues

_Currently none_

---

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2026-02-01 | vow-spec-architect | Initial creation with 4 work streams |

