/**
 * VOW AI Coach Agent
 *
 * Mastra Agentを使用したAI習慣コーチング機能を提供します。
 * ユーザーの習慣データを分析し、パーソナライズされたアドバイスを提供します。
 *
 * Features:
 * - analyze_habits: 習慣分析
 * - suggest_goals: 目標提案
 * - check_progress: 進捗確認
 * - generate_baby_steps: スモールステップ生成
 *
 * Requirements:
 * - B-005: VOW AI Coach エージェント
 * - マルチターン会話のメモリ保持
 * - クォータ制限 (Free: 10回/月, Premium: 無制限)
 *
 * @module agents/mastra/vow-coach-agent
 */

import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { getMastraConfig } from './config.js';
import { getPersonalizationEngine } from '../../services/personalizationEngine.js';
import { getSubscriptionService } from '../../services/subscriptionService.js';
import { getSessionStore, type SessionStore, type SessionOptions } from '../../services/session-store.js';
import { getLogger } from '../../utils/logger.js';
import { getSettings } from '../../config.js';
import type { UserContext } from '../../types/personalization.js';
import type { BabyStepPlan, LevelTier } from '../../types/thli.js';

// Import shared coach tools
import {
  // Schemas
  AnalyzeHabitsSchema,
  SuggestGoalsSchema,
  CheckProgressSchema,
  GenerateBabyStepsSchema,
  // Types
  type AnalyzeHabitsInput,
  type SuggestGoalsInput,
  type CheckProgressInput,
  type GenerateBabyStepsInput,
  type CoachToolContext,
  // Execution functions
  analyzeHabitsExecute,
  suggestGoalsExecute,
  checkProgressExecute,
  generateBabyStepsExecute,
} from '../shared-tools/index.js';

const logger = getLogger('vow-coach-agent');

// =============================================================================
// Constants
// =============================================================================

/** Free user monthly quota for coach interactions */
const FREE_USER_QUOTA = 10;

/** Quota type identifier for coach interactions */
const COACH_QUOTA_TYPE = 'coach_interactions';

// =============================================================================
// Types
// =============================================================================

/**
 * Message in the conversation
 */
export interface CoachMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  toolCalls?: ToolCallRecord[] | undefined;
}

/**
 * Tool call record
 */
export interface ToolCallRecord {
  toolName: string;
  input: unknown;
  output: unknown;
  success: boolean;
  durationMs: number;
}

/**
 * Coach session for multi-turn conversations
 */
export interface CoachSession {
  id: string;
  userId: string;
  messages: CoachMessage[];
  userContext?: UserContext;
  createdAt: Date;
  lastActivityAt: Date;
  quotaUsed: number;
}

/**
 * Coach execution context
 */
export interface CoachExecutionContext {
  userId: string;
  sessionId: string;
  supabase: SupabaseClient;
  locale?: 'ja' | 'en';
  userContext?: UserContext;
}

/**
 * Coach response
 */
export interface CoachResponse {
  message: string;
  toolCalls?: ToolCallRecord[];
  quotaRemaining?: number;
  suggestions?: string[];
}

/**
 * Quota check result
 */
export interface CoachQuotaResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  isUnlimited: boolean;
  message?: string;
}

// =============================================================================
// Tool Schemas (re-exported from shared-tools)
// =============================================================================

// Schemas and types are imported from shared-tools and re-exported below for backward compatibility
export {
  AnalyzeHabitsSchema,
  SuggestGoalsSchema,
  CheckProgressSchema,
  GenerateBabyStepsSchema,
  type AnalyzeHabitsInput,
  type SuggestGoalsInput,
  type CheckProgressInput,
  type GenerateBabyStepsInput,
} from '../shared-tools/index.js';

// =============================================================================
// System Prompt
// =============================================================================

/**
 * Generate system prompt based on locale and user context
 */
export function generateSystemPrompt(locale: 'ja' | 'en', userContext?: UserContext): string {
  const basePromptJa = `あなたはVOW（習慣・目標トラッカー）のAIコーチです。
ユーザーが習慣を身につけ、目標を達成するのを支援します。

## あなたの役割

1. **習慣分析**: ユーザーの習慣データを分析し、パターンや改善点を見つけます
2. **目標提案**: ユーザーに適した具体的で達成可能な目標を提案します
3. **進捗確認**: 習慣や目標の進捗状況を確認し、フィードバックを提供します
4. **スモールステップ**: 習慣を簡単に始められるよう、小さなステップを生成します

## コミュニケーションスタイル

- 励ましと支援的なトーンで話します
- 具体的で実行可能なアドバイスを提供します
- ユーザーの進捗を称え、小さな勝利も認めます
- 無理のないペースで習慣形成を促します
- 科学的根拠に基づいたアドバイスを心がけます

## 重要な原則

- ユーザーの現在のレベルに合わせたアドバイスを提供
- 一度に多くのことを要求しない
- 習慣スタッキング（既存の習慣に新しい習慣を紐づける）を活用
- 失敗を非難せず、再挑戦を励ます`;

  const basePromptEn = `You are the AI Coach for VOW (Habit & Goal Tracker).
You help users build habits and achieve their goals.

## Your Role

1. **Habit Analysis**: Analyze user habit data to find patterns and areas for improvement
2. **Goal Suggestions**: Suggest specific and achievable goals suited to the user
3. **Progress Check**: Check progress on habits and goals, providing feedback
4. **Baby Steps**: Generate small steps to make habits easier to start

## Communication Style

- Speak in an encouraging and supportive tone
- Provide specific and actionable advice
- Celebrate user progress and acknowledge small wins
- Encourage habit formation at a sustainable pace
- Base advice on scientific evidence

## Important Principles

- Provide advice suited to the user's current level
- Don't demand too much at once
- Utilize habit stacking (linking new habits to existing ones)
- Don't criticize failure, encourage retry`;

  const basePrompt = locale === 'ja' ? basePromptJa : basePromptEn;

  // Add user context if available
  if (userContext) {
    const contextSection = locale === 'ja'
      ? `\n\n## ユーザーコンテキスト

- アクティブな習慣数: ${userContext.activeHabitCount}
- 平均達成率: ${Math.round(userContext.averageCompletionRate * 100)}%
- ユーザーレベル: ${translateUserLevel(userContext.userLevel, 'ja')}
- 好みの頻度: ${userContext.preferredFrequency}
- 既存の習慣: ${userContext.existingHabitNames.slice(0, 5).join(', ')}${userContext.existingHabitNames.length > 5 ? ' ...' : ''}
- アンカー習慣: ${userContext.anchorHabits.map(h => h.habitName).join(', ') || 'なし'}`
      : `\n\n## User Context

- Active habits: ${userContext.activeHabitCount}
- Average completion rate: ${Math.round(userContext.averageCompletionRate * 100)}%
- User level: ${userContext.userLevel}
- Preferred frequency: ${userContext.preferredFrequency}
- Existing habits: ${userContext.existingHabitNames.slice(0, 5).join(', ')}${userContext.existingHabitNames.length > 5 ? ' ...' : ''}
- Anchor habits: ${userContext.anchorHabits.map(h => h.habitName).join(', ') || 'None'}`;

    return basePrompt + contextSection;
  }

  return basePrompt;
}

/**
 * Translate user level to localized string
 */
function translateUserLevel(level: string, locale: 'ja' | 'en'): string {
  if (locale === 'en') return level;

  const translations: Record<string, string> = {
    beginner: '初心者',
    intermediate: '中級者',
    advanced: '上級者',
  };
  return translations[level] || level;
}

// =============================================================================
// Coach Session Manager
// =============================================================================

/**
 * Get the session store instance.
 * Uses DynamoDB in production, in-memory for development.
 */
function getCoachSessionStore(): SessionStore {
  return getSessionStore();
}

/**
 * Get or create a coach session (async version using SessionStore)
 */
export async function getOrCreateSessionAsync(
  userId: string,
  sessionId?: string,
  options?: SessionOptions
): Promise<CoachSession> {
  const store = getCoachSessionStore();
  return store.getOrCreateSession(userId, sessionId, options);
}

/**
 * Get or create a coach session (sync wrapper for backward compatibility)
 * @deprecated Use getOrCreateSessionAsync instead for production use
 */
export function getOrCreateSession(userId: string, sessionId?: string): CoachSession {
  // For backward compatibility, create a new session synchronously
  // Note: This won't persist to DynamoDB - use getOrCreateSessionAsync for that
  const id = sessionId || `session_${userId}_${Date.now()}`;
  logger.warning('Using synchronous getOrCreateSession - consider using getOrCreateSessionAsync', {
    userId,
    sessionId: id,
  });

  return {
    id,
    userId,
    messages: [],
    createdAt: new Date(),
    lastActivityAt: new Date(),
    quotaUsed: 0,
  };
}

/**
 * Update session with new message (async version using SessionStore)
 */
export async function addMessageToSessionAsync(
  session: CoachSession,
  message: CoachMessage
): Promise<void> {
  const store = getCoachSessionStore();
  await store.addMessageToSession(session.id, session.userId, message);

  // Also update the local session object
  session.messages.push(message);
  session.lastActivityAt = new Date();
}

/**
 * Update session with new message (sync wrapper for backward compatibility)
 * @deprecated Use addMessageToSessionAsync instead for production use
 */
export function addMessageToSession(
  session: CoachSession,
  message: CoachMessage
): void {
  // Update local session object synchronously
  session.messages.push(message);
  session.lastActivityAt = new Date();

  // Fire-and-forget async save to SessionStore
  const store = getCoachSessionStore();
  store.addMessageToSession(session.id, session.userId, message).catch((error) => {
    logger.error('Failed to persist message to session store', error as Error, {
      sessionId: session.id,
      userId: session.userId,
    });
  });
}

/**
 * Save session to store
 */
export async function saveSession(
  session: CoachSession,
  options?: SessionOptions
): Promise<void> {
  const store = getCoachSessionStore();
  await store.saveSession(session, options);
}

/**
 * Get a session from store
 */
export async function getSession(
  sessionId: string,
  userId: string
): Promise<CoachSession | null> {
  const store = getCoachSessionStore();
  return store.getSession(sessionId, userId);
}

/**
 * Delete a session from store
 */
export async function deleteSession(
  sessionId: string,
  userId: string
): Promise<void> {
  const store = getCoachSessionStore();
  await store.deleteSession(sessionId, userId);
}

/**
 * List sessions for a user
 */
export async function listUserSessions(
  userId: string,
  limit?: number
): Promise<CoachSession[]> {
  const store = getCoachSessionStore();
  return store.listUserSessions(userId, limit);
}

/**
 * Get conversation history as a formatted string
 */
export function getConversationHistory(session: CoachSession): string {
  return session.messages
    .map(m => `${m.role}: ${m.content}`)
    .join('\n\n');
}

/**
 * Clear expired sessions (call periodically)
 * Only works with in-memory store; DynamoDB uses TTL for automatic cleanup
 */
export async function clearExpiredSessions(_maxAgeMs: number = 3600000): Promise<number> {
  const store = getCoachSessionStore();

  if (store.clearExpiredSessions) {
    return store.clearExpiredSessions();
  }

  // DynamoDB handles TTL automatically
  logger.debug('clearExpiredSessions called - DynamoDB uses TTL for automatic cleanup');
  return 0;
}

// =============================================================================
// Quota Management
// =============================================================================

/**
 * Check coach interaction quota for a user
 */
export async function checkCoachQuota(
  userId: string,
  supabase: SupabaseClient
): Promise<CoachQuotaResult> {
  try {
    const subscriptionService = getSubscriptionService(supabase);
    const isPremium = await subscriptionService.hasPremiumAccess(userId);

    if (isPremium) {
      return {
        allowed: true,
        remaining: -1,
        limit: -1,
        isUnlimited: true,
      };
    }

    // Get current month's usage from database
    const now = new Date();

    const { data, error } = await supabase
      .from('coach_interaction_quotas')
      .select('quota_used')
      .eq('user_id', userId)
      .gte('period_end', now.toISOString())
      .lte('period_start', now.toISOString())
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "no rows returned", which is fine for new users
      logger.error('Failed to check coach quota', error as Error, { userId });
      throw error;
    }

    const quotaUsed = data?.quota_used ?? 0;
    const remaining = FREE_USER_QUOTA - quotaUsed;

    if (remaining <= 0) {
      return {
        allowed: false,
        remaining: 0,
        limit: FREE_USER_QUOTA,
        isUnlimited: false,
        message: '今月のAIコーチ利用回数の上限に達しました。プレミアムプランにアップグレードすると無制限でご利用いただけます。',
      };
    }

    return {
      allowed: true,
      remaining,
      limit: FREE_USER_QUOTA,
      isUnlimited: false,
    };
  } catch (error) {
    logger.error('Error checking coach quota', error as Error, { userId });
    // Allow on error to avoid blocking users
    return {
      allowed: true,
      remaining: FREE_USER_QUOTA,
      limit: FREE_USER_QUOTA,
      isUnlimited: false,
    };
  }
}

/**
 * Consume one coach interaction from quota
 */
export async function consumeCoachQuota(
  userId: string,
  supabase: SupabaseClient
): Promise<void> {
  try {
    const subscriptionService = getSubscriptionService(supabase);
    const isPremium = await subscriptionService.hasPremiumAccess(userId);

    if (isPremium) {
      // Premium users don't consume quota
      return;
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Upsert quota record
    const { error } = await supabase.rpc('increment_coach_quota', {
      p_user_id: userId,
      p_period_start: monthStart.toISOString(),
      p_period_end: monthEnd.toISOString(),
    });

    if (error) {
      // Fallback to direct upsert if RPC doesn't exist
      const { error: upsertError } = await supabase
        .from('coach_interaction_quotas')
        .upsert({
          user_id: userId,
          quota_type: COACH_QUOTA_TYPE,
          quota_used: 1,
          quota_limit: FREE_USER_QUOTA,
          period_start: monthStart.toISOString(),
          period_end: monthEnd.toISOString(),
        }, {
          onConflict: 'user_id,period_start',
        });

      if (upsertError) {
        logger.warning('Failed to consume coach quota', { userId, error: upsertError.message });
      }
    }

    logger.info('Coach quota consumed', { userId });
  } catch (error) {
    logger.error('Error consuming coach quota', error as Error, { userId });
  }
}

// =============================================================================
// Tool Implementations (delegating to shared-tools)
// =============================================================================

/**
 * Convert CoachExecutionContext to CoachToolContext for shared tools
 */
function toToolContext(context: CoachExecutionContext): CoachToolContext {
  const toolContext: CoachToolContext = {
    userId: context.userId,
    sessionId: context.sessionId,
    supabase: context.supabase,
  };
  if (context.locale !== undefined) {
    toolContext.locale = context.locale;
  }
  if (context.userContext !== undefined) {
    toolContext.userContext = context.userContext;
  }
  return toolContext;
}

/**
 * Analyze user's habits
 * Delegates to shared tool implementation
 */
export async function analyzeHabits(
  input: AnalyzeHabitsInput,
  context: CoachExecutionContext
): Promise<{
  analysis: {
    habitId: string;
    habitName: string;
    completionRate: number;
    currentStreak: number;
    longestStreak: number;
    insights: string[];
  }[];
  summary: string;
}> {
  const startTime = Date.now();
  logger.info('Analyzing habits', { userId: context.userId, period: input.period });

  try {
    const result = await analyzeHabitsExecute(input, toToolContext(context));

    logger.info('Habit analysis completed', {
      userId: context.userId,
      habitCount: result.analysis.length,
      durationMs: Date.now() - startTime,
    });

    return result;
  } catch (error) {
    logger.error('Failed to analyze habits', error as Error, { userId: context.userId });
    throw error;
  }
}

/**
 * Suggest goals for the user
 * Delegates to shared tool implementation
 */
export async function suggestGoals(
  input: SuggestGoalsInput,
  context: CoachExecutionContext
): Promise<{
  suggestions: {
    name: string;
    description: string;
    category: string;
    difficulty: LevelTier;
    suggestedHabits: string[];
    rationale: string;
  }[];
}> {
  const startTime = Date.now();
  logger.info('Suggesting goals', { userId: context.userId, category: input.category });

  try {
    const result = await suggestGoalsExecute(input, toToolContext(context));

    logger.info('Goal suggestions generated', {
      userId: context.userId,
      count: result.suggestions.length,
      durationMs: Date.now() - startTime,
    });

    return result;
  } catch (error) {
    logger.error('Failed to suggest goals', error as Error, { userId: context.userId });
    throw error;
  }
}

/**
 * Check progress on habits or goals
 * Delegates to shared tool implementation
 */
export async function checkProgress(
  input: CheckProgressInput,
  context: CoachExecutionContext
): Promise<{
  progress: {
    entityId?: string;
    entityName?: string;
    completionRate: number;
    trend: 'improving' | 'stable' | 'declining';
    periodSummary: string;
  };
  encouragement: string;
}> {
  const startTime = Date.now();
  logger.info('Checking progress', { userId: context.userId, entityType: input.entityType });

  try {
    const result = await checkProgressExecute(input, toToolContext(context));

    logger.info('Progress check completed', {
      userId: context.userId,
      completionRate: result.progress.completionRate,
      trend: result.progress.trend,
      durationMs: Date.now() - startTime,
    });

    return result;
  } catch (error) {
    logger.error('Failed to check progress', error as Error, { userId: context.userId });
    throw error;
  }
}

/**
 * Generate baby steps for a habit
 * Delegates to shared tool implementation
 */
export async function generateBabySteps(
  input: GenerateBabyStepsInput,
  context: CoachExecutionContext
): Promise<{
  babySteps: BabyStepPlan;
  motivation: string;
}> {
  const startTime = Date.now();
  logger.info('Generating baby steps', { userId: context.userId, habitId: input.habitId });

  try {
    const result = await generateBabyStepsExecute(input, toToolContext(context));

    logger.info('Baby steps generated', {
      userId: context.userId,
      habitId: input.habitId,
      targetLevel: result.babySteps.targetLevel,
      durationMs: Date.now() - startTime,
    });

    return result;
  } catch (error) {
    logger.error('Failed to generate baby steps', error as Error, { userId: context.userId });
    throw error;
  }
}

// =============================================================================
// VOW Coach Agent
// =============================================================================

/**
 * Tool definition for the VOW Coach Agent
 */
export interface CoachTool {
  name: string;
  description: string;
  descriptionJa: string;
  inputSchema: z.ZodSchema;
  execute: (input: unknown, context: CoachExecutionContext) => Promise<unknown>;
}

/**
 * Available tools for the coach agent
 */
export const coachTools: CoachTool[] = [
  {
    name: 'analyze_habits',
    description: 'Analyze user habit patterns and completion rates. Provides insights and recommendations.',
    descriptionJa: 'ユーザーの習慣パターンと達成率を分析します。洞察と推奨事項を提供します。',
    inputSchema: AnalyzeHabitsSchema,
    execute: async (input: unknown, context: CoachExecutionContext) => {
      const parsed = AnalyzeHabitsSchema.parse(input);
      return analyzeHabits(parsed, context);
    },
  },
  {
    name: 'suggest_goals',
    description: 'Suggest personalized goals based on user context and preferences.',
    descriptionJa: 'ユーザーのコンテキストと好みに基づいて、パーソナライズされた目標を提案します。',
    inputSchema: SuggestGoalsSchema,
    execute: async (input: unknown, context: CoachExecutionContext) => {
      const parsed = SuggestGoalsSchema.parse(input);
      return suggestGoals(parsed, context);
    },
  },
  {
    name: 'check_progress',
    description: 'Check progress on habits or goals over a specified period.',
    descriptionJa: '指定期間における習慣や目標の進捗を確認します。',
    inputSchema: CheckProgressSchema,
    execute: async (input: unknown, context: CoachExecutionContext) => {
      const parsed = CheckProgressSchema.parse(input);
      return checkProgress(parsed, context);
    },
  },
  {
    name: 'generate_baby_steps',
    description: 'Generate simplified versions of habits to make them easier to start.',
    descriptionJa: '習慣を始めやすくするための簡略化バージョンを生成します。',
    inputSchema: GenerateBabyStepsSchema,
    execute: async (input: unknown, context: CoachExecutionContext) => {
      const parsed = GenerateBabyStepsSchema.parse(input);
      return generateBabySteps(parsed, context);
    },
  },
];

/**
 * VOW Coach Agent configuration
 */
export interface VowCoachAgentConfig {
  /** Model to use (defaults to Mastra config) */
  model?: string;
  /** Temperature for responses */
  temperature?: number;
  /** Maximum tokens for response */
  maxTokens?: number;
  /** Default locale */
  defaultLocale?: 'ja' | 'en';
}

/**
 * VOW Coach Agent class
 */
export class VowCoachAgent {
  private readonly config: Required<VowCoachAgentConfig>;
  private readonly tools: Map<string, CoachTool>;

  constructor(config: VowCoachAgentConfig = {}) {
    const mastraConfig = getMastraConfig();

    this.config = {
      model: config.model ?? mastraConfig.defaultModel,
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 2048,
      defaultLocale: config.defaultLocale ?? 'ja',
    };

    this.tools = new Map(coachTools.map(t => [t.name, t]));

    logger.info('VOW Coach Agent initialized', {
      model: this.config.model,
      toolCount: this.tools.size,
    });
  }

  /**
   * Get system prompt for the agent
   */
  getSystemPrompt(locale?: 'ja' | 'en', userContext?: UserContext): string {
    return generateSystemPrompt(locale ?? this.config.defaultLocale, userContext);
  }

  /**
   * Get available tools
   */
  getTools(): CoachTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tool by name
   */
  getTool(name: string): CoachTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Execute a tool
   */
  async executeTool<TInput, TOutput>(
    toolName: string,
    input: TInput,
    context: CoachExecutionContext
  ): Promise<TOutput> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    const startTime = Date.now();

    try {
      // Validate input
      const validatedInput = tool.inputSchema.parse(input);

      // Execute tool
      const result = await tool.execute(validatedInput, context) as TOutput;

      logger.info('Tool executed successfully', {
        toolName,
        userId: context.userId,
        durationMs: Date.now() - startTime,
      });

      return result;
    } catch (error) {
      logger.error('Tool execution failed', error as Error, {
        toolName,
        userId: context.userId,
      });
      throw error;
    }
  }

  /**
   * Process a user message with quota checking
   * Uses DynamoDB-backed session store for multi-process/server support
   */
  async processMessage(
    message: string,
    context: CoachExecutionContext
  ): Promise<CoachResponse> {
    // Check quota
    const quotaResult = await checkCoachQuota(context.userId, context.supabase);

    if (!quotaResult.allowed) {
      return {
        message: quotaResult.message ?? 'Quota exceeded',
        quotaRemaining: 0,
      };
    }

    // Get or create session (async, DynamoDB-backed)
    const session = await getOrCreateSessionAsync(context.userId, context.sessionId, {
      metadata: {
        agentType: 'coach',
        locale: context.locale,
      },
    });

    // Add user message to session
    const userMessage: CoachMessage = {
      role: 'user',
      content: message,
      timestamp: new Date(),
    };
    await addMessageToSessionAsync(session, userMessage);

    // Load user context if not provided
    if (!context.userContext) {
      const engine = getPersonalizationEngine(context.supabase);
      context.userContext = await engine.analyzeUserContext(context.userId);
      session.userContext = context.userContext;
    }

    // Generate response (placeholder - actual LLM integration would go here)
    const response = await this.generateResponse(message, session, context);

    // Consume quota
    await consumeCoachQuota(context.userId, context.supabase);
    session.quotaUsed++;

    // Add assistant message to session
    const assistantMessage: CoachMessage = {
      role: 'assistant',
      content: response.message,
      timestamp: new Date(),
    };
    if (response.toolCalls) {
      assistantMessage.toolCalls = response.toolCalls;
    }
    await addMessageToSessionAsync(session, assistantMessage);

    // Increment quota used in session store
    const store = getSessionStore();
    await store.incrementQuotaUsed(session.id, session.userId);

    return {
      ...response,
      quotaRemaining: quotaResult.isUnlimited ? -1 : quotaResult.remaining - 1,
    };
  }

  /**
   * Generate response using OpenAI LLM
   * Supports Manager Mode: messages prefixed with [Manager Mode] are handled
   * with orchestration-focused system prompt.
   */
  private async generateResponse(
    message: string,
    session: CoachSession,
    context: CoachExecutionContext
  ): Promise<CoachResponse> {
    const isJa = (context.locale ?? this.config.defaultLocale) === 'ja';
    const userContext = session.userContext ?? context.userContext;
    const settings = getSettings();

    // Check for Manager Mode
    const isManagerMode = message.startsWith('[Manager Mode]');
    const actualMessage = isManagerMode ? message.replace('[Manager Mode] ', '') : message;

    // Check if OpenAI is configured
    if (!settings.openaiApiKey) {
      logger.warning('OpenAI API key not configured, returning fallback response');
      return this.getFallbackResponse(isJa, userContext, session.messages.length, isManagerMode);
    }

    try {
      // Initialize OpenAI client
      const openai = new OpenAI({ apiKey: settings.openaiApiKey });

      // Build system prompt - use manager prompt for Manager Mode
      const systemPrompt = isManagerMode
        ? this.getManagerSystemPrompt(context.locale, userContext)
        : this.getSystemPrompt(context.locale, userContext);

      // Build messages array from session history
      const messages: ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
      ];

      // Add conversation history (last 10 messages)
      const historyMessages = session.messages.slice(-10);
      for (const msg of historyMessages) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          // Clean up Manager Mode prefix from history if present
          let content = msg.content;
          if (msg.role === 'user' && content.startsWith('[Manager Mode] ')) {
            content = content.replace('[Manager Mode] ', '');
          }
          messages.push({
            role: msg.role,
            content,
          });
        }
      }

      // Add current message if not already in history
      const lastMessage = historyMessages[historyMessages.length - 1];
      if (!lastMessage || lastMessage.content !== message || lastMessage.role !== 'user') {
        messages.push({ role: 'user', content: actualMessage });
      }

      logger.info('Calling OpenAI for coach response', {
        userId: context.userId,
        sessionId: context.sessionId,
        model: this.config.model,
        messageCount: messages.length,
        isManagerMode,
      });

      // Call OpenAI
      const response = await openai.chat.completions.create({
        model: this.config.model,
        messages,
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
      });

      const choice = response.choices[0];
      if (!choice?.message?.content) {
        logger.warning('Empty response from OpenAI');
        return this.getFallbackResponse(isJa, userContext, session.messages.length, isManagerMode);
      }

      const responseMessage = choice.message.content;

      logger.info('OpenAI response received', {
        userId: context.userId,
        sessionId: context.sessionId,
        tokensUsed: response.usage?.total_tokens ?? 0,
        isManagerMode,
      });

      // Generate suggestions based on response and mode
      const suggestions = isManagerMode
        ? this.generateManagerSuggestions(isJa)
        : this.generateSuggestions(isJa, responseMessage);

      return {
        message: responseMessage,
        suggestions,
      };
    } catch (error) {
      logger.error('OpenAI API call failed', error as Error, {
        userId: context.userId,
        sessionId: context.sessionId,
        isManagerMode,
      });
      return this.getFallbackResponse(isJa, userContext, session.messages.length, isManagerMode);
    }
  }

  /**
   * Generate system prompt for Manager Mode
   */
  private getManagerSystemPrompt(locale?: 'ja' | 'en', userContext?: UserContext): string {
    const isJa = (locale ?? this.config.defaultLocale) === 'ja';

    const managerPromptJa = `あなたはVOW（習慣・目標トラッカー）のマネージャーエージェントです。
ユーザーのリクエストを理解し、適切なエージェントに作業を委譲します。

## あなたの役割

1. **タスク管理**: ユーザーのリクエストを分析し、タスクとして整理
2. **エージェント調整**: 適切なエージェント（AI Coach、開発者など）に作業を委譲
3. **進捗報告**: タスクの進捗状況を報告
4. **統括**: 複数のエージェントの連携を管理

## コミュニケーションスタイル

- 明確で簡潔な指示を出す
- 進捗状況を定期的に報告
- 問題が発生した場合は速やかに報告
- ユーザーの意図を正確に理解する

## 利用可能なリソース

- AI Coach: 習慣形成と目標達成のアドバイス
- タスクシステム: タスクの作成と管理
- 分析ツール: 習慣データの分析`;

    const managerPromptEn = `You are the Manager Agent for VOW (Habit & Goal Tracker).
You understand user requests and delegate work to appropriate agents.

## Your Role

1. **Task Management**: Analyze user requests and organize them as tasks
2. **Agent Coordination**: Delegate work to appropriate agents (AI Coach, developers, etc.)
3. **Progress Reporting**: Report on task progress
4. **Orchestration**: Manage coordination between multiple agents

## Communication Style

- Give clear and concise instructions
- Report progress regularly
- Report problems promptly when they occur
- Accurately understand user intent

## Available Resources

- AI Coach: Advice on habit formation and goal achievement
- Task System: Task creation and management
- Analysis Tools: Habit data analysis`;

    let prompt = isJa ? managerPromptJa : managerPromptEn;

    // Add user context if available
    if (userContext) {
      const contextSection = isJa
        ? `\n\n## ユーザーコンテキスト

- アクティブな習慣数: ${userContext.activeHabitCount}
- 平均達成率: ${Math.round(userContext.averageCompletionRate * 100)}%`
        : `\n\n## User Context

- Active habits: ${userContext.activeHabitCount}
- Average completion rate: ${Math.round(userContext.averageCompletionRate * 100)}%`;

      prompt += contextSection;
    }

    return prompt;
  }

  /**
   * Generate suggestions for Manager Mode
   */
  private generateManagerSuggestions(isJa: boolean): string[] {
    return isJa
      ? ['タスク一覧を見せて', '進捗状況を教えて', 'AIコーチに相談したい', '習慣を分析して']
      : ['Show task list', 'Report progress', 'Consult AI Coach', 'Analyze my habits'];
  }

  /**
   * Get fallback response when OpenAI is not available
   */
  private getFallbackResponse(
    isJa: boolean,
    userContext: UserContext | undefined,
    messageCount: number,
    isManagerMode: boolean = false
  ): CoachResponse {
    // Manager Mode fallback
    if (isManagerMode) {
      if (messageCount <= 2) {
        return {
          message: isJa
            ? `こんにちは！VOWマネージャーです。${userContext ? `${userContext.activeHabitCount}個の習慣を管理中です。` : ''}タスクの管理やエージェントの調整をお手伝いします。何をお手伝いしましょうか？`
            : `Hello! I'm your VOW Manager. ${userContext ? `Managing ${userContext.activeHabitCount} habits. ` : ''}I can help with task management and agent coordination. What can I help you with?`,
          suggestions: this.generateManagerSuggestions(isJa),
        };
      }
      return {
        message: isJa
          ? 'かしこまりました。どのようなタスクを実行しましょうか？'
          : 'Understood. What task would you like me to execute?',
        suggestions: this.generateManagerSuggestions(isJa),
      };
    }

    // First message - welcome
    if (messageCount <= 2) {
      return {
        message: isJa
          ? `こんにちは！VOWのAIコーチです。${userContext ? `${userContext.activeHabitCount}個の習慣を追跡中ですね。` : ''}習慣形成や目標達成をサポートします。何かお手伝いできることはありますか？`
          : `Hello! I'm your VOW AI Coach. ${userContext ? `You're tracking ${userContext.activeHabitCount} habits. ` : ''}I'm here to support your habit formation and goal achievement. How can I help you?`,
        suggestions: isJa
          ? ['習慣を分析してほしい', '新しい目標を提案してほしい', '進捗を確認したい']
          : ['Analyze my habits', 'Suggest new goals', 'Check my progress'],
      };
    }

    // Default response
    return {
      message: isJa
        ? 'ご質問ありがとうございます。習慣や目標についてお気軽にご相談ください。'
        : 'Thank you for your question. Feel free to ask about your habits or goals.',
    };
  }

  /**
   * Generate contextual suggestions based on response
   */
  private generateSuggestions(isJa: boolean, _response: string): string[] {
    // Default suggestions
    return isJa
      ? ['習慣の達成状況を教えて', '目標に向けたアドバイスをください', '今日やるべきことは？']
      : ['Show my habit progress', 'Give me advice for my goals', 'What should I do today?'];
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

let vowCoachAgentInstance: VowCoachAgent | null = null;

/**
 * Get or create the VOW Coach Agent singleton
 */
export function getVowCoachAgent(config?: VowCoachAgentConfig): VowCoachAgent {
  if (!vowCoachAgentInstance) {
    vowCoachAgentInstance = new VowCoachAgent(config);
  }
  return vowCoachAgentInstance;
}

/**
 * Reset the VOW Coach Agent instance (useful for testing)
 */
export function resetVowCoachAgent(): void {
  vowCoachAgentInstance = null;
}

// =============================================================================
// Exports
// =============================================================================

export {
  generateSystemPrompt as getCoachSystemPrompt,
  checkCoachQuota as checkQuota,
  consumeCoachQuota as consumeQuota,
};
