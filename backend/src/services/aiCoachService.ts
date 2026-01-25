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
  // === 既存ツール ===
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
  // === 新規ツール: 習慣テンプレート/ナレッジベース ===
  {
    type: 'function',
    function: {
      name: 'get_habit_template',
      description: '特定のカテゴリの習慣テンプレートと科学的なベストプラクティスを取得する。新しい習慣を始める際の参考になる。',
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            enum: ['exercise', 'reading', 'meditation', 'sleep', 'nutrition', 'learning', 'productivity', 'social', 'creativity'],
            description: '習慣のカテゴリ。exercise=運動、reading=読書、meditation=瞑想、sleep=睡眠、nutrition=食事、learning=学習、productivity=生産性、social=人間関係、creativity=創造性',
          },
        },
        required: ['category'],
      },
    },
  },
  // === 新規ツール: 行動科学ベース ===
  {
    type: 'function',
    function: {
      name: 'suggest_habit_stacking',
      description: '既存の習慣に新しい習慣を紐付ける「習慣スタッキング」の提案を生成する。「〜した後に〜する」形式で習慣を連鎖させる。',
      parameters: {
        type: 'object',
        properties: {
          new_habit_name: {
            type: 'string',
            description: '新しく始めたい習慣の名前や内容',
          },
        },
        required: ['new_habit_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'identify_triggers',
      description: 'ユーザーの習慣実行パターンから、効果的なトリガー（きっかけ）となる時間帯、場所、行動を特定する。',
      parameters: {
        type: 'object',
        properties: {
          habit_name: {
            type: 'string',
            description: '分析対象の習慣名（省略時は全習慣を分析）',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'calculate_minimum_viable_habit',
      description: '習慣を最小限の形（2分ルール）に分解して、始めやすい形を提案する。挫折しにくい小さな一歩を設計。',
      parameters: {
        type: 'object',
        properties: {
          habit_name: {
            type: 'string',
            description: '小さくしたい習慣の名前や内容',
          },
          current_target: {
            type: 'string',
            description: '現在の目標（例: 30分ジョギング、10ページ読書）',
          },
        },
        required: ['habit_name'],
      },
    },
  },
  // === 新規ツール: モチベーション分析 ===
  {
    type: 'function',
    function: {
      name: 'analyze_motivation_patterns',
      description: 'ユーザーの習慣実行パターンから、モチベーションが高い/低い時間帯や曜日を分析する。',
      parameters: {
        type: 'object',
        properties: {
          period_days: {
            type: 'number',
            description: '分析対象の期間（日数）。デフォルトは30日。',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'suggest_rewards',
      description: '習慣の継続を促す報酬システムを提案する。内発的・外発的動機付けの両方を考慮。',
      parameters: {
        type: 'object',
        properties: {
          habit_name: {
            type: 'string',
            description: '報酬を設定したい習慣の名前',
          },
          preference: {
            type: 'string',
            enum: ['intrinsic', 'extrinsic', 'both'],
            description: '報酬の種類。intrinsic=内発的（達成感など）、extrinsic=外発的（ご褒美など）、both=両方',
          },
        },
        required: ['habit_name'],
      },
    },
  },
];

/**
 * System prompt for the AI Coach
 */
const COACH_SYSTEM_PROMPT = `あなたは習慣管理アプリの専属AIコーチです。行動科学と心理学の知識を活かして、ユーザーの習慣形成を親身にサポートします。

あなたの特徴:
- 共感的で励ましの姿勢を持つ
- 科学的根拠に基づいたアドバイスを提供する
- ユーザーの状況を深く理解するために質問する
- データに基づいた客観的な分析ができる
- 小さな一歩から始めることを重視する

利用可能なツール:

【分析系】
- analyze_habits: 習慣の達成率と傾向を分析
- get_workload_summary: ワークロード状況を確認
- get_habit_details: 特定の習慣の詳細を取得
- get_goal_progress: ゴールの進捗を確認
- analyze_motivation_patterns: モチベーションパターンを分析

【提案系】
- suggest_habit_adjustments: 調整案を生成
- get_habit_template: 習慣テンプレートとベストプラクティスを取得
- suggest_habit_stacking: 習慣スタッキングを提案
- calculate_minimum_viable_habit: 最小限の習慣を設計
- suggest_rewards: 報酬システムを提案

【トリガー分析】
- identify_triggers: 効果的なトリガーを特定

コーチングの原則:
1. まずユーザーの話を聞き、状況を理解する
2. 必要に応じてツールを使ってデータを確認する
3. 科学的知見とデータの両方を踏まえてアドバイスする
4. 一度に多くの変更を提案しない（1-2個に絞る）
5. 「2分ルール」を活用し、小さく始めることを推奨
6. 習慣スタッキングで既存の行動に紐付ける
7. ユーザーの自主性を尊重し、押し付けない

行動科学の知識:
- 習慣ループ: きっかけ → 行動 → 報酬
- 2分ルール: 新しい習慣は2分以内でできる形から始める
- 習慣スタッキング: 「〜した後に〜する」で既存習慣に紐付け
- 環境デザイン: 良い習慣を簡単に、悪い習慣を難しくする
- アイデンティティ: 「〜する人」というセルフイメージを育てる

応答スタイル:
- 自然な日本語で会話する
- 絵文字を適度に使う
- 長すぎない応答を心がける
- 質問で会話を続ける
- 具体的なアクションを提案する`;

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
      // 既存ツール
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

      // 新規ツール: 習慣テンプレート
      case 'get_habit_template':
        return this.getHabitTemplate(args['category'] as string);

      // 新規ツール: 行動科学ベース
      case 'suggest_habit_stacking':
        return this.suggestHabitStacking(args['new_habit_name'] as string);

      case 'identify_triggers':
        return this.identifyTriggers(args['habit_name'] as string | undefined);

      case 'calculate_minimum_viable_habit':
        return this.calculateMinimumViableHabit(
          args['habit_name'] as string,
          args['current_target'] as string | undefined
        );

      // 新規ツール: モチベーション分析
      case 'analyze_motivation_patterns':
        return this.analyzeMotivationPatterns((args['period_days'] as number) || 30);

      case 'suggest_rewards':
        return this.suggestRewards(
          args['habit_name'] as string,
          args['preference'] as string | undefined
        );

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

  // ============================================================================
  // 新規ツール: 習慣テンプレート/ナレッジベース
  // ============================================================================

  /**
   * Get habit template and best practices for a category
   */
  private getHabitTemplate(category: string): Record<string, unknown> {
    const templates: Record<string, {
      name: string;
      description: string;
      startSmall: string;
      idealFrequency: string;
      bestTime: string;
      commonMistakes: string[];
      tips: string[];
      scienceNote: string;
    }> = {
      exercise: {
        name: '運動習慣',
        description: '身体を動かす習慣。健康維持、ストレス解消、エネルギー向上に効果的。',
        startSmall: '1日5分のストレッチや散歩から始める',
        idealFrequency: '週3-5回（毎日でなくてOK）',
        bestTime: '朝（コルチゾールが高く、習慣化しやすい）または夕方（体温が高く、パフォーマンスが良い）',
        commonMistakes: ['いきなり毎日1時間を目指す', '完璧を求めすぎる', '休息日を設けない'],
        tips: ['運動着を前日に準備しておく', '友人と一緒に始める', '好きな音楽やポッドキャストと組み合わせる'],
        scienceNote: '運動は脳内のBDNF（脳由来神経栄養因子）を増加させ、学習能力と気分を向上させます。',
      },
      reading: {
        name: '読書習慣',
        description: '本を読む習慣。知識獲得、集中力向上、ストレス軽減に効果的。',
        startSmall: '1日1ページまたは5分から始める',
        idealFrequency: '毎日（短時間でも継続が重要）',
        bestTime: '就寝前（リラックス効果）または朝（集中力が高い）',
        commonMistakes: ['難しい本から始める', '1冊読み終えることにこだわる', 'スマホの近くで読む'],
        tips: ['常に本を持ち歩く', '読書専用の場所を作る', '興味のある本から始める'],
        scienceNote: '読書は共感能力を高め、認知症リスクを低下させることが研究で示されています。',
      },
      meditation: {
        name: '瞑想習慣',
        description: 'マインドフルネスや瞑想の習慣。ストレス軽減、集中力向上、感情調整に効果的。',
        startSmall: '1日1分の深呼吸から始める',
        idealFrequency: '毎日（短時間でも効果あり）',
        bestTime: '朝起きてすぐ（1日の始まりを整える）',
        commonMistakes: ['「何も考えない」ことを目指す', '長時間を目指しすぎる', '効果をすぐに期待する'],
        tips: ['アプリを活用する', '同じ時間、同じ場所で行う', '呼吸に意識を向けることから始める'],
        scienceNote: '8週間の瞑想で扁桃体が縮小し、前頭前皮質が活性化することが確認されています。',
      },
      sleep: {
        name: '睡眠習慣',
        description: '質の良い睡眠を取る習慣。健康、認知機能、感情調整の基盤。',
        startSmall: '就寝時間を15分早める',
        idealFrequency: '毎日同じ時間に寝起きする',
        bestTime: '22:00-23:00就寝が理想的',
        commonMistakes: ['週末に寝だめする', '寝る直前までスマホを見る', 'カフェインを午後に摂取する'],
        tips: ['寝室を暗く涼しくする', '就寝1時間前からブルーライトを避ける', '就寝前のルーティンを作る'],
        scienceNote: '睡眠中に脳の老廃物が除去され、記憶が定着します。7-9時間の睡眠が推奨されています。',
      },
      nutrition: {
        name: '食事習慣',
        description: '健康的な食事を取る習慣。エネルギー、健康、気分に直結。',
        startSmall: '1日1食に野菜を追加する',
        idealFrequency: '毎食意識する',
        bestTime: '朝食をしっかり取る、夕食は就寝3時間前まで',
        commonMistakes: ['極端な食事制限', '完璧を求めすぎる', '水分摂取を忘れる'],
        tips: ['週末に食事を準備しておく', '健康的な食品を目につく場所に置く', 'ゆっくり食べる'],
        scienceNote: '腸内細菌叢は脳と密接に関連しており、食事は気分やメンタルヘルスに影響します。',
      },
      learning: {
        name: '学習習慣',
        description: '新しいスキルや知識を学ぶ習慣。キャリア、自己成長に効果的。',
        startSmall: '1日15分の学習から始める',
        idealFrequency: '毎日（間隔を空けた反復が効果的）',
        bestTime: '朝（集中力が高い）または昼食後',
        commonMistakes: ['一度に多くを学ぼうとする', 'インプットだけでアウトプットしない', '復習をしない'],
        tips: ['ポモドーロテクニックを使う', '学んだことを誰かに教える', 'スペースドリピティションを活用'],
        scienceNote: '睡眠中に記憶が定着するため、就寝前の学習は効果的です。',
      },
      productivity: {
        name: '生産性習慣',
        description: '効率的に仕事や作業を行う習慣。時間管理、集中力向上に効果的。',
        startSmall: '朝一番に最重要タスクを1つ決める',
        idealFrequency: '毎日',
        bestTime: '朝（意志力が最も高い）',
        commonMistakes: ['マルチタスクをする', '完璧を求めすぎる', '休憩を取らない'],
        tips: ['前日に翌日のタスクを決める', '通知をオフにする時間を作る', '90分ごとに休憩を取る'],
        scienceNote: '人間の集中力は90分周期（ウルトラディアンリズム）で変動します。',
      },
      social: {
        name: '人間関係習慣',
        description: '人とのつながりを大切にする習慣。幸福感、健康、長寿に関連。',
        startSmall: '週1回、誰かに連絡を取る',
        idealFrequency: '週に数回',
        bestTime: '夕方や週末',
        commonMistakes: ['SNSでの交流だけに頼る', '忙しさを理由に後回しにする', '深い会話を避ける'],
        tips: ['定期的な予定を入れる', '感謝を伝える習慣を持つ', '相手の話を聴くことに集中する'],
        scienceNote: 'ハーバード大学の75年間の研究で、良好な人間関係が健康と幸福の最大の予測因子であることが判明しています。',
      },
      creativity: {
        name: '創造性習慣',
        description: '創造的な活動を行う習慣。問題解決能力、自己表現、ストレス解消に効果的。',
        startSmall: '1日5分、自由に書く/描く/作る',
        idealFrequency: '週3-5回',
        bestTime: '朝（脳がリフレッシュされている）または夜（制約が少ない）',
        commonMistakes: ['完璧な作品を目指す', '他人と比較する', 'インスピレーションを待つ'],
        tips: ['毎日同じ時間に創作する', '制約を設ける', '失敗を恐れない'],
        scienceNote: '創造性は「発散的思考」と「収束的思考」の組み合わせで、練習で向上します。',
      },
    };

    const template = templates[category];
    if (!template) {
      return {
        error: `カテゴリ「${category}」が見つかりません`,
        availableCategories: Object.keys(templates),
      };
    }

    return template;
  }

  // ============================================================================
  // 新規ツール: 行動科学ベース
  // ============================================================================

  /**
   * Suggest habit stacking opportunities
   */
  private async suggestHabitStacking(newHabitName: string): Promise<Record<string, unknown>> {
    const analysis = await this.analyzeHabits(30);

    // Find high-completion habits as anchors
    const anchorHabits = analysis
      .filter(a => a.completionRate >= 0.7)
      .slice(0, 5);

    if (anchorHabits.length === 0) {
      return {
        message: 'まだ安定した習慣がないため、まずは1つの習慣を定着させることをお勧めします。',
        suggestions: [],
        tip: '新しい習慣は、既存の行動（歯磨き、コーヒーを入れるなど）に紐付けることもできます。',
      };
    }

    const suggestions = anchorHabits.map(anchor => ({
      anchorHabit: anchor.habitName,
      completionRate: `${Math.round(anchor.completionRate * 100)}%`,
      stackingFormula: `「${anchor.habitName}」をした後に「${newHabitName}」をする`,
      reason: `達成率${Math.round(anchor.completionRate * 100)}%の安定した習慣なので、良いアンカーになります`,
    }));

    return {
      newHabit: newHabitName,
      suggestions,
      principle: '習慣スタッキングは、既存の習慣を「きっかけ」として新しい習慣を紐付ける手法です。',
      formula: '「[現在の習慣]をした後に、[新しい習慣]をする」',
    };
  }

  /**
   * Identify effective triggers for habits
   */
  private async identifyTriggers(habitName?: string): Promise<Record<string, unknown>> {
    const habits = await this.habitRepo.getByOwner('user', this.userId, true);

    const targetHabits = habitName
      ? habits.filter(h => h.name.toLowerCase().includes(habitName.toLowerCase()))
      : habits;

    if (targetHabits.length === 0) {
      return { error: habitName ? `「${habitName}」という習慣が見つかりません` : '習慣がありません' };
    }

    const triggerAnalysis = [];

    for (const habit of targetHabits.slice(0, 5)) {
      const activities = await this.activityRepo.getHabitActivities(habit.id, 'complete', 30);
      
      const hourCounts: Record<number, number> = {};
      const dayOfWeekCounts: Record<number, number> = {};

      for (const activity of activities) {
        const date = new Date(activity.timestamp);
        const hour = date.getHours();
        const dayOfWeek = date.getDay();

        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        dayOfWeekCounts[dayOfWeek] = (dayOfWeekCounts[dayOfWeek] || 0) + 1;
      }

      const peakHours = Object.entries(hourCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([hour]) => `${hour}時`);

      const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
      const peakDays = Object.entries(dayOfWeekCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([day]) => `${dayNames[parseInt(day)]}曜日`);

      triggerAnalysis.push({
        habitName: habit.name,
        totalCompletions: activities.length,
        peakHours: peakHours.length > 0 ? peakHours : ['データ不足'],
        peakDays: peakDays.length > 0 ? peakDays : ['データ不足'],
        suggestedTrigger: peakHours.length > 0
          ? `${peakHours[0]}頃に実行するのが最も成功しやすいようです`
          : '実行パターンを確立するために、毎日同じ時間に行うことをお勧めします',
      });
    }

    return {
      analysis: triggerAnalysis,
      generalTips: [
        '時間トリガー: 特定の時刻に実行する',
        '行動トリガー: 既存の行動の後に実行する（習慣スタッキング）',
        '場所トリガー: 特定の場所で実行する',
        '感情トリガー: 特定の気分の時に実行する',
      ],
    };
  }

  /**
   * Calculate minimum viable habit (2-minute rule)
   */
  private calculateMinimumViableHabit(habitName: string, currentTarget?: string): Record<string, unknown> {
    const breakdowns: Record<string, { minimal: string; steps: string[] }> = {
      'ジョギング': { minimal: '運動靴を履く', steps: ['運動靴を履く', '玄関を出る', '5分歩く', '10分ジョギング', '30分ジョギング'] },
      '運動': { minimal: '運動着に着替える', steps: ['運動着に着替える', 'ストレッチ1分', '腕立て5回', '10分運動', '30分運動'] },
      '読書': { minimal: '本を開く', steps: ['本を開く', '1ページ読む', '5分読む', '15分読む', '30分読む'] },
      '瞑想': { minimal: '座って目を閉じる', steps: ['座る', '3回深呼吸', '1分瞑想', '5分瞑想', '10分瞑想'] },
      '勉強': { minimal: '教材を開く', steps: ['教材を開く', '1問解く', '15分勉強', '30分勉強', '1時間勉強'] },
      '筋トレ': { minimal: 'マットを敷く', steps: ['マットを敷く', 'スクワット5回', '10分筋トレ', '20分筋トレ', '30分筋トレ'] },
      '日記': { minimal: 'ノートを開く', steps: ['ノートを開く', '1文書く', '3行書く', '1ページ書く', '詳細に書く'] },
      '片付け': { minimal: '1つ物を拾う', steps: ['1つ物を拾う', '机の上を片付ける', '5分片付け', '15分片付け', '30分片付け'] },
    };

    let matchedBreakdown = null;
    for (const [key, value] of Object.entries(breakdowns)) {
      if (habitName.includes(key) || key.includes(habitName)) {
        matchedBreakdown = { key, ...value };
        break;
      }
    }

    if (!matchedBreakdown) {
      return {
        habitName,
        currentTarget: currentTarget || '不明',
        principle: '2分ルール: 新しい習慣は2分以内でできる形から始める',
        suggestion: {
          minimal: `「${habitName}」の準備をする（道具を出す、場所に行くなど）`,
          steps: ['準備をする', '2分だけやる', '5分やる', '15分やる', currentTarget || '目標達成'],
        },
        tip: '最初は「習慣を始める」ことだけに集中し、量や質は後から増やしていきます。',
      };
    }

    return {
      habitName,
      currentTarget: currentTarget || '不明',
      principle: '2分ルール: 新しい習慣は2分以内でできる形から始める',
      suggestion: { minimal: matchedBreakdown.minimal, steps: matchedBreakdown.steps },
      tip: `まずは「${matchedBreakdown.minimal}」だけを目標にしましょう。それができたら次のステップへ。`,
      scienceNote: '習慣の定着には「始める」ことが最も重要です。一度始めれば、続けることは比較的簡単です。',
    };
  }

  // ============================================================================
  // 新規ツール: モチベーション分析
  // ============================================================================

  /**
   * Analyze motivation patterns
   */
  private async analyzeMotivationPatterns(periodDays: number): Promise<Record<string, unknown>> {
    const habits = await this.habitRepo.getByOwner('user', this.userId, true);
    const now = new Date();
    const periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);

    const allActivities = [];
    for (const habit of habits) {
      const activities = await this.activityRepo.getHabitActivities(habit.id, 'complete', 100);
      const filteredActivities = activities.filter(a => new Date(a.timestamp) >= periodStart);
      allActivities.push(...filteredActivities);
    }

    if (allActivities.length < 10) {
      return {
        message: 'モチベーションパターンを分析するには、もう少しデータが必要です。',
        tip: '2週間ほど習慣を続けると、パターンが見えてきます。',
      };
    }

    const dayOfWeekCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    const hourCounts: Record<number, number> = {};

    for (const activity of allActivities) {
      const date = new Date(activity.timestamp);
      const dayOfWeek = date.getDay();
      if (dayOfWeekCounts[dayOfWeek] !== undefined) {
        dayOfWeekCounts[dayOfWeek]++;
      }
      const hour = date.getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    }

    const dayNames = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];
    const dayAnalysis = Object.entries(dayOfWeekCounts)
      .map(([day, count]) => ({
        day: dayNames[parseInt(day)] || '不明',
        completions: count,
        level: count > allActivities.length / 7 * 1.2 ? 'high' : count < allActivities.length / 7 * 0.8 ? 'low' : 'average',
      }))
      .sort((a, b) => b.completions - a.completions);

    const hourEntries = Object.entries(hourCounts).sort(([, a], [, b]) => b - a);
    const peakHours = hourEntries.slice(0, 3).map(([h]) => `${h}時`);

    const morningCount = Object.entries(hourCounts).filter(([h]) => parseInt(h) >= 5 && parseInt(h) < 12).reduce((sum, [, c]) => sum + c, 0);
    const afternoonCount = Object.entries(hourCounts).filter(([h]) => parseInt(h) >= 12 && parseInt(h) < 18).reduce((sum, [, c]) => sum + c, 0);
    const eveningCount = Object.entries(hourCounts).filter(([h]) => parseInt(h) >= 18 || parseInt(h) < 5).reduce((sum, [, c]) => sum + c, 0);

    let timePreference = '均等';
    if (morningCount > afternoonCount && morningCount > eveningCount) timePreference = '朝型';
    else if (eveningCount > morningCount && eveningCount > afternoonCount) timePreference = '夜型';
    else if (afternoonCount > morningCount && afternoonCount > eveningCount) timePreference = '昼型';

    const topDay = dayAnalysis[0];

    return {
      periodDays,
      totalCompletions: allActivities.length,
      timePreference,
      peakHours,
      dayAnalysis,
      insights: [
        `あなたは${timePreference}のようです。`,
        `最も活動的な時間帯: ${peakHours.join(', ')}`,
        topDay ? `${topDay.day}が最も習慣を実行しやすい曜日です。` : '',
      ].filter(Boolean),
    };
  }

  /**
   * Suggest rewards for habit
   */
  private async suggestRewards(habitName: string, preference?: string): Promise<Record<string, unknown>> {
    const habits = await this.habitRepo.searchByName('user', this.userId, habitName, 1);
    const habit = habits[0];

    const intrinsicRewards = [
      { type: '達成感の可視化', examples: ['カレンダーに✓をつける', '連続記録を更新する', '進捗グラフを見る'], tip: '視覚的なフィードバックは脳の報酬系を活性化します' },
      { type: 'アイデンティティの強化', examples: [`「${habitName}をする人」として自分を認識する`, '習慣を続けている自分を褒める'], tip: '「〜する人」というアイデンティティが習慣を強化します' },
      { type: '即時の満足感', examples: ['深呼吸して達成感を味わう', '小さなガッツポーズ', '「よくやった」と自分に言う'], tip: '習慣の直後に満足感を感じることが重要です' },
    ];

    const extrinsicRewards = [
      { type: '小さなご褒美', examples: ['好きな飲み物を飲む', '5分間好きなことをする', 'お気に入りの音楽を聴く'], tip: '習慣の直後に与えることが効果的です' },
      { type: 'マイルストーン報酬', examples: ['7日連続で達成したら特別なご褒美', '1ヶ月達成で欲しかったものを買う'], tip: '大きな報酬は長期的なモチベーションを維持します' },
      { type: 'ソーシャル報酬', examples: ['達成を友人に報告する', 'SNSでシェアする', '家族に褒めてもらう'], tip: '社会的な承認は強力な報酬になります' },
    ];

    let rewards;
    if (preference === 'intrinsic') rewards = intrinsicRewards;
    else if (preference === 'extrinsic') rewards = extrinsicRewards;
    else rewards = [...intrinsicRewards, ...extrinsicRewards];

    return {
      habitName: habit?.name || habitName,
      rewards,
      principle: '習慣ループの「報酬」は、行動を繰り返したくなる動機を作ります',
      tips: ['報酬は習慣の直後に与える', '最初は外発的報酬も有効、徐々に内発的報酬にシフト'],
      scienceNote: 'ドーパミンは報酬を「予期」する時に最も放出されます。',
    };
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
