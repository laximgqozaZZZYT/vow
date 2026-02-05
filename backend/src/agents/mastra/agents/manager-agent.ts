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

// Drilldown (Fukabori) tools for clarifying vague queries
import {
  drilldownAnalysisTool,
  genreQuickRepliesTool,
  purposeQuickRepliesTool,
  responseTypeQuickRepliesTool,
} from '../drilldown/index.js';

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

    // キーワード分析でどのエージェントが必要かを判定
    const habitKeywords = ['習慣', 'habit', '毎日', 'daily', 'ルーティン', 'routine', 'vow', 'VOW', 'Vow', '朝', '夜', 'morning', 'evening', 'coach', 'コーチ', 'アドバイス', 'advice'];
    const goalKeywords = ['目標', 'goal', '達成', 'achieve', 'マイルストーン', 'milestone', 'ゴール', '計画', 'plan', '設定したい', 'を決める', 'planner', '立てたい', '作りたい', '決めたい', 'ターゲット', 'target', 'objective'];
    const progressKeywords = ['進捗', 'progress', 'レポート', 'report', '分析', 'analyze', '統計', 'statistics', '達成率'];

    const hasHabitKeyword = habitKeywords.some(k => lowerQuery.includes(k));
    const hasGoalKeyword = goalKeywords.some(k => lowerQuery.includes(k));
    const hasProgressKeyword = progressKeywords.some(k => lowerQuery.includes(k));

    const relevantAgents: Array<'habit-coach' | 'goal-planner' | 'progress-tracker'> = [];
    if (hasHabitKeyword) relevantAgents.push('habit-coach');
    if (hasGoalKeyword) relevantAgents.push('goal-planner');
    if (hasProgressKeyword) relevantAgents.push('progress-tracker');

    // キーワードが見つからない場合は、両方のエージェントを使用して、適切な方に任せる
    // ユーザーの意図が不明確な場合、habit-coachとgoal-plannerの両方に問い合わせることで、より適切な対応が可能
    if (relevantAgents.length === 0) {
      relevantAgents.push('habit-coach', 'goal-planner');
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

## 掘り下げモード（フカボリ）
ユーザーの質問が曖昧な場合（ジャンル、目的、回答の型が不明確）は、掘り下げモードに入り、段階的に情報を収集します。

### 曖昧な質問の例
- 「何か新しいことを始めたい」
- 「もっと良い生活を送りたい」
- 「自分を変えたい」
- 「習慣を作りたい」（具体性なし）
- 「おすすめを教えて」

### 掘り下げフロー
1. drilldown_analysis ツールを使って曖昧さを判定
2. 曖昧な場合は genre_quick_replies でジャンルを確認（候補ボタンで提示）
3. ジャンル選択後は purpose_quick_replies で目的を確認（候補ボタンで提示）
4. 目的選択後は response_type_quick_replies で回答の型を確認（候補ボタンで提示）
5. すべて確定後、適切なエージェント（Habit Coach / Goal Planner）に引き継ぎ

### 重要：候補ボタンの必須使用
- **すべての掘り下げステップで候補ボタン（quickReplies）を必ず表示**
- テキストのみの応答は避ける
- 「その他」オプションも用意してカスタム入力を許可

## 処理フロー
1. ユーザーからの質問やリクエストを分析
2. 曖昧な場合は掘り下げモードを開始
3. 明確な場合は適切なエージェント（複数可）を選択
4. 各エージェントからの応答を集約
5. 統合された、一貫性のある回答を提供

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
    // Drilldown (Fukabori) tools
    drilldownAnalysisTool,
    genreQuickRepliesTool,
    purposeQuickRepliesTool,
    responseTypeQuickRepliesTool,
  },
});

/**
 * マネージャーのみでの応答を取得
 * シンプルな質問や挨拶には、マネージャーが直接回答
 */
export async function getManagerOnlyResponse(
  query: string,
  userId: string,
  options?: {
    locale?: 'ja' | 'en';
    openaiApiKey?: string;
  }
): Promise<{
  query: string;
  content: string;
  needsSpecialists: boolean;
  suggestedAgents: string[];
  timestamp: Date;
  durationMs: number;
}> {
  const startTime = Date.now();

  // If user has their own API key, temporarily set it
  const originalApiKey = process.env['OPENAI_API_KEY'];
  if (options?.openaiApiKey) {
    process.env['OPENAI_API_KEY'] = options.openaiApiKey;
  }

  try {
    const result = await managerAgent.generate([
      { role: 'user', content: `ユーザーID: ${userId}\n\n${query}` }
    ]);

    const content = typeof result.text === 'string' ? result.text : JSON.stringify(result.text);

    // Check if the manager's response indicates specialist needs
    const lowerContent = content.toLowerCase();
    const lowerQuery = query.toLowerCase();

    const needsHabitCoach =
      lowerQuery.includes('習慣') || lowerQuery.includes('habit') ||
      lowerContent.includes('habit-coach') || lowerContent.includes('習慣コーチ');
    const needsGoalPlanner =
      lowerQuery.includes('目標') || lowerQuery.includes('goal') ||
      lowerContent.includes('goal-planner') || lowerContent.includes('目標プランナー');
    const needsProgressTracker =
      lowerQuery.includes('進捗') || lowerQuery.includes('progress') ||
      lowerContent.includes('progress-tracker') || lowerContent.includes('進捗トラッカー');

    const suggestedAgents: string[] = [];
    if (needsHabitCoach) suggestedAgents.push('habit-coach');
    if (needsGoalPlanner) suggestedAgents.push('goal-planner');
    if (needsProgressTracker) suggestedAgents.push('progress-tracker');

    return {
      query,
      content,
      needsSpecialists: suggestedAgents.length > 0,
      suggestedAgents,
      timestamp: new Date(),
      durationMs: Date.now() - startTime,
    };
  } finally {
    if (options?.openaiApiKey && originalApiKey !== undefined) {
      process.env['OPENAI_API_KEY'] = originalApiKey;
    } else if (options?.openaiApiKey) {
      delete process.env['OPENAI_API_KEY'];
    }
  }
}

/**
 * テキストから候補を抽出
 * エージェントがツールを使わなかった場合のフォールバック
 */
function extractSuggestionsFromText(content: string, agentId: string): Array<{
  toolName: string;
  toolCallId: string;
  args: unknown;
  result: unknown;
}> {
  const suggestions: Array<{
    toolName: string;
    toolCallId: string;
    args: unknown;
    result: unknown;
  }> = [];

  // 箇条書きパターンを検出（・、-、1.、①など）
  const bulletPatterns = [
    /^[・•]\s*(.+)$/gm,
    /^[-]\s+(.+)$/gm,
    /^(\d+)[.)]\s*(.+)$/gm,
    /^[①②③④⑤]\s*(.+)$/gm,
    /^「(.+)」/gm,
  ];

  const extractedItems: string[] = [];

  for (const pattern of bulletPatterns) {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      const item = match[2] || match[1];
      if (item && item.length > 2 && item.length < 100) {
        extractedItems.push(item.trim());
      }
    }
  }

  // 抽出したアイテムが3つ以上あれば候補として扱う
  if (extractedItems.length >= 2) {
    const isGoalRelated = agentId === 'goal-planner';
    const toolName = isGoalRelated ? 'suggest_goals' : 'suggest_habits';

    suggestions.push({
      toolName,
      toolCallId: `extracted-${Date.now()}`,
      args: { extracted: true },
      result: {
        suggestions: extractedItems.slice(0, 5).map((item) => ({
          name: item,
          description: '',
          frequency: isGoalRelated ? undefined : '毎日',
          estimatedTime: isGoalRelated ? undefined : '5分',
        })),
      },
    });
  }

  return suggestions;
}

/**
 * 会話履歴の保存用インターフェース
 */
interface ConversationContext {
  sessionId?: string;
  previousIntent?: 'habit_related' | 'goal_related' | 'progress_related' | 'general' | 'mixed';
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

/**
 * マルチエージェント応答を取得するヘルパー関数
 *
 * @param query - ユーザーからの質問
 * @param userId - ユーザーID
 * @param options - オプション設定
 * @param options.includeAgents - 使用するエージェントのリスト
 * @param options.locale - レスポンスの言語
 * @param options.openaiApiKey - OpenAI APIキー（ユーザー固有）
 * @param options.managerOnly - マネージャーのみで対応（デフォルト: false）
 * @param options.conversationContext - 会話コンテキスト（セッションID、前回の意図など）
 * @param options.existingGoalNames - ISS-20260204-019: 既存Goal名リスト（重複提案防止用）
 * @param options.existingHabitNames - 既存Habit名リスト（重複提案防止用）
 */
export async function getMultiAgentResponse(
  query: string,
  userId: string,
  options?: {
    includeAgents?: ('habit-coach' | 'goal-planner' | 'progress-tracker')[];
    locale?: 'ja' | 'en';
    openaiApiKey?: string;
    openaiModel?: string;
    managerOnly?: boolean;
    conversationContext?: ConversationContext;
    existingGoalNames?: string[];
    existingHabitNames?: string[];
  }
): Promise<{
  query: string;
  responses: Array<{
    agentId: string;
    agentName: string;
    content: string;
    toolCalls: Array<{
      toolName: string;
      toolCallId: string;
      args: unknown;
      result: unknown;
    }>;
    toolResults: Array<{
      toolCallId: string;
      toolName: string;
      result: unknown;
    }>;
    timestamp: Date;
    durationMs: number;
  }>;
  summary: string;
  timestamp: Date;
  totalDurationMs: number;
}> {
  const startTime = Date.now();

  // マネージャーのみモード: 複雑なタスクでなければマネージャーだけで対応
  if (options?.managerOnly) {
    const managerResponse = await getManagerOnlyResponse(query, userId, {
      ...(options.locale && { locale: options.locale }),
      ...(options.openaiApiKey && { openaiApiKey: options.openaiApiKey }),
    });

    // マネージャーのテキストから候補を抽出
    const extractedToolCalls = extractSuggestionsFromText(managerResponse.content, 'manager');

    return {
      query,
      responses: [{
        agentId: 'manager',
        agentName: 'VOW Manager',
        content: managerResponse.content,
        toolCalls: extractedToolCalls,
        toolResults: [],
        timestamp: managerResponse.timestamp,
        durationMs: managerResponse.durationMs,
      }],
      summary: managerResponse.content,
      timestamp: managerResponse.timestamp,
      totalDurationMs: managerResponse.durationMs,
    };
  }

  // エージェントが明示的に指定されていない場合は、クエリ分析で適切なエージェントを選択
  let agentsToQuery: ('habit-coach' | 'goal-planner' | 'progress-tracker')[];

  if (options?.includeAgents && options.includeAgents.length > 0) {
    agentsToQuery = options.includeAgents;
  } else {
    // 会話コンテキストから前回の意図を確認
    const previousIntent = options?.conversationContext?.previousIntent;
    const conversationHistory = options?.conversationContext?.conversationHistory || [];

    // 会話履歴全体から意図を判定
    let contextualQuery = query;
    if (conversationHistory.length > 0) {
      // 最初のユーザーメッセージを重視（会話の主題）
      const firstUserMessage = conversationHistory.find(m => m.role === 'user')?.content || '';
      contextualQuery = firstUserMessage + ' ' + query;
    }

    // クエリを分析して必要なエージェントを決定（全エージェントは呼び出さない）
    const lowerQuery = contextualQuery.toLowerCase();
    const habitKeywords = ['習慣', 'habit', '毎日', 'daily', 'ルーティン', 'routine', 'vow', 'コーチ', 'アドバイス'];
    const goalKeywords = ['目標', 'goal', '達成', 'achieve', 'マイルストーン', 'milestone', 'ゴール', '計画', '設定したい', 'を決める', '立てたい', '作りたい', '決めたい', 'ターゲット', 'target', 'objective'];
    const progressKeywords = ['進捗', 'progress', 'レポート', 'report', '分析', 'analyze', '統計', '達成率'];

    const hasHabitKeyword = habitKeywords.some(k => lowerQuery.includes(k));
    const hasGoalKeyword = goalKeywords.some(k => lowerQuery.includes(k));
    const hasProgressKeyword = progressKeywords.some(k => lowerQuery.includes(k));

    const relevantAgents: ('habit-coach' | 'goal-planner' | 'progress-tracker')[] = [];

    // 前回の意図を優先（継続的な会話の場合）
    if (previousIntent === 'goal_related' && !hasHabitKeyword) {
      relevantAgents.push('goal-planner');
    } else if (previousIntent === 'habit_related' && !hasGoalKeyword) {
      relevantAgents.push('habit-coach');
    } else {
      // 新しいキーワードベースの判定
      if (hasHabitKeyword) relevantAgents.push('habit-coach');
      if (hasGoalKeyword) relevantAgents.push('goal-planner');
      if (hasProgressKeyword) relevantAgents.push('progress-tracker');
    }

    // キーワードが見つからない場合は、前回の意図を継続、またはデフォルトで両方
    if (relevantAgents.length === 0) {
      if (previousIntent === 'goal_related') {
        agentsToQuery = ['goal-planner'];
      } else if (previousIntent === 'habit_related') {
        agentsToQuery = ['habit-coach'];
      } else {
        // デフォルト: 両方のエージェントを使用
        agentsToQuery = ['habit-coach', 'goal-planner'];
      }
    } else {
      agentsToQuery = relevantAgents;
    }
  }

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
    toolCalls: Array<{
      toolName: string;
      toolCallId: string;
      args: unknown;
      result: unknown;
    }>;
    toolResults: Array<{
      toolCallId: string;
      toolName: string;
      result: unknown;
    }>;
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
        toolCalls: [],
        toolResults: [],
        timestamp: new Date(),
        durationMs: 0,
      };
    }
    const agentStart = Date.now();

    try {
      // ISS-20260204-019: Build context with existing goals/habits to prevent duplicate suggestions
      let contextInfo = `ユーザーID: ${userId}`;
      if (options?.existingGoalNames && options.existingGoalNames.length > 0) {
        contextInfo += `\n既存の目標: ${options.existingGoalNames.join('、')}`;
      }
      if (options?.existingHabitNames && options.existingHabitNames.length > 0) {
        contextInfo += `\n既存の習慣: ${options.existingHabitNames.join('、')}`;
      }
      if (options?.existingGoalNames?.length || options?.existingHabitNames?.length) {
        contextInfo += `\n\n【重要】既存の目標/習慣と重複しない新しい提案をしてください。`;
      }

      const result = await agent.generate([
        { role: 'user', content: `${contextInfo}\n\n${query}` }
      ]);

      // Extract tool calls and results from Mastra response
      // Mastra returns these as promises, so we need to await them
      const toolCallsRaw = await result.toolCalls;
      const toolResultsRaw = await result.toolResults;

      // Map tool calls to our format (handle various Mastra response formats)
      const toolCalls: Array<{
        toolName: string;
        toolCallId: string;
        args: unknown;
        result: unknown;
      }> = [];

      if (toolCallsRaw && Array.isArray(toolCallsRaw)) {
        for (const tc of toolCallsRaw) {
          // Mastra ToolCallChunk may have different property names
          const tcAny = tc as unknown as Record<string, unknown>;
          toolCalls.push({
            toolName: (tcAny['toolName'] || tcAny['name'] || tcAny['type'] || 'unknown') as string,
            toolCallId: (tcAny['toolCallId'] || '') as string,
            args: tcAny['args'] || tcAny['input'],
            result: undefined,
          });
        }
      }

      // Map tool results to our format
      const toolResults: Array<{
        toolCallId: string;
        toolName: string;
        result: unknown;
      }> = [];

      if (toolResultsRaw && Array.isArray(toolResultsRaw)) {
        for (const tr of toolResultsRaw) {
          const trAny = tr as unknown as Record<string, unknown>;
          toolResults.push({
            toolCallId: (trAny['toolCallId'] || trAny['id'] || '') as string,
            toolName: (trAny['toolName'] || trAny['name'] || '') as string,
            result: trAny['result'] || trAny['output'],
          });
        }
      }

      // Merge tool calls with their results for easier frontend parsing
      const mergedToolCalls = toolCalls.map(tc => {
        const matchingResult = toolResults.find(tr => tr.toolCallId === tc.toolCallId);
        return {
          toolName: tc.toolName,
          toolCallId: tc.toolCallId,
          args: tc.args,
          result: matchingResult?.result ?? tc.result,
        };
      });

      const textContent = typeof result.text === 'string' ? result.text : JSON.stringify(result.text);

      // フォールバック: ツールが呼び出されなかった場合、テキストから候補を抽出
      let finalToolCalls = mergedToolCalls;
      if (mergedToolCalls.length === 0) {
        const extractedCalls = extractSuggestionsFromText(textContent, agentId);
        if (extractedCalls.length > 0) {
          finalToolCalls = extractedCalls;
        }
      }

      return {
        agentId,
        agentName: agent.name,
        content: textContent,
        toolCalls: finalToolCalls,
        toolResults: toolResults.length > 0 ? toolResults : [],
        timestamp: new Date(),
        durationMs: Date.now() - agentStart,
      };
    } catch (error) {
      return {
        agentId,
        agentName: agent.name,
        content: `エラーが発生しました: ${error instanceof Error ? error.message : 'Unknown error'}`,
        toolCalls: [],
        toolResults: [],
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
