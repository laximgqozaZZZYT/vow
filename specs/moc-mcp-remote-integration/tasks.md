# MOC Section MCP Remote Integration - Implementation Tasks

## Overview
- Purpose: 実装タスク一覧と進捗管理
- Status: Draft
- Version: 1.0.0
- Last Updated: 2026-02-03
- Author: vow-spec-architect

---

## Phase 1: Basic Remote Execution

### Task 1.1: Claude Executor Service
**Assignable to**: Backend Developer
**Estimated Time**: 3 days
**Prerequisite**: None
**Status**: COMPLETE (ISS-20260204-018)

- [x] Create `/home/ubuntu/.mcp-multi-agent/mcp-task-distributor/src/claude-executor.ts`
- [x] Implement `execute()` method with child_process spawn
- [x] Implement stdout/stderr streaming capture
- [x] Add timeout handling (default 30 minutes)
- [x] Add cancellation support
- [ ] Write unit tests (deferred)

**Files Created/Modified:**
```
mcp-task-distributor/src/claude-executor.ts (new - ClaudeExecutor class)
mcp-task-distributor/src/types.ts (extended - ExecutionOptions, ExecutionState, etc.)
```

**Spec**: `/home/ubuntu/Downloads/vow/specs/iss-20260204-018/`

### Task 1.2: Remote Task API Endpoint
**Assignable to**: Backend Developer
**Estimated Time**: 2 days
**Prerequisite**: Task 1.1

- [ ] Add `POST /tasks/remote` endpoint to server.ts
- [ ] Validate request body (title, description, priority)
- [ ] Create task record with `type: 'remote'`
- [ ] Trigger Claude Executor for assigned agent
- [ ] Return task ID and initial status

**Files to Modify:**
```
mcp-task-distributor/src/server.ts
mcp-task-distributor/src/types.ts
```

### Task 1.3: Output Streaming Endpoint
**Assignable to**: Backend Developer
**Estimated Time**: 1 day
**Prerequisite**: Task 1.2

- [ ] Add `GET /tasks/:id/output` SSE endpoint
- [ ] Stream Claude Executor output in real-time
- [ ] Include file change events
- [ ] Handle task completion event

**Files to Modify:**
```
mcp-task-distributor/src/server.ts
```

### Task 1.4: Remote Task UI - Input Form
**Assignable to**: Frontend Developer
**Estimated Time**: 2 days
**Prerequisite**: Task 1.2 (API ready)

- [ ] Create `RemoteTaskPanel` component
- [ ] Add to MOC Section as new tab or panel
- [ ] Implement task input form (title, description, priority)
- [ ] Add submit handler calling `POST /tasks/remote`
- [ ] Show loading state and success/error feedback

**Files to Create/Modify:**
```
frontend/app/dashboard/components/Section.MOC.RemoteTask.tsx (new)
frontend/app/dashboard/components/Section.MOC.tsx (integrate)
```

### Task 1.5: Execution Monitor Component
**Assignable to**: Frontend Developer
**Estimated Time**: 2 days
**Prerequisite**: Task 1.3 (Streaming API ready)

- [ ] Create `ExecutionMonitor` component
- [ ] Connect to `GET /tasks/:id/output` SSE
- [ ] Display streaming output in terminal-like view
- [ ] Add progress indicator
- [ ] Implement cancel button

**Files to Create/Modify:**
```
frontend/app/dashboard/components/Section.MOC.ExecutionMonitor.tsx (new)
frontend/app/dashboard/hooks/useRemoteTask.ts (new)
```

---

## Phase 2: Git Integration

### Task 2.1: Git Manager Service
**Assignable to**: Backend Developer
**Estimated Time**: 2 days
**Prerequisite**: Phase 1 complete

- [ ] Create `git-manager.ts` with simple-git
- [ ] Implement `createBranch(taskId)`
- [ ] Implement `commitChanges(files, message)`
- [ ] Implement `getDiff()`
- [ ] Write unit tests

**Files to Create:**
```
mcp-task-distributor/src/git-manager.ts (new)
mcp-task-distributor/package.json (add simple-git)
```

### Task 2.2: Auto Branch Creation
**Assignable to**: Backend Developer
**Estimated Time**: 1 day
**Prerequisite**: Task 2.1

- [ ] Integrate Git Manager into remote task flow
- [ ] Create branch `task/{taskId}` on task start
- [ ] Update task record with branch name
- [ ] Handle branch creation failures

**Files to Modify:**
```
mcp-task-distributor/src/server.ts
```

### Task 2.3: PR Creation via GitHub CLI
**Assignable to**: Backend Developer
**Estimated Time**: 1 day
**Prerequisite**: Task 2.1

- [ ] Add `createPR(title, body)` to Git Manager
- [ ] Execute `gh pr create` via child_process
- [ ] Parse and return PR URL
- [ ] Handle authentication errors

**Files to Modify:**
```
mcp-task-distributor/src/git-manager.ts
```

### Task 2.4: Git Options in UI
**Assignable to**: Frontend Developer
**Estimated Time**: 1 day
**Prerequisite**: Task 2.2, 2.3

- [ ] Add "Auto-commit" checkbox to task form
- [ ] Add "Create PR" checkbox to task form
- [ ] Display branch name after task creation
- [ ] Show PR link on completion (if created)

**Files to Modify:**
```
frontend/app/dashboard/components/Section.MOC.RemoteTask.tsx
```

---

## Phase 3: Code Review UI

### Task 3.1: File Watcher Service
**Assignable to**: Backend Developer
**Estimated Time**: 2 days
**Prerequisite**: Phase 1 complete

- [ ] Create `file-watcher.ts` with chokidar
- [ ] Watch project directory during task execution
- [ ] Emit SSE events on file changes
- [ ] Calculate and include diff in events
- [ ] Handle cleanup on task completion

**Files to Create:**
```
mcp-task-distributor/src/file-watcher.ts (new)
mcp-task-distributor/package.json (add chokidar)
```

### Task 3.2: Diff Viewer Component
**Assignable to**: Frontend Developer
**Estimated Time**: 3 days
**Prerequisite**: Task 3.1

- [ ] Create `CodeReviewPanel` component
- [ ] Integrate a diff viewer library (react-diff-viewer or similar)
- [ ] Display file list with change indicators
- [ ] Show side-by-side diff for selected file
- [ ] Support syntax highlighting

**Files to Create:**
```
frontend/app/dashboard/components/Section.MOC.CodeReview.tsx (new)
frontend/package.json (add diff library)
```

### Task 3.3: Review Actions (Approve/Reject/Revise)
**Assignable to**: Full Stack Developer
**Estimated Time**: 2 days
**Prerequisite**: Task 3.2

- [ ] Add `POST /tasks/:id/approve` endpoint
- [ ] Handle 'approve', 'reject', 'revise' actions
- [ ] Trigger Git commit on approve
- [ ] Re-queue task with revision prompt on 'revise'
- [ ] Add action buttons in CodeReviewPanel

**Files to Modify:**
```
mcp-task-distributor/src/server.ts
frontend/app/dashboard/components/Section.MOC.CodeReview.tsx
```

---

## Phase 4: Advanced Features

### Task 4.1: Task History View
**Assignable to**: Frontend Developer
**Estimated Time**: 2 days
**Prerequisite**: Phase 1-3 complete

- [ ] Create task history list component
- [ ] Add filtering (status, date range, agent)
- [ ] Add search functionality
- [ ] Display task details on click

**Files to Create:**
```
frontend/app/dashboard/components/Section.MOC.TaskHistory.tsx (new)
```

### Task 4.2: Execution Statistics Dashboard
**Assignable to**: Full Stack Developer
**Estimated Time**: 2 days
**Prerequisite**: Phase 1-3 complete

- [ ] Add statistics endpoint to server
- [ ] Calculate success rate, avg execution time
- [ ] Create statistics display component
- [ ] Add to MOC Section dashboard

**Files to Create/Modify:**
```
mcp-task-distributor/src/server.ts
frontend/app/dashboard/components/Section.MOC.Stats.tsx (new)
```

### Task 4.3: Multi-Agent Parallel Execution
**Assignable to**: Backend Developer
**Estimated Time**: 3 days
**Prerequisite**: Phase 1-3 complete

- [ ] Enhance task queue for dependency tracking
- [ ] Implement parallel execution scheduler
- [ ] Add task splitting for large tasks
- [ ] Handle result aggregation

**Files to Modify:**
```
mcp-task-distributor/src/server.ts
mcp-task-distributor/src/claude-executor.ts
```

---

## Documentation Tasks

### Doc 1: Update CLAUDE.md
**Assignable to**: Any agent
**Prerequisite**: Phase 1 complete

- [ ] Add Remote Task section
- [ ] Document new API endpoints
- [ ] Add troubleshooting guide

### Doc 2: API Specification
**Assignable to**: Any agent
**Prerequisite**: Phase 1-2 complete

- [ ] Create OpenAPI/Swagger spec
- [ ] Document all endpoints
- [ ] Add example requests/responses

---

## Progress Summary

| Phase | Tasks | Completed | Progress |
|-------|-------|-----------|----------|
| Phase 1 | 5 | 1 | 20% |
| Phase 2 | 4 | 0 | 0% |
| Phase 3 | 3 | 0 | 0% |
| Phase 4 | 3 | 0 | 0% |
| Docs | 2 | 0 | 0% |
| **Total** | **17** | **1** | **6%** |

---

## Agent Assignment Matrix

| Agent Role | Recommended Tasks |
|------------|-------------------|
| Backend Developer | 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 4.3 |
| Frontend Developer | 1.4, 1.5, 2.4, 3.2, 4.1 |
| Full Stack Developer | 3.3, 4.2 |
| Any | Doc 1, Doc 2 |
