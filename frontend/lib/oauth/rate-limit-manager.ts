/**
 * OAuth Rate Limit Manager
 * Implements rate limiting for OAuth endpoints with Redis-like functionality
 */

import { createClient } from '@supabase/supabase-js';
import { SECURITY_CONFIG, RateLimitManager as SecurityRateLimitManager } from './security';

// Supabase client for rate limit operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: Date;
  retryAfter?: number;
}

export interface RateLimitRecord {
  id: string;
  identifier: string;
  endpoint: string;
  request_count: number;
  window_start: string;
  created_at: string;
  updated_at: string;
}

/**
 * OAuth Rate Limit Manager
 */
export class RateLimitManager {
  /**
   * レート制限チェック
   */
  static async checkRateLimit(
    identifier: string,
    endpoint: keyof typeof SECURITY_CONFIG.RATE_LIMITS
  ): Promise<RateLimitResult> {
    try {
      const config = SECURITY_CONFIG.RATE_LIMITS[endpoint];
      const now = new Date();
      const windowStart = new Date(now.getTime() - (now.getTime() % (config.window * 1000)));

      // 現在のウィンドウでのレコードを取得
      const { data, error } = await supabase
        .from('oauth_rate_limits')
        .select('*')
        .eq('identifier', identifier)
        .eq('endpoint', endpoint)
        .eq('window_start', windowStart.toISOString())
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Failed to check rate limit:', error);
        // エラー時は制限なしとして処理を継続
        return {
          allowed: true,
          remaining: config.limit - 1,
          resetTime: new Date(windowStart.getTime() + config.window * 1000),
        };
      }

      const currentCount = data?.request_count || 0;
      const resetTime = new Date(windowStart.getTime() + config.window * 1000);

      // レート制限チェック
      if (currentCount >= config.limit) {
        const retryAfter = Math.ceil((resetTime.getTime() - now.getTime()) / 1000);
        
        return {
          allowed: false,
          remaining: 0,
          resetTime,
          retryAfter,
        };
      }

      return {
        allowed: true,
        remaining: config.limit - currentCount - 1,
        resetTime,
      };
    } catch (error) {
      console.error('Error checking rate limit:', error);
      // エラー時は制限なしとして処理を継続
      const config = SECURITY_CONFIG.RATE_LIMITS[endpoint];
      return {
        allowed: true,
        remaining: config.limit - 1,
        resetTime: new Date(Date.now() + config.window * 1000),
      };
    }
  }

  /**
   * リクエスト記録（レート制限カウンター更新）
   */
  static async recordRequest(
    identifier: string,
    endpoint: keyof typeof SECURITY_CONFIG.RATE_LIMITS
  ): Promise<void> {
    try {
      const config = SECURITY_CONFIG.RATE_LIMITS[endpoint];
      const now = new Date();
      const windowStart = new Date(now.getTime() - (now.getTime() % (config.window * 1000)));

      // UPSERT操作：既存レコードがあれば更新、なければ挿入
      const { error } = await supabase
        .from('oauth_rate_limits')
        .upsert({
          identifier,
          endpoint,
          window_start: windowStart.toISOString(),
          request_count: 1,
          updated_at: now.toISOString(),
        }, {
          onConflict: 'identifier,endpoint,window_start',
          ignoreDuplicates: false,
        });

      if (error) {
        // UPSERTが失敗した場合は手動で更新を試行
        const { error: updateError } = await supabase
          .rpc('increment_rate_limit_counter', {
            p_identifier: identifier,
            p_endpoint: endpoint,
            p_window_start: windowStart.toISOString(),
          });

        if (updateError) {
          console.error('Failed to record request:', updateError);
          // レート制限記録の失敗は処理を停止させない
        }
      }
    } catch (error) {
      console.error('Error recording request:', error);
      // レート制限記録の失敗は処理を停止させない
    }
  }

  /**
   * レート制限リセット
   */
  static async resetRateLimit(
    identifier: string,
    endpoint: keyof typeof SECURITY_CONFIG.RATE_LIMITS
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('oauth_rate_limits')
        .delete()
        .eq('identifier', identifier)
        .eq('endpoint', endpoint);

      if (error) {
        console.error('Failed to reset rate limit:', error);
        throw new Error('Failed to reset rate limit');
      }
    } catch (error) {
      console.error('Error resetting rate limit:', error);
      throw error;
    }
  }

  /**
   * 期限切れレート制限データのクリーンアップ
   */
  static async cleanupExpiredRateLimits(): Promise<number> {
    try {
      // 24時間以上前のデータを削除
      const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const { data, error } = await supabase
        .from('oauth_rate_limits')
        .delete()
        .lt('window_start', cutoffTime.toISOString())
        .select('id');

      if (error) {
        console.error('Failed to cleanup expired rate limits:', error);
        throw new Error('Failed to cleanup expired rate limits');
      }

      const deletedCount = data?.length || 0;
      console.log(`Cleaned up ${deletedCount} expired rate limit records`);
      
      return deletedCount;
    } catch (error) {
      console.error('Error cleaning up expired rate limits:', error);
      throw error;
    }
  }

  /**
   * レート制限統計取得
   */
  static async getRateLimitStats(
    identifier: string,
    endpoint?: keyof typeof SECURITY_CONFIG.RATE_LIMITS
  ): Promise<{
    currentLimits: Array<{
      endpoint: string;
      requestCount: number;
      limit: number;
      remaining: number;
      resetTime: Date;
    }>;
    totalRequests: number;
  }> {
    try {
      let query = supabase
        .from('oauth_rate_limits')
        .select('*')
        .eq('identifier', identifier);

      if (endpoint) {
        query = query.eq('endpoint', endpoint);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Failed to get rate limit stats:', error);
        throw new Error('Failed to get rate limit stats');
      }

      const records = data || [];
      const now = new Date();
      const currentLimits = [];
      let totalRequests = 0;

      for (const record of records) {
        const windowStart = new Date(record.window_start);
        const endpointConfig = SECURITY_CONFIG.RATE_LIMITS[record.endpoint as keyof typeof SECURITY_CONFIG.RATE_LIMITS];
        
        if (!endpointConfig) continue;

        const resetTime = new Date(windowStart.getTime() + endpointConfig.window * 1000);
        
        // 現在のウィンドウ内のレコードのみ含める
        if (resetTime > now) {
          currentLimits.push({
            endpoint: record.endpoint,
            requestCount: record.request_count,
            limit: endpointConfig.limit,
            remaining: Math.max(0, endpointConfig.limit - record.request_count),
            resetTime,
          });
        }

        totalRequests += record.request_count;
      }

      return {
        currentLimits,
        totalRequests,
      };
    } catch (error) {
      console.error('Error getting rate limit stats:', error);
      throw error;
    }
  }

  /**
   * IP別レート制限チェック
   */
  static async checkIPRateLimit(
    ipAddress: string,
    endpoint: keyof typeof SECURITY_CONFIG.RATE_LIMITS
  ): Promise<RateLimitResult> {
    return this.checkRateLimit(`ip:${ipAddress}`, endpoint);
  }

  /**
   * クライアント別レート制限チェック
   */
  static async checkClientRateLimit(
    clientId: string,
    endpoint: keyof typeof SECURITY_CONFIG.RATE_LIMITS
  ): Promise<RateLimitResult> {
    return this.checkRateLimit(`client:${clientId}`, endpoint);
  }

  /**
   * ユーザー別レート制限チェック
   */
  static async checkUserRateLimit(
    userId: string,
    endpoint: keyof typeof SECURITY_CONFIG.RATE_LIMITS
  ): Promise<RateLimitResult> {
    return this.checkRateLimit(`user:${userId}`, endpoint);
  }

  /**
   * 複合レート制限チェック（IP + クライアント）
   */
  static async checkCombinedRateLimit(
    ipAddress: string,
    clientId: string,
    endpoint: keyof typeof SECURITY_CONFIG.RATE_LIMITS
  ): Promise<{
    ipLimit: RateLimitResult;
    clientLimit: RateLimitResult;
    allowed: boolean;
  }> {
    const [ipLimit, clientLimit] = await Promise.all([
      this.checkIPRateLimit(ipAddress, endpoint),
      this.checkClientRateLimit(clientId, endpoint),
    ]);

    return {
      ipLimit,
      clientLimit,
      allowed: ipLimit.allowed && clientLimit.allowed,
    };
  }

  /**
   * レート制限違反の記録
   */
  static async recordRateLimitViolation(
    identifier: string,
    endpoint: string,
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    try {
      // 監査ログに記録
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      );

      // User-Agentハッシュ化
      const userAgentHash = require('crypto')
        .createHash('sha256')
        .update(userAgent)
        .digest('hex');

      await supabaseAdmin
        .from('oauth_auth_logs')
        .insert({
          action: 'rate_limit_violation',
          ip_address: ipAddress,
          user_agent_hash: userAgentHash,
          success: false,
          error_message: `Rate limit exceeded for ${endpoint} by ${identifier}`,
          log_hash: require('crypto')
            .createHash('sha256')
            .update(`rate_limit_violation|${identifier}|${endpoint}|${Date.now()}`)
            .digest('hex'),
        });

    } catch (error) {
      console.error('Error recording rate limit violation:', error);
      // ログ記録の失敗は処理を停止させない
    }
  }
}

/**
 * レート制限ミドルウェア
 */
export class RateLimitMiddleware {
  /**
   * Express/Next.js用レート制限ミドルウェア
   */
  static async checkRateLimit(
    request: Request,
    endpoint: keyof typeof SECURITY_CONFIG.RATE_LIMITS
  ): Promise<{
    allowed: boolean;
    response?: Response;
  }> {
    try {
      const clientIp = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'unknown';

      const rateLimitResult = await RateLimitManager.checkIPRateLimit(clientIp, endpoint);

      if (!rateLimitResult.allowed) {
        const userAgent = request.headers.get('user-agent') || 'unknown';
        
        // 違反を記録
        await RateLimitManager.recordRateLimitViolation(
          `ip:${clientIp}`,
          endpoint,
          clientIp,
          userAgent
        );

        // 429レスポンスを返す
        const response = new Response(
          JSON.stringify({
            error: 'too_many_requests',
            error_description: 'Rate limit exceeded',
            retry_after: rateLimitResult.retryAfter,
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': rateLimitResult.retryAfter?.toString() || '60',
              'X-RateLimit-Limit': SECURITY_CONFIG.RATE_LIMITS[endpoint].limit.toString(),
              'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
              'X-RateLimit-Reset': Math.floor(rateLimitResult.resetTime.getTime() / 1000).toString(),
            },
          }
        );

        return { allowed: false, response };
      }

      // リクエストを記録
      await RateLimitManager.recordRequest(clientIp, endpoint);

      return { allowed: true };
    } catch (error) {
      console.error('Error in rate limit middleware:', error);
      // エラー時は制限なしとして処理を継続
      return { allowed: true };
    }
  }
}