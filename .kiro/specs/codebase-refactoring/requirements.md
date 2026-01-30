# Requirements Document

## Introduction

本プロジェクト全体のリファクタリングを行い、コードの可読性、保守性、パフォーマンス、型安全性を向上させる。既存ファイルの命名規則を分析し、統一された命名規則を策定・適用する。

## Glossary

- **Codebase**: フロントエンドアプリケーション全体のソースコード
- **Naming_Convention**: ファイル名、変数名、関数名、型名などの命名規則
- **Component**: Reactコンポーネント
- **Hook**: Reactカスタムフック
- **Type_Definition**: TypeScript型定義
- **Refactoring_System**: リファクタリングを実行するシステム

## 現状の命名規則分析

### コンポーネント命名パターン（既存）
1. **Widget.{Name}.tsx** - ウィジェットコンポーネント（例: Widget.Calendar.tsx, Widget.Mindmap.tsx）
2. **Modal.{Name}.tsx** - モーダルコンポーネント（例: Modal.Goal.tsx, Modal.Habit.tsx）
3. **Section.{Name}.tsx** - セクションコンポーネント（例: Section.Activity.tsx, Section.Diary.tsx）
4. **Form.{Name}.tsx** - フォームコンポーネント（例: Form.Goal.tsx, Form.Habit.tsx）
5. **Layout.{Name}.tsx** - レイアウトコンポーネント（例: Layout.Header.tsx, Layout.Sidebar.tsx）
6. **{Feature}.{SubComponent}.tsx** - 機能別サブコンポーネント（例: Mindmap.Node.tsx, Mindmap.Controls.tsx）
7. **Dashboard.Shell.tsx** - シェルコンポーネント

### フック命名パターン（既存）
1. **use{Feature}Manager.ts** - 状態管理フック（例: useActivityManager.ts, useGoalManager.ts）
2. **use{Feature}State.ts** - 状態フック（例: useMindmapState.ts, useEditableMindmapState.ts）
3. **use{Feature}Handlers.ts** - イベントハンドラーフック（例: useConnectionHandlers.ts, useEventHandlers.ts）
4. **use{Feature}.ts** - 汎用フック（例: useAuth.ts, useLocalStorage.ts）

### 型定義命名パターン（既存）
1. **{feature}.types.ts** - 機能別型定義（例: mindmap.types.ts）
2. **index.ts** - 共通型定義のエクスポート
3. **shared.ts** - 共有型定義

## Requirements

### Requirement 1: 命名規則の統一

**User Story:** As a developer, I want consistent naming conventions across the codebase, so that I can easily find and understand files.

#### Acceptance Criteria

1. THE Refactoring_System SHALL apply the following file naming conventions:
   - Components: \`{Category}.{Name}.tsx\` (例: Widget.Calendar.tsx, Modal.Goal.tsx)
   - Hooks: \`use{Feature}{Purpose}.ts\` (例: useMindmapState.ts, useConnectionHandlers.ts)
   - Types: \`{feature}.types.ts\` または \`index.ts\`
   - Utils: \`{feature}.utils.ts\` または \`{feature}.{purpose}.ts\`

2. THE Refactoring_System SHALL apply the following variable/function naming conventions:
   - 関数名: camelCase（例: handleClick, calculateTotal）
   - コンポーネント名: PascalCase（例: GoalModal, HabitForm）
   - 定数: UPPER_SNAKE_CASE（例: MAX_ITEMS, DEFAULT_VALUE）
   - 型/インターフェース: PascalCase（例: Goal, HabitProps）
   - プライベート変数: _prefixまたはcamelCase

3. WHEN a file does not follow the naming convention THEN THE Refactoring_System SHALL rename it to follow the convention

### Requirement 2: 重複コードの排除（DRY原則）

**User Story:** As a developer, I want to eliminate duplicate code, so that maintenance becomes easier and bugs are reduced.

#### Acceptance Criteria

1. WHEN similar logic exists in multiple files THEN THE Refactoring_System SHALL extract it into a shared utility or hook

2. WHEN similar UI patterns exist in multiple components THEN THE Refactoring_System SHALL extract them into reusable components

3. THE Refactoring_System SHALL identify and consolidate:
   - 重複するイベントハンドラーロジック
   - 重複するスタイル定義
   - 重複する型定義
   - 重複するユーティリティ関数

### Requirement 3: 関数の分割と簡素化

**User Story:** As a developer, I want smaller, focused functions, so that code is easier to understand and test.

#### Acceptance Criteria

1. WHEN a function exceeds 50 lines THEN THE Refactoring_System SHALL consider splitting it into smaller functions

2. WHEN a component exceeds 300 lines THEN THE Refactoring_System SHALL consider extracting sub-components or hooks

3. THE Refactoring_System SHALL ensure each function has a single responsibility

4. THE Refactoring_System SHALL add JSDoc comments to exported functions and components

### Requirement 4: 型安全性の向上

**User Story:** As a developer, I want proper TypeScript types, so that I can catch errors at compile time.

#### Acceptance Criteria

1. THE Refactoring_System SHALL eliminate all \`any\` types where possible

2. THE Refactoring_System SHALL add explicit return types to all exported functions

3. THE Refactoring_System SHALL use strict null checks

4. WHEN a type is used in multiple files THEN THE Refactoring_System SHALL define it in a shared types file

5. THE Refactoring_System SHALL use discriminated unions for state management where appropriate

### Requirement 5: パフォーマンス最適化

**User Story:** As a user, I want the application to be fast and responsive, so that I can work efficiently.

#### Acceptance Criteria

1. THE Refactoring_System SHALL wrap expensive computations in useMemo

2. THE Refactoring_System SHALL wrap callback functions in useCallback where appropriate

3. THE Refactoring_System SHALL avoid unnecessary re-renders by proper dependency management

4. THE Refactoring_System SHALL eliminate unnecessary loops and reduce computational complexity

### Requirement 6: ES6+モダン構文の適用

**User Story:** As a developer, I want modern JavaScript/TypeScript syntax, so that code is concise and maintainable.

#### Acceptance Criteria

1. THE Refactoring_System SHALL use:
   - Arrow functions for callbacks
   - Destructuring for props and state
   - Template literals for string concatenation
   - Optional chaining (?.) and nullish coalescing (??)
   - Spread operators for object/array manipulation

2. THE Refactoring_System SHALL NOT use:
   - var declarations (use const/let)
   - Function declarations for callbacks (use arrow functions)
   - String concatenation with + (use template literals)

### Requirement 7: 既存動作の保持

**User Story:** As a user, I want the application to work exactly as before after refactoring, so that my workflow is not disrupted.

#### Acceptance Criteria

1. THE Refactoring_System SHALL NOT change any external API contracts

2. THE Refactoring_System SHALL NOT change any component props interfaces

3. THE Refactoring_System SHALL NOT change any user-facing behavior

4. WHEN refactoring is complete THEN all existing tests SHALL pass

### Requirement 8: 外部ライブラリ制約

**User Story:** As a developer, I want to avoid adding new dependencies, so that the bundle size remains manageable.

#### Acceptance Criteria

1. THE Refactoring_System SHALL NOT add any new external libraries

2. THE Refactoring_System SHALL use only existing dependencies for refactoring
