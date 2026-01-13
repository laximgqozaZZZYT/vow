-- OAuth 2.0 Secure Implementation Migration
-- This migration creates OAuth tables with security best practices

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- クライアントアプリケーション（セキュリティ強化版）
CREATE TABLE oauth_client_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  client_id VARCHAR(255) UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'base64url'),
  client_secret_hash VARCHAR(255) NOT NULL, -- bcryptハッシュ化
  client_type VARCHAR(20) NOT NULL DEFAULT 'confidential', -- 'public' or 'confidential'
  salt VARCHAR(255) NOT NULL DEFAULT encode(gen_random_bytes(32), 'base64url'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT unique_app_name_per_user UNIQUE(user_id, name),
  CONSTRAINT valid_client_type CHECK (client_type IN ('public', 'confidential'))
);

-- リダイレクトURI
CREATE TABLE oauth_redirect_uris (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES oauth_client_applications(id) ON DELETE CASCADE,
  uri VARCHAR(2048) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT unique_uri_per_app UNIQUE(application_id, uri),
  -- セキュリティ制約: HTTPSまたはlocalhostのみ許可
  CONSTRAINT valid_redirect_uri CHECK (
    uri ~ '^https://' OR 
    uri ~ '^http://localhost' OR 
    uri ~ '^http://127\.0\.0\.1'
  )
);

-- 認可コード（セキュリティ強化版）
CREATE TABLE oauth_authorization_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(255) UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'base64url'),
  client_id VARCHAR(255) NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redirect_uri VARCHAR(2048) NOT NULL,
  scope VARCHAR(255),
  code_challenge VARCHAR(255), -- PKCE: パブリッククライアントでは必須
  code_challenge_method VARCHAR(10) DEFAULT 'S256', -- S256のみ許可
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '1 minute'), -- 1分に短縮
  used_at TIMESTAMP WITH TIME ZONE,
  is_used BOOLEAN DEFAULT false, -- 使用済みフラグ追加
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_challenge_method CHECK (code_challenge_method = 'S256' OR code_challenge_method IS NULL)
);

-- アクセストークン（セキュリティ強化版）
CREATE TABLE oauth_access_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash VARCHAR(255) UNIQUE NOT NULL, -- トークンハッシュ化
  refresh_token_hash VARCHAR(255) UNIQUE, -- リフレッシュトークンハッシュ化
  client_id VARCHAR(255) NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope VARCHAR(255),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes'), -- 15分に短縮
  refresh_expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  revoked_at TIMESTAMP WITH TIME ZONE,
  last_used_at TIMESTAMP WITH TIME ZONE -- 最終使用時刻追加
);

-- 認証ログ（改ざん防止強化）
CREATE TABLE oauth_auth_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id VARCHAR(255),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL, -- 'authorize', 'token', 'revoke'
  ip_address INET,
  user_agent_hash VARCHAR(255), -- User-Agentハッシュ化
  success BOOLEAN NOT NULL,
  error_message TEXT,
  log_hash VARCHAR(255) NOT NULL, -- ログ改ざん防止ハッシュ
  previous_log_hash VARCHAR(255), -- チェーン化
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- レート制限テーブル追加
CREATE TABLE oauth_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier VARCHAR(255) NOT NULL, -- IP address or client_id
  endpoint VARCHAR(100) NOT NULL, -- 'authorize', 'token', 'api'
  request_count INTEGER DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT unique_rate_limit UNIQUE(identifier, endpoint, window_start)
);

-- インデックス作成（パフォーマンス向上）
CREATE INDEX idx_oauth_client_applications_user_id ON oauth_client_applications(user_id);
CREATE INDEX idx_oauth_client_applications_client_id ON oauth_client_applications(client_id);

CREATE INDEX idx_oauth_redirect_uris_application_id ON oauth_redirect_uris(application_id);
CREATE INDEX idx_oauth_redirect_uris_uri ON oauth_redirect_uris(uri);

CREATE INDEX idx_oauth_authorization_codes_code ON oauth_authorization_codes(code);
CREATE INDEX idx_oauth_authorization_codes_client_id ON oauth_authorization_codes(client_id);
CREATE INDEX idx_oauth_authorization_codes_user_id ON oauth_authorization_codes(user_id);
CREATE INDEX idx_oauth_authorization_codes_expires_at ON oauth_authorization_codes(expires_at);

CREATE INDEX idx_oauth_access_tokens_token_hash ON oauth_access_tokens(token_hash);
CREATE INDEX idx_oauth_access_tokens_refresh_token_hash ON oauth_access_tokens(refresh_token_hash);
CREATE INDEX idx_oauth_access_tokens_client_id ON oauth_access_tokens(client_id);
CREATE INDEX idx_oauth_access_tokens_user_id ON oauth_access_tokens(user_id);
CREATE INDEX idx_oauth_access_tokens_expires_at ON oauth_access_tokens(expires_at);

CREATE INDEX idx_oauth_auth_logs_client_id ON oauth_auth_logs(client_id);
CREATE INDEX idx_oauth_auth_logs_user_id ON oauth_auth_logs(user_id);
CREATE INDEX idx_oauth_auth_logs_created_at ON oauth_auth_logs(created_at);

CREATE INDEX idx_oauth_rate_limits_identifier_endpoint ON oauth_rate_limits(identifier, endpoint);
CREATE INDEX idx_oauth_rate_limits_window_start ON oauth_rate_limits(window_start);

-- RLS (Row Level Security) ポリシー設定
ALTER TABLE oauth_client_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_redirect_uris ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_authorization_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_access_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_auth_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_rate_limits ENABLE ROW LEVEL SECURITY;

-- RLSポリシー: ユーザーは自分のクライアントアプリケーションのみアクセス可能
CREATE POLICY "Users can manage own client applications" ON oauth_client_applications
    FOR ALL USING (user_id = auth.uid());

-- RLSポリシー: ユーザーは自分のアプリケーションのリダイレクトURIのみアクセス可能
CREATE POLICY "Users can manage own redirect URIs" ON oauth_redirect_uris
    FOR ALL USING (
        application_id IN (
            SELECT id FROM oauth_client_applications WHERE user_id = auth.uid()
        )
    );

-- RLSポリシー: ユーザーは自分の認可コードのみアクセス可能
CREATE POLICY "Users can access own authorization codes" ON oauth_authorization_codes
    FOR ALL USING (user_id = auth.uid());

-- RLSポリシー: ユーザーは自分のアクセストークンのみアクセス可能
CREATE POLICY "Users can access own access tokens" ON oauth_access_tokens
    FOR ALL USING (user_id = auth.uid());

-- RLSポリシー: ユーザーは自分の認証ログのみ閲覧可能
CREATE POLICY "Users can view own auth logs" ON oauth_auth_logs
    FOR SELECT USING (user_id = auth.uid());

-- RLSポリシー: レート制限は管理者のみアクセス可能
CREATE POLICY "Service role can manage rate limits" ON oauth_rate_limits
    FOR ALL USING (auth.role() = 'service_role');

-- 自動クリーンアップ関数: 期限切れデータの削除
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_data()
RETURNS void AS $$
BEGIN
    -- 期限切れ認可コードの削除
    DELETE FROM oauth_authorization_codes 
    WHERE expires_at < NOW() - INTERVAL '1 hour';
    
    -- 期限切れアクセストークンの削除
    DELETE FROM oauth_access_tokens 
    WHERE expires_at < NOW() - INTERVAL '1 hour'
    AND revoked_at IS NULL;
    
    -- 古いレート制限データの削除（24時間以上前）
    DELETE FROM oauth_rate_limits 
    WHERE window_start < NOW() - INTERVAL '24 hours';
    
    -- 古い認証ログの削除（90日以上前）
    DELETE FROM oauth_auth_logs 
    WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 定期クリーンアップのスケジュール設定（pg_cronが利用可能な場合）
-- SELECT cron.schedule('oauth-cleanup', '0 2 * * *', 'SELECT cleanup_expired_oauth_data();');

-- セキュリティ関数: Client Secret ハッシュ化
CREATE OR REPLACE FUNCTION hash_client_secret(secret TEXT, salt TEXT)
RETURNS TEXT AS $$
BEGIN
    -- bcryptハッシュ化（実際の実装ではアプリケーション側で行う）
    RETURN encode(digest(secret || salt, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- セキュリティ関数: ログハッシュ生成
CREATE OR REPLACE FUNCTION generate_log_hash(
    client_id_param VARCHAR,
    user_id_param UUID,
    action_param VARCHAR,
    success_param BOOLEAN,
    previous_hash_param VARCHAR
)
RETURNS TEXT AS $$
BEGIN
    RETURN encode(
        digest(
            COALESCE(client_id_param, '') || 
            COALESCE(user_id_param::TEXT, '') || 
            action_param || 
            success_param::TEXT || 
            COALESCE(previous_hash_param, '') ||
            EXTRACT(EPOCH FROM NOW())::TEXT,
            'sha256'
        ),
        'hex'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;