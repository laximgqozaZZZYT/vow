/**
 * API Key Service
 *
 * Service for generating, validating, and managing API keys for embeddable
 * dashboard widgets. Uses cryptographically secure key generation and
 * SHA-256 hashing for secure storage.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */
import { randomBytes, createHash } from 'node:crypto';
/**
 * Maximum number of active API keys allowed per user.
 * Requirements: 1.5 - Limit each user to a maximum of 5 active API keys
 */
const MAX_KEYS_PER_USER = 5;
/**
 * Length of the generated API key in bytes (32 bytes = 64 hex characters).
 */
const KEY_LENGTH_BYTES = 32;
/**
 * Prefix length for display purposes (first 8 characters).
 */
const KEY_PREFIX_LENGTH = 8;
/**
 * Error thrown when a user attempts to create more than the maximum allowed API keys.
 */
export class MaxKeysReachedError extends Error {
    constructor() {
        super(`Maximum of ${MAX_KEYS_PER_USER} API keys allowed`);
        this.name = 'MaxKeysReachedError';
    }
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
export class ApiKeyService {
    apiKeyRepo;
    /**
     * Initialize the ApiKeyService.
     *
     * @param apiKeyRepo - Repository for API key database operations.
     */
    constructor(apiKeyRepo) {
        this.apiKeyRepo = apiKeyRepo;
    }
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
    generateKey() {
        return randomBytes(KEY_LENGTH_BYTES).toString('hex');
    }
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
    hashKey(key) {
        return createHash('sha256').update(key).digest('hex');
    }
    /**
     * Extract the prefix from an API key for display purposes.
     *
     * @param key - The full API key.
     * @returns The first 8 characters of the key.
     */
    getKeyPrefix(key) {
        return key.substring(0, KEY_PREFIX_LENGTH);
    }
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
    async createKey(userId, name) {
        // Check if user has reached the maximum number of keys
        const activeKeyCount = await this.countActiveKeys(userId);
        if (activeKeyCount >= MAX_KEYS_PER_USER) {
            throw new MaxKeysReachedError();
        }
        // Generate a new cryptographically secure key
        const key = this.generateKey();
        const keyHash = this.hashKey(key);
        const keyPrefix = this.getKeyPrefix(key);
        // Store the key in the database
        const createdKey = await this.apiKeyRepo.create({
            user_id: userId,
            key_hash: keyHash,
            key_prefix: keyPrefix,
            name,
            is_active: true,
        });
        return {
            id: createdKey.id,
            key, // Full key, only returned once at creation
            keyPrefix,
            name: createdKey.name,
            createdAt: createdKey.created_at,
        };
    }
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
    async validateKey(key) {
        // Hash the provided key
        const keyHash = this.hashKey(key);
        // Look up the key by hash
        const apiKey = await this.apiKeyRepo.findByKeyHash(keyHash);
        if (!apiKey) {
            return null;
        }
        // Key is valid - return user ID and key ID
        return {
            userId: apiKey.user_id,
            keyId: apiKey.id,
        };
    }
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
    async listKeys(userId) {
        const keys = await this.apiKeyRepo.findActiveByUserId(userId);
        return keys.map((key) => ({
            id: key.id,
            keyPrefix: key.key_prefix,
            name: key.name,
            createdAt: key.created_at,
            lastUsedAt: key.last_used_at,
            isActive: key.is_active,
        }));
    }
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
    async revokeKey(userId, keyId) {
        // First, verify the key belongs to the user
        const key = await this.apiKeyRepo.getById(keyId);
        if (!key || key.user_id !== userId) {
            return false;
        }
        // Mark the key as revoked
        const revokedKey = await this.apiKeyRepo.markRevoked(keyId);
        return revokedKey !== null;
    }
    /**
     * Update the last used timestamp for an API key.
     *
     * Called when an API key is successfully used for authentication.
     * This helps users track which keys are actively being used.
     *
     * @param keyId - The unique identifier of the API key.
     */
    async updateLastUsed(keyId) {
        await this.apiKeyRepo.updateLastUsed(keyId);
    }
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
    async countActiveKeys(userId) {
        return this.apiKeyRepo.countActiveByUserId(userId);
    }
}
//# sourceMappingURL=apiKeyService.js.map