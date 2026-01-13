/**
 * OAuth Client Application Management API
 * Handles individual client application operations
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
 * GET /api/oauth/clients/[id]
 * 特定のクライアントアプリケーションを取得
 */
export async function GET(
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
    const application = await OAuthClientManager.getApplication(applicationId, user.id);

    if (!application) {
      return NextResponse.json(
        { error: 'Client application not found' },
        { status: 404 }
      );
    }

    // 認証統計を取得
    const stats = await OAuthClientManager.getAuthStats(application.client_id, user.id);

    // 機密情報を除外してレスポンス
    const safeApplication = {
      id: application.id,
      name: application.name,
      description: application.description,
      client_id: application.client_id,
      client_type: application.client_type,
      created_at: application.created_at,
      updated_at: application.updated_at,
      stats,
    };

    return NextResponse.json({ application: safeApplication });

  } catch (error) {
    console.error('Error fetching client application:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/oauth/clients/[id]
 * クライアントアプリケーションを更新
 */
export async function PUT(
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

    // リクエストボディの検証
    const body = await request.json();
    const { name, description } = body;

    const updates: { name?: string; description?: string } = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json(
          { error: 'Application name must be a non-empty string' },
          { status: 400 }
        );
      }
      if (name.length > 255) {
        return NextResponse.json(
          { error: 'Application name must be 255 characters or less' },
          { status: 400 }
        );
      }
      updates.name = name.trim();
    }

    if (description !== undefined) {
      if (description !== null && typeof description !== 'string') {
        return NextResponse.json(
          { error: 'Description must be a string or null' },
          { status: 400 }
        );
      }
      updates.description = description?.trim() || null;
    }

    const { id } = await params;
    const applicationId = id;
    const updatedApplication = await OAuthClientManager.updateApplication(
      applicationId,
      user.id,
      updates
    );

    // 監査ログ記録
    const clientIp = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    await logAuditEvent({
      clientId: updatedApplication.client_id,
      userId: user.id,
      action: 'client_updated',
      ipAddress: clientIp,
      userAgent,
      success: true,
    });

    // 機密情報を除外してレスポンス
    const safeApplication = {
      id: updatedApplication.id,
      name: updatedApplication.name,
      description: updatedApplication.description,
      client_id: updatedApplication.client_id,
      client_type: updatedApplication.client_type,
      created_at: updatedApplication.created_at,
      updated_at: updatedApplication.updated_at,
    };

    return NextResponse.json({ application: safeApplication });

  } catch (error) {
    console.error('Error updating client application:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/oauth/clients/[id]
 * クライアントアプリケーションを削除
 */
export async function DELETE(
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
    
    // 削除前にアプリケーション情報を取得（ログ用）
    const application = await OAuthClientManager.getApplication(applicationId, user.id);
    
    if (!application) {
      return NextResponse.json(
        { error: 'Client application not found' },
        { status: 404 }
      );
    }

    // アプリケーションを削除
    await OAuthClientManager.deleteApplication(applicationId, user.id);

    // 監査ログ記録
    const clientIp = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    await logAuditEvent({
      clientId: application.client_id,
      userId: user.id,
      action: 'client_deleted',
      ipAddress: clientIp,
      userAgent,
      success: true,
    });

    return NextResponse.json({ message: 'Client application deleted successfully' });

  } catch (error) {
    console.error('Error deleting client application:', error);
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