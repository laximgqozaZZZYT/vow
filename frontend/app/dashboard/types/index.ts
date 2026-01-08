// Shared type definitions for dashboard components

export type SectionId = 'next' | 'activity' | 'calendar' | 'statics' | 'diary';
export type ActivityKind = 'start' | 'complete' | 'skip' | 'pause';
export type HabitAction = 'start' | 'complete' | 'pause';

export interface Goal {
  id: string;
  name: string;
  details?: string;
  dueDate?: string | Date | null;
  parentId?: string | null;
  isCompleted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Habit {
  id: string;
  goalId: string;
  name: string;
  active: boolean;
  type: "do" | "avoid";
  count: number;
  must?: number;
  completed?: boolean;
  lastCompletedAt?: string;
  duration?: number;
  reminders?: ({ kind: 'absolute'; time: string; weekdays: string[] } | { kind: 'relative'; minutesBefore: number })[];
  dueDate?: string;
  time?: string;
  endTime?: string;
  repeat?: string;
  allDay?: boolean;
  notes?: string;
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
  timings?: any[];
  allDay?: boolean;
  notes?: string;
  workloadUnit?: string;
  workloadTotal?: number;
  workloadPerCount?: number;
}

// Context interfaces
export interface AuthContext {
  user: any; // TODO: implement proper user type
  signOut: () => Promise<void>;
  isAuthed: boolean | null;
  actorLabel: string;
  authError: string | null;
  handleLogout: () => Promise<void>;
  isGuest: boolean; // ゲストユーザーかどうかを示すフラグ
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
  onHabitAction: (habitId: string, action: HabitAction) => void;
}

export interface ActivitySectionProps {
  activities: Activity[];
  onEditActivity: (activityId: string) => void;
  onDeleteActivity: (activityId: string) => void;
}

export interface CalendarSectionProps {
  habits: Habit[];
  goals: Goal[];
  onEventClick: (habitId: string) => void;
  onSlotSelect: (date: string, time?: string, endTime?: string) => void;
  onEventChange: (habitId: string, changes: EventChanges) => void;
  onRecurringAttempt: (habitId: string, changes: EventChanges) => void;
}