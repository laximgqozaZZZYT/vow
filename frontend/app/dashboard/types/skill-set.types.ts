/**
 * Skill Set Types - MOC Task Kanban
 *
 * スキルセット（Note + Sticky'n + Goal/Habit紐づけ）の型定義
 */

import type { Sticky, Goal, Habit } from './index';

// ============================================================================
// Note Entity
// ============================================================================

export interface Note {
  id: string;
  title: string;
  content: string; // Markdown format
  ownerType: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNotePayload {
  title: string;
  content: string;
}

export interface UpdateNotePayload {
  title?: string;
  content?: string;
}

// ============================================================================
// Skill Set Entity
// ============================================================================

export type SkillSetStatus = 'todo' | 'in_progress' | 'done';

export interface SkillSetStickyItem {
  id: string; // skill_set_stickies.id
  stickyId: string;
  displayOrder: number;
  sticky?: Sticky; // Joined data
}

export interface SkillSetGoalItem {
  id: string; // skill_set_goals.id
  goalId: string;
  goal?: Goal; // Joined data
}

export interface SkillSetHabitItem {
  id: string; // skill_set_habits.id
  habitId: string;
  habit?: Habit; // Joined data
}

export interface SkillSet {
  id: string;
  name: string;
  description?: string;
  noteId?: string;
  note?: Note; // Joined data
  status: SkillSetStatus;
  executionResult?: SkillSetExecutionResult;
  lastExecutedAt?: string;
  displayOrder: number;
  ownerType: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  // Joined relations
  stickies?: SkillSetStickyItem[];
  goals?: SkillSetGoalItem[];
  habits?: SkillSetHabitItem[];
}

// ============================================================================
// CRUD Payloads
// ============================================================================

export interface CreateSkillSetPayload {
  name: string;
  description?: string;
  noteId?: string;
  /** If provided, create a new Note inline */
  newNote?: CreateNotePayload;
  stickyIds?: string[];
  goalIds?: string[];
  habitIds?: string[];
}

export interface UpdateSkillSetPayload {
  name?: string;
  description?: string;
  noteId?: string | null;
  status?: SkillSetStatus;
  displayOrder?: number;
  /** Sticky IDs to add */
  addStickyIds?: string[];
  /** Sticky IDs to remove */
  removeStickyIds?: string[];
  /** Goal IDs to add */
  addGoalIds?: string[];
  /** Goal IDs to remove */
  removeGoalIds?: string[];
  /** Habit IDs to add */
  addHabitIds?: string[];
  /** Habit IDs to remove */
  removeHabitIds?: string[];
}

// ============================================================================
// Execution Types
// ============================================================================

export interface SkillSetExecutionResult {
  status: 'success' | 'error' | 'cancelled';
  message: string;
  completedAt: string;
  stepsCompleted?: number;
  totalSteps?: number;
}

export interface SkillSetProgressReply {
  label: string;
  action: string;
  icon?: string;
}

export interface SkillSetProgressReport {
  type: 'skill_set_progress';
  skillSetId: string;
  status: 'in_progress' | 'done' | 'error' | 'waiting';
  progress: number; // 0-100
  message: string;
  taskName?: string;
  replies?: SkillSetProgressReply[];
}

// ============================================================================
// Kanban Column Config
// ============================================================================

export type TaskKanbanColumnId = 'todo' | 'in_progress' | 'done';

export interface TaskKanbanColumnConfig {
  id: TaskKanbanColumnId;
  title: string;
  titleJa: string;
  accentColor: string; // Tailwind border color
  accentBg: string; // Tailwind bg color
  statusDotColor: string; // Status indicator color
}

export const TASK_KANBAN_COLUMNS: TaskKanbanColumnConfig[] = [
  {
    id: 'todo',
    title: 'TODO',
    titleJa: 'TODO',
    accentColor: 'border-warning/50',
    accentBg: 'bg-warning/5',
    statusDotColor: 'bg-warning',
  },
  {
    id: 'in_progress',
    title: 'In Progress',
    titleJa: '進行中',
    accentColor: 'border-blue-500/50',
    accentBg: 'bg-blue-500/5',
    statusDotColor: 'bg-blue-500',
  },
  {
    id: 'done',
    title: 'Done',
    titleJa: '完了',
    accentColor: 'border-success/50',
    accentBg: 'bg-success/5',
    statusDotColor: 'bg-success',
  },
];
