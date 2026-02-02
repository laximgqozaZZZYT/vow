/**
 * Habit Coach Agent
 *
 * 習慣分析と提案に特化したMastraエージェント
 *
 * 機能:
 * - 習慣パターンの分析
 * - 新しい習慣の提案
 * - 習慣スタッキングのアドバイス
 * - スモールステップの生成
 *
 * @module agents/mastra/agents/habit-coach-agent
 */

import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * 習慣分析ツール
 */
const analyzeHabitsTool = createTool({
  id: 'analyze_habits',
  description: 'Analyze user habit patterns and provide insights',
  inputSchema: z.object({
    userId: z.string().describe('User ID'),
    period: z.enum(['week', 'month', 'quarter']).default('month'),
    habitIds: z.array(z.string()).optional().describe('Specific habits to analyze'),
  }),
  outputSchema: z.object({
    completionRate: z.number(),
    streakInfo: z.object({
      current: z.number(),
      longest: z.number(),
    }),
    patterns: z.array(z.object({
      type: z.string(),
      description: z.string(),
      impact: z.enum(['positive', 'neutral', 'negative']),
    })),
    insights: z.array(z.string()),
  }),
  execute: async (inputData) => {
    // ツール実行ロジック（実際のデータ分析は共有ツールから呼び出す）
    const period = inputData.period ?? 'month';

    // プレースホルダーレスポンス（実際の実装では共有ツールを使用）
    return {
      completionRate: 0.75,
      streakInfo: { current: 5, longest: 14 },
      patterns: [
        {
          type: 'morning_routine',
          description: '朝の習慣が最も安定しています',
          impact: 'positive' as const,
        },
      ],
      insights: [
        `${period}の期間で習慣の達成率は75%です`,
        '朝の時間帯が最も効果的です',
      ],
    };
  },
});

/**
 * 習慣提案ツール
 */
const suggestHabitsTool = createTool({
  id: 'suggest_habits',
  description: 'Suggest new habits based on user goals and patterns',
  inputSchema: z.object({
    userId: z.string(),
    category: z.enum(['health', 'productivity', 'learning', 'wellness', 'other']).optional(),
    count: z.number().min(1).max(5).default(3),
  }),
  outputSchema: z.object({
    suggestions: z.array(z.object({
      name: z.string(),
      description: z.string(),
      frequency: z.string(),
      estimatedTime: z.string(),
      stackingTip: z.string().optional(),
    })),
  }),
  execute: async (inputData) => {
    const count = inputData.count ?? 3;

    return {
      suggestions: [
        {
          name: '朝の瞑想',
          description: '5分間の呼吸瞑想で一日をスタート',
          frequency: '毎日',
          estimatedTime: '5分',
          stackingTip: '歯磨きの後に行うと定着しやすいです',
        },
        {
          name: '読書タイム',
          description: '就寝前に15分の読書',
          frequency: '毎日',
          estimatedTime: '15分',
          stackingTip: 'スマホを充電器に置いた後に始めましょう',
        },
      ].slice(0, count),
    };
  },
});

/**
 * スモールステップ生成ツール
 */
const generateBabyStepsTool = createTool({
  id: 'generate_baby_steps',
  description: 'Generate small actionable steps for starting a habit',
  inputSchema: z.object({
    habitName: z.string(),
    currentLevel: z.enum(['beginner', 'intermediate', 'advanced']).default('beginner'),
  }),
  outputSchema: z.object({
    steps: z.array(z.object({
      level: z.number(),
      action: z.string(),
      duration: z.string(),
      tips: z.array(z.string()),
    })),
  }),
  execute: async (inputData) => {
    const habitName = inputData.habitName;

    return {
      steps: [
        {
          level: 10,
          action: `${habitName}を1分だけ試す`,
          duration: '1分',
          tips: ['完璧を目指さない', '「やった」という事実を大切に'],
        },
        {
          level: 25,
          action: `${habitName}を3分間続ける`,
          duration: '3分',
          tips: ['時間を決めてタイマーをセット', '環境を整える'],
        },
        {
          level: 50,
          action: `${habitName}を5分間継続`,
          duration: '5分',
          tips: ['既存の習慣にスタッキング', '成功を記録する'],
        },
      ],
    };
  },
});

/**
 * Habit Coach Agent
 *
 * 習慣に関する分析、提案、アドバイスを提供
 */
export const habitCoachAgent = new Agent({
  id: 'habit-coach',
  name: 'Habit Coach',
  instructions: `あなたは習慣形成の専門家AIコーチです。

## 役割
- ユーザーの習慣パターンを分析する
- 新しい習慣を提案する
- 習慣スタッキングのアドバイスを提供する
- 小さなステップから始める方法を教える

## コミュニケーションスタイル
- 励ましと支援的なトーン
- 具体的で実践的なアドバイス
- 科学的根拠に基づいた提案
- ユーザーの状況に合わせた柔軟な対応

## 重要なポイント
- 「アトミックハビット」の原則を活用
- 2分ルール: 新しい習慣は2分以内で始められるものに
- 習慣スタッキング: 既存の習慣に新しい習慣を連結
- 環境デザイン: 良い習慣を簡単に、悪い習慣を難しく`,
  model: {
    id: 'openai/gpt-4o',
  },
  tools: {
    analyzeHabitsTool,
    suggestHabitsTool,
    generateBabyStepsTool,
  },
});
