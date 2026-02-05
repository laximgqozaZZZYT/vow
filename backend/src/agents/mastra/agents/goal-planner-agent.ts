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
 * 目標提案ツール
 * ISS-20260204-019: 既存Goal参照機能を追加
 */
const suggestGoalsTool = createTool({
  id: 'suggest_goals',
  description: 'Suggest new goals based on user context and patterns. Filters out goals that match existing goal names.',
  inputSchema: z.object({
    userId: z.string(),
    category: z.enum(['career', 'health', 'learning', 'finance', 'relationship', 'other']).optional(),
    count: z.number().min(1).max(5).default(3),
    existingGoalNames: z.array(z.string()).optional().describe('List of existing goal names to exclude from suggestions'),
  }),
  outputSchema: z.object({
    suggestions: z.array(z.object({
      name: z.string(),
      description: z.string(),
      category: z.string(),
      difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
      suggestedHabits: z.array(z.string()),
      rationale: z.string(),
    })),
    existingGoalsConsidered: z.number().describe('Number of existing goals that were considered'),
  }),
  execute: async (inputData) => {
    const count = inputData.count ?? 3;
    const category = inputData.category ?? 'health';
    const existingGoalNames = inputData.existingGoalNames ?? [];

    // Normalize existing goal names for comparison
    const normalizedExisting = existingGoalNames.map(name => name.toLowerCase().trim());

    const allSuggestions = [
      {
        name: '毎日30分の運動習慣',
        description: '体力向上と健康維持のための運動習慣を確立する',
        category: 'health',
        difficulty: 'beginner' as const,
        suggestedHabits: ['朝のストレッチ', '昼休みの散歩', '週3回のジョギング'],
        rationale: '小さな運動習慣から始めて、徐々に強度を上げていく方法が効果的です',
      },
      {
        name: '月4冊の読書',
        description: '継続的な学習習慣を通じて知識を拡大する',
        category: 'learning',
        difficulty: 'intermediate' as const,
        suggestedHabits: ['毎日15分の読書', '週末の読書タイム', '読書ノートの作成'],
        rationale: '週1冊のペースで無理なく続けられる目標です',
      },
      {
        name: '緊急資金の構築',
        description: '3ヶ月分の生活費を緊急資金として貯蓄する',
        category: 'finance',
        difficulty: 'intermediate' as const,
        suggestedHabits: ['毎日の支出記録', '週次の予算確認', '自動貯金の設定'],
        rationale: '経済的な安心感が他の目標への集中力を高めます',
      },
      // Additional suggestions for variety when existing goals are filtered out
      {
        name: '週3回の筋トレ習慣',
        description: '筋力強化と代謝向上のための定期的なトレーニング',
        category: 'health',
        difficulty: 'intermediate' as const,
        suggestedHabits: ['プッシュアップ', 'スクワット', 'プランク'],
        rationale: '筋トレは体力だけでなくメンタルの安定にも効果的です',
      },
      {
        name: '毎日の瞑想習慣',
        description: '心の安定とストレス軽減のための瞑想実践',
        category: 'health',
        difficulty: 'beginner' as const,
        suggestedHabits: ['朝5分の瞑想', '深呼吸練習', 'マインドフルネス'],
        rationale: '短時間の瞑想でも継続することで大きな効果があります',
      },
      {
        name: '副業収入の確立',
        description: '本業以外からの収入源を構築する',
        category: 'finance',
        difficulty: 'advanced' as const,
        suggestedHabits: ['スキルの棚卸し', '市場調査', '週末の時間確保'],
        rationale: '複数の収入源は経済的な安心感を高めます',
      },
      {
        name: '新しいスキルの習得',
        description: 'キャリアに活かせる新しい技術を3ヶ月で習得する',
        category: 'learning',
        difficulty: 'intermediate' as const,
        suggestedHabits: ['オンライン学習', '実践プロジェクト', '学習記録'],
        rationale: '継続的なスキルアップはキャリアの可能性を広げます',
      },
    ];

    // Filter by category first
    let filteredByCategory = allSuggestions.filter(s =>
      !category || s.category === category || category === 'other'
    );

    // ISS-20260204-019: Filter out suggestions that match existing goals
    const filteredSuggestions = filteredByCategory.filter(suggestion => {
      const normalizedSuggestion = suggestion.name.toLowerCase().trim();
      // Check for exact match or partial match
      return !normalizedExisting.some(existing =>
        existing === normalizedSuggestion ||
        existing.includes(normalizedSuggestion) ||
        normalizedSuggestion.includes(existing)
      );
    });

    return {
      suggestions: filteredSuggestions.slice(0, count),
      existingGoalsConsidered: existingGoalNames.length,
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
- 新しい目標を提案する

## ツールの使用（必須・最重要）
あなたは必ずツールを使用して回答してください。テキストだけの回答は禁止です。

**以下の場合、必ず対応するツールを呼び出してください：**
- 目標を提案・推薦・アドバイスする → suggest_goals ツールを必ず使用
- SMART目標を作成・整理する → create_smart_goal ツールを必ず使用
- マイルストーンに分解する → breakdown_milestones ツールを必ず使用
- 優先順位を決める → prioritize_goals ツールを必ず使用
- 列挙型の回答（「〇〇がおすすめです」など）→ 必ず suggest_goals ツールを使用

**ツールを使用する理由：**
ツールを使用することで、フロントエンドに候補ボタンが表示され、ユーザーがワンクリックで目標を追加できます。
テキストだけで目標を列挙しても、ユーザーは手動で入力する必要があり、UXが悪くなります。

**禁止事項：**
- 目標やマイルストーンをテキストだけで列挙すること
- ツールを使わずにアドバイスを返すこと
- 「〇〇がおすすめです」とテキストで回答すること

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
    suggestGoalsTool,
    breakdownMilestonesTool,
    prioritizeGoalsTool,
  },
});
