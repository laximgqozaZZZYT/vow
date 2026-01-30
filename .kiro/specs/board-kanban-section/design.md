# Design Document: Board Kanban Section

## Overview

このデザインは「Next」セクションを「Board」セクションに変換し、Trello風のカンバンボードレイアウトを実装する。ユーザーは3つのカラム（予定、進行中、完了(日次)）間で習慣をドラッグ&ドロップで移動できる。既存のシンプルレイアウトは「簡易レイアウト」として保持し、新しいカンバンボードを「詳細レイアウト」としてデフォルト表示する。

主な設計方針:
- 既存の`Section.Next.tsx`を`Section.Board.tsx`にリネーム・拡張
- 既存の`useDragAndDrop`フックのパターンを活用した新しい`useKanbanDragDrop`フック
- レイアウトモードの状態管理にローカルストレージを使用
- モバイルではスワイプナビゲーションとロングプレスによるドラッグを実装

## Architecture

```mermaid
graph TB
    subgraph BoardSection
        LayoutToggle[Layout Toggle Button]
        SimpleLayout[Simple Layout]
        DetailedLayout[Detailed Layout / Kanban]
    end

    subgraph KanbanBoard
        PlannedColumn[予定 Column]
        InProgressColumn[進行中 Column]
        CompletedColumn[完了(日次) Column]
    end

    subgraph HabitCard
        CardInfo[Habit Info]
        CardActions[Action Buttons]
        DragHandle[Drag Handle]
    end

    subgraph Hooks
        useKanbanDragDrop[useKanbanDragDrop]
        useBoardLayout[useBoardLayout]
        useMobileSwipe[useMobileSwipe]
    end

    BoardSection --> LayoutToggle
    BoardSection --> SimpleLayout
    BoardSection --> DetailedLayout
    DetailedLayout --> KanbanBoard
    KanbanBoard --> PlannedColumn
    KanbanBoard --> InProgressColumn
    KanbanBoard --> CompletedColumn
    PlannedColumn --> HabitCard
    InProgressColumn --> HabitCard
    CompletedColumn --> HabitCard
    HabitCard --> CardInfo
    HabitCard --> CardActions
    HabitCard --> DragHandle
    KanbanBoard --> useKanbanDragDrop
    BoardSection --> useBoardLayout
    KanbanBoard --> useMobileSwipe
```

## Components and Interfaces

### コンポーネント階層

```
Section.Board.tsx
├── BoardLayoutToggle (レイアウト切り替えボタン)
├── BoardSimpleLayout (簡易レイアウト - 既存NextSection相当)
└── BoardKanbanLayout (詳細レイアウト)
    ├── KanbanColumn (x3: planned, in_progress, completed_daily)
    │   ├── ColumnHeader
    │   └── HabitCard[]
    └── MobileColumnIndicator (モバイル用インジケーター)
```

### Section.Board.tsx

```typescript
// frontend/app/dashboard/components/Section.Board.tsx

interface BoardSectionProps {
  habits: Habit[];
  activities: Activity[];
  onHabitAction: (habitId: string, action: HabitAction, amount?: number) => void;
  onHabitEdit: (habitId: string) => void;
}

export default function BoardSection({
  habits,
  activities,
  onHabitAction,
  onHabitEdit
}: BoardSectionProps): JSX.Element;
```

### BoardKanbanLayout

```typescript
// frontend/app/dashboard/components/Board.KanbanLayout.tsx

type HabitStatus = 'planned' | 'in_progress' | 'completed_daily';

interface KanbanLayoutProps {
  habits: Habit[];
  activities: Activity[];
  onHabitAction: (habitId: string, action: HabitAction, amount?: number) => void;
  onHabitEdit: (habitId: string) => void;
}

interface ColumnConfig {
  id: HabitStatus;
  title: string;
  titleJa: string;
}

const COLUMNS: ColumnConfig[] = [
  { id: 'planned', title: 'Planned', titleJa: '予定' },
  { id: 'in_progress', title: 'In Progress', titleJa: '進行中' },
  { id: 'completed_daily', title: 'Completed', titleJa: '完了(日次)' }
];
```

### KanbanColumn

```typescript
// frontend/app/dashboard/components/Board.KanbanColumn.tsx

interface KanbanColumnProps {
  column: ColumnConfig;
  habits: Habit[];
  activities: Activity[];
  onHabitAction: (habitId: string, action: HabitAction, amount?: number) => void;
  onHabitEdit: (habitId: string) => void;
  onDrop: (habitId: string, targetStatus: HabitStatus) => void;
  isDragOver: boolean;
  onDragOver: () => void;
  onDragLeave: () => void;
}
```

### HabitCard (Kanban用)

```typescript
// frontend/app/dashboard/components/Board.HabitCard.tsx

interface HabitCardProps {
  habit: Habit;
  activities: Activity[];
  status: HabitStatus;
  onComplete: (amount?: number) => void;
  onEdit: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  isDragging: boolean;
}
```

### useKanbanDragDrop フック

```typescript
// frontend/app/dashboard/hooks/useKanbanDragDrop.ts

interface UseKanbanDragDropProps {
  onHabitAction: (habitId: string, action: HabitAction, amount?: number) => void;
}

interface UseKanbanDragDropReturn {
  draggedHabitId: string | null;
  dropTargetColumn: HabitStatus | null;
  handleDragStart: (habitId: string, event?: React.DragEvent) => void;
  handleDragEnd: () => void;
  handleDragOver: (column: HabitStatus, event?: React.DragEvent) => void;
  handleDragLeave: () => void;
  handleDrop: (targetColumn: HabitStatus) => void;
  // Touch support
  handleTouchStart: (habitId: string, event: React.TouchEvent) => void;
  handleTouchMove: (event: React.TouchEvent) => void;
  handleTouchEnd: () => void;
}
```

### useBoardLayout フック

```typescript
// frontend/app/dashboard/hooks/useBoardLayout.ts

type LayoutMode = 'simple' | 'detailed';

interface UseBoardLayoutReturn {
  layoutMode: LayoutMode;
  setLayoutMode: (mode: LayoutMode) => void;
  toggleLayoutMode: () => void;
}

const STORAGE_KEY = 'board-layout-mode';
const DEFAULT_MODE: LayoutMode = 'detailed';
```

### useMobileSwipe フック

```typescript
// frontend/app/dashboard/hooks/useMobileSwipe.ts

interface UseMobileSwipeProps {
  totalColumns: number;
  onColumnChange: (index: number) => void;
}

interface UseMobileSwipeReturn {
  currentColumnIndex: number;
  containerRef: React.RefObject<HTMLDivElement>;
  handleTouchStart: (event: React.TouchEvent) => void;
  handleTouchMove: (event: React.TouchEvent) => void;
  handleTouchEnd: () => void;
  goToColumn: (index: number) => void;
}
```

## Data Models

### 習慣ステータスの判定ロジック

```typescript
// frontend/app/dashboard/utils/habitStatusUtils.ts

/**
 * 今日のアクティビティから習慣のステータスを判定
 */
function getHabitStatus(habit: Habit, activities: Activity[]): HabitStatus {
  const today = new Date().toISOString().slice(0, 10);
  const todayActivities = activities.filter(a => 
    a.habitId === habit.id && 
    a.timestamp.slice(0, 10) === today
  );

  // 完了アクティビティがあれば completed_daily
  const hasComplete = todayActivities.some(a => a.kind === 'complete');
  if (hasComplete) return 'completed_daily';

  // 開始アクティビティがあり、一時停止していなければ in_progress
  const hasStart = todayActivities.some(a => a.kind === 'start');
  const lastActivity = todayActivities.sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )[0];
  
  if (hasStart && lastActivity?.kind !== 'pause') {
    return 'in_progress';
  }

  return 'planned';
}

/**
 * 習慣をステータス別にグループ化
 */
function groupHabitsByStatus(
  habits: Habit[], 
  activities: Activity[]
): Record<HabitStatus, Habit[]> {
  const result: Record<HabitStatus, Habit[]> = {
    planned: [],
    in_progress: [],
    completed_daily: []
  };

  for (const habit of habits) {
    const status = getHabitStatus(habit, activities);
    result[status].push(habit);
  }

  return result;
}
```

### カラム間移動時のアクションマッピング

```typescript
// ドロップ先カラムに応じたアクション
const COLUMN_ACTIONS: Record<HabitStatus, HabitAction | null> = {
  planned: 'pause',      // 進行中 → 予定: pause
  in_progress: 'start',  // 予定 → 進行中: start
  completed_daily: 'complete' // any → 完了: complete
};
```

### ローカルストレージのスキーマ

```typescript
interface BoardLayoutPreference {
  mode: LayoutMode;
  updatedAt: string;
}

// Key: 'board-layout-mode'
// Value: JSON.stringify(BoardLayoutPreference)
```



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Layout mode toggle

*For any* current layout mode (simple or detailed), clicking the toggle button should result in the opposite layout mode being active.

**Validates: Requirements 1.3**

### Property 2: Layout preference persistence round-trip

*For any* layout mode that is set and saved to local storage, loading the component should restore that same layout mode.

**Validates: Requirements 1.4, 1.5**

### Property 3: Habit status classification

*For any* habit and set of activities, the habit should be classified into the correct column:
- If the habit has a 'complete' activity today → 'completed_daily'
- If the habit has a 'start' activity today without subsequent 'complete' or 'pause' → 'in_progress'
- Otherwise → 'planned'

**Validates: Requirements 2.3, 2.4, 2.5, 2.6**

### Property 4: Column header count accuracy

*For any* set of habits distributed across columns, each column header should display a count equal to the number of habits in that column.

**Validates: Requirements 2.2**

### Property 5: Habit card information display

*For any* habit with configured properties (name, time, must, workloadPerCount, workloadUnit), the rendered habit card should contain all available information.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

### Property 6: Elapsed time calculation

*For any* habit in the 'in_progress' column with a start activity, the displayed elapsed time should equal the difference between current time and the start activity timestamp.

**Validates: Requirements 3.5**

### Property 7: Habit edit callback

*For any* habit card, clicking the habit name should invoke onHabitEdit with that habit's ID.

**Validates: Requirements 3.7**

### Property 8: Drag visual feedback

*For any* habit being dragged, the dragged card should have 'dragging' visual state, and any column being dragged over should have 'drop-target' visual state.

**Validates: Requirements 4.1, 4.2**

### Property 9: Drop action mapping

*For any* habit dropped in a target column, the correct action should be triggered:
- Drop in 'in_progress' → 'start' action
- Drop in 'completed_daily' → 'complete' action
- Drop in 'planned' from 'in_progress' → 'pause' action

**Validates: Requirements 4.3, 4.4, 4.5**

### Property 10: Drag failure recovery

*For any* failed drag operation, the habit card should return to its original column position.

**Validates: Requirements 4.6**

### Property 11: Mobile swipe navigation

*For any* horizontal swipe gesture on mobile, the current column index should update based on swipe direction (left swipe → next column, right swipe → previous column), bounded by 0 and totalColumns-1.

**Validates: Requirements 5.2**

### Property 12: Long press drag initiation

*For any* long press (≥400ms) on a habit card on mobile, drag mode should be initiated for that habit.

**Validates: Requirements 5.4**

### Property 13: Touch target minimum size

*For any* interactive element in the habit card, the touch target should have minimum dimensions of 44x44 pixels.

**Validates: Requirements 5.5**

### Property 14: Layout data consistency

*For any* set of habits, both Simple_Layout and Detailed_Layout should display the same set of habits (same IDs).

**Validates: Requirements 6.3**

### Property 15: Backward compatibility for tab ID

*For any* saved page sections configuration containing 'next', the system should treat it as equivalent to 'board' and display the Board section.

**Validates: Requirements 7.3**

## Error Handling

### ドラッグ&ドロップエラー

| エラー状況 | 対応 |
|-----------|------|
| ドロップ先が無効 | カードを元の位置に戻す |
| アクション実行失敗 | カードを元の位置に戻し、エラーをコンソールに記録 |
| タッチイベント中断 | ドラッグ状態をリセット |

### ローカルストレージエラー

| エラー状況 | 対応 |
|-----------|------|
| ストレージアクセス失敗 | デフォルト値（detailed）を使用 |
| 不正なJSON | デフォルト値を使用し、ストレージをクリア |
| クォータ超過 | 保存をスキップし、メモリ内状態のみ維持 |

### データ整合性エラー

| エラー状況 | 対応 |
|-----------|------|
| 習慣IDが見つからない | 該当カードをスキップ |
| アクティビティのタイムスタンプが不正 | 該当アクティビティを無視 |

## Testing Strategy

### テストアプローチ

このフィーチャーでは、ユニットテストとプロパティベーステストの両方を使用する：

- **ユニットテスト**: 特定の例、エッジケース、エラー条件の検証
- **プロパティテスト**: すべての入力に対して成り立つべき普遍的な性質の検証

### プロパティベーステスト設定

- **ライブラリ**: fast-check (TypeScript用)
- **最小イテレーション**: 100回/プロパティ
- **タグフォーマット**: `Feature: board-kanban-section, Property {number}: {property_text}`

### テスト対象

#### ユニットテスト

1. **useBoardLayout フック**
   - デフォルト値の確認
   - トグル動作の確認
   - ローカルストレージ連携

2. **habitStatusUtils**
   - 各ステータスの判定ロジック
   - エッジケース（複数アクティビティ、日付境界）

3. **useKanbanDragDrop フック**
   - ドラッグ開始/終了
   - ドロップアクションマッピング
   - タッチイベント処理

4. **コンポーネントレンダリング**
   - レイアウトモード切り替え
   - カラム表示
   - カード情報表示

#### プロパティベーステスト

1. **Property 2: Layout preference persistence round-trip**
   - 任意のレイアウトモードを保存→読み込みで同じ値が復元される

2. **Property 3: Habit status classification**
   - 任意の習慣とアクティビティの組み合わせで正しいステータスに分類される

3. **Property 4: Column header count accuracy**
   - 任意の習慣セットでカラムヘッダーのカウントが正確

4. **Property 9: Drop action mapping**
   - 任意のドロップ操作で正しいアクションがトリガーされる

5. **Property 11: Mobile swipe navigation**
   - 任意のスワイプ操作でカラムインデックスが正しく更新される

6. **Property 14: Layout data consistency**
   - 任意の習慣セットで両レイアウトが同じ習慣を表示する

### テストファイル構成

```
frontend/__tests__/
├── board/
│   ├── useBoardLayout.test.ts
│   ├── useKanbanDragDrop.test.ts
│   ├── habitStatusUtils.test.ts
│   ├── habitStatusUtils.property.test.ts
│   ├── BoardSection.test.tsx
│   └── BoardKanbanLayout.test.tsx
```
