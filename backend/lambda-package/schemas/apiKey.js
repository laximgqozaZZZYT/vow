/**
 * API Key Schemas
 *
 * Zod schemas for API key management used by embeddable dashboard widgets.
 * These schemas define data structures for API key creation, validation,
 * and response formatting.
 *
 * Requirements: 1.1, 1.3
 */
import { z } from 'zod';
// ============================================================================
// API Key Database Schema
// ============================================================================
/**
 * Schema for API key data from database.
 * Requirements: 1.1, 1.2 - API key storage with hash and metadata
 */
export const apiKeyDbSchema = z.object({
    /** Unique identifier for the API key */
    id: z.string().uuid(),
    /** User ID who owns this API key */
    user_id: z.string().uuid(),
    /** SHA-256 hash of the full API key */
    key_hash: z.string(),
    /** First 8 characters of the key for display purposes */
    key_prefix: z.string().length(8),
    /** User-provided name for the API key */
    name: z.string().min(1).max(100),
    /** Timestamp when the key was created */
    created_at: z.string().datetime(),
    /** Timestamp when the key was last used (null if never used) */
    last_used_at: z.string().datetime().nullable(),
    /** Timestamp when the key was revoked (null if active) */
    revoked_at: z.string().datetime().nullable(),
    /** Whether the key is currently active */
    is_active: z.boolean(),
});
// ============================================================================
// API Key Request Schemas
// ============================================================================
/**
 * Schema for creating a new API key.
 * Requirements: 1.1 - API key generation request
 */
export const createApiKeyRequestSchema = z.object({
    /** User-provided name for the API key */
    name: z.string().min(1).max(100),
});
// ============================================================================
// API Key Response Schemas
// ============================================================================
/**
 * Schema for API key response (used when listing keys).
 * Requirements: 1.3 - Return masked values and creation dates
 */
export const apiKeyResponseSchema = z.object({
    /** Unique identifier for the API key */
    id: z.string().uuid(),
    /** First 8 characters of the key for display (masked) */
    keyPrefix: z.string(),
    /** User-provided name for the API key */
    name: z.string(),
    /** Timestamp when the key was created */
    createdAt: z.string().datetime(),
    /** Timestamp when the key was last used (null if never used) */
    lastUsedAt: z.string().datetime().nullable(),
    /** Whether the key is currently active */
    isActive: z.boolean(),
});
/**
 * Schema for API key creation response (includes full key).
 * Requirements: 1.1 - Return full key only at creation time
 */
export const createApiKeyResponseSchema = z.object({
    /** Unique identifier for the API key */
    id: z.string().uuid(),
    /** Full API key (only returned once at creation) */
    key: z.string(),
    /** First 8 characters of the key for display */
    keyPrefix: z.string(),
    /** User-provided name for the API key */
    name: z.string(),
    /** Timestamp when the key was created */
    createdAt: z.string().datetime(),
});
// ============================================================================
// Widget Request/Response Schemas
// ============================================================================
/**
 * Schema for habit completion request.
 * Requirements: 5.1 - Record completion activity with amount
 */
export const habitCompleteRequestSchema = z.object({
    /** Amount to complete (defaults to 1) */
    amount: z.number().positive().default(1),
});
/**
 * Schema for sticky toggle response.
 * Requirements: 5.2 - Toggle sticky completion status
 */
export const stickyToggleResponseSchema = z.object({
    /** Unique identifier for the sticky */
    id: z.string().uuid(),
    /** Display name of the sticky */
    name: z.string(),
    /** Current completion status */
    completed: z.boolean(),
    /** Timestamp when completed (null if not completed) */
    completedAt: z.string().datetime().nullable(),
});
//# sourceMappingURL=apiKey.js.map