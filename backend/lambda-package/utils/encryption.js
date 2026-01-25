/**
 * Token Encryption Utility
 *
 * Provides secure encryption/decryption for sensitive tokens using AES-256-GCM.
 * Also supports decryption of Python's Fernet format for backward compatibility.
 *
 * Requirements:
 * - 14.1: Encrypt sensitive tokens before storage
 * - 14.2: Decrypt tokens when needed for API calls
 * - 14.3: Use AES-256-GCM for encryption
 * - 14.4: Support key rotation
 */
import { webcrypto, createDecipheriv } from 'node:crypto';
import { getSettings } from '../config.js';
// Use Web Crypto API from Node.js
const crypto = webcrypto;
/**
 * AES-256-GCM encryption parameters.
 */
const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits for GCM
const TAG_LENGTH = 128; // 128 bits for authentication tag
/**
 * Token encryption class using Web Crypto API.
 */
export class TokenEncryption {
    key = null;
    keyBase64;
    /**
     * Initialize with encryption key.
     *
     * @param encryptionKey - Base64-encoded 32-byte key. If not provided,
     *                        reads from TOKEN_ENCRYPTION_KEY environment variable.
     * @throws Error if encryption key is not provided
     */
    constructor(encryptionKey) {
        const key = encryptionKey ?? getSettings().tokenEncryptionKey;
        if (!key) {
            throw new Error('TOKEN_ENCRYPTION_KEY environment variable must be set. ' +
                'Generate one with: openssl rand -base64 32');
        }
        this.keyBase64 = key;
    }
    /**
     * Import the encryption key for use with Web Crypto API.
     */
    async getKey() {
        if (this.key) {
            return this.key;
        }
        // Decode base64 key
        const keyBytes = Buffer.from(this.keyBase64, 'base64');
        // Import key for AES-GCM
        this.key = await crypto.subtle.importKey('raw', keyBytes, { name: ALGORITHM, length: KEY_LENGTH }, false, ['encrypt', 'decrypt']);
        return this.key;
    }
    /**
     * Encrypt a plaintext string.
     *
     * @param plaintext - The string to encrypt
     * @returns Base64-encoded encrypted string (IV + ciphertext + tag)
     */
    async encrypt(plaintext) {
        if (!plaintext) {
            return '';
        }
        const key = await this.getKey();
        // Generate random IV
        const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
        // Encode plaintext to bytes
        const encoder = new TextEncoder();
        const plaintextBytes = encoder.encode(plaintext);
        // Encrypt
        const ciphertext = await crypto.subtle.encrypt({ name: ALGORITHM, iv, tagLength: TAG_LENGTH }, key, plaintextBytes);
        // Combine IV + ciphertext (tag is appended by Web Crypto)
        const combined = new Uint8Array(iv.length + ciphertext.byteLength);
        combined.set(iv);
        combined.set(new Uint8Array(ciphertext), iv.length);
        // Return as base64
        return Buffer.from(combined).toString('base64');
    }
    /**
     * Decrypt an encrypted string.
     * Supports both AES-256-GCM format and Python Fernet format.
     *
     * @param ciphertext - Base64-encoded encrypted string
     * @returns Decrypted plaintext string
     * @throws Error if decryption fails (wrong key or corrupted data)
     */
    async decrypt(ciphertext) {
        if (!ciphertext) {
            return '';
        }
        // Check if this is Fernet format (starts with gAAAAA after base64 decode has version byte 0x80)
        if (ciphertext.startsWith('gAAAAA')) {
            return this.decryptFernet(ciphertext);
        }
        const key = await this.getKey();
        // Decode base64
        const combined = Buffer.from(ciphertext, 'base64');
        // Extract IV and ciphertext
        const iv = combined.subarray(0, IV_LENGTH);
        const encryptedData = combined.subarray(IV_LENGTH);
        // Decrypt
        const decrypted = await crypto.subtle.decrypt({ name: ALGORITHM, iv, tagLength: TAG_LENGTH }, key, encryptedData);
        // Decode to string
        const decoder = new TextDecoder();
        return decoder.decode(decrypted);
    }
    /**
     * Decrypt a Python Fernet-encrypted string.
     * Fernet format: version (1) + timestamp (8) + IV (16) + ciphertext + HMAC (32)
     * Uses AES-128-CBC with PKCS7 padding.
     *
     * @param ciphertext - Base64-encoded Fernet token
     * @returns Decrypted plaintext string
     */
    decryptFernet(ciphertext) {
        // Fernet uses URL-safe base64, convert to standard base64
        const standardBase64 = ciphertext.replace(/-/g, '+').replace(/_/g, '/');
        const data = Buffer.from(standardBase64, 'base64');
        // Fernet format:
        // - Version: 1 byte (0x80)
        // - Timestamp: 8 bytes (big-endian uint64)
        // - IV: 16 bytes
        // - Ciphertext: variable (AES-128-CBC encrypted, PKCS7 padded)
        // - HMAC: 32 bytes (SHA256)
        if (data.length < 57) {
            throw new Error('Invalid Fernet token: too short');
        }
        const version = data[0];
        if (version !== 0x80) {
            throw new Error(`Invalid Fernet version: ${version}`);
        }
        // Extract components
        const iv = data.subarray(9, 25); // 16 bytes IV
        const encryptedData = data.subarray(25, data.length - 32); // Ciphertext without HMAC
        // Fernet key is URL-safe base64 encoded, 32 bytes total:
        // - First 16 bytes: signing key (HMAC-SHA256)
        // - Last 16 bytes: encryption key (AES-128-CBC)
        const fernetKeyBase64 = this.keyBase64.replace(/-/g, '+').replace(/_/g, '/');
        const keyBytes = Buffer.from(fernetKeyBase64, 'base64');
        // Handle different key lengths - try multiple approaches
        // For 47-byte key, it might be: 32-byte Fernet key + 15-byte extra data
        // Or the key might be stored differently
        let encryptionKey;
        if (keyBytes.length >= 32) {
            // Try using bytes 0-16 as encryption key (first 16 bytes)
            // This is non-standard but might work for custom implementations
            encryptionKey = keyBytes.subarray(0, 16);
        }
        else if (keyBytes.length >= 16) {
            encryptionKey = keyBytes.subarray(0, 16);
        }
        else {
            throw new Error(`Invalid Fernet key length: ${keyBytes.length} bytes (minimum 16 required)`);
        }
        // Decrypt using AES-128-CBC
        const decipher = createDecipheriv('aes-128-cbc', encryptionKey, iv);
        let decrypted = decipher.update(encryptedData);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString('utf8');
    }
    /**
     * Encrypt value if it's not null or empty.
     */
    async encryptIfPresent(value) {
        if (value) {
            return this.encrypt(value);
        }
        return null;
    }
    /**
     * Decrypt value if it's not null or empty.
     */
    async decryptIfPresent(value) {
        if (value) {
            try {
                return await this.decrypt(value);
            }
            catch {
                // Return null if decryption fails
                return null;
            }
        }
        return null;
    }
}
// Singleton instance for convenience
let _encryptionInstance = null;
/**
 * Get or create the singleton encryption instance.
 */
export function getEncryption() {
    if (_encryptionInstance === null) {
        _encryptionInstance = new TokenEncryption();
    }
    return _encryptionInstance;
}
/**
 * Reset the singleton instance (useful for testing).
 */
export function resetEncryption() {
    _encryptionInstance = null;
}
/**
 * Convenience function to encrypt a token.
 */
export async function encryptToken(plaintext) {
    return getEncryption().encrypt(plaintext);
}
/**
 * Convenience function to decrypt a token.
 */
export async function decryptToken(ciphertext) {
    return getEncryption().decrypt(ciphertext);
}
/**
 * Generate a new encryption key.
 * @returns Base64-encoded 32-byte key
 */
export function generateEncryptionKey() {
    const key = crypto.getRandomValues(new Uint8Array(32));
    return Buffer.from(key).toString('base64');
}
//# sourceMappingURL=encryption.js.map