# MOC Task Kanban + Remote CLI Skill Set - Design Specification

## Overview

- **Purpose**: MOCタスクKanban + Remote CLIスキルセット機能のアーキテクチャ設計
- **Status**: Draft
- **Version**: 1.0
- **Last Updated**: 2026-02-07
- **Author**: vow-spec-architect
- **Spec ID**: MOC-TASK-KANBAN-001

---

## 1. Architecture Overview (アーキテクチャ概要)

### 1.1 System Architecture

```
+---------------------------------------------------------------+
|                       Section.MOC.tsx                          |
|  +----------------------------------------------------------+ |
|  | Tab Navigation: [Chat] [Tasks] [Agents] [History]        | |
|  +----------------------------------------------------------+ |
|  |                                                            | |
|  | activeTab === 'tasks'                                      | |
|  | +------------------------------------------------------+  | |
|  | |  MOC.TaskKanban (new component)                      |  | |
|  | |  +------------+  +------------+  +------------+      |  | |
|  | |  | TODO       |  | In Progress|  | Done       |      |  | |
|  | |  | [Card]     |  | [Card]     |  | [Card]     |      |  | |
|  | |  | [Card]     |  |   [====]   |  | [Card]     |      |  | |
|  | |  | [+ New]    |  |            |  |            |      |  | |
|  | |  +------------+  +------------+  +------------+      |  | |
|  | +------------------------------------------------------+  | |
|  |                                                            | |
|  | activeTab === 'chat' (Remote CLI mode)                     | |
|  | +------------------------------------------------------+  | |
|  | |  User: "タスク実行をしてください"                    |  | |
|  | |  System: [Skill Set選択UI]                           |  | |
|  | |  Remote CLI: "実行開始します..."                     |  | |
|  | |  Remote CLI: {progress: 60%, step: 2/4}              |  | |
|  | +------------------------------------------------------+  | |
|  +------------------------------------------------------------+ |
+---------------------------------------------------------------+
         |                    |                    |
         v                    v                    v
  +------------+     +---------------+     +-------------+
  | Supabase   |     | MCP Server    |     | SSE Stream  |
  | skill_sets |     | (Remote CLI)  |     | (Progress)  |
  | notes      |     |               |     |             |
  | stickies   |     +---------------+     +-------------+
  +------------+
```

### 1.2 Data Flow

```
[Create Skill Set]
    |
    v
[Supabase: INSERT skill_sets, notes, skill_set_stickies]
    |
    v
[Kanban: Card appears in TODO column]
    |
    v
[Chat: "タスク実行をしてください"]
    |
    v
[Build prompt from Skill Set]
    |
    v
[Send to Remote CLI via MCP Chat]
    |
    v
[Update Skill Set status → in_progress]
    |
    v
[Kanban: Card moves to In Progress]
    |
    v
[SSE: Progress reports from Remote CLI]
    |
    v
[Kanban: Update progress bar on card]
    |
    v
[SSE: status: "done"]
    |
    v
[Update Skill Set status → done]
    |
    v
[Kanban: Card moves to Done]
```

---

## 2. Database Design (データベース設計)

### 2.1 Entity Relationship Diagram

```
+----------+       +-------------+       +----------+
|  goals   |<------| skill_set_  |------>| skill_   |
|          |       | goals       |       | sets     |
+----------+       +-------------+       +----------+
                                             |   |
+----------+       +-------------+           |   |
|  habits  |<------| skill_set_  |---------->+   |
|          |       | habits      |               |
+----------+       +-------------+               |
                                                 |
+----------+       +-------------+               |
| stickies |<------| skill_set_  |-------------->+
|          |       | stickies    |
+----------+       +-------------+

+----------+
|  notes   |<------ skill_sets.note_id
|          |
+----------+
```

### 2.2 Migration: `YYYYMMDDHHMMSS_add_skill_sets.sql`

```sql
-- =================================================================
-- Notes テーブル
-- 再利用可能なテキストブロック（スキルセットのメインプロンプト）
-- =================================================================
CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    owner_type TEXT,
    owner_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notes_user_policy" ON notes
    FOR ALL USING (
        auth.uid() IS NOT NULL AND (
            owner_type = 'user' AND owner_id = auth.uid()::text
            OR owner_type IS NULL
            OR owner_id IS NULL
        )
    )
    WITH CHECK (
        auth.uid() IS NOT NULL AND (
            owner_type = 'user' AND owner_id = auth.uid()::text
            OR owner_type IS NULL
            OR owner_id IS NULL
        )
    );

CREATE INDEX IF NOT EXISTS idx_notes_owner ON notes(owner_type, owner_id);

-- =================================================================
-- Skill Sets テーブル
-- スキルセット本体
-- =================================================================
CREATE TABLE IF NOT EXISTS skill_sets (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    description TEXT,
    note_id TEXT REFERENCES notes(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'todo'
        CHECK (status IN ('todo', 'in_progress', 'done')),
    execution_result JSONB,
    last_executed_at TIMESTAMP WITH TIME ZONE,
    display_order INTEGER DEFAULT 0,
    owner_type TEXT,
    owner_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE skill_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "skill_sets_user_policy" ON skill_sets
    FOR ALL USING (
        auth.uid() IS NOT NULL AND (
            owner_type = 'user' AND owner_id = auth.uid()::text
            OR owner_type IS NULL
            OR owner_id IS NULL
        )
    )
    WITH CHECK (
        auth.uid() IS NOT NULL AND (
            owner_type = 'user' AND owner_id = auth.uid()::text
            OR owner_type IS NULL
            OR owner_id IS NULL
        )
    );

CREATE INDEX IF NOT EXISTS idx_skill_sets_owner
    ON skill_sets(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_skill_sets_status
    ON skill_sets(status);
CREATE INDEX IF NOT EXISTS idx_skill_sets_note
    ON skill_sets(note_id);

-- =================================================================
-- Skill Set - Stickies 関連テーブル
-- =================================================================
CREATE TABLE IF NOT EXISTS skill_set_stickies (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    skill_set_id TEXT NOT NULL REFERENCES skill_sets(id) ON DELETE CASCADE,
    sticky_id TEXT NOT NULL REFERENCES stickies(id) ON DELETE CASCADE,
    display_order INTEGER DEFAULT 0,
    owner_type TEXT,
    owner_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(skill_set_id, sticky_id)
);

ALTER TABLE skill_set_stickies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "skill_set_stickies_user_policy" ON skill_set_stickies
    FOR ALL USING (
        auth.uid() IS NOT NULL AND (
            owner_type = 'user' AND owner_id = auth.uid()::text
            OR owner_type IS NULL
            OR owner_id IS NULL
        )
    )
    WITH CHECK (
        auth.uid() IS NOT NULL AND (
            owner_type = 'user' AND owner_id = auth.uid()::text
            OR owner_type IS NULL
            OR owner_id IS NULL
        )
    );

CREATE INDEX IF NOT EXISTS idx_skill_set_stickies_skill_set
    ON skill_set_stickies(skill_set_id);
CREATE INDEX IF NOT EXISTS idx_skill_set_stickies_sticky
    ON skill_set_stickies(sticky_id);

-- =================================================================
-- Skill Set - Goals 関連テーブル
-- =================================================================
CREATE TABLE IF NOT EXISTS skill_set_goals (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    skill_set_id TEXT NOT NULL REFERENCES skill_sets(id) ON DELETE CASCADE,
    goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    owner_type TEXT,
    owner_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(skill_set_id, goal_id)
);

ALTER TABLE skill_set_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "skill_set_goals_user_policy" ON skill_set_goals
    FOR ALL USING (
        auth.uid() IS NOT NULL AND (
            owner_type = 'user' AND owner_id = auth.uid()::text
            OR owner_type IS NULL
            OR owner_id IS NULL
        )
    )
    WITH CHECK (
        auth.uid() IS NOT NULL AND (
            owner_type = 'user' AND owner_id = auth.uid()::text
            OR owner_type IS NULL
            OR owner_id IS NULL
        )
    );

CREATE INDEX IF NOT EXISTS idx_skill_set_goals_skill_set
    ON skill_set_goals(skill_set_id);
CREATE INDEX IF NOT EXISTS idx_skill_set_goals_goal
    ON skill_set_goals(goal_id);

-- =================================================================
-- Skill Set - Habits 関連テーブル
-- =================================================================
CREATE TABLE IF NOT EXISTS skill_set_habits (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    skill_set_id TEXT NOT NULL REFERENCES skill_sets(id) ON DELETE CASCADE,
    habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    owner_type TEXT,
    owner_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(skill_set_id, habit_id)
);

ALTER TABLE skill_set_habits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "skill_set_habits_user_policy" ON skill_set_habits
    FOR ALL USING (
        auth.uid() IS NOT NULL AND (
            owner_type = 'user' AND owner_id = auth.uid()::text
            OR owner_type IS NULL
            OR owner_id IS NULL
        )
    )
    WITH CHECK (
        auth.uid() IS NOT NULL AND (
            owner_type = 'user' AND owner_id = auth.uid()::text
            OR owner_type IS NULL
            OR owner_id IS NULL
        )
    );

CREATE INDEX IF NOT EXISTS idx_skill_set_habits_skill_set
    ON skill_set_habits(skill_set_id);
CREATE INDEX IF NOT EXISTS idx_skill_set_habits_habit
    ON skill_set_habits(habit_id);

-- =================================================================
-- Updated_at トリガー
-- =================================================================
CREATE OR REPLACE FUNCTION update_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notes_updated_at
    BEFORE UPDATE ON notes
    FOR EACH ROW
    EXECUTE FUNCTION update_notes_updated_at();

CREATE OR REPLACE FUNCTION update_skill_sets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_skill_sets_updated_at
    BEFORE UPDATE ON skill_sets
    FOR EACH ROW
    EXECUTE FUNCTION update_skill_sets_updated_at();
```

---

## 3. TypeScript Type Definitions (型定義)

### 3.1 New Types: `types/skill-set.types.ts`

```typescript
/**
 * Skill Set Type Definitions
 *
 * Types for the MOC Task Kanban + Remote CLI Skill Set feature.
 *
 * @module types/skill-set.types
 */

import type { Goal, Habit, Sticky } from '.';

// ============================================================================
// Note Entity
// ============================================================================

/** Note - 再利用可能なテキストブロック */
export interface Note {
  id: string;
  title: string;
  content: string;       // Markdown形式
  createdAt: string;
  updatedAt: string;
}

/** Note作成用ペイロード */
export interface CreateNotePayload {
  title: string;
  content: string;
}

/** Note更新用ペイロード */
export interface UpdateNotePayload {
  title?: string;
  content?: string;
}

// ============================================================================
// Skill Set Entity
// ============================================================================

/** スキルセットのステータス */
export type SkillSetStatus = 'todo' | 'in_progress' | 'done';

/** Skill Set - タスクKanbanのカード単位 */
export interface SkillSet {
  id: string;
  name: string;
  description?: string;
  noteId?: string;
  note?: Note;                    // JOINで取得
  status: SkillSetStatus;
  executionResult?: SkillSetExecutionResult;
  lastExecutedAt?: string;
  displayOrder: number;
  stickies?: SkillSetStickyItem[];  // JOINで取得
  goals?: Goal[];                    // JOINで取得
  habits?: Habit[];                  // JOINで取得
  createdAt: string;
  updatedAt: string;
}

/** スキルセットに紐づくSticky'nアイテム */
export interface SkillSetStickyItem {
  id: string;            // skill_set_stickies.id
  stickyId: string;
  sticky?: Sticky;       // JOINで取得
  displayOrder: number;
}

/** スキルセット作成用ペイロード */
export interface CreateSkillSetPayload {
  name: string;
  description?: string;
  noteId?: string;
  stickyIds?: string[];      // 紐づけるSticky IDの配列
  goalIds?: string[];        // 紐づけるGoal IDの配列
  habitIds?: string[];       // 紐づけるHabit IDの配列
}

/** スキルセット更新用ペイロード */
export interface UpdateSkillSetPayload {
  name?: string;
  description?: string;
  noteId?: string;
  status?: SkillSetStatus;
  displayOrder?: number;
  addStickyIds?: string[];
  removeStickyIds?: string[];
  addGoalIds?: string[];
  removeGoalIds?: string[];
  addHabitIds?: string[];
  removeHabitIds?: string[];
}

// ============================================================================
// Execution & Progress
// ============================================================================

/** 実行結果 */
export interface SkillSetExecutionResult {
  status: 'success' | 'error' | 'cancelled';
  message?: string;
  startedAt: string;
  completedAt?: string;
  output?: string;           // Remote CLIの最終出力
  error?: string;            // エラーメッセージ
}

/** Remote CLIからの進捗報告 */
export interface SkillSetProgressReport {
  type: 'skill_set_progress';
  skillSetId: string;
  status: 'in_progress' | 'done' | 'error';
  progress: number;          // 0-100
  message: string;           // 人間可読な進捗メッセージ
  stepCurrent?: number;      // 現在のステップ番号
  stepTotal?: number;        // 総ステップ数
}

// ============================================================================
// Kanban UI Types
// ============================================================================

/** Kanbanカラムのステータス */
export type TaskKanbanColumnId = 'todo' | 'in_progress' | 'done';

/** Kanbanカラム設定 */
export interface TaskKanbanColumnConfig {
  id: TaskKanbanColumnId;
  title: string;
  titleJa: string;
  accentColor: string;
}

/** カラム設定定数 */
export const TASK_KANBAN_COLUMNS: TaskKanbanColumnConfig[] = [
  {
    id: 'todo',
    title: 'TODO',
    titleJa: 'TODO',
    accentColor: 'warning',
  },
  {
    id: 'in_progress',
    title: 'In Progress',
    titleJa: '進行中',
    accentColor: 'blue-500',
  },
  {
    id: 'done',
    title: 'Done',
    titleJa: '完了',
    accentColor: 'success',
  },
];
```

### 3.2 Updated Types: `types/moc.types.ts`

```typescript
// 既存のTabIdを拡張（変更なし、'tasks'は既に存在）
export type TabId = 'chat' | 'tasks' | 'agents' | 'history';

// TABSの変更なし（既存の'tasks'タブをそのまま使用）
```

---

## 4. Component Architecture (コンポーネント設計)

### 4.1 Component Hierarchy

```
Section.MOC.tsx (既存)
  |
  +-- activeTab === 'tasks'
  |     |
  |     +-- MOC.TaskKanban.tsx (NEW)
  |           |
  |           +-- MOC.TaskKanbanColumn.tsx (NEW)
  |           |     |
  |           |     +-- MOC.SkillSetCard.tsx (NEW)
  |           |           |
  |           |           +-- SkillSetProgressBar (inline)
  |           |           +-- GoalHabitBadges (inline)
  |           |
  |           +-- Modal.SkillSet.tsx (NEW)
  |                 |
  |                 +-- NoteSelector (inline)
  |                 +-- NoteEditor (inline)
  |                 +-- StickySelector (inline)
  |                 +-- GoalHabitLinker (inline)
  |
  +-- activeTab === 'chat'
        |
        +-- (既存チャットUI)
        +-- SkillSetExecutionHandler (logic, NEW)
```

### 4.2 New Component: `MOC.TaskKanban.tsx`

**責務**: Kanbanボード全体のレイアウト、カラム描画、ドラッグ&ドロップ制御

```typescript
/**
 * MOC.TaskKanban - Task Kanban Board for MOC Section
 *
 * Provides a 3-column Kanban board (TODO / In Progress / Done)
 * for managing Skill Sets with drag-and-drop support.
 *
 * @module MOC.TaskKanban
 */

export interface TaskKanbanProps {
  /** All skill sets to display */
  skillSets: SkillSet[];
  /** All goals (for linking UI) */
  goals: Goal[];
  /** All habits (for linking UI) */
  habits: Habit[];
  /** All stickies (for selection UI) */
  stickies: Sticky[];
  /** All notes (for selection UI) */
  notes: Note[];
  /** Locale */
  locale: 'ja' | 'en';
  /** Callbacks */
  onCreateSkillSet: (payload: CreateSkillSetPayload) => Promise<void>;
  onUpdateSkillSet: (id: string, payload: UpdateSkillSetPayload) => Promise<void>;
  onDeleteSkillSet: (id: string) => Promise<void>;
  onExecuteSkillSet: (id: string) => Promise<void>;
  onCreateNote: (payload: CreateNotePayload) => Promise<Note>;
  onUpdateNote: (id: string, payload: UpdateNotePayload) => Promise<void>;
  onCreateSticky: (name: string, description?: string) => Promise<Sticky>;
  /** Current execution progress (from SSE) */
  executionProgress: Map<string, SkillSetProgressReport>;
  /** Whether Remote CLI is connected */
  isRemoteCliConnected: boolean;
}
```

**レイアウト構造**:

```
<div className="flex flex-col h-full">
  {/* Kanban Container - 3 columns */}
  <div ref={scrollContainerRef}
       className="flex gap-2 p-2 overflow-x-auto flex-1 min-h-0
                  md:overflow-x-visible md:gap-3 md:p-3
                  snap-x snap-mandatory md:snap-none">
    {TASK_KANBAN_COLUMNS.map(column => (
      <div key={column.id}
           className="min-w-[70vw] max-w-[70vw] md:min-w-0 md:max-w-none md:flex-1
                      snap-center">
        <TaskKanbanColumn
          column={column}
          skillSets={skillSetsByStatus[column.id]}
          ...
        />
      </div>
    ))}
  </div>

  {/* Mobile Column Indicators */}
  <div className="flex justify-center gap-2 py-3 md:hidden">
    {/* Dot navigation */}
  </div>
</div>
```

### 4.3 New Component: `MOC.TaskKanbanColumn.tsx`

**責務**: 個別カラムの描画、ドロップターゲット、カード一覧

```typescript
export interface TaskKanbanColumnProps {
  column: TaskKanbanColumnConfig;
  skillSets: SkillSet[];
  onDrop: (skillSetId: string, targetStatus: TaskKanbanColumnId) => void;
  isDragOver: boolean;
  onDragOver: () => void;
  onDragLeave: () => void;
  onCardClick: (skillSet: SkillSet) => void;
  onNewSkillSet?: () => void;        // TODOカラムのみ
  onExecute?: (skillSetId: string) => void;
  executionProgress: Map<string, SkillSetProgressReport>;
  isRemoteCliConnected: boolean;
}
```

### 4.4 New Component: `MOC.SkillSetCard.tsx`

**責務**: スキルセットカードのUI表示

```typescript
export interface SkillSetCardProps {
  skillSet: SkillSet;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onClick: () => void;
  onExecute?: () => void;
  progress?: SkillSetProgressReport;
  isRemoteCliConnected: boolean;
}
```

**カード表示要素**:

1. **ステータスドット**: 色付き丸アイコン（todo=warning, in_progress=blue, done=success）
2. **タイトル**: スキルセット名
3. **メニューボタン**: 編集/削除/実行のコンテキストメニュー
4. **Noteプレビュー**: "Note: {note.title}" のテキスト表示
5. **Sticky数**: "{count} steps" のテキスト表示
6. **Goal/Habitバッジ**: タグ形式のバッジ表示
7. **進捗バー**: in_progress時のみ表示（0-100%）
8. **進捗メッセージ**: "ステップ2/4: テスト実行中..."

### 4.5 New Component: `Modal.SkillSet.tsx`

**責務**: スキルセットの作成/編集/詳細表示モーダル

```typescript
export interface SkillSetModalProps {
  /** モーダル表示モード */
  mode: 'create' | 'edit' | 'view';
  /** 編集/表示対象のスキルセット */
  skillSet?: SkillSet;
  /** 選択可能なNote一覧 */
  notes: Note[];
  /** 選択可能なSticky'n一覧 */
  stickies: Sticky[];
  /** 選択可能なGoal一覧 */
  goals: Goal[];
  /** 選択可能なHabit一覧 */
  habits: Habit[];
  /** Locale */
  locale: 'ja' | 'en';
  /** Callbacks */
  onSave: (payload: CreateSkillSetPayload | UpdateSkillSetPayload) => Promise<void>;
  onDelete?: () => Promise<void>;
  onExecute?: () => Promise<void>;
  onCreateNote: (payload: CreateNotePayload) => Promise<Note>;
  onUpdateNote: (id: string, payload: UpdateNotePayload) => Promise<void>;
  onCreateSticky: (name: string, description?: string) => Promise<Sticky>;
  onClose: () => void;
  /** Remote CLI接続状態 */
  isRemoteCliConnected: boolean;
}
```

**モーダルレイアウト**:

```
+----------------------------------------------------------+
| [X] スキルセット作成 / 編集 / 詳細                       |
+----------------------------------------------------------+
|                                                          |
| 名前:  [________________________]                        |
| 説明:  [________________________]                        |
|                                                          |
| ── メインプロンプト (Note) ──────────────────            |
| [既存Noteから選択 v] [+ 新規作成]                        |
|                                                          |
| +------------------------------------------------------+ |
| | Note: "コードレビュープロンプト"                      | |
| | # コードレビュー手順                                 | |
| | 1. 変更差分を確認                                    | |
| | 2. コーディング規約との整合性チェック                 | |
| | ...                                                  | |
| | [編集]                                               | |
| +------------------------------------------------------+ |
|                                                          |
| ── サブ指示 (Sticky'n) ─────────────────────            |
| [既存Sticky'nを追加] [+ 新規作成]                        |
|                                                          |
| 1. [x] eslint設定の確認                          [除外] |
| 2. [ ] テストカバレッジの確認                    [除外] |
| 3. [ ] セキュリティチェック                      [除外] |
|    (ドラッグで並び替え可能)                              |
|                                                          |
| ── Goal / Habit 紐づけ ────────────────────             |
| Goals: [プロジェクト品質向上 x] [+ 追加]                 |
| Habits: [コードレビュー x] [+ 追加]                      |
|                                                          |
| ── 実行履歴 ───────────────────────────────              |
| 最終実行: 2026-02-07 15:30 - 成功                        |
|                                                          |
| [削除]                         [キャンセル] [保存]       |
| [実行する] (Remote CLI接続時のみ有効)                    |
+----------------------------------------------------------+
```

---

## 5. Hooks Design (カスタムフック設計)

### 5.1 New Hook: `useSkillSets.ts`

**責務**: スキルセットのCRUD操作とSupabase連携

```typescript
export interface UseSkillSetsOptions {
  userId?: string;
  authToken?: string;
}

export interface UseSkillSetsReturn {
  /** スキルセット一覧 */
  skillSets: SkillSet[];
  /** ローディング状態 */
  loading: boolean;
  /** エラー状態 */
  error: Error | null;
  /** スキルセット作成 */
  createSkillSet: (payload: CreateSkillSetPayload) => Promise<SkillSet>;
  /** スキルセット更新 */
  updateSkillSet: (id: string, payload: UpdateSkillSetPayload) => Promise<void>;
  /** スキルセット削除 */
  deleteSkillSet: (id: string) => Promise<void>;
  /** ステータス変更（Kanbanドラッグ用ショートカット） */
  changeStatus: (id: string, status: SkillSetStatus) => Promise<void>;
  /** データ再取得 */
  refresh: () => Promise<void>;
}

export function useSkillSets({ userId, authToken }: UseSkillSetsOptions): UseSkillSetsReturn {
  // Supabase clientでskill_setsをJOIN取得
  // notes, skill_set_stickies(+stickies), skill_set_goals(+goals), skill_set_habits(+habits)
  // 楽観的更新パターン
}
```

**データ取得クエリの概要**:

```sql
SELECT
    ss.*,
    n.id AS note_id, n.title AS note_title, n.content AS note_content,
    n.created_at AS note_created_at, n.updated_at AS note_updated_at
FROM skill_sets ss
LEFT JOIN notes n ON ss.note_id = n.id
WHERE ss.owner_id = :userId
ORDER BY ss.display_order, ss.created_at DESC;

-- 関連Stickies
SELECT sss.skill_set_id, sss.display_order, s.*
FROM skill_set_stickies sss
JOIN stickies s ON sss.sticky_id = s.id
WHERE sss.skill_set_id IN (:skillSetIds)
ORDER BY sss.display_order;

-- 関連Goals
SELECT ssg.skill_set_id, g.*
FROM skill_set_goals ssg
JOIN goals g ON ssg.goal_id = g.id
WHERE ssg.skill_set_id IN (:skillSetIds);

-- 関連Habits
SELECT ssh.skill_set_id, h.*
FROM skill_set_habits ssh
JOIN habits h ON ssh.habit_id = h.id
WHERE ssh.skill_set_id IN (:skillSetIds);
```

### 5.2 New Hook: `useNotes.ts`

**責務**: NoteのCRUD操作

```typescript
export interface UseNotesReturn {
  notes: Note[];
  loading: boolean;
  error: Error | null;
  createNote: (payload: CreateNotePayload) => Promise<Note>;
  updateNote: (id: string, payload: UpdateNotePayload) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useNotes({ userId, authToken }: { userId?: string; authToken?: string }): UseNotesReturn;
```

### 5.3 New Hook: `useTaskKanbanDragDrop.ts`

**責務**: Kanbanカードのドラッグ&ドロップ制御（`useKanbanDragDrop`の汎用化版）

```typescript
export interface UseTaskKanbanDragDropProps {
  onStatusChange: (skillSetId: string, newStatus: SkillSetStatus) => void;
}

export interface UseTaskKanbanDragDropReturn {
  draggedCardId: string | null;
  dropTargetColumn: TaskKanbanColumnId | null;
  sourceColumn: TaskKanbanColumnId | null;
  isDragging: boolean;
  handleDragStart: (cardId: string, sourceColumn: TaskKanbanColumnId, event?: React.DragEvent) => void;
  handleDragEnd: () => void;
  handleDragOver: (column: TaskKanbanColumnId, event?: React.DragEvent) => void;
  handleDragLeave: () => void;
  handleDrop: (targetColumn: TaskKanbanColumnId) => void;
  handleTouchStart: (cardId: string, sourceColumn: TaskKanbanColumnId, event: React.TouchEvent) => void;
  handleTouchMove: (event: React.TouchEvent) => void;
  handleTouchEnd: () => void;
}
```

**設計方針**: 既存の `useKanbanDragDrop` は Habit/HabitAction に強く依存しているため、汎用的なID + ステータスベースの新hookを作成する。コアロジック（ドラッグ検出、ドロップターゲット判定、タッチ操作）は同等のパターンに従う。

### 5.4 New Hook: `useSkillSetExecution.ts`

**責務**: スキルセットの実行管理とRemote CLI連携

```typescript
export interface UseSkillSetExecutionOptions {
  /** MCP chatのsendMessage関数 */
  sendMessage: (message: string) => Promise<void>;
  /** スキルセット状態更新関数 */
  changeStatus: (id: string, status: SkillSetStatus) => Promise<void>;
  /** ロール */
  isRemoteCli: boolean;
  /** 接続状態 */
  isConnected: boolean;
}

export interface UseSkillSetExecutionReturn {
  /** 実行中のスキルセットID */
  executingSkillSetId: string | null;
  /** 進捗マップ（skillSetId -> progress） */
  progressMap: Map<string, SkillSetProgressReport>;
  /** スキルセットを実行する */
  execute: (skillSet: SkillSet) => Promise<void>;
  /** 実行をキャンセルする */
  cancel: () => void;
  /** SSEメッセージをハンドルする（進捗報告の検出） */
  handleMessage: (message: MastraMessage) => void;
}
```

**プロンプト構築ロジック**:

```typescript
function buildExecutionPrompt(skillSet: SkillSet): string {
  const parts: string[] = [];

  // 1. コンテキスト: Goal/Habit情報
  if (skillSet.goals?.length || skillSet.habits?.length) {
    parts.push('## コンテキスト');
    if (skillSet.goals?.length) {
      parts.push('### 関連Goal');
      skillSet.goals.forEach(g => parts.push(`- ${g.name}${g.details ? `: ${g.details}` : ''}`));
    }
    if (skillSet.habits?.length) {
      parts.push('### 関連Habit');
      skillSet.habits.forEach(h => parts.push(`- ${h.name}`));
    }
    parts.push('');
  }

  // 2. メインプロンプト: Note
  if (skillSet.note) {
    parts.push('## メインタスク');
    parts.push(skillSet.note.content);
    parts.push('');
  }

  // 3. サブ指示: Sticky'nアイテム
  if (skillSet.stickies?.length) {
    parts.push('## サブタスク / ステップ');
    skillSet.stickies
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .forEach((item, index) => {
        const sticky = item.sticky;
        if (sticky) {
          parts.push(`${index + 1}. ${sticky.name}${sticky.description ? `\n   ${sticky.description}` : ''}`);
        }
      });
    parts.push('');
  }

  // 4. 進捗報告指示
  parts.push('## 進捗報告');
  parts.push('各ステップの完了時に、以下のJSON形式で進捗を報告してください:');
  parts.push('```json');
  parts.push(JSON.stringify({
    type: 'skill_set_progress',
    skillSetId: skillSet.id,
    status: 'in_progress',
    progress: 50,
    message: 'ステップN完了: 次のステップを開始',
    stepCurrent: 2,
    stepTotal: 4,
  }, null, 2));
  parts.push('```');
  parts.push('全ステップ完了時は status を "done" にしてください。');
  parts.push('エラー発生時は status を "error" にしてください。');

  return parts.join('\n');
}
```

---

## 6. API Design (API設計)

### 6.1 Backend Routes: `routers/skillSets.ts`

新規ルーターを追加する。

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/skill-sets` | スキルセット一覧取得（JOIN含む） |
| GET | `/api/v1/skill-sets/:id` | スキルセット詳細取得 |
| POST | `/api/v1/skill-sets` | スキルセット作成 |
| PUT | `/api/v1/skill-sets/:id` | スキルセット更新 |
| DELETE | `/api/v1/skill-sets/:id` | スキルセット削除 |
| PATCH | `/api/v1/skill-sets/:id/status` | ステータス変更 |
| POST | `/api/v1/skill-sets/:id/execute` | 実行開始（プロンプト構築 + ステータス更新） |

### 6.2 Backend Routes: `routers/notes.ts`

新規ルーターを追加する。

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/notes` | Note一覧取得 |
| GET | `/api/v1/notes/:id` | Note詳細取得 |
| POST | `/api/v1/notes` | Note作成 |
| PUT | `/api/v1/notes/:id` | Note更新 |
| DELETE | `/api/v1/notes/:id` | Note削除 |

### 6.3 Frontend API Client Extension: `lib/api.ts`

```typescript
// Skill Set API
skillSets: {
  list: () => api.get('/api/v1/skill-sets'),
  get: (id: string) => api.get(`/api/v1/skill-sets/${id}`),
  create: (payload: CreateSkillSetPayload) => api.post('/api/v1/skill-sets', payload),
  update: (id: string, payload: UpdateSkillSetPayload) => api.put(`/api/v1/skill-sets/${id}`, payload),
  delete: (id: string) => api.delete(`/api/v1/skill-sets/${id}`),
  changeStatus: (id: string, status: SkillSetStatus) => api.patch(`/api/v1/skill-sets/${id}/status`, { status }),
  execute: (id: string) => api.post(`/api/v1/skill-sets/${id}/execute`),
},

// Notes API
notes: {
  list: () => api.get('/api/v1/notes'),
  get: (id: string) => api.get(`/api/v1/notes/${id}`),
  create: (payload: CreateNotePayload) => api.post('/api/v1/notes', payload),
  update: (id: string, payload: UpdateNotePayload) => api.put(`/api/v1/notes/${id}`, payload),
  delete: (id: string) => api.delete(`/api/v1/notes/${id}`),
},
```

### 6.4 Zod Validation Schemas

```typescript
// schemas/skillSet.ts
import { z } from 'zod';

export const createSkillSetSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  noteId: z.string().uuid().optional(),
  stickyIds: z.array(z.string()).optional(),
  goalIds: z.array(z.string()).optional(),
  habitIds: z.array(z.string()).optional(),
});

export const updateSkillSetSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  noteId: z.string().uuid().optional().nullable(),
  status: z.enum(['todo', 'in_progress', 'done']).optional(),
  displayOrder: z.number().int().min(0).optional(),
  addStickyIds: z.array(z.string()).optional(),
  removeStickyIds: z.array(z.string()).optional(),
  addGoalIds: z.array(z.string()).optional(),
  removeGoalIds: z.array(z.string()).optional(),
  addHabitIds: z.array(z.string()).optional(),
  removeHabitIds: z.array(z.string()).optional(),
});

export const changeStatusSchema = z.object({
  status: z.enum(['todo', 'in_progress', 'done']),
});

// schemas/note.ts
export const createNoteSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().max(50000),
});

export const updateNoteSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().max(50000).optional(),
});
```

---

## 7. State Management (状態管理設計)

### 7.1 State Flow in Section.MOC.tsx

```typescript
// 新しいstate追加（Section.MOC.tsx内）
const {
  skillSets,
  loading: skillSetsLoading,
  createSkillSet,
  updateSkillSet,
  deleteSkillSet,
  changeStatus,
  refresh: refreshSkillSets,
} = useSkillSets({ userId, authToken });

const {
  notes,
  createNote,
  updateNote,
} = useNotes({ userId, authToken });

const {
  executingSkillSetId,
  progressMap,
  execute: executeSkillSet,
  cancel: cancelExecution,
  handleMessage: handleExecutionMessage,
} = useSkillSetExecution({
  sendMessage,   // from useMcpChat
  changeStatus,
  isRemoteCli,
  isConnected: /* MCP connection status */,
});

// MCP chatのonMessage内で進捗報告を検出
const handleMcpMessage = useCallback((msg: MastraMessage) => {
  handleExecutionMessage(msg);
  // ...existing message handling
}, [handleExecutionMessage]);
```

### 7.2 Progress Report Detection

SSEメッセージ内の進捗報告検出ロジック:

```typescript
function extractProgressReport(message: MastraMessage): SkillSetProgressReport | null {
  // ケース1: toolCallsの出力にJSON形式の進捗報告がある場合
  if (message.toolCalls) {
    for (const tc of message.toolCalls) {
      if (typeof tc.output === 'object' && tc.output !== null) {
        const obj = tc.output as Record<string, unknown>;
        if (obj.type === 'skill_set_progress') {
          return obj as unknown as SkillSetProgressReport;
        }
      }
    }
  }

  // ケース2: メッセージ本文にJSON形式の進捗報告が埋め込まれている場合
  const jsonMatch = message.content.match(/```json\s*(\{[\s\S]*?"type"\s*:\s*"skill_set_progress"[\s\S]*?\})\s*```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (parsed.type === 'skill_set_progress') {
        return parsed as SkillSetProgressReport;
      }
    } catch {
      // ignore parse errors
    }
  }

  return null;
}
```

---

## 8. Chat Integration Design (チャット連携設計)

### 8.1 Task Execution Trigger Detection

チャットメッセージから「タスク実行」要求を検出するロジック:

```typescript
const TASK_EXECUTION_PATTERNS = [
  /タスク実行/,
  /タスクを実行/,
  /スキルセット実行/,
  /スキルセットを実行/,
  /task.*execut/i,
  /execute.*task/i,
  /run.*skill/i,
  /skill.*set.*run/i,
];

function isTaskExecutionRequest(message: string): boolean {
  return TASK_EXECUTION_PATTERNS.some(pattern => pattern.test(message));
}
```

### 8.2 Skill Set Selection Flow

```
User: "タスク実行をしてください"
  |
  v
[isTaskExecutionRequest → true]
  |
  v
[Fetch todo skill sets]
  |
  +-- 0件 → System: "実行可能なスキルセットがありません。タスクタブで作成してください。"
  |
  +-- 1件 → [直接実行]
  |
  +-- N件 → [Selection UI: クイックリプライボタン]
               User: [Skill Set A] をクリック
                 |
                 v
               [選択されたスキルセットで実行開始]
```

### 8.3 Execution Flow in Chat

```
System: "「コードレビュー」スキルセットを実行します..."
  |
Remote CLI: "実行を開始します。"
Remote CLI: "ステップ1: 変更差分を確認中..."
  |
  [Progress: 25%]
  |
Remote CLI: "ステップ1完了。ステップ2: コーディング規約チェック中..."
  |
  [Progress: 50%]
  |
Remote CLI: "ステップ2完了。ステップ3: テストカバレッジ確認中..."
  |
  [Progress: 75%]
  |
Remote CLI: "全ステップ完了。レビュー結果をまとめます。"
  |
  [Progress: 100%, status: done]
  |
System: "スキルセット「コードレビュー」が完了しました。"
```

---

## 9. Error Handling (エラーハンドリング)

### 9.1 Error Cases

| エラーケース | 対処 |
|-------------|------|
| Remote CLI未接続時の実行要求 | エラーメッセージ表示 + 実行ボタン無効化 |
| Supabase接続エラー | 楽観的更新のロールバック + リトライボタン表示 |
| スキルセットのNote未設定 | 実行ボタン無効化 + ツールチップで理由表示 |
| 実行中のスキルセットが既にある | 確認ダイアログ表示（既存実行を中止するか） |
| Remote CLIからのエラー報告 | カードにエラー状態表示 + エラーメッセージ表示 |
| ドラッグ&ドロップの競合 | ステータス変更の順序保証（最後の操作を優先） |

### 9.2 Error States on Card

```
+------------------------------------------+
| [!] Skill Set Name               [Menu] |
|                                          |
| Error: テスト実行でタイムアウト          |
| [再実行]                                 |
+------------------------------------------+
```

---

## 10. File Structure Summary (ファイル構成)

### 10.1 New Files

```
frontend/app/dashboard/
  types/
    skill-set.types.ts              # 型定義
  hooks/
    useSkillSets.ts                 # スキルセットCRUD hook
    useNotes.ts                     # Note CRUD hook
    useTaskKanbanDragDrop.ts        # Kanban D&D hook
    useSkillSetExecution.ts         # 実行管理 hook
  components/
    MOC.TaskKanban.tsx              # Kanbanボード全体
    MOC.TaskKanbanColumn.tsx        # Kanbanカラム
    MOC.SkillSetCard.tsx            # スキルセットカード
    Modal.SkillSet.tsx              # スキルセットモーダル

backend/src/
  routers/
    skillSets.ts                    # スキルセットAPI
    notes.ts                        # Note API
  repositories/
    skillSetRepository.ts           # スキルセットDB操作
    noteRepository.ts               # Note DB操作
  schemas/
    skillSet.ts                     # Zodスキーマ
    note.ts                         # Zodスキーマ

supabase/migrations/
  YYYYMMDDHHMMSS_add_skill_sets.sql # マイグレーション
```

### 10.2 Modified Files

```
frontend/app/dashboard/
  components/
    Section.MOC.tsx                 # タスクタブの描画を変更
  types/
    index.ts                        # Note型のexport追加
    moc.types.ts                    # (変更なしの見込み)

backend/src/
  index.ts                          # 新規ルーターの登録
```
