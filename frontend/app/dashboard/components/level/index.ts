/**
 * Level System Components Index
 * 
 * Exports all THLI-24 level-related components for the habit-goal-level-system feature.
 * 
 * @module level
 */

// Core level badge component
export { default as LevelBadge, LevelBadgeCompact, LevelBadgePositioned } from '../LevelBadge';
export type { LevelBadgeProps, LevelTier } from '../LevelBadge';
export { calculateTier, getTierColors } from '../LevelBadge';

// Level details modal
export { default as LevelDetailsModal } from '../Modal.LevelDetails';
export type { 
  LevelDetailsModalProps, 
  LevelAssessmentData, 
  THLIVariable, 
  THLIDomain, 
  StoplightStatus,
  CrossFrameworkScores 
} from '../Modal.LevelDetails';

// Assessment result modal
export { default as AssessmentResultModal } from '../Modal.AssessmentResult';
export type { AssessmentResultModalProps, AssessmentResultData } from '../Modal.AssessmentResult';

// Baby step plan modal
export { default as BabyStepPlanModal } from '../Modal.BabyStepPlan';
export type { 
  BabyStepPlanModalProps, 
  BabyStepPlan, 
  VariableReduction, 
  MinimalHabit 
} from '../Modal.BabyStepPlan';

// Level history section
export { default as LevelHistory } from '../Section.LevelHistory';
export type { 
  LevelHistoryProps, 
  LevelChange, 
  WorkloadChanges,
  DateRangeFilter,
  ChangeTypeFilter 
} from '../Section.LevelHistory';

// Quota status widget
export { default as QuotaStatusWidget, QuotaStatusCompact, QuotaIndicator } from '../Widget.QuotaStatus';
export type { QuotaStatusWidgetProps, QuotaStatus } from '../Widget.QuotaStatus';

// Assess level button
export { 
  default as AssessLevelButton, 
  AssessLevelButtonCompact, 
  AssessLevelPrompt,
  getAssessmentMessage 
} from '../Widget.AssessLevelButton';
export type { AssessLevelButtonProps } from '../Widget.AssessLevelButton';

// Goal level badge
export { 
  default as GoalLevelBadge, 
  GoalLevelBadgePositioned, 
  GoalLevelSummary,
  calculateGoalLevel,
  getHabitLevelStats 
} from '../Widget.GoalLevelBadge';
export type { GoalLevelBadgeProps, HabitWithLevel } from '../Widget.GoalLevelBadge';

// Habit Inventory Feature (Requirements 3.1-3.7)
export { default as HabitInventoryWidget, HabitInventoryButton } from '../Widget.HabitInventory';
export type { HabitInventoryWidgetProps } from '../Widget.HabitInventory';

export { default as InventoryConfirmModal } from '../Modal.InventoryConfirm';
export type { InventoryConfirmModalProps } from '../Modal.InventoryConfirm';

export { default as InventoryProgress, InventoryProgressCompact } from '../Widget.InventoryProgress';
export type { InventoryProgressProps } from '../Widget.InventoryProgress';

export { default as InventorySummaryModal } from '../Modal.InventorySummary';
export type { 
  InventorySummaryModalProps, 
  InventorySummaryData,
  LevelDistribution,
  AssessedHabit,
  PendingDataHabit 
} from '../Modal.InventorySummary';
