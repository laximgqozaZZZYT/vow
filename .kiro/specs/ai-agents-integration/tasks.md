# AI Coaching / Agents Integration - Implementation Tasks

## Overview

| Phase | Tasks | Priority | Estimated Hours |
|-------|-------|----------|-----------------|
| Phase 1: 基盤構築 | 3 tasks | High | 8h |
| Phase 2: マネージャーモード | 4 tasks | High | 12h |
| Phase 3: グループチャット強化 | 3 tasks | Medium | 6h |
| Phase 4: コーチモード強化 | 2 tasks | Medium | 4h |
| Phase 5: 統合テスト | 3 tasks | High | 6h |
| **Total** | **15 tasks** | - | **36h** |

---

## Phase 1: 基盤構築

### TASK-1.1: Section.AIAssistant スケルトン作成

**Priority**: High
**Estimated**: 3h
**Assignable to**: frontend-developer
**Prerequisite**: None
**Blocks**: TASK-1.3, TASK-2.1

#### Description

AI CoachingセクションとAgentsセクションを統合する新しいメインコンポーネントを作成する。

#### Acceptance Criteria

- [ ] `Section.AIAssistant.tsx` ファイルを作成
- [ ] モード切り替えUI（Coach | Manager タブ）を実装
- [ ] Premiumユーザーチェックを追加
- [ ] MCP接続状態インジケーターを表示
- [ ] 設定ボタン（Modal.MultiAgentConfig呼び出し）を配置
- [ ] モバイル・デスクトップ両対応のレスポンシブレイアウト

#### Technical Notes

```tsx
// 基本構造
export default function AIAssistantSection({
  goals,
  habits,
  onHabitCreated,
  onGoalCreated,
  locale = 'ja',
}: AIAssistantSectionProps) {
  const { mode, setMode, isCoachMode, isManagerMode } = useAIAssistantMode();
  const { connectionState, agents, ... } = useMultiAgentServer({ authToken });

  return (
    <section className="...">
      <Header mode={mode} onModeChange={setMode} connectionState={connectionState} />
      <ContentArea>
        {isCoachMode && <CoachModeView ... />}
        {isManagerMode && <ManagerModeView ... />}
      </ContentArea>
      <UnifiedInputArea ... />
    </section>
  );
}
```

#### Files to Create/Modify

- **Create**: `frontend/app/dashboard/components/Section.AIAssistant.tsx`
- **Modify**: `frontend/app/dashboard/page.tsx` (セクション切り替え)

---

### TASK-1.2: useAIAssistantMode フック作成

**Priority**: High
**Estimated**: 2h
**Assignable to**: frontend-developer
**Prerequisite**: None
**Blocks**: TASK-1.1

#### Description

モード切り替え状態を管理するカスタムフックを作成する。

#### Acceptance Criteria

- [ ] `useAIAssistantMode.ts` フックを作成
- [ ] mode state ('coach' | 'manager') を管理
- [ ] localStorage に永続化
- [ ] setMode, toggleMode 関数を提供
- [ ] isCoachMode, isManagerMode 便利プロパティを提供
- [ ] TypeScript型定義を完備

#### Technical Notes

See `design.md` Section 2.2 for interface definition.

#### Files to Create

- **Create**: `frontend/app/dashboard/hooks/useAIAssistantMode.ts`

---

### TASK-1.3: Section.Coach リファクタリング

**Priority**: High
**Estimated**: 3h
**Assignable to**: frontend-developer
**Prerequisite**: TASK-1.1
**Blocks**: TASK-4.1, TASK-4.2

#### Description

既存の Section.Coach を View.CoachMode として抽出し、Section.AIAssistant から呼び出せるようにする。

#### Acceptance Criteria

- [ ] `View.CoachMode.tsx` を作成（Section.Coachのロジックを移行）
- [ ] 明確なpropsインターフェースを定義
- [ ] ヘッダー・フッターは親コンポーネントに任せる
- [ ] 既存の機能（Mastra連携、提案カード、レベル設定）を維持
- [ ] 後方互換性のため Section.Coach.tsx は View.CoachMode をラップする形で残す

#### Technical Notes

```tsx
// View.CoachMode props
interface CoachModeViewProps {
  goals: Goal[];
  habits: Habit[];
  messages: Message[];
  onAddMessage: (role: 'user' | 'assistant', content: string, ...) => void;
  onHabitCreated?: () => void;
  onGoalCreated?: () => void;
  locale?: 'ja' | 'en';
  authToken: string | null;
  mastraAgent: UseMastraAgentReturn;
  // ... extracted from Section.Coach state
}
```

#### Files to Create/Modify

- **Create**: `frontend/app/dashboard/components/View.CoachMode.tsx`
- **Modify**: `frontend/app/dashboard/components/Section.Coach.tsx` (wrapper only)

---

## Phase 2: マネージャーモード

### TASK-2.1: View.ManagerMode 作成

**Priority**: High
**Estimated**: 4h
**Assignable to**: frontend-developer
**Prerequisite**: TASK-1.1
**Blocks**: TASK-3.1

#### Description

マネージャーモードの表示コンポーネントを作成する。

#### Acceptance Criteria

- [ ] `View.ManagerMode.tsx` を作成
- [ ] Agent Status Bar を表示（Widget.AgentStatusBar使用）
- [ ] Group Chat Timeline を表示
- [ ] Template Selector を表示
- [ ] MCP未接続時の空状態UIを表示
- [ ] タスク作成・割り当てフローを実装

#### Technical Notes

See `design.md` Section 4.2 for AgentStatusBar implementation.

#### Files to Create

- **Create**: `frontend/app/dashboard/components/View.ManagerMode.tsx`
- **Create**: `frontend/app/dashboard/components/Widget.AgentStatusBar.tsx`

---

### TASK-2.2: taskTemplates.ts 作成

**Priority**: High
**Estimated**: 2h
**Assignable to**: frontend-developer
**Prerequisite**: None
**Blocks**: TASK-2.3

#### Description

タスクテンプレートのスキーマ定義と初期テンプレートを作成する。

#### Acceptance Criteria

- [ ] `template.types.ts` に型定義を作成
- [ ] `taskTemplates.ts` に5つのシステムテンプレートを定義
  - 習慣分析 (habit-analysis)
  - 週次レビュー (weekly-review)
  - ゴール設計 (goal-planning)
  - SPEC作成 (spec-draft)
  - コードレビュー (code-review)
- [ ] `fillTemplate()` 関数を実装
- [ ] `getTemplatesByCategory()` 関数を実装

#### Technical Notes

See `design.md` Section 3 for complete template definitions.

#### Files to Create

- **Create**: `frontend/app/dashboard/types/template.types.ts`
- **Create**: `frontend/app/dashboard/data/taskTemplates.ts`

---

### TASK-2.3: Widget.TemplateSelector 作成

**Priority**: High
**Estimated**: 3h
**Assignable to**: frontend-developer
**Prerequisite**: TASK-2.2
**Blocks**: TASK-2.4

#### Description

テンプレート選択UIコンポーネントを作成する。

#### Acceptance Criteria

- [ ] `Widget.TemplateSelector.tsx` を作成
- [ ] テンプレートカードのグリッド表示
- [ ] テンプレート変数入力フォーム（モーダル形式）
- [ ] 入力プレビュー表示
- [ ] 必須項目バリデーション
- [ ] カテゴリフィルタリング（オプション）

#### Technical Notes

See `design.md` Section 4.1 for implementation.

#### Files to Create

- **Create**: `frontend/app/dashboard/components/Widget.TemplateSelector.tsx`

---

### TASK-2.4: テンプレートからタスク作成フロー

**Priority**: High
**Estimated**: 3h
**Assignable to**: frontend-developer
**Prerequisite**: TASK-2.3
**Blocks**: None

#### Description

テンプレート選択後のタスク作成・割り当てフローを実装する。

#### Acceptance Criteria

- [ ] テンプレート選択イベントのハンドリング
- [ ] 変数置換（fillTemplate）の適用
- [ ] `useMultiAgentServer.createTask()` 呼び出し
- [ ] ターゲットエージェントの決定ロジック
  - テンプレートの `requiredAgentRole` を優先
  - 該当ロールがいなければ `fallbackToManager`
  - 選択エージェントがあれば優先
- [ ] 作成結果のチャットメッセージ表示
- [ ] エラーハンドリング

#### Technical Notes

```typescript
const handleTemplateSelect = async (
  template: TaskTemplate,
  variables: Record<string, string | number>
) => {
  const { title, description } = fillTemplate(template, variables);

  // Find target agent
  let targetAgentId = selectedAgentId;
  if (!targetAgentId && template.requiredAgentRole) {
    const roleAgent = agents.find(
      a => a.role === template.requiredAgentRole && a.status === 'idle'
    );
    if (roleAgent) {
      targetAgentId = roleAgent.id;
    } else if (template.fallbackToManager) {
      const manager = agents.find(a => a.role === 'manager' && a.status !== 'offline');
      targetAgentId = manager?.id;
    }
  }

  const task = await server.createTask(serverId, {
    title,
    description,
    priority: template.defaultPriority,
    tags: template.defaultTags,
    assignTo: targetAgentId,
  });

  // ... handle response
};
```

#### Files to Modify

- **Modify**: `frontend/app/dashboard/components/View.ManagerMode.tsx`

---

## Phase 3: グループチャット強化

### TASK-3.1: チャットタイムライン統合

**Priority**: Medium
**Estimated**: 3h
**Assignable to**: frontend-developer
**Prerequisite**: TASK-2.1
**Blocks**: TASK-3.2, TASK-3.3

#### Description

Modal.ManagerChat からチャットタイムラインロジックを抽出し、埋め込み可能なコンポーネントにする。

#### Acceptance Criteria

- [ ] `Widget.GroupChatTimeline.tsx` を作成
- [ ] MessageBubble コンポーネントを抽出（または再利用）
- [ ] ActivityからChatMessageへの変換ロジックを移植
- [ ] processedActivityIds のトラッキング
- [ ] 自動スクロール機能
- [ ] 日付セパレーター（オプション）

#### Technical Notes

Modal.ManagerChat の以下のロジックを抽出:
- `convertActivityToMessage()`
- `MessageBubble` コンポーネント
- SSEイベント→メッセージ変換 useEffect

#### Files to Create/Modify

- **Create**: `frontend/app/dashboard/components/Widget.GroupChatTimeline.tsx`
- **Modify**: `frontend/app/dashboard/components/Modal.ManagerChat.tsx` (リファクタ)

---

### TASK-3.2: タスクフォーカス機能

**Priority**: Medium
**Estimated**: 2h
**Assignable to**: frontend-developer
**Prerequisite**: TASK-3.1
**Blocks**: None

#### Description

特定タスクに関連するメッセージのみをフィルタ表示する機能を実装する。

#### Acceptance Criteria

- [ ] `focusTaskId` state を管理
- [ ] メッセージをtaskIdでフィルタリング
- [ ] フォーカスバナー表示（タスク名、ステータス、解除ボタン）
- [ ] フォーカス時の最初の関連メッセージへスクロール
- [ ] フィルタ解除 ("Show all") ボタン

#### Technical Notes

```typescript
const filteredMessages = useMemo(() => {
  if (!focusTaskId) return allMessages;
  return allMessages.filter(m => m.taskId === focusTaskId);
}, [allMessages, focusTaskId]);
```

#### Files to Modify

- **Modify**: `frontend/app/dashboard/components/Widget.GroupChatTimeline.tsx`

---

### TASK-3.3: リアルタイム更新最適化

**Priority**: Medium
**Estimated**: 1h
**Assignable to**: frontend-developer
**Prerequisite**: TASK-3.1
**Blocks**: None

#### Description

SSEイベントの処理を最適化し、パフォーマンスを向上させる。

#### Acceptance Criteria

- [ ] SSEイベントのデバウンス（100ms）
- [ ] メッセージ数リミット（100件）
- [ ] 重複イベントの確実な除外
- [ ] バッチ更新によるレンダリング最適化

#### Technical Notes

```typescript
// Debounce hook
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}
```

#### Files to Modify

- **Modify**: `frontend/app/dashboard/components/Widget.GroupChatTimeline.tsx`
- **Create** (optional): `frontend/app/dashboard/hooks/useDebouncedValue.ts`

---

## Phase 4: コーチモード強化

### TASK-4.1: コンテキストベース推奨プロンプト強化

**Priority**: Medium
**Estimated**: 2h
**Assignable to**: frontend-developer
**Prerequisite**: TASK-1.3
**Blocks**: None

#### Description

ユーザーの習慣・目標データに基づいて、より賢い推奨プロンプトを生成する。

#### Acceptance Criteria

- [ ] `getContextualPrompts()` 関数を拡張
- [ ] 未設定レベルの習慣数をチェック
- [ ] 今日の未完了習慣数をチェック
- [ ] 習慣のないゴールをチェック
- [ ] 達成率が低い習慣へのフォローアップ提案
- [ ] 時間帯に応じた提案（朝/夜）

#### Technical Notes

```typescript
function getContextualPrompts(
  habits: Habit[],
  goals: Goal[],
  locale: 'ja' | 'en',
  timeOfDay: 'morning' | 'evening' | 'other'
): Choice[] {
  const prompts: Choice[] = [];

  // Time-based suggestions
  if (timeOfDay === 'morning') {
    prompts.push({
      id: 'morning-check',
      label: locale === 'ja' ? '今日の習慣をチェック' : 'Check today\'s habits',
      icon: '☀️',
    });
  }

  // ... more context-based logic

  return prompts.slice(0, 3);
}
```

#### Files to Modify

- **Modify**: `frontend/app/dashboard/components/View.CoachMode.tsx`

---

### TASK-4.2: ツールコール視覚化改善

**Priority**: Medium
**Estimated**: 2h
**Assignable to**: frontend-developer
**Prerequisite**: TASK-1.3
**Blocks**: None

#### Description

Mastraエージェントのツール呼び出し表示をより詳細で分かりやすくする。

#### Acceptance Criteria

- [ ] ツール実行中のスピナー表示
- [ ] ツール名と説明の表示改善
- [ ] 成功/失敗のアイコン表示
- [ ] 失敗時のエラーメッセージ表示
- [ ] リトライボタンの追加
- [ ] 複数ツール呼び出し時の順序表示

#### Technical Notes

ToolCallVisualization コンポーネントを拡張:
- 実行中状態のアニメーション
- ホバーで詳細表示（ツールパラメータなど）
- エラー時のスタックトレース表示（デバッグモード）

#### Files to Modify

- **Modify**: `frontend/app/dashboard/components/View.CoachMode.tsx` (ToolCallVisualization)

---

## Phase 5: 統合テスト

### TASK-5.1: ユニットテスト作成

**Priority**: High
**Estimated**: 2h
**Assignable to**: tester
**Prerequisite**: Phase 1-2 完了
**Blocks**: None

#### Description

新規フックとユーティリティ関数のユニットテストを作成する。

#### Test Targets

- [ ] `useAIAssistantMode` フック
- [ ] `fillTemplate()` 関数
- [ ] `getTemplatesByCategory()` 関数
- [ ] `getContextualPrompts()` 関数

#### Files to Create

- **Create**: `frontend/app/dashboard/hooks/__tests__/useAIAssistantMode.test.ts`
- **Create**: `frontend/app/dashboard/data/__tests__/taskTemplates.test.ts`

---

### TASK-5.2: 統合テスト作成

**Priority**: High
**Estimated**: 2h
**Assignable to**: tester
**Prerequisite**: Phase 1-3 完了
**Blocks**: None

#### Description

コンポーネント間の統合テストを作成する。

#### Test Scenarios

- [ ] モード切り替えフロー（Coach → Manager → Coach）
- [ ] テンプレート選択 → 変数入力 → タスク作成
- [ ] MCP接続エラー時のUI状態
- [ ] エージェント選択とタスク割り当て
- [ ] チャットメッセージの表示更新

#### Files to Create

- **Create**: `frontend/app/dashboard/components/__tests__/Section.AIAssistant.test.tsx`
- **Create**: `frontend/app/dashboard/components/__tests__/View.ManagerMode.test.tsx`

---

### TASK-5.3: E2Eテスト作成

**Priority**: High
**Estimated**: 2h
**Assignable to**: tester
**Prerequisite**: Phase 1-4 完了
**Blocks**: None

#### Description

完全なユーザーフローのE2Eテストを作成する。

#### Test Scenarios

- [ ] ログイン → AIAssistantセクション表示
- [ ] コーチモードで習慣提案を受ける → 習慣作成
- [ ] マネージャーモードでテンプレートタスク作成
- [ ] エージェントからの完了報告確認
- [ ] モバイルでの全機能動作確認

#### Files to Create

- **Create**: `frontend/e2e/ai-assistant.spec.ts` (Playwright)

---

## Task Dependency Graph

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Phase 1: 基盤構築                            │
│                                                                      │
│   TASK-1.2 ─────────┐                                               │
│   (フック)           │                                               │
│                     ▼                                               │
│                 TASK-1.1 ─────────┬───────────────────┐             │
│                 (スケルトン)       │                   │             │
│                                   ▼                   ▼             │
│                               TASK-1.3             TASK-2.1         │
│                               (Coach抽出)          (Manager作成)    │
└─────────────────────────────────────────────────────────────────────┘
                                    │                   │
                                    │                   │
┌───────────────────────────────────┼───────────────────┼─────────────┐
│                         Phase 2: マネージャーモード                   │
│                                                                      │
│   TASK-2.2 ──────► TASK-2.3 ──────► TASK-2.4                        │
│   (テンプレート)    (セレクタUI)      (作成フロー)                     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                                                        │
                                                        │
┌───────────────────────────────────┼───────────────────┼─────────────┐
│                         Phase 3: グループチャット                     │
│                                   │                                  │
│                                   ▼                                  │
│                               TASK-3.1                               │
│                               (タイムライン)                          │
│                                   │                                  │
│                          ┌───────┴───────┐                          │
│                          ▼               ▼                          │
│                      TASK-3.2        TASK-3.3                       │
│                      (フォーカス)    (最適化)                        │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                         Phase 4: コーチ強化                          │
│                                                                      │
│   (From TASK-1.3)                                                    │
│         │                                                            │
│         ├──────────► TASK-4.1 (推奨プロンプト)                       │
│         │                                                            │
│         └──────────► TASK-4.2 (ツール視覚化)                        │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                         Phase 5: テスト                              │
│                                                                      │
│   Phase 1-2 完了 ──────► TASK-5.1 (ユニットテスト)                   │
│                                                                      │
│   Phase 1-3 完了 ──────► TASK-5.2 (統合テスト)                       │
│                                                                      │
│   Phase 1-4 完了 ──────► TASK-5.3 (E2Eテスト)                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Sprint Planning Recommendation

### Sprint 1 (Week 1)

**Focus**: 基盤構築 + マネージャーモード基礎

| Task | Assignee | Days |
|------|----------|------|
| TASK-1.2 | Frontend Dev A | 0.5 |
| TASK-1.1 | Frontend Dev A | 1 |
| TASK-1.3 | Frontend Dev A | 1 |
| TASK-2.2 | Frontend Dev B | 0.5 |
| TASK-2.1 | Frontend Dev B | 1.5 |

### Sprint 2 (Week 2)

**Focus**: マネージャーモード完成 + チャット強化

| Task | Assignee | Days |
|------|----------|------|
| TASK-2.3 | Frontend Dev A | 1 |
| TASK-2.4 | Frontend Dev A | 1 |
| TASK-3.1 | Frontend Dev B | 1 |
| TASK-3.2 | Frontend Dev B | 0.5 |
| TASK-3.3 | Frontend Dev B | 0.5 |

### Sprint 3 (Week 3)

**Focus**: コーチ強化 + テスト

| Task | Assignee | Days |
|------|----------|------|
| TASK-4.1 | Frontend Dev A | 0.5 |
| TASK-4.2 | Frontend Dev A | 0.5 |
| TASK-5.1 | Tester | 0.5 |
| TASK-5.2 | Tester | 0.5 |
| TASK-5.3 | Tester | 0.5 |
| Buffer / Bug fixes | All | 1 |

---

## Checklist for Review

### Phase 1 完了チェック
- [ ] Section.AIAssistant がモード切り替え可能
- [ ] localStorage にモードが永続化
- [ ] View.CoachMode が既存機能を維持

### Phase 2 完了チェック
- [ ] 5つのテンプレートが利用可能
- [ ] テンプレート変数入力フォームが動作
- [ ] タスク作成がMCPサーバーに送信される

### Phase 3 完了チェック
- [ ] チャットメッセージがリアルタイム更新
- [ ] タスクフォーカスでフィルタリング可能
- [ ] 100件以上のメッセージでもパフォーマンス維持

### Phase 4 完了チェック
- [ ] コンテキストに応じた推奨プロンプト表示
- [ ] ツール呼び出しが視覚的に表示

### Phase 5 完了チェック
- [ ] 全ユニットテストがパス
- [ ] 全統合テストがパス
- [ ] E2Eテストがパス
