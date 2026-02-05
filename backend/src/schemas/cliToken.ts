/**
 * CLI Token Schemas
 *
 * Zod schemas for CLI JWT token management.
 * These schemas define data structures for CLI token creation, validation,
 * and response formatting.
 */

import { z } from 'zod';

// ============================================================================
// CLI Token Database Schema
// ============================================================================

/**
 * Schema for CLI token data from database.
 */
export const cliTokenDbSchema = z.object({
  /** Unique identifier for the CLI token */
  id: z.string().uuid(),
  /** User ID who owns this CLI token */
  user_id: z.string().uuid(),
  /** User-provided name for the CLI token */
  name: z.string().min(1).max(255),
  /** SHA-256 hash of the refresh token */
  refresh_token_hash: z.string().length(64),
  /** Allowed scopes for this token */
  scopes: z.array(z.string()).default(['cli:read', 'cli:write']),
  /** Timestamp when the token was last used (null if never used) */
  last_used_at: z.string().datetime().nullable(),
  /** Timestamp when the refresh token expires */
  expires_at: z.string().datetime(),
  /** Timestamp when the token was revoked (null if active) */
  revoked_at: z.string().datetime().nullable(),
  /** Timestamp when the token was created */
  created_at: z.string().datetime(),
  /** Timestamp when the token was last updated */
  updated_at: z.string().datetime(),
});

export type CliTokenDb = z.infer<typeof cliTokenDbSchema>;

// ============================================================================
// CLI Token Request Schemas
// ============================================================================

/**
 * Available scopes for CLI tokens.
 */
export const CLI_TOKEN_SCOPES = ['cli:read', 'cli:write', 'cli:admin'] as const;
export type CliTokenScope = (typeof CLI_TOKEN_SCOPES)[number];

/**
 * Available expiration periods for refresh tokens.
 * Security note: Longer expiration periods increase risk if token is compromised.
 */
export const REFRESH_TOKEN_EXPIRATION_OPTIONS = [7, 30, 90, 180, 365] as const;
export type RefreshTokenExpirationDays = (typeof REFRESH_TOKEN_EXPIRATION_OPTIONS)[number];

/**
 * Schema for creating a new CLI token.
 */
export const createCliTokenRequestSchema = z.object({
  /** User-provided name for the CLI token */
  name: z.string().min(1).max(255),
  /** Allowed scopes for this token */
  scopes: z.array(z.enum(CLI_TOKEN_SCOPES)).optional().default(['cli:read', 'cli:write']),
  /** Refresh token expiration in days (7, 30, 90, 180, or 365). Default: 30 days */
  expirationDays: z.enum(['7', '30', '90', '180', '365']).optional().default('30').transform(val => parseInt(val, 10)),
});

export type CreateCliTokenRequest = z.infer<typeof createCliTokenRequestSchema>;

/**
 * Schema for refresh token request.
 */
export const refreshTokenRequestSchema = z.object({
  /** The refresh token to use for getting a new access token */
  refreshToken: z.string().min(1),
});

export type RefreshTokenRequest = z.infer<typeof refreshTokenRequestSchema>;

/**
 * Schema for extending CLI token expiration.
 * Requirements: Security - Allow extending existing token expiration
 */
export const extendCliTokenRequestSchema = z.object({
  /** Extension period in days (7, 30, 90, 180, or 365 days from now) */
  extensionDays: z.enum(['7', '30', '90', '180', '365']).transform(val => parseInt(val, 10)),
});

export type ExtendCliTokenRequest = z.infer<typeof extendCliTokenRequestSchema>;

// ============================================================================
// CLI Token Response Schemas
// ============================================================================

/**
 * Schema for CLI token response (used when listing tokens).
 */
export const cliTokenResponseSchema = z.object({
  /** Unique identifier for the CLI token */
  id: z.string().uuid(),
  /** User-provided name for the CLI token */
  name: z.string(),
  /** Allowed scopes for this token */
  scopes: z.array(z.string()),
  /** Timestamp when the token was created */
  createdAt: z.string().datetime(),
  /** Timestamp when the token was last used (null if never used) */
  lastUsedAt: z.string().datetime().nullable(),
  /** Timestamp when the refresh token expires */
  expiresAt: z.string().datetime(),
  /** Whether the token is currently active */
  isActive: z.boolean(),
});

export type CliTokenResponse = z.infer<typeof cliTokenResponseSchema>;

/**
 * Schema for CLI token creation response (includes tokens).
 */
export const createCliTokenResponseSchema = z.object({
  /** Unique identifier for the CLI token */
  id: z.string().uuid(),
  /** Access token (short-lived, 15 minutes) */
  accessToken: z.string(),
  /** Refresh token (long-lived, 30 days) - only returned once at creation */
  refreshToken: z.string(),
  /** User-provided name for the CLI token */
  name: z.string(),
  /** Allowed scopes for this token */
  scopes: z.array(z.string()),
  /** Timestamp when the access token expires */
  accessTokenExpiresAt: z.string().datetime(),
  /** Timestamp when the refresh token expires */
  refreshTokenExpiresAt: z.string().datetime(),
  /** Timestamp when the token was created */
  createdAt: z.string().datetime(),
});

export type CreateCliTokenResponse = z.infer<typeof createCliTokenResponseSchema>;

/**
 * Schema for token refresh response.
 */
export const refreshTokenResponseSchema = z.object({
  /** New access token */
  accessToken: z.string(),
  /** Timestamp when the access token expires */
  expiresAt: z.string().datetime(),
});

export type RefreshTokenResponse = z.infer<typeof refreshTokenResponseSchema>;

// ============================================================================
// JWT Payload Schema
// ============================================================================

/**
 * Schema for CLI JWT access token payload.
 */
export const cliJwtPayloadSchema = z.object({
  /** Subject (user ID) */
  sub: z.string().uuid(),
  /** Token ID (CLI token ID) */
  tid: z.string().uuid(),
  /** Allowed scopes */
  scopes: z.array(z.string()),
  /** Token type */
  type: z.literal('cli_access'),
  /** Issued at timestamp */
  iat: z.number(),
  /** Expiration timestamp */
  exp: z.number(),
});

export type CliJwtPayload = z.infer<typeof cliJwtPayloadSchema>;
