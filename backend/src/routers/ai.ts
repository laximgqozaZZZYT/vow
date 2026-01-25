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
// AICoachService is imported dynamically in the chat endpoint
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
 * Conversational AI endpoint with Function Calling.
 * AI can autonomously call tools to analyze habits, get workload data,
 * and provide personalized coaching advice.
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
    const userId = user.sub;

    try {
      const supabase = getSupabaseClient();
      const tokenManager = getTokenManager(supabase);

      // Check token quota (estimate higher for function calling)
      await tokenManager.requireQuota(userId, 3000);

      // Use the new AI Coach Service with Function Calling
      const { createAICoachService } = await import('../services/aiCoachService.js');
      const coachService = createAICoachService(supabase, userId);

      if (!coachService.isAvailable()) {
        throw new AIServiceError('AIサービスが利用できません', AIErrorCode.PROVIDER_ERROR);
      }

      // Process with function calling
      const result = await coachService.chat(message, conversationHistory || []);

      // Record token usage
      await tokenManager.recordUsage(userId, 'ai_chat', result.tokensUsed);

      // Log admin action if applicable
      await logAdminAIAction(c, 'ai_chat', {
        inputMessage: message.substring(0, 100),
        toolsUsed: result.toolsUsed,
        tokensUsed: result.tokensUsed,
      });

      // Get remaining tokens
      const usage = await tokenManager.getUsage(userId);

      logger.info('AI coach response generated', {
        userId,
        toolsUsed: result.toolsUsed,
        tokensUsed: result.tokensUsed,
        hasGoalSuggestions: !!result.data?.goalSuggestions,
        goalSuggestionsCount: result.data?.goalSuggestions?.length,
      });

      return c.json({
        response: result.message,
        toolsUsed: result.toolsUsed,
        data: result.data,
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

export { aiRouter };
