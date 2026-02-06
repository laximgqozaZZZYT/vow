/**
 * Rate Limit Service for MOC Chat
 *
 * Enforces chat usage limits for free/guest users:
 * - Daily limit: 5 chats per day
 * - Total limit: 100 chats cumulative
 * - IP limit: 20 chats per IP per day (prevents abuse)
 *
 * Premium users and admins are exempt from these limits.
 *
 * @module services/rateLimitService
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('rateLimitService');

/**
 * Rate limit configuration for free users
 */
export const FREE_USER_LIMITS = {
  /** Maximum chats per day */
  dailyLimit: 5,
  /** Maximum cumulative chats */
  totalLimit: 100,
  /** Maximum chats per IP per day (considers multiple users sharing IP) */
  ipDailyLimit: 20,
} as const;

/**
 * Reason for rate limit denial
 */
export type RateLimitReason = 'daily_limit' | 'total_limit' | 'ip_limit';

/**
 * Result of a rate limit check
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Reason if not allowed */
  reason?: RateLimitReason;
  /** Remaining usage counts */
  remaining?: {
    /** Remaining daily chats */
    daily: number;
    /** Remaining total chats */
    total: number;
  };
  /** Current usage counts */
  current?: {
    /** Chats used today */
    dailyUsed: number;
    /** Total chats used */
    totalUsed: number;
  };
}

/**
 * Chat usage record for a user on a specific date
 */
interface ChatUsageRecord {
  id: string;
  user_id: string;
  date: string;
  daily_count: number;
  total_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * IP chat usage record for an IP on a specific date
 */
interface IpChatUsageRecord {
  id: string;
  ip_address: string;
  date: string;
  count: number;
  created_at: string;
  updated_at: string;
}

/**
 * Normalize IP address for consistent storage
 */
function normalizeIpAddress(ip: string | undefined): string {
  if (!ip) return 'unknown';

  // Handle IPv6-mapped IPv4 addresses (::ffff:192.168.1.1 -> 192.168.1.1)
  if (ip.startsWith('::ffff:')) {
    return ip.substring(7);
  }

  // Handle X-Forwarded-For format (first IP is the client)
  if (ip.includes(',')) {
    const firstIp = ip.split(',')[0];
    return firstIp ? firstIp.trim() : 'unknown';
  }

  return ip.trim();
}

/**
 * Get today's date in YYYY-MM-DD format
 */
function getTodayDate(): string {
  const datePart = new Date().toISOString().split('T')[0];
  return datePart ?? new Date().toISOString().substring(0, 10);
}

/**
 * Get the total usage count for a user (cumulative across all days)
 */
async function getUserTotalUsage(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  // Get the most recent record which should have the current total_count
  const { data, error } = await supabase
    .from('chat_usage')
    .select('total_count')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
    logger.error('Failed to get user total usage', error, { userId });
  }

  return data?.total_count ?? 0;
}

/**
 * Get today's usage for a user
 */
async function getUserDailyUsage(
  supabase: SupabaseClient,
  userId: string
): Promise<ChatUsageRecord | null> {
  const today = getTodayDate();

  const { data, error } = await supabase
    .from('chat_usage')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .single();

  if (error && error.code !== 'PGRST116') {
    logger.error('Failed to get user daily usage', error, { userId, today });
  }

  return data;
}

/**
 * Get today's usage for an IP address
 */
async function getIpDailyUsage(
  supabase: SupabaseClient,
  ipAddress: string
): Promise<IpChatUsageRecord | null> {
  const today = getTodayDate();
  const normalizedIp = normalizeIpAddress(ipAddress);

  const { data, error } = await supabase
    .from('ip_chat_usage')
    .select('*')
    .eq('ip_address', normalizedIp)
    .eq('date', today)
    .single();

  if (error && error.code !== 'PGRST116') {
    logger.error('Failed to get IP daily usage', error, { ip: normalizedIp, today });
  }

  return data;
}

/**
 * Check if a chat request is allowed based on rate limits
 *
 * @param supabase - Supabase client
 * @param userId - User ID (required for authenticated users)
 * @param ipAddress - Client IP address
 * @param isPremium - Whether user has premium subscription
 * @returns Rate limit check result
 */
export async function checkChatRateLimit(
  supabase: SupabaseClient,
  userId: string | null,
  ipAddress: string,
  isPremium: boolean
): Promise<RateLimitResult> {
  // Premium users have no limits
  if (isPremium) {
    logger.info('Premium user bypassing rate limit', { userId });
    return { allowed: true };
  }

  const normalizedIp = normalizeIpAddress(ipAddress);

  // If no userId, only check IP limit (guest user)
  if (!userId) {
    const ipUsage = await getIpDailyUsage(supabase, normalizedIp);
    const ipCount = ipUsage?.count ?? 0;

    if (ipCount >= FREE_USER_LIMITS.ipDailyLimit) {
      logger.warning('IP rate limit exceeded for guest', { ip: normalizedIp, count: ipCount });
      return {
        allowed: false,
        reason: 'ip_limit',
      };
    }

    // Guest users always allowed if IP limit not exceeded
    return { allowed: true };
  }

  // Get user's daily and total usage
  const [dailyUsage, totalUsage, ipUsage] = await Promise.all([
    getUserDailyUsage(supabase, userId),
    getUserTotalUsage(supabase, userId),
    getIpDailyUsage(supabase, normalizedIp),
  ]);

  const dailyCount = dailyUsage?.daily_count ?? 0;
  const totalCount = totalUsage;
  const ipCount = ipUsage?.count ?? 0;

  // Check total limit first (most restrictive)
  if (totalCount >= FREE_USER_LIMITS.totalLimit) {
    logger.warning('Total rate limit exceeded', { userId, totalCount });
    return {
      allowed: false,
      reason: 'total_limit',
      remaining: {
        daily: Math.max(0, FREE_USER_LIMITS.dailyLimit - dailyCount),
        total: 0,
      },
      current: {
        dailyUsed: dailyCount,
        totalUsed: totalCount,
      },
    };
  }

  // Check daily limit
  if (dailyCount >= FREE_USER_LIMITS.dailyLimit) {
    logger.warning('Daily rate limit exceeded', { userId, dailyCount });
    return {
      allowed: false,
      reason: 'daily_limit',
      remaining: {
        daily: 0,
        total: Math.max(0, FREE_USER_LIMITS.totalLimit - totalCount),
      },
      current: {
        dailyUsed: dailyCount,
        totalUsed: totalCount,
      },
    };
  }

  // Check IP limit
  if (ipCount >= FREE_USER_LIMITS.ipDailyLimit) {
    logger.warning('IP rate limit exceeded', { userId, ip: normalizedIp, ipCount });
    return {
      allowed: false,
      reason: 'ip_limit',
      remaining: {
        daily: Math.max(0, FREE_USER_LIMITS.dailyLimit - dailyCount),
        total: Math.max(0, FREE_USER_LIMITS.totalLimit - totalCount),
      },
      current: {
        dailyUsed: dailyCount,
        totalUsed: totalCount,
      },
    };
  }

  // All checks passed
  return {
    allowed: true,
    remaining: {
      daily: FREE_USER_LIMITS.dailyLimit - dailyCount - 1, // -1 for current request
      total: FREE_USER_LIMITS.totalLimit - totalCount - 1,
    },
    current: {
      dailyUsed: dailyCount,
      totalUsed: totalCount,
    },
  };
}

/**
 * Increment chat usage counters after a successful chat
 *
 * @param supabase - Supabase client
 * @param userId - User ID (null for guest users)
 * @param ipAddress - Client IP address
 */
export async function incrementChatUsage(
  supabase: SupabaseClient,
  userId: string | null,
  ipAddress: string
): Promise<void> {
  const today = getTodayDate();
  const normalizedIp = normalizeIpAddress(ipAddress);

  // Always increment IP usage
  const ipIncrementPromise = (async () => {
    const existingIpUsage = await getIpDailyUsage(supabase, normalizedIp);

    if (existingIpUsage) {
      // Update existing record
      const { error } = await supabase
        .from('ip_chat_usage')
        .update({ count: existingIpUsage.count + 1 })
        .eq('id', existingIpUsage.id);

      if (error) {
        logger.error('Failed to increment IP usage', error, { ip: normalizedIp });
      }
    } else {
      // Insert new record
      const { error } = await supabase
        .from('ip_chat_usage')
        .insert({
          ip_address: normalizedIp,
          date: today,
          count: 1,
        });

      if (error) {
        logger.error('Failed to create IP usage record', error, { ip: normalizedIp });
      }
    }
  })();

  // Increment user usage if authenticated
  const userIncrementPromise = userId
    ? (async () => {
        const existingUsage = await getUserDailyUsage(supabase, userId);
        const totalUsage = await getUserTotalUsage(supabase, userId);

        if (existingUsage) {
          // Update existing daily record
          const { error } = await supabase
            .from('chat_usage')
            .update({
              daily_count: existingUsage.daily_count + 1,
              total_count: totalUsage + 1,
            })
            .eq('id', existingUsage.id);

          if (error) {
            logger.error('Failed to increment user usage', error, { userId });
          }
        } else {
          // Insert new daily record
          const { error } = await supabase
            .from('chat_usage')
            .insert({
              user_id: userId,
              date: today,
              daily_count: 1,
              total_count: totalUsage + 1,
            });

          if (error) {
            logger.error('Failed to create user usage record', error, { userId });
          }
        }
      })()
    : Promise.resolve();

  // Execute both in parallel
  await Promise.all([ipIncrementPromise, userIncrementPromise]);

  logger.info('Chat usage incremented', {
    userId: userId ?? 'guest',
    ip: normalizedIp,
    date: today,
  });
}

/**
 * Get current usage statistics for a user
 *
 * @param supabase - Supabase client
 * @param userId - User ID
 * @returns Current usage stats
 */
export async function getChatUsageStats(
  supabase: SupabaseClient,
  userId: string
): Promise<{
  dailyUsed: number;
  dailyLimit: number;
  totalUsed: number;
  totalLimit: number;
  dailyRemaining: number;
  totalRemaining: number;
}> {
  const [dailyUsage, totalUsage] = await Promise.all([
    getUserDailyUsage(supabase, userId),
    getUserTotalUsage(supabase, userId),
  ]);

  const dailyUsed = dailyUsage?.daily_count ?? 0;
  const totalUsed = totalUsage;

  return {
    dailyUsed,
    dailyLimit: FREE_USER_LIMITS.dailyLimit,
    totalUsed,
    totalLimit: FREE_USER_LIMITS.totalLimit,
    dailyRemaining: Math.max(0, FREE_USER_LIMITS.dailyLimit - dailyUsed),
    totalRemaining: Math.max(0, FREE_USER_LIMITS.totalLimit - totalUsed),
  };
}

/**
 * Clean up old usage records (optional maintenance function)
 * Can be called by a scheduled job to remove records older than 30 days
 *
 * @param supabase - Supabase client
 * @param daysToKeep - Number of days of records to keep (default: 30)
 */
export async function cleanupOldUsageRecords(
  supabase: SupabaseClient,
  daysToKeep: number = 30
): Promise<{ chatUsageDeleted: number; ipUsageDeleted: number }> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

  // Note: We don't delete chat_usage records because we need total_count
  // Instead, we only clean up ip_chat_usage which is purely daily tracking

  const { data: ipData, error: ipError } = await supabase
    .from('ip_chat_usage')
    .delete()
    .lt('date', cutoffDateStr)
    .select('id');

  if (ipError) {
    logger.error('Failed to cleanup old IP usage records', ipError);
  }

  const ipUsageDeleted = ipData?.length ?? 0;

  logger.info('Old usage records cleaned up', {
    cutoffDate: cutoffDateStr,
    ipUsageDeleted,
  });

  return {
    chatUsageDeleted: 0, // We keep chat_usage for total tracking
    ipUsageDeleted,
  };
}
