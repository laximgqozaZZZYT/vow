/**
 * OAuth Security Utilities
 * Implements security best practices for OAuth 2.0 implementation
 */

import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Base64urlManager } from './base64url-manager';

// セキュリティ設定
export const SECURITY_CONFIG = {
  // bcrypt設定
  BCRYPT_ROUNDS: 12,
  
  // トークン設定（バイト数）
  ACCESS_TOKEN_LENGTH: 32,
  REFRESH_TOKEN_LENGTH: 32,
  AUTHORIZATION_CODE_LENGTH: 32,
  CLIENT_ID_LENGTH: 16,
  CLIENT_SECRET_LENGTH: 32,
  
  // 有効期限設定
  AUTHORIZATION_CODE_TTL: 60, // 1分（秒）
  ACCESS_TOKEN_TTL: 15 * 60, // 15分（秒）
  REFRESH_TOKEN_TTL: 30 * 24 * 60 * 60, // 30日（秒）
  
  // レート制限設定
  RATE_LIMITS: {
    authorize: { limit: 10, window: 60 }, // 10回/分
    token: { limit: 5, window: 60 }, // 5回/分
    api: { limit: 1000, window: 3600 }, // 1000回/時間
  },
} as const;

/**
 * Client Secret セキュリティ管理
 */
export class ClientSecretManager {
  /**
   * Client Secret をハッシュ化
   */
  static async hashSecret(secret: string): Promise<{ hash: string; salt: string }> {
    const salt = Base64urlManager.generateToken(32);
    const hash = await bcrypt.hash(secret + salt, SECURITY_CONFIG.BCRYPT_ROUNDS);
    
    return { hash, salt };
  }

  /**
   * Client Secret を検証（定数時間比較）
   */
  static async verifySecret(
    secret: string,
    hash: string,
    salt: string
  ): Promise<boolean> {
    try {
      return await bcrypt.compare(secret + salt, hash);
    } catch (error) {
      console.error('Client secret verification error:', error);
      return false;
    }
  }

  /**
   * セキュアなClient Secret生成（base64url）
   */
  static generateSecret(): string {
    return Base64urlManager.generateClientSecret();
  }
}

/**
 * PKCE (Proof Key for Code Exchange) 実装
 */
export class PKCEManager {
  /**
   * Code Verifier 生成（base64url）
   */
  static generateCodeVerifier(): string {
    return Base64urlManager.generateCodeVerifier();
  }

  /**
   * Code Challenge 生成（S256メソッド、base64url）
   */
  static generateCodeChallenge(verifier: string): string {
    return Base64urlManager.generateCodeChallenge(verifier);
  }

  /**
   * PKCE 検証
   */
  static verifyPKCE(
    challenge: string,
    verifier: string,
    method: string = 'S256'
  ): boolean {
    if (method !== 'S256') {
      return false;
    }

    return Base64urlManager.verifyCodeChallenge(challenge, verifier);
  }
}

/**
 * 認可コード管理
 */
export class AuthorizationCodeManager {
  /**
   * セキュアな認可コード生成（base64url）
   */
  static generateCode(): string {
    return Base64urlManager.generateAuthorizationCode();
  }

  /**
   * 認可コード有効期限チェック
   */
  static isExpired(createdAt: Date): boolean {
    const now = new Date();
    const expiresAt = new Date(createdAt.getTime() + SECURITY_CONFIG.AUTHORIZATION_CODE_TTL * 1000);
    return now > expiresAt;
  }
}

/**
 * トークン管理
 */
export class TokenManager {
  /**
   * セキュアなアクセストークン生成（base64url）
   */
  static generateAccessToken(): string {
    return Base64urlManager.generateAccessToken();
  }

  /**
   * セキュアなリフレッシュトークン生成（base64url）
   */
  static generateRefreshToken(): string {
    return Base64urlManager.generateRefreshToken();
  }

  /**
   * トークンハッシュ化
   */
  static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * トークン検証
   */
  static verifyToken(token: string, hash: string): boolean {
    const tokenHash = this.hashToken(token);
    
    // 定数時間比較
    return crypto.timingSafeEqual(
      Buffer.from(tokenHash),
      Buffer.from(hash)
    );
  }
}

/**
 * 監査ログ管理
 */
export class AuditLogManager {
  /**
   * User-Agent ハッシュ化
   */
  static hashUserAgent(userAgent: string): string {
    return crypto.createHash('sha256').update(userAgent).digest('hex');
  }

  /**
   * ログハッシュ生成（改ざん防止）
   */
  static generateLogHash(
    clientId: string | null,
    userId: string | null,
    action: string,
    success: boolean,
    previousHash: string | null = null
  ): string {
    const data = [
      clientId || '',
      userId || '',
      action,
      success.toString(),
      previousHash || '',
      Date.now().toString(),
    ].join('|');

    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * ログ整合性検証
   */
  static verifyLogIntegrity(
    logEntry: {
      client_id: string | null;
      user_id: string | null;
      action: string;
      success: boolean;
      log_hash: string;
      previous_log_hash: string | null;
    }
  ): boolean {
    const expectedHash = this.generateLogHash(
      logEntry.client_id,
      logEntry.user_id,
      logEntry.action,
      logEntry.success,
      logEntry.previous_log_hash
    );

    return crypto.timingSafeEqual(
      Buffer.from(logEntry.log_hash),
      Buffer.from(expectedHash)
    );
  }
}

/**
 * レート制限管理
 */
export class RateLimitManager {
  /**
   * レート制限チェック
   */
  static isRateLimited(
    endpoint: keyof typeof SECURITY_CONFIG.RATE_LIMITS,
    requestCount: number,
    windowStart: Date
  ): boolean {
    const config = SECURITY_CONFIG.RATE_LIMITS[endpoint];
    const now = new Date();
    const windowEnd = new Date(windowStart.getTime() + config.window * 1000);

    // ウィンドウが期限切れの場合は制限なし
    if (now > windowEnd) {
      return false;
    }

    // リクエスト数が制限を超えている場合は制限あり
    return requestCount >= config.limit;
  }

  /**
   * 次のリセット時刻計算
   */
  static getResetTime(
    endpoint: keyof typeof SECURITY_CONFIG.RATE_LIMITS,
    windowStart: Date
  ): Date {
    const config = SECURITY_CONFIG.RATE_LIMITS[endpoint];
    return new Date(windowStart.getTime() + config.window * 1000);
  }
}

/**
 * リダイレクトURI検証
 */
export class RedirectURIValidator {
  /**
   * リダイレクトURIの厳密検証
   */
  static validateURI(uri: string, isProduction: boolean = false): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    try {
      const url = new URL(uri);

      // フラグメント識別子の禁止
      if (url.hash) {
        errors.push('Fragment identifiers are not allowed in redirect URIs');
      }

      // 本番環境でのHTTPS強制
      if (isProduction && url.protocol !== 'https:') {
        if (!['localhost', '127.0.0.1'].includes(url.hostname)) {
          errors.push('HTTPS is required for production redirect URIs');
        }
      }

      // 危険なスキームの禁止
      const allowedProtocols = ['https:', 'http:'];
      if (!allowedProtocols.includes(url.protocol)) {
        errors.push(`Protocol ${url.protocol} is not allowed`);
      }

      // ローカルホスト以外でのHTTP禁止（本番環境）
      if (isProduction && url.protocol === 'http:') {
        if (!['localhost', '127.0.0.1'].includes(url.hostname)) {
          errors.push('HTTP is only allowed for localhost in production');
        }
      }

    } catch (error) {
      errors.push('Invalid URL format');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * リダイレクトURI完全一致検証
   */
  static exactMatch(registeredURI: string, providedURI: string): boolean {
    return registeredURI === providedURI;
  }
}

/**
 * セキュリティユーティリティ
 */
export class SecurityUtils {
  /**
   * セキュアなランダム文字列生成
   */
  static generateSecureRandom(length: number = 32): string {
    return crypto.randomBytes(length).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  /**
   * 定数時間文字列比較
   */
  static timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(a),
      Buffer.from(b)
    );
  }

  /**
   * IPアドレス部分マスキング
   */
  static maskIPAddress(ip: string): string {
    if (ip.includes(':')) {
      // IPv6
      const parts = ip.split(':');
      return parts.slice(0, 4).join(':') + '::****';
    } else {
      // IPv4
      const parts = ip.split('.');
      return parts.slice(0, 2).join('.') + '.***.***.';
    }
  }
}

/**
 * セキュリティ設定検証
 */
export class SecurityConfigValidator {
  /**
   * 設定値の検証
   */
  static validateConfig(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // bcrypt rounds チェック
    if (SECURITY_CONFIG.BCRYPT_ROUNDS < 10) {
      errors.push('bcrypt rounds should be at least 10');
    }

    // トークン長チェック
    if (SECURITY_CONFIG.ACCESS_TOKEN_LENGTH < 32) {
      errors.push('Access token length should be at least 32 bytes');
    }

    // 有効期限チェック
    if (SECURITY_CONFIG.AUTHORIZATION_CODE_TTL > 600) {
      errors.push('Authorization code TTL should not exceed 10 minutes');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

// 設定検証の実行
const configValidation = SecurityConfigValidator.validateConfig();
if (!configValidation.isValid) {
  console.warn('Security configuration issues:', configValidation.errors);
}