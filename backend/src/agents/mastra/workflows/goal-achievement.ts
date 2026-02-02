/**
 * Goal Achievement Workflow
 *
 * Mastra Workflow を使用した目標達成パイプライン。
 * 目標の分析、マイルストーン計画、習慣マッピング、進捗追跡を実行します。
 *
 * Requirements:
 * - B-007: 目標達成ワークフロー
 * - 4.1-4.8: Goal Achievement Workflow (AI Agent Framework Integration)
 *
 * @module agents/mastra/workflows/goal-achievement
 */

import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getLogger } from '../../../utils/logger.js';
import { GoalRepository } from '../../../repositories/goalRepository.js';
import { HabitRepository } from '../../../repositories/habitRepository.js';
import { ActivityRepository } from '../../../repositories/activityRepository.js';
import type { Goal, Habit } from '../../../schemas/habit.js';
import type { LevelTier } from '../../../types/thli.js';

const logger = getLogger('goal-achievement-workflow');

// =============================================================================
// Constants
// =============================================================================

/** Goal type categories */
export const GOAL_TYPES = ['skill', 'health', 'productivity', 'relationship', 'finance', 'other'] as const;
export type GoalType = (typeof GOAL_TYPES)[number];

/** Workflow step names */
export const WORKFLOW_STEPS = [
  'goal_assessment',
  'milestone_planning',
  'habit_mapping',
  'progress_tracking',
] as const;
export type WorkflowStep = (typeof WORKFLOW_STEPS)[number];

/** Default analysis period in days */
const DEFAULT_ANALYSIS_PERIOD_DAYS = 30;

// =============================================================================
// Input/Output Schemas
// =============================================================================

/**
 * Schema for workflow input
 */
export const GoalAchievementInputSchema = z.object({
  /** Goal ID to analyze */
  goalId: z.string().uuid(),
  /** User ID */
  userId: z.string().uuid(),
  /** Optional locale for responses */
  locale: z.enum(['ja', 'en']).default('ja'),
  /** Whether to include detailed recommendations */
  includeRecommendations: z.boolean().default(true),
});

export type GoalAchievementInput = z.infer<typeof GoalAchievementInputSchema>;

/**
 * Goal assessment result
 */
export interface GoalAssessmentResult {
  goalId: string;
  goalName: string;
  goalType: GoalType;
  complexity: 'low' | 'medium' | 'high';
  estimatedTimelineDays: number;
  estimatedTimelineDescription: string;
  levelTier?: LevelTier | undefined;
  parentGoalId?: string | undefined;
  linkedHabitCount: number;
  analysis: {
    hasDeadline: boolean;
    hasMilestones: boolean;
    hasLinkedHabits: boolean;
    overallReadiness: number; // 0-100
  };
}

/**
 * OKR-style milestone
 */
export interface Milestone {
  id: string;
  title: string;
  description: string;
  targetDate: string;
  keyResults: KeyResult[];
  priority: 'high' | 'medium' | 'low';
  estimatedEffortHours: number;
}

/**
 * Key result for a milestone
 */
export interface KeyResult {
  id: string;
  description: string;
  metric: string;
  targetValue: number;
  currentValue: number;
  unit: string;
}

/**
 * Milestone planning result
 */
export interface MilestonePlanningResult {
  goalId: string;
  milestones: Milestone[];
  totalDuration: number;
  criticalPath: string[];
  recommendations: string[];
}

/**
 * Habit suggestion for goal
 */
export interface HabitSuggestion {
  name: string;
  description: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  targetCount: number;
  workloadUnit: string | null;
  contributionToGoal: string;
  estimatedLevel: number;
  levelTier: LevelTier;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Linked habit analysis
 */
export interface LinkedHabitAnalysis {
  habitId: string;
  habitName: string;
  contributionScore: number; // 0-100
  completionRate: number; // 0-1
  currentStreak: number;
  recommendation: string;
}

/**
 * Habit mapping result
 */
export interface HabitMappingResult {
  goalId: string;
  existingHabits: LinkedHabitAnalysis[];
  suggestedHabits: HabitSuggestion[];
  totalContributionScore: number;
  gaps: string[];
}

/**
 * Progress tracking result
 */
export interface ProgressTrackingResult {
  goalId: string;
  currentProgress: number; // 0-100
  trend: 'improving' | 'stable' | 'declining';
  predictedCompletionDate: string | null;
  daysToCompletion: number | null;
  confidenceLevel: 'high' | 'medium' | 'low';
  progressHistory: {
    date: string;
    progress: number;
  }[];
  insights: string[];
  recommendations: string[];
}

/**
 * Complete workflow result
 */
export interface GoalAchievementWorkflowResult {
  goalId: string;
  goalName: string;
  executedAt: string;
  locale: 'ja' | 'en';
  assessment: GoalAssessmentResult;
  milestones: MilestonePlanningResult;
  habitMapping: HabitMappingResult;
  progressTracking: ProgressTrackingResult;
  summary: {
    overallStatus: 'on_track' | 'at_risk' | 'behind' | 'completed';
    priorityActions: string[];
    nextReviewDate: string;
  };
}

// =============================================================================
// Workflow Context
// =============================================================================

/**
 * Workflow execution context
 */
export interface GoalAchievementContext {
  supabase: SupabaseClient;
  goalRepo: GoalRepository;
  habitRepo: HabitRepository;
  activityRepo: ActivityRepository;
}

/**
 * Create workflow context from Supabase client
 */
export function createWorkflowContext(supabase: SupabaseClient): GoalAchievementContext {
  return {
    supabase,
    goalRepo: new GoalRepository(supabase),
    habitRepo: new HabitRepository(supabase),
    activityRepo: new ActivityRepository(supabase),
  };
}

// =============================================================================
// Step 1: Goal Assessment
// =============================================================================

/**
 * Detect goal type from name and description
 */
function detectGoalType(goal: Goal): GoalType {
  const text = `${goal.name} ${goal.description || ''}`.toLowerCase();

  const typePatterns: Record<GoalType, RegExp[]> = {
    skill: [/学ぶ|勉強|スキル|資格|skill|learn|study|certificate/i],
    health: [/健康|運動|ダイエット|睡眠|health|exercise|diet|sleep|fitness/i],
    productivity: [/生産性|効率|仕事|タスク|productivity|efficiency|work|task/i],
    relationship: [/人間関係|友達|家族|コミュニケーション|relationship|friend|family/i],
    finance: [/お金|貯金|投資|収入|finance|money|saving|investment|income/i],
    other: [],
  };

  for (const [type, patterns] of Object.entries(typePatterns)) {
    if (type === 'other') continue;
    if (patterns.some((pattern) => pattern.test(text))) {
      return type as GoalType;
    }
  }

  return 'other';
}

/**
 * Estimate complexity based on goal characteristics
 */
function estimateComplexity(
  goal: Goal,
  linkedHabitCount: number
): 'low' | 'medium' | 'high' {
  let complexityScore = 0;

  // Factor 1: Description length
  const descLength = goal.description?.length || 0;
  if (descLength > 200) complexityScore += 2;
  else if (descLength > 50) complexityScore += 1;

  // Factor 2: Has parent goal (part of larger goal)
  if (goal.parent_id) complexityScore += 1;

  // Factor 3: Level if available
  const level = goal.level || 0;
  if (level >= 100) complexityScore += 2;
  else if (level >= 50) complexityScore += 1;

  // Factor 4: Linked habits
  if (linkedHabitCount > 5) complexityScore += 2;
  else if (linkedHabitCount > 2) complexityScore += 1;

  if (complexityScore >= 4) return 'high';
  if (complexityScore >= 2) return 'medium';
  return 'low';
}

/**
 * Estimate timeline based on goal type and complexity
 */
function estimateTimeline(
  goalType: GoalType,
  complexity: 'low' | 'medium' | 'high',
  locale: 'ja' | 'en'
): { days: number; description: string } {
  const baseTimelines: Record<GoalType, number> = {
    skill: 90,
    health: 60,
    productivity: 30,
    relationship: 45,
    finance: 90,
    other: 60,
  };

  const complexityMultipliers: Record<'low' | 'medium' | 'high', number> = {
    low: 0.5,
    medium: 1.0,
    high: 2.0,
  };

  const days = Math.round(baseTimelines[goalType] * complexityMultipliers[complexity]);

  const descriptions: Record<string, Record<'ja' | 'en', string>> = {
    '15-30': { ja: '2-4週間', en: '2-4 weeks' },
    '30-60': { ja: '1-2ヶ月', en: '1-2 months' },
    '60-90': { ja: '2-3ヶ月', en: '2-3 months' },
    '90-180': { ja: '3-6ヶ月', en: '3-6 months' },
    '180+': { ja: '6ヶ月以上', en: '6+ months' },
  };

  let descKey: string;
  if (days < 30) descKey = '15-30';
  else if (days < 60) descKey = '30-60';
  else if (days < 90) descKey = '60-90';
  else if (days < 180) descKey = '90-180';
  else descKey = '180+';

  return { days, description: descriptions[descKey]![locale] };
}

/**
 * Step 1: Assess the goal's complexity and timeline
 */
export async function assessGoal(
  input: GoalAchievementInput,
  context: GoalAchievementContext
): Promise<GoalAssessmentResult> {
  const startTime = Date.now();
  logger.info('Starting goal assessment', { goalId: input.goalId, userId: input.userId });

  try {
    // Fetch goal
    const goal = await context.goalRepo.getById(input.goalId);
    if (!goal || goal.owner_id !== input.userId) {
      throw new Error(`Goal not found: ${input.goalId}`);
    }

    // Fetch linked habits
    const allHabits = await context.habitRepo.getByOwner('user', input.userId, true);
    const linkedHabits = allHabits.filter((h) => h.goal_id === input.goalId);

    // Detect goal type
    const goalType = detectGoalType(goal);

    // Estimate complexity
    const complexity = estimateComplexity(goal, linkedHabits.length);

    // Estimate timeline
    const timeline = estimateTimeline(goalType, complexity, input.locale);

    // Calculate readiness score
    const hasDeadline = false; // Goal schema doesn't have deadline yet
    const hasMilestones = false; // Would need to check milestones table
    const hasLinkedHabits = linkedHabits.length > 0;

    let overallReadiness = 30; // Base score
    if (hasLinkedHabits) overallReadiness += 30;
    if (linkedHabits.length >= 3) overallReadiness += 20;
    if (goal.description && goal.description.length > 50) overallReadiness += 10;
    if (goal.level !== null && goal.level !== undefined) overallReadiness += 10;

    const result: GoalAssessmentResult = {
      goalId: goal.id,
      goalName: goal.name,
      goalType,
      complexity,
      estimatedTimelineDays: timeline.days,
      estimatedTimelineDescription: timeline.description,
      levelTier: goal.level_tier as LevelTier | undefined,
      parentGoalId: goal.parent_id || undefined,
      linkedHabitCount: linkedHabits.length,
      analysis: {
        hasDeadline,
        hasMilestones,
        hasLinkedHabits,
        overallReadiness: Math.min(overallReadiness, 100),
      },
    };

    logger.info('Goal assessment completed', {
      goalId: input.goalId,
      goalType,
      complexity,
      durationMs: Date.now() - startTime,
    });

    return result;
  } catch (error) {
    logger.error('Goal assessment failed', error as Error, { goalId: input.goalId });
    throw error;
  }
}

// =============================================================================
// Step 2: Milestone Planning
// =============================================================================

/**
 * Generate milestone templates based on goal type
 */
function generateMilestoneTemplates(
  goalType: GoalType,
  complexity: 'low' | 'medium' | 'high',
  timelineDays: number,
  locale: 'ja' | 'en'
): Milestone[] {
  const now = new Date();
  const milestones: Milestone[] = [];

  // Define milestone count based on complexity
  const milestoneCount = complexity === 'low' ? 2 : complexity === 'medium' ? 3 : 4;

  // Milestone templates by goal type
  const templates: Record<GoalType, { titles: { ja: string; en: string }[]; descriptions: { ja: string; en: string }[] }> = {
    skill: {
      titles: [
        { ja: '基礎学習完了', en: 'Complete Foundation Learning' },
        { ja: '実践開始', en: 'Begin Practical Application' },
        { ja: '応用スキル習得', en: 'Acquire Advanced Skills' },
        { ja: '習熟度確認', en: 'Verify Proficiency' },
      ],
      descriptions: [
        { ja: '基本概念と理論を理解する', en: 'Understand basic concepts and theory' },
        { ja: '学んだことを実際に適用し始める', en: 'Start applying what you learned' },
        { ja: '応用的なスキルを身につける', en: 'Develop advanced skills' },
        { ja: 'スキルの習熟度をテストで確認', en: 'Test proficiency level' },
      ],
    },
    health: {
      titles: [
        { ja: '習慣化の基盤作り', en: 'Build Habit Foundation' },
        { ja: '継続的な実践', en: 'Consistent Practice' },
        { ja: '目標達成への加速', en: 'Accelerate Toward Goal' },
        { ja: '成果の定着', en: 'Solidify Results' },
      ],
      descriptions: [
        { ja: '健康的な習慣を日常に組み込む', en: 'Incorporate healthy habits into daily routine' },
        { ja: '習慣を継続し、効果を確認する', en: 'Continue habits and verify effects' },
        { ja: '目標に向けて活動を強化する', en: 'Intensify activities toward goal' },
        { ja: '達成した成果を維持する方法を確立', en: 'Establish methods to maintain results' },
      ],
    },
    productivity: {
      titles: [
        { ja: 'ワークフロー分析', en: 'Workflow Analysis' },
        { ja: '改善策の実装', en: 'Implement Improvements' },
        { ja: '効率化の最適化', en: 'Optimize Efficiency' },
        { ja: '成果測定と調整', en: 'Measure and Adjust' },
      ],
      descriptions: [
        { ja: '現在の作業プロセスを分析する', en: 'Analyze current work processes' },
        { ja: '特定した改善策を実装する', en: 'Implement identified improvements' },
        { ja: '効率をさらに最適化する', en: 'Further optimize efficiency' },
        { ja: '成果を測定し、必要に応じて調整', en: 'Measure results and adjust as needed' },
      ],
    },
    relationship: {
      titles: [
        { ja: '現状分析', en: 'Current State Analysis' },
        { ja: 'コミュニケーション改善', en: 'Improve Communication' },
        { ja: '関係の深化', en: 'Deepen Relationships' },
        { ja: '持続可能な関係構築', en: 'Build Sustainable Relationships' },
      ],
      descriptions: [
        { ja: '現在の人間関係の状態を把握', en: 'Understand current relationship status' },
        { ja: 'コミュニケーションの質を改善する', en: 'Improve quality of communication' },
        { ja: 'より深い信頼関係を築く', en: 'Build deeper trust' },
        { ja: '長期的に維持できる関係を構築', en: 'Build relationships that last' },
      ],
    },
    finance: {
      titles: [
        { ja: '財務状況の把握', en: 'Understand Financial Status' },
        { ja: '計画の策定', en: 'Create Plan' },
        { ja: '実行と追跡', en: 'Execute and Track' },
        { ja: '目標達成と次のステップ', en: 'Achieve Goal and Next Steps' },
      ],
      descriptions: [
        { ja: '収入、支出、資産の現状を把握', en: 'Understand income, expenses, and assets' },
        { ja: '具体的な財務計画を策定する', en: 'Create specific financial plan' },
        { ja: '計画を実行し、進捗を追跡', en: 'Execute plan and track progress' },
        { ja: '目標を達成し、次の目標を設定', en: 'Achieve goal and set next objectives' },
      ],
    },
    other: {
      titles: [
        { ja: '準備フェーズ', en: 'Preparation Phase' },
        { ja: '実行フェーズ', en: 'Execution Phase' },
        { ja: '改善フェーズ', en: 'Improvement Phase' },
        { ja: '完了フェーズ', en: 'Completion Phase' },
      ],
      descriptions: [
        { ja: '必要な準備を整える', en: 'Complete necessary preparations' },
        { ja: '計画を実行に移す', en: 'Put plan into action' },
        { ja: 'フィードバックを基に改善', en: 'Improve based on feedback' },
        { ja: '目標達成を確認', en: 'Confirm goal achievement' },
      ],
    },
  };

  const template = templates[goalType];
  const intervalDays = Math.floor(timelineDays / milestoneCount);

  for (let i = 0; i < milestoneCount; i++) {
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + intervalDays * (i + 1));

    milestones.push({
      id: `milestone_${i + 1}`,
      title: template.titles[i]![locale],
      description: template.descriptions[i]![locale],
      targetDate: targetDate.toISOString().split('T')[0]!,
      keyResults: [
        {
          id: `kr_${i + 1}_1`,
          description:
            locale === 'ja'
              ? `${template.titles[i]!.ja}の主要成果`
              : `Key result for ${template.titles[i]!.en}`,
          metric: locale === 'ja' ? '達成度' : 'Completion',
          targetValue: 100,
          currentValue: 0,
          unit: '%',
        },
      ],
      priority: i === 0 ? 'high' : i < milestoneCount - 1 ? 'medium' : 'low',
      estimatedEffortHours: Math.round(intervalDays * 0.5),
    });
  }

  return milestones;
}

/**
 * Step 2: Generate OKR-style milestones using AI
 */
export async function planMilestones(
  input: GoalAchievementInput,
  assessment: GoalAssessmentResult,
  _context: GoalAchievementContext
): Promise<MilestonePlanningResult> {
  const startTime = Date.now();
  logger.info('Starting milestone planning', { goalId: input.goalId });

  try {
    const milestones = generateMilestoneTemplates(
      assessment.goalType,
      assessment.complexity,
      assessment.estimatedTimelineDays,
      input.locale
    );

    const recommendations =
      input.locale === 'ja'
        ? [
            'マイルストーンは柔軟に調整してください',
            '定期的に進捗を確認することをお勧めします',
            '各マイルストーンの完了後に振り返りを行いましょう',
          ]
        : [
            'Adjust milestones flexibly as needed',
            'We recommend regular progress reviews',
            'Reflect after completing each milestone',
          ];

    const result: MilestonePlanningResult = {
      goalId: input.goalId,
      milestones,
      totalDuration: assessment.estimatedTimelineDays,
      criticalPath: milestones.map((m) => m.id),
      recommendations,
    };

    logger.info('Milestone planning completed', {
      goalId: input.goalId,
      milestoneCount: milestones.length,
      durationMs: Date.now() - startTime,
    });

    return result;
  } catch (error) {
    logger.error('Milestone planning failed', error as Error, { goalId: input.goalId });
    throw error;
  }
}

// =============================================================================
// Step 3: Habit Mapping
// =============================================================================

/**
 * Calculate habit contribution score to goal
 */
function calculateContributionScore(habit: Habit, goal: Goal): number {
  let score = 0;

  // Direct link
  if (habit.goal_id === goal.id) {
    score += 40;
  }

  // Name/description similarity (simplified)
  const goalText = `${goal.name} ${goal.description || ''}`.toLowerCase();
  const habitText = `${habit.name} ${habit.description || ''}`.toLowerCase();

  // Check for common words
  const goalWords = new Set(goalText.split(/\s+/).filter((w) => w.length > 2));
  const habitWordsList = habitText.split(/\s+/).filter((w) => w.length > 2);

  let commonCount = 0;
  for (const word of habitWordsList) {
    if (goalWords.has(word)) commonCount++;
  }

  score += Math.min(commonCount * 10, 30);

  // Level alignment
  if (habit.level !== null && habit.level !== undefined && goal.level !== null && goal.level !== undefined) {
    const levelDiff = Math.abs(habit.level - goal.level);
    if (levelDiff < 20) score += 20;
    else if (levelDiff < 50) score += 10;
  }

  // Domain alignment
  if (
    habit.domain_codes &&
    goal.domain_codes &&
    habit.domain_codes.some((d) => goal.domain_codes.includes(d))
  ) {
    score += 10;
  }

  return Math.min(score, 100);
}

/**
 * Generate habit suggestions based on goal type
 */
function generateHabitSuggestions(
  goalType: GoalType,
  existingHabitNames: string[],
  locale: 'ja' | 'en'
): HabitSuggestion[] {
  const suggestions: Record<GoalType, HabitSuggestion[]> = {
    skill: [
      {
        name: locale === 'ja' ? '毎日15分の学習' : '15 minutes of daily learning',
        description:
          locale === 'ja'
            ? '集中して学習する時間を確保する'
            : 'Dedicate focused time for learning',
        frequency: 'daily',
        targetCount: 1,
        workloadUnit: locale === 'ja' ? '分' : 'minutes',
        contributionToGoal:
          locale === 'ja' ? '継続的な学習習慣を形成' : 'Build consistent learning habits',
        estimatedLevel: 40,
        levelTier: 'beginner',
        priority: 'high',
      },
      {
        name: locale === 'ja' ? '週次の実践演習' : 'Weekly practice exercises',
        description:
          locale === 'ja'
            ? '学んだことを実践で試す'
            : 'Apply what you learned through practice',
        frequency: 'weekly',
        targetCount: 2,
        workloadUnit: locale === 'ja' ? '回' : 'times',
        contributionToGoal:
          locale === 'ja' ? '理論を実践に変換' : 'Convert theory into practice',
        estimatedLevel: 60,
        levelTier: 'intermediate',
        priority: 'medium',
      },
    ],
    health: [
      {
        name: locale === 'ja' ? '毎日30分のウォーキング' : '30 minutes of daily walking',
        description:
          locale === 'ja' ? '軽い有酸素運動で健康維持' : 'Light cardio for health maintenance',
        frequency: 'daily',
        targetCount: 1,
        workloadUnit: locale === 'ja' ? '分' : 'minutes',
        contributionToGoal:
          locale === 'ja' ? '基礎体力の向上' : 'Improve basic fitness',
        estimatedLevel: 30,
        levelTier: 'beginner',
        priority: 'high',
      },
      {
        name: locale === 'ja' ? '水を2リットル飲む' : 'Drink 2 liters of water',
        description:
          locale === 'ja' ? '十分な水分補給で代謝を促進' : 'Stay hydrated to boost metabolism',
        frequency: 'daily',
        targetCount: 2,
        workloadUnit: locale === 'ja' ? 'リットル' : 'liters',
        contributionToGoal:
          locale === 'ja' ? '健康的な代謝をサポート' : 'Support healthy metabolism',
        estimatedLevel: 20,
        levelTier: 'beginner',
        priority: 'medium',
      },
    ],
    productivity: [
      {
        name: locale === 'ja' ? '朝のタスク整理' : 'Morning task organization',
        description:
          locale === 'ja'
            ? '1日の始まりにタスクを整理する'
            : 'Organize tasks at the start of the day',
        frequency: 'daily',
        targetCount: 1,
        workloadUnit: null,
        contributionToGoal:
          locale === 'ja' ? '1日の生産性を向上' : 'Improve daily productivity',
        estimatedLevel: 35,
        levelTier: 'beginner',
        priority: 'high',
      },
      {
        name: locale === 'ja' ? 'ポモドーロテクニック' : 'Pomodoro technique',
        description:
          locale === 'ja'
            ? '25分集中、5分休憩のサイクルで作業'
            : 'Work in 25-minute focus, 5-minute break cycles',
        frequency: 'daily',
        targetCount: 4,
        workloadUnit: locale === 'ja' ? 'セット' : 'sets',
        contributionToGoal:
          locale === 'ja' ? '集中力と効率を向上' : 'Improve focus and efficiency',
        estimatedLevel: 50,
        levelTier: 'intermediate',
        priority: 'medium',
      },
    ],
    relationship: [
      {
        name: locale === 'ja' ? '感謝を伝える' : 'Express gratitude',
        description:
          locale === 'ja'
            ? '毎日誰かに感謝の気持ちを伝える'
            : 'Express gratitude to someone every day',
        frequency: 'daily',
        targetCount: 1,
        workloadUnit: null,
        contributionToGoal:
          locale === 'ja' ? '人間関係を強化' : 'Strengthen relationships',
        estimatedLevel: 25,
        levelTier: 'beginner',
        priority: 'high',
      },
    ],
    finance: [
      {
        name: locale === 'ja' ? '支出の記録' : 'Track expenses',
        description:
          locale === 'ja' ? '毎日の支出を記録する' : 'Record daily expenses',
        frequency: 'daily',
        targetCount: 1,
        workloadUnit: null,
        contributionToGoal:
          locale === 'ja' ? '支出パターンを把握' : 'Understand spending patterns',
        estimatedLevel: 30,
        levelTier: 'beginner',
        priority: 'high',
      },
    ],
    other: [
      {
        name: locale === 'ja' ? '日次振り返り' : 'Daily reflection',
        description:
          locale === 'ja'
            ? '1日の終わりに振り返りを行う'
            : 'Reflect at the end of each day',
        frequency: 'daily',
        targetCount: 1,
        workloadUnit: null,
        contributionToGoal:
          locale === 'ja' ? '継続的な改善をサポート' : 'Support continuous improvement',
        estimatedLevel: 30,
        levelTier: 'beginner',
        priority: 'medium',
      },
    ],
  };

  // Filter out suggestions that match existing habits
  const existingNamesLower = existingHabitNames.map((n) => n.toLowerCase());

  return (suggestions[goalType] || suggestions.other).filter(
    (s) => !existingNamesLower.some((name) => name.includes(s.name.toLowerCase()))
  );
}

/**
 * Step 3: Map habits to goal and suggest new ones
 */
export async function mapHabits(
  input: GoalAchievementInput,
  assessment: GoalAssessmentResult,
  context: GoalAchievementContext
): Promise<HabitMappingResult> {
  const startTime = Date.now();
  logger.info('Starting habit mapping', { goalId: input.goalId });

  try {
    // Fetch goal and habits
    const goal = await context.goalRepo.getById(input.goalId);
    if (!goal) {
      throw new Error(`Goal not found: ${input.goalId}`);
    }

    const allHabits = await context.habitRepo.getByOwner('user', input.userId, true);
    const activeHabits = allHabits.filter((h) => h.active);

    // Analyze existing habits
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - DEFAULT_ANALYSIS_PERIOD_DAYS);
    const now = new Date();

    const activities = await context.activityRepo.getActivitiesByOwnerInRange(
      'user',
      input.userId,
      thirtyDaysAgo,
      now
    );

    const existingHabits: LinkedHabitAnalysis[] = [];

    for (const habit of activeHabits) {
      const contributionScore = calculateContributionScore(habit, goal);

      // Only include habits with significant contribution
      if (contributionScore > 20) {
        const habitActivities = activities.filter((a) => a.habit_id === habit.id);
        const expectedCount =
          habit.frequency === 'daily'
            ? DEFAULT_ANALYSIS_PERIOD_DAYS
            : habit.frequency === 'weekly'
              ? Math.floor(DEFAULT_ANALYSIS_PERIOD_DAYS / 7)
              : 1;
        const completionRate = Math.min(habitActivities.length / expectedCount, 1);

        // Calculate current streak (simplified)
        let currentStreak = 0;
        const sortedActivities = habitActivities.sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        if (sortedActivities.length > 0) {
          const lastActivity = new Date(sortedActivities[0]!.timestamp);
          const daysDiff = Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));
          if (daysDiff <= 1) {
            currentStreak = Math.min(sortedActivities.length, 7); // Simplified streak calculation
          }
        }

        const recommendation =
          completionRate >= 0.8
            ? input.locale === 'ja'
              ? 'この習慣は順調です。継続してください！'
              : 'This habit is on track. Keep it up!'
            : completionRate >= 0.5
              ? input.locale === 'ja'
                ? '達成率を上げるために、リマインダーの設定をお勧めします'
                : 'Consider setting reminders to improve completion rate'
              : input.locale === 'ja'
                ? 'この習慣は改善が必要です。ベビーステップを検討してください'
                : 'This habit needs improvement. Consider baby steps';

        existingHabits.push({
          habitId: habit.id,
          habitName: habit.name,
          contributionScore,
          completionRate,
          currentStreak,
          recommendation,
        });
      }
    }

    // Sort by contribution score
    existingHabits.sort((a, b) => b.contributionScore - a.contributionScore);

    // Generate suggestions
    const suggestedHabits = generateHabitSuggestions(
      assessment.goalType,
      activeHabits.map((h) => h.name),
      input.locale
    );

    // Identify gaps
    const gaps: string[] = [];

    if (existingHabits.length === 0) {
      gaps.push(
        input.locale === 'ja'
          ? 'この目標に関連する習慣がまだありません'
          : 'No habits linked to this goal yet'
      );
    }

    const lowCompletionHabits = existingHabits.filter((h) => h.completionRate < 0.5);
    if (lowCompletionHabits.length > 0) {
      gaps.push(
        input.locale === 'ja'
          ? `${lowCompletionHabits.length}個の習慣の達成率が50%未満です`
          : `${lowCompletionHabits.length} habit(s) have completion rate below 50%`
      );
    }

    const totalContributionScore = existingHabits.reduce((sum, h) => sum + h.contributionScore, 0);

    const result: HabitMappingResult = {
      goalId: input.goalId,
      existingHabits,
      suggestedHabits,
      totalContributionScore,
      gaps,
    };

    logger.info('Habit mapping completed', {
      goalId: input.goalId,
      existingHabitCount: existingHabits.length,
      suggestedHabitCount: suggestedHabits.length,
      durationMs: Date.now() - startTime,
    });

    return result;
  } catch (error) {
    logger.error('Habit mapping failed', error as Error, { goalId: input.goalId });
    throw error;
  }
}

// =============================================================================
// Step 4: Progress Tracking
// =============================================================================

/**
 * Step 4: Calculate progress and predict completion
 */
export async function trackProgress(
  input: GoalAchievementInput,
  assessment: GoalAssessmentResult,
  habitMapping: HabitMappingResult,
  _context: GoalAchievementContext
): Promise<ProgressTrackingResult> {
  const startTime = Date.now();
  logger.info('Starting progress tracking', { goalId: input.goalId });

  try {
    // Calculate current progress based on habit completion
    const existingHabits = habitMapping.existingHabits;
    let currentProgress = 0;

    if (existingHabits.length > 0) {
      const weightedProgress = existingHabits.reduce((sum, habit) => {
        return sum + habit.completionRate * habit.contributionScore;
      }, 0);

      const totalWeight = existingHabits.reduce((sum, habit) => sum + habit.contributionScore, 0);

      currentProgress = totalWeight > 0 ? Math.round((weightedProgress / totalWeight) * 100) : 0;
    } else {
      // No linked habits - base progress on goal readiness
      currentProgress = Math.round(assessment.analysis.overallReadiness * 0.3);
    }

    // Determine trend (simplified - would use historical data in production)
    const trend: 'improving' | 'stable' | 'declining' =
      currentProgress > 50 ? 'improving' : currentProgress > 20 ? 'stable' : 'declining';

    // Calculate predicted completion date
    let predictedCompletionDate: string | null = null;
    let daysToCompletion: number | null = null;
    let confidenceLevel: 'high' | 'medium' | 'low' = 'low';

    if (currentProgress > 0 && trend !== 'declining') {
      const progressPerDay = currentProgress / DEFAULT_ANALYSIS_PERIOD_DAYS;
      const remainingProgress = 100 - currentProgress;

      if (progressPerDay > 0) {
        daysToCompletion = Math.ceil(remainingProgress / progressPerDay);
        const completionDate = new Date();
        completionDate.setDate(completionDate.getDate() + daysToCompletion);
        predictedCompletionDate = completionDate.toISOString().split('T')[0] || null;

        // Determine confidence
        if (existingHabits.length >= 3 && trend === 'improving') {
          confidenceLevel = 'high';
        } else if (existingHabits.length >= 1) {
          confidenceLevel = 'medium';
        }
      }
    }

    // Generate progress history (simulated - would use real data)
    const progressHistory: { date: string; progress: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i * 7);
      const historicalProgress = Math.max(
        0,
        currentProgress - Math.round(Math.random() * 10 * (6 - i))
      );
      progressHistory.push({
        date: date.toISOString().split('T')[0]!,
        progress: historicalProgress,
      });
    }

    // Generate insights
    const insights: string[] = [];

    if (currentProgress >= 80) {
      insights.push(
        input.locale === 'ja'
          ? '目標達成に非常に近づいています！'
          : 'You are very close to achieving your goal!'
      );
    } else if (currentProgress >= 50) {
      insights.push(
        input.locale === 'ja'
          ? '順調に進んでいます。このペースを維持しましょう。'
          : 'Good progress. Maintain this pace.'
      );
    } else {
      insights.push(
        input.locale === 'ja'
          ? 'まだ初期段階です。習慣を着実に積み重ねましょう。'
          : 'Still in early stages. Build habits steadily.'
      );
    }

    if (habitMapping.gaps.length > 0) {
      insights.push(
        input.locale === 'ja'
          ? '改善の余地があるポイントが見つかりました。'
          : 'Areas for improvement have been identified.'
      );
    }

    // Generate recommendations
    const recommendations: string[] = [];

    if (existingHabits.length === 0) {
      recommendations.push(
        input.locale === 'ja'
          ? '目標に関連する習慣を追加することをお勧めします。'
          : 'We recommend adding habits related to this goal.'
      );
    }

    if (trend === 'declining') {
      recommendations.push(
        input.locale === 'ja'
          ? '進捗が減速しています。習慣の難易度を下げることを検討してください。'
          : 'Progress is slowing. Consider reducing habit difficulty.'
      );
    }

    if (confidenceLevel === 'low') {
      recommendations.push(
        input.locale === 'ja'
          ? 'より正確な予測のため、習慣を継続してデータを蓄積しましょう。'
          : 'Continue habits to build data for more accurate predictions.'
      );
    }

    const result: ProgressTrackingResult = {
      goalId: input.goalId,
      currentProgress,
      trend,
      predictedCompletionDate,
      daysToCompletion,
      confidenceLevel,
      progressHistory,
      insights,
      recommendations,
    };

    logger.info('Progress tracking completed', {
      goalId: input.goalId,
      currentProgress,
      trend,
      durationMs: Date.now() - startTime,
    });

    return result;
  } catch (error) {
    logger.error('Progress tracking failed', error as Error, { goalId: input.goalId });
    throw error;
  }
}

// =============================================================================
// Main Workflow Executor
// =============================================================================

/**
 * Execute the complete goal achievement workflow
 */
export async function executeGoalAchievementWorkflow(
  input: GoalAchievementInput,
  supabase: SupabaseClient
): Promise<GoalAchievementWorkflowResult> {
  const startTime = Date.now();
  logger.info('Starting goal achievement workflow', { goalId: input.goalId, userId: input.userId });

  // Validate input
  const validatedInput = GoalAchievementInputSchema.parse(input);

  // Create context
  const context = createWorkflowContext(supabase);

  try {
    // Step 1: Goal Assessment
    const assessment = await assessGoal(validatedInput, context);

    // Step 2: Milestone Planning (uses assessment results for branching)
    const milestones = await planMilestones(validatedInput, assessment, context);

    // Step 3: Habit Mapping (uses assessment for goal type branching)
    const habitMapping = await mapHabits(validatedInput, assessment, context);

    // Step 4: Progress Tracking (uses all previous results)
    const progressTracking = await trackProgress(validatedInput, assessment, habitMapping, context);

    // Determine overall status
    let overallStatus: 'on_track' | 'at_risk' | 'behind' | 'completed';
    if (progressTracking.currentProgress >= 100) {
      overallStatus = 'completed';
    } else if (progressTracking.trend === 'declining') {
      overallStatus = 'behind';
    } else if (progressTracking.confidenceLevel === 'low' || habitMapping.gaps.length > 2) {
      overallStatus = 'at_risk';
    } else {
      overallStatus = 'on_track';
    }

    // Generate priority actions
    const priorityActions: string[] = [];

    if (habitMapping.existingHabits.length === 0) {
      priorityActions.push(
        validatedInput.locale === 'ja'
          ? '目標に関連する習慣を1つ追加する'
          : 'Add one habit related to this goal'
      );
    }

    if (habitMapping.gaps.length > 0) {
      priorityActions.push(
        validatedInput.locale === 'ja'
          ? '特定されたギャップを解消する'
          : 'Address identified gaps'
      );
    }

    if (progressTracking.trend === 'declining') {
      priorityActions.push(
        validatedInput.locale === 'ja'
          ? '習慣の難易度を見直す'
          : 'Review habit difficulty levels'
      );
    }

    // Calculate next review date (1 week from now)
    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + 7);

    const result: GoalAchievementWorkflowResult = {
      goalId: validatedInput.goalId,
      goalName: assessment.goalName,
      executedAt: new Date().toISOString(),
      locale: validatedInput.locale,
      assessment,
      milestones,
      habitMapping,
      progressTracking,
      summary: {
        overallStatus,
        priorityActions,
        nextReviewDate: nextReviewDate.toISOString().split('T')[0]!,
      },
    };

    logger.info('Goal achievement workflow completed successfully', {
      goalId: validatedInput.goalId,
      overallStatus,
      durationMs: Date.now() - startTime,
    });

    return result;
  } catch (error) {
    logger.error('Goal achievement workflow failed', error as Error, {
      goalId: validatedInput.goalId,
    });
    throw error;
  }
}

// =============================================================================
// Exports
// =============================================================================

export {
  executeGoalAchievementWorkflow as runGoalAchievementWorkflow,
  assessGoal as runGoalAssessment,
  planMilestones as runMilestonePlanning,
  mapHabits as runHabitMapping,
  trackProgress as runProgressTracking,
};
