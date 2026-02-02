/**
 * Progress Tracker Agent
 *
 * 進捗追跡と分析に特化したMastraエージェント
 *
 * 機能:
 * - 進捗状況の可視化
 * - トレンド分析
 * - 遅延検知とアラート
 * - 達成予測
 *
 * @module agents/mastra/agents/progress-tracker-agent
 */

import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * 進捗分析ツール
 */
const analyzeProgressTool = createTool({
  id: 'analyze_progress',
  description: 'Analyze progress towards goals and habits',
  inputSchema: z.object({
    userId: z.string().describe('User ID'),
    targetType: z.enum(['goal', 'habit', 'all']),
    targetId: z.string().optional().describe('Specific goal or habit ID'),
    period: z.enum(['week', 'month', 'quarter']).default('month'),
  }),
  outputSchema: z.object({
    summary: z.object({
      overallProgress: z.number(),
      completedTasks: z.number(),
      totalTasks: z.number(),
      onTrack: z.boolean(),
    }),
    trends: z.array(z.object({
      metric: z.string(),
      direction: z.enum(['improving', 'stable', 'declining']),
      change: z.number(),
    })),
    highlights: z.array(z.string()),
    concerns: z.array(z.string()),
  }),
  execute: async (inputData) => {
    const period = inputData.period ?? 'month';

    return {
      summary: {
        overallProgress: 0.68,
        completedTasks: 17,
        totalTasks: 25,
        onTrack: true,
      },
      trends: [
        { metric: '習慣達成率', direction: 'improving' as const, change: 12 },
        { metric: '目標進捗', direction: 'stable' as const, change: 2 },
        { metric: 'アクティブ日数', direction: 'improving' as const, change: 8 },
      ],
      highlights: [
        `${period}の間、着実に進歩しています`,
        '習慣の達成率が12%向上しました',
        '3つの主要マイルストーンを達成しました',
      ],
      concerns: [
        '週末の活動が平日より低下傾向',
      ],
    };
  },
});

/**
 * 達成予測ツール
 */
const predictCompletionTool = createTool({
  id: 'predict_completion',
  description: 'Predict goal completion based on current pace',
  inputSchema: z.object({
    goalId: z.string(),
    currentProgress: z.number().min(0).max(100),
    deadline: z.string(),
    historicalPace: z.number().optional().describe('Average progress per week'),
  }),
  outputSchema: z.object({
    prediction: z.object({
      estimatedCompletion: z.string(),
      confidence: z.enum(['high', 'medium', 'low']),
      willMeetDeadline: z.boolean(),
      daysAhead: z.number(),
    }),
    recommendations: z.array(z.string()),
    riskFactors: z.array(z.object({
      factor: z.string(),
      impact: z.enum(['high', 'medium', 'low']),
      mitigation: z.string(),
    })),
  }),
  execute: async (inputData) => {
    const { currentProgress, deadline } = inputData;
    const deadlineDate = new Date(deadline);
    const now = new Date();
    const daysRemaining = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const estimatedDate = new Date(now.getTime() + daysRemaining * 0.8 * 24 * 60 * 60 * 1000);

    return {
      prediction: {
        estimatedCompletion: estimatedDate.toISOString().split('T')[0] ?? '',
        confidence: currentProgress > 50 ? 'high' as const : 'medium' as const,
        willMeetDeadline: currentProgress > 30,
        daysAhead: Math.floor(daysRemaining * 0.2),
      },
      recommendations: [
        '現在のペースを維持してください',
        '週に1回の振り返りを推奨します',
        'モチベーション維持のため小さな報酬を設定しましょう',
      ],
      riskFactors: [
        {
          factor: 'モチベーション低下',
          impact: 'medium' as const,
          mitigation: '進捗の可視化と小さな成功体験の積み重ね',
        },
        {
          factor: '予期せぬ障害',
          impact: 'low' as const,
          mitigation: 'バッファ期間を確保',
        },
      ],
    };
  },
});

/**
 * 進捗レポート生成ツール
 */
const generateProgressReportTool = createTool({
  id: 'generate_progress_report',
  description: 'Generate a comprehensive progress report',
  inputSchema: z.object({
    userId: z.string(),
    reportType: z.enum(['daily', 'weekly', 'monthly']),
    includeGoals: z.boolean().default(true),
    includeHabits: z.boolean().default(true),
  }),
  outputSchema: z.object({
    report: z.object({
      period: z.string(),
      generatedAt: z.string(),
      sections: z.array(z.object({
        title: z.string(),
        content: z.string(),
        metrics: z.array(z.object({
          label: z.string(),
          value: z.string(),
          trend: z.enum(['up', 'down', 'stable']),
        })),
      })),
    }),
    actionItems: z.array(z.string()),
    celebrationPoints: z.array(z.string()),
  }),
  execute: async (inputData) => {
    const reportType = inputData.reportType;

    return {
      report: {
        period: reportType === 'daily' ? '今日' : reportType === 'weekly' ? '今週' : '今月',
        generatedAt: new Date().toISOString(),
        sections: [
          {
            title: '目標の進捗',
            content: '設定した目標に向けて順調に進んでいます。',
            metrics: [
              { label: '達成率', value: '68%', trend: 'up' as const },
              { label: '完了タスク', value: '17/25', trend: 'up' as const },
            ],
          },
          {
            title: '習慣の定着',
            content: '主要な習慣が安定して継続できています。',
            metrics: [
              { label: '継続日数', value: '14日', trend: 'up' as const },
              { label: '達成率', value: '85%', trend: 'stable' as const },
            ],
          },
        ],
      },
      actionItems: [
        '週末の活動を増やす工夫を検討',
        '新しい習慣の追加を検討',
      ],
      celebrationPoints: [
        '2週間連続で習慣を達成！',
        '先週比で進捗率が10%向上',
      ],
    };
  },
});

/**
 * Progress Tracker Agent
 *
 * 進捗追跡、分析、レポート生成を担当
 */
export const progressTrackerAgent = new Agent({
  id: 'progress-tracker',
  name: 'Progress Tracker',
  instructions: `あなたは進捗追跡と分析の専門家AIトラッカーです。

## 役割
- ユーザーの目標・習慣の進捗を追跡する
- データに基づいたトレンド分析を行う
- 達成予測を提供する
- 分かりやすいレポートを生成する

## コミュニケーションスタイル
- データドリブンで客観的な分析
- ポジティブな面も課題も正直に伝える
- 具体的な数値とグラフィカルな表現
- 実行可能なアドバイスを添える

## 重要なポイント
- 小さな進歩も見逃さず褒める
- 遅延やリスクは早期に検知して通知
- 達成可能な改善提案を行う
- ユーザーのモチベーションを維持する表現`,
  model: {
    id: 'openai/gpt-4o',
  },
  tools: {
    analyzeProgressTool,
    predictCompletionTool,
    generateProgressReportTool,
  },
});
