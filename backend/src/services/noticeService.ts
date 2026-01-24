/**
 * Notice Service
 *
 * Manages in-app notifications for users.
 *
 * Requirements: 12.1, 12.2
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('noticeService');

/**
 * Notice types for in-app notifications.
 */
export type NoticeType =
  | 'workload_coaching'
  | 'habit_recovery'
  | 'token_warning_70'
  | 'token_warning_90'
  | 'token_exhausted'
  | 'subscription_renewed'
  | 'subscription_payment_failed'
  | 'habit_suggestion'
  | 'weekly_report';

/**
 * Action types for notices.
 */
export type NoticeActionType =
  | 'coaching_proposal'
  | 'recovery_proposal'
  | 'token_warning'
  | 'subscription'
  | 'habit_suggestion';

/**
 * Notice data from database.
 */
export interface Notice {
  id: string;
  user_id: string;
  type: NoticeType;
  title: string;
  message: string;
  action_type: NoticeActionType | null;
  action_payload: Record<string, unknown> | null;
  read: boolean;
  created_at: string;
}

/**
 * Data for creating a new notice.
 */
export interface NoticeCreate {
  type: NoticeType;
  title: string;
  message: string;
  actionType?: NoticeActionType;
  actionPayload?: Record<string, unknown>;
}

/**
 * Query options for fetching notices.
 */
export interface NoticeQueryOptions {
  unreadOnly?: boolean;
  type?: NoticeType;
  limit?: number;
  offset?: number;
}

/**
 * Notice Service for managing in-app notifications.
 *
 * Requirements:
 * - 12.1: Create and manage notices
 * - 12.2: Display notices in Notice Section
 */
export class NoticeService {
  private readonly supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Create a new notice for a user.
   *
   * Requirements: 12.1
   */
  async createNotice(userId: string, notice: NoticeCreate): Promise<Notice> {
    const { data, error } = await this.supabase
      .from('notices')
      .insert({
        user_id: userId,
        type: notice.type,
        title: notice.title,
        message: notice.message,
        action_type: notice.actionType || null,
        action_payload: notice.actionPayload || null,
        read: false,
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to create notice', new Error(error.message), { userId, type: notice.type });
      throw new Error(`Failed to create notice: ${error.message}`);
    }

    logger.info('Notice created', { userId, type: notice.type, noticeId: data.id });
    return data as Notice;
  }

  /**
   * Get notices for a user.
   *
   * Requirements: 12.1, 12.2
   */
  async getNotices(userId: string, options?: NoticeQueryOptions): Promise<Notice[]> {
    let query = this.supabase
      .from('notices')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (options?.unreadOnly) {
      query = query.eq('read', false);
    }

    if (options?.type) {
      query = query.eq('type', options.type);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Failed to get notices', new Error(error.message), { userId });
      return [];
    }

    return (data || []) as Notice[];
  }

  /**
   * Mark a notice as read.
   *
   * Requirements: 12.1
   */
  async markAsRead(userId: string, noticeId: string): Promise<void> {
    const { error } = await this.supabase
      .from('notices')
      .update({ read: true })
      .eq('id', noticeId)
      .eq('user_id', userId);

    if (error) {
      logger.error('Failed to mark notice as read', new Error(error.message), { userId, noticeId });
      throw new Error(`Failed to mark notice as read: ${error.message}`);
    }

    logger.debug('Notice marked as read', { userId, noticeId });
  }

  /**
   * Mark all notices as read for a user.
   *
   * Requirements: 12.1
   */
  async markAllAsRead(userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('notices')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) {
      logger.error('Failed to mark all notices as read', new Error(error.message), { userId });
      throw new Error(`Failed to mark all notices as read: ${error.message}`);
    }

    logger.info('All notices marked as read', { userId });
  }

  /**
   * Get unread notice count for a user.
   *
   * Requirements: 12.1
   */
  async getUnreadCount(userId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from('notices')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) {
      logger.error('Failed to get unread count', new Error(error.message), { userId });
      return 0;
    }

    return count || 0;
  }

  /**
   * Delete a notice.
   *
   * Requirements: 12.1
   */
  async deleteNotice(userId: string, noticeId: string): Promise<void> {
    const { error } = await this.supabase
      .from('notices')
      .delete()
      .eq('id', noticeId)
      .eq('user_id', userId);

    if (error) {
      logger.error('Failed to delete notice', new Error(error.message), { userId, noticeId });
      throw new Error(`Failed to delete notice: ${error.message}`);
    }

    logger.debug('Notice deleted', { userId, noticeId });
  }

  /**
   * Delete old notices (older than specified days).
   * Used for cleanup.
   */
  async deleteOldNotices(userId: string, daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const { data, error } = await this.supabase
      .from('notices')
      .delete()
      .eq('user_id', userId)
      .lt('created_at', cutoffDate.toISOString())
      .select('id');

    if (error) {
      logger.error('Failed to delete old notices', new Error(error.message), { userId, daysOld });
      return 0;
    }

    const deletedCount = data?.length || 0;
    if (deletedCount > 0) {
      logger.info('Old notices deleted', { userId, deletedCount, daysOld });
    }

    return deletedCount;
  }
}

// Singleton instance
let _noticeService: NoticeService | null = null;

/**
 * Get or create the singleton notice service instance.
 */
export function getNoticeService(supabase: SupabaseClient): NoticeService {
  if (_noticeService === null) {
    _noticeService = new NoticeService(supabase);
  }
  return _noticeService;
}

/**
 * Reset the singleton instance (useful for testing).
 */
export function resetNoticeService(): void {
  _noticeService = null;
}
