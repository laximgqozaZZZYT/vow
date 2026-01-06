export interface Goal {
  id: string;
  name: string;
  details?: string;
  dueDate?: string | Date | null;
  parentId?: string | null;
  isCompleted?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Habit {
  id: string;
  name: string;
  goalId: string;
  type: "do" | "avoid";
  active: boolean;
  completed: boolean;
  count?: number;
  dueDate?: string;
  time?: string;
  endTime?: string;
  repeat?: string;
  duration?: number;
  notes?: string;
  workloadUnit?: string;
  workloadTotal?: number;
  workloadPerCount?: number;
  reminders?: ({ kind: 'absolute'; time: string; weekdays: string[] } | { kind: 'relative'; minutesBefore: number })[];
  timings?: any[];
  allDay?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Activity {
  id: string;
  name?: string;
  habitId?: string;
  habitName?: string;
  timestamp?: string;
  kind?: ActivityKind;
  startedAt?: string;
  completedAt?: string;
  pausedAt?: string;
  duration?: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type ActivityKind = 'habit' | 'goal' | 'custom';

export type SectionId = 'next' | 'activity' | 'calendar' | 'statics' | 'diary';

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

export interface DashboardSidebarProps {
  isVisible: boolean;
  onClose: () => void;
  onNewGoal: () => void;
  onNewHabit: (initial?: any) => void;
}