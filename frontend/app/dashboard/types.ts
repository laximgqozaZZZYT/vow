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

export interface Mindmap {
  id: string;
  name: string;
  description?: string;
  nodes: MindmapNode[];
  edges: MindmapEdge[];
  createdAt?: string;
  updatedAt?: string;
}

export interface MindmapNode {
  id: string;
  mindmapId: string;
  label: string;
  position: { x: number; y: number };
  nodeType?: 'default' | 'habit' | 'goal';
  createdAt?: string;
  updatedAt?: string;
}

export interface MindmapEdge {
  id: string;
  mindmapId: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
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
  must?: number;
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
  amount?: number;
  durationSeconds?: number;
  newCount?: number;
  prevCount?: number;
}

export type ActivityKind = 'start' | 'complete' | 'skip' | 'pause' | 'habit' | 'goal' | 'custom';

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

export interface DashboardHeaderProps {
  onToggleSidebar: () => void;
  showSidebar: boolean;
  onEditLayout: () => void;
}

export interface NextSectionProps {
  habits: Habit[];
  onHabitAction: (habitId: string, action: 'start' | 'complete' | 'pause') => void;
}

export interface ActivitySectionProps {
  activities: Activity[];
  onEditActivity: (activityId: string) => void;
  onDeleteActivity: (activityId: string) => void;
  habits: Habit[];
}

export interface GoalTreeProps {
  goals: Goal[];
  habits: Habit[];
  selectedGoal: string | null;
  onGoalSelect: (goalId: string | null) => void;
  onGoalEdit: (goalId: string) => void;
  onHabitEdit: (habitId: string) => void;
  onHabitAction: (habitId: string, action: 'start' | 'complete' | 'pause') => void;
  onMoveGoal: (goalId: string, newParentId: string | null) => void;
  onMoveHabit: (habitId: string, newGoalId: string) => void;
}

export interface GuestDataMigrationResult {
  success: boolean;
  migratedGoals: number;
  migratedHabits: number;
  migratedActivities: number;
  errors: string[];
}

export interface AuthContext {
  user: any;
  signOut: () => Promise<void>;
  isAuthed: boolean | null;
  actorLabel: string;
  authError: string | null;
  handleLogout: () => Promise<void>;
  isGuest: boolean;
  // Migration properties
  migrationStatus: 'idle' | 'checking' | 'migrating' | 'success' | 'error';
  migrationResult: GuestDataMigrationResult | null;
  migrationError: string | null;
  retryMigration: () => Promise<void>;
}