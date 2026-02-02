/**
 * Mastra Agent Module for VOW Backend
 *
 * Exports the Mastra configuration, utilities, and agents for use throughout the application.
 *
 * @module agents/mastra
 */

// Configuration
export {
  getMastra,
  getMastraConfig,
  validateMastraConfig,
  createMastraInstance,
  resetMastra,
  MASTRA_ENV_KEYS,
  DEFAULT_MASTRA_MODEL,
  type MastraConfig,
} from './config.js';

// VOW Coach Agent
export {
  VowCoachAgent,
  getVowCoachAgent,
  resetVowCoachAgent,
  getCoachSystemPrompt,
  checkQuota,
  consumeQuota,
  getOrCreateSession,
  addMessageToSession,
  clearExpiredSessions,
  analyzeHabits,
  suggestGoals,
  checkProgress,
  generateBabySteps,
  coachTools,
  // Types
  type CoachMessage,
  type CoachSession,
  type CoachExecutionContext,
  type CoachResponse,
  type CoachQuotaResult,
  type CoachTool,
  type VowCoachAgentConfig,
  type ToolCallRecord,
  // Schemas
  AnalyzeHabitsSchema,
  SuggestGoalsSchema,
  CheckProgressSchema,
  GenerateBabyStepsSchema,
  type AnalyzeHabitsInput,
  type SuggestGoalsInput,
  type CheckProgressInput,
  type GenerateBabyStepsInput,
} from './vow-coach-agent.js';

// Workflows
export {
  // Habit Analysis Workflow
  habitAnalysisWorkflow,
  executeHabitAnalysis,
  habitDataCollectionStep,
  habitPatternAnalysisStep,
  habitInsightGenerationStep,
  habitRecommendationStep,
  getCachedAnalysis,
  setCachedAnalysis,
  clearAnalysisCache,
  subscribeToProgress,
  HabitAnalysisInputSchema,
  // Workflow Types
  type WorkflowProgressEvent,
  type HabitAnalysisInput,
  type HabitAnalysisOutput,
  type HabitAnalysisState,
  type DataCollectionOutput,
  type PatternAnalysisOutput,
  type InsightGenerationOutput,
  type RecommendationOutput,
  type HabitData,
  type ActivityData,
  type TimeSlotPattern,
  type HabitCorrelation,
  type Insight,
  type Recommendation,
  type InsightReviewInput,

  // Goal Achievement Workflow
  executeGoalAchievementWorkflow,
  runGoalAchievementWorkflow,
  runGoalAssessment,
  runMilestonePlanning,
  runHabitMapping,
  runProgressTracking,
  createWorkflowContext,
  GOAL_TYPES,
  WORKFLOW_STEPS,
  GoalAchievementInputSchema,
  // Goal Achievement Types
  type GoalType,
  type WorkflowStep,
  type GoalAchievementInput,
  type GoalAssessmentResult,
  type Milestone,
  type KeyResult,
  type MilestonePlanningResult,
  type HabitSuggestion,
  type LinkedHabitAnalysis,
  type HabitMappingResult,
  type ProgressTrackingResult,
  type GoalAchievementWorkflowResult,
  type GoalAchievementContext,
} from './workflows/index.js';
