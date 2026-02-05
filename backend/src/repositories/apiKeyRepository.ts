/**
 * API Key Repository
 *
 * Database operations for api_keys table using the repository pattern.
 * Provides methods for API key lookup, validation, and lifecycle management.
 *
 * Requirements: 1.2, 1.4
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { BaseRepository } from './base.js';
import type { ApiKeyDb } from '../schemas/apiKey.js';

/**
 * Repository for API key database operations.
 *
 * This repository encapsulates all database operations for the api_keys table,
 * providing methods for querying keys by hash, user, and managing key lifecycle.
 */
export class ApiKeyRepository extends BaseRepository<ApiKeyDb> {
  /**
   * Initialize the ApiKeyRepository.
   *
   * @param supabase - The Supabase client instance.
   */
  constructor(supabase: SupabaseClient) {
    super(supabase, 'api_keys');
  }

  /**
   * Find an API key by its hash.
   *
   * Used for validating API keys during authentication. Only returns
   * active (non-revoked) keys that haven't expired.
   *
   * Requirements: 1.2 - Store key hash with associated user ID
   *
   * @param keyHash - The SHA-256 hash of the API key.
   * @returns The API key record if found and active, null otherwise.
   */
  async findByKeyHash(keyHash: string): Promise<ApiKeyDb | null> {
    // First try with expiration check
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('key_hash', keyHash)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return null;
    }

    // Check expiration if expires_at exists
    const apiKey = data as ApiKeyDb;
    if (apiKey.expires_at) {
      const expiresAt = new Date(apiKey.expires_at);
      if (expiresAt <= new Date()) {
        return null; // Key has expired
      }
    }

    return apiKey;
  }

  /**
   * Find all active API keys for a user.
   *
   * Used for listing a user's API keys in the management UI.
   * Only returns active (non-revoked) keys that haven't expired.
   *
   * Requirements: 1.4 - Support listing active keys
   *
   * @param userId - The unique identifier of the user.
   * @returns List of active API key records for the user.
   */
  async findActiveByUserId(userId: string): Promise<ApiKeyDb[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error || !data) {
      return [];
    }

    // Filter out expired keys (backward compatible with keys without expires_at)
    const now = new Date();
    const keys = (data as ApiKeyDb[]).filter((key) => {
      if (!key.expires_at) return true; // Legacy keys without expiration
      return new Date(key.expires_at) > now;
    });

    return keys;
  }

  /**
   * Count active API keys for a user.
   *
   * Used to enforce the maximum API key limit per user.
   * Only counts keys that are active and not expired.
   *
   * Requirements: 1.4 - Support key limit enforcement
   *
   * @param userId - The unique identifier of the user.
   * @returns The count of active API keys for the user.
   */
  async countActiveByUserId(userId: string): Promise<number> {
    // Use findActiveByUserId to get accurate count including expiration filtering
    const keys = await this.findActiveByUserId(userId);
    return keys.length;
  }

  /**
   * Mark an API key as revoked.
   *
   * Sets is_active to false and records the revocation timestamp.
   * Revoked keys will no longer be valid for authentication.
   *
   * Requirements: 1.4 - Mark key as inactive and reject future requests
   *
   * @param id - The unique identifier of the API key to revoke.
   * @returns The updated API key record if found, null otherwise.
   */
  async markRevoked(id: string): Promise<ApiKeyDb | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      return null;
    }
    return data as ApiKeyDb;
  }

  /**
   * Update the last used timestamp for an API key.
   *
   * Called when an API key is successfully used for authentication.
   * This helps users track which keys are actively being used.
   *
   * Requirements: 1.2 - Track key usage
   *
   * @param id - The unique identifier of the API key.
   */
  async updateLastUsed(id: string): Promise<void> {
    await this.supabase
      .from(this.tableName)
      .update({
        last_used_at: new Date().toISOString(),
      })
      .eq('id', id);
  }

  /**
   * Extend the expiration of an API key.
   *
   * Sets a new expiration date for an active API key.
   * Only the owner can extend their own keys.
   *
   * @param id - The unique identifier of the API key.
   * @param userId - The user ID (for ownership verification).
   * @param newExpiresAt - The new expiration date.
   * @returns The updated API key record if found, null otherwise.
   */
  async extendExpiration(id: string, userId: string, newExpiresAt: string): Promise<ApiKeyDb | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .update({
        expires_at: newExpiresAt,
      })
      .eq('id', id)
      .eq('user_id', userId)
      .eq('is_active', true)
      .select()
      .single();

    if (error || !data) {
      return null;
    }
    return data as ApiKeyDb;
  }

  /**
   * Delete expired API keys.
   *
   * Cleans up keys that have passed their expiration date.
   * This is a maintenance operation that can be run periodically.
   *
   * @returns Number of keys deleted.
   */
  async deleteExpiredKeys(): Promise<number> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select('id');

    if (error || !data) {
      return 0;
    }
    return data.length;
  }
}
