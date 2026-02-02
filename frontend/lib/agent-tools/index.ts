/**
 * Agent Tools Library
 *
 * Common tools and utilities for AI agents in the VOW application.
 * Provides type-safe tool definitions, error handling, and shared utilities.
 *
 * @module agent-tools
 */

// Types
export type {
  ToolContext,
  AgentTool,
  ToolResult,
  ToolExecutionStatus,
  ToolExecutionRecord,
  ToolRegistration,
  ToolInput,
  ToolOutput,
} from './types';

// Habit Tools
export {
  // Schemas
  CreateHabitSchema,
  GetHabitsSchema,
  AnalyzeHabitsSchema,
  UpdateHabitSchema,
  LogHabitCompletionSchema,
  // Tools
  createHabitTool,
  getHabitsTool,
  analyzeHabitsTool,
  updateHabitTool,
  logHabitCompletionTool,
  // Collections
  habitTools,
  habitToolList,
} from './habit-tools';

export type {
  CreateHabitInput,
  GetHabitsInput,
  AnalyzeHabitsInput,
  UpdateHabitInput,
  LogHabitCompletionInput,
  Habit,
  HabitAnalysis,
} from './habit-tools';

// Goal Tools
export {
  // Schemas
  CreateGoalSchema,
  GetGoalsSchema,
  UpdateGoalSchema,
  CalculateProgressSchema,
  LinkHabitToGoalSchema,
  // Tools
  createGoalTool,
  getGoalsTool,
  updateGoalTool,
  calculateProgressTool,
  linkHabitToGoalTool,
  // Collections
  goalTools,
  goalToolList,
} from './goal-tools';

export type {
  CreateGoalInput,
  GetGoalsInput,
  UpdateGoalInput,
  CalculateProgressInput,
  LinkHabitToGoalInput,
  Goal,
  GoalProgress,
} from './goal-tools';

// Activity Tools
export {
  // Schemas
  LogActivitySchema,
  GetActivitiesSchema,
  GetStatsSchema,
  UpdateWorkloadSchema,
  // Tools
  logActivityTool,
  getActivitiesTool,
  getStatsTool,
  updateWorkloadTool,
  // Collections
  activityTools,
  activityToolList,
} from './activity-tools';

export type {
  LogActivityInput,
  GetActivitiesInput,
  GetStatsInput,
  UpdateWorkloadInput,
  Activity,
  ActivityStats,
  DailyWorkload,
} from './activity-tools';

// Diary Tools
export {
  // Schemas
  CreateDiaryEntrySchema,
  GetDiaryEntriesSchema,
  UpdateDiaryEntrySchema,
  // Tools
  createDiaryEntryTool,
  getDiaryEntriesTool,
  updateDiaryEntryTool,
  // Collections
  diaryTools,
  diaryToolList,
} from './diary-tools';

export type {
  CreateDiaryEntryInput,
  GetDiaryEntriesInput,
  UpdateDiaryEntryInput,
  DiaryEntry,
  DiaryTag,
} from './diary-tools';

// Calendar Tools
export {
  // Schemas
  GetEventsSchema,
  CreateEventSchema,
  CreateReminderSchema,
  // Tools
  getEventsTool,
  createEventTool,
  createReminderTool,
  // Collections
  calendarTools,
  calendarToolList,
} from './calendar-tools';

export type {
  GetEventsInput,
  CreateEventInput,
  CreateReminderInput,
  CalendarEvent,
  Reminder,
} from './calendar-tools';

// Error Handling
export {
  // Retry
  withRetry,
  DEFAULT_RETRY_CONFIG,
  // Circuit Breaker
  CircuitBreaker,
  CircuitOpenError,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
  // Combined
  withCircuitBreakerAndRetry,
  // Error Classification
  isRetryableError,
  isPermanentError,
} from './error-handler';

export type { RetryConfig, CircuitBreakerConfig, CircuitState } from './error-handler';

// Message Adapter
export {
  // Converters: Source -> Unified
  fromMastraMessage,
  fromMultiAgentMessage,
  fromCoachMessage,
  fromBaseAgentMessage,
  toUnifiedMessage,
  toUnifiedMessages,
  // Converters: Unified -> Target
  toMastraMessage,
  toMultiAgentMessage,
  toCoachMessage,
  toBaseAgentMessage,
  fromUnifiedMessage,
  // Type Detection
  isUnifiedMessage,
  detectSourceType,
  // Batch Utilities
  convertMessagesWithOrder,
  mergeAndSortMessages,
  filterByAgentType,
  filterByRole,
  groupBySession,
  getLatestByRole,
} from './message-adapter';

export type {
  MastraMessage,
  MastraToolCall,
  MultiAgentChatMessage,
  CoachMessage,
  BaseAgentMessage,
  SourceMessage,
} from './message-adapter';

// ============================================================================
// Aggregate Tool Collections
// ============================================================================

import { habitToolList } from './habit-tools';
import { goalToolList } from './goal-tools';
import { activityToolList } from './activity-tools';
import { diaryToolList } from './diary-tools';
import { calendarToolList } from './calendar-tools';

/**
 * All available agent tools combined.
 */
export const allTools = [
  ...habitToolList,
  ...goalToolList,
  ...activityToolList,
  ...diaryToolList,
  ...calendarToolList,
];

/**
 * Tool count by category for monitoring.
 */
export const toolCounts = {
  habit: habitToolList.length,
  goal: goalToolList.length,
  activity: activityToolList.length,
  diary: diaryToolList.length,
  calendar: calendarToolList.length,
  total: allTools.length,
} as const;
