# Implementation Plan: AI Agent Framework Integration

## Overview

本実装計画は、MastraとStrands Agentsフレームワークの統合を4つの並列ワークストリームで進めます。各ワークストリームは独立したAIエージェントが担当し、仕様駆動開発で進行します。

## Work Streams (並列開発用)

| Stream | 担当エージェント | フォーカス | 依存関係 |
|--------|-----------------|-----------|---------|
| A | Frontend Agent | Mastra UI統合、AI Coach UI強化 | Core完了後 |
| B | Backend Agent | Mastra/Strands Services | なし (最初に開始) |
| C | Integration Agent | MCP連携、RAG Pipeline | B完了後 |
| D | Testing Agent | テスト、ドキュメント | A, B, C完了後 |

---

## Phase 1: コア基盤構築 (Stream B - Backend Agent)

### 1.1 Mastraパッケージインストールと設定
- [ ] 1.1.1 Install @mastra/core in frontend: `npm install @mastra/core`
- [ ] 1.1.2 Install @mastra/core in backend: `npm install @mastra/core`
- [ ] 1.1.3 Create `frontend/lib/mastra/config.ts` with provider configuration
- [ ] 1.1.4 Create `backend/src/agents/mastra/config.ts` with provider configuration
- [ ] 1.1.5 Add environment variables: MASTRA_OPENAI_API_KEY, MASTRA_ANTHROPIC_API_KEY
- [ ] 1.1.6 Create Mastra instance initialization in both projects
- _Requirements: 1.1, 1.2, 1.3_

### 1.2 Strands Agentsパッケージインストールと設定
- [ ] 1.2.1 Install @strands-agents/sdk in backend: `npm install @strands-agents/sdk`
- [ ] 1.2.2 Create `backend/src/agents/strands/config.ts` with Bedrock/OpenAI configuration
- [ ] 1.2.3 Create TypeScript interfaces for Strands agent types
- [ ] 1.2.4 Add environment variables: AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
- [ ] 1.2.5 Create Strands agent base class with VOW defaults
- _Requirements: 5.1, 5.2, 5.3, 5.7_

### 1.3 共通ツールライブラリ作成
- [ ] 1.3.1 Create `lib/agent-tools/index.ts` with tool exports
- [ ] 1.3.2 Create `lib/agent-tools/habit-tools.ts`: createHabit, updateHabit, getHabits, analyzeHabits
- [ ] 1.3.3 Create `lib/agent-tools/goal-tools.ts`: createGoal, updateGoal, getGoals, calculateProgress
- [ ] 1.3.4 Create `lib/agent-tools/activity-tools.ts`: logActivity, getActivities, getStats
- [ ] 1.3.5 Create `lib/agent-tools/calendar-tools.ts`: getEvents, createEvent, scheduleReminder
- [ ] 1.3.6 Create `lib/agent-tools/notification-tools.ts`: sendNotification, createReminder
- [ ] 1.3.7 Add Zod validation schemas for all tool inputs/outputs
- [ ] 1.3.8 Add JSDoc documentation for all tools
- _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_

### 1.4 エラーハンドリング基盤
- [ ] 1.4.1 Create `lib/agent-tools/error-handler.ts` with retry logic
- [ ] 1.4.2 Implement exponential backoff (2s, 4s, 8s delays)
- [ ] 1.4.3 Implement circuit breaker pattern with 5 failure threshold
- [ ] 1.4.4 Create fallback to direct OpenAI calls
- [ ] 1.4.5 Create agent error logging utility
- _Requirements: 12.1, 12.4, 12.6, 12.7_

---

## Phase 2: Mastraエージェント実装 (Stream B - Backend Agent)

### 2.1 VOW AI Coachエージェント作成
- [ ] 2.1.1 Create `backend/src/agents/mastra/vow-coach-agent.ts`
- [ ] 2.1.2 Define system instructions for habit coaching (Japanese/English)
- [ ] 2.1.3 Register tools: analyze_habits, suggest_goals, check_progress, generate_baby_steps
- [ ] 2.1.4 Implement PersonalizationEngine integration for user context
- [ ] 2.1.5 Implement memory retention for multi-turn conversations
- [ ] 2.1.6 Add quota enforcement middleware (10/month free, unlimited premium)
- [ ] 2.1.7 Implement conversation storage to ai_coach_conversations
- [ ] 2.1.8 Add locale detection for response language
- _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9_

### 2.2 習慣分析ワークフロー作成
- [ ] 2.2.1 Create `backend/src/agents/mastra/workflows/habit-analysis.ts`
- [ ] 2.2.2 Implement data_collection step: query habits, activities, completion rates
- [ ] 2.2.3 Implement pattern_analysis step: identify peak times, struggles, correlations
- [ ] 2.2.4 Implement insight_generation step: generate natural language insights
- [ ] 2.2.5 Implement recommendation step: rank suggestions by impact
- [ ] 2.2.6 Add human-in-the-loop pause for insight review
- [ ] 2.2.7 Implement result caching (24 hours TTL)
- [ ] 2.2.8 Add workflow progress events for UI updates
- _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9_

### 2.3 目標達成ワークフロー作成
- [ ] 2.3.1 Create `backend/src/agents/mastra/workflows/goal-achievement.ts`
- [ ] 2.3.2 Implement goal_assessment step: analyze complexity, estimate timeline
- [ ] 2.3.3 Implement milestone_planning step: generate OKR-style milestones
- [ ] 2.3.4 Implement habit_mapping step: suggest contributing habits
- [ ] 2.3.5 Implement progress_tracking step: calculate progress, predict completion
- [ ] 2.3.6 Add branching logic for goal types (skill, health, productivity)
- [ ] 2.3.7 Integrate with existing goal-habit model
- _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

---

## Phase 3: Strandsエージェント実装 (Stream B - Backend Agent)

### 3.1 タスクオーケストレーターエージェント作成
- [ ] 3.1.1 Create `backend/src/agents/strands/task-orchestrator.ts`
- [ ] 3.1.2 Implement create_task tool with MCP Task Server integration
- [ ] 3.1.3 Implement assign_task tool with worker selection logic
- [ ] 3.1.4 Implement monitor_progress tool with stuck task detection
- [ ] 3.1.5 Implement reassign_task tool for failed tasks
- [ ] 3.1.6 Add load balancing logic across worker agents
- [ ] 3.1.7 Implement orchestration decision logging
- _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

### 3.2 ワーカーエージェントプール作成
- [ ] 3.2.1 Create `backend/src/agents/strands/base-worker.ts` with common logic
- [ ] 3.2.2 Create `backend/src/agents/strands/workers/frontend-worker.ts`
- [ ] 3.2.3 Create `backend/src/agents/strands/workers/backend-worker.ts`
- [ ] 3.2.4 Create `backend/src/agents/strands/workers/tester-worker.ts`
- [ ] 3.2.5 Create `backend/src/agents/strands/workers/spec-worker.ts`
- [ ] 3.2.6 Implement MCP Task Server registration on startup
- [ ] 3.2.7 Implement task claiming by role/capability
- [ ] 3.2.8 Implement heartbeat every 30 seconds
- [ ] 3.2.9 Implement result submission and status update
- [ ] 3.2.10 Add environment variable configuration
- _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_

### 3.3 MCP Task Server連携
- [ ] 3.3.1 Create `backend/src/agents/strands/mcp-client.ts` with Strands MCPClient
- [ ] 3.3.2 Implement connection to existing VOW MCP Task Server
- [ ] 3.3.3 Implement SSE event handling for real-time updates
- [ ] 3.3.4 Add reconnection logic with exponential backoff
- [ ] 3.3.5 Implement task event translation between Strands and VOW format
- _Requirements: 5.4, 5.5, 5.6_

---

## Phase 4: RAG Pipeline構築 (Stream C - Integration Agent)

### 4.1 pgvector拡張セットアップ
- [ ] 4.1.1 Create Supabase migration for pgvector extension
- [ ] 4.1.2 Create embeddings table: id, user_id, entity_type, entity_id, embedding, metadata, created_at
- [ ] 4.1.3 Add RLS policies for embeddings table
- [ ] 4.1.4 Create index for vector similarity search
- _Requirements: 10.1, 10.5_

### 4.2 埋め込み生成パイプライン
- [ ] 4.2.1 Create `backend/src/services/embedding-service.ts`
- [ ] 4.2.2 Implement embeddings for habit descriptions
- [ ] 4.2.3 Implement embeddings for goal details
- [ ] 4.2.4 Implement embeddings for diary entries
- [ ] 4.2.5 Implement embeddings for activity memos
- [ ] 4.2.6 Implement incremental update on data change
- [ ] 4.2.7 Add embedding cache layer
- _Requirements: 10.2, 10.3, 10.6_

### 4.3 セマンティック検索API
- [ ] 4.3.1 Create `backend/src/routers/rag.ts` with search endpoints
- [ ] 4.3.2 Implement POST /api/rag/search with query embedding
- [ ] 4.3.3 Implement relevance scoring and ranking
- [ ] 4.3.4 Add user data isolation (only query user's data)
- [ ] 4.3.5 Implement query logging for performance monitoring
- _Requirements: 10.4, 10.5, 10.7_

---

## Phase 5: フロントエンドUI実装 (Stream A - Frontend Agent)

### 5.1 AI Coaching UI強化
- [ ] 5.1.1 Update `Section.Coach.tsx` to use Mastra agent
- [ ] 5.1.2 Implement streaming response display
- [ ] 5.1.3 Add tool call visualization with icons
- [ ] 5.1.4 Add suggested prompts based on user context
- [ ] 5.1.5 Add workflow progress indicator
- [ ] 5.1.6 Add response rating feature
- [ ] 5.1.7 Add voice input using Web Speech API
- [ ] 5.1.8 Implement cross-session chat history persistence
- _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8_

### 5.2 Agents Dashboard強化
- [ ] 5.2.1 Update `Section.Agents.tsx` to display Mastra/Strands agents
- [ ] 5.2.2 Add agent type badge (mastra/strands)
- [ ] 5.2.3 Add status, current task, metrics display
- [ ] 5.2.4 Implement real-time SSE updates
- [ ] 5.2.5 Add workflow execution progress view
- [ ] 5.2.6 Add manual task creation form
- [ ] 5.2.7 Add agent filtering by type and status
- [ ] 5.2.8 Add expandable agent logs view
- _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_

### 5.3 共通コンポーネント作成
- [ ] 5.3.1 Create `Widget.AgentStatus.tsx` for agent status display
- [ ] 5.3.2 Create `Widget.WorkflowProgress.tsx` for workflow step visualization
- [ ] 5.3.3 Create `Widget.ToolCallDisplay.tsx` for tool execution display
- [ ] 5.3.4 Create `Widget.StreamingResponse.tsx` for streaming text
- [ ] 5.3.5 Create `Modal.AgentConfig.tsx` for agent configuration
- [ ] 5.3.6 Create `Modal.TaskCreate.tsx` for manual task creation

---

## Phase 6: パフォーマンス最適化 (Stream C - Integration Agent)

### 6.1 レスポンス最適化
- [ ] 6.1.1 Implement response streaming for all agent interactions
- [ ] 6.1.2 Implement response caching with 5-minute TTL
- [ ] 6.1.3 Implement user context pre-loading on dashboard load
- [ ] 6.1.4 Implement lazy loading for workflow steps
- [ ] 6.1.5 Implement MCP connection pooling
- _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

### 6.2 モニタリング
- [ ] 6.2.1 Add response time monitoring (alert if > 3s)
- [ ] 6.2.2 Implement request deduplication
- [ ] 6.2.3 Add token usage logging
- [ ] 6.2.4 Create monitoring dashboard for agent metrics
- _Requirements: 13.6, 13.7, 15.4, 15.6_

---

## Phase 7: セキュリティ実装 (Stream C - Integration Agent)

### 7.1 データ保護
- [ ] 7.1.1 Verify RLS policies for all agent data access
- [ ] 7.1.2 Implement input sanitization for agent prompts
- [ ] 7.1.3 Implement rate limiting (60 requests/minute per user)
- [ ] 7.1.4 Implement action audit logging
- [ ] 7.1.5 Implement conversation encryption for sensitive data
- _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

### 7.2 ガードレール
- [ ] 7.2.1 Implement output guardrails using existing ai-coach-guardrails
- [ ] 7.2.2 Add user opt-out feature for AI features
- _Requirements: 14.6, 14.7_

---

## Phase 8: テストとドキュメント (Stream D - Testing Agent)

### 8.1 ユニットテスト
- [ ] 8.1.1 Create tests for all agent tools in `__tests__/agent-tools/`
- [ ] 8.1.2 Create tests for Mastra agent in `__tests__/agents/mastra/`
- [ ] 8.1.3 Create tests for Strands agent in `__tests__/agents/strands/`
- [ ] 8.1.4 Create tests for RAG pipeline in `__tests__/services/rag/`
- _Requirements: 15.1_

### 8.2 統合テスト
- [ ] 8.2.1 Create workflow integration tests using Vitest
- [ ] 8.2.2 Create MCP integration tests
- [ ] 8.2.3 Create end-to-end agent flow tests
- _Requirements: 15.2_

### 8.3 プロパティベーステスト
- [ ] 8.3.1 Create property tests for tool validation with fast-check
- [ ] 8.3.2 Create property tests for RAG query isolation
- [ ] 8.3.3 Create property tests for quota enforcement
- _Requirements: 15.3_

### 8.4 ドキュメント
- [ ] 8.4.1 Update CLAUDE.md with agent framework information
- [ ] 8.4.2 Create agent development guide in docs/
- [ ] 8.4.3 Create API documentation for agent endpoints
- [ ] 8.4.4 Create user guide for AI coaching features

---

## Checkpoints

### Checkpoint 1: Core Foundation Complete
- [ ] All Phase 1 tasks complete
- [ ] Mastra and Strands packages installed
- [ ] Tool library created
- [ ] Error handling in place

### Checkpoint 2: Backend Agents Complete
- [ ] All Phase 2 and 3 tasks complete
- [ ] VOW Coach Agent working
- [ ] Workflows executing
- [ ] Strands agents communicating with MCP

### Checkpoint 3: Integration Complete
- [ ] All Phase 4, 5, 6, 7 tasks complete
- [ ] RAG pipeline operational
- [ ] Frontend UI updated
- [ ] Performance optimized
- [ ] Security implemented

### Checkpoint 4: Production Ready
- [ ] All Phase 8 tasks complete
- [ ] All tests passing
- [ ] Documentation complete
- [ ] Deployed to development environment
- [ ] User acceptance testing passed

---

## Notes

- 各Phaseは可能な限り並列で進行
- Stream B (Backend) が最初に開始し、CoreとAgentsを構築
- Stream A (Frontend) はStream B完了後に開始
- Stream C (Integration) はStream B完了後に開始
- Stream D (Testing) は全Stream完了後に開始
- 各Checkpointでユーザーレビューを実施
- タスクには要件番号を付与してトレーサビリティを確保
