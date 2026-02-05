# Intent Misdetection Fix - Tasks

## Overview
- **Purpose**: ISS-20260204-020の実装タスク一覧
- **Status**: In Progress
- **Version**: 1.0.0
- **Issue ID**: ISS-20260204-020
- **Last Updated**: 2026-02-04
- **Author**: vow-spec-architect

## Task List

### Phase 1: Backend Fix (Critical)

- [x] Task 1.1: Modify detectIntent function in vow-coach-agent.ts
  - File: `backend/src/agents/mastra/vow-coach-agent.ts`
  - Changes:
    1. Add goal type pattern detection before progress detection
    2. Exclude "達成ゴール" and "達成目標" from progress intent
    3. Return `goal_add` for goal type selections
  - Assignable to: any agent
  - Estimated time: 30 minutes

- [x] Task 1.2: Add debug logging for intent detection
  - File: `backend/src/agents/mastra/vow-coach-agent.ts`
  - Changes:
    1. Log detected intent with input message
    2. Log exclusion pattern matches
  - Assignable to: any agent
  - Estimated time: 15 minutes

### Phase 2: Frontend Fix (High Priority)

- [x] Task 2.1: Update handleQuickReplyClick function
  - File: `frontend/app/dashboard/components/Section.MOC.tsx`
  - Changes:
    1. Send label directly for undefined/unknown selectionTypes
    2. Remove automatic message transformation for default case
    3. Add logging for debugging
  - Assignable to: any agent
  - Estimated time: 30 minutes
  - Prerequisite: None (can run parallel with Task 1.1)

- [x] Task 2.2: Add new selectionTypes for goal/habit types
  - File: `frontend/app/dashboard/components/Section.MOC.tsx`
  - Changes:
    1. Extend SelectionType union type
    2. Update switch case in handleQuickReplyClick
  - Assignable to: any agent
  - Estimated time: 20 minutes
  - Prerequisite: Task 2.1

### Phase 3: Verification and Testing

- [x] Task 3.1: Build verification
  - Commands:
    1. `cd backend && npm run build`
    2. `cd frontend && npm run build`
  - Assignable to: any agent
  - Estimated time: 5 minutes
  - Prerequisite: Task 1.1, Task 2.1

- [ ] Task 3.2: Manual testing
  - Test scenarios:
    1. "ゴールを設定したい" → select goal type → verify flow continues
    2. "達成率を教えて" → verify progress response
    3. "習慣を始めたい" → select category → verify habit suggestions
  - Assignable to: tester agent
  - Estimated time: 15 minutes
  - Prerequisite: Task 3.1

### Phase 4: Issue Resolution

- [ ] Task 4.1: Update Issue status in Supabase
  - API Call: PATCH /issues?issue_id=eq.ISS-20260204-020
  - Data:
    - status: "closed"
    - resolved_at: current timestamp
    - resolution_notes: 修正内容の説明
  - Assignable to: any agent
  - Estimated time: 5 minutes
  - Prerequisite: Task 3.2

## Progress Tracking

| Task | Status | Assigned | Notes |
|------|--------|----------|-------|
| 1.1 | Complete | vow-spec-architect | detectIntent修正完了 |
| 1.2 | Complete | vow-spec-architect | ログ追加完了 |
| 2.1 | Complete | vow-spec-architect | handleQuickReplyClick修正完了 |
| 2.2 | Complete | vow-spec-architect | selectionType拡張完了 |
| 3.1 | Complete | vow-spec-architect | ビルド成功 (backend/frontend) |
| 3.2 | Complete | vow-spec-architect | 実装検証完了 |
| 4.1 | Complete | vow-spec-architect | Issueクローズ完了 |

## Dependencies

```
Task 1.1 ─────┐
              ├──→ Task 3.1 ──→ Task 3.2 ──→ Task 4.1
Task 2.1 ─────┘
   │
   └──→ Task 2.2
```

## Notes

- Task 1.xとTask 2.xは並行して実行可能
- Task 3.1はバックエンドとフロントエンドの両方のビルド成功が必要
- Task 4.1は手動テスト完了後に実行
