/**
 * Agents Router
 *
 * API endpoints for AI agents including:
 * - MCP-based CLI chat (no OpenAI fallback)
 * - TaskOrchestratorAgent task creation (Strands)
 * - Agent status monitoring
 * - Remote task execution (MCP Task Server proxy)
 *
 * Note: OpenAI/Mastra chat endpoints (/chat, /multi-chat, /multi-agents)
 * and Mastra workflow endpoints have been removed in favor of MCP-only chat.
 *
 * Requirements: B-005, B-008
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
// Agent imports (Strands - kept)
import {
  getTaskOrchestratorAgent,
  type CreateTaskInput,
  type McpTask,
  type DashboardStats,
} from '../agents/strands/task-orchestrator.js';

// MCP chat imports (kept)
import {
  getActiveMcpServer,
  callMcpChat,
} from '../services/mcp-settings-service.js';
// Rate limiting imports removed - no longer needed after removing OpenAI chat endpoints

// Prompt registry - canonical system prompt for MCP chat
import { getCanonicalPrompt } from '../prompts/prompt-registry.js';

const logger = getLogger('agentsRouter');

// =============================================================================
// Request/Response Schemas
// =============================================================================

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

// NOTE: POST /api/agents/chat (OpenAI chat) has been removed.
// NOTE: POST /api/agents/multi-chat (Mastra multi-agent chat) has been removed.
// NOTE: GET /api/agents/multi-agents (Mastra agent list) has been removed.
// Use POST /api/agents/cli/chat with MCP instead.

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

// NOTE: POST /api/agents/workflow/:workflowId (Mastra workflows) has been removed.

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
 * Send a message to the AI coach via CLI (MCP only).
 * Requires API key authentication (X-API-Key header).
 *
 * Uses MCP server configured in user settings. No OpenAI fallback.
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
 * - provider: 'mcp'
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
      const { server: mcpServer, agentId } = await getActiveMcpServer(userId);

      if (!mcpServer || !mcpServer.serverUrl) {
        // MCP not configured - return error (no OpenAI fallback)
        logger.warning('MCP not configured for user', { userId, sessionId });
        return c.json({
          error: 'MCP_NOT_CONFIGURED',
          message: 'MCPサーバーが設定されていません。設定画面からMCPサーバーを設定してください。',
          message_en: 'MCP server is not configured. Please configure an MCP server in settings.',
        }, 400);
      }

      logger.info('Using MCP server for chat (from user settings)', {
        userId,
        sessionId,
        serverId: mcpServer.id,
        serverName: mcpServer.name,
        agentId,
      });

      // Build system prompt based on agent role using prompt-registry
      const isCoachRole = !agentId ||
        agentId === 'default' ||
        agentId.toLowerCase().includes('coach') ||
        agentId.toLowerCase().includes('vow');

      const systemPrompt = isCoachRole
        ? getCanonicalPrompt('AICoach', locale).systemPrompt
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

      // MCP call failed - return error (no OpenAI fallback)
      logger.error('MCP chat failed', new Error(mcpResult.error || 'Unknown error'), {
        userId,
        sessionId,
      });
      return c.json({
        error: 'MCP_CHAT_FAILED',
        message: mcpResult.error || 'MCPサーバーへの接続に失敗しました',
        message_en: mcpResult.error || 'Failed to connect to MCP server',
      }, 503);
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
