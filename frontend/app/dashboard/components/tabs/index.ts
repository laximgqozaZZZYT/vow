/**
 * Tab Components for Habit Modal
 * 
 * Export all tab panel components for the habit modal's 4-tab structure:
 * - BasicTab: Name, Type, Timings, Description, Level
 * - ExclusionTab: Outdates configuration
 * - WorkloadTab: Workload settings (Level, Unit, Load per Count, Load Total)
 * - DetailTab: Goal, Tags, Related Habits
 */

export { BasicTab } from './BasicTab';
export type { 
  BasicTabProps, 
  Timing, 
  TimingType, 
  Habit, 
  HabitFormState 
} from './BasicTab';

export { ExclusionTab } from './ExclusionTab';
export type { ExclusionTabProps } from './ExclusionTab';

export { WorkloadTab } from './WorkloadTab';
export type { WorkloadTabProps } from './WorkloadTab';

export { DetailTab } from './DetailTab';
export type { 
  DetailTabProps, 
  HabitRelation, 
  RelationType, 
  Goal, 
  Tag 
} from './DetailTab';
