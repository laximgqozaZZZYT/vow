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

import { webcrypto } from 'node:crypto';
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
  private key: webcrypto.CryptoKey | null = null;
  private readonly keyBase64: string;

  /**
   * Initialize with encryption key.
   *
   * @param encryptionKey - Base64-encoded 32-byte key. If not provided,
   *                        reads from TOKEN_ENCRYPTION_KEY environment variable.
   * @throws Error if encryption key is not provided
   */
  constructor(encryptionKey?: string) {
    const key = encryptionKey ?? getSettings().tokenEncryptionKey;

    if (!key) {
      throw new Error(
        'TOKEN_ENCRYPTION_KEY environment variable must be set. ' +
          'Generate one with: openssl rand -base64 32'
      );
    }

    this.keyBase64 = key;
  }

  /**
   * Import the encryption key for use with Web Crypto API.
   */
  private async getKey(): Promise<webcrypto.CryptoKey> {
    if (this.key) {
      return this.key;
    }

    // Decode base64 key
    const keyBytes = Buffer.from(this.keyBase64, 'base64');

    // Import key for AES-GCM
    this.key = await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: ALGORITHM, length: KEY_LENGTH },
      false,
      ['encrypt', 'decrypt']
    );

    return this.key;
  }

  /**
   * Encrypt a plaintext string.
   *
   * @param plaintext - The string to encrypt
   * @returns Base64-encoded encrypted string (IV + ciphertext + tag)
   */
  async encrypt(plaintext: string): Promise<string> {
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
    const ciphertext = await crypto.subtle.encrypt(
      { name: ALGORITHM, iv, tagLength: TAG_LENGTH },
      key,
      plaintextBytes
    );

    // Combine IV + ciphertext (tag is appended by Web Crypto)
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(ciphertext), iv.length);

    // Return as base64
    return Buffer.from(combined).toString('base64');
  }

  /**
   * Decrypt an encrypted string.
   *
   * @param ciphertext - Base64-encoded encrypted string
   * @returns Decrypted plaintext string
   * @throws Error if decryption fails (wrong key or corrupted data)
   */
  async decrypt(ciphertext: string): Promise<string> {
    if (!ciphertext) {
      return '';
    }

    const key = await this.getKey();

    // Decode base64
    const combined = Buffer.from(ciphertext, 'base64');

    // Extract IV and ciphertext
    const iv = combined.subarray(0, IV_LENGTH);
    const encryptedData = combined.subarray(IV_LENGTH);

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv, tagLength: TAG_LENGTH },
      key,
      encryptedData
    );

    // Decode to string
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }

  /**
   * Encrypt value if it's not null or empty.
   */
  async encryptIfPresent(value: string | null | undefined): Promise<string | null> {
    if (value) {
      return this.encrypt(value);
    }
    return null;
  }

  /**
   * Decrypt value if it's not null or empty.
   */
  async decryptIfPresent(value: string | null | undefined): Promise<string | null> {
    if (value) {
      try {
        return await this.decrypt(value);
      } catch {
        // Return null if decryption fails
        return null;
      }
    }
    return null;
  }
}

// Singleton instance for convenience
let _encryptionInstance: TokenEncryption | null = null;

/**
 * Get or create the singleton encryption instance.
 */
export function getEncryption(): TokenEncryption {
  if (_encryptionInstance === null) {
    _encryptionInstance = new TokenEncryption();
  }
  return _encryptionInstance;
}

/**
 * Reset the singleton instance (useful for testing).
 */
export function resetEncryption(): void {
  _encryptionInstance = null;
}

/**
 * Convenience function to encrypt a token.
 */
export async function encryptToken(plaintext: string): Promise<string> {
  return getEncryption().encrypt(plaintext);
}

/**
 * Convenience function to decrypt a token.
 */
export async function decryptToken(ciphertext: string): Promise<string> {
  return getEncryption().decrypt(ciphertext);
}

/**
 * Generate a new encryption key.
 * @returns Base64-encoded 32-byte key
 */
export function generateEncryptionKey(): string {
  const key = crypto.getRandomValues(new Uint8Array(32));
  return Buffer.from(key).toString('base64');
}
