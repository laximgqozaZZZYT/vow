/**
 * OAuth Redirect URI Manager
 * Handles redirect URI management with validation and CORS integration
 */

import { createClient } from '@supabase/supabase-js';

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

export interface OAuthRedirectURI {
  id: string;
  application_id: string;
  uri: string;
  is_active: boolean;
  created_at: string;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * OAuth Redirect URI Manager
 */
export class RedirectURIManager {
  /**
   * リダイレクトURIを追加
   */
  static async addRedirectURI(
    applicationId: string,
    uri: string
  ): Promise<OAuthRedirectURI> {
    try {
      // URI検証
      const validation = this.validateURI(uri);
      if (!validation.isValid) {
        throw new Error(validation.error || 'Invalid redirect URI');
      }

      // 最大URI数チェック
      const existingURIs = await this.getRedirectURIs(applicationId);
      if (existingURIs.length >= 10) {
        throw new Error('Maximum 10 redirect URIs allowed per application');
      }

      // データベースに保存
      const { data, error } = await supabase
        .from('oauth_redirect_uris')
        .insert({
          application_id: applicationId,
          uri: uri.trim(),
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          throw new Error('This redirect URI is already registered for this application');
        }
        console.error('Failed to add redirect URI:', error);
        throw new Error('Failed to add redirect URI');
      }

      // CORS設定を更新（非同期で実行）
      this.updateCORSSettings(applicationId).catch(err => {
        console.error('Failed to update CORS settings:', err);
      });

      return data;
    } catch (error) {
      console.error('Error adding redirect URI:', error);
      throw error;
    }
  }

  /**
   * リダイレクトURI一覧を取得
   */
  static async getRedirectURIs(applicationId: string): Promise<OAuthRedirectURI[]> {
    try {
      const { data, error } = await supabase
        .from('oauth_redirect_uris')
        .select('*')
        .eq('application_id', applicationId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch redirect URIs:', error);
        throw new Error('Failed to fetch redirect URIs');
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching redirect URIs:', error);
      throw error;
    }
  }

  /**
   * リダイレクトURIを更新
   */
  static async updateRedirectURI(
    uriId: string,
    newUri: string
  ): Promise<OAuthRedirectURI> {
    try {
      // URI検証
      const validation = this.validateURI(newUri);
      if (!validation.isValid) {
        throw new Error(validation.error || 'Invalid redirect URI');
      }

      const { data, error } = await supabase
        .from('oauth_redirect_uris')
        .update({
          uri: newUri.trim(),
        })
        .eq('id', uriId)
        .select()
        .single();

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          throw new Error('This redirect URI is already registered for this application');
        }
        console.error('Failed to update redirect URI:', error);
        throw new Error('Failed to update redirect URI');
      }

      // CORS設定を更新（非同期で実行）
      this.updateCORSSettings(data.application_id).catch(err => {
        console.error('Failed to update CORS settings:', err);
      });

      return data;
    } catch (error) {
      console.error('Error updating redirect URI:', error);
      throw error;
    }
  }

  /**
   * リダイレクトURIを削除
   */
  static async deleteRedirectURI(uriId: string): Promise<void> {
    try {
      // 削除前にアプリケーションIDを取得（CORS更新用）
      const { data: uriData } = await supabase
        .from('oauth_redirect_uris')
        .select('application_id')
        .eq('id', uriId)
        .single();

      const { error } = await supabase
        .from('oauth_redirect_uris')
        .delete()
        .eq('id', uriId);

      if (error) {
        console.error('Failed to delete redirect URI:', error);
        throw new Error('Failed to delete redirect URI');
      }

      // CORS設定を更新（非同期で実行）
      if (uriData) {
        this.updateCORSSettings(uriData.application_id).catch(err => {
          console.error('Failed to update CORS settings:', err);
        });
      }
    } catch (error) {
      console.error('Error deleting redirect URI:', error);
      throw error;
    }
  }

  /**
   * リダイレクトURIを検証
   */
  static validateURI(uri: string): ValidationResult {
    try {
      const url = new URL(uri);

      // プロトコル検証
      if (!['http:', 'https:'].includes(url.protocol)) {
        return {
          isValid: false,
          error: 'Only HTTP and HTTPS protocols are allowed'
        };
      }

      // 本番環境ではHTTPS必須（localhostは除く）
      if (process.env.NODE_ENV === 'production' && 
          url.protocol === 'http:' && 
          !['localhost', '127.0.0.1'].includes(url.hostname)) {
        return {
          isValid: false,
          error: 'HTTPS is required in production (except for localhost)'
        };
      }

      // フラグメント識別子の禁止
      if (url.hash) {
        return {
          isValid: false,
          error: 'Fragment identifiers (#) are not allowed in redirect URIs'
        };
      }

      // 長さ制限
      if (uri.length > 2048) {
        return {
          isValid: false,
          error: 'Redirect URI must be less than 2048 characters'
        };
      }

      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        error: 'Invalid URL format'
      };
    }
  }

  /**
   * クライアントアプリケーションのリダイレクトURIを検証
   */
  static async validateRedirectURI(
    clientId: string,
    redirectUri: string
  ): Promise<{ isValid: boolean; error?: string }> {
    try {
      // クライアントアプリケーションを取得
      const { data: application, error: appError } = await supabase
        .from('oauth_client_applications')
        .select('id')
        .eq('client_id', clientId)
        .single();

      if (appError || !application) {
        return {
          isValid: false,
          error: 'Invalid client_id'
        };
      }

      // 登録されたリダイレクトURIを取得
      const { data: uris, error: uriError } = await supabase
        .from('oauth_redirect_uris')
        .select('uri')
        .eq('application_id', application.id)
        .eq('is_active', true);

      if (uriError) {
        console.error('Failed to fetch redirect URIs for validation:', uriError);
        return {
          isValid: false,
          error: 'Failed to validate redirect URI'
        };
      }

      // 完全一致チェック
      const isRegistered = uris?.some(uri => uri.uri === redirectUri) || false;

      if (!isRegistered) {
        return {
          isValid: false,
          error: 'Redirect URI is not registered for this client'
        };
      }

      return { isValid: true };
    } catch (error) {
      console.error('Error validating redirect URI:', error);
      return {
        isValid: false,
        error: 'Failed to validate redirect URI'
      };
    }
  }

  /**
   * CORS設定を更新（アプリケーションの全リダイレクトURIに基づく）
   */
  private static async updateCORSSettings(applicationId: string): Promise<void> {
    try {
      // アプリケーションの全リダイレクトURIを取得
      const uris = await this.getRedirectURIs(applicationId);
      
      // ドメインを抽出
      const domains = new Set<string>();
      for (const uri of uris) {
        try {
          const url = new URL(uri.uri);
          domains.add(url.origin);
        } catch (error) {
          console.warn('Invalid URI in CORS update:', uri.uri);
        }
      }

      // TODO: CORS設定の実際の更新処理
      // 現在はログ出力のみ（実装は後続のタスクで行う）
      console.log('CORS domains for application', applicationId, ':', Array.from(domains));
    } catch (error) {
      console.error('Error updating CORS settings:', error);
    }
  }

  /**
   * アプリケーション削除時のクリーンアップ
   */
  static async cleanupApplicationURIs(applicationId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('oauth_redirect_uris')
        .delete()
        .eq('application_id', applicationId);

      if (error) {
        console.error('Failed to cleanup redirect URIs:', error);
        throw new Error('Failed to cleanup redirect URIs');
      }
    } catch (error) {
      console.error('Error cleaning up redirect URIs:', error);
      throw error;
    }
  }

  /**
   * ユーザーの全リダイレクトURI数を取得
   */
  static async getUserRedirectURICount(userId: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('oauth_redirect_uris')
        .select('id', { count: 'exact' })
        .eq('oauth_client_applications.user_id', userId)
        .eq('is_active', true);

      if (error) {
        console.error('Failed to count user redirect URIs:', error);
        return 0;
      }

      return data?.length || 0;
    } catch (error) {
      console.error('Error counting user redirect URIs:', error);
      return 0;
    }
  }

  /**
   * ドメインからオリジンを抽出
   */
  static extractOrigin(uri: string): string | null {
    try {
      const url = new URL(uri);
      return url.origin;
    } catch (error) {
      return null;
    }
  }

  /**
   * 開発環境用のデフォルトリダイレクトURI
   */
  static getDefaultRedirectURIs(): string[] {
    if (process.env.NODE_ENV === 'development') {
      return [
        'http://localhost:3000/oauth/callback',
        'http://localhost:8080/oauth/callback',
        'http://127.0.0.1:3000/oauth/callback'
      ];
    }
    return [];
  }
}

/**
 * リダイレクトURI検証ヘルパー
 */
export class RedirectURIValidator {
  /**
   * 包括的なリダイレクトURI検証
   */
  static async validateForOAuth(
    clientId: string,
    redirectUri: string
  ): Promise<{
    isValid: boolean;
    error?: string;
    origin?: string;
  }> {
    try {
      // 基本的なURI形式検証
      const formatValidation = RedirectURIManager.validateURI(redirectUri);
      if (!formatValidation.isValid) {
        return {
          isValid: false,
          error: formatValidation.error
        };
      }

      // クライアント登録検証
      const clientValidation = await RedirectURIManager.validateRedirectURI(
        clientId,
        redirectUri
      );
      if (!clientValidation.isValid) {
        return {
          isValid: false,
          error: clientValidation.error
        };
      }

      // オリジン抽出
      const origin = RedirectURIManager.extractOrigin(redirectUri);

      return {
        isValid: true,
        origin: origin || undefined
      };
    } catch (error) {
      console.error('Error in comprehensive redirect URI validation:', error);
      return {
        isValid: false,
        error: 'Failed to validate redirect URI'
      };
    }
  }

  /**
   * 複数のリダイレクトURIを一括検証
   */
  static validateMultiple(uris: string[]): {
    valid: string[];
    invalid: { uri: string; error: string }[];
  } {
    const valid: string[] = [];
    const invalid: { uri: string; error: string }[] = [];

    for (const uri of uris) {
      const validation = RedirectURIManager.validateURI(uri);
      if (validation.isValid) {
        valid.push(uri);
      } else {
        invalid.push({
          uri,
          error: validation.error || 'Invalid URI'
        });
      }
    }

    return { valid, invalid };
  }
}