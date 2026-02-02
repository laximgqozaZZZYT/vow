/**
 * Mastra Workflows Module
 *
 * Exports all Mastra workflows for the VOW backend.
 *
 * @module agents/mastra/workflows
 */

// Habit Analysis Workflow
export {
  // Workflow
  habitAnalysisWorkflow,
  executeHabitAnalysis,

  // Steps
  habitDataCollectionStep,
  habitPatternAnalysisStep,
  habitInsightGenerationStep,
  habitRecommendationStep,

  // Cache Management
  getCachedAnalysis,
  setCachedAnalysis,
  clearAnalysisCache,

  // Progress Events
  subscribeToProgress,
  type WorkflowProgressEvent,

  // Types
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

  // Schemas
  HabitAnalysisInputSchema,
} from './habit-analysis.js';

// Goal Achievement Workflow
export {
  // Main workflow executor
  executeGoalAchievementWorkflow,
  runGoalAchievementWorkflow,

  // Individual steps
  runGoalAssessment,
  runMilestonePlanning,
  runHabitMapping,
  runProgressTracking,

  // Utility functions
  createWorkflowContext,

  // Constants
  GOAL_TYPES,
  WORKFLOW_STEPS,

  // Schemas
  GoalAchievementInputSchema,

  // Types
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
} from './goal-achievement.js';
