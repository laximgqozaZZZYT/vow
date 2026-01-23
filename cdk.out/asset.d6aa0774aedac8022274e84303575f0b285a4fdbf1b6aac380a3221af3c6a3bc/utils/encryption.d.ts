/**
 * Token Encryption Utility
 *
 * Provides secure encryption/decryption for sensitive tokens using AES-256-GCM.
 * Compatible with Python's Fernet encryption format.
 *
 * Requirements:
 * - 14.1: Encrypt sensitive tokens before storage
 * - 14.2: Decrypt tokens when needed for API calls
 * - 14.3: Use AES-256-GCM for encryption
 * - 14.4: Support key rotation
 */
/**
 * Token encryption class using Web Crypto API.
 */
export declare class TokenEncryption {
    private key;
    private readonly keyBase64;
    /**
     * Initialize with encryption key.
     *
     * @param encryptionKey - Base64-encoded 32-byte key. If not provided,
     *                        reads from TOKEN_ENCRYPTION_KEY environment variable.
     * @throws Error if encryption key is not provided
     */
    constructor(encryptionKey?: string);
    /**
     * Import the encryption key for use with Web Crypto API.
     */
    private getKey;
    /**
     * Encrypt a plaintext string.
     *
     * @param plaintext - The string to encrypt
     * @returns Base64-encoded encrypted string (IV + ciphertext + tag)
     */
    encrypt(plaintext: string): Promise<string>;
    /**
     * Decrypt an encrypted string.
     *
     * @param ciphertext - Base64-encoded encrypted string
     * @returns Decrypted plaintext string
     * @throws Error if decryption fails (wrong key or corrupted data)
     */
    decrypt(ciphertext: string): Promise<string>;
    /**
     * Encrypt value if it's not null or empty.
     */
    encryptIfPresent(value: string | null | undefined): Promise<string | null>;
    /**
     * Decrypt value if it's not null or empty.
     */
    decryptIfPresent(value: string | null | undefined): Promise<string | null>;
}
/**
 * Get or create the singleton encryption instance.
 */
export declare function getEncryption(): TokenEncryption;
/**
 * Reset the singleton instance (useful for testing).
 */
export declare function resetEncryption(): void;
/**
 * Convenience function to encrypt a token.
 */
export declare function encryptToken(plaintext: string): Promise<string>;
/**
 * Convenience function to decrypt a token.
 */
export declare function decryptToken(ciphertext: string): Promise<string>;
/**
 * Generate a new encryption key.
 * @returns Base64-encoded 32-byte key
 */
export declare function generateEncryptionKey(): string;
//# sourceMappingURL=encryption.d.ts.map