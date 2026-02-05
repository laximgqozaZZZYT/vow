/**
 * CLI Token Service
 *
 * Business logic for CLI JWT token management.
 * Provides token generation, verification, and lifecycle management.
 */

import * as jose from 'jose';
import { createHash, randomBytes } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { CliTokenRepository } from '../repositories/cliTokenRepository.js';
import { getSettings } from '../config.js';
import { AuthenticationError, TokenExpiredError } from '../errors/index.js';
import { getLogger } from '../utils/logger.js';
import type {
  CliTokenDb,
  CreateCliTokenResponse,
  CliTokenResponse,
  RefreshTokenResponse,
  CliJwtPayload,
} from '../schemas/cliToken.js';

const logger = getLogger('services.cliToken');

// Token configuration
const ACCESS_TOKEN_EXPIRY = '15m'; // 15 minutes
const DEFAULT_REFRESH_TOKEN_EXPIRY_DAYS = 30; // 30 days
const MAX_TOKENS_PER_USER = 10;

/**
 * Service for CLI JWT token management.
 */
export class CliTokenService {
  private readonly repository: CliTokenRepository;

  constructor(supabase: SupabaseClient) {
    this.repository = new CliTokenRepository(supabase);
  }

  /**
   * Create a new CLI token pair (access + refresh).
   *
   * @param userId - The user ID to create tokens for.
   * @param name - User-provided name for the token.
   * @param scopes - Allowed scopes for this token.
   * @param expirationDays - Refresh token expiration in days (default: 30).
   * @returns Token pair with access token, refresh token, and metadata.
   */
  async createToken(
    userId: string,
    name: string,
    scopes: string[] = ['cli:read', 'cli:write'],
    expirationDays: number = DEFAULT_REFRESH_TOKEN_EXPIRY_DAYS
  ): Promise<CreateCliTokenResponse> {
    // Check token limit
    const tokenCount = await this.repository.countActiveByUserId(userId);
    if (tokenCount >= MAX_TOKENS_PER_USER) {
      throw new Error(`Maximum number of CLI tokens (${MAX_TOKENS_PER_USER}) reached. Please revoke an existing token first.`);
    }

    // Generate refresh token (random 32 bytes = 64 hex chars)
    const refreshToken = randomBytes(32).toString('hex');
    const refreshTokenHash = this.hashToken(refreshToken);

    // Calculate expiration dates (validate expiration days: 7-365)
    const validExpirationDays = Math.min(Math.max(expirationDays, 7), 365);
    const now = new Date();
    const refreshExpiresAt = new Date(now);
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + validExpirationDays);

    // Save to database
    const tokenRecord = await this.repository.createToken({
      userId,
      name,
      refreshTokenHash,
      scopes,
      expiresAt: refreshExpiresAt.toISOString(),
    });

    // Generate access token
    const { accessToken, accessExpiresAt } = await this.generateAccessToken(
      userId,
      tokenRecord.id,
      scopes
    );

    logger.info('CLI token created', {
      userId,
      tokenId: tokenRecord.id,
      name,
      scopes,
      expirationDays: validExpirationDays,
    });

    return {
      id: tokenRecord.id,
      accessToken,
      refreshToken,
      name,
      scopes,
      accessTokenExpiresAt: accessExpiresAt.toISOString(),
      refreshTokenExpiresAt: refreshExpiresAt.toISOString(),
      createdAt: tokenRecord.created_at,
    };
  }

  /**
   * Refresh an access token using a refresh token.
   *
   * @param refreshToken - The refresh token.
   * @returns New access token and expiration.
   */
  async refreshAccessToken(refreshToken: string): Promise<RefreshTokenResponse> {
    const refreshTokenHash = this.hashToken(refreshToken);

    // Find token record
    const tokenRecord = await this.repository.findByRefreshTokenHash(refreshTokenHash);
    if (!tokenRecord) {
      throw new AuthenticationError('Invalid or expired refresh token');
    }

    // Update last used timestamp
    await this.repository.updateLastUsed(tokenRecord.id);

    // Generate new access token
    const { accessToken, accessExpiresAt } = await this.generateAccessToken(
      tokenRecord.user_id,
      tokenRecord.id,
      tokenRecord.scopes
    );

    logger.info('Access token refreshed', {
      userId: tokenRecord.user_id,
      tokenId: tokenRecord.id,
    });

    return {
      accessToken,
      expiresAt: accessExpiresAt.toISOString(),
    };
  }

  /**
   * Verify an access token and return the payload.
   *
   * @param accessToken - The access token to verify.
   * @returns The decoded JWT payload.
   */
  async verifyAccessToken(accessToken: string): Promise<CliJwtPayload> {
    const settings = getSettings();
    const secret = new TextEncoder().encode(settings.jwtSecret);

    try {
      const { payload } = await jose.jwtVerify(accessToken, secret, {
        algorithms: ['HS256'],
      });

      // Validate token type
      if (payload['type'] !== 'cli_access') {
        throw new AuthenticationError('Invalid token type');
      }

      // Update last used timestamp (don't await to avoid slowing down requests)
      const tid = payload['tid'];
      if (tid && typeof tid === 'string') {
        this.repository.updateLastUsed(tid).catch((err) => {
          logger.warning('Failed to update last_used_at', { error: err });
        });
      }

      return payload as unknown as CliJwtPayload;
    } catch (error) {
      if (error instanceof jose.errors.JWTExpired) {
        throw new TokenExpiredError();
      }
      if (error instanceof AuthenticationError) {
        throw error;
      }
      throw new AuthenticationError('Invalid CLI access token');
    }
  }

  /**
   * List all active tokens for a user.
   *
   * @param userId - The user ID.
   * @returns List of token metadata (without sensitive data).
   */
  async listTokens(userId: string): Promise<CliTokenResponse[]> {
    const tokens = await this.repository.findActiveByUserId(userId);

    return tokens.map((token) => this.mapToResponse(token));
  }

  /**
   * Revoke a CLI token.
   *
   * @param userId - The user ID (for ownership verification).
   * @param tokenId - The token ID to revoke.
   * @returns True if revoked successfully, false if not found.
   */
  async revokeToken(userId: string, tokenId: string): Promise<boolean> {
    const result = await this.repository.markRevoked(tokenId, userId);

    if (result) {
      logger.info('CLI token revoked', {
        userId,
        tokenId,
      });
    }

    return result !== null;
  }

  /**
   * Clean up expired tokens.
   *
   * @returns Number of tokens deleted.
   */
  async cleanupExpiredTokens(): Promise<number> {
    const count = await this.repository.deleteExpiredTokens();
    if (count > 0) {
      logger.info('Cleaned up expired CLI tokens', { count });
    }
    return count;
  }

  /**
   * Extend the expiration of a CLI token.
   *
   * Allows a user to extend the expiration date of an active CLI token.
   * The new expiration is calculated from the current date plus the
   * specified number of days (7-365 days).
   *
   * @param userId - The unique identifier of the user (for ownership verification).
   * @param tokenId - The unique identifier of the CLI token to extend.
   * @param extensionDays - Number of days to extend from now (7-365).
   * @returns The updated CLI token response, or null if not found.
   */
  async extendExpiration(
    userId: string,
    tokenId: string,
    extensionDays: number
  ): Promise<CliTokenResponse | null> {
    // Calculate new expiration date (validate: 7-365 days)
    const validExtensionDays = Math.min(Math.max(extensionDays, 7), 365);
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + validExtensionDays);

    // Update the expiration
    const updatedToken = await this.repository.extendExpiration(
      tokenId,
      userId,
      newExpiresAt.toISOString()
    );

    if (!updatedToken) {
      return null;
    }

    logger.info('CLI token expiration extended', {
      userId,
      tokenId,
      extensionDays: validExtensionDays,
      newExpiresAt: newExpiresAt.toISOString(),
    });

    return this.mapToResponse(updatedToken);
  }

  /**
   * Generate a new access token.
   */
  private async generateAccessToken(
    userId: string,
    tokenId: string,
    scopes: string[]
  ): Promise<{ accessToken: string; accessExpiresAt: Date }> {
    const settings = getSettings();
    const secret = new TextEncoder().encode(settings.jwtSecret);

    const now = new Date();
    const accessExpiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes

    const payload: Omit<CliJwtPayload, 'iat' | 'exp'> = {
      sub: userId,
      tid: tokenId,
      scopes,
      type: 'cli_access',
    };

    const accessToken = await new jose.SignJWT(payload as unknown as jose.JWTPayload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(ACCESS_TOKEN_EXPIRY)
      .sign(secret);

    return { accessToken, accessExpiresAt };
  }

  /**
   * Hash a token using SHA-256.
   */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Map database record to response DTO.
   */
  private mapToResponse(token: CliTokenDb): CliTokenResponse {
    const now = new Date();
    const expiresAt = new Date(token.expires_at);
    const isActive = token.revoked_at === null && expiresAt > now;

    return {
      id: token.id,
      name: token.name,
      scopes: token.scopes,
      createdAt: token.created_at,
      lastUsedAt: token.last_used_at,
      expiresAt: token.expires_at,
      isActive,
    };
  }
}
