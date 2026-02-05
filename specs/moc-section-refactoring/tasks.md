# Section.MOC.tsx Refactoring Specification - Implementation Tasks

## Overview
- **Purpose**: Section.MOC.tsx リファクタリングの実装タスク一覧
- **Status**: Draft
- **Version**: 1.0.0
- **Last Updated**: 2026-02-05
- **Author**: vow-spec-architect
- **Total Tasks**: 42 tasks
- **Estimated Total Time**: 28 hours

---

## Phase Summary

| Phase | Name | Tasks | Est. Time | Risk | Parallel |
|-------|------|-------|-----------|------|----------|
| 1 | Type Definitions | 3 | 1.5h | Low | No |
| 2 | Parser Functions | 4 | 3h | Low | After P1 |
| 3 | SuggestionCard | 4 | 2.5h | Medium | After P1 |
| 4 | ChatMessageBubble | 4 | 3h | Medium | After P3 |
| 5 | Task Components | 5 | 2.5h | Low | After P1 |
| 6 | Agent Components | 6 | 5h | Medium-High | After P1 |
| 7 | Custom Hooks | 6 | 6h | High | After P2-6 |
| 8 | Integration | 5 | 2.5h | Medium | After P7 |
| 9 | Testing & Cleanup | 5 | 2h | Low | After P8 |

---

## Dependency Graph

```
Phase 1 (Types)
    │
    ├─────────────────┬─────────────────┬─────────────────┐
    ▼                 ▼                 ▼                 ▼
Phase 2           Phase 3           Phase 5           Phase 6
(Parsers)         (Suggestion)      (Tasks)           (Agents)
    │                 │                                   │
    │                 ▼                                   │
    │             Phase 4                                 │
    │             (Message)                               │
    │                 │                                   │
    └────────────────┬┴───────────────────────────────────┘
                     │
                     ▼
                 Phase 7
              (Custom Hooks)
                     │
                     ▼
                 Phase 8
              (Integration)
                     │
                     ▼
                 Phase 9
            (Testing & Cleanup)
```

---

## Phase 1: Type Definitions (FR-009)

**Goal**: 型定義を独立ファイルに分離
**Risk Level**: Low
**Prerequisites**: None
**Estimated Time**: 1.5 hours

### TASK-1.1: Create Type Definition File
- **Description**: `types/moc.types.ts` ファイルを作成し、Section.MOC.tsx から型定義を移動
- **Estimated Time**: 45 minutes
- **Assignable to**: Any agent
- **Files to Create**:
  - `/home/ubuntu/Downloads/vow/frontend/app/dashboard/types/moc.types.ts`
- **Steps**:
  1. Create new file
  2. Copy type definitions from Section.MOC.tsx lines 29-176
  3. Add necessary imports (Goal, Habit, Sticky, Tag from '../types')
  4. Export all types
- **Acceptance Criteria**:
  - [ ] File created with all types
  - [ ] No TypeScript errors in the new file
  - [ ] All types have JSDoc comments

### TASK-1.2: Move Constants to Type File
- **Description**: TABS と ROLE_ICONS 定数を型ファイルに移動
- **Estimated Time**: 15 minutes
- **Assignable to**: Any agent
- **Prerequisites**: TASK-1.1
- **Files to Modify**:
  - `/home/ubuntu/Downloads/vow/frontend/app/dashboard/types/moc.types.ts`
- **Steps**:
  1. Copy TABS array (lines 40-45)
  2. Copy ROLE_ICONS object (lines 164-176)
  3. Export both constants
- **Acceptance Criteria**:
  - [ ] Constants exported correctly

### TASK-1.3: Update Section.MOC.tsx Imports
- **Description**: Section.MOC.tsx の型インポートを新ファイルに変更
- **Estimated Time**: 30 minutes
- **Assignable to**: Any agent
- **Prerequisites**: TASK-1.1, TASK-1.2
- **Files to Modify**:
  - `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.MOC.tsx`
- **Steps**:
  1. Add import statement for types/moc.types
  2. Remove inline type definitions (lines 29-176)
  3. Verify all references work
  4. Run `npm run build` to verify
- **Acceptance Criteria**:
  - [ ] Section.MOC.tsx imports from types/moc.types
  - [ ] Build passes without errors
  - [ ] No duplicate type definitions

---

## Phase 2: Parser Functions (FR-008)

**Goal**: パーサー関数を独立ユーティリティファイルに分離
**Risk Level**: Low
**Prerequisites**: Phase 1 complete
**Estimated Time**: 3 hours

### TASK-2.1: Create Parser Utility File
- **Description**: `utils/mocParsers.ts` ファイルを作成
- **Estimated Time**: 30 minutes
- **Assignable to**: Any agent
- **Prerequisites**: TASK-1.3
- **Files to Create**:
  - `/home/ubuntu/Downloads/vow/frontend/app/dashboard/utils/mocParsers.ts`
- **Steps**:
  1. Create new file
  2. Add necessary imports
  3. Create empty function stubs with types
- **Acceptance Criteria**:
  - [ ] File created with proper structure

### TASK-2.2: Move Parser Functions
- **Description**: parseSuggestions, parseSuggestion, parseQuickReplies, parseFollowUpActions を移動
- **Estimated Time**: 1 hour
- **Assignable to**: Any agent
- **Prerequisites**: TASK-2.1
- **Files to Modify**:
  - `/home/ubuntu/Downloads/vow/frontend/app/dashboard/utils/mocParsers.ts`
- **Source Lines**:
  - parseSuggestions: 2041-2300
  - parseSuggestion: 2302-2306
  - parseQuickReplies: 2313-2434
  - parseFollowUpActions: 2439-2465
- **Acceptance Criteria**:
  - [ ] All functions moved and exported
  - [ ] TypeScript types correct

### TASK-2.3: Move Remaining Functions
- **Description**: parseUnifiedResponse, parseMultiAgentSuggestion, generateManagerSummary, formatActivityContent, formatTime を移動
- **Estimated Time**: 45 minutes
- **Assignable to**: Any agent
- **Prerequisites**: TASK-2.2
- **Files to Modify**:
  - `/home/ubuntu/Downloads/vow/frontend/app/dashboard/utils/mocParsers.ts`
- **Source Lines**:
  - parseUnifiedResponse: 2471-2526
  - parseMultiAgentSuggestion: 2532-2638
  - generateManagerSummary: 2643-2680
  - formatActivityContent: 2019-2035
  - formatTime: 4503-4505
- **Acceptance Criteria**:
  - [ ] All functions moved and exported

### TASK-2.4: Update Section.MOC.tsx Parser Imports
- **Description**: Section.MOC.tsx でパーサー関数のインポートを更新
- **Estimated Time**: 45 minutes
- **Assignable to**: Any agent
- **Prerequisites**: TASK-2.3
- **Files to Modify**:
  - `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.MOC.tsx`
- **Steps**:
  1. Add import from utils/mocParsers
  2. Remove inline function definitions
  3. Verify all usages work
  4. Run `npm run build`
- **Acceptance Criteria**:
  - [ ] Build passes
  - [ ] Parser functions removed from Section.MOC.tsx

---

## Phase 3: SuggestionCard Component (FR-001)

**Goal**: SuggestionCard を独立コンポーネントに分離
**Risk Level**: Medium
**Prerequisites**: Phase 1 complete
**Estimated Time**: 2.5 hours
**Can Run Parallel With**: Phase 2

### TASK-3.1: Create SuggestionCard Component File
- **Description**: `components/Chat.SuggestionCard.tsx` ファイルを作成
- **Estimated Time**: 30 minutes
- **Assignable to**: Any agent
- **Prerequisites**: TASK-1.3
- **Files to Create**:
  - `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Chat.SuggestionCard.tsx`
- **Steps**:
  1. Create new file with 'use client' directive
  2. Add imports from types/moc.types
  3. Create empty component structure
- **Acceptance Criteria**:
  - [ ] File created with basic structure

### TASK-3.2: Move SuggestionCard Implementation
- **Description**: SuggestionCard コンポーネントの実装を移動
- **Estimated Time**: 1 hour
- **Assignable to**: Any agent
- **Prerequisites**: TASK-3.1
- **Source Lines**: 3026-3202
- **Files to Modify**:
  - `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Chat.SuggestionCard.tsx`
- **Steps**:
  1. Copy SuggestionCardProps interface
  2. Copy typeConfig object
  3. Copy SuggestionCard function component
  4. Add React.memo wrapper for optimization
- **Acceptance Criteria**:
  - [ ] Full component implementation moved
  - [ ] TypeScript types correct

### TASK-3.3: Add SuggestionCard Tests
- **Description**: SuggestionCard の基本テストを追加
- **Estimated Time**: 30 minutes
- **Assignable to**: Any agent
- **Prerequisites**: TASK-3.2
- **Files to Create**:
  - `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/__tests__/Chat.SuggestionCard.test.tsx`
- **Test Cases**:
  1. Renders habit suggestion correctly
  2. Renders goal suggestion correctly
  3. Shows accepted/snoozed/dismissed states
  4. Calls onAction when clicked
- **Acceptance Criteria**:
  - [ ] Tests pass

### TASK-3.4: Update Section.MOC.tsx SuggestionCard Import
- **Description**: Section.MOC.tsx の SuggestionCard インポートを更新
- **Estimated Time**: 30 minutes
- **Assignable to**: Any agent
- **Prerequisites**: TASK-3.2
- **Files to Modify**:
  - `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.MOC.tsx`
- **Steps**:
  1. Add import for Chat.SuggestionCard
  2. Remove inline SuggestionCard definition
  3. Run `npm run build`
- **Acceptance Criteria**:
  - [ ] Build passes
  - [ ] SuggestionCard removed from Section.MOC.tsx

---

## Phase 4: ChatMessageBubble Component (FR-002)

**Goal**: ChatMessageBubble を独立コンポーネントに分離
**Risk Level**: Medium
**Prerequisites**: Phase 3 complete
**Estimated Time**: 3 hours

### TASK-4.1: Create ChatMessageBubble Component File
- **Description**: `components/Chat.MessageBubble.tsx` ファイルを作成
- **Estimated Time**: 30 minutes
- **Assignable to**: Any agent
- **Prerequisites**: TASK-3.4
- **Files to Create**:
  - `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Chat.MessageBubble.tsx`
- **Steps**:
  1. Create new file with 'use client' directive
  2. Add imports
  3. Create empty component structure

### TASK-4.2: Move ChatMessageBubble Implementation
- **Description**: ChatMessageBubble コンポーネントの実装を移動
- **Estimated Time**: 1.5 hours
- **Assignable to**: Any agent
- **Prerequisites**: TASK-4.1
- **Source Lines**: 2820-3024
- **Files to Modify**:
  - `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Chat.MessageBubble.tsx`
- **Steps**:
  1. Copy ChatMessageBubbleProps interface
  2. Copy senderStyles object
  3. Copy roleBadgeColors object
  4. Copy ChatMessageBubble function component
  5. Import SuggestionCard from Chat.SuggestionCard
  6. Import formatTime from utils/mocParsers
- **Acceptance Criteria**:
  - [ ] Full component implementation moved

### TASK-4.3: Move GroupChatView Component
- **Description**: GroupChatView コンポーネントを同じファイルに移動するか別ファイルに分離
- **Estimated Time**: 30 minutes
- **Assignable to**: Any agent
- **Prerequisites**: TASK-4.2
- **Source Lines**: 2699-2818
- **Decision**: GroupChatView は ChatMessageBubble に強く依存しているため、同じファイルに配置
- **Acceptance Criteria**:
  - [ ] GroupChatView moved

### TASK-4.4: Update Section.MOC.tsx MessageBubble Import
- **Description**: Section.MOC.tsx のインポートを更新
- **Estimated Time**: 30 minutes
- **Assignable to**: Any agent
- **Prerequisites**: TASK-4.3
- **Files to Modify**:
  - `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.MOC.tsx`
- **Steps**:
  1. Add imports for Chat.MessageBubble
  2. Remove inline definitions
  3. Run `npm run build`
- **Acceptance Criteria**:
  - [ ] Build passes

---

## Phase 5: Task Components (FR-003, FR-004)

**Goal**: Task 関連コンポーネントを独立ファイルに分離
**Risk Level**: Low
**Prerequisites**: Phase 1 complete
**Estimated Time**: 2.5 hours
**Can Run Parallel With**: Phase 2, 3

### TASK-5.1: Create TaskDetail Modal File
- **Description**: `components/Modal.TaskDetail.tsx` ファイルを作成
- **Estimated Time**: 30 minutes
- **Assignable to**: Any agent
- **Prerequisites**: TASK-1.3
- **Files to Create**:
  - `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Modal.TaskDetail.tsx`

### TASK-5.2: Move TaskSection and TaskDetailModal
- **Description**: TaskSection と TaskDetailModal を移動
- **Estimated Time**: 1 hour
- **Assignable to**: Any agent
- **Prerequisites**: TASK-5.1
- **Source Lines**:
  - TaskSection: 3298-3358
  - TaskDetailModal: 3360-3508
- **Acceptance Criteria**:
  - [ ] Both components moved and exported

### TASK-5.3: Create TaskListView File
- **Description**: `components/Task.ListView.tsx` ファイルを作成
- **Estimated Time**: 15 minutes
- **Assignable to**: Any agent
- **Prerequisites**: TASK-5.2
- **Files to Create**:
  - `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Task.ListView.tsx`

### TASK-5.4: Move TaskListView Implementation
- **Description**: TaskListView を移動
- **Estimated Time**: 30 minutes
- **Assignable to**: Any agent
- **Prerequisites**: TASK-5.3
- **Source Lines**: 3204-3296
- **Steps**:
  1. Copy TaskListViewProps interface
  2. Copy TaskListView function component
  3. Import TaskSection and TaskDetailModal from Modal.TaskDetail
- **Acceptance Criteria**:
  - [ ] TaskListView moved and working

### TASK-5.5: Update Section.MOC.tsx Task Imports
- **Description**: Section.MOC.tsx のインポートを更新
- **Estimated Time**: 15 minutes
- **Assignable to**: Any agent
- **Prerequisites**: TASK-5.4
- **Files to Modify**:
  - `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.MOC.tsx`
- **Acceptance Criteria**:
  - [ ] Build passes

---

## Phase 6: Agent Components (FR-005, FR-006)

**Goal**: Agent 関連コンポーネントを独立ファイルに分離
**Risk Level**: Medium-High
**Prerequisites**: Phase 1 complete
**Estimated Time**: 5 hours
**Can Run Parallel With**: Phase 2, 3, 5

### TASK-6.1: Create RemoteAgentInstaller File
- **Description**: `components/Agent.RemoteInstaller.tsx` を作成
- **Estimated Time**: 30 minutes
- **Assignable to**: Any agent
- **Prerequisites**: TASK-1.3
- **Files to Create**:
  - `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Agent.RemoteInstaller.tsx`
- **Source Lines**: 3945-4127

### TASK-6.2: Create RemoteAgentGuide File
- **Description**: `components/Agent.RemoteGuide.tsx` を作成
- **Estimated Time**: 15 minutes
- **Assignable to**: Any agent
- **Prerequisites**: TASK-1.3
- **Files to Create**:
  - `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Agent.RemoteGuide.tsx`
- **Source Lines**: 4129-4193

### TASK-6.3: Create RemoteTaskExecutor File
- **Description**: `components/Agent.RemoteExecutor.tsx` を作成
- **Estimated Time**: 45 minutes
- **Assignable to**: Any agent
- **Prerequisites**: TASK-1.3
- **Files to Create**:
  - `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Agent.RemoteExecutor.tsx`
- **Source Lines**: 4195-4442

### TASK-6.4: Create AgentListView File
- **Description**: `components/Agent.ListView.tsx` を作成
- **Estimated Time**: 30 minutes
- **Assignable to**: Any agent
- **Prerequisites**: TASK-6.1, TASK-6.2, TASK-6.3
- **Files to Create**:
  - `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Agent.ListView.tsx`

### TASK-6.5: Move AgentListView Implementation
- **Description**: AgentListView と関連サブコンポーネントを移動
- **Estimated Time**: 2 hours
- **Assignable to**: Any agent
- **Prerequisites**: TASK-6.4
- **Source Lines**: 3510-3943
- **Includes**:
  - AgentListViewProps interface
  - AgentListView function component
  - AgentTooltip sub-component
  - TreeNode sub-component
  - statusColors, statusLabels, roleGradients objects
- **Steps**:
  1. Copy all related code
  2. Import Remote* components
  3. Import ROLE_ICONS from types/moc.types
- **Acceptance Criteria**:
  - [ ] AgentListView and sub-components moved
  - [ ] Tree rendering works correctly

### TASK-6.6: Update Section.MOC.tsx Agent Imports
- **Description**: Section.MOC.tsx のインポートを更新
- **Estimated Time**: 30 minutes
- **Assignable to**: Any agent
- **Prerequisites**: TASK-6.5
- **Files to Modify**:
  - `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.MOC.tsx`
- **Acceptance Criteria**:
  - [ ] Build passes
  - [ ] Agent tree renders correctly

---

## Phase 7: Custom Hooks (FR-007)

**Goal**: カスタムフックを抽出してロジックを分離
**Risk Level**: High
**Prerequisites**: Phase 2-6 complete
**Estimated Time**: 6 hours

### TASK-7.1: Create useMOCChat Hook File
- **Description**: `hooks/useMOCChat.ts` ファイルを作成
- **Estimated Time**: 30 minutes
- **Assignable to**: Any agent
- **Prerequisites**: TASK-2.4, TASK-4.4
- **Files to Create**:
  - `/home/ubuntu/Downloads/vow/frontend/app/dashboard/hooks/useMOCChat.ts`

### TASK-7.2: Extract Chat Logic to useMOCChat
- **Description**: チャット関連のロジックを useMOCChat に移動
- **Estimated Time**: 2 hours
- **Assignable to**: Any agent
- **Prerequisites**: TASK-7.1
- **Logic to Extract**:
  - messages state and setMessages
  - inputValue state
  - textareaRef
  - handleSendMessage callback
  - message conversion useEffect (lines 528-659)
  - handleQuickAction callback
  - handleQuickReplyClick callback
  - handleFollowUpActionClick callback
  - handleRetry callback
  - quickActions useMemo
  - activeAgent selection logic
  - shouldUseMcpAgent useMemo
  - isConnected useMemo
  - connectedAgentCount useMemo
  - availableAgents useMemo
- **Acceptance Criteria**:
  - [ ] Hook compiles without errors
  - [ ] Returns all necessary values

### TASK-7.3: Create useSuggestionState Hook File
- **Description**: `hooks/useSuggestionState.ts` ファイルを作成
- **Estimated Time**: 30 minutes
- **Assignable to**: Any agent
- **Prerequisites**: TASK-1.3
- **Files to Create**:
  - `/home/ubuntu/Downloads/vow/frontend/app/dashboard/hooks/useSuggestionState.ts`

### TASK-7.4: Extract Suggestion Logic to useSuggestionState
- **Description**: 提案関連のロジックを useSuggestionState に移動
- **Estimated Time**: 1 hour
- **Assignable to**: Any agent
- **Prerequisites**: TASK-7.3
- **Logic to Extract**:
  - suggestionStates state
  - snoozedSuggestions state
  - handleSuggestionAction callback (lines 717-911)
- **Acceptance Criteria**:
  - [ ] Hook compiles without errors

### TASK-7.5: Create useMOCModals Hook File
- **Description**: `hooks/useMOCModals.ts` ファイルを作成し、モーダル状態管理を移動
- **Estimated Time**: 1 hour
- **Assignable to**: Any agent
- **Prerequisites**: TASK-1.3
- **Files to Create**:
  - `/home/ubuntu/Downloads/vow/frontend/app/dashboard/hooks/useMOCModals.ts`
- **Logic to Extract**:
  - habitModalOpen, habitModalInitial states
  - goalModalOpen, goalModalInitial states
  - stickyModalOpen, stickyModalInitial states
  - agentDetailModalOpen, selectedAgentForDetail, agentDetailModalMode states
  - showHelpModal, showIssueModal states
  - openHabitModal, openGoalModal, openStickyModal callbacks
- **Acceptance Criteria**:
  - [ ] Hook compiles without errors

### TASK-7.6: Refactor MOCSection to Use New Hooks
- **Description**: MOCSection を新しいフックを使用するようにリファクタリング
- **Estimated Time**: 1 hour
- **Assignable to**: Any agent
- **Prerequisites**: TASK-7.2, TASK-7.4, TASK-7.5
- **Files to Modify**:
  - `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.MOC.tsx`
- **Steps**:
  1. Import new hooks
  2. Replace inline state/logic with hook calls
  3. Wire up hook return values to components
  4. Run `npm run build`
- **Acceptance Criteria**:
  - [ ] Build passes
  - [ ] All functionality works

---

## Phase 8: Integration (Post-Refactoring)

**Goal**: 全ての変更を統合し検証
**Risk Level**: Medium
**Prerequisites**: Phase 7 complete
**Estimated Time**: 2.5 hours

### TASK-8.1: Create History View File
- **Description**: `components/History.View.tsx` を作成し、HistoryView を移動
- **Estimated Time**: 30 minutes
- **Assignable to**: Any agent
- **Prerequisites**: TASK-7.6
- **Files to Create**:
  - `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/History.View.tsx`
- **Source Lines**: 4444-4501

### TASK-8.2: Update Section.MOC.tsx Final Cleanup
- **Description**: Section.MOC.tsx の最終クリーンアップ
- **Estimated Time**: 30 minutes
- **Assignable to**: Any agent
- **Prerequisites**: TASK-8.1
- **Steps**:
  1. Remove all inline component definitions
  2. Update all imports
  3. Verify file size is under 2,000 lines
  4. Run `npm run build`
- **Acceptance Criteria**:
  - [ ] File size <= 2,000 lines
  - [ ] Build passes

### TASK-8.3: Update Exports and Index Files
- **Description**: 新しいコンポーネントのエクスポートを整理
- **Estimated Time**: 30 minutes
- **Assignable to**: Any agent
- **Prerequisites**: TASK-8.2
- **Files to Modify/Create**:
  - `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/index.ts` (if exists)
  - `/home/ubuntu/Downloads/vow/frontend/app/dashboard/hooks/index.ts`
  - `/home/ubuntu/Downloads/vow/frontend/app/dashboard/types/index.ts`
  - `/home/ubuntu/Downloads/vow/frontend/app/dashboard/utils/index.ts`
- **Acceptance Criteria**:
  - [ ] All new modules properly exported

### TASK-8.4: Run Build Verification
- **Description**: 完全なビルド検証を実行
- **Estimated Time**: 30 minutes
- **Assignable to**: Any agent
- **Prerequisites**: TASK-8.3
- **Steps**:
  1. Run `npm run build`
  2. Run `npm run lint`
  3. Fix any warnings/errors
- **Acceptance Criteria**:
  - [ ] Build passes with no errors
  - [ ] No ESLint warnings

### TASK-8.5: Manual Functionality Test
- **Description**: 手動でのフル機能テスト
- **Estimated Time**: 30 minutes
- **Assignable to**: Any agent
- **Prerequisites**: TASK-8.4
- **Test Checklist**:
  - [ ] Chat message send/receive
  - [ ] Suggestion card display and actions
  - [ ] Quick reply buttons
  - [ ] Task list and detail modal
  - [ ] Agent tree display
  - [ ] Remote task execution
  - [ ] History view

---

## Phase 9: Testing & Cleanup

**Goal**: テスト追加とドキュメント整備
**Risk Level**: Low
**Prerequisites**: Phase 8 complete
**Estimated Time**: 2 hours

### TASK-9.1: Add Parser Unit Tests
- **Description**: mocParsers.ts のユニットテストを追加
- **Estimated Time**: 30 minutes
- **Assignable to**: Any agent
- **Prerequisites**: TASK-8.4
- **Files to Create**:
  - `/home/ubuntu/Downloads/vow/frontend/app/dashboard/utils/__tests__/mocParsers.test.ts`
- **Test Coverage**:
  - parseSuggestions
  - parseQuickReplies
  - parseUnifiedResponse

### TASK-9.2: Add Hook Unit Tests
- **Description**: 新しいフックのユニットテストを追加
- **Estimated Time**: 30 minutes
- **Assignable to**: Any agent
- **Prerequisites**: TASK-8.4
- **Files to Create**:
  - `/home/ubuntu/Downloads/vow/frontend/app/dashboard/hooks/__tests__/useSuggestionState.test.ts`

### TASK-9.3: Run E2E Tests
- **Description**: 既存のE2Eテストを実行して回帰がないことを確認
- **Estimated Time**: 30 minutes
- **Assignable to**: Any agent
- **Prerequisites**: TASK-8.5
- **Steps**:
  1. Run `npm run e2e`
  2. Verify all tests pass
- **Acceptance Criteria**:
  - [ ] All E2E tests pass

### TASK-9.4: Update COORDINATION.md
- **Description**: COORDINATIONファイルにリファクタリング完了を記録
- **Estimated Time**: 15 minutes
- **Assignable to**: Any agent
- **Prerequisites**: TASK-9.3
- **Files to Modify**:
  - `/home/ubuntu/Downloads/vow/specs/COORDINATION.md`

### TASK-9.5: Create Migration Summary
- **Description**: リファクタリングの結果サマリーを作成
- **Estimated Time**: 15 minutes
- **Assignable to**: Any agent
- **Prerequisites**: TASK-9.4
- **Files to Create**:
  - `/home/ubuntu/Downloads/vow/specs/moc-section-refactoring/SUMMARY.md`
- **Contents**:
  - Before/After file sizes
  - Files created
  - Performance impact (if any)
  - Lessons learned

---

## Parallel Execution Guide

### 3-Agent Parallel Execution Plan

**Agent A (Frontend Focus)**:
- Phase 1: TASK-1.1, 1.2, 1.3 (1.5h)
- Phase 3: TASK-3.1, 3.2, 3.3, 3.4 (2.5h)
- Phase 4: TASK-4.1, 4.2, 4.3, 4.4 (3h)
- **Total**: 7h

**Agent B (Backend/Utils Focus)**:
- Phase 2: TASK-2.1, 2.2, 2.3, 2.4 (3h)
- Phase 7: TASK-7.1, 7.2, 7.3, 7.4 (4h)
- **Total**: 7h

**Agent C (Components Focus)**:
- Phase 5: TASK-5.1, 5.2, 5.3, 5.4, 5.5 (2.5h)
- Phase 6: TASK-6.1, 6.2, 6.3, 6.4, 6.5, 6.6 (5h)
- **Total**: 7.5h

**Integration Phase (All Agents)**:
- Phase 7: TASK-7.5, 7.6 (after Agent B completes 7.4)
- Phase 8: All tasks
- Phase 9: All tasks
- **Total**: ~4.5h

**Total Elapsed Time with 3 Agents**: ~12 hours (vs 28 hours sequential)

---

## Risk Mitigation Checkpoints

### After Phase 1
- [ ] `npm run build` passes
- [ ] Types importable from new location

### After Phase 2
- [ ] Parser functions work in isolation
- [ ] No runtime errors in chat flow

### After Phase 4
- [ ] Chat messages render correctly
- [ ] Suggestions display properly

### After Phase 6
- [ ] Agent tree renders
- [ ] Remote task execution works

### After Phase 7
- [ ] All hooks return correct values
- [ ] No state management issues

### After Phase 8
- [ ] Full application works
- [ ] File size target met

### After Phase 9
- [ ] All tests pass
- [ ] No regressions
