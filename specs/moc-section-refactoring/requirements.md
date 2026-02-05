# Section.MOC.tsx Refactoring Specification - Requirements

## Overview
- **Purpose**: 4,507行の巨大ファイル Section.MOC.tsx を保守しやすい小さなモジュールに分割する
- **Status**: Draft
- **Version**: 1.0.0
- **Last Updated**: 2026-02-05
- **Author**: vow-spec-architect

## Problem Statement

### Current State Analysis (2026-02-05時点)

**File Location**: `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.MOC.tsx`

**File Statistics**:
- Total Lines: 4,507行
- Imports: 28件（行1-28）
- Type Definitions: ~160行（行29-176）
- Main Component (MOCSection): ~1,840行（行177-2016）
- Helper Functions: ~520行（行2018-2526）
- Sub-Components: ~1,980行（行2527-4507）

**Identified Sub-Components** (同一ファイル内):

| Component | Lines | Approx. Size | Complexity |
|-----------|-------|--------------|------------|
| `GroupChatView` | 2699-2818 | ~120行 | Low |
| `ChatMessageBubble` | 2820-3024 | ~205行 | Medium |
| `SuggestionCard` | 3026-3202 | ~177行 | Medium |
| `TaskListView` | 3204-3296 | ~93行 | Low |
| `TaskSection` | 3298-3358 | ~61行 | Low |
| `TaskDetailModal` | 3360-3508 | ~149行 | Medium |
| `AgentListView` | 3510-3943 | ~434行 | High |
| `RemoteAgentInstaller` | 3945-4127 | ~183行 | Medium |
| `RemoteAgentGuide` | 4129-4193 | ~65行 | Low |
| `RemoteTaskExecutor` | 4195-4442 | ~248行 | High |
| `HistoryView` | 4444-4501 | ~58行 | Low |

**Helper Functions**:
- `formatActivityContent` (2018-2035): ~18行
- `parseSuggestions` (2037-2300): ~264行
- `parseSuggestion` (2302-2306): ~5行
- `parseQuickReplies` (2308-2434): ~127行
- `parseFollowUpActions` (2436-2465): ~30行
- `parseUnifiedResponse` (2467-2526): ~60行
- `parseMultiAgentSuggestion` (2528-2638): ~111行
- `generateManagerSummary` (2640-2680): ~41行
- `formatTime` (4503-4505): ~3行

**Hook Usage** (81 calls identified):
- `useState`: ~30 calls
- `useCallback`: ~20 calls
- `useEffect`: ~8 calls
- `useMemo`: ~10 calls
- `useRef`: ~3 calls
- Custom hooks: ~10 calls (useMultiAgentServer, useMastraAgent, useMcpChat, etc.)

### Problems

1. **Maintainability (保守性)**
   - 4,500行超のファイルは変更時の影響範囲把握が困難
   - 複数開発者の並列作業でコンフリクトが頻発

2. **Code Organization (コード構成)**
   - 型定義、ヘルパー関数、UIコンポーネントが混在
   - 責務の分離が不明確

3. **Testing (テスト性)**
   - コンポーネント単体テストが困難
   - ヘルパー関数のユニットテストが書きにくい

4. **Performance (パフォーマンス)**
   - 不必要な再レンダリングの可能性
   - コンポーネント分離によるメモ化の機会損失

---

## Functional Requirements

### FR-001: SuggestionCard Component Extraction
提案カードコンポーネントを独立ファイルに分離する

- **Source**: Section.MOC.tsx 行3026-3202 (~177行)
- **Target**: `components/Chat.SuggestionCard.tsx`
- **Includes**:
  - SuggestionCardProps interface
  - SuggestionCard function component
  - typeConfig オブジェクト (type icons/labels/colors)
  - Status display logic (accepted/snoozed/dismissed)
- **Dependencies**:
  - `SuggestionButtonType` type (既存 export済み)
  - `SuggestionState` type (export必要)
  - `GroupChatMessage['suggestion']` type
- **Risk Level**: Medium

### FR-002: ChatMessageBubble Component Extraction
チャットメッセージバブルコンポーネントを独立ファイルに分離する

- **Source**: Section.MOC.tsx 行2820-3024 (~205行)
- **Target**: `components/Chat.MessageBubble.tsx`
- **Includes**:
  - ChatMessageBubbleProps interface
  - ChatMessageBubble function component
  - senderStyles object
  - roleBadgeColors object
- **Dependencies**:
  - GroupChatMessage type
  - UnifiedButton type (from `types/candidate-button.types`)
  - SuggestionCard component (FR-001)
  - CandidateButtonCard component (既存)
  - RefineActionButtons component (既存)
- **Risk Level**: Medium

### FR-003: TaskListView Component Extraction
タスクリストビューコンポーネントを独立ファイルに分離する

- **Source**: Section.MOC.tsx 行3204-3296 (~93行)
- **Target**: `components/Task.ListView.tsx`
- **Includes**:
  - TaskListViewProps interface
  - TaskListView function component
  - Task filtering logic (inProgress, pending, completed)
- **Dependencies**:
  - TaskWithDetail type (export必要)
  - TaskSection component (FR-004)
  - TaskDetailModal component (FR-004)
  - ServerConnection type (from hooks)
- **Risk Level**: Low

### FR-004: Task Section and Modal Components Extraction
タスクセクションとモーダルコンポーネントを独立ファイルに分離する

- **Source**: Section.MOC.tsx 行3298-3508 (~210行)
- **Target**: `components/Modal.TaskDetail.tsx`
- **Includes**:
  - TaskSectionProps interface
  - TaskSection function component
  - TaskDetailModalProps interface
  - TaskDetailModal function component
  - priorityColors/priorityBgColors objects
  - statusOptions array
  - priorityLabels object
- **Dependencies**:
  - TaskWithDetail type
- **Risk Level**: Low

### FR-005: AgentListView Component Extraction
エージェントリストビューコンポーネントを独立ファイルに分離する

- **Source**: Section.MOC.tsx 行3510-3943 (~434行)
- **Target**: `components/Agent.ListView.tsx`
- **Includes**:
  - AgentListViewProps interface
  - AgentListView function component
  - AgentTooltip sub-component
  - TreeNode sub-component
  - statusColors/statusLabels objects
  - roleGradients object
  - getChildAgents helper
- **Dependencies**:
  - ServerConnection type
  - AgentConfig type (from Modal.AgentDetail)
  - ROLE_ICONS constant
  - RemoteAgentInstaller component (FR-006)
  - RemoteAgentGuide component (FR-006)
  - RemoteTaskExecutor component (FR-006)
- **Risk Level**: High (largest component, nested sub-components)

### FR-006: Remote Agent Components Extraction
リモートエージェント関連コンポーネントを独立ファイルに分離する

- **Source**: Section.MOC.tsx 行3945-4442 (~498行)
- **Target**:
  - `components/Agent.RemoteInstaller.tsx` (~183行)
  - `components/Agent.RemoteGuide.tsx` (~65行)
  - `components/Agent.RemoteExecutor.tsx` (~248行)
- **Includes**:
  - RemoteAgentInstaller function component
  - RemoteAgentGuide function component
  - RemoteTaskExecutor function component
  - installerConfig state management
  - SSE streaming logic for task execution
- **Dependencies**:
  - ReactMarkdown (external)
  - fetch API calls
- **Risk Level**: Medium

### FR-007: Custom Hooks Extraction
メインコンポーネント内のロジックをカスタムフックに抽出する

- **Target Hooks**:
  - `hooks/useMOCChat.ts` (~150行推定)
    - activeAgent selection logic (useMemo)
    - handleSendMessage callback
    - message conversion useEffect
    - handleQuickAction callback
  - `hooks/useSuggestionState.ts` (~100行推定)
    - suggestionStates state
    - snoozedSuggestions state
    - handleSuggestionAction callback
  - `hooks/useMOCModals.ts` (~80行推定)
    - habitModalOpen/Initial states
    - goalModalOpen/Initial states
    - stickyModalOpen/Initial states
    - agentDetailModal states
    - showHelpModal/showIssueModal states
    - openHabitModal/openGoalModal/openStickyModal callbacks
- **Risk Level**: High (state management coupling)

### FR-008: Parser Functions Extraction
パーサー関数群を独立ユーティリティファイルに分離する

- **Source**: Section.MOC.tsx 行2037-2680 (~644行)
- **Target**: `utils/mocParsers.ts`
- **Functions to Extract**:
  - `parseSuggestions` (~264行)
  - `parseSuggestion` (~5行)
  - `parseQuickReplies` (~127行)
  - `parseFollowUpActions` (~30行)
  - `parseUnifiedResponse` (~60行)
  - `parseMultiAgentSuggestion` (~111行)
  - `generateManagerSummary` (~41行)
- **Dependencies**:
  - MastraMessage type
  - GroupChatMessage type
  - UnifiedButton type
  - SuggestionButtonType type
  - AgentResponse type
- **Risk Level**: Low (pure functions)

### FR-009: Type Definitions Extraction
型定義を独立ファイルに分離する

- **Source**: Section.MOC.tsx 行29-176 (~148行)
- **Target**: `types/moc.types.ts`
- **Types to Extract**:
  - TabId
  - TabConfig
  - GroupChatMessage (export済み)
  - SuggestionButtonType (export済み)
  - MOCSectionProps
  - SuggestionStatus
  - SuggestionState
  - SnoozedSuggestion
  - TaskWithDetail
  - HistoryFilter
  - AgentResponse
  - AggregationSession
  - SelectableAgent
- **Risk Level**: Low

---

## Non-Functional Requirements

### NFR-001: Backward Compatibility
既存の機能を壊さない

- 全ての公開APIを維持
- exportされている型・コンポーネントの互換性を保持
- Section.MOC.tsx の export default MOCSection は維持

### NFR-002: Incremental Migration
段階的な移行を実施

- 各フェーズで独立してデプロイ可能
- 既存コードとの共存期間を設ける
- 各フェーズ完了後にビルド・テスト実行

### NFR-003: Code Quality
コード品質の維持・向上

- ESLint/Prettier警告ゼロを維持
- TypeScript strict mode対応
- 各ファイルに適切なJSDocコメント

### NFR-004: Performance
パフォーマンスへの影響を最小化

- React.memo による不要な再レンダリング防止
- 適切な useCallback/useMemo の使用
- バンドルサイズの増加を10%未満に抑える

### NFR-005: Testing
テスト可能性の向上

- 抽出されたコンポーネントは単体テスト可能
- パーサー関数は純粋関数としてテスト可能
- 既存のE2Eテストをパスする

---

## Acceptance Criteria

### AC-001: Build Success
全フェーズ完了後、`npm run build` がエラーなしで成功する

### AC-002: Test Pass
既存のテストスイートが全てパスする
- `npm test` (unit tests)
- `npm run e2e` (E2E tests) - 既存テストのみ

### AC-003: Functionality Preserved
以下の機能が正常に動作することを手動確認:
- [ ] チャットメッセージ送信・受信
- [ ] 提案カード表示・アクション (Accept/Snooze/Dismiss)
- [ ] クイックリプライボタン
- [ ] タスクリスト表示・詳細モーダル
- [ ] エージェントツリー表示
- [ ] リモートタスク実行
- [ ] 履歴ビュー

### AC-004: File Size Reduction
Section.MOC.tsx のファイルサイズが 2,000行以下になる

### AC-005: No New Warnings
リファクタリングによる新しいESLint/TypeScript警告が発生しない

---

## Dependencies and Risk Analysis

### External Dependencies
| Dependency | Version | Usage |
|------------|---------|-------|
| react | 19.x | Core framework |
| react-markdown | ^9.0.0 | RemoteAgentGuide content |
| typescript | 5.x | Type checking |

### Internal Dependencies
| Module | Depends On |
|--------|------------|
| Chat.SuggestionCard | types/moc.types |
| Chat.MessageBubble | Chat.SuggestionCard, types/moc.types |
| Task.ListView | Modal.TaskDetail, types/moc.types |
| Modal.TaskDetail | types/moc.types |
| Agent.ListView | Agent.Remote*, types/moc.types |
| Agent.Remote* | (standalone) |
| hooks/useMOCChat | types/moc.types, utils/mocParsers |
| utils/mocParsers | types/moc.types |

### Risk Matrix

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| State coupling破壊 | Medium | High | Phase 7を最後に実施、十分なテスト |
| Import循環依存 | Low | Medium | 依存関係図の事前検証 |
| パフォーマンス劣化 | Low | Medium | React DevToolsでプロファイリング |
| 型エラー | Medium | Low | TypeScript strict mode使用 |
| E2Eテスト失敗 | Medium | High | 各フェーズでテスト実行 |

---

## Phase Execution Order

依存関係とリスクレベルを考慮した推奨実行順序:

1. **Phase 1**: FR-009 Type Definitions (Low Risk) - 他の全てが依存
2. **Phase 2**: FR-008 Parser Functions (Low Risk) - 純粋関数、依存少
3. **Phase 3**: FR-001 SuggestionCard (Medium Risk) - 独立性高
4. **Phase 4**: FR-002 ChatMessageBubble (Medium Risk) - SuggestionCardに依存
5. **Phase 5**: FR-004 Task Modal/Section (Low Risk) - 独立性高
6. **Phase 6**: FR-003 TaskListView (Low Risk) - Task Modal/Sectionに依存
7. **Phase 7**: FR-006 Remote Agent Components (Medium Risk) - 独立性高
8. **Phase 8**: FR-005 AgentListView (High Risk) - Remote Componentsに依存
9. **Phase 9**: FR-007 Custom Hooks (High Risk) - 最後に実施、state coupling
