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
import {
  handleError,
  getToolFallbackResponse,
  createErrorLogMessage,
} from '../utils/errorHandler.js';
import type { SupabaseClient } from '@supabase/supabase-js';

// THLI-24 related imports
import { THLIAssessmentService } from './thliAssessmentService.js';
import { BabyStepGeneratorService } from './babyStepGeneratorService.js';
import { LevelManagerService } from './levelManagerService.js';
import { UsageQuotaService } from './usageQuotaService.js';
import type { LevelEstimate, BabyStepPlans, QuotaStatus } from '../types/thli.js';

const logger = getLogger('aiCoachService');

/**
 * Tool definitions for OpenAI Function Calling
 */
const COACH_TOOLS: ChatCompletionTool[] = [
  // === UI連携ツール（習慣作成・提案用） ===
  {
    type: 'function',
    function: {
      name: 'create_habit_suggestion',
      description: 'ユーザーに習慣を提案する際に使用。このツールを呼ぶと、フロントエンドに候補カードが表示される（モーダルは開かない）。ユーザーがカードをクリックすると編集モーダルが開く。ユーザーが習慣を作りたい、または習慣を提案してほしいと言った場合は必ずこのツールを使う。',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: '習慣の名前（例: 毎朝ジョギング、読書30分）',
          },
          type: {
            type: 'string',
            enum: ['do', 'avoid'],
            description: '習慣のタイプ。do=実行する習慣、avoid=避ける習慣',
          },
          frequency: {
            type: 'string',
            enum: ['daily', 'weekly', 'monthly'],
            description: '頻度。daily=毎日、weekly=毎週、monthly=毎月',
          },
          triggerTime: {
            type: 'string',
            description: '実行時刻（HH:MM形式、例: 07:00）。省略可。',
          },
          duration: {
            type: 'number',
            description: '所要時間（分）。省略可。',
          },
          targetCount: {
            type: 'number',
            description: '目標回数/量。省略可。',
          },
          workloadUnit: {
            type: 'string',
            description: '単位（例: 回、ページ、分）。省略可。',
          },
          reason: {
            type: 'string',
            description: 'この習慣を提案する理由。',
          },
          confidence: {
            type: 'number',
            description: '提案の確信度（0-1）。',
          },
        },
        required: ['name', 'type', 'frequency'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_multiple_habit_suggestions',
      description: '複数の習慣を一度に提案する際に使用。ゴール達成のための習慣を提案する場合などに使う。',
      parameters: {
        type: 'object',
        properties: {
          suggestions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', description: '習慣の名前' },
                type: { type: 'string', enum: ['do', 'avoid'] },
                frequency: { type: 'string', enum: ['daily', 'weekly', 'monthly'] },
                triggerTime: { type: 'string', description: '実行時刻（HH:MM形式）' },
                duration: { type: 'number', description: '所要時間（分）' },
                suggestedTargetCount: { type: 'number', description: '目標回数/量' },
                workloadUnit: { type: 'string', description: '単位' },
                reason: { type: 'string', description: '提案理由' },
                confidence: { type: 'number', description: '確信度（0-1）' },
              },
              required: ['name', 'type', 'frequency', 'reason'],
            },
            description: '提案する習慣のリスト',
          },
        },
        required: ['suggestions'],
      },
    },
  },
  // === Goal提案ツール ===
  {
    type: 'function',
    function: {
      name: 'create_goal_suggestion',
      description: 'ユーザーにゴール（目標）を提案する際に使用。このツールを呼ぶと、フロントエンドに候補カードが表示される（モーダルは開かない）。ユーザーがカードをクリックすると編集モーダルが開く。ユーザーがゴールを作りたい、または目標を提案してほしいと言った場合は必ずこのツールを使う。',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'ゴールの名前（例: 健康的な生活を送る、英語力を向上させる）',
          },
          description: {
            type: 'string',
            description: 'ゴールの詳細説明（省略可）',
          },
          reason: {
            type: 'string',
            description: 'このゴールを提案する理由',
          },
          suggestedHabits: {
            type: 'array',
            items: { type: 'string' },
            description: 'このゴール達成に役立つ習慣の例（省略可）',
          },
        },
        required: ['name', 'reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_multiple_goal_suggestions',
      description: '【必須】複数のゴールを提案する際に使用。ユーザーが「どんなゴールを設定すればいいか」「目標を決めたい」と聞いた場合は必ずこのツールを使う。テキストの番号リストでゴールを提案することは禁止。このツールを呼ぶと、フロントエンドに候補カードが表示される。',
      parameters: {
        type: 'object',
        properties: {
          suggestions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'ゴールの名前' },
                description: { type: 'string', description: 'ゴールの詳細説明' },
                icon: { type: 'string', description: 'アイコン（絵文字1つ）' },
                reason: { type: 'string', description: '提案理由' },
                suggestedHabits: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'このゴール達成に役立つ習慣の例',
                },
              },
              required: ['name', 'reason'],
            },
            description: '提案するゴールのリスト',
          },
        },
        required: ['suggestions'],
      },
    },
  },
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
  // === 新規ツール: カテゴリ別提案（マスターデータ） ===
  {
    type: 'function',
    function: {
      name: 'get_category_suggestions',
      description: 'カテゴリ別の習慣・ゴール提案をマスターデータから取得する。ユーザーが「健康の習慣を教えて」「仕事の生産性を上げたい」などと言った場合に使用。トークン消費を抑えながら質の高い提案ができる。',
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            enum: ['health-fitness', 'work-productivity', 'learning-skills', 'hobbies-relaxation', 'relationships', 'finance', 'mindfulness-spirituality', 'self-care-beauty', 'home-living', 'parenting-family', 'social-contribution', 'digital-technology', 'career-growth'],
            description: 'カテゴリID。health-fitness=健康・運動、work-productivity=仕事・生産性、learning-skills=学習・スキル、hobbies-relaxation=趣味・リラックス、relationships=人間関係、finance=財務、mindfulness-spirituality=マインドフルネス・精神性、self-care-beauty=セルフケア・美容、home-living=家事・住環境、parenting-family=子育て・家族、social-contribution=社会貢献、digital-technology=デジタル・テクノロジー、career-growth=キャリア・成長',
          },
          type: {
            type: 'string',
            enum: ['habits', 'goals', 'both'],
            description: '取得するデータの種類。habits=習慣のみ、goals=ゴールのみ、both=両方',
          },
          limit: {
            type: 'number',
            description: '取得する提案の最大数（デフォルト: 5）',
          },
        },
        required: ['category'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_available_categories',
      description: '利用可能なカテゴリ一覧を取得する。ユーザーが「どんなカテゴリがある？」「何を始めればいい？」と聞いた場合に使用。',
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
      name: 'search_habit_suggestions',
      description: 'キーワードで習慣提案を検索する。ユーザーが具体的なキーワード（「朝」「運動」「読書」など）で習慣を探している場合に使用。',
      parameters: {
        type: 'object',
        properties: {
          keyword: {
            type: 'string',
            description: '検索キーワード（日本語OK）',
          },
          limit: {
            type: 'number',
            description: '取得する提案の最大数（デフォルト: 5）',
          },
        },
        required: ['keyword'],
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
  // === THLI-24 レベル評価ツール ===
  {
    type: 'function',
    function: {
      name: 'assess_habit_level',
      description: '習慣のレベル（難易度）をTHLI-24フレームワークで評価する。ユーザーが「この習慣のレベルを知りたい」「習慣の難易度を評価して」と言った場合に使用。評価には複数の質問に答える必要がある。',
      parameters: {
        type: 'object',
        properties: {
          habit_id: {
            type: 'string',
            description: '評価する習慣のID',
          },
          habit_name: {
            type: 'string',
            description: '評価する習慣の名前（IDがない場合に名前で検索）',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'suggest_baby_steps',
      description: '習慣を簡略化するベビーステップを提案する。ユーザーが「習慣が難しすぎる」「もっと簡単にしたい」「続けられない」と言った場合に使用。Lv.50（半分の負荷）とLv.10（最小限の習慣）の2つのプランを提案する。',
      parameters: {
        type: 'object',
        properties: {
          habit_id: {
            type: 'string',
            description: '簡略化する習慣のID',
          },
          habit_name: {
            type: 'string',
            description: '簡略化する習慣の名前（IDがない場合に名前で検索）',
          },
          target_level: {
            type: 'number',
            description: '目標レベル（省略時はLv.50とLv.10の両方を提案）',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'suggest_level_up',
      description: '習慣のレベルアップを提案する。ユーザーが「習慣が簡単すぎる」「もっと挑戦したい」「レベルを上げたい」と言った場合に使用。達成率が高い習慣に対して、より高い負荷の習慣を提案する。',
      parameters: {
        type: 'object',
        properties: {
          habit_id: {
            type: 'string',
            description: 'レベルアップする習慣のID',
          },
          habit_name: {
            type: 'string',
            description: 'レベルアップする習慣の名前（IDがない場合に名前で検索）',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_habit_level_details',
      description: '習慣のレベル詳細情報を取得する。ユーザーが「習慣のレベルを見せて」「評価結果を確認したい」と言った場合に使用。',
      parameters: {
        type: 'object',
        properties: {
          habit_id: {
            type: 'string',
            description: '詳細を取得する習慣のID',
          },
          habit_name: {
            type: 'string',
            description: '詳細を取得する習慣の名前（IDがない場合に名前で検索）',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_thli_quota_status',
      description: 'ユーザーのTHLI-24評価クォータ（残り回数）を取得する。ユーザーが「あと何回評価できる？」「クォータを確認したい」と言った場合に使用。',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  // === UIコンポーネント表示ツール ===
  {
    type: 'function',
    function: {
      name: 'render_ui_component',
      description: 'フロントエンドにUIコンポーネントを表示する。統計、選択肢、ワークロードなどを視覚的に表示したい場合に使用。',
      parameters: {
        type: 'object',
        properties: {
          component: {
            type: 'string',
            enum: ['habit_stats', 'choice_buttons', 'workload_chart', 'progress_indicator', 'quick_actions'],
            description: '表示するコンポーネントの種類',
          },
          data: {
            type: 'object',
            description: 'コンポーネントに渡すデータ',
          },
        },
        required: ['component', 'data'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'show_habit_stats',
      description: '習慣の統計情報をカード形式で表示する。達成率、トレンド、ストリーク日数などを視覚的に表示。',
      parameters: {
        type: 'object',
        properties: {
          habit_name: {
            type: 'string',
            description: '統計を表示する習慣の名前',
          },
        },
        required: ['habit_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'show_choice_buttons',
      description: '【重要】ユーザーに選択肢を提示する際は必ずこのツールを使用する。テキストの番号リスト（1. 2. 3.）は禁止。選択肢をボタン形式で表示することで、ユーザーはクリックで選択でき、UXが向上する。習慣カテゴリの選択、頻度の選択、次のアクションの選択など、複数の選択肢がある場合は常にこのツールを使う。',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: '選択肢のタイトル（例: どんな分野の習慣を始めたいですか？）',
          },
          choices: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', description: '選択肢のID（英語、スネークケース推奨）' },
                label: { type: 'string', description: '選択肢のラベル（日本語OK）' },
                icon: { type: 'string', description: 'アイコン（絵文字1つ）' },
                description: { type: 'string', description: '補足説明（省略可）' },
                urgency: { type: 'string', enum: ['low', 'medium', 'high'], description: '緊急度（省略可）' },
                disabled: { type: 'boolean', description: '無効化フラグ（省略可）' },
              },
              required: ['id', 'label'],
            },
            description: '選択肢のリスト（2-5個推奨）',
          },
          layout: {
            type: 'string',
            enum: ['vertical', 'horizontal', 'grid'],
            description: 'レイアウト。vertical=縦並び、horizontal=横並び、grid=グリッド（省略時は選択肢数に応じて自動決定）',
          },
          size: {
            type: 'string',
            enum: ['sm', 'md', 'lg'],
            description: 'ボタンサイズ。sm=小、md=中、lg=大（省略時はmd）',
          },
        },
        required: ['title', 'choices'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'show_workload_chart',
      description: 'ワークロード分析をチャート形式で表示する。日/週の負荷を視覚的に表示。',
      parameters: {
        type: 'object',
        properties: {
          chart_type: {
            type: 'string',
            enum: ['bar', 'donut'],
            description: 'チャートの種類。bar=棒グラフ、donut=ドーナツチャート',
          },
        },
        required: [],
      },
    },
  },
];

// Import the spec-based helpers (guardrails and clarification logic)
import {
  shouldProceedWithoutClarification,
  isWithinScope,
  needsClarification,
} from './aiCoachSpec.js';

// Import SpecLoader for external spec files
import { getSpecLoader, type SpecContent } from './specLoader.js';

// Import MasterDataLoader for category-based suggestions
import { getMasterDataLoader } from './masterDataLoader.js';

// Import PersonalizationEngine for user context analysis
import { PersonalizationEngine } from './personalizationEngine.js';

// Import PromptBuilder for context-aware prompts
import { getPromptBuilder } from './promptBuilder.js';

// Import SimilarityChecker for duplicate detection
import { getSimilarityChecker } from './similarityChecker.js';

// Import UserContext type
import type { UserContext } from '../types/personalization.js';

/**
 * System prompt cache for the AI Coach
 * Loaded from external spec files on first use
 */
let cachedSystemPrompt: string | null = null;
let specLoadPromise: Promise<SpecContent> | null = null;

/**
 * Load and build system prompt from external spec files
 * Uses caching to avoid repeated file reads
 */
async function loadSystemPrompt(): Promise<string> {
  if (cachedSystemPrompt) {
    return cachedSystemPrompt;
  }

  // Prevent concurrent loading
  if (!specLoadPromise) {
    const specLoader = getSpecLoader();
    specLoadPromise = specLoader.loadSpecs();
  }

  const specs = await specLoadPromise;
  const specLoader = getSpecLoader();
  cachedSystemPrompt = specLoader.buildSystemPrompt(specs);

  return cachedSystemPrompt;
}

/**
 * Clear the cached system prompt (for hot-reload support)
 */
export function clearSystemPromptCache(): void {
  cachedSystemPrompt = null;
  specLoadPromise = null;
  getSpecLoader().clearCache();
}

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
    parsedHabit?: Record<string, unknown>;
    habitSuggestions?: Array<Record<string, unknown>>;
    parsedGoal?: Record<string, unknown>;
    goalSuggestions?: Array<Record<string, unknown>>;
    uiComponents?: Array<Record<string, unknown>>;
    // THLI-24 related data
    levelAssessment?: LevelEstimate;
    babyStepPlans?: BabyStepPlans;
    quotaStatus?: QuotaStatus;
    levelDetails?: Record<string, unknown>;
    levelUpSuggestion?: Record<string, unknown>;
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
  private personalizationEngine: PersonalizationEngine;
  private userContext: UserContext | null = null;
  private supabase: SupabaseClient;
  // THLI-24 related services
  private thliAssessmentService: THLIAssessmentService;
  private babyStepGeneratorService: BabyStepGeneratorService;
  private levelManagerService: LevelManagerService;
  private usageQuotaService: UsageQuotaService;

  constructor(supabase: SupabaseClient, userId: string) {
    const settings = getSettings();
    this.model = settings.openaiModel || 'gpt-4o-mini';
    this.userId = userId;
    this.supabase = supabase;

    if (settings.openaiApiKey) {
      this.openai = new OpenAI({ apiKey: settings.openaiApiKey });
    }

    this.habitRepo = new HabitRepository(supabase);
    this.activityRepo = new ActivityRepository(supabase);
    this.goalRepo = new GoalRepository(supabase);
    this.personalizationEngine = new PersonalizationEngine(supabase);
    
    // Initialize THLI-24 services
    this.thliAssessmentService = new THLIAssessmentService(supabase);
    this.babyStepGeneratorService = new BabyStepGeneratorService(supabase);
    this.levelManagerService = new LevelManagerService(supabase);
    this.usageQuotaService = new UsageQuotaService(supabase);
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

    // Check if the topic is within scope (guardrail)
    if (!isWithinScope(userMessage)) {
      return {
        message: '申し訳ありませんが、習慣管理に関することでお手伝いできます。\n\n例えば：\n・新しい習慣を作りたい\n・習慣の達成率を確認したい\n・ワークロードを調整したい\n\nなどについてお聞きください 😊',
        toolsUsed: [],
        tokensUsed: 0,
      };
    }

    try {
      // Load base system prompt from external spec files
      const baseSystemPrompt = await loadSystemPrompt();

      // Analyze user context for personalization (Requirements: 1.1, 6.1)
      this.userContext = await this.personalizationEngine.analyzeUserContext(this.userId);
      
      // Build personalized system prompt using PromptBuilder (Requirements: 6.1, 6.2, 6.3)
      const promptBuilder = getPromptBuilder();
      const systemPrompt = promptBuilder.buildSystemPrompt(this.userContext, baseSystemPrompt);

      logger.debug('Personalized system prompt built', {
        userId: this.userId,
        userLevel: this.userContext.userLevel,
        activeHabitCount: this.userContext.activeHabitCount,
        averageCompletionRate: Math.round(this.userContext.averageCompletionRate * 100),
      });

      // Check if clarification is needed (unless user wants to proceed)
      const clarification = needsClarification(userMessage);
      const shouldProceed = shouldProceedWithoutClarification(userMessage);
      
      // Build context message for clarification needs
      let contextMessage = '';
      if (clarification.needed && !shouldProceed && conversationHistory.length === 0) {
        // Only add clarification hint on first message if needed
        contextMessage = `\n\n[システム注記: ユーザーの意図が曖昧な可能性があります。以下の点を確認することを検討してください: ${clarification.questions.join(', ')}。ただし、ユーザーが「それで進めて」などと言った場合は確認せずに進めてください。]`;
      }

      const messages: ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt + contextMessage },
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
            let args: Record<string, unknown>;
            try {
              args = JSON.parse(toolCall.function.arguments || '{}') as Record<string, unknown>;
            } catch {
              args = {};
            }
            
            toolsUsed.push(toolName);
            logger.info('Executing tool', { toolName, args, userId: this.userId });

            // Execute tool with error handling
            const result = await this.executeToolSafely(toolName, args);
            
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
    } catch (error) {
      // Handle errors gracefully
      const errorResult = handleError(error);
      logger.error(createErrorLogMessage(error, { userId: this.userId, userMessage }));

      return {
        message: errorResult.userMessage,
        toolsUsed: [],
        tokensUsed: 0,
      };
    }
  }

  /**
   * Execute a tool safely with error handling
   */
  private async executeToolSafely(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    try {
      return await this.executeTool(toolName, args);
    } catch (error) {
      logger.error(
        'Tool execution failed',
        error instanceof Error ? error : new Error(String(error)),
        { toolName, userId: this.userId }
      );

      // Return fallback response for the tool
      return {
        error: true,
        fallbackMessage: getToolFallbackResponse(toolName),
      };
    }
  }

  /**
   * Execute a tool and return the result
   */
  private async executeTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    switch (toolName) {
      // UI連携ツール
      case 'create_habit_suggestion':
        return this.createHabitSuggestion(args);

      case 'create_multiple_habit_suggestions':
        return this.createMultipleHabitSuggestions(args['suggestions'] as Array<Record<string, unknown>>);

      // Goal提案ツール
      case 'create_goal_suggestion':
        return await this.createGoalSuggestion(args);

      case 'create_multiple_goal_suggestions':
        return await this.createMultipleGoalSuggestions(args['suggestions'] as Array<Record<string, unknown>>);

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

      // 新規ツール: カテゴリ別提案（マスターデータ）
      case 'get_category_suggestions':
        return this.getCategorySuggestions(
          args['category'] as string,
          args['type'] as string | undefined,
          args['limit'] as number | undefined
        );

      case 'list_available_categories':
        return this.listAvailableCategories();

      case 'search_habit_suggestions':
        return this.searchHabitSuggestions(
          args['keyword'] as string,
          args['limit'] as number | undefined
        );

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

      // UIコンポーネント表示ツール
      case 'render_ui_component':
        return this.renderUIComponent(
          args['component'] as string,
          args['data'] as Record<string, unknown>
        );

      case 'show_habit_stats':
        return this.showHabitStats(args['habit_name'] as string);

      case 'show_choice_buttons': {
        const layout = args['layout'] as 'vertical' | 'horizontal' | 'grid' | undefined;
        const size = args['size'] as 'sm' | 'md' | 'lg' | undefined;
        const options: { layout?: 'vertical' | 'horizontal' | 'grid'; size?: 'sm' | 'md' | 'lg' } = {};
        if (layout) options.layout = layout;
        if (size) options.size = size;
        return this.showChoiceButtons(
          args['title'] as string,
          args['choices'] as Array<{ 
            id: string; 
            label: string; 
            icon?: string; 
            description?: string;
            urgency?: 'low' | 'medium' | 'high';
            disabled?: boolean;
          }>,
          Object.keys(options).length > 0 ? options : undefined
        );
      }

      case 'show_workload_chart':
        return this.showWorkloadChart(args['chart_type'] as string | undefined);

      // THLI-24 レベル評価ツール
      case 'assess_habit_level':
        return this.assessHabitLevel(
          args['habit_id'] as string | undefined,
          args['habit_name'] as string | undefined
        );

      case 'suggest_baby_steps':
        return this.suggestBabySteps(
          args['habit_id'] as string | undefined,
          args['habit_name'] as string | undefined,
          args['target_level'] as number | undefined
        );

      case 'suggest_level_up':
        return this.suggestLevelUp(
          args['habit_id'] as string | undefined,
          args['habit_name'] as string | undefined
        );

      case 'get_habit_level_details':
        return this.getHabitLevelDetails(
          args['habit_id'] as string | undefined,
          args['habit_name'] as string | undefined
        );

      case 'get_thli_quota_status':
        return this.getTHLIQuotaStatus();

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
      case 'create_habit_suggestion':
        // Store as parsedHabit for single habit suggestion
        data.parsedHabit = result as Record<string, unknown>;
        break;
      case 'create_multiple_habit_suggestions':
        // Store as suggestions for multiple habit suggestions
        data.habitSuggestions = (result as { suggestions: Record<string, unknown>[] }).suggestions;
        break;
      case 'create_goal_suggestion':
        // Store as parsedGoal for single goal suggestion
        data.parsedGoal = result as Record<string, unknown>;
        break;
      case 'create_multiple_goal_suggestions':
        // Store as goalSuggestions for multiple goal suggestions
        const goalResult = result as { suggestions: Record<string, unknown>[] };
        data.goalSuggestions = goalResult.suggestions;
        logger.info('Stored goalSuggestions', { count: goalResult.suggestions?.length, data: goalResult.suggestions });
        break;
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
      case 'render_ui_component':
      case 'show_habit_stats':
      case 'show_choice_buttons':
      case 'show_workload_chart':
        // UIコンポーネントデータを保存
        if (!data.uiComponents) {
          data.uiComponents = [];
        }
        data.uiComponents.push(result as Record<string, unknown>);
        break;
      // THLI-24 ツール結果の保存
      case 'assess_habit_level':
        data.levelAssessment = (result as { assessment: LevelEstimate }).assessment;
        break;
      case 'suggest_baby_steps':
        data.babyStepPlans = (result as { plans: BabyStepPlans }).plans;
        break;
      case 'suggest_level_up':
        data.levelUpSuggestion = result as Record<string, unknown>;
        break;
      case 'get_habit_level_details':
        data.levelDetails = result as Record<string, unknown>;
        break;
      case 'get_thli_quota_status':
        data.quotaStatus = result as QuotaStatus;
        break;
    }
  }

  /**
   * Create a single habit suggestion (for UI display)
   * Includes duplicate detection using SimilarityChecker (Requirements: 4.1, 4.2)
   * Enhanced with user preferred time slots (Requirements: 3.5)
   */
  private createHabitSuggestion(args: Record<string, unknown>): Record<string, unknown> {
    const habitName = args['name'] as string;
    const frequency = args['frequency'] as string;
    
    // Check for duplicates using SimilarityChecker (Requirements: 4.1, 4.2)
    const similarityChecker = getSimilarityChecker();
    const existingHabitNames = this.userContext?.existingHabitNames || [];
    const similarityResult = similarityChecker.checkSimilarity(habitName, existingHabitNames);

    // Log duplicate detection (Requirements: 4.5)
    if (!similarityResult.isUnique) {
      logger.info('Duplicate habit suggestion detected', {
        userId: this.userId,
        suggestedHabit: habitName,
        similarTo: similarityResult.mostSimilarHabit,
        similarityScore: similarityResult.similarityScore,
      });
    }

    // Enhance triggerTime with user's preferred time slots (Requirements: 3.5)
    let triggerTime = args['triggerTime'] as string | null || null;
    if (!triggerTime && frequency === 'daily' && this.userContext?.preferredTimeSlots?.length) {
      // Use the most frequent time slot
      const preferredSlot = this.userContext.preferredTimeSlots[0];
      if (preferredSlot) {
        triggerTime = `${preferredSlot.hour.toString().padStart(2, '0')}:00`;
      }
    }

    // Generate personalized reason (Requirements: 3.4)
    let reason = args['reason'] as string || '';
    if (reason && this.userContext) {
      reason = this.personalizeReason(reason, habitName);
    }

    return {
      name: habitName,
      type: args['type'] as string,
      frequency,
      triggerTime,
      duration: args['duration'] as number | null || null,
      targetCount: args['targetCount'] as number | null || null,
      workloadUnit: args['workloadUnit'] as string | null || null,
      reason,
      confidence: args['confidence'] as number || 0.8,
      goalId: null,
      // Include duplicate detection info
      duplicateWarning: !similarityResult.isUnique ? {
        similarTo: similarityResult.mostSimilarHabit,
        similarityScore: similarityResult.similarityScore,
        message: `「${similarityResult.mostSimilarHabit}」と類似しています`,
      } : undefined,
    };
  }

  /**
   * Personalize the reason based on user context (Requirements: 3.4)
   */
  private personalizeReason(reason: string, _habitName: string): string {
    if (!this.userContext) return reason;

    const { userLevel, averageCompletionRate, activeHabitCount } = this.userContext;

    // Add level-specific encouragement
    if (userLevel === 'beginner') {
      if (!reason.includes('始め') && !reason.includes('最初')) {
        reason += ' 小さく始めることが成功の鍵です。';
      }
    } else if (userLevel === 'intermediate') {
      if (averageCompletionRate >= 0.7) {
        reason += ' 現在の達成率を維持しながら挑戦してみましょう。';
      }
    } else if (userLevel === 'advanced') {
      if (activeHabitCount >= 5) {
        reason += ' 既存の習慣との相乗効果が期待できます。';
      }
    }

    return reason;
  }

  /**
   * Create multiple habit suggestions (for UI display)
   * Includes duplicate detection using SimilarityChecker (Requirements: 4.1, 4.2)
   * Enhanced with user preferred time slots (Requirements: 3.5)
   */
  private createMultipleHabitSuggestions(suggestions: Array<Record<string, unknown>>): { suggestions: Array<Record<string, unknown>> } {
    const similarityChecker = getSimilarityChecker();
    const existingHabitNames = this.userContext?.existingHabitNames || [];

    return {
      suggestions: suggestions.map(s => {
        const habitName = s['name'] as string;
        const frequency = s['frequency'] as string;
        const similarityResult = similarityChecker.checkSimilarity(habitName, existingHabitNames);

        // Log duplicate detection (Requirements: 4.5)
        if (!similarityResult.isUnique) {
          logger.info('Duplicate habit suggestion detected in batch', {
            userId: this.userId,
            suggestedHabit: habitName,
            similarTo: similarityResult.mostSimilarHabit,
            similarityScore: similarityResult.similarityScore,
          });
        }

        // Enhance triggerTime with user's preferred time slots (Requirements: 3.5)
        let triggerTime = s['triggerTime'] as string | null || null;
        if (!triggerTime && frequency === 'daily' && this.userContext?.preferredTimeSlots?.length) {
          const preferredSlot = this.userContext.preferredTimeSlots[0];
          if (preferredSlot) {
            triggerTime = `${preferredSlot.hour.toString().padStart(2, '0')}:00`;
          }
        }

        // Generate personalized reason (Requirements: 3.4)
        let reason = s['reason'] as string || '';
        if (reason && this.userContext) {
          reason = this.personalizeReason(reason, habitName);
        }

        return {
          name: habitName,
          type: s['type'] as string,
          frequency,
          triggerTime,
          duration: s['duration'] as number | null || null,
          suggestedTargetCount: s['suggestedTargetCount'] as number || 1,
          workloadUnit: s['workloadUnit'] as string | null || null,
          reason,
          confidence: s['confidence'] as number || 0.8,
          // Include duplicate detection info
          duplicateWarning: !similarityResult.isUnique ? {
            similarTo: similarityResult.mostSimilarHabit,
            similarityScore: similarityResult.similarityScore,
            message: `「${similarityResult.mostSimilarHabit}」と類似しています`,
          } : undefined,
        };
      }),
    };
  }

  /**
   * Create a single goal suggestion (for UI display)
   * Enhanced with habit suggestions from master data (Requirements: 8.2, 8.3)
   */
  private async createGoalSuggestion(args: Record<string, unknown>): Promise<Record<string, unknown>> {
    const goalName = args['name'] as string;
    const suggestedHabits = args['suggestedHabits'] as string[] || [];
    
    // Enhance with habits from master data if not enough suggestions
    let enhancedHabits = [...suggestedHabits];
    if (enhancedHabits.length < 2) {
      const masterDataLoader = getMasterDataLoader();
      const relatedHabits = await masterDataLoader.searchHabits(goalName);
      
      // Filter out duplicates with existing habits
      const similarityChecker = getSimilarityChecker();
      const existingHabitNames = this.userContext?.existingHabitNames || [];
      
      const uniqueRelatedHabits = relatedHabits.filter(h => {
        const result = similarityChecker.checkSimilarity(h.name, existingHabitNames);
        return result.isUnique && !enhancedHabits.includes(h.name);
      });
      
      // Add up to 4 habits total
      const habitsToAdd = uniqueRelatedHabits.slice(0, 4 - enhancedHabits.length);
      enhancedHabits = [...enhancedHabits, ...habitsToAdd.map(h => h.name)];
    }
    
    return {
      name: goalName,
      description: args['description'] as string || '',
      reason: args['reason'] as string || '',
      suggestedHabits: enhancedHabits,
    };
  }

  /**
   * Create multiple goal suggestions (for UI display)
   * Enhanced with habit suggestions from master data (Requirements: 8.2, 8.3)
   */
  private async createMultipleGoalSuggestions(suggestions: Array<Record<string, unknown>>): Promise<{ suggestions: Array<Record<string, unknown>> }> {
    const masterDataLoader = getMasterDataLoader();
    const similarityChecker = getSimilarityChecker();
    const existingHabitNames = this.userContext?.existingHabitNames || [];
    
    const enhancedSuggestions = await Promise.all(
      suggestions.map(async (s) => {
        const goalName = s['name'] as string;
        const suggestedHabits = s['suggestedHabits'] as string[] || [];
        
        // Enhance with habits from master data if not enough suggestions
        let enhancedHabits = [...suggestedHabits];
        if (enhancedHabits.length < 2) {
          const relatedHabits = await masterDataLoader.searchHabits(goalName);
          
          // Filter out duplicates with existing habits
          const uniqueRelatedHabits = relatedHabits.filter(h => {
            const result = similarityChecker.checkSimilarity(h.name, existingHabitNames);
            return result.isUnique && !enhancedHabits.includes(h.name);
          });
          
          // Add up to 4 habits total
          const habitsToAdd = uniqueRelatedHabits.slice(0, 4 - enhancedHabits.length);
          enhancedHabits = [...enhancedHabits, ...habitsToAdd.map(h => h.name)];
        }
        
        return {
          name: goalName,
          description: s['description'] as string || '',
          icon: s['icon'] as string || '🎯',
          reason: s['reason'] as string || '',
          suggestedHabits: enhancedHabits,
        };
      })
    );
    
    return { suggestions: enhancedSuggestions };
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
  // 新規ツール: カテゴリ別提案（マスターデータ）
  // ============================================================================

  /**
   * Get category suggestions from master data
   * This uses pre-defined master data instead of AI generation, saving tokens
   * Includes user level filtering (Requirements: 2.4, 2.5, 2.6)
   */
  private async getCategorySuggestions(
    category: string,
    type?: string,
    limit?: number
  ): Promise<Record<string, unknown>> {
    const masterDataLoader = getMasterDataLoader();
    const categoryData = await masterDataLoader.loadCategory(category);

    if (!categoryData) {
      const availableCategories = masterDataLoader.getAvailableCategories();
      return {
        error: `カテゴリ「${category}」が見つかりません`,
        availableCategories: availableCategories.map(c => ({ id: c.id, name: c.nameJa })),
      };
    }

    const maxItems = limit || 5;
    const dataType = type || 'both';

    // Get user level for filtering (Requirements: 2.4, 2.5, 2.6)
    const userLevel = this.userContext?.userLevel || 'beginner';
    
    // Map user level to max difficulty level
    const maxDifficultyByLevel: Record<string, 'beginner' | 'intermediate' | 'advanced'> = {
      beginner: 'beginner',
      intermediate: 'intermediate',
      advanced: 'advanced',
    };
    const maxDifficulty = maxDifficultyByLevel[userLevel] || 'beginner';

    const result: Record<string, unknown> = {
      category: categoryData.category,
      categoryName: categoryData.categoryJa,
      subcategories: categoryData.subcategories,
      userLevel,
    };

    if (dataType === 'habits' || dataType === 'both') {
      // Filter habits by user level (Requirements: 2.4, 2.5, 2.6)
      const filteredHabits = await masterDataLoader.getHabitsByMaxDifficulty(category, maxDifficulty);
      
      // Check for duplicates using SimilarityChecker
      const similarityChecker = getSimilarityChecker();
      const existingHabitNames = this.userContext?.existingHabitNames || [];
      
      // Filter out duplicates and shuffle for variety
      const uniqueHabits = filteredHabits.filter(h => {
        const similarityResult = similarityChecker.checkSimilarity(h.name, existingHabitNames);
        return similarityResult.isUnique;
      });
      
      const shuffledHabits = [...uniqueHabits].sort(() => Math.random() - 0.5);
      
      result['habits'] = shuffledHabits.slice(0, maxItems).map(h => ({
        name: h.name,
        type: h.type,
        frequency: h.frequency,
        suggestedTargetCount: h.suggestedTargetCount,
        workloadUnit: h.workloadUnit,
        reason: h.reason,
        triggerTime: h.triggerTime,
        duration: h.duration,
        subcategory: h.subcategory,
        difficultyLevel: h.difficultyLevel,
        habitStackingTriggers: h.habitStackingTriggers,
      }));
      result['totalHabitsInCategory'] = categoryData.habits.length;
      result['filteredByLevel'] = userLevel !== 'advanced';
    }

    if (dataType === 'goals' || dataType === 'both') {
      const shuffledGoals = [...categoryData.goals].sort(() => Math.random() - 0.5);
      result['goals'] = shuffledGoals.slice(0, maxItems).map(g => ({
        name: g.name,
        description: g.description,
        icon: g.icon,
        reason: g.reason,
        suggestedHabits: g.suggestedHabits,
      }));
      result['totalGoalsInCategory'] = categoryData.goals.length;
    }

    result['tip'] = userLevel === 'beginner' 
      ? '初心者向けの習慣を優先して表示しています。慣れてきたら難易度を上げていきましょう。'
      : userLevel === 'intermediate'
      ? '中級者向けの習慣も含めて表示しています。'
      : 'すべての難易度の習慣を表示しています。';

    // Log token savings from using master data
    const estimatedTokensSaved = this.estimateTokenSavings(categoryData, dataType, maxItems);
    logger.info('Master data used for category suggestions', {
      userId: this.userId,
      category,
      dataType,
      userLevel,
      itemsReturned: maxItems,
      estimatedTokensSaved,
      source: 'master_data',
    });

    return result;
  }

  /**
   * Estimate tokens saved by using master data instead of AI generation
   * AI generation typically uses ~500-1000 tokens per suggestion
   */
  private estimateTokenSavings(
    categoryData: { habits: unknown[]; goals: unknown[] },
    dataType: string,
    itemCount: number
  ): number {
    const tokensPerAISuggestion = 750; // Average tokens for AI-generated suggestion
    let itemsUsed = 0;
    
    if (dataType === 'habits' || dataType === 'both') {
      itemsUsed += Math.min(itemCount, categoryData.habits.length);
    }
    if (dataType === 'goals' || dataType === 'both') {
      itemsUsed += Math.min(itemCount, categoryData.goals.length);
    }
    
    return itemsUsed * tokensPerAISuggestion;
  }

  /**
   * List all available categories
   */
  private listAvailableCategories(): Record<string, unknown> {
    const masterDataLoader = getMasterDataLoader();
    const categories = masterDataLoader.getAvailableCategories();

    return {
      categories: categories.map(c => ({
        id: c.id,
        name: c.nameJa,
        icon: this.getCategoryIcon(c.id),
      })),
      tip: 'カテゴリを選択すると、そのカテゴリの習慣・ゴール提案を取得できます。',
    };
  }

  /**
   * Get icon for category
   */
  private getCategoryIcon(categoryId: string): string {
    const icons: Record<string, string> = {
      'health-fitness': '💪',
      'work-productivity': '💼',
      'learning-skills': '📚',
      'hobbies-relaxation': '🎨',
      'relationships': '🤝',
      'finance': '💰',
      'mindfulness-spirituality': '🧘',
      'self-care-beauty': '✨',
      'home-living': '🏠',
      'parenting-family': '👨‍👩‍👧‍👦',
      'social-contribution': '🌍',
      'digital-technology': '💻',
      'career-growth': '📈',
    };
    return icons[categoryId] || '📌';
  }

  /**
   * Search habit suggestions by keyword
   * Uses master data for efficient token-free search
   */
  private async searchHabitSuggestions(
    keyword: string,
    limit?: number
  ): Promise<Record<string, unknown>> {
    const masterDataLoader = getMasterDataLoader();
    const results = await masterDataLoader.searchHabits(keyword);
    const maxItems = limit || 5;

    // Log token savings from using master data search
    logger.info('Master data search used for habit suggestions', {
      userId: this.userId,
      keyword,
      resultsFound: results.length,
      resultsReturned: Math.min(results.length, maxItems),
      estimatedTokensSaved: Math.min(results.length, maxItems) * 750,
      source: 'master_data_search',
    });

    if (results.length === 0) {
      return {
        keyword,
        results: [],
        message: `「${keyword}」に関連する習慣が見つかりませんでした。`,
        tip: '別のキーワードで検索するか、カテゴリ一覧から選んでください。',
      };
    }

    return {
      keyword,
      totalResults: results.length,
      results: results.slice(0, maxItems).map(h => ({
        name: h.name,
        type: h.type,
        frequency: h.frequency,
        suggestedTargetCount: h.suggestedTargetCount,
        workloadUnit: h.workloadUnit,
        reason: h.reason,
        category: h.category,
      })),
      tip: results.length > maxItems
        ? `他にも${results.length - maxItems}件の結果があります。`
        : undefined,
    };
  }

  // ============================================================================
  // 新規ツール: 行動科学ベース
  // ============================================================================

  /**
   * Suggest habit stacking opportunities
   * Uses PersonalizationEngine for anchor habits and MasterData for stacking triggers
   * Requirements: 7.1, 7.2, 7.3, 7.4
   */
  private async suggestHabitStacking(newHabitName: string): Promise<Record<string, unknown>> {
    // Use PersonalizationEngine's anchor habits if available (Requirements: 7.1)
    const anchorHabits = this.userContext?.anchorHabits || [];
    
    // If no anchor habits from context, fall back to analysis
    let effectiveAnchors = anchorHabits;
    if (effectiveAnchors.length === 0) {
      const analysis = await this.analyzeHabits(30);
      effectiveAnchors = analysis
        .filter(a => a.completionRate >= 0.8)
        .slice(0, 5)
        .map(a => ({
          habitId: a.habitId,
          habitName: a.habitName,
          completionRate: a.completionRate,
          triggerTime: null,
        }));
    }

    // Search for matching habits in master data based on the new habit name
    const masterDataLoader = getMasterDataLoader();
    const matchingHabits = await masterDataLoader.searchHabits(newHabitName);
    
    // Get stacking triggers from master data
    const stackingTriggers = matchingHabits.length > 0 
      ? matchingHabits[0]?.habitStackingTriggers || []
      : [];

    // Also search for habits that can be stacked with the new habit
    const stackingCandidates = await masterDataLoader.getStackingCandidates(newHabitName);

    if (effectiveAnchors.length === 0 && stackingTriggers.length === 0) {
      return {
        message: 'まだ安定した習慣がないため、まずは1つの習慣を定着させることをお勧めします。',
        suggestions: [],
        tip: '新しい習慣は、既存の行動（歯磨き、コーヒーを入れるなど）に紐付けることもできます。',
        commonTriggers: ['起床後', '朝食後', '歯磨き後', '仕事終わり', '夕食後', '就寝前'],
      };
    }

    const suggestions: Array<{
      anchorHabit: string;
      completionRate: string;
      stackingFormula: string;
      reason: string;
      triggerTime?: string | null;
    }> = [];

    // Add suggestions based on user's anchor habits (Requirements: 7.2, 7.3)
    for (const anchor of effectiveAnchors.slice(0, 3)) {
      suggestions.push({
        anchorHabit: anchor.habitName,
        completionRate: `${Math.round(anchor.completionRate * 100)}%`,
        stackingFormula: `「${anchor.habitName}」をした後に、「${newHabitName}」をする`,
        reason: `達成率${Math.round(anchor.completionRate * 100)}%の安定した習慣なので、良いアンカーになります`,
        triggerTime: anchor.triggerTime,
      });
    }

    // Add suggestions based on master data triggers (Requirements: 7.4)
    if (stackingTriggers.length > 0) {
      for (const trigger of stackingTriggers.slice(0, 2)) {
        // Check if this trigger is not already covered by anchor habits
        const alreadyCovered = suggestions.some(s => 
          s.anchorHabit.includes(trigger) || trigger.includes(s.anchorHabit)
        );
        if (!alreadyCovered) {
          suggestions.push({
            anchorHabit: trigger,
            completionRate: '推奨',
            stackingFormula: `「${trigger}」に、「${newHabitName}」をする`,
            reason: `マスターデータに基づく推奨トリガーです`,
          });
        }
      }
    }

    // Add related habits from master data that could be stacked
    const relatedHabits = stackingCandidates.slice(0, 3).map(h => ({
      name: h.name,
      category: h.category,
      triggers: h.habitStackingTriggers,
    }));

    return {
      newHabit: newHabitName,
      suggestions,
      relatedHabits: relatedHabits.length > 0 ? relatedHabits : undefined,
      principle: '習慣スタッキングは、既存の習慣を「きっかけ」として新しい習慣を紐付ける手法です。',
      formula: '「[現在の習慣]をした後に、[新しい習慣]をする」',
      tip: effectiveAnchors.length > 0 
        ? `あなたの安定した習慣（${effectiveAnchors.slice(0, 2).map(a => a.habitName).join('、')}）を起点にするのがおすすめです。`
        : '毎日行う既存の行動（歯磨き、コーヒーを入れるなど）を起点にしましょう。',
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

  // ============================================================================
  // UIコンポーネント表示ツール
  // ============================================================================

  /**
   * Render a UI component with specified data
   */
  private renderUIComponent(
    component: string,
    data: Record<string, unknown>
  ): Record<string, unknown> {
    return {
      type: 'ui_component',
      component,
      data,
      rendered: true,
    };
  }

  /**
   * Show habit statistics card
   */
  private async showHabitStats(habitName: string): Promise<Record<string, unknown>> {
    const habits = await this.habitRepo.searchByName('user', this.userId, habitName, 1);
    
    if (habits.length === 0) {
      return { error: `「${habitName}」という習慣が見つかりませんでした` };
    }

    const habit = habits[0];
    if (!habit) {
      return { error: `「${habitName}」という習慣が見つかりませんでした` };
    }

    const analysis = await this.analyzeHabits(30, [habit.id]);
    const habitAnalysis = analysis[0];

    // Calculate streak
    const activities = await this.activityRepo.getHabitActivities(habit.id, 'complete', 60);
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 60; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const dateStr = checkDate.toISOString().split('T')[0];
      
      const hasActivity = activities.some(a => {
        const actDate = new Date(a.timestamp).toISOString().split('T')[0];
        return actDate === dateStr;
      });

      if (hasActivity) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }

    // Get recent history for mini calendar
    const recentHistory: Array<{ date: string; completed: boolean }> = [];
    for (let i = 6; i >= 0; i--) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const dateStr = checkDate.toISOString().split('T')[0] || '';
      
      const hasActivity = activities.some(a => {
        const actDate = new Date(a.timestamp).toISOString().split('T')[0];
        return actDate === dateStr;
      });

      recentHistory.push({ date: dateStr, completed: hasActivity });
    }

    return {
      type: 'ui_component',
      component: 'habit_stats',
      data: {
        habitId: habit.id,
        habitName: habit.name,
        completionRate: habitAnalysis?.completionRate || 0,
        trend: habitAnalysis?.trend || 'stable',
        streak,
        recentHistory,
        frequency: habit.frequency,
        targetCount: habit.target_count,
        workloadUnit: habit.workload_unit,
      },
    };
  }

  /**
   * Show choice buttons for user selection
   * Returns UIComponentData with choice_buttons component
   * 
   * Schema:
   * - type: 'ui_component'
   * - component: 'choice_buttons'
   * - data: ChoiceButtonsData
   *   - title: string (required)
   *   - choices: Choice[] (required, 2-5 items)
   *     - id: string (required)
   *     - label: string (required)
   *     - icon?: string (emoji)
   *     - description?: string
   *     - urgency?: 'low' | 'medium' | 'high'
   *     - disabled?: boolean
   *   - layout?: 'vertical' | 'horizontal' | 'grid'
   *   - size?: 'sm' | 'md' | 'lg'
   */
  private showChoiceButtons(
    title: string,
    choices: Array<{ 
      id: string; 
      label: string; 
      icon?: string; 
      description?: string;
      urgency?: 'low' | 'medium' | 'high';
      disabled?: boolean;
    }>,
    options?: {
      layout?: 'vertical' | 'horizontal' | 'grid';
      size?: 'sm' | 'md' | 'lg';
    }
  ): Record<string, unknown> {
    // Limit to 5 choices (2-5 recommended)
    const limitedChoices = choices.slice(0, 5);

    // Determine default layout based on choice count
    const defaultLayout = limitedChoices.length <= 3 ? 'horizontal' : 'vertical';

    return {
      type: 'ui_component',
      component: 'choice_buttons',
      data: {
        title,
        choices: limitedChoices.map(c => ({
          id: c.id,
          label: c.label,
          icon: c.icon || '📌',
          description: c.description,
          urgency: c.urgency,
          disabled: c.disabled || false,
        })),
        layout: options?.layout || defaultLayout,
        size: options?.size || 'md',
      },
    };
  }

  /**
   * Show workload chart
   */
  private async showWorkloadChart(chartType?: string): Promise<Record<string, unknown>> {
    const workload = await this.getWorkloadSummary();
    const habits = await this.habitRepo.getByOwner('user', this.userId, true);
    const activeHabits = habits.filter(h => h.active);

    // Calculate breakdown by habit
    const breakdown = activeHabits.map(habit => {
      let minutes = habit.workload_per_count * 15;
      if (habit.frequency === 'weekly') {
        minutes = minutes / 7;
      } else if (habit.frequency === 'monthly') {
        minutes = minutes / 30;
      }
      return {
        name: habit.name,
        minutes: Math.round(minutes),
      };
    }).sort((a, b) => b.minutes - a.minutes).slice(0, 8);

    return {
      type: 'ui_component',
      component: 'workload_chart',
      data: {
        ...workload,
        breakdown,
        chartType: chartType || 'bar',
      },
    };
  }

  // ============================================================================
  // THLI-24 レベル評価ツール
  // ============================================================================

  /**
   * Assess habit level using THLI-24 framework
   * Requirements: 10.5, 10.6
   */
  private async assessHabitLevel(
    habitId?: string,
    habitName?: string
  ): Promise<Record<string, unknown>> {
    // Find habit by ID or name
    let habit;
    if (habitId) {
      habit = await this.habitRepo.getById(habitId);
    } else if (habitName) {
      const habits = await this.habitRepo.searchByName('user', this.userId, habitName, 1);
      habit = habits[0];
    }

    if (!habit) {
      return {
        error: true,
        message: habitName 
          ? `「${habitName}」という習慣が見つかりませんでした。`
          : '習慣が見つかりませんでした。習慣名を指定してください。',
      };
    }

    // Check quota first
    const quotaStatus = await this.usageQuotaService.checkQuota(this.userId);
    if (!quotaStatus.isUnlimited && quotaStatus.remaining <= 0) {
      return {
        error: true,
        message: '今月のTHLI-24評価回数の上限に達しました。',
        quotaStatus,
        upgradeRequired: true,
      };
    }

    try {
      // Initiate assessment
      const session = await this.thliAssessmentService.initiateAssessment(
        habit.id,
        this.userId
      );

      logger.info('THLI-24 assessment initiated', {
        userId: this.userId,
        habitId: habit.id,
        habitName: habit.name,
        sessionId: session.sessionId,
      });

      return {
        success: true,
        habitId: habit.id,
        habitName: habit.name,
        sessionId: session.sessionId,
        status: session.status,
        message: `「${habit.name}」のレベル評価を開始します。いくつかの質問に答えてください。`,
        firstQuestion: session.status === 'in_progress' 
          ? 'この習慣を実行するとき、具体的にどのような行動をしますか？（例：30分ジョギングする、10ページ読書する）'
          : undefined,
        quotaRemaining: quotaStatus.remaining - 1,
      };
    } catch (error) {
      logger.error('Failed to initiate THLI-24 assessment', error instanceof Error ? error : new Error(String(error)), {
        userId: this.userId,
        habitId: habit.id,
      });
      return {
        error: true,
        message: 'レベル評価の開始に失敗しました。しばらくしてからもう一度お試しください。',
      };
    }
  }

  /**
   * Suggest baby steps for a struggling habit
   * Requirements: 10.5
   */
  private async suggestBabySteps(
    habitId?: string,
    habitName?: string,
    targetLevel?: number
  ): Promise<Record<string, unknown>> {
    // Find habit by ID or name
    let habit;
    if (habitId) {
      habit = await this.habitRepo.getById(habitId);
    } else if (habitName) {
      const habits = await this.habitRepo.searchByName('user', this.userId, habitName, 1);
      habit = habits[0];
    }

    if (!habit) {
      return {
        error: true,
        message: habitName 
          ? `「${habitName}」という習慣が見つかりませんでした。`
          : '習慣が見つかりませんでした。習慣名を指定してください。',
      };
    }

    // Check if habit has level assessment
    if (habit.level === null || habit.level === undefined) {
      return {
        error: true,
        message: `「${habit.name}」はまだレベル評価されていません。先にレベル評価を行ってください。`,
        suggestion: 'assess_habit_level ツールを使用してレベル評価を行ってください。',
      };
    }

    try {
      // Get current assessment data
      const assessmentData = habit.level_assessment_data as LevelEstimate | null;
      if (!assessmentData) {
        return {
          error: true,
          message: '評価データが見つかりません。再度レベル評価を行ってください。',
        };
      }

      // Generate baby step plans
      const plans = await this.babyStepGeneratorService.generateBabySteps(
        habit.id,
        assessmentData
      );

      logger.info('Baby step plans generated', {
        userId: this.userId,
        habitId: habit.id,
        habitName: habit.name,
        currentLevel: habit.level,
        lv50Target: plans.lv50.targetLevel,
        lv10Target: plans.lv10.targetLevel,
      });

      return {
        success: true,
        habitId: habit.id,
        habitName: habit.name,
        currentLevel: habit.level,
        plans,
        message: `「${habit.name}」を簡略化するプランを2つ提案します。`,
        explanation: {
          lv50: `Lv.50プラン: 現在の約半分の負荷（レベル${plans.lv50.targetLevel}）に調整します。`,
          lv10: `Lv.10プラン: 最小限の習慣（レベル${plans.lv10.targetLevel}）に調整します。2分以内で完了できる形です。`,
        },
      };
    } catch (error) {
      logger.error('Failed to generate baby step plans', error instanceof Error ? error : new Error(String(error)), {
        userId: this.userId,
        habitId: habit.id,
      });
      return {
        error: true,
        message: 'ベビーステッププランの生成に失敗しました。',
      };
    }
  }

  /**
   * Suggest level up for a habit
   * Requirements: 10.5
   */
  private async suggestLevelUp(
    habitId?: string,
    habitName?: string
  ): Promise<Record<string, unknown>> {
    // Find habit by ID or name
    let habit;
    if (habitId) {
      habit = await this.habitRepo.getById(habitId);
    } else if (habitName) {
      const habits = await this.habitRepo.searchByName('user', this.userId, habitName, 1);
      habit = habits[0];
    }

    if (!habit) {
      return {
        error: true,
        message: habitName 
          ? `「${habitName}」という習慣が見つかりませんでした。`
          : '習慣が見つかりませんでした。習慣名を指定してください。',
      };
    }

    // Check if habit has level assessment
    if (habit.level === null || habit.level === undefined) {
      return {
        error: true,
        message: `「${habit.name}」はまだレベル評価されていません。先にレベル評価を行ってください。`,
      };
    }

    try {
      // Analyze completion rate
      const analysis = await this.analyzeHabits(30, [habit.id]);
      const habitAnalysis = analysis[0];

      if (!habitAnalysis) {
        return {
          error: true,
          message: '習慣の分析データが取得できませんでした。',
        };
      }

      // Check if eligible for level up
      if (habitAnalysis.completionRate < 0.9) {
        return {
          success: false,
          habitId: habit.id,
          habitName: habit.name,
          currentLevel: habit.level,
          completionRate: habitAnalysis.completionRate,
          message: `「${habit.name}」の達成率は${Math.round(habitAnalysis.completionRate * 100)}%です。レベルアップには90%以上の達成率が必要です。`,
          suggestion: '現在のレベルでもう少し継続してから、レベルアップを検討しましょう。',
        };
      }

      // Calculate target level (10-20% increase)
      const currentLevel = habit.level;
      const increasePercent = 0.15; // 15% increase
      const targetLevel = Math.min(199, Math.round(currentLevel * (1 + increasePercent)));

      // Generate workload changes
      const workloadChanges = {
        workloadPerCount: {
          old: habit.workload_per_count,
          new: Math.round(habit.workload_per_count * (1 + increasePercent)),
          changePercent: Math.round(increasePercent * 100),
        },
        targetCount: habit.target_count ? {
          old: habit.target_count,
          new: Math.round(habit.target_count * (1 + increasePercent * 0.5)),
          changePercent: Math.round(increasePercent * 50),
        } : undefined,
      };

      logger.info('Level up suggestion generated', {
        userId: this.userId,
        habitId: habit.id,
        habitName: habit.name,
        currentLevel,
        targetLevel,
        completionRate: habitAnalysis.completionRate,
      });

      return {
        success: true,
        habitId: habit.id,
        habitName: habit.name,
        currentLevel,
        targetLevel,
        completionRate: habitAnalysis.completionRate,
        workloadChanges,
        message: `「${habit.name}」は達成率${Math.round(habitAnalysis.completionRate * 100)}%で順調です！レベル${currentLevel}からレベル${targetLevel}へのレベルアップを提案します。`,
        explanation: `負荷を約${Math.round(increasePercent * 100)}%増やして、より挑戦的な習慣にします。`,
      };
    } catch (error) {
      logger.error('Failed to suggest level up', error instanceof Error ? error : new Error(String(error)), {
        userId: this.userId,
        habitId: habit?.id,
      });
      return {
        error: true,
        message: 'レベルアップ提案の生成に失敗しました。',
      };
    }
  }

  /**
   * Get habit level details
   * Requirements: 13.6
   */
  private async getHabitLevelDetails(
    habitId?: string,
    habitName?: string
  ): Promise<Record<string, unknown>> {
    // Find habit by ID or name
    let habit;
    if (habitId) {
      habit = await this.habitRepo.getById(habitId);
    } else if (habitName) {
      const habits = await this.habitRepo.searchByName('user', this.userId, habitName, 1);
      habit = habits[0];
    }

    if (!habit) {
      return {
        error: true,
        message: habitName 
          ? `「${habitName}」という習慣が見つかりませんでした。`
          : '習慣が見つかりませんでした。習慣名を指定してください。',
      };
    }

    // Check if habit has level assessment
    if (habit.level === null || habit.level === undefined) {
      return {
        habitId: habit.id,
        habitName: habit.name,
        level: null,
        levelTier: null,
        message: `「${habit.name}」はまだレベル評価されていません。`,
        suggestion: 'レベル評価を行うと、習慣の難易度を把握できます。',
      };
    }

    // Get level history
    const levelHistory = await this.levelManagerService.getLevelHistory(habit.id);

    return {
      habitId: habit.id,
      habitName: habit.name,
      level: habit.level,
      levelTier: habit.level_tier,
      assessmentData: habit.level_assessment_data,
      lastAssessedAt: habit.level_last_assessed_at,
      levelHistory: levelHistory.slice(0, 5), // Last 5 changes
      message: `「${habit.name}」のレベルは${habit.level}（${this.getTierNameJa(habit.level_tier)}）です。`,
    };
  }

  /**
   * Get tier name in Japanese
   */
  private getTierNameJa(tier: string | null): string {
    const tierNames: Record<string, string> = {
      beginner: '初級',
      intermediate: '中級',
      advanced: '上級',
      expert: 'エキスパート',
    };
    return tier ? tierNames[tier] || tier : '未評価';
  }

  /**
   * Get THLI-24 quota status
   * Requirements: 13.5
   */
  private async getTHLIQuotaStatus(): Promise<Record<string, unknown>> {
    try {
      const quotaStatus = await this.usageQuotaService.checkQuota(this.userId);

      return {
        ...quotaStatus,
        message: quotaStatus.isUnlimited
          ? 'プレミアムプランのため、THLI-24評価は無制限です。'
          : `今月の残り評価回数: ${quotaStatus.remaining}/${quotaStatus.quotaLimit}回`,
      };
    } catch (error) {
      logger.error('Failed to get THLI quota status', error instanceof Error ? error : new Error(String(error)), {
        userId: this.userId,
      });
      return {
        error: true,
        message: 'クォータ情報の取得に失敗しました。',
      };
    }
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
