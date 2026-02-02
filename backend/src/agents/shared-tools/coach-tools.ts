/**
 * Shared Coach Tools
 *
 * Common tool definitions for AI coaching functionality.
 * Used by both VowCoachAgent (Mastra) and legacy AICoachService.
 *
 * This module provides:
 * - Zod schemas for input validation
 * - Tool definitions compatible with both Mastra and OpenAI formats
 * - Unified tool interface for gradual migration
 *
 * @module agents/shared-tools/coach-tools
 */

import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserContext } from '../../types/personalization.js';
import type { BabyStepPlan, LevelTier } from '../../types/thli.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Execution context for coach tools
 */
export interface CoachToolContext {
  userId: string;
  sessionId: string;
  supabase: SupabaseClient;
  locale?: 'ja' | 'en';
  userContext?: UserContext;
}

/**
 * Shared coach tool definition
 * Compatible with both Mastra CoachTool and OpenAI adapter
 */
export interface SharedCoachTool<TInput = unknown, TOutput = unknown> {
  /** Tool name (snake_case) */
  name: string;
  /** English description for the AI model */
  description: string;
  /** Japanese description for the AI model */
  descriptionJa: string;
  /** Zod schema for input validation */
  inputSchema: z.ZodSchema<TInput>;
  /** Tool execution function */
  execute: (input: TInput, context: CoachToolContext) => Promise<TOutput>;
}

// =============================================================================
// Schemas
// =============================================================================

/**
 * Schema for analyze_habits tool
 */
export const AnalyzeHabitsSchema = z.object({
  period: z.enum(['week', 'month', 'quarter']).default('month')
    .describe('Analysis period'),
  habitIds: z.array(z.string().uuid()).optional()
    .describe('Specific habit IDs to analyze (all if omitted)'),
  includeInsights: z.boolean().default(true)
    .describe('Include AI-generated insights'),
});

export type AnalyzeHabitsInput = z.infer<typeof AnalyzeHabitsSchema>;

/**
 * Schema for suggest_goals tool
 */
export const SuggestGoalsSchema = z.object({
  category: z.enum(['health', 'learning', 'productivity', 'relationships', 'finance', 'other'])
    .optional()
    .describe('Goal category to focus on'),
  count: z.number().int().min(1).max(5).default(3)
    .describe('Number of goals to suggest'),
  considerExisting: z.boolean().default(true)
    .describe('Consider existing habits and goals'),
});

export type SuggestGoalsInput = z.infer<typeof SuggestGoalsSchema>;

/**
 * Schema for check_progress tool
 */
export const CheckProgressSchema = z.object({
  entityType: z.enum(['habit', 'goal']).default('habit')
    .describe('Type of entity to check progress for'),
  entityId: z.string().uuid().optional()
    .describe('Specific entity ID (overall progress if omitted)'),
  period: z.enum(['day', 'week', 'month']).default('week')
    .describe('Period to check progress for'),
});

export type CheckProgressInput = z.infer<typeof CheckProgressSchema>;

/**
 * Schema for generate_baby_steps tool
 */
export const GenerateBabyStepsSchema = z.object({
  habitId: z.string().uuid()
    .describe('Habit ID to generate baby steps for'),
  currentLevel: z.number().int().min(0).max(199)
    .describe('Current habit level'),
  targetType: z.enum(['lv50', 'lv10', 'custom']).default('lv50')
    .describe('Target level type'),
  customTargetLevel: z.number().int().min(0).max(199).optional()
    .describe('Custom target level (only for custom type)'),
});

export type GenerateBabyStepsInput = z.infer<typeof GenerateBabyStepsSchema>;

// =============================================================================
// Output Types
// =============================================================================

export interface HabitAnalysisResult {
  analysis: {
    habitId: string;
    habitName: string;
    completionRate: number;
    currentStreak: number;
    longestStreak: number;
    insights: string[];
  }[];
  summary: string;
}

export interface GoalSuggestionResult {
  suggestions: {
    name: string;
    description: string;
    category: string;
    difficulty: LevelTier;
    suggestedHabits: string[];
    rationale: string;
  }[];
}

export interface ProgressResult {
  progress: {
    entityId?: string;
    entityName?: string;
    completionRate: number;
    trend: 'improving' | 'stable' | 'declining';
    periodSummary: string;
  };
  encouragement: string;
}

export interface BabyStepsResult {
  babySteps: BabyStepPlan;
  motivation: string;
}

// =============================================================================
// Tool Implementations
// =============================================================================

/**
 * Generate insights for a habit based on completion data
 */
function generateHabitInsights(
  habit: {
    completion_rate: number;
    current_streak: number;
    longest_streak: number;
  },
  locale?: 'ja' | 'en'
): string[] {
  const insights: string[] = [];
  const isJa = locale === 'ja';

  if (habit.completion_rate >= 0.9) {
    insights.push(isJa
      ? 'Excellent completion rate! This habit is fully established.'
      : 'Excellent completion rate! This habit is fully established.');
  } else if (habit.completion_rate >= 0.7) {
    insights.push(isJa
      ? 'Good progress. The habit is almost established.'
      : 'Good progress. The habit is almost established.');
  } else if (habit.completion_rate >= 0.5) {
    insights.push(isJa
      ? 'Moderate progress. Setting reminders might help.'
      : 'Moderate progress. Setting reminders might help.');
  } else if (habit.completion_rate > 0) {
    insights.push(isJa
      ? 'This habit has room for improvement. Try starting with smaller steps.'
      : 'This habit has room for improvement. Try starting with smaller steps.');
  }

  if (habit.current_streak > 0 && habit.current_streak === habit.longest_streak) {
    insights.push(isJa
      ? `Currently on a ${habit.current_streak}-day streak, your personal best!`
      : `Currently on a ${habit.current_streak}-day streak, your personal best!`);
  }

  return insights;
}

/**
 * Analyze user's habits
 */
export async function analyzeHabitsExecute(
  input: AnalyzeHabitsInput,
  context: CoachToolContext
): Promise<HabitAnalysisResult> {
  const { supabase, userId, locale } = context;

  // Get habit analysis from database
  const { data, error } = await supabase.rpc('analyze_habits_for_coach', {
    p_user_id: userId,
    p_period: input.period,
    p_habit_ids: input.habitIds ?? null,
  });

  if (error) {
    throw new Error(`Failed to analyze habits: ${error.message}`);
  }

  const analysis = (data ?? []).map((row: {
    habit_id: string;
    habit_name: string;
    completion_rate: number;
    current_streak: number;
    longest_streak: number;
  }) => ({
    habitId: row.habit_id,
    habitName: row.habit_name,
    completionRate: row.completion_rate,
    currentStreak: row.current_streak,
    longestStreak: row.longest_streak,
    insights: input.includeInsights ? generateHabitInsights(row, locale) : [],
  }));

  const averageRate = analysis.length > 0
    ? analysis.reduce((sum: number, a: { completionRate: number }) => sum + a.completionRate, 0) / analysis.length
    : 0;

  const isJa = locale === 'ja';
  const summary = isJa
    ? `${analysis.length}個の習慣を分析しました。平均達成率は${Math.round(averageRate * 100)}%です。`
    : `Analyzed ${analysis.length} habits. Average completion rate is ${Math.round(averageRate * 100)}%.`;

  return { analysis, summary };
}

/**
 * Generate goal suggestion templates
 */
async function generateGoalSuggestions(
  input: SuggestGoalsInput,
  userContext?: UserContext,
  locale?: 'ja' | 'en'
): Promise<GoalSuggestionResult['suggestions']> {
  const isJa = locale === 'ja';
  const userLevel = userContext?.userLevel ?? 'beginner';

  // Template suggestions based on category and user level
  const suggestionTemplates: Record<string, {
    name: { ja: string; en: string };
    description: { ja: string; en: string };
    difficulty: LevelTier;
    suggestedHabits: { ja: string[]; en: string[] };
    rationale: { ja: string; en: string };
  }[]> = {
    health: [
      {
        name: { ja: 'Daily 30-minute walk', en: '30-minute daily walk' },
        description: { ja: 'Light exercise habit for health', en: 'Light exercise habit for health maintenance' },
        difficulty: 'beginner',
        suggestedHabits: {
          ja: ['Walk 10 minutes after breakfast', 'Take a walk during lunch'],
          en: ['Walk 10 minutes after breakfast', 'Take a walk during lunch break'],
        },
        rationale: {
          ja: 'Beginner-friendly health goal',
          en: 'Beginner-friendly health goal',
        },
      },
      {
        name: { ja: 'Strength training 3x/week', en: 'Strength training 3x/week' },
        description: { ja: 'Muscle and fitness improvement', en: 'Muscle strength and fitness improvement' },
        difficulty: 'intermediate',
        suggestedHabits: {
          ja: ['20 squats', '10 push-ups'],
          en: ['20 squats', '10 push-ups'],
        },
        rationale: {
          ja: 'For those with existing exercise habits',
          en: 'Suitable for those with existing exercise habits',
        },
      },
    ],
    learning: [
      {
        name: { ja: 'Daily 15-minute reading', en: '15 minutes of daily reading' },
        description: { ja: 'Reading habit for knowledge', en: 'Reading habit to broaden knowledge' },
        difficulty: 'beginner',
        suggestedHabits: {
          ja: ['Read 5 pages before bed', 'Read e-books during commute'],
          en: ['Read 5 pages before bed', 'Read e-books during commute'],
        },
        rationale: {
          ja: 'Learning habit with short sessions',
          en: 'Learning habit that can start with short sessions',
        },
      },
    ],
    productivity: [
      {
        name: { ja: 'Morning task organization', en: 'Morning task organization' },
        description: { ja: 'Morning routine for efficiency', en: 'Morning routine for an efficient day' },
        difficulty: 'beginner',
        suggestedHabits: {
          ja: ['Create to-do list after waking', 'Decide 3 priority tasks'],
          en: ['Create a to-do list after waking up', 'Decide on 3 priority tasks'],
        },
        rationale: {
          ja: 'Foundation for productivity',
          en: 'Foundational habit for productivity improvement',
        },
      },
    ],
  };

  const category = input.category ?? 'health';
  const templates = suggestionTemplates[category] ?? suggestionTemplates['health'] ?? [];

  // Filter by user level and limit count
  const filtered = templates
    .filter(t => {
      if (userLevel === 'beginner') return t.difficulty === 'beginner';
      if (userLevel === 'intermediate') return t.difficulty !== 'advanced';
      return true;
    })
    .slice(0, input.count);

  return filtered.map(t => ({
    name: isJa ? t.name.ja : t.name.en,
    description: isJa ? t.description.ja : t.description.en,
    category,
    difficulty: t.difficulty,
    suggestedHabits: isJa ? t.suggestedHabits.ja : t.suggestedHabits.en,
    rationale: isJa ? t.rationale.ja : t.rationale.en,
  }));
}

/**
 * Suggest goals for the user
 */
export async function suggestGoalsExecute(
  input: SuggestGoalsInput,
  context: CoachToolContext
): Promise<GoalSuggestionResult> {
  const { locale, userContext } = context;

  const suggestions = await generateGoalSuggestions(input, userContext, locale);

  return { suggestions };
}

/**
 * Check progress on habits or goals
 */
export async function checkProgressExecute(
  input: CheckProgressInput,
  context: CoachToolContext
): Promise<ProgressResult> {
  const { supabase, userId, locale } = context;
  const isJa = locale === 'ja';

  // Get progress data from database
  const { data, error } = await supabase.rpc('get_progress_summary', {
    p_user_id: userId,
    p_entity_type: input.entityType,
    p_entity_id: input.entityId ?? null,
    p_period: input.period,
  });

  if (error) {
    throw new Error(`Failed to check progress: ${error.message}`);
  }

  const progressData = data?.[0] ?? {
    entity_id: null,
    entity_name: null,
    completion_rate: 0,
    previous_rate: 0,
  };

  const currentRate = progressData.completion_rate ?? 0;
  const previousRate = progressData.previous_rate ?? 0;
  const trend: 'improving' | 'stable' | 'declining' =
    currentRate > previousRate + 0.05 ? 'improving' :
    currentRate < previousRate - 0.05 ? 'declining' : 'stable';

  const periodLabels: Record<string, { ja: string; en: string }> = {
    day: { ja: 'today', en: 'Today' },
    week: { ja: 'this week', en: 'This week' },
    month: { ja: 'this month', en: 'This month' },
  };

  const periodLabel = periodLabels[input.period] ?? { ja: 'this week', en: 'This week' };
  const periodSummary = isJa
    ? `${periodLabel.ja}'s completion rate is ${Math.round(currentRate * 100)}%.`
    : `${periodLabel.en}'s completion rate is ${Math.round(currentRate * 100)}%.`;

  const encouragementTexts = {
    improving: {
      ja: 'You are making great progress! Keep it up.',
      en: 'You are making great progress! Keep it up.',
    },
    stable: {
      ja: 'You are maintaining a steady pace.',
      en: 'You are maintaining a steady pace.',
    },
    declining: {
      ja: 'Things have slowed down, but let\'s keep going!',
      en: 'Things have slowed down a bit, but let\'s keep going!',
    },
  } as const;

  const encouragementText = encouragementTexts[trend];

  return {
    progress: {
      entityId: progressData.entity_id,
      entityName: progressData.entity_name,
      completionRate: currentRate,
      trend,
      periodSummary,
    },
    encouragement: isJa ? encouragementText.ja : encouragementText.en,
  };
}

/**
 * Generate baby steps for a habit
 */
export async function generateBabyStepsExecute(
  input: GenerateBabyStepsInput,
  context: CoachToolContext
): Promise<BabyStepsResult> {
  const { supabase, userId, locale } = context;
  const isJa = locale === 'ja';

  // Calculate target level
  let targetLevel: number;
  if (input.targetType === 'lv50') {
    targetLevel = Math.floor(input.currentLevel * 0.5);
  } else if (input.targetType === 'lv10') {
    targetLevel = 10;
  } else {
    targetLevel = input.customTargetLevel ?? Math.floor(input.currentLevel * 0.5);
  }

  // Get habit details
  const { data: habit, error } = await supabase
    .from('habits')
    .select('name, frequency, target_count, workload_unit')
    .eq('id', input.habitId)
    .eq('user_id', userId)
    .single();

  if (error || !habit) {
    throw new Error(`Habit not found: ${input.habitId}`);
  }

  // Generate baby step plan
  const babySteps: BabyStepPlan = {
    targetLevel,
    name: isJa
      ? `${habit.name} (Simplified)`
      : `${habit.name} (Simplified)`,
    changes: [
      {
        variableId: '⑱',
        variableName: isJa ? 'Frequency' : 'Frequency',
        currentValue: habit.frequency,
        newValue: habit.frequency === 'daily' ? 'weekly' : habit.frequency,
        pointsReduced: 2.8,
        rationale: isJa ? 'Reduce frequency to lower load' : 'Reduce frequency to lower load',
      },
    ],
    workloadChanges: {
      frequency: {
        old: habit.frequency,
        new: habit.frequency === 'daily' ? '3x/week' : habit.frequency,
      },
      targetCount: {
        old: habit.target_count ?? 1,
        new: Math.max(1, Math.floor((habit.target_count ?? 1) / 2)),
      },
    },
    explanation: isJa
      ? `Reduced frequency and target for ${habit.name} to make it easier. Start with this small step.`
      : `We reduced the frequency and target count for ${habit.name} to make it easier to start. Begin with this small step.`,
    estimatedDifficulty: isJa
      ? `About ${Math.round((targetLevel / input.currentLevel) * 100)}% of current load`
      : `About ${Math.round((targetLevel / input.currentLevel) * 100)}% of current load`,
  };

  const motivation = isJa
    ? 'Starting small ensures you can build the habit. Prioritize consistency over perfection.'
    : 'Starting with small steps ensures you can build the habit successfully. Prioritize consistency over perfection.';

  return { babySteps, motivation };
}

// =============================================================================
// Shared Tool Definitions
// =============================================================================

/**
 * Analyze habits tool definition
 */
export const analyzeHabitsTool: SharedCoachTool<AnalyzeHabitsInput, HabitAnalysisResult> = {
  name: 'analyze_habits',
  description: 'Analyze user habit patterns and completion rates. Provides insights and recommendations.',
  descriptionJa: 'User habit patterns and completion rates analysis. Provides insights and recommendations.',
  inputSchema: AnalyzeHabitsSchema as z.ZodSchema<AnalyzeHabitsInput>,
  execute: analyzeHabitsExecute,
};

/**
 * Suggest goals tool definition
 */
export const suggestGoalsTool: SharedCoachTool<SuggestGoalsInput, GoalSuggestionResult> = {
  name: 'suggest_goals',
  description: 'Suggest personalized goals based on user context and preferences.',
  descriptionJa: 'Suggest personalized goals based on user context and preferences.',
  inputSchema: SuggestGoalsSchema as z.ZodSchema<SuggestGoalsInput>,
  execute: suggestGoalsExecute,
};

/**
 * Check progress tool definition
 */
export const checkProgressTool: SharedCoachTool<CheckProgressInput, ProgressResult> = {
  name: 'check_progress',
  description: 'Check progress on habits or goals over a specified period.',
  descriptionJa: 'Check progress on habits or goals over a specified period.',
  inputSchema: CheckProgressSchema as z.ZodSchema<CheckProgressInput>,
  execute: checkProgressExecute,
};

/**
 * Generate baby steps tool definition
 */
export const generateBabyStepsTool: SharedCoachTool<GenerateBabyStepsInput, BabyStepsResult> = {
  name: 'generate_baby_steps',
  description: 'Generate simplified versions of habits to make them easier to start.',
  descriptionJa: 'Generate simplified habit versions to make them easier to start.',
  inputSchema: GenerateBabyStepsSchema as z.ZodSchema<GenerateBabyStepsInput>,
  execute: generateBabyStepsExecute,
};

// =============================================================================
// Tool Collections
// =============================================================================

/**
 * All shared coach tools as an object
 */
export const sharedCoachTools = {
  analyzeHabits: analyzeHabitsTool,
  suggestGoals: suggestGoalsTool,
  checkProgress: checkProgressTool,
  generateBabySteps: generateBabyStepsTool,
} as const;

/**
 * All shared coach tools as an array
 */
export const sharedCoachToolList: SharedCoachTool<unknown, unknown>[] = [
  analyzeHabitsTool as SharedCoachTool<unknown, unknown>,
  suggestGoalsTool as SharedCoachTool<unknown, unknown>,
  checkProgressTool as SharedCoachTool<unknown, unknown>,
  generateBabyStepsTool as SharedCoachTool<unknown, unknown>,
];

/**
 * Get a shared coach tool by name
 */
export function getSharedCoachTool(name: string): SharedCoachTool | undefined {
  return sharedCoachToolList.find(t => t.name === name);
}
