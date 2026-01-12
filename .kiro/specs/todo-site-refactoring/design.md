# Design Document

## Overview

TODOサイトのリファクタリングを段階的に実施するための設計。現在のコードベースは機能的に動作しているため、既存機能を破壊することなく、保守性とパフォーマンスを向上させる。

主要な問題点：
- 大型コンポーネント（Widget.Calendar.tsx: 889行、Widget.Mindmap.tsx: 1812行）
- 重複するユーティリティ関数（日付処理、モバイル検出）
- 複雑な状態管理（多数のuseState、相互依存する状態）
- 一貫性のないモバイル対応実装

## Architecture

### 段階的リファクタリングアプローチ（低リスクのみ）

```
Phase 1: ユーティリティ抽出 (低リスク)
├── 日付・時間処理ユーティリティ
├── モバイル検出フック
└── 共通型定義の統合

Phase 2a: 独立したカスタムフックの抽出 (低リスク)
├── useDeviceDetection (モバイル検出)
├── useApiWithLoading (API呼び出し共通化)
└── useLocalStorage (ローカルストレージ管理)

Phase 3a: 独立性の高い部分の抽出 (低リスク)
├── CalendarControls (ナビゲーション部分)
├── MindmapControls (ツールバー部分)
└── Modal系の共通部分
```

**除外されるフェーズ（中・高リスク）**:
- Phase 2b: 単純な状態統合 (中リスク)
- Phase 2c: 複雑な状態管理の最適化 (高リスク)
- Phase 3b: 状態を持たない表示コンポーネント (中リスク)
- Phase 3c: 状態管理を含むコア部分 (高リスク)

### 新しいディレクトリ構造（低リスクタスクのみ）

```
frontend/app/dashboard/
├── components/
│   ├── calendar/           # カレンダー関連コンポーネント
│   │   └── CalendarControls.tsx  # ナビゲーション部分のみ
│   ├── mindmap/           # マインドマップ関連コンポーネント
│   │   └── MindmapControls.tsx   # ツールバー部分のみ
│   └── shared/            # 共通コンポーネント
├── hooks/
│   ├── useDeviceDetection.ts
│   ├── useApiWithLoading.ts
│   └── useLocalStorage.ts
├── utils/
│   ├── dateUtils.ts       # 日付・時間処理
│   ├── deviceUtils.ts     # デバイス検出
│   └── apiUtils.ts        # API呼び出し共通処理
└── types/
    └── shared.ts          # 共通型定義
```

## Components and Interfaces

### 1. 共通ユーティリティ

#### DateUtils
```typescript
// utils/dateUtils.ts
export interface DateUtils {
  formatLocalDate(date: Date): string;
  parseYMD(dateString?: string | Date | null): Date | undefined;
  ymd(date: Date): string;
  addDays(date: Date, days: number): Date;
  getTimeString(date: Date): string;
}
```

#### DeviceDetection Hook
```typescript
// hooks/useDeviceDetection.ts
export interface DeviceDetection {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  screenWidth: number;
  screenHeight: number;
  isTouchDevice: boolean;
}
```

### 2. 独立したカスタムフック

#### useApiWithLoading
```typescript
// hooks/useApiWithLoading.ts - 低リスク
export function useApiWithLoading<T>() {
  return {
    loading: boolean;
    error: string | null;
    execute: (apiCall: () => Promise<T>) => Promise<T>;
    reset: () => void;
  };
}
```

#### useLocalStorage
```typescript
// hooks/useLocalStorage.ts - 低リスク
export function useLocalStorage<T>(key: string, initialValue: T) {
  return {
    value: T;
    setValue: (value: T) => void;
    removeValue: () => void;
  };
}
```

### 3. 独立性の高いコンポーネント

#### CalendarControls (ナビゲーション)
```typescript
// components/calendar/CalendarControls.tsx - 低リスク
interface CalendarControlsProps {
  selectedView: 'today' | 'tomorrow' | 'week' | 'month';
  onViewChange: (view: string) => void;
  onScrollToNow: () => void;
}
```
**低リスク理由**: 純粋な表示コンポーネント、状態を持たない、親から props を受け取るのみ

#### MindmapControls (ツールバー)
```typescript
// components/mindmap/MindmapControls.tsx - 低リスク  
interface MindmapControlsProps {
  onAddNode: () => void;
  onClearConnections: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
}
```
**低リスク理由**: 単純なボタン群、イベントハンドラーを親に委譲
```
**低リスク理由**: 単純なボタン群、イベントハンドラーを親に委譲

#### Phase 3b: 状態を持たない表示コンポーネント（中リスク）

#### CalendarEvents (イベント生成ロジック)
```typescript
// components/calendar/CalendarEvents.tsx - 中リスク
interface CalendarEventsProps {
  habits: Habit[];
  goals: Goal[];
  onEventGenerated: (events: CalendarEvent[]) => void;
}
```
**中リスク理由**: 複雑なロジックを含むが、状態は持たない。入力に対して決定的な出力を生成

#### MindmapNode (カスタムノード)
```typescript
// components/mindmap/MindmapNode.tsx - 中リスク
interface MindmapNodeProps extends NodeProps<CustomNodeData> {
  onEdit: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  isMobile: boolean;
}
```
**中リスク理由**: 複雑なイベント処理を含むが、ReactFlowのNodePropsに準拠

#### Phase 3c: 状態管理を含むコア部分（高リスク）

メイン状態管理を含む部分は最後に実施。Phase 1, 2の成果を活用して複雑さを軽減してから着手。
```

#### MindmapNode (カスタムノード)
```typescript
// components/mindmap/MindmapNode.tsx
interface MindmapNodeProps extends NodeProps<CustomNodeData> {
  onEdit: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  isMobile: boolean;
}
```

### 5. 状態管理フック

#### useCalendarState
```typescript
// hooks/useCalendarState.ts
interface CalendarState {
  selectedEventId: string | null;
  contextMenu: ContextMenuState | null;
  touchMoveMode: boolean;
  navSelection: ViewType;
}

export function useCalendarState(): {
  state: CalendarState;
  actions: CalendarActions;
## Data Models（低リスクタスクのみ）

### 共通型定義の統合

```typescript
// types/shared.ts
export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  screenWidth: number;
  screenHeight: number;
  isTouchDevice: boolean;
}

export interface ApiState<T> {
  loading: boolean;
  error: string | null;
  data: T | null;
}

// 日付処理用の型定義
export interface DateRange {
  start: Date;
  end: Date;
}

export interface TimeString {
  hours: string;
  minutes: string;
}
```
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property-Based Testing Overview

Property-based testing (PBT) validates software correctness by testing universal properties across many generated inputs. Each property is a formal specification that should hold for all valid inputs.

### Prework Analysis

<function_calls>
<invoke name="prework">
<parameter name="featureName">todo-site-refactoring

### Property Reflection

After analyzing the acceptance criteria, several properties can be consolidated:
- Properties 1.1, 4.1, and 7.1 all relate to component size and structure optimization
- Properties 2.1, 2.2, 3.1, and 6.1 all relate to code organization and deduplication
- Properties 5.1 and 8.2 both relate to consistency and regression prevention

### Correctness Properties（低リスクタスクのみ）

Property 1: Component size constraint
*For any* React component file in the refactored codebase, the line count should not exceed 500 lines
**Validates: Requirements 1.1**

Property 2: Functional equivalence preservation
*For any* refactored component, all existing functionality should remain intact and all existing tests should continue to pass
**Validates: Requirements 1.2, 8.2**

Property 3: Naming convention consistency
*For any* newly created sub-component, the naming should follow the established pattern of FeatureName + ComponentType (e.g., CalendarControls, MindmapControls)
**Validates: Requirements 1.3**

Property 4: Code deduplication effectiveness
*For any* utility function that appears in multiple components, it should be extracted to a shared utility module and imported consistently
**Validates: Requirements 2.1, 3.1**

Property 5: File organization consistency
*For any* utility function or component, it should be placed in the appropriate directory structure based on its functionality and feature domain
**Validates: Requirements 2.2, 6.1**

Property 6: Incremental refactoring order
*For any* refactoring phase, utility extraction should be completed before component splitting to minimize risk
**Validates: Requirements 8.1**

## Error Handling

### リファクタリング中のエラー処理戦略

1. **段階的ロールバック**
   - 各フェーズ完了時にコミットポイントを作成
   - 問題発生時は前のコミットポイントに戻る

2. **機能テスト**
   - 既存のテストスイートを各段階で実行
   - 新しいテストケースを追加してリグレッションを防ぐ

3. **型安全性の維持**
   - TypeScriptの型チェックを活用
   - インターフェースの変更時は段階的に移行

4. **実行時エラーの監視**
   - コンソールエラーの監視
   - 本番環境での動作確認

## Testing Strategy

### デュアルテストアプローチ

**Unit Tests**:
- リファクタリング前後の機能同等性テスト
- 新しいユーティリティ関数のテスト
- コンポーネント分割後の個別機能テスト

**Property-Based Tests**:
- ファイルサイズ制約の検証（Property 1）
- 機能等価性の検証（Property 2）
- 命名規則の一貫性検証（Property 3）
- コード重複の除去検証（Property 4）
- ファイル組織の一貫性検証（Property 5）
- ファイル組織の一貫性検証（Property 5）
- 段階的実装順序の検証（Property 6）

### テスト設定

- **最小反復回数**: 100回（プロパティテストの信頼性確保）
- **テストフレームワーク**: Jest + React Testing Library
- **プロパティテストライブラリ**: fast-check
- **各プロパティテストのタグ形式**: **Feature: todo-site-refactoring, Property {number}: {property_text}**

### テストバランス

- **Unit Tests**: 具体的な例、エッジケース、エラー条件に焦点
- **Property Tests**: 全入力に対する普遍的プロパティの検証
- 両方のテストが相補的に機能し、包括的なカバレッジを提供

### 継続的検証

- 各リファクタリング段階でテストスイートを実行
- 新機能追加時の既存テスト継続実行
- 低リスクタスクに限定することで、テスト負荷を軽減