/**
 * API Key Service
 *
 * Service for generating, validating, and managing API keys for embeddable
 * dashboard widgets. Uses cryptographically secure key generation and
 * SHA-256 hashing for secure storage.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */
import type { ApiKeyRepository } from '../repositories/apiKeyRepository.js';
import type { ApiKeyResponse, CreateApiKeyResponse } from '../schemas/apiKey.js';
/**
 * Error thrown when a user attempts to create more than the maximum allowed API keys.
 */
export declare class MaxKeysReachedError extends Error {
    constructor();
}
/**
 * Result of validating an API key.
 */
export interface ValidateKeyResult {
    /** User ID associated with the API key */
    userId: string;
    /** Unique identifier of the API key */
    keyId: string;
}
/**
 * Service for API key management.
 *
 * This service provides methods for generating, validating, listing, and
 * revoking API keys. It uses cryptographically secure random generation
 * for keys and SHA-256 hashing for secure storage.
 *
 * Requirements:
 * - 1.1: Generate unique, cryptographically secure API keys
 * - 1.2: Store key hash with associated user ID and creation timestamp
 * - 1.3: Return list of active keys with masked values
 * - 1.4: Mark keys as inactive and reject future requests
 * - 1.5: Limit each user to maximum of 5 active API keys
 */
export declare class ApiKeyService {
    private readonly apiKeyRepo;
    /**
     * Initialize the ApiKeyService.
     *
     * @param apiKeyRepo - Repository for API key database operations.
     */
    constructor(apiKeyRepo: ApiKeyRepository);
    /**
     * Generate a cryptographically secure random API key.
     *
     * Uses Node.js crypto.randomBytes for secure random generation.
     * The key is returned as a hexadecimal string.
     *
     * Requirements: 1.1 - Generate unique, cryptographically secure API key
     *
     * @returns A random API key string (64 hex characters).
     */
    private generateKey;
    /**
     * Hash an API key using SHA-256.
     *
     * The hash is used for secure storage and comparison.
     * The same key will always produce the same hash (deterministic).
     *
     * Requirements: 2.4 - Validate API keys by comparing hash
     *
     * @param key - The API key to hash.
     * @returns The SHA-256 hash of the key as a hexadecimal string.
     */
    private hashKey;
    /**
     * Extract the prefix from an API key for display purposes.
     *
     * @param key - The full API key.
     * @returns The first 8 characters of the key.
     */
    private getKeyPrefix;
    /**
     * Generate a new API key for a user.
     *
     * Creates a cryptographically secure API key, stores its hash in the
     * database, and returns the full key (only returned once at creation).
     *
     * Requirements:
     * - 1.1: Generate unique, cryptographically secure API key
     * - 1.2: Store key hash with associated user ID and creation timestamp
     * - 1.5: Limit each user to maximum of 5 active API keys
     *
     * @param userId - The unique identifier of the user.
     * @param name - User-provided name for the API key.
     * @returns The created API key details including the full key.
     * @throws MaxKeysReachedError if user already has 5 active keys.
     */
    createKey(userId: string, name: string): Promise<CreateApiKeyResponse>;
    /**
     * Validate an API key and return the associated user ID.
     *
     * Hashes the provided key and looks up the hash in the database.
     * Only active (non-revoked) keys will be validated successfully.
     *
     * Requirements:
     * - 2.1: Authenticate request and associate with key's owner
     * - 2.4: Validate by comparing hash of provided key against stored hashes
     *
     * @param key - The API key to validate.
     * @returns The user ID and key ID if valid, null otherwise.
     */
    validateKey(key: string): Promise<ValidateKeyResult | null>;
    /**
     * List all active API keys for a user with masked values.
     *
     * Returns only the key prefix (first 8 characters) for display,
     * never exposing the full key or key hash.
     *
     * Requirements: 1.3 - Return list of active keys with masked values
     *
     * @param userId - The unique identifier of the user.
     * @returns List of active API keys with masked values.
     */
    listKeys(userId: string): Promise<ApiKeyResponse[]>;
    /**
     * Revoke an API key.
     *
     * Marks the key as inactive so it can no longer be used for authentication.
     * Only the owner of the key can revoke it.
     *
     * Requirements: 1.4 - Mark key as inactive and reject future requests
     *
     * @param userId - The unique identifier of the user (for ownership verification).
     * @param keyId - The unique identifier of the API key to revoke.
     * @returns True if the key was revoked, false if not found or not owned by user.
     */
    revokeKey(userId: string, keyId: string): Promise<boolean>;
    /**
     * Update the last used timestamp for an API key.
     *
     * Called when an API key is successfully used for authentication.
     * This helps users track which keys are actively being used.
     *
     * @param keyId - The unique identifier of the API key.
     */
    updateLastUsed(keyId: string): Promise<void>;
    /**
     * Count active API keys for a user.
     *
     * Used to enforce the maximum API key limit per user.
     *
     * Requirements: 1.5 - Limit each user to maximum of 5 active API keys
     *
     * @param userId - The unique identifier of the user.
     * @returns The count of active API keys for the user.
     */
    countActiveKeys(userId: string): Promise<number>;
}
//# sourceMappingURL=apiKeyService.d.ts.map