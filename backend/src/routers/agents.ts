/**
 * Agents Router
 *
 * Unified API endpoints for AI agents including:
 * - VowCoachAgent chat (Mastra)
 * - TaskOrchestratorAgent task creation (Strands)
 * - Agent status monitoring
 * - Workflow execution (habit-analysis, goal-achievement)
 *
 * Requirements: B-005, B-006, B-007, B-008
 *
 * @module routers/agents
 */

import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { streamSSE } from 'hono/streaming';
import { getSupabaseClient } from '../utils/supabase.js';
import { getLogger } from '../utils/logger.js';
import type { AuthContext } from '../middleware/auth.js';
import { getSubscriptionService } from '../services/subscriptionService.js';
import { getAdminService } from '../services/adminService.js';
import { PersonalizationEngine } from '../services/personalizationEngine.js';

// Agent imports
import {
  getVowCoachAgent,
  checkCoachQuota,
  generateSystemPrompt as generateCoachSystemPrompt,
  type CoachExecutionContext,
  type CoachResponse,
} from '../agents/mastra/vow-coach-agent.js';
import {
  getTaskOrchestratorAgent,
  type CreateTaskInput,
  type McpTask,
  type DashboardStats,
} from '../agents/strands/task-orchestrator.js';

// Mastra Multi-Agent imports
import {
  managerAgent,
  habitCoachAgent,
  goalPlannerAgent,
  progressTrackerAgent,
} from '../agents/mastra/agents/index.js';
import { getMultiAgentResponse } from '../agents/mastra/agents/manager-agent.js';
import type { MultiAgentResponse } from '../agents/mastra/agents/types.js';

// Workflow imports
import {
  executeHabitAnalysis,
  executeGoalAchievementWorkflow,
  type HabitAnalysisOutput,
  type GoalAchievementInput,
  type GoalAchievementWorkflowResult,
  GoalAchievementInputSchema,
} from '../agents/mastra/workflows/index.js';
import {
  getOpenAIApiKey,
  getOpenAIModel,
  getProviderApiKey,
  getProviderModel,
  getAvailableProviders,
  type CredentialType,
} from '../services/credentials-store.js';
import { FREE_USER_CONFIG } from '../config/llm-config.js';
import {
  classifyQuery,
} from '../services/query-classifier.js';
import {
  getActiveMcpServer,
  callMcpChat,
} from '../services/mcp-settings-service.js';
import {
  checkChatRateLimit,
  incrementChatUsage,
} from '../services/rateLimitService.js';

const logger = getLogger('agentsRouter');

// =============================================================================
// Request/Response Schemas
// =============================================================================

/**
 * Chat request schema
 */
const ChatRequestSchema = z.object({
  message: z.string().min(1).max(2000)
    .describe('User message to the coach'),
  sessionId: z.string().optional()
    .describe('Session ID for multi-turn conversations'),
  locale: z.enum(['ja', 'en']).default('ja')
    .describe('Response language'),
  streaming: z.boolean().default(false)
    .describe('Whether to use SSE streaming'),
});

type ChatRequest = z.infer<typeof ChatRequestSchema>;

/**
 * Multi-Agent Chat request schema
 */
const MultiAgentChatRequestSchema = z.object({
  message: z.string().min(1).max(2000)
    .describe('User message to the multi-agent system'),
  sessionId: z.string().optional()
    .describe('Session ID for multi-turn conversations'),
  locale: z.enum(['ja', 'en']).default('ja')
    .describe('Response language'),
  includeAgents: z.array(z.enum(['habit-coach', 'goal-planner', 'progress-tracker'])).optional()
    .describe('Specific agents to query (defaults to smart routing)'),
  streaming: z.boolean().default(false)
    .describe('Whether to use SSE streaming'),
  aiProvider: z.enum(['openai', 'anthropic', 'gemini', 'codex', 'auto']).optional().default('auto')
    .describe('AI provider to use (auto = smart selection based on query)'),
  smartRouting: z.boolean().optional().default(true)
    .describe('Enable smart routing to only query relevant agents'),
  managerOnly: z.boolean().optional().default(false)
    .describe('Use manager only mode - no specialist agents unless explicitly needed'),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).optional()
    .describe('Previous conversation history for context-aware routing'),
  previousIntent: z.enum(['habit_related', 'goal_related', 'progress_related', 'general', 'mixed']).optional()
    .describe('Previous conversation intent to maintain context'),
});

type MultiAgentChatRequest = z.infer<typeof MultiAgentChatRequestSchema>;

/**
 * Task creation request schema
 */
const CreateTaskRequestSchema = z.object({
  title: z.string().min(1).max(200)
    .describe('Task title'),
  description: z.string().max(2000).optional()
    .describe('Task description'),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium')
    .describe('Task priority'),
  assignTo: z.string().uuid().optional()
    .describe('Agent ID to assign the task to'),
});

type CreateTaskRequest = z.infer<typeof CreateTaskRequestSchema>;

/**
 * Workflow execution request schema
 */
const WorkflowRequestSchema = z.object({
  params: z.record(z.unknown())
    .describe('Workflow parameters'),
});

type WorkflowRequest = z.infer<typeof WorkflowRequestSchema>;

// =============================================================================
// Middleware
// =============================================================================

/**
 * Premium/Admin access middleware for agents.
 * Checks if user has premium subscription or is admin.
 * Admin check is done first to avoid requiring Stripe for admin users.
 */
async function requirePremiumOrAdmin(
  c: Context<{ Variables: AuthContext }>,
  next: Next
): Promise<Response | void> {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const userId = user.sub;
  const userEmail = user.email?.toLowerCase() ?? '';
  const supabase = getSupabaseClient();
  const adminService = getAdminService(supabase);

  // Check for admin access first (before subscription check to avoid Stripe dependency)
  const isAdmin = await adminService.isAdmin(userId, userEmail);
  if (isAdmin) {
    // Set admin flag in context for downstream handlers
    c.set('isAdmin' as any, true);
    logger.info('Admin access granted', { userId, userEmail });
    await next();
    return;
  }

  // Check premium subscription for non-admin users
  // This requires STRIPE_SECRET_KEY to be configured
  try {
    const subscriptionService = getSubscriptionService(supabase);
    const hasPremium = await subscriptionService.hasPremiumAccess(userId);

    if (!hasPremium) {
      return c.json(
        {
          error: 'PREMIUM_REQUIRED',
          message: 'この機能はPremiumプランでのみ利用可能です',
          message_en: 'This feature is only available with Premium plan',
          upgradeUrl: '/settings/subscription',
        },
        402
      );
    }

    c.set('isAdmin' as any, false);
    await next();
  } catch (error) {
    // If Stripe is not configured, deny access for non-admin users
    logger.warning('Subscription check failed, denying access', {
      userId,
      error: (error as Error).message,
    });
    return c.json(
      {
        error: 'PREMIUM_REQUIRED',
        message: 'この機能はPremiumプランでのみ利用可能です',
        message_en: 'This feature is only available with Premium plan',
        upgradeUrl: '/settings/subscription',
      },
      402
    );
  }
}

/**
 * Auth middleware that allows free users with rate limiting.
 * - Guest (unauthenticated) → 401
 * - Admin → bypass all limits
 * - Premium → bypass rate limits
 * - Free user → rate limit check (5/day)
 *
 * Sets context variables: isAdmin, isPremium (both as `any` to match existing pattern)
 */
async function requireAuthWithRateLimit(
  c: Context<{ Variables: AuthContext }>,
  next: Next
): Promise<Response | void> {
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
    c.set('isAdmin' as any, true);
    c.set('isPremium' as any, true);
    logger.info('Admin access granted (rate limit bypass)', { userId });
    await next();
    return;
  }

  // Check premium subscription
  let isPremium = false;
  try {
    const subscriptionService = getSubscriptionService(supabase);
    isPremium = await subscriptionService.hasPremiumAccess(userId);
  } catch (error) {
    logger.warning('Subscription check failed, treating as free user', {
      userId,
      error: (error as Error).message,
    });
  }

  if (isPremium) {
    c.set('isAdmin' as any, false);
    c.set('isPremium' as any, true);
    await next();
    return;
  }

  // Free user - check rate limit
  const ipAddress = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
  const rateLimitResult = await checkChatRateLimit(supabase, userId, ipAddress, false);

  if (!rateLimitResult.allowed) {
    const messages: Record<string, string> = {
      daily_limit: '本日のAIチャット利用回数（5回）の上限に達しました。明日また利用できます。',
      total_limit: 'AIチャットの累計利用回数の上限に達しました。Premiumプランへのアップグレードをご検討ください。',
      ip_limit: 'このIPアドレスからの利用上限に達しました。',
    };
    return c.json(
      {
        error: 'RATE_LIMIT_EXCEEDED',
        message: messages[rateLimitResult.reason!] || 'Rate limit exceeded',
        remaining: rateLimitResult.remaining,
        current: rateLimitResult.current,
        upgradeUrl: '/settings/subscription',
      },
      429
    );
  }

  c.set('isAdmin' as any, false);
  c.set('isPremium' as any, false);
  logger.info('Free user access granted with rate limit', {
    userId,
    remaining: rateLimitResult.remaining,
  });
  await next();
}

// =============================================================================
// Router
// =============================================================================

const agentsRouter = new Hono<{ Variables: AuthContext }>();

/**
 * POST /api/agents/chat
 *
 * Chat with VOW Coach Agent.
 * Supports both JSON response and SSE streaming.
 * Free users can use this with rate limiting (5/day).
 *
 * Requirements: B-005
 */
agentsRouter.post(
  '/chat',
  requireAuthWithRateLimit,
  zValidator('json', ChatRequestSchema),
  async (c: Context<{ Variables: AuthContext }>) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = c.req.valid('json' as never) as ChatRequest;
    const userId = user.sub;

    logger.info('Chat request received', {
      userId,
      sessionId: body.sessionId,
      locale: body.locale,
      streaming: body.streaming,
      messageLength: body.message.length,
    });

    try {
      const supabase = getSupabaseClient();

      // Check quota
      const quotaResult = await checkCoachQuota(userId, supabase);
      if (!quotaResult.allowed) {
        return c.json(
          {
            error: 'QUOTA_EXCEEDED',
            message: quotaResult.message,
            quotaRemaining: 0,
            quotaLimit: quotaResult.limit,
          },
          429
        );
      }

      const coachAgent = getVowCoachAgent();

      // Get user context for personalization (ISS-20260204-019)
      const personalizationEngine = new PersonalizationEngine(supabase);
      const userContext = await personalizationEngine.analyzeUserContext(userId);

      // Create execution context with userContext
      const executionContext: CoachExecutionContext = {
        userId,
        sessionId: body.sessionId ?? `session_${userId}_${Date.now()}`,
        supabase,
        locale: body.locale,
        userContext,
      };

      // SSE streaming response
      if (body.streaming) {
        return streamSSE(c, async (stream) => {
          try {
            // Send initial event
            await stream.writeSSE({
              event: 'start',
              data: JSON.stringify({ sessionId: executionContext.sessionId }),
            });

            // Process message
            const response = await coachAgent.processMessage(
              body.message,
              executionContext
            );

            // Send response chunks (simulated streaming for now)
            const words = response.message.split(' ');
            for (let i = 0; i < words.length; i++) {
              await stream.writeSSE({
                event: 'token',
                data: JSON.stringify({ token: words[i] + ' ', index: i }),
              });
            }

            // Send completion event
            // Debug: Log toolCalls details before sending
            logger.info('SSE complete event - toolCalls details', {
              userId,
              hasToolCalls: !!(response.toolCalls && response.toolCalls.length > 0),
              toolCallCount: response.toolCalls?.length ?? 0,
              toolNames: response.toolCalls?.map(tc => tc.toolName),
              toolCallOutputs: response.toolCalls?.map(tc => ({
                toolName: tc.toolName,
                hasOutput: tc.output !== null && tc.output !== undefined,
                outputType: typeof tc.output,
                outputKeys: tc.output && typeof tc.output === 'object' ? Object.keys(tc.output as object) : [],
                // Check for suggestions specifically
                hasSuggestions: tc.output && typeof tc.output === 'object' && 'suggestions' in (tc.output as object),
                suggestionsCount: tc.output && typeof tc.output === 'object' && Array.isArray((tc.output as Record<string, unknown>)['suggestions'])
                  ? ((tc.output as Record<string, unknown>)['suggestions'] as unknown[]).length : 0,
              })),
            });
            await stream.writeSSE({
              event: 'complete',
              data: JSON.stringify({
                message: response.message,
                toolCalls: response.toolCalls,
                quotaRemaining: response.quotaRemaining,
                suggestions: response.suggestions,
              }),
            });

            // Increment usage for free users after successful chat
            const isPremiumSSE = c.get('isPremium' as any);
            if (!isPremiumSSE) {
              const ipAddr = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
              await incrementChatUsage(supabase, userId, ipAddr);
            }
          } catch (error) {
            await stream.writeSSE({
              event: 'error',
              data: JSON.stringify({
                error: 'CHAT_ERROR',
                message: (error as Error).message,
              }),
            });
          }
        });
      }

      // JSON response
      logger.info('Processing chat (JSON mode)', {
        userId,
        sessionId: executionContext.sessionId,
        sessionIdSource: body.sessionId ? 'client' : 'generated',
        messagePreview: body.message.substring(0, 50),
      });
      const response: CoachResponse = await coachAgent.processMessage(
        body.message,
        executionContext
      );

      // Increment usage for free users after successful chat
      const isPremium = c.get('isPremium' as any);
      if (!isPremium) {
        const ipAddr = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
        await incrementChatUsage(supabase, userId, ipAddr);
      }

      logger.info('Chat response generated', {
        userId,
        sessionId: executionContext.sessionId,
        hasToolCalls: !!(response.toolCalls && response.toolCalls.length > 0),
        quotaRemaining: response.quotaRemaining,
      });

      return c.json({
        message: response.message,
        sessionId: executionContext.sessionId,
        toolCalls: response.toolCalls,
        quotaRemaining: response.quotaRemaining,
        suggestions: response.suggestions,
      });
    } catch (error) {
      logger.error('Chat error', error as Error, { userId });
      return c.json(
        {
          error: 'CHAT_FAILED',
          message: 'AI処理中にエラーが発生しました',
          message_en: 'An error occurred during AI processing',
        },
        500
      );
    }
  }
);

/**
 * POST /api/agents/multi-chat
 *
 * Chat with Mastra Multi-Agent System.
 * Manager agent coordinates responses from multiple specialized agents.
 * Free users can use this with rate limiting (5/day).
 *
 * Requirements: B-005, Multi-Agent System
 */
agentsRouter.post(
  '/multi-chat',
  requireAuthWithRateLimit,
  zValidator('json', MultiAgentChatRequestSchema),
  async (c: Context<{ Variables: AuthContext }>) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = c.req.valid('json' as never) as MultiAgentChatRequest;
    const userId = user.sub;

    // Classify query for smart routing
    const classification = classifyQuery(body.message);

    logger.info('Multi-agent chat request received', {
      userId,
      sessionId: body.sessionId,
      locale: body.locale,
      includeAgents: body.includeAgents,
      messageLength: body.message.length,
      queryCategory: classification.category,
      suggestedProvider: classification.suggestedProvider,
      relevantAgents: classification.relevantAgents,
      smartRouting: body.smartRouting,
    });

    try {
      const supabase = getSupabaseClient();

      // Check quota
      const quotaResult = await checkCoachQuota(userId, supabase);
      if (!quotaResult.allowed) {
        return c.json(
          {
            error: 'QUOTA_EXCEEDED',
            message: quotaResult.message,
            quotaRemaining: 0,
            quotaLimit: quotaResult.limit,
          },
          429
        );
      }

      // ISS-20260204-019: Get user context for personalization (existing goals/habits)
      const personalizationEngine = new PersonalizationEngine(supabase);
      const userContext = await personalizationEngine.analyzeUserContext(userId);

      // Determine which AI provider to use
      const selectedProvider: CredentialType = body.aiProvider === 'auto'
        ? classification.suggestedProvider
        : body.aiProvider as CredentialType;

      // Get user's API key for the selected provider
      const userApiKey = await getProviderApiKey(selectedProvider, userId);
      const userModel = await getProviderModel(selectedProvider, userId);

      // Track if using shared key for free users
      let effectiveApiKey: string | null = userApiKey;
      let effectiveModel: string = userModel || 'gpt-4o';

      if (!userApiKey) {
        // Try fallback to OpenAI if the selected provider isn't configured
        const fallbackKey = await getOpenAIApiKey(userId);
        if (fallbackKey) {
          effectiveApiKey = fallbackKey;
          // Check if user has their own OpenAI key, or using shared key
          const store = await import('../services/credentials-store.js').then(m => m.getCredentialsStore());
          const userOpenAIKey = await store.getApiKey(userId, 'openai');
          if (!userOpenAIKey) {
            // User doesn't have their own key, using shared key - use free user config
            effectiveModel = FREE_USER_CONFIG.model;
            logger.info('Free user using shared API key', { userId, model: effectiveModel, usingSharedKey: true });
          } else {
            effectiveModel = await getOpenAIModel(userId);
          }
        } else {
          // No API key available at all
          return c.json(
            {
              error: 'API_KEY_REQUIRED',
              message: `${selectedProvider}のAPIキーが設定されていません。設定画面からAPIキーを登録してください。`,
              message_en: `${selectedProvider} API key is not configured. Please set up your API key in settings.`,
              settingsUrl: '/settings',
              suggestedProvider: selectedProvider,
              availableProviders: await getAvailableProviders(userId),
            },
            400
          );
        }
      }

      // SSE streaming response
      if (body.streaming) {
        return streamSSE(c, async (stream) => {
          try {
            const sessionId = body.sessionId ?? `session_${userId}_${Date.now()}`;

            // Send initial event
            await stream.writeSSE({
              event: 'start',
              data: JSON.stringify({ sessionId }),
            });

            // Get agents to query using smart routing
            let agentsToQuery: ('habit-coach' | 'goal-planner' | 'progress-tracker')[];

            if (body.includeAgents) {
              // Use explicitly specified agents
              agentsToQuery = body.includeAgents;
            } else if (body.smartRouting !== false) {
              // Smart routing: only query relevant agents based on classification
              const relevantAgents = classification.relevantAgents;
              agentsToQuery = relevantAgents.filter(
                (a): a is 'habit-coach' | 'goal-planner' | 'progress-tracker' =>
                  ['habit-coach', 'goal-planner', 'progress-tracker'].includes(a)
              );

              // Ensure at least one agent is queried
              if (agentsToQuery.length === 0) {
                agentsToQuery = ['habit-coach', 'goal-planner'];
              }

              logger.info('Smart routing selected agents', {
                queryCategory: classification.category,
                selectedAgents: agentsToQuery,
              });
            } else {
              // No smart routing: query all agents
              agentsToQuery = ['habit-coach', 'goal-planner', 'progress-tracker'];
            }

            // Send agent processing events
            for (const agentId of agentsToQuery) {
              await stream.writeSSE({
                event: 'agent_start',
                data: JSON.stringify({ agentId, status: 'processing' }),
              });
            }

            // Get multi-agent response with user's API key and conversation context
            // ISS-20260204-019: Include existing goals/habits for duplicate prevention
            const response = await getMultiAgentResponse(body.message, userId, {
              ...(body.managerOnly ? {} : { includeAgents: agentsToQuery }),
              locale: body.locale,
              openaiApiKey: effectiveApiKey!,
              openaiModel: effectiveModel,
              managerOnly: body.managerOnly,
              existingGoalNames: userContext.existingGoalNames,
              existingHabitNames: userContext.existingHabitNames,
              ...(body.sessionId || body.previousIntent || body.conversationHistory ? {
                conversationContext: {
                  ...(body.sessionId && { sessionId: body.sessionId }),
                  ...(body.previousIntent && { previousIntent: body.previousIntent }),
                  ...(body.conversationHistory && { conversationHistory: body.conversationHistory }),
                },
              } : {}),
            });

            // Send individual agent responses
            for (const agentResponse of response.responses) {
              await stream.writeSSE({
                event: 'agent_response',
                data: JSON.stringify({
                  agentId: agentResponse.agentId,
                  agentName: agentResponse.agentName,
                  content: agentResponse.content,
                  toolCalls: agentResponse.toolCalls,
                  toolResults: agentResponse.toolResults,
                  durationMs: agentResponse.durationMs,
                }),
              });
            }

            // Send summary from Manager
            await stream.writeSSE({
              event: 'summary',
              data: JSON.stringify({
                summary: response.summary,
                totalDurationMs: response.totalDurationMs,
              }),
            });

            // Send completion event
            await stream.writeSSE({
              event: 'complete',
              data: JSON.stringify({
                sessionId,
                responseCount: response.responses.length,
                timestamp: response.timestamp,
              }),
            });

            // Increment usage for free users after successful chat
            const isPremiumSSE = c.get('isPremium' as any);
            if (!isPremiumSSE) {
              const ipAddr = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
              await incrementChatUsage(supabase, userId, ipAddr);
            }
          } catch (error) {
            await stream.writeSSE({
              event: 'error',
              data: JSON.stringify({
                error: 'MULTI_CHAT_ERROR',
                message: (error as Error).message,
              }),
            });
          }
        });
      }

      // JSON response with smart routing
      let jsonAgentsToQuery: ('habit-coach' | 'goal-planner' | 'progress-tracker')[];

      if (body.includeAgents) {
        jsonAgentsToQuery = body.includeAgents;
      } else if (body.smartRouting !== false) {
        // Smart routing for JSON response
        const relevantAgents = classification.relevantAgents;
        jsonAgentsToQuery = relevantAgents.filter(
          (a): a is 'habit-coach' | 'goal-planner' | 'progress-tracker' =>
            ['habit-coach', 'goal-planner', 'progress-tracker'].includes(a)
        );
        if (jsonAgentsToQuery.length === 0) {
          jsonAgentsToQuery = ['habit-coach', 'goal-planner'];
        }
      } else {
        jsonAgentsToQuery = ['habit-coach', 'goal-planner', 'progress-tracker'];
      }

      // ISS-20260204-019: Include existing goals/habits for duplicate prevention
      const options: {
        includeAgents?: ('habit-coach' | 'goal-planner' | 'progress-tracker')[];
        locale?: 'ja' | 'en';
        openaiApiKey?: string;
        openaiModel?: string;
        managerOnly?: boolean;
        existingGoalNames?: string[];
        existingHabitNames?: string[];
        conversationContext?: {
          sessionId?: string;
          previousIntent?: 'habit_related' | 'goal_related' | 'progress_related' | 'general' | 'mixed';
          conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
        };
      } = {
        locale: body.locale,
        openaiApiKey: effectiveApiKey!,
        openaiModel: effectiveModel,
        includeAgents: jsonAgentsToQuery,
        managerOnly: body.managerOnly,
        existingGoalNames: userContext.existingGoalNames,
        existingHabitNames: userContext.existingHabitNames,
        ...(body.sessionId || body.previousIntent || body.conversationHistory ? {
          conversationContext: {
            ...(body.sessionId && { sessionId: body.sessionId }),
            ...(body.previousIntent && { previousIntent: body.previousIntent }),
            ...(body.conversationHistory && { conversationHistory: body.conversationHistory }),
          },
        } : {}),
      };

      const response: MultiAgentResponse = await getMultiAgentResponse(body.message, userId, options);

      // Increment usage for free users after successful chat
      const isPremium = c.get('isPremium' as any);
      if (!isPremium) {
        const ipAddr = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
        await incrementChatUsage(supabase, userId, ipAddr);
      }

      logger.info('Multi-agent chat response generated', {
        userId,
        responseCount: response.responses.length,
        totalDurationMs: response.totalDurationMs,
      });

      return c.json({
        query: response.query,
        responses: response.responses.map((r) => ({
          agentId: r.agentId,
          agentName: r.agentName,
          content: r.content,
          toolCalls: r.toolCalls,
          toolResults: r.toolResults,
          timestamp: r.timestamp,
          durationMs: r.durationMs,
        })),
        summary: response.summary,
        timestamp: response.timestamp,
        totalDurationMs: response.totalDurationMs,
        // Include classification info for transparency
        classification: {
          category: classification.category,
          confidence: classification.confidence,
          queriedAgents: jsonAgentsToQuery,
          usedProvider: selectedProvider,
        },
      });
    } catch (error) {
      logger.error('Multi-agent chat error', error as Error, { userId });
      return c.json(
        {
          error: 'MULTI_CHAT_FAILED',
          message: 'マルチエージェント処理中にエラーが発生しました',
          message_en: 'An error occurred during multi-agent processing',
        },
        500
      );
    }
  }
);

/**
 * GET /api/agents/multi-agents
 *
 * Get list of available Mastra multi-agents and their status.
 */
agentsRouter.get(
  '/multi-agents',
  requirePremiumOrAdmin,
  async (c: Context<{ Variables: AuthContext }>) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    logger.info('Multi-agents list request', { userId: user.sub });

    const agents = [
      {
        id: managerAgent.id,
        name: managerAgent.name,
        role: 'manager',
        description: 'マルチエージェントシステムの統括',
        capabilities: ['query_analysis', 'response_aggregation', 'task_delegation'],
        status: 'active',
      },
      {
        id: habitCoachAgent.id,
        name: habitCoachAgent.name,
        role: 'specialist',
        description: '習慣形成と維持のエキスパート',
        capabilities: ['habit_analysis', 'habit_suggestions', 'baby_steps'],
        status: 'active',
      },
      {
        id: goalPlannerAgent.id,
        name: goalPlannerAgent.name,
        role: 'specialist',
        description: '目標設定とマイルストーン管理',
        capabilities: ['smart_goals', 'milestone_breakdown', 'prioritization'],
        status: 'active',
      },
      {
        id: progressTrackerAgent.id,
        name: progressTrackerAgent.name,
        role: 'specialist',
        description: '進捗追跡と分析',
        capabilities: ['progress_analysis', 'completion_prediction', 'report_generation'],
        status: 'active',
      },
    ];

    return c.json({
      agents,
      count: agents.length,
      systemStatus: 'operational',
    });
  }
);

/**
 * POST /api/agents/tasks
 *
 * Create a new task using TaskOrchestratorAgent.
 *
 * Requirements: B-008
 */
agentsRouter.post(
  '/tasks',
  requirePremiumOrAdmin,
  zValidator('json', CreateTaskRequestSchema),
  async (c: Context<{ Variables: AuthContext }>) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = c.req.valid('json' as never) as CreateTaskRequest;
    const userId = user.sub;

    logger.info('Task creation request received', {
      userId,
      title: body.title,
      priority: body.priority,
      assignTo: body.assignTo,
    });

    try {
      const orchestrator = getTaskOrchestratorAgent();

      const taskInput: CreateTaskInput = {
        title: body.title,
        description: body.description,
        priority: body.priority,
        assignTo: body.assignTo,
      };

      const task: McpTask = await orchestrator.executeTool(
        'create_task',
        taskInput,
        { userId }
      );

      logger.info('Task created successfully', {
        userId,
        taskId: task.id,
        title: task.title,
        priority: task.priority,
        assignedTo: task.assignedTo,
      });

      return c.json({
        task: {
          id: task.id,
          title: task.title,
          description: task.description,
          priority: task.priority,
          status: task.status,
          assignedTo: task.assignedTo,
          createdAt: task.createdAt,
        },
      });
    } catch (error) {
      logger.error('Task creation error', error as Error, { userId });

      // Check if it's a connection error to MCP Task Server
      const errorMessage = (error as Error).message;
      if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('fetch failed')) {
        return c.json(
          {
            error: 'TASK_SERVER_UNAVAILABLE',
            message: 'MCP Task Serverに接続できません',
            message_en: 'Cannot connect to MCP Task Server',
          },
          503
        );
      }

      return c.json(
        {
          error: 'TASK_CREATION_FAILED',
          message: 'タスク作成中にエラーが発生しました',
          message_en: 'An error occurred while creating the task',
        },
        500
      );
    }
  }
);

/**
 * GET /api/agents/status
 *
 * Get connected agents and their status from MCP Task Server.
 *
 * Requirements: B-008
 */
agentsRouter.get(
  '/status',
  requirePremiumOrAdmin,
  async (c: Context<{ Variables: AuthContext }>) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    logger.info('Agent status request', { userId: user.sub });

    try {
      const orchestrator = getTaskOrchestratorAgent();
      const client = orchestrator.getClient();

      // Check server health
      const health = await client.checkHealth();

      if (!health.healthy) {
        return c.json({
          status: 'disconnected',
          serverHealthy: false,
          agents: [],
          tasks: {
            total: 0,
            pending: 0,
            inProgress: 0,
            completed: 0,
            failed: 0,
          },
        });
      }

      // Get dashboard stats
      const stats: DashboardStats = await client.getDashboard();

      // Get all agents
      const agents = await client.listAgents();

      logger.info('Agent status retrieved', {
        userId: user.sub,
        agentCount: agents.length,
        taskTotal: stats.tasks.total,
      });

      return c.json({
        status: 'connected',
        serverHealthy: true,
        serverVersion: health.version,
        agents: agents.map((agent) => ({
          id: agent.id,
          name: agent.name,
          role: agent.role,
          status: agent.status,
          machineId: agent.machineId,
          capabilities: agent.capabilities,
          currentTaskId: agent.currentTaskId,
          lastHeartbeat: agent.lastHeartbeat,
        })),
        tasks: {
          total: stats.tasks.total,
          pending: stats.tasks.pending,
          assigned: stats.tasks.assigned,
          inProgress: stats.tasks.in_progress,
          completed: stats.tasks.completed,
          failed: stats.tasks.failed,
        },
        agentsByRole: stats.agents.byRole,
        agentsByMachine: stats.agents.byMachine,
      });
    } catch (error) {
      logger.error('Agent status error', error as Error, { userId: user.sub });

      // Return disconnected status on error
      return c.json({
        status: 'disconnected',
        serverHealthy: false,
        error: 'MCP Task Serverに接続できません',
        error_en: 'Cannot connect to MCP Task Server',
        agents: [],
        tasks: {
          total: 0,
          pending: 0,
          assigned: 0,
          inProgress: 0,
          completed: 0,
          failed: 0,
        },
      });
    }
  }
);

/**
 * POST /api/agents/workflow/:workflowId
 *
 * Execute a workflow (habit-analysis, goal-achievement).
 *
 * Requirements: B-006, B-007
 */
agentsRouter.post(
  '/workflow/:workflowId',
  requirePremiumOrAdmin,
  zValidator('json', WorkflowRequestSchema),
  async (c: Context<{ Variables: AuthContext }>) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const workflowId = c.req.param('workflowId');
    const body = c.req.valid('json' as never) as WorkflowRequest;
    const userId = user.sub;

    logger.info('Workflow execution request', {
      userId,
      workflowId,
      params: Object.keys(body.params),
    });

    try {
      const supabase = getSupabaseClient();

      switch (workflowId) {
        case 'habit-analysis': {
          // Execute habit analysis workflow
          const locale = (body.params['locale'] as 'ja' | 'en') ?? 'ja';
          const forceRefresh = (body.params['forceRefresh'] as boolean) ?? false;
          const analysisDepth = (body.params['analysisDepth'] as 'basic' | 'detailed' | 'comprehensive') ?? 'detailed';

          const result: HabitAnalysisOutput = await executeHabitAnalysis(userId, supabase, {
            locale,
            forceRefresh,
            analysisDepth,
          });

          logger.info('Habit analysis workflow completed', {
            userId,
            totalHabits: result.dataCollection.totalHabits,
            insightsCount: result.insights.insights.length,
          });

          return c.json({
            workflowId: 'habit-analysis',
            status: 'completed',
            result: {
              dataCollection: result.dataCollection,
              patternAnalysis: result.patternAnalysis,
              insights: result.insights,
              recommendations: result.recommendations,
              metadata: result.metadata,
            },
          });
        }

        case 'goal-achievement': {
          // Validate and execute goal achievement workflow
          const goalId = body.params['goalId'] as string;
          if (!goalId) {
            return c.json(
              {
                error: 'INVALID_PARAMS',
                message: 'goalId is required for goal-achievement workflow',
              },
              400
            );
          }

          const input: GoalAchievementInput = GoalAchievementInputSchema.parse({
            goalId,
            userId,
            locale: (body.params['locale'] as 'ja' | 'en') ?? 'ja',
            includeRecommendations: (body.params['includeRecommendations'] as boolean) ?? true,
          });

          const result: GoalAchievementWorkflowResult = await executeGoalAchievementWorkflow(
            input,
            supabase
          );

          logger.info('Goal achievement workflow completed', {
            userId,
            goalId,
            overallStatus: result.summary.overallStatus,
          });

          return c.json({
            workflowId: 'goal-achievement',
            status: 'completed',
            result: {
              goalId: result.goalId,
              goalName: result.goalName,
              assessment: result.assessment,
              milestones: result.milestones,
              habitMapping: result.habitMapping,
              progressTracking: result.progressTracking,
              summary: result.summary,
            },
          });
        }

        default:
          return c.json(
            {
              error: 'UNKNOWN_WORKFLOW',
              message: `Unknown workflow: ${workflowId}`,
              availableWorkflows: ['habit-analysis', 'goal-achievement'],
            },
            400
          );
      }
    } catch (error) {
      logger.error('Workflow execution error', error as Error, {
        userId,
        workflowId,
      });

      // Handle validation errors
      if (error instanceof z.ZodError) {
        return c.json(
          {
            error: 'VALIDATION_ERROR',
            message: 'Invalid workflow parameters',
            details: error.errors,
          },
          400
        );
      }

      return c.json(
        {
          error: 'WORKFLOW_FAILED',
          message: 'ワークフロー実行中にエラーが発生しました',
          message_en: 'An error occurred during workflow execution',
        },
        500
      );
    }
  }
);

/**
 * GET /api/agents/orchestration-log
 *
 * Get recent orchestration decisions for debugging and monitoring.
 *
 * Requirements: B-008
 */
agentsRouter.get(
  '/orchestration-log',
  requirePremiumOrAdmin,
  async (c: Context<{ Variables: AuthContext }>) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const count = parseInt(c.req.query('count') ?? '50', 10);
    const taskId = c.req.query('taskId');

    logger.info('Orchestration log request', {
      userId: user.sub,
      count,
      taskId,
    });

    try {
      const orchestrator = getTaskOrchestratorAgent();
      const orchestrationLogger = orchestrator.getOrchestrationLog();

      let decisions;
      if (taskId) {
        decisions = orchestrationLogger.getForTask(taskId);
      } else {
        decisions = orchestrationLogger.getRecent(Math.min(count, 100));
      }

      return c.json({
        decisions,
        count: decisions.length,
      });
    } catch (error) {
      logger.error('Orchestration log error', error as Error, { userId: user.sub });
      return c.json(
        {
          error: 'LOG_FETCH_FAILED',
          message: 'オーケストレーションログの取得に失敗しました',
        },
        500
      );
    }
  }
);

// =============================================================================
// Conversation History API (API Key Authentication)
// =============================================================================

import { cliAuthMiddleware, type CliAuthContext, getCliUserId, getCliAuthMethod } from '../middleware/cliAuth.js';
import { getSessionStore } from '../services/session-store.js';

/**
 * Conversation history response format
 */
interface ConversationHistoryMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  toolCalls?: Array<{
    toolName: string;
    input: unknown;
    output: unknown;
    success: boolean;
    durationMs: number;
  }>;
}

interface ConversationHistorySession {
  sessionId: string;
  createdAt: string;
  lastActivityAt: string;
  messageCount: number;
  quotaUsed: number;
}

interface ConversationHistoryDetail extends ConversationHistorySession {
  messages: ConversationHistoryMessage[];
}

/**
 * GET /api/agents/history
 *
 * List all conversation sessions for the authenticated user.
 * Requires API key authentication (X-API-Key header).
 *
 * Query parameters:
 * - limit: Maximum number of sessions to return (default: 20, max: 100)
 *
 * Response:
 * - sessions: Array of session metadata
 * - count: Number of sessions returned
 */
agentsRouter.get(
  '/history',
  cliAuthMiddleware(),
  async (c: Context<{ Variables: CliAuthContext }>) => {
    const userId = getCliUserId(c);
    const authMethod = getCliAuthMethod(c);

    const limit = Math.min(parseInt(c.req.query('limit') ?? '20', 10), 100);

    logger.info('Conversation history list request', {
      userId,
      limit,
      authMethod,
    });

    try {
      const sessionStore = getSessionStore();
      const sessions = await sessionStore.listUserSessions(userId, limit);

      const sessionList: ConversationHistorySession[] = sessions.map(session => ({
        sessionId: session.id,
        createdAt: session.createdAt.toISOString(),
        lastActivityAt: session.lastActivityAt.toISOString(),
        messageCount: session.messages.length,
        quotaUsed: session.quotaUsed,
      }));

      return c.json({
        sessions: sessionList,
        count: sessionList.length,
        userId,
      });
    } catch (error) {
      logger.error('Failed to list conversation history', error as Error, { userId });
      return c.json(
        {
          error: 'HISTORY_LIST_FAILED',
          message: '会話履歴の取得に失敗しました',
          message_en: 'Failed to retrieve conversation history',
        },
        500
      );
    }
  }
);

/**
 * GET /api/agents/history/:sessionId
 *
 * Get detailed conversation history for a specific session.
 * Requires API key authentication (X-API-Key header).
 *
 * Path parameters:
 * - sessionId: The session ID to retrieve
 *
 * Query parameters:
 * - includeSuggestions: Include full tool call outputs (suggestions) (default: true)
 *
 * Response:
 * - session: Full session data including messages and tool calls
 */
agentsRouter.get(
  '/history/:sessionId',
  cliAuthMiddleware(),
  async (c: Context<{ Variables: CliAuthContext }>) => {
    const userId = getCliUserId(c);
    const authMethod = getCliAuthMethod(c);

    const sessionId = c.req.param('sessionId');
    const includeSuggestions = c.req.query('includeSuggestions') !== 'false';

    logger.info('Conversation history detail request', {
      userId,
      sessionId,
      includeSuggestions,
      authMethod,
    });

    try {
      const sessionStore = getSessionStore();
      const session = await sessionStore.getSession(sessionId, userId);

      if (!session) {
        return c.json(
          {
            error: 'SESSION_NOT_FOUND',
            message: '指定されたセッションが見つかりません',
            message_en: 'Session not found',
          },
          404
        );
      }

      // Build response with full message details
      const messages: ConversationHistoryMessage[] = session.messages.map(msg => {
        const message: ConversationHistoryMessage = {
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp.toISOString(),
        };

        // Include tool calls with suggestion details if requested
        if (includeSuggestions && msg.toolCalls && msg.toolCalls.length > 0) {
          message.toolCalls = msg.toolCalls.map(tc => ({
            toolName: tc.toolName,
            input: tc.input,
            output: tc.output,
            success: tc.success,
            durationMs: tc.durationMs,
          }));
        }

        return message;
      });

      const detail: ConversationHistoryDetail = {
        sessionId: session.id,
        createdAt: session.createdAt.toISOString(),
        lastActivityAt: session.lastActivityAt.toISOString(),
        messageCount: session.messages.length,
        quotaUsed: session.quotaUsed,
        messages,
      };

      return c.json({
        session: detail,
        userId,
      });
    } catch (error) {
      logger.error('Failed to get conversation history', error as Error, {
        userId,
        sessionId,
      });
      return c.json(
        {
          error: 'HISTORY_FETCH_FAILED',
          message: '会話履歴の取得に失敗しました',
          message_en: 'Failed to retrieve conversation history',
        },
        500
      );
    }
  }
);

/**
 * CLI Chat request schema
 */
const CliChatRequestSchema = z.object({
  message: z.string().min(1).max(2000)
    .describe('User message to the coach'),
  sessionId: z.string().optional()
    .describe('Session ID for multi-turn conversations (auto-generated if not provided)'),
  locale: z.enum(['ja', 'en']).default('ja')
    .describe('Response language'),
});

type CliChatRequest = z.infer<typeof CliChatRequestSchema>;

/**
 * POST /api/agents/cli/chat
 *
 * Send a message to the AI coach via CLI.
 * Requires API key authentication (X-API-Key header).
 *
 * Uses the same provider as configured in WEBUI:
 * - If MCP agent is enabled in user settings, uses MCP server
 * - Otherwise uses VowCoachAgent (OpenAI)
 *
 * Request body:
 * - message: User message (required)
 * - sessionId: Session ID for multi-turn conversations (optional)
 * - locale: Response language 'ja' | 'en' (default: 'ja')
 *
 * Response:
 * - message: AI response text
 * - sessionId: Session ID for continuing the conversation
 * - toolCalls: Array of tool calls with suggestion details
 * - suggestions: Quick reply suggestions
 * - provider: 'mcp' | 'openai' - which provider was used
 */
agentsRouter.post(
  '/cli/chat',
  cliAuthMiddleware(),
  zValidator('json', CliChatRequestSchema),
  async (c: Context<{ Variables: CliAuthContext }>) => {
    const userId = getCliUserId(c);
    const authMethod = getCliAuthMethod(c);

    const body = c.req.valid('json' as never) as CliChatRequest;
    const { message, locale } = body;
    const sessionId = body.sessionId || `cli_session_${userId}_${Date.now()}`;

    logger.info('CLI chat request received', {
      userId,
      sessionId,
      messageLength: message.length,
      locale,
      authMethod,
    });

    try {
      // Check user's MCP settings from DynamoDB (same as WEBUI)
      const { server: mcpServer, agentId, settings: mcpSettings } = await getActiveMcpServer(userId);

      if (mcpServer && mcpServer.serverUrl) {
        logger.info('Using MCP server for chat (from user settings)', {
          userId,
          sessionId,
          serverId: mcpServer.id,
          serverName: mcpServer.name,
          agentId,
        });

        // Build system prompt based on agent role
        // For CLI chat endpoint and coach-related agentIds, use the full AICoach system prompt
        const isCoachRole = !agentId ||
          agentId === 'default' ||
          agentId.toLowerCase().includes('coach') ||
          agentId.toLowerCase().includes('vow');

        const systemPrompt = isCoachRole
          ? generateCoachSystemPrompt(locale)
          : locale === 'ja'
            ? `あなたはVOWアプリのAIアシスタントです。日本語で親しみやすく対話してください。`
            : `You are an AI assistant for the VOW app. Respond in a friendly manner in English.`;

        logger.info('Using system prompt for MCP chat', {
          agentId,
          isCoachRole,
          promptLength: systemPrompt.length,
        });

        const mcpResult = await callMcpChat(mcpServer, agentId || 'default', message, sessionId, systemPrompt);

        if (mcpResult.success && mcpResult.message) {
          logger.info('MCP chat response generated', {
            userId,
            sessionId,
            serverName: mcpServer.name,
            hasToolCalls: !!(mcpResult.toolCalls && mcpResult.toolCalls.length > 0),
            provider: 'mcp',
          });

          return c.json({
            message: mcpResult.message,
            sessionId,
            toolCalls: mcpResult.toolCalls ?? [],
            suggestions: [],
            quotaRemaining: 100, // MCP doesn't track quota
            provider: 'mcp',
          });
        }

        // MCP call failed - check if fallback is allowed
        if (mcpSettings?.fallbackToApi) {
          logger.warning('MCP chat failed, falling back to VowCoachAgent', {
            userId,
            sessionId,
            error: mcpResult.error,
          });
        } else {
          // No fallback allowed, return the error
          logger.error('MCP chat failed (no fallback)', new Error(mcpResult.error || 'Unknown error'), {
            userId,
            sessionId,
          });
          return c.json({
            error: 'MCP_CHAT_FAILED',
            message: mcpResult.error || 'MCPサーバーへの接続に失敗しました',
            message_en: mcpResult.error || 'Failed to connect to MCP server',
          }, 503);
        }
      } else {
        logger.info('MCP not configured, using VowCoachAgent', { userId, sessionId });
      }

      // Use VowCoachAgent (OpenAI)
      const supabase = getSupabaseClient();

      // Get user context for personalization (ISS-20260204-019)
      const personalizationEngine = new PersonalizationEngine(supabase);
      const userContext = await personalizationEngine.analyzeUserContext(userId);

      // Create execution context with userContext
      const executionContext: CoachExecutionContext = {
        userId,
        sessionId,
        supabase,
        locale,
        userContext,
      };

      // Get coach agent and process message
      const coachAgent = getVowCoachAgent();
      const response: CoachResponse = await coachAgent.processMessage(
        message,
        executionContext
      );

      logger.info('CLI chat response generated', {
        userId,
        sessionId,
        hasToolCalls: !!(response.toolCalls && response.toolCalls.length > 0),
        toolCallCount: response.toolCalls?.length ?? 0,
        provider: 'openai',
      });

      // Format tool calls for response
      const toolCalls = response.toolCalls?.map(tc => ({
        toolName: tc.toolName,
        input: tc.input,
        output: tc.output,
        success: tc.success,
        durationMs: tc.durationMs,
      }));

      return c.json({
        message: response.message,
        sessionId,
        toolCalls: toolCalls ?? [],
        suggestions: response.suggestions ?? [],
        quotaRemaining: response.quotaRemaining,
        provider: 'openai',
      });
    } catch (error) {
      logger.error('CLI chat error', error as Error, { userId, sessionId });
      return c.json(
        {
          error: 'CHAT_FAILED',
          message: 'AI処理中にエラーが発生しました',
          message_en: 'An error occurred during AI processing',
        },
        500
      );
    }
  }
);

// =============================================================================
// Remote Task Execution (MCP Task Server Proxy)
// =============================================================================

const MCP_SERVER_URL = process.env['MCP_SERVER_URL'] || 'http://localhost:3456';
const MCP_SERVER_TOKEN = process.env['MCP_SERVER_TOKEN'] || '';

/**
 * Remote task request schema
 */
const RemoteTaskRequestSchema = z.object({
  prompt: z.string().min(1).max(10000)
    .describe('Task prompt for Claude Code'),
  workingDirectory: z.string().optional()
    .describe('Working directory for execution'),
  timeoutMs: z.number().min(1000).max(60 * 60 * 1000).default(30 * 60 * 1000)
    .describe('Timeout in milliseconds (default 30 minutes)'),
  allowedTools: z.array(z.string()).optional()
    .describe('List of allowed tools'),
  dangerouslySkipPermissions: z.boolean().optional().default(false)
    .describe('Skip permission checks (dangerous)'),
});

/**
 * POST /remote-task - Create and execute a remote task via MCP Task Server
 */
agentsRouter.post(
  '/remote-task',
  zValidator('json', RemoteTaskRequestSchema),
  async (c) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'UNAUTHORIZED', message: 'Authentication required' }, 401);
    }

    const userId = user.sub;
    const body = c.req.valid('json' as never) as z.infer<typeof RemoteTaskRequestSchema>;
    const { prompt, workingDirectory, timeoutMs, allowedTools, dangerouslySkipPermissions } = body;

    logger.info('Creating remote task', {
      userId,
      promptLength: prompt.length,
      workingDirectory,
    });

    try {
      const response = await fetch(`${MCP_SERVER_URL}/remote-tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${MCP_SERVER_TOKEN}`,
          'X-Agent-ID': `user-${userId.slice(0, 8)}`,
        },
        body: JSON.stringify({
          prompt,
          workingDirectory,
          timeoutMs,
          allowedTools,
          dangerouslySkipPermissions,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' })) as { error?: string };
        logger.error('Remote task creation failed', new Error(JSON.stringify(errorData)), {
          userId,
          status: response.status,
        });
        return c.json({
          error: 'REMOTE_TASK_FAILED',
          message: errorData.error || 'Failed to create remote task',
        }, response.status as 400 | 500);
      }

      const result = await response.json();
      return c.json(result);
    } catch (err) {
      logger.error('Remote task error', err as Error, { userId });
      return c.json({
        error: 'REMOTE_TASK_ERROR',
        message: 'Failed to communicate with task server',
      }, 500);
    }
  }
);

/**
 * GET /remote-task - List remote tasks
 */
agentsRouter.get(
  '/remote-task',
  async (c) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'UNAUTHORIZED', message: 'Authentication required' }, 401);
    }

    const userId = user.sub;

    try {
      const response = await fetch(`${MCP_SERVER_URL}/remote-tasks`, {
        headers: {
          'Authorization': `Bearer ${MCP_SERVER_TOKEN}`,
        },
      });

      if (!response.ok) {
        return c.json({ error: 'FETCH_FAILED', message: 'Failed to fetch remote tasks' }, 500);
      }

      const result = await response.json();
      return c.json(result);
    } catch (err) {
      logger.error('Remote task list error', err as Error, { userId });
      return c.json({ error: 'REMOTE_TASK_ERROR', message: 'Failed to fetch remote tasks' }, 500);
    }
  }
);

/**
 * GET /remote-task/:id - Get specific remote task
 */
agentsRouter.get(
  '/remote-task/:id',
  async (c) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'UNAUTHORIZED', message: 'Authentication required' }, 401);
    }

    const userId = user.sub;
    const taskId = c.req.param('id');

    try {
      const response = await fetch(`${MCP_SERVER_URL}/remote-tasks/${taskId}`, {
        headers: {
          'Authorization': `Bearer ${MCP_SERVER_TOKEN}`,
        },
      });

      if (!response.ok) {
        return c.json({ error: 'NOT_FOUND', message: 'Task not found' }, 404);
      }

      const result = await response.json();
      return c.json(result);
    } catch (err) {
      logger.error('Remote task get error', err as Error, { userId, taskId });
      return c.json({ error: 'REMOTE_TASK_ERROR', message: 'Failed to fetch task' }, 500);
    }
  }
);

/**
 * GET /remote-task/:id/output - SSE stream for task output
 */
agentsRouter.get(
  '/remote-task/:id/output',
  async (c) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'UNAUTHORIZED', message: 'Authentication required' }, 401);
    }

    const userId = user.sub;
    const taskId = c.req.param('id');

    logger.info('Connecting to remote task output stream', {
      userId,
      taskId,
    });

    return streamSSE(c, async (stream) => {
      try {
        const response = await fetch(`${MCP_SERVER_URL}/tasks/${taskId}/output?token=${MCP_SERVER_TOKEN}`, {
          headers: {
            'Accept': 'text/event-stream',
          },
        });

        if (!response.ok || !response.body) {
          await stream.writeSSE({
            data: JSON.stringify({ type: 'error', message: 'Failed to connect to task output stream' }),
          });
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          // Forward the SSE data as-is
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              await stream.writeSSE({
                data: line.slice(6),
              });
            }
          }
        }
      } catch (err) {
        logger.error('Remote task output stream error', err as Error, { userId, taskId });
        await stream.writeSSE({
          data: JSON.stringify({ type: 'error', message: 'Stream connection failed' }),
        });
      }
    });
  }
);

/**
 * POST /remote-task/:id/cancel - Cancel a running remote task
 */
agentsRouter.post(
  '/remote-task/:id/cancel',
  async (c) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'UNAUTHORIZED', message: 'Authentication required' }, 401);
    }

    const userId = user.sub;
    const taskId = c.req.param('id');

    logger.info('Cancelling remote task', {
      userId,
      taskId,
    });

    try {
      const response = await fetch(`${MCP_SERVER_URL}/tasks/${taskId}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${MCP_SERVER_TOKEN}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' })) as { error?: string };
        return c.json({
          error: 'CANCEL_FAILED',
          message: errorData.error || 'Failed to cancel task',
        }, response.status as 400 | 500);
      }

      const result = await response.json();
      return c.json(result);
    } catch (err) {
      logger.error('Remote task cancel error', err as Error, { userId, taskId });
      return c.json({ error: 'REMOTE_TASK_ERROR', message: 'Failed to cancel task' }, 500);
    }
  }
);

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create the agents router
 */
export function createAgentsRouter(): Hono<{ Variables: AuthContext }> {
  return agentsRouter;
}

export { agentsRouter };
