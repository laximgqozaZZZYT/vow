/**
 * OAuth Token Validation Middleware
 * Validates access tokens for API requests with rate limiting
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { RateLimitManager } from './rate-limit-manager';
import { AuditLogManager } from './security';
import crypto from 'crypto';

// Supabase client for token validation
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

export interface TokenValidationResult {
  isValid: boolean;
  userId?: string;
  clientId?: string;
  scope?: string;
  error?: string;
  statusCode?: number;
}

export interface ValidatedRequest extends NextRequest {
  oauth?: {
    userId: string;
    clientId: string;
    scope?: string;
  };
}

/**
 * OAuth Token Validation Middleware
 */
export class TokenMiddleware {
  /**
   * Validate OAuth access token from Authorization header
   */
  static async validateToken(request: NextRequest): Promise<TokenValidationResult> {
    const clientIp = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    try {
      // Extract token from Authorization header
      const authHeader = request.headers.get('authorization');
      if (!authHeader) {
        return {
          isValid: false,
          error: 'Missing Authorization header',
          statusCode: 401,
        };
      }

      if (!authHeader.startsWith('Bearer ')) {
        return {
          isValid: false,
          error: 'Invalid Authorization header format. Expected: Bearer <token>',
          statusCode: 401,
        };
      }

      const token = authHeader.substring(7);
      if (!token) {
        return {
          isValid: false,
          error: 'Missing access token',
          statusCode: 401,
        };
      }

      // Rate limiting check
      const rateLimitResult = await RateLimitManager.checkRateLimit(
        clientIp,
        'api'
      );

      if (!rateLimitResult.allowed) {
        await this.logTokenEvent({
          action: 'token_validation_rate_limited',
          ipAddress: clientIp,
          userAgent,
          success: false,
          errorMessage: 'Rate limit exceeded',
        });

        return {
          isValid: false,
          error: 'Rate limit exceeded',
          statusCode: 429,
        };
      }

      // Hash the token for database lookup
      const tokenHash = this.hashToken(token);

      // Validate token in database
      const { data: tokenRecord, error: tokenError } = await supabase
        .from('oauth_access_tokens')
        .select(`
          id,
          client_id,
          user_id,
          scope,
          expires_at,
          revoked_at,
          last_used_at
        `)
        .eq('token_hash', tokenHash)
        .is('revoked_at', null)
        .single();

      if (tokenError || !tokenRecord) {
        await this.logTokenEvent({
          action: 'token_validation_invalid',
          ipAddress: clientIp,
          userAgent,
          success: false,
          errorMessage: 'Invalid access token',
        });

        return {
          isValid: false,
          error: 'Invalid access token',
          statusCode: 401,
        };
      }

      // Check token expiration
      if (new Date() > new Date(tokenRecord.expires_at)) {
        await this.logTokenEvent({
          clientId: tokenRecord.client_id,
          userId: tokenRecord.user_id,
          action: 'token_validation_expired',
          ipAddress: clientIp,
          userAgent,
          success: false,
          errorMessage: 'Access token expired',
        });

        return {
          isValid: false,
          error: 'Access token expired',
          statusCode: 401,
        };
      }

      // Update last used timestamp
      await supabase
        .from('oauth_access_tokens')
        .update({
          last_used_at: new Date().toISOString(),
        })
        .eq('id', tokenRecord.id);

      // Record rate limit usage
      await RateLimitManager.recordRequest(clientIp, 'api');

      await this.logTokenEvent({
        clientId: tokenRecord.client_id,
        userId: tokenRecord.user_id,
        action: 'token_validation_success',
        ipAddress: clientIp,
        userAgent,
        success: true,
      });

      return {
        isValid: true,
        userId: tokenRecord.user_id,
        clientId: tokenRecord.client_id,
        scope: tokenRecord.scope || undefined,
      };

    } catch (error) {
      console.error('Error validating OAuth token:', error);

      await this.logTokenEvent({
        action: 'token_validation_error',
        ipAddress: clientIp,
        userAgent,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        isValid: false,
        error: 'Internal server error',
        statusCode: 500,
      };
    }
  }

  /**
   * Middleware function for Next.js API routes
   */
  static async middleware(
    request: NextRequest,
    requiredScope?: string
  ): Promise<NextResponse | null> {
    const validation = await this.validateToken(request);

    if (!validation.isValid) {
      return NextResponse.json(
        { 
          error: 'unauthorized',
          error_description: validation.error || 'Invalid token',
        },
        { 
          status: validation.statusCode || 401,
          headers: validation.statusCode === 429 ? {
            'Retry-After': '60',
          } : {},
        }
      );
    }

    // Check scope if required
    if (requiredScope && validation.scope) {
      const scopes = validation.scope.split(' ');
      if (!scopes.includes(requiredScope)) {
        return NextResponse.json(
          { 
            error: 'insufficient_scope',
            error_description: `Required scope: ${requiredScope}`,
          },
          { status: 403 }
        );
      }
    }

    // Add OAuth info to request (for TypeScript, we'll use headers)
    const headers = new Headers(request.headers);
    headers.set('x-oauth-user-id', validation.userId!);
    headers.set('x-oauth-client-id', validation.clientId!);
    if (validation.scope) {
      headers.set('x-oauth-scope', validation.scope);
    }

    // Return null to continue processing
    return null;
  }

  /**
   * Extract OAuth info from validated request headers
   */
  static getOAuthInfo(request: NextRequest): {
    userId: string;
    clientId: string;
    scope?: string;
  } | null {
    const userId = request.headers.get('x-oauth-user-id');
    const clientId = request.headers.get('x-oauth-client-id');
    const scope = request.headers.get('x-oauth-scope');

    if (!userId || !clientId) {
      return null;
    }

    return {
      userId,
      clientId,
      scope: scope || undefined,
    };
  }

  /**
   * Hash token for database storage/lookup
   */
  private static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Log token validation events
   */
  private static async logTokenEvent(params: {
    clientId?: string;
    userId?: string;
    action: string;
    ipAddress: string;
    userAgent: string;
    success: boolean;
    errorMessage?: string;
  }) {
    try {
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

      // Get latest log hash for chaining
      const { data: latestLog } = await supabaseAdmin
        .from('oauth_auth_logs')
        .select('log_hash')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const previousHash = latestLog?.log_hash || null;

      // Generate log hash
      const logHash = AuditLogManager.generateLogHash(
        params.clientId || null,
        params.userId || null,
        params.action,
        params.success,
        previousHash
      );

      // Hash User-Agent
      const userAgentHash = AuditLogManager.hashUserAgent(params.userAgent);

      // Insert log record
      await supabaseAdmin
        .from('oauth_auth_logs')
        .insert({
          client_id: params.clientId || null,
          user_id: params.userId || null,
          action: params.action,
          ip_address: params.ipAddress,
          user_agent_hash: userAgentHash,
          success: params.success,
          error_message: params.errorMessage || null,
          log_hash: logHash,
          previous_log_hash: previousHash,
        });

    } catch (error) {
      console.error('Failed to log token event:', error);
      // Don't throw - logging failures shouldn't break the main flow
    }
  }
}

/**
 * Helper function to create OAuth-protected API route
 */
export function withOAuth(
  handler: (request: NextRequest, oauth: { userId: string; clientId: string; scope?: string }) => Promise<NextResponse>,
  requiredScope?: string
) {
  return async (request: NextRequest) => {
    // Validate token
    const middlewareResponse = await TokenMiddleware.middleware(request, requiredScope);
    if (middlewareResponse) {
      return middlewareResponse;
    }

    // Extract OAuth info
    const oauthInfo = TokenMiddleware.getOAuthInfo(request);
    if (!oauthInfo) {
      return NextResponse.json(
        { error: 'unauthorized', error_description: 'OAuth validation failed' },
        { status: 401 }
      );
    }

    // Call the actual handler
    return handler(request, oauthInfo);
  };
}