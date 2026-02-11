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
/**
 * Schema for API key data from database.
 * Requirements: 1.1, 1.2 - API key storage with hash and metadata
 */
export declare const apiKeyDbSchema: z.ZodObject<{
    /** Unique identifier for the API key */
    id: z.ZodString;
    /** User ID who owns this API key */
    user_id: z.ZodString;
    /** SHA-256 hash of the full API key */
    key_hash: z.ZodString;
    /** First 8 characters of the key for display purposes */
    key_prefix: z.ZodString;
    /** User-provided name for the API key */
    name: z.ZodString;
    /** Timestamp when the key was created */
    created_at: z.ZodString;
    /** Timestamp when the key was last used (null if never used) */
    last_used_at: z.ZodNullable<z.ZodString>;
    /** Timestamp when the key expires (optional for legacy keys) */
    expires_at: z.ZodOptional<z.ZodString>;
    /** Timestamp when the key was revoked (null if active) */
    revoked_at: z.ZodNullable<z.ZodString>;
    /** Whether the key is currently active */
    is_active: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    name: string;
    created_at: string;
    id: string;
    user_id: string;
    is_active: boolean;
    key_hash: string;
    key_prefix: string;
    last_used_at: string | null;
    revoked_at: string | null;
    expires_at?: string | undefined;
}, {
    name: string;
    created_at: string;
    id: string;
    user_id: string;
    is_active: boolean;
    key_hash: string;
    key_prefix: string;
    last_used_at: string | null;
    revoked_at: string | null;
    expires_at?: string | undefined;
}>;
export type ApiKeyDb = z.infer<typeof apiKeyDbSchema>;
/**
 * Available expiration periods for API keys.
 * Security note: Longer expiration periods increase risk if key is compromised.
 */
export declare const API_KEY_EXPIRATION_OPTIONS: readonly [7, 30, 90, 180, 365];
export type ApiKeyExpirationDays = (typeof API_KEY_EXPIRATION_OPTIONS)[number];
/**
 * Schema for creating a new API key.
 * Requirements: 1.1 - API key generation request
 */
export declare const createApiKeyRequestSchema: z.ZodObject<{
    /** User-provided name for the API key */
    name: z.ZodString;
    /** Expiration in days (7, 30, 90, 180, or 365). Default: 365 days */
    expirationDays: z.ZodEffects<z.ZodDefault<z.ZodOptional<z.ZodEnum<["7", "30", "90", "180", "365"]>>>, number, "7" | "30" | "90" | "180" | "365" | undefined>;
}, "strip", z.ZodTypeAny, {
    name: string;
    expirationDays: number;
}, {
    name: string;
    expirationDays?: "7" | "30" | "90" | "180" | "365" | undefined;
}>;
export type CreateApiKeyRequest = z.infer<typeof createApiKeyRequestSchema>;
/**
 * Schema for extending API key expiration.
 * Requirements: Security - Allow extending existing key expiration
 */
export declare const extendApiKeyRequestSchema: z.ZodObject<{
    /** Extension period in days (7, 30, 90, 180, or 365 days from now) */
    extensionDays: z.ZodEffects<z.ZodEnum<["7", "30", "90", "180", "365"]>, number, "7" | "30" | "90" | "180" | "365">;
}, "strip", z.ZodTypeAny, {
    extensionDays: number;
}, {
    extensionDays: "7" | "30" | "90" | "180" | "365";
}>;
export type ExtendApiKeyRequest = z.infer<typeof extendApiKeyRequestSchema>;
/**
 * Schema for API key response (used when listing keys).
 * Requirements: 1.3 - Return masked values and creation dates
 */
export declare const apiKeyResponseSchema: z.ZodObject<{
    /** Unique identifier for the API key */
    id: z.ZodString;
    /** First 8 characters of the key for display (masked) */
    keyPrefix: z.ZodString;
    /** User-provided name for the API key */
    name: z.ZodString;
    /** Timestamp when the key was created */
    createdAt: z.ZodString;
    /** Timestamp when the key was last used (null if never used) */
    lastUsedAt: z.ZodNullable<z.ZodString>;
    /** Timestamp when the key expires */
    expiresAt: z.ZodString;
    /** Whether the key is currently active */
    isActive: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    name: string;
    id: string;
    isActive: boolean;
    expiresAt: string;
    keyPrefix: string;
    createdAt: string;
    lastUsedAt: string | null;
}, {
    name: string;
    id: string;
    isActive: boolean;
    expiresAt: string;
    keyPrefix: string;
    createdAt: string;
    lastUsedAt: string | null;
}>;
export type ApiKeyResponse = z.infer<typeof apiKeyResponseSchema>;
/**
 * Schema for API key creation response (includes full key).
 * Requirements: 1.1 - Return full key only at creation time
 */
export declare const createApiKeyResponseSchema: z.ZodObject<{
    /** Unique identifier for the API key */
    id: z.ZodString;
    /** Full API key (only returned once at creation) */
    key: z.ZodString;
    /** First 8 characters of the key for display */
    keyPrefix: z.ZodString;
    /** User-provided name for the API key */
    name: z.ZodString;
    /** Timestamp when the key was created */
    createdAt: z.ZodString;
    /** Timestamp when the key expires */
    expiresAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    id: string;
    expiresAt: string;
    key: string;
    keyPrefix: string;
    createdAt: string;
}, {
    name: string;
    id: string;
    expiresAt: string;
    key: string;
    keyPrefix: string;
    createdAt: string;
}>;
export type CreateApiKeyResponse = z.infer<typeof createApiKeyResponseSchema>;
/**
 * Schema for habit completion request.
 * Requirements: 5.1 - Record completion activity with amount
 */
export declare const habitCompleteRequestSchema: z.ZodObject<{
    /** Amount to complete (defaults to 1) */
    amount: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    amount: number;
}, {
    amount?: number | undefined;
}>;
export type HabitCompleteRequest = z.infer<typeof habitCompleteRequestSchema>;
/**
 * Schema for sticky toggle response.
 * Requirements: 5.2 - Toggle sticky completion status
 */
export declare const stickyToggleResponseSchema: z.ZodObject<{
    /** Unique identifier for the sticky */
    id: z.ZodString;
    /** Display name of the sticky */
    name: z.ZodString;
    /** Current completion status */
    completed: z.ZodBoolean;
    /** Timestamp when completed (null if not completed) */
    completedAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    id: string;
    completed: boolean;
    completedAt: string | null;
}, {
    name: string;
    id: string;
    completed: boolean;
    completedAt: string | null;
}>;
export type StickyToggleResponse = z.infer<typeof stickyToggleResponseSchema>;
//# sourceMappingURL=apiKey.d.ts.map