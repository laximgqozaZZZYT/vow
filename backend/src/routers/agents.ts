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

// Agent imports
import {
  getVowCoachAgent,
  checkCoachQuota,
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
import { getOpenAIApiKey, getOpenAIModel } from '../services/credentials-store.js';

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
    .describe('Specific agents to query (defaults to all)'),
  streaming: z.boolean().default(false)
    .describe('Whether to use SSE streaming'),
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

// =============================================================================
// Router
// =============================================================================

const agentsRouter = new Hono<{ Variables: AuthContext }>();

/**
 * POST /api/agents/chat
 *
 * Chat with VOW Coach Agent.
 * Supports both JSON response and SSE streaming.
 *
 * Requirements: B-005
 */
agentsRouter.post(
  '/chat',
  requirePremiumOrAdmin,
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

      // Create execution context
      const executionContext: CoachExecutionContext = {
        userId,
        sessionId: body.sessionId ?? `session_${userId}_${Date.now()}`,
        supabase,
        locale: body.locale,
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
            await stream.writeSSE({
              event: 'complete',
              data: JSON.stringify({
                message: response.message,
                toolCalls: response.toolCalls,
                quotaRemaining: response.quotaRemaining,
                suggestions: response.suggestions,
              }),
            });
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
      const response: CoachResponse = await coachAgent.processMessage(
        body.message,
        executionContext
      );

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
 *
 * Requirements: B-005, Multi-Agent System
 */
agentsRouter.post(
  '/multi-chat',
  requirePremiumOrAdmin,
  zValidator('json', MultiAgentChatRequestSchema),
  async (c: Context<{ Variables: AuthContext }>) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = c.req.valid('json' as never) as MultiAgentChatRequest;
    const userId = user.sub;

    logger.info('Multi-agent chat request received', {
      userId,
      sessionId: body.sessionId,
      locale: body.locale,
      includeAgents: body.includeAgents,
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

      // Get user's OpenAI credentials
      const userOpenAIKey = await getOpenAIApiKey(userId);
      const userOpenAIModel = await getOpenAIModel(userId);

      if (!userOpenAIKey) {
        return c.json(
          {
            error: 'API_KEY_REQUIRED',
            message: 'OpenAI APIキーが設定されていません。設定画面からAPIキーを登録してください。',
            message_en: 'OpenAI API key is not configured. Please set up your API key in settings.',
            settingsUrl: '/settings',
          },
          400
        );
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

            // Get agents to query
            const agentsToQuery = body.includeAgents || ['habit-coach', 'goal-planner', 'progress-tracker'];

            // Send agent processing events
            for (const agentId of agentsToQuery) {
              await stream.writeSSE({
                event: 'agent_start',
                data: JSON.stringify({ agentId, status: 'processing' }),
              });
            }

            // Get multi-agent response with user's API key
            const response = await getMultiAgentResponse(body.message, userId, {
              includeAgents: agentsToQuery,
              locale: body.locale,
              openaiApiKey: userOpenAIKey,
              openaiModel: userOpenAIModel,
            });

            // Send individual agent responses
            for (const agentResponse of response.responses) {
              await stream.writeSSE({
                event: 'agent_response',
                data: JSON.stringify({
                  agentId: agentResponse.agentId,
                  agentName: agentResponse.agentName,
                  content: agentResponse.content,
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

      // JSON response
      const options: {
        includeAgents?: ('habit-coach' | 'goal-planner' | 'progress-tracker')[];
        locale?: 'ja' | 'en';
        openaiApiKey?: string;
        openaiModel?: string;
      } = {
        locale: body.locale,
        openaiApiKey: userOpenAIKey,
        openaiModel: userOpenAIModel,
      };
      if (body.includeAgents) {
        options.includeAgents = body.includeAgents;
      }
      const response: MultiAgentResponse = await getMultiAgentResponse(body.message, userId, options);

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
          timestamp: r.timestamp,
          durationMs: r.durationMs,
        })),
        summary: response.summary,
        timestamp: response.timestamp,
        totalDurationMs: response.totalDurationMs,
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
// Factory Function
// =============================================================================

/**
 * Create the agents router
 */
export function createAgentsRouter(): Hono<{ Variables: AuthContext }> {
  return agentsRouter;
}

export { agentsRouter };
