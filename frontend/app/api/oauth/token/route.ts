/**
 * OAuth Token Endpoint
 * Handles OAuth 2.0 token exchange with security enhancements
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { OAuthClientManager, ClientValidator } from '@/lib/oauth/client-manager';
import { AuthorizationCodeValidator } from '@/lib/oauth/authorization-code-manager';
import { TokenManager } from '@/lib/oauth/security';
import { RateLimitManager } from '@/lib/oauth/rate-limit-manager';
import { AuditLogManager } from '@/lib/oauth/security';

// Supabase client for OAuth operations
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

/**
 * POST /api/oauth/token
 * OAuth 2.0 トークンエンドポイント
 */
export async function POST(request: NextRequest) {
  const clientIp = request.headers.get('x-forwarded-for') || 
                  request.headers.get('x-real-ip') || 
                  'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';

  try {
    // レート制限チェック
    const rateLimitResult = await RateLimitManager.checkRateLimit(
      clientIp,
      'token'
    );

    if (!rateLimitResult.allowed) {
      await logAuditEvent({
        action: 'token_rate_limited',
        ipAddress: clientIp,
        userAgent,
        success: false,
        errorMessage: 'Rate limit exceeded',
      });

      return NextResponse.json(
        { 
          error: 'too_many_requests',
          error_description: 'Rate limit exceeded. Try again later.',
        },
        { 
          status: 429,
          headers: {
            'Retry-After': rateLimitResult.retryAfter?.toString() || '60',
          },
        }
      );
    }

    // リクエストボディの取得
    const body = await request.json();
    const {
      grant_type: grantType,
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
      code_verifier: codeVerifier,
      refresh_token: refreshToken,
    } = body;

    // 必須パラメータの検証
    if (!grantType) {
      await logAuditEvent({
        action: 'token_invalid_request',
        ipAddress: clientIp,
        userAgent,
        success: false,
        errorMessage: 'Missing grant_type',
      });

      return NextResponse.json(
        { 
          error: 'invalid_request',
          error_description: 'grant_type is required',
        },
        { status: 400 }
      );
    }

    if (!clientId) {
      await logAuditEvent({
        action: 'token_invalid_request',
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

    // サポートされているgrant_typeの確認
    if (!['authorization_code', 'refresh_token'].includes(grantType)) {
      await logAuditEvent({
        clientId,
        action: 'token_unsupported_grant_type',
        ipAddress: clientIp,
        userAgent,
        success: false,
        errorMessage: `Unsupported grant_type: ${grantType}`,
      });

      return NextResponse.json(
        { 
          error: 'unsupported_grant_type',
          error_description: `grant_type '${grantType}' is not supported`,
        },
        { status: 400 }
      );
    }

    // クライアント検証
    const clientValidation = await ClientValidator.validateClient(clientId, clientSecret);
    
    if (!clientValidation.isValid) {
      await logAuditEvent({
        clientId,
        action: 'token_invalid_client',
        ipAddress: clientIp,
        userAgent,
        success: false,
        errorMessage: clientValidation.error || 'Invalid client',
      });

      return NextResponse.json(
        { 
          error: 'invalid_client',
          error_description: clientValidation.error || 'Invalid client credentials',
        },
        { status: 401 }
      );
    }

    const application = clientValidation.application!;

    // レート制限記録
    await RateLimitManager.recordRequest(clientIp, 'token');

    // grant_type別の処理
    if (grantType === 'authorization_code') {
      return await handleAuthorizationCodeGrant({
        code,
        redirectUri,
        codeVerifier,
        application,
        clientIp,
        userAgent,
      });
    } else if (grantType === 'refresh_token') {
      return await handleRefreshTokenGrant({
        refreshToken,
        application,
        clientIp,
        userAgent,
      });
    }

  } catch (error) {
    console.error('Error in OAuth token endpoint:', error);

    await logAuditEvent({
      action: 'token_internal_error',
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
 * 認可コードグラント処理
 */
async function handleAuthorizationCodeGrant(params: {
  code: string;
  redirectUri: string;
  codeVerifier?: string;
  application: any;
  clientIp: string;
  userAgent: string;
}) {
  const { code, redirectUri, codeVerifier, application, clientIp, userAgent } = params;

  // 必須パラメータの検証
  if (!code) {
    await logAuditEvent({
      clientId: application.client_id,
      action: 'token_missing_code',
      ipAddress: clientIp,
      userAgent,
      success: false,
      errorMessage: 'Missing authorization code',
    });

    return NextResponse.json(
      { 
        error: 'invalid_request',
        error_description: 'code is required for authorization_code grant',
      },
      { status: 400 }
    );
  }

  if (!redirectUri) {
    await logAuditEvent({
      clientId: application.client_id,
      action: 'token_missing_redirect_uri',
      ipAddress: clientIp,
      userAgent,
      success: false,
      errorMessage: 'Missing redirect_uri',
    });

    return NextResponse.json(
      { 
        error: 'invalid_request',
        error_description: 'redirect_uri is required for authorization_code grant',
      },
      { status: 400 }
    );
  }

  // パブリッククライアントではcode_verifierが必須
  if (application.client_type === 'public' && !codeVerifier) {
    await logAuditEvent({
      clientId: application.client_id,
      action: 'token_missing_code_verifier',
      ipAddress: clientIp,
      userAgent,
      success: false,
      errorMessage: 'Missing code_verifier for public client',
    });

    return NextResponse.json(
      { 
        error: 'invalid_request',
        error_description: 'code_verifier is required for public clients',
      },
      { status: 400 }
    );
  }

  // 認可コード検証と交換
  const validation = await AuthorizationCodeValidator.validateForTokenExchange(
    code,
    application.client_id,
    redirectUri,
    codeVerifier
  );

  if (!validation.isValid || !validation.authCode) {
    await logAuditEvent({
      clientId: application.client_id,
      action: 'token_invalid_code',
      ipAddress: clientIp,
      userAgent,
      success: false,
      errorMessage: validation.error || 'Invalid authorization code',
      securityAlert: validation.securityAlert,
    });

    return NextResponse.json(
      { 
        error: 'invalid_grant',
        error_description: validation.error || 'Invalid authorization code',
      },
      { status: 400 }
    );
  }

  const authCode = validation.authCode;

  // アクセストークンとリフレッシュトークンを生成
  const accessToken = TokenManager.generateAccessToken();
  const refreshToken = TokenManager.generateRefreshToken();
  
  const accessTokenHash = TokenManager.hashToken(accessToken);
  const refreshTokenHash = TokenManager.hashToken(refreshToken);

  // トークンをデータベースに保存
  const { data: tokenRecord, error: tokenError } = await supabase
    .from('oauth_access_tokens')
    .insert({
      token_hash: accessTokenHash,
      refresh_token_hash: refreshTokenHash,
      client_id: application.client_id,
      user_id: authCode.user_id,
      scope: authCode.scope,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15分
      refresh_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30日
    })
    .select()
    .single();

  if (tokenError) {
    console.error('Failed to save access token:', tokenError);
    
    await logAuditEvent({
      clientId: application.client_id,
      userId: authCode.user_id,
      action: 'token_save_failed',
      ipAddress: clientIp,
      userAgent,
      success: false,
      errorMessage: 'Failed to save access token',
    });

    return NextResponse.json(
      { 
        error: 'server_error',
        error_description: 'Failed to issue access token',
      },
      { status: 500 }
    );
  }

  await logAuditEvent({
    clientId: application.client_id,
    userId: authCode.user_id,
    action: 'token_issued',
    ipAddress: clientIp,
    userAgent,
    success: true,
  });

  // トークンレスポンス
  return NextResponse.json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 15 * 60, // 15分（秒）
    refresh_token: refreshToken,
    scope: authCode.scope || undefined,
  });
}

/**
 * リフレッシュトークングラント処理
 */
async function handleRefreshTokenGrant(params: {
  refreshToken: string;
  application: any;
  clientIp: string;
  userAgent: string;
}) {
  const { refreshToken, application, clientIp, userAgent } = params;

  if (!refreshToken) {
    await logAuditEvent({
      clientId: application.client_id,
      action: 'token_missing_refresh_token',
      ipAddress: clientIp,
      userAgent,
      success: false,
      errorMessage: 'Missing refresh_token',
    });

    return NextResponse.json(
      { 
        error: 'invalid_request',
        error_description: 'refresh_token is required',
      },
      { status: 400 }
    );
  }

  // リフレッシュトークン検証
  const refreshTokenHash = TokenManager.hashToken(refreshToken);
  
  const { data: tokenRecord, error: tokenError } = await supabase
    .from('oauth_access_tokens')
    .select('*')
    .eq('refresh_token_hash', refreshTokenHash)
    .eq('client_id', application.client_id)
    .is('revoked_at', null)
    .single();

  if (tokenError || !tokenRecord) {
    await logAuditEvent({
      clientId: application.client_id,
      action: 'token_invalid_refresh_token',
      ipAddress: clientIp,
      userAgent,
      success: false,
      errorMessage: 'Invalid refresh token',
    });

    return NextResponse.json(
      { 
        error: 'invalid_grant',
        error_description: 'Invalid refresh token',
      },
      { status: 400 }
    );
  }

  // リフレッシュトークンの有効期限チェック
  if (new Date() > new Date(tokenRecord.refresh_expires_at)) {
    await logAuditEvent({
      clientId: application.client_id,
      userId: tokenRecord.user_id,
      action: 'token_refresh_expired',
      ipAddress: clientIp,
      userAgent,
      success: false,
      errorMessage: 'Refresh token expired',
    });

    return NextResponse.json(
      { 
        error: 'invalid_grant',
        error_description: 'Refresh token expired',
      },
      { status: 400 }
    );
  }

  // 新しいトークンペアを生成
  const newAccessToken = TokenManager.generateAccessToken();
  const newRefreshToken = TokenManager.generateRefreshToken();
  
  const newAccessTokenHash = TokenManager.hashToken(newAccessToken);
  const newRefreshTokenHash = TokenManager.hashToken(newRefreshToken);

  // 古いトークンを無効化し、新しいトークンを保存
  const { error: updateError } = await supabase
    .from('oauth_access_tokens')
    .update({
      revoked_at: new Date().toISOString(),
    })
    .eq('id', tokenRecord.id);

  if (updateError) {
    console.error('Failed to revoke old token:', updateError);
  }

  // 新しいトークンを保存
  const { error: newTokenError } = await supabase
    .from('oauth_access_tokens')
    .insert({
      token_hash: newAccessTokenHash,
      refresh_token_hash: newRefreshTokenHash,
      client_id: application.client_id,
      user_id: tokenRecord.user_id,
      scope: tokenRecord.scope,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15分
      refresh_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30日
    });

  if (newTokenError) {
    console.error('Failed to save new access token:', newTokenError);
    
    await logAuditEvent({
      clientId: application.client_id,
      userId: tokenRecord.user_id,
      action: 'token_refresh_failed',
      ipAddress: clientIp,
      userAgent,
      success: false,
      errorMessage: 'Failed to refresh access token',
    });

    return NextResponse.json(
      { 
        error: 'server_error',
        error_description: 'Failed to refresh access token',
      },
      { status: 500 }
    );
  }

  await logAuditEvent({
    clientId: application.client_id,
    userId: tokenRecord.user_id,
    action: 'token_refreshed',
    ipAddress: clientIp,
    userAgent,
    success: true,
  });

  // 新しいトークンレスポンス
  return NextResponse.json({
    access_token: newAccessToken,
    token_type: 'Bearer',
    expires_in: 15 * 60, // 15分（秒）
    refresh_token: newRefreshToken,
    scope: tokenRecord.scope || undefined,
  });
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
  securityAlert?: string;
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

    // エラーメッセージにセキュリティアラートを追加
    let errorMessage = params.errorMessage;
    if (params.securityAlert) {
      errorMessage = `${errorMessage} | SECURITY ALERT: ${params.securityAlert}`;
    }

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
        error_message: errorMessage || null,
        log_hash: logHash,
        previous_log_hash: previousHash,
      });

  } catch (error) {
    console.error('Failed to log audit event:', error);
    // 監査ログの失敗は処理を停止させない
  }
}