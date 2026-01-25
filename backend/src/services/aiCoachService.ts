/**
 * AI Coach Service with Function Calling
 *
 * Provides intelligent coaching using OpenAI Function Calling.
 * The AI can autonomously call tools to analyze habits, get workload data,
 * and provide personalized coaching advice.
 */

import OpenAI from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import { getSettings } from '../config.js';
import { getLogger } from '../utils/logger.js';
import { HabitRepository } from '../repositories/habitRepository.js';
import { ActivityRepository } from '../repositories/activityRepository.js';
import { GoalRepository } from '../repositories/goalRepository.js';
import type { SupabaseClient } from '@supabase/supabase-js';

const logger = getLogger('aiCoachService');

/**
 * Tool definitions for OpenAI Function Calling
 */
const COACH_TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'analyze_habits',
      description: 'ユーザーの習慣の達成率と傾向を分析する。達成率が低い習慣、最近サボりがちな習慣、順調な習慣を特定できる。',
      parameters: {
        type: 'object',
        properties: {
          period_days: {
            type: 'number',
            description: '分析対象の期間（日数）。デフォルトは30日。',
          },
          habit_ids: {
            type: 'array',
            items: { type: 'string' },
            description: '特定の習慣IDのみを分析する場合に指定。省略時は全習慣を分析。',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_workload_summary',
      description: 'ユーザーの現在のワークロード（習慣の負荷）状況を取得する。過負荷かどうか、余裕があるかを判断できる。',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'suggest_habit_adjustments',
      description: '達成率や負荷に基づいて、習慣の調整案を生成する。頻度の変更、目標値の調整、一時停止などを提案。',
      parameters: {
        type: 'object',
        properties: {
          focus: {
            type: 'string',
            enum: ['low_completion', 'high_workload', 'optimization'],
            description: '調整の焦点。low_completion=達成率改善、high_workload=負荷軽減、optimization=全体最適化',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_habit_details',
      description: '特定の習慣の詳細情報と履歴を取得する。',
      parameters: {
        type: 'object',
        properties: {
          habit_name: {
            type: 'string',
            description: '習慣の名前（部分一致で検索）',
          },
        },
        required: ['habit_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_goal_progress',
      description: 'ゴールとそれに紐づく習慣の進捗状況を取得する。',
      parameters: {
        type: 'object',
        properties: {
          goal_name: {
            type: 'string',
            description: 'ゴールの名前（部分一致で検索）。省略時は全ゴールを取得。',
          },
        },
        required: [],
      },
    },
  },
];

/**
 * System prompt for the AI Coach
 */
const COACH_SYSTEM_PROMPT = `あなたは習慣管理アプリの専属AIコーチです。ユーザーの習慣形成を親身にサポートします。

あなたの特徴:
- 共感的で励ましの姿勢を持つ
- 具体的で実行可能なアドバイスを提供する
- ユーザーの状況を深く理解するために質問する
- データに基づいた客観的な分析ができる

利用可能なツール:
- analyze_habits: 習慣の達成率と傾向を分析
- get_workload_summary: ワークロード状況を確認
- suggest_habit_adjustments: 調整案を生成
- get_habit_details: 特定の習慣の詳細を取得
- get_goal_progress: ゴールの進捗を確認

コーチングの原則:
1. まずユーザーの話を聞き、状況を理解する
2. 必要に応じてツールを使ってデータを確認する
3. データと会話の両方を踏まえてアドバイスする
4. 一度に多くの変更を提案しない（1-2個に絞る）
5. ユーザーの自主性を尊重し、押し付けない

応答スタイル:
- 自然な日本語で会話する
- 絵文字を適度に使う
- 長すぎない応答を心がける
- 質問で会話を続ける`;

interface HabitAnalysis {
  habitId: string;
  habitName: string;
  completionRate: number;
  trend: 'improving' | 'stable' | 'declining';
  recentCompletions: number;
  targetCompletions: number;
  lastCompletedAt: string | null;
}

interface WorkloadSummary {
  totalHabits: number;
  activeHabits: number;
  dailyMinutes: number;
  weeklyMinutes: number;
  status: 'light' | 'moderate' | 'heavy' | 'overloaded';
  recommendation: string;
}

interface AdjustmentSuggestion {
  habitId: string;
  habitName: string;
  currentState: string;
  suggestion: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
}

export interface CoachResponse {
  message: string;
  toolsUsed: string[];
  tokensUsed: number;
  data?: {
    analysis?: HabitAnalysis[];
    workload?: WorkloadSummary;
    suggestions?: AdjustmentSuggestion[];
    habitDetails?: Record<string, unknown>;
    goalProgress?: Record<string, unknown>;
  } | undefined;
}

/**
 * AI Coach Service
 */
export class AICoachService {
  private openai: OpenAI | null = null;
  private model: string;
  private habitRepo: HabitRepository;
  private activityRepo: ActivityRepository;
  private goalRepo: GoalRepository;
  private userId: string;

  constructor(supabase: SupabaseClient, userId: string) {
    const settings = getSettings();
    this.model = settings.openaiModel || 'gpt-4o-mini';
    this.userId = userId;

    if (settings.openaiApiKey) {
      this.openai = new OpenAI({ apiKey: settings.openaiApiKey });
    }

    this.habitRepo = new HabitRepository(supabase);
    this.activityRepo = new ActivityRepository(supabase);
    this.goalRepo = new GoalRepository(supabase);
  }

  /**
   * Check if service is available
   */
  isAvailable(): boolean {
    return this.openai !== null;
  }

  /**
   * Process a coaching conversation with function calling
   */
  async chat(
    userMessage: string,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
  ): Promise<CoachResponse> {
    if (!this.openai) {
      throw new Error('OpenAI API key not configured');
    }

    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: COACH_SYSTEM_PROMPT },
      ...conversationHistory.slice(-10).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: userMessage },
    ];

    const toolsUsed: string[] = [];
    const collectedData: NonNullable<CoachResponse['data']> = {};
    let totalTokens = 0;

    // Allow up to 3 tool call iterations
    for (let iteration = 0; iteration < 3; iteration++) {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages,
        tools: COACH_TOOLS,
        tool_choice: 'auto',
        temperature: 0.7,
        max_tokens: 1500,
      });

      totalTokens += response.usage?.total_tokens || 0;
      const choice = response.choices[0];

      if (!choice) {
        break;
      }

      if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls) {
        // Process tool calls
        messages.push(choice.message);

        for (const toolCall of choice.message.tool_calls) {
          if (toolCall.type !== 'function') continue;
          
          const toolName = toolCall.function.name;
          const args = JSON.parse(toolCall.function.arguments || '{}') as Record<string, unknown>;
          
          toolsUsed.push(toolName);
          logger.info('Executing tool', { toolName, args, userId: this.userId });

          const result = await this.executeTool(toolName, args);
          
          // Store collected data
          this.storeToolResult(collectedData, toolName, result);

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        }
      } else {
        // Final response
        return {
          message: choice.message.content || 'すみません、応答を生成できませんでした。',
          toolsUsed,
          tokensUsed: totalTokens,
          data: Object.keys(collectedData).length > 0 ? collectedData : undefined,
        };
      }
    }

    // If we hit max iterations, get final response
    const finalResponse = await this.openai.chat.completions.create({
      model: this.model,
      messages,
      temperature: 0.7,
      max_tokens: 1000,
    });

    totalTokens += finalResponse.usage?.total_tokens || 0;
    const finalChoice = finalResponse.choices[0];

    return {
      message: finalChoice?.message.content || 'すみません、応答を生成できませんでした。',
      toolsUsed,
      tokensUsed: totalTokens,
      data: Object.keys(collectedData).length > 0 ? collectedData : undefined,
    };
  }

  /**
   * Execute a tool and return the result
   */
  private async executeTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    switch (toolName) {
      case 'analyze_habits':
        return this.analyzeHabits(
          (args['period_days'] as number) || 30,
          args['habit_ids'] as string[] | undefined
        );

      case 'get_workload_summary':
        return this.getWorkloadSummary();

      case 'suggest_habit_adjustments':
        return this.suggestAdjustments(args['focus'] as string | undefined);

      case 'get_habit_details':
        return this.getHabitDetails(args['habit_name'] as string);

      case 'get_goal_progress':
        return this.getGoalProgress(args['goal_name'] as string | undefined);

      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  }

  /**
   * Store tool result in collected data
   */
  private storeToolResult(
    data: NonNullable<CoachResponse['data']>,
    toolName: string,
    result: unknown
  ): void {
    switch (toolName) {
      case 'analyze_habits':
        data.analysis = result as HabitAnalysis[];
        break;
      case 'get_workload_summary':
        data.workload = result as WorkloadSummary;
        break;
      case 'suggest_habit_adjustments':
        data.suggestions = result as AdjustmentSuggestion[];
        break;
      case 'get_habit_details':
        data.habitDetails = result as Record<string, unknown>;
        break;
      case 'get_goal_progress':
        data.goalProgress = result as Record<string, unknown>;
        break;
    }
  }

  /**
   * Analyze habits completion rates and trends
   */
  private async analyzeHabits(
    periodDays: number,
    habitIds?: string[]
  ): Promise<HabitAnalysis[]> {
    const habits = await this.habitRepo.getByOwner('user', this.userId, true);
    const filteredHabits = habitIds
      ? habits.filter(h => habitIds.includes(h.id))
      : habits;

    const now = new Date();
    const periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
    const halfPeriodStart = new Date(now.getTime() - (periodDays / 2) * 24 * 60 * 60 * 1000);

    const analyses: HabitAnalysis[] = [];

    for (const habit of filteredHabits) {
      // Get completions for full period
      const fullPeriodCount = await this.activityRepo.countActivitiesInRange(
        habit.id,
        periodStart,
        now,
        'complete'
      );

      // Get completions for recent half period (for trend)
      const recentCount = await this.activityRepo.countActivitiesInRange(
        habit.id,
        halfPeriodStart,
        now,
        'complete'
      );

      // Calculate expected completions based on frequency
      let expectedCompletions = periodDays;
      if (habit.frequency === 'weekly') {
        expectedCompletions = Math.floor(periodDays / 7);
      } else if (habit.frequency === 'monthly') {
        expectedCompletions = Math.floor(periodDays / 30);
      }

      const completionRate = expectedCompletions > 0
        ? Math.min(1, fullPeriodCount / expectedCompletions)
        : 0;

      // Determine trend
      const firstHalfCount = fullPeriodCount - recentCount;
      let trend: 'improving' | 'stable' | 'declining' = 'stable';
      
      if (recentCount > firstHalfCount * 1.2) {
        trend = 'improving';
      } else if (recentCount < firstHalfCount * 0.8) {
        trend = 'declining';
      }

      // Get last completion
      const lastActivity = await this.activityRepo.getLatestActivity(habit.id, 'complete');

      analyses.push({
        habitId: habit.id,
        habitName: habit.name,
        completionRate: Math.round(completionRate * 100) / 100,
        trend,
        recentCompletions: recentCount,
        targetCompletions: expectedCompletions,
        lastCompletedAt: lastActivity?.timestamp || null,
      });
    }

    // Sort by completion rate (lowest first)
    return analyses.sort((a, b) => a.completionRate - b.completionRate);
  }

  /**
   * Get workload summary
   */
  private async getWorkloadSummary(): Promise<WorkloadSummary> {
    const habits = await this.habitRepo.getByOwner('user', this.userId, true);
    const activeHabits = habits.filter(h => h.active);

    let dailyMinutes = 0;
    let weeklyMinutes = 0;

    for (const habit of activeHabits) {
      // Estimate duration based on workload_per_count (default 15 minutes per count)
      const duration = habit.workload_per_count * 15;
      
      if (habit.frequency === 'daily') {
        dailyMinutes += duration;
        weeklyMinutes += duration * 7;
      } else if (habit.frequency === 'weekly') {
        weeklyMinutes += duration;
        dailyMinutes += duration / 7;
      } else if (habit.frequency === 'monthly') {
        weeklyMinutes += duration / 4;
        dailyMinutes += duration / 30;
      }
    }

    let status: WorkloadSummary['status'] = 'light';
    let recommendation = '余裕があります。新しい習慣を追加しても大丈夫です。';

    if (dailyMinutes > 180) {
      status = 'overloaded';
      recommendation = '負荷が高すぎます。いくつかの習慣を見直すことをお勧めします。';
    } else if (dailyMinutes > 120) {
      status = 'heavy';
      recommendation = '負荷が高めです。無理のない範囲で続けましょう。';
    } else if (dailyMinutes > 60) {
      status = 'moderate';
      recommendation = 'バランスの取れた負荷です。この調子で続けましょう。';
    }

    return {
      totalHabits: habits.length,
      activeHabits: activeHabits.length,
      dailyMinutes: Math.round(dailyMinutes),
      weeklyMinutes: Math.round(weeklyMinutes),
      status,
      recommendation,
    };
  }

  /**
   * Suggest habit adjustments
   */
  private async suggestAdjustments(
    focus?: string
  ): Promise<AdjustmentSuggestion[]> {
    const analysis = await this.analyzeHabits(30);
    const workload = await this.getWorkloadSummary();
    const suggestions: AdjustmentSuggestion[] = [];

    // Low completion rate habits
    if (!focus || focus === 'low_completion' || focus === 'optimization') {
      const lowCompletionHabits = analysis.filter(a => a.completionRate < 0.5);
      
      for (const habit of lowCompletionHabits.slice(0, 3)) {
        suggestions.push({
          habitId: habit.habitId,
          habitName: habit.habitName,
          currentState: `達成率 ${Math.round(habit.completionRate * 100)}%`,
          suggestion: habit.completionRate < 0.2
            ? '一時停止して、より小さな習慣から始めることを検討'
            : '頻度を減らすか、目標を小さくすることを検討',
          reason: `過去30日間の達成率が${Math.round(habit.completionRate * 100)}%と低いため`,
          priority: habit.completionRate < 0.2 ? 'high' : 'medium',
        });
      }
    }

    // High workload
    if ((!focus || focus === 'high_workload' || focus === 'optimization') && 
        (workload.status === 'heavy' || workload.status === 'overloaded')) {
      const decliningHabits = analysis.filter(a => a.trend === 'declining');
      
      for (const habit of decliningHabits.slice(0, 2)) {
        if (!suggestions.find(s => s.habitId === habit.habitId)) {
          suggestions.push({
            habitId: habit.habitId,
            habitName: habit.habitName,
            currentState: `傾向: 下降中`,
            suggestion: '負荷軽減のため、頻度を週1-2回に減らすことを検討',
            reason: '全体の負荷が高く、この習慣の達成率が下がっているため',
            priority: 'medium',
          });
        }
      }
    }

    return suggestions;
  }

  /**
   * Get details for a specific habit
   */
  private async getHabitDetails(habitName: string): Promise<Record<string, unknown>> {
    const habits = await this.habitRepo.searchByName('user', this.userId, habitName, 1);
    
    if (habits.length === 0) {
      return { error: `「${habitName}」という習慣が見つかりませんでした` };
    }

    const habit = habits[0];
    if (!habit) {
      return { error: `「${habitName}」という習慣が見つかりませんでした` };
    }
    
    const analysis = await this.analyzeHabits(30, [habit.id]);
    const recentActivities = await this.activityRepo.getHabitActivities(habit.id, 'complete', 10);

    return {
      id: habit.id,
      name: habit.name,
      frequency: habit.frequency,
      targetCount: habit.target_count,
      workloadUnit: habit.workload_unit,
      isActive: habit.active,
      analysis: analysis[0] || null,
      recentCompletions: recentActivities.map(a => ({
        timestamp: a.timestamp,
        amount: a.amount,
      })),
    };
  }

  /**
   * Get goal progress
   */
  private async getGoalProgress(goalName?: string): Promise<Record<string, unknown>> {
    const goals = await this.goalRepo.getByOwner('user', this.userId);
    
    const filteredGoals = goalName
      ? goals.filter(g => g.name.toLowerCase().includes(goalName.toLowerCase()))
      : goals;

    if (filteredGoals.length === 0) {
      return goalName
        ? { error: `「${goalName}」というゴールが見つかりませんでした` }
        : { error: 'ゴールがまだ設定されていません' };
    }

    const progress = [];

    for (const goal of filteredGoals) {
      const habits = await this.habitRepo.getHabitsByGoal(goal.id, true);
      const habitAnalyses = habits.length > 0
        ? await this.analyzeHabits(30, habits.map(h => h.id))
        : [];

      const avgCompletionRate = habitAnalyses.length > 0
        ? habitAnalyses.reduce((sum, a) => sum + a.completionRate, 0) / habitAnalyses.length
        : 0;

      progress.push({
        goalId: goal.id,
        goalName: goal.name,
        habitCount: habits.length,
        averageCompletionRate: Math.round(avgCompletionRate * 100) / 100,
        habits: habitAnalyses.map(a => ({
          name: a.habitName,
          completionRate: a.completionRate,
          trend: a.trend,
        })),
      });
    }

    return { goals: progress };
  }
}

/**
 * Factory function to create AI Coach Service
 */
export function createAICoachService(
  supabase: SupabaseClient,
  userId: string
): AICoachService {
  return new AICoachService(supabase, userId);
}
