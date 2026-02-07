/**
 * Shared Agent Tools
 *
 * Common tool definitions and utilities shared between different agent implementations.
 * This module provides a unified interface for tool definitions used by:
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
  SuggestHabitsSchema,
  SuggestStickyNSchema,
  CheckProgressSchema,
  GenerateBabyStepsSchema,
  GenerateAdviceSchema,
  ShowCategorySelectionSchema,
  ShowHabitSelectionSchema,
  ShowGoalSelectionSchema,
  RefineSuggestionsSchema,
  SuggestHabitImprovementsSchema,
  ShowChoiceButtonsSchema,

  // Input Types
  type AnalyzeHabitsInput,
  type SuggestGoalsInput,
  type SuggestHabitsInput,
  type SuggestStickyNInput,
  type CheckProgressInput,
  type GenerateBabyStepsInput,
  type GenerateAdviceInput,
  type ShowCategorySelectionInput,
  type ShowHabitSelectionInput,
  type ShowGoalSelectionInput,
  type RefineSuggestionsInput,
  type SuggestHabitImprovementsInput,
  type ShowChoiceButtonsInput,

  // Output Types
  type HabitAnalysisResult,
  type GoalSuggestionResult,
  type HabitSuggestionResult,
  type StickyNSuggestionResult,
  type ProgressResult,
  type BabyStepsResult,
  type AdviceResult,
  type CategorySelectionResult,
  type HabitSelectionResult,
  type GoalSelectionResult,
  type RefinementResult,
  type HabitImprovementResult,
  type ChoiceButtonsResult,

  // Tool Execution Functions
  analyzeHabitsExecute,
  suggestGoalsExecute,
  suggestHabitsExecute,
  checkProgressExecute,
  generateBabyStepsExecute,
  generateAdviceExecute,
  showCategorySelectionExecute,
  showHabitSelectionExecute,
  showGoalSelectionExecute,
  refineSuggestionsExecute,
  suggestHabitImprovementsExecute,
  showChoiceButtonsExecute,

  // Tool Definitions
  analyzeHabitsTool,
  suggestGoalsTool,
  suggestHabitsTool,
  checkProgressTool,
  generateBabyStepsTool,
  generateAdviceTool,
  showCategorySelectionTool,
  showHabitSelectionTool,
  showGoalSelectionTool,
  refineSuggestionsTool,
  suggestHabitImprovementsTool,
  showChoiceButtonsTool,

  // Collections
  sharedCoachTools,
  sharedCoachToolList,

  // Utilities
  getSharedCoachTool,
} from './coach-tools.js';

// =============================================================================
// Tool Configuration
// =============================================================================

export {
  // Category Constants
  HABIT_CATEGORIES,
  GOAL_CATEGORIES,
  ANALYSIS_PERIODS,
  DIFFICULTY_LEVELS,
  FREQUENCY_OPTIONS,

  // Category Types
  type HabitCategory,
  type GoalCategory,
  type AnalysisPeriod,
  type DifficultyLevel,
  type FrequencyOption,

  // Japanese Labels
  HABIT_CATEGORY_LABELS_JA,
  GOAL_CATEGORY_LABELS_JA,
} from './tool-config.js';

// =============================================================================
// Response Transformer
// =============================================================================

export {
  // Transformation Functions
  transformCategorySelectionResult,
  transformHabitSuggestionResult,
  transformGoalSuggestionResult,
  transformStickyNSuggestionResult,
  transformChoiceButtonsResult,
  transformToolOutput,
} from './response-transformer.js';
