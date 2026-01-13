/**
 * OAuth Client Applications API
 * Handles CRUD operations for OAuth client applications with security
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { OAuthClientManager, CreateClientApplicationParams } from '@/lib/oauth/client-manager';
import { AuditLogManager } from '@/lib/oauth/security';

// Supabase client for user authentication
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * GET /api/oauth/clients
 * ユーザーのクライアントアプリケーション一覧を取得
 */
export async function GET(request: NextRequest) {
  try {
    // 認証チェック
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // クライアントアプリケーション一覧を取得
    const applications = await OAuthClientManager.getApplications(user.id);

    // 機密情報を除外してレスポンス
    const safeApplications = applications.map(app => ({
      id: app.id,
      name: app.name,
      description: app.description,
      client_id: app.client_id,
      client_type: app.client_type,
      created_at: app.created_at,
      updated_at: app.updated_at,
    }));

    return NextResponse.json({ applications: safeApplications });

  } catch (error) {
    console.error('Error fetching client applications:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/oauth/clients
 * 新しいクライアントアプリケーションを作成
 */
export async function POST(request: NextRequest) {
  try {
    // 認証チェック
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // リクエストボディの検証
    const body = await request.json();
    const { name, description, clientType } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Application name is required' },
        { status: 400 }
      );
    }

    if (name.length > 255) {
      return NextResponse.json(
        { error: 'Application name must be 255 characters or less' },
        { status: 400 }
      );
    }

    if (!clientType || !['public', 'confidential'].includes(clientType)) {
      return NextResponse.json(
        { error: 'Valid client type is required (public or confidential)' },
        { status: 400 }
      );
    }

    if (description && typeof description !== 'string') {
      return NextResponse.json(
        { error: 'Description must be a string' },
        { status: 400 }
      );
    }

    // 既存のアプリケーション数をチェック（制限: 10個）
    const existingApps = await OAuthClientManager.getApplications(user.id);
    if (existingApps.length >= 10) {
      return NextResponse.json(
        { error: 'Maximum number of client applications (10) reached' },
        { status: 400 }
      );
    }

    // クライアントアプリケーションを作成
    const params: CreateClientApplicationParams = {
      userId: user.id,
      name: name.trim(),
      description: description?.trim() || undefined,
      clientType,
    };

    const { application, clientSecret } = await OAuthClientManager.createApplication(params);

    // 監査ログ記録
    const clientIp = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    await logAuditEvent({
      clientId: application.client_id,
      userId: user.id,
      action: 'client_created',
      ipAddress: clientIp,
      userAgent,
      success: true,
    });

    // レスポンス（client_secretは作成時のみ返却）
    const response = {
      application: {
        id: application.id,
        name: application.name,
        description: application.description,
        client_id: application.client_id,
        client_type: application.client_type,
        created_at: application.created_at,
        updated_at: application.updated_at,
      },
      client_secret: clientSecret, // 作成時のみ返却
      warning: 'Store the client_secret securely. It will not be shown again.',
    };

    return NextResponse.json(response, { status: 201 });

  } catch (error) {
    console.error('Error creating client application:', error);
    
    // エラーログ記録
    try {
      const authHeader = request.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const { data: { user } } = await supabase.auth.getUser(token);
        
        if (user) {
          const clientIp = request.headers.get('x-forwarded-for') || 
                          request.headers.get('x-real-ip') || 
                          'unknown';
          const userAgent = request.headers.get('user-agent') || 'unknown';

          await logAuditEvent({
            userId: user.id,
            action: 'client_create_failed',
            ipAddress: clientIp,
            userAgent,
            success: false,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    } catch (logError) {
      console.error('Error logging audit event:', logError);
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * 監査ログ記録ヘルパー
 */
async function logAuditEvent(params: {
  clientId?: string;
  userId: string;
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
      params.userId,
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
        user_id: params.userId,
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