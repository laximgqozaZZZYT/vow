/**
 * Habit Analysis Workflow
 *
 * Mastra Workflow を使用した習慣分析パイプライン。
 * ユーザーの習慣データを収集・分析し、AIによるインサイトと推奨事項を生成します。
 *
 * Workflow Steps:
 * 1. data_collection: 習慣、活動、完了率をクエリ
 * 2. pattern_analysis: ピーク時間、苦手な習慣、相関パターンを特定
 * 3. insight_generation: AIを使用して自然言語のインサイトを生成
 * 4. recommendation: インパクト順にランク付けした提案を提供
 *
 * Features:
 * - Human-in-the-loop でインサイトレビュー後に推奨を表示
 * - 24時間のキャッシュで結果を保存
 * - ワークフロー進行状況イベントをUI更新用に発行
 *
 * Requirements:
 * - B-006: 習慣分析ワークフロー
 * - 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9
 *
 * @module agents/mastra/workflows/habit-analysis
 */

import { z } from 'zod';
import { createWorkflow, createStep } from '@mastra/core/workflows';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getLogger } from '../../../utils/logger.js';

const logger = getLogger('habit-analysis-workflow');

// =============================================================================
// Constants
// =============================================================================

/** Cache TTL in milliseconds (24 hours) */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** Analysis period in days */
const ANALYSIS_PERIOD_DAYS = 30;

/** Minimum completion rate threshold for struggling habits */
const STRUGGLING_THRESHOLD = 0.4;

/** Minimum completion rate for anchor habits */
const ANCHOR_THRESHOLD = 0.8;

// =============================================================================
// Types
// =============================================================================

/**
 * Input schema for the habit analysis workflow
 */
export const HabitAnalysisInputSchema = z.object({
  userId: z.string().uuid().describe('User ID to analyze'),
  locale: z.enum(['ja', 'en']).describe('Response language'),
  forceRefresh: z.boolean().describe('Force refresh bypassing cache'),
  analysisDepth: z.enum(['basic', 'detailed', 'comprehensive'])
    .describe('Depth of analysis'),
});

export type HabitAnalysisInput = z.infer<typeof HabitAnalysisInputSchema>;

/**
 * Habit data structure
 */
export interface HabitData {
  id: string;
  name: string;
  frequency: string;
  targetCount: number;
  workloadUnit: string | null;
  level: number | null;
  levelTier: string | null;
  active: boolean;
  createdAt: string;
}

/**
 * Activity data structure
 */
export interface ActivityData {
  id: string;
  habitId: string;
  timestamp: string;
  completedCount: number;
  memo: string | null;
}

/**
 * Data collection step output
 */
export interface DataCollectionOutput {
  habits: HabitData[];
  activities: ActivityData[];
  completionRates: Record<string, number>;
  totalHabits: number;
  activeHabits: number;
  averageCompletionRate: number;
  analysisStartDate: string;
  analysisEndDate: string;
}

/**
 * Time slot pattern
 */
export interface TimeSlotPattern {
  hour: number;
  dayOfWeek?: number;
  frequency: number;
  habitIds: string[];
}

/**
 * Habit correlation
 */
export interface HabitCorrelation {
  habitId1: string;
  habitId2: string;
  habitName1: string;
  habitName2: string;
  correlationScore: number;
  correlationType: 'positive' | 'negative' | 'neutral';
}

/**
 * Pattern analysis step output
 */
export interface PatternAnalysisOutput {
  peakTimeSlots: TimeSlotPattern[];
  strugglingHabits: Array<{
    habitId: string;
    habitName: string;
    completionRate: number;
    suggestedAction: string;
  }>;
  anchorHabits: Array<{
    habitId: string;
    habitName: string;
    completionRate: number;
    potentialStackingOpportunities: string[];
  }>;
  correlations: HabitCorrelation[];
  weekdayVsWeekend: {
    weekdayRate: number;
    weekendRate: number;
    difference: number;
  };
  consistencyScore: number;
}

/**
 * Individual insight
 */
export interface Insight {
  id: string;
  type: 'strength' | 'opportunity' | 'risk' | 'trend';
  title: string;
  description: string;
  confidence: number;
  relatedHabits: string[];
  actionable: boolean;
}

/**
 * Insight generation step output
 */
export interface InsightGenerationOutput {
  insights: Insight[];
  summary: string;
  overallHealthScore: number;
  reviewRequired: boolean;
}

/**
 * Recommendation
 */
export interface Recommendation {
  id: string;
  type: 'habit_adjustment' | 'new_habit' | 'habit_stacking' | 'schedule_change' | 'motivation';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'high' | 'medium' | 'low';
  priority: number;
  relatedInsights: string[];
  implementationSteps: string[];
}

/**
 * Recommendation step output (final workflow output)
 */
export interface RecommendationOutput {
  recommendations: Recommendation[];
  quickWins: Recommendation[];
  longTermGoals: Recommendation[];
  nextReviewDate: string;
}

/**
 * Complete workflow output
 */
export interface HabitAnalysisOutput {
  dataCollection: DataCollectionOutput;
  patternAnalysis: PatternAnalysisOutput;
  insights: InsightGenerationOutput;
  recommendations: RecommendationOutput;
  metadata: {
    workflowId: string;
    userId: string;
    generatedAt: string;
    cacheExpiresAt: string;
    analysisDepth: string;
    locale: string;
  };
}

/**
 * Workflow state for tracking progress
 */
export interface HabitAnalysisState {
  userId: string;
  locale: 'ja' | 'en';
  startedAt: number;
  supabaseClient?: SupabaseClient;
  cachedResult?: HabitAnalysisOutput;
  currentStep: string;
  progress: number;
}

/**
 * Human review input for insight review
 */
export interface InsightReviewInput {
  approved: boolean;
  feedback?: string;
  modifiedInsights?: Insight[];
}

// =============================================================================
// Cache Management
// =============================================================================

/** In-memory cache for analysis results */
const analysisCache = new Map<string, { result: HabitAnalysisOutput; expiresAt: number }>();

/**
 * Get cached analysis result
 */
export function getCachedAnalysis(userId: string): HabitAnalysisOutput | null {
  const cached = analysisCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    logger.debug('Cache hit for habit analysis', { userId });
    return cached.result;
  }
  if (cached) {
    analysisCache.delete(userId);
    logger.debug('Cache expired for habit analysis', { userId });
  }
  return null;
}

/**
 * Set cached analysis result
 */
export function setCachedAnalysis(userId: string, result: HabitAnalysisOutput): void {
  analysisCache.set(userId, {
    result,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
  logger.debug('Cached habit analysis result', { userId, expiresAt: new Date(Date.now() + CACHE_TTL_MS).toISOString() });
}

/**
 * Clear cache for a user
 */
export function clearAnalysisCache(userId: string): void {
  analysisCache.delete(userId);
  logger.debug('Cleared habit analysis cache', { userId });
}

// =============================================================================
// Progress Event Emitter
// =============================================================================

/**
 * Workflow progress event
 */
export interface WorkflowProgressEvent {
  workflowId: string;
  userId: string;
  step: string;
  progress: number;
  message: string;
  timestamp: string;
}

/** Progress event listeners */
const progressListeners: Array<(event: WorkflowProgressEvent) => void> = [];

/**
 * Subscribe to progress events
 */
export function subscribeToProgress(listener: (event: WorkflowProgressEvent) => void): () => void {
  progressListeners.push(listener);
  return () => {
    const index = progressListeners.indexOf(listener);
    if (index > -1) {
      progressListeners.splice(index, 1);
    }
  };
}

/**
 * Emit progress event
 */
function emitProgress(workflowId: string, userId: string, step: string, progress: number, message: string): void {
  const event: WorkflowProgressEvent = {
    workflowId,
    userId,
    step,
    progress,
    message,
    timestamp: new Date().toISOString(),
  };

  for (let i = 0; i < progressListeners.length; i++) {
    try {
      progressListeners[i]!(event);
    } catch (error) {
      logger.error('Progress listener error', error as Error, { workflowId, step });
    }
  }
}

// =============================================================================
// Step 1: Data Collection
// =============================================================================

/**
 * Data collection step - queries habits, activities, and completion rates
 */
export const dataCollectionStep = createStep({
  id: 'data_collection',
  description: 'Collect habit data, activities, and completion rates for analysis',
  inputSchema: HabitAnalysisInputSchema,
  outputSchema: z.custom<DataCollectionOutput>(),
  execute: async ({ inputData, getInitData }) => {
    const startTime = Date.now();
    const { userId, forceRefresh } = inputData;

    logger.info('Starting data collection step', { userId });
    emitProgress('habit-analysis', userId, 'data_collection', 10, 'Collecting habit data...');

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = getCachedAnalysis(userId);
      if (cached) {
        logger.info('Using cached analysis result', { userId });
        return cached.dataCollection;
      }
    }

    // Get Supabase client from request context
    const initData = getInitData() as HabitAnalysisInput & { supabase?: SupabaseClient };
    const supabase = initData.supabase;

    if (!supabase) {
      throw new Error('Supabase client not provided in workflow context');
    }

    // Calculate analysis date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - ANALYSIS_PERIOD_DAYS);

    // Query habits
    const { data: habits, error: habitsError } = await supabase
      .from('habits')
      .select('id, name, frequency, target_count, workload_unit, level, level_tier, active, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (habitsError) {
      throw new Error(`Failed to fetch habits: ${habitsError.message}`);
    }

    emitProgress('habit-analysis', userId, 'data_collection', 30, 'Fetching activity data...');

    // Query activities
    const { data: activities, error: activitiesError } = await supabase
      .from('habit_activities')
      .select('id, habit_id, timestamp, completed_count, memo')
      .eq('user_id', userId)
      .gte('timestamp', startDate.toISOString())
      .lte('timestamp', endDate.toISOString())
      .order('timestamp', { ascending: false });

    if (activitiesError) {
      throw new Error(`Failed to fetch activities: ${activitiesError.message}`);
    }

    emitProgress('habit-analysis', userId, 'data_collection', 50, 'Calculating completion rates...');

    // Calculate completion rates for each habit
    const completionRates: Record<string, number> = {};
    const activeHabits = habits?.filter(h => h.active) ?? [];

    for (const habit of activeHabits) {
      const habitActivities = activities?.filter(a => a.habit_id === habit.id) ?? [];
      const completedCount = habitActivities.length;

      // Calculate expected completions based on frequency
      let expectedCount: number;
      switch (habit.frequency) {
        case 'daily':
          expectedCount = ANALYSIS_PERIOD_DAYS;
          break;
        case 'weekly':
          expectedCount = Math.floor(ANALYSIS_PERIOD_DAYS / 7);
          break;
        case 'monthly':
          expectedCount = 1;
          break;
        default:
          expectedCount = ANALYSIS_PERIOD_DAYS;
      }

      completionRates[habit.id] = expectedCount > 0
        ? Math.min(completedCount / expectedCount, 1)
        : 0;
    }

    // Calculate average completion rate
    const rates = Object.values(completionRates);
    const averageCompletionRate = rates.length > 0
      ? rates.reduce((sum, rate) => sum + rate, 0) / rates.length
      : 0;

    const output: DataCollectionOutput = {
      habits: (habits ?? []).map(h => ({
        id: h.id,
        name: h.name,
        frequency: h.frequency,
        targetCount: h.target_count ?? 1,
        workloadUnit: h.workload_unit,
        level: h.level,
        levelTier: h.level_tier,
        active: h.active,
        createdAt: h.created_at,
      })),
      activities: (activities ?? []).map(a => ({
        id: a.id,
        habitId: a.habit_id,
        timestamp: a.timestamp,
        completedCount: a.completed_count ?? 1,
        memo: a.memo,
      })),
      completionRates,
      totalHabits: habits?.length ?? 0,
      activeHabits: activeHabits.length,
      averageCompletionRate,
      analysisStartDate: startDate.toISOString(),
      analysisEndDate: endDate.toISOString(),
    };

    logger.info('Data collection completed', {
      userId,
      totalHabits: output.totalHabits,
      activeHabits: output.activeHabits,
      activitiesCount: output.activities.length,
      durationMs: Date.now() - startTime,
    });

    emitProgress('habit-analysis', userId, 'data_collection', 100, 'Data collection complete');

    return output;
  },
});

// =============================================================================
// Step 2: Pattern Analysis
// =============================================================================

/**
 * Pattern analysis step - identifies peak times, struggles, and correlations
 */
export const patternAnalysisStep = createStep({
  id: 'pattern_analysis',
  description: 'Analyze patterns including peak times, struggling habits, and correlations',
  inputSchema: z.custom<DataCollectionOutput>(),
  outputSchema: z.custom<PatternAnalysisOutput>(),
  execute: async ({ inputData, getInitData }) => {
    const startTime = Date.now();
    const initData = getInitData() as HabitAnalysisInput;
    const { userId, locale } = initData;

    logger.info('Starting pattern analysis step', { userId });
    emitProgress('habit-analysis', userId, 'pattern_analysis', 10, 'Analyzing activity patterns...');

    const { habits, activities, completionRates } = inputData;
    const isJa = locale === 'ja';

    // Analyze peak time slots
    const timeSlotCounts = new Map<string, { count: number; habitIds: Set<string> }>();

    for (const activity of activities) {
      const date = new Date(activity.timestamp);
      const hour = date.getHours();
      const dayOfWeek = date.getDay();
      const key = `${hour}-${dayOfWeek}`;

      const existing = timeSlotCounts.get(key) ?? { count: 0, habitIds: new Set() };
      existing.count++;
      existing.habitIds.add(activity.habitId);
      timeSlotCounts.set(key, existing);
    }

    // Sort and get top time slots
    const peakTimeSlots: TimeSlotPattern[] = Array.from(timeSlotCounts.entries())
      .map(([key, value]) => {
        const [hour, dayOfWeek] = key.split('-').map(Number);
        return {
          hour: hour!,
          dayOfWeek: dayOfWeek!,
          frequency: value.count,
          habitIds: Array.from(value.habitIds),
        };
      })
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5);

    emitProgress('habit-analysis', userId, 'pattern_analysis', 40, 'Identifying struggling habits...');

    // Identify struggling habits
    const strugglingHabits = habits
      .filter(h => h.active && (completionRates[h.id] ?? 0) < STRUGGLING_THRESHOLD)
      .map(h => ({
        habitId: h.id,
        habitName: h.name,
        completionRate: completionRates[h.id] ?? 0,
        suggestedAction: generateSuggestion(h, completionRates[h.id] ?? 0, isJa),
      }))
      .sort((a, b) => a.completionRate - b.completionRate);

    emitProgress('habit-analysis', userId, 'pattern_analysis', 60, 'Finding anchor habits...');

    // Identify anchor habits (high completion rate)
    const anchorHabits = habits
      .filter(h => h.active && (completionRates[h.id] ?? 0) >= ANCHOR_THRESHOLD)
      .map(h => ({
        habitId: h.id,
        habitName: h.name,
        completionRate: completionRates[h.id] ?? 0,
        potentialStackingOpportunities: generateStackingOpportunities(h, strugglingHabits, isJa),
      }))
      .sort((a, b) => b.completionRate - a.completionRate);

    emitProgress('habit-analysis', userId, 'pattern_analysis', 80, 'Calculating correlations...');

    // Calculate habit correlations (simplified - based on co-occurrence on same day)
    const correlations = calculateHabitCorrelations(habits, activities);

    // Calculate weekday vs weekend performance
    const weekdayActivities = activities.filter(a => {
      const day = new Date(a.timestamp).getDay();
      return day >= 1 && day <= 5;
    });
    const weekendActivities = activities.filter(a => {
      const day = new Date(a.timestamp).getDay();
      return day === 0 || day === 6;
    });

    const weekdayRate = weekdayActivities.length / (ANALYSIS_PERIOD_DAYS * 5 / 7);
    const weekendRate = weekendActivities.length / (ANALYSIS_PERIOD_DAYS * 2 / 7);

    // Calculate consistency score (standard deviation of daily completions)
    const consistencyScore = calculateConsistencyScore(activities);

    const output: PatternAnalysisOutput = {
      peakTimeSlots,
      strugglingHabits,
      anchorHabits,
      correlations,
      weekdayVsWeekend: {
        weekdayRate: Math.min(weekdayRate, 1),
        weekendRate: Math.min(weekendRate, 1),
        difference: weekdayRate - weekendRate,
      },
      consistencyScore,
    };

    logger.info('Pattern analysis completed', {
      userId,
      peakTimeSlots: peakTimeSlots.length,
      strugglingHabits: strugglingHabits.length,
      anchorHabits: anchorHabits.length,
      correlations: correlations.length,
      durationMs: Date.now() - startTime,
    });

    emitProgress('habit-analysis', userId, 'pattern_analysis', 100, 'Pattern analysis complete');

    return output;
  },
});

// =============================================================================
// Step 3: Insight Generation
// =============================================================================

/**
 * Insight generation step - generates natural language insights using AI
 */
export const insightGenerationStep = createStep({
  id: 'insight_generation',
  description: 'Generate natural language insights from pattern analysis',
  inputSchema: z.custom<PatternAnalysisOutput>(),
  outputSchema: z.custom<InsightGenerationOutput>(),
  suspendSchema: z.custom<InsightGenerationOutput>(),
  resumeSchema: z.custom<InsightReviewInput>(),
  execute: async ({ inputData, getInitData, suspend, resumeData }) => {
    const startTime = Date.now();
    const initData = getInitData() as HabitAnalysisInput;
    const { userId, locale, analysisDepth } = initData;

    logger.info('Starting insight generation step', { userId, analysisDepth });
    emitProgress('habit-analysis', userId, 'insight_generation', 10, 'Generating insights...');

    const { peakTimeSlots, strugglingHabits, anchorHabits, weekdayVsWeekend, consistencyScore } = inputData;
    const isJa = locale === 'ja';

    // If we have resume data, use the reviewed insights
    if (resumeData) {
      logger.info('Resuming with reviewed insights', { userId, approved: resumeData.approved });

      if (!resumeData.approved) {
        // User rejected insights, regenerate or return with modifications
        const modifiedInsights = resumeData.modifiedInsights ?? [];
        return {
          insights: modifiedInsights,
          summary: isJa
            ? 'ユーザーレビュー後の修正済みインサイト'
            : 'Modified insights after user review',
          overallHealthScore: calculateHealthScore(inputData),
          reviewRequired: false,
        };
      }
    }

    const insights: Insight[] = [];
    let insightId = 1;

    // Generate insights from peak time analysis
    if (peakTimeSlots.length > 0) {
      const topSlot = peakTimeSlots[0]!;
      insights.push({
        id: `insight_${insightId++}`,
        type: 'strength',
        title: isJa ? 'ピークパフォーマンス時間' : 'Peak Performance Time',
        description: isJa
          ? `${topSlot.hour}時台が最も活動的な時間帯です。この時間に重要な習慣をスケジュールすることを検討してください。`
          : `${topSlot.hour}:00 is your most active time. Consider scheduling important habits during this time.`,
        confidence: 0.85,
        relatedHabits: topSlot.habitIds,
        actionable: true,
      });
    }

    emitProgress('habit-analysis', userId, 'insight_generation', 40, 'Analyzing struggles...');

    // Generate insights from struggling habits
    if (strugglingHabits.length > 0) {
      insights.push({
        id: `insight_${insightId++}`,
        type: 'risk',
        title: isJa ? '改善が必要な習慣' : 'Habits Needing Improvement',
        description: isJa
          ? `${strugglingHabits.length}個の習慣が達成率${Math.round(STRUGGLING_THRESHOLD * 100)}%未満です。スモールステップから始めることを検討してください。`
          : `${strugglingHabits.length} habit(s) have completion rates below ${Math.round(STRUGGLING_THRESHOLD * 100)}%. Consider starting with smaller steps.`,
        confidence: 0.9,
        relatedHabits: strugglingHabits.map(h => h.habitId),
        actionable: true,
      });
    }

    // Generate insights from anchor habits
    if (anchorHabits.length > 0) {
      insights.push({
        id: `insight_${insightId++}`,
        type: 'opportunity',
        title: isJa ? '習慣スタッキングの機会' : 'Habit Stacking Opportunity',
        description: isJa
          ? `${anchorHabits.length}個の強い習慣があります。これらを新しい習慣のアンカーとして活用できます。`
          : `You have ${anchorHabits.length} strong habit(s). These can be used as anchors for new habits.`,
        confidence: 0.8,
        relatedHabits: anchorHabits.map(h => h.habitId),
        actionable: true,
      });
    }

    emitProgress('habit-analysis', userId, 'insight_generation', 60, 'Evaluating consistency...');

    // Generate insight from weekday vs weekend
    if (Math.abs(weekdayVsWeekend.difference) > 0.2) {
      const betterPeriod = weekdayVsWeekend.difference > 0 ?
        (isJa ? '平日' : 'weekdays') :
        (isJa ? '週末' : 'weekends');
      insights.push({
        id: `insight_${insightId++}`,
        type: 'trend',
        title: isJa ? '平日と週末の違い' : 'Weekday vs Weekend Pattern',
        description: isJa
          ? `${betterPeriod}の方がパフォーマンスが高いです。スケジュールを調整することを検討してください。`
          : `You perform better on ${betterPeriod}. Consider adjusting your schedule accordingly.`,
        confidence: 0.75,
        relatedHabits: [],
        actionable: true,
      });
    }

    // Generate consistency insight
    insights.push({
      id: `insight_${insightId++}`,
      type: consistencyScore >= 0.7 ? 'strength' : 'opportunity',
      title: isJa ? '一貫性スコア' : 'Consistency Score',
      description: isJa
        ? `あなたの一貫性スコアは${Math.round(consistencyScore * 100)}%です。${consistencyScore >= 0.7 ? '素晴らしい安定性です！' : '毎日同じ時間に習慣を行うことで改善できます。'}`
        : `Your consistency score is ${Math.round(consistencyScore * 100)}%. ${consistencyScore >= 0.7 ? 'Great stability!' : 'Try doing habits at the same time each day to improve.'}`,
      confidence: 0.85,
      relatedHabits: [],
      actionable: consistencyScore < 0.7,
    });

    emitProgress('habit-analysis', userId, 'insight_generation', 80, 'Finalizing insights...');

    // Calculate overall health score
    const overallHealthScore = calculateHealthScore(inputData);

    // Generate summary
    const summary = generateSummary(insights, overallHealthScore, isJa);

    // Determine if human review is required (for comprehensive analysis)
    const reviewRequired = analysisDepth === 'comprehensive';

    const output: InsightGenerationOutput = {
      insights,
      summary,
      overallHealthScore,
      reviewRequired,
    };

    // If review is required, suspend for human-in-the-loop
    if (reviewRequired && !resumeData) {
      logger.info('Suspending for insight review', { userId, insightCount: insights.length });
      emitProgress('habit-analysis', userId, 'insight_generation', 90, 'Awaiting human review...');

      await suspend(output, {
        label: 'insight_review',
      });
    }

    logger.info('Insight generation completed', {
      userId,
      insightCount: insights.length,
      overallHealthScore,
      durationMs: Date.now() - startTime,
    });

    emitProgress('habit-analysis', userId, 'insight_generation', 100, 'Insight generation complete');

    return output;
  },
});

// =============================================================================
// Step 4: Recommendation
// =============================================================================

/**
 * Recommendation step - generates ranked suggestions by impact
 */
export const recommendationStep = createStep({
  id: 'recommendation',
  description: 'Generate actionable recommendations ranked by impact',
  inputSchema: z.custom<InsightGenerationOutput>(),
  outputSchema: z.custom<RecommendationOutput>(),
  execute: async ({ inputData, getInitData }) => {
    const startTime = Date.now();
    const initData = getInitData() as HabitAnalysisInput;
    const { userId, locale } = initData;

    logger.info('Starting recommendation step', { userId });
    emitProgress('habit-analysis', userId, 'recommendation', 10, 'Generating recommendations...');

    const { insights, overallHealthScore } = inputData;
    const isJa = locale === 'ja';

    const recommendations: Recommendation[] = [];
    let recId = 1;

    // Generate recommendations based on insights
    for (const insight of insights) {
      if (!insight.actionable) continue;

      const rec = generateRecommendation(insight, recId++, isJa);
      if (rec) {
        recommendations.push(rec);
      }
    }

    emitProgress('habit-analysis', userId, 'recommendation', 50, 'Prioritizing recommendations...');

    // Sort recommendations by priority (impact/effort ratio)
    recommendations.sort((a, b) => b.priority - a.priority);

    // Categorize recommendations
    const quickWins = recommendations.filter(r =>
      r.impact !== 'low' && r.effort === 'low'
    ).slice(0, 3);

    const longTermGoals = recommendations.filter(r =>
      r.impact === 'high' && r.effort !== 'low'
    ).slice(0, 3);

    // Calculate next review date (1 week from now)
    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + 7);

    emitProgress('habit-analysis', userId, 'recommendation', 80, 'Finalizing recommendations...');

    // Add general health-based recommendations
    if (overallHealthScore < 0.5) {
      recommendations.push({
        id: `rec_${recId++}`,
        type: 'motivation',
        title: isJa ? '基礎から始めましょう' : 'Start with Fundamentals',
        description: isJa
          ? '現在のスコアを上げるため、まず1つの習慣に集中することをお勧めします。'
          : 'To improve your score, we recommend focusing on just one habit first.',
        impact: 'high',
        effort: 'low',
        priority: 10,
        relatedInsights: [],
        implementationSteps: isJa
          ? ['最も重要な習慣を1つ選ぶ', '毎日同じ時間に行う', '2週間継続する', '成功したら次の習慣を追加']
          : ['Choose your most important habit', 'Do it at the same time daily', 'Continue for 2 weeks', 'Add next habit after success'],
      });
    }

    const output: RecommendationOutput = {
      recommendations,
      quickWins,
      longTermGoals,
      nextReviewDate: nextReviewDate.toISOString(),
    };

    logger.info('Recommendation step completed', {
      userId,
      totalRecommendations: recommendations.length,
      quickWins: quickWins.length,
      longTermGoals: longTermGoals.length,
      durationMs: Date.now() - startTime,
    });

    emitProgress('habit-analysis', userId, 'recommendation', 100, 'Recommendations complete');

    return output;
  },
});

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate suggestion for struggling habit
 */
function generateSuggestion(habit: HabitData, completionRate: number, isJa: boolean): string {
  if (completionRate < 0.1) {
    return isJa
      ? `「${habit.name}」を簡単なバージョンに置き換えることを検討してください。`
      : `Consider replacing "${habit.name}" with an easier version.`;
  }
  if (completionRate < 0.3) {
    return isJa
      ? `「${habit.name}」の目標を半分に減らしてみてください。`
      : `Try reducing the target for "${habit.name}" by half.`;
  }
  return isJa
    ? `「${habit.name}」にリマインダーを設定することを検討してください。`
    : `Consider setting a reminder for "${habit.name}".`;
}

/**
 * Generate habit stacking opportunities
 */
function generateStackingOpportunities(
  anchorHabit: HabitData,
  strugglingHabits: Array<{ habitId: string; habitName: string }>,
  isJa: boolean
): string[] {
  return strugglingHabits.slice(0, 2).map(sh =>
    isJa
      ? `「${anchorHabit.name}」の後に「${sh.habitName}」を行う`
      : `Do "${sh.habitName}" after "${anchorHabit.name}"`
  );
}

/**
 * Calculate habit correlations based on same-day co-occurrence
 */
function calculateHabitCorrelations(
  habits: HabitData[],
  activities: ActivityData[]
): HabitCorrelation[] {
  const correlations: HabitCorrelation[] = [];
  const activeHabits = habits.filter(h => h.active);

  // Group activities by date
  const activitiesByDate = new Map<string, Set<string>>();
  for (const activity of activities) {
    const date = activity.timestamp.split('T')[0]!;
    const habitIds = activitiesByDate.get(date) ?? new Set();
    habitIds.add(activity.habitId);
    activitiesByDate.set(date, habitIds);
  }

  // Calculate co-occurrence for each habit pair
  for (let i = 0; i < activeHabits.length; i++) {
    for (let j = i + 1; j < activeHabits.length; j++) {
      const habit1 = activeHabits[i]!;
      const habit2 = activeHabits[j]!;

      let coOccurrence = 0;
      let habit1Only = 0;
      let habit2Only = 0;

      const habitIdSets = Array.from(activitiesByDate.values());
    for (const habitIds of habitIdSets) {
        const has1 = habitIds.has(habit1.id);
        const has2 = habitIds.has(habit2.id);

        if (has1 && has2) coOccurrence++;
        else if (has1) habit1Only++;
        else if (has2) habit2Only++;
      }

      // Simple correlation score
      const total = coOccurrence + habit1Only + habit2Only;
      if (total > 5) {
        const score = coOccurrence / total;
        correlations.push({
          habitId1: habit1.id,
          habitId2: habit2.id,
          habitName1: habit1.name,
          habitName2: habit2.name,
          correlationScore: score,
          correlationType: score > 0.5 ? 'positive' : score < 0.2 ? 'negative' : 'neutral',
        });
      }
    }
  }

  return correlations.sort((a, b) => b.correlationScore - a.correlationScore).slice(0, 5);
}

/**
 * Calculate consistency score based on daily activity variance
 */
function calculateConsistencyScore(activities: ActivityData[]): number {
  if (activities.length < 7) return 0.5;

  // Group by date
  const dailyCounts = new Map<string, number>();
  for (const activity of activities) {
    const date = activity.timestamp.split('T')[0]!;
    dailyCounts.set(date, (dailyCounts.get(date) ?? 0) + 1);
  }

  const counts = Array.from(dailyCounts.values());
  if (counts.length < 7) return 0.5;

  // Calculate coefficient of variation
  const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
  if (mean === 0) return 0;

  const variance = counts.reduce((sum, count) => sum + Math.pow(count - mean, 2), 0) / counts.length;
  const stdDev = Math.sqrt(variance);
  const cv = stdDev / mean;

  // Convert CV to consistency score (lower CV = higher consistency)
  return Math.max(0, Math.min(1, 1 - cv));
}

/**
 * Calculate overall health score
 */
function calculateHealthScore(patternAnalysis: PatternAnalysisOutput): number {
  const {
    strugglingHabits,
    anchorHabits,
    weekdayVsWeekend,
    consistencyScore,
  } = patternAnalysis;

  // Weight factors
  const anchorWeight = 0.3;
  const strugglingWeight = 0.3;
  const consistencyWeight = 0.25;
  const balanceWeight = 0.15;

  // Anchor score (more anchor habits = better)
  const anchorScore = Math.min(anchorHabits.length / 3, 1);

  // Struggling score (fewer struggling habits = better)
  const strugglingScore = Math.max(0, 1 - strugglingHabits.length / 5);

  // Balance score (similar weekday/weekend performance = better)
  const balanceScore = 1 - Math.min(Math.abs(weekdayVsWeekend.difference), 1);

  return (
    anchorScore * anchorWeight +
    strugglingScore * strugglingWeight +
    consistencyScore * consistencyWeight +
    balanceScore * balanceWeight
  );
}

/**
 * Generate summary text
 */
function generateSummary(insights: Insight[], healthScore: number, isJa: boolean): string {
  const strengths = insights.filter(i => i.type === 'strength').length;
  const opportunities = insights.filter(i => i.type === 'opportunity').length;
  const risks = insights.filter(i => i.type === 'risk').length;

  if (isJa) {
    return `習慣分析が完了しました。健康スコアは${Math.round(healthScore * 100)}%です。` +
      `${strengths}個の強み、${opportunities}個の機会、${risks}個の改善点が見つかりました。`;
  }

  return `Habit analysis complete. Health score: ${Math.round(healthScore * 100)}%. ` +
    `Found ${strengths} strength(s), ${opportunities} opportunity(ies), and ${risks} area(s) for improvement.`;
}

/**
 * Generate recommendation from insight
 */
function generateRecommendation(insight: Insight, id: number, isJa: boolean): Recommendation | null {
  const impactMap: Record<Insight['type'], 'high' | 'medium' | 'low'> = {
    strength: 'low',
    opportunity: 'medium',
    risk: 'high',
    trend: 'medium',
  };

  const effortMap: Record<Insight['type'], 'high' | 'medium' | 'low'> = {
    strength: 'low',
    opportunity: 'medium',
    risk: 'medium',
    trend: 'low',
  };

  const typeMap: Record<Insight['type'], Recommendation['type']> = {
    strength: 'motivation',
    opportunity: 'habit_stacking',
    risk: 'habit_adjustment',
    trend: 'schedule_change',
  };

  const impact = impactMap[insight.type];
  const effort = effortMap[insight.type];

  // Calculate priority (higher = more important)
  const impactValue = impact === 'high' ? 3 : impact === 'medium' ? 2 : 1;
  const effortValue = effort === 'low' ? 3 : effort === 'medium' ? 2 : 1;
  const priority = impactValue * effortValue * insight.confidence;

  return {
    id: `rec_${id}`,
    type: typeMap[insight.type],
    title: insight.title,
    description: insight.description,
    impact,
    effort,
    priority,
    relatedInsights: [insight.id],
    implementationSteps: generateImplementationSteps(insight, isJa),
  };
}

/**
 * Generate implementation steps for a recommendation
 */
function generateImplementationSteps(insight: Insight, isJa: boolean): string[] {
  switch (insight.type) {
    case 'strength':
      return isJa
        ? ['現在の取り組みを継続', '成功パターンを他の習慣に適用']
        : ['Continue current approach', 'Apply success patterns to other habits'];
    case 'opportunity':
      return isJa
        ? ['アンカー習慣を特定', '新しい習慣を紐づける', '1週間試す']
        : ['Identify anchor habit', 'Link new habit to it', 'Try for one week'];
    case 'risk':
      return isJa
        ? ['目標を半分に減らす', 'リマインダーを設定', '2週間後に見直す']
        : ['Reduce target by half', 'Set reminders', 'Review in two weeks'];
    case 'trend':
      return isJa
        ? ['パターンを認識', 'スケジュールを調整', '結果を追跡']
        : ['Recognize pattern', 'Adjust schedule', 'Track results'];
    default:
      return [];
  }
}

// =============================================================================
// Workflow Definition
// =============================================================================

/**
 * Habit Analysis Workflow
 *
 * A Mastra workflow that analyzes user habit data and generates personalized insights
 * and recommendations.
 */
export const habitAnalysisWorkflow = createWorkflow({
  id: 'habit-analysis',
  description: 'Analyze user habits and generate personalized insights and recommendations',
  inputSchema: HabitAnalysisInputSchema,
  outputSchema: z.custom<HabitAnalysisOutput>(),
  stateSchema: z.custom<HabitAnalysisState>(),
})
  .then(dataCollectionStep)
  .then(patternAnalysisStep)
  .then(insightGenerationStep)
  .then(recommendationStep)
  .map(async ({ inputData, getInitData }) => {
    const initData = getInitData() as HabitAnalysisInput;
    const { userId, locale, analysisDepth } = initData;

    // Access step results
    const dataCollection = (inputData as any).data_collection as DataCollectionOutput;
    const patternAnalysis = (inputData as any).pattern_analysis as PatternAnalysisOutput;
    const insights = (inputData as any).insight_generation as InsightGenerationOutput;
    const recommendations = inputData as RecommendationOutput;

    const now = new Date();
    const cacheExpiresAt = new Date(now.getTime() + CACHE_TTL_MS);

    const result: HabitAnalysisOutput = {
      dataCollection,
      patternAnalysis,
      insights,
      recommendations,
      metadata: {
        workflowId: 'habit-analysis',
        userId,
        generatedAt: now.toISOString(),
        cacheExpiresAt: cacheExpiresAt.toISOString(),
        analysisDepth,
        locale,
      },
    };

    // Cache the result
    setCachedAnalysis(userId, result);

    logger.info('Habit analysis workflow completed', {
      userId,
      analysisDepth,
      insightCount: insights.insights.length,
      recommendationCount: recommendations.recommendations.length,
    });

    return result;
  })
  .commit();

// =============================================================================
// Workflow Execution Helper
// =============================================================================

/**
 * Execute the habit analysis workflow
 *
 * @param userId - User ID to analyze
 * @param supabase - Supabase client instance
 * @param options - Additional options
 * @returns The workflow output
 */
export async function executeHabitAnalysis(
  userId: string,
  supabase: SupabaseClient,
  options: {
    locale?: 'ja' | 'en';
    forceRefresh?: boolean;
    analysisDepth?: 'basic' | 'detailed' | 'comprehensive';
  } = {}
): Promise<HabitAnalysisOutput> {
  const { locale = 'ja', forceRefresh = false, analysisDepth = 'detailed' } = options;

  logger.info('Starting habit analysis workflow', { userId, locale, analysisDepth, forceRefresh });

  // Check cache first
  if (!forceRefresh) {
    const cached = getCachedAnalysis(userId);
    if (cached) {
      logger.info('Returning cached analysis', { userId });
      return cached;
    }
  }

  // Create and execute workflow run
  const run = await habitAnalysisWorkflow.createRun();

  const result = await run.start({
    inputData: {
      userId,
      locale,
      forceRefresh,
      analysisDepth,
      supabase, // Pass supabase in context
    } as HabitAnalysisInput & { supabase: SupabaseClient },
  });

  if (result.status === 'success') {
    return result.result;
  }

  if (result.status === 'suspended') {
    // Handle human-in-the-loop case
    logger.info('Workflow suspended for review', { userId });
    throw new Error('Workflow suspended for human review. Resume with reviewed insights.');
  }

  if (result.status === 'failed') {
    logger.error('Habit analysis workflow failed', result.error, { userId });
    throw result.error;
  }

  throw new Error(`Unexpected workflow status: ${result.status}`);
}

// =============================================================================
// Exports
// =============================================================================

export {
  dataCollectionStep as habitDataCollectionStep,
  patternAnalysisStep as habitPatternAnalysisStep,
  insightGenerationStep as habitInsightGenerationStep,
  recommendationStep as habitRecommendationStep,
};
