/**
 * OAuth Authorization Code Manager
 * Handles secure authorization code management with reuse prevention
 */

import { createClient } from '@supabase/supabase-js';
import { AuthorizationCodeManager, PKCEManager, SECURITY_CONFIG } from './security';

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

export interface OAuthAuthorizationCode {
  id: string;
  code: string;
  client_id: string;
  user_id: string;
  redirect_uri: string;
  scope: string | null;
  code_challenge: string | null;
  code_challenge_method: 'S256' | null;
  expires_at: string;
  used_at: string | null;
  is_used: boolean;
  created_at: string;
}

export interface CreateAuthorizationCodeParams {
  clientId: string;
  userId: string;
  redirectUri: string;
  scope?: string;
  codeChallenge?: string;
  codeChallengeMethod?: 'S256';
}

export interface AuthorizationCodeValidation {
  isValid: boolean;
  isUsed: boolean;
  isExpired: boolean;
  code?: OAuthAuthorizationCode;
  error?: string;
}

/**
 * OAuth Authorization Code Manager
 */
export class OAuthAuthorizationCodeManager {
  /**
   * 新しい認可コードを生成・保存
   */
  static async createAuthorizationCode(
    params: CreateAuthorizationCodeParams
  ): Promise<OAuthAuthorizationCode> {
    try {
      // セキュアな認可コード生成
      const code = AuthorizationCodeManager.generateCode();
      
      // 有効期限設定（1分後）
      const expiresAt = new Date(Date.now() + SECURITY_CONFIG.AUTHORIZATION_CODE_TTL * 1000);

      // データベースに保存
      const { data, error } = await supabase
        .from('oauth_authorization_codes')
        .insert({
          code,
          client_id: params.clientId,
          user_id: params.userId,
          redirect_uri: params.redirectUri,
          scope: params.scope || null,
          code_challenge: params.codeChallenge || null,
          code_challenge_method: params.codeChallengeMethod || null,
          expires_at: expiresAt.toISOString(),
          is_used: false,
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to create authorization code:', error);
        throw new Error('Failed to create authorization code');
      }

      return data;
    } catch (error) {
      console.error('Error creating authorization code:', error);
      throw error;
    }
  }

  /**
   * 認可コードを検証（再利用防止付き）
   */
  static async validateAuthorizationCode(
    code: string,
    clientId: string,
    redirectUri: string
  ): Promise<AuthorizationCodeValidation> {
    try {
      // 認可コードを取得
      const { data, error } = await supabase
        .from('oauth_authorization_codes')
        .select('*')
        .eq('code', code)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return {
            isValid: false,
            isUsed: false,
            isExpired: false,
            error: 'Invalid authorization code',
          };
        }
        console.error('Failed to fetch authorization code:', error);
        throw new Error('Failed to validate authorization code');
      }

      const authCode = data as OAuthAuthorizationCode;

      // 基本検証
      if (authCode.client_id !== clientId) {
        return {
          isValid: false,
          isUsed: authCode.is_used,
          isExpired: new Date() > new Date(authCode.expires_at),
          error: 'Authorization code does not belong to this client',
        };
      }

      if (authCode.redirect_uri !== redirectUri) {
        return {
          isValid: false,
          isUsed: authCode.is_used,
          isExpired: new Date() > new Date(authCode.expires_at),
          error: 'Redirect URI mismatch',
        };
      }

      // 使用済みチェック
      if (authCode.is_used) {
        return {
          isValid: false,
          isUsed: true,
          isExpired: new Date() > new Date(authCode.expires_at),
          code: authCode,
          error: 'Authorization code has already been used',
        };
      }

      // 有効期限チェック
      const isExpired = new Date() > new Date(authCode.expires_at);
      if (isExpired) {
        return {
          isValid: false,
          isUsed: authCode.is_used,
          isExpired: true,
          code: authCode,
          error: 'Authorization code has expired',
        };
      }

      return {
        isValid: true,
        isUsed: false,
        isExpired: false,
        code: authCode,
      };
    } catch (error) {
      console.error('Error validating authorization code:', error);
      throw error;
    }
  }

  /**
   * 認可コードを使用済みとしてマーク（原子的操作）
   */
  static async markCodeAsUsed(code: string): Promise<boolean> {
    try {
      // 原子的更新：未使用の場合のみ使用済みにマーク
      const { data, error } = await supabase
        .from('oauth_authorization_codes')
        .update({
          is_used: true,
          used_at: new Date().toISOString(),
        })
        .eq('code', code)
        .eq('is_used', false) // 未使用の場合のみ更新
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // 更新対象が見つからない = 既に使用済み
          return false;
        }
        console.error('Failed to mark authorization code as used:', error);
        throw new Error('Failed to mark authorization code as used');
      }

      return true; // 正常に使用済みマークが完了
    } catch (error) {
      console.error('Error marking authorization code as used:', error);
      throw error;
    }
  }

  /**
   * 認可コードを交換（検証 + 使用済みマーク + トークン生成準備）
   */
  static async exchangeAuthorizationCode(
    code: string,
    clientId: string,
    redirectUri: string,
    codeVerifier?: string
  ): Promise<{
    success: boolean;
    authCode?: OAuthAuthorizationCode;
    error?: string;
  }> {
    try {
      // 1. 認可コード検証
      const validation = await this.validateAuthorizationCode(code, clientId, redirectUri);
      
      if (!validation.isValid || !validation.code) {
        return {
          success: false,
          error: validation.error || 'Invalid authorization code',
        };
      }

      const authCode = validation.code;

      // 2. PKCE検証（code_challengeが設定されている場合）
      if (authCode.code_challenge) {
        if (!codeVerifier) {
          return {
            success: false,
            error: 'code_verifier is required for PKCE',
          };
        }

        const isPKCEValid = PKCEManager.verifyPKCE(
          authCode.code_challenge,
          codeVerifier,
          authCode.code_challenge_method || 'S256'
        );

        if (!isPKCEValid) {
          return {
            success: false,
            error: 'Invalid code_verifier',
          };
        }
      }

      // 3. 認可コードを使用済みとしてマーク（原子的操作）
      const markedAsUsed = await this.markCodeAsUsed(code);
      
      if (!markedAsUsed) {
        return {
          success: false,
          error: 'Authorization code has already been used',
        };
      }

      return {
        success: true,
        authCode,
      };
    } catch (error) {
      console.error('Error exchanging authorization code:', error);
      return {
        success: false,
        error: 'Internal server error',
      };
    }
  }

  /**
   * 期限切れ認可コードのクリーンアップ
   */
  static async cleanupExpiredCodes(): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('oauth_authorization_codes')
        .delete()
        .lt('expires_at', new Date().toISOString())
        .select('id');

      if (error) {
        console.error('Failed to cleanup expired authorization codes:', error);
        throw new Error('Failed to cleanup expired authorization codes');
      }

      const deletedCount = data?.length || 0;
      console.log(`Cleaned up ${deletedCount} expired authorization codes`);
      
      return deletedCount;
    } catch (error) {
      console.error('Error cleaning up expired authorization codes:', error);
      throw error;
    }
  }

  /**
   * ユーザーの認可コード一覧を取得（デバッグ用）
   */
  static async getUserAuthorizationCodes(
    userId: string,
    limit: number = 10
  ): Promise<OAuthAuthorizationCode[]> {
    try {
      const { data, error } = await supabase
        .from('oauth_authorization_codes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Failed to fetch user authorization codes:', error);
        throw new Error('Failed to fetch user authorization codes');
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching user authorization codes:', error);
      throw error;
    }
  }

  /**
   * クライアントの認可コード統計を取得
   */
  static async getClientCodeStats(clientId: string): Promise<{
    totalCodes: number;
    usedCodes: number;
    expiredCodes: number;
    activeCodes: number;
  }> {
    try {
      const { data, error } = await supabase
        .from('oauth_authorization_codes')
        .select('is_used, expires_at')
        .eq('client_id', clientId);

      if (error) {
        console.error('Failed to fetch client code stats:', error);
        throw new Error('Failed to fetch client code stats');
      }

      const codes = data || [];
      const now = new Date();

      const totalCodes = codes.length;
      const usedCodes = codes.filter(code => code.is_used).length;
      const expiredCodes = codes.filter(code => new Date(code.expires_at) < now).length;
      const activeCodes = codes.filter(code => 
        !code.is_used && new Date(code.expires_at) >= now
      ).length;

      return {
        totalCodes,
        usedCodes,
        expiredCodes,
        activeCodes,
      };
    } catch (error) {
      console.error('Error fetching client code stats:', error);
      throw error;
    }
  }

  /**
   * 認可コードの再利用攻撃検出
   */
  static async detectReuseAttempt(code: string): Promise<{
    isReuseAttempt: boolean;
    originalUsage?: {
      used_at: string;
      client_id: string;
      user_id: string;
    };
  }> {
    try {
      const { data, error } = await supabase
        .from('oauth_authorization_codes')
        .select('is_used, used_at, client_id, user_id')
        .eq('code', code)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return { isReuseAttempt: false };
        }
        console.error('Failed to check code reuse:', error);
        throw new Error('Failed to check code reuse');
      }

      if (data.is_used && data.used_at) {
        return {
          isReuseAttempt: true,
          originalUsage: {
            used_at: data.used_at,
            client_id: data.client_id,
            user_id: data.user_id,
          },
        };
      }

      return { isReuseAttempt: false };
    } catch (error) {
      console.error('Error detecting code reuse attempt:', error);
      throw error;
    }
  }
}

/**
 * 認可コード検証ヘルパー
 */
export class AuthorizationCodeValidator {
  /**
   * 包括的な認可コード検証
   */
  static async validateForTokenExchange(
    code: string,
    clientId: string,
    redirectUri: string,
    codeVerifier?: string
  ): Promise<{
    isValid: boolean;
    authCode?: OAuthAuthorizationCode;
    error?: string;
    securityAlert?: string;
  }> {
    try {
      // 再利用攻撃検出
      const reuseCheck = await OAuthAuthorizationCodeManager.detectReuseAttempt(code);
      
      if (reuseCheck.isReuseAttempt) {
        return {
          isValid: false,
          error: 'Authorization code has already been used',
          securityAlert: `Code reuse attempt detected. Original usage: ${reuseCheck.originalUsage?.used_at}`,
        };
      }

      // 認可コード交換
      const exchange = await OAuthAuthorizationCodeManager.exchangeAuthorizationCode(
        code,
        clientId,
        redirectUri,
        codeVerifier
      );

      if (!exchange.success) {
        return {
          isValid: false,
          error: exchange.error,
        };
      }

      return {
        isValid: true,
        authCode: exchange.authCode,
      };
    } catch (error) {
      console.error('Error validating authorization code for token exchange:', error);
      return {
        isValid: false,
        error: 'Internal server error',
      };
    }
  }
}