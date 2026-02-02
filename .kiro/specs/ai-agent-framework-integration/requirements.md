# Requirements Document: AI Agent Framework Integration

## Introduction

本ドキュメントは、VOWプロジェクトにMastraおよびStrands Agentsフレームワークを統合するための要件を定義します。この統合により、以下の機能が強化されます：

1. **AI Coachingセクション**: Mastraエージェントによる高度なコーチング機能
2. **Agentsセクション**: Strands Agentsによるマルチエージェント協調・タスク管理

**対象バージョン:**
- Mastra: v1.0+ (TypeScript)
- Strands Agents SDK: v0.1.5+ (TypeScript preview)

## Glossary

- **Mastra**: Gatsby開発チームによるTypeScript AIエージェントフレームワーク。RAG、ワークフロー、エージェントを提供
- **Strands Agents**: AWSが開発したオープンソースAIエージェントSDK。モデル駆動型アプローチでMCPネイティブ対応
- **MCP (Model Context Protocol)**: エージェント間のツール共有・通信プロトコル
- **RAG (Retrieval-Augmented Generation)**: 外部データソースを活用した生成AI手法
- **Workflow**: 複数ステップの処理を制御するグラフベースのオーケストレーション
- **Agent Tool**: エージェントが実行可能な関数・アクション
- **Swarm**: Strands Agentsの複数エージェント協調パターン
- **Human-in-the-Loop**: ユーザー入力を待機して処理を再開するパターン
- **VOW AI Coach**: 既存のOpenAI GPT-4ベースコーチング機能
- **MCP Task Server**: VOW既存のマルチエージェントタスク配布サーバー

## Requirements

### Requirement 1: Mastraコア統合

**User Story:** 開発者として、MastraフレームワークをVOWフロントエンド/バックエンドに統合したい。

#### Acceptance Criteria

1. THE System SHALL install @mastra/core package in frontend and backend projects
2. THE System SHALL create a Mastra instance configuration in `lib/mastra/index.ts`
3. THE System SHALL support model provider configuration (OpenAI, Anthropic, etc.) via environment variables
4. THE System SHALL create a base agent class that extends Mastra Agent with VOW-specific defaults
5. THE System SHALL implement error handling wrapper for Mastra agent calls
6. THE System SHALL support streaming responses for real-time UI updates
7. THE System SHALL integrate with existing Supabase authentication for agent context

### Requirement 2: AI Coach Agent (Mastra)

**User Story:** ユーザーとして、より賢いAIコーチからパーソナライズされたアドバイスを受けたい。

#### Acceptance Criteria

1. THE System SHALL create a VOWCoachAgent class using Mastra Agent
2. THE System SHALL configure the agent with system instructions for habit coaching
3. THE System SHALL implement tools for: analyze_habits, suggest_goals, check_progress, generate_baby_steps
4. THE System SHALL load user context (habits, goals, activities) via PersonalizationEngine
5. THE System SHALL support multi-turn conversations with memory retention
6. THE System SHALL implement RAG for querying user's historical data (past 90 days)
7. THE System SHALL respect existing AI quota limits (10/month for free, unlimited for premium)
8. THE System SHALL store conversation history in ai_coach_conversations table
9. THE System SHALL support both Japanese and English responses based on user locale

### Requirement 3: Habit Analysis Workflow (Mastra)

**User Story:** ユーザーとして、自分の習慣パターンを自動分析してもらいたい。

#### Acceptance Criteria

1. THE System SHALL create a HabitAnalysisWorkflow using Mastra Workflow
2. THE Workflow SHALL have steps: data_collection → pattern_analysis → insight_generation → recommendation
3. WHEN data_collection runs, THE System SHALL query habits, activities, and completion rates for specified period
4. WHEN pattern_analysis runs, THE System SHALL identify: peak performance times, struggling habits, correlation patterns
5. WHEN insight_generation runs, THE System SHALL generate natural language insights using the agent
6. WHEN recommendation runs, THE System SHALL provide actionable suggestions ranked by impact
7. THE Workflow SHALL support human-in-the-loop for insight review before recommendations
8. THE System SHALL cache analysis results for 24 hours to reduce API costs
9. THE System SHALL display workflow progress in UI with step indicators

### Requirement 4: Goal Achievement Workflow (Mastra)

**User Story:** ユーザーとして、目標達成に向けたステップバイステップのガイダンスを受けたい。

#### Acceptance Criteria

1. THE System SHALL create a GoalAchievementWorkflow using Mastra Workflow
2. THE Workflow SHALL have steps: goal_assessment → milestone_planning → habit_mapping → progress_tracking
3. WHEN goal_assessment runs, THE System SHALL analyze goal complexity and estimated timeline
4. WHEN milestone_planning runs, THE System SHALL generate OKR-style milestones using AI
5. WHEN habit_mapping runs, THE System SHALL suggest habits that contribute to the goal
6. WHEN progress_tracking runs, THE System SHALL calculate current progress and predict completion date
7. THE System SHALL support branching logic based on goal type (skill, health, productivity, etc.)
8. THE Workflow SHALL integrate with existing goal-habit relationship model

### Requirement 5: Strands Agents SDK統合

**User Story:** 開発者として、Strands AgentsをVOWバックエンドに統合したい。

#### Acceptance Criteria

1. THE System SHALL install @strands-agents/sdk package in backend project
2. THE System SHALL create a Strands agent configuration in `backend/src/agents/strands/`
3. THE System SHALL implement custom tools using @tool decorator pattern
4. THE System SHALL connect to existing MCP Task Server via Strands MCPClient
5. THE System SHALL support Amazon Bedrock and OpenAI as model providers
6. THE System SHALL implement agent lifecycle management (register, heartbeat, deregister)
7. THE System SHALL create TypeScript interfaces for Strands agent types

### Requirement 6: Task Orchestration Agent (Strands)

**User Story:** 管理者として、複数のAIエージェントにタスクを自動配布したい。

#### Acceptance Criteria

1. THE System SHALL create a TaskOrchestratorAgent using Strands Agent
2. THE Agent SHALL implement tools: create_task, assign_task, monitor_progress, reassign_task
3. THE Agent SHALL connect to VOW MCP Task Server for task management
4. WHEN a new task is created, THE Agent SHALL analyze task requirements and select appropriate worker agent
5. THE Agent SHALL implement load balancing across available worker agents
6. THE Agent SHALL detect stuck tasks (no progress for 5 minutes) and trigger reassignment
7. THE Agent SHALL log all orchestration decisions to activities table
8. THE System SHALL display orchestration status in Agents dashboard

### Requirement 7: Worker Agent Pool (Strands)

**User Story:** 開発者として、特定の役割を持つワーカーエージェントを作成したい。

#### Acceptance Criteria

1. THE System SHALL create base WorkerAgent class using Strands Agent
2. THE System SHALL implement specialized worker agents: FrontendWorker, BackendWorker, TesterWorker, SpecWorker
3. EACH Worker Agent SHALL register with MCP Task Server on startup
4. EACH Worker Agent SHALL claim tasks matching its role/capabilities
5. EACH Worker Agent SHALL report progress via heartbeat every 30 seconds
6. WHEN a task is completed, THE Worker Agent SHALL submit results and update task status
7. THE System SHALL support worker agent configuration via environment variables
8. THE Worker Agents SHALL integrate with git for code changes

### Requirement 8: Multi-Agent Dashboard強化

**User Story:** ユーザーとして、マルチエージェントの状態をリアルタイムで監視したい。

#### Acceptance Criteria

1. THE System SHALL enhance Section.Agents to display both Mastra and Strands agents
2. THE Dashboard SHALL show agent type (mastra/strands), status, current task, and metrics
3. THE Dashboard SHALL display real-time SSE updates for agent status changes
4. THE Dashboard SHALL show workflow execution progress for Mastra workflows
5. THE Dashboard SHALL allow manual task creation and assignment
6. THE Dashboard SHALL support filtering by agent type and status
7. THE Dashboard SHALL display agent logs with expandable details
8. THE Dashboard SHALL integrate with existing McpServer connection management

### Requirement 9: AI Coaching UI強化

**User Story:** ユーザーとして、AIコーチとの対話をより直感的に行いたい。

#### Acceptance Criteria

1. THE System SHALL enhance Section.Coach with Mastra agent integration
2. THE Chat UI SHALL display agent thinking process as streaming text
3. THE Chat UI SHALL show tool calls with icons and descriptions
4. THE Chat UI SHALL support suggested prompts based on user context
5. THE Chat UI SHALL display workflow progress when running analysis
6. THE Chat UI SHALL allow users to rate AI responses for feedback
7. THE Chat UI SHALL support voice input (Web Speech API)
8. THE Chat UI SHALL persist chat history across sessions

### Requirement 10: RAG Pipeline Setup

**User Story:** 開発者として、ユーザーデータをAIエージェントが検索できるようにしたい。

#### Acceptance Criteria

1. THE System SHALL configure Mastra RAG with vector storage (Supabase pgvector extension)
2. THE System SHALL create embeddings for: habit descriptions, goal details, diary entries, activity memos
3. THE System SHALL implement incremental embedding updates when data changes
4. THE System SHALL support semantic search with relevance scoring
5. THE RAG Pipeline SHALL respect user data isolation (only query user's own data)
6. THE System SHALL implement caching for frequently accessed embeddings
7. THE System SHALL log RAG query performance for optimization

### Requirement 11: Agent Tool Library

**User Story:** 開発者として、再利用可能なエージェントツールを作成したい。

#### Acceptance Criteria

1. THE System SHALL create a shared tool library in `lib/agent-tools/`
2. THE Tool Library SHALL include: habit_tools (CRUD, analysis), goal_tools (CRUD, progress), activity_tools (logging, stats)
3. THE Tool Library SHALL include: calendar_tools (events, scheduling), mindmap_tools (node operations)
4. THE Tool Library SHALL include: notification_tools (reminders, alerts), export_tools (CSV, JSON)
5. EACH Tool SHALL have TypeScript type definitions with Zod validation
6. EACH Tool SHALL include comprehensive JSDoc documentation
7. THE Tools SHALL be compatible with both Mastra and Strands agents
8. THE System SHALL implement tool execution logging for debugging

### Requirement 12: エラーハンドリングと回復

**User Story:** ユーザーとして、AIエージェントのエラー時も作業を継続したい。

#### Acceptance Criteria

1. THE System SHALL implement retry logic with exponential backoff for API calls (max 3 retries)
2. THE System SHALL gracefully degrade to basic functionality when agents are unavailable
3. THE System SHALL save agent conversation state on failure for resumption
4. THE System SHALL implement circuit breaker pattern for repeated failures
5. THE System SHALL notify users of agent errors with actionable recovery steps
6. THE System SHALL log all agent errors to monitoring system
7. THE System SHALL implement fallback to direct OpenAI calls when frameworks fail

### Requirement 13: パフォーマンス最適化

**User Story:** ユーザーとして、AIエージェント応答を高速に受け取りたい。

#### Acceptance Criteria

1. THE System SHALL implement response streaming for all agent interactions
2. THE System SHALL cache agent responses for repeated queries (TTL: 5 minutes)
3. THE System SHALL pre-load user context on dashboard load for instant agent startup
4. THE System SHALL implement lazy loading for workflow steps
5. THE System SHALL use connection pooling for MCP Task Server connections
6. THE System SHALL monitor and alert on response times exceeding 3 seconds
7. THE System SHALL implement request deduplication for concurrent identical queries

### Requirement 14: セキュリティとプライバシー

**User Story:** ユーザーとして、AIエージェントが私のデータを安全に扱うことを確認したい。

#### Acceptance Criteria

1. THE System SHALL enforce RLS policies for all agent data access
2. THE System SHALL sanitize user inputs before passing to agents
3. THE System SHALL implement rate limiting per user (60 requests/minute)
4. THE System SHALL log all agent actions for audit purposes
5. THE System SHALL encrypt sensitive data in agent conversations
6. THE System SHALL implement guardrails to prevent harmful agent outputs
7. THE System SHALL support user opt-out of AI features

### Requirement 15: テストとモニタリング

**User Story:** 開発者として、AIエージェントの品質を継続的に監視したい。

#### Acceptance Criteria

1. THE System SHALL implement unit tests for all agent tools (Jest)
2. THE System SHALL implement integration tests for workflows (Vitest)
3. THE System SHALL implement property-based tests for critical agent logic (fast-check)
4. THE System SHALL create a monitoring dashboard for agent metrics (response time, success rate, token usage)
5. THE System SHALL implement A/B testing framework for agent prompt improvements
6. THE System SHALL log agent token usage for cost tracking
7. THE System SHALL alert on anomalous agent behavior patterns
