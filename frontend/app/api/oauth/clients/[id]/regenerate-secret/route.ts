/**
 * OAuth Client Secret Regeneration API
 * Handles secure client secret regeneration
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { OAuthClientManager } from '@/lib/oauth/client-manager';
import { AuditLogManager } from '@/lib/oauth/security';

// Supabase client for user authentication
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * POST /api/oauth/clients/[id]/regenerate-secret
 * クライアントシークレットを再生成
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const applicationId = id;

    // アプリケーションの存在確認
    const existingApp = await OAuthClientManager.getApplication(applicationId, user.id);
    if (!existingApp) {
      return NextResponse.json(
        { error: 'Client application not found' },
        { status: 404 }
      );
    }

    // パブリッククライアントはシークレット再生成不可
    if (existingApp.client_type === 'public') {
      return NextResponse.json(
        { error: 'Public clients do not have client secrets' },
        { status: 400 }
      );
    }

    // 確認パラメータのチェック
    const body = await request.json();
    const { confirm } = body;

    if (!confirm) {
      return NextResponse.json(
        { 
          error: 'Confirmation required',
          message: 'This action will invalidate all existing tokens. Set confirm: true to proceed.'
        },
        { status: 400 }
      );
    }

    // シークレットを再生成
    const { application, newSecret } = await OAuthClientManager.regenerateSecret(
      applicationId,
      user.id
    );

    // 監査ログ記録
    const clientIp = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    await logAuditEvent({
      clientId: application.client_id,
      userId: user.id,
      action: 'client_secret_regenerated',
      ipAddress: clientIp,
      userAgent,
      success: true,
    });

    // レスポンス
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
      client_secret: newSecret,
      warning: 'Store the new client_secret securely. It will not be shown again. All existing tokens have been invalidated.',
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error regenerating client secret:', error);
    
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
            action: 'client_secret_regenerate_failed',
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