# MOC Section MCP Remote Integration - Architecture Design

## Overview
- Purpose: VOW MOCセクションへのMCPリモート接続アーキテクチャ設計
- Status: Draft
- Version: 1.0.0
- Last Updated: 2026-02-03
- Author: vow-spec-architect

---

## 1. System Architecture

### 1.1 Target Architecture

```
                                      [Target Architecture]

+----------------------------------------------------------+
|                 VOW Web UI (MOC Section)                  |
|  +----------------------------------------------------+  |
|  |            Remote Task Management UI                |  |
|  |  +-------------+  +-------------+  +-------------+  |  |
|  |  | Task Input  |  | Code Review |  | Progress    |  |  |
|  |  | Form        |  | Panel       |  | Monitor     |  |  |
|  |  +-------------+  +-------------+  +-------------+  |  |
|  +----------------------------------------------------+  |
+---------------------------+------------------------------+
                            | WebSocket/SSE
                            v
+----------------------------------------------------------+
|               MCP Task Server (Enhanced)                  |
|  Port: 3456                                               |
|  +----------------------------------------------------+  |
|  |                   New Components                    |  |
|  |  +-------------+  +-------------+  +-------------+  |  |
|  |  | Claude      |  | Git         |  | File        |  |  |
|  |  | Executor    |  | Manager     |  | Watcher     |  |  |
|  |  +-------------+  +-------------+  +-------------+  |  |
|  +----------------------------------------------------+  |
|  +----------------------------------------------------+  |
|  |                 Existing Components                 |  |
|  |  +-------------+  +-------------+  +-------------+  |  |
|  |  | Task Queue  |  | Agent       |  | SSE         |  |  |
|  |  |             |  | Registry    |  | Broadcaster |  |  |
|  |  +-------------+  +-------------+  +-------------+  |  |
|  +----------------------------------------------------+  |
+---------------------------+------------------------------+
                            | MCP Protocol
                            v
+----------------------------------------------------------+
|            Claude Code Agent Instances                    |
|  +----------------+  +----------------+  +-------------+  |
|  | Agent 1        |  | Agent 2        |  | Agent N    |  |
|  | (Frontend Dev) |  | (Backend Dev)  |  | (...)      |  |
|  +----------------+  +----------------+  +-------------+  |
|  +----------------------------------------------------+  |
|  |                  Target Project                     |  |
|  |           /home/ubuntu/Downloads/vow               |  |
|  +----------------------------------------------------+  |
+----------------------------------------------------------+
```

### 1.2 Data Flow

```
[Task Submission Flow]

User Input (MOC UI)
    |
    v
POST /tasks/remote
    |
    +-- { title, description, spec, targetFiles, priority }
    |
    v
MCP Task Server
    |
    +-- Validate request
    +-- Create task record
    +-- Select available agent
    +-- Assign task
    |
    v
Claude Code Agent (via MCP Bridge)
    |
    +-- register_agent (if not registered)
    +-- claim_task
    +-- Execute: claude --prompt "..." --allowedTools ...
    +-- Monitor progress (heartbeat)
    +-- submit_result
    |
    v
MCP Task Server
    |
    +-- Store result
    +-- Broadcast SSE event
    +-- Trigger Git operations (optional)
    |
    v
MOC UI Update (via SSE)
    |
    +-- Display result
    +-- Show diff
    +-- Enable review actions
```

---

## 2. New Components Specification

### 2.1 Claude Executor Service

**Location**: `mcp-task-distributor/src/claude-executor.ts`

**Responsibilities:**
- Claude Code CLI の非同期実行
- プロンプト構築とコンテキスト注入
- 出力のストリーミングキャプチャ
- タイムアウト・エラーハンドリング

**Interface:**
```typescript
interface ClaudeExecutorOptions {
  workingDirectory: string;
  prompt: string;
  allowedTools?: string[];
  timeout?: number;
  agentId: string;
  taskId: string;
}

interface ClaudeExecutorResult {
  success: boolean;
  output: string;
  filesModified: string[];
  error?: string;
  duration: number;
}

interface ClaudeExecutor {
  execute(options: ClaudeExecutorOptions): Promise<ClaudeExecutorResult>;
  cancel(taskId: string): Promise<void>;
  getStatus(taskId: string): ExecutionStatus;
}
```

### 2.2 Git Manager Service

**Location**: `mcp-task-distributor/src/git-manager.ts`

**Responsibilities:**
- ブランチ作成・切り替え
- 変更のステージング・コミット
- PRの作成（GitHub CLI経由）
- コンフリクト検出

**Interface:**
```typescript
interface GitManagerOptions {
  repoPath: string;
  baseBranch?: string;
}

interface GitManager {
  createBranch(taskId: string): Promise<string>;
  commitChanges(files: string[], message: string): Promise<string>;
  createPR(title: string, body: string): Promise<string>;
  getDiff(fromRef?: string, toRef?: string): Promise<string>;
  getModifiedFiles(): Promise<string[]>;
}
```

### 2.3 File Watcher Service

**Location**: `mcp-task-distributor/src/file-watcher.ts`

**Responsibilities:**
- ファイル変更のリアルタイム監視
- 差分計算
- SSEイベント発火

**Interface:**
```typescript
interface FileWatcher {
  watch(taskId: string, paths: string[]): void;
  unwatch(taskId: string): void;
  getChanges(taskId: string): FileChange[];
}

interface FileChange {
  path: string;
  type: 'create' | 'modify' | 'delete';
  diff?: string;
  timestamp: string;
}
```

---

## 3. API Extensions

### 3.1 New Endpoints

#### POST /tasks/remote
リモートClaude Code実行タスクを作成

```typescript
// Request
{
  title: string;
  description: string;
  spec?: string;           // Reference to .kiro/specs/
  targetFiles?: string[];  // Files to focus on
  priority: 'low' | 'normal' | 'high' | 'urgent';
  autoCommit?: boolean;    // Auto-commit changes
  createPR?: boolean;      // Create PR on completion
}

// Response
{
  success: true,
  data: {
    taskId: string;
    branchName: string;
    assignedAgent?: string;
    status: 'pending' | 'assigned';
  }
}
```

#### GET /tasks/:id/output
タスク実行の出力をストリーミング取得

```typescript
// Response (SSE)
data: { type: 'token', content: '...' }
data: { type: 'file_change', path: '...', diff: '...' }
data: { type: 'complete', result: {...} }
```

#### POST /tasks/:id/approve
コードレビュー後の承認

```typescript
// Request
{
  action: 'approve' | 'reject' | 'revise';
  comment?: string;
  revisionPrompt?: string;  // For 'revise' action
}
```

### 3.2 SSE Event Extensions

```typescript
// New event types
type RemoteTaskEvent =
  | { type: 'task_execution_started'; taskId: string; agentId: string }
  | { type: 'task_output_token'; taskId: string; token: string }
  | { type: 'task_file_changed'; taskId: string; change: FileChange }
  | { type: 'task_execution_completed'; taskId: string; result: ExecutorResult }
  | { type: 'task_pr_created'; taskId: string; prUrl: string };
```

---

## 4. Frontend Changes

### 4.1 New Components

#### RemoteTaskPanel (`Section.MOC.RemoteTask.tsx`)
```typescript
interface RemoteTaskPanelProps {
  serverId: string;
  onTaskCreated: (task: RemoteTask) => void;
}

// Features:
// - Task description input (markdown support)
// - Spec selector (dropdown from .kiro/specs/)
// - Target files picker
// - Priority selector
// - Auto-commit/PR toggles
```

#### CodeReviewPanel (`Section.MOC.CodeReview.tsx`)
```typescript
interface CodeReviewPanelProps {
  taskId: string;
  changes: FileChange[];
  onApprove: () => void;
  onReject: () => void;
  onRequestRevision: (prompt: string) => void;
}

// Features:
// - Side-by-side diff view
// - Inline comments
// - Approve/Reject buttons
// - Revision request input
```

#### ExecutionMonitor (`Section.MOC.ExecutionMonitor.tsx`)
```typescript
interface ExecutionMonitorProps {
  taskId: string;
  status: ExecutionStatus;
  output: string;
}

// Features:
// - Real-time output streaming
// - Progress indicator
// - Cancel button
// - File change notifications
```

### 4.2 Hook Extensions

#### useRemoteTask
```typescript
interface UseRemoteTaskReturn {
  createRemoteTask: (params: CreateRemoteTaskParams) => Promise<string>;
  approveTask: (taskId: string) => Promise<void>;
  rejectTask: (taskId: string, reason: string) => Promise<void>;
  requestRevision: (taskId: string, prompt: string) => Promise<void>;
  cancelTask: (taskId: string) => Promise<void>;

  // State
  currentTask: RemoteTask | null;
  output: string;
  changes: FileChange[];
  status: ExecutionStatus;
}
```

---

## 5. Security Considerations

### 5.1 Access Control
- タスク作成は認証済みユーザーのみ
- Trust Level による実行権限制限
- ファイルアクセスはプロジェクトディレクトリ内に限定

### 5.2 Execution Sandboxing
- Claude Code の `--allowedTools` でツール制限
- `--disallowedTools` でdangerousツールを除外
- 実行時間制限（デフォルト30分）

### 5.3 Audit Logging
- 全タスク実行をログ記録
- 変更ファイルのスナップショット保存
- ロールバック可能性の確保

---

## 6. Implementation Phases

### Phase 1: Basic Remote Execution (2 weeks)
- [ ] Claude Executor Service実装
- [ ] POST /tasks/remote エンドポイント
- [ ] 基本的なUI（タスク入力フォーム）
- [ ] 出力表示

### Phase 2: Git Integration (1 week)
- [ ] Git Manager Service実装
- [ ] 自動ブランチ作成
- [ ] 変更のコミット
- [ ] PR作成

### Phase 3: Code Review UI (2 weeks)
- [ ] File Watcher Service実装
- [ ] Diff表示コンポーネント
- [ ] 承認/却下/修正リクエストワークフロー
- [ ] インラインコメント

### Phase 4: Advanced Features (1 week)
- [ ] 複数エージェント並列実行
- [ ] タスク依存関係管理
- [ ] 実行履歴・分析

---

## 7. Agent Coordination Notes

### For Implementation Agents:

1. **Backend (mcp-task-distributor) を先に実装**
   - Claude Executor は最優先
   - 既存の Task Server コードとの統合に注意

2. **Frontend は Backend API 完成後に着手**
   - Mock データでプロトタイピング可
   - 既存の useMultiAgentServer hook を拡張

3. **テストは各フェーズで必須**
   - Claude Executor の単体テスト
   - API統合テスト
   - E2Eテスト（手動でも可）

4. **ドキュメント更新を忘れずに**
   - CLAUDE.md への追記
   - API仕様書の更新
