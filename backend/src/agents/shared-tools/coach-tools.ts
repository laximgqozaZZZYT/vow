/**
 * Shared Coach Tools
 *
 * Common tool definitions for AI coaching functionality.
 * Used by AICoachService.
 *
 * This module provides:
 * - Zod schemas for input validation
 * - Tool definitions compatible with OpenAI format
 * - Unified tool interface for gradual migration
 *
 * @module agents/shared-tools/coach-tools
 */

import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import type { UserContext } from '../../types/personalization.js';
import type { BabyStepPlan, LevelTier } from '../../types/thli.js';
import {
  HABIT_CATEGORIES,
  GOAL_CATEGORIES,
  STICKYN_CATEGORIES,
  ANALYSIS_PERIODS,
} from './tool-config.js';
import { getSettings } from '../../config.js';
import { getLogger } from '../../utils/logger.js';

const logger = getLogger('coach-tools');

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
  /** OpenAI API key (optional, falls back to settings if not provided) */
  openaiApiKey?: string;
}

/**
 * Shared coach tool definition
 * Compatible with OpenAI adapter
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
 * Helper to handle null values from OpenAI function calling
 * OpenAI sometimes sends null for optional fields instead of omitting them
 */
const nullableOptionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess(
    (val) => (val === null ? undefined : val),
    z.enum(values).optional()
  );

/**
 * Schema for analyze_habits tool
 */
export const AnalyzeHabitsSchema = z.object({
  period: nullableOptionalEnum(ANALYSIS_PERIODS).default('month')
    .describe('Analysis period (day, week, month, quarter, year)'),
  habitIds: z.preprocess(
    (val) => (val === null ? undefined : val),
    z.array(z.string().uuid()).optional()
  ).describe('Specific habit IDs to analyze (all if omitted)'),
  includeInsights: z.boolean().default(true)
    .describe('Include AI-generated insights'),
});

export type AnalyzeHabitsInput = z.infer<typeof AnalyzeHabitsSchema>;

/**
 * Schema for suggest_goals tool
 * Uses expanded category list from tool-config.ts
 */
export const SuggestGoalsSchema = z.object({
  category: nullableOptionalEnum(GOAL_CATEGORIES)
    .describe('Goal category to focus on (health, fitness, learning, career, finance, relationships, etc.)'),
  count: z.number().int().min(1).max(10).default(3)
    .describe('Number of goals to suggest (1-10)'),
  considerExisting: z.boolean().default(true)
    .describe('Consider existing habits and goals'),
});

export type SuggestGoalsInput = z.infer<typeof SuggestGoalsSchema>;

/**
 * Schema for suggest_habits tool
 * Uses expanded category list from tool-config.ts
 */
export const SuggestHabitsSchema = z.object({
  category: nullableOptionalEnum(HABIT_CATEGORIES)
    .describe('Habit category to focus on (health, fitness, productivity, learning, wellness, mindfulness, etc.)'),
  count: z.number().int().min(1).max(10).default(3)
    .describe('Number of habits to suggest (1-10)'),
  considerExisting: z.boolean().default(true)
    .describe('Consider existing habits and goals'),
});

export type SuggestHabitsInput = z.infer<typeof SuggestHabitsSchema>;

/**
 * Schema for suggest_stickyn tool
 * Used to suggest Sticky'n (memo/note) content for users
 */
export const SuggestStickyNSchema = z.object({
  category: nullableOptionalEnum(STICKYN_CATEGORIES)
    .describe('Sticky\'n category to focus on (idea, task, learning, gratitude, etc.)'),
  count: z.number().int().min(1).max(5).default(3)
    .describe('Number of Sticky\'n suggestions to return (1-5)'),
  context: z.string().optional()
    .describe('Additional context for more personalized suggestions'),
  relatedTo: z.enum(['habit', 'goal', 'general']).optional()
    .describe('What the Sticky\'n should be related to'),
});

export type SuggestStickyNInput = z.infer<typeof SuggestStickyNSchema>;

/**
 * Schema for check_progress tool
 */
export const CheckProgressSchema = z.object({
  entityType: z.preprocess(
    (val) => (val === null ? undefined : val),
    z.enum(['habit', 'goal']).default('habit')
  ).describe('Type of entity to check progress for'),
  entityId: z.preprocess(
    (val) => (val === null ? undefined : val),
    z.string().uuid().optional()
  ).describe('Specific entity ID (overall progress if omitted)'),
  period: nullableOptionalEnum(ANALYSIS_PERIODS).default('week')
    .describe('Period to check progress for (day, week, month, quarter, year)'),
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

/**
 * Schema for show_category_selection tool
 * Used when user request is vague and needs to select a category first
 */
export const ShowCategorySelectionSchema = z.object({
  selectionType: z.enum(['habit_category', 'goal_category', 'difficulty']).default('habit_category')
    .describe('Type of selection to show'),
  message: z.string()
    .describe('Message to show with the category buttons'),
});

export type ShowCategorySelectionInput = z.infer<typeof ShowCategorySelectionSchema>;

/**
 * Schema for refine_suggestions tool
 * Used to show more specific, easier, or harder suggestions
 */
export const RefineSuggestionsSchema = z.object({
  currentCategory: z.string()
    .describe('Current category of suggestions'),
  refinementType: z.enum(['more_specific', 'more_general', 'easier', 'harder', 'different'])
    .describe('Type of refinement requested'),
  currentDifficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional()
    .describe('Current difficulty level'),
  specificityLevel: z.number().int().min(0).max(3).optional()
    .describe('Specificity level (0=very broad, 1=normal, 2=detailed, 3=very detailed)'),
  excludeSuggestionNames: z.array(z.string()).optional()
    .describe('List of suggestion names to exclude from results (used to show different suggestions)'),
});

export type RefineSuggestionsInput = z.infer<typeof RefineSuggestionsSchema>;

/**
 * Schema for show_habit_selection tool
 * Used when asking about specific habits - shows user's existing habits as buttons
 */
export const ShowHabitSelectionSchema = z.object({
  message: z.string()
    .describe('Message to show with the habit selection buttons'),
  includeAll: z.boolean().default(true)
    .describe('Include "全ての習慣" option'),
  maxItems: z.number().int().min(1).max(20).default(10)
    .describe('Maximum number of habits to show'),
});

export type ShowHabitSelectionInput = z.infer<typeof ShowHabitSelectionSchema>;

/**
 * Schema for show_goal_selection tool
 * Used when asking about specific goals - shows user's existing goals as buttons
 */
export const ShowGoalSelectionSchema = z.object({
  message: z.string()
    .describe('Message to show with the goal selection buttons'),
  includeAll: z.boolean().default(true)
    .describe('Include "全ての目標" option'),
  maxItems: z.number().int().min(1).max(20).default(10)
    .describe('Maximum number of goals to show'),
});

export type ShowGoalSelectionInput = z.infer<typeof ShowGoalSelectionSchema>;

/**
 * Schema for generate_advice tool
 * Used when user asks "アドバイスして" or similar vague advice requests
 * Generates creative, personalized advice each time
 */
export const GenerateAdviceSchema = z.object({
  adviceType: z.enum(['general', 'motivation', 'strategy', 'recovery', 'celebration']).default('general')
    .describe('Type of advice to generate: general (overall coaching), motivation (boost motivation), strategy (improve approach), recovery (when failing), celebration (acknowledge success)'),
  focusArea: z.preprocess(
    (val) => (val === null ? undefined : val),
    z.string().optional()
  ).describe('Specific area to focus advice on (e.g., habit name, goal name, or category)'),
  userMood: z.preprocess(
    (val) => (val === null ? undefined : val),
    z.enum(['positive', 'neutral', 'struggling', 'uncertain']).optional()
  ).describe('Current user mood detected from conversation'),
  creativityLevel: z.number().min(1).max(3).default(2)
    .describe('Creativity level: 1=conservative, 2=balanced, 3=highly creative'),
});

export type GenerateAdviceInput = z.infer<typeof GenerateAdviceSchema>;

/**
 * Schema for suggest_habit_improvements tool
 * Used when user wants to improve their existing habits
 * Shows habits and generates improvement suggestions for selected habit
 */
export const SuggestHabitImprovementsSchema = z.object({
  habitId: z.preprocess(
    (val) => (val === null ? undefined : val),
    z.string().uuid().optional()
  ).describe('Specific habit ID to improve (if known). If not provided, will show habit selection.'),
  improvementFocus: z.preprocess(
    (val) => (val === null ? undefined : val),
    z.enum(['efficiency', 'consistency', 'difficulty', 'engagement', 'general']).optional().default('general')
  ).describe('Focus area for improvement: efficiency=make it faster/easier, consistency=improve completion rate, difficulty=adjust challenge level, engagement=make it more enjoyable, general=overall improvement'),
  maxSuggestions: z.number().int().min(1).max(5).default(3)
    .describe('Maximum number of improvement suggestions to generate'),
});

export type SuggestHabitImprovementsInput = z.infer<typeof SuggestHabitImprovementsSchema>;

/**
 * Button type definitions for semantic categorization
 * 【重要】ボタンの種類を明示的に指定する
 * - habit: Habit候補ボタン（習慣追加・編集用）- 習慣追加要求時に必須
 * - goal: Goal候補ボタン（目標設定用）- Goal設定要求時に必須
 * - category: カテゴリ選択ボタン（健康、学習など）
 * - text: テキスト入力促進ボタン
 * - reply: 汎用返答ボタン
 * - action: アクション実行ボタン
 */
export const SuggestionButtonTypeEnum = z.enum(['habit', 'goal', 'category', 'text', 'reply', 'action']);
export type SuggestionButtonType = z.infer<typeof SuggestionButtonTypeEnum>;

/**
 * Schema for show_choice_buttons tool
 * 【最重要】テキストで選択肢を列挙する代わりに、必ずこのツールでボタン形式で表示する
 * 例: 「散歩」「ストレッチ」「ウォーキング」などの選択肢をボタンとして表示
 *
 * ボタンタイプの使い分け:
 * - 習慣追加要求 → type: 'habit' を使用
 * - Goal設定要求 → type: 'goal' を使用
 * - カテゴリ選択 → type: 'category' を使用
 */
export const ShowChoiceButtonsSchema = z.object({
  title: z.string()
    .describe('選択肢のタイトル（例: どんな運動に興味がありますか？）'),
  choices: z.array(z.object({
    id: z.string().describe('選択肢のID（英語、スネークケース推奨）'),
    label: z.string().describe('選択肢のラベル（日本語OK）'),
    type: SuggestionButtonTypeEnum.optional().default('reply')
      .describe('ボタンの種類（habit/goal/category/text/reply/action）【重要】習慣追加要求にはhabit型、Goal設定要求にはgoal型を必ず使用'),
    icon: z.string().optional().describe('絵文字アイコン（例: 🚶）'),
    description: z.string().optional().describe('選択肢の説明（任意）'),
  })).min(2).max(6)
    .describe('選択肢の配列（2-6個）'),
  layout: z.enum(['vertical', 'horizontal', 'grid']).optional()
    .describe('ボタンのレイアウト（デフォルト: 選択肢数に応じて自動判定）'),
  size: z.enum(['sm', 'md', 'lg']).optional()
    .describe('ボタンサイズ（デフォルト: md）'),
});

export type ShowChoiceButtonsInput = z.infer<typeof ShowChoiceButtonsSchema>;

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
    suggestedHabits?: string[];
    rationale?: string;
    deadline?: string;
    milestones?: Array<{
      name: string;
      description?: string;
      targetDate?: string;
    }>;
    /** Estimated time to achieve the goal (e.g., "3ヶ月", "6 months") */
    estimatedDuration?: string;
    /** Type of suggestion button */
    suggestionType: 'goal' | 'habit' | 'stickyn' | 'reply';
  }[];
  /** Follow-up action buttons for refining suggestions */
  followUpActions?: {
    id: string;
    label: string;
    action: 'more_specific' | 'more_general' | 'easier' | 'harder' | 'different';
    category: string;
  }[];
}

export interface HabitSuggestionResult {
  suggestions: {
    name: string;
    type?: 'do' | 'avoid';
    description: string;
    category: string;
    difficulty: LevelTier;
    frequency?: 'daily' | 'weekly' | '3x/week' | string;
    reason?: string;
    targetCount?: number;
    workloadUnit?: string;
    triggerTime?: string;
    anchorHabit?: string;
    /** Estimated time per execution (e.g., "5分", "5 min") */
    estimatedTime?: string;
    /** Estimated time to establish the habit (e.g., "2週間", "2 weeks") */
    estimatedDuration?: string;
    rationale?: string;
    /** Type of suggestion button */
    suggestionType: 'goal' | 'habit' | 'stickyn' | 'reply';
  }[];
  /** Follow-up action buttons for refining suggestions */
  followUpActions?: {
    id: string;
    label: string;
    action: 'more_specific' | 'more_general' | 'easier' | 'harder' | 'different';
    category: string;
  }[];
}

/**
 * Sticky'n suggestion result structure
 * Used for memo/note-type suggestions
 */
export interface StickyNSuggestionResult {
  suggestions: {
    /** Title of the Sticky'n */
    name: string;
    /** Content/body of the Sticky'n */
    content: string;
    /** Category of the Sticky'n */
    category: string;
    /** Icon emoji for the Sticky'n */
    icon: string;
    /** Color theme for the Sticky'n */
    color: 'yellow' | 'blue' | 'green' | 'pink' | 'purple';
    /** Rationale/purpose for this Sticky'n */
    rationale: string;
    /** Type of suggestion button */
    suggestionType: 'stickyn';
  }[];
  /** Follow-up action buttons for refining suggestions */
  followUpActions?: {
    id: string;
    label: string;
    action: 'more_specific' | 'more_general' | 'easier' | 'harder' | 'different';
    category: string;
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

/**
 * Result for habit selection tool
 */
export interface HabitSelectionResult {
  message: string;
  quickReplies: {
    id: string;
    label: string;
    value: string;
    icon: string;
  }[];
}

/**
 * Result for goal selection tool
 */
export interface GoalSelectionResult {
  message: string;
  quickReplies: {
    id: string;
    label: string;
    value: string;
    icon: string;
  }[];
}

/**
 * Result for generate_advice tool
 * Contains personalized, creative advice with follow-up options
 */
export interface AdviceResult {
  /** Main advice content - different each time */
  advice: string;
  /** Key insight or tip */
  keyInsight: string;
  /** Motivational message tailored to user's situation */
  motivation: string;
  /** Practical action steps */
  actionSteps: string[];
  /** Relevant quote or wisdom (randomly selected) */
  wisdomQuote?: string | undefined;
  /** Advice type that was generated */
  adviceType: 'general' | 'motivation' | 'strategy' | 'recovery' | 'celebration';
  /** Follow-up action buttons */
  followUpActions: {
    id: string;
    label: string;
    action: 'more_advice' | 'deeper' | 'different_angle' | 'action_plan';
  }[];
}

/**
 * Result for suggest_habit_improvements tool
 * Contains improvement suggestions for an existing habit
 */
export interface HabitImprovementResult {
  /** The habit being improved */
  habit: {
    id: string;
    name: string;
    currentCompletionRate: number;
    currentStreak: number;
    frequency: string;
    level?: number;
  };
  /** Summary of current habit status */
  statusSummary: string;
  /** Improvement suggestions */
  improvements: {
    id: string;
    title: string;
    description: string;
    category: 'efficiency' | 'consistency' | 'difficulty' | 'engagement' | 'general';
    impact: 'high' | 'medium' | 'low';
    effort: 'easy' | 'moderate' | 'challenging';
    rationale: string;
    /** Concrete action steps to implement this improvement */
    actionSteps: string[];
    /** Type of suggestion button */
    suggestionType: 'reply';
  }[];
  /** Follow-up action buttons */
  followUpActions: {
    id: string;
    label: string;
    action: 'apply_improvement' | 'more_suggestions' | 'different_habit';
  }[];
  /** Quick replies for habit selection (if no habitId was provided) */
  quickReplies?: {
    id: string;
    label: string;
    value: string;
    icon: string;
  }[];
}

/**
 * Result for show_choice_buttons tool
 * Returns UI component data for frontend to render as buttons
 */
export interface ChoiceButtonsResult {
  type: 'ui_component';
  component: 'choice_buttons';
  data: {
    title: string;
    choices: {
      id: string;
      label: string;
      icon: string;
      description?: string;
    }[];
    layout: 'vertical' | 'horizontal' | 'grid';
    size: 'sm' | 'md' | 'lg';
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Simple string similarity check using Levenshtein-like comparison
 * Returns true if the names are too similar (>= 70% match)
 */
function isSimilarToExisting(newName: string, existingNames: string[]): boolean {
  if (existingNames.length === 0) return false;

  const normalizedNew = newName.toLowerCase().replace(/[\s　]+/g, '');

  for (const existing of existingNames) {
    const normalizedExisting = existing.toLowerCase().replace(/[\s　]+/g, '');

    // Check for exact match or substring match
    if (normalizedNew === normalizedExisting) return true;
    if (normalizedNew.includes(normalizedExisting) || normalizedExisting.includes(normalizedNew)) return true;

    // Check for high similarity (simple character overlap)
    const shorter = normalizedNew.length < normalizedExisting.length ? normalizedNew : normalizedExisting;
    const longer = normalizedNew.length < normalizedExisting.length ? normalizedExisting : normalizedNew;
    let matches = 0;
    for (const char of shorter) {
      if (longer.includes(char)) matches++;
    }
    const similarity = matches / shorter.length;
    if (similarity >= 0.7) return true;
  }

  return false;
}

/**
 * Generate personalized rationale based on user context
 */
function generatePersonalizedRationale(
  baseRationale: string,
  userContext: UserContext | undefined,
  isJa: boolean
): string {
  if (!userContext) return baseRationale;

  const { activeHabitCount, averageCompletionRate, anchorHabits } = userContext;

  // Add personalization based on user's situation
  let personalizedPart = '';

  if (activeHabitCount === 0) {
    personalizedPart = isJa
      ? '初めての習慣として最適です。'
      : 'Great as your first habit.';
  } else if (averageCompletionRate >= 0.8) {
    personalizedPart = isJa
      ? `現在の達成率${Math.round(averageCompletionRate * 100)}%を維持しながら新しい挑戦を。`
      : `Challenge yourself while maintaining your ${Math.round(averageCompletionRate * 100)}% completion rate.`;
  } else if (averageCompletionRate < 0.5) {
    personalizedPart = isJa
      ? '小さく始めて確実に習慣化しましょう。'
      : 'Start small and establish the habit surely.';
  }

  // Add anchor habit suggestion if available
  if (anchorHabits && anchorHabits.length > 0) {
    const topAnchor = anchorHabits[0];
    if (topAnchor) {
      const anchorPart = isJa
        ? `「${topAnchor.habitName}」の後に組み合わせると効果的です。`
        : `Try combining it after "${topAnchor.habitName}" for better results.`;
      personalizedPart = personalizedPart ? `${personalizedPart} ${anchorPart}` : anchorPart;
    }
  }

  return personalizedPart ? `${baseRationale} ${personalizedPart}` : baseRationale;
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

// =============================================================================
// Category Mapping
// =============================================================================

/**
 * Maps detailed categories to main suggestion template categories.
 * This ensures that selecting any category returns relevant suggestions
 * instead of always falling back to 'health'.
 */
const CATEGORY_TO_TEMPLATE_MAPPING: Record<string, string> = {
  // Health & Physical - map to health
  health: 'health',
  nutrition: 'health',
  sleep: 'health',
  exercise: 'fitness',
  weight: 'health',

  // Fitness - map to fitness
  fitness: 'fitness',

  // Mental & Emotional - map to wellness/mindfulness
  wellness: 'wellness',
  mindfulness: 'mindfulness',
  mental_health: 'wellness',
  stress_management: 'wellness',

  // Productivity & Work - map to productivity
  productivity: 'productivity',
  time_management: 'productivity',
  focus: 'productivity',
  organization: 'productivity',
  work: 'productivity',
  projects: 'productivity',

  // Learning & Growth - map to learning
  learning: 'learning',
  reading: 'learning',
  skills: 'learning',
  creativity: 'learning',
  education: 'learning',
  certifications: 'learning',

  // Social & Relationships - map to relationships
  relationships: 'relationships',
  social: 'relationships',
  communication: 'relationships',
  family: 'relationships',
  networking: 'relationships',

  // Finance & Career - map to finance or career
  finance: 'finance',
  career: 'career',
  savings: 'finance',
  investment: 'finance',
  business: 'career',

  // Lifestyle - map to lifestyle
  lifestyle: 'lifestyle',
  hobbies: 'hobbies',
  self_care: 'wellness',
  morning_routine: 'lifestyle',
  evening_routine: 'lifestyle',
  travel: 'lifestyle',
  home: 'lifestyle',

  // Other
  other: 'other',
};

/**
 * Get the template category for a given category
 */
function getTemplateCategoryForGoal(category: string): string {
  return CATEGORY_TO_TEMPLATE_MAPPING[category] ?? category;
}

function getTemplateCategoryForHabit(category: string): string {
  return CATEGORY_TO_TEMPLATE_MAPPING[category] ?? category;
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
  const existingHabitNames = userContext?.existingHabitNames ?? [];

  // Template suggestions based on category and user level
  const suggestionTemplates: Record<string, {
    name: { ja: string; en: string };
    description: { ja: string; en: string };
    difficulty: LevelTier;
    suggestedHabits: { ja: string[]; en: string[] };
    rationale: { ja: string; en: string };
    estimatedDuration: { ja: string; en: string };
  }[]> = {
    health: [
      {
        name: { ja: '毎日ウォーキング', en: 'Daily walk' },
        description: { ja: '健康維持のための軽い運動習慣', en: 'Light exercise habit for health maintenance' },
        difficulty: 'beginner',
        suggestedHabits: {
          ja: ['朝食後10分歩く', '昼休みに散歩する'],
          en: ['Walk 10 minutes after breakfast', 'Take a walk during lunch break'],
        },
        rationale: {
          ja: '初心者向けの健康目標',
          en: 'Beginner-friendly health goal',
        },
        estimatedDuration: { ja: '1〜2ヶ月', en: '1-2 months' },
      },
      {
        name: { ja: '週3回の筋力トレーニング', en: 'Strength training 3x/week' },
        description: { ja: '筋力とフィットネスの向上', en: 'Muscle strength and fitness improvement' },
        difficulty: 'intermediate',
        suggestedHabits: {
          ja: ['スクワット20回', '腕立て伏せ10回'],
          en: ['20 squats', '10 push-ups'],
        },
        rationale: {
          ja: '既存の運動習慣がある方向け',
          en: 'Suitable for those with existing exercise habits',
        },
        estimatedDuration: { ja: '2〜3ヶ月', en: '2-3 months' },
      },
      {
        name: { ja: '毎日8時間の睡眠確保', en: 'Get 8 hours of sleep daily' },
        description: { ja: '十分な睡眠で健康的な生活を', en: 'Healthy life with adequate sleep' },
        difficulty: 'beginner',
        suggestedHabits: {
          ja: ['22時にスマホをオフ', '起床時間を固定'],
          en: ['Turn off phone at 10 PM', 'Fixed wake-up time'],
        },
        rationale: {
          ja: '睡眠は健康の基盤',
          en: 'Sleep is the foundation of health',
        },
        estimatedDuration: { ja: '2〜4週間', en: '2-4 weeks' },
      },
      {
        name: { ja: '1日2リットルの水分摂取', en: 'Drink 2 liters of water daily' },
        description: { ja: '適切な水分補給で代謝向上', en: 'Improve metabolism with proper hydration' },
        difficulty: 'beginner',
        suggestedHabits: {
          ja: ['起床後にコップ1杯の水', '食事前に水を飲む'],
          en: ['Glass of water after waking', 'Drink water before meals'],
        },
        rationale: {
          ja: 'シンプルで効果的な健康習慣',
          en: 'Simple and effective health habit',
        },
        estimatedDuration: { ja: '1〜2週間', en: '1-2 weeks' },
      },
    ],
    fitness: [
      {
        name: { ja: '週4回のジムトレーニング', en: 'Gym training 4x/week' },
        description: { ja: '本格的なフィットネス習慣を構築', en: 'Build a serious fitness routine' },
        difficulty: 'intermediate',
        suggestedHabits: {
          ja: ['ジムバッグを前日に準備', '運動後にプロテイン'],
          en: ['Prepare gym bag the night before', 'Protein shake after workout'],
        },
        rationale: {
          ja: 'フィットネス上級者向け',
          en: 'For fitness enthusiasts',
        },
        estimatedDuration: { ja: '2〜3ヶ月', en: '2-3 months' },
      },
      {
        name: { ja: '5kmランニング達成', en: 'Complete a 5K run' },
        description: { ja: 'ランニング習慣を身につける', en: 'Establish a running habit' },
        difficulty: 'beginner',
        suggestedHabits: {
          ja: ['週3回のジョギング', 'ストレッチを欠かさない'],
          en: ['Jog 3x/week', 'Never skip stretching'],
        },
        rationale: {
          ja: '達成感のある目標',
          en: 'Goal with sense of achievement',
        },
        estimatedDuration: { ja: '6〜8週間', en: '6-8 weeks' },
      },
      {
        name: { ja: '柔軟性の向上', en: 'Improve flexibility' },
        description: { ja: '毎日のストレッチで体を柔らかく', en: 'Daily stretching for a flexible body' },
        difficulty: 'beginner',
        suggestedHabits: {
          ja: ['朝の5分ストレッチ', '寝る前のヨガポーズ'],
          en: ['5-minute morning stretch', 'Yoga pose before bed'],
        },
        rationale: {
          ja: '怪我予防と健康維持に',
          en: 'For injury prevention and health',
        },
        estimatedDuration: { ja: '1〜2ヶ月', en: '1-2 months' },
      },
    ],
    learning: [
      {
        name: { ja: '毎日の読書', en: 'Daily reading' },
        description: { ja: '知識を広げるための読書習慣', en: 'Reading habit to broaden knowledge' },
        difficulty: 'beginner',
        suggestedHabits: {
          ja: ['寝る前に5ページ読む', '通勤中に電子書籍を読む'],
          en: ['Read 5 pages before bed', 'Read e-books during commute'],
        },
        rationale: {
          ja: '短時間から始められる学習習慣',
          en: 'Learning habit that can start with short sessions',
        },
        estimatedDuration: { ja: '3〜4週間', en: '3-4 weeks' },
      },
      {
        name: { ja: '月に2冊の本を読破', en: 'Read 2 books per month' },
        description: { ja: '読書量を増やして知識を深める', en: 'Increase reading volume for deeper knowledge' },
        difficulty: 'intermediate',
        suggestedHabits: {
          ja: ['毎日30分の読書時間', '読書ノートをつける'],
          en: ['30 minutes of daily reading', 'Keep a reading journal'],
        },
        rationale: {
          ja: '読書習慣がある方向け',
          en: 'For those with existing reading habits',
        },
        estimatedDuration: { ja: '1ヶ月', en: '1 month' },
      },
      {
        name: { ja: '新しいスキルの習得', en: 'Learn a new skill' },
        description: { ja: 'オンライン講座で新しいスキルを学ぶ', en: 'Learn new skills through online courses' },
        difficulty: 'intermediate',
        suggestedHabits: {
          ja: ['毎日15分のオンライン学習', '週末にまとめて復習'],
          en: ['15 minutes of online learning daily', 'Review on weekends'],
        },
        rationale: {
          ja: '自己投資として効果的',
          en: 'Effective self-investment',
        },
        estimatedDuration: { ja: '2〜3ヶ月', en: '2-3 months' },
      },
      {
        name: { ja: '語学力の向上', en: 'Improve language skills' },
        description: { ja: '外国語の会話力を高める', en: 'Improve conversational skills in a foreign language' },
        difficulty: 'beginner',
        suggestedHabits: {
          ja: ['毎日5分の語学アプリ', '週1回のオンラインレッスン'],
          en: ['5 minutes of language app daily', 'Weekly online lesson'],
        },
        rationale: {
          ja: '継続が力になる語学学習',
          en: 'Consistency is key in language learning',
        },
        estimatedDuration: { ja: '3〜6ヶ月', en: '3-6 months' },
      },
    ],
    productivity: [
      {
        name: { ja: '朝のタスク整理', en: 'Morning task organization' },
        description: { ja: '効率的な1日のための朝ルーティン', en: 'Morning routine for an efficient day' },
        difficulty: 'beginner',
        suggestedHabits: {
          ja: ['起床後にToDoリストを作成', '優先タスク3つを決める'],
          en: ['Create a to-do list after waking up', 'Decide on 3 priority tasks'],
        },
        rationale: {
          ja: '生産性向上の基礎となる習慣',
          en: 'Foundational habit for productivity improvement',
        },
        estimatedDuration: { ja: '2〜3週間', en: '2-3 weeks' },
      },
      {
        name: { ja: 'ポモドーロテクニックの習得', en: 'Master Pomodoro Technique' },
        description: { ja: '集中力を高める時間管理術', en: 'Time management for better focus' },
        difficulty: 'beginner',
        suggestedHabits: {
          ja: ['25分集中・5分休憩', '1日4ポモドーロ達成'],
          en: ['25-min focus + 5-min break', 'Complete 4 Pomodoros daily'],
        },
        rationale: {
          ja: '科学的に効果が証明された方法',
          en: 'Scientifically proven method',
        },
        estimatedDuration: { ja: '2〜3週間', en: '2-3 weeks' },
      },
      {
        name: { ja: '週次レビューの実施', en: 'Weekly review practice' },
        description: { ja: '毎週の振り返りで改善を継続', en: 'Continue improvement with weekly reflection' },
        difficulty: 'intermediate',
        suggestedHabits: {
          ja: ['日曜夜に1週間を振り返る', '翌週の計画を立てる'],
          en: ['Reflect on the week Sunday night', 'Plan for next week'],
        },
        rationale: {
          ja: '継続的な改善サイクルを作る',
          en: 'Create continuous improvement cycle',
        },
        estimatedDuration: { ja: '1ヶ月', en: '1 month' },
      },
    ],
    career: [
      {
        name: { ja: 'キャリアの振り返りと目標設定', en: 'Career reflection and goal setting' },
        description: { ja: '自分のキャリアの現状を把握し、目標を明確にする', en: 'Understand your current career status and clarify goals' },
        difficulty: 'beginner',
        suggestedHabits: {
          ja: ['週1回キャリアについて考える時間', '月1回の自己評価'],
          en: ['Weekly time to think about career', 'Monthly self-assessment'],
        },
        rationale: {
          ja: 'キャリアの方向性を明確にする第一歩',
          en: 'First step to clarify career direction',
        },
        estimatedDuration: { ja: '1ヶ月', en: '1 month' },
      },
      {
        name: { ja: '業界知識の基礎固め', en: 'Build industry knowledge foundation' },
        description: { ja: '業界のトレンドやニュースをキャッチアップ', en: 'Keep up with industry trends and news' },
        difficulty: 'beginner',
        suggestedHabits: {
          ja: ['毎朝10分の業界ニュース', '週1回の専門記事読解'],
          en: ['10 min of industry news every morning', 'Weekly professional article reading'],
        },
        rationale: {
          ja: '知識は自信と成長の基盤',
          en: 'Knowledge is the foundation for confidence and growth',
        },
        estimatedDuration: { ja: '1〜2ヶ月', en: '1-2 months' },
      },
      {
        name: { ja: '専門スキルの向上', en: 'Improve professional skills' },
        description: { ja: '業務に直結するスキルアップ', en: 'Skill improvement directly related to work' },
        difficulty: 'intermediate',
        suggestedHabits: {
          ja: ['毎日30分の専門書読書', '週1回の勉強会参加'],
          en: ['30 min of professional reading daily', 'Attend study session weekly'],
        },
        rationale: {
          ja: 'キャリアアップに直結',
          en: 'Directly linked to career advancement',
        },
        estimatedDuration: { ja: '3〜6ヶ月', en: '3-6 months' },
      },
      {
        name: { ja: 'ネットワーキングの強化', en: 'Strengthen networking' },
        description: { ja: 'プロフェッショナルな人脈を広げる', en: 'Expand professional connections' },
        difficulty: 'intermediate',
        suggestedHabits: {
          ja: ['週1回LinkedInを更新', '月1回の業界イベント参加'],
          en: ['Update LinkedIn weekly', 'Attend industry event monthly'],
        },
        rationale: {
          ja: '人脈がキャリアを広げる',
          en: 'Network expands career opportunities',
        },
        estimatedDuration: { ja: '3〜6ヶ月', en: '3-6 months' },
      },
      {
        name: { ja: '資格取得', en: 'Obtain certification' },
        description: { ja: '専門資格を取得してキャリアアップ', en: 'Career advancement through certification' },
        difficulty: 'advanced',
        suggestedHabits: {
          ja: ['毎日1時間の資格勉強', '週末に模擬試験'],
          en: ['1 hour of certification study daily', 'Practice tests on weekends'],
        },
        rationale: {
          ja: '明確な目標がモチベーションに',
          en: 'Clear goal drives motivation',
        },
        estimatedDuration: { ja: '3〜12ヶ月', en: '3-12 months' },
      },
      {
        name: { ja: 'プレゼンスキルの向上', en: 'Improve presentation skills' },
        description: { ja: '効果的なプレゼン能力を身につける', en: 'Develop effective presentation abilities' },
        difficulty: 'intermediate',
        suggestedHabits: {
          ja: ['週1回プレゼン練習', 'フィードバックを求める'],
          en: ['Practice presentations weekly', 'Seek feedback'],
        },
        rationale: {
          ja: 'ビジネスで必須のスキル',
          en: 'Essential business skill',
        },
        estimatedDuration: { ja: '2〜3ヶ月', en: '2-3 months' },
      },
    ],
    finance: [
      {
        name: { ja: '毎月の貯蓄目標達成', en: 'Achieve monthly savings goal' },
        description: { ja: '計画的な貯蓄習慣を身につける', en: 'Develop systematic saving habits' },
        difficulty: 'beginner',
        suggestedHabits: {
          ja: ['給料日に自動振替設定', '週末に支出を振り返る'],
          en: ['Set up auto-transfer on payday', 'Review expenses on weekends'],
        },
        rationale: {
          ja: '小さな一歩から始める貯蓄',
          en: 'Start saving with small steps',
        },
        estimatedDuration: { ja: '1〜2ヶ月', en: '1-2 months' },
      },
      {
        name: { ja: '家計簿の継続', en: 'Maintain household budget' },
        description: { ja: '毎日の支出を記録して管理', en: 'Record and manage daily expenses' },
        difficulty: 'beginner',
        suggestedHabits: {
          ja: ['毎晩5分で支出記録', '週末に予算確認'],
          en: ['Record expenses for 5 min every night', 'Check budget on weekends'],
        },
        rationale: {
          ja: '把握が節約の第一歩',
          en: 'Awareness is the first step to saving',
        },
        estimatedDuration: { ja: '3〜4週間', en: '3-4 weeks' },
      },
      {
        name: { ja: '投資の勉強と実践', en: 'Learn and practice investing' },
        description: { ja: '資産形成のための投資知識を習得', en: 'Acquire investment knowledge for wealth building' },
        difficulty: 'intermediate',
        suggestedHabits: {
          ja: ['毎日投資ニュースをチェック', '月1回ポートフォリオ見直し'],
          en: ['Check investment news daily', 'Review portfolio monthly'],
        },
        rationale: {
          ja: '長期的な資産形成に必須',
          en: 'Essential for long-term wealth building',
        },
        estimatedDuration: { ja: '3〜6ヶ月', en: '3-6 months' },
      },
    ],
    relationships: [
      {
        name: { ja: '家族との時間を増やす', en: 'Increase quality time with family' },
        description: { ja: '大切な人との絆を深める', en: 'Strengthen bonds with loved ones' },
        difficulty: 'beginner',
        suggestedHabits: {
          ja: ['毎日夕食を一緒に', '週末に家族イベント'],
          en: ['Have dinner together daily', 'Family event on weekends'],
        },
        rationale: {
          ja: '人間関係は幸福の基盤',
          en: 'Relationships are the foundation of happiness',
        },
        estimatedDuration: { ja: '継続的', en: 'Ongoing' },
      },
      {
        name: { ja: 'コミュニケーション力の向上', en: 'Improve communication skills' },
        description: { ja: '効果的なコミュニケーション能力を育てる', en: 'Develop effective communication abilities' },
        difficulty: 'intermediate',
        suggestedHabits: {
          ja: ['相手の話を最後まで聞く', '感謝を言葉で伝える'],
          en: ['Listen to others completely', 'Express gratitude verbally'],
        },
        rationale: {
          ja: '良好な人間関係の要',
          en: 'Key to good relationships',
        },
        estimatedDuration: { ja: '1〜2ヶ月', en: '1-2 months' },
      },
      {
        name: { ja: '友人との交流を深める', en: 'Deepen friendships' },
        description: { ja: '定期的に友人と連絡を取る', en: 'Keep in regular contact with friends' },
        difficulty: 'beginner',
        suggestedHabits: {
          ja: ['週1回友人に連絡', '月1回の食事会'],
          en: ['Contact a friend weekly', 'Monthly dinner gathering'],
        },
        rationale: {
          ja: '友情は心の支え',
          en: 'Friendship supports mental well-being',
        },
        estimatedDuration: { ja: '継続的', en: 'Ongoing' },
      },
    ],
    wellness: [
      {
        name: { ja: 'ストレス管理の習慣化', en: 'Develop stress management habits' },
        description: { ja: '心身の健康を保つためのセルフケア', en: 'Self-care for mental and physical health' },
        difficulty: 'beginner',
        suggestedHabits: {
          ja: ['毎日5分の深呼吸', '週末にリラックスタイム'],
          en: ['5 minutes of deep breathing daily', 'Relaxation time on weekends'],
        },
        rationale: {
          ja: 'ストレス対策は現代の必須スキル',
          en: 'Stress management is essential today',
        },
        estimatedDuration: { ja: '2〜4週間', en: '2-4 weeks' },
      },
      {
        name: { ja: 'マインドフルネス瞑想の習慣化', en: 'Establish mindfulness meditation' },
        description: { ja: '毎日の瞑想で心の平静を保つ', en: 'Maintain peace of mind through daily meditation' },
        difficulty: 'beginner',
        suggestedHabits: {
          ja: ['朝5分の瞑想', '寝る前のボディスキャン'],
          en: ['5-minute morning meditation', 'Body scan before sleep'],
        },
        rationale: {
          ja: '科学的に効果が証明された方法',
          en: 'Scientifically proven method',
        },
        estimatedDuration: { ja: '4〜6週間', en: '4-6 weeks' },
      },
    ],
    mindfulness: [
      {
        name: { ja: '毎日の瞑想習慣', en: 'Daily meditation practice' },
        description: { ja: '心の静けさを取り戻す', en: 'Regain inner peace' },
        difficulty: 'beginner',
        suggestedHabits: {
          ja: ['朝10分の瞑想', '夜のリラクゼーション'],
          en: ['10-minute morning meditation', 'Evening relaxation'],
        },
        rationale: {
          ja: '心の健康は体の健康に繋がる',
          en: 'Mental health connects to physical health',
        },
        estimatedDuration: { ja: '4〜8週間', en: '4-8 weeks' },
      },
      {
        name: { ja: '感謝日記の継続', en: 'Maintain gratitude journal' },
        description: { ja: '毎日感謝を書き留めてポジティブに', en: 'Stay positive by journaling gratitude daily' },
        difficulty: 'beginner',
        suggestedHabits: {
          ja: ['寝る前に3つの感謝を書く', '週末に振り返り'],
          en: ['Write 3 gratitudes before bed', 'Weekly reflection'],
        },
        rationale: {
          ja: 'ポジティブ心理学に基づく習慣',
          en: 'Habit based on positive psychology',
        },
        estimatedDuration: { ja: '3〜4週間', en: '3-4 weeks' },
      },
    ],
    lifestyle: [
      {
        name: { ja: '朝型生活への転換', en: 'Transition to morning person' },
        description: { ja: '早起き習慣で1日を有効活用', en: 'Make the most of your day by waking early' },
        difficulty: 'intermediate',
        suggestedHabits: {
          ja: ['22時就寝を目標', '起床後すぐに日光を浴びる'],
          en: ['Aim to sleep by 10 PM', 'Get sunlight right after waking'],
        },
        rationale: {
          ja: '朝の時間は生産性が高い',
          en: 'Morning hours are most productive',
        },
        estimatedDuration: { ja: '3〜4週間', en: '3-4 weeks' },
      },
      {
        name: { ja: 'デジタルデトックス', en: 'Digital detox' },
        description: { ja: 'スマホ依存から脱却する', en: 'Break free from smartphone addiction' },
        difficulty: 'intermediate',
        suggestedHabits: {
          ja: ['寝る1時間前はスマホ禁止', '食事中はスマホを見ない'],
          en: ['No phone 1 hour before bed', 'No phone during meals'],
        },
        rationale: {
          ja: '集中力と睡眠の質が向上',
          en: 'Improves focus and sleep quality',
        },
        estimatedDuration: { ja: '2〜3週間', en: '2-3 weeks' },
      },
    ],
    hobbies: [
      {
        name: { ja: '新しい趣味を見つける', en: 'Find a new hobby' },
        description: { ja: '週末を充実させる趣味を始める', en: 'Start a hobby to enrich weekends' },
        difficulty: 'beginner',
        suggestedHabits: {
          ja: ['週1回新しいことに挑戦', '趣味仲間を見つける'],
          en: ['Try something new weekly', 'Find hobby companions'],
        },
        rationale: {
          ja: '趣味は人生を豊かにする',
          en: 'Hobbies enrich life',
        },
        estimatedDuration: { ja: '1〜2ヶ月', en: '1-2 months' },
      },
      {
        name: { ja: '創作活動を始める', en: 'Start creative activities' },
        description: { ja: '絵画、音楽、執筆などの創作に挑戦', en: 'Try painting, music, writing, etc.' },
        difficulty: 'beginner',
        suggestedHabits: {
          ja: ['毎日15分の創作時間', '作品を記録に残す'],
          en: ['15 minutes of creation daily', 'Document your work'],
        },
        rationale: {
          ja: '創造性は心の健康に良い',
          en: 'Creativity benefits mental health',
        },
        estimatedDuration: { ja: '2〜3ヶ月', en: '2-3 months' },
      },
    ],
  };

  // Helper function to filter templates based on user level and existing habits/goals
  // Note: considerExisting defaults to true (undefined is treated as true)
  const shouldConsiderExisting = input.considerExisting !== false;
  const existingGoalNames = userContext?.existingGoalNames ?? [];
  const allExistingNames = [...existingHabitNames, ...existingGoalNames];

  const filterTemplates = (templates: typeof suggestionTemplates[string], _categoryName?: string) => {
    return templates.filter(t => {
      // Filter by user level
      if (userLevel === 'beginner' && t.difficulty !== 'beginner') return false;
      if (userLevel === 'intermediate' && t.difficulty === 'advanced') return false;

      // Skip if user already has a similar habit/goal (default: true)
      if (shouldConsiderExisting && allExistingNames.length > 0) {
        const suggestionName = isJa ? t.name.ja : t.name.en;
        if (isSimilarToExisting(suggestionName, allExistingNames)) return false;
      }

      return true;
    });
  };

  // If no category specified, gather from multiple categories for variety
  if (!input.category) {
    const allCategories = Object.keys(suggestionTemplates);
    const allSuggestions: (typeof suggestionTemplates[string][number] & { _category?: string })[] = [];

    // Collect suggestions from all categories
    for (const cat of allCategories) {
      const catTemplates = suggestionTemplates[cat] ?? [];
      const filtered = filterTemplates(catTemplates, cat);
      filtered.forEach(t => allSuggestions.push({ ...t, _category: cat }));
    }

    // Shuffle and take requested count
    const shuffled = allSuggestions.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, input.count).map(t => {
      const baseRationale = isJa ? t.rationale.ja : t.rationale.en;
      return {
        name: isJa ? t.name.ja : t.name.en,
        description: isJa ? t.description.ja : t.description.en,
        category: t._category ?? 'other',
        difficulty: t.difficulty,
        suggestedHabits: isJa ? t.suggestedHabits.ja : t.suggestedHabits.en,
        rationale: generatePersonalizedRationale(baseRationale, userContext, isJa),
        estimatedDuration: isJa ? t.estimatedDuration.ja : t.estimatedDuration.en,
        suggestionType: 'goal' as const,
      };
    });
  }

  // Specific category requested - map to template category
  const category = input.category;
  const templateCategory = getTemplateCategoryForGoal(category);
  const templates = suggestionTemplates[templateCategory] ?? suggestionTemplates['health'] ?? [];

  // Filter by user level, existing habits, and limit count
  const filtered = filterTemplates(templates, templateCategory).slice(0, input.count);

  return filtered.map(t => {
    const baseRationale = isJa ? t.rationale.ja : t.rationale.en;
    return {
      name: isJa ? t.name.ja : t.name.en,
      description: isJa ? t.description.ja : t.description.en,
      category: templateCategory,
      difficulty: t.difficulty,
      suggestedHabits: isJa ? t.suggestedHabits.ja : t.suggestedHabits.en,
      rationale: generatePersonalizedRationale(baseRationale, userContext, isJa),
      estimatedDuration: isJa ? t.estimatedDuration.ja : t.estimatedDuration.en,
      suggestionType: 'goal' as const,
    };
  });
}

/**
 * Generate goal suggestions dynamically using OpenAI API
 * Falls back to template-based suggestions if OpenAI is not available
 */
async function generateGoalSuggestionsWithAI(
  input: SuggestGoalsInput,
  context: CoachToolContext
): Promise<GoalSuggestionResult['suggestions']> {
  const { locale, userContext } = context;
  const isJa = locale === 'ja';
  const settings = getSettings();
  const openaiApiKey = context.openaiApiKey ?? settings.openaiApiKey;

  // Fall back to template-based if OpenAI is not configured
  if (!openaiApiKey) {
    logger.info('OpenAI API key not configured, falling back to template-based suggestions');
    return generateGoalSuggestions(input, userContext, locale);
  }

  try {
    const openai = new OpenAI({ apiKey: openaiApiKey });

    // Build context information for AI
    const userLevel = userContext?.userLevel ?? 'beginner';
    const existingGoals = userContext?.existingGoalNames ?? [];
    const existingHabits = userContext?.existingHabitNames ?? [];
    const category = input.category ?? 'general';
    const count = input.count ?? 3;

    // Build prompt based on locale
    const systemPrompt = isJa
      ? `あなたは習慣形成とゴール設定の専門家です。ユーザーのコンテキストを考慮して、実現可能で具体的な目標を提案してください。

重要なルール：
- 既存の目標/習慣と重複しない新しい提案をすること
- ユーザーのレベルに適した難易度を選択すること
- 具体的で測定可能な目標を提案すること
- 提案理由は個人的で励みになる内容にすること

必ず以下のJSON形式で返してください：
{
  "suggestions": [
    {
      "name": "目標名",
      "description": "目標の詳細説明",
      "category": "カテゴリ",
      "difficulty": "beginner|intermediate|advanced",
      "suggestedHabits": ["関連する習慣1", "関連する習慣2"],
      "rationale": "この目標をおすすめする理由（ユーザー向けの励ましを含む）",
      "estimatedDuration": "達成期間の目安"
    }
  ]
}`
      : `You are an expert in habit formation and goal setting. Please suggest achievable and specific goals considering the user's context.

Important rules:
- Suggest new goals that don't overlap with existing goals/habits
- Choose difficulty appropriate for the user's level
- Suggest specific and measurable goals
- Make the rationale personal and encouraging

Always return in the following JSON format:
{
  "suggestions": [
    {
      "name": "Goal name",
      "description": "Detailed description of the goal",
      "category": "category",
      "difficulty": "beginner|intermediate|advanced",
      "suggestedHabits": ["Related habit 1", "Related habit 2"],
      "rationale": "Why this goal is recommended (include encouragement for user)",
      "estimatedDuration": "Estimated time to achieve"
    }
  ]
}`;

    const userPrompt = isJa
      ? `カテゴリ「${category}」で${count}個の目標を提案してください。

ユーザー情報：
- レベル: ${userLevel}
- 既存の目標: ${existingGoals.length > 0 ? existingGoals.join('、') : 'なし'}
- 既存の習慣: ${existingHabits.length > 0 ? existingHabits.join('、') : 'なし'}

既存の目標や習慣と重複しない、このユーザーに適した新しい目標を提案してください。`
      : `Please suggest ${count} goals in the "${category}" category.

User information:
- Level: ${userLevel}
- Existing goals: ${existingGoals.length > 0 ? existingGoals.join(', ') : 'None'}
- Existing habits: ${existingHabits.length > 0 ? existingHabits.join(', ') : 'None'}

Please suggest new goals that are suitable for this user and don't overlap with their existing goals or habits.`;

    logger.info('Generating goal suggestions with OpenAI', {
      category,
      count,
      userLevel,
      locale,
    });

    const response = await openai.chat.completions.create({
      model: settings.openaiModel || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.8,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      logger.warning('Empty response from OpenAI for goal suggestions, falling back to templates');
      return generateGoalSuggestions(input, userContext, locale);
    }

    const parsed = JSON.parse(content);
    const suggestions = parsed.suggestions ?? [];

    // Validate and transform suggestions
    const validSuggestions = suggestions
      .filter((s: Record<string, unknown>) => s['name'] && s['description'])
      .map((s: Record<string, unknown>) => ({
        name: String(s['name']),
        description: String(s['description']),
        category: String(s['category'] ?? category),
        difficulty: (['beginner', 'intermediate', 'advanced'].includes(String(s['difficulty']))
          ? String(s['difficulty'])
          : 'beginner') as LevelTier,
        suggestedHabits: Array.isArray(s['suggestedHabits'])
          ? (s['suggestedHabits'] as unknown[]).map(String)
          : [],
        rationale: String(s['rationale'] ?? ''),
        estimatedDuration: String(s['estimatedDuration'] ?? (isJa ? '1〜2ヶ月' : '1-2 months')),
        suggestionType: 'goal' as const,
      }));

    logger.info('Generated AI goal suggestions', {
      requestedCount: count,
      generatedCount: validSuggestions.length,
    });

    if (validSuggestions.length === 0) {
      logger.warning('No valid suggestions from OpenAI, falling back to templates');
      return generateGoalSuggestions(input, userContext, locale);
    }

    return validSuggestions;
  } catch (error) {
    logger.error('Failed to generate goal suggestions with AI, falling back to templates', error as Error);
    return generateGoalSuggestions(input, userContext, locale);
  }
}

/**
 * Suggest goals for the user
 */
export async function suggestGoalsExecute(
  input: SuggestGoalsInput,
  context: CoachToolContext
): Promise<GoalSuggestionResult> {
  const { locale } = context;
  const isJa = locale === 'ja';

  // Use AI-powered suggestion generation
  const suggestions = await generateGoalSuggestionsWithAI(input, context);

  // Error handling: Empty suggestions list is treated as an error
  if (!suggestions || suggestions.length === 0) {
    const errorMessage = isJa
      ? `カテゴリー「${input.category || '指定なし'}」の目標提案が見つかりませんでした。別のカテゴリーをお試しください。`
      : `No goal suggestions found for category "${input.category || 'unspecified'}". Please try a different category.`;
    throw new Error(errorMessage);
  }

  // Add follow-up actions for refining suggestions
  const followUpActions: GoalSuggestionResult['followUpActions'] = [
    {
      id: 'more_specific',
      label: isJa ? '🔍 もっと具体的に' : '🔍 More Specific',
      action: 'more_specific',
      category: input.category || 'health',
    },
    {
      id: 'more_general',
      label: isJa ? '🌐 もっと一般的に' : '🌐 More General',
      action: 'more_general',
      category: input.category || 'health',
    },
    {
      id: 'easier',
      label: isJa ? '🌱 もっとやさしく' : '🌱 Easier',
      action: 'easier',
      category: input.category || 'health',
    },
    {
      id: 'harder',
      label: isJa ? '🔥 もっとむずかしく' : '🔥 Harder',
      action: 'harder',
      category: input.category || 'health',
    },
    {
      id: 'different',
      label: isJa ? '🔄 他には？' : '🔄 Show More',
      action: 'different',
      category: input.category || 'health',
    },
  ];

  return { suggestions, followUpActions };
}

/**
 * Options for generating habit suggestions with refinement
 */
interface GenerateHabitSuggestionsOptions {
  /** Specificity level: 1=normal, 2=detailed, 3=very detailed */
  specificityLevel?: number;
  /** List of suggestion names to exclude from results */
  excludeNames?: string[];
  /** Seed for shuffling to get different results */
  shuffleSeed?: number;
}

/**
 * Generate habit suggestion templates
 */
async function generateHabitSuggestions(
  input: SuggestHabitsInput,
  userContext?: UserContext,
  locale?: 'ja' | 'en',
  options?: GenerateHabitSuggestionsOptions
): Promise<HabitSuggestionResult['suggestions']> {
  const isJa = locale === 'ja';
  const userLevel = userContext?.userLevel ?? 'beginner';
  const existingHabitNames = userContext?.existingHabitNames ?? [];
  const specificityLevel = options?.specificityLevel ?? 1;
  const excludeNames = options?.excludeNames ?? [];
  const shuffleSeed = options?.shuffleSeed ?? Date.now();
  const preferredFrequency = userContext?.preferredFrequency ?? 'daily';

  // Template suggestions based on category and user level
  const suggestionTemplates: Record<string, {
    name: { ja: string; en: string };
    description: { ja: string; en: string };
    difficulty: LevelTier;
    frequency: 'daily' | 'weekly' | '3x/week';
    estimatedTime: { ja: string; en: string };
    estimatedDuration: { ja: string; en: string };
    rationale: { ja: string; en: string };
  }[]> = {
    health: [
      {
        name: { ja: '朝のストレッチ', en: 'Morning stretch' },
        description: { ja: '起床後5分間のストレッチで体を目覚めさせる', en: 'Wake up your body with 5 minutes of stretching after waking' },
        difficulty: 'beginner',
        frequency: 'daily',
        estimatedTime: { ja: '5分', en: '5 min' },
        estimatedDuration: { ja: '2〜3週間で習慣化', en: '2-3 weeks to establish' },
        rationale: { ja: '小さな習慣から始めるのが継続のコツ', en: 'Starting with small habits is key to consistency' },
      },
      {
        name: { ja: '水を飲む習慣', en: 'Drink water habit' },
        description: { ja: '毎朝起きたらコップ1杯の水を飲む', en: 'Drink a glass of water every morning after waking' },
        difficulty: 'beginner',
        frequency: 'daily',
        estimatedTime: { ja: '1分', en: '1 min' },
        estimatedDuration: { ja: '1〜2週間で習慣化', en: '1-2 weeks to establish' },
        rationale: { ja: '既存の行動（起床）にアンカーできる', en: 'Can be anchored to existing behavior (waking up)' },
      },
      {
        name: { ja: '階段を使う', en: 'Take the stairs' },
        description: { ja: 'エレベーターの代わりに階段を使う', en: 'Use stairs instead of elevators' },
        difficulty: 'beginner',
        frequency: 'daily',
        estimatedTime: { ja: '3分', en: '3 min' },
        estimatedDuration: { ja: '2〜4週間で習慣化', en: '2-4 weeks to establish' },
        rationale: { ja: '日常に運動を自然に取り入れる', en: 'Naturally incorporate exercise into daily life' },
      },
      {
        name: { ja: '深呼吸エクササイズ', en: 'Deep breathing exercise' },
        description: { ja: '1日3回、5回の深呼吸をする', en: 'Take 5 deep breaths, 3 times a day' },
        difficulty: 'beginner',
        frequency: 'daily',
        estimatedTime: { ja: '2分', en: '2 min' },
        estimatedDuration: { ja: '1〜2週間で習慣化', en: '1-2 weeks to establish' },
        rationale: { ja: 'ストレス軽減と集中力向上に効果的', en: 'Effective for stress reduction and focus' },
      },
      {
        name: { ja: '姿勢チェック', en: 'Posture check' },
        description: { ja: '1時間ごとに姿勢を正す習慣', en: 'Correct your posture every hour' },
        difficulty: 'beginner',
        frequency: 'daily',
        estimatedTime: { ja: '1分', en: '1 min' },
        estimatedDuration: { ja: '3〜4週間で習慣化', en: '3-4 weeks to establish' },
        rationale: { ja: '長時間のデスクワークによる肩こり防止', en: 'Prevent stiffness from long desk work' },
      },
      {
        name: { ja: '野菜を1品追加', en: 'Add one vegetable' },
        description: { ja: '毎食に野菜を1品追加する', en: 'Add one vegetable dish to every meal' },
        difficulty: 'beginner',
        frequency: 'daily',
        estimatedTime: { ja: '5分', en: '5 min' },
        estimatedDuration: { ja: '3〜4週間で習慣化', en: '3-4 weeks to establish' },
        rationale: { ja: '栄養バランスの改善に効果的', en: 'Effective for improving nutritional balance' },
      },
      {
        name: { ja: '15分ウォーキング', en: '15-minute walk' },
        description: { ja: '昼食後または夕方に15分歩く', en: 'Walk 15 minutes after lunch or in the evening' },
        difficulty: 'intermediate',
        frequency: '3x/week',
        estimatedTime: { ja: '15分', en: '15 min' },
        estimatedDuration: { ja: '4〜6週間で習慣化', en: '4-6 weeks to establish' },
        rationale: { ja: '運動習慣の基礎づくりに最適', en: 'Ideal for building exercise habits' },
      },
      {
        name: { ja: 'スクワット10回', en: '10 squats' },
        description: { ja: '朝または夜にスクワット10回', en: '10 squats in the morning or evening' },
        difficulty: 'intermediate',
        frequency: 'daily',
        estimatedTime: { ja: '3分', en: '3 min' },
        estimatedDuration: { ja: '3〜5週間で習慣化', en: '3-5 weeks to establish' },
        rationale: { ja: '下半身の筋力維持に効果的', en: 'Effective for maintaining lower body strength' },
      },
    ],
    fitness: [
      {
        name: { ja: '毎朝の軽いジョギング', en: 'Light morning jog' },
        description: { ja: '朝10分の軽いジョギングで1日をスタート', en: 'Start your day with a 10-minute light jog' },
        difficulty: 'beginner',
        frequency: 'daily',
        estimatedTime: { ja: '10分', en: '10 min' },
        estimatedDuration: { ja: '3〜4週間で習慣化', en: '3-4 weeks to establish' },
        rationale: { ja: '朝の運動は代謝を上げる効果がある', en: 'Morning exercise boosts metabolism' },
      },
      {
        name: { ja: 'プランク30秒', en: '30-second plank' },
        description: { ja: '毎日30秒のプランクで体幹を鍛える', en: 'Strengthen your core with a 30-second daily plank' },
        difficulty: 'beginner',
        frequency: 'daily',
        estimatedTime: { ja: '2分', en: '2 min' },
        estimatedDuration: { ja: '2〜3週間で習慣化', en: '2-3 weeks to establish' },
        rationale: { ja: '短時間で効果的な体幹トレーニング', en: 'Effective core training in short time' },
      },
      {
        name: { ja: '腕立て伏せ10回', en: '10 push-ups' },
        description: { ja: '朝または夜に腕立て伏せ10回', en: '10 push-ups in the morning or evening' },
        difficulty: 'beginner',
        frequency: 'daily',
        estimatedTime: { ja: '3分', en: '3 min' },
        estimatedDuration: { ja: '2〜4週間で習慣化', en: '2-4 weeks to establish' },
        rationale: { ja: '上半身の筋力維持に効果的', en: 'Effective for upper body strength' },
      },
      {
        name: { ja: 'ヨガ15分', en: '15-minute yoga' },
        description: { ja: '朝または夜に15分のヨガ', en: '15 minutes of yoga in the morning or evening' },
        difficulty: 'intermediate',
        frequency: 'daily',
        estimatedTime: { ja: '15分', en: '15 min' },
        estimatedDuration: { ja: '4〜6週間で習慣化', en: '4-6 weeks to establish' },
        rationale: { ja: '柔軟性と心の安定を同時に向上', en: 'Improves flexibility and mental stability' },
      },
      {
        name: { ja: 'HIIT5分', en: '5-minute HIIT' },
        description: { ja: '短時間で効果的な高強度インターバルトレーニング', en: 'Effective high-intensity interval training in short time' },
        difficulty: 'intermediate',
        frequency: '3x/week',
        estimatedTime: { ja: '5分', en: '5 min' },
        estimatedDuration: { ja: '3〜5週間で習慣化', en: '3-5 weeks to establish' },
        rationale: { ja: '短時間で高いカロリー消費効果', en: 'High calorie burn in short time' },
      },
      {
        name: { ja: 'ジム通い', en: 'Gym workout' },
        description: { ja: '週3回のジムでのトレーニング', en: 'Training at the gym 3 times a week' },
        difficulty: 'intermediate',
        frequency: '3x/week',
        estimatedTime: { ja: '60分', en: '60 min' },
        estimatedDuration: { ja: '6〜8週間で習慣化', en: '6-8 weeks to establish' },
        rationale: { ja: '本格的なフィットネス習慣の構築', en: 'Building a serious fitness routine' },
      },
    ],
    productivity: [
      {
        name: { ja: 'タスク整理', en: 'Task organization' },
        description: { ja: '朝一番にその日のタスクを3つ決める', en: 'Decide on 3 tasks first thing in the morning' },
        difficulty: 'beginner',
        frequency: 'daily',
        estimatedTime: { ja: '5分', en: '5 min' },
        estimatedDuration: { ja: '2〜3週間で習慣化', en: '2-3 weeks to establish' },
        rationale: { ja: '優先順位を明確にすることで生産性向上', en: 'Clarifying priorities improves productivity' },
      },
      {
        name: { ja: 'ポモドーロ1セット', en: 'One Pomodoro session' },
        description: { ja: '25分集中→5分休憩を1セット実施', en: 'Complete one 25-minute focus + 5-minute break session' },
        difficulty: 'beginner',
        frequency: 'daily',
        estimatedTime: { ja: '30分', en: '30 min' },
        estimatedDuration: { ja: '3〜4週間で習慣化', en: '3-4 weeks to establish' },
        rationale: { ja: '集中力を鍛える最初のステップ', en: 'First step to building focus' },
      },
      {
        name: { ja: '朝のメールチェック禁止', en: 'No morning email check' },
        description: { ja: '朝の最初の1時間はメールを見ない', en: 'No email for the first hour in the morning' },
        difficulty: 'beginner',
        frequency: 'daily',
        estimatedTime: { ja: '0分', en: '0 min' },
        estimatedDuration: { ja: '2〜3週間で習慣化', en: '2-3 weeks to establish' },
        rationale: { ja: '朝の集中時間を確保する', en: 'Secure focused time in the morning' },
      },
      {
        name: { ja: '1日の振り返り', en: 'Daily reflection' },
        description: { ja: '寝る前に今日やったことを3つ書く', en: 'Write 3 things you did before bed' },
        difficulty: 'beginner',
        frequency: 'daily',
        estimatedTime: { ja: '5分', en: '5 min' },
        estimatedDuration: { ja: '2〜3週間で習慣化', en: '2-3 weeks to establish' },
        rationale: { ja: '達成感を得て翌日のモチベーションに', en: 'Gain sense of achievement for tomorrow' },
      },
      {
        name: { ja: 'デスク整理', en: 'Desk organization' },
        description: { ja: '仕事終わりにデスクを片付ける', en: 'Clean up your desk at the end of work' },
        difficulty: 'beginner',
        frequency: 'daily',
        estimatedTime: { ja: '5分', en: '5 min' },
        estimatedDuration: { ja: '2〜3週間で習慣化', en: '2-3 weeks to establish' },
        rationale: { ja: '翌日のスタートをスムーズにする', en: 'Smooth start to the next day' },
      },
      {
        name: { ja: '週次レビュー', en: 'Weekly review' },
        description: { ja: '日曜の夜に1週間を振り返り翌週を計画', en: 'Review the week and plan the next on Sunday night' },
        difficulty: 'intermediate',
        frequency: 'weekly',
        estimatedTime: { ja: '30分', en: '30 min' },
        estimatedDuration: { ja: '4〜6週間で習慣化', en: '4-6 weeks to establish' },
        rationale: { ja: '継続的な改善サイクルを作る', en: 'Create continuous improvement cycle' },
      },
    ],
    learning: [
      {
        name: { ja: '読書10ページ', en: 'Read 10 pages' },
        description: { ja: '毎日10ページ本を読む', en: 'Read 10 pages of a book every day' },
        difficulty: 'beginner',
        frequency: 'daily',
        estimatedTime: { ja: '15分', en: '15 min' },
        estimatedDuration: { ja: '3〜4週間で習慣化', en: '3-4 weeks to establish' },
        rationale: { ja: '小さな読書習慣が知識の蓄積につながる', en: 'Small reading habits lead to knowledge accumulation' },
      },
      {
        name: { ja: '語学学習5分', en: '5-minute language study' },
        description: { ja: 'アプリで5分間語学学習', en: '5 minutes of language learning with an app' },
        difficulty: 'beginner',
        frequency: 'daily',
        estimatedTime: { ja: '5分', en: '5 min' },
        estimatedDuration: { ja: '2〜3週間で習慣化', en: '2-3 weeks to establish' },
        rationale: { ja: '毎日少しずつが語学上達の鍵', en: 'A little every day is key to language improvement' },
      },
      {
        name: { ja: 'オンライン講座15分', en: '15-minute online course' },
        description: { ja: '毎日15分のオンライン学習', en: '15 minutes of online learning daily' },
        difficulty: 'beginner',
        frequency: 'daily',
        estimatedTime: { ja: '15分', en: '15 min' },
        estimatedDuration: { ja: '3〜4週間で習慣化', en: '3-4 weeks to establish' },
        rationale: { ja: '新しいスキルを継続的に習得', en: 'Continuously acquire new skills' },
      },
      {
        name: { ja: '単語10個暗記', en: 'Memorize 10 words' },
        description: { ja: '毎日10個の新しい単語を覚える', en: 'Memorize 10 new words every day' },
        difficulty: 'beginner',
        frequency: 'daily',
        estimatedTime: { ja: '10分', en: '10 min' },
        estimatedDuration: { ja: '2〜4週間で習慣化', en: '2-4 weeks to establish' },
        rationale: { ja: '語彙力は学習の基盤', en: 'Vocabulary is the foundation of learning' },
      },
      {
        name: { ja: 'ポッドキャスト学習', en: 'Podcast learning' },
        description: { ja: '通勤中に教育系ポッドキャストを聴く', en: 'Listen to educational podcasts during commute' },
        difficulty: 'beginner',
        frequency: 'daily',
        estimatedTime: { ja: '20分', en: '20 min' },
        estimatedDuration: { ja: '2〜3週間で習慣化', en: '2-3 weeks to establish' },
        rationale: { ja: '移動時間を学習時間に変える', en: 'Turn commute time into learning time' },
      },
      {
        name: { ja: '学習ノートの作成', en: 'Create study notes' },
        description: { ja: '学んだことを5分でノートにまとめる', en: 'Summarize what you learned in 5 minutes' },
        difficulty: 'intermediate',
        frequency: 'daily',
        estimatedTime: { ja: '5分', en: '5 min' },
        estimatedDuration: { ja: '3〜4週間で習慣化', en: '3-4 weeks to establish' },
        rationale: { ja: 'アウトプットで記憶が定着する', en: 'Output helps retain memory' },
      },
    ],
    career: [
      {
        name: { ja: '業界ニュースチェック', en: 'Industry news check' },
        description: { ja: '毎朝10分で業界の最新情報を確認', en: 'Check latest industry news for 10 minutes every morning' },
        difficulty: 'beginner',
        frequency: 'daily',
        estimatedTime: { ja: '10分', en: '10 min' },
        estimatedDuration: { ja: '2〜3週間で習慣化', en: '2-3 weeks to establish' },
        rationale: { ja: '業界動向を把握してキャリアに活かす', en: 'Stay updated for career growth' },
      },
      {
        name: { ja: 'LinkedIn更新', en: 'LinkedIn update' },
        description: { ja: '週1回プロフィールや投稿を更新', en: 'Update profile or post weekly' },
        difficulty: 'beginner',
        frequency: 'weekly',
        estimatedTime: { ja: '15分', en: '15 min' },
        estimatedDuration: { ja: '4〜6週間で習慣化', en: '4-6 weeks to establish' },
        rationale: { ja: 'プロフェッショナルネットワークを構築', en: 'Build professional network' },
      },
      {
        name: { ja: 'スキル学習', en: 'Skill learning' },
        description: { ja: '仕事に関連するスキルを毎日30分学習', en: 'Learn job-related skills for 30 minutes daily' },
        difficulty: 'intermediate',
        frequency: 'daily',
        estimatedTime: { ja: '30分', en: '30 min' },
        estimatedDuration: { ja: '4〜6週間で習慣化', en: '4-6 weeks to establish' },
        rationale: { ja: '継続的なスキルアップがキャリアを向上', en: 'Continuous skill development advances career' },
      },
      {
        name: { ja: 'メンターとの定期連絡', en: 'Regular mentor check-in' },
        description: { ja: '月1回メンターと連絡を取る', en: 'Contact your mentor once a month' },
        difficulty: 'intermediate',
        frequency: 'weekly',
        estimatedTime: { ja: '30分', en: '30 min' },
        estimatedDuration: { ja: '3〜4週間で習慣化', en: '3-4 weeks to establish' },
        rationale: { ja: 'メンターからの学びはキャリアの宝', en: 'Learning from mentors is career treasure' },
      },
      {
        name: { ja: '1日1つ新しいことを学ぶ', en: 'Learn one new thing daily' },
        description: { ja: '業務に関連する新しい知識を1つ獲得', en: 'Gain one new piece of work-related knowledge' },
        difficulty: 'beginner',
        frequency: 'daily',
        estimatedTime: { ja: '15分', en: '15 min' },
        estimatedDuration: { ja: '2〜3週間で習慣化', en: '2-3 weeks to establish' },
        rationale: { ja: '小さな学びの積み重ねが大きな成長に', en: 'Small learnings lead to big growth' },
      },
    ],
    finance: [
      {
        name: { ja: '支出記録', en: 'Expense tracking' },
        description: { ja: '毎晩5分で今日の支出を記録', en: 'Record today\'s expenses in 5 minutes every night' },
        difficulty: 'beginner',
        frequency: 'daily',
        estimatedTime: { ja: '5分', en: '5 min' },
        estimatedDuration: { ja: '2〜3週間で習慣化', en: '2-3 weeks to establish' },
        rationale: { ja: '把握が節約の第一歩', en: 'Awareness is the first step to saving' },
      },
      {
        name: { ja: '週末の予算確認', en: 'Weekend budget review' },
        description: { ja: '週末に1週間の支出と予算を確認', en: 'Review weekly expenses and budget on weekends' },
        difficulty: 'beginner',
        frequency: 'weekly',
        estimatedTime: { ja: '15分', en: '15 min' },
        estimatedDuration: { ja: '3〜4週間で習慣化', en: '3-4 weeks to establish' },
        rationale: { ja: '定期的な確認で予算オーバーを防ぐ', en: 'Regular review prevents budget overflow' },
      },
      {
        name: { ja: '投資ニュースチェック', en: 'Investment news check' },
        description: { ja: '毎朝5分で投資関連ニュースを確認', en: 'Check investment news for 5 minutes every morning' },
        difficulty: 'beginner',
        frequency: 'daily',
        estimatedTime: { ja: '5分', en: '5 min' },
        estimatedDuration: { ja: '2〜3週間で習慣化', en: '2-3 weeks to establish' },
        rationale: { ja: '市場動向を把握して賢い投資判断', en: 'Track market trends for smart investing' },
      },
      {
        name: { ja: '小銭貯金', en: 'Coin saving' },
        description: { ja: '毎日小銭を貯金箱に入れる', en: 'Put coins in a piggy bank every day' },
        difficulty: 'beginner',
        frequency: 'daily',
        estimatedTime: { ja: '1分', en: '1 min' },
        estimatedDuration: { ja: '1〜2週間で習慣化', en: '1-2 weeks to establish' },
        rationale: { ja: '小さな貯蓄習慣が大きな資産に', en: 'Small saving habits lead to big assets' },
      },
      {
        name: { ja: '節約ランチ', en: 'Budget lunch' },
        description: { ja: '週3回はお弁当を持参して節約', en: 'Bring lunch 3 times a week to save money' },
        difficulty: 'intermediate',
        frequency: '3x/week',
        estimatedTime: { ja: '15分', en: '15 min' },
        estimatedDuration: { ja: '4〜6週間で習慣化', en: '4-6 weeks to establish' },
        rationale: { ja: 'ランチ代の節約は年間で大きな差に', en: 'Lunch savings make a big difference annually' },
      },
    ],
    wellness: [
      {
        name: { ja: '瞑想3分', en: '3-minute meditation' },
        description: { ja: '朝または夜に3分間の瞑想', en: '3 minutes of meditation in the morning or evening' },
        difficulty: 'beginner',
        frequency: 'daily',
        estimatedTime: { ja: '3分', en: '3 min' },
        estimatedDuration: { ja: '2〜4週間で習慣化', en: '2-4 weeks to establish' },
        rationale: { ja: '短時間から始めてメンタルケアの習慣化', en: 'Start short and build mental care habits' },
      },
      {
        name: { ja: '感謝日記', en: 'Gratitude journal' },
        description: { ja: '寝る前に3つ感謝することを書く', en: 'Write 3 things you are grateful for before bed' },
        difficulty: 'beginner',
        frequency: 'daily',
        estimatedTime: { ja: '5分', en: '5 min' },
        estimatedDuration: { ja: '3〜4週間で習慣化', en: '3-4 weeks to establish' },
        rationale: { ja: 'ポジティブ思考を育む効果的な習慣', en: 'Effective habit for cultivating positive thinking' },
      },
      {
        name: { ja: '深呼吸休憩', en: 'Deep breathing break' },
        description: { ja: '1日3回、仕事の合間に深呼吸', en: 'Take deep breaths 3 times a day between work' },
        difficulty: 'beginner',
        frequency: 'daily',
        estimatedTime: { ja: '3分', en: '3 min' },
        estimatedDuration: { ja: '1〜2週間で習慣化', en: '1-2 weeks to establish' },
        rationale: { ja: 'ストレス軽減に即効性のある習慣', en: 'Quick habit for stress relief' },
      },
      {
        name: { ja: 'デジタルデトックス', en: 'Digital detox' },
        description: { ja: '寝る1時間前からスマホを見ない', en: 'No phone 1 hour before bed' },
        difficulty: 'intermediate',
        frequency: 'daily',
        estimatedTime: { ja: '0分', en: '0 min' },
        estimatedDuration: { ja: '3〜4週間で習慣化', en: '3-4 weeks to establish' },
        rationale: { ja: '睡眠の質と心の健康を向上', en: 'Improves sleep quality and mental health' },
      },
      {
        name: { ja: '自然の中を散歩', en: 'Walk in nature' },
        description: { ja: '週末に自然の中を30分散歩', en: '30-minute walk in nature on weekends' },
        difficulty: 'beginner',
        frequency: 'weekly',
        estimatedTime: { ja: '30分', en: '30 min' },
        estimatedDuration: { ja: '3〜4週間で習慣化', en: '3-4 weeks to establish' },
        rationale: { ja: '自然はストレス軽減に効果的', en: 'Nature is effective for stress relief' },
      },
    ],
    mindfulness: [
      {
        name: { ja: '朝の瞑想10分', en: '10-minute morning meditation' },
        description: { ja: '起床後に10分間の瞑想で1日をスタート', en: 'Start your day with 10 minutes of meditation after waking' },
        difficulty: 'beginner',
        frequency: 'daily',
        estimatedTime: { ja: '10分', en: '10 min' },
        estimatedDuration: { ja: '3〜4週間で習慣化', en: '3-4 weeks to establish' },
        rationale: { ja: '朝の瞑想は1日の集中力を高める', en: 'Morning meditation improves daily focus' },
      },
      {
        name: { ja: 'マインドフルイーティング', en: 'Mindful eating' },
        description: { ja: '食事中はスマホを置いて味わって食べる', en: 'Put down your phone and savor your meal' },
        difficulty: 'beginner',
        frequency: 'daily',
        estimatedTime: { ja: '15分', en: '15 min' },
        estimatedDuration: { ja: '2〜3週間で習慣化', en: '2-3 weeks to establish' },
        rationale: { ja: '食事を意識的に楽しむことで満足感向上', en: 'Mindful eating increases satisfaction' },
      },
      {
        name: { ja: 'ボディスキャン', en: 'Body scan' },
        description: { ja: '寝る前に5分間体の各部位に意識を向ける', en: 'Focus on each body part for 5 minutes before bed' },
        difficulty: 'beginner',
        frequency: 'daily',
        estimatedTime: { ja: '5分', en: '5 min' },
        estimatedDuration: { ja: '2〜4週間で習慣化', en: '2-4 weeks to establish' },
        rationale: { ja: '体の緊張に気づきリラックスを促す', en: 'Notice tension and promote relaxation' },
      },
      {
        name: { ja: '歩く瞑想', en: 'Walking meditation' },
        description: { ja: '通勤中に5分間意識的に歩く', en: '5 minutes of conscious walking during commute' },
        difficulty: 'intermediate',
        frequency: 'daily',
        estimatedTime: { ja: '5分', en: '5 min' },
        estimatedDuration: { ja: '3〜4週間で習慣化', en: '3-4 weeks to establish' },
        rationale: { ja: '日常の中にマインドフルネスを取り入れる', en: 'Incorporate mindfulness into daily life' },
      },
    ],
    relationships: [
      {
        name: { ja: '家族との会話時間', en: 'Family conversation time' },
        description: { ja: '毎日15分家族と会話する時間を作る', en: 'Create 15 minutes of conversation time with family daily' },
        difficulty: 'beginner',
        frequency: 'daily',
        estimatedTime: { ja: '15分', en: '15 min' },
        estimatedDuration: { ja: '2〜3週間で習慣化', en: '2-3 weeks to establish' },
        rationale: { ja: '日常の会話が絆を深める', en: 'Daily conversation deepens bonds' },
      },
      {
        name: { ja: '感謝を伝える', en: 'Express gratitude' },
        description: { ja: '毎日誰かに感謝の言葉を伝える', en: 'Tell someone thank you every day' },
        difficulty: 'beginner',
        frequency: 'daily',
        estimatedTime: { ja: '2分', en: '2 min' },
        estimatedDuration: { ja: '2〜3週間で習慣化', en: '2-3 weeks to establish' },
        rationale: { ja: '感謝は人間関係を良好にする', en: 'Gratitude improves relationships' },
      },
      {
        name: { ja: '友人への連絡', en: 'Contact friends' },
        description: { ja: '週1回友人に連絡を取る', en: 'Contact a friend once a week' },
        difficulty: 'beginner',
        frequency: 'weekly',
        estimatedTime: { ja: '15分', en: '15 min' },
        estimatedDuration: { ja: '3〜4週間で習慣化', en: '3-4 weeks to establish' },
        rationale: { ja: '友情を大切にすることで心の支えに', en: 'Cherishing friendship provides mental support' },
      },
      {
        name: { ja: '相手の話を聴く', en: 'Listen to others' },
        description: { ja: '会話中は相手の話を最後まで聴く', en: 'Listen to others until they finish speaking' },
        difficulty: 'intermediate',
        frequency: 'daily',
        estimatedTime: { ja: '10分', en: '10 min' },
        estimatedDuration: { ja: '4〜6週間で習慣化', en: '4-6 weeks to establish' },
        rationale: { ja: '傾聴は信頼関係の基盤', en: 'Listening is the foundation of trust' },
      },
    ],
    lifestyle: [
      {
        name: { ja: '早起き習慣', en: 'Early rising habit' },
        description: { ja: '毎日同じ時間に起きる', en: 'Wake up at the same time every day' },
        difficulty: 'intermediate',
        frequency: 'daily',
        estimatedTime: { ja: '0分', en: '0 min' },
        estimatedDuration: { ja: '3〜4週間で習慣化', en: '3-4 weeks to establish' },
        rationale: { ja: '規則正しい生活リズムが健康の基盤', en: 'Regular routine is the foundation of health' },
      },
      {
        name: { ja: '夜の準備習慣', en: 'Evening preparation' },
        description: { ja: '寝る前に翌日の準備をする', en: 'Prepare for tomorrow before bed' },
        difficulty: 'beginner',
        frequency: 'daily',
        estimatedTime: { ja: '10分', en: '10 min' },
        estimatedDuration: { ja: '2〜3週間で習慣化', en: '2-3 weeks to establish' },
        rationale: { ja: '朝の余裕を作りストレス軽減', en: 'Create morning calm and reduce stress' },
      },
      {
        name: { ja: '部屋の片付け', en: 'Room tidying' },
        description: { ja: '毎日10分部屋を片付ける', en: 'Tidy up your room for 10 minutes every day' },
        difficulty: 'beginner',
        frequency: 'daily',
        estimatedTime: { ja: '10分', en: '10 min' },
        estimatedDuration: { ja: '2〜3週間で習慣化', en: '2-3 weeks to establish' },
        rationale: { ja: '整理整頓された環境は心の安定に', en: 'Organized space leads to mental stability' },
      },
      {
        name: { ja: 'スクリーンタイム管理', en: 'Screen time management' },
        description: { ja: 'スマホの使用時間を1日2時間以内に', en: 'Limit smartphone use to 2 hours a day' },
        difficulty: 'intermediate',
        frequency: 'daily',
        estimatedTime: { ja: '0分', en: '0 min' },
        estimatedDuration: { ja: '3〜4週間で習慣化', en: '3-4 weeks to establish' },
        rationale: { ja: 'デジタル依存を防ぎ時間を有効活用', en: 'Prevent digital addiction and use time wisely' },
      },
    ],
    hobbies: [
      {
        name: { ja: '毎日のスケッチ', en: 'Daily sketch' },
        description: { ja: '毎日10分絵を描く習慣', en: 'Draw for 10 minutes every day' },
        difficulty: 'beginner',
        frequency: 'daily',
        estimatedTime: { ja: '10分', en: '10 min' },
        estimatedDuration: { ja: '3〜4週間で習慣化', en: '3-4 weeks to establish' },
        rationale: { ja: '創造性を育てリラックス効果も', en: 'Nurture creativity with relaxation benefits' },
      },
      {
        name: { ja: '楽器の練習', en: 'Practice an instrument' },
        description: { ja: '毎日15分楽器を練習する', en: 'Practice an instrument for 15 minutes daily' },
        difficulty: 'beginner',
        frequency: 'daily',
        estimatedTime: { ja: '15分', en: '15 min' },
        estimatedDuration: { ja: '4〜6週間で習慣化', en: '4-6 weeks to establish' },
        rationale: { ja: '音楽は脳の活性化と心の癒しに', en: 'Music activates the brain and heals the heart' },
      },
      {
        name: { ja: '写真を撮る', en: 'Take photos' },
        description: { ja: '毎日1枚お気に入りの写真を撮る', en: 'Take one favorite photo every day' },
        difficulty: 'beginner',
        frequency: 'daily',
        estimatedTime: { ja: '5分', en: '5 min' },
        estimatedDuration: { ja: '2〜3週間で習慣化', en: '2-3 weeks to establish' },
        rationale: { ja: '日常の中に美しさを見つける訓練', en: 'Train to find beauty in everyday life' },
      },
      {
        name: { ja: '料理に挑戦', en: 'Try new recipes' },
        description: { ja: '週に1回新しいレシピに挑戦する', en: 'Try a new recipe once a week' },
        difficulty: 'beginner',
        frequency: 'weekly',
        estimatedTime: { ja: '60分', en: '60 min' },
        estimatedDuration: { ja: '3〜4週間で習慣化', en: '3-4 weeks to establish' },
        rationale: { ja: '料理は創造性と実用性を兼ね備えた趣味', en: 'Cooking combines creativity with practicality' },
      },
      {
        name: { ja: 'ガーデニング', en: 'Gardening' },
        description: { ja: '毎日10分植物の世話をする', en: 'Care for plants for 10 minutes daily' },
        difficulty: 'beginner',
        frequency: 'daily',
        estimatedTime: { ja: '10分', en: '10 min' },
        estimatedDuration: { ja: '2〜3週間で習慣化', en: '2-3 weeks to establish' },
        rationale: { ja: '自然と触れ合うことでストレス軽減', en: 'Reduce stress by connecting with nature' },
      },
      {
        name: { ja: '手芸・クラフト', en: 'Crafts' },
        description: { ja: '週に2回手芸やDIYの時間を作る', en: 'Make time for crafts or DIY twice a week' },
        difficulty: 'intermediate',
        frequency: '3x/week',
        estimatedTime: { ja: '30分', en: '30 min' },
        estimatedDuration: { ja: '4〜6週間で習慣化', en: '4-6 weeks to establish' },
        rationale: { ja: '手を動かす作業は集中力と達成感をもたらす', en: 'Hands-on work brings focus and achievement' },
      },
      {
        name: { ja: 'ゲームの時間管理', en: 'Managed gaming time' },
        description: { ja: '週末に1時間のゲーム時間を設ける', en: 'Set 1 hour of gaming time on weekends' },
        difficulty: 'beginner',
        frequency: 'weekly',
        estimatedTime: { ja: '60分', en: '60 min' },
        estimatedDuration: { ja: '2〜3週間で習慣化', en: '2-3 weeks to establish' },
        rationale: { ja: '適度なゲームはリフレッシュに効果的', en: 'Moderate gaming is effective for refreshing' },
      },
      {
        name: { ja: '映画・ドラマ鑑賞', en: 'Watch movies/shows' },
        description: { ja: '週末に映画やドラマを1本見る', en: 'Watch one movie or show on weekends' },
        difficulty: 'beginner',
        frequency: 'weekly',
        estimatedTime: { ja: '120分', en: '120 min' },
        estimatedDuration: { ja: '1〜2週間で習慣化', en: '1-2 weeks to establish' },
        rationale: { ja: '物語を楽しむことで感性を磨く', en: 'Enjoying stories sharpens sensibilities' },
      },
    ],
    other: [
      {
        name: { ja: 'デスク整理', en: 'Desk organization' },
        description: { ja: '仕事終わりにデスクを片付ける', en: 'Clean up your desk at the end of work' },
        difficulty: 'beginner',
        frequency: 'daily',
        estimatedTime: { ja: '5分', en: '5 min' },
        estimatedDuration: { ja: '2〜3週間で習慣化', en: '2-3 weeks to establish' },
        rationale: { ja: '翌日のスタートをスムーズにする', en: 'Smooth start to the next day' },
      },
      {
        name: { ja: '植物に水やり', en: 'Water plants' },
        description: { ja: '毎日植物に水をあげて心を落ち着ける', en: 'Water plants daily to calm your mind' },
        difficulty: 'beginner',
        frequency: 'daily',
        estimatedTime: { ja: '3分', en: '3 min' },
        estimatedDuration: { ja: '1〜2週間で習慣化', en: '1-2 weeks to establish' },
        rationale: { ja: '植物の世話は心の癒しになる', en: 'Caring for plants is healing' },
      },
      {
        name: { ja: '日記をつける', en: 'Keep a journal' },
        description: { ja: '毎日5分その日の出来事を記録', en: 'Record the day\'s events for 5 minutes' },
        difficulty: 'beginner',
        frequency: 'daily',
        estimatedTime: { ja: '5分', en: '5 min' },
        estimatedDuration: { ja: '3〜4週間で習慣化', en: '3-4 weeks to establish' },
        rationale: { ja: '自己理解を深め成長を促す', en: 'Deepen self-understanding and promote growth' },
      },
    ],
  };

  // Helper function to filter templates based on user level, existing habits, and frequency preference
  // Note: considerExisting defaults to true (undefined is treated as true)
  const shouldConsiderExisting = input.considerExisting !== false;

  const filterHabitTemplates = (templates: typeof suggestionTemplates[string]) => {
    return templates.filter(t => {
      // Filter by user level
      if (userLevel === 'beginner' && t.difficulty !== 'beginner') return false;
      if (userLevel === 'intermediate' && t.difficulty === 'advanced') return false;

      // Skip if user already has a similar habit (default: true)
      if (shouldConsiderExisting && existingHabitNames.length > 0) {
        const suggestionName = isJa ? t.name.ja : t.name.en;
        if (isSimilarToExisting(suggestionName, existingHabitNames)) return false;
      }

      // Exclude suggestions by name (for refinement to show different suggestions)
      if (excludeNames.length > 0) {
        const suggestionNameJa = t.name.ja.toLowerCase();
        const suggestionNameEn = t.name.en.toLowerCase();
        for (const excludeName of excludeNames) {
          const lowerExclude = excludeName.toLowerCase();
          if (suggestionNameJa.includes(lowerExclude) || suggestionNameEn.includes(lowerExclude) ||
              lowerExclude.includes(suggestionNameJa) || lowerExclude.includes(suggestionNameEn)) {
            return false;
          }
        }
      }

      return true;
    });
  };

  // Sort by frequency preference (prioritize matching user's preferred frequency)
  const sortByFrequencyPreference = (templates: typeof suggestionTemplates[string]) => {
    return [...templates].sort((a, b) => {
      const aMatchesPreferred = a.frequency === preferredFrequency ? 1 : 0;
      const bMatchesPreferred = b.frequency === preferredFrequency ? 1 : 0;
      return bMatchesPreferred - aMatchesPreferred;
    });
  };

  // Seeded shuffle function for reproducible but varied results
  const seededShuffle = <T>(arr: T[], seed: number): T[] => {
    const result = [...arr];
    let currentSeed = seed;
    const random = () => {
      currentSeed = (currentSeed * 9301 + 49297) % 233280;
      return currentSeed / 233280;
    };
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      const temp = result[i]!;
      result[i] = result[j]!;
      result[j] = temp;
    }
    return result;
  };

  // Enhance description based on specificity level
  const enhanceDescription = (baseDesc: string, specificityLevel: number, isJa: boolean): string => {
    if (specificityLevel <= 1) return baseDesc;

    // Add more specific details based on specificity level
    if (specificityLevel >= 2) {
      const detailSuffix = isJa
        ? '。具体的なタイミングや場所を決めて実行しましょう'
        : '. Set a specific time and place to do this';
      return baseDesc + detailSuffix;
    }
    if (specificityLevel >= 3) {
      const detailSuffix = isJa
        ? '。毎日同じ時間・同じ場所で行い、既存の習慣の直後に組み込むと定着しやすくなります'
        : '. Do this at the same time and place every day, right after an existing habit for better adherence';
      return baseDesc + detailSuffix;
    }
    return baseDesc;
  };

  // If no category specified, gather from multiple categories for variety
  if (!input.category) {
    const allCategories = Object.keys(suggestionTemplates);
    const allSuggestions: (typeof suggestionTemplates[string][number] & { _category?: string })[] = [];

    // Collect suggestions from all categories
    for (const cat of allCategories) {
      const catTemplates = suggestionTemplates[cat] ?? [];
      const filtered = filterHabitTemplates(catTemplates);
      // Add category info to each template
      filtered.forEach(t => allSuggestions.push({ ...t, _category: cat }));
    }

    // Sort by frequency preference and then shuffle for variety (using seeded shuffle)
    const sorted = sortByFrequencyPreference(allSuggestions as typeof suggestionTemplates[string]);
    const shuffled = seededShuffle(sorted, shuffleSeed);

    return shuffled.slice(0, input.count).map(t => {
      const baseRationale = isJa ? t.rationale.ja : t.rationale.en;
      const baseDescription = isJa ? t.description.ja : t.description.en;
      return {
        name: isJa ? t.name.ja : t.name.en,
        description: enhanceDescription(baseDescription, specificityLevel, isJa),
        category: (t as typeof t & { _category?: string })._category ?? 'other',
        difficulty: t.difficulty,
        frequency: t.frequency,
        estimatedTime: isJa ? t.estimatedTime.ja : t.estimatedTime.en,
        estimatedDuration: isJa ? t.estimatedDuration.ja : t.estimatedDuration.en,
        rationale: generatePersonalizedRationale(baseRationale, userContext, isJa),
        suggestionType: 'habit' as const,
      };
    });
  }

  // Specific category requested - map to template category
  const category = input.category;
  const templateCategory = getTemplateCategoryForHabit(category);
  const templates = suggestionTemplates[templateCategory] ?? suggestionTemplates['health'] ?? [];

  // Filter by user level, existing habits, sort by frequency preference, shuffle for variety, and limit count
  const filtered = filterHabitTemplates(templates);
  const sorted = sortByFrequencyPreference(filtered);
  const shuffled = seededShuffle(sorted, shuffleSeed);
  const limited = shuffled.slice(0, input.count);

  return limited.map(t => {
    const baseRationale = isJa ? t.rationale.ja : t.rationale.en;
    const baseDescription = isJa ? t.description.ja : t.description.en;
    return {
      name: isJa ? t.name.ja : t.name.en,
      description: enhanceDescription(baseDescription, specificityLevel, isJa),
      category: templateCategory,
      difficulty: t.difficulty,
      frequency: t.frequency,
      estimatedTime: isJa ? t.estimatedTime.ja : t.estimatedTime.en,
      estimatedDuration: isJa ? t.estimatedDuration.ja : t.estimatedDuration.en,
      rationale: generatePersonalizedRationale(baseRationale, userContext, isJa),
      suggestionType: 'habit' as const,
    };
  });
}

/**
 * Generate habit suggestions dynamically using OpenAI API
 * Falls back to template-based suggestions if OpenAI is not available
 */
async function generateHabitSuggestionsWithAI(
  input: SuggestHabitsInput,
  context: CoachToolContext
): Promise<HabitSuggestionResult['suggestions']> {
  const { locale, userContext } = context;
  const isJa = locale === 'ja';
  const settings = getSettings();
  const openaiApiKey = context.openaiApiKey ?? settings.openaiApiKey;

  // Fall back to template-based if OpenAI is not configured
  if (!openaiApiKey) {
    logger.info('OpenAI API key not configured, falling back to template-based habit suggestions');
    return generateHabitSuggestions(input, userContext, locale);
  }

  try {
    const openai = new OpenAI({ apiKey: openaiApiKey });

    // Build context information for AI
    const userLevel = userContext?.userLevel ?? 'beginner';
    const existingHabits = userContext?.existingHabitNames ?? [];
    const preferredFrequency = userContext?.preferredFrequency ?? 'daily';
    const category = input.category ?? 'general';
    const count = input.count ?? 3;

    // Build prompt based on locale
    const systemPrompt = isJa
      ? `あなたは習慣形成の専門家です。ユーザーのコンテキストを考慮して、実現可能で継続しやすい習慣を提案してください。

重要なルール：
- 既存の習慣と重複しない新しい提案をすること
- ユーザーのレベルに適した難易度を選択すること
- 具体的で測定可能な習慣を提案すること（時間、回数などを明示）
- 小さく始められる習慣を優先すること
- 提案理由は個人的で励みになる内容にすること

必ず以下のJSON形式で返してください：
{
  "suggestions": [
    {
      "name": "習慣名（時間などの数値は含めないでください）",
      "description": "習慣の詳細説明（具体的なやり方を含む）",
      "category": "カテゴリ",
      "difficulty": "beginner|intermediate|advanced",
      "frequency": "daily|weekly|3x/week",
      "estimatedTime": "所要時間（例：5分）",
      "estimatedDuration": "習慣化にかかる期間の目安",
      "rationale": "この習慣をおすすめする理由（ユーザー向けの励ましを含む）"
    }
  ]
}`
      : `You are a habit formation expert. Please suggest achievable and sustainable habits considering the user's context.

Important rules:
- Suggest new habits that don't overlap with existing habits
- Choose difficulty appropriate for the user's level
- Suggest specific and measurable habits (include time, frequency, etc.)
- Prioritize habits that can be started small
- Make the rationale personal and encouraging

Always return in the following JSON format:
{
  "suggestions": [
    {
      "name": "Habit name (do not include time/numbers in the name)",
      "description": "Detailed description of the habit (include specific how-to)",
      "category": "category",
      "difficulty": "beginner|intermediate|advanced",
      "frequency": "daily|weekly|3x/week",
      "estimatedTime": "Time required (e.g., 5 min)",
      "estimatedDuration": "Estimated time to establish the habit",
      "rationale": "Why this habit is recommended (include encouragement for user)"
    }
  ]
}`;

    const userPrompt = isJa
      ? `カテゴリ「${category}」で${count}個の習慣を提案してください。

ユーザー情報：
- レベル: ${userLevel}
- 希望頻度: ${preferredFrequency}
- 既存の習慣: ${existingHabits.length > 0 ? existingHabits.join('、') : 'なし'}

既存の習慣と重複しない、このユーザーに適した新しい習慣を提案してください。初心者でも始めやすく、継続しやすい習慣を優先してください。`
      : `Please suggest ${count} habits in the "${category}" category.

User information:
- Level: ${userLevel}
- Preferred frequency: ${preferredFrequency}
- Existing habits: ${existingHabits.length > 0 ? existingHabits.join(', ') : 'None'}

Please suggest new habits that are suitable for this user and don't overlap with their existing habits. Prioritize habits that are easy to start and maintain, even for beginners.`;

    logger.info('Generating habit suggestions with OpenAI', {
      category,
      count,
      userLevel,
      preferredFrequency,
      locale,
    });

    const response = await openai.chat.completions.create({
      model: settings.openaiModel || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.8,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      logger.warning('Empty response from OpenAI for habit suggestions, falling back to templates');
      return generateHabitSuggestions(input, userContext, locale);
    }

    const parsed = JSON.parse(content);
    const suggestions = parsed.suggestions ?? [];

    // Validate and transform suggestions
    const validSuggestions = suggestions
      .filter((s: Record<string, unknown>) => s['name'] && s['description'])
      .map((s: Record<string, unknown>) => ({
        name: String(s['name']),
        description: String(s['description']),
        category: String(s['category'] ?? category),
        difficulty: (['beginner', 'intermediate', 'advanced'].includes(String(s['difficulty']))
          ? String(s['difficulty'])
          : 'beginner') as LevelTier,
        frequency: (['daily', 'weekly', '3x/week'].includes(String(s['frequency']))
          ? String(s['frequency'])
          : 'daily') as 'daily' | 'weekly' | '3x/week',
        estimatedTime: String(s['estimatedTime'] ?? (isJa ? '5分' : '5 min')),
        estimatedDuration: String(s['estimatedDuration'] ?? (isJa ? '2〜3週間で習慣化' : '2-3 weeks to establish')),
        rationale: String(s['rationale'] ?? ''),
        suggestionType: 'habit' as const,
      }));

    logger.info('Generated AI habit suggestions', {
      requestedCount: count,
      generatedCount: validSuggestions.length,
    });

    if (validSuggestions.length === 0) {
      logger.warning('No valid habit suggestions from OpenAI, falling back to templates');
      return generateHabitSuggestions(input, userContext, locale);
    }

    return validSuggestions;
  } catch (error) {
    logger.error('Failed to generate habit suggestions with AI, falling back to templates', error as Error);
    return generateHabitSuggestions(input, userContext, locale);
  }
}

/**
 * Suggest habits for the user
 */
export async function suggestHabitsExecute(
  input: SuggestHabitsInput,
  context: CoachToolContext
): Promise<HabitSuggestionResult> {
  const { locale } = context;
  const isJa = locale === 'ja';

  // Use AI-powered suggestion generation
  const suggestions = await generateHabitSuggestionsWithAI(input, context);

  // Error handling: Empty suggestions list is treated as an error
  if (!suggestions || suggestions.length === 0) {
    const errorMessage = isJa
      ? `カテゴリー「${input.category || '指定なし'}」の習慣提案が見つかりませんでした。別のカテゴリーをお試しください。`
      : `No habit suggestions found for category "${input.category || 'unspecified'}". Please try a different category.`;
    throw new Error(errorMessage);
  }

  // Add follow-up actions for refining suggestions
  const followUpActions: HabitSuggestionResult['followUpActions'] = [
    {
      id: 'more_specific',
      label: isJa ? '🔍 もっと具体的に' : '🔍 More Specific',
      action: 'more_specific',
      category: input.category || 'health',
    },
    {
      id: 'more_general',
      label: isJa ? '🌐 もっと一般的に' : '🌐 More General',
      action: 'more_general',
      category: input.category || 'health',
    },
    {
      id: 'easier',
      label: isJa ? '🌱 もっとやさしく' : '🌱 Easier',
      action: 'easier',
      category: input.category || 'health',
    },
    {
      id: 'harder',
      label: isJa ? '🔥 もっとむずかしく' : '🔥 Harder',
      action: 'harder',
      category: input.category || 'health',
    },
    {
      id: 'different',
      label: isJa ? '🔄 他には？' : '🔄 Show More',
      action: 'different',
      category: input.category || 'health',
    },
  ];

  return { suggestions, followUpActions };
}

// =============================================================================
// Sticky'n (Memo/Note) Suggestion Functions
// =============================================================================

/**
 * Generate Sticky'n suggestions using AI
 * Returns memo/note-type suggestions based on user context
 */
async function generateStickyNSuggestionsWithAI(
  input: SuggestStickyNInput,
  context: CoachToolContext
): Promise<StickyNSuggestionResult['suggestions']> {
  const { locale, userContext } = context;
  const isJa = locale === 'ja';
  const settings = getSettings();
  const openaiApiKey = context.openaiApiKey ?? settings.openaiApiKey;

  // Fall back to template-based if OpenAI is not configured
  if (!openaiApiKey) {
    logger.info('OpenAI API key not configured, using fallback Sticky\'n suggestions');
    return generateFallbackStickyNSuggestions(input, locale);
  }

  try {
    const openai = new OpenAI({ apiKey: openaiApiKey });

    const category = input.category ?? 'idea';
    const count = input.count ?? 3;
    const relatedTo = input.relatedTo ?? 'general';
    const additionalContext = input.context ?? '';

    // Get existing habits/goals for context
    const existingHabits = userContext?.existingHabitNames ?? [];
    const existingGoals = userContext?.existingGoalNames ?? [];

    // Build prompt based on locale
    const systemPrompt = isJa
      ? `あなたはパーソナルアシスタントです。ユーザーの状況に合わせて、有用なメモやリマインダーを提案してください。

重要なルール：
- 実行可能で具体的な内容を提案すること
- ユーザーの既存の習慣や目標に関連づけること
- 短くて覚えやすい内容にすること
- ポジティブで励みになる内容にすること

必ず以下のJSON形式で返してください：
{
  "suggestions": [
    {
      "name": "メモのタイトル（短く簡潔に）",
      "content": "メモの内容（詳細な説明や行動の提案）",
      "category": "カテゴリ",
      "icon": "絵文字アイコン（1つ）",
      "color": "yellow|blue|green|pink|purple",
      "rationale": "このメモをおすすめする理由"
    }
  ]
}`
      : `You are a personal assistant. Please suggest useful memos and reminders tailored to the user's situation.

Important rules:
- Suggest actionable and specific content
- Relate to user's existing habits and goals
- Keep content short and memorable
- Make content positive and encouraging

Always return in the following JSON format:
{
  "suggestions": [
    {
      "name": "Memo title (short and concise)",
      "content": "Memo content (detailed description or action suggestions)",
      "category": "category",
      "icon": "emoji icon (1 character)",
      "color": "yellow|blue|green|pink|purple",
      "rationale": "Why this memo is recommended"
    }
  ]
}`;

    const userPrompt = isJa
      ? `カテゴリ「${category}」で${count}個のSticky'n（メモ）を提案してください。

ユーザー情報：
- 既存の習慣: ${existingHabits.length > 0 ? existingHabits.join('、') : 'なし'}
- 既存の目標: ${existingGoals.length > 0 ? existingGoals.join('、') : 'なし'}
- 関連対象: ${relatedTo === 'habit' ? '習慣' : relatedTo === 'goal' ? '目標' : '一般'}
${additionalContext ? `- 追加コンテキスト: ${additionalContext}` : ''}

ユーザーの習慣や目標に関連した、実用的で励みになるメモを提案してください。`
      : `Please suggest ${count} Sticky'n (memo) in the "${category}" category.

User information:
- Existing habits: ${existingHabits.length > 0 ? existingHabits.join(', ') : 'None'}
- Existing goals: ${existingGoals.length > 0 ? existingGoals.join(', ') : 'None'}
- Related to: ${relatedTo}
${additionalContext ? `- Additional context: ${additionalContext}` : ''}

Please suggest practical and encouraging memos related to the user's habits and goals.`;

    logger.info('Generating Sticky\'n suggestions with OpenAI', {
      category,
      count,
      relatedTo,
      locale,
    });

    const response = await openai.chat.completions.create({
      model: settings.openaiModel || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.8,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      logger.warning('Empty response from OpenAI for Sticky\'n suggestions, falling back to templates');
      return generateFallbackStickyNSuggestions(input, locale);
    }

    const parsed = JSON.parse(content);
    const suggestions = parsed.suggestions ?? [];

    // Validate and transform suggestions
    const validColors = ['yellow', 'blue', 'green', 'pink', 'purple'] as const;
    const validSuggestions = suggestions
      .filter((s: Record<string, unknown>) => s['name'] && s['content'])
      .map((s: Record<string, unknown>) => ({
        name: String(s['name']),
        content: String(s['content']),
        category: String(s['category'] ?? category),
        icon: String(s['icon'] ?? '📌'),
        color: (validColors.includes(String(s['color']) as typeof validColors[number])
          ? String(s['color'])
          : 'yellow') as typeof validColors[number],
        rationale: String(s['rationale'] ?? ''),
        suggestionType: 'stickyn' as const,
      }));

    logger.info('Generated AI Sticky\'n suggestions', {
      requestedCount: count,
      generatedCount: validSuggestions.length,
    });

    if (validSuggestions.length === 0) {
      logger.warning('No valid Sticky\'n suggestions from OpenAI, falling back to templates');
      return generateFallbackStickyNSuggestions(input, locale);
    }

    return validSuggestions;
  } catch (error) {
    logger.error('Failed to generate Sticky\'n suggestions with AI, falling back to templates', error as Error);
    return generateFallbackStickyNSuggestions(input, locale);
  }
}

/**
 * Fallback Sticky'n suggestions when OpenAI is not available
 */
function generateFallbackStickyNSuggestions(
  input: SuggestStickyNInput,
  locale?: 'ja' | 'en'
): StickyNSuggestionResult['suggestions'] {
  const isJa = locale === 'ja';
  const category = input.category ?? 'idea';

  const fallbackSuggestions: Record<string, StickyNSuggestionResult['suggestions']> = {
    idea: [
      {
        name: isJa ? '新しいアイデア' : 'New Idea',
        content: isJa ? 'ここにアイデアを書き留めましょう' : 'Write down your idea here',
        category: 'idea',
        icon: '💡',
        color: 'yellow',
        rationale: isJa ? 'アイデアを逃さず記録しましょう' : 'Don\'t let your ideas slip away',
        suggestionType: 'stickyn',
      },
    ],
    task: [
      {
        name: isJa ? '今日のタスク' : 'Today\'s Task',
        content: isJa ? '今日やるべきことを整理しましょう' : 'Organize what you need to do today',
        category: 'task',
        icon: '✅',
        color: 'blue',
        rationale: isJa ? 'タスクを可視化して達成感を得ましょう' : 'Visualize tasks and feel accomplished',
        suggestionType: 'stickyn',
      },
    ],
    gratitude: [
      {
        name: isJa ? '今日の感謝' : 'Today\'s Gratitude',
        content: isJa ? '今日感謝したいことは何ですか？' : 'What are you grateful for today?',
        category: 'gratitude',
        icon: '🙏',
        color: 'pink',
        rationale: isJa ? '感謝の気持ちを持つとポジティブになれます' : 'Gratitude helps you stay positive',
        suggestionType: 'stickyn',
      },
    ],
    learning: [
      {
        name: isJa ? '今日の学び' : 'Today\'s Learning',
        content: isJa ? '今日学んだことを記録しましょう' : 'Record what you learned today',
        category: 'learning',
        icon: '📚',
        color: 'green',
        rationale: isJa ? '学びを振り返ることで成長を実感できます' : 'Reflecting on learning helps you grow',
        suggestionType: 'stickyn',
      },
    ],
  };

  const result = fallbackSuggestions[category] ?? fallbackSuggestions['idea'];
  return result ?? fallbackSuggestions['idea']!;
}

/**
 * Suggest Sticky'n (memo/note) for the user
 */
export async function suggestStickyNExecute(
  input: SuggestStickyNInput,
  context: CoachToolContext
): Promise<StickyNSuggestionResult> {
  const { locale } = context;
  const isJa = locale === 'ja';

  // Use AI-powered suggestion generation
  const suggestions = await generateStickyNSuggestionsWithAI(input, context);

  // Error handling: Empty suggestions list is treated as an error
  if (!suggestions || suggestions.length === 0) {
    const errorMessage = isJa
      ? `カテゴリー「${input.category || '指定なし'}」のSticky'n提案が見つかりませんでした。別のカテゴリーをお試しください。`
      : `No Sticky'n suggestions found for category "${input.category || 'unspecified'}". Please try a different category.`;
    throw new Error(errorMessage);
  }

  // Add follow-up actions for refining suggestions
  const followUpActions: StickyNSuggestionResult['followUpActions'] = [
    {
      id: 'more_specific',
      label: isJa ? '🔍 もっと具体的に' : '🔍 More Specific',
      action: 'more_specific',
      category: input.category || 'idea',
    },
    {
      id: 'more_general',
      label: isJa ? '🌐 もっと一般的に' : '🌐 More General',
      action: 'more_general',
      category: input.category || 'idea',
    },
    {
      id: 'different',
      label: isJa ? '🔄 他には？' : '🔄 Show More',
      action: 'different',
      category: input.category || 'idea',
    },
  ];

  return { suggestions, followUpActions };
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

/**
 * Generate personalized, creative advice using AI
 * Each call generates unique content based on user context and randomization
 */
export async function generateAdviceExecute(
  input: GenerateAdviceInput,
  context: CoachToolContext
): Promise<AdviceResult> {
  const { supabase, userId, locale } = context;
  const isJa = locale === 'ja';
  const settings = getSettings();
  const openaiApiKey = context.openaiApiKey ?? settings.openaiApiKey;

  // Gather user data for personalization
  let habitStats = { totalHabits: 0, activeHabits: 0, averageCompletion: 0, recentStruggle: '', recentSuccess: '' };
  let goalStats = { totalGoals: 0, progressingGoals: 0 };

  try {
    // Get habit statistics
    const { data: habits } = await supabase
      .from('habits')
      .select('id, name, is_active')
      .eq('user_id', userId);

    if (habits) {
      habitStats.totalHabits = habits.length;
      habitStats.activeHabits = habits.filter((h: { is_active?: boolean }) => h.is_active !== false).length;
    }

    // Get recent completion data
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const { data: completions } = await supabase
      .from('habit_completions')
      .select('habit_id, completed, completed_at, habits(name)')
      .eq('user_id', userId)
      .gte('completed_at', weekAgo);

    if (completions && completions.length > 0) {
      const completed = completions.filter((c: { completed?: boolean }) => c.completed === true).length;
      habitStats.averageCompletion = Math.round((completed / completions.length) * 100);

      // Find recent struggles and successes
      const habitCompletionMap = new Map<string, { total: number; done: number; name: string }>();
      for (const c of completions) {
        const id = String(c.habit_id);
        const habitData = c.habits as { name?: string } | null;
        const existing = habitCompletionMap.get(id) || { total: 0, done: 0, name: String(habitData?.name || 'Unknown') };
        existing.total++;
        if (c.completed) existing.done++;
        habitCompletionMap.set(id, existing);
      }

      let minRate = 100, maxRate = 0;
      let struggleHabit = '', successHabit = '';
      for (const [, data] of habitCompletionMap) {
        const rate = (data.done / data.total) * 100;
        if (rate < minRate) { minRate = rate; struggleHabit = data.name; }
        if (rate > maxRate) { maxRate = rate; successHabit = data.name; }
      }
      habitStats.recentStruggle = struggleHabit;
      habitStats.recentSuccess = successHabit;
    }

    // Get goal count
    const { data: goals } = await supabase
      .from('goals')
      .select('id')
      .eq('user_id', userId);

    if (goals) {
      goalStats.totalGoals = goals.length;
    }
  } catch (error) {
    logger.warning('Failed to fetch user stats for advice generation', { error });
  }

  // Generate unique seed for randomization
  const randomSeed = Date.now() + Math.random() * 10000;
  const perspectives = isJa
    ? ['行動科学', '心理学', 'マインドフルネス', '生産性研究', '脳科学', '習慣形成理論', 'ポジティブ心理学', 'モチベーション理論']
    : ['behavioral science', 'psychology', 'mindfulness', 'productivity research', 'neuroscience', 'habit formation theory', 'positive psychology', 'motivation theory'];
  const randomPerspective = perspectives[Math.floor(randomSeed % perspectives.length)];

  // Build AI prompt
  const adviceTypeDescriptions = {
    general: isJa ? '全般的なコーチングアドバイス' : 'general coaching advice',
    motivation: isJa ? 'モチベーションを高めるアドバイス' : 'motivation-boosting advice',
    strategy: isJa ? '効果的な戦略とアプローチ' : 'effective strategies and approaches',
    recovery: isJa ? '疲労・ストレスからの回復とリラックス法' : 'recovery from fatigue and stress with relaxation techniques',
    celebration: isJa ? '成功を祝い次に進むアドバイス' : 'celebrating success and moving forward',
  };

  // ISS-a956eb83: Recovery専用の追加ガイダンス（疲労・ストレス対応）
  const recoverySpecificGuidance = input.adviceType === 'recovery'
    ? (isJa
      ? `
【重要・必須】疲労・ストレス回復アドバイスには、以下のキーワードを必ず1つ以上含めてください：
- リラックス（リラックスする時間、リラックス法など）
- 呼吸（深呼吸、呼吸法、ゆっくり呼吸など）
- 睡眠（十分な睡眠、早めに休む、休息など）
- 瞑想（5分間の瞑想、マインドフルネスなど）
- 休息（体を休める、休憩を取るなど）

具体的な実践方法を含めてください。例：
- 「4-7-8呼吸法を試してみてください（4秒吸う、7秒止める、8秒で吐く）」
- 「5分間の瞑想アプリを使ってリラックスしましょう」
- 「今日は早めに休息を取り、十分な睡眠を確保しましょう」
- 「肩の力を抜いて、深呼吸を3回してみてください」
`
      : `
【IMPORTANT - REQUIRED】Recovery advice for fatigue/stress MUST include at least one of these keywords:
- Relaxation (relax, relaxation techniques)
- Breathing (deep breathing, breathing exercises)
- Sleep (adequate sleep, rest early)
- Meditation (5-minute meditation, mindfulness)
- Rest (take a break, rest your body)

Include specific practical methods. Examples:
- "Try the 4-7-8 breathing technique (inhale 4s, hold 7s, exhale 8s)"
- "Use a 5-minute meditation app to relax"
- "Rest early today and get adequate sleep"
- "Release tension in your shoulders and take 3 deep breaths"
`)
    : '';

  const systemPrompt = isJa
    ? `あなたは習慣形成と目標達成の専門コーチです。${randomPerspective}の観点からアドバイスを提供してください。

重要なルール：
- 毎回異なる視点、表現、アプローチを使うこと
- ユーザーのデータを活用してパーソナライズすること
- 実践的で行動可能なアドバイスを含めること
- 励ましと共感を込めること
- 創造性レベル${input.creativityLevel}（1=保守的、2=バランス、3=非常にクリエイティブ）で回答すること
${recoverySpecificGuidance}
必ず以下のJSON形式で返してください：
{
  "advice": "メインのアドバイス（100〜200文字）",
  "keyInsight": "核心的な気づき（1〜2文）",
  "motivation": "ユーザーへの励まし（50〜100文字）",
  "actionSteps": ["具体的なアクション1", "具体的なアクション2", "具体的なアクション3"],
  "wisdomQuote": "関連する名言や格言（オプション）"
}`
    : `You are an expert coach in habit formation and goal achievement. Provide advice from the perspective of ${randomPerspective}.

Important rules:
- Use different perspectives, expressions, and approaches each time
- Personalize using user's data
- Include practical and actionable advice
- Be encouraging and empathetic
- Respond with creativity level ${input.creativityLevel} (1=conservative, 2=balanced, 3=highly creative)
${recoverySpecificGuidance}
Always return in the following JSON format:
{
  "advice": "Main advice (100-200 characters)",
  "keyInsight": "Core insight (1-2 sentences)",
  "motivation": "Encouragement for user (50-100 characters)",
  "actionSteps": ["Specific action 1", "Specific action 2", "Specific action 3"],
  "wisdomQuote": "Related quote or wisdom (optional)"
}`;

  const userPrompt = isJa
    ? `${adviceTypeDescriptions[input.adviceType]}を生成してください。

ユーザー情報：
- 登録習慣数: ${habitStats.totalHabits}個
- アクティブ習慣数: ${habitStats.activeHabits}個
- 直近の平均達成率: ${habitStats.averageCompletion}%
- 最近うまくいっている習慣: ${habitStats.recentSuccess || '情報なし'}
- 最近苦戦している習慣: ${habitStats.recentStruggle || '情報なし'}
- 設定中の目標数: ${goalStats.totalGoals}個
- ユーザーの気分: ${input.userMood || '不明'}
${input.focusArea ? `- フォーカスエリア: ${input.focusArea}` : ''}

このユーザーに合った、今日すぐ実践できるアドバイスを提供してください。
ランダムシード: ${randomSeed}（多様性のため）`
    : `Please generate ${adviceTypeDescriptions[input.adviceType]}.

User information:
- Total habits: ${habitStats.totalHabits}
- Active habits: ${habitStats.activeHabits}
- Recent average completion: ${habitStats.averageCompletion}%
- Recently succeeding habit: ${habitStats.recentSuccess || 'No info'}
- Recently struggling habit: ${habitStats.recentStruggle || 'No info'}
- Total goals: ${goalStats.totalGoals}
- User mood: ${input.userMood || 'unknown'}
${input.focusArea ? `- Focus area: ${input.focusArea}` : ''}

Provide advice that fits this user and can be practiced immediately today.
Random seed: ${randomSeed} (for diversity)`;

  // ISS-a956eb83: Recovery専用のfallback advice（疲労・ストレス対応）
  const recoveryFallbackAdvice: AdviceResult = {
    advice: isJa
      ? 'お疲れ様です。体と心を休めることが大切です。まずは深呼吸を3回してみましょう。4秒吸って、7秒止めて、8秒かけて吐く「4-7-8呼吸法」がリラックスに効果的です。'
      : 'You\'ve worked hard. It\'s important to rest your body and mind. Let\'s start with 3 deep breaths. The "4-7-8 breathing technique" (inhale 4s, hold 7s, exhale 8s) is effective for relaxation.',
    keyInsight: isJa
      ? '休息は怠けではなく、次へ進むための大切な投資です。'
      : 'Rest is not laziness, but an important investment for moving forward.',
    motivation: isJa
      ? '今日はゆっくり休んで、明日また元気に始めましょう！'
      : 'Take it easy today and start fresh tomorrow!',
    actionSteps: isJa
      ? ['深呼吸を3回する', '5分間の瞑想またはリラックスタイムを取る', '十分な睡眠を確保する']
      : ['Take 3 deep breaths', '5-minute meditation or relaxation time', 'Get adequate sleep'],
    wisdomQuote: isJa
      ? '休息もまた仕事の一部である - オウィディウス'
      : 'Rest is also a part of work - Ovid',
    adviceType: 'recovery',
    followUpActions: [
      { id: 'more_advice', label: isJa ? '💡 別のアドバイス' : '💡 Different Advice', action: 'more_advice' },
      { id: 'deeper', label: isJa ? '🔍 もっと詳しく' : '🔍 Go Deeper', action: 'deeper' },
      { id: 'action_plan', label: isJa ? '📝 具体的なプラン' : '📝 Action Plan', action: 'action_plan' },
    ],
  };

  // Default fallback in case AI is not available
  const fallbackAdvice: AdviceResult = input.adviceType === 'recovery'
    ? recoveryFallbackAdvice
    : {
        advice: isJa
          ? '小さな一歩から始めましょう。完璧を求めず、まず始めることが大切です。今日できる最も小さなことから取り組んでみてください。'
          : 'Start with small steps. Don\'t aim for perfection, just start. Try tackling the smallest thing you can do today.',
        keyInsight: isJa
          ? '習慣は一度に作られるものではなく、小さな積み重ねで形成されます。'
          : 'Habits are not built at once, but through small accumulations.',
        motivation: isJa
          ? 'あなたは既に前進しています。この調子で続けていきましょう！'
          : 'You\'re already making progress. Keep up the good work!',
        actionSteps: isJa
          ? ['今日の目標を1つだけ決める', '達成したら自分を褒める', '明日の準備をしておく']
          : ['Set just one goal for today', 'Celebrate when you achieve it', 'Prepare for tomorrow'],
        wisdomQuote: isJa
          ? '千里の道も一歩から - 老子'
          : 'A journey of a thousand miles begins with a single step - Lao Tzu',
        adviceType: input.adviceType,
        followUpActions: [
          { id: 'more_advice', label: isJa ? '💡 別のアドバイス' : '💡 Different Advice', action: 'more_advice' },
          { id: 'deeper', label: isJa ? '🔍 もっと詳しく' : '🔍 Go Deeper', action: 'deeper' },
          { id: 'action_plan', label: isJa ? '📝 具体的なプラン' : '📝 Action Plan', action: 'action_plan' },
        ],
      };

  // If no OpenAI key, return fallback
  if (!openaiApiKey) {
    logger.info('OpenAI API key not configured, returning fallback advice');
    return fallbackAdvice;
  }

  try {
    const openai = new OpenAI({ apiKey: openaiApiKey });

    logger.info('Generating advice with OpenAI', {
      adviceType: input.adviceType,
      creativityLevel: input.creativityLevel,
      locale,
    });

    // Use higher temperature for more creative responses
    const temperature = 0.9 + (input.creativityLevel - 1) * 0.15; // 0.9, 1.05, or 1.2

    const response = await openai.chat.completions.create({
      model: settings.openaiModel || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
      max_tokens: 1500,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      logger.warning('Empty response from OpenAI for advice generation');
      return fallbackAdvice;
    }

    const parsed = JSON.parse(content);

    const result: AdviceResult = {
      advice: String(parsed.advice || fallbackAdvice.advice),
      keyInsight: String(parsed.keyInsight || fallbackAdvice.keyInsight),
      motivation: String(parsed.motivation || fallbackAdvice.motivation),
      actionSteps: Array.isArray(parsed.actionSteps)
        ? (parsed.actionSteps as unknown[]).map(String)
        : fallbackAdvice.actionSteps,
      wisdomQuote: parsed.wisdomQuote ? String(parsed.wisdomQuote) : undefined,
      adviceType: input.adviceType,
      followUpActions: [
        { id: 'more_advice', label: isJa ? '💡 別のアドバイス' : '💡 Different Advice', action: 'more_advice' },
        { id: 'deeper', label: isJa ? '🔍 もっと詳しく' : '🔍 Go Deeper', action: 'deeper' },
        { id: 'different_angle', label: isJa ? '🔄 別の視点から' : '🔄 Different Angle', action: 'different_angle' },
        { id: 'action_plan', label: isJa ? '📝 具体的なプラン' : '📝 Action Plan', action: 'action_plan' },
      ],
    };

    logger.info('Generated AI advice successfully', {
      adviceType: input.adviceType,
      hasQuote: !!result.wisdomQuote,
      actionStepsCount: result.actionSteps.length,
    });

    return result;
  } catch (error) {
    logger.error('Failed to generate advice with AI', error as Error);
    return fallbackAdvice;
  }
}

/**
 * Category selection result
 */
export interface CategorySelectionResult {
  message: string;
  /** The type of selection (habit_category, goal_category, or difficulty) - used by frontend to determine correct follow-up action */
  selectionType: 'habit_category' | 'goal_category' | 'difficulty';
  quickReplies: Array<{
    id: string;
    label: string;
    value: string;
    icon: string;
  }>;
}

/**
 * Show category selection buttons
 */
export async function showCategorySelectionExecute(
  input: ShowCategorySelectionInput,
  context: CoachToolContext
): Promise<CategorySelectionResult> {
  const { locale } = context;
  const isJa = locale === 'ja';

  // Habit categories - IDs must match HABIT_CATEGORIES in tool-config.ts
  const habitCategories = [
    { id: 'health', icon: '💪', labelJa: '健康・運動', labelEn: 'Health & Fitness' },
    { id: 'learning', icon: '📚', labelJa: '学習・読書', labelEn: 'Learning & Reading' },
    { id: 'productivity', icon: '⚡', labelJa: '仕事・生産性', labelEn: 'Work & Productivity' },
    { id: 'wellness', icon: '🧘', labelJa: 'メンタル・瞑想', labelEn: 'Mental & Mindfulness' },
    { id: 'relationships', icon: '👥', labelJa: '人間関係', labelEn: 'Social & Relationships' },
    { id: 'hobbies', icon: '🎨', labelJa: '趣味・創作', labelEn: 'Hobbies & Creative' },
  ];

  // Goal categories - IDs must match GOAL_CATEGORIES in tool-config.ts
  const goalCategories = [
    { id: 'health', icon: '💪', labelJa: '健康目標', labelEn: 'Health Goals' },
    { id: 'career', icon: '💼', labelJa: 'キャリア目標', labelEn: 'Career Goals' },
    { id: 'learning', icon: '📚', labelJa: '学習目標', labelEn: 'Learning Goals' },
    { id: 'finance', icon: '💰', labelJa: '貯蓄・財務', labelEn: 'Financial Goals' },
    { id: 'relationships', icon: '❤️', labelJa: '人間関係', labelEn: 'Relationship Goals' },
    { id: 'lifestyle', icon: '🌟', labelJa: '自己成長', labelEn: 'Personal Growth' },
  ];

  const difficultyOptions = [
    { id: 'beginner', icon: '🌱', labelJa: '初心者向け（1日5分以内）', labelEn: 'Beginner (under 5 min/day)' },
    { id: 'intermediate', icon: '🌿', labelJa: '中級者向け（1日15分程度）', labelEn: 'Intermediate (about 15 min/day)' },
    { id: 'advanced', icon: '🌳', labelJa: '上級者向け（1日30分以上）', labelEn: 'Advanced (30+ min/day)' },
  ];

  let categories: typeof habitCategories;
  switch (input.selectionType) {
    case 'habit_category':
      categories = habitCategories;
      break;
    case 'goal_category':
      categories = goalCategories;
      break;
    case 'difficulty':
      categories = difficultyOptions;
      break;
    default:
      categories = habitCategories;
  }

  return {
    message: input.message,
    selectionType: input.selectionType,
    quickReplies: categories.map(cat => ({
      id: cat.id,
      label: isJa ? cat.labelJa : cat.labelEn,
      value: cat.id,
      icon: cat.icon,
    })),
  };
}

/**
 * Show user's existing habits as selection buttons
 */
export async function showHabitSelectionExecute(
  input: ShowHabitSelectionInput,
  context: CoachToolContext
): Promise<HabitSelectionResult> {
  const { supabase, userId, locale } = context;
  const isJa = locale === 'ja';
  const maxItems = input.maxItems ?? 10;

  // Fetch user's habits from database
  // Note: habits table uses owner_id (not user_id) and owner_type for polymorphic association
  // Note: habits table uses 'active' column (not 'archived')
  const { data: habits, error } = await supabase
    .from('habits')
    .select('id, name')
    .eq('owner_type', 'user')
    .eq('owner_id', userId)
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(maxItems);

  if (error) {
    console.error('[showHabitSelection] Failed to fetch habits:', error);
    const errorMessage = isJa
      ? '習慣データの取得に失敗しました。しばらく経ってからもう一度お試しください。'
      : 'Failed to fetch habit data. Please try again later.';
    throw new Error(errorMessage);
  }

  const quickReplies: HabitSelectionResult['quickReplies'] = [];

  // Add "All habits" option if requested
  if (input.includeAll) {
    quickReplies.push({
      id: 'all',
      label: isJa ? '📊 全ての習慣' : '📊 All Habits',
      value: 'all',
      icon: '📊',
    });
  }

  // Add user's habits (use ✅ as default icon since emoji column doesn't exist)
  for (const habit of habits || []) {
    quickReplies.push({
      id: habit.id,
      label: `✅ ${habit.name}`,
      value: habit.id,
      icon: '✅',
    });
  }

  // If no habits, add a helpful message button
  if ((habits || []).length === 0) {
    quickReplies.push({
      id: 'no-habits',
      label: isJa ? '➕ 新しい習慣を追加' : '➕ Add New Habit',
      value: 'add-new-habit',
      icon: '➕',
    });
  }

  return {
    message: input.message,
    quickReplies,
  };
}

/**
 * Show user's existing goals as selection buttons
 */
export async function showGoalSelectionExecute(
  input: ShowGoalSelectionInput,
  context: CoachToolContext
): Promise<GoalSelectionResult> {
  const { supabase, userId, locale } = context;
  const isJa = locale === 'ja';
  const maxItems = input.maxItems ?? 10;

  // Fetch user's goals from database
  // Note: goals table uses owner_id and owner_type for polymorphic association
  const { data: goals, error } = await supabase
    .from('goals')
    .select('id, name')
    .eq('owner_type', 'user')
    .eq('owner_id', userId)
    .eq('is_completed', false)
    .order('created_at', { ascending: false })
    .limit(maxItems);

  if (error) {
    console.error('[showGoalSelection] Failed to fetch goals:', error);
    const errorMessage = isJa
      ? '目標データの取得に失敗しました。しばらく経ってからもう一度お試しください。'
      : 'Failed to fetch goal data. Please try again later.';
    throw new Error(errorMessage);
  }

  const quickReplies: GoalSelectionResult['quickReplies'] = [];

  // Add "All goals" option if requested
  if (input.includeAll) {
    quickReplies.push({
      id: 'all',
      label: isJa ? '🎯 全ての目標' : '🎯 All Goals',
      value: 'all',
      icon: '🎯',
    });
  }

  // Add user's goals (use 🎯 as default icon since emoji column doesn't exist)
  for (const goal of goals || []) {
    quickReplies.push({
      id: goal.id,
      label: `🎯 ${goal.name}`,
      value: goal.id,
      icon: '🎯',
    });
  }

  // If no goals, add a helpful message button
  if ((goals || []).length === 0) {
    quickReplies.push({
      id: 'no-goals',
      label: isJa ? '➕ 新しい目標を追加' : '➕ Add New Goal',
      value: 'add-new-goal',
      icon: '➕',
    });
  }

  return {
    message: input.message,
    quickReplies,
  };
}

/**
 * Refinement result
 */
export interface RefinementResult {
  suggestions: HabitSuggestionResult['suggestions'];
  followUpActions: Array<{
    id: string;
    label: string;
    action: 'more_specific' | 'more_general' | 'easier' | 'harder' | 'different';
    category: string;
  }>;
}

/**
 * Refine suggestions based on user feedback
 */
export async function refineSuggestionsExecute(
  input: RefineSuggestionsInput,
  context: CoachToolContext
): Promise<RefinementResult> {
  const { locale, userContext } = context;
  const isJa = locale === 'ja';

  // Determine new difficulty based on refinement type
  let newDifficulty: 'beginner' | 'intermediate' | 'advanced' = input.currentDifficulty ?? 'beginner';
  if (input.refinementType === 'easier') {
    newDifficulty = 'beginner';
  } else if (input.refinementType === 'harder') {
    newDifficulty = input.currentDifficulty === 'beginner' ? 'intermediate' : 'advanced';
  }

  // Determine specificity level based on refinement type
  // Each call to 'more_specific' increases the specificity level
  // Each call to 'more_general' decreases the specificity level
  let specificityLevel = input.specificityLevel ?? 1;
  if (input.refinementType === 'more_specific') {
    specificityLevel = Math.min(3, specificityLevel + 1);
  } else if (input.refinementType === 'more_general') {
    specificityLevel = Math.max(0, specificityLevel - 1);
  }

  // Get exclude names from input (to show different suggestions)
  const excludeNames = input.excludeSuggestionNames ?? [];

  // Generate a unique shuffle seed based on current time and refinement type
  // This ensures different results on each refinement request
  const shuffleSeed = Date.now() + input.refinementType.charCodeAt(0);

  // Generate new suggestions with adjusted difficulty and options
  const adjustedContext = userContext
    ? { ...userContext, userLevel: newDifficulty }
    : { userLevel: newDifficulty } as { userLevel: 'beginner' | 'intermediate' | 'advanced' };

  const suggestions = await generateHabitSuggestions(
    {
      category: input.currentCategory as typeof HABIT_CATEGORIES[number],
      count: 3,
      considerExisting: true,
    },
    adjustedContext as UserContext | undefined,
    locale,
    {
      specificityLevel,
      excludeNames,
      shuffleSeed,
    }
  );

  // Update specificity level for next refinement
  const nextSpecificityLevel = input.refinementType === 'more_specific' || input.refinementType === 'more_general' ? specificityLevel : 1;

  const followUpActions = [
    {
      id: 'more_specific',
      label: isJa ? '🔍 もっと具体的に' : '🔍 More Specific',
      action: 'more_specific' as const,
      category: input.currentCategory,
      specificityLevel: nextSpecificityLevel,
    },
    {
      id: 'more_general',
      label: isJa ? '🌐 もっと一般的に' : '🌐 More General',
      action: 'more_general' as const,
      category: input.currentCategory,
      specificityLevel: nextSpecificityLevel,
    },
    {
      id: 'easier',
      label: isJa ? '🌱 もっとやさしく' : '🌱 Easier',
      action: 'easier' as const,
      category: input.currentCategory,
    },
    {
      id: 'harder',
      label: isJa ? '🔥 もっとむずかしく' : '🔥 Harder',
      action: 'harder' as const,
      category: input.currentCategory,
    },
    {
      id: 'different',
      label: isJa ? '🔄 別のジャンル' : '🔄 Different Category',
      action: 'different' as const,
      category: input.currentCategory,
    },
  ];

  return { suggestions, followUpActions };
}

/**
 * Suggest improvements for an existing habit
 * If no habitId is provided, returns habit selection buttons first
 */
export async function suggestHabitImprovementsExecute(
  input: SuggestHabitImprovementsInput,
  context: CoachToolContext
): Promise<HabitImprovementResult> {
  const { supabase, userId, locale } = context;
  const isJa = locale === 'ja';
  const settings = getSettings();
  const openaiApiKey = context.openaiApiKey ?? settings.openaiApiKey;

  // If no habitId provided, return habit selection
  if (!input.habitId) {
    // Fetch user's habits for selection
    const { data: habits, error } = await supabase
      .from('habits')
      .select('id, name')
      .eq('owner_type', 'user')
      .eq('owner_id', userId)
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      logger.error('Failed to fetch habits for improvement selection', error as Error);
      throw new Error(isJa ? '習慣の取得に失敗しました' : 'Failed to fetch habits');
    }

    if (!habits || habits.length === 0) {
      return {
        habit: { id: '', name: '', currentCompletionRate: 0, currentStreak: 0, frequency: '' },
        statusSummary: isJa
          ? 'まだ習慣が登録されていません。まずは新しい習慣を始めてみましょう！'
          : 'No habits registered yet. Let\'s start with a new habit!',
        improvements: [],
        followUpActions: [],
        quickReplies: [{
          id: 'add-new-habit',
          label: isJa ? '➕ 新しい習慣を追加' : '➕ Add New Habit',
          value: 'add-new-habit',
          icon: '➕',
        }],
      };
    }

    // Return habit selection
    return {
      habit: { id: '', name: '', currentCompletionRate: 0, currentStreak: 0, frequency: '' },
      statusSummary: isJa
        ? 'どの習慣を改善しますか？選択してください。'
        : 'Which habit would you like to improve? Please select.',
      improvements: [],
      followUpActions: [],
      quickReplies: habits.map((h: { id: string; name: string }) => ({
        id: h.id,
        label: `✅ ${h.name}`,
        value: h.id,
        icon: '✅',
      })),
    };
  }

  // Fetch the specific habit with completion data
  const { data: habit, error: habitError } = await supabase
    .from('habits')
    .select('id, name, frequency, target_count, workload_unit, level')
    .eq('id', input.habitId)
    .eq('owner_type', 'user')
    .eq('owner_id', userId)
    .single();

  if (habitError || !habit) {
    logger.error('Failed to fetch habit', habitError as Error, { habitId: input.habitId });
    throw new Error(isJa ? '習慣が見つかりません' : 'Habit not found');
  }

  // Get completion data for the last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const { data: completions } = await supabase
    .from('habit_completions')
    .select('completed, completed_at')
    .eq('habit_id', input.habitId)
    .eq('user_id', userId)
    .gte('completed_at', thirtyDaysAgo);

  const totalCompletions = completions?.length || 0;
  const successfulCompletions = completions?.filter((c: { completed: boolean }) => c.completed).length || 0;
  const completionRate = totalCompletions > 0 ? Math.round((successfulCompletions / totalCompletions) * 100) : 0;

  // Calculate current streak
  let currentStreak = 0;
  if (completions && completions.length > 0) {
    const sortedCompletions = [...completions].sort((a, b) =>
      new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
    );
    for (const c of sortedCompletions) {
      if (c.completed) currentStreak++;
      else break;
    }
  }

  const habitInfo = {
    id: habit.id,
    name: habit.name,
    currentCompletionRate: completionRate,
    currentStreak,
    frequency: habit.frequency || 'daily',
    level: habit.level,
  };

  // Generate status summary
  let statusSummary: string;
  if (completionRate >= 80) {
    statusSummary = isJa
      ? `「${habit.name}」は達成率${completionRate}%と素晴らしい成績です！さらに高みを目指しましょう。`
      : `"${habit.name}" has an excellent ${completionRate}% completion rate! Let's aim even higher.`;
  } else if (completionRate >= 50) {
    statusSummary = isJa
      ? `「${habit.name}」は達成率${completionRate}%です。あと少しで安定した習慣になりますね。`
      : `"${habit.name}" has a ${completionRate}% completion rate. Just a bit more to make it a stable habit.`;
  } else {
    statusSummary = isJa
      ? `「${habit.name}」は達成率${completionRate}%です。改善の余地がありますね。一緒に工夫しましょう。`
      : `"${habit.name}" has a ${completionRate}% completion rate. There's room for improvement. Let's work on it together.`;
  }

  // Generate improvements using AI
  const improvementFocus = input.improvementFocus || 'general';
  const focusDescriptions = {
    efficiency: isJa ? '効率性（より短時間で達成）' : 'efficiency (achieve in less time)',
    consistency: isJa ? '一貫性（達成率向上）' : 'consistency (improve completion rate)',
    difficulty: isJa ? '難易度調整' : 'difficulty adjustment',
    engagement: isJa ? '楽しさ・モチベーション' : 'engagement and motivation',
    general: isJa ? '全般的な改善' : 'general improvement',
  };

  // Generate AI-powered improvement suggestions
  const systemPrompt = isJa
    ? `あなたは習慣コーチです。ユーザーの習慣を分析し、具体的で実行可能な改善提案を生成してください。

改善提案のルール：
1. 各提案は具体的で実行可能であること
2. ユーザーの現状（達成率、頻度、レベル）を考慮すること
3. 小さな変更から始められるものを含めること
4. 科学的根拠に基づいたアドバイスを心がけること

必ず以下のJSON形式で返してください：
{
  "improvements": [
    {
      "id": "improvement_1",
      "title": "改善案のタイトル（簡潔に）",
      "description": "改善案の詳細説明（50-100文字）",
      "category": "efficiency|consistency|difficulty|engagement|general",
      "impact": "high|medium|low",
      "effort": "easy|moderate|challenging",
      "rationale": "なぜこの改善が効果的か（50-100文字）",
      "actionSteps": ["具体的なステップ1", "具体的なステップ2", "具体的なステップ3"]
    }
  ]
}`
    : `You are a habit coach. Analyze the user's habit and generate specific, actionable improvement suggestions.

Improvement rules:
1. Each suggestion must be specific and actionable
2. Consider user's current status (completion rate, frequency, level)
3. Include changes that can start small
4. Base advice on scientific evidence

Always return in the following JSON format:
{
  "improvements": [
    {
      "id": "improvement_1",
      "title": "Improvement title (concise)",
      "description": "Detailed description (50-100 chars)",
      "category": "efficiency|consistency|difficulty|engagement|general",
      "impact": "high|medium|low",
      "effort": "easy|moderate|challenging",
      "rationale": "Why this improvement is effective (50-100 chars)",
      "actionSteps": ["Specific step 1", "Specific step 2", "Specific step 3"]
    }
  ]
}`;

  const userPrompt = isJa
    ? `以下の習慣について、${focusDescriptions[improvementFocus]}に焦点を当てた改善提案を${input.maxSuggestions}個生成してください。

習慣情報：
- 名前: ${habit.name}
- 頻度: ${habit.frequency || 'daily'}
- 現在の達成率: ${completionRate}%
- 現在の連続記録: ${currentStreak}日
- レベル: ${habit.level || '不明'}
- 目標回数: ${habit.target_count || 1}
- 単位: ${habit.workload_unit || '回'}`
    : `Generate ${input.maxSuggestions} improvement suggestions for the following habit, focusing on ${focusDescriptions[improvementFocus]}.

Habit info:
- Name: ${habit.name}
- Frequency: ${habit.frequency || 'daily'}
- Current completion rate: ${completionRate}%
- Current streak: ${currentStreak} days
- Level: ${habit.level || 'unknown'}
- Target count: ${habit.target_count || 1}
- Unit: ${habit.workload_unit || 'times'}`;

  // Default improvements if AI is not available
  const defaultImprovements: HabitImprovementResult['improvements'] = [
    {
      id: 'default_1',
      title: isJa ? '時間を固定する' : 'Fix the time',
      description: isJa
        ? '毎日同じ時間に行うことで習慣化が加速します'
        : 'Doing it at the same time every day accelerates habit formation',
      category: 'consistency',
      impact: 'high',
      effort: 'easy',
      rationale: isJa
        ? '脳は決まった時間の行動を自動化しやすいです'
        : 'The brain easily automates actions at fixed times',
      actionSteps: isJa
        ? ['実行する時間を決める', 'スマホにリマインダーを設定', '最初の1週間は意識して続ける']
        : ['Decide on a time', 'Set a reminder on your phone', 'Stay conscious for the first week'],
      suggestionType: 'reply',
    },
    {
      id: 'default_2',
      title: isJa ? '既存の習慣に紐付ける' : 'Link to existing habit',
      description: isJa
        ? '既に習慣化されている行動の後に行う（習慣スタッキング）'
        : 'Do it after an already established habit (habit stacking)',
      category: 'consistency',
      impact: 'high',
      effort: 'easy',
      rationale: isJa
        ? '既存の習慣がトリガーになり、忘れにくくなります'
        : 'Existing habits serve as triggers, making it harder to forget',
      actionSteps: isJa
        ? ['毎日欠かさない習慣を1つ選ぶ', 'その直後にこの習慣を行う', '「〇〇した後に△△する」と宣言する']
        : ['Choose one habit you never miss', 'Do this habit right after', 'Declare "After X, I will do Y"'],
      suggestionType: 'reply',
    },
    {
      id: 'default_3',
      title: isJa ? 'ハードルを下げる' : 'Lower the barrier',
      description: isJa
        ? '最小限の労力で始められるように環境を整える'
        : 'Set up the environment to start with minimal effort',
      category: 'efficiency',
      impact: 'medium',
      effort: 'easy',
      rationale: isJa
        ? '始めるまでのハードルが低いほど継続しやすいです'
        : 'The lower the barrier to start, the easier to continue',
      actionSteps: isJa
        ? ['必要な道具を目につく場所に置く', '準備時間を最小化する', '「2分ルール」で小さく始める']
        : ['Place necessary tools in visible spots', 'Minimize preparation time', 'Start small with "2-minute rule"'],
      suggestionType: 'reply',
    },
  ];

  let improvements = defaultImprovements.slice(0, input.maxSuggestions);

  // Try to generate AI improvements if API key is available
  if (openaiApiKey) {
    try {
      const openai = new OpenAI({ apiKey: openaiApiKey });

      logger.info('Generating habit improvements with AI', {
        habitId: input.habitId,
        focus: improvementFocus,
      });

      const response = await openai.chat.completions.create({
        model: settings.openaiModel || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.8,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        if (parsed.improvements && Array.isArray(parsed.improvements)) {
          improvements = parsed.improvements.slice(0, input.maxSuggestions).map((imp: {
            id?: string;
            title: string;
            description: string;
            category?: string;
            impact?: string;
            effort?: string;
            rationale: string;
            actionSteps?: string[];
          }, index: number) => ({
            id: imp.id || `improvement_${index + 1}`,
            title: String(imp.title),
            description: String(imp.description),
            category: (['efficiency', 'consistency', 'difficulty', 'engagement', 'general'].includes(imp.category || '')
              ? imp.category
              : 'general') as HabitImprovementResult['improvements'][0]['category'],
            impact: (['high', 'medium', 'low'].includes(imp.impact || '')
              ? imp.impact
              : 'medium') as HabitImprovementResult['improvements'][0]['impact'],
            effort: (['easy', 'moderate', 'challenging'].includes(imp.effort || '')
              ? imp.effort
              : 'moderate') as HabitImprovementResult['improvements'][0]['effort'],
            rationale: String(imp.rationale),
            actionSteps: Array.isArray(imp.actionSteps)
              ? imp.actionSteps.map(String)
              : defaultImprovements[0]?.actionSteps || [],
            suggestionType: 'reply' as const,
          }));

          logger.info('AI-generated habit improvements', {
            habitId: input.habitId,
            count: improvements.length,
          });
        }
      }
    } catch (error) {
      logger.warning('Failed to generate AI improvements, using defaults', { error });
    }
  }

  const followUpActions: HabitImprovementResult['followUpActions'] = [
    {
      id: 'more_suggestions',
      label: isJa ? '💡 他の改善案を見る' : '💡 See More Suggestions',
      action: 'more_suggestions',
    },
    {
      id: 'different_habit',
      label: isJa ? '🔄 別の習慣を改善' : '🔄 Improve Different Habit',
      action: 'different_habit',
    },
  ];

  return {
    habit: habitInfo,
    statusSummary,
    improvements,
    followUpActions,
  };
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
 * Suggest habits tool definition
 */
export const suggestHabitsTool: SharedCoachTool<SuggestHabitsInput, HabitSuggestionResult> = {
  name: 'suggest_habits',
  description: 'Suggest personalized habits based on user context and preferences. Returns habit suggestions with name, description, frequency, and rationale.',
  descriptionJa: 'ユーザーのコンテキストと好みに基づいてパーソナライズされた習慣を提案します。',
  inputSchema: SuggestHabitsSchema as z.ZodSchema<SuggestHabitsInput>,
  execute: suggestHabitsExecute,
};

/**
 * Suggest Sticky'n (memo/note) tool definition
 * Use this when user wants to create notes, reminders, or capture ideas
 */
export const suggestStickyNTool: SharedCoachTool<SuggestStickyNInput, StickyNSuggestionResult> = {
  name: 'suggest_stickyn',
  description: 'Suggest Sticky\'n (memo/note) content for the user. Use when user wants to: capture ideas, create reminders, organize thoughts, record learnings, express gratitude, or track tasks. Returns Sticky\'n suggestions with title, content, category, and rationale.',
  descriptionJa: 'ユーザー向けのSticky\'n（メモ/ノート）コンテンツを提案します。アイデアの記録、リマインダー作成、思考の整理、学びの記録、感謝の表現、タスク管理などに使用します。',
  inputSchema: SuggestStickyNSchema as z.ZodSchema<SuggestStickyNInput>,
  execute: suggestStickyNExecute,
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

/**
 * Generate advice tool definition
 * IMPORTANT: Use this tool when user asks for general advice ("アドバイスして", "おすすめは？", "どうすれば", etc.)
 * Generates unique, personalized advice each time using AI with high creativity.
 */
export const generateAdviceTool: SharedCoachTool<GenerateAdviceInput, AdviceResult> = {
  name: 'generate_advice',
  description: 'Generate personalized, creative coaching advice. Use this when user asks for advice, tips, or recommendations without specifying a particular habit or goal. Each call generates unique content based on user context. ALWAYS use this tool for "アドバイスして", "おすすめは？", "どうすれば", "コツを教えて" requests.',
  descriptionJa: 'パーソナライズされた創造的なコーチングアドバイスを生成します。特定の習慣や目標を指定せずにアドバイス、ヒント、おすすめを求められた場合に使用します。毎回ユーザーの状況に基づいた異なるコンテンツを生成します。「アドバイスして」「おすすめは？」「どうすれば」「コツを教えて」などのリクエストには必ずこのツールを使用してください。',
  inputSchema: GenerateAdviceSchema as z.ZodSchema<GenerateAdviceInput>,
  execute: generateAdviceExecute,
};

/**
 * Show category selection tool definition
 */
export const showCategorySelectionTool: SharedCoachTool<ShowCategorySelectionInput, CategorySelectionResult> = {
  name: 'show_category_selection',
  description: 'Show category selection buttons when user request is vague. Use this to let user choose a category (habit_category, goal_category, or difficulty).',
  descriptionJa: 'ユーザーのリクエストが漠然としている場合にカテゴリー選択ボタンを表示します。習慣カテゴリー、目標カテゴリー、または難易度の選択に使用します。',
  inputSchema: ShowCategorySelectionSchema as z.ZodSchema<ShowCategorySelectionInput>,
  execute: showCategorySelectionExecute,
};

/**
 * Show habit selection tool definition
 * IMPORTANT: Use this tool when user asks about their existing habits (progress, analysis, specific habit info).
 * Shows the user's actual habits as clickable buttons for easy selection.
 */
export const showHabitSelectionTool: SharedCoachTool<ShowHabitSelectionInput, HabitSelectionResult> = {
  name: 'show_habit_selection',
  description: 'Show user\'s existing habits as selection buttons. Use this when user asks about specific habits, habit progress, or needs to select which habit to work with. ALWAYS use this tool when asking "which habit?" instead of asking for an ID.',
  descriptionJa: 'ユーザーの既存の習慣を選択ボタンとして表示します。特定の習慣についての質問、習慣の進捗確認、またはどの習慣を対象にするか選択が必要な場合に使用してください。「どの習慣ですか？」と聞く代わりに、必ずこのツールを使用してください。',
  inputSchema: ShowHabitSelectionSchema as z.ZodSchema<ShowHabitSelectionInput>,
  execute: showHabitSelectionExecute,
};

/**
 * Show goal selection tool definition
 * IMPORTANT: Use this tool when user asks about their existing goals (progress, analysis, specific goal info).
 * Shows the user's actual goals as clickable buttons for easy selection.
 */
export const showGoalSelectionTool: SharedCoachTool<ShowGoalSelectionInput, GoalSelectionResult> = {
  name: 'show_goal_selection',
  description: 'Show user\'s existing goals as selection buttons. Use this when user asks about specific goals, goal progress, or needs to select which goal to work with. ALWAYS use this tool when asking "which goal?" instead of asking for an ID.',
  descriptionJa: 'ユーザーの既存の目標を選択ボタンとして表示します。特定の目標についての質問、目標の進捗確認、またはどの目標を対象にするか選択が必要な場合に使用してください。「どの目標ですか？」と聞く代わりに、必ずこのツールを使用してください。',
  inputSchema: ShowGoalSelectionSchema as z.ZodSchema<ShowGoalSelectionInput>,
  execute: showGoalSelectionExecute,
};

/**
 * Refine suggestions tool definition
 */
export const refineSuggestionsTool: SharedCoachTool<RefineSuggestionsInput, RefinementResult> = {
  name: 'refine_suggestions',
  description: 'Refine suggestions to be more specific, easier, harder, or different category.',
  descriptionJa: 'より具体的に、より簡単に、より難しく、または別のカテゴリーに提案を調整します。',
  inputSchema: RefineSuggestionsSchema as z.ZodSchema<RefineSuggestionsInput>,
  execute: refineSuggestionsExecute,
};

/**
 * Suggest habit improvements tool definition
 * IMPORTANT: Use this tool when user wants to improve or optimize their existing habits.
 * Responds to: "改善したい", "もっと良くしたい", "習慣を改善", "効率を上げたい", etc.
 */
export const suggestHabitImprovementsTool: SharedCoachTool<SuggestHabitImprovementsInput, HabitImprovementResult> = {
  name: 'suggest_habit_improvements',
  description: 'Suggest improvements for existing habits. Use this when user wants to improve, optimize, or make their habits better. Shows habit selection if no specific habit is provided. ALWAYS use for "改善したい", "もっと良くしたい", "効率を上げたい", "習慣を見直したい" requests.',
  descriptionJa: '既存の習慣の改善案を提案します。ユーザーが習慣を改善したい、最適化したい、より良くしたいときに使用します。特定の習慣が指定されていない場合は習慣選択を表示します。「改善したい」「もっと良くしたい」「効率を上げたい」「習慣を見直したい」などのリクエストには必ずこのツールを使用してください。',
  inputSchema: SuggestHabitImprovementsSchema as z.ZodSchema<SuggestHabitImprovementsInput>,
  execute: suggestHabitImprovementsExecute,
};

/**
 * Show choice buttons - 汎用的な選択肢ボタン表示
 * 【最重要】テキストで選択肢を列挙する代わりに、必ずこのツールでボタン形式で表示する
 */
export async function showChoiceButtonsExecute(
  input: ShowChoiceButtonsInput,
  _context: CoachToolContext
): Promise<ChoiceButtonsResult> {
  const { title, choices, layout, size } = input;

  // Limit to 6 choices (2-6 recommended)
  const limitedChoices = choices.slice(0, 6);

  // Determine default layout based on choice count
  const defaultLayout = limitedChoices.length <= 3 ? 'horizontal' : 'vertical';

  return {
    type: 'ui_component',
    component: 'choice_buttons',
    data: {
      title,
      choices: limitedChoices.map(c => {
        const choice: { id: string; label: string; type: string; icon: string; description?: string } = {
          id: c.id,
          label: c.label,
          type: c.type || 'reply', // デフォルトは'reply'型
          icon: c.icon || '📌',
        };
        if (c.description) {
          choice.description = c.description;
        }
        return choice;
      }),
      layout: layout || defaultLayout,
      size: size || 'md',
    },
  };
}

/**
 * Show choice buttons tool definition
 * 【最重要】テキストで選択肢を列挙する代わりに、必ずこのツールでボタン形式で表示する
 * 例: 「散歩」「ストレッチ」「ウォーキング」などの選択肢をボタンとして表示
 */
export const showChoiceButtonsTool: SharedCoachTool<ShowChoiceButtonsInput, ChoiceButtonsResult> = {
  name: 'show_choice_buttons',
  description: '【CRITICAL】Display choices as clickable buttons instead of text list. ALWAYS use this tool when presenting options to user. Never use numbered text lists (1. 2. 3.) - always use this tool for better UX. Use for: exercise type selection, frequency options, next action suggestions, etc.',
  descriptionJa: '【最重要・必須】選択肢をボタン形式で表示します。テキストの番号リスト（1. 2. 3.）は絶対禁止。必ずこのツールを使ってボタンで表示してください。用途: 運動の種類の選択、頻度の選択、次のアクションの選択など。',
  inputSchema: ShowChoiceButtonsSchema as z.ZodSchema<ShowChoiceButtonsInput>,
  execute: showChoiceButtonsExecute,
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
  suggestHabits: suggestHabitsTool,
  suggestStickyN: suggestStickyNTool,
  checkProgress: checkProgressTool,
  generateBabySteps: generateBabyStepsTool,
  generateAdvice: generateAdviceTool,
  showCategorySelection: showCategorySelectionTool,
  showHabitSelection: showHabitSelectionTool,
  showGoalSelection: showGoalSelectionTool,
  refineSuggestions: refineSuggestionsTool,
  suggestHabitImprovements: suggestHabitImprovementsTool,
  showChoiceButtons: showChoiceButtonsTool,
} as const;

/**
 * All shared coach tools as an array
 */
export const sharedCoachToolList: SharedCoachTool<unknown, unknown>[] = [
  analyzeHabitsTool as SharedCoachTool<unknown, unknown>,
  suggestGoalsTool as SharedCoachTool<unknown, unknown>,
  suggestHabitsTool as SharedCoachTool<unknown, unknown>,
  suggestStickyNTool as SharedCoachTool<unknown, unknown>,
  checkProgressTool as SharedCoachTool<unknown, unknown>,
  generateBabyStepsTool as SharedCoachTool<unknown, unknown>,
  generateAdviceTool as SharedCoachTool<unknown, unknown>,
  showCategorySelectionTool as SharedCoachTool<unknown, unknown>,
  showHabitSelectionTool as SharedCoachTool<unknown, unknown>,
  showGoalSelectionTool as SharedCoachTool<unknown, unknown>,
  refineSuggestionsTool as SharedCoachTool<unknown, unknown>,
  suggestHabitImprovementsTool as SharedCoachTool<unknown, unknown>,
  showChoiceButtonsTool as SharedCoachTool<unknown, unknown>,
];

/**
 * Get a shared coach tool by name
 */
export function getSharedCoachTool(name: string): SharedCoachTool | undefined {
  return sharedCoachToolList.find(t => t.name === name);
}
