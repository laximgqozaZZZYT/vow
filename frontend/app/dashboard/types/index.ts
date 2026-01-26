// Shared type definitions for dashboard components

export type SectionId = 'next' | 'activity' | 'calendar' | 'statics' | 'diary' | 'stickies';
export type ActivityKind = 'start' | 'complete' | 'skip' | 'pause';
export type HabitAction = 'start' | 'complete' | 'pause' | 'reset';

export interface Tag {
  id: string;
  name: string;
  color?: string;
  parentId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Goal {
  id: string;
  name: string;
  details?: string;
  dueDate?: string | Date | null;
  parentId?: string | null;
  isCompleted?: boolean;
  tags?: Tag[];
  createdAt: string;
  updatedAt: string;
}

import type { Timing } from './shared';

export interface Habit {
  id: string;
  goalId: string;
  name: string;
  active: boolean;
  type: "do" | "avoid";
  count: number;
  must: number;
  completed: boolean;
  lastCompletedAt?: string;
  duration?: number;
  reminders?: ({ kind: 'absolute'; time: string; weekdays: string[] } | { kind: 'relative'; minutesBefore: number })[];
  dueDate?: string;
  time?: string;
  endTime?: string;
  repeat?: string;
  allDay?: boolean;
  notes?: string;
  tags?: Tag[];
  workloadUnit?: string;
  workloadTotal?: number;
  workloadTotalEnd?: number;
  workloadPerCount?: number;
  timings?: Timing[];
  outdates?: Timing[];
  createdAt: string;
  updatedAt: string;
}

export interface Activity {
  id: string;
  kind: ActivityKind;
  habitId: string;
  habitName: string;
  timestamp: string;
  amount?: number;
  prevCount?: number;
  newCount?: number;
  durationSeconds?: number;
}

export interface HabitInitial {
  date?: string;
  time?: string;
  endTime?: string;
  type?: "do" | "avoid";
}

export interface EventChanges {
  start?: string;
  end?: string;
  timingIndex?: number;
}

export interface RecurringRequest {
  habitId: string;
  start?: string;
  end?: string;
}

export interface CreateGoalPayload {
  name: string;
  details?: string;
  dueDate?: string;
  parentId?: string | null;
}

export interface CreateHabitPayload {
  name: string;
  goalId?: string;
  type: "do" | "avoid";
  duration?: number;
  reminders?: ({ kind: 'absolute'; time: string; weekdays: string[] } | { kind: 'relative'; minutesBefore: number })[];
  dueDate?: string;
  time?: string;
  endTime?: string;
  repeat?: string;
  timings?: Timing[];
  allDay?: boolean;
  notes?: string;
  workloadUnit?: string;
  workloadTotal?: number;
  workloadPerCount?: number;
}

// Context interfaces
export interface GuestDataMigrationResult {
  success: boolean;
  migratedGoals: number;
  migratedHabits: number;
  migratedActivities: number;
  errors: string[];
}

/** User type from Supabase Auth */
export interface AuthUser {
  id: string;
  email?: string;
  phone?: string;
  created_at?: string;
  updated_at?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
  aud?: string;
  role?: string;
}

export interface AuthContext {
  user: AuthUser | null;
  signOut: () => Promise<void>;
  isAuthed: boolean | null;
  actorLabel: string;
  authError: string | null;
  handleLogout: () => Promise<void>;
  isGuest: boolean; // ゲストユーザーかどうかを示すフラグ
  migrationStatus: 'idle' | 'checking' | 'migrating' | 'success' | 'error';
  migrationResult: GuestDataMigrationResult | null;
  migrationError: string | null;
  retryMigration: () => Promise<void>;
}

// Component prop interfaces
export interface DashboardHeaderProps {
  onToggleSidebar: () => void;
  showSidebar: boolean;
  onEditLayout: () => void;
}

export interface DashboardSidebarProps {
  isVisible: boolean;
  onClose: () => void;
  onNewGoal: () => void;
  onNewHabit: (initial?: HabitInitial) => void;
}

export interface GoalTreeProps {
  goals: Goal[];
  habits: Habit[];
  selectedGoal: string | null;
  onGoalSelect: (goalId: string) => void;
  onGoalEdit: (goalId: string) => void;
  onHabitEdit: (habitId: string) => void;
  onHabitAction: (habitId: string, action: HabitAction) => void;
}

export interface NextSectionProps {
  habits: Habit[];
  activities: Activity[];
  onHabitAction: (habitId: string, action: HabitAction, amount?: number) => void;
  onHabitEdit: (habitId: string) => void;
}

export interface ActivitySectionProps {
  activities: Activity[];
  onEditActivity: (activityId: string) => void;
  onDeleteActivity: (activityId: string) => void;
  habits: Habit[];
}

export interface CalendarSectionProps {
  habits: Habit[];
  goals: Goal[];
  onEventClick: (habitId: string) => void;
  onSlotSelect: (date: string, time?: string, endTime?: string) => void;
  onEventChange: (habitId: string, changes: EventChanges) => void;
  onRecurringAttempt: (habitId: string, changes: EventChanges) => void;
}

// Mindmap interfaces
export interface Mindmap {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MindmapNode {
  id: string;
  mindmapId: string;
  text: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  color?: string;
  goalId?: string | null;
  habitId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MindmapConnection {
  id: string;
  mindmapId: string;
  fromNodeId: string;
  toNodeId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMindmapPayload {
  name: string;
  description?: string;
}

export interface CreateMindmapNodePayload {
  text: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  color?: string;
}

export interface CreateMindmapConnectionPayload {
  fromNodeId: string;
  toNodeId: string;
}

// Sticky'n interfaces
export interface Sticky {
  id: string;
  name: string;
  description?: string;
  completed: boolean;
  completedAt?: string;
  displayOrder: number;
  tags?: Tag[];
  goals?: Goal[];
  habits?: Habit[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateStickyPayload {
  name: string;
  description?: string;
  displayOrder?: number;
}

export interface StickySectionProps {
  stickies: Sticky[];
  onStickyCreate: () => void;
  onStickyEdit: (stickyId: string) => void;
  onStickyComplete: (stickyId: string) => void;
  onStickyDelete: (stickyId: string) => void;
}