/**
 * OAuth Client Application Manager
 * Handles secure client application management with bcrypt hashing
 */

import { createClient } from '@supabase/supabase-js';
import { ClientSecretManager, SecurityUtils } from './security';
import { Base64urlManager } from './base64url-manager';

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

export interface OAuthClientApplication {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  client_id: string;
  client_secret_hash: string;
  client_type: 'public' | 'confidential';
  salt: string;
  created_at: string;
  updated_at: string;
}

export interface CreateClientApplicationParams {
  userId: string;
  name: string;
  description?: string;
  clientType: 'public' | 'confidential';
}

export interface ClientApplicationWithSecret {
  application: OAuthClientApplication;
  clientSecret: string; // 平文のシークレット（作成時のみ返却）
}

/**
 * OAuth Client Application Manager
 */
export class OAuthClientManager {
  /**
   * 新しいクライアントアプリケーションを作成
   */
  static async createApplication(
    params: CreateClientApplicationParams
  ): Promise<ClientApplicationWithSecret> {
    try {
      // Base64url エンコード済みクライアントIDとシークレットを生成
      const clientId = Base64urlManager.generateClientId();
      const clientSecret = Base64urlManager.generateClientSecret();
      
      // シークレットをハッシュ化
      const { hash, salt } = await ClientSecretManager.hashSecret(clientSecret);

      // データベースに保存
      const { data, error } = await supabase
        .from('oauth_client_applications')
        .insert({
          user_id: params.userId,
          name: params.name,
          description: params.description || null,
          client_id: clientId,
          client_secret_hash: hash,
          client_type: params.clientType,
          salt: salt,
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to create client application:', error);
        throw new Error('Failed to create client application');
      }

      return {
        application: data,
        clientSecret, // 平文のシークレットは作成時のみ返却
      };
    } catch (error) {
      console.error('Error creating client application:', error);
      throw error;
    }
  }

  /**
   * クライアントアプリケーション一覧を取得
   */
  static async getApplications(userId: string): Promise<OAuthClientApplication[]> {
    try {
      const { data, error } = await supabase
        .from('oauth_client_applications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        // Check if the error is due to missing table (database not migrated)
        if (error.code === '42P01' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
          console.warn('OAuth tables not found. Database migration may be required.');
          return []; // Return empty array instead of throwing error
        }
        console.error('Failed to fetch client applications:', error);
        throw new Error('Failed to fetch client applications');
      }

      return data || [];
    } catch (error) {
      // Handle network errors or other issues gracefully
      if (error instanceof Error && error.message.includes('Failed to fetch client applications')) {
        throw error; // Re-throw our custom error
      }
      console.error('Error fetching client applications:', error);
      // Return empty array for other errors to prevent UI crash
      return [];
    }
  }

  /**
   * クライアントアプリケーションを取得（ID指定）
   */
  static async getApplication(
    applicationId: string,
    userId: string
  ): Promise<OAuthClientApplication | null> {
    try {
      const { data, error } = await supabase
        .from('oauth_client_applications')
        .select('*')
        .eq('id', applicationId)
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Not found
        }
        console.error('Failed to fetch client application:', error);
        throw new Error('Failed to fetch client application');
      }

      return data;
    } catch (error) {
      console.error('Error fetching client application:', error);
      throw error;
    }
  }

  /**
   * クライアントアプリケーションを取得（client_id指定）
   */
  static async getApplicationByClientId(
    clientId: string
  ): Promise<OAuthClientApplication | null> {
    try {
      const { data, error } = await supabase
        .from('oauth_client_applications')
        .select('*')
        .eq('client_id', clientId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Not found
        }
        console.error('Failed to fetch client application by client_id:', error);
        throw new Error('Failed to fetch client application');
      }

      return data;
    } catch (error) {
      console.error('Error fetching client application by client_id:', error);
      throw error;
    }
  }

  /**
   * クライアントシークレットを検証
   */
  static async verifyClientSecret(
    clientId: string,
    providedSecret: string
  ): Promise<{ isValid: boolean; application?: OAuthClientApplication }> {
    try {
      const application = await this.getApplicationByClientId(clientId);
      
      if (!application) {
        return { isValid: false };
      }

      // confidentialクライアントのみシークレット検証
      if (application.client_type === 'public') {
        return { isValid: true, application };
      }

      const isValid = await ClientSecretManager.verifySecret(
        providedSecret,
        application.client_secret_hash,
        application.salt
      );

      return { isValid, application: isValid ? application : undefined };
    } catch (error) {
      console.error('Error verifying client secret:', error);
      return { isValid: false };
    }
  }

  /**
   * クライアントアプリケーションを更新
   */
  static async updateApplication(
    applicationId: string,
    userId: string,
    updates: {
      name?: string;
      description?: string;
    }
  ): Promise<OAuthClientApplication> {
    try {
      const { data, error } = await supabase
        .from('oauth_client_applications')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', applicationId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        console.error('Failed to update client application:', error);
        throw new Error('Failed to update client application');
      }

      return data;
    } catch (error) {
      console.error('Error updating client application:', error);
      throw error;
    }
  }

  /**
   * クライアントシークレットを再生成
   */
  static async regenerateSecret(
    applicationId: string,
    userId: string
  ): Promise<{ application: OAuthClientApplication; newSecret: string }> {
    try {
      // 新しいシークレットを生成
      const newSecret = ClientSecretManager.generateSecret();
      const { hash, salt } = await ClientSecretManager.hashSecret(newSecret);

      // データベースを更新
      const { data, error } = await supabase
        .from('oauth_client_applications')
        .update({
          client_secret_hash: hash,
          salt: salt,
          updated_at: new Date().toISOString(),
        })
        .eq('id', applicationId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        console.error('Failed to regenerate client secret:', error);
        throw new Error('Failed to regenerate client secret');
      }

      // 関連するトークンを無効化
      await this.revokeAllTokens(data.client_id);

      return {
        application: data,
        newSecret,
      };
    } catch (error) {
      console.error('Error regenerating client secret:', error);
      throw error;
    }
  }

  /**
   * クライアントアプリケーションを削除
   */
  static async deleteApplication(
    applicationId: string,
    userId: string
  ): Promise<void> {
    try {
      // まず関連するトークンを無効化
      const application = await this.getApplication(applicationId, userId);
      if (application) {
        await this.revokeAllTokens(application.client_id);
      }

      // アプリケーションを削除（CASCADE制約により関連データも削除）
      const { error } = await supabase
        .from('oauth_client_applications')
        .delete()
        .eq('id', applicationId)
        .eq('user_id', userId);

      if (error) {
        console.error('Failed to delete client application:', error);
        throw new Error('Failed to delete client application');
      }
    } catch (error) {
      console.error('Error deleting client application:', error);
      throw error;
    }
  }

  /**
   * クライアントの全トークンを無効化
   */
  static async revokeAllTokens(clientId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('oauth_access_tokens')
        .update({
          revoked_at: new Date().toISOString(),
        })
        .eq('client_id', clientId)
        .is('revoked_at', null);

      if (error) {
        console.error('Failed to revoke tokens:', error);
        throw new Error('Failed to revoke tokens');
      }
    } catch (error) {
      console.error('Error revoking tokens:', error);
      throw error;
    }
  }

  /**
   * クライアント認証統計を取得
   */
  static async getAuthStats(
    clientId: string,
    userId: string
  ): Promise<{
    totalAuthorizations: number;
    successfulAuthorizations: number;
    failedAuthorizations: number;
    lastActivity: string | null;
  }> {
    try {
      // クライアントの所有者確認
      const application = await this.getApplicationByClientId(clientId);
      if (!application || application.user_id !== userId) {
        throw new Error('Unauthorized access to client statistics');
      }

      const { data, error } = await supabase
        .from('oauth_auth_logs')
        .select('success, created_at')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch auth stats:', error);
        throw new Error('Failed to fetch auth stats');
      }

      const logs = data || [];
      const totalAuthorizations = logs.length;
      const successfulAuthorizations = logs.filter(log => log.success).length;
      const failedAuthorizations = totalAuthorizations - successfulAuthorizations;
      const lastActivity = logs.length > 0 ? logs[0].created_at : null;

      return {
        totalAuthorizations,
        successfulAuthorizations,
        failedAuthorizations,
        lastActivity,
      };
    } catch (error) {
      console.error('Error fetching auth stats:', error);
      throw error;
    }
  }

  /**
   * クライアントタイプ検証
   */
  static requiresPKCE(clientType: string): boolean {
    return clientType === 'public';
  }

  /**
   * クライアント認証が必要かチェック
   */
  static requiresAuthentication(clientType: string): boolean {
    return clientType === 'confidential';
  }
}

/**
 * クライアント検証結果
 */
export interface ClientValidationResult {
  isValid: boolean;
  application?: OAuthClientApplication;
  requiresPKCE: boolean;
  requiresAuthentication: boolean;
  error?: string;
}

/**
 * クライアント検証ヘルパー
 */
export class ClientValidator {
  /**
   * 包括的なクライアント検証
   */
  static async validateClient(
    clientId: string,
    clientSecret?: string
  ): Promise<ClientValidationResult> {
    try {
      const application = await OAuthClientManager.getApplicationByClientId(clientId);
      
      if (!application) {
        return {
          isValid: false,
          requiresPKCE: false,
          requiresAuthentication: false,
          error: 'Invalid client_id',
        };
      }

      const requiresAuthentication = OAuthClientManager.requiresAuthentication(application.client_type);
      const requiresPKCE = OAuthClientManager.requiresPKCE(application.client_type);

      // confidentialクライアントの場合はシークレット検証
      if (requiresAuthentication) {
        if (!clientSecret) {
          return {
            isValid: false,
            requiresPKCE,
            requiresAuthentication,
            error: 'client_secret is required for confidential clients',
          };
        }

        const { isValid } = await OAuthClientManager.verifyClientSecret(clientId, clientSecret);
        if (!isValid) {
          return {
            isValid: false,
            requiresPKCE,
            requiresAuthentication,
            error: 'Invalid client_secret',
          };
        }
      }

      return {
        isValid: true,
        application,
        requiresPKCE,
        requiresAuthentication,
      };
    } catch (error) {
      console.error('Error validating client:', error);
      return {
        isValid: false,
        requiresPKCE: false,
        requiresAuthentication: false,
        error: 'Internal server error',
      };
    }
  }
}