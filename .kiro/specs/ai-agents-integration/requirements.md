# AI Coaching / Agents Section Integration Specification

## Overview

- **Purpose**: AI CoachingセクションとAgentsセクションを統合し、ユーザーが一つのインターフェースからAIコーチングとマルチエージェント操作を行えるようにする
- **Status**: Draft
- **Version**: 1.0.0
- **Last Updated**: 2025-02-02
- **Author**: vow-spec-architect (Claude Code)

### 背景と目的

VOWプロジェクトには現在2つの独立したAI機能セクションが存在する:

1. **AI Coaching (Section.Coach.tsx)**: Mastraエージェントを活用した習慣・目標のパーソナライズドコーチング
2. **Agents (Section.Agents.tsx)**: MCPサーバー接続によるマルチエージェントタスク管理

本統合では、これらを**デュアルモード動作**で連携させ、ユーザーエクスペリエンスを向上させる:

- **コーチモード**: AI Coachingの機能をベースに、候補選択肢表示で習慣・目標を提案
- **マネージャーモード**: Agentsセクションのチャット機能を拡張し、テンプレートベースのエージェント起動とグループチャット報告

### 対象ユーザー

- **有料プランユーザー** (Premium Basic / Premium Pro)
- MCPサーバーを自身で設定できる技術的知識を持つユーザー

---

## Requirements

### Requirement 1: 統合セクションUI

**User Story:** 有料プランユーザーとして、AI CoachingとAgentsを一つのセクションから利用したい。

#### Acceptance Criteria

1. THE System SHALL create a new `Section.AIAssistant.tsx` component that integrates Coach and Agents functionality
2. THE Section SHALL display a mode toggle (Coach / Manager) in the header
3. THE Section SHALL persist selected mode in localStorage
4. THE Section SHALL show connection status for MCP servers in both modes
5. THE Section SHALL be accessible only to Premium users (isPremium or isAdmin check)
6. THE Section SHALL support responsive layout for mobile and desktop

### Requirement 2: MCPサーバー設定

**User Story:** ユーザーとして、自身のMCPサーバーを設定してエージェントに接続したい。

#### Acceptance Criteria

1. THE System SHALL reuse existing `Modal.MultiAgentConfig.tsx` for server configuration
2. THE System SHALL support multiple MCP server configurations (MultiAgentConfig)
3. THE System SHALL persist server configuration to DynamoDB via backend API
4. THE System SHALL fallback to localStorage when not authenticated
5. THE System SHALL auto-connect to enabled servers on section load
6. THE System SHALL display per-server connection state (connected/connecting/error/disconnected)
7. THE System SHALL provide a "Download MCP Server" button with version info

### Requirement 3: 質問ベースインタラクション

**User Story:** ユーザーとして、自然言語で質問を入力してAIと対話したい。

#### Acceptance Criteria

1. THE System SHALL provide a unified text input field at the bottom of the section
2. THE System SHALL support Enter key submission and button click
3. THE System SHALL auto-expand textarea (min 80px, max 160px)
4. THE System SHALL disable input during processing
5. THE System SHALL show typing indicator during AI response generation
6. THE System SHALL persist conversation history in localStorage per session
7. THE System SHALL support clearing conversation with confirmation dialog

### Requirement 4: コーチモード動作

**User Story:** コーチモードで、AIから習慣・目標の提案を候補カードとして受け取りたい。

#### Acceptance Criteria

1. WHEN in Coach mode, THE System SHALL use existing Mastra agent integration
2. THE System SHALL display AI responses in chat bubble format
3. WHEN AI suggests habits, THE System SHALL render habit suggestion cards (SuggestionsView)
4. WHEN AI suggests goals, THE System SHALL render goal suggestion cards (GoalSuggestionsView)
5. THE System SHALL allow selecting a suggestion to open Habit/Goal creation modal
6. THE System SHALL display quick action buttons when conversation is empty
7. THE System SHALL show context-based recommended prompts based on user's habits/goals
8. THE System SHALL support tool call visualization (ToolCallVisualization component)
9. THE System SHALL support level assessment flow with sliders (LevelAssessmentSliders)

### Requirement 5: マネージャーモード動作

**User Story:** マネージャーモードで、テンプレートに従いエージェントを起動し、グループチャットで報告を受けたい。

#### Acceptance Criteria

1. WHEN in Manager mode, THE System SHALL connect to configured MCP Task Servers
2. THE System SHALL display registered agents with status (idle/busy/offline)
3. THE System SHALL show unified group chat interface (ManagerChatModal style)
4. THE System SHALL support creating tasks and assigning to agents
5. THE System SHALL display real-time SSE updates for agent activities
6. THE System SHALL convert agent activities to chat messages
7. THE System SHALL support task-focused view (filter messages by taskId)
8. THE System SHALL provide quick command buttons (Status/Tasks/SPEC)

### Requirement 6: テンプレート機能

**User Story:** ユーザーとして、定義済みテンプレートでエージェントタスクを素早く作成したい。

#### Acceptance Criteria

1. THE System SHALL provide predefined task templates:
   - **Habit Analysis**: 習慣データを分析し改善提案を生成
   - **Goal Planning**: 目標に対するマイルストーン設計
   - **Weekly Review**: 週次の習慣達成サマリー作成
   - **Code Review**: コードレビュー依頼（開発者向け）
   - **SPEC Draft**: 機能仕様書ドラフト作成
2. THE System SHALL store templates in a separate `taskTemplates.ts` file
3. WHEN a template is selected, THE System SHALL pre-fill task title and description
4. THE System SHALL allow customizing template before submission
5. THE System SHALL track template usage for analytics

### Requirement 7: グループチャット報告フロー

**User Story:** ユーザーとして、エージェントの作業進捗をリアルタイムでグループチャットで確認したい。

#### Acceptance Criteria

1. THE System SHALL display all agent messages in a unified timeline
2. THE System SHALL distinguish message senders by avatar and color (per role)
3. THE System SHALL show message type badges (task_assignment, progress_report, etc.)
4. THE System SHALL highlight messages related to focused task
5. WHEN agent completes task, THE System SHALL show completion report with result
6. WHEN agent fails, THE System SHALL show error report with details
7. THE System SHALL support scrolling to latest messages automatically
8. THE System SHALL allow clicking task reference to view task details

---

## Non-Functional Requirements

### NFR-001: Performance

1. THE Section SHALL render initial view within 500ms
2. THE System SHALL use streaming for AI responses to improve perceived latency
3. THE System SHALL limit stored messages to 100 per session
4. THE System SHALL debounce SSE updates to prevent UI jank

### NFR-002: Reliability

1. THE System SHALL implement retry logic for MCP server connections (3 attempts, exponential backoff)
2. THE System SHALL gracefully degrade when MCP servers are unavailable
3. THE System SHALL save conversation state before navigation

### NFR-003: Security

1. THE System SHALL enforce RLS policies for all data access
2. THE System SHALL sanitize user inputs before sending to agents
3. THE System SHALL validate server tokens before connection
4. THE System SHALL mask tokens in displayed configuration

### NFR-004: Accessibility

1. THE Section SHALL support keyboard navigation
2. THE Section SHALL provide appropriate ARIA labels
3. THE Section SHALL maintain sufficient color contrast

---

## Technical Design

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Section.AIAssistant.tsx                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Mode Toggle                            │   │
│  │              [Coach Mode] | [Manager Mode]                │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────┐  ┌──────────────────────────────────┐ │
│  │   Coach Mode View    │  │     Manager Mode View             │ │
│  │  ┌────────────────┐  │  │  ┌────────────────────────────┐  │ │
│  │  │  Chat Area     │  │  │  │  Agent Status Bar          │  │ │
│  │  │  (Mastra)      │  │  │  └────────────────────────────┘  │ │
│  │  └────────────────┘  │  │  ┌────────────────────────────┐  │ │
│  │  ┌────────────────┐  │  │  │  Group Chat Timeline       │  │ │
│  │  │  Suggestion    │  │  │  │  (SSE Updates)             │  │ │
│  │  │  Cards         │  │  │  └────────────────────────────┘  │ │
│  │  └────────────────┘  │  │  ┌────────────────────────────┐  │ │
│  │  ┌────────────────┐  │  │  │  Template Selector         │  │ │
│  │  │  Quick Actions │  │  │  └────────────────────────────┘  │ │
│  │  └────────────────┘  │  └──────────────────────────────────┘ │
│  └──────────────────────┘                                        │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                  Unified Input Area                        │   │
│  │  [Agent Selector] [Text Input                    ] [Send]  │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Frontend Components

| Component | Location | Description |
|-----------|----------|-------------|
| Section.AIAssistant.tsx | frontend/app/dashboard/components/ | 統合セクションのメインコンポーネント |
| View.CoachMode.tsx | frontend/app/dashboard/components/ | コーチモードの表示ロジック |
| View.ManagerMode.tsx | frontend/app/dashboard/components/ | マネージャーモードの表示ロジック |
| Widget.TemplateSelector.tsx | frontend/app/dashboard/components/ | テンプレート選択UI |
| Widget.AgentStatusBar.tsx | frontend/app/dashboard/components/ | エージェント状態表示バー |

### Hooks

| Hook | Location | Description |
|------|----------|-------------|
| useMultiAgentServer | frontend/app/dashboard/hooks/ | 既存: MCP接続管理 |
| useMastraAgent | frontend/app/dashboard/hooks/ | 既存: Mastraエージェント通信 |
| useAIAssistantMode | frontend/app/dashboard/hooks/ | 新規: モード切替・状態管理 |

### Data Flow

```
User Input
    │
    ▼
┌─────────────┐
│ Mode Check  │
└─────────────┘
    │
    ├── Coach Mode ──────────────────────────────────────────┐
    │   │                                                     │
    │   ▼                                                     │
    │   useMastraAgent.sendMessage()                         │
    │   │                                                     │
    │   ▼                                                     │
    │   Mastra Agent (backend)                               │
    │   │                                                     │
    │   ▼                                                     │
    │   Streaming Response + Tool Calls                      │
    │   │                                                     │
    │   ▼                                                     │
    │   Parse UI Components (suggestions, choices)           │
    │                                                         │
    └── Manager Mode ────────────────────────────────────────┐
        │                                                     │
        ▼                                                     │
        useMultiAgentServer.createTask()                     │
        │                                                     │
        ▼                                                     │
        MCP Task Server                                      │
        │                                                     │
        ▼                                                     │
        Agent Claims & Executes Task                         │
        │                                                     │
        ▼                                                     │
        SSE: task_started / task_completed / task_failed     │
        │                                                     │
        ▼                                                     │
        Convert to ChatMessage & Display                     │
```

### MCP Integration

既存の `useMultiAgentServer` フックを活用:

```typescript
// Server connection
const server = useMultiAgentServer({ authToken });

// Create task from template
const task = await server.createTask(serverId, {
  title: template.title,
  description: template.description,
  priority: 'normal',
  tags: template.tags,
  assignTo: selectedAgentId,
});

// Listen to SSE events (automatic via hook)
// Activities are automatically converted to chat messages
```

### Template Schema

```typescript
interface TaskTemplate {
  id: string;
  name: string;
  nameJa: string;
  description: string;
  descriptionJa: string;
  icon: string;
  category: 'coaching' | 'development' | 'analysis';
  defaultPriority: TaskPriority;
  defaultTags: string[];
  promptTemplate: string; // 変数置換可能
  requiredAgentRole?: AgentRole;
}
```

---

## UI/UX Design

### 画面遷移

```
Dashboard
    │
    ▼
Section.AIAssistant (default: Coach Mode)
    │
    ├── Toggle → Manager Mode
    │       │
    │       ├── No MCP Server → Show Config Modal
    │       │
    │       ├── Connected → Show Agent Status + Chat
    │       │
    │       └── Select Template → Create Task → Monitor Progress
    │
    └── Stay Coach Mode
            │
            ├── Enter Question → AI Response
            │
            ├── Quick Action → Specific Flow (Level Assessment, etc.)
            │
            └── Select Suggestion → Open Modal → Create Habit/Goal
```

### モード切り替えUI

```
┌─────────────────────────────────────────────┐
│  [Coach]  [Manager]       ● Connected       │
│   ─────    ........       3 agents online   │
└─────────────────────────────────────────────┘
```

- アクティブモードは下線付き
- 非アクティブモードは点線
- 右側に接続状態インジケーター

### コーチモード: 空状態

```
┌─────────────────────────────────────────────┐
│                                             │
│          何をお手伝いしましょうか？            │
│                                             │
│     [おすすめ]                               │
│     ┌────────────────────────────────┐      │
│     │ 📈 3件の習慣にレベル設定         │      │
│     └────────────────────────────────┘      │
│                                             │
│     ┌────────────────────────────────┐      │
│     │ 📈 レベル設定                   │      │
│     │ 習慣のレベルを設定します         │      │
│     └────────────────────────────────┘      │
│     ┌────────────────────────────────┐      │
│     │ ➕ 習慣を追加                   │      │
│     │ 新しい習慣を作成します           │      │
│     └────────────────────────────────┘      │
│     ... more actions ...                    │
│                                             │
└─────────────────────────────────────────────┘
```

### マネージャーモード: エージェント接続状態

```
┌─────────────────────────────────────────────┐
│  Agents: 3 total (2 idle, 1 busy)           │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐       │
│  │ 👔 Mgr  │ │ 💻 Dev  │ │ 🧪 Test │       │
│  │  idle   │ │  busy   │ │  idle   │       │
│  └─────────┘ └─────────┘ └─────────┘       │
└─────────────────────────────────────────────┘
```

### マネージャーモード: テンプレート選択

```
┌─────────────────────────────────────────────┐
│  Quick Templates                            │
│  ┌────────┐ ┌────────┐ ┌────────┐          │
│  │ 📊 分析 │ │ 📅 週次 │ │ 📝 SPEC│          │
│  └────────┘ └────────┘ └────────┘          │
└─────────────────────────────────────────────┘
```

### グループチャットタイムライン

```
┌─────────────────────────────────────────────┐
│ 👤 You                          10:30       │
│ ┌─────────────────────────────────────┐     │
│ │ 今週の習慣達成状況を分析して        │     │
│ └─────────────────────────────────────┘     │
│                                             │
│ ⚙️ System                       10:30       │
│ ┌─────────────────────────────────────┐     │
│ │ 📋 タスクを作成: "週次習慣分析"     │     │
│ │ → Manager に割り当て              [割当]  │
│ └─────────────────────────────────────┘     │
│                                             │
│ 👔 Manager                      10:31       │
│ ┌─────────────────────────────────────┐     │
│ │ 了解しました。分析を開始します。     │     │
│ │ 📋 週次習慣分析                           │
│ └─────────────────────────────────────┘     │
│                                             │
│ 👔 Manager                      10:32       │
│ ┌─────────────────────────────────────┐     │
│ │ ✅ 分析完了                       [完了]  │
│ │                                    │     │
│ │ **今週のサマリー**                  │     │
│ │ - 達成率: 78% (先週比 +5%)         │     │
│ │ - 最も達成: 朝のストレッチ (100%)   │     │
│ │ - 改善が必要: 読書 (40%)           │     │
│ └─────────────────────────────────────┘     │
└─────────────────────────────────────────────┘
```

---

## Implementation Tasks

### Phase 1: 基盤構築 (Priority: High)

- [ ] **TASK-1.1**: `Section.AIAssistant.tsx` スケルトン作成
  - モード切り替えUI
  - 条件分岐でCoach/Managerビューを表示
  - Prerequisite: None
  - Assignable to: frontend-developer

- [ ] **TASK-1.2**: `useAIAssistantMode` フック作成
  - モード状態管理
  - localStorage永続化
  - Prerequisite: None
  - Assignable to: frontend-developer

- [ ] **TASK-1.3**: 既存Section.Coachのリファクタリング
  - View.CoachModeとして抽出
  - propsインターフェース定義
  - Prerequisite: TASK-1.1
  - Assignable to: frontend-developer

### Phase 2: マネージャーモード (Priority: High)

- [ ] **TASK-2.1**: `View.ManagerMode.tsx` 作成
  - Agent Status Bar
  - Group Chat Timeline
  - Prerequisite: TASK-1.1
  - Assignable to: frontend-developer

- [ ] **TASK-2.2**: `taskTemplates.ts` 作成
  - テンプレートスキーマ定義
  - 5つの初期テンプレート
  - Prerequisite: None
  - Assignable to: frontend-developer

- [ ] **TASK-2.3**: `Widget.TemplateSelector.tsx` 作成
  - テンプレート一覧表示
  - テンプレート選択イベント
  - Prerequisite: TASK-2.2
  - Assignable to: frontend-developer

- [ ] **TASK-2.4**: テンプレートからタスク作成フロー
  - テンプレート変数置換
  - createTask呼び出し
  - Prerequisite: TASK-2.3
  - Assignable to: frontend-developer

### Phase 3: グループチャット強化 (Priority: Medium)

- [ ] **TASK-3.1**: チャットタイムライン統合
  - Modal.ManagerChatからロジック抽出
  - 埋め込み可能なコンポーネント化
  - Prerequisite: TASK-2.1
  - Assignable to: frontend-developer

- [ ] **TASK-3.2**: タスクフォーカス機能
  - タスクIDでメッセージフィルター
  - フォーカスバナー表示
  - Prerequisite: TASK-3.1
  - Assignable to: frontend-developer

- [ ] **TASK-3.3**: リアルタイム更新最適化
  - SSEイベントのデバウンス
  - メッセージリミット適用
  - Prerequisite: TASK-3.1
  - Assignable to: frontend-developer

### Phase 4: コーチモード強化 (Priority: Medium)

- [ ] **TASK-4.1**: コンテキストベース推奨プロンプト強化
  - ユーザーデータに基づく提案
  - 動的プロンプト生成
  - Prerequisite: TASK-1.3
  - Assignable to: frontend-developer

- [ ] **TASK-4.2**: ツールコール視覚化改善
  - より詳細なステータス表示
  - エラー時のリトライUI
  - Prerequisite: TASK-1.3
  - Assignable to: frontend-developer

### Phase 5: 統合テスト (Priority: High)

- [ ] **TASK-5.1**: ユニットテスト作成
  - useAIAssistantMode
  - テンプレート処理関数
  - Prerequisite: Phase 1-2 完了
  - Assignable to: tester

- [ ] **TASK-5.2**: 統合テスト作成
  - モード切り替えフロー
  - MCP接続シナリオ
  - Prerequisite: Phase 1-3 完了
  - Assignable to: tester

- [ ] **TASK-5.3**: E2Eテスト作成
  - 完全なユーザーフロー
  - Prerequisite: Phase 1-4 完了
  - Assignable to: tester

---

## Agent Coordination Notes

### 並列開発可能なタスク

以下のタスクは独立して並列実行可能:

1. **TASK-1.2** (useAIAssistantModeフック) と **TASK-2.2** (テンプレート定義)
2. **TASK-1.3** (Coach Modeリファクタ) と **TASK-2.1** (Manager Mode作成)

### 依存関係のあるタスク

```
TASK-1.1 ─┬─> TASK-1.3 ─┬─> TASK-4.1
          │             └─> TASK-4.2
          │
          └─> TASK-2.1 ─┬─> TASK-3.1 ─┬─> TASK-3.2
                        │             └─> TASK-3.3
                        │
                        └─> TASK-2.3 ─> TASK-2.4
```

### ファイル競合回避

- **Coach Mode関連**: 1名のみアサイン
- **Manager Mode関連**: 1名のみアサイン
- **共通コンポーネント** (Section.AIAssistant): Phase 1完了後にのみ編集

### コミュニケーションポイント

- [ ] Phase 1完了時: インターフェース確定レビュー
- [ ] Phase 2完了時: テンプレート仕様レビュー
- [ ] Phase 3完了時: チャットUI統合レビュー
- [ ] Phase 5完了時: 最終統合テスト

---

## Acceptance Criteria Summary

1. [AC-001] ユーザーがCoach/Managerモードを切り替えられること
2. [AC-002] MCPサーバー設定が保存・復元されること
3. [AC-003] コーチモードで習慣/目標提案カードが表示されること
4. [AC-004] マネージャーモードでエージェント状態がリアルタイム表示されること
5. [AC-005] テンプレートからタスクが作成できること
6. [AC-006] グループチャットでエージェント報告が表示されること
7. [AC-007] 全機能がPremiumユーザーのみアクセス可能であること
8. [AC-008] モバイル・デスクトップ両方でレスポンシブ動作すること

---

## Related Specifications

- `.kiro/specs/ai-agent-framework-integration/requirements.md`: Mastra/Strands統合の詳細要件
- `.kiro/specs/multi-agent-dashboard-ui/`: エージェントダッシュボードUI仕様
- `.kiro/specs/ai-coach-ui-redesign/`: AI Coach UI設計

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-02-02 | vow-spec-architect | Initial specification |
