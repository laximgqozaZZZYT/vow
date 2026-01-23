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
export declare class ApiKeyRepository extends BaseRepository<ApiKeyDb> {
    /**
     * Initialize the ApiKeyRepository.
     *
     * @param supabase - The Supabase client instance.
     */
    constructor(supabase: SupabaseClient);
    /**
     * Find an API key by its hash.
     *
     * Used for validating API keys during authentication. Only returns
     * active (non-revoked) keys.
     *
     * Requirements: 1.2 - Store key hash with associated user ID
     *
     * @param keyHash - The SHA-256 hash of the API key.
     * @returns The API key record if found and active, null otherwise.
     */
    findByKeyHash(keyHash: string): Promise<ApiKeyDb | null>;
    /**
     * Find all active API keys for a user.
     *
     * Used for listing a user's API keys in the management UI.
     * Only returns active (non-revoked) keys.
     *
     * Requirements: 1.4 - Support listing active keys
     *
     * @param userId - The unique identifier of the user.
     * @returns List of active API key records for the user.
     */
    findActiveByUserId(userId: string): Promise<ApiKeyDb[]>;
    /**
     * Count active API keys for a user.
     *
     * Used to enforce the maximum API key limit per user.
     *
     * Requirements: 1.4 - Support key limit enforcement
     *
     * @param userId - The unique identifier of the user.
     * @returns The count of active API keys for the user.
     */
    countActiveByUserId(userId: string): Promise<number>;
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
    markRevoked(id: string): Promise<ApiKeyDb | null>;
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
    updateLastUsed(id: string): Promise<void>;
}
//# sourceMappingURL=apiKeyRepository.d.ts.map