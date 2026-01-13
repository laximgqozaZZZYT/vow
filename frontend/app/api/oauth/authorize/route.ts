/**
 * OAuth Authorization Endpoint
 * Handles OAuth 2.0 authorization requests with security enhancements
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { OAuthClientManager } from '@/lib/oauth/client-manager';
import { OAuthAuthorizationCodeManager } from '@/lib/oauth/authorization-code-manager';
import { RedirectURIValidator, PKCEManager } from '@/lib/oauth/security';
import { RateLimitManager } from '@/lib/oauth/rate-limit-manager';
import { AuditLogManager } from '@/lib/oauth/security';

// Supabase client for user authentication
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * GET /api/oauth/authorize
 * OAuth 2.0 認可エンドポイント
 */
export async function GET(request: NextRequest) {
  const clientIp = request.headers.get('x-forwarded-for') || 
                  request.headers.get('x-real-ip') || 
                  'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';

  try {
    // レート制限チェック
    const rateLimitResult = await RateLimitManager.checkRateLimit(
      clientIp,
      'authorize'
    );

    if (!rateLimitResult.allowed) {
      await logAuditEvent({
        action: 'authorize_rate_limited',
        ipAddress: clientIp,
        userAgent,
        success: false,
        errorMessage: 'Rate limit exceeded',
      });

      return NextResponse.json(
        { 
          error: 'too_many_requests',
          error_description: 'Rate limit exceeded. Try again later.',
          retry_after: rateLimitResult.retryAfter,
        },
        { 
          status: 429,
          headers: {
            'Retry-After': rateLimitResult.retryAfter?.toString() || '60',
          },
        }
      );
    }

    // リクエストパラメータの取得
    const searchParams = request.nextUrl.searchParams;
    const clientId = searchParams.get('client_id');
    const redirectUri = searchParams.get('redirect_uri');
    const responseType = searchParams.get('response_type');
    const scope = searchParams.get('scope');
    const state = searchParams.get('state');
    const codeChallenge = searchParams.get('code_challenge');
    const codeChallengeMethod = searchParams.get('code_challenge_method');

    // 必須パラメータの検証
    if (!clientId) {
      await logAuditEvent({
        action: 'authorize_invalid_request',
        ipAddress: clientIp,
        userAgent,
        success: false,
        errorMessage: 'Missing client_id',
      });

      return NextResponse.json(
        { 
          error: 'invalid_request',
          error_description: 'client_id is required',
        },
        { status: 400 }
      );
    }

    if (!redirectUri) {
      await logAuditEvent({
        clientId,
        action: 'authorize_invalid_request',
        ipAddress: clientIp,
        userAgent,
        success: false,
        errorMessage: 'Missing redirect_uri',
      });

      return NextResponse.json(
        { 
          error: 'invalid_request',
          error_description: 'redirect_uri is required',
        },
        { status: 400 }
      );
    }

    if (responseType !== 'code') {
      await logAuditEvent({
        clientId,
        action: 'authorize_unsupported_response_type',
        ipAddress: clientIp,
        userAgent,
        success: false,
        errorMessage: `Unsupported response_type: ${responseType}`,
      });

      return NextResponse.json(
        { 
          error: 'unsupported_response_type',
          error_description: 'Only response_type=code is supported',
        },
        { status: 400 }
      );
    }

    // クライアント検証
    const clientValidation = await OAuthClientManager.getApplicationByClientId(clientId);
    if (!clientValidation) {
      await logAuditEvent({
        clientId,
        action: 'authorize_invalid_client',
        ipAddress: clientIp,
        userAgent,
        success: false,
        errorMessage: 'Invalid client_id',
      });

      return NextResponse.json(
        { 
          error: 'invalid_client',
          error_description: 'Invalid client_id',
        },
        { status: 400 }
      );
    }

    // リダイレクトURI検証
    const { data: registeredUris } = await supabase
      .from('oauth_redirect_uris')
      .select('uri')
      .eq('application_id', clientValidation.id)
      .eq('is_active', true);

    const isValidRedirectUri = registeredUris?.some(
      uri => RedirectURIValidator.exactMatch(uri.uri, redirectUri)
    );

    if (!isValidRedirectUri) {
      await logAuditEvent({
        clientId,
        action: 'authorize_invalid_redirect_uri',
        ipAddress: clientIp,
        userAgent,
        success: false,
        errorMessage: `Invalid redirect_uri: ${redirectUri}`,
      });

      return NextResponse.json(
        { 
          error: 'invalid_request',
          error_description: 'Invalid redirect_uri',
        },
        { status: 400 }
      );
    }

    // PKCE検証（パブリッククライアントでは必須）
    if (clientValidation.client_type === 'public') {
      if (!codeChallenge) {
        const errorUrl = new URL(redirectUri);
        errorUrl.searchParams.set('error', 'invalid_request');
        errorUrl.searchParams.set('error_description', 'code_challenge is required for public clients');
        if (state) errorUrl.searchParams.set('state', state);

        await logAuditEvent({
          clientId,
          action: 'authorize_missing_pkce',
          ipAddress: clientIp,
          userAgent,
          success: false,
          errorMessage: 'Missing PKCE for public client',
        });

        return NextResponse.redirect(errorUrl.toString());
      }

      if (codeChallengeMethod && codeChallengeMethod !== 'S256') {
        const errorUrl = new URL(redirectUri);
        errorUrl.searchParams.set('error', 'invalid_request');
        errorUrl.searchParams.set('error_description', 'Only code_challenge_method=S256 is supported');
        if (state) errorUrl.searchParams.set('state', state);

        await logAuditEvent({
          clientId,
          action: 'authorize_invalid_pkce_method',
          ipAddress: clientIp,
          userAgent,
          success: false,
          errorMessage: `Invalid code_challenge_method: ${codeChallengeMethod}`,
        });

        return NextResponse.redirect(errorUrl.toString());
      }
    }

    // レート制限記録
    await RateLimitManager.recordRequest(clientIp, 'authorize');

    // 認可ページにリダイレクト（パラメータを保持）
    const authPageUrl = new URL('/oauth/authorize', request.url);
    authPageUrl.searchParams.set('client_id', clientId);
    authPageUrl.searchParams.set('redirect_uri', redirectUri);
    authPageUrl.searchParams.set('response_type', responseType);
    if (scope) authPageUrl.searchParams.set('scope', scope);
    if (state) authPageUrl.searchParams.set('state', state);
    if (codeChallenge) authPageUrl.searchParams.set('code_challenge', codeChallenge);
    if (codeChallengeMethod) authPageUrl.searchParams.set('code_challenge_method', codeChallengeMethod);

    await logAuditEvent({
      clientId,
      action: 'authorize_request_valid',
      ipAddress: clientIp,
      userAgent,
      success: true,
    });

    return NextResponse.redirect(authPageUrl.toString());

  } catch (error) {
    console.error('Error in OAuth authorize endpoint:', error);

    await logAuditEvent({
      action: 'authorize_internal_error',
      ipAddress: clientIp,
      userAgent,
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { 
        error: 'server_error',
        error_description: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/oauth/authorize
 * ユーザー認可処理
 */
export async function POST(request: NextRequest) {
  const clientIp = request.headers.get('x-forwarded-for') || 
                  request.headers.get('x-real-ip') || 
                  'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';

  try {
    // 認証チェック
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'unauthorized', error_description: 'Authentication required' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'unauthorized', error_description: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // リクエストボディの取得
    const body = await request.json();
    const {
      client_id: clientId,
      redirect_uri: redirectUri,
      scope,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: codeChallengeMethod,
      approved,
    } = body;

    // 必須パラメータの検証
    if (!clientId || !redirectUri) {
      return NextResponse.json(
        { error: 'invalid_request', error_description: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // ユーザーが拒否した場合
    if (!approved) {
      const errorUrl = new URL(redirectUri);
      errorUrl.searchParams.set('error', 'access_denied');
      errorUrl.searchParams.set('error_description', 'User denied the request');
      if (state) errorUrl.searchParams.set('state', state);

      await logAuditEvent({
        clientId,
        userId: user.id,
        action: 'authorize_denied',
        ipAddress: clientIp,
        userAgent,
        success: false,
        errorMessage: 'User denied authorization',
      });

      return NextResponse.json({
        redirect_url: errorUrl.toString(),
      });
    }

    // 認可コード生成
    const authCode = await OAuthAuthorizationCodeManager.createAuthorizationCode({
      clientId,
      userId: user.id,
      redirectUri,
      scope,
      codeChallenge,
      codeChallengeMethod: codeChallengeMethod as 'S256' | undefined,
    });

    // 成功時のリダイレクトURL生成
    const successUrl = new URL(redirectUri);
    successUrl.searchParams.set('code', authCode.code);
    if (state) successUrl.searchParams.set('state', state);

    await logAuditEvent({
      clientId,
      userId: user.id,
      action: 'authorize_approved',
      ipAddress: clientIp,
      userAgent,
      success: true,
    });

    return NextResponse.json({
      redirect_url: successUrl.toString(),
    });

  } catch (error) {
    console.error('Error in OAuth authorize POST:', error);

    await logAuditEvent({
      action: 'authorize_post_internal_error',
      ipAddress: clientIp,
      userAgent,
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: 'server_error', error_description: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * 監査ログ記録ヘルパー
 */
async function logAuditEvent(params: {
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

    // 最新のログハッシュを取得
    const { data: latestLog } = await supabaseAdmin
      .from('oauth_auth_logs')
      .select('log_hash')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const previousHash = latestLog?.log_hash || null;

    // ログハッシュ生成
    const logHash = AuditLogManager.generateLogHash(
      params.clientId || null,
      params.userId || null,
      params.action,
      params.success,
      previousHash
    );

    // User-Agentハッシュ化
    const userAgentHash = AuditLogManager.hashUserAgent(params.userAgent);

    // ログ記録
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
    console.error('Failed to log audit event:', error);
    // 監査ログの失敗は処理を停止させない
  }
}