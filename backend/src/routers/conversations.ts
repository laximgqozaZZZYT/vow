/**
 * Conversations Router
 *
 * API endpoints for managing AI conversation history.
 * Provides access to stored coach sessions and conversation logs.
 *
 * Endpoints:
 * - GET    /api/conversations           - List conversations (sessions)
 * - GET    /api/conversations/:id       - Get a specific conversation
 * - DELETE /api/conversations/:id       - Delete a conversation
 * - GET    /api/conversations/:id/messages - Get messages for a conversation
 *
 * @module routers/conversations
 */

import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import { getLogger } from '../utils/logger.js';
import type { AuthContext } from '../middleware/auth.js';
import { getUserFriendlyMessage } from '../errors/index.js';
import { getSessionStore } from '../services/session-store.js';
import { getSupabaseClient } from '../utils/supabase.js';
import { getSubscriptionService } from '../services/subscriptionService.js';
import { getAdminService } from '../services/adminService.js';

const logger = getLogger('conversationsRouter');

// =============================================================================
// Middleware
// =============================================================================

/**
 * Premium access middleware for conversation history.
 * Only Premium users and admins can access conversation history.
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

  // Check for admin access first
  const isAdmin = await adminService.isAdmin(userId, userEmail);
  if (isAdmin) {
    c.set('isAdmin' as any, true);
    await next();
    return;
  }

  // Check premium subscription for non-admin users
  try {
    const subscriptionService = getSubscriptionService(supabase);
    const hasPremium = await subscriptionService.hasPremiumAccess(userId);

    if (!hasPremium) {
      return c.json(
        {
          error: 'PREMIUM_REQUIRED',
          message: '会話履歴はPremiumプランでのみ利用可能です',
          message_en: 'Conversation history is only available with Premium plan',
          upgradeUrl: '/settings/subscription',
        },
        402
      );
    }

    c.set('isAdmin' as any, false);
    await next();
  } catch (error) {
    logger.warning('Subscription check failed', {
      userId,
      error: (error as Error).message,
    });
    return c.json(
      {
        error: 'PREMIUM_REQUIRED',
        message: '会話履歴はPremiumプランでのみ利用可能です',
        upgradeUrl: '/settings/subscription',
      },
      402
    );
  }
}

// =============================================================================
// Router
// =============================================================================

const conversationsRouter = new Hono<{ Variables: AuthContext }>();

/**
 * GET /api/conversations
 * List user's conversation sessions.
 */
conversationsRouter.get(
  '/',
  requirePremiumOrAdmin,
  async (c: Context<{ Variables: AuthContext }>) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userId = user.sub;
    const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 50);

    try {
      const sessionStore = getSessionStore();
      const sessions = await sessionStore.listUserSessions(userId, limit);

      const conversations = sessions.map(session => ({
        id: session.id,
        messageCount: session.messages.length,
        quotaUsed: session.quotaUsed,
        createdAt: session.createdAt.toISOString(),
        lastActivityAt: session.lastActivityAt.toISOString(),
        // Include first and last message preview
        preview: {
          firstMessage: session.messages[0]?.content?.substring(0, 100) || null,
          lastMessage: session.messages[session.messages.length - 1]?.content?.substring(0, 100) || null,
        },
      }));

      logger.info('Conversations listed', { userId, count: conversations.length });

      return c.json({
        conversations,
        count: conversations.length,
        limit,
      });
    } catch (err) {
      logger.error('List conversations error', err instanceof Error ? err : undefined, { userId });
      return c.json({ error: 'FETCH_FAILED', message: getUserFriendlyMessage(err) }, 500);
    }
  }
);

/**
 * GET /api/conversations/:id
 * Get a specific conversation session.
 */
conversationsRouter.get(
  '/:id',
  requirePremiumOrAdmin,
  async (c: Context<{ Variables: AuthContext }>) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userId = user.sub;
    const sessionId = c.req.param('id');

    try {
      const sessionStore = getSessionStore();
      const session = await sessionStore.getSession(sessionId, userId);

      if (!session) {
        return c.json({ error: 'NOT_FOUND', message: '会話が見つかりません' }, 404);
      }

      const conversation = {
        id: session.id,
        messages: session.messages.map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp.toISOString(),
          toolCalls: msg.toolCalls,
        })),
        quotaUsed: session.quotaUsed,
        createdAt: session.createdAt.toISOString(),
        lastActivityAt: session.lastActivityAt.toISOString(),
      };

      logger.info('Conversation retrieved', {
        userId,
        sessionId,
        messageCount: session.messages.length,
      });

      return c.json({ conversation });
    } catch (err) {
      logger.error('Get conversation error', err instanceof Error ? err : undefined, { userId, sessionId });
      return c.json({ error: 'FETCH_FAILED', message: getUserFriendlyMessage(err) }, 500);
    }
  }
);

/**
 * GET /api/conversations/:id/messages
 * Get messages for a specific conversation with pagination.
 */
conversationsRouter.get(
  '/:id/messages',
  requirePremiumOrAdmin,
  async (c: Context<{ Variables: AuthContext }>) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userId = user.sub;
    const sessionId = c.req.param('id');
    const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 100);
    const offset = parseInt(c.req.query('offset') || '0', 10);

    try {
      const sessionStore = getSessionStore();
      const session = await sessionStore.getSession(sessionId, userId);

      if (!session) {
        return c.json({ error: 'NOT_FOUND', message: '会話が見つかりません' }, 404);
      }

      const allMessages = session.messages;
      const paginatedMessages = allMessages.slice(offset, offset + limit);

      const messages = paginatedMessages.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp.toISOString(),
        toolCalls: msg.toolCalls,
      }));

      return c.json({
        messages,
        total: allMessages.length,
        limit,
        offset,
        hasMore: offset + limit < allMessages.length,
      });
    } catch (err) {
      logger.error('Get messages error', err instanceof Error ? err : undefined, { userId, sessionId });
      return c.json({ error: 'FETCH_FAILED', message: getUserFriendlyMessage(err) }, 500);
    }
  }
);

/**
 * DELETE /api/conversations/:id
 * Delete a conversation session.
 */
conversationsRouter.delete(
  '/:id',
  requirePremiumOrAdmin,
  async (c: Context<{ Variables: AuthContext }>) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userId = user.sub;
    const sessionId = c.req.param('id');

    try {
      const sessionStore = getSessionStore();

      // Verify session exists and belongs to user
      const session = await sessionStore.getSession(sessionId, userId);
      if (!session) {
        return c.json({ error: 'NOT_FOUND', message: '会話が見つかりません' }, 404);
      }

      await sessionStore.deleteSession(sessionId, userId);

      logger.info('Conversation deleted', { userId, sessionId });

      return c.json({ success: true, message: '会話を削除しました' });
    } catch (err) {
      logger.error('Delete conversation error', err instanceof Error ? err : undefined, { userId, sessionId });
      return c.json({ error: 'DELETE_FAILED', message: getUserFriendlyMessage(err) }, 500);
    }
  }
);

/**
 * GET /api/conversations/stats
 * Get conversation statistics for the user.
 */
conversationsRouter.get(
  '/stats',
  requirePremiumOrAdmin,
  async (c: Context<{ Variables: AuthContext }>) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userId = user.sub;

    try {
      const sessionStore = getSessionStore();
      const sessions = await sessionStore.listUserSessions(userId, 100);

      // Calculate last conversation timestamp
      let lastConversationAt: string | null = null;
      if (sessions.length > 0) {
        const firstSession = sessions[0];
        if (firstSession) {
          const latestDate = sessions.reduce(
            (latest, s) => (s.lastActivityAt > latest ? s.lastActivityAt : latest),
            firstSession.lastActivityAt
          );
          lastConversationAt = latestDate.toISOString();
        }
      }

      const stats = {
        totalConversations: sessions.length,
        totalMessages: sessions.reduce((sum, s) => sum + s.messages.length, 0),
        totalQuotaUsed: sessions.reduce((sum, s) => sum + s.quotaUsed, 0),
        averageMessagesPerConversation: sessions.length > 0
          ? Math.round(sessions.reduce((sum, s) => sum + s.messages.length, 0) / sessions.length)
          : 0,
        lastConversationAt,
      };

      return c.json({ stats });
    } catch (err) {
      logger.error('Get conversation stats error', err instanceof Error ? err : undefined, { userId });
      return c.json({ error: 'FETCH_FAILED', message: getUserFriendlyMessage(err) }, 500);
    }
  }
);

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create the conversations router
 */
export function createConversationsRouter(): Hono<{ Variables: AuthContext }> {
  return conversationsRouter;
}

export { conversationsRouter };
