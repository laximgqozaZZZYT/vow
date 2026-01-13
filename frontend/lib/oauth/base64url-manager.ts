/**
 * Base64url Manager
 * RFC 4648 Section 5 compliant base64url encoding/decoding for OAuth identifiers
 * Uses Node.js v22.18.0 Buffer API for optimal performance
 */

import crypto from 'crypto';

/**
 * Base64url Manager for URL-safe encoding of OAuth identifiers
 */
export class Base64urlManager {
  /**
   * Encode data to base64url format (RFC 4648 Section 5)
   * @param data - Buffer or string to encode
   * @returns base64url encoded string (URL-safe, no padding)
   */
  static encode(data: Buffer | string): string {
    const buffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
    
    return buffer
      .toString('base64')
      .replace(/\+/g, '-')    // Replace + with -
      .replace(/\//g, '_')    // Replace / with _
      .replace(/=/g, '');     // Remove padding
  }

  /**
   * Decode base64url string to Buffer
   * @param encoded - base64url encoded string
   * @returns decoded Buffer
   */
  static decode(encoded: string): Buffer {
    // Restore padding
    const padded = encoded + '='.repeat((4 - encoded.length % 4) % 4);
    
    // Convert base64url to standard base64
    const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
    
    return Buffer.from(base64, 'base64');
  }

  /**
   * Generate cryptographically secure random token with base64url encoding
   * @param length - Number of random bytes to generate (default: 32)
   * @returns base64url encoded random token
   */
  static generateToken(length: number = 32): string {
    const randomBytes = crypto.randomBytes(length);
    return this.encode(randomBytes);
  }

  /**
   * Generate base64url encoded client ID (128-bit entropy)
   * @returns base64url encoded client ID
   */
  static generateClientId(): string {
    return this.generateToken(16); // 128-bit
  }

  /**
   * Generate base64url encoded client secret (256-bit entropy)
   * @returns base64url encoded client secret
   */
  static generateClientSecret(): string {
    return this.generateToken(32); // 256-bit
  }

  /**
   * Generate base64url encoded authorization code (256-bit entropy)
   * @returns base64url encoded authorization code
   */
  static generateAuthorizationCode(): string {
    return this.generateToken(32); // 256-bit
  }

  /**
   * Generate base64url encoded access token (256-bit entropy)
   * @returns base64url encoded access token
   */
  static generateAccessToken(): string {
    return this.generateToken(32); // 256-bit
  }

  /**
   * Generate base64url encoded refresh token (256-bit entropy)
   * @returns base64url encoded refresh token
   */
  static generateRefreshToken(): string {
    return this.generateToken(32); // 256-bit
  }

  /**
   * Validate base64url format
   * @param encoded - String to validate
   * @returns true if valid base64url format
   */
  static isValidBase64url(encoded: string): boolean {
    // Check for valid base64url characters only
    const base64urlRegex = /^[A-Za-z0-9_-]+$/;
    
    if (!base64urlRegex.test(encoded)) {
      return false;
    }

    try {
      // Try to decode - if it fails, it's not valid
      this.decode(encoded);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get entropy bits for a base64url encoded string
   * @param encoded - base64url encoded string
   * @returns number of entropy bits
   */
  static getEntropyBits(encoded: string): number {
    try {
      const decoded = this.decode(encoded);
      return decoded.length * 8; // 8 bits per byte
    } catch {
      return 0;
    }
  }

  /**
   * Generate PKCE code verifier (RFC 7636)
   * @returns base64url encoded code verifier (43-128 characters)
   */
  static generateCodeVerifier(): string {
    // Generate 32 random bytes (256 bits) for high entropy
    // This results in 43 base64url characters (within RFC 7636 range)
    return this.generateToken(32);
  }

  /**
   * Generate PKCE code challenge from verifier (RFC 7636)
   * @param codeVerifier - base64url encoded code verifier
   * @returns base64url encoded SHA256 hash of verifier
   */
  static generateCodeChallenge(codeVerifier: string): string {
    const hash = crypto.createHash('sha256').update(codeVerifier).digest();
    return this.encode(hash);
  }

  /**
   * Verify PKCE code challenge against verifier
   * @param codeChallenge - base64url encoded code challenge
   * @param codeVerifier - base64url encoded code verifier
   * @returns true if challenge matches verifier
   */
  static verifyCodeChallenge(codeChallenge: string, codeVerifier: string): boolean {
    try {
      const expectedChallenge = this.generateCodeChallenge(codeVerifier);
      return codeChallenge === expectedChallenge;
    } catch {
      return false;
    }
  }

  /**
   * Generate state parameter for OAuth flow
   * @returns base64url encoded state parameter
   */
  static generateState(): string {
    return this.generateToken(16); // 128-bit
  }

  /**
   * Convert standard base64 to base64url
   * @param base64 - standard base64 string
   * @returns base64url string
   */
  static fromBase64(base64: string): string {
    return base64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Convert base64url to standard base64
   * @param base64url - base64url string
   * @returns standard base64 string
   */
  static toBase64(base64url: string): string {
    // Restore padding
    const padded = base64url + '='.repeat((4 - base64url.length % 4) % 4);
    
    // Convert to standard base64
    return padded.replace(/-/g, '+').replace(/_/g, '/');
  }

  /**
   * Encode string to base64url
   * @param str - string to encode
   * @returns base64url encoded string
   */
  static encodeString(str: string): string {
    return this.encode(Buffer.from(str, 'utf8'));
  }

  /**
   * Decode base64url to string
   * @param encoded - base64url encoded string
   * @returns decoded string
   */
  static decodeString(encoded: string): string {
    return this.decode(encoded).toString('utf8');
  }
}

/**
 * OAuth Token Generator using Base64url encoding
 */
export class OAuthTokenGenerator {
  /**
   * Generate all tokens for a new client application
   */
  static generateClientCredentials(): {
    clientId: string;
    clientSecret: string;
  } {
    return {
      clientId: Base64urlManager.generateClientId(),
      clientSecret: Base64urlManager.generateClientSecret(),
    };
  }

  /**
   * Generate authorization code with metadata
   */
  static generateAuthorizationCodeData(): {
    code: string;
    entropy: number;
    createdAt: Date;
  } {
    const code = Base64urlManager.generateAuthorizationCode();
    return {
      code,
      entropy: Base64urlManager.getEntropyBits(code),
      createdAt: new Date(),
    };
  }

  /**
   * Generate access token pair
   */
  static generateTokenPair(): {
    accessToken: string;
    refreshToken: string;
    entropy: {
      access: number;
      refresh: number;
    };
  } {
    const accessToken = Base64urlManager.generateAccessToken();
    const refreshToken = Base64urlManager.generateRefreshToken();

    return {
      accessToken,
      refreshToken,
      entropy: {
        access: Base64urlManager.getEntropyBits(accessToken),
        refresh: Base64urlManager.getEntropyBits(refreshToken),
      },
    };
  }

  /**
   * Generate PKCE pair for OAuth flow
   */
  static generatePKCEPair(): {
    codeVerifier: string;
    codeChallenge: string;
    codeChallengeMethod: 'S256';
  } {
    const codeVerifier = Base64urlManager.generateCodeVerifier();
    const codeChallenge = Base64urlManager.generateCodeChallenge(codeVerifier);

    return {
      codeVerifier,
      codeChallenge,
      codeChallengeMethod: 'S256',
    };
  }
}

// Export default instance for convenience
export default Base64urlManager;