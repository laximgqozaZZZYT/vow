/**
 * Manager Agent
 *
 * 他のエージェントを統括するMastraマネージャーエージェント
 *
 * 機能:
 * - ユーザークエリの分析と適切なエージェントへの振り分け
 * - 複数エージェントからの応答の集約
 * - 統合レスポンスの生成
 *
 * @module agents/mastra/agents/manager-agent
 */

import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { habitCoachAgent } from './habit-coach-agent.js';
import { goalPlannerAgent } from './goal-planner-agent.js';
import { progressTrackerAgent } from './progress-tracker-agent.js';

/**
 * クエリ分析ツール
 * ユーザーの質問を分析し、どのエージェントに振り分けるかを決定
 */
const analyzeQueryTool = createTool({
  id: 'analyze_query',
  description: 'Analyze user query and determine which agents should handle it',
  inputSchema: z.object({
    query: z.string().describe('User query to analyze'),
    userId: z.string().optional(),
    hasActiveGoals: z.boolean().optional(),
    hasActiveHabits: z.boolean().optional(),
  }),
  outputSchema: z.object({
    intent: z.enum(['habit_related', 'goal_related', 'progress_related', 'general', 'mixed']),
    relevantAgents: z.array(z.enum(['habit-coach', 'goal-planner', 'progress-tracker'])),
    priority: z.enum(['high', 'medium', 'low']),
    reasoning: z.string(),
  }),
  execute: async (inputData) => {
    const query = inputData.query;
    const lowerQuery = query.toLowerCase();

    // 簡易的なキーワード分析（実際の実装ではLLMで分析）
    const habitKeywords = ['習慣', 'habit', '毎日', 'daily', 'ルーティン', 'routine'];
    const goalKeywords = ['目標', 'goal', '達成', 'achieve', 'マイルストーン', 'milestone'];
    const progressKeywords = ['進捗', 'progress', 'レポート', 'report', '分析', 'analyze'];

    const hasHabitKeyword = habitKeywords.some(k => lowerQuery.includes(k));
    const hasGoalKeyword = goalKeywords.some(k => lowerQuery.includes(k));
    const hasProgressKeyword = progressKeywords.some(k => lowerQuery.includes(k));

    const relevantAgents: Array<'habit-coach' | 'goal-planner' | 'progress-tracker'> = [];
    if (hasHabitKeyword) relevantAgents.push('habit-coach');
    if (hasGoalKeyword) relevantAgents.push('goal-planner');
    if (hasProgressKeyword) relevantAgents.push('progress-tracker');

    // デフォルトで全エージェントを含める
    if (relevantAgents.length === 0) {
      relevantAgents.push('habit-coach', 'goal-planner', 'progress-tracker');
    }

    const intent = relevantAgents.length > 1 ? 'mixed' as const :
      hasHabitKeyword ? 'habit_related' as const :
      hasGoalKeyword ? 'goal_related' as const :
      hasProgressKeyword ? 'progress_related' as const : 'general' as const;

    return {
      intent,
      relevantAgents,
      priority: 'medium' as const,
      reasoning: `クエリ "${query}" は ${relevantAgents.join(', ')} エージェントが対応します`,
    };
  },
});

/**
 * レスポンス集約ツール
 * 複数エージェントからの応答を統合して要約
 */
const aggregateResponsesTool = createTool({
  id: 'aggregate_responses',
  description: 'Aggregate and summarize responses from multiple agents',
  inputSchema: z.object({
    originalQuery: z.string(),
    responses: z.array(z.object({
      agentId: z.string(),
      agentName: z.string(),
      content: z.string(),
      timestamp: z.string(),
    })),
  }),
  outputSchema: z.object({
    summary: z.string(),
    keyPoints: z.array(z.object({
      source: z.string(),
      point: z.string(),
    })),
    actionItems: z.array(z.string()),
    confidence: z.enum(['high', 'medium', 'low']),
  }),
  execute: async (inputData) => {
    const { originalQuery, responses } = inputData;

    const keyPoints = responses.map((r: { agentName: string; content: string }) => ({
      source: r.agentName,
      point: r.content.substring(0, 100) + (r.content.length > 100 ? '...' : ''),
    }));

    return {
      summary: `「${originalQuery}」について ${responses.length} つのエージェントから回答を集約しました。`,
      keyPoints,
      actionItems: [
        '具体的なアクションを開始してください',
        '定期的な振り返りを行いましょう',
      ],
      confidence: responses.length >= 2 ? 'high' as const : 'medium' as const,
    };
  },
});

/**
 * タスク委譲ツール
 * 特定のエージェントにタスクを委譲
 */
const delegateTaskTool = createTool({
  id: 'delegate_task',
  description: 'Delegate a specific task to a sub-agent',
  inputSchema: z.object({
    targetAgent: z.enum(['habit-coach', 'goal-planner', 'progress-tracker']),
    task: z.string(),
    priority: z.enum(['high', 'medium', 'low']).default('medium'),
    context: z.record(z.unknown()).optional(),
  }),
  outputSchema: z.object({
    delegated: z.boolean(),
    taskId: z.string(),
    message: z.string(),
  }),
  execute: async (inputData) => {
    const { targetAgent, task } = inputData;

    return {
      delegated: true,
      taskId: `task-${Date.now()}`,
      message: `タスク "${task}" を ${targetAgent} に委譲しました`,
    };
  },
});

/**
 * Manager Agent
 *
 * マルチエージェントシステムの中核として、他のエージェントを統括
 * Mastraの`agents`パラメータを使用してサブエージェントにアクセス
 */
export const managerAgent = new Agent({
  id: 'manager',
  name: 'VOW Manager',
  instructions: `あなたはVOW習慣・目標トラッカーのマネージャーAIです。

## 役割
あなたは複数の専門エージェントを統括するマネージャーです：
- **Habit Coach**: 習慣形成と維持のエキスパート
- **Goal Planner**: 目標設定とマイルストーン管理のエキスパート
- **Progress Tracker**: 進捗追跡と分析のエキスパート

## 処理フロー
1. ユーザーからの質問やリクエストを分析
2. 適切なエージェント（複数可）を選択
3. 各エージェントからの応答を集約
4. 統合された、一貫性のある回答を提供

## コミュニケーションスタイル
- 明確で簡潔な日本語
- 各エージェントの専門性を活かした回答
- ユーザーにとって実行可能なアドバイス
- 必要に応じて詳細情報を提供

## 重要なポイント
- 常にユーザーの目標達成を最優先
- 複数の視点からのアドバイスを統合
- 矛盾がある場合は適切に調整
- ユーザーの状況に合わせた柔軟な対応

## 使用可能なサブエージェント
- habit-coach: 習慣に関する質問に使用
- goal-planner: 目標に関する質問に使用
- progress-tracker: 進捗に関する質問に使用

複数のエージェントが関連する質問には、それぞれに問い合わせて回答を統合してください。`,
  model: {
    id: 'openai/gpt-4o',
  },
  tools: {
    analyzeQueryTool,
    aggregateResponsesTool,
    delegateTaskTool,
  },
});

/**
 * マルチエージェント応答を取得するヘルパー関数
 *
 * @param query - ユーザーからの質問
 * @param userId - ユーザーID
 * @param options - オプション設定
 * @param options.includeAgents - 使用するエージェントのリスト
 * @param options.locale - レスポンスの言語
 * @param options.openaiApiKey - OpenAI APIキー（ユーザー固有）
 */
export async function getMultiAgentResponse(
  query: string,
  userId: string,
  options?: {
    includeAgents?: ('habit-coach' | 'goal-planner' | 'progress-tracker')[];
    locale?: 'ja' | 'en';
    openaiApiKey?: string;
    openaiModel?: string;
  }
): Promise<{
  query: string;
  responses: Array<{
    agentId: string;
    agentName: string;
    content: string;
    timestamp: Date;
    durationMs: number;
  }>;
  summary: string;
  timestamp: Date;
  totalDurationMs: number;
}> {
  const startTime = Date.now();
  const agentsToQuery = options?.includeAgents ?? ['habit-coach', 'goal-planner', 'progress-tracker'];

  // If user has their own API key, temporarily set it for this request
  const originalApiKey = process.env['OPENAI_API_KEY'];
  if (options?.openaiApiKey) {
    process.env['OPENAI_API_KEY'] = options.openaiApiKey;
  }

  try {
  const agentMap = {
    'habit-coach': habitCoachAgent,
    'goal-planner': goalPlannerAgent,
    'progress-tracker': progressTrackerAgent,
  } as const;

  const responses: Array<{
    agentId: string;
    agentName: string;
    content: string;
    timestamp: Date;
    durationMs: number;
  }> = [];

  // 並列でエージェントにクエリを送信
  const promises = agentsToQuery.map(async (agentId) => {
    const agent = agentMap[agentId];
    if (!agent) {
      return {
        agentId,
        agentName: agentId,
        content: `エージェント ${agentId} が見つかりません`,
        timestamp: new Date(),
        durationMs: 0,
      };
    }
    const agentStart = Date.now();

    try {
      const result = await agent.generate([
        { role: 'user', content: `ユーザーID: ${userId}\n\n${query}` }
      ]);

      return {
        agentId,
        agentName: agent.name,
        content: typeof result.text === 'string' ? result.text : JSON.stringify(result.text),
        timestamp: new Date(),
        durationMs: Date.now() - agentStart,
      };
    } catch (error) {
      return {
        agentId,
        agentName: agent.name,
        content: `エラーが発生しました: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
        durationMs: Date.now() - agentStart,
      };
    }
  });

  const results = await Promise.all(promises);
  responses.push(...results);

  // Manager Agentで応答を統合
  const summaryResult = await managerAgent.generate([
    {
      role: 'user',
      content: `以下のエージェント応答を統合して要約してください：

元の質問: ${query}

各エージェントの回答:
${responses.map(r => `\n### ${r.agentName}\n${r.content}`).join('\n')}

統合された回答を日本語で提供してください。`,
    }
  ]);

  return {
    query,
    responses,
    summary: typeof summaryResult.text === 'string' ? summaryResult.text : JSON.stringify(summaryResult.text),
    timestamp: new Date(),
    totalDurationMs: Date.now() - startTime,
  };
  } finally {
    // Restore original API key
    if (options?.openaiApiKey && originalApiKey !== undefined) {
      process.env['OPENAI_API_KEY'] = originalApiKey;
    } else if (options?.openaiApiKey) {
      delete process.env['OPENAI_API_KEY'];
    }
  }
}
