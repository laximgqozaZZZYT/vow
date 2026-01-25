/**
 * Notices Router
 *
 * API endpoints for managing in-app notifications.
 *
 * Requirements: 12.1
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { getSupabaseClient } from '../utils/supabase.js';
import { getNoticeService } from '../services/noticeService.js';
import { getLogger } from '../utils/logger.js';
import type { AuthContext } from '../middleware/auth.js';

const logger = getLogger('noticesRouter');

// Create router
const noticesRouter = new Hono<{ Variables: AuthContext }>();

/**
 * GET /api/notices
 * Get notices for the authenticated user.
 *
 * Query params:
 * - unreadOnly: boolean (optional)
 * - type: string (optional)
 * - limit: number (optional, default 50)
 * - offset: number (optional, default 0)
 */
noticesRouter.get('/', async (c: Context<{ Variables: AuthContext }>) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const userId = user.sub;
  const unreadOnly = c.req.query('unreadOnly') === 'true';
  const type = c.req.query('type');
  const limit = parseInt(c.req.query('limit') || '50', 10);
  const offset = parseInt(c.req.query('offset') || '0', 10);

  try {
    const supabase = getSupabaseClient();
    const noticeService = getNoticeService(supabase);

    const notices = await noticeService.getNotices(userId, {
      unreadOnly,
      type: type as any,
      limit,
      offset,
    });

    const unreadCount = await noticeService.getUnreadCount(userId);

    return c.json({
      notices,
      unreadCount,
      pagination: {
        limit,
        offset,
        hasMore: notices.length === limit,
      },
    });
  } catch (err) {
    logger.error('Get notices error', err instanceof Error ? err : undefined);
    return c.json({ error: 'Failed to get notices' }, 500);
  }
});

/**
 * GET /api/notices/unread-count
 * Get unread notice count for the authenticated user.
 */
noticesRouter.get('/unread-count', async (c: Context<{ Variables: AuthContext }>) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const userId = user.sub;

  try {
    const supabase = getSupabaseClient();
    const noticeService = getNoticeService(supabase);

    const count = await noticeService.getUnreadCount(userId);

    return c.json({ unreadCount: count });
  } catch (err) {
    logger.error('Get unread count error', err instanceof Error ? err : undefined);
    return c.json({ error: 'Failed to get unread count' }, 500);
  }
});

/**
 * PATCH /api/notices/:id/read
 * Mark a notice as read.
 */
const markReadSchema = z.object({
  id: z.string().uuid(),
});

noticesRouter.patch(
  '/:id/read',
  zValidator('param', markReadSchema),
  async (c: Context<{ Variables: AuthContext }>) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userId = user.sub;
    const noticeId = c.req.param('id');

    try {
      const supabase = getSupabaseClient();
      const noticeService = getNoticeService(supabase);

      await noticeService.markAsRead(userId, noticeId);

      return c.json({ success: true });
    } catch (err) {
      logger.error('Mark as read error', err instanceof Error ? err : undefined);
      return c.json({ error: 'Failed to mark notice as read' }, 500);
    }
  }
);

/**
 * POST /api/notices/read-all
 * Mark all notices as read.
 */
noticesRouter.post('/read-all', async (c: Context<{ Variables: AuthContext }>) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const userId = user.sub;

  try {
    const supabase = getSupabaseClient();
    const noticeService = getNoticeService(supabase);

    await noticeService.markAllAsRead(userId);

    return c.json({ success: true });
  } catch (err) {
    logger.error('Mark all as read error', err instanceof Error ? err : undefined);
    return c.json({ error: 'Failed to mark all notices as read' }, 500);
  }
});

/**
 * DELETE /api/notices/:id
 * Delete a notice.
 */
noticesRouter.delete(
  '/:id',
  zValidator('param', markReadSchema),
  async (c: Context<{ Variables: AuthContext }>) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userId = user.sub;
    const noticeId = c.req.param('id');

    try {
      const supabase = getSupabaseClient();
      const noticeService = getNoticeService(supabase);

      await noticeService.deleteNotice(userId, noticeId);

      return c.json({ success: true });
    } catch (err) {
      logger.error('Delete notice error', err instanceof Error ? err : undefined);
      return c.json({ error: 'Failed to delete notice' }, 500);
    }
  }
);

export { noticesRouter };
