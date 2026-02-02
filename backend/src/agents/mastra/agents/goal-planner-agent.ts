/**
 * Goal Planner Agent
 *
 * 目標設定とマイルストーン管理に特化したMastraエージェント
 *
 * 機能:
 * - SMART目標の設定支援
 * - マイルストーンの分解
 * - 達成可能性の評価
 * - 目標の優先順位付け
 *
 * @module agents/mastra/agents/goal-planner-agent
 */

import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * SMART目標作成ツール
 */
const createSmartGoalTool = createTool({
  id: 'create_smart_goal',
  description: 'Help create a SMART (Specific, Measurable, Achievable, Relevant, Time-bound) goal',
  inputSchema: z.object({
    userId: z.string().describe('User ID'),
    rawGoal: z.string().describe('User\'s initial goal description'),
    category: z.enum(['career', 'health', 'learning', 'finance', 'relationship', 'other']),
  }),
  outputSchema: z.object({
    smartGoal: z.object({
      specific: z.string(),
      measurable: z.string(),
      achievable: z.string(),
      relevant: z.string(),
      timeBound: z.string(),
    }),
    refinedGoal: z.string(),
    keyMetrics: z.array(z.string()),
    suggestedDeadline: z.string(),
  }),
  execute: async (inputData) => {
    const { rawGoal, category } = inputData;

    return {
      smartGoal: {
        specific: `${rawGoal}を具体的な行動に落とし込む`,
        measurable: '週次での進捗確認が可能な形式に',
        achievable: '現在のスケジュールと能力を考慮した現実的な目標',
        relevant: `${category}カテゴリでの成長に直結`,
        timeBound: '3ヶ月以内の達成を目指す',
      },
      refinedGoal: `${rawGoal}（3ヶ月以内に達成）`,
      keyMetrics: [
        '週間の取り組み時間',
        '完了したタスク数',
        'マイルストーン達成率',
      ],
      suggestedDeadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    };
  },
});

/**
 * マイルストーン分解ツール
 */
const breakdownMilestonesTool = createTool({
  id: 'breakdown_milestones',
  description: 'Break down a goal into achievable milestones',
  inputSchema: z.object({
    goalId: z.string().describe('Goal ID'),
    goalDescription: z.string(),
    deadline: z.string().describe('Target completion date'),
    complexity: z.enum(['simple', 'moderate', 'complex']).default('moderate'),
  }),
  outputSchema: z.object({
    milestones: z.array(z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      targetDate: z.string(),
      dependencies: z.array(z.string()),
      checkpoints: z.array(z.string()),
    })),
    totalDuration: z.string(),
    criticalPath: z.array(z.string()),
  }),
  execute: async (inputData) => {
    const { goalDescription } = inputData;

    return {
      milestones: [
        {
          id: 'ms-1',
          title: 'Phase 1: 準備と計画',
          description: `${goalDescription}に向けた基盤作り`,
          targetDate: '2週間後',
          dependencies: [],
          checkpoints: ['リソースの確認', '必要なツールの準備', '初期計画の策定'],
        },
        {
          id: 'ms-2',
          title: 'Phase 2: 実行開始',
          description: '本格的な取り組み開始',
          targetDate: '1ヶ月後',
          dependencies: ['ms-1'],
          checkpoints: ['最初の成果物', '週次レビュー開始', 'フィードバック収集'],
        },
        {
          id: 'ms-3',
          title: 'Phase 3: 発展と調整',
          description: '学習内容の深化と軌道修正',
          targetDate: '2ヶ月後',
          dependencies: ['ms-2'],
          checkpoints: ['中間評価', '改善点の特定', '戦略の調整'],
        },
        {
          id: 'ms-4',
          title: 'Phase 4: 完成と定着',
          description: '目標達成と成果の定着',
          targetDate: '3ヶ月後',
          dependencies: ['ms-3'],
          checkpoints: ['最終成果物', '振り返り', '次の目標設定'],
        },
      ],
      totalDuration: '約3ヶ月',
      criticalPath: ['ms-1', 'ms-2', 'ms-3', 'ms-4'],
    };
  },
});

/**
 * 目標優先順位付けツール
 */
const prioritizeGoalsTool = createTool({
  id: 'prioritize_goals',
  description: 'Help prioritize multiple goals based on impact and urgency',
  inputSchema: z.object({
    userId: z.string(),
    goals: z.array(z.object({
      id: z.string(),
      title: z.string(),
      deadline: z.string().optional(),
    })),
  }),
  outputSchema: z.object({
    prioritizedGoals: z.array(z.object({
      goalId: z.string(),
      priority: z.number(),
      reason: z.string(),
      recommendedFocus: z.enum(['primary', 'secondary', 'background']),
    })),
    recommendation: z.string(),
  }),
  execute: async (inputData) => {
    const { goals } = inputData;

    return {
      prioritizedGoals: goals.map((goal, index) => ({
        goalId: goal.id,
        priority: index + 1,
        reason: goal.deadline ? '期限が設定されています' : '長期的な成長に貢献',
        recommendedFocus: index === 0 ? 'primary' as const : index === 1 ? 'secondary' as const : 'background' as const,
      })),
      recommendation: '一度に集中する目標は1-2個に絞ることをお勧めします。残りは「いつかやる」リストに入れておきましょう。',
    };
  },
});

/**
 * Goal Planner Agent
 *
 * 目標設定、マイルストーン管理、優先順位付けを支援
 */
export const goalPlannerAgent = new Agent({
  id: 'goal-planner',
  name: 'Goal Planner',
  instructions: `あなたは目標設定と計画立案の専門家AIプランナーです。

## 役割
- ユーザーの目標をSMART形式に整理する
- 大きな目標を達成可能なマイルストーンに分解する
- 複数の目標の優先順位付けを支援する
- 現実的なタイムラインを提案する

## コミュニケーションスタイル
- 論理的で明確な説明
- 具体的な数値や期限を含める
- 達成可能性を重視した現実的な提案
- ユーザーのモチベーションを考慮

## 重要なポイント
- SMART基準: Specific, Measurable, Achievable, Relevant, Time-bound
- 小さな成功体験の積み重ねが重要
- 柔軟な計画変更を許容する
- 目標は多くても3つまでに集中`,
  model: {
    id: 'openai/gpt-4o',
  },
  tools: {
    createSmartGoalTool,
    breakdownMilestonesTool,
    prioritizeGoalsTool,
  },
});
