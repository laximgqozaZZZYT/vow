/**
 * CLI Token Repository
 *
 * Database operations for cli_tokens table using the repository pattern.
 * Provides methods for CLI token lookup, validation, and lifecycle management.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { BaseRepository } from './base.js';
import type { CliTokenDb } from '../schemas/cliToken.js';

/**
 * Repository for CLI token database operations.
 *
 * This repository encapsulates all database operations for the cli_tokens table,
 * providing methods for querying tokens by hash, user, and managing token lifecycle.
 */
export class CliTokenRepository extends BaseRepository<CliTokenDb> {
  /**
   * Initialize the CliTokenRepository.
   *
   * @param supabase - The Supabase client instance.
   */
  constructor(supabase: SupabaseClient) {
    super(supabase, 'cli_tokens');
  }

  /**
   * Find a CLI token by its refresh token hash.
   *
   * Used for validating refresh tokens during token refresh.
   * Only returns active (non-revoked, non-expired) tokens.
   *
   * @param refreshTokenHash - The SHA-256 hash of the refresh token.
   * @returns The CLI token record if found and active, null otherwise.
   */
  async findByRefreshTokenHash(refreshTokenHash: string): Promise<CliTokenDb | null> {
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('refresh_token_hash', refreshTokenHash)
      .is('revoked_at', null)
      .gt('expires_at', now)
      .single();

    if (error || !data) {
      return null;
    }
    return data as CliTokenDb;
  }

  /**
   * Find all active CLI tokens for a user.
   *
   * Used for listing a user's CLI tokens in the management UI.
   * Only returns active (non-revoked) tokens.
   *
   * @param userId - The unique identifier of the user.
   * @returns List of active CLI token records for the user.
   */
  async findActiveByUserId(userId: string): Promise<CliTokenDb[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .is('revoked_at', null)
      .order('created_at', { ascending: false });

    if (error || !data) {
      return [];
    }
    return data as CliTokenDb[];
  }

  /**
   * Count active CLI tokens for a user.
   *
   * Used to enforce the maximum CLI token limit per user.
   *
   * @param userId - The unique identifier of the user.
   * @returns The count of active CLI tokens for the user.
   */
  async countActiveByUserId(userId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from(this.tableName)
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('revoked_at', null);

    if (error || count === null) {
      return 0;
    }
    return count;
  }

  /**
   * Mark a CLI token as revoked.
   *
   * Sets revoked_at timestamp. Revoked tokens will no longer be valid
   * for authentication.
   *
   * @param id - The unique identifier of the CLI token to revoke.
   * @param userId - The user ID (for ownership verification).
   * @returns The updated CLI token record if found and owned by user, null otherwise.
   */
  async markRevoked(id: string, userId: string): Promise<CliTokenDb | null> {
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from(this.tableName)
      .update({
        revoked_at: now,
        updated_at: now,
      })
      .eq('id', id)
      .eq('user_id', userId)
      .is('revoked_at', null)
      .select()
      .single();

    if (error || !data) {
      return null;
    }
    return data as CliTokenDb;
  }

  /**
   * Update the last used timestamp for a CLI token.
   *
   * Called when a CLI token is successfully used for authentication.
   * This helps users track which tokens are actively being used.
   *
   * @param id - The unique identifier of the CLI token.
   */
  async updateLastUsed(id: string): Promise<void> {
    const now = new Date().toISOString();
    await this.supabase
      .from(this.tableName)
      .update({
        last_used_at: now,
        updated_at: now,
      })
      .eq('id', id);
  }

  /**
   * Extend the expiration of a CLI token.
   *
   * Sets a new expiration date for an active CLI token.
   * Only the owner can extend their own tokens.
   *
   * @param id - The unique identifier of the CLI token.
   * @param userId - The user ID (for ownership verification).
   * @param newExpiresAt - The new expiration date.
   * @returns The updated CLI token record if found, null otherwise.
   */
  async extendExpiration(id: string, userId: string, newExpiresAt: string): Promise<CliTokenDb | null> {
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from(this.tableName)
      .update({
        expires_at: newExpiresAt,
        updated_at: now,
      })
      .eq('id', id)
      .eq('user_id', userId)
      .is('revoked_at', null)
      .select()
      .single();

    if (error || !data) {
      return null;
    }
    return data as CliTokenDb;
  }

  /**
   * Delete expired tokens for cleanup.
   *
   * Removes tokens that have expired their refresh token validity.
   * Should be called periodically as a cleanup job.
   *
   * @returns The number of tokens deleted.
   */
  async deleteExpiredTokens(): Promise<number> {
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from(this.tableName)
      .delete()
      .lt('expires_at', now)
      .select('id');

    if (error || !data) {
      return 0;
    }
    return data.length;
  }

  /**
   * Create a new CLI token.
   *
   * @param params - Token creation parameters.
   * @returns The created CLI token record.
   */
  async createToken(params: {
    userId: string;
    name: string;
    refreshTokenHash: string;
    scopes: string[];
    expiresAt: string;
  }): Promise<CliTokenDb> {
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from(this.tableName)
      .insert({
        user_id: params.userId,
        name: params.name,
        refresh_token_hash: params.refreshTokenHash,
        scopes: params.scopes,
        expires_at: params.expiresAt,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to create CLI token: ${error?.message ?? 'Unknown error'}`);
    }
    return data as CliTokenDb;
  }
}
