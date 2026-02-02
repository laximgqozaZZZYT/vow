/**
 * Shared Agent Tools
 *
 * Common tool definitions and utilities shared between different agent implementations.
 * This module provides a unified interface for tool definitions used by:
 * - VowCoachAgent (Mastra-based)
 * - AICoachService (Legacy OpenAI direct calls)
 *
 * @module agents/shared-tools
 */

// =============================================================================
// Coach Tools
// =============================================================================

export {
  // Types
  type CoachToolContext,
  type SharedCoachTool,

  // Schemas
  AnalyzeHabitsSchema,
  SuggestGoalsSchema,
  CheckProgressSchema,
  GenerateBabyStepsSchema,

  // Input Types
  type AnalyzeHabitsInput,
  type SuggestGoalsInput,
  type CheckProgressInput,
  type GenerateBabyStepsInput,

  // Output Types
  type HabitAnalysisResult,
  type GoalSuggestionResult,
  type ProgressResult,
  type BabyStepsResult,

  // Tool Execution Functions
  analyzeHabitsExecute,
  suggestGoalsExecute,
  checkProgressExecute,
  generateBabyStepsExecute,

  // Tool Definitions
  analyzeHabitsTool,
  suggestGoalsTool,
  checkProgressTool,
  generateBabyStepsTool,

  // Collections
  sharedCoachTools,
  sharedCoachToolList,

  // Utilities
  getSharedCoachTool,
} from './coach-tools.js';
