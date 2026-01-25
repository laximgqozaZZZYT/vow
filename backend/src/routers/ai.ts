/**
 * AI Router
 *
 * API endpoints for AI-powered habit parsing and editing.
 * Requires Premium subscription.
 *
 * Requirements: 3.1, 3.6, 4.1
 */

import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { getSupabaseClient } from '../utils/supabase.js';
import { getNLHabitParser } from '../services/nlHabitParser.js';
import { getSubscriptionService } from '../services/subscriptionService.js';
import { getLogger } from '../utils/logger.js';
import type { AuthContext } from '../middleware/auth.js';
import { z } from 'zod';
import {
  ParseHabitRequestSchema,
  EditHabitRequestSchema,
  AIServiceError,
  AIErrorCode,
} from '../schemas/ai.js';
import { getAIHabitSuggester } from '../services/aiHabitSuggester.js';
import { GoalRepository } from '../repositories/goalRepository.js';
import { HabitRepository } from '../repositories/habitRepository.js';
import { getTokenManager, QuotaExceededError, PremiumRequiredError } from '../services/tokenManager.js';
import { getAdminService } from '../services/adminService.js';

const logger = getLogger('aiRouter');

// Create router
const aiRouter = new Hono<{ Variables: AuthContext }>();

/**
 * Premium access middleware.
 * Checks if user has premium subscription or is admin.
 * Admins bypass subscription check and token quota enforcement.
 * All admin AI operations are logged to audit log.
 *
 * Requirements: 13.2, 13.3
 */
async function requirePremium(c: Context<{ Variables: AuthContext }>, next: Next): Promise<Response | void> {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const userId = user.sub;
  const userEmail = user.email?.toLowerCase() ?? '';
  const supabase = getSupabaseClient();
  const adminService = getAdminService(supabase);

  // Check for admin access first
  const isAdmin = await adminService.isAdmin(userId, userEmail);

  if (isAdmin) {
    // Set admin flag in context for downstream handlers
    c.set('isAdmin' as any, true);
    
    // Log admin action (will be completed after request)
    const action = `ai_${c.req.path.split('/').pop()}`;
    const ipAddress = c.req.header('x-forwarded-for') || c.req.header('x-real-ip');
    const userAgent = c.req.header('user-agent');
    
    // Store context for audit logging after response
    c.set('adminAuditContext' as any, {
      action,
      ipAddress,
      userAgent,
    });
    
    await next();
    return;
  }

  // Check premium subscription for non-admin users
  const subscriptionService = getSubscriptionService(supabase);
  const hasPremium = await subscriptionService.hasPremiumAccess(userId);
  
  if (!hasPremium) {
    return c.json(
      {
        error: 'PREMIUM_REQUIRED',
        message: 'この機能はPremiumプランでのみ利用可能です',
        upgradeUrl: '/settings/subscription',
      },
      402
    );
  }

  c.set('isAdmin' as any, false);
  await next();
}

/**
 * Helper to log admin actions after AI operations
 */
async function logAdminAIAction(
  c: Context<{ Variables: AuthContext }>,
  action: string,
  details: Record<string, any>
): Promise<void> {
  const isAdmin = c.get('isAdmin' as any);
  if (!isAdmin) return;

  const user = c.get('user');
  if (!user) return;

  const userId = user.sub;
  const supabase = getSupabaseClient();
  const adminService = getAdminService(supabase);

  const ipAddress = c.req.header('x-forwarded-for') || c.req.header('x-real-ip');
  const userAgent = c.req.header('user-agent');

  // Build context object only with defined values
  const context: { ipAddress?: string; userAgent?: string } = {};
  if (ipAddress) context.ipAddress = ipAddress;
  if (userAgent) context.userAgent = userAgent;

  await adminService.logAdminAction(userId, action, details, context);
}


/**
 * POST /api/ai/parse-habit
 * Parse natural language text to habit data.
 *
 * Requirements: 3.1, 3.6
 */
aiRouter.post(
  '/parse-habit',
  requirePremium,
  zValidator('json', ParseHabitRequestSchema),
  async (c: Context<{ Variables: AuthContext }>) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const text = body.text as string;
    const context = body.context as { existingGoals?: Array<{ id: string; name: string }> } | undefined;

    try {
      const supabase = getSupabaseClient();
      const parser = getNLHabitParser(supabase);

      // Get user's existing goals if not provided
      let parseContext = context;
      if (!parseContext?.existingGoals) {
        const goals = await parser.getUserGoals(user.sub);
        parseContext = {
          ...parseContext,
          existingGoals: goals,
        };
      }

      const result = await parser.parse(user.sub, text, parseContext);

      // Log admin action if applicable
      await logAdminAIAction(c, 'ai_parse_habit', {
        inputText: text.substring(0, 100),
        tokensUsed: result.tokensUsed,
        parsedName: result.parsed.name,
      });

      logger.info('Habit parsed successfully', {
        userId: user.sub,
        tokensUsed: result.tokensUsed,
      });

      return c.json({
        parsed: result.parsed,
        tokensUsed: result.tokensUsed,
        remainingTokens: result.remainingTokens,
      });
    } catch (err) {
      if (err instanceof AIServiceError) {
        const status = err.code === AIErrorCode.QUOTA_EXCEEDED ? 429 : 503;
        return c.json(
          {
            error: err.code,
            message: err.message,
            retryAfter: err.retryAfter,
            upgradeUrl: err.code === AIErrorCode.QUOTA_EXCEEDED ? '/settings/subscription' : undefined,
          },
          status
        );
      }
      logger.error('Parse habit error', err instanceof Error ? err : undefined);
      return c.json({ error: 'PARSE_FAILED', message: 'AI処理中にエラーが発生しました' }, 500);
    }
  }
);

/**
 * POST /api/ai/edit-habit
 * Parse edit command from natural language text.
 *
 * Requirements: 4.1
 */
aiRouter.post(
  '/edit-habit',
  requirePremium,
  zValidator('json', EditHabitRequestSchema),
  async (c: Context<{ Variables: AuthContext }>) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const text = body.text as string;

    try {
      const supabase = getSupabaseClient();
      const parser = getNLHabitParser(supabase);

      // Get user's existing habits
      const existingHabits = await parser.getUserHabits(user.sub);

      if (existingHabits.length === 0) {
        return c.json(
          {
            error: 'NO_HABITS',
            message: '編集可能な習慣がありません',
          },
          400
        );
      }

      const result = await parser.parseEdit(user.sub, text, existingHabits);

      // Log admin action if applicable
      await logAdminAIAction(c, 'ai_edit_habit', {
        inputText: text.substring(0, 100),
        tokensUsed: result.tokensUsed,
        targetHabitId: result.targetHabitId,
        targetHabitName: result.targetHabitName,
      });

      logger.info('Edit command parsed successfully', {
        userId: user.sub,
        tokensUsed: result.tokensUsed,
        targetHabitId: result.targetHabitId,
      });

      return c.json({
        targetHabitId: result.targetHabitId,
        targetHabitName: result.targetHabitName,
        candidates: result.candidates,
        changes: result.changes,
        tokensUsed: result.tokensUsed,
        remainingTokens: result.remainingTokens,
        confidence: result.confidence,
      });
    } catch (err) {
      if (err instanceof AIServiceError) {
        const status = err.code === AIErrorCode.QUOTA_EXCEEDED ? 429 : 503;
        return c.json(
          {
            error: err.code,
            message: err.message,
            retryAfter: err.retryAfter,
            upgradeUrl: err.code === AIErrorCode.QUOTA_EXCEEDED ? '/settings/subscription' : undefined,
          },
          status
        );
      }
      logger.error('Edit habit error', err instanceof Error ? err : undefined);
      return c.json({ error: 'PARSE_FAILED', message: 'AI処理中にエラーが発生しました' }, 500);
    }
  }
);

/**
 * Request schema for habit suggestion.
 */
const SuggestHabitsRequestSchema = z.object({
  goalId: z.string().uuid(),
});

/**
 * POST /api/ai/suggest-habits
 * Suggest habits for a goal using AI.
 *
 * Requirements: 11.1, 11.4, 11.5
 */
aiRouter.post(
  '/suggest-habits',
  requirePremium,
  zValidator('json', SuggestHabitsRequestSchema),
  async (c: Context<{ Variables: AuthContext }>) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const goalId = body.goalId as string;
    const userId = user.sub;

    try {
      const supabase = getSupabaseClient();
      const goalRepo = new GoalRepository(supabase);
      const habitRepo = new HabitRepository(supabase);
      const tokenManager = getTokenManager(supabase);
      const suggester = getAIHabitSuggester();

      // Get the goal
      const goal = await goalRepo.getById(goalId);
      if (!goal) {
        return c.json({ error: 'GOAL_NOT_FOUND', message: 'ゴールが見つかりません' }, 404);
      }

      // Verify goal belongs to user
      if (goal.owner_id !== userId) {
        return c.json({ error: 'FORBIDDEN', message: 'このゴールにアクセスする権限がありません' }, 403);
      }

      // Check token quota (estimate ~1500 tokens for suggestion)
      const estimatedTokens = 1500;
      await tokenManager.requireQuota(userId, estimatedTokens);

      // Get user's existing habits to avoid duplicates
      const existingHabits = await habitRepo.getByOwner('user', userId, true);

      // Generate suggestions
      const result = await suggester.suggestHabitsForGoal(goal, existingHabits);

      // Record token usage
      await tokenManager.recordUsage(userId, 'ai_habit_suggestion', result.tokensUsed);

      // Log admin action if applicable
      await logAdminAIAction(c, 'ai_suggest_habits', {
        goalId,
        goalName: goal.name,
        suggestionsCount: result.suggestions.length,
        tokensUsed: result.tokensUsed,
      });

      // Get remaining tokens
      const usage = await tokenManager.getUsage(userId);

      logger.info('Habit suggestions generated', {
        userId,
        goalId,
        suggestionsCount: result.suggestions.length,
        tokensUsed: result.tokensUsed,
      });

      return c.json({
        suggestions: result.suggestions,
        tokensUsed: result.tokensUsed,
        remainingTokens: usage.monthlyQuota - usage.usedQuota,
      });
    } catch (err) {
      if (err instanceof QuotaExceededError) {
        return c.json(
          {
            error: 'QUOTA_EXCEEDED',
            message: err.message,
            resetAt: err.resetAt,
            upgradeUrl: '/settings/subscription',
          },
          429
        );
      }
      if (err instanceof PremiumRequiredError) {
        return c.json(
          {
            error: 'PREMIUM_REQUIRED',
            message: err.message,
            upgradeUrl: '/settings/subscription',
          },
          402
        );
      }
      if (err instanceof AIServiceError) {
        const status = err.code === AIErrorCode.QUOTA_EXCEEDED ? 429 : 503;
        return c.json(
          {
            error: err.code,
            message: err.message,
            retryAfter: err.retryAfter,
          },
          status
        );
      }
      logger.error('Suggest habits error', err instanceof Error ? err : undefined);
      return c.json({ error: 'SUGGESTION_FAILED', message: 'AI処理中にエラーが発生しました' }, 500);
    }
  }
);

/**
 * Request schema for AI chat.
 */
const ChatRequestSchema = z.object({
  message: z.string().min(1).max(1000),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).optional(),
  context: z.object({
    goals: z.array(z.object({
      id: z.string(),
      name: z.string(),
    })).optional(),
    habits: z.array(z.object({
      id: z.string(),
      name: z.string(),
      completionRate: z.number().optional(),
    })).optional(),
  }).optional(),
});

/**
 * POST /api/ai/chat
 * Conversational AI endpoint that understands intent and responds appropriately.
 * Can ask follow-up questions, provide coaching, or help create/edit habits.
 */
aiRouter.post(
  '/chat',
  requirePremium,
  zValidator('json', ChatRequestSchema),
  async (c: Context<{ Variables: AuthContext }>) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const message = body.message as string;
    const conversationHistory = body.conversationHistory as Array<{ role: 'user' | 'assistant'; content: string }> | undefined;
    const context = body.context as { goals?: Array<{ id: string; name: string }>; habits?: Array<{ id: string; name: string; completionRate?: number }> } | undefined;
    const userId = user.sub;

    try {
      const supabase = getSupabaseClient();
      const tokenManager = getTokenManager(supabase);
      const habitRepo = new HabitRepository(supabase);
      const goalRepo = new GoalRepository(supabase);

      // Check token quota
      await tokenManager.requireQuota(userId, 2000);

      // Get user's habits and goals if not provided
      let userHabits: Array<{ id: string; name: string; completionRate?: number }> = context?.habits || [];
      let userGoals: Array<{ id: string; name: string }> = context?.goals || [];

      if (userHabits.length === 0) {
        const habits = await habitRepo.getByOwner('user', userId, true);
        userHabits = habits.map(h => ({
          id: h.id,
          name: h.name,
        }));
      }

      if (userGoals.length === 0) {
        const goals = await goalRepo.getByOwner('user', userId);
        userGoals = goals.map(g => ({
          id: g.id,
          name: g.name,
        }));
      }

      // Build conversation context for AI
      const systemPrompt = buildChatSystemPrompt(userHabits, userGoals);
      const messages = buildChatMessages(systemPrompt, conversationHistory || [], message);

      // Call OpenAI
      const { getAIService } = await import('../services/aiService.js');
      const aiService = getAIService();
      
      if (!aiService.isAvailable()) {
        throw new AIServiceError('AIサービスが利用できません', AIErrorCode.PROVIDER_ERROR);
      }

      const OpenAI = (await import('openai')).default;
      const { getSettings } = await import('../config.js');
      const settings = getSettings();
      
      const openai = new OpenAI({ apiKey: settings.openaiApiKey });
      
      const completion = await openai.chat.completions.create({
        model: settings.openaiModel || 'gpt-4o-mini',
        messages,
        temperature: 0.7,
        max_tokens: 1000,
        response_format: { type: 'json_object' },
      });

      const responseContent = completion.choices[0]?.message?.content || '{}';
      const tokensUsed = completion.usage?.total_tokens || 0;

      // Record token usage
      await tokenManager.recordUsage(userId, 'ai_chat', tokensUsed);

      // Parse AI response
      const aiResponse = JSON.parse(responseContent) as {
        intent: 'create_habit' | 'edit_habit' | 'suggest' | 'coaching' | 'question' | 'general';
        response: string;
        followUpQuestion?: string;
        habitData?: Record<string, unknown>;
        suggestions?: Array<Record<string, unknown>>;
        confidence: number;
      };

      // Log admin action if applicable
      await logAdminAIAction(c, 'ai_chat', {
        inputMessage: message.substring(0, 100),
        intent: aiResponse.intent,
        tokensUsed,
      });

      // Get remaining tokens
      const usage = await tokenManager.getUsage(userId);

      logger.info('AI chat response generated', {
        userId,
        intent: aiResponse.intent,
        tokensUsed,
      });

      return c.json({
        intent: aiResponse.intent,
        response: aiResponse.response,
        followUpQuestion: aiResponse.followUpQuestion,
        habitData: aiResponse.habitData,
        suggestions: aiResponse.suggestions,
        confidence: aiResponse.confidence,
        tokensUsed,
        remainingTokens: usage.monthlyQuota - usage.usedQuota,
      });
    } catch (err) {
      if (err instanceof QuotaExceededError) {
        return c.json(
          {
            error: 'QUOTA_EXCEEDED',
            message: err.message,
            resetAt: err.resetAt,
            upgradeUrl: '/settings/subscription',
          },
          429
        );
      }
      if (err instanceof AIServiceError) {
        return c.json(
          {
            error: err.code,
            message: err.message,
          },
          503
        );
      }
      logger.error('AI chat error', err instanceof Error ? err : undefined);
      return c.json({ error: 'CHAT_FAILED', message: 'AI処理中にエラーが発生しました' }, 500);
    }
  }
);

/**
 * Build system prompt for chat.
 */
function buildChatSystemPrompt(
  habits: Array<{ id: string; name: string; completionRate?: number }>,
  goals: Array<{ id: string; name: string }>
): string {
  const habitsInfo = habits.length > 0
    ? habits.map(h => `- ${h.name}${h.completionRate !== undefined ? ` (達成率: ${Math.round(h.completionRate * 100)}%)` : ''}`).join('\n')
    : '（習慣なし）';

  const goalsInfo = goals.length > 0
    ? goals.map(g => `- ${g.name}`).join('\n')
    : '（ゴールなし）';

  return `あなたは習慣管理アプリのAIコーチです。ユーザーの習慣形成をサポートします。

ユーザーの現在の習慣:
${habitsInfo}

ユーザーのゴール:
${goalsInfo}

あなたの役割:
1. ユーザーの意図を理解し、適切に応答する
2. 相談や悩みには共感し、具体的な質問で深堀りする
3. 習慣作成の依頼には詳細を確認してから提案する
4. 達成率が低い習慣については原因を一緒に考える

応答は必ず以下のJSON形式で返してください:
{
  "intent": "create_habit" | "edit_habit" | "suggest" | "coaching" | "question" | "general",
  "response": "ユーザーへの応答メッセージ（自然な日本語で）",
  "followUpQuestion": "深堀りのための質問（必要な場合）",
  "habitData": { 習慣データ（intent=create_habitの場合のみ） },
  "suggestions": [ 提案リスト（intent=suggestの場合のみ） ],
  "confidence": 0.0-1.0
}

intentの判定基準:
- create_habit: 具体的な習慣を作りたい（時間、頻度、内容が明確）
- edit_habit: 既存の習慣を変更したい
- suggest: 習慣の提案を求めている
- coaching: 相談、悩み、分析、見直し、改善したい
- question: 情報が不足しており、詳細を聞く必要がある
- general: その他の一般的な会話

重要:
- 「〜したい」「〜を見直したい」「達成率が低い」などは coaching として扱う
- 具体的な習慣内容が不明確な場合は question として詳細を聞く
- いきなり習慣を作成せず、まず理解を深める質問をする`;
}

/**
 * Build chat messages array for OpenAI.
 */
function buildChatMessages(
  systemPrompt: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  currentMessage: string
): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt },
  ];

  // Add conversation history (limit to last 10 messages)
  const recentHistory = history.slice(-10);
  for (const msg of recentHistory) {
    messages.push({ role: msg.role, content: msg.content });
  }

  // Add current message
  messages.push({ role: 'user', content: currentMessage });

  return messages;
}

export { aiRouter };
