/**
 * Query Classifier - Analyze user queries to determine appropriate routing
 *
 * Classifies queries into categories:
 * - coding: Programming, development, code review, debugging
 * - habit: Habit creation, tracking, management
 * - goal: Goal setting, planning, progress tracking
 * - general: General questions, chat
 *
 * @module services/query-classifier
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger('services.query-classifier');

/**
 * Query category types
 */
export type QueryCategory = 'coding' | 'habit' | 'goal' | 'general';

/**
 * Agent types that can handle queries
 */
export type RelevantAgent = 'habit-coach' | 'goal-planner' | 'progress-tracker' | 'coding-assistant';

/**
 * Classification result
 */
export interface ClassificationResult {
  category: QueryCategory;
  confidence: number;
  relevantAgents: RelevantAgent[];
  suggestedProvider: 'openai' | 'anthropic' | 'gemini' | 'codex';
  keywords: string[];
}

/**
 * Keyword patterns for each category
 */
const CATEGORY_PATTERNS: Record<QueryCategory, RegExp[]> = {
  coding: [
    // Programming languages
    /\b(javascript|typescript|python|java|rust|go|ruby|php|swift|kotlin|c\+\+|c#)\b/i,
    // Frameworks and tools
    /\b(react|vue|angular|next\.?js|node|express|django|flask|rails|spring|docker|kubernetes|git|github)\b/i,
    // Development actions
    /\b(code|coding|program|develop|debug|fix|bug|error|compile|build|deploy|test|refactor)\b/i,
    /\b(function|class|method|variable|module|component|api|endpoint|database|query|sql)\b/i,
    /\b(実装|コード|プログラム|開発|デバッグ|バグ|エラー|コンパイル|ビルド|デプロイ|テスト|リファクタ)\b/i,
    /\b(関数|クラス|メソッド|変数|モジュール|コンポーネント|データベース|クエリ)\b/i,
    // Code snippets
    /```[\s\S]*```/,
    /\bimport\s+.*from\b/,
    /\bconst\s+\w+\s*=/,
    /\bfunction\s+\w+\s*\(/,
  ],
  habit: [
    // Habit-related terms
    /\b(habit|routine|daily|weekly|morning|evening|streak|track|tracking)\b/i,
    /\b(習慣|ルーティン|毎日|毎週|朝|夜|継続|追跡|トラッキング)\b/i,
    // Habit actions
    /\b(start|begin|create|add|new|set up|establish)\s+(a\s+)?(habit|routine)/i,
    /\b(習慣を|ルーティンを)(作|始|追加|設定)/i,
    // Habit management
    /\b(complete|finish|done|check|mark|miss|skip)\s+(habit|routine|task)/i,
    /\b(習慣|タスク)(完了|達成|スキップ|忘)/i,
    // VOW/Coaching specific terms
    /\b(vow|Vow|VOW)\b/,
    /\b(coach|coaching|アドバイス|提案|おすすめ)\b/i,
    /\b(level|レベル|tier|ティア|beginner|intermediate|advanced|expert)\b/i,
    /\b(baby\s*step|スモールステップ|小さな一歩)\b/i,
    // Wellness and self-improvement
    /\b(health|wellness|exercise|meditation|睡眠|運動|瞑想|健康)\b/i,
    /\b(productivity|生産性|効率|時間管理)\b/i,
  ],
  goal: [
    // Goal-related terms
    /\b(goal|objective|target|milestone|achievement|progress)\b/i,
    /\b(目標|ゴール|目的|マイルストーン|達成|進捗)\b/i,
    // Goal actions
    /\b(set|create|plan|achieve|reach|accomplish)\s+(a\s+)?(goal|target)/i,
    /\b(目標を|ゴールを)(設定|作|達成|計画)/i,
    // Planning
    /\b(plan|planning|roadmap|timeline|deadline|schedule)\b/i,
    /\b(計画|プラン|ロードマップ|タイムライン|締切|スケジュール)\b/i,
  ],
  general: [
    // General conversation
    /\b(hello|hi|hey|thanks|thank you|help|question)\b/i,
    /\b(こんにちは|ありがとう|助けて|質問|教えて)\b/i,
  ],
};

/**
 * Provider recommendations based on category
 */
const CATEGORY_PROVIDERS: Record<QueryCategory, 'openai' | 'anthropic' | 'gemini' | 'codex'> = {
  coding: 'codex',      // Codex/o-series for coding tasks
  habit: 'openai',      // OpenAI for habit coaching
  goal: 'openai',       // OpenAI for goal planning
  general: 'openai',    // OpenAI for general chat
};

/**
 * Agent mapping based on category
 */
const CATEGORY_AGENTS: Record<QueryCategory, RelevantAgent[]> = {
  coding: ['coding-assistant'],
  habit: ['habit-coach', 'progress-tracker'],
  goal: ['goal-planner', 'progress-tracker'],
  general: ['habit-coach', 'goal-planner'], // Default to habit/goal agents
};

/**
 * Classify a query to determine its category and routing
 */
export function classifyQuery(query: string): ClassificationResult {
  const scores: Record<QueryCategory, number> = {
    coding: 0,
    habit: 0,
    goal: 0,
    general: 0,
  };
  const matchedKeywords: string[] = [];

  // Score each category based on pattern matches
  for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS) as [QueryCategory, RegExp[]][]) {
    for (const pattern of patterns) {
      const matches = query.match(pattern);
      if (matches) {
        scores[category] += pattern.flags.includes('i') ? 1 : 2; // Exact case matches score higher
        matchedKeywords.push(...matches);
      }
    }
  }

  // Determine the winning category
  let maxScore = 0;
  let category: QueryCategory = 'general';
  for (const [cat, score] of Object.entries(scores) as [QueryCategory, number][]) {
    if (score > maxScore) {
      maxScore = score;
      category = cat;
    }
  }

  // Calculate confidence (0-1)
  const totalScore = Object.values(scores).reduce((sum, s) => sum + s, 0);
  const confidence = totalScore > 0 ? maxScore / totalScore : 0.5;

  // If no strong match, default to general
  if (maxScore === 0) {
    category = 'general';
  }

  const result: ClassificationResult = {
    category,
    confidence,
    relevantAgents: CATEGORY_AGENTS[category],
    suggestedProvider: CATEGORY_PROVIDERS[category],
    keywords: [...new Set(matchedKeywords)].slice(0, 5), // Unique keywords, max 5
  };

  logger.debug('Query classified', {
    queryPreview: query.slice(0, 50),
    category,
    confidence,
    relevantAgents: result.relevantAgents,
  });

  return result;
}

/**
 * Check if a query is primarily about coding
 */
export function isCodingQuery(query: string): boolean {
  const result = classifyQuery(query);
  return result.category === 'coding' && result.confidence > 0.3;
}

/**
 * Check if a query is about habits or goals
 */
export function isHabitOrGoalQuery(query: string): boolean {
  const result = classifyQuery(query);
  return (result.category === 'habit' || result.category === 'goal') && result.confidence > 0.3;
}

/**
 * Get the relevant agents for a query
 */
export function getRelevantAgents(query: string): RelevantAgent[] {
  const result = classifyQuery(query);
  return result.relevantAgents;
}

/**
 * Get the suggested AI provider for a query
 */
export function getSuggestedProvider(query: string): 'openai' | 'anthropic' | 'gemini' | 'codex' {
  const result = classifyQuery(query);
  return result.suggestedProvider;
}

export default {
  classifyQuery,
  isCodingQuery,
  isHabitOrGoalQuery,
  getRelevantAgents,
  getSuggestedProvider,
};
