/**
 * Notification Service
 *
 * Multi-channel notification delivery service supporting in-app, Slack, and Web Push notifications.
 *
 * Requirements: 12.2, 12.3, 12.4
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getLogger } from '../utils/logger.js';
import { getNoticeService, type NoticeType } from './noticeService.js';

const logger = getLogger('notificationService');

// ============================================================================
// Types
// ============================================================================

export interface NotificationPayload {
  type: NoticeType;
  title: string;
  message: string;
  channels: ('in_app' | 'slack' | 'web_push')[];
  actionUrl?: string;
  actionType?: string;
  actionPayload?: Record<string, any>;
}

export interface NotificationPreferences {
  // In-app notifications
  inApp: {
    workloadCoaching: boolean;
    tokenWarning: boolean;
    weeklyReport: boolean;
  };
  // Slack notifications
  slack: {
    enabled: boolean;
    workloadCoaching: boolean;
    tokenWarning: boolean;
    weeklyReport: boolean;
    notificationTime: string; // HH:MM format
  };
  // Web Push notifications
  webPush: {
    enabled: boolean;
    dailyReminder: boolean;
    dailyReminderTime: string; // HH:MM format
    workloadCoaching: boolean;
  };
}

export interface WebPushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: {
    url?: string;
    actionType?: string;
    actionPayload?: Record<string, any>;
  };
}

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string;
}

interface PushSubscriptionRecord {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
  createdAt: string;
}

// Default notification preferences
const DEFAULT_PREFERENCES: NotificationPreferences = {
  inApp: {
    workloadCoaching: true,
    tokenWarning: true,
    weeklyReport: true,
  },
  slack: {
    enabled: false,
    workloadCoaching: false,
    tokenWarning: true,
    weeklyReport: true,
    notificationTime: '09:00',
  },
  webPush: {
    enabled: false,
    dailyReminder: false,
    dailyReminderTime: '08:00',
    workloadCoaching: false,
  },
};

// ============================================================================
// Notification Service
// ============================================================================

export interface NotificationService {
  sendNotification(userId: string, notification: NotificationPayload): Promise<void>;
  sendSlackNotification(userId: string, title: string, message: string): Promise<void>;
  sendWebPushNotification(userId: string, payload: WebPushPayload): Promise<void>;
  getUserNotificationPreferences(userId: string): Promise<NotificationPreferences>;
  updateNotificationPreferences(userId: string, preferences: Partial<NotificationPreferences>): Promise<void>;
  registerPushSubscription(userId: string, subscription: PushSubscription): Promise<void>;
  unregisterPushSubscription(userId: string, endpoint?: string): Promise<void>;
  getPushSubscriptions(userId: string): Promise<PushSubscriptionRecord[]>;
}

class NotificationServiceImpl implements NotificationService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Send notification to user via enabled channels
   */
  async sendNotification(userId: string, notification: NotificationPayload): Promise<void> {
    const preferences = await this.getUserNotificationPreferences(userId);
    const { type, title, message, channels, actionType, actionPayload } = notification;

    const deliveryPromises: Promise<void>[] = [];

    // In-app notification
    if (channels.includes('in_app') && this.shouldSendInApp(type, preferences)) {
      deliveryPromises.push(this.sendInAppNotification(userId, notification));
    }

    // Slack notification
    if (channels.includes('slack') && this.shouldSendSlack(type, preferences)) {
      deliveryPromises.push(this.sendSlackNotification(userId, title, message));
    }

    // Web Push notification
    if (channels.includes('web_push') && this.shouldSendWebPush(type, preferences)) {
      const webPushPayload: WebPushPayload = {
        title,
        body: message,
      };
      
      const webPushData: { url?: string; actionType?: string; actionPayload?: Record<string, any> } = {};
      if (notification.actionUrl) webPushData.url = notification.actionUrl;
      if (actionType) webPushData.actionType = actionType;
      if (actionPayload) webPushData.actionPayload = actionPayload;
      
      if (Object.keys(webPushData).length > 0) {
        webPushPayload.data = webPushData;
      }
      
      deliveryPromises.push(this.sendWebPushNotification(userId, webPushPayload));
    }

    // Execute all deliveries in parallel
    const results = await Promise.allSettled(deliveryPromises);
    
    // Log any failures
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        logger.error('Notification delivery failed', new Error(result.reason), {
          userId,
          channel: channels[index],
          type,
        });
      }
    });
  }

  /**
   * Send in-app notification via NoticeService
   */
  private async sendInAppNotification(userId: string, notification: NotificationPayload): Promise<void> {
    const noticeService = getNoticeService(this.supabase);
    
    // Map actionType to NoticeActionType
    type NoticeActionTypeValue = 'coaching_proposal' | 'recovery_proposal' | 'token_warning' | 'subscription' | 'habit_suggestion';
    const actionTypeMap: Record<string, NoticeActionTypeValue> = {
      'coaching_proposal': 'coaching_proposal',
      'recovery_proposal': 'recovery_proposal',
      'token_warning': 'token_warning',
      'subscription': 'subscription',
      'habit_suggestion': 'habit_suggestion',
    };
    
    const noticeActionType = notification.actionType ? actionTypeMap[notification.actionType] : undefined;
    
    if (noticeActionType) {
      if (notification.actionPayload) {
        await noticeService.createNotice(userId, {
          type: notification.type,
          title: notification.title,
          message: notification.message,
          actionType: noticeActionType,
          actionPayload: notification.actionPayload,
        });
      } else {
        await noticeService.createNotice(userId, {
          type: notification.type,
          title: notification.title,
          message: notification.message,
          actionType: noticeActionType,
        });
      }
    } else {
      await noticeService.createNotice(userId, {
        type: notification.type,
        title: notification.title,
        message: notification.message,
      });
    }
  }

  /**
   * Check if in-app notification should be sent based on preferences
   */
  private shouldSendInApp(type: NoticeType, preferences: NotificationPreferences): boolean {
    switch (type) {
      case 'workload_coaching':
      case 'habit_recovery':
        return preferences.inApp.workloadCoaching;
      case 'token_warning_70':
      case 'token_warning_90':
      case 'token_exhausted':
        return preferences.inApp.tokenWarning;
      case 'weekly_report':
        return preferences.inApp.weeklyReport;
      default:
        return true; // Default to sending for other types
    }
  }

  /**
   * Check if Slack notification should be sent based on preferences
   */
  private shouldSendSlack(type: NoticeType, preferences: NotificationPreferences): boolean {
    if (!preferences.slack.enabled) return false;

    switch (type) {
      case 'workload_coaching':
      case 'habit_recovery':
        return preferences.slack.workloadCoaching;
      case 'token_warning_70':
      case 'token_warning_90':
      case 'token_exhausted':
        return preferences.slack.tokenWarning;
      case 'weekly_report':
        return preferences.slack.weeklyReport;
      default:
        return true;
    }
  }

  /**
   * Check if Web Push notification should be sent based on preferences
   */
  private shouldSendWebPush(type: NoticeType, preferences: NotificationPreferences): boolean {
    if (!preferences.webPush.enabled) return false;

    switch (type) {
      case 'workload_coaching':
      case 'habit_recovery':
        return preferences.webPush.workloadCoaching;
      default:
        return false; // Web Push is more limited by default
    }
  }

  /**
   * Send Slack notification to user
   */
  async sendSlackNotification(userId: string, title: string, message: string): Promise<void> {
    // Get user's Slack connection
    const { data: connection, error } = await this.supabase
      .from('slack_connections')
      .select('slack_user_id, access_token')
      .eq('user_id', userId)
      .single();

    if (error || !connection) {
      logger.warning('No Slack connection found for user', { userId });
      return;
    }

    // Send DM via Slack API
    try {
      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${connection.access_token}`,
        },
        body: JSON.stringify({
          channel: connection.slack_user_id,
          text: `*${title}*\n${message}`,
          mrkdwn: true,
        }),
      });

      const result = await response.json() as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? 'Slack API error');
      }

      logger.info('Slack notification sent', { userId });
    } catch (err) {
      logger.error('Failed to send Slack notification', err instanceof Error ? err : undefined, { userId });
      throw err;
    }
  }

  /**
   * Send Web Push notification to user
   */
  async sendWebPushNotification(userId: string, payload: WebPushPayload): Promise<void> {
    const subscriptions = await this.getPushSubscriptions(userId);

    if (subscriptions.length === 0) {
      logger.warning('No push subscriptions found for user', { userId });
      return;
    }

    // Web Push requires VAPID keys - check if configured
    const vapidPublicKey = process.env['VAPID_PUBLIC_KEY'];
    const vapidPrivateKey = process.env['VAPID_PRIVATE_KEY'];

    if (!vapidPublicKey || !vapidPrivateKey) {
      logger.warning('VAPID keys not configured, skipping Web Push');
      return;
    }

    // Send to all subscriptions
    for (const subscription of subscriptions) {
      try {
        // Use web-push library if available
        // For now, log that we would send
        logger.info('Would send Web Push notification', {
          userId,
          endpoint: subscription.endpoint.substring(0, 50) + '...',
          title: payload.title,
        });

        // TODO: Implement actual web-push sending
        // const webpush = await import('web-push');
        // webpush.setVapidDetails('mailto:support@vow.app', vapidPublicKey, vapidPrivateKey);
        // await webpush.sendNotification(
        //   { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        //   JSON.stringify(payload)
        // );
      } catch (err) {
        logger.error('Failed to send Web Push', err instanceof Error ? err : undefined, {
          userId,
          endpoint: subscription.endpoint.substring(0, 50),
        });

        // If subscription is invalid, remove it
        if (err instanceof Error && err.message.includes('410')) {
          await this.unregisterPushSubscription(userId, subscription.endpoint);
        }
      }
    }
  }

  /**
   * Get user's notification preferences
   */
  async getUserNotificationPreferences(userId: string): Promise<NotificationPreferences> {
    const { data, error } = await this.supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      // Return defaults if no preferences set
      return DEFAULT_PREFERENCES;
    }

    return {
      inApp: {
        workloadCoaching: data.in_app_workload_coaching ?? true,
        tokenWarning: data.in_app_token_warning ?? true,
        weeklyReport: data.in_app_weekly_report ?? true,
      },
      slack: {
        enabled: data.slack_enabled ?? false,
        workloadCoaching: data.slack_workload_coaching ?? false,
        tokenWarning: data.slack_token_warning ?? true,
        weeklyReport: data.slack_weekly_report ?? true,
        notificationTime: data.slack_notification_time ?? '09:00',
      },
      webPush: {
        enabled: data.web_push_enabled ?? false,
        dailyReminder: data.web_push_daily_reminder ?? false,
        dailyReminderTime: data.web_push_daily_reminder_time ?? '08:00',
        workloadCoaching: data.web_push_workload_coaching ?? false,
      },
    };
  }

  /**
   * Update user's notification preferences
   */
  async updateNotificationPreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>
  ): Promise<void> {
    // Build update payload
    const updateData: Record<string, any> = {
      user_id: userId,
      updated_at: new Date().toISOString(),
    };

    if (preferences.inApp) {
      if (preferences.inApp.workloadCoaching !== undefined) {
        updateData['in_app_workload_coaching'] = preferences.inApp.workloadCoaching;
      }
      if (preferences.inApp.tokenWarning !== undefined) {
        updateData['in_app_token_warning'] = preferences.inApp.tokenWarning;
      }
      if (preferences.inApp.weeklyReport !== undefined) {
        updateData['in_app_weekly_report'] = preferences.inApp.weeklyReport;
      }
    }

    if (preferences.slack) {
      if (preferences.slack.enabled !== undefined) {
        updateData['slack_enabled'] = preferences.slack.enabled;
      }
      if (preferences.slack.workloadCoaching !== undefined) {
        updateData['slack_workload_coaching'] = preferences.slack.workloadCoaching;
      }
      if (preferences.slack.tokenWarning !== undefined) {
        updateData['slack_token_warning'] = preferences.slack.tokenWarning;
      }
      if (preferences.slack.weeklyReport !== undefined) {
        updateData['slack_weekly_report'] = preferences.slack.weeklyReport;
      }
      if (preferences.slack.notificationTime !== undefined) {
        updateData['slack_notification_time'] = preferences.slack.notificationTime;
      }
    }

    if (preferences.webPush) {
      if (preferences.webPush.enabled !== undefined) {
        updateData['web_push_enabled'] = preferences.webPush.enabled;
      }
      if (preferences.webPush.dailyReminder !== undefined) {
        updateData['web_push_daily_reminder'] = preferences.webPush.dailyReminder;
      }
      if (preferences.webPush.dailyReminderTime !== undefined) {
        updateData['web_push_daily_reminder_time'] = preferences.webPush.dailyReminderTime;
      }
      if (preferences.webPush.workloadCoaching !== undefined) {
        updateData['web_push_workload_coaching'] = preferences.webPush.workloadCoaching;
      }
    }

    // Upsert preferences
    const { error } = await this.supabase
      .from('notification_preferences')
      .upsert(updateData, { onConflict: 'user_id' });

    if (error) {
      logger.error('Failed to update notification preferences', new Error(error.message), { userId });
      throw new Error('Failed to update notification preferences');
    }
  }

  /**
   * Register a Web Push subscription
   */
  async registerPushSubscription(userId: string, subscription: PushSubscription): Promise<void> {
    const { error } = await this.supabase.from('push_subscriptions').upsert(
      {
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        user_agent: subscription.userAgent,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' }
    );

    if (error) {
      logger.error('Failed to register push subscription', new Error(error.message), { userId });
      throw new Error('Failed to register push subscription');
    }

    // Enable web push in preferences
    await this.updateNotificationPreferences(userId, {
      webPush: { enabled: true, dailyReminder: false, dailyReminderTime: '08:00', workloadCoaching: false },
    });

    logger.info('Push subscription registered', { userId });
  }

  /**
   * Unregister a Web Push subscription
   */
  async unregisterPushSubscription(userId: string, endpoint?: string): Promise<void> {
    let query = this.supabase.from('push_subscriptions').delete().eq('user_id', userId);

    if (endpoint) {
      query = query.eq('endpoint', endpoint);
    }

    const { error } = await query;

    if (error) {
      logger.error('Failed to unregister push subscription', new Error(error.message), { userId });
      throw new Error('Failed to unregister push subscription');
    }

    // If removing all subscriptions, disable web push
    if (!endpoint) {
      await this.updateNotificationPreferences(userId, {
        webPush: { enabled: false, dailyReminder: false, dailyReminderTime: '08:00', workloadCoaching: false },
      });
    }

    logger.info('Push subscription unregistered', { userId, endpoint: endpoint?.substring(0, 50) });
  }

  /**
   * Get all push subscriptions for a user
   */
  async getPushSubscriptions(userId: string): Promise<PushSubscriptionRecord[]> {
    const { data, error } = await this.supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      logger.error('Failed to get push subscriptions', new Error(error.message), { userId });
      return [];
    }

    return (data || []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      endpoint: row.endpoint,
      p256dh: row.p256dh,
      auth: row.auth,
      userAgent: row.user_agent,
      createdAt: row.created_at,
    }));
  }
}

// ============================================================================
// Factory Function
// ============================================================================

let notificationServiceInstance: NotificationService | null = null;

export function getNotificationService(supabase: SupabaseClient): NotificationService {
  if (!notificationServiceInstance) {
    notificationServiceInstance = new NotificationServiceImpl(supabase);
  }
  return notificationServiceInstance;
}

// Reset for testing
export function resetNotificationService(): void {
  notificationServiceInstance = null;
}
