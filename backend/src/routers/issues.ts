/**
 * Issues Router
 *
 * API endpoints for managing issue reports from the chat interface.
 * Supports both JWT authentication (user) and API key authentication (CLI).
 *
 * Endpoints:
 * - POST   /api/issues           - Create a new issue
 * - GET    /api/issues           - List user's issues (JWT)
 * - GET    /api/issues/cli       - List issues (API key for CLI)
 * - GET    /api/issues/:id       - Get issue details
 * - PATCH  /api/issues/:id       - Update issue
 * - DELETE /api/issues/:id       - Delete issue
 *
 * @module routers/issues
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { getSupabaseClient } from '../utils/supabase.js';
import { getLogger } from '../utils/logger.js';
import type { AuthContext } from '../middleware/auth.js';
import { getUserFriendlyMessage } from '../errors/index.js';
import { cliAuthMiddleware, getCliUserId, type CliAuthContext } from '../middleware/cliAuth.js';

const logger = getLogger('issuesRouter');

// =============================================================================
// Schemas
// =============================================================================

/**
 * Conversation message schema for validation
 */
const ConversationMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  timestamp: z.string(),
  toolCalls: z.array(z.unknown()).optional(),
});

/**
 * Conversation data schema with size limits
 * - Max 50 messages
 * - Total size validation happens in handler
 */
const ConversationDataSchema = z.object({
  messages: z.array(ConversationMessageSchema).max(50),
}).optional().nullable();

/**
 * Create issue request schema
 */
const CreateIssueSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional().nullable(), // Changed to optional
  cause: z.string().max(2000).optional().nullable(),
  conversationId: z.string().uuid().optional().nullable(),
  messageIds: z.array(z.string()).optional().nullable(),
  conversationData: ConversationDataSchema, // New field for conversation history
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  category: z.enum(['bug', 'feature', 'question', 'feedback', 'general']).default('general'),
});

/**
 * Update issue request schema
 */
const UpdateIssueSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional().nullable(),  // Changed to allow nullable
  cause: z.string().max(2000).optional().nullable(),
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  category: z.enum(['bug', 'feature', 'question', 'feedback', 'general']).optional(),
  resolutionNotes: z.string().max(2000).optional().nullable(),
  conversationData: ConversationDataSchema,  // Allow updating conversation data
});

// =============================================================================
// Types
// =============================================================================

/**
 * Issue record from database
 */
/**
 * Conversation message format
 */
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  toolCalls?: unknown[];
}

/**
 * Conversation data format
 */
export interface ConversationData {
  messages: ConversationMessage[];
}

export interface Issue {
  id: string;
  issueId: string;  // Human-readable ID: ISS-YYYYMMDD-NNN
  userId: string;
  title: string;
  description?: string | null;  // Changed to optional
  cause?: string | null;
  conversationId?: string | null;
  messageIds?: string[] | null;
  conversationData?: ConversationData | null;  // New field for conversation history
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: 'bug' | 'feature' | 'question' | 'feedback' | 'general';
  resolvedAt?: string | null;
  resolutionNotes?: string | null;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Max size for conversation data in bytes (~100KB)
 */
const MAX_CONVERSATION_DATA_SIZE = 100 * 1024;

/**
 * Validate conversation data size
 * Accepts any object with messages array to avoid strict type checking issues
 */
function validateConversationDataSize(data: unknown): boolean {
  if (!data) return true;
  const jsonString = JSON.stringify(data);
  return jsonString.length <= MAX_CONVERSATION_DATA_SIZE;
}

/**
 * Transform database row to Issue interface
 */
function transformIssue(row: Record<string, unknown>): Issue {
  return {
    id: row['id'] as string,
    issueId: row['issue_id'] as string,  // Human-readable ID: ISS-YYYYMMDD-NNN
    userId: row['user_id'] as string,
    title: row['title'] as string,
    description: row['description'] as string | null,  // Can be null now
    cause: row['cause'] as string | null,
    conversationId: row['conversation_id'] as string | null,
    messageIds: row['message_ids'] as string[] | null,
    conversationData: row['conversation_data'] as ConversationData | null,
    status: row['status'] as Issue['status'],
    priority: row['priority'] as Issue['priority'],
    category: row['category'] as Issue['category'],
    resolvedAt: row['resolved_at'] as string | null,
    resolutionNotes: row['resolution_notes'] as string | null,
    createdAt: row['created_at'] as string,
    updatedAt: row['updated_at'] as string,
  };
}


// =============================================================================
// Router
// =============================================================================

const issuesRouter = new Hono<{ Variables: AuthContext }>();

/**
 * POST /api/issues
 * Create a new issue report.
 */
issuesRouter.post(
  '/',
  zValidator('json', CreateIssueSchema),
  async (c: Context<{ Variables: AuthContext }>) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userId = user.sub;
    const body = c.req.valid('json' as never) as z.infer<typeof CreateIssueSchema>;

    try {
      // Validate conversation data size
      if (body.conversationData && !validateConversationDataSize(body.conversationData)) {
        return c.json({
          error: 'VALIDATION_ERROR',
          message: '会話履歴のサイズが制限を超えています（最大100KB）',
          details: 'Conversation data exceeds size limit (max 100KB)',
        }, 400);
      }

      const supabase = getSupabaseClient();

      logger.info('Creating issue', {
        userId,
        title: body.title,
        category: body.category,
        priority: body.priority,
        hasConversationData: !!body.conversationData,
      });

      const { data, error } = await supabase
        .from('issues')
        .insert({
          user_id: userId,
          title: body.title,
          description: body.description || null,  // Now optional
          cause: body.cause || null,
          conversation_id: body.conversationId || null,
          message_ids: body.messageIds || null,
          conversation_data: body.conversationData || null,
          priority: body.priority,
          category: body.category,
        })
        .select()
        .single();

      if (error) {
        logger.error('Failed to create issue', error, {
          userId,
          errorCode: error.code,
          errorMessage: error.message,
          errorDetails: error.details,
          errorHint: error.hint,
        });
        return c.json({
          error: 'CREATE_FAILED',
          message: 'Issue の作成に失敗しました',
          details: error.message,
        }, 500);
      }

      logger.info('Issue created successfully', {
        userId,
        id: data['id'],
        issueId: data['issue_id'],
        category: body.category,
      });

      return c.json({ issue: transformIssue(data) }, 201);
    } catch (err) {
      logger.error('Create issue error', err instanceof Error ? err : undefined, {
        userId,
        errorMessage: err instanceof Error ? err.message : String(err),
      });
      return c.json({ error: 'CREATE_FAILED', message: getUserFriendlyMessage(err) }, 500);
    }
  }
);

/**
 * GET /api/issues
 * List issues for the authenticated user.
 */
issuesRouter.get('/', async (c: Context<{ Variables: AuthContext }>) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const userId = user.sub;

  // Parse query parameters
  const status = c.req.query('status') as Issue['status'] | 'all' | undefined;
  const priority = c.req.query('priority') as Issue['priority'] | 'all' | undefined;
  const category = c.req.query('category') as Issue['category'] | 'all' | undefined;
  const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 100);
  const offset = parseInt(c.req.query('offset') || '0', 10);

  try {
    const supabase = getSupabaseClient();

    let query = supabase
      .from('issues')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    if (priority && priority !== 'all') {
      query = query.eq('priority', priority);
    }
    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    const { data, error, count } = await query;

    if (error) {
      logger.error('Failed to fetch issues', error, { userId });
      return c.json({ error: 'FETCH_FAILED', message: 'Issue の取得に失敗しました' }, 500);
    }

    const issues = (data || []).map(transformIssue);

    return c.json({
      issues,
      total: count || 0,
      limit,
      offset,
    });
  } catch (err) {
    logger.error('Fetch issues error', err instanceof Error ? err : undefined, { userId });
    return c.json({ error: 'FETCH_FAILED', message: getUserFriendlyMessage(err) }, 500);
  }
});

/**
 * GET /api/issues/cli
 * List issues using API key or JWT authentication (for CLI access).
 */
issuesRouter.get('/cli', cliAuthMiddleware(), async (c: Context<{ Variables: CliAuthContext }>) => {
  const userId = getCliUserId(c);

  // Parse query parameters
  const status = c.req.query('status') as Issue['status'] | 'all' | undefined;
  const priority = c.req.query('priority') as Issue['priority'] | 'all' | undefined;
  const category = c.req.query('category') as Issue['category'] | 'all' | undefined;
  const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 100);
  const offset = parseInt(c.req.query('offset') || '0', 10);

  try {
    const supabase = getSupabaseClient();

    let query = supabase
      .from('issues')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    if (priority && priority !== 'all') {
      query = query.eq('priority', priority);
    }
    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    const { data, error, count } = await query;

    if (error) {
      logger.error('Failed to fetch issues (CLI)', error, { userId });
      return c.json({ error: 'FETCH_FAILED', message: 'Issue の取得に失敗しました' }, 500);
    }

    const issues = (data || []).map(transformIssue);

    return c.json({
      issues,
      total: count || 0,
      limit,
      offset,
    });
  } catch (err) {
    logger.error('Fetch issues error (CLI)', err instanceof Error ? err : undefined, { userId });
    return c.json({ error: 'FETCH_FAILED', message: getUserFriendlyMessage(err) }, 500);
  }
});

/**
 * POST /api/issues/cli
 * Create a new issue using API key or JWT authentication (for CLI/Agent access).
 */
issuesRouter.post(
  '/cli',
  cliAuthMiddleware(),
  zValidator('json', CreateIssueSchema),
  async (c: Context<{ Variables: CliAuthContext }>) => {
    const userId = getCliUserId(c);
    const body = c.req.valid('json' as never) as z.infer<typeof CreateIssueSchema>;

    try {
      // Validate conversation data size
      if (body.conversationData && !validateConversationDataSize(body.conversationData)) {
        return c.json({
          error: 'VALIDATION_ERROR',
          message: '会話履歴のサイズが制限を超えています（最大100KB）',
          details: 'Conversation data exceeds size limit (max 100KB)',
        }, 400);
      }

      const supabase = getSupabaseClient();

      logger.info('Creating issue (CLI)', {
        userId,
        title: body.title,
        category: body.category,
        priority: body.priority,
        hasConversationData: !!body.conversationData,
      });

      const { data, error } = await supabase
        .from('issues')
        .insert({
          user_id: userId,
          title: body.title,
          description: body.description || null,
          cause: body.cause || null,
          conversation_id: body.conversationId || null,
          message_ids: body.messageIds || null,
          conversation_data: body.conversationData || null,
          priority: body.priority,
          category: body.category,
        })
        .select()
        .single();

      if (error) {
        logger.error('Failed to create issue (CLI)', error, {
          userId,
          errorCode: error.code,
          errorMessage: error.message,
          errorDetails: error.details,
          errorHint: error.hint,
        });
        return c.json({
          error: 'CREATE_FAILED',
          message: 'Issue の作成に失敗しました',
          details: error.message,
        }, 500);
      }

      logger.info('Issue created successfully (CLI)', {
        userId,
        id: data['id'],
        issueId: data['issue_id'],
        category: body.category,
      });

      return c.json({ issue: transformIssue(data) }, 201);
    } catch (err) {
      logger.error('Create issue error (CLI)', err instanceof Error ? err : undefined, {
        userId,
        errorMessage: err instanceof Error ? err.message : String(err),
      });
      return c.json({ error: 'CREATE_FAILED', message: getUserFriendlyMessage(err) }, 500);
    }
  }
);

/**
 * PATCH /api/issues/cli/:id
 * Update an issue using API key or JWT authentication (for CLI/Agent access).
 */
issuesRouter.patch(
  '/cli/:id',
  cliAuthMiddleware(),
  zValidator('json', UpdateIssueSchema),
  async (c: Context<{ Variables: CliAuthContext }>) => {
    const userId = getCliUserId(c);
    const issueId = c.req.param('id');
    const body = c.req.valid('json' as never) as z.infer<typeof UpdateIssueSchema>;

    try {
      const supabase = getSupabaseClient();

      // Build update object
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (body.title !== undefined) {
        updateData['title'] = body.title;
      }
      if (body.description !== undefined) {
        updateData['description'] = body.description;
      }
      if (body.cause !== undefined) {
        updateData['cause'] = body.cause;
      }
      if (body.status !== undefined) {
        updateData['status'] = body.status;
        if (body.status === 'resolved' || body.status === 'closed') {
          updateData['resolved_at'] = new Date().toISOString();
        }
      }
      if (body.priority !== undefined) {
        updateData['priority'] = body.priority;
      }
      if (body.category !== undefined) {
        updateData['category'] = body.category;
      }
      if (body.resolutionNotes !== undefined) {
        updateData['resolution_notes'] = body.resolutionNotes;
      }

      const { data, error } = await supabase
        .from('issues')
        .update(updateData)
        .eq('id', issueId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return c.json({ error: 'NOT_FOUND', message: 'Issue が見つかりません' }, 404);
        }
        logger.error('Failed to update issue (CLI)', error, { userId, issueId });
        return c.json({ error: 'UPDATE_FAILED', message: 'Issue の更新に失敗しました' }, 500);
      }

      logger.info('Issue updated (CLI)', {
        userId,
        issueId,
        status: body.status,
      });

      return c.json({ issue: transformIssue(data) });
    } catch (err) {
      logger.error('Update issue error (CLI)', err instanceof Error ? err : undefined, { userId, issueId });
      return c.json({ error: 'UPDATE_FAILED', message: getUserFriendlyMessage(err) }, 500);
    }
  }
);

/**
 * GET /api/issues/:id
 * Get a specific issue by ID.
 */
issuesRouter.get('/:id', async (c: Context<{ Variables: AuthContext }>) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const userId = user.sub;
  const issueId = c.req.param('id');

  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('issues')
      .select('*')
      .eq('id', issueId)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return c.json({ error: 'NOT_FOUND', message: 'Issue が見つかりません' }, 404);
      }
      logger.error('Failed to fetch issue', error, { userId, issueId });
      return c.json({ error: 'FETCH_FAILED', message: 'Issue の取得に失敗しました' }, 500);
    }

    return c.json({ issue: transformIssue(data) });
  } catch (err) {
    logger.error('Fetch issue error', err instanceof Error ? err : undefined, { userId, issueId });
    return c.json({ error: 'FETCH_FAILED', message: getUserFriendlyMessage(err) }, 500);
  }
});

/**
 * PATCH /api/issues/:id
 * Update an issue.
 */
issuesRouter.patch(
  '/:id',
  zValidator('json', UpdateIssueSchema),
  async (c: Context<{ Variables: AuthContext }>) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userId = user.sub;
    const issueId = c.req.param('id');
    const body = c.req.valid('json' as never) as z.infer<typeof UpdateIssueSchema>;

    try {
      const supabase = getSupabaseClient();

      // Build update object
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (body.title !== undefined) {
        updateData['title'] = body.title;
      }
      if (body.description !== undefined) {
        updateData['description'] = body.description;
      }
      if (body.cause !== undefined) {
        updateData['cause'] = body.cause;
      }
      if (body.status !== undefined) {
        updateData['status'] = body.status;
        if (body.status === 'resolved' || body.status === 'closed') {
          updateData['resolved_at'] = new Date().toISOString();
        }
      }
      if (body.priority !== undefined) {
        updateData['priority'] = body.priority;
      }
      if (body.category !== undefined) {
        updateData['category'] = body.category;
      }
      if (body.resolutionNotes !== undefined) {
        updateData['resolution_notes'] = body.resolutionNotes;
      }

      const { data, error } = await supabase
        .from('issues')
        .update(updateData)
        .eq('id', issueId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return c.json({ error: 'NOT_FOUND', message: 'Issue が見つかりません' }, 404);
        }
        logger.error('Failed to update issue', error, { userId, issueId });
        return c.json({ error: 'UPDATE_FAILED', message: 'Issue の更新に失敗しました' }, 500);
      }

      logger.info('Issue updated', {
        userId,
        issueId,
        status: body.status,
      });

      return c.json({ issue: transformIssue(data) });
    } catch (err) {
      logger.error('Update issue error', err instanceof Error ? err : undefined, { userId, issueId });
      return c.json({ error: 'UPDATE_FAILED', message: getUserFriendlyMessage(err) }, 500);
    }
  }
);

/**
 * DELETE /api/issues/:id
 * Delete an issue.
 */
issuesRouter.delete('/:id', async (c: Context<{ Variables: AuthContext }>) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const userId = user.sub;
  const issueId = c.req.param('id');

  try {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('issues')
      .delete()
      .eq('id', issueId)
      .eq('user_id', userId);

    if (error) {
      logger.error('Failed to delete issue', error, { userId, issueId });
      return c.json({ error: 'DELETE_FAILED', message: 'Issue の削除に失敗しました' }, 500);
    }

    logger.info('Issue deleted', { userId, issueId });

    return c.json({ success: true, message: 'Issue を削除しました' });
  } catch (err) {
    logger.error('Delete issue error', err instanceof Error ? err : undefined, { userId, issueId });
    return c.json({ error: 'DELETE_FAILED', message: getUserFriendlyMessage(err) }, 500);
  }
});

/**
 * GET /api/issues/stats
 * Get issue statistics for the authenticated user.
 */
issuesRouter.get('/stats', async (c: Context<{ Variables: AuthContext }>) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const userId = user.sub;

  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('issues')
      .select('status, priority, category')
      .eq('user_id', userId);

    if (error) {
      logger.error('Failed to fetch issue stats', error, { userId });
      return c.json({ error: 'FETCH_FAILED', message: '統計の取得に失敗しました' }, 500);
    }

    const stats = {
      total: data?.length || 0,
      byStatus: {
        open: 0,
        in_progress: 0,
        resolved: 0,
        closed: 0,
      },
      byPriority: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0,
      },
      byCategory: {
        bug: 0,
        feature: 0,
        question: 0,
        feedback: 0,
        general: 0,
      },
    };

    for (const item of data || []) {
      const status = item['status'] as keyof typeof stats.byStatus;
      const priority = item['priority'] as keyof typeof stats.byPriority;
      const category = item['category'] as keyof typeof stats.byCategory;

      if (status in stats.byStatus) {
        stats.byStatus[status]++;
      }
      if (priority in stats.byPriority) {
        stats.byPriority[priority]++;
      }
      if (category in stats.byCategory) {
        stats.byCategory[category]++;
      }
    }

    return c.json({ stats });
  } catch (err) {
    logger.error('Fetch issue stats error', err instanceof Error ? err : undefined, { userId });
    return c.json({ error: 'FETCH_FAILED', message: getUserFriendlyMessage(err) }, 500);
  }
});

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create the issues router
 */
export function createIssuesRouter(): Hono<{ Variables: AuthContext }> {
  return issuesRouter;
}

export { issuesRouter };
