/**
 * Notifications Router
 *
 * API endpoints for managing notification preferences and push subscriptions.
 *
 * Requirements: 12.4
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { getSupabaseClient } from '../utils/supabase.js';
import { getNotificationService } from '../services/notificationService.js';
import { getLogger } from '../utils/logger.js';
import type { AuthContext } from '../middleware/auth.js';

const logger = getLogger('notificationsRouter');

// Create router
const notificationsRouter = new Hono<{ Variables: AuthContext }>();

// ============================================================================
// Schemas
// ============================================================================

const preferencesUpdateSchema = z.object({
  inApp: z.object({
    workloadCoaching: z.boolean().optional(),
    tokenWarning: z.boolean().optional(),
    weeklyReport: z.boolean().optional(),
  }).optional(),
  slack: z.object({
    enabled: z.boolean().optional(),
    workloadCoaching: z.boolean().optional(),
    tokenWarning: z.boolean().optional(),
    weeklyReport: z.boolean().optional(),
    notificationTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  }).optional(),
  webPush: z.object({
    enabled: z.boolean().optional(),
    dailyReminder: z.boolean().optional(),
    dailyReminderTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    workloadCoaching: z.boolean().optional(),
  }).optional(),
});

const pushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
  userAgent: z.string().optional(),
});

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /api/notifications/preferences
 * Get notification preferences for the authenticated user.
 */
notificationsRouter.get('/preferences', async (c: Context<{ Variables: AuthContext }>) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const userId = user['id'] as string;

  try {
    const supabase = getSupabaseClient();
    const notificationService = getNotificationService(supabase);

    const preferences = await notificationService.getUserNotificationPreferences(userId);

    return c.json({ preferences });
  } catch (err) {
    logger.error('Get preferences error', err instanceof Error ? err : undefined);
    return c.json({ error: 'Failed to get notification preferences' }, 500);
  }
});

/**
 * PUT /api/notifications/preferences
 * Update notification preferences for the authenticated user.
 */
notificationsRouter.put(
  '/preferences',
  zValidator('json', preferencesUpdateSchema),
  async (c: Context<{ Variables: AuthContext }>) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userId = user['id'] as string;
    const body = await c.req.json();
    const parseResult = preferencesUpdateSchema.safeParse(body);
    if (!parseResult.success) {
      return c.json({ error: 'Invalid request body' }, 400);
    }
    const updates = parseResult.data;

    try {
      const supabase = getSupabaseClient();
      const notificationService = getNotificationService(supabase);

      // Build properly typed update object
      const typedUpdates: {
        inApp?: { workloadCoaching: boolean; tokenWarning: boolean; weeklyReport: boolean };
        slack?: { enabled: boolean; workloadCoaching: boolean; tokenWarning: boolean; weeklyReport: boolean; notificationTime: string };
        webPush?: { enabled: boolean; dailyReminder: boolean; dailyReminderTime: string; workloadCoaching: boolean };
      } = {};

      // Get current preferences to merge with updates
      const currentPrefs = await notificationService.getUserNotificationPreferences(userId);

      if (updates.inApp) {
        typedUpdates.inApp = {
          workloadCoaching: updates.inApp.workloadCoaching ?? currentPrefs.inApp.workloadCoaching,
          tokenWarning: updates.inApp.tokenWarning ?? currentPrefs.inApp.tokenWarning,
          weeklyReport: updates.inApp.weeklyReport ?? currentPrefs.inApp.weeklyReport,
        };
      }

      if (updates.slack) {
        typedUpdates.slack = {
          enabled: updates.slack.enabled ?? currentPrefs.slack.enabled,
          workloadCoaching: updates.slack.workloadCoaching ?? currentPrefs.slack.workloadCoaching,
          tokenWarning: updates.slack.tokenWarning ?? currentPrefs.slack.tokenWarning,
          weeklyReport: updates.slack.weeklyReport ?? currentPrefs.slack.weeklyReport,
          notificationTime: updates.slack.notificationTime ?? currentPrefs.slack.notificationTime,
        };
      }

      if (updates.webPush) {
        typedUpdates.webPush = {
          enabled: updates.webPush.enabled ?? currentPrefs.webPush.enabled,
          dailyReminder: updates.webPush.dailyReminder ?? currentPrefs.webPush.dailyReminder,
          dailyReminderTime: updates.webPush.dailyReminderTime ?? currentPrefs.webPush.dailyReminderTime,
          workloadCoaching: updates.webPush.workloadCoaching ?? currentPrefs.webPush.workloadCoaching,
        };
      }

      await notificationService.updateNotificationPreferences(userId, typedUpdates);

      // Return updated preferences
      const preferences = await notificationService.getUserNotificationPreferences(userId);

      return c.json({ preferences });
    } catch (err) {
      logger.error('Update preferences error', err instanceof Error ? err : undefined);
      return c.json({ error: 'Failed to update notification preferences' }, 500);
    }
  }
);

/**
 * POST /api/notifications/push-subscription
 * Register a Web Push subscription.
 */
notificationsRouter.post(
  '/push-subscription',
  zValidator('json', pushSubscriptionSchema),
  async (c: Context<{ Variables: AuthContext }>) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userId = user['id'] as string;
    const body = await c.req.json();
    const parseResult = pushSubscriptionSchema.safeParse(body);
    if (!parseResult.success) {
      return c.json({ error: 'Invalid request body' }, 400);
    }
    const subscription = parseResult.data;

    try {
      const supabase = getSupabaseClient();
      const notificationService = getNotificationService(supabase);

      const pushSub: { endpoint: string; keys: { p256dh: string; auth: string }; userAgent?: string } = {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      };
      if (subscription.userAgent) {
        pushSub.userAgent = subscription.userAgent;
      }

      await notificationService.registerPushSubscription(userId, pushSub);

      return c.json({ success: true });
    } catch (err) {
      logger.error('Register push subscription error', err instanceof Error ? err : undefined);
      return c.json({ error: 'Failed to register push subscription' }, 500);
    }
  }
);

/**
 * DELETE /api/notifications/push-subscription
 * Unregister a Web Push subscription.
 */
notificationsRouter.delete('/push-subscription', async (c: Context<{ Variables: AuthContext }>) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const userId = user['id'] as string;
  const endpoint = c.req.query('endpoint');

  try {
    const supabase = getSupabaseClient();
    const notificationService = getNotificationService(supabase);

    await notificationService.unregisterPushSubscription(userId, endpoint);

    return c.json({ success: true });
  } catch (err) {
    logger.error('Unregister push subscription error', err instanceof Error ? err : undefined);
    return c.json({ error: 'Failed to unregister push subscription' }, 500);
  }
});

/**
 * GET /api/notifications/push-subscriptions
 * Get all push subscriptions for the authenticated user.
 */
notificationsRouter.get('/push-subscriptions', async (c: Context<{ Variables: AuthContext }>) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const userId = user['id'] as string;

  try {
    const supabase = getSupabaseClient();
    const notificationService = getNotificationService(supabase);

    const subscriptions = await notificationService.getPushSubscriptions(userId);

    return c.json({
      subscriptions: subscriptions.map(s => ({
        id: s.id,
        endpoint: s.endpoint.substring(0, 50) + '...', // Truncate for privacy
        userAgent: s.userAgent,
        createdAt: s.createdAt,
      })),
    });
  } catch (err) {
    logger.error('Get push subscriptions error', err instanceof Error ? err : undefined);
    return c.json({ error: 'Failed to get push subscriptions' }, 500);
  }
});

export { notificationsRouter };
